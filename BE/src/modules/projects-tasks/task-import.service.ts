import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getIsoWeekAndYear } from '../../common/utils/date.util';
import { CreateTaskDto } from './dto/task.dto';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskStatus,
} from './projects-tasks.constants';
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
    defaultYear?: number,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file CSV hoặc XLSX');
    }
    if (!/\.(csv|xlsx)$/i.test(file.originalname)) {
      throw new BadRequestException('Chỉ hỗ trợ file .csv hoặc .xlsx');
    }

    try {
      const rows = /\.csv$/i.test(file.originalname)
        ? this.readCsv(file.buffer.toString('utf8'))
        : await this.readWorkbook(file.buffer);
      if (!rows.length) throw new BadRequestException('File không có dữ liệu');

      this.validateTemplateHeaders(rows);

      const [projects, members] = (await Promise.all([
        this.prisma.project.findMany({ select: { id: true, name: true } }),
        this.prisma.member.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true },
        }),
      ])) as [
        Array<
          Pick<Prisma.ProjectGetPayload<Record<string, never>>, 'id' | 'name'>
        >,
        Array<
          Pick<
            Prisma.MemberGetPayload<Record<string, never>>,
            'id' | 'name' | 'email'
          >
        >,
      ];

      const projectById = new Map(
        projects.map((project) => [project.id, project]),
      );
      const projectByName = new Map(
        projects
          .filter((project) => project.name)
          .map((project) => [
            project.name.trim().toLowerCase().replace(/\s+/g, ' '),
            project,
          ]),
      );

      const memberByName = new Map(
        members
          .filter((member) => member.name)
          .map((member) => [
            member.name.trim().toLowerCase().replace(/\s+/g, ' '),
            member,
          ]),
      );
      const memberByEmail = new Map(
        members
          .filter((member) => member.email)
          .map((member) => [
            member.email!.trim().toLowerCase().replace(/\s+/g, ' '),
            member,
          ]),
      );
      const memberByNoAccentName = new Map(
        members
          .filter((member) => member.name)
          .map((member) => [
            this.removeAccents(
              member.name.trim().toLowerCase().replace(/\s+/g, ' '),
            ),
            member,
          ]),
      );

      const normalized: ImportRow[] = [];

      rows.forEach((row, index) => {
        // Skip completely empty rows
        const isBlank = Object.values(row).every((v) => {
          if (v === null || v === undefined) return true;
          if (typeof v === 'string' && !v.trim()) return true;
          return false;
        });
        if (isBlank) return;

        const mapped = this.normalizeRowData(row);
        const errors: string[] = [];

        // 1. Task Name
        const name = this.text(mapped.task);
        if (!name) {
          errors.push('Tên task (TASK) là bắt buộc');
        }

        // 2. Project ID
        const rawProjectId =
          this.text(mapped.projectId) || defaultProjectId || '';
        let resolvedProjectId = '';
        if (rawProjectId) {
          if (projectById.has(rawProjectId)) {
            resolvedProjectId = rawProjectId;
          } else {
            const byName = projectByName.get(
              rawProjectId.toLowerCase().replace(/\s+/g, ' '),
            );
            if (byName) {
              resolvedProjectId = byName.id;
            }
          }
        }
        if (!resolvedProjectId) {
          errors.push('project_id không hợp lệ hoặc chưa chọn dự án');
        }

        // 3. Assignee / PIC
        const picText = this.text(mapped.pic);
        let assigneeId = '';
        if (!picText) {
          errors.push('PIC (người phụ trách) là bắt buộc');
        } else {
          const matchedMember = this.findMember(
            picText,
            memberByEmail,
            memberByName,
            memberByNoAccentName,
          );
          if (matchedMember) {
            assigneeId = matchedMember.id;
          } else {
            errors.push(`Không tìm thấy PIC "${picText}" trong hệ thống`);
          }
        }

        // 4. Status
        const statusResult = this.parseStatus(mapped.status);
        let status: string = 'To Do';
        if (statusResult.error) {
          errors.push(statusResult.error);
        } else {
          status = statusResult.status ?? 'To Do';
        }

        // 5. Priority
        let priority = 'Medium';
        if (mapped.priority) {
          const canonicalPriority = this.canonical(
            this.text(mapped.priority),
            TASK_PRIORITIES,
          );
          if (canonicalPriority) {
            priority = canonicalPriority;
          } else {
            errors.push('priority không hợp lệ');
          }
        }

        // 6. Dates
        let startDate: Date | undefined = undefined;
        if (mapped.startDate !== undefined && mapped.startDate !== '') {
          const parsedStart = this.parseDate(mapped.startDate);
          if (!parsedStart) {
            errors.push('START-DAY (start_date) không đúng định dạng');
          } else {
            startDate = parsedStart;
          }
        }

        let dueDate: Date | null = null;
        if (mapped.dueDate !== undefined && mapped.dueDate !== '') {
          const parsedDue = this.parseDate(mapped.dueDate);
          if (!parsedDue) {
            errors.push('END-DAY (due_date) không đúng định dạng');
          } else {
            dueDate = parsedDue;
          }
        } else {
          // If END-DAY is missing, fallback to startDate or fallback date
          dueDate =
            startDate ??
            (defaultYear ? new Date(Date.UTC(defaultYear, 0, 1)) : new Date());
        }

        if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
          errors.push(
            'Hạn chót (END-DAY) phải lớn hơn hoặc bằng ngày bắt đầu (START-DAY)',
          );
        }

        // 7. Week & Year
        let execWeek: number;
        let execYear: number;
        if (mapped.execWeek !== undefined && mapped.execWeek !== '') {
          execWeek = Number(mapped.execWeek);
          if (!Number.isInteger(execWeek) || execWeek < 1 || execWeek > 53) {
            errors.push('exec_week phải từ 1 đến 53');
          }
          execYear =
            defaultYear ??
            dueDate?.getUTCFullYear() ??
            new Date().getUTCFullYear();
        } else {
          const iso = getIsoWeekAndYear(dueDate ?? new Date());
          execWeek = iso.week;
          execYear = defaultYear ?? iso.year;
        }

        // 8. Stakeholders
        const stakeholders = this.parseStakeholders(mapped.stakeholder);

        // 9. Description (OUTPUT REQUIRE)
        const description = this.text(mapped.outputRequire) || undefined;

        // 10. Link (FILE)
        const link = this.parseLink(mapped.file);

        // 11. Remark (NOTE)
        const remark = this.text(mapped.note) || undefined;

        // 12. Reason
        const reason = this.text(mapped.reason) || undefined;

        normalized.push({
          row: index + 2,
          errors,
          data: {
            name,
            description,
            projectId: resolvedProjectId,
            assigneeId,
            status,
            priority,
            startDate: startDate ? startDate.toISOString() : undefined,
            dueDate: dueDate ? dueDate.toISOString() : '',
            execWeek,
            execYear,
            stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
            reason,
            link,
            remark,
          },
        });
      });

      const validRows = normalized.filter((row) => row.errors.length === 0);
      const invalidRows = normalized.filter((row) => row.errors.length > 0);
      const errorList = invalidRows.flatMap((r) =>
        r.errors.map((e) => `Dòng ${r.row}: ${e}`),
      );

      if (!confirm) {
        return {
          imported: 0,
          errors: invalidRows.length,
          errorList,
          totalRows: normalized.length,
          validRows: validRows.length,
          errorRows: invalidRows.length,
          createdRows: 0,
          preview: normalized.slice(0, 5),
        };
      }

      for (const row of validRows) {
        const createData = await this.tasksService.toCreateData(row.data);
        await this.prisma.task.create({
          data: createData,
        });
      }

      if (validRows.length > 0 || invalidRows.length > 0) {
        await this.prisma.importLog.create({
          data: {
            importType: 'task',
            fileName: file.originalname,
            totalRows: normalized.length,
            validRows: validRows.length,
            errorRows: invalidRows.length,
            createdById: userId,
          },
        });
      }

      return {
        imported: validRows.length,
        errors: invalidRows.length,
        errorList,
        totalRows: normalized.length,
        validRows: validRows.length,
        errorRows: invalidRows.length,
        createdRows: validRows.length,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Lỗi đọc hoặc lưu file import task: ${err?.message || err}`,
      );
    }
  }

  async campaignTemplateWorkbook(): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('KẾ HOẠCH TASK CHIẾN DỊCH');

    worksheet.columns = [
      { header: 'NUMBER', key: 'number', width: 10 },
      { header: 'TASK', key: 'task', width: 35 },
      { header: 'START-DAY', key: 'startDay', width: 15 },
      { header: 'END-DAY', key: 'endDay', width: 15 },
      { header: 'PIC', key: 'pic', width: 22 },
      { header: 'STAKEHOLDER', key: 'stakeholder', width: 25 },
      { header: 'STATUS', key: 'status', width: 15 },
      { header: 'OUTPUT REQUIRE', key: 'outputRequire', width: 35 },
      { header: 'FILE', key: 'file', width: 30 },
      { header: 'NOTE', key: 'note', width: 25 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    worksheet.addRow({
      number: 1,
      task: 'Thiết kế ấn phẩm truyền thông',
      startDay: '18/09/2026',
      endDay: '25/09/2026',
      pic: 'Nguyen Van A',
      stakeholder: 'BOD, Sales Team',
      status: 'To Do',
      outputRequire: 'Banner 1200x628 và poster A3',
      file: 'https://drive.google.com/sample',
      note: 'Ưu tiên duyệt sớm',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  template() {
    return [
      'NUMBER,TASK,START-DAY,END-DAY,PIC,STAKEHOLDER,STATUS,OUTPUT REQUIRE,FILE,NOTE',
      '1,Thiết kế ấn phẩm truyền thông,18/09/2026,25/09/2026,Nguyen Van A,"BOD, Sales Team",To Do,Banner 1200x628 và poster A3,https://drive.google.com/sample,Ưu tiên duyệt sớm',
    ].join('\r\n');
  }

  legacyTemplate() {
    return [
      'task_name,project_id,assignee,status,priority,start_date,due_date,exec_week,remark,reason',
      'Chuẩn bị nội dung,,Nguyen Van A,Planning,Medium,2026-06-01,2026-06-08,23,,',
    ].join('\r\n');
  }

  private validateTemplateHeaders(rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const firstRowKeys = Object.keys(rows[0]).map((k) =>
      this.removeAccents(k.trim().toLowerCase().replace(/[\s\-_]+/g, '')),
    );
    const hasNewTask = firstRowKeys.some((k) =>
      ['task', 'tentask', 'name'].includes(k),
    );
    const hasOldTask = firstRowKeys.some((k) =>
      ['taskname', 'task_name'].includes(k),
    );

    if (!hasNewTask && !hasOldTask) {
      throw new BadRequestException(
        'File không đúng định dạng template task. Vui lòng tải template mới.',
      );
    }
  }

  private normalizeRowData(row: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const normKey = this.removeAccents(
        key.trim().toLowerCase().replace(/[\s\-_]+/g, '_'),
      );
      normalized[normKey] = value;
    }

    return {
      number: normalized.number ?? normalized.stt,
      task:
        normalized.task ??
        normalized.task_name ??
        normalized.name ??
        normalized.ten_task,
      startDate:
        normalized.start_day ??
        normalized.startday ??
        normalized.start_date ??
        normalized.ngay_bat_dau,
      dueDate:
        normalized.end_day ??
        normalized.endday ??
        normalized.due_date ??
        normalized.han_chot ??
        normalized.ngay_ket_thuc,
      pic:
        normalized.pic ??
        normalized.assignee ??
        normalized.nguoi_phu_trach,
      stakeholder:
        normalized.stakeholder ??
        normalized.stakeholders,
      status:
        normalized.status ??
        normalized.trang_thai,
      outputRequire:
        normalized.output_require ??
        normalized.outputrequire ??
        normalized.description ??
        normalized.mo_ta,
      file:
        normalized.file ??
        normalized.link ??
        normalized.tep,
      note:
        normalized.note ??
        normalized.remark ??
        normalized.ghi_chu,
      projectId:
        normalized.project_id ??
        normalized.project ??
        normalized.du_an,
      priority:
        normalized.priority ??
        normalized.do_uu_tien,
      execWeek:
        normalized.exec_week ??
        normalized.execweek ??
        normalized.tuan,
      reason:
        normalized.reason ??
        normalized.ly_do,
    };
  }

  private findMember(
    nameOrEmail: string,
    byEmail: Map<string, any>,
    byName: Map<string, any>,
    byNoAccent: Map<string, any>,
  ) {
    const key = nameOrEmail.trim().toLowerCase().replace(/\s+/g, ' ');
    if (byEmail.has(key)) return byEmail.get(key);
    if (byName.has(key)) return byName.get(key);
    const noAccent = this.removeAccents(key);
    if (byNoAccent.has(noAccent)) return byNoAccent.get(noAccent);
    return undefined;
  }

  private parseStatus(raw: unknown): { status?: TaskStatus; error?: string } {
    const text = String(raw ?? '').trim().toLowerCase();
    if (!text) {
      return { status: 'To Do' };
    }
    const clean = this.removeAccents(
      text.replace(/[\-_]/g, ' ').replace(/\s+/g, ' '),
    );

    if (['chua lam', 'to do', 'todo', 'planning'].includes(clean)) {
      return { status: 'To Do' };
    }
    if (
      ['dang lam', 'in progress', 'inprogress', 'processing'].includes(clean)
    ) {
      return { status: 'In Progress' };
    }
    if (['dang cho', 'review', 'pending', 'waiting'].includes(clean)) {
      return { status: 'Review' };
    }
    if (['ton dong', 'backlog'].includes(clean)) {
      return { status: 'Backlog' };
    }
    if (['hoan thanh', 'done', 'completed'].includes(clean)) {
      return { status: 'Done' };
    }
    if (
      [
        'da huy',
        'huy',
        'cancel',
        'cancelled',
        'canceled',
      ].includes(clean)
    ) {
      return { status: 'Cancel' };
    }

    return { error: `Trạng thái (STATUS) "${raw}" không hợp lệ` };
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'number') {
      if (value >= 10000 && value <= 100000) {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{5}$/.test(trimmed)) {
        const num = Number(trimmed);
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!Number.isNaN(date.getTime())) return date;
      }
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]) - 1;
        const year = Number(ddmmyyyy[3]);
        const date = new Date(Date.UTC(year, month, day));
        return Number.isNaN(date.getTime()) ? null : date;
      }
      const yyyymmdd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (yyyymmdd) {
        const year = Number(yyyymmdd[1]);
        const month = Number(yyyymmdd[2]) - 1;
        const day = Number(yyyymmdd[3]);
        const date = new Date(Date.UTC(year, month, day));
        return Number.isNaN(date.getTime()) ? null : date;
      }
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private parseStakeholders(raw: unknown): string[] {
    if (raw === null || raw === undefined) return [];
    const text = String(raw).trim();
    if (!text) return [];
    return text
      .split(/[,;\n+]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private parseLink(raw: unknown): string | undefined {
    if (raw === null || raw === undefined) return undefined;
    const text = String(raw).trim();
    if (!text) return undefined;
    if (/^[a-zA-Z]:[\\\/]/i.test(text) || /^file:\/\//i.test(text)) {
      return undefined;
    }
    if (/^https?:\/\//i.test(text)) {
      return text;
    }
    if (/^(drive|docs)\.google\.com/i.test(text)) {
      return `https://${text}`;
    }
    return text;
  }

  private async readWorkbook(buffer: Buffer) {
    const safeBuffer = Buffer.from(buffer);
    const isZip =
      safeBuffer.length >= 4 &&
      safeBuffer[0] === 0x50 &&
      safeBuffer[1] === 0x4b;
    if (!isZip) {
      return this.readCsv(safeBuffer.toString('utf8'));
    }

    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(safeBuffer as any);
    } catch (err) {
      try {
        return this.readCsv(safeBuffer.toString('utf8'));
      } catch (_) {
        throw new BadRequestException(
          'File Excel/CSV không đúng định dạng hoặc bị hỏng.',
        );
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headers: string[] = [];
    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = cell.text ? cell.text.trim() : '';
        });
        return;
      }
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const cell = row.getCell(index + 1);
        record[header] = this.getCellValue(cell);
      });
      rows.push(record);
    });
    return rows;
  }

  private getCellValue(cell: any): unknown {
    if (!cell) return '';
    const val = cell.value;
    if (val instanceof Date) return val;
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      if ('hyperlink' in val && typeof val.hyperlink === 'string') {
        return val.hyperlink;
      }
      if ('text' in val && typeof val.text === 'string') {
        return val.text;
      }
      if ('result' in val) {
        return val.result;
      }
      if ('richText' in val && Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text || '').join('');
      }
    }
    return cell.text || '';
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
    const trimmedHeaders = headers.map((h) => h.trim());
    return rows.map((values) =>
      Object.fromEntries(
        trimmedHeaders.map((header, index) => [header, values[index] ?? '']),
      ),
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

  private removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }
}
