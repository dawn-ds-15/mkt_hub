import { BadRequestException, ConflictException, ValidationPipe } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import {
  CreateBatchDto,
  CreateInventoryEntryDto,
  CreateInventoryItemDto,
  GetInventoryItemsQueryDto,
  UpdateBatchDto,
} from '../../../src/modules/inventory/dto/inventory.dto';

const CATEGORY_ID = 'bb5caa34-755f-42bb-aa60-c507ea7c03bf';

function createPrismaMock() {
  const prisma: any = {
    inventoryItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryBatch: {
      findFirst: jest.fn(),
      // Default: no batch-code collision and no active batches for stats recalculation
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'batch-new', ...data }),
      ),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ id: where.id, itemId: 'item-1', ...data }),
      ),
      updateMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    budgetCategory: {
      findFirst: jest.fn().mockResolvedValue({ id: CATEGORY_ID, name: 'EVENT' }),
    },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

const baseBatchDto = {
  batchCode: 'VOUCHER-072026-004',
  receivedDate: '2026-07-20',
  quantityIn: 10,
  unitPriceBeforeVat: 100000,
  vatRate: 8,
};

const existingBatch = {
  id: 'batch-1',
  batchCode: 'VOUCHER-072026-004',
  itemId: 'item-1',
  receivedDate: new Date('2026-07-20'),
  quantityIn: 10,
  currentStock: 10,
  unitPrice: new Decimal(108000),
  unitPriceBeforeVat: new Decimal(100000),
  vatRate: new Decimal(8),
  unitPriceAfterVat: new Decimal(108000),
  expenseCategoryId: CATEGORY_ID,
  expenseCategoryName: 'EVENT',
  archivedAt: null,
};

describe('InventoryService - BE_requirement_26_09_26 (§4, §6, 9.1, 9.2)', () => {
  let prisma: any;
  let audit: any;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: jest.fn().mockResolvedValue(null) };
    service = new InventoryService(prisma, audit);
  });

  // ---------------------------------------------------------------- §4
  describe('§4 expenseCategoryId / expenseCategoryName', () => {
    it('POST /items/{id}/batches stores the link and fills the name from the category', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });

      const batch = await service.createBatch(
        'item-1',
        { ...baseBatchDto, expenseCategoryId: CATEGORY_ID },
        'user-1',
      );

      expect(prisma.budgetCategory.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, archivedAt: null },
        select: { id: true, name: true },
      });
      expect(prisma.inventoryBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expenseCategoryId: CATEGORY_ID,
          expenseCategoryName: 'EVENT',
        }),
      });
      expect(batch.expenseCategoryId).toBe(CATEGORY_ID);
      expect(batch.expenseCategoryName).toBe('EVENT');
    });

    it('keeps the name sent by the FE when both fields are given', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });

      await service.createBatch(
        'item-1',
        { ...baseBatchDto, expenseCategoryId: CATEGORY_ID, expenseCategoryName: ' Sự kiện ' },
        'user-1',
      );

      expect(prisma.inventoryBatch.create.mock.calls[0][0].data.expenseCategoryName).toBe(
        'Sự kiện',
      );
    });

    it('rejects an unknown / archived category with 400 before writing', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.budgetCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createBatch('item-1', { ...baseBatchDto, expenseCategoryId: CATEGORY_ID }, 'user-1'),
      ).rejects.toThrow('Hạng mục chi phí không tồn tại hoặc đã bị xoá.');
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
    });

    it('omits the fields on create when not sent and returns them as null', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });

      const batch = await service.createBatch('item-1', { ...baseBatchDto }, 'user-1');

      const data = prisma.inventoryBatch.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('expenseCategoryId');
      expect(data).not.toHaveProperty('expenseCategoryName');
      expect(prisma.budgetCategory.findFirst).not.toHaveBeenCalled();
      expect(batch.expenseCategoryId).toBeNull();
      expect(batch.expenseCategoryName).toBeNull();
    });

    it('PATCH /batches/{id} with null clears the link', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({ ...existingBatch });

      const batch = await service.updateBatch(
        'batch-1',
        { expenseCategoryId: null, expenseCategoryName: null },
        'user-1',
      );

      const data = prisma.inventoryBatch.update.mock.calls[0][0].data;
      expect(data.expenseCategoryId).toBeNull();
      expect(data.expenseCategoryName).toBeNull();
      expect(prisma.budgetCategory.findFirst).not.toHaveBeenCalled();
      expect(batch.expenseCategoryId).toBeNull();
      expect(batch.expenseCategoryName).toBeNull();
    });

    it('PATCH /batches/{id} without the fields leaves the link unchanged', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({ ...existingBatch });

      await service.updateBatch('batch-1', { note: 'abc' }, 'user-1');

      const data = prisma.inventoryBatch.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('expenseCategoryId');
      expect(data).not.toHaveProperty('expenseCategoryName');
    });

    it('PATCH /batches/{id} can set a new category', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({
        ...existingBatch,
        expenseCategoryId: null,
        expenseCategoryName: null,
      });

      await service.updateBatch('batch-1', { expenseCategoryId: CATEGORY_ID }, 'user-1');

      expect(prisma.inventoryBatch.update.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' }),
      );
    });

    it('POST /items stores the link on the first batch (top-level fields)', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'item-1', code: 'VC-100' });
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1', code: 'VC-100', batches: [] });

      await service.createItem(
        {
          code: 'VC-100',
          name: 'VOUCHER GIẤY 100.000',
          unit: 'tờ',
          batchCode: ' VOUCHER-072026-004 ',
          quantityIn: 10,
          unitPriceBeforeVat: 100000,
          expenseCategoryId: CATEGORY_ID,
          expenseCategoryName: 'EVENT',
        },
        'user-1',
      );

      expect(prisma.inventoryBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          batchCode: 'VOUCHER-072026-004',
          expenseCategoryId: CATEGORY_ID,
          expenseCategoryName: 'EVENT',
        }),
      });
    });

    it('POST /items stores the link sent inside initialBatch', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'item-1', code: 'VC-100' });
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1', code: 'VC-100', batches: [] });

      await service.createItem(
        {
          code: 'VC-100',
          unit: 'tờ',
          initialBatch: { ...baseBatchDto, expenseCategoryId: CATEGORY_ID } as any,
        },
        'user-1',
      );

      expect(prisma.inventoryBatch.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' }),
      );
    });

    it('POST /entries stores the link on a new batch and when topping up the same batch', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1', batches: [] });

      const created = await service.createEntry(
        {
          itemId: 'item-1',
          receivedDate: '2026-07-20',
          batchCode: 'NEW-01',
          quantity: 5,
          expenseCategoryId: CATEGORY_ID,
        },
        'user-1',
      );
      expect(prisma.inventoryBatch.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' }),
      );
      expect(created.batch.expenseCategoryId).toBe(CATEGORY_ID);

      // Top-up path: same item, exact same code
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: 'batch-1', batchCode: 'VOUCHER-072026-004', itemId: 'item-1', archivedAt: null, item: { name: 'X' } },
      ]);
      prisma.inventoryBatch.findFirst.mockResolvedValue({ ...existingBatch, expenseCategoryId: null });

      await service.createEntry(
        {
          itemId: 'item-1',
          receivedDate: '2026-07-21',
          batchCode: 'VOUCHER-072026-004',
          quantity: 5,
          expenseCategoryId: null,
        },
        'user-1',
      );
      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: expect.objectContaining({
          quantityIn: 15,
          expenseCategoryId: null,
          expenseCategoryName: null,
        }),
      });
    });

    it('returns both fields on batches nested in GET /items', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          totalStock: 10,
          avgUnitPrice: new Decimal(108000),
          batches: [{ ...existingBatch }, { ...existingBatch, id: 'b2', expenseCategoryId: undefined, expenseCategoryName: undefined }],
        },
      ]);
      prisma.inventoryItem.count.mockResolvedValue(1);

      const res = await service.getItems({ page: 1, limit: 10 });

      expect(res.items[0].batches[0]).toEqual(
        expect.objectContaining({ expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' }),
      );
      expect(res.items[0].batches[1]).toEqual(
        expect.objectContaining({ expenseCategoryId: null, expenseCategoryName: null }),
      );
    });
  });

  describe('§4 DTO validation (fields are not stripped by whitelist)', () => {
    const strictPipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    it('UpdateBatchDto keeps null (clear) and accepts a uuid', async () => {
      const cleared = await strictPipe.transform(
        { expenseCategoryId: null, expenseCategoryName: null },
        { type: 'body', metatype: UpdateBatchDto },
      );
      expect(cleared.expenseCategoryId).toBeNull();
      expect(cleared.expenseCategoryName).toBeNull();

      const set = await strictPipe.transform(
        { expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' },
        { type: 'body', metatype: UpdateBatchDto },
      );
      expect(set.expenseCategoryId).toBe(CATEGORY_ID);
      expect(set.expenseCategoryName).toBe('EVENT');
    });

    it('rejects a non-uuid expenseCategoryId with 400', async () => {
      await expect(
        strictPipe.transform({ expenseCategoryId: 'abc' }, { type: 'body', metatype: UpdateBatchDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['CreateBatchDto', CreateBatchDto, { ...baseBatchDto }],
      ['CreateInventoryItemDto', CreateInventoryItemDto, { code: 'VC-100', unit: 'tờ' }],
      [
        'CreateInventoryEntryDto',
        CreateInventoryEntryDto,
        { itemId: CATEGORY_ID, receivedDate: '2026-07-20', batchCode: 'B-1', quantity: 1 },
      ],
    ])('%s keeps expenseCategoryId / expenseCategoryName', async (_name, metatype, body) => {
      const out = await pipe.transform(
        { ...body, expenseCategoryId: CATEGORY_ID, expenseCategoryName: 'EVENT' },
        { type: 'body', metatype: metatype as any },
      );
      expect(out.expenseCategoryId).toBe(CATEGORY_ID);
      expect(out.expenseCategoryName).toBe('EVENT');
    });

    it('GetInventoryItemsQueryDto keeps the new filters and validates dates', async () => {
      const out = await pipe.transform(
        { receivedFrom: '2026-07-01', receivedTo: '2026-07-31', batchCode: 'VOUCHER' },
        { type: 'query', metatype: GetInventoryItemsQueryDto },
      );
      expect(out).toEqual(
        expect.objectContaining({ receivedFrom: '2026-07-01', receivedTo: '2026-07-31', batchCode: 'VOUCHER' }),
      );
      await expect(
        pipe.transform({ receivedFrom: '01/07/2026' }, { type: 'query', metatype: GetInventoryItemsQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------- §6
  describe('§6 unique batchCode (trim + case-insensitive, non-archived)', () => {
    const conflictRow = {
      id: 'batch-9',
      batchCode: 'VOUCHER-072026-004',
      itemId: 'item-9',
      archivedAt: null,
      item: { name: 'VOUCHER GIẤY 100.000' },
    };

    it('POST /items/{id}/batches: 409 with Vietnamese message for a case/space variant', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);

      const promise = service.createBatch(
        'item-1',
        { ...baseBatchDto, batchCode: '  voucher-072026-004 ' },
        'user-1',
      );
      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'Mã batch "voucher-072026-004" đã tồn tại (VOUCHER GIẤY 100.000)',
      );

      expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual({
        batchCode: { contains: 'voucher-072026-004', mode: 'insensitive' },
        archivedAt: null,
        item: { archivedAt: null },
      });
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
      expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('matches legacy codes stored with surrounding spaces', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { ...conflictRow, batchCode: ' Voucher-072026-004  ' },
      ]);

      await expect(
        service.createBatch('item-1', { ...baseBatchDto }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('ignores codes that only contain the value and archived case variants; stores trimmed code', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { ...conflictRow, batchCode: 'VOUCHER-072026-0041' },
        { ...conflictRow, id: 'batch-old', batchCode: 'voucher-072026-004', archivedAt: new Date() },
      ]);

      await service.createBatch(
        'item-1',
        { ...baseBatchDto, batchCode: ' VOUCHER-072026-004 ' },
        'user-1',
      );

      expect(prisma.inventoryBatch.create.mock.calls[0][0].data.batchCode).toBe('VOUCHER-072026-004');
    });

    it('allows reusing the code of a deleted batch or of a batch of a deleted item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([
        { ...conflictRow, archivedAt: new Date() },
        { ...conflictRow, id: 'batch-of-deleted-item', item: { name: 'X', archivedAt: new Date() } },
      ]);

      await service.createBatch('item-1', { ...baseBatchDto }, 'user-1');

      expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ archivedAt: null, item: { archivedAt: null } }),
      );
      expect(prisma.inventoryBatch.create).toHaveBeenCalled();
    });

    it('400 when the code is blank after trim', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      await expect(
        service.createBatch('item-1', { ...baseBatchDto, batchCode: '   ' }, 'user-1'),
      ).rejects.toThrow('Mã batch không được để trống.');
    });

    it('POST /items: 409 before the item is created', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);

      await expect(
        service.createItem(
          {
            code: 'VC-200',
            unit: 'tờ',
            batchCode: 'VOUCHER-072026-004',
            quantityIn: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow('Mã batch "VOUCHER-072026-004" đã tồn tại (VOUCHER GIẤY 100.000)');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
    });

    it('POST /entries: 409 when the code belongs to another item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);

      await expect(
        service.createEntry(
          { itemId: 'item-1', receivedDate: '2026-07-20', batchCode: 'Voucher-072026-004', quantity: 1 },
          'user-1',
        ),
      ).rejects.toThrow('Mã batch "Voucher-072026-004" đã tồn tại (VOUCHER GIẤY 100.000)');
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
    });

    it('POST /entries: 409 for a case variant of a batch of the same item (no silent merge)', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-9' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);

      await expect(
        service.createEntry(
          { itemId: 'item-9', receivedDate: '2026-07-20', batchCode: 'voucher-072026-004', quantity: 1 },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('PATCH /batches/{id}: 409 against another batch, excluding the edited batch', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({ ...existingBatch, batchCode: 'OLD-CODE' });
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);

      await expect(
        service.updateBatch('batch-1', { batchCode: ' voucher-072026-004' }, 'user-1'),
      ).rejects.toThrow('Mã batch "voucher-072026-004" đã tồn tại (VOUCHER GIẤY 100.000)');

      expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual({
        batchCode: { contains: 'voucher-072026-004', mode: 'insensitive' },
        archivedAt: null,
        item: { archivedAt: null },
        id: { not: 'batch-1' },
      });
      expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
    });

    it('PATCH /batches/{id}: re-saving its own code (any case) is not a conflict', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({ ...existingBatch });

      // Same code after trim -> no lookup at all
      await service.updateBatch('batch-1', { batchCode: ' VOUCHER-072026-004 ' }, 'user-1');
      expect(prisma.inventoryBatch.findMany.mock.calls.every((c: any[]) => !c[0]?.where?.batchCode)).toBe(true);
      expect(prisma.inventoryBatch.update.mock.calls[0][0].data.batchCode).toBe('VOUCHER-072026-004');

      // Case change on itself -> lookup excludes itself, nothing else found
      await service.updateBatch('batch-1', { batchCode: 'voucher-072026-004' }, 'user-1');
      const lookup = prisma.inventoryBatch.findMany.mock.calls.find((c: any[]) => c[0]?.where?.batchCode);
      expect(lookup[0].where.id).toEqual({ not: 'batch-1' });
      expect(prisma.inventoryBatch.update.mock.calls[1][0].data.batchCode).toBe('voucher-072026-004');
    });

    it('GET /batches/check-code returns { exists, itemName } and honours excludeId', async () => {
      prisma.inventoryBatch.findMany.mockResolvedValueOnce([conflictRow]);
      await expect(service.checkBatchCode(' voucher-072026-004 ')).resolves.toEqual({
        exists: true,
        itemName: 'VOUCHER GIẤY 100.000',
      });

      prisma.inventoryBatch.findMany.mockResolvedValueOnce([]);
      await expect(service.checkBatchCode('VOUCHER-072026-004', 'batch-9')).resolves.toEqual({
        exists: false,
        itemName: null,
      });
      expect(prisma.inventoryBatch.findMany.mock.calls[1][0].where.id).toEqual({ not: 'batch-9' });

      await expect(service.checkBatchCode('   ')).resolves.toEqual({ exists: false, itemName: null });
    });
  });

  // ---------------------------------------------------------------- 9.1
  describe('9.1 GET /overview totalImportValue & totalStock', () => {
    it('adds the two totals over non-archived batches and keeps existing fields', async () => {
      prisma.inventoryBatch.findMany.mockResolvedValue([
        { status: 'active', currentStock: 4, quantityIn: 10, unitPrice: new Decimal(100), unitPriceAfterVat: new Decimal(108) },
        { status: 'depleted', currentStock: 0, quantityIn: 5, unitPrice: new Decimal(200), unitPriceAfterVat: null },
      ]);
      prisma.inventoryItem.count.mockResolvedValue(1);

      const overview = await service.getOverview();

      expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where).toEqual({ archivedAt: null });
      expect(overview).toEqual({
        totalValue: 432, // 4 × 108
        totalValueTrend: 0,
        lowStockCount: 1,
        incomingCount: 0,
        incomingNote: 'tuần này',
        activeBatches: 1,
        totalImportValue: 2080, // 10 × 108 + 5 × 200
        totalStock: 4,
      });
    });
  });

  // ---------------------------------------------------------------- 9.2
  describe('9.2 GET /items filters', () => {
    it('search also matches non-archived batch codes', async () => {
      await service.getItems({ search: 'VOUCHER-072026', page: 1, limit: 10 });

      const where = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { code: { contains: 'VOUCHER-072026', mode: 'insensitive' } },
        { name: { contains: 'VOUCHER-072026', mode: 'insensitive' } },
        {
          batches: {
            some: { archivedAt: null, batchCode: { contains: 'VOUCHER-072026', mode: 'insensitive' } },
          },
        },
      ]);
      expect(prisma.inventoryItem.count).toHaveBeenCalledWith({ where });
      // Nested batches stay "all non-archived batches of the item"
      expect(prisma.inventoryItem.findMany.mock.calls[0][0].include).toEqual({
        batches: { where: { archivedAt: null }, orderBy: { createdAt: 'desc' } },
      });
    });

    it('receivedFrom / receivedTo (inclusive) and batchCode filter on the same non-archived batch', async () => {
      await service.getItems({
        receivedFrom: '2026-07-01',
        receivedTo: '2026-07-31',
        batchCode: ' voucher ',
        page: 1,
        limit: 10,
      });

      const where = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        archivedAt: null,
        batches: {
          some: {
            archivedAt: null,
            receivedDate: {
              gte: new Date('2026-07-01T00:00:00.000Z'),
              lt: new Date('2026-08-01T00:00:00.000Z'),
            },
            batchCode: { contains: 'voucher', mode: 'insensitive' },
          },
        },
      });
    });

    it('supports only one date bound and keeps the MAX_ITEMS_LIMIT cap', async () => {
      const res = await service.getItems({ receivedTo: '2026-07-31', page: 2, limit: 50000 });

      const args = prisma.inventoryItem.findMany.mock.calls[0][0];
      expect(args.where.batches.some.receivedDate).toEqual({ lt: new Date('2026-08-01T00:00:00.000Z') });
      expect(args.take).toBe(InventoryService.MAX_ITEMS_LIMIT);
      expect(args.skip).toBe(InventoryService.MAX_ITEMS_LIMIT);
      expect(res.limit).toBe(InventoryService.MAX_ITEMS_LIMIT);
    });

    it('no batch filter when none is given', async () => {
      await service.getItems({ page: 1, limit: 10 });
      expect(prisma.inventoryItem.findMany.mock.calls[0][0].where).toEqual({ archivedAt: null });
    });
  });
});
