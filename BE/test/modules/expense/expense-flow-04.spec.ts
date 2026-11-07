import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ExpenseService - USER-FLOW-04 Specification', () => {
  let service: ExpenseService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      expenseRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseLine: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      annualExpensePlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', status: 'active' }),
      },
      budgetItem: {
        findFirst: jest.fn(),
      },
      budgetSubcategory: {
        findFirst: jest.fn(),
      },
      budgetCategory: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    audit = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('Flow 7 — Cancelled Project Expense Handling', () => {
    it('should block saveExpense if month is after project cancelledAt', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Cancelled Project',
        status: 'Cancelled',
        cancelledAt: new Date('2026-06-15T00:00:00.000Z'),
      });

      await expect(
        service.saveExpense(
          {
            projectId: 'proj-1',
            month: 7, // July is after June 15
            year: 2026,
            directCost: 1000000,
          },
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Không thể ghi nhận chi phí cho kỳ sau thời điểm dự án bị hủy (cancelled_at).',
        ),
      );
    });

    it('should allow saveExpense on Cancelled project if month is before/equal cancelledAt', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Cancelled Project',
        status: 'Cancelled',
        cancelledAt: new Date('2026-06-15T00:00:00.000Z'),
      });

      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        month: 5,
        year: 2026,
        directCost: new Decimal(1000000),
        overheadCost: new Decimal(0),
        lines: [],
      });
      prisma.expenseRecord.create.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        month: 5, // May is before June 15
        year: 2026,
        directCost: new Decimal(1000000),
        overheadCost: new Decimal(0),
        lines: [],
      });

      const result = await service.saveExpense(
        {
          projectId: 'proj-1',
          month: 5,
          year: 2026,
          directCost: 1000000,
        },
        'user-1',
      );

      expect(result).toBeDefined();
      expect(prisma.expenseRecord.create).toHaveBeenCalled();
    });

    it('should block createExpenseLine on Cancelled project if recognizedDate > cancelledAt', async () => {
      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        project: {
          id: 'proj-1',
          status: 'Cancelled',
          cancelledAt: new Date('2026-06-15T00:00:00.000Z'),
        },
      });

      await expect(
        service.createExpenseLine(
          'exp-1',
          {
            name: 'Chi phí sau khi hủy',
            actualUnitPrice: 500000,
            quantity: 1,
            status: 'confirmed',
            recognizedDate: '2026-06-20', // June 20 > June 15
          },
          'user-1',
        ),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Ngày ghi nhận chi phí không được sau thời điểm dự án bị hủy (cancelled_at).',
        ),
      );
    });

    it('should allow createExpenseLine on Cancelled project if recognizedDate <= cancelledAt', async () => {
      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        project: {
          id: 'proj-1',
          status: 'Cancelled',
          cancelledAt: new Date('2026-06-15T00:00:00.000Z'),
        },
      });

      prisma.expenseLine.findFirst.mockResolvedValue(null);
      prisma.expenseLine.create.mockResolvedValue({
        id: 'line-1',
        expenseId: 'exp-1',
        name: 'Chi phí hợp lệ trước khi hủy',
        actualUnitPrice: new Decimal(500000),
        quantity: 1,
        actualQuantity: 1,
        status: 'confirmed',
        recognizedDate: new Date('2026-06-10'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.expenseLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          actualUnitPrice: new Decimal(500000),
          actualQuantity: 1,
          status: 'confirmed',
        },
      ]);
      prisma.expenseRecord.update.mockResolvedValue({ id: 'exp-1' });

      const res = await service.createExpenseLine(
        'exp-1',
        {
          name: 'Chi phí hợp lệ trước khi hủy',
          actualUnitPrice: 500000,
          quantity: 1,
          status: 'confirmed',
          recognizedDate: '2026-06-10',
        },
        'user-1',
      );

      expect(res).toBeDefined();
      expect(res.name).toBe('Chi phí hợp lệ trước khi hủy');
      expect(res.status).toBe('confirmed');
    });

    it('should block createExpenseLine on Cancelled project if confirmed but missing recognizedDate', async () => {
      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        project: {
          id: 'proj-1',
          status: 'Cancelled',
          cancelledAt: new Date('2026-06-15T00:00:00.000Z'),
        },
      });

      await expect(
        service.createExpenseLine(
          'exp-1',
          {
            name: 'Chi phí thiếu recognizedDate',
            actualUnitPrice: 500000,
            quantity: 1,
            status: 'confirmed',
          },
          'user-1',
        ),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Chi phí cho dự án đã hủy bắt buộc phải có ngày ghi nhận (recognizedDate).',
        ),
      );
    });
  });

  describe('Flow 4 — Unplanned Expense Validation', () => {
    it('should block createExpenseLine with isUnplanned = true if unplannedItemName is missing', async () => {
      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        project: { id: 'proj-1', status: 'Active' },
      });

      await expect(
        service.createExpenseLine(
          'exp-1',
          {
            name: 'Chi phí phát sinh',
            actualUnitPrice: 200000,
            quantity: 1,
            isUnplanned: true,
            categoryId: 'cat-1',
            status: 'confirmed',
          },
          'user-1',
        ),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Chi phí phát sinh ngoài kế hoạch bắt buộc phải có tên hạng mục phát sinh (unplannedItemName).',
        ),
      );
    });

    it('should block createExpenseLine with isUnplanned = true if categoryId is missing', async () => {
      prisma.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        project: { id: 'proj-1', status: 'Active' },
      });

      await expect(
        service.createExpenseLine(
          'exp-1',
          {
            name: 'Chi phí phát sinh',
            actualUnitPrice: 200000,
            quantity: 1,
            isUnplanned: true,
            unplannedItemName: 'In thêm backdrop',
            status: 'confirmed',
          },
          'user-1',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('Flow 3 & Flow 6 — Status Lifecycle & Total Aggregation', () => {
    it('should include draft lines and exclude cancelled lines in recalculateDirectCost', async () => {
      prisma.expenseLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          actualUnitPrice: new Decimal(100000),
          actualQuantity: 2,
          status: 'confirmed', // 200,000
        },
        {
          id: 'line-2',
          actualUnitPrice: new Decimal(300000),
          actualQuantity: 1,
          status: 'draft', // Included in rollup per 11-09-26: 300,000
        },
        {
          id: 'line-3',
          actualUnitPrice: new Decimal(500000),
          actualQuantity: 1,
          status: 'cancelled', // Excluded
        },
      ]);
      prisma.expenseRecord.update.mockResolvedValue({ id: 'exp-1' });

      await service.recalculateDirectCost('exp-1');

      expect(prisma.expenseRecord.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { directCost: new Decimal(500000), overheadCost: new Decimal(0) },
      });
    });

    it('should format totalActual only from confirmed lines in formatExpense', () => {
      const expense = {
        id: 'exp-1',
        directCost: new Decimal(200000),
        overheadCost: new Decimal(50000),
        lines: [
          {
            id: 'line-1',
            name: 'Line 1',
            actualUnitPrice: new Decimal(100000),
            quantity: 2,
            actualQuantity: 2,
            status: 'confirmed',
          },
          {
            id: 'line-2',
            name: 'Line 2',
            actualUnitPrice: new Decimal(300000),
            quantity: 1,
            actualQuantity: 1,
            status: 'draft',
          },
          {
            id: 'line-3',
            name: 'Line 3',
            actualUnitPrice: new Decimal(500000),
            quantity: 1,
            actualQuantity: 1,
            status: 'cancelled',
          },
        ],
      };

      const formatted = service.formatExpense(expense);

      // Only line 1 (100,000 * 2 = 200,000) is confirmed
      expect(formatted.totalActual).toBe(200000);
      expect(formatted.lines).toHaveLength(3);
      expect(formatted.lines[0].status).toBe('confirmed');
      expect(formatted.lines[1].status).toBe('draft');
      expect(formatted.lines[2].status).toBe('cancelled');
    });
  });
});
