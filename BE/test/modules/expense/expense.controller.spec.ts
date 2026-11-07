import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseController } from '../../../src/modules/expense/expense.controller';
import { ExpenseService } from '../../../src/modules/expense/expense.service';

describe('ExpenseController', () => {
  let controller: ExpenseController;
  let service: ExpenseService;

  const mockExpenseService = {
    getOverview: jest.fn().mockResolvedValue({ period: '2026', metrics: {}, projects: [] }),
    getReports: jest.fn().mockResolvedValue({ overview: {}, trend: [], distribution: [] }),
    getExpense: jest.fn().mockResolvedValue({ id: 'uuid-1', lines: [] }),
    getExpenses: jest.fn().mockResolvedValue([]),
    saveExpense: jest.fn().mockResolvedValue({ id: 'uuid-1' }),
    updateExpense: jest.fn().mockResolvedValue({ id: 'uuid-1' }),
    removeExpense: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseController],
      providers: [
        {
          provide: ExpenseService,
          useValue: mockExpenseService,
        },
      ],
    }).compile();

    controller = module.get<ExpenseController>(ExpenseController);
    service = module.get<ExpenseService>(ExpenseService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should call expenseService.getOverview with period', async () => {
      const result = await controller.getOverview('2026');
      expect(service.getOverview).toHaveBeenCalledWith('2026', undefined);
      expect(result.period).toBe('2026');
    });

    it('should pass the projectId filter (BE_requirement_29_09_26 §4)', async () => {
      await controller.getOverview('2026-Q3', ' p1 ');
      expect(service.getOverview).toHaveBeenCalledWith('2026-Q3', 'p1');
    });
  });

  describe('getReports', () => {
    it('should call expenseService.getReports with period', async () => {
      const result = await controller.getReports('2026-Q3');
      expect(service.getReports).toHaveBeenCalledWith('2026-Q3', undefined);
      expect(result).toHaveProperty('trend');
    });
  });

  describe('getExpense', () => {
    it('should call expenseService.getExpense with id', async () => {
      const result = await controller.getExpense('uuid-1');
      expect(service.getExpense).toHaveBeenCalledWith('uuid-1', undefined);
      expect(result.id).toBe('uuid-1');
    });
  });
});
