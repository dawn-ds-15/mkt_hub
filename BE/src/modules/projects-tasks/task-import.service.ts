import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/task.dto';
import { TASK_PRIORITIES, TASK_STATUSES } from './projects-tasks.constants';
import { TasksService } from './tasks.service';

type ImportRow = { row: number; errors: string[]; data: CreateTaskDto };

@Injectable()
export class TaskImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async parse(
    file: Express.Multer.File,
    defaultProjectId: string | undefined,
    confirm: boolean,
    userId: string,
  ) {
    if (!file)
      throw new BadRequestException('Vui lòng chọn file CSV hoặc XLSX');
    if (!/\.(csv|xlsx)$/i.test(file.originalname)) {
      throw new BadRequestException('Chỉ hỗ trợ file .csv hoặc .xlsx');
    }
    const rows = /\.csv$/i.test(file.originalname)
      ? this.readCsv(file.buffer.toString('utf8'))
      : await this.readWorkbook(file.buffer);
    if (!rows.length) throw new BadRequestException('File không có dữ liệu');

    const [projects, members] = (await Promise.all([
      this.prisma.project.findMany({ select: { id: true, name: true } }),
      this.prisma.member.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ])) as [
      Array<
        Pick<Prisma.ProjectGetPayload<Record<string, never>>, 'id' | 'name'>
      >,
      Array<
        Pick<Prisma.MemberGetPayload<Record<string, never>>, 'id' | 'name'>
      >,
    ];
    const projectIds = new Set(projects.map((project) => project.id));
    const memberByName = new Map(
      members.map((member) => [member.name.trim().toLowerCase(), member]),
    );
    const normalized: ImportRow[] = rows.map((row, index) => {
      const data = this.normalizeKeys(row);
      const errors: string[] = [];
      const projectId = this.text(data.project_id) || defaultProjectId || '';
      const assigneeName = this.text(data.assignee);
      const assignee = memberByName.get(assigneeName.toLowerCase());
      const status = this.canonical(
        this.text(data.status) || 'Planning',
        TASK_STATUSES,
      );
      const priority = this.canonical(
        this.text(data.priority) || 'Medium',
        TASK_PRIORITIES,
      );
      const dueDate = this.toDate(data.due_date);
      const startDate = data.start_date
        ? this.toDate(data.start_date)
        : undefined;
      const execWeek = Number(data.exec_week);
      const reason = this.text(data.reason) || undefined;

      if (!this.text(data.task_name)) errors.push('task_name là bắt buộc');
      if (!projectIds.has(projectId)) errors.push('project_id không hợp lệ');
      if (!assignee) errors.push(`Không tìm thấy assignee "${assigneeName}"`);
      if (!status) errors.push('status không hợp lệ');
      if (!priority) errors.push('priority không hợp lệ');
      if (!dueDate) errors.push('due_date không hợp lệ');
      if (startDate === null) errors.push('start_date không hợp lệ');
      if (!Number.isInteger(execWeek) || execWeek < 1 || execWeek > 53) {
        errors.push('exec_week phải từ 1 đến 53');
      }
      if (status === 'Backlog' && !reason) {
        errors.push('reason là bắt buộc với Backlog');
      }

      return {
        row: index + 2,
        errors,
        data: {
          name: this.text(data.task_name),
          projectId,
          assigneeId: assignee?.id ?? '',
          status: status ?? 'Planning',
          priority: priority ?? 'Medium',
          startDate: startDate ? startDate.toISOString() : undefined,
          dueDate: dueDate ? dueDate.toISOString() : '',
          execWeek,
          execYear: dueDate?.getUTCFullYear() ?? new Date().getUTCFullYear(),
          reason,
          remark: this.text(data.remark) || undefined,
        },
      };
    });

    const invalid = normalized.filter((row) => row.errors.length);
    if (!confirm) {
      return {
        totalRows: normalized.length,
        validRows: normalized.length - invalid.length,
        errorRows: invalid.length,
        preview: normalized.slice(0, 5),
        errors: invalid,
      };
    }
    if (invalid.length) {
      throw new BadRequestException({
        message: 'File còn dòng không hợp lệ; chưa có task nào được tạo',
        errors: invalid,
      });
    }

    for (const row of normalized) {
      await this.prisma.task.create({
        data: this.tasksService.toCreateData(row.data),
      });
    }
    await this.prisma.importLog.create({
      data: {
        importType: 'task',
        fileName: file.originalname,
        totalRows: normalized.length,
        validRows: normalized.length,
        errorRows: 0,
        createdById: userId,
      },
    });
    return { totalRows: normalized.length, createdRows: normalized.length };
  }

  template() {
    return [
      'task_name,project_id,assignee,status,priority,start_date,due_date,exec_week,remark,reason',
      'Chuẩn bị nội dung,,Nguyen Van A,Planning,Medium,2026-06-01,2026-06-08,23,,',
    ].join('\r\n');
  }

  private async readWorkbook(buffer: Buffer) {
    const workbook = new Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headers: string[] = [];
    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = cell.text;
        });
        return;
      }
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        record[header] = cell.value instanceof Date ? cell.value : cell.text;
      });
      rows.push(record);
    });
    return rows;
  }

  private readCsv(source: string) {
    const records: string[][] = [];
    let record: string[] = [];
    let field = '';
    let quoted = false;
    const input = source.replace(/^\uFEFF/, '');
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') {
        if (quoted && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        record.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && input[index + 1] === '\n') index += 1;
        record.push(field);
        if (record.some((value) => value.length)) records.push(record);
        record = [];
        field = '';
      } else {
        field += char;
      }
    }
    record.push(field);
    if (record.some((value) => value.length)) records.push(record);
    const [headers = [], ...rows] = records;
    return rows.map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? '']),
      ),
    );
  }

  private normalizeKeys(row: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.trim().toLowerCase().replace(/\s+/g, '_'),
        value,
      ]),
    );
  }

  private canonical<T extends readonly string[]>(
    value: string,
    values: T,
  ): T[number] | null {
    return (
      values.find(
        (item) => item.toLowerCase() === value.trim().toLowerCase(),
      ) ?? null
    );
  }

  private text(value: unknown) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    return '';
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
