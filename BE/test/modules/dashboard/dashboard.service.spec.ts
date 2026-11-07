import { Test, TestingModule } from '@nestjs/testing';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';
import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    kpiDistribution: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    kpiActual: {
      findMany: jest.fn(),
    },
    opportunity: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    kpiPlan: {
      findFirst: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    closedDeal: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _avg: {} }),
    },
    expenseRecord: {
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    },
    systemConfig: {
      findFirst: jest.fn(),
    },
    projectDailyActual: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('Weeks Helper calculations', () => {
    it('should correctly calculate weeks in Month 1 of 2026', () => {
      const weeks = service.getWeeksInMonth(2026, 1);
      expect(weeks).toEqual([1, 2, 3, 4, 5]);
    });

    it('should correctly calculate weeks in Quarter 1 of 2026', () => {
      const weeks = service.getWeeksInQuarter(2026, 1);
      expect(weeks).toContain(1);
      expect(weeks).toContain(5);
    });
  });

  describe('getOverview', () => {
    it('should return empty widgets but keep dashboard available when no active projects exist', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.kpiActual.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findFirst.mockResolvedValue(null);

      const result = await service.getOverview('week', '10', '2026');
      expect(result.success).toBe(true);
      expect(result.data.progress).toEqual({ totalPct: 0, projects: [] });
      expect(result.data.alerts).toEqual({ overdue: [], upcoming: [] });
    });

    it('should correctly fetch and structure dashboard overview data', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'project-1', type: 'Camp' },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          name: 'Overdue Task',
          dueDate: new Date('2026-06-01'),
          assignee: { name: 'Alice' },
        },
      ]);
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([
        {
          rawLeads: 100,
          mql: 40,
          sql: 20,
          oppCount: 10,
          closedCount: 4,
          planRawLeads: 200,
          planMql: 80,
          planSql: 40,
          planOpp: 20,
          planClosedDeal: 8,
        },
      ]);
      mockPrismaService.kpiActual.findMany.mockResolvedValue([
        {
          rawLeads: 100,
          mql: 40,
          sql: 20,
          oppCount: 10,
          closedCount: 4,
          planRawLeads: 200,
          planMql: 80,
          planSql: 40,
          planOpp: 20,
          planClosedDeal: 8,
        },
      ]);
      mockPrismaService.projectDailyActual.findMany.mockResolvedValueOnce([
        {
          actualDate: new Date('2026-03-05T00:00:00.000Z'),
          rawLeads: 100,
          mql: 40,
          sql: 20,
          opp: 10,
          closedDeal: 4,
        },
      ]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([
        { setupFee: 200, monthlyFee: 50 }, // 200 + 50 * 12 = 800
      ]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { setupFee: 200, monthlyFee: 50 }, // 200 + 50 * 12 = 800
      ]);
      mockPrismaService.kpiPlan.findFirst.mockResolvedValue({
        targetPipelineVal: 104000, // 104000 * 1/52 = 2000
        targetWonVal: 83200, // 83200 * 1/52 = 1600
      });
      mockPrismaService.expenseRecord.aggregate.mockResolvedValue({
        _sum: { directCost: 1000, overheadCost: 500 },
      });
      mockPrismaService.closedDeal.count.mockResolvedValue(2);
      mockPrismaService.closedDeal.aggregate.mockResolvedValue({
        _avg: { setupFee: 500, monthlyFee: 300 },
      });
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.task.count.mockResolvedValue(5);
      mockPrismaService.task.groupBy.mockResolvedValue([]);

      const result = await service.getOverview('week', '10', '2026');
      expect(result.success).toBe(true);
      expect(result.data.topbar.overdueCount).toBe(1);
      expect(result.data.kpiCards[0].actual).toBe(100);
      expect(result.data.kpiCards[1].convPct).toBe(40.0);
    });

    it('should return pipeline by segment data with growthPct', async () => {
      mockPrismaService.opportunity.findMany
        .mockResolvedValueOnce([
          { size: 'Enterprise', setupFee: 1000, monthlyFee: 500 },
          { size: 'smb', setupFee: 200, monthlyFee: 50 },
        ])
        .mockResolvedValueOnce([
          { size: 'Enterprise', setupFee: 800, monthlyFee: 400 },
        ]);

      const segments = await service.getPipelineBySegmentData('month', '8', 2026);
      expect(segments).toHaveLength(3);
      const enterprise = segments.find((s) => s.segment === 'enterprise');
      const smb = segments.find((s) => s.segment === 'smb');
      expect(enterprise?.openDeals).toBe(1);
      expect(enterprise?.value).toBe(1500);
      expect(smb?.openDeals).toBe(1);
      expect(smb?.value).toBe(250);
    });

    it('should throw NotFoundException if projectId does not exist in getKpiCardsData', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getKpiCardsData('month', '8', 2026, 'invalid-proj-id'),
      ).rejects.toThrow('Dự án không tồn tại.');
    });

    it('should filter kpiCardsData by projectId', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.kpiDistribution.findMany
        .mockResolvedValueOnce([
          { rawLeads: 50, mql: 20, sql: 10, type: 'actual' },
        ])
        .mockResolvedValueOnce([
          { rawLeads: 80, mql: 30, sql: 15, oppCount: 5, closedCount: 2, pipelineValue: 1000, wonValue: 500, type: 'plan' },
        ]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { setupFee: 500, monthlyFee: 100 },
      ]);
      // OPP count is derived from the fetched opportunities (same filter)
      mockPrismaService.opportunity.findMany.mockResolvedValue([
        { setupFee: 500, monthlyFee: 100 },
        { setupFee: 300, monthlyFee: 50 },
        { setupFee: 200, monthlyFee: 0 },
      ]);
      mockPrismaService.expenseRecord.aggregate.mockResolvedValue({
        _sum: { directCost: 200, overheadCost: 100 },
      });
      mockPrismaService.closedDeal.aggregate.mockResolvedValue({
        _avg: { setupFee: 500, monthlyFee: 100 },
      });
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      // Leads come from the project's daily actuals (req 22-09 §2.1)
      mockPrismaService.projectDailyActual.findMany.mockResolvedValueOnce([
        { rawLeads: 50, mql: 20, sql: 10, opp: 0, closedDeal: 0 },
      ]);

      const cards = await service.getKpiCardsData('month', '8', 2026, 'proj-1');
      expect(mockPrismaService.projectDailyActual.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ projectId: 'proj-1' }),
      );
      expect(cards[0].actual).toBe(50);
      expect(cards[0].plan).toBe(80);
      expect(cards[3].actual).toBe(3); // OPP
      expect(cards[4].actual).toBe(1); // Closed Deal
    });

    it('should query opportunity count and pipeline value using initiationDate period condition', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.aggregate.mockResolvedValue({ _avg: {} });
      mockPrismaService.expenseRecord.aggregate.mockResolvedValue({ _sum: {} });
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.opportunity.findMany.mockResolvedValue([
        { setupFee: 1000000, monthlyFee: 0 },
      ]);

      const cards = await service.getKpiCardsData('month', '7', 2026, 'proj-1');
      expect(mockPrismaService.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    initiationDate: expect.objectContaining({
                      gte: expect.any(Date),
                      lte: expect.any(Date),
                    }),
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
      expect(cards[3].actual).toBe(1); // OPP
      expect(cards[5].actual).toBe(1000000); // Pipeline Value
    });

    it('non-week periods take leads from daily actuals, not stale week-level rows (req 22-09 §2.1)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      // week-level "actual" rows (e.g. entered before daily input existed) say 260 MQL
      mockPrismaService.kpiDistribution.findMany
        .mockResolvedValueOnce([{ rawLeads: 300, mql: 260, sql: 110, type: 'actual' }])
        .mockResolvedValue([]);
      const dailyFindMany = jest.fn().mockResolvedValue([
        { rawLeads: 200, mql: 254, sql: 109, opp: 0, closedDeal: 0 },
      ]);
      const baseDaily = (mockPrismaService as any).projectDailyActual;
      (mockPrismaService as any).projectDailyActual = { findMany: dailyFindMany };

      try {
        const cards = await service.getKpiCardsData('year', '2026', 2026);
        expect(cards[0].actual).toBe(200); // Raw Leads
        expect(cards[1].actual).toBe(254); // MQL
        expect(cards[2].actual).toBe(109); // SQL
        // same project scope as /reports/weekly: every non-archived project
        expect(dailyFindMany.mock.calls[0][0].where).toEqual(
          expect.objectContaining({ project: { archivedAt: null }, archivedAt: null }),
        );
      } finally {
        (mockPrismaService as any).projectDailyActual = baseDaily;
      }
    });

    it('ROAS card = won value (by opportunity start date) / lead cost before VAT, no plan (req 26-09 §2, §9.3)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      // 1st closedDeal.findMany: deals signed in the period (Closed Deal card)
      // 2nd: every deal of the scope, bucketed by opportunity start date
      mockPrismaService.closedDeal.findMany
        .mockResolvedValueOnce([{ setupFee: 5, monthlyFee: 0 }])
        .mockResolvedValueOnce([
          { projectId: 'proj-1', setupFee: 40000000, monthlyFee: 0, closedDate: new Date('2026-08-02'), initiationDate: new Date('2026-07-10') },
          { projectId: 'proj-1', setupFee: 999, monthlyFee: 0, closedDate: new Date('2026-07-20'), initiationDate: new Date('2026-05-01') },
        ]);
      (mockPrismaService.expenseRecord as any).findMany = jest.fn();
      (mockPrismaService as any).expenseLine = { findMany: jest.fn() };
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'r1', projectId: 'proj-1', year: 2026, month: 7, createdAt: new Date('2026-07-15'),
          lines: [{
            id: 'l1', recognizedDate: new Date('2026-07-12'), actualQuantity: 1,
            unitPriceBeforeVatSnapshot: 20000000, unitPriceAfterVatSnapshot: 21600000, actualUnitPrice: 21600000,
          }],
        },
      ]);

      try {
        const cards = await service.getKpiCardsData('month', '7', 2026, 'proj-1');
        const roasCard: any = cards.find((c: any) => c.label === 'ROAS');
        expect(roasCard).toBeDefined();
        expect(cards.find((c: any) => c.label === 'ROA')).toBeUndefined();
        expect(roasCard.leadCost).toBe(20000000);
        expect(roasCard.wonValue).toBe(40000000);
        expect(roasCard.wonCount).toBe(1);
        expect(roasCard.roas).toBe(2);
        expect(roasCard.cac).toBe(20000000);
        expect(roasCard.percentVsPlan).toBeNull();
        expect(cards[4].actual).toBe(1); // Closed Deal card still counts deals signed in the period
      } finally {
        delete (mockPrismaService.expenseRecord as any).findMany;
        delete (mockPrismaService as any).expenseLine;
      }
    });

    describe('CAC / ROAS by quarter and project (req 29-09 §4)', () => {
      const leadRecords = [
        {
          id: 'r-lead', projectId: 'lead', year: 2026, month: 8, createdAt: new Date('2026-08-20'),
          lines: [
            // Q3 -> counted
            { id: 'l1', recognizedDate: new Date('2026-08-05'), actualQuantity: 2, unitPriceBeforeVatSnapshot: 30000000, unitPriceAfterVatSnapshot: 32400000, actualUnitPrice: 32400000 },
            // Q2 -> not in the period
            { id: 'l2', recognizedDate: new Date('2026-06-30'), actualQuantity: 1, unitPriceBeforeVatSnapshot: 7000000, unitPriceAfterVatSnapshot: 7000000, actualUnitPrice: 7000000 },
          ],
        },
        {
          // not a lead-source project -> left out of the system-wide lead cost
          id: 'r-other', projectId: 'other', year: 2026, month: 8, createdAt: new Date('2026-08-20'),
          lines: [
            { id: 'l3', recognizedDate: new Date('2026-08-06'), actualQuantity: 1, unitPriceBeforeVatSnapshot: 90000000, unitPriceAfterVatSnapshot: 90000000, actualUnitPrice: 90000000 },
          ],
        },
      ];
      const wonDeals = [
        { projectId: 'lead', setupFee: 50000000, monthlyFee: 0, closedDate: new Date('2026-09-10'), initiationDate: new Date('2026-07-01') },
        // deal of another / cancelled project still counts system-wide
        { projectId: 'other', setupFee: 70000000, monthlyFee: 0, closedDate: new Date('2026-09-11'), initiationDate: null, opportunity: { initiationDate: new Date('2026-08-15') } },
        // started in Q2 -> other period
        { projectId: 'lead', setupFee: 1, monthlyFee: 0, closedDate: new Date('2026-07-02'), initiationDate: new Date('2026-06-01') },
      ];

      const setup = () => {
        mockPrismaService.project.findFirst.mockResolvedValue({ id: 'lead' });
        mockPrismaService.project.findMany.mockImplementation(({ where }: any) =>
          Promise.resolve(where?.isLeadSource ? [{ id: 'lead' }] : [{ id: 'lead' }]),
        );
        mockPrismaService.kpiDistribution.findMany.mockResolvedValue([]);
        mockPrismaService.opportunity.findMany.mockResolvedValue([]);
        mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
        mockPrismaService.kpiPlan.findFirst.mockResolvedValue(null);
        mockPrismaService.closedDeal.findMany.mockImplementation(({ where }: any) =>
          Promise.resolve(
            where?.closedDate
              ? []
              : wonDeals.filter((d) => !where?.projectId || d.projectId === where.projectId),
          ),
        );
        (mockPrismaService.expenseRecord as any).findMany = jest.fn();
        (mockPrismaService as any).expenseLine = { findMany: jest.fn() };
        mockExpenseSnapshots(mockPrismaService, leadRecords);
      };
      const cleanup = () => {
        delete (mockPrismaService.expenseRecord as any).findMany;
        delete (mockPrismaService as any).expenseLine;
        mockPrismaService.project.findMany.mockReset();
        mockPrismaService.closedDeal.findMany.mockReset().mockResolvedValue([]);
      };

      it('quarter, no project: lead-source cost by line date, won deals of the whole system', async () => {
        setup();
        try {
          const cards = await service.getKpiCardsData('quarter', '3', 2026);
          const cac: any = cards.find((c: any) => c.label === 'CAC');
          const roas: any = cards.find((c: any) => c.label === 'ROAS');
          expect(cac.leadCost).toBe(60000000);
          expect(cac.wonCount).toBe(2);
          expect(cac.cac).toBe(30000000);
          expect(cac.actual).toBe(30000000);
          expect(cac.costScope).toBe('lead_source');
          expect(roas.roas).toBe(2); // (50M + 70M) / 60M
          // won deals are not limited to active projects
          const scopeCall = mockPrismaService.closedDeal.findMany.mock.calls
            .map((c: any[]) => c[0].where)
            .find((w: any) => !w.closedDate);
          expect(scopeCall).toEqual({ archivedAt: null });
        } finally {
          cleanup();
        }
      });

      it('one project: its whole cost and its own won deals', async () => {
        setup();
        try {
          const cards = await service.getKpiCardsData('quarter', '3', 2026, 'other');
          const cac: any = cards.find((c: any) => c.label === 'CAC');
          expect(cac.leadCost).toBe(90000000);
          expect(cac.wonCount).toBe(1);
          expect(cac.cac).toBe(90000000);
          expect(cac.costScope).toBe('project');
        } finally {
          cleanup();
        }
      });

      it('week: only lines dated inside the week; CAC is null without won deals', async () => {
        setup();
        try {
          // ISO week 32 of 2026 = 3–9 Aug: l1 (5 Aug) in, l3 is another project, l2 out
          const cards = await service.getKpiCardsData('week', '32', 2026);
          const cac: any = cards.find((c: any) => c.label === 'CAC');
          expect(cac.leadCost).toBe(60000000);
          expect(cac.wonCount).toBe(0);
          expect(cac.cac).toBeNull();
        } finally {
          cleanup();
        }
      });
    });
  });
});
