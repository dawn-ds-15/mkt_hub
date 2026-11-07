import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { CategoryBudgetService } from '../../../src/modules/expense/category-budget.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('CategoryBudgetService - Spec 01 (Summary, Save, Dashboard)', () => {
  let service: CategoryBudgetService;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockPrismaService = {
    budgetCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    budgetSubcategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    budgetItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    budgetValue: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    expenseRecord: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBudgetService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CategoryBudgetService>(CategoryBudgetService);
  });

  describe('getBudgetSummary', () => {
    it('should aggregate 12 months correctly across hierarchy and compute percentages', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Branding Marketing',
          sortOrder: 0,
          year: 2026,
          subcategories: [
            {
              id: 'sub-1',
              name: 'Brand Online',
              sortOrder: 0,
              items: [
                { id: 'item-1', name: 'Facebook Ads', sortOrder: 0 },
                { id: 'item-2', name: 'Google Ads', sortOrder: 1 },
              ],
            },
          ],
        },
        {
          id: 'cat-2',
          name: 'Budget Event',
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub-2',
              name: 'Event Offline',
              sortOrder: 0,
              items: [{ id: 'item-3', name: 'Workshop', sortOrder: 0 }],
            },
          ],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        // item-1: 10,000,000 in month 1 and month 2
        { itemId: 'item-1', month: 1, amount: new Decimal(10000000) },
        { itemId: 'item-1', month: 2, amount: new Decimal(10000000) },
        // item-2: 5,000,000 in month 1
        { itemId: 'item-2', month: 1, amount: new Decimal(5000000) },
        // item-3: 25,000,000 in month 12
        { itemId: 'item-3', month: 12, amount: new Decimal(25000000) },
      ]);

      const result = await service.getBudgetSummary('all', 2026);

      // cat-1 total = 20,000,000 + 5,000,000 = 25,000,000
      // cat-2 total = 25,000,000
      // totalBudget = 50,000,000
      expect(result.totalBudget).toBe(50000000);
      expect(result.categories).toHaveLength(2);

      const cat1 = result.categories[0];
      expect(cat1.yearTotal).toBe(25000000);
      expect(cat1.percentage).toBe(50);
      expect(cat1.months[0]).toBe(15000000); // 10M + 5M
      expect(cat1.months[1]).toBe(10000000); // 10M

      const cat2 = result.categories[1];
      expect(cat2.yearTotal).toBe(25000000);
      expect(cat2.percentage).toBe(50);
      expect(cat2.months[11]).toBe(25000000);
    });

    it('should handle totalBudget = 0 gracefully by setting percentage to 0', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Empty Category',
          sortOrder: 0,
          year: 2026,
          subcategories: [],
        },
      ]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([]);

      const result = await service.getBudgetSummary('proj-1', 2026);

      expect(result.totalBudget).toBe(0);
      expect(result.categories[0].percentage).toBe(0);
      expect(result.categories[0].yearTotal).toBe(0);
    });
  });

  describe('saveBudgetByProjectAndYear', () => {
    it('should validate amounts and months', async () => {
      await expect(
        service.saveBudgetByProjectAndYear('all', 2026, [
          { categoryId: 'item-1', month: 13, amount: 1000 },
        ]),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.saveBudgetByProjectAndYear('all', 2026, [
          { categoryId: 'item-1', month: 1, amount: -500 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if category is not found', async () => {
      mockPrismaService.budgetItem.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetSubcategory.findFirst.mockResolvedValue(null);

      await expect(
        service.saveBudgetByProjectAndYear('all', 2026, [
          { categoryId: 'unknown-cat', month: 1, amount: 1000 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert values when category is BudgetItem', async () => {
      mockPrismaService.budgetItem.findFirst.mockResolvedValue({
        id: 'item-1',
        name: 'Item 1',
      });
      mockPrismaService.budgetValue.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetValue.create.mockResolvedValue({ id: 'val-1' });

      const result = await service.saveBudgetByProjectAndYear(
        'all',
        2026,
        [{ categoryId: 'item-1', month: 5, amount: 10000000 }],
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith({
        data: {
          itemId: 'item-1',
          isBackup: false,
          projectId: null,
          year: 2026,
          month: 5,
          amount: new Decimal(10000000),
        },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('getBudgetDashboard', () => {
    it('should return budget dashboard with actual spent, negative remaining and usedPercentage', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Budget Brand Marketing',
          sortOrder: 0,
          year: 2026,
          subcategories: [
            {
              id: 'sub-1',
              name: 'Sub 1',
              sortOrder: 0,
              items: [{ id: 'item-1', name: 'Item 1', sortOrder: 0 }],
            },
          ],
        },
      ]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        { itemId: 'item-1', month: 1, amount: new Decimal(100000000) },
      ]);

      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp-1',
          projectId: 'proj-1',
          year: 2026,
          month: 1,
          directCost: new Decimal(0),
          overheadCost: new Decimal(0),
          lines: [
            {
              id: 'line-1',
              actualQuantity: 2,
              actualUnitPrice: new Decimal(60000000), // 120,000,000 total
            },
          ],
        },
      ]);

      const dashboard = await service.getBudgetDashboard('all', 2026);

      // totalBudget: 100M
      // actualSpent: 120M
      // remainingBudget: -20M
      // usedPercentage: 120.0
      expect(dashboard.totalBudget).toBe(100000000);
      expect(dashboard.actualSpent).toBe(120000000);
      expect(dashboard.remainingBudget).toBe(-20000000);
      expect(dashboard.usedPercentage).toBe(120);
      expect(dashboard.categories).toHaveLength(1);
      expect(dashboard.categories[0].categoryId).toBe('cat-1');
      expect(dashboard.categories[0].percentage).toBe(100);
    });

    it('should return usedPercentage = null when totalBudget is 0', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([]);
      // Legacy record without lines: its directCost still counts
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp-1',
          projectId: 'proj-1',
          year: 2026,
          month: 1,
          directCost: new Decimal(5000000),
          overheadCost: new Decimal(0),
          lines: [],
        },
      ]);

      const dashboard = await service.getBudgetDashboard('proj-1', 2026);

      expect(dashboard.totalBudget).toBe(0);
      expect(dashboard.actualSpent).toBe(5000000);
      expect(dashboard.remainingBudget).toBe(-5000000);
      expect(dashboard.usedPercentage).toBeNull();
    });
  });
});
