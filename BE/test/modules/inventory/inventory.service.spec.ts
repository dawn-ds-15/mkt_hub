import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(async (args) => {
      if (typeof args === 'function') {
        return args(mockPrismaService);
      }
      return args;
    }),
    inventoryItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('createItem', () => {
    it('should create an inventory item with initial stock 0', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({
        id: 'item-1',
        code: 'ITEM001',
        name: 'Ao thun',
        category: 'gift',
        unit: 'cai',
        totalStock: 0,
        avgUnitPrice: new Decimal(0),
        status: 'out',
      });

      const dto = {
        code: 'ITEM001',
        name: 'Ao thun',
        category: 'gift',
        unit: 'cai',
      };

      const result = await service.createItem(dto, 'user-1');
      expect(result.code).toBe('ITEM001');
      expect(result.status).toBe('out');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'InventoryItem' }),
      );
    });

    it('should throw BadRequestException if code exists', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-0', code: 'ITEM001' });

      await expect(
        service.createItem({ code: 'ITEM001', name: 'Test', category: 'gift', unit: 'cai' }, 'user-1'),
      ).rejects.toThrow('Mã vật phẩm đã tồn tại.');
    });
  });

  describe('recalculateItemStats', () => {
    it('should calculate totalStock and weighted avgUnitPrice correctly', async () => {
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
        minThreshold: 10,
      });

      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { currentStock: 20, unitPrice: new Decimal(100) },
        { currentStock: 30, unitPrice: new Decimal(200) },
      ]);

      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      await service.recalculateItemStats('item-1');

      expect(mockPrismaService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          totalStock: 50,
          status: 'instock',
        }),
      });
    });
  });

  describe('getOverview', () => {
    it('should return correct overview statistics', async () => {
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { currentStock: 10, unitPrice: new Decimal(100), status: 'active' },
        { currentStock: 5, unitPrice: new Decimal(200), status: 'active' },
      ]);
      mockPrismaService.inventoryItem.count.mockResolvedValue(2);

      const overview = await service.getOverview();

      expect(overview.totalValue).toBe(2000); // 10*100 + 5*200 = 2000
      expect(overview.activeBatches).toBe(2);
      expect(overview.lowStockCount).toBe(2);
    });
  });

  describe('getItemBatches', () => {
    it('should always return an array of batches', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch-1', batchCode: 'BATCH001' },
      ]);

      const result = await service.getItemBatches('item-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe('createTransaction', () => {
    it('should export items for project with FIFO batch reduction', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-1',
        totalStock: 20,
        minThreshold: 5,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'Project A',
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          itemId: 'item-1',
          currentStock: 10,
          unitPrice: new Decimal(5000),
          receivedDate: new Date('2026-08-01'),
        },
        {
          id: 'batch-2',
          itemId: 'item-1',
          currentStock: 10,
          unitPrice: new Decimal(6000),
          receivedDate: new Date('2026-08-10'),
        },
      ]);
      mockPrismaService.inventoryBatch.update.mockResolvedValue({});
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-1',
        itemId: 'item-1',
        projectId: 'proj-1',
        type: 'out',
        quantity: 15,
        note: 'Dung cho su kien',
        createdAt: new Date('2026-08-21'),
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.createTransaction(
        {
          itemId: 'item-1',
          projectId: 'proj-1',
          type: 'out',
          quantity: 15,
          note: 'Dung cho su kien',
        },
        'user-1',
      );

      expect(res.id).toBe('tx-1');
      expect(res.quantity).toBe(15);
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if export quantity exceeds available stock', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch-1', currentStock: 5, unitPrice: new Decimal(5000) },
      ]);

      await expect(
        service.createTransaction(
          {
            itemId: 'item-1',
            projectId: 'proj-1',
            type: 'out',
            quantity: 10,
          },
          'user-1',
        ),
      ).rejects.toThrow();
    });

    it('should handle type: in with specific batchId', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-1',
        totalStock: 10,
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        itemId: 'item-1',
        currentStock: 5,
        unitPrice: new Decimal(5000),
        unitPriceBeforeVat: new Decimal(5000),
        vatRate: new Decimal(0),
        unitPriceAfterVat: new Decimal(5000),
      });
      mockPrismaService.inventoryBatch.update.mockResolvedValue({
        id: 'batch-1',
        currentStock: 10,
      });
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-in-1',
        itemId: 'item-1',
        batchId: 'batch-1',
        projectId: null,
        type: 'in',
        quantity: 5,
        note: 'Hoan kho tu chi phi',
        createdAt: new Date('2026-08-26'),
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.createTransaction(
        {
          itemId: 'item-1',
          batchId: 'batch-1',
          type: 'in',
          quantity: 5,
          note: 'Hoan kho tu chi phi',
        },
        'user-1',
      );

      expect(res.id).toBe('tx-in-1');
      expect(res.type).toBe('in');
      expect(res.quantity).toBe(5);
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-1' },
          data: { currentStock: 10, status: 'active' },
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'InventoryTransaction',
        }),
      );
    });

    it('should throw NotFoundException if batchId does not exist for type: in', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.createTransaction(
          {
            itemId: 'item-1',
            batchId: 'non-existing-batch',
            type: 'in',
            quantity: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow('Batch không tồn tại.');
    });

    it('should handle type: in without batchId and find active batch (FIFO)', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-active-1',
        itemId: 'item-1',
        currentStock: 10,
        unitPrice: new Decimal(6000),
        unitPriceBeforeVat: new Decimal(6000),
        vatRate: new Decimal(0),
        unitPriceAfterVat: new Decimal(6000),
      });
      mockPrismaService.inventoryBatch.update.mockResolvedValue({
        id: 'batch-active-1',
        currentStock: 15,
      });
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-in-2',
        itemId: 'item-1',
        batchId: 'batch-active-1',
        projectId: null,
        type: 'in',
        quantity: 5,
        note: 'Hoan kho auto batch',
        createdAt: new Date('2026-08-26'),
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.createTransaction(
        {
          itemId: 'item-1',
          type: 'in',
          quantity: 5,
          note: 'Hoan kho auto batch',
        },
        'user-1',
      );

      expect(res.id).toBe('tx-in-2');
      expect(res.type).toBe('in');
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-active-1' },
          data: { currentStock: 15, status: 'active' },
        }),
      );
    });

    it('should handle type: in without batchId and auto-create batch if no active batch found', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue(null);
      mockPrismaService.inventoryBatch.create.mockResolvedValue({
        id: 'batch-auto-new',
        batchCode: 'AUTO-1234567890',
        itemId: 'item-1',
        quantityIn: 5,
        currentStock: 5,
        unitPrice: new Decimal(0),
        unitPriceBeforeVat: new Decimal(0),
        vatRate: new Decimal(0),
        unitPriceAfterVat: new Decimal(0),
        status: 'active',
      });
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-in-3',
        itemId: 'item-1',
        batchId: 'batch-auto-new',
        projectId: null,
        type: 'in',
        quantity: 5,
        note: 'Hoan kho new batch',
        createdAt: new Date('2026-08-26'),
      });
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.createTransaction(
        {
          itemId: 'item-1',
          type: 'in',
          quantity: 5,
          note: 'Hoan kho new batch',
        },
        'user-1',
      );

      expect(res.id).toBe('tx-in-3');
      expect(mockPrismaService.inventoryBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item-1',
            quantityIn: 5,
            currentStock: 5,
            status: 'active',
          }),
        }),
      );
    });

    it('should throw NotFoundException if itemId does not exist', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(
        service.createTransaction(
          {
            itemId: 'non-existing-item',
            type: 'in',
            quantity: 5,
          },
          'user-1',
        ),
      ).rejects.toThrow('Vật phẩm không tồn tại.');
    });
  });

  describe('createBatch', () => {
    it('should throw ConflictException (409) if batchCode already exists', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: 'batch-1', batchCode: 'BATCH001', itemId: 'item-0', archivedAt: null, item: { name: 'Ao thun' } },
      ]);

      const dto = {
        batchCode: 'BATCH001',
        receivedDate: '2026-08-01',
        quantityIn: 10,
        unitPrice: 100,
      };

      await expect(service.createBatch('item-1', dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateBatch', () => {
    it('should throw ConflictException (409) if updated batchCode conflicts with another batch', async () => {
      mockPrismaService.inventoryBatch.findFirst
        .mockResolvedValueOnce({ id: 'batch-1', batchCode: 'BATCH001', itemId: 'item-1', quantityIn: 10, currentStock: 10, unitPrice: new Decimal(100) });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValueOnce([
        { id: 'batch-2', batchCode: 'BATCH002', itemId: 'item-2', archivedAt: null, item: { name: 'Mu' } },
      ]);

      await expect(
        service.updateBatch('batch-1', { batchCode: 'BATCH002' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should update batch and recalculate currentStock and item totalStock', async () => {
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        batchCode: 'BATCH001',
        itemId: 'item-1',
        quantityIn: 10,
        currentStock: 6,
        unitPrice: new Decimal(5000),
        archivedAt: null,
      });
      mockPrismaService.inventoryTransaction.findMany.mockResolvedValue([
        { quantity: 4, type: 'out' },
      ]);
      mockPrismaService.inventoryBatch.update.mockResolvedValue({
        id: 'batch-1',
        quantityIn: 15,
        currentStock: 11,
        status: 'active',
      });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
        minThreshold: 5,
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { currentStock: 11, unitPrice: new Decimal(5000), unitPriceAfterVat: new Decimal(5500) },
      ]);
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const updated = await service.updateBatch('batch-1', { quantityIn: 15 }, 'user-1');

      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-1' },
          data: expect.objectContaining({
            quantityIn: 15,
            currentStock: 11,
            status: 'active',
          }),
        }),
      );
      expect(mockPrismaService.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            totalStock: 11,
            status: 'instock',
          }),
        }),
      );
    });

    it('should throw BadRequestException if new quantityIn is less than total exported', async () => {
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        batchCode: 'BATCH001',
        itemId: 'item-1',
        quantityIn: 10,
        currentStock: 2,
        archivedAt: null,
      });
      mockPrismaService.inventoryTransaction.findMany.mockResolvedValue([
        { quantity: 8, type: 'out' },
      ]);

      await expect(
        service.updateBatch('batch-1', { quantityIn: 5 }, 'user-1'),
      ).rejects.toThrow('Số lượng nhập không được nhỏ hơn số lượng đã xuất');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete type: out transaction and refund stock back to batch', async () => {
      mockPrismaService.inventoryTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        itemId: 'item-1',
        batchId: 'batch-1',
        type: 'out',
        quantity: 5,
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        itemId: 'item-1',
        currentStock: 3,
        archivedAt: null,
      });
      mockPrismaService.inventoryBatch.update.mockResolvedValue({});
      mockPrismaService.inventoryTransaction.delete.mockResolvedValue({});
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
        minThreshold: 5,
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { currentStock: 8, unitPrice: new Decimal(5000) },
      ]);
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.deleteTransaction('tx-1', 'user-1');

      expect(res.id).toBe('tx-1');
      expect(res.deleted).toBe(true);
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { currentStock: 8, status: 'active' },
      });
      expect(mockPrismaService.inventoryTransaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'InventoryTransaction',
          entityId: 'tx-1',
        }),
      );
    });

    it('should delete type: in transaction and deduct stock from batch', async () => {
      mockPrismaService.inventoryTransaction.findUnique.mockResolvedValue({
        id: 'tx-2',
        itemId: 'item-1',
        batchId: 'batch-1',
        type: 'in',
        quantity: 3,
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        itemId: 'item-1',
        currentStock: 10,
        archivedAt: null,
      });
      mockPrismaService.inventoryBatch.update.mockResolvedValue({});
      mockPrismaService.inventoryTransaction.delete.mockResolvedValue({});
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { currentStock: 7, unitPrice: new Decimal(5000) },
      ]);
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      const res = await service.deleteTransaction('tx-2', 'user-1');

      expect(res.id).toBe('tx-2');
      expect(res.deleted).toBe(true);
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { currentStock: 7, status: 'active' },
      });
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      mockPrismaService.inventoryTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTransaction('non-existing-tx', 'user-1'),
      ).rejects.toThrow('Transaction không tồn tại.');
    });

    it('should throw BadRequestException if associated batch is archived/deleted', async () => {
      mockPrismaService.inventoryTransaction.findUnique.mockResolvedValue({
        id: 'tx-3',
        itemId: 'item-1',
        batchId: 'batch-deleted',
        type: 'out',
        quantity: 5,
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTransaction('tx-3', 'user-1'),
      ).rejects.toThrow('Batch liên kết đã bị xóa.');
    });
  });

  describe('VAT calculations and validation', () => {
    it('should correctly calculate unitPriceAfterVat = 8981 when unitPriceBeforeVat = 8316 and vatRate = 8', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1', archivedAt: null });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue(null);
      mockPrismaService.inventoryBatch.create.mockImplementation((args) => Promise.resolve({
        id: 'batch-vat-1',
        ...args.data,
      }));
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({ id: 'tx-vat-1' });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([]);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1' });
      mockPrismaService.inventoryItem.update.mockResolvedValue({});

      mockPrismaService.$transaction = jest.fn().mockImplementation((cb) => cb(mockPrismaService));

      const batch = await service.createBatch(
        'item-1',
        {
          batchCode: 'SLEAFLET-2026-001',
          receivedDate: '2026-07-29',
          quantityIn: 500,
          unitPriceBeforeVat: 8316,
          vatRate: 8,
        },
        'user-1',
      );

      expect(batch.vatRate).toBe(8);
      expect(batch.unitPriceBeforeVat).toBe(8316);
      expect(batch.unitPriceAfterVat).toBe(8981);
      expect(batch.unitPrice).toBe(8981);
    });

    it('should throw BadRequestException if vatRate is negative or > 100', async () => {
      await expect(
        service.createBatch(
          'item-1',
          {
            batchCode: 'BATCH-ERR-1',
            receivedDate: '2026-07-29',
            quantityIn: 100,
            unitPriceBeforeVat: 5000,
            vatRate: 150,
          },
          'user-1',
        ),
      ).rejects.toThrow('VAT rate phải nằm trong khoảng từ 0 đến 100%.');

      await expect(
        service.createBatch(
          'item-1',
          {
            batchCode: 'BATCH-ERR-2',
            receivedDate: '2026-07-29',
            quantityIn: 100,
            unitPriceBeforeVat: 5000,
            vatRate: -5,
          },
          'user-1',
        ),
      ).rejects.toThrow('VAT rate phải nằm trong khoảng từ 0 đến 100%.');
    });

    it('should throw BadRequestException if unitPriceBeforeVat is negative', async () => {
      await expect(
        service.createBatch(
          'item-1',
          {
            batchCode: 'BATCH-ERR-3',
            receivedDate: '2026-07-29',
            quantityIn: 100,
            unitPriceBeforeVat: -100,
            vatRate: 10,
          },
          'user-1',
        ),
      ).rejects.toThrow('Đơn giá trước VAT không được âm.');
    });
  });
});

