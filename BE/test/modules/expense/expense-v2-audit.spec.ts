import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AnnualPlansService } from '../../../src/modules/expense/annual-plans.service';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { ProjectExpensePlanService } from '../../../src/modules/expense/project-expense-plan.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { EXPENSE_ERROR_CODES } from '../../../src/modules/expense/expense-permissions.helper';

describe('Expense V2 Audit Suite (BE-yeu-cau-be-6-9-26-v2.md)', () => {
  let annualPlansService: AnnualPlansService;
  let expenseService: ExpenseService;
  let projectExpensePlanService: ProjectExpensePlanService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      annualExpensePlan: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      annualExpensePlanItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      projectExpensePlan: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      projectExpensePlanItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      expenseRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseLine: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      budgetItem: { findFirst: jest.fn() },
      budgetCategory: { findFirst: jest.fn() },
      budgetSubcategory: { findFirst: jest.fn() },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnualPlansService,
        ExpenseService,
        ProjectExpensePlanService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    annualPlansService = module.get<AnnualPlansService>(AnnualPlansService);
    expenseService = module.get<ExpenseService>(ExpenseService);
    projectExpensePlanService = module.get<ProjectExpensePlanService>(ProjectExpensePlanService);
  });

  // ==========================================
  // FLOW 3: Kích hoạt kế hoạch năm & Tree
  // ==========================================
  describe('Flow 3 & F4: Annual Plans Activation & Nodes', () => {
    it('should throw 409 ERR_ANNUAL_PLAN_ALREADY_ACTIVE if active plan exists and confirmReplace is not true', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft_02',
        year: 2026,
        version: 2,
        status: 'draft',
      });
      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce({
        id: 'plan_active_01',
        year: 2026,
        version: 1,
        status: 'active',
      });

      try {
        await annualPlansService.activateAnnualPlan('plan_draft_02', { confirmReplace: false });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_ALREADY_ACTIVE,
        });
      }
    });

    it('should successfully activate plan if confirmReplace is true', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft_02',
        year: 2026,
        version: 2,
        status: 'draft',
      });
      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce({
        id: 'plan_active_01',
        year: 2026,
        version: 1,
        status: 'active',
      });
      prisma.annualExpensePlan.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.annualExpensePlan.update.mockResolvedValueOnce({
        id: 'plan_draft_02',
        year: 2026,
        version: 2,
        name: 'Kế hoạch v2',
        status: 'active',
        activatedAt: new Date(),
        totalPlan: new Decimal(10000000),
      });

      const res = await annualPlansService.activateAnnualPlan('plan_draft_02', {
        confirmReplace: true,
      });

      expect(res.data.status).toBe('active');
      expect(res.permissions).toBeDefined();
      expect(res.permissions.managePlans).toBe(true);
      expect(prisma.annualExpensePlan.updateMany).toHaveBeenCalledWith({
        where: { year: 2026, status: 'active', id: { not: 'plan_draft_02' } },
        data: { status: 'archived', replacedByVersion: 2 },
      });
    });

    it('should throw 409 ERR_PLAN_NOT_DRAFT if plan is already active or archived', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_active',
        year: 2026,
        version: 1,
        status: 'active',
      });

      try {
        await annualPlansService.activateAnnualPlan('plan_active');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_PLAN_NOT_DRAFT,
        });
      }
    });

    it('should throw 409 ERR_PLAN_STATUS_CHANGE_DENIED if If-Match header does not match', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft',
        year: 2026,
        version: 2,
        status: 'draft',
      });

      try {
        await annualPlansService.activateAnnualPlan('plan_draft', {}, '"v1"');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_PLAN_STATUS_CHANGE_DENIED,
        });
      }
    });

    it('should throw 422 ERR_NODE_LEVEL_INVALID when adding level 1 node with parentId', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft',
        status: 'draft',
      });

      try {
        await annualPlansService.addItemNode('plan_draft', {
          level: 1,
          parentId: 'some_parent',
          name: 'Level 1 invalid',
        });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
        });
      }
    });

    it('should throw 422 ERR_BUDGET_AMOUNT_NEGATIVE when amount is negative', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft',
        status: 'draft',
      });

      try {
        await annualPlansService.addItemNode('plan_draft', {
          level: 3,
          parentId: 'parent_l2',
          name: 'Level 3 negative',
          amount: -5000,
        });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_BUDGET_AMOUNT_NEGATIVE,
        });
      }
    });

    it('should throw 403 ERR_NOT_DRAFT when editing items on non-draft plan', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_active',
        status: 'active',
      });

      try {
        await annualPlansService.updateAnnualPlanItems('plan_active', {
          items: [{ itemId: 'itm_1', amount: 1000 }],
        });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_NOT_DRAFT,
        });
      }
    });
  });

  // ==========================================
  // FLOW 5 & 6: Confirm & Cancel Expense Line
  // ==========================================
  describe('Flow 5 & 6: Line Confirmation and Cancellation (F2, F4, F5)', () => {
    it('should throw 409 ERR_LINE_ALREADY_CONFIRMED if line is already confirmed', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_confirmed',
        status: 'confirmed',
      });

      try {
        await expenseService.confirmExpenseLine('line_confirmed');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CONFIRMED,
        });
      }
    });

    it('should throw 409 ERR_LINE_ALREADY_CANCELLED when confirming a cancelled line', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_cancelled',
        status: 'cancelled',
      });

      try {
        await expenseService.confirmExpenseLine('line_cancelled');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
        });
      }
    });

    it('should throw 409 ERR_LINE_ALREADY_CANCELLED when cancelling an already cancelled line', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_cancelled',
        status: 'cancelled',
      });

      try {
        await expenseService.cancelExpenseLine('line_cancelled', { reason: 'Hủy lại' });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
        });
      }
    });

    it('should throw 422 ERR_LINE_NOT_CONFIRMED when cancelling a draft line', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
      });

      try {
        await expenseService.cancelExpenseLine('line_draft', { reason: 'Hủy dòng draft' });
        fail('Should have thrown UnprocessableEntityException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_NOT_CONFIRMED,
        });
      }
    });

    it('should successfully confirm draft line and return permissions block', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
        expenseId: 'exp_01',
        recognizedDate: new Date('2026-08-15'),
        actualUnitPrice: new Decimal(50000),
        quantity: 10,
        actualQuantity: 10,
        expense: {
          project: { status: 'Active', cancelledAt: null },
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
      prisma.expenseLine.findMany.mockResolvedValueOnce([]);

      const res = await expenseService.confirmExpenseLine('line_draft', {
        id: 'u1',
        role: 'manager',
      } as any);

      expect(res.status).toBe('confirmed');
      expect(res.data.status).toBe('confirmed');
      expect(res.permissions).toBeDefined();
      expect(res.permissions.confirm).toBe(true);
      expect(res.permissions.cancel).toBe(true);
    });

    it('should successfully cancel confirmed line with audit log', async () => {
      prisma.expenseLine.findUnique.mockResolvedValueOnce({
        id: 'line_01',
        status: 'confirmed',
        expenseId: 'exp_01',
      });
      prisma.expenseLine.update.mockResolvedValueOnce({
        id: 'line_01',
        status: 'cancelled',
        expenseId: 'exp_01',
        cancelledAt: new Date(),
        cancelledReason: 'Khách hàng dời lịch sự kiện',
      });
      prisma.expenseLine.findMany.mockResolvedValueOnce([]);

      const res = await expenseService.cancelExpenseLine(
        'line_01',
        { reason: 'Khách hàng dời lịch sự kiện' },
        { id: 'u1', role: 'manager' } as any,
      );

      expect(res.status).toBe('cancelled');
      expect(res.data.status).toBe('cancelled');
      expect(res.permissions).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          entityType: 'ExpenseLine',
        }),
      );
    });
  });

  // ==========================================
  // FLOW 7: Edit Draft Line & Status Protection (F7)
  // ==========================================
  describe('Flow 7: Edit Draft Line & Field Aliases (F7)', () => {
    it('should reject editing if line is confirmed with 409 ERR_LINE_ALREADY_CONFIRMED', async () => {
      prisma.expenseLine.findFirst.mockResolvedValueOnce({
        id: 'line_conf',
        status: 'confirmed',
        expense: { projectId: 'p1' },
      });

      try {
        await expenseService.updateExpenseLine('line_conf', { name: 'New Name' }, 'u1');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CONFIRMED,
        });
      }
    });

    it('should reject editing if line is cancelled with 409 ERR_LINE_ALREADY_CANCELLED', async () => {
      prisma.expenseLine.findFirst.mockResolvedValueOnce({
        id: 'line_canc',
        status: 'cancelled',
        expense: { projectId: 'p1' },
      });

      try {
        await expenseService.updateExpenseLine('line_canc', { name: 'New Name' }, 'u1');
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
        });
      }
    });

    it('should accept draft line updates with aliases (description, realQty, unitPrice, supplierName)', async () => {
      prisma.expenseLine.findFirst.mockResolvedValueOnce({
        id: 'line_draft',
        status: 'draft',
        expense: { projectId: 'p1' },
        actualQuantity: 5,
        actualUnitPrice: new Decimal(20000),
      });
      prisma.expenseLine.update.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'line_draft',
          status: 'draft',
          name: data.name,
          actualQuantity: data.actualQuantity,
          actualUnitPrice: data.actualUnitPrice,
          supplier: data.supplier,
        });
      });
      prisma.expenseLine.findMany.mockResolvedValueOnce([]);

      const updated = await expenseService.updateExpenseLine(
        'line_draft',
        {
          description: 'Mô tả qua alias',
          realQty: 12,
          unitPrice: 35000,
          supplierName: 'Công ty Cung ứng XYZ',
        },
        'u1',
      );

      expect(updated.name).toBe('Mô tả qua alias');
      expect(updated.actualQuantity).toBe(12);
      expect(updated.actualUnitPrice).toBe(35000);
      expect(updated.supplier).toBe('Công ty Cung ứng XYZ');
      expect(updated.supplierName).toBe('Công ty Cung ứng XYZ');
    });
  });

  // ==========================================
  // FLOW 8 & 9: Tree Overview & Pagination (F8, F9)
  // ==========================================
  describe('Flow 8 & 9: Aggregations & Pagination (F8, F9)', () => {
    it('should return hasMore = true when page * perPage < total', async () => {
      prisma.expenseLine.count.mockResolvedValueOnce(45);
      prisma.expenseLine.findMany.mockResolvedValueOnce([
        {
          id: 'line_1',
          name: 'Line 1',
          status: 'confirmed',
          expense: { project: { id: 'p1', name: 'Project 1' } },
        },
      ]);

      const res = await expenseService.getActualExpenses({
        page: 1,
        perPage: 20,
      });

      expect(res.total).toBe(45);
      expect(res.page).toBe(1);
      expect(res.perPage).toBe(20);
      expect(res.hasMore).toBe(true);
      expect(res.items).toBeDefined();
      expect(res.data).toBeDefined();
      expect(res.permissions).toBeDefined();
    });

    it('should return hasMore = false when page * perPage >= total', async () => {
      prisma.expenseLine.count.mockResolvedValueOnce(15);
      prisma.expenseLine.findMany.mockResolvedValueOnce([]);

      const res = await expenseService.getActualExpenses({
        page: 1,
        perPage: 20,
      });

      expect(res.hasMore).toBe(false);
    });

    it('Project Overview Tree should allow negative variance and only count confirmed lines', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({
        id: 'p1',
        name: 'Chiến dịch Q3',
        status: 'Active',
      });
      prisma.projectExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_p1',
        projectId: 'p1',
        items: [
          { id: 'itm_01', name: 'Hạng mục 1', planAmount: new Decimal(10000000), source: 'custom' },
        ],
      });
      // 1 confirmed line of 15,000,000 (exceeds budget)
      prisma.expenseLine.findMany.mockResolvedValueOnce([
        {
          id: 'line_01',
          projectExpenseItemId: 'itm_01',
          actualUnitPrice: new Decimal(15000000),
          quantity: 1,
          actualQuantity: 1,
          isUnplanned: false,
        },
      ]);

      const tree = await expenseService.getProjectOverviewTree('p1');
      expect(tree.data.totalPlan).toBe(10000000);
      expect(tree.data.totalActual).toBe(15000000);
      // Variance should be negative: 10M - 15M = -5M
      expect(tree.data.variance).toBe(-5000000);
      expect(tree.data.nodes[0].variance).toBe(-5000000);
      expect(tree.permissions).toBeDefined();
    });

    it('should throw BadRequestException when projectId is undefined, null, or whitespace in getProjectOverviewTree', async () => {
      await expect(
        expenseService.getProjectOverviewTree(undefined as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        expenseService.getProjectOverviewTree(''),
      ).rejects.toThrow(BadRequestException);
      await expect(
        expenseService.getProjectOverviewTree('   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when year is undefined, 0, or NaN in getAnnualOverviewTree', async () => {
      await expect(
        expenseService.getAnnualOverviewTree(undefined as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        expenseService.getAnnualOverviewTree(NaN as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when projectId is undefined or whitespace in projectExpensePlanService', async () => {
      await expect(
        projectExpensePlanService.getProjectExpensePlan(undefined as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        projectExpensePlanService.getProjectExpensePlan(''),
      ).rejects.toThrow(BadRequestException);
      await expect(
        projectExpensePlanService.saveProjectExpensePlan(undefined as any, { items: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
