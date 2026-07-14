import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const prisma = {
    task: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TasksService);
    jest.clearAllMocks();
  });

  it('rejects Backlog without reason (BR-001)', () => {
    expect(() => service.validateBusinessRules('Backlog', '   ')).toThrow(
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
});
