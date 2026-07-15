import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TaskImportService } from '../../../src/modules/projects-tasks/task-import.service';
import { TasksService } from '../../../src/modules/projects-tasks/tasks.service';

describe('TaskImportService', () => {
  const projectId = '00000000-0000-4000-8000-000000000001';
  const memberId = '00000000-0000-4000-8000-000000000002';
  const prisma = {
    project: { findMany: jest.fn() },
    member: { findMany: jest.fn() },
    task: { create: jest.fn() },
    importLog: { create: jest.fn() },
  };
  const tasksService = { toCreateData: jest.fn() };
  let service: TaskImportService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TaskImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();
    service = module.get(TaskImportService);
    jest.clearAllMocks();
    prisma.project.findMany.mockResolvedValue([{ id: projectId, name: 'P1' }]);
    prisma.member.findMany.mockResolvedValue([{ id: memberId, name: 'Alice' }]);
  });

  it('previews only the first five CSV rows before confirmation (AC-P07)', async () => {
    const header =
      'task_name,assignee,status,priority,due_date,exec_week,remark';
    const rows = Array.from(
      { length: 6 },
      (_, index) => `Task ${index + 1},Alice,To Do,Medium,2026-07-14,29,`,
    );
    const file = {
      originalname: 'tasks.csv',
      buffer: Buffer.from([header, ...rows].join('\n')),
    } as Express.Multer.File;

    const result = await service.parse(file, projectId, false, memberId);
    expect(result).toMatchObject({ totalRows: 6, validRows: 6, errorRows: 0 });
    expect(result.preview).toHaveLength(5);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
