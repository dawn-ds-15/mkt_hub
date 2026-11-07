import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from '../../../src/modules/projects-tasks/tasks.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('TasksService - Stakeholders & Notifications', () => {
  let service: TasksService;
  let notificationsService: any;
  let prisma: any;

  beforeEach(async () => {
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue(null),
    };

    prisma = {
      task: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      taskStakeholder: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('Status Normalization', () => {
    it('normalizes Vietnamese status strings to canonical TaskStatus', () => {
      expect(service.normalizeTaskStatus('Đang làm')).toBe('In Progress');
      expect(service.normalizeTaskStatus('Dang lam')).toBe('In Progress');
      expect(service.normalizeTaskStatus('Chưa làm')).toBe('To Do');
      expect(service.normalizeTaskStatus('Hoàn thành')).toBe('Done');
      expect(service.normalizeTaskStatus('Tạm dừng')).toBe('Pending');
      expect(service.normalizeTaskStatus('Hủy')).toBe('Cancel');
      expect(service.normalizeTaskStatus('Planning')).toBe('Planning');
    });
  });

  describe('Task creation with stakeholders and notifications', () => {
    it('creates task, saves stakeholders, and emits notifications', async () => {
      const actorUser = { id: 'actor-user-id', email: 'actor@test.com' };

      prisma.member.findMany.mockResolvedValue([
        { id: 'user-stakeholder-1', isActive: true },
        { id: 'user-stakeholder-2', isActive: true },
      ]);
      prisma.member.findUnique.mockResolvedValue({ id: 'assignee-id', isActive: true });

      const createdTask = {
        id: 'new-task-1',
        name: 'Chiến dịch TikTok tháng 10',
        status: 'In Progress',
        assigneeId: 'assignee-id',
        projectId: 'proj-1',
        stakeholderMembers: [
          {
            user: { id: 'user-stakeholder-1', name: 'Member 1', avatarUrl: null },
          },
        ],
        stakeholderUsers: [],
        stakeholders: [],
      };
      prisma.task.create.mockResolvedValue(createdTask);
      prisma.task.findFirst.mockResolvedValue(createdTask);
      prisma.task.findUnique.mockResolvedValue(createdTask);

      const res = await service.create(
        {
          name: 'Chiến dịch TikTok tháng 10',
          status: 'Đang làm',
          assigneeId: 'assignee-id',
          projectId: 'proj-1',
          stakeholderUserIds: ['user-stakeholder-1', 'user-stakeholder-2'],
        },
        actorUser,
      );

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'In Progress', // normalized!
            assigneeId: 'assignee-id',
          }),
        }),
      );

      // Stakeholders should be linked
      expect(prisma.taskStakeholder.createMany).toHaveBeenCalled();

      // Notifications should be triggered for assignee and both stakeholders
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'assignee-id',
          type: 'task_assigned',
          taskId: 'new-task-1',
        }),
      );
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-stakeholder-1',
          type: 'task_stakeholder_added',
          taskId: 'new-task-1',
        }),
      );
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-stakeholder-2',
          type: 'task_stakeholder_added',
          taskId: 'new-task-1',
        }),
      );
    });

    it('throws BadRequestException if any stakeholderUserId does not exist', async () => {
      prisma.member.findMany.mockResolvedValue([
        { id: 'user-1', isActive: true },
      ]); // only 1 found out of 2

      await expect(
        service.create(
          {
            name: 'Task with invalid stakeholder',
            stakeholderUserIds: ['user-1', 'invalid-user-2'],
          },
          { id: 'actor-id' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Task update with new stakeholders', () => {
    it('notifies only newly added stakeholders', async () => {
      const existingTask = {
        id: 'task-100',
        name: 'Existing Task',
        assigneeId: 'assignee-1',
        projectId: 'proj-1',
        stakeholderMembers: [
          { userId: 'existing-stk-1' },
        ],
      };
      prisma.task.findUnique.mockResolvedValue(existingTask);
      prisma.task.findFirst.mockResolvedValue(existingTask);
      prisma.member.findMany.mockResolvedValue([
        { id: 'existing-stk-1', isActive: true },
        { id: 'new-stk-2', isActive: true },
      ]);
      prisma.task.update.mockResolvedValue(existingTask);

      await service.update(
        'task-100',
        {
          stakeholderUserIds: ['existing-stk-1', 'new-stk-2'],
        },
        { id: 'actor-id' },
      );

      // existing-stk-1 was already a stakeholder, new-stk-2 was newly added
      expect(notificationsService.createNotification).toHaveBeenCalledWith({
        userId: 'new-stk-2',
        actorId: 'actor-id',
        type: 'task_stakeholder_added',
        taskId: 'task-100',
        projectId: 'proj-1',
      });
      // Should NOT notify existing-stk-1 again
      expect(notificationsService.createNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'existing-stk-1',
        }),
      );
    });
  });
});
