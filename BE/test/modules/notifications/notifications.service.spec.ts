import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    member: {
      findUnique: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return user notifications for assigned tasks and owned projects', async () => {
    const userId = 'user-uuid-1';
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    mockPrismaService.member.findUnique.mockResolvedValue({
      id: userId,
      name: 'Nguyen Van A',
      avatarUrl: null,
    });

    mockPrismaService.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        name: 'Overdue Task',
        dueDate: pastDate,
        status: 'To Do',
        projectId: 'project-1',
        project: { id: 'project-1', name: 'Project 1' },
        assigneeId: userId,
        assignee: { id: userId, name: 'Nguyen Van A', avatarUrl: null },
      },
      {
        id: 'task-2',
        name: 'Upcoming Task',
        dueDate: futureDate,
        status: 'In Progress',
        projectId: 'project-1',
        project: { id: 'project-1', name: 'Project 1' },
        assigneeId: userId,
        assignee: { id: userId, name: 'Nguyen Van A', avatarUrl: null },
      },
    ]);

    mockPrismaService.project.findMany.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project 1',
        status: 'Active',
        createdAt: now,
      },
    ]);

    const result = await service.getUserNotifications(userId);

    expect(result.totalCount).toBe(3); // 2 tasks + 1 project
    expect(result.overdueCount).toBe(1);
    expect(result.upcomingCount).toBe(1);
    expect(result.items.length).toBe(3);
    expect(result.items[0].assigneeId).toBe(userId);
    expect(result.items[0].assignee.id).toBe(userId);
  });

  describe('getAppNotifications', () => {
    it('should return notifications list', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'u1',
          actorId: 'u2',
          type: 'task_assigned',
          taskId: 'task-1',
          projectId: 'proj-1',
          isRead: false,
          createdAt: new Date(),
          actor: { id: 'u2', name: 'User Two', avatarUrl: null },
          task: { id: 'task-1', name: 'Task One', status: 'In Progress' },
          project: { id: 'proj-1', name: 'Project One' },
        },
      ];

      (mockPrismaService as any).notification = {
        findMany: jest.fn().mockResolvedValue(mockNotifications),
      };

      const result = await service.getAppNotifications('u1', false, 20);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('notif-1');
      expect(result[0].type).toBe('task_assigned');
      expect(result[0].actor?.name).toBe('User Two');
      expect(result[0].task?.name).toBe('Task One');
    });
  });

  describe('markAsRead and markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      (mockPrismaService as any).notification = {
        findFirst: jest.fn().mockResolvedValue({ id: 'notif-1', userId: 'u1', isRead: false }),
        update: jest.fn().mockResolvedValue({ id: 'notif-1', isRead: true }),
        updateMany: jest.fn(),
      };

      const res = await service.markAsRead('notif-1', 'u1');
      expect(res.success).toBe(true);
      expect((mockPrismaService as any).notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
    });

    it('should mark all notifications as read for user', async () => {
      (mockPrismaService as any).notification = {
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      };

      const res = await service.markAllAsRead('u1');
      expect(res.success).toBe(true);
      expect(res.count).toBe(5);
      expect((mockPrismaService as any).notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('createNotification', () => {
    it('should skip creating notification if actor is recipient', async () => {
      (mockPrismaService as any).notification = {
        findFirst: jest.fn(),
        create: jest.fn(),
      };

      const res = await service.createNotification({
        userId: 'u1',
        actorId: 'u1',
        type: 'task_assigned',
        taskId: 't1',
      });

      expect(res).toBeNull();
      expect((mockPrismaService as any).notification.create).not.toHaveBeenCalled();
    });

    it('should throttle notification if identical one was sent within 1 minute', async () => {
      (mockPrismaService as any).notification = {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-notif' }),
        create: jest.fn(),
      };

      const res = await service.createNotification({
        userId: 'u1',
        actorId: 'u2',
        type: 'task_assigned',
        taskId: 't1',
      });

      expect(res).toEqual({ id: 'existing-notif' });
      expect((mockPrismaService as any).notification.create).not.toHaveBeenCalled();
    });

    it('should create notification if not duplicate', async () => {
      const createdNotif = {
        id: 'new-notif-1',
        userId: 'u1',
        actorId: 'u2',
        type: 'task_stakeholder_added',
        taskId: 't1',
        projectId: 'p1',
        isRead: false,
        createdAt: new Date(),
      };

      (mockPrismaService as any).notification = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdNotif),
      };

      const res = await service.createNotification({
        userId: 'u1',
        actorId: 'u2',
        type: 'task_stakeholder_added',
        taskId: 't1',
        projectId: 'p1',
      });

      expect(res).toEqual(createdNotif);
      expect((mockPrismaService as any).notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          actorId: 'u2',
          type: 'task_stakeholder_added',
          taskId: 't1',
          projectId: 'p1',
        },
      });
    });
  });
});
