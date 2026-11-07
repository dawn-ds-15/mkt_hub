import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Workbook } from 'exceljs';
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
  const tasksService = {
    toCreateData: jest.fn((dto) => dto),
  };
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
    tasksService.toCreateData.mockImplementation((dto) => dto);
    prisma.project.findMany.mockResolvedValue([
      { id: projectId, name: 'Chiến dịch Mùa Hè' },
    ]);
    prisma.member.findMany.mockResolvedValue([
      { id: memberId, name: 'Alice Nguyen', email: 'alice@example.com' },
    ]);
  });

  it('previews only the first five CSV rows before confirmation (AC-P07)', async () => {
    const header =
      'task_name,assignee,status,priority,due_date,exec_week,remark';
    const rows = Array.from(
      { length: 6 },
      (_, index) => `Task ${index + 1},Alice Nguyen,To Do,Medium,2026-07-14,29,`,
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

  it('imports valid campaign task plan Excel file (10 columns, 5 rows) with confirm=true', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Task');
    worksheet.addRow([
      'NUMBER',
      'TASK',
      'START-DAY',
      'END-DAY',
      'PIC',
      'STAKEHOLDER',
      'STATUS',
      'OUTPUT REQUIRE',
      'FILE',
      'NOTE',
    ]);

    for (let i = 1; i <= 5; i++) {
      worksheet.addRow([
        i,
        `Task chiến dịch ${i}`,
        '18/09/2026',
        '25/09/2026',
        'Alice Nguyen',
        'BOD, Sales Team; Dev Team',
        'Đang làm',
        `Mô tả yêu cầu ${i}`,
        'https://drive.google.com/folder1',
        `Ghi chú ${i}`,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const file = {
      originalname: 'MẪU BẢNG KẾ HOẠCH TASK CHIẾN DỊCH.xlsx',
      buffer: Buffer.from(buffer),
    } as Express.Multer.File;

    const result = await service.parse(file, projectId, true, memberId);
    expect(result).toMatchObject({
      imported: 5,
      errors: 0,
      errorList: [],
      totalRows: 5,
      validRows: 5,
      errorRows: 0,
    });
    expect(prisma.task.create).toHaveBeenCalledTimes(5);

    const firstTaskData = tasksService.toCreateData.mock.calls[0][0];
    expect(firstTaskData).toMatchObject({
      name: 'Task chiến dịch 1',
      projectId,
      assigneeId: memberId,
      status: 'In Progress',
      priority: 'Medium',
      description: 'Mô tả yêu cầu 1',
      link: 'https://drive.google.com/folder1',
      remark: 'Ghi chú 1',
      stakeholders: ['BOD', 'Sales Team', 'Dev Team'],
    });
    expect(firstTaskData.startDate).toContain('2026-09-18');
    expect(firstTaskData.dueDate).toContain('2026-09-25');
  });

  it('handles lowercase headers, extra whitespace, and shuffled columns', async () => {
    const csvContent = [
      '  task  ,  pic , number , status , output require , file , note , stakeholder , start-day , end-day ',
      'Task A, alice@example.com , 1 , Hoàn thành , Output A , drive.google.com/fileA , Note A , BOD + Marketing , 2026-09-01 , 2026-09-10 ',
    ].join('\n');

    const file = {
      originalname: 'campaign.csv',
      buffer: Buffer.from(csvContent, 'utf8'),
    } as Express.Multer.File;

    const result = await service.parse(file, projectId, true, memberId);
    expect(result.imported).toBe(1);
    expect(result.errors).toBe(0);

    const taskData = tasksService.toCreateData.mock.calls[0][0];
    expect(taskData.name).toBe('Task A');
    expect(taskData.assigneeId).toBe(memberId);
    expect(taskData.status).toBe('Done');
    expect(taskData.description).toBe('Output A');
    expect(taskData.link).toBe('https://drive.google.com/fileA');
    expect(taskData.remark).toBe('Note A');
    expect(taskData.stakeholders).toEqual(['BOD', 'Marketing']);
  });

  it('records unknown PIC to errorList and continues importing valid rows', async () => {
    const csvContent = [
      'NUMBER,TASK,START-DAY,END-DAY,PIC,STAKEHOLDER,STATUS,OUTPUT REQUIRE,FILE,NOTE',
      '1,Task Valid,18/09/2026,25/09/2026,Alice Nguyen,,To Do,,,',
      '2,Task Invalid PIC,18/09/2026,25/09/2026,Unknown Person,,To Do,,,',
    ].join('\n');

    const file = {
      originalname: 'campaign.csv',
      buffer: Buffer.from(csvContent, 'utf8'),
    } as Express.Multer.File;

    const result = await service.parse(file, projectId, true, memberId);
    expect(result.imported).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.errorList).toHaveLength(1);
    expect(result.errorList[0]).toContain('Dòng 3');
    expect(result.errorList[0]).toContain('Unknown Person');
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
  });

  it('maps various Vietnamese and English statuses and handles Excel serial numbers', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('StatusTest');
    worksheet.addRow(['TASK', 'PIC', 'STATUS', 'START-DAY', 'END-DAY']);
    worksheet.addRow(['T1', 'Alice Nguyen', 'Chưa làm', 46283, 46290]); // serial dates: 2026-09-18 to 2026-09-25
    worksheet.addRow(['T2', 'Alice Nguyen', 'Đang chờ', '2026-09-18', '2026-09-25']);
    worksheet.addRow(['T3', 'Alice Nguyen', 'Tồn đọng', '2026-09-18', '2026-09-25']);
    worksheet.addRow(['T4', 'Alice Nguyen', 'Đã huỷ', '2026-09-18', '2026-09-25']);

    const buffer = await workbook.xlsx.writeBuffer();
    const file = {
      originalname: 'statuses.xlsx',
      buffer: Buffer.from(buffer),
    } as Express.Multer.File;

    const result = await service.parse(file, projectId, true, memberId);
    expect(result.imported).toBe(4);
    expect(result.errors).toBe(0);

    const calls = tasksService.toCreateData.mock.calls;
    expect(calls[0][0].status).toBe('To Do');
    expect(calls[0][0].startDate).toContain('2026-09-18');
    expect(calls[1][0].status).toBe('Review');
    expect(calls[2][0].status).toBe('Backlog');
    expect(calls[3][0].status).toBe('Cancel');
  });

  it('supports legacy CSV format without regression', async () => {
    const header =
      'task_name,project_id,assignee,status,priority,start_date,due_date,exec_week,remark,reason';
    const row = `Task Legacy,${projectId},Alice Nguyen,In Progress,High,2026-06-01,2026-06-08,23,Remark Legacy,Reason Legacy`;
    const file = {
      originalname: 'legacy.csv',
      buffer: Buffer.from([header, row].join('\n')),
    } as Express.Multer.File;

    const result = await service.parse(file, undefined, true, memberId);
    expect(result.imported).toBe(1);
    expect(result.errors).toBe(0);
    const data = tasksService.toCreateData.mock.calls[0][0];
    expect(data.name).toBe('Task Legacy');
    expect(data.priority).toBe('High');
    expect(data.execWeek).toBe(23);
    expect(data.reason).toBe('Reason Legacy');
  });

  it('throws 400 BadRequestException when headers match neither template', async () => {
    const invalidCsv = 'foo,bar,baz\n1,2,3';
    const file = {
      originalname: 'wrong.csv',
      buffer: Buffer.from(invalidCsv),
    } as Express.Multer.File;

    await expect(
      service.parse(file, projectId, true, memberId),
    ).rejects.toThrow(
      new BadRequestException(
        'File không đúng định dạng template task. Vui lòng tải template mới.',
      ),
    );
  });

  it('generates campaign template workbook with 10 columns', async () => {
    const buffer = await service.campaignTemplateWorkbook();
    expect(buffer).toBeDefined();

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.name).toBe('KẾ HOẠCH TASK CHIẾN DỊCH');

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.text);
    });
    expect(headers).toEqual([
      'NUMBER',
      'TASK',
      'START-DAY',
      'END-DAY',
      'PIC',
      'STAKEHOLDER',
      'STATUS',
      'OUTPUT REQUIRE',
      'FILE',
      'NOTE',
    ]);
  });
});

