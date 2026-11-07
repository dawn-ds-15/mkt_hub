import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ExpenseService - Note & ItemId Persistence (Images 3 & 4)', () => {
  let service: ExpenseService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'proj-1', status: 'Active' }),
      },
      expenseRecord: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseLine: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryItem: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'item-decal-1', name: 'Decal dán', archivedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      inventoryTransaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('formatLine aliases', () => {
    it('provides itemId, item, and inventoryItem for dropdown binding', () => {
      const line = {
        id: 'line-1',
        expenseId: 'exp-1',
        name: 'Vật phẩm A',
        inventoryItemId: 'inv-item-123',
        quantity: 5,
        actualUnitPrice: new Decimal(50000),
        note: 'Ghi chú test',
        inventoryItem: {
          id: 'inv-item-123',
          code: 'VPA',
          name: 'Vật phẩm A',
          unit: 'cái',
          avgUnitPrice: new Decimal(50000),
        },
      };

      const formatted = service.formatLine(line as any);

      expect(formatted.inventoryItemId).toBe('inv-item-123');
      expect(formatted.itemId).toBe('inv-item-123');
      expect(formatted.item?.id).toBe('inv-item-123');
      expect(formatted.inventoryItem?.id).toBe('inv-item-123');
      expect(formatted.note).toBe('Ghi chú test');
    });
  });

  describe('saveExpense with target record id and line aliases', () => {
    it('updates existing record when id is provided and persists line notes/itemId', async () => {
      const existingRecord = {
        id: 'exp-rec-existing',
        projectId: 'proj-1',
        month: 9,
        year: 2026,
        status: 'draft',
        directCost: new Decimal(0),
        directNotes: null,
      };

      prisma.expenseRecord.findFirst.mockResolvedValue(existingRecord);
      prisma.expenseRecord.update.mockResolvedValue({
        ...existingRecord,
        directCost: new Decimal(200000),
      });

      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-decal-1',
        name: 'Decal dán',
        avgUnitPrice: new Decimal(100000),
      });

      const lineCreated = {
        id: 'line-decal-1',
        expenseId: 'exp-rec-existing',
        name: 'Decal dán',
        inventoryItemId: 'item-decal-1',
        actualQuantity: 2,
        actualUnitPrice: new Decimal(100000),
        note: 'In decal theo kích thước thiết kế mới',
      };
      prisma.expenseLine.create.mockResolvedValue(lineCreated);

      await service.saveExpense(
        {
          id: 'exp-rec-existing',
          projectId: 'proj-1',
          month: 9,
          year: 2026,
          directCost: 200000,
          lines: [
            {
              itemId: 'item-decal-1', // FE sends itemId instead of inventoryItemId
              ghiChu: 'In decal theo kích thước thiết kế mới', // FE sends ghiChu
              quantity: 2,
              unitPrice: 100000,
            } as any,
          ],
        },
        'user-1',
      );

      // Verify existing record was updated
      expect(prisma.expenseRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exp-rec-existing' },
        }),
      );

      // Verify line created with mapped inventoryItemId and note
      expect(prisma.expenseLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inventoryItemId: 'item-decal-1',
            note: 'In decal theo kích thước thiết kế mới',
          }),
        }),
      );
    });
  });
});
