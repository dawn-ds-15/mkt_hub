import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { startOfBusinessToday } from '../../../src/common/utils/date.util';
import { TasksService } from '../../../src/modules/projects-tasks/tasks.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('TasksService', () => {
  let service: TasksService;
  const notificationsService = {
    createNotification: jest.fn().mockResolvedValue(null),
    getAppNotifications: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
    markAsRead: jest.fn().mockResolvedValue(null),
    markAllAsRead: jest.fn().mockResolvedValue(null),
  };
  const prisma = {
    task: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    member: {
      findUnique: jest.fn().mockResolvedValue({ id: '1', isActive: true }),
    },
    taskStakeholder: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get(TasksService);
    jest.clearAllMocks();
  });

  it('rejects Backlog without reason (BR-001)', () => {
    expect(() => service.validateBusinessRules('Backlog', '   ')).toThrow(
      BadRequestException,
    );
  });

  it('rejects Pending without reason', () => {
    expect(() => service.validateBusinessRules('Pending', '')).toThrow(
      BadRequestException,
    );
  });

  it('rejects Cancel without reason', () => {
    expect(() => service.validateBusinessRules('Cancel', ' ')).toThrow(
      BadRequestException,
    );
  });

  it('automatically fills completedDate when creating a Done task', () => {
    const data = service.toCreateData({
      name: 'Publish landing page',
      projectId: '00000000-0000-4000-8000-000000000001',
      assigneeId: '00000000-0000-4000-8000-000000000002',
      status: 'Done',
      priority: 'High',
      dueDate: '2026-07-13',
      execWeek: 29,
      execYear: 2026,
    });
    expect(data.completedDate).toBeInstanceOf(Date);
  });

  it('marks yesterday as overdue but not a task due today', async () => {
    const start = startOfBusinessToday();
    const yesterday = new Date(start.getTime() - 86400000);
    prisma.task.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'Old',
        status: 'In Progress',
        dueDate: yesterday,
        stakeholders: null,
      },
      {
        id: '2',
        name: 'Today',
        status: 'In Progress',
        dueDate: start,
        stakeholders: null,
      },
    ]);
    const result = await service.findAll({});
    expect(result.stats.overdue).toBe(1);
    expect(result.data.find((task) => task.id === '2')?.isOverdue).toBe(false);
  });

  it('handles subtasks in toCreateData and generates UUID for items without id, preserving doneDate', () => {
    const data = service.toCreateData({
      name: 'Task with subtasks',
      projectId: '00000000-0000-4000-8000-000000000001',
      assigneeId: '00000000-0000-4000-8000-000000000002',
      dueDate: '2026-09-20',
      priority: 'Medium',
      subtasks: [
        { text: 'Check item 1', doneDate: '2026-09-18' },
        { id: 'custom-id-2', text: 'Check item 2', done: true, doneDate: null },
      ],
    });
    expect(data.subtasks).toBeDefined();
    const parsed = JSON.parse(data.subtasks as string);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBeDefined();
    expect(parsed[0].text).toBe('Check item 1');
    expect(parsed[0].done).toBe(false);
    expect(parsed[0].doneDate).toBe('2026-09-18');
    expect(parsed[1].id).toBe('custom-id-2');
    expect(parsed[1].done).toBe(true);
    expect(parsed[1].doneDate).toBeNull();
  });

  it('preserves stakeholders as array and presents subtasks with all 4 fields including doneDate', async () => {
    const today = startOfBusinessToday();
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-100',
      name: 'Task 100',
      status: 'In Progress',
      priority: 'High',
      dueDate: today,
      startDate: today,
      stakeholders: JSON.stringify(['Nguyễn Văn A', 'Trần Thị B']),
      subtasks: JSON.stringify([
        { id: 'st-1', text: 'Subtask 1', done: false, doneDate: '2026-09-15' },
        { id: 'st-2', text: 'Subtask 2', done: true },
      ]),
      project: { id: 'p-1', name: 'Project 1', type: 'Outbound' },
      assignee: { id: 'm-1', name: 'Alice', avatarUrl: null },
    });

    const result = await service.findOne('task-100');
    expect(result.stakeholders).toEqual(['Nguyễn Văn A', 'Trần Thị B']);
    expect(result.subtasks).toHaveLength(2);
    expect(result.subtasks[0]).toEqual({
      id: 'st-1',
      text: 'Subtask 1',
      done: false,
      doneDate: '2026-09-15',
    });
    expect(result.subtasks[1]).toEqual({
      id: 'st-2',
      text: 'Subtask 2',
      done: true,
      doneDate: null,
    });
  });

  describe('update and name/title compatibility (17/09/2026 requirement)', () => {
    const mockExisting = {
      id: 'task-200',
      name: 'Old Task Name',
      status: 'To Do',
      reason: null,
      remark: 'Old Remark',
      description: 'Old Description',
      assigneeId: '1',
      projectId: 'p-1',
      dueDate: new Date('2026-09-20'),
      startDate: null,
      execWeek: 38,
      execYear: 2026,
    };

    it('updates name using title when name is omitted, and does not pass title to prisma', async () => {
      prisma.task.findUnique.mockResolvedValue(mockExisting);
      prisma.task.update.mockResolvedValue({ ...mockExisting, name: 'Title As Name' });
      prisma.task.findFirst.mockResolvedValue({
        ...mockExisting,
        name: 'Title As Name',
        project: { id: 'p-1', name: 'P1' },
        assignee: { id: '1', name: 'Alice' },
      });

      await service.update('task-200', { title: 'Title As Name' } as any);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-200' },
        data: expect.objectContaining({
          name: 'Title As Name',
        }),
      });
      const updateCallArg = prisma.task.update.mock.calls[0][0];
      expect(updateCallArg.data.title).toBeUndefined();
    });

    it('prefers name over title when both name and title are provided, and strips title', async () => {
      prisma.task.findUnique.mockResolvedValue(mockExisting);
      prisma.task.update.mockResolvedValue({ ...mockExisting, name: 'New Name Value' });
      prisma.task.findFirst.mockResolvedValue({
        ...mockExisting,
        name: 'New Name Value',
        project: { id: 'p-1', name: 'P1' },
        assignee: { id: '1', name: 'Alice' },
      });

      await service.update('task-200', {
        name: 'New Name Value',
        title: 'Fallback Title',
      } as any);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-200' },
        data: expect.objectContaining({
          name: 'New Name Value',
        }),
      });
      const updateCallArg = prisma.task.update.mock.calls[0][0];
      expect(updateCallArg.data.title).toBeUndefined();
    });

    it('updates status to Backlog and saves reason, remark, description together', async () => {
      prisma.task.findUnique.mockResolvedValue(mockExisting);
      prisma.task.update.mockResolvedValue({
        ...mockExisting,
        status: 'Backlog',
        reason: 'Blocker reason from FE',
        remark: 'New remark',
        description: 'New description',
      });
      prisma.task.findFirst.mockResolvedValue({
        ...mockExisting,
        status: 'Backlog',
        reason: 'Blocker reason from FE',
        remark: 'New remark',
        description: 'New description',
        project: { id: 'p-1', name: 'P1' },
        assignee: { id: '1', name: 'Alice' },
      });

      await service.update('task-200', {
        status: 'Backlog',
        reason: 'Blocker reason from FE',
        remark: 'New remark',
        description: 'New description',
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-200' },
        data: expect.objectContaining({
          status: 'Backlog',
          reason: 'Blocker reason from FE',
          remark: 'New remark',
          description: 'New description',
        }),
      });
    });

    it('toCreateData persists remark, description, neededSupportBod, and link', () => {
      const data = service.toCreateData({
        name: 'Create Task All Fields',
        projectId: 'p-1',
        assigneeId: '1',
        priority: 'High',
        dueDate: '2026-09-25',
        description: 'Detailed description',
        remark: 'Important note',
        neededSupportBod: 'Need approval on budget',
        link: 'https://example.com/spec',
      });

      expect(data.name).toBe('Create Task All Fields');
      expect(data.description).toBe('Detailed description');
      expect(data.remark).toBe('Important note');
      expect(data.neededSupportBod).toBe('Need approval on budget');
      expect(data.link).toBe('https://example.com/spec');
    });
  });
});
