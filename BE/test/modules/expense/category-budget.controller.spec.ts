import { Test, TestingModule } from '@nestjs/testing';
import { CategoryBudgetController } from '../../../src/modules/expense/category-budget.controller';
import { CategoryBudgetService } from '../../../src/modules/expense/category-budget.service';
import { AuthenticatedUser } from '../../../src/common/interfaces/authenticated-user.interface';

describe('CategoryBudgetController', () => {
  let controller: CategoryBudgetController;

  const mockBudgetService = {
    getCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getSubcategories: jest.fn(),
    createSubcategory: jest.fn(),
    updateSubcategory: jest.fn(),
    deleteSubcategory: jest.fn(),
    getBudgetTree: jest.fn(),
    bulkSaveValues: jest.fn(),
    getCategoryBudgetActuals: jest.fn(),
    getBudgetDashboard: jest.fn(),
    getBudgetPermissions: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'admin@company.com',
    role: 'manager',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryBudgetController],
      providers: [
        {
          provide: CategoryBudgetService,
          useValue: mockBudgetService,
        },
      ],
    }).compile();

    controller = module.get<CategoryBudgetController>(CategoryBudgetController);
  });

  describe('GET /v1/expense-budgets/dashboard', () => {
    it('should return dashboard data with permissions block', async () => {
      mockBudgetService.getBudgetDashboard.mockResolvedValue({
        totalBudget: 100000000,
        actualSpent: 80000000,
        remainingBudget: 20000000,
        usedPercentage: 80,
        categories: [
          { categoryName: 'Budget Brand Marketing', budget: 40000000, percentage: 40 },
        ],
      });
      mockBudgetService.getBudgetPermissions.mockReturnValue({
        view: true,
        edit: true,
        manageCategories: true,
        export: true,
      });

      const result = await controller.getDashboard({ year: 2026, projectId: 'all' }, mockUser);
      expect(result.data.totalBudget).toBe(100000000);
      expect(result.permissions).toEqual({
        view: true,
        edit: true,
        manageCategories: true,
        export: true,
      });
    });
  });

  describe('GET /v1/expense-budgets/tree', () => {
    it('should return tree data and updatedAt with permissions block', async () => {
      mockBudgetService.getBudgetTree.mockResolvedValue({
        categories: [],
        updatedAt: '2026-09-01T12:00:00.000Z',
      });
      mockBudgetService.getBudgetPermissions.mockReturnValue({
        view: true,
        edit: false,
        manageCategories: false,
        export: false,
      });

      const result = await controller.getTree({ year: 2026 }, { ...mockUser, role: 'specialist' });
      expect(result.data.updatedAt).toBe('2026-09-01T12:00:00.000Z');
      expect(result.permissions.edit).toBe(false);
    });
  });

  describe('GET /v1/expense-budgets/categories', () => {
    it('should return categories list with permissions block', async () => {
      mockBudgetService.getCategories.mockResolvedValue([{ id: 'cat-1', name: 'Brand' }]);
      mockBudgetService.getBudgetPermissions.mockReturnValue({
        view: true,
        edit: true,
        manageCategories: true,
        export: true,
      });

      const result = await controller.getCategories({ year: 2026 }, mockUser);
      expect(result.data).toHaveLength(1);
      expect(result.permissions.view).toBe(true);
    });
  });

  describe('GET /v1/expense-budgets/values', () => {
    it('should return budget tree with values and permissions block', async () => {
      mockBudgetService.getBudgetTree.mockResolvedValue({
        categories: [],
        updatedAt: null,
      });
      mockBudgetService.getBudgetPermissions.mockReturnValue({
        view: true,
        edit: true,
        manageCategories: true,
        export: true,
      });

      const result = await controller.getValues({ year: 2026 }, mockUser);
      expect(result.data.categories).toEqual([]);
      expect(result.permissions.export).toBe(true);
    });
  });

  describe('GET /v1/expense-budgets/actuals', () => {
    it('should return category budget actuals from service', async () => {
      mockBudgetService.getCategoryBudgetActuals.mockResolvedValue({
        cat_01: { '1': 5000000, total: 5000000 },
      });

      const result = await controller.getActuals('2026', 'prj-1');
      expect(result).toEqual({
        cat_01: { '1': 5000000, total: 5000000 },
      });
      expect(mockBudgetService.getCategoryBudgetActuals).toHaveBeenCalledWith(2026, 'prj-1');
    });
  });
});
