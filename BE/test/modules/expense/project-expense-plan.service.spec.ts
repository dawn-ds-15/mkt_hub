import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { ProjectExpensePlanService } from '../../../src/modules/expense/project-expense-plan.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ProjectExpensePlanService', () => {
  let service: ProjectExpensePlanService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      projectExpensePlan: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      projectExpensePlanItem: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      expenseLine: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectExpensePlanService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectExpensePlanService>(ProjectExpensePlanService);
  });

  describe('saveProjectExpensePlan (Flow 2 Rule)', () => {
    it('should throw UnprocessableEntityException if project is Cancelled', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({
        id: 'prj_cancelled',
        status: 'Cancelled',
      });

      await expect(
        service.saveProjectExpensePlan('prj_cancelled', {
          year: 2026,
          items: [
            {
              source: 'custom',
              name: 'Thi công gian hàng',
              planAmount: 20000000,
            },
          ],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should successfully save project plan when project is active', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'prj_active',
        name: 'Dự án Alpha',
        status: 'Active',
        cancelledAt: null,
      });

      prisma.projectExpensePlan.upsert.mockResolvedValueOnce({
        id: 'plan_prj_1',
        projectId: 'prj_active',
        year: 2026,
        totalPlan: new Decimal(20000000),
      });

      prisma.projectExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_prj_1',
        projectId: 'prj_active',
        year: 2026,
        totalPlan: new Decimal(20000000),
        items: [
          {
            id: 'item_1',
            source: 'custom',
            name: 'Thi công gian hàng',
            planAmount: new Decimal(20000000),
            note: null,
            sortOrder: 0,
          },
        ],
      });

      prisma.expenseLine.findMany.mockResolvedValueOnce([]);

      const res = await service.saveProjectExpensePlan('prj_active', {
        year: 2026,
        items: [
          {
            source: 'custom',
            name: 'Thi công gian hàng',
            planAmount: 20000000,
          },
        ],
      });

      expect(res.data.totalPlan).toBe(20000000);
      expect(res.data.variance).toBe(20000000);
      expect(res.data.items).toHaveLength(1);
    });
  });

  describe('getProjectExpensePlan', () => {
    it('should compute totalPlan, totalActual from confirmed lines, and variance', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({
        id: 'prj_01',
        name: 'Dự án Beta',
        status: 'Active',
        cancelledAt: null,
      });

      prisma.projectExpensePlan.findUnique.mockResolvedValueOnce({
        id: 'plan_prj_01',
        projectId: 'prj_01',
        year: 2026,
        totalPlan: new Decimal(50000000),
        items: [
          {
            id: 'item_1',
            source: 'template',
            templateId: 'tpl_1',
            name: 'Tổ chức sự kiện',
            planAmount: new Decimal(50000000),
            note: null,
            sortOrder: 0,
          },
        ],
      });

      // Confirmed lines with total = 20,000,000
      prisma.expenseLine.findMany.mockResolvedValueOnce([
        {
          quantity: 2,
          actualQuantity: 2,
          actualUnitPrice: new Decimal(10000000),
          unitPriceAfterVatSnapshot: null,
          recognizedDate: new Date('2026-08-15'),
        },
      ]);

      const res = await service.getProjectExpensePlan('prj_01');

      expect(res.data.totalPlan).toBe(50000000);
      expect(res.data.totalActual).toBe(20000000);
      expect(res.data.variance).toBe(30000000); // 50M - 20M
    });
  });
});
