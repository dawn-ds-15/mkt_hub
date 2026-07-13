import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
    },
    kpiDistribution: {
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    closedDeal: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
    },
    systemConfig: {
      findFirst: jest.fn(),
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
      mockPrismaService.kpiDistribution.groupBy.mockResolvedValue([
        {
          type: 'actual',
          _sum: {
            rawLeads: 100,
            mql: 40,
            sql: 20,
            oppCount: 10,
            closedCount: 4,
            pipelineValue: 1000,
            wonValue: 800,
          },
        },
        {
          type: 'plan',
          _sum: {
            rawLeads: 200,
            mql: 80,
            sql: 40,
            oppCount: 20,
            closedCount: 8,
            pipelineValue: 2000,
            wonValue: 1600,
          },
        },
      ]);
      mockPrismaService.kpiDistribution.findMany.mockResolvedValue([]);
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
  });
});
