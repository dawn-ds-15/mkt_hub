import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';

describe('InventoryService - Batch Stock Recalculation & Validation', () => {
  let service: InventoryService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      inventoryBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ currentStock: 50, unitPrice: 100, unitPriceAfterVat: 100 }]),
        update: jest.fn(),
      },
      inventoryTransaction: {
        findMany: jest.fn(),
      },
      inventoryItem: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: 'item-1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', avgUnitPrice: 100 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('updateBatch recalculation', () => {
    it('recalculates currentStock = quantityIn - totalExported when quantityIn is modified', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        batchCode: 'B001',
        itemId: 'item-1',
        quantityIn: 100,
        currentStock: 70,
        archivedAt: null,
      });

      // Total exported is 30
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        { quantity: 20, type: 'out' },
        { quantity: 10, type: 'out' },
      ]);

      prisma.inventoryBatch.update.mockResolvedValue({
        id: 'batch-1',
        quantityIn: 80,
        currentStock: 50, // 80 - 30 = 50
      });

      const res = await service.updateBatch(
        'batch-1',
        { quantityIn: 80 },
        'user-1',
      );

      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantityIn: 80,
            currentStock: 50,
          }),
        }),
      );
    });

    it('rejects quantityIn < totalExported with required Vietnamese error message', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        batchCode: 'B001',
        itemId: 'item-1',
        quantityIn: 50,
        currentStock: 10,
        archivedAt: null,
      });

      // Total exported is 40
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        { quantity: 40, type: 'out' },
      ]);

      // User attempts to set quantityIn = 30 (< 40)
      await expect(
        service.updateBatch('batch-1', { quantityIn: 30 }, 'user-1'),
      ).rejects.toThrow(
        'Không thể đặt số lượng nhập là 30: batch này đã xuất 40. Số lượng nhập phải >= 40.',
      );
    });

    it('preserves existing currentStock when quantityIn is omitted', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        batchCode: 'B001',
        itemId: 'item-1',
        quantityIn: 50,
        currentStock: 25,
        note: 'old note',
        archivedAt: null,
      });
      prisma.inventoryTransaction.findMany.mockResolvedValue([]);

      prisma.inventoryBatch.update.mockResolvedValue({
        id: 'batch-1',
        note: 'new note',
        currentStock: 25,
      });

      await service.updateBatch('batch-1', { note: 'new note' }, 'user-1');

      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStock: 25,
            note: 'new note',
          }),
        }),
      );
    });

    it('subtracts returned transactions from exported total when calculating currentStock', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch-ret-1',
        batchCode: 'BRET',
        itemId: 'item-ret',
        quantityIn: 100,
        currentStock: 50,
        archivedAt: null,
      });

      // Out 40, returned 10 -> net exported is 30
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        { type: 'out', quantity: 40 },
        { type: 'in', quantity: 10, note: 'Hoàn kho từ dòng chi phí' },
      ]);

      prisma.inventoryBatch.update.mockResolvedValue({});

      await service.updateBatch('batch-ret-1', { quantityIn: 100 }, 'user-1');

      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStock: 70, // 100 - (40 - 10) = 70
          }),
        }),
      );
    });
  });

  describe('recalculateAllBatches', () => {
    it('recalculates all batches against transactions', async () => {
      prisma.inventoryBatch.findMany.mockResolvedValue([
        { id: 'b-1', itemId: 'item-1', quantityIn: 100, currentStock: 0, unitPrice: 100, transactions: [{ quantity: 25, type: 'out' }] },
        { id: 'b-2', itemId: 'item-1', quantityIn: 50, currentStock: 50, unitPrice: 100, transactions: [{ quantity: 10, type: 'out' }] },
      ]);

      prisma.inventoryBatch.update.mockResolvedValue({});

      const result = await service.recalculateAllBatches('admin-1');

      expect(result.updatedCount).toBe(2);
      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { currentStock: 75, status: 'active' }, // 100 - 25
      });
      expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'b-2' },
        data: { currentStock: 40, status: 'active' }, // 50 - 10
      });
    });

    it('filters recalculation by itemId when provided', async () => {
      prisma.inventoryBatch.findMany.mockResolvedValue([
        { id: 'b-filtered-1', itemId: 'item-spec', quantityIn: 50, currentStock: 0, unitPrice: 100, transactions: [] },
      ]);

      prisma.inventoryBatch.update.mockResolvedValue({});

      const result = await service.recalculateAllBatches('admin-1', { itemId: 'item-spec' });

      expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId: 'item-spec',
          }),
        }),
      );
      expect(result.updatedCount).toBe(1);
    });
  });
});
