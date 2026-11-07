import { Test, TestingModule } from '@nestjs/testing';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CategoryBudgetService } from '../../../src/modules/expense/category-budget.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';

describe('CategoryBudgetService', () => {
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
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    expenseRecord: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.budgetCategory.findMany.mockImplementation((args: any) => {
      if (args?.where?.id?.in) {
        return Promise.resolve(args.where.id.in.map((id: string) => ({ id })));
      }
      return Promise.resolve([]);
    });
    mockPrismaService.budgetItem.findMany.mockImplementation((args: any) => {
      if (args?.where?.id?.in) {
        return Promise.resolve(args.where.id.in.map((id: string) => ({ id })));
      }
      return Promise.resolve([]);
    });
    mockPrismaService.budgetSubcategory.findMany.mockImplementation((args: any) => {
      if (args?.where?.id?.in) {
        return Promise.resolve(args.where.id.in.map((id: string) => ({ id })));
      }
      return Promise.resolve([]);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBudgetService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CategoryBudgetService>(CategoryBudgetService);
  });

  describe('BudgetCategory CRUD', () => {
    it('should return list of categories', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Budget Brand Marketing',
          percent: new Decimal(11),
          sortOrder: 1,
          year: 2026,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getCategories(2026);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Budget Brand Marketing');
      expect(result[0].percent).toBe(11);
    });

    it('should throw ConflictException if category name already exists in same year', async () => {
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue({
        id: 'cat_01',
        name: 'Budget Brand Marketing',
        year: 2026,
      });

      await expect(
        service.createCategory({
          name: 'Budget Brand Marketing',
          percent: 11,
          year: 2026,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create new category successfully', async () => {
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetCategory.create.mockResolvedValue({
        id: 'cat_01',
        name: 'Budget Brand Marketing',
        percent: new Decimal(11),
        sortOrder: 1,
        year: 2026,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createCategory(
        {
          name: 'Budget Brand Marketing',
          percent: 11,
          sortOrder: 1,
          year: 2026,
        },
        'user_01',
      );

      expect(result.id).toBe('cat_01');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'BudgetCategory' }),
      );
    });

    it('should soft delete category', async () => {
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue({
        id: 'cat_01',
        name: 'Budget Brand Marketing',
      });
      mockPrismaService.budgetCategory.update.mockResolvedValue({
        id: 'cat_01',
        archivedAt: new Date(),
      });

      const result = await service.deleteCategory('cat_01', 'user_01');
      expect(result.success).toBe(true);
      expect(mockPrismaService.budgetCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat_01' },
        data: { archivedAt: expect.any(Date) },
      });
    });
  });

  describe('BudgetSubcategory CRUD', () => {
    it('should throw NotFoundException if parent category does not exist', async () => {
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createSubcategory({
          categoryId: 'non_existent',
          name: 'I. BRAND MARKETING',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create subcategory successfully', async () => {
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue({ id: 'cat_01' });
      mockPrismaService.budgetSubcategory.create.mockResolvedValue({
        id: 'sub_01',
        categoryId: 'cat_01',
        name: 'I. BRAND MARKETING',
        totalName: 'TOTAL BRAND MKT',
        backupPercent: new Decimal(10),
        sortOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSubcategory(
        {
          categoryId: 'cat_01',
          name: 'I. BRAND MARKETING',
          totalName: 'TOTAL BRAND MKT',
          backupPercent: 10,
        },
        'user_01',
      );

      expect(result.id).toBe('sub_01');
      expect(result.backupPercent).toBe(10);
    });
  });

  describe('BudgetItem CRUD', () => {
    it('should create item successfully', async () => {
      mockPrismaService.budgetSubcategory.findFirst.mockResolvedValue({ id: 'sub_01' });
      mockPrismaService.budgetItem.create.mockResolvedValue({
        id: 'item_01',
        subcategoryId: 'sub_01',
        name: 'Campaign',
        subCount: null,
        sortOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createItem(
        {
          subcategoryId: 'sub_01',
          name: 'Campaign',
          sortOrder: 1,
        },
        'user_01',
      );

      expect(result.id).toBe('item_01');
      expect(result.name).toBe('Campaign');
    });
  });

  describe('Budget Tree & Bulk Save', () => {
    it('should return hierarchical budget tree with 12 months data', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Budget Brand Marketing',
          percent: new Decimal(11),
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub_01',
              name: 'I. BRAND MARKETING',
              totalName: 'TOTAL BRAND MKT',
              backupPercent: new Decimal(10),
              sortOrder: 1,
              items: [
                {
                  id: 'item_01',
                  name: 'Campaign',
                  subCount: null,
                  sortOrder: 1,
                },
              ],
            },
          ],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        {
          id: 'val_01',
          itemId: 'item_01',
          subcategoryId: null,
          isBackup: false,
          year: 2026,
          month: 1,
          amount: new Decimal(10000000),
        },
        {
          id: 'val_02',
          itemId: null,
          subcategoryId: 'sub_01',
          isBackup: true,
          year: 2026,
          month: 1,
          amount: new Decimal(5000000),
        },
      ]);

      const result = await service.getBudgetTree(2026);
      expect(result.categories).toHaveLength(1);
      const cat = result.categories[0];
      expect(cat.name).toBe('Budget Brand Marketing');
      const sub = cat.subcategories[0];
      expect(sub.backup.months['1']).toBe(5000000);
      expect(sub.items[0].months['1']).toBe(10000000);
      expect(sub.items[0].months['2']).toBe(0);
    });

    it('should bulk save item values and backup values', async () => {
      mockPrismaService.budgetValue.findFirst
        .mockResolvedValueOnce(null) // insert item value
        .mockResolvedValueOnce({ id: 'existing_backup_id' }); // update backup value

      const result = await service.bulkSaveValues(
        {
          year: 2026,
          values: [
            {
              itemId: 'item_01',
              isBackup: false,
              month: 1,
              amount: 10000000,
            },
            {
              subcategoryId: 'sub_01',
              isBackup: true,
              month: 1,
              amount: 5000000,
            },
          ],
        },
        'user_01',
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item_01',
            isBackup: false,
            month: 1,
          }),
        }),
      );
      expect(mockPrismaService.budgetValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing_backup_id' },
          data: expect.objectContaining({
            amount: expect.any(Decimal),
          }),
        }),
      );
    });
    it('should throw NotFoundException if projectId does not exist in getBudgetTree', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.getBudgetTree(2026, 'invalid_project_id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return budget tree filtered by projectId', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj_01' });
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Budget Brand Marketing',
          percent: new Decimal(11),
          sortOrder: 1,
          year: 2026,
          subcategories: [],
        },
      ]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([]);

      const result = await service.getBudgetTree(2026, 'proj_01');
      expect(result.categories).toHaveLength(1);
      expect(mockPrismaService.budgetValue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2026,
            projectId: 'proj_01',
          }),
        }),
      );
    });

    it('should bulk save values with projectId', async () => {
      const validProjId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      mockPrismaService.project.findFirst.mockResolvedValue({ id: validProjId });
      mockPrismaService.budgetValue.findFirst.mockResolvedValue(null);

      const result = await service.bulkSaveValues(
        {
          year: 2026,
          projectId: validProjId,
          values: [
            {
              itemId: 'item_01',
              isBackup: false,
              month: 1,
              amount: 20000000,
            },
          ],
        },
        'user_01',
      );

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(validProjId);
      expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: validProjId,
            amount: new Decimal(20000000),
          }),
        }),
      );
    });

    it('should throw BadRequestException with per-cell errors if amount is negative in bulkSaveValues', async () => {
      try {
        await service.bulkSaveValues({
          year: 2026,
          values: [
            {
              itemId: 'item_01',
              isBackup: false,
              month: 1,
              amount: -5000,
            },
          ],
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        const response = err.getResponse();
        expect(response.message).toBe('Có ô không hợp lệ');
        expect(response.errors).toBeDefined();
        expect(response.errors[0]).toEqual({
          categoryId: null,
          itemId: 'item_01',
          subcategoryId: null,
          isBackup: false,
          month: 1,
          message: 'amount không được âm',
        });
      }
    });

    it('should throw 412 Precondition Failed if baseUpdatedAt is older than current updatedAt in DB', async () => {
      const dbDate = new Date('2026-09-02T10:00:00.000Z');
      mockPrismaService.budgetValue.findFirst.mockResolvedValue({
        id: 'val_01',
        updatedAt: dbDate,
      });

      let thrownErr: any;
      try {
        await service.bulkSaveValues({
          year: 2026,
          baseUpdatedAt: '2026-09-01T10:00:00.000Z',
          values: [
            {
              itemId: 'item_01',
              isBackup: false,
              month: 1,
              amount: 5000,
            },
          ],
        });
      } catch (err: any) {
        thrownErr = err;
      }
      expect(thrownErr).toBeDefined();
      expect(thrownErr.getStatus()).toBe(412);
      const response = thrownErr.getResponse();
      expect(response.message).toContain('Dữ liệu đã được cập nhật bởi người khác');
      expect(response.currentUpdatedAt).toBe(dbDate.toISOString());
    });

    it('should save category-level budget value when amount > 0', async () => {
      mockPrismaService.budgetValue.findFirst.mockResolvedValue(null);

      const result = await service.bulkSaveValues({
        year: 2026,
        values: [
          {
            categoryId: 'cat_01',
            month: 5,
            amount: 50000000,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 'cat_01',
            year: 2026,
            month: 5,
            amount: expect.any(Decimal),
          }),
        }),
      );
    });

    it('should update category-level budget value when amount is 0', async () => {
      mockPrismaService.budgetValue.findFirst.mockResolvedValue({
        id: 'val_cat_existing',
      });

      const result = await service.bulkSaveValues({
        year: 2026,
        values: [
          {
            categoryId: 'cat_01',
            month: 5,
            amount: 0,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);
      expect(mockPrismaService.budgetValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'val_cat_existing' },
          data: { amount: new Decimal(0) },
        }),
      );
    });

    it('should return categoryId in cell error when category-level value is negative', async () => {
      try {
        await service.bulkSaveValues({
          year: 2026,
          values: [
            {
              categoryId: 'cat_01',
              month: 3,
              amount: -1000,
            },
          ],
        });
        fail('Should throw BadRequestException');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        const res = err.getResponse();
        expect(res.errors[0]).toEqual({
          categoryId: 'cat_01',
          itemId: null,
          subcategoryId: null,
          isBackup: false,
          month: 3,
          message: 'amount không được âm',
        });
      }
    });

    it('should return categories[].months in getBudgetTree with rollup from subcategories or direct', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_rollup',
          name: 'Cat Rollup',
          percent: new Decimal(10),
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub_1',
              name: 'Sub 1',
              backupPercent: new Decimal(10),
              sortOrder: 1,
              items: [
                { id: 'item_1', name: 'Item 1', sortOrder: 1 },
              ],
            },
          ],
        },
        {
          id: 'cat_direct',
          name: 'Cat Direct',
          percent: new Decimal(20),
          sortOrder: 2,
          year: 2026,
          subcategories: [],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        {
          id: 'v1',
          itemId: 'item_1',
          subcategoryId: null,
          categoryId: null,
          isBackup: false,
          year: 2026,
          month: 1,
          amount: new Decimal(10000000),
          updatedAt: new Date(),
        },
        {
          id: 'v2',
          itemId: null,
          subcategoryId: 'sub_1',
          categoryId: null,
          isBackup: true,
          year: 2026,
          month: 1,
          amount: new Decimal(2000000),
          updatedAt: new Date(),
        },
        {
          id: 'v3',
          itemId: null,
          subcategoryId: null,
          categoryId: 'cat_direct',
          isBackup: false,
          year: 2026,
          month: 2,
          amount: new Decimal(30000000),
          updatedAt: new Date(),
        },
      ]);

      const tree = await service.getBudgetTree(2026);
      expect(tree.categories).toHaveLength(2);

      // Category without direct budget: months = {} and planTotal = 0 (Yêu cầu 8.1: no auto-rollup)
      const catRollup = tree.categories.find((c) => c.id === 'cat_rollup');
      expect(catRollup?.months).toEqual({});
      expect(catRollup?.planTotal).toBe(0);

      // Direct category: month 2 = 30M
      const catDirect = tree.categories.find((c) => c.id === 'cat_direct');
      expect(catDirect?.months).toBeDefined();
      expect(catDirect?.months['1']).toBe(0);
      expect(catDirect?.months['2']).toBe(30000000);
      expect(catDirect?.planTotal).toBe(30000000);
    });

    it('should throw 400 with cell error when categoryId does not exist in DB', async () => {
      mockPrismaService.budgetCategory.findMany.mockImplementation(() => {
        return Promise.resolve([]);
      });

      try {
        await service.bulkSaveValues({
          year: 2026,
          values: [
            {
              categoryId: 'non_existent_cat',
              month: 2,
              amount: 5000000,
            },
          ],
        });
        fail('Should throw BadRequestException');
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        const res = err.getResponse();
        expect(res.message).toBe('Có ô không hợp lệ');
        expect(res.errors[0].categoryId).toBe('non_existent_cat');
        expect(res.errors[0].message).toContain('non_existent_cat');
      }
    });

    it('should aggregate budget values across all projects when projectId=all in getBudgetTree', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_haidang',
          name: 'Category HaiDang Test',
          percent: new Decimal(10),
          sortOrder: 1,
          year: 2026,
          subcategories: [],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        {
          id: 'v_global',
          itemId: null,
          subcategoryId: null,
          categoryId: 'cat_haidang',
          projectId: null,
          isBackup: false,
          year: 2026,
          month: 2,
          amount: new Decimal(100),
          updatedAt: new Date(),
        },
        {
          id: 'v_haidang',
          itemId: null,
          subcategoryId: null,
          categoryId: 'cat_haidang',
          projectId: 'proj_haidang',
          isBackup: false,
          year: 2026,
          month: 2,
          amount: new Decimal(777),
          updatedAt: new Date(),
        },
      ]);

      const tree = await service.getBudgetTree(2026, 'all');
      expect(tree.categories).toHaveLength(1);
      const cat = tree.categories[0];
      // month 2 should be 100 + 777 = 877
      expect(cat.months['2']).toBe(877);
      expect(cat.planTotal).toBe(877);
    });
  });

  describe('Budget Permissions', () => {
    it('should return read-only permissions for specialist role', () => {
      const perms = service.getBudgetPermissions({
        id: 'u1',
        role: 'specialist',
      } as any);
      expect(perms).toEqual({
        view: true,
        edit: false,
        manageCategories: false,
        export: false,
      });
    });

    it('should return full permissions for manager role', () => {
      const perms = service.getBudgetPermissions({
        id: 'u2',
        role: 'manager',
      } as any);
      expect(perms).toEqual({
        view: true,
        edit: true,
        manageCategories: true,
        export: true,
      });
    });
  });

  describe('September Spec: Dynamic Category Budget Report', () => {
    it('should compute Plan vs Actual dynamically from Expense records', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Digital Marketing',
          percent: new Decimal(50),
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub_01',
              categoryId: 'cat_01',
              name: 'Digital Ads',
              items: [],
            },
          ],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        {
          id: 'bv_1',
          subcategoryId: 'sub_01',
          itemId: null,
          isBackup: false,
          year: 2026,
          month: 9,
          amount: new Decimal(800000000),
        },
      ]);

      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_1',
          projectId: 'prj-1',
          month: 9,
          year: 2026,
          lines: [
            {
              id: 'l_1',
              categoryId: 'cat_01',
              actualQuantity: 1,
              actualUnitPrice: new Decimal(620000000),
            },
          ],
        },
      ]);

      const report = await service.getCategoryBudgetReport(2026, 9);
      expect(report.totalPlan).toBe(800000000);
      expect(report.totalActual).toBe(620000000);
      expect(report.totalRemaining).toBe(180000000);
      expect(report.totalUsagePercent).toBe(77.5);
      expect(report.categories[0].categoryName).toBe('Digital Marketing');
      expect(report.categories[0].remaining).toBe(180000000);
      expect(report.categories[0].usagePercent).toBe(77.5);
    });

    it('should filter out field: actual and reject negative amount in bulkSaveValues', async () => {
      // Negative amount should throw BadRequestException
      let errorThrown: any = null;
      try {
        await service.bulkSaveValues({
          year: 2026,
          values: [
            {
              itemId: 'it_1',
              month: 1,
              amount: -500000,
            },
          ],
        });
      } catch (err) {
        errorThrown = err;
      }
      expect(errorThrown).toBeInstanceOf(BadRequestException);

      // Filtering field: actual
      mockPrismaService.budgetValue.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetValue.create.mockResolvedValue({});

      const result = await service.bulkSaveValues({
        year: 2026,
        values: [
          {
            itemId: 'it_1',
            month: 1,
            amount: 5000000,
            field: 'actual', // should be ignored
          } as any,
          {
            itemId: 'it_1',
            month: 1,
            amount: 10000000,
            field: 'plan',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1); // Only 1 plan item saved
    });

    it('should return actuals keyed by category_id in getCategoryBudgetActuals', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Budget Brand Marketing',
          subcategories: [
            {
              id: 'sub_01',
              items: [{ id: 'it_01' }],
            },
          ],
        },
      ]);

      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_1',
          month: 3,
          year: 2026,
          lines: [
            {
              id: 'l_1',
              categoryId: 'it_01',
              actualQuantity: 2,
              actualUnitPrice: new Decimal(2500000),
            },
          ],
        },
      ]);

      const res = await service.getCategoryBudgetActuals(2026);
      expect(res['cat_01']).toBeDefined();
      expect(res['cat_01']['3']).toBe(5000000);
      expect(res['cat_01']['total']).toBe(5000000);
      expect(res['budget brand marketing']).toBeDefined();
    });

    it('should include item/sub actuals and category totals in getBudgetTree', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Budget Brand Marketing',
          percent: new Decimal(11),
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub_01',
              name: 'Brand Sub',
              totalName: null,
              sortOrder: 1,
              backupPercent: new Decimal(0),
              items: [
                {
                  id: 'it_01',
                  name: 'Brand Item',
                  subCount: null,
                  sortOrder: 1,
                },
              ],
            },
          ],
        },
      ]);

      mockPrismaService.budgetValue.findMany.mockResolvedValue([
        {
          id: 'bv_cat_1',
          categoryId: 'cat_01',
          itemId: null,
          subcategoryId: null,
          isBackup: false,
          year: 2026,
          month: 1,
          amount: new Decimal(10000000),
        },
        {
          id: 'bv_1',
          itemId: 'it_01',
          subcategoryId: null,
          isBackup: false,
          year: 2026,
          month: 1,
          amount: new Decimal(10000000),
        },
      ]);

      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_1',
          month: 1,
          year: 2026,
          lines: [
            {
              id: 'l_1',
              categoryId: 'it_01',
              actualQuantity: 1,
              actualUnitPrice: new Decimal(6000000),
            },
          ],
        },
      ]);

      const tree = await service.getBudgetTree(2026);
      expect(tree.categories).toHaveLength(1);
      const cat = tree.categories[0];
      expect(cat.planTotal).toBe(10000000);
      expect(cat.actualTotal).toBe(6000000);
      expect(cat.remaining).toBe(4000000);
      expect(cat.usagePercent).toBe(60);

      const sub = cat.subcategories[0];
      expect(sub.actuals['1']).toBe(6000000);

      const item = sub.items[0];
      expect(item.actuals['1']).toBe(6000000);
    });

    it('should use before-VAT line amounts, count draft lines, and add batches booked to a category (§1, §4)', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'EVENT',
          percent: new Decimal(10),
          sortOrder: 1,
          year: 2026,
          subcategories: [],
        },
      ]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([]);
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_1',
          projectId: 'prj-1',
          month: 9,
          year: 2026,
          lines: [
            {
              id: 'l_1',
              status: 'draft',
              categoryId: 'cat_01',
              recognizedDate: new Date('2026-03-15'),
              actualQuantity: 2,
              unitPriceBeforeVatSnapshot: new Decimal(1000000),
              unitPriceAfterVatSnapshot: new Decimal(1080000),
              actualUnitPrice: new Decimal(1080000),
            },
            {
              id: 'l_cancelled',
              status: 'cancelled',
              categoryId: 'cat_01',
              recognizedDate: new Date('2026-03-15'),
              actualQuantity: 1,
              actualUnitPrice: new Decimal(999),
            },
          ],
        },
      ]);
      const batchFindMany = jest.fn().mockResolvedValue([
        {
          expenseCategoryId: 'cat_01',
          receivedDate: new Date('2026-05-02'),
          quantityIn: 10,
          unitPriceBeforeVat: new Decimal(50000),
        },
      ]);
      (mockPrismaService as any).inventoryBatch = { findMany: batchFindMany };

      try {
        const tree = await service.getBudgetTree(2026, 'all');
        const cat = tree.categories[0];
        expect(cat.actuals['3']).toBe(2000000); // 2 × 1,000,000 before VAT, draft counted
        expect(cat.actuals['5']).toBe(500000); // batch: 10 × 50,000
        expect(cat.actualTotal).toBe(2500000);
        expect(batchFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ expenseCategoryId: { not: null } }),
          }),
        );

        // A single project's view excludes company-level batches
        batchFindMany.mockClear();
        const projectTree = await service.getBudgetTree(2026, 'prj-1');
        expect(projectTree.categories[0].actualTotal).toBe(2000000);
        expect(batchFindMany).not.toHaveBeenCalled();
      } finally {
        delete (mockPrismaService as any).inventoryBatch;
      }
    });

    it('tree lists costs outside the tree as virtual groups per "hạng mục lớn" (req 29-09 §3)', async () => {
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        { id: 'cat_01', name: 'EVENT', percent: new Decimal(10), sortOrder: 1, year: 2026, subcategories: [] },
      ]);
      mockPrismaService.budgetValue.findMany.mockResolvedValue([]);
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_1', projectId: 'prj-1', month: 9, year: 2026,
          lines: [
            { id: 'l_cat', categoryId: 'cat_01', recognizedDate: new Date('2026-03-15'), actualQuantity: 1, unitPriceBeforeVatSnapshot: new Decimal(1000), actualUnitPrice: new Decimal(1000) },
            // no categoryId: "Vật phẩm" issued from stock
            { id: 'l_vp1', categoryId: null, hangMucLon: 'Vật phẩm', recognizedDate: new Date('2026-03-20'), actualQuantity: 2, unitPriceBeforeVatSnapshot: new Decimal(500), actualUnitPrice: new Decimal(540) },
            { id: 'l_vp2', categoryId: null, hangMucLon: 'vật phẩm ', recognizedDate: new Date('2026-04-02'), actualQuantity: 1, unitPriceBeforeVatSnapshot: new Decimal(300), actualUnitPrice: new Decimal(300) },
            // category of another year / deleted -> not in this tree
            { id: 'l_gone', categoryId: 'cat_deleted', hangMucLon: 'Khác', recognizedDate: new Date('2026-04-03'), actualQuantity: 1, unitPriceBeforeVatSnapshot: new Decimal(70), actualUnitPrice: new Decimal(70) },
          ],
        },
      ]);
      (mockPrismaService as any).inventoryBatch = {
        findMany: jest.fn().mockResolvedValue([
          { expenseCategoryId: 'cat_01', expenseCategoryName: 'EVENT', receivedDate: new Date('2026-05-02'), quantityIn: 2, unitPriceBeforeVat: new Decimal(100) },
        ]),
      };

      try {
        const tree: any = await service.getBudgetTree(2026, 'all', { includeUnassigned: true });
        expect(tree.categories.map((c: any) => c.name)).toEqual(['EVENT', 'Khác', 'Vật phẩm']);
        const vatPham = tree.categories.find((c: any) => c.name === 'Vật phẩm');
        expect(vatPham).toMatchObject({ id: null, unassigned: true, actualTotal: 1300, planTotal: 0, subcategories: [] });
        expect(vatPham.actuals['3']).toBe(1000);
        expect(vatPham.actuals['4']).toBe(300);
        // same total as expense-budgets/dashboard.actualSpent
        expect(tree.actualTotal).toBe(1000 + 200 + 1300 + 70);
        expect(tree.unassignedActualTotal).toBe(1370);
        const dashboard = await service.getBudgetDashboard('all', 2026);
        expect(dashboard.actualSpent).toBe(tree.actualTotal);

        // the editing grid (GET values) is unchanged
        const plain: any = await service.getBudgetTree(2026, 'all');
        expect(plain.categories).toHaveLength(1);
      } finally {
        delete (mockPrismaService as any).inventoryBatch;
      }
    });

    it('should generate Category Summary Report from ExpenseLines without double counting', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'prj-1' });
      mockPrismaService.budgetCategory.findMany.mockResolvedValue([
        {
          id: 'cat_01',
          name: 'Digital Marketing',
          percent: new Decimal(20),
          sortOrder: 1,
          year: 2026,
          subcategories: [
            {
              id: 'sub_01',
              name: 'Online Ads',
              sortOrder: 1,
              items: [
                {
                  id: 'it_01',
                  name: 'Google Ads',
                  sortOrder: 1,
                },
              ],
            },
          ],
        },
      ]);

      // Each save creates a snapshot holding ALL lines of the project: only the latest counts,
      // every line in the month of its own expense date (BE_requirement_26_09_26 §1)
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'exp_old',
          projectId: 'prj-1',
          month: 1,
          year: 2026,
          createdAt: new Date('2026-01-05T00:00:00Z'),
          lines: [
            {
              id: 'line_old',
              categoryId: 'it_01',
              recognizedDate: new Date('2026-01-10'),
              plannedAmount: new Decimal(300000000),
              actualQuantity: 1,
              actualUnitPrice: new Decimal(230000000),
            },
          ],
        },
        {
          id: 'exp_latest',
          projectId: 'prj-1',
          month: 2,
          year: 2026,
          createdAt: new Date('2026-02-05T00:00:00Z'),
          lines: [
            {
              id: 'line_1',
              categoryId: 'it_01',
              recognizedDate: new Date('2026-01-10'),
              plannedAmount: new Decimal(300000000),
              actualQuantity: 1,
              actualUnitPrice: new Decimal(230000000),
            },
            {
              id: 'line_2',
              categoryId: 'it_01',
              recognizedDate: new Date('2026-02-12'),
              plannedAmount: new Decimal(50000000),
              actualQuantity: 1,
              actualUnitPrice: new Decimal(40000000),
            },
          ],
        },
      ]);

      const report = await service.getCategorySummaryReport(2026, 'prj-1');
      expect(report.year).toBe(2026);
      expect(report.project_id).toBe('prj-1');
      expect(report.categories).toHaveLength(1);

      const cat = report.categories[0];
      expect(cat.category_id).toBe('cat_01');
      expect(cat.months['01'].planned_total).toBe(300000000);
      expect(cat.months['01'].actual_total).toBe(230000000);
      expect(cat.months['02'].planned_total).toBe(50000000);
      expect(cat.months['02'].actual_total).toBe(40000000);

      expect(cat.year_total.planned_total).toBe(350000000);
      expect(cat.year_total.actual_total).toBe(270000000);
      expect(cat.year_total.remaining).toBe(80000000);
      expect(cat.year_total.usage_percent).toBeCloseTo(77.1429, 2);

      expect(report.grand_total.planned_total).toBe(350000000);
      expect(report.grand_total.actual_total).toBe(270000000);
    });
  });

  describe('Requirements 8-9-26 Specification', () => {
    const validProjectId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    describe('Yêu cầu 8.1 & 8.2: Category Budget Contract & bulkSaveValues', () => {
      it('should return 200 with count 0 when values array is empty', async () => {
        const result = await service.bulkSaveValues({
          year: 2026,
          values: [],
        });

        expect(result).toEqual({
          success: true,
          count: 0,
          created: 0,
          updated: 0,
          message: 'Cập nhật ngân sách thành công',
          year: 2026,
          projectId: null,
        });
      });

      it('should reject projectId as empty string with 400 Bad Request', async () => {
        await expect(
          service.bulkSaveValues({
            year: 2026,
            projectId: '',
            values: [],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject projectId as "all" with 400 Bad Request', async () => {
        await expect(
          service.bulkSaveValues({
            year: 2026,
            projectId: 'all',
            values: [],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject non-UUID projectId with 400 Bad Request', async () => {
        await expect(
          service.bulkSaveValues({
            year: 2026,
            projectId: 'not-a-valid-uuid',
            values: [],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject non-existent projectId with 404 NotFoundException', async () => {
        mockPrismaService.project.findFirst.mockResolvedValue(null);
        await expect(
          service.bulkSaveValues({
            year: 2026,
            projectId: validProjectId,
            values: [
              {
                categoryId: 'cat_01',
                month: 1,
                amount: 5000000,
              },
            ],
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should track created and updated counts accurately during bulkSaveValues', async () => {
        mockPrismaService.project.findFirst.mockResolvedValue({ id: validProjectId });
        mockPrismaService.budgetCategory.findMany.mockResolvedValue([{ id: 'cat_01' }]);

        // First item exists (update), second item does not (create)
        mockPrismaService.budgetValue.findFirst
          .mockResolvedValueOnce({ id: 'existing_bv_1' })
          .mockResolvedValueOnce(null);

        const result = await service.bulkSaveValues({
          year: 2026,
          projectId: validProjectId,
          values: [
            { categoryId: 'cat_01', month: 1, amount: 10000000.4 },
            { categoryId: 'cat_01', month: 2, amount: 20000000.6 },
          ],
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(result.updated).toBe(1);
        expect(result.created).toBe(1);
        expect(result.message).toBe('Cập nhật ngân sách thành công');
        expect(mockPrismaService.budgetValue.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'existing_bv_1' },
            data: { amount: new Decimal(10000000) },
          }),
        );
        expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              categoryId: 'cat_01',
              projectId: validProjectId,
              month: 2,
              amount: new Decimal(20000001),
            }),
          }),
        );
      });

      it('should save at global level (projectId = null) when projectId is omitted or null', async () => {
        mockPrismaService.budgetCategory.findMany.mockResolvedValue([{ id: 'cat_01' }]);
        mockPrismaService.budgetValue.findFirst.mockResolvedValue(null);

        const result = await service.bulkSaveValues({
          year: 2026,
          projectId: null,
          values: [{ categoryId: 'cat_01', month: 1, amount: 15000000 }],
        });

        expect(result.success).toBe(true);
        expect(result.projectId).toBeNull();
        expect(mockPrismaService.budgetValue.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              projectId: null,
              amount: new Decimal(15000000),
            }),
          }),
        );
      });
    });

    describe('Yêu cầu 8.3: getBudgetByProject & exportBudgetExcel', () => {
      it('should return budget breakdown by project prioritizing direct category values', async () => {
        mockPrismaService.project.findMany.mockResolvedValue([
          { id: 'proj-1', name: 'Chiến dịch Q1', type: 'Campaign' },
          { id: 'proj-2', name: 'Sự kiện Smartlog', type: 'Workshop' },
        ]);

        mockPrismaService.budgetCategory.findMany.mockResolvedValue([
          {
            id: 'cat-1',
            name: 'Brand Marketing',
            year: 2026,
            subcategories: [
              {
                id: 'sub-1',
                items: [{ id: 'it-1' }],
              },
            ],
          },
        ]);

        mockPrismaService.budgetValue.findMany.mockResolvedValue([
          // Direct category for proj-1 (month 1: 50M)
          {
            id: 'bv-1',
            categoryId: 'cat-1',
            itemId: null,
            subcategoryId: null,
            projectId: 'proj-1',
            year: 2026,
            month: 1,
            amount: new Decimal(50000000),
          },
          // Legacy item for proj-2 (month 2: 20M)
          {
            id: 'bv-2',
            categoryId: null,
            itemId: 'it-1',
            subcategoryId: null,
            projectId: 'proj-2',
            year: 2026,
            month: 2,
            amount: new Decimal(20000000),
          },
          // Global budget (month 3: 30M)
          {
            id: 'bv-3',
            categoryId: 'cat-1',
            itemId: null,
            subcategoryId: null,
            projectId: null,
            year: 2026,
            month: 3,
            amount: new Decimal(30000000),
          },
        ]);

        const result = await service.getBudgetByProject(2026);
        expect(result.year).toBe(2026);
        expect(result.totalBudget).toBe(100000000); // 50M + 20M + 30M
        expect(result.projects).toHaveLength(3); // proj-1, proj-2, and global

        const p1 = result.projects.find((p) => p.projectId === 'proj-1');
        expect(p1?.totalBudget).toBe(50000000);
        expect(p1?.months['1']).toBe(50000000);

        const p2 = result.projects.find((p) => p.projectId === 'proj-2');
        expect(p2?.totalBudget).toBe(20000000);
        expect(p2?.months['2']).toBe(20000000);

        const global = result.projects.find((p) => p.projectId === null);
        expect(global?.totalBudget).toBe(30000000);
        expect(global?.projectName).toContain('Ngân sách chung');
        expect(global?.months['3']).toBe(30000000);
      });

      it('should export budget tree to Excel buffer using ExcelJS', async () => {
        mockPrismaService.budgetCategory.findMany.mockResolvedValue([
          {
            id: 'cat-excel',
            name: 'Chi phí Marketing',
            year: 2026,
            percent: new Decimal(100),
            sortOrder: 1,
            subcategories: [],
          },
        ]);
        mockPrismaService.budgetValue.findMany.mockResolvedValue([
          {
            id: 'bv-cat-excel',
            categoryId: 'cat-excel',
            itemId: null,
            subcategoryId: null,
            year: 2026,
            month: 1,
            amount: new Decimal(10000000),
          },
        ]);
        mockPrismaService.expenseRecord.findMany.mockResolvedValue([]);

        const buffer = await service.exportBudgetExcel(2026);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(0);
        // Valid zip magic bytes for xlsx: PK (0x50, 0x4B)
        expect(buffer[0]).toBe(0x50);
        expect(buffer[1]).toBe(0x4b);
      });
    });
  });
});

