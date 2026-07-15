import { Test, TestingModule } from '@nestjs/testing';
import { WeeklyReportsService } from '../../../src/modules/projects-tasks/weekly-reports.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('WeeklyReportsService', () => {
  let service: WeeklyReportsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    task: {
      findMany: jest.fn(),
    },
    weeklyReportLog: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WeeklyReportsService>(WeeklyReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getReport', () => {
    it('should successfully fetch tasks and logs to assemble a weekly report', async () => {
      const mockTasksDone = [
        {
          id: 'task-1',
          name: 'Task Done',
          status: 'Done',
          project: { id: 'p-1', name: 'Project 1' },
          assignee: { id: 'm-1', name: 'Alice' },
        },
      ];
      const mockTasksPlan = [
        {
          id: 'task-2',
          name: 'Task Plan',
          status: 'In Progress',
          dueDate: new Date('2026-07-20'),
          project: { id: 'p-1', name: 'Project 1' },
          assignee: { id: 'm-1', name: 'Alice' },
        },
      ];
      const mockTasksBacklog = [
        {
          id: 'task-3',
          name: 'Task Backlog',
          status: 'To Do',
          reason: 'Blocked',
          project: { id: 'p-1', name: 'Project 1' },
          assignee: { id: 'm-1', name: 'Alice' },
        },
      ];
      const mockTasksBod = [
        {
          id: 'task-4',
          name: 'Task Bod',
          status: 'In Progress',
          neededSupportBod: 'Need budget approval',
          project: { id: 'p-1', name: 'Project 1' },
          assignee: { id: 'm-1', name: 'Alice' },
        },
      ];
      const mockLog = {
        id: 'log-1',
        year: 2026,
        week: 29,
        doneNotes: 'Notes done',
      };

      mockPrismaService.task.findMany
        .mockResolvedValueOnce(mockTasksDone)
        .mockResolvedValueOnce(mockTasksPlan)
        .mockResolvedValueOnce(mockTasksBacklog)
        .mockResolvedValueOnce(mockTasksBod);

      mockPrismaService.weeklyReportLog.findFirst.mockResolvedValue(mockLog);

      const result = await service.getReport({ year: 2026, week: 29 });

      expect(result.title).toBe('Weekly Report — Tuần 29/2026');
      expect(result.sections.done).toEqual(mockTasksDone);
      expect(result.sections.nextWeekPlan).toEqual(mockTasksPlan);
      expect(result.sections.backlog).toEqual(mockTasksBacklog);
      expect(result.sections.bodSupport).toEqual(mockTasksBod);
      expect(result.log).toEqual(mockLog);
    });
  });

  describe('saveLog', () => {
    it('should create new log if it does not exist', async () => {
      mockPrismaService.weeklyReportLog.findFirst.mockResolvedValue(null);
      mockPrismaService.weeklyReportLog.create.mockResolvedValue({ id: 'log-new' });

      const result = await service.saveLog(
        {
          year: 2026,
          week: 29,
          doneNotes: 'New done notes',
        },
        'user-1',
      );

      expect(mockPrismaService.weeklyReportLog.create).toHaveBeenCalledWith({
        data: {
          year: 2026,
          week: 29,
          projectId: null,
          memberId: null,
          doneNotes: 'New done notes',
          planNotes: undefined,
          backlogNotes: undefined,
          bodNotes: undefined,
          createdById: 'user-1',
        },
      });
      expect(result).toEqual({ id: 'log-new' });
    });

    it('should update existing log if found', async () => {
      const mockLog = { id: 'log-1', year: 2026, week: 29 };
      mockPrismaService.weeklyReportLog.findFirst.mockResolvedValue(mockLog);
      mockPrismaService.weeklyReportLog.update.mockResolvedValue({ ...mockLog, doneNotes: 'Updated notes' });

      const result = await service.saveLog(
        {
          year: 2026,
          week: 29,
          doneNotes: 'Updated notes',
        },
        'user-1',
      );

      expect(mockPrismaService.weeklyReportLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          doneNotes: 'Updated notes',
          planNotes: undefined,
          backlogNotes: undefined,
          bodNotes: undefined,
        },
      });
      expect(result.doneNotes).toBe('Updated notes');
    });
  });

  describe('exportText', () => {
    it('should correctly format report sections into exportable text', async () => {
      const mockReport = {
        period: { from: new Date('2026-07-13'), to: new Date('2026-07-19') },
        sections: {
          done: [{ name: 'Task 1', assignee: { name: 'Alice' }, project: { name: 'P1' } }],
          nextWeekPlan: [{ name: 'Task 2', assignee: { name: 'Bob' }, dueDate: new Date('2026-07-20') }],
          backlog: [{ name: 'Task 3', assignee: { name: 'Alice' }, reason: 'Blocked' }],
          bodSupport: [{ name: 'Task 4', assignee: { name: 'Bob' }, neededSupportBod: 'Need approval' }],
        },
      };

      jest.spyOn(service, 'getReport').mockResolvedValue(mockReport as any);

      const text = await service.exportText({ year: 2026, week: 29 });
      expect(text).toContain('📊 WEEKLY REPORT — TUẦN 29/2026 (2026-07-13–2026-07-19)');
      expect(text).toContain('• Task 1 — Alice (P1)');
      expect(text).toContain('• Task 2 — Bob — Due: 2026-07-20');
      expect(text).toContain('• Task 3 — Alice — Lý do: Blocked');
      expect(text).toContain('• Task 4 — Bob — Nội dung: Need approval');
    });
  });
});
