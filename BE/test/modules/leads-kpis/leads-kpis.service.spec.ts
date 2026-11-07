import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeadsKpisService } from '../../../src/modules/leads-kpis/leads-kpis.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('LeadsKpisService', () => {
  let service: LeadsKpisService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn(async (args) => {
      if (typeof args === 'function') {
        return args(mockPrismaService);
      }
      return args;
    }),
    kpiPlan: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ year: 2026 }),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    kpiMonthlyPlan: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    kpiActual: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    opportunity: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    closedDeal: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
    systemConfig: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    task: {
      deleteMany: jest.fn(),
    },
    weeklyReportLog: {
      deleteMany: jest.fn(),
    },
    kpiDistribution: {
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    event: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    projectDailyActual: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockPrismaService.closedDeal.findFirst =
      mockPrismaService.closedDeal.findUnique;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsKpisService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LeadsKpisService>(LeadsKpisService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('KPI Plan', () => {
    it('should create new plan if not exists', async () => {
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.kpiPlan.create.mockResolvedValue({ year: 2026 });

      const dto = {
        year: 2026,
        totalRawLeads: 12000,
        targetMql: 2400,
        targetSql: 1200,
        targetOpp: 600,
        targetClosedDeal: 300,
        targetPipelineVal: 1000000,
        targetWonVal: 2000000,
      };

      const result = await service.savePlan(dto, 'user-1');
      expect(result).toEqual({ year: 2026 });
      expect(mockPrismaService.kpiPlan.create).toHaveBeenCalled();
    });

    it('should update plan if exists', async () => {
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue({ year: 2026 });
      mockPrismaService.kpiPlan.update.mockResolvedValue({ year: 2026 });

      const dto = {
        year: 2026,
        totalRawLeads: 12000,
        targetMql: 2400,
        targetSql: 1200,
        targetOpp: 600,
        targetClosedDeal: 300,
        targetPipelineVal: 1000000,
        targetWonVal: 2000000,
      };

      const result = await service.savePlan(dto, 'user-1');
      expect(result).toEqual({ year: 2026 });
      expect(mockPrismaService.kpiPlan.update).toHaveBeenCalled();
    });
  });

  describe('Events', () => {
    const event = {
      id: 'event-1',
      projectId: 'project-1',
      week: 23,
      year: 2026,
      name: 'Webinar',
      date: new Date('2026-06-04T00:00:00.000Z'),
      description: null,
      rawLeads: 100,
      mql: 30,
      sql: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    };

    it('creates and serializes an event', async () => {
      mockPrismaService.event.create.mockResolvedValue(event);

      const result = await service.createEvent({
        projectId: 'project-1',
        week: 23,
        year: 2026,
        name: 'Webinar',
        date: '2026-06-04',
        rawLeads: 100,
        mql: 30,
        sql: 10,
      });

      expect(result.date).toBe('2026-06-04');
      expect(mockPrismaService.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ date: new Date('2026-06-04') }),
      });
    });

    it('lists only active events for the requested project and week', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([event]);

      const result = await service.getEvents({
        projectId: 'project-1',
        week: 23,
        year: 2026,
      });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ archivedAt: null }),
        }),
      );
    });

    it('updates an active event', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(event);
      mockPrismaService.event.update.mockResolvedValue({
        ...event,
        name: 'Updated',
      });

      const result = await service.updateEvent('event-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('soft-deletes an active event', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(event);
      mockPrismaService.event.update.mockResolvedValue({});

      await expect(service.deleteEvent('event-1')).resolves.toEqual({
        success: true,
      });
      expect(mockPrismaService.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { archivedAt: expect.any(Date) },
      });
    });

    it('rejects updates to missing or archived events', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEvent('missing', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Rollover Logic (BR-005) - Disabled in September Spec', () => {
    it('should return 0 rollover per September specification', async () => {
      // Per September specification, rollover is eliminated
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue({
        totalRawLeads: 12000,
        targetMql: 2600,
        targetSql: 1040,
        targetOpp: 520,
        targetClosedDeal: 260,
      });

      mockPrismaService.kpiActual.findUnique.mockResolvedValueOnce({
        rawLeads: 180,
        planRawLeads: 231,
        rolloverLeads: 0,
      });

      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);

      const result = await service.getWeeklyData(2026, 3);
      expect(result.rollover.rawLeads).toBe(0);
    });
  });

  describe('Opportunities', () => {
    it('should create opportunity successfully', async () => {
      const dto = {
        companyName: 'Test Company',
        size: 'Medium' as const,
        setupFee: 100,
        monthlyFee: 50,
        expectedCloseDate: '2026-07-20',
        year: 2026,
        week: 30,
      };
      mockPrismaService.opportunity.create.mockResolvedValue({
        id: 'opp-1',
        ...dto,
      });

      const result = await service.createOpportunity(dto, 'user-1');
      expect(result).toHaveProperty('id', 'opp-1');
      expect(mockPrismaService.opportunity.create).toHaveBeenCalled();
    });

    it('should update opportunity successfully', async () => {
      mockPrismaService.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
      });
      mockPrismaService.opportunity.update.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Updated',
      });

      const dto = { companyName: 'Updated' };
      const result = await service.updateOpportunity('opp-1', dto);
      expect(result).toHaveProperty('companyName', 'Updated');
      expect(mockPrismaService.opportunity.update).toHaveBeenCalled();
    });

    it('should preserve size: SME when creating opportunity and not force to Enterprise', async () => {
      const dto = {
        companyName: 'SME Client',
        size: 'SME',
        setupFee: 20000000,
        monthlyFee: 5000000,
        expectedCloseDate: '2026-09-30',
        year: 2026,
        week: 38,
      };
      mockPrismaService.opportunity.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'opp-sme', ...data }),
      );

      const result = await service.createOpportunity(dto, 'user-1');
      expect(result.size).toBe('SME');
      expect(mockPrismaService.opportunity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyName: 'SME Client',
          size: 'SME',
        }),
      });
    });

    it('should update opportunity with size: SME without forcing to Enterprise', async () => {
      mockPrismaService.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Test',
        size: 'Enterprise',
      });
      mockPrismaService.opportunity.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'opp-1', ...data }),
      );

      const result = await service.updateOpportunity('opp-1', { size: 'SME' });
      expect(mockPrismaService.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: expect.objectContaining({
          size: 'SME',
        }),
      });
      expect(result.size).toBe('SME');
    });

    it('should map SME opportunities into smb segment in getPipelineBySegmentData', async () => {
      mockPrismaService.opportunity.findMany
        .mockResolvedValueOnce([
          {
            id: 'opp-sme-1',
            size: 'SME',
            setupFee: 10000000,
            monthlyFee: 2000000,
          },
          {
            id: 'opp-ent-1',
            size: 'Enterprise',
            setupFee: 50000000,
            monthlyFee: 10000000,
          },
        ])
        .mockResolvedValueOnce([]); // prevOpps

      const res = await service.getPipelineBySegmentData('year', '2026', 2026);
      const smb = res.data.find((d) => d.segment === 'smb');
      expect(smb).toBeDefined();
      expect(smb?.openDeals).toBe(1);
      expect(smb?.value).toBe(12000000);

      const ent = res.data.find((d) => d.segment === 'enterprise');
      expect(ent).toBeDefined();
      expect(ent?.openDeals).toBe(1);
      expect(ent?.value).toBe(60000000);
    });
  });

  describe('Comparison', () => {
    it('should get comparison data with optional years omitted', async () => {
      mockPrismaService.kpiActual.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);

      const query = {
        periodType: 'quarter' as const,
        currentPeriodValue: '1',
        year1: '2026',
        year2: undefined,
        year3: undefined,
      };

      const result = await service.getComparison(query);
      expect(result.year1.year).toBe(2026);
      expect(result.year2).toBeNull();
      expect(result.year3).toBeNull();
      expect(result.yoy26vs25).toBeNull();
    });
  });

  describe('Closed Deals', () => {
    it('should list closed deals with archivedAt: null filter and format response correctly', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          companyName: 'Company A',
          size: 'Enterprise',
          projectId: 'p-1',
          project: { id: 'p-1', name: 'Project 1' },
          setupFee: 50000000,
          monthlyFee: 10000000,
          closedDate: new Date('2026-06-15T00:00:00.000Z'),
          createdBy: { id: 'u-1', name: 'Nguyen Van A' },
          week: 24,
          year: 2026,
          archivedAt: null,
        },
      ];
      mockPrismaService.closedDeal.findMany.mockResolvedValue(mockDeals);

      const result = await service.getClosedDeals({
        year: '2026',
        size: 'Enterprise',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'deal-1',
        companyName: 'Company A',
        size: 'Enterprise',
        projectId: 'p-1',
        projectName: 'Project 1',
        contractName: null,
        setupFee: 50000000,
        monthlyFee: 10000000,
        dealValue: 170000000,
        closedDate: '2026-06-15',
        createdBy: 'Nguyen Van A',
        week: 24,
        year: 2026,
        archivedAt: null,
        initiationDate: null,
        opportunityId: null,
      });
      expect(mockPrismaService.closedDeal.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          year: 2026,
          size: 'Enterprise',
          archivedAt: null,
        }),
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          opportunity: { select: { initiationDate: true } },
        },
        orderBy: { closedDate: 'desc' },
      });
    });

    it('should filter closed deals by valid projectId and throw on invalid projectId', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({ id: 'p-1' });
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);

      const res = await service.getClosedDeals({ projectId: 'p-1' });
      expect(res).toEqual([]);
      expect(mockPrismaService.closedDeal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'p-1', archivedAt: null }),
        }),
      );

      mockPrismaService.project.findFirst.mockResolvedValueOnce(null);
      await expect(service.getClosedDeals({ projectId: 'invalid-p' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update closed deal when active', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue({
        id: 'deal-1',
        companyName: 'Old Name',
        archivedAt: null,
      });
      mockPrismaService.closedDeal.update.mockResolvedValue({
        id: 'deal-1',
        companyName: 'New Name',
      });

      const result = await service.updateClosedDeal('deal-1', {
        companyName: 'New Name',
      });

      expect(result.companyName).toBe('New Name');
      expect(mockPrismaService.closedDeal.findFirst).toHaveBeenCalledWith({
        where: { id: 'deal-1', archivedAt: null },
      });
    });

    it('should throw NotFoundException when updating archived or missing closed deal', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue(null);

      await expect(
        service.updateClosedDeal('missing-deal', { companyName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete closed deal and reset opportunity status to active', async () => {
      const mockDeal = { id: 'deal-1', opportunityId: 'opp-1' };
      mockPrismaService.closedDeal.findFirst.mockResolvedValue(mockDeal);
      mockPrismaService.opportunity.updateMany.mockResolvedValue({});
      mockPrismaService.closedDeal.update.mockResolvedValue({});

      const result = await service.deleteClosedDeal('deal-1');
      expect(result).toEqual({ success: true });
      expect(mockPrismaService.opportunity.updateMany).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: { status: 'active', wonDate: null },
      });
      expect(mockPrismaService.closedDeal.update).toHaveBeenCalled();
    });
  });

  describe('Weekly and Monthly Project Plan', () => {
    it('should save project plan for a specific week', async () => {
      mockPrismaService.kpiDistribution.upsert.mockResolvedValue({});

      await service.saveWeeklyData(
        {
          year: 2026,
          week: 35,
          projectId: 'proj-1',
          rawLeadsPlan: 100,
          mqlPlan: 40,
          sqlPlan: 20,
          oppPlan: 5,
          closedDealPlan: 2,
        },
        'user-1',
      );

      expect(mockPrismaService.kpiDistribution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            year_week_projectId_type: {
              year: 2026,
              week: 35,
              projectId: 'proj-1',
              type: 'plan',
            },
          },
          update: expect.objectContaining({
            rawLeads: 100,
            mql: 40,
            sql: 20,
            oppCount: 5,
            closedCount: 2,
          }),
        }),
      );
    });

    it('should return saved plan in planGoc when querying weekly data for a project', async () => {
      mockPrismaService.kpiDistribution.findUnique
        .mockResolvedValueOnce({
          rawLeads: 100,
          mql: 40,
          sql: 20,
          oppCount: 5,
          closedCount: 2,
        }) // type: plan
        .mockResolvedValueOnce({
          rawLeads: 50,
          mql: 20,
          sql: 10,
          oppCount: 2,
          closedCount: 1,
        }); // type: actual

      mockPrismaService.kpiPlan.findUnique.mockResolvedValue({
        totalRawLeads: 12000,
        targetMql: 2400,
        targetSql: 1200,
        targetOpp: 600,
        targetClosedDeal: 300,
      });

      mockPrismaService.projectDailyActual.findMany.mockResolvedValueOnce([
        {
          actualDate: new Date('2026-08-25T00:00:00.000Z'),
          rawLeads: 50,
          mql: 20,
          sql: 10,
          opp: 2,
          closedDeal: 1,
        },
      ]);

      const result = await service.getWeeklyData(2026, 35, 'proj-1');

      expect(result.planGoc).toEqual({
        rawLeads: 100,
        mql: 40,
        sql: 20,
        oppCount: 5,
        closedCount: 2,
      });
      expect(result.actual).toEqual({
        rawLeads: 50,
        mql: 20,
        sql: 10,
        oppCount: 2,
        closedCount: 1,
      });
    });

    it('should return distributed saved plan in planGoc when querying monthly data for a project', async () => {
      mockPrismaService.kpiDistribution.findMany
        .mockResolvedValueOnce([
          { rawLeads: 25, mql: 10, sql: 5, oppCount: 1, closedCount: 0 },
          { rawLeads: 25, mql: 10, sql: 5, oppCount: 1, closedCount: 0 },
          { rawLeads: 25, mql: 10, sql: 5, oppCount: 1, closedCount: 0 },
          { rawLeads: 25, mql: 10, sql: 5, oppCount: 2, closedCount: 2 },
        ]) // type: plan
        .mockResolvedValueOnce([
          { rawLeads: 10, mql: 5, sql: 2, oppCount: 0, closedCount: 0 },
        ]); // type: actual

      const result = await service.getWeeklyData(2026, undefined, 'proj-1', 9);

      expect(result.planGoc).toEqual({
        rawLeads: 100,
        mql: 40,
        sql: 20,
        oppCount: 5,
        closedCount: 2,
      });
    });
  });

  describe('Compare Data Deletion', () => {
    it('should delete all related records in transaction for specified years', async () => {
      mockPrismaService.task.deleteMany.mockResolvedValue({});
      mockPrismaService.closedDeal.deleteMany.mockResolvedValue({});
      mockPrismaService.opportunity.deleteMany.mockResolvedValue({});
      mockPrismaService.expenseRecord.deleteMany.mockResolvedValue({});
      mockPrismaService.weeklyReportLog.deleteMany.mockResolvedValue({});
      mockPrismaService.kpiDistribution.deleteMany.mockResolvedValue({});
      mockPrismaService.kpiActual.deleteMany.mockResolvedValue({});
      mockPrismaService.kpiPlan.deleteMany.mockResolvedValue({});
      mockPrismaService.systemConfig.deleteMany.mockResolvedValue({});

      const result = await service.deleteCompareData([2025, 2026]);
      expect(result.success).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('Opportunity & Won Deal Management (Mục 7)', () => {
    it('should create opportunity with contractName', async () => {
      mockPrismaService.opportunity.create.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Company X',
        size: 'Enterprise',
        contractName: 'HD-2026-001',
        setupFee: 50000000,
        monthlyFee: 10000000,
        status: 'active',
        year: 2026,
        week: 34,
      });

      const result = await service.createOpportunity(
        {
          companyName: 'Company X',
          size: 'Enterprise',
          contractName: 'HD-2026-001',
          setupFee: 50000000,
          monthlyFee: 10000000,
        },
        'user-1',
      );

      expect(result.contractName).toBe('HD-2026-001');
      expect(mockPrismaService.opportunity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyName: 'Company X',
          contractName: 'HD-2026-001',
          createdById: 'user-1',
        }),
      });
    });

    it('should mark opportunity won and copy contractName and signedDate to ClosedDeal', async () => {
      mockPrismaService.closedDeal.findUnique.mockResolvedValue(null);
      mockPrismaService.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Company X',
        size: 'Enterprise',
        projectId: 'p-1',
        contractName: 'HD-GOC',
        setupFee: 50000000,
        monthlyFee: 10000000,
        year: 2026,
        week: 30,
      });

      mockPrismaService.opportunity.update.mockResolvedValue({
        id: 'opp-1',
        status: 'won',
        contractName: 'HD-MOI',
      });

      mockPrismaService.closedDeal.create.mockResolvedValue({
        id: 'deal-new',
        companyName: 'Company X',
        contractName: 'HD-MOI',
        closedDate: new Date('2026-08-20'),
      });

      const result = await service.markOpportunityWon('opp-1', 'user-1', {
        contractName: 'HD-MOI',
        signedDate: '2026-08-20',
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: expect.objectContaining({
          status: 'won',
          contractName: 'HD-MOI',
        }),
      });
      expect(mockPrismaService.closedDeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyName: 'Company X',
          contractName: 'HD-MOI',
          opportunityId: 'opp-1',
          createdById: 'user-1',
        }),
      });
    });
  });

  describe('Monthly KPI Plan (BE-06)', () => {
    it('returns 12 months with defaults and computed totals', async () => {
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue({
        year: 2026,
        rawLeads: 1200,
        mql: 600,
        sql: 300,
        oppCount: 150,
        closedCount: 60,
        pipelineValue: 1200000000,
        wonValue: 600000000,
      });

      mockPrismaService.kpiMonthlyPlan.findMany.mockResolvedValue([
        {
          year: 2026,
          month: 1,
          rawLeads: 100,
          mql: 50,
          sql: 25,
          oppCount: 12,
          closedCount: 5,
          pipelineValue: 100000000,
          wonValue: 50000000,
        },
      ]);

      const res = await service.getMonthlyPlan(2026);
      expect(res.year).toBe(2026);
      expect(res.months.length).toBe(12);
      expect(res.months[0].rawLeads).toBe(100);
      expect(res.months[1].rawLeads).toBe(0);
      expect(res.monthlyTotal.rawLeads).toBe(100);
      expect(res.diff.rawLeads).toBeDefined();
    });

    it('saves monthly plans and applies monthly total to annual plan atomically', async () => {
      mockPrismaService.kpiMonthlyPlan.upsert.mockResolvedValue({});
      mockPrismaService.kpiPlan.update.mockResolvedValue({ year: 2026 });
      mockPrismaService.kpiMonthlyPlan.findMany.mockResolvedValue([
        {
          year: 2026,
          month: 1,
          rawLeads: 100,
          mql: 50,
          sql: 25,
          oppCount: 10,
          closedCount: 5,
          pipelineValue: 100000000,
          wonValue: 50000000,
        },
      ]);

      await service.saveMonthlyPlan(
        2026,
        {
          months: [
            {
              month: 1,
              rawLeads: 100,
              mql: 50,
              sql: 25,
              oppCount: 10,
              closedCount: 5,
              pipelineValue: 100000000,
              wonValue: 50000000,
            },
          ],
        },
        'user-1',
      );

      expect(mockPrismaService.kpiMonthlyPlan.upsert).toHaveBeenCalled();

      const applyRes = await service.applyMonthlyTotal(2026, 'user-1');
      expect(applyRes.message).toBeDefined();
      expect(mockPrismaService.kpiPlan.upsert).toHaveBeenCalled();
    });
  });

  describe('September Spec: Project KPI & Daily Actuals', () => {
    it('should save and get project KPI plan correctly', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
        type: 'Lead Gen',
        kpiRawLeadsPlan: 400,
        kpiMqlPlan: 250,
        kpiSqlPlan: 100,
        kpiOppPlan: 40,
        kpiClosedDealPlan: 12,
        kpiPipelineValuePlan: 500000000,
      });

      const plan = await service.getProjectKpiPlan('prj-1');
      expect(plan.plan.rawLeads).toBe(400);
      expect(plan.plan.mql).toBe(250);

      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
      });
      mockPrismaService.project.update.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
        kpiRawLeadsPlan: 500,
        kpiMqlPlan: 300,
        kpiSqlPlan: 120,
        kpiOppPlan: 50,
        kpiClosedDealPlan: 15,
        kpiPipelineValuePlan: 600000000,
      });

      const saved = await service.saveProjectKpiPlan('prj-1', {
        rawLeadsPlan: 500,
        mqlPlan: 300,
      });
      expect(saved.plan.rawLeads).toBe(500);
      expect(saved.plan.mql).toBe(300);
    });

    it('should calculate annual allocation and remaining target correctly', async () => {
      mockPrismaService.kpiPlan.findUnique.mockResolvedValueOnce({
        year: 2026,
        totalRawLeads: 10000,
        targetMql: 6000,
        targetSql: 2500,
        targetOpp: 1000,
        targetClosedDeal: 300,
        targetPipelineVal: 10000000000,
      });

      mockPrismaService.project.findMany.mockResolvedValueOnce([
        {
          id: 'prj-1',
          name: 'Project 1',
          kpiRawLeadsPlan: 4000,
          kpiMqlPlan: 2500,
          kpiSqlPlan: 1000,
          kpiOppPlan: 400,
          kpiClosedDealPlan: 120,
          kpiPipelineValuePlan: 4000000000,
        },
        {
          id: 'prj-2',
          name: 'Project 2',
          kpiRawLeadsPlan: 3500,
          kpiMqlPlan: 2000,
          kpiSqlPlan: 800,
          kpiOppPlan: 300,
          kpiClosedDealPlan: 80,
          kpiPipelineValuePlan: 3000000000,
        },
      ]);

      const allocation = await service.getAnnualAllocation(2026);
      expect(allocation.annualTarget.rawLeads).toBe(10000);
      expect(allocation.allocatedTarget.rawLeads).toBe(7500);
      expect(allocation.remainingTarget.rawLeads).toBe(2500);
      expect(allocation.isOverAllocated).toBe(false);
    });

    it('should save daily actual by replacing (no cumulative error)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
      });

      mockPrismaService.projectDailyActual.upsert.mockResolvedValueOnce({
        id: 'daily-1',
        projectId: 'prj-1',
        actualDate: new Date('2026-09-03'),
        rawLeads: 15,
        mql: 10,
        sql: 4,
        opp: 2,
        closedDeal: 1,
        note: 'Updated day actual',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.saveDailyActual('prj-1', {
        actualDate: '2026-09-03',
        rawLeads: 15,
        mql: 10,
        sql: 4,
        opp: 2,
        closedDeal: 1,
      });

      expect(res.rawLeads).toBe(15);
      expect(res.isoWeek).toBe('2026-W36');
      expect(mockPrismaService.projectDailyActual.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_actualDate: {
              projectId: 'prj-1',
              actualDate: new Date('2026-09-03'),
            },
          },
        }),
      );
    });

    it('should calculate project cumulative progress and handle 0-plan correctly', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
        kpiRawLeadsPlan: 400,
        kpiMqlPlan: 0, // 0 plan should result in null completionRate
      });

      mockPrismaService.projectDailyActual.findMany.mockResolvedValueOnce([
        { rawLeads: 100, mql: 50, sql: 20, opp: 5, closedDeal: 2 },
        { rawLeads: 120, mql: 60, sql: 30, opp: 10, closedDeal: 4 },
      ]);

      const progress = await service.getProjectKpiProgress('prj-1', 2026);
      expect(progress.actualCumulative.rawLeads).toBe(220);
      expect(progress.actualCumulative.mql).toBe(110);
      expect(progress.completionRate.rawLeads).toBe(55); // 220 / 400 * 100
      expect(progress.completionRate.mql).toBeNull(); // Plan = 0
    });

    it('should aggregate weekly report directly from daily actuals', async () => {
      mockPrismaService.projectDailyActual.findMany.mockResolvedValueOnce([
        {
          id: 'd-1',
          projectId: 'prj-1',
          actualDate: new Date('2026-09-03'), // Thursday week 36
          rawLeads: 10,
          mql: 5,
          sql: 2,
          opp: 1,
          closedDeal: 0,
        },
        {
          id: 'd-2',
          projectId: 'prj-1',
          actualDate: new Date('2026-09-04'), // Friday week 36
          rawLeads: 15,
          mql: 8,
          sql: 3,
          opp: 1,
          closedDeal: 1,
        },
      ]);

      const report = await service.getWeeklyReportFromDaily(2026, 36);
      expect(report.total.rawLeads).toBe(25);
      expect(report.total.mql).toBe(13);
      expect(report.dailyRecords.length).toBe(2);
    });

    it('should return flat record with actualId in getDailyActual', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
      });
      mockPrismaService.projectDailyActual.findUnique.mockResolvedValueOnce({
        id: 'daily-1',
        projectId: 'prj-1',
        actualDate: new Date('2026-09-03'),
        rawLeads: 15,
        mql: 10,
        sql: 4,
        opp: 2,
        closedDeal: 1,
        note: 'Some note',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getDailyActual('prj-1', '2026-09-03');
      expect(res.exists).toBe(true);
      expect(res.id).toBe('daily-1');
      expect(res.actualId).toBe('daily-1');
      expect(res.rawLeads).toBe(15);
      expect(res.actualDate).toBe('2026-09-03');
    });

    it('should return exists: false and actualId: null when daily actual not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
      });
      mockPrismaService.projectDailyActual.findUnique.mockResolvedValueOnce(null);

      const res = await service.getDailyActual('prj-1', '2026-09-03');
      expect(res.exists).toBe(false);
      expect(res.id).toBeNull();
      expect(res.actualId).toBeNull();
      expect(res.rawLeads).toBe(0);
    });

    it('should patch daily actual by actualId via updateDailyActualById', async () => {
      mockPrismaService.project.findFirst.mockResolvedValueOnce({
        id: 'prj-1',
        name: 'Project 1',
      });
      mockPrismaService.projectDailyActual.findFirst.mockResolvedValueOnce({
        id: 'daily-1',
        projectId: 'prj-1',
        actualDate: new Date('2026-09-03'),
      });
      mockPrismaService.projectDailyActual.update.mockResolvedValueOnce({
        id: 'daily-1',
        projectId: 'prj-1',
        actualDate: new Date('2026-09-03'),
        rawLeads: 20,
        mql: 12,
        sql: 5,
        opp: 3,
        closedDeal: 1,
        note: 'Patched note',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateDailyActualById('prj-1', 'daily-1', {
        rawLeads: 20,
        mql: 12,
      });

      expect(res.actualId).toBe('daily-1');
      expect(res.rawLeads).toBe(20);
      expect(res.mql).toBe(12);
    });
  });

  describe('BE_REQUIREMENT_11-09-26 Enhancements', () => {
    it('getWeeklyData should return contractName and initiationDate for opportunities', async () => {
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.kpiActual.findUnique.mockResolvedValue(null);
      mockPrismaService.project.findMany.mockResolvedValue([]);
      mockPrismaService.projectDailyActual.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp-field-test',
          companyName: 'Tech Corp',
          size: 'Enterprise',
          projectId: 'p-1',
          contractName: 'HD-TECH-001',
          initiationDate: new Date('2026-03-15T00:00:00.000Z'),
          setupFee: 100000000,
          monthlyFee: 20000000,
          expectedCloseDate: new Date('2026-07-20T00:00:00.000Z'),
          status: 'active',
          week: 10,
          year: 2026,
          notes: 'Test note',
        },
      ]);

      const result = await service.getWeeklyData(2026, 10);
      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].contractName).toBe('HD-TECH-001');
      expect(result.opportunities[0].initiationDate).toBe('2026-03-15');
    });

    it('getComparison takes leads from daily actuals (req 22-09 §2.1) and keeps max parity for OPP / closed', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'p-1' }]);
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([
        {
          rawLeads: 10,
          mql: 20,
          sql: 5,
          oppCount: 1,
          closedCount: 0,
        },
      ]);
      mockPrismaService.projectDailyActual.findMany.mockResolvedValue([
        {
          rawLeads: 30, // daily value wins
          mql: 15,     // daily value wins even when the week-level row is higher
          sql: 12,
          opp: 4,      // greater than 1 -> 4 (max parity kept for OPP)
          closedDeal: 2,
        },
      ]);
      mockPrismaService.opportunity.count.mockResolvedValue(0);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);

      const comparison = await service.getComparison({
        periodType: 'month',
        currentPeriodValue: '9',
        year1: '2026',
      });

      const actual = comparison.year1.data.actual;
      expect(actual.rawLeads).toBe(30);
      expect(actual.mql).toBe(15);
      expect(actual.sql).toBe(12);
      expect(actual.oppCount).toBe(4);
      expect(actual.closedCount).toBe(2);
    });
  });

  describe('BE_REQUIREMENT_22_09_26: Week Actuals derived strictly from Daily Actuals', () => {
    it('should calculate W39 actuals strictly from projectDailyActual, ignoring stale week-level kpiDistribution', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([
        { id: 'lead-gen-id', name: 'LEAD GENERATION 2026' },
        { id: 'acc-id', name: 'ACCOUNT CENTRIC' },
        { id: 'innoex-id', name: 'INNOEX' },
      ]);
      // kpiDistribution has stale 1 lead for each project in W39 (total 3)
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([
        { projectId: 'lead-gen-id', rawLeads: 1, mql: 1, sql: 1 },
        { projectId: 'acc-id', rawLeads: 1, mql: 1, sql: 1 },
        { projectId: 'innoex-id', rawLeads: 1, mql: 1, sql: 0 },
      ]);
      // projectDailyActual ONLY has 1 record for LEAD GENERATION on 2026-09-22
      mockPrismaService.projectDailyActual.findMany.mockResolvedValue([
        {
          projectId: 'lead-gen-id',
          actualDate: new Date('2026-09-22T00:00:00.000Z'),
          rawLeads: 1,
          mql: 1,
          sql: 1,
          opp: 0,
          closedDeal: 0,
          project: { id: 'lead-gen-id', name: 'LEAD GENERATION 2026' },
        },
      ]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);

      const weeklyData = await service.getWeeklyData(2026, 39);
      const weeklyReport = await service.getWeeklyReportFromDaily(2026, 39);

      // Must be 1 lead, not 3!
      expect(weeklyData.actual.rawLeads).toBe(1);
      expect(weeklyReport.total.rawLeads).toBe(1);
      expect(weeklyData.actual.rawLeads).toBe(weeklyReport.total.rawLeads);
    });

    it('should return 0 rawLeads for ACC and INNOEX in W39 when they have no daily actuals', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'acc-id' }]);
      mockPrismaService.projectDailyActual.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);

      const accResult = await service.getWeeklyData(2026, 39, 'acc-id');
      expect(accResult.actual.rawLeads).toBe(0);

      const innoexResult = await service.getWeeklyData(2026, 39, 'innoex-id');
      expect(innoexResult.actual.rawLeads).toBe(0);
    });
  });

  describe('BE_REQUIREMENT_26_09_26 §3: ClosedDeal initiationDate / opportunityId', () => {
    const baseDeal = {
      id: 'deal-1',
      companyName: 'Company A',
      size: 'Enterprise',
      projectId: 'p-1',
      project: { id: 'p-1', name: 'Project 1' },
      contractName: null,
      setupFee: 50000000,
      monthlyFee: 10000000,
      closedDate: new Date('2026-06-15T00:00:00.000Z'),
      createdBy: { id: 'u-1', name: 'Nguyen Van A' },
      week: 24,
      year: 2026,
      archivedAt: null,
    };

    it('list returns the deal own initiationDate and opportunityId', async () => {
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        {
          ...baseDeal,
          initiationDate: new Date('2026-04-02T00:00:00.000Z'),
          opportunityId: 'opp-1',
          opportunity: { initiationDate: new Date('2026-01-01T00:00:00.000Z') },
        },
      ]);

      const [deal] = await service.getClosedDeals({ year: '2026' });
      expect(deal.initiationDate).toBe('2026-04-02');
      expect(deal.opportunityId).toBe('opp-1');
      // existing fields untouched
      expect(deal.closedDate).toBe('2026-06-15');
      expect(deal.dealValue).toBe(170000000);
      expect(deal.week).toBe(24);
      expect(deal.year).toBe(2026);
      expect(deal).not.toHaveProperty('opportunity');
    });

    it('list falls back to the linked opportunity initiationDate, else null', async () => {
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        {
          ...baseDeal,
          initiationDate: null,
          opportunityId: 'opp-2',
          opportunity: { initiationDate: new Date('2026-03-09T00:00:00.000Z') },
        },
        {
          ...baseDeal,
          id: 'deal-2',
          initiationDate: null,
          opportunityId: null,
          opportunity: null,
        },
      ]);

      const [withOpp, imported] = await service.getClosedDeals({ year: '2026' });
      expect(withOpp.initiationDate).toBe('2026-03-09');
      expect(withOpp.opportunityId).toBe('opp-2');
      expect(imported.initiationDate).toBeNull();
      expect(imported.opportunityId).toBeNull();
    });

    it('weekly data closedDeals include initiationDate/opportunityId and load the opportunity date', async () => {
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'p-1' }]);
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([]);
      mockPrismaService.projectDailyActual.findMany.mockResolvedValue([]);
      mockPrismaService.opportunity.findMany.mockResolvedValue([]);
      mockPrismaService.kpiPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        {
          ...baseDeal,
          initiationDate: null,
          opportunityId: 'opp-1',
          opportunity: { initiationDate: new Date('2026-05-04T00:00:00.000Z') },
        },
      ]);

      const weekly = await service.getWeeklyData(2026, 24);
      expect(weekly.closedDeals[0]).toEqual(
        expect.objectContaining({
          id: 'deal-1',
          closedDate: '2026-06-15',
          initiationDate: '2026-05-04',
          opportunityId: 'opp-1',
        }),
      );
      expect(mockPrismaService.closedDeal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            opportunity: { select: { initiationDate: true } },
          }),
        }),
      );
    });

    it('POST /opportunities/:id/won copies the opportunity initiationDate to the new deal', async () => {
      const oppInit = new Date('2026-02-10T00:00:00.000Z');
      mockPrismaService.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Company X',
        size: 'Enterprise',
        projectId: 'p-1',
        contractName: null,
        setupFee: 50000000,
        monthlyFee: 10000000,
        initiationDate: oppInit,
      });
      mockPrismaService.opportunity.update.mockResolvedValue({ id: 'opp-1', status: 'won' });
      mockPrismaService.closedDeal.findUnique.mockResolvedValue(null);
      mockPrismaService.closedDeal.create.mockImplementation(async ({ data }: any) => ({
        id: 'deal-new',
        ...data,
      }));

      const result = await service.markOpportunityWon('opp-1', 'user-1', {
        signedDate: '2026-08-20',
      });

      expect(mockPrismaService.closedDeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          initiationDate: oppInit,
          opportunityId: 'opp-1',
          createdById: 'user-1',
        }),
      });
      expect(result.closedDeal.initiationDate).toBe('2026-02-10');
      expect(result.closedDeal.opportunityId).toBe('opp-1');
      expect(result.closedDeal.id).toBe('deal-new');
    });

    it('won on an opportunity whose deal was archived updates that deal (opportunityId is unique)', async () => {
      mockPrismaService.opportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        companyName: 'Company X',
        size: 'Enterprise',
        projectId: 'p-1',
        contractName: null,
        setupFee: 1,
        monthlyFee: 0,
        initiationDate: null,
      });
      mockPrismaService.opportunity.update.mockResolvedValue({ id: 'opp-1', status: 'won' });
      mockPrismaService.closedDeal.findUnique.mockResolvedValue({
        id: 'deal-old',
        opportunityId: 'opp-1',
        archivedAt: new Date(),
      });
      mockPrismaService.closedDeal.update.mockImplementation(async ({ data }: any) => ({
        id: 'deal-old',
        opportunityId: 'opp-1',
        ...data,
      }));

      const result = await service.markOpportunityWon('opp-1', 'user-1');

      expect(mockPrismaService.closedDeal.create).not.toHaveBeenCalled();
      expect(mockPrismaService.closedDeal.update).toHaveBeenCalledWith({
        where: { id: 'deal-old' },
        data: expect.objectContaining({
          initiationDate: null,
          archivedAt: null,
          archivedBy: null,
        }),
      });
      expect(result.closedDeal.initiationDate).toBeNull();
      expect(result.closedDeal.opportunityId).toBe('opp-1');
    });

    it('PUT /closed-deals/:id sets initiationDate and returns it as YYYY-MM-DD', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue({ id: 'deal-1', archivedAt: null });
      mockPrismaService.closedDeal.update.mockImplementation(async ({ data }: any) => ({
        id: 'deal-1',
        companyName: 'A',
        closedDate: new Date('2026-06-15T00:00:00.000Z'),
        opportunityId: null,
        opportunity: null,
        ...data,
      }));

      const result = await service.updateClosedDeal('deal-1', {
        initiationDate: '2026-04-20',
      });

      expect(mockPrismaService.closedDeal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: { initiationDate: new Date('2026-04-20T00:00:00.000Z') },
        include: { opportunity: { select: { initiationDate: true } } },
      });
      expect(result.initiationDate).toBe('2026-04-20');
      expect(result.opportunityId).toBeNull();
      expect(result).not.toHaveProperty('opportunity');
    });

    it('PUT /closed-deals/:id with null clears initiationDate (response falls back to opportunity)', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue({ id: 'deal-1', archivedAt: null });
      mockPrismaService.closedDeal.update.mockImplementation(async ({ data }: any) => ({
        id: 'deal-1',
        opportunityId: 'opp-1',
        opportunity: { initiationDate: new Date('2026-01-05T00:00:00.000Z') },
        ...data,
      }));

      const result = await service.updateClosedDeal('deal-1', { initiationDate: null });

      expect(mockPrismaService.closedDeal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { initiationDate: null } }),
      );
      expect(result.initiationDate).toBe('2026-01-05');
      expect(result.opportunityId).toBe('opp-1');
    });

    it('PUT /closed-deals/:id without initiationDate does not touch it', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue({ id: 'deal-1', archivedAt: null });
      mockPrismaService.closedDeal.update.mockResolvedValue({ id: 'deal-1', companyName: 'B' });

      await service.updateClosedDeal('deal-1', { companyName: 'B', initiationDate: undefined });

      const call = mockPrismaService.closedDeal.update.mock.calls[0][0];
      expect(call.data).toEqual({ companyName: 'B' });
    });

    it('prior-year-deals stores initiationDate (null when absent)', async () => {
      mockPrismaService.closedDeal.deleteMany.mockResolvedValue({});
      mockPrismaService.closedDeal.create.mockResolvedValue({ id: 'x' });

      await service.savePriorYearDeals(
        {
          year: 2025,
          deals: [
            {
              companyName: 'A',
              size: 'SME',
              setupFee: 1,
              closedDate: '2025-03-10',
              initiationDate: '2025-01-15',
            },
            { companyName: 'B', size: 'SME', setupFee: 1, closedDate: '2025-04-10' },
          ],
        },
        'user-1',
      );

      const calls = mockPrismaService.closedDeal.create.mock.calls;
      expect(calls[0][0].data.initiationDate).toEqual(new Date('2025-01-15T00:00:00.000Z'));
      expect(calls[1][0].data.initiationDate).toBeNull();
    });

    it('saveWeeklyData sets initiationDate on created deals only when sent', async () => {
      mockPrismaService.closedDeal.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.create.mockResolvedValue({ id: 'x' });

      await service.saveWeeklyData(
        {
          year: 2026,
          week: 24,
          closedDeals: [
            {
              companyName: 'A',
              size: 'SME',
              setupFee: 1,
              closedDate: '2026-06-10',
              initiationDate: '2026-05-01',
            },
            { companyName: 'B', size: 'SME', setupFee: 1, closedDate: '2026-06-11' },
          ],
        } as any,
        'user-1',
      );

      const calls = mockPrismaService.closedDeal.create.mock.calls;
      expect(calls[0][0].data.initiationDate).toEqual(new Date('2026-05-01T00:00:00.000Z'));
      expect(calls[1][0].data).not.toHaveProperty('initiationDate');
    });
  });
});
