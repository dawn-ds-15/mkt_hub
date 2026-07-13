import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveWeeklyLogDto, WeeklyReportQueryDto } from './dto/task.dto';

@Injectable()
export class WeeklyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: WeeklyReportQueryDto) {
    const currentScope = this.scope(query);
    const next = this.nextWeek(query.week, query.year);
    const nextScope = this.scope({ ...query, ...next });
    const include = {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    } as const;
    const [done, plan, backlog, bodSupport, log] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...currentScope, status: 'Done' },
        include,
      }),
      this.prisma.task.findMany({
        where: { ...nextScope, status: { in: ['Planning', 'Processing'] } },
        include,
      }),
      this.prisma.task.findMany({
        where: { ...currentScope, status: 'Backlog' },
        include,
      }),
      this.prisma.task.findMany({
        where: { ...currentScope, neededSupportBod: { not: null } },
        include,
      }),
      this.prisma.weeklyReportLog.findFirst({
        where: {
          year: query.year,
          week: query.week,
          projectId: query.projectId ?? null,
          memberId: query.memberId ?? null,
        },
      }),
    ]);
    const bod = bodSupport.filter((task) => task.neededSupportBod?.trim());
    const dates = this.isoWeekRange(query.year, query.week);
    return {
      title: `Weekly Report — Tuần ${query.week}/${query.year}`,
      period: { ...dates, week: query.week, year: query.year },
      filters: {
        projectId: query.projectId ?? null,
        memberId: query.memberId ?? null,
      },
      sections: { done, nextWeekPlan: plan, backlog, bodSupport: bod },
      log,
    };
  }

  async saveLog(dto: SaveWeeklyLogDto, userId: string) {
    const where = {
      year: dto.year,
      week: dto.week,
      projectId: dto.projectId ?? null,
      memberId: dto.memberId ?? null,
    };
    const existing = await this.prisma.weeklyReportLog.findFirst({ where });
    const notes = {
      doneNotes: dto.doneNotes,
      planNotes: dto.planNotes,
      backlogNotes: dto.backlogNotes,
      bodNotes: dto.bodNotes,
    };
    return existing
      ? this.prisma.weeklyReportLog.update({
          where: { id: existing.id },
          data: notes,
        })
      : this.prisma.weeklyReportLog.create({
          data: { ...where, ...notes, createdById: userId },
        });
  }

  async exportText(query: WeeklyReportQueryDto) {
    const report = await this.getReport(query);
    const fmt = (value: Date) => value.toISOString().slice(0, 10);
    const lines = [
      `📊 WEEKLY REPORT — TUẦN ${query.week}/${query.year} (${fmt(report.period.from)}–${fmt(report.period.to)})`,
      '════════════════════════════════════',
      '',
      '✅ CÔNG VIỆC ĐÃ HOÀN THÀNH',
      ...report.sections.done.map(
        (t) => `• ${t.name} — ${t.assignee.name} (${t.project.name})`,
      ),
      '',
      `📌 KẾ HOẠCH TUẦN ${this.nextWeek(query.week, query.year).week}`,
      ...report.sections.nextWeekPlan.map(
        (t) => `• ${t.name} — ${t.assignee.name} — Due: ${fmt(t.dueDate)}`,
      ),
      '',
      '🚧 BACKLOG / VẤN ĐỀ',
      ...report.sections.backlog.map(
        (t) => `• ${t.name} — ${t.assignee.name} — Lý do: ${t.reason ?? ''}`,
      ),
      '',
      '🤝 CẦN BOD HỖ TRỢ',
      ...report.sections.bodSupport.map(
        (t) =>
          `• ${t.name} — ${t.assignee.name} — Nội dung: ${t.neededSupportBod}`,
      ),
    ];
    return lines.join('\n');
  }

  private scope(query: WeeklyReportQueryDto): Prisma.TaskWhereInput {
    return {
      execYear: query.year,
      execWeek: query.week,
      projectId: query.projectId,
      assigneeId: query.memberId,
    };
  }

  private nextWeek(week: number, year: number) {
    if (week < 52) return { week: week + 1, year };
    const dec28 = new Date(Date.UTC(year, 11, 28));
    const maxWeek = this.isoWeekNumber(dec28);
    return week < maxWeek
      ? { week: week + 1, year }
      : { week: 1, year: year + 1 };
  }

  private isoWeekRange(year: number, week: number) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(
      jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7,
    );
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: monday, to: sunday };
  }

  private isoWeekNumber(date: Date) {
    const value = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
  }
}
