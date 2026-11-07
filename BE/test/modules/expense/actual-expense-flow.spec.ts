import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ActualExpenseFlow - User Flow 3, 4, 6, 7 & 422 Errors', () => {
  let service: ExpenseService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      expenseRecord: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      expenseLine: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      annualExpensePlan: {
        findFirst: jest.fn(),
      },
      annualExpensePlanItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      projectExpensePlanItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      budgetCategory: {
        findFirst: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
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

  describe('confirmExpenseLine', () => {
    it('should throw UnprocessableEntityException (ERR_ANNUAL_PLAN_NOT_ACTIVE) if no active annual plan exists', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
        recognizedDate: new Date('2026-08-15'),
        expense: { project: { status: 'Active', cancelledAt: null } },
      });

      // No active annual plan or legacy category
      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce(null);
      prisma.budgetCategory.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.confirmExpenseLine('line_draft', { id: 'u1', role: 'manager' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException (ERR_RECOGNIZED_AFTER_CANCELLED) if project is Cancelled and date > cancelledAt', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
        recognizedDate: new Date('2026-08-25'),
        expense: {
          project: {
            status: 'Cancelled',
            cancelledAt: new Date('2026-08-20T10:00:00Z'),
          },
        },
      });

      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce({ id: 'plan_active' });

      await expect(
        service.confirmExpenseLine('line_draft', { id: 'u1', role: 'manager' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should confirm line when date <= cancelledAt and active plan exists', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
        expenseId: 'exp_01',
        recognizedDate: new Date('2026-08-15'),
        actualUnitPrice: new Decimal(50000),
        quantity: 10,
        actualQuantity: 10,
        expense: {
          project: {
            status: 'Cancelled',
            cancelledAt: new Date('2026-08-20T10:00:00Z'),
          },
        },
      });

      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce({ id: 'plan_active' });
      prisma.expenseLine.update.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'confirmed',
        expenseId: 'exp_01',
        recognizedDate: new Date('2026-08-15'),
        actualUnitPrice: new Decimal(50000),
        quantity: 10,
        actualQuantity: 10,
        confirmedAt: new Date(),
      });
      prisma.expenseLine.findMany.mockResolvedValueOnce([]); // for recalculateDirectCost

      const res = await service.confirmExpenseLine('line_draft', { id: 'u1', role: 'manager' } as any);

      expect(res.status).toBe('confirmed');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'confirm',
          entityType: 'ExpenseLine',
        }),
      );
    });
  });

  describe('cancelExpenseLine (Flow 6)', () => {
    it('should throw BadRequestException if reason is missing', async () => {
      await expect(
        service.cancelExpenseLine('line_01', { reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should cancel line and record audit trail with reason', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_01',
        expenseId: 'exp_01',
        status: 'confirmed',
      });
      prisma.expenseLine.update.mockResolvedValueOnce({
        id: 'line_01',
        expenseId: 'exp_01',
        status: 'cancelled',
        cancelledReason: 'Hủy hợp đồng nhà cung cấp',
      });
      prisma.expenseLine.findMany.mockResolvedValueOnce([]); // for recalculateDirectCost

      const res = await service.cancelExpenseLine(
        'line_01',
        { reason: 'Hủy hợp đồng nhà cung cấp' },
        { id: 'u1', role: 'manager' } as any,
      );

      expect(res.status).toBe('cancelled');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          newValue: expect.objectContaining({
            status: 'cancelled',
            reason: 'Hủy hợp đồng nhà cung cấp',
          }),
        }),
      );
    });
  });

  describe('getActualExpenses', () => {
    it('should return paginated actual lines with permissions', async () => {
      prisma.expenseLine.count.mockResolvedValueOnce(1);
      prisma.expenseLine.findMany.mockResolvedValueOnce([
        {
          id: 'l1',
          name: 'Thuê âm thanh ánh sáng',
          status: 'confirmed',
          actualUnitPrice: new Decimal(10000000),
          quantity: 1,
          actualQuantity: 1,
          recognizedDate: new Date('2026-08-10'),
          expense: {
            project: { id: 'prj_01', name: 'Dự án Sự kiện', status: 'Active' },
          },
        },
      ]);

      const res = await service.getActualExpenses({ page: 1, perPage: 10 });

      expect(res.total).toBe(1);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].projectName).toBe('Dự án Sự kiện');
      expect(res.permissions.view).toBe(true);
      expect(res.permissions.createDraft).toBe(true);
    });
  });
});
