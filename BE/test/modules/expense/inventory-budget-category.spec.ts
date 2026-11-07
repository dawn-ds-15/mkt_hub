import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../../src/modules/audit/audit.service';
import {
  CreateExpenseLineDto,
  UpdateExpenseLineDto,
} from '../../../src/modules/expense/dto/expense.dto';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import {
  BUDGET_GROUP_GIFT_PRINT,
  BUDGET_GROUP_VAT_PHAM,
  getInventoryBudgetGroup,
  resolveInventoryBudgetCategory,
} from '../../../src/modules/expense/inventory-budget-category.util';
import { CreateInventoryTransactionDto } from '../../../src/modules/inventory/dto/inventory.dto';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const GIFT_PRINT_CAT_ID = '11111111-1111-4111-8111-111111111111';
const VAT_PHAM_CAT_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_CAT_ID = '33333333-3333-4333-8333-333333333333';
const GIFT_SUB_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_YEAR_CAT_ID = '55555555-5555-4555-8555-555555555555';

describe('BE_requirement_07_11_26_budget_category — Inventory category -> Budget category', () => {
  let expenseService: ExpenseService;
  let inventoryService: InventoryService;
  let prisma: any;
  let auditService: any;

  const budgetCategories2026 = [
    {
      id: GIFT_PRINT_CAT_ID,
      name: 'QUÀ TẶNG/ IN ẤN',
      year: 2026,
      sortOrder: 1,
      archivedAt: null,
    },
    {
      id: EVENT_CAT_ID,
      name: 'EVENT',
      year: 2026,
      sortOrder: 2,
      archivedAt: null,
    },
  ];

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj-1',
          name: 'Chiến dịch Q4',
          status: 'Active',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'proj-1',
          name: 'Chiến dịch Q4',
          status: 'Active',
        }),
      },
      expenseRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'exp-1',
          projectId: 'proj-1',
          month: 11,
          year: 2026,
          status: 'draft',
          directCost: new Decimal(0),
          project: { id: 'proj-1', name: 'Chiến dịch Q4', status: 'Active' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'exp-1' }),
      },
      expenseLine: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'line-created-1',
            createdAt: new Date('2026-11-07T10:00:00Z'),
            updatedAt: new Date('2026-11-07T10:00:00Z'),
            ...data,
          }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            expenseId: 'exp-1',
            createdAt: new Date('2026-11-07T10:00:00Z'),
            updatedAt: new Date('2026-11-07T10:00:00Z'),
            ...data,
          }),
        ),
      },
      expenseAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryItem: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockImplementation(async (...args: any[]) => {
          return prisma.inventoryItem.findFirst(...args);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'batch-1',
            itemId: 'item-1',
            currentStock: 100,
            quantityIn: 100,
            status: 'active',
            unitPrice: new Decimal(50000),
            unitPriceBeforeVat: new Decimal(50000),
            vatRate: new Decimal(0),
            unitPriceAfterVat: new Decimal(50000),
          },
        ]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'batch-created-1', ...data }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      },
      inventoryTransaction: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'tx-1',
            createdAt: data.createdAt || new Date('2026-11-07T00:00:00Z'),
            ...data,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      budgetCategory: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const year = where?.year;
          return Promise.resolve(
            budgetCategories2026.filter(
              (c) => (year === undefined || c.year === year) && !c.archivedAt,
            ),
          );
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const all = [
            ...budgetCategories2026,
            {
              id: OTHER_YEAR_CAT_ID,
              name: 'QUÀ TẶNG/ IN ẤN',
              year: 2025,
              sortOrder: 1,
              archivedAt: null,
            },
          ];
          const found = all.find((c) => c.id === where?.id && !c.archivedAt);
          return Promise.resolve(found || null);
        }),
      },
      budgetSubcategory: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.id === GIFT_SUB_ID) {
            return Promise.resolve({
              id: GIFT_SUB_ID,
              name: 'Quà tặng VIP',
              categoryId: GIFT_PRINT_CAT_ID,
              archivedAt: null,
              category: {
                id: GIFT_PRINT_CAT_ID,
                name: 'QUÀ TẶNG/ IN ẤN',
                year: 2026,
                archivedAt: null,
              },
            });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      budgetItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectExpensePlanItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      annualExpensePlanItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    prisma.$transaction = jest.fn((cb: any) => cb(prisma));

    auditService = {
      log: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    expenseService = module.get<ExpenseService>(ExpenseService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  describe('§1 Mapping rules (getInventoryBudgetGroup & resolveInventoryBudgetCategory)', () => {
    it('maps gift and print -> QUÀ TẶNG/ IN ẤN, and posm/uniform/null/unknown -> Vật phẩm', () => {
      expect(getInventoryBudgetGroup('gift')).toBe(BUDGET_GROUP_GIFT_PRINT);
      expect(getInventoryBudgetGroup('print')).toBe(BUDGET_GROUP_GIFT_PRINT);
      expect(getInventoryBudgetGroup('GIFT')).toBe(BUDGET_GROUP_GIFT_PRINT);
      expect(getInventoryBudgetGroup('posm')).toBe(BUDGET_GROUP_VAT_PHAM);
      expect(getInventoryBudgetGroup('uniform')).toBe(BUDGET_GROUP_VAT_PHAM);
      expect(getInventoryBudgetGroup(null)).toBe(BUDGET_GROUP_VAT_PHAM);
      expect(getInventoryBudgetGroup(undefined)).toBe(BUDGET_GROUP_VAT_PHAM);
      expect(getInventoryBudgetGroup('unknown_cat')).toBe(BUDGET_GROUP_VAT_PHAM);
    });

    it('resolves gift/print to real BudgetCategory ID of QUÀ TẶNG/ IN ẤN without creating new categories', async () => {
      const resGift = await resolveInventoryBudgetCategory(prisma, {
        inventoryCategory: 'gift',
        year: 2026,
      });
      expect(resGift).toEqual({
        categoryId: GIFT_PRINT_CAT_ID,
        hangMucLon: 'QUÀ TẶNG/ IN ẤN',
        targetGroup: 'QUÀ TẶNG/ IN ẤN',
        warning: null,
      });

      const resPrint = await resolveInventoryBudgetCategory(prisma, {
        inventoryCategory: 'print',
        year: 2026,
      });
      expect(resPrint.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(resPrint.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
    });

    it('resolves posm/uniform to categoryId = null and hangMucLon = "Vật phẩm" when no real "Vật phẩm" category exists in tree', async () => {
      const resPosm = await resolveInventoryBudgetCategory(prisma, {
        inventoryCategory: 'posm',
        year: 2026,
      });
      expect(resPosm).toEqual({
        categoryId: null,
        hangMucLon: 'Vật phẩm',
        targetGroup: 'Vật phẩm',
        warning: null,
      });

      const resUniform = await resolveInventoryBudgetCategory(prisma, {
        inventoryCategory: 'uniform',
        year: 2026,
      });
      expect(resUniform).toEqual({
        categoryId: null,
        hangMucLon: 'Vật phẩm',
        targetGroup: 'Vật phẩm',
        warning: null,
      });
    });

    it('resolves posm/uniform to real BudgetCategory ID when "Vật phẩm" exists in the year tree', async () => {
      prisma.budgetCategory.findMany.mockResolvedValueOnce([
        ...budgetCategories2026,
        {
          id: VAT_PHAM_CAT_ID,
          name: 'Vật phẩm',
          year: 2026,
          sortOrder: 3,
          archivedAt: null,
        },
      ]);

      const resPosm = await resolveInventoryBudgetCategory(prisma, {
        inventoryCategory: 'posm',
        year: 2026,
      });
      expect(resPosm.categoryId).toBe(VAT_PHAM_CAT_ID);
      expect(resPosm.hangMucLon).toBe('Vật phẩm');
    });
  });

  describe('§3.1 Stock-out auto-assigns budget category & returns inventoryItem.category', () => {
    it('auto-assigns QUÀ TẶNG/ IN ẤN when creating an expense line from a gift item without categoryId', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
        avgUnitPrice: new Decimal(250000),
        totalStock: 100,
      });

      const line = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Bộ ấm chén quà tặng',
          inventoryItemId: 'item-gift-1',
          actualQuantity: 4,
          plannedQuantity: 4,
        },
        'user-1',
      );

      expect(line.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(line.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
      expect(line.inventoryItem).toEqual({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
      });
      expect(line.actualAmount).toBe(1000000);
      // Only 1 out transaction created from stock deduction
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
    });

    it('auto-assigns QUÀ TẶNG/ IN ẤN when creating an expense line from a print item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-print-1',
        code: 'PRT-01',
        name: 'Brochure A4',
        unit: 'cuốn',
        category: 'print',
        avgUnitPrice: new Decimal(15000),
        totalStock: 100,
      });

      const line = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Brochure A4',
          inventoryItemId: 'item-print-1',
          actualQuantity: 10,
        },
        'user-1',
      );

      expect(line.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(line.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
      expect(line.inventoryItem?.category).toBe('print');
    });

    it('auto-assigns Vật phẩm (unassigned categoryId=null) when creating an expense line from posm or uniform item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-posm-1',
        code: 'POSM-01',
        name: 'Standee cuốn nhôm',
        unit: 'cái',
        category: 'posm',
        avgUnitPrice: new Decimal(120000),
        totalStock: 50,
      });

      const linePosm = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Standee cuốn nhôm',
          inventoryItemId: 'item-posm-1',
          actualQuantity: 2,
        },
        'user-1',
      );

      expect(linePosm.categoryId).toBeNull();
      expect(linePosm.hangMucLon).toBe('Vật phẩm');
      expect(linePosm.inventoryItem?.category).toBe('posm');

      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-uni-1',
        code: 'UNI-01',
        name: 'Áo thun đồng phục sự kiện',
        unit: 'áo',
        category: 'uniform',
        avgUnitPrice: new Decimal(95000),
        totalStock: 50,
      });

      const lineUniform = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Áo thun đồng phục sự kiện',
          inventoryItemId: 'item-uni-1',
          actualQuantity: 5,
        },
        'user-1',
      );

      expect(lineUniform.categoryId).toBeNull();
      expect(lineUniform.hangMucLon).toBe('Vật phẩm');
      expect(lineUniform.inventoryItem?.category).toBe('uniform');
    });

    it('validates optional expenseCategoryId against the year budget tree and rejects wrong-year or unknown ID', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
        avgUnitPrice: new Decimal(250000),
        totalStock: 100,
      });

      // Valid subcategory in 2026 under QUÀ TẶNG/ IN ẤN
      const lineSub = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Bộ ấm chén quà tặng',
          inventoryItemId: 'item-gift-1',
          expenseCategoryId: GIFT_SUB_ID,
          actualQuantity: 2,
          recognizedDate: '2026-11-07',
        },
        'user-1',
      );
      expect(lineSub.categoryId).toBe(GIFT_SUB_ID);
      expect(lineSub.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');

      // Wrong year category (2025 when expense is 2026) -> 400 BadRequestException
      await expect(
        expenseService.createExpenseLine(
          'exp-1',
          {
            name: 'Bộ ấm chén quà tặng',
            inventoryItemId: 'item-gift-1',
            expenseCategoryId: OTHER_YEAR_CAT_ID,
            actualQuantity: 2,
            recognizedDate: '2026-11-07',
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('supports POST /v1/inventory/transactions with inventoryItemId/expenseDate/expenseCategoryId and returns resolved budget category', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
        avgUnitPrice: new Decimal(250000),
        totalStock: 100,
      });

      const txRes = await inventoryService.createTransaction(
        {
          itemId: 'item-gift-1',
          inventoryItemId: 'item-gift-1',
          projectId: 'proj-1',
          type: 'out',
          quantity: 5,
          expenseDate: '2026-11-07',
        },
        'user-1',
      );

      expect(txRes.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(txRes.expenseCategoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(txRes.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
      expect(txRes.expenseCategoryName).toBe('QUÀ TẶNG/ IN ẤN');
      expect(txRes.inventoryItem).toEqual({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
      });
    });

    it('returns inventoryItem.category in getExpense, getExpenses, getActualExpenses, and getActualExpenseDetail', async () => {
      const sampleLine = {
        id: 'line-1',
        expenseId: 'exp-1',
        name: 'Quà tặng khách hàng',
        categoryId: GIFT_PRINT_CAT_ID,
        hangMucLon: 'QUÀ TẶNG/ IN ẤN',
        inventoryItemId: 'item-gift-1',
        actualQuantity: 3,
        quantity: 3,
        actualUnitPrice: new Decimal(200000),
        status: 'confirmed',
        recognizedDate: new Date('2026-11-07'),
        inventoryItem: {
          id: 'item-gift-1',
          code: 'GIFT-01',
          name: 'Quà tặng khách hàng',
          unit: 'hộp',
          category: 'gift',
          avgUnitPrice: new Decimal(200000),
        },
        expense: {
          id: 'exp-1',
          projectId: 'proj-1',
          project: { id: 'proj-1', name: 'Chiến dịch Q4', status: 'Active', cancelledAt: null },
        },
      };

      prisma.expenseRecord.findFirst.mockResolvedValueOnce({
        id: 'exp-1',
        projectId: 'proj-1',
        month: 11,
        year: 2026,
        directCost: new Decimal(600000),
        overheadCost: new Decimal(0),
        lines: [sampleLine],
      });
      const singleExp = await expenseService.getExpense('exp-1');
      expect(singleExp.lines[0].inventoryItem?.category).toBe('gift');

      prisma.expenseLine.count.mockResolvedValueOnce(1);
      prisma.expenseLine.findMany.mockResolvedValueOnce([sampleLine]);
      const actuals = await expenseService.getActualExpenses({ page: 1, perPage: 10 });
      expect(actuals.data[0].inventoryItem?.category).toBe('gift');
    });
  });

  describe('§3.2 Server-side guard when saving/updating expense lines', () => {
    it('overrides mismatched client categoryId/hangMucLon (e.g. client sends Vật phẩm for a gift item) and returns categoryWarning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-gift-1',
        code: 'GIFT-01',
        name: 'Bộ ấm chén quà tặng',
        unit: 'bộ',
        category: 'gift',
        avgUnitPrice: new Decimal(250000),
        totalStock: 100,
      });

      const line = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Bộ ấm chén quà tặng',
          inventoryItemId: 'item-gift-1',
          categoryId: EVENT_CAT_ID,
          hangMucLon: 'Vật phẩm',
          actualQuantity: 2,
        },
        'user-1',
      );

      expect(line.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(line.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
      expect((line as any).categoryWarning).toContain('QUÀ TẶNG/ IN ẤN');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('overrides mismatched client category on PATCH /v1/expenses/lines/:id when line has inventoryItemId', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      prisma.expenseLine.findFirst.mockResolvedValueOnce({
        id: 'line-gift-1',
        expenseId: 'exp-1',
        name: 'Bộ ấm chén quà tặng',
        status: 'draft',
        inventoryItemId: 'item-gift-1',
        categoryId: null,
        hangMucLon: 'Vật phẩm',
        actualQuantity: 2,
        deductedQuantity: 2,
        actualUnitPrice: new Decimal(250000),
        expense: { id: 'exp-1', projectId: 'proj-1', year: 2026 },
        inventoryItem: {
          id: 'item-gift-1',
          code: 'GIFT-01',
          name: 'Bộ ấm chén quà tặng',
          unit: 'bộ',
          category: 'gift',
          avgUnitPrice: new Decimal(250000),
        },
      });

      const updated = await expenseService.updateExpenseLine(
        'line-gift-1',
        {
          categoryId: EVENT_CAT_ID,
          hangMucLon: 'EVENT',
          actualQuantity: 2,
        },
        'user-1',
      );

      expect(updated.categoryId).toBe(GIFT_PRINT_CAT_ID);
      expect(updated.hangMucLon).toBe('QUÀ TẶNG/ IN ẤN');
      expect((updated as any).categoryWarning).toContain('QUÀ TẶNG/ IN ẤN');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('preserves client valid categoryId when inventoryItem.category is null/empty (backwards compatibility)', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-legacy-1',
        code: 'LEG-01',
        name: 'Vật tư cũ chưa phân loại',
        unit: 'cái',
        category: null,
        avgUnitPrice: new Decimal(100000),
        totalStock: 50,
      });

      const line = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Vật tư cũ chưa phân loại',
          inventoryItemId: 'item-legacy-1',
          categoryId: EVENT_CAT_ID,
          actualQuantity: 1,
        },
        'user-1',
      );

      expect(line.categoryId).toBe(EVENT_CAT_ID);
      expect(line.hangMucLon).toBe('EVENT');
      expect((line as any).categoryWarning).toBeUndefined();
    });

    it('preserves client-selected categoryId on lines without inventoryItemId (including amount-only lines)', async () => {
      const line = await expenseService.createExpenseLine(
        'exp-1',
        {
          name: 'Thuê hội trường',
          categoryId: EVENT_CAT_ID,
          plannedAmount: 15000000,
          actualQuantity: 1,
          actualUnitPrice: 15000000,
        },
        'user-1',
      );

      expect(line.categoryId).toBe(EVENT_CAT_ID);
      expect(line.hangMucLon).toBe('EVENT');
      expect(line.inventoryItemId).toBeNull();
    });
  });

  describe('§3.3 Batch category preservation & item.category hint', () => {
    it('keeps user-selected expenseCategoryId on batch and returns itemCategory + inventoryItem.category', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-posm-1',
        code: 'POSM-01',
        name: 'Standee cuốn nhôm',
        unit: 'cái',
        category: 'posm',
      });
      prisma.budgetCategory.findFirst.mockResolvedValue({
        id: EVENT_CAT_ID,
        name: 'EVENT',
      });

      const batch = await inventoryService.createBatch(
        'item-posm-1',
        {
          batchCode: 'BATCH-POSM-01',
          receivedDate: '2026-11-07',
          quantityIn: 20,
          unitPriceBeforeVat: 100000,
          vatRate: 10,
          expenseCategoryId: EVENT_CAT_ID,
        },
        'user-1',
      );

      // Batch keeps user's choice (EVENT) even though item.category is 'posm'
      expect(batch.expenseCategoryId).toBe(EVENT_CAT_ID);
      expect(batch.expenseCategoryName).toBe('EVENT');
      expect((batch as any).itemCategory).toBe('posm');
      expect((batch as any).inventoryItem?.category).toBe('posm');
    });
  });

  describe('DTO whitelist validation', () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    it('preserves expenseCategoryId on CreateExpenseLineDto and UpdateExpenseLineDto', async () => {
      const createValidated = await pipe.transform(
        {
          name: 'Quà tặng',
          inventoryItemId: GIFT_PRINT_CAT_ID,
          expenseCategoryId: GIFT_PRINT_CAT_ID,
        },
        { type: 'body', metatype: CreateExpenseLineDto },
      );
      expect(createValidated.expenseCategoryId).toBe(GIFT_PRINT_CAT_ID);

      const updateValidated = await pipe.transform(
        {
          expenseCategoryId: GIFT_PRINT_CAT_ID,
        },
        { type: 'body', metatype: UpdateExpenseLineDto },
      );
      expect(updateValidated.expenseCategoryId).toBe(GIFT_PRINT_CAT_ID);
    });

    it('preserves inventoryItemId, expenseDate, and expenseCategoryId on CreateInventoryTransactionDto', async () => {
      const txValidated = await pipe.transform(
        {
          inventoryItemId: GIFT_PRINT_CAT_ID,
          projectId: EVENT_CAT_ID,
          type: 'out',
          quantity: 5,
          expenseDate: '2026-11-07',
          expenseCategoryId: GIFT_PRINT_CAT_ID,
        },
        { type: 'body', metatype: CreateInventoryTransactionDto },
      );
      expect(txValidated.inventoryItemId).toBe(GIFT_PRINT_CAT_ID);
      expect(txValidated.expenseDate).toBe('2026-11-07');
      expect(txValidated.expenseCategoryId).toBe(GIFT_PRINT_CAT_ID);
    });
  });
});
