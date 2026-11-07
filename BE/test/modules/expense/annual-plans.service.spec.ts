import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AnnualPlansService } from '../../../src/modules/expense/annual-plans.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('AnnualPlansService', () => {
  let service: AnnualPlansService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      annualExpensePlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      annualExpensePlanItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      member: {
        findFirst: jest.fn().mockResolvedValue({ id: 'member_01' }),
      },
      budgetCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnualPlansService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnnualPlansService>(AnnualPlansService);
  });

  describe('createAnnualPlan', () => {
    it('should create a new draft plan with incremented version', async () => {
      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce({ version: 2 });
      prisma.annualExpensePlan.create.mockResolvedValueOnce({
        id: 'plan_new',
        year: 2026,
        version: 3,
        name: 'Bản 2026 v3',
        status: 'draft',
        totalPlan: new Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.annualExpensePlanItem.findMany.mockResolvedValueOnce([]);
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_new',
        year: 2026,
        version: 3,
        name: 'Bản 2026 v3',
        status: 'draft',
        totalPlan: new Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createAnnualPlan({
        year: 2026,
        name: 'Bản 2026 v3',
      });

      expect(res.data.version).toBe(3);
      expect(res.data.status).toBe('draft');
      expect(res.permissions.managePlans).toBe(true);
    });
  });

  describe('updateAnnualPlanItems (Rollup rule)', () => {
    it('should throw ForbiddenException if plan is not draft', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_active',
        status: 'active',
      });

      await expect(
        service.updateAnnualPlanItems('plan_active', {
          items: [{ itemId: 'item_01', amount: 1000 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnprocessableEntityException if item is not level 3 (detail)', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft',
        status: 'draft',
      });
      prisma.annualExpensePlanItem.findUnique.mockResolvedValueOnce({
        id: 'item_l2',
        planId: 'plan_draft',
        level: 2,
        name: 'Nhóm L2',
      });

      await expect(
        service.updateAnnualPlanItems('plan_draft', {
          items: [{ itemId: 'item_l2', amount: 5000000 }],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('activateAnnualPlan', () => {
    it('should archive previously active plan and activate target plan', async () => {
      prisma.annualExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_draft',
        year: 2026,
        version: 2,
        status: 'draft',
      });
      prisma.annualExpensePlan.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.annualExpensePlan.update.mockResolvedValueOnce({
        id: 'plan_draft',
        year: 2026,
        version: 2,
        name: 'Bản 2026 v2',
        status: 'active',
        activatedAt: new Date(),
        totalPlan: new Decimal(10000000),
      });

      const res = await service.activateAnnualPlan('plan_draft');

      expect(prisma.annualExpensePlan.updateMany).toHaveBeenCalledWith({
        where: { year: 2026, status: 'active', id: { not: 'plan_draft' } },
        data: { status: 'archived', replacedByVersion: 2 },
      });
      expect(res.data.status).toBe('active');
    });
  });

  describe('getActiveAnnualPlan', () => {
    it('should throw NotFoundException if no active plan exists', async () => {
      prisma.annualExpensePlan.findFirst.mockResolvedValueOnce(null);

      await expect(service.getActiveAnnualPlan(2027)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
