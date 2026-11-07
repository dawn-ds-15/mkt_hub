import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import {
  loadLatestExpenseSnapshots,
  toExpenseCostEntries,
} from '../expense/expense-snapshot.util';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import {
  EVENT_CHECKLIST,
  EVENT_PROJECT_TYPES,
} from './projects-tasks.constants';
import { EVENT_TEMPLATES_DATA } from './event-templates.data';
import {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  UpdateStakeholderOptionsDto,
} from './dto/checklist-template.dto';

export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    owner: { select: { id: true; name: true; avatarUrl: true } };
    tasks: {
      include: {
        assignee: { select: { id: true; name: true; avatarUrl: true } };
      };
    };
  };
}>;

export interface ProjectKpiSummary {
  key: string;
  plan: number;
  actual: number;
  percent: number;
}

export type PresentedProject = ProjectWithDetails & {
  budgetPlanTotal: number;
  actualCostTotal: number;
  documentsCount: number;
  kpis: ProjectKpiSummary[];
  progress: {
    percentage: number;
    total: number;
    done: number;
    processing: number;
    overdue: number;
  };
};

export function parseSafeDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(type?: string): Promise<PresentedProject[]> {
    let projects: ProjectWithDetails[] = [];
    const where: any = { archivedAt: null };
    if (type && type.trim() && type.toLowerCase() !== 'all' && type.toLowerCase() !== 'tất cả') {
      where.type = { equals: type.trim(), mode: 'insensitive' };
    }

    try {
      projects = await this.queryProjectsWithDetails(where, true, false);
    } catch (err) {
      console.warn(
        'ProjectsService.findAll primary query failed, falling back without _count.documents:',
        (err as any)?.message || err,
      );
      try {
        projects = await this.queryProjectsWithDetails(where, false, false);
      } catch (err2) {
        console.warn(
          'ProjectsService.findAll secondary query failed, falling back to basic findMany:',
          (err2 as any)?.message || err2,
        );
        projects = (await this.prisma.project.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
        })) as unknown as ProjectWithDetails[];
      }
    }

    return projects.map((project) => {
      try {
        return this.present(project);
      } catch (err) {
        console.error(`Failed to present project ${project?.id}:`, err);
        return {
          ...project,
          budgetPlanTotal: 0,
          actualCostTotal: 0,
          documentsCount: 0,
          kpis: [],
          progress: { percentage: 0, total: 0, done: 0, processing: 0, overdue: 0 },
        } as PresentedProject;
      }
    });
  }

  // Totals of the latest expense snapshot of the project (BE_requirement_26_09_26 §9.5, §1)
  async getExpenseSummary(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, archivedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Không tìm thấy project');

    const entries = toExpenseCostEntries(
      await loadLatestExpenseSnapshots(this.prisma, { projectId: id }),
    );
    const summary = {
      projectId: id,
      plannedBeforeVat: 0,
      plannedAfterVat: 0,
      actualBeforeVat: 0,
      actualAfterVat: 0,
    };
    for (const e of entries) {
      summary.plannedBeforeVat += e.plannedBeforeVat;
      summary.plannedAfterVat += e.plannedAfterVat;
      summary.actualBeforeVat += e.actualBeforeVat;
      summary.actualAfterVat += e.actualAfterVat;
    }
    return summary;
  }

  async findOne(id: string): Promise<PresentedProject> {
    let project: ProjectWithDetails | null = null;
    try {
      [project = null] = await this.queryProjectsWithDetails(
        { id, archivedAt: null },
        true,
        true,
      );
    } catch (err) {
      console.warn(
        `ProjectsService.findOne(${id}) primary query failed, falling back without _count.documents:`,
        (err as any)?.message || err,
      );
      try {
        [project = null] = await this.queryProjectsWithDetails(
          { id, archivedAt: null },
          false,
          true,
        );
      } catch (err2) {
        console.warn(
          `ProjectsService.findOne(${id}) secondary query failed, falling back to basic findFirst:`,
          (err2 as any)?.message || err2,
        );
        project = (await this.prisma.project.findFirst({
          where: { id, archivedAt: null },
        })) as unknown as ProjectWithDetails | null;
      }
    }

    if (!project) throw new NotFoundException('Không tìm thấy project');
    return this.present(project);
  }

  /**
   * Loads projects with the same relations (and filters/order) as a single
   * `include`, split across 3 concurrent queries. Prisma resolves every included
   * relation with its own sequential round-trip, so the single include cost ~9
   * serial queries; this brings the critical path down to ~4.
   * `first` = findFirst semantics (findOne), otherwise findMany ordered by updatedAt desc.
   */
  private async queryProjectsWithDetails(
    where: Prisma.ProjectWhereInput,
    withDocumentsCount: boolean,
    first: boolean,
  ): Promise<ProjectWithDetails[]> {
    const find = (args: any): Promise<any[]> =>
      first
        ? this.prisma.project
            .findFirst(args)
            .then((row: any) => (row ? [row] : []))
        : this.prisma.project.findMany({
            ...args,
            orderBy: { updatedAt: 'desc' },
          });

    const [baseRows, planRows, actualRows] = await Promise.all([
      find({
        where,
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          tasks: {
            where: { archivedAt: null },
            include: {
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { dueDate: 'asc' },
          },
          ...(withDocumentsCount
            ? {
                _count: {
                  select: {
                    documents: {
                      where: { archivedAt: null },
                    },
                  },
                },
              }
            : {}),
        },
      }),
      find({
        where,
        select: {
          id: true,
          budgetValues: true,
          kpiDistributions: true,
        },
      }),
      find({
        where,
        select: {
          id: true,
          dailyActuals: {
            where: { archivedAt: null },
          },
          expenseRecords: {
            where: { archivedAt: null },
            include: {
              lines: {
                where: { archivedAt: null },
              },
            },
          },
        },
      }),
    ]);

    const planById = new Map(planRows.map((row) => [row.id, row]));
    const actualById = new Map(actualRows.map((row) => [row.id, row]));
    return baseRows.map((project) => {
      const plan = planById.get(project.id);
      const actual = actualById.get(project.id);
      return {
        ...project,
        budgetValues: plan?.budgetValues ?? [],
        kpiDistributions: plan?.kpiDistributions ?? [],
        dailyActuals: actual?.dailyActuals ?? [],
        expenseRecords: actual?.expenseRecords ?? [],
      };
    }) as unknown as ProjectWithDetails[];
  }

  private async resolveOwnerId(rawOwner: any, defaultUserId: string): Promise<string> {
    if (!rawOwner) return defaultUserId;

    let target = rawOwner;
    if (typeof rawOwner === 'object' && rawOwner.id) {
      target = rawOwner.id;
    }

    if (typeof target === 'string') {
      const trimmed = target.trim();
      if (!trimmed) return defaultUserId;

      if (this.prisma.member) {
        try {
          const byId = await this.prisma.member.findUnique({ where: { id: trimmed } });
          if (byId) return byId.id;

          const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emailMatch) {
            const byEmail = await this.prisma.member.findUnique({ where: { email: emailMatch[1] } });
            if (byEmail) return byEmail.id;
          }

          const byName = await this.prisma.member.findFirst({ where: { name: trimmed } });
          if (byName) return byName.id;
        } catch {
          // ignore lookup errors
        }
      }

      if (trimmed.match(/^[0-9a-fA-F-]{36}$/)) {
        return trimmed;
      }
    }

    return defaultUserId;
  }

  private sanitizeProjectInput(dto: Record<string, any>) {
    const stringKeys = [
      'name',
      'type',
      'status',
      'event',
      'budgetDirectNotes',
      'budgetOverheadNotes',
      'actualDirectNotes',
      'actualOverheadNotes',
    ];

    const decimalKeys = [
      'budgetPlanDirect',
      'budgetPlanOverhead',
      'actualCostDirect',
      'actualCostOverhead',
      'kpiRawLeadsPlan',
      'kpiMqlPlan',
      'kpiSqlPlan',
      'kpiOppPlan',
      'kpiClosedDealPlan',
      'kpiPipelineValuePlan',
      'kpiRawLeadsActual',
      'kpiMqlActual',
      'kpiSqlActual',
      'kpiOppActual',
      'kpiClosedDealActual',
      'kpiPipelineValueActual',
    ];

    const cleanData: Record<string, any> = {};
    if (typeof dto.isLeadSource === 'boolean') {
      cleanData.isLeadSource = dto.isLeadSource;
    }
    for (const key of stringKeys) {
      if (dto[key] !== undefined) {
        cleanData[key] = dto[key];
      }
    }

    for (const key of decimalKeys) {
      if (dto[key] !== undefined) {
        const val = dto[key];
        if (val === null || val === '') {
          cleanData[key] = null;
        } else {
          const num = Number(val);
          if (!isNaN(num)) {
            cleanData[key] = num;
          }
        }
      }
    }
    return cleanData;
  }

  private handlePrismaError(error: any) {
    console.error('[ProjectsService] Prisma Error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Người phụ trách (ownerId) không hợp lệ hoặc không tồn tại trong hệ thống.',
        );
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy dự án tương ứng.');
      }
      if (error.code === 'P2002') {
        throw new BadRequestException('Dữ liệu dự án bị trùng lặp.');
      }
      throw new BadRequestException(`Lỗi dữ liệu (${error.code}): ${error.message}`);
    }
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      const msg = error.message ? error.message.replace(/\s+/g, ' ').trim() : '';
      throw new BadRequestException(
        `Lỗi định dạng dữ liệu gửi lên: ${msg || 'Vui lòng kiểm tra lại Hạn chót và các thông tin nhập.'}`,
      );
    }
    throw error;
  }

  // Only managers/admins may mark a project as lead source (requirement 26-09-26 §2).
  // actorRole is undefined for internal callers (seed/import), which are trusted.
  private assertCanSetLeadSource(
    actorRole: Role | undefined,
    requested: boolean | undefined,
    current: boolean,
  ) {
    if (typeof requested !== 'boolean' || requested === current || !actorRole) return;
    if (actorRole !== Role.manager && actorRole !== Role.admin) {
      throw new ForbiddenException(
        'Chỉ manager được thay đổi cấu hình "Dự án mang lại lead".',
      );
    }
  }

  async create(dto: CreateProjectDto, userId: string, actorRole?: Role) {
    this.validateDeadline(dto.type, dto.deadline);
    this.assertCanSetLeadSource(actorRole, dto.isLeadSource, false);
    let templateResolution: { templateTasks: any[]; leadTimeDays: number } | null = null;
    if (dto.applyTemplate) {
      templateResolution = await this.resolveTemplateTasks(
        dto.templateType,
        dto.type,
      );
    }

    const cleanInput = this.sanitizeProjectInput(dto);
    const ownerId = await this.resolveOwnerId(dto.ownerId, userId);
    const parsedDeadline = parseSafeDate(dto.deadline);

    let createdTasksCount = 0;

    let createdProject: Prisma.ProjectGetPayload<{}>;
    try {
      createdProject = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            ...cleanInput,
            name: dto.name,
            type: dto.type,
            status: dto.status ?? 'Planning',
            cancelledAt: dto.status === 'Cancelled' ? new Date() : null,
            ownerId,
            event: dto.event ?? null,
            deadline: parsedDeadline,
            createdBy: userId,
          },
        });

        if (dto.applyTemplate && templateResolution) {
          const { templateTasks, leadTimeDays } = templateResolution;

          const now = new Date();
          const end =
            project.deadline && project.deadline > now
              ? project.deadline
              : new Date(now.getTime() + leadTimeDays * 86400000);

          const totalDaysAvailable = Math.max(
            1,
            Math.floor((end.getTime() - now.getTime()) / 86400000),
          );

          const tasksData = templateTasks.map((item) => {
            let daysBefore = item.daysBeforeDeadline ?? 7;
            // Auto-clamp & scale proportionally if deadline is closer than recommended leadTimeDays
            if (
              daysBefore > totalDaysAvailable ||
              totalDaysAvailable < leadTimeDays
            ) {
              daysBefore = Math.max(
                1,
                Math.floor(
                  (item.daysBeforeDeadline / leadTimeDays) * totalDaysAvailable,
                ),
              );
            }

            const dueTimestamp = Math.max(
              now.getTime(),
              end.getTime() - daysBefore * 86400000,
            );
            const dueDate = new Date(dueTimestamp);
            const { week, year } = this.getIsoWeek(dueDate);

            const taskName = item.group
              ? `[${item.group}] ${item.name}`
              : item.name;

            return {
              name: taskName,
              description: item.description || null,
              projectId: project.id,
              assigneeId: project.ownerId,
              stakeholders: item.stakeholders || null,
              status: 'To Do',
              priority: item.priority as any,
              dueDate,
              execWeek: week,
              execYear: year,
            };
          });

          if (tasksData.length > 0) {
            await tx.task.createMany({ data: tasksData });
            createdTasksCount = tasksData.length;
          }
        }

        return project;
      });
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }

    const presented = await this.findOne(createdProject.id);
    return {
      ...presented,
      createdTasksCount,
    };
  }

  async update(id: string, dto: UpdateProjectDto, actorRole?: Role) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy project');
    this.assertCanSetLeadSource(
      actorRole,
      dto.isLeadSource,
      Boolean((existing as any).isLeadSource),
    );

    const type = dto.type ?? existing.type;
    const deadline = dto.deadline !== undefined ? dto.deadline : existing.deadline;
    this.validateDeadline(type, deadline);

    const cleanInput = this.sanitizeProjectInput(dto);
    if (dto.ownerId !== undefined) {
      cleanInput.ownerId = await this.resolveOwnerId(dto.ownerId, existing.ownerId);
    }

    let cancelledAt = existing.cancelledAt;
    if (dto.status !== undefined) {
      if (dto.status === 'Cancelled' && existing.status !== 'Cancelled') {
        cancelledAt = new Date();
      } else if (dto.status !== 'Cancelled' && existing.status === 'Cancelled') {
        cancelledAt = null;
      }
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {
      ...cleanInput,
      cancelledAt,
      deadline:
        dto.deadline === undefined
          ? undefined
          : parseSafeDate(dto.deadline),
    };
    try {
      await this.prisma.project.update({ where: { id }, data });
    } catch (error) {
      this.handlePrismaError(error);
    }
    return this.findOne(id);
  }

  async remove(id: string, userId?: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, archivedAt: null },
    });
    if (!project) throw new NotFoundException('Không tìm thấy project');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId: id, archivedAt: null },
        data: { archivedAt: now, archivedBy: userId },
      }),
      this.prisma.budgetValue.deleteMany({
        where: { projectId: id },
      }),
      this.prisma.opportunity.updateMany({
        where: { projectId: id, archivedAt: null },
        data: { archivedAt: now, archivedBy: userId },
      }),
      this.prisma.closedDeal.updateMany({
        where: { projectId: id, archivedAt: null },
        data: { archivedAt: now, archivedBy: userId },
      }),
      this.prisma.kpiDistribution.deleteMany({
        where: { projectId: id },
      }),
      (this.prisma as any).projectDailyActual.deleteMany({
        where: { projectId: id },
      }),
      this.prisma.event.updateMany({
        where: { projectId: id, archivedAt: null },
        data: { archivedAt: now },
      }),
      this.prisma.expenseRecord.updateMany({
        where: { projectId: id, archivedAt: null },
        data: { archivedAt: now, archivedBy: userId },
      }),
      this.prisma.expenseLine.updateMany({
        where: { expense: { projectId: id }, archivedAt: null },
        data: { archivedAt: now, archivedBy: userId },
      }),
      this.prisma.project.update({
        where: { id },
        data: { archivedAt: now, archivedBy: userId },
      }),
    ]);
    return { message: 'Lưu trữ (Soft delete) project thành công' };
  }

  private validateDeadline(type: string, deadline?: string | Date | null) {
    if (type !== 'Lead Generation') {
      const parsed = parseSafeDate(deadline);
      if (!parsed) {
        throw new BadRequestException(
          'Deadline là bắt buộc với project không phải Lead Generation',
        );
      }
    }
  }

  private sanitizeChecklistTasks(tasks: any[] = []): any[] {
    if (!Array.isArray(tasks)) {
      return [];
    }
    return tasks.map((task, index) => {
      if (!task.name || typeof task.name !== 'string' || !task.name.trim()) {
        throw new BadRequestException(
          `Tên đầu việc (name) ở task thứ ${index + 1} là bắt buộc`,
        );
      }

      let priority = 'Medium';
      if (task.priority) {
        const pLower = String(task.priority).trim().toLowerCase();
        if (pLower === 'high') priority = 'High';
        else if (pLower === 'low') priority = 'Low';
        else if (pLower === 'medium') priority = 'Medium';
        else {
          throw new BadRequestException(
            `Độ ưu tiên (priority) ở task '${task.name}' không hợp lệ. Chỉ chấp nhận High, Medium, Low`,
          );
        }
      }

      const daysBeforeDeadline =
        typeof task.daysBeforeDeadline === 'number' &&
        task.daysBeforeDeadline >= 0
          ? Math.floor(task.daysBeforeDeadline)
          : 0;

      return {
        group:
          task.group && String(task.group).trim()
            ? String(task.group).trim()
            : 'Khác',
        name: String(task.name).trim(),
        description: task.description ? String(task.description).trim() : '',
        priority,
        stakeholders: task.stakeholders ? String(task.stakeholders).trim() : '',
        daysBeforeDeadline,
        startOffset: task.startOffset ? String(task.startOffset).trim() : undefined,
        endOffset: task.endOffset ? String(task.endOffset).trim() : undefined,
      };
    });
  }

  private getDefaultChecklistTemplates() {
    return [
      {
        key: 'exhibition',
        name: 'Triển Lãm Ngành Lớn (VWAS, VILOG...)',
        appliesToTypes: ['Exhibition', 'Event', 'exhibition', 'event'],
        leadTimeDays: 75,
        tasks: EVENT_TEMPLATES_DATA.exhibition,
      },
      {
        key: 'workshop_partner',
        name: 'Workshop Hợp Tác Partner',
        appliesToTypes: ['Workshop', 'Event', 'workshop', 'event'],
        leadTimeDays: 45,
        tasks: EVENT_TEMPLATES_DATA.workshop_partner,
      },
      {
        key: 'workshop_tai_tro',
        name: 'Workshop Tài Trợ',
        appliesToTypes: ['Workshop', 'Event', 'workshop', 'event'],
        leadTimeDays: 30,
        tasks: EVENT_TEMPLATES_DATA.workshop_tai_tro,
      },
      {
        key: 'workshop_smartlog',
        name: 'Smartlog Workshop Offline (Private Event)',
        appliesToTypes: ['Workshop', 'Event', 'workshop', 'event'],
        leadTimeDays: 60,
        tasks: EVENT_TEMPLATES_DATA.workshop_smartlog,
      },
      {
        key: 'webinar',
        name: 'Webinar (Online Workshop)',
        appliesToTypes: [
          'Webinar',
          'Workshop',
          'Event',
          'webinar',
          'workshop',
          'event',
        ],
        leadTimeDays: 45,
        tasks: EVENT_TEMPLATES_DATA.webinar,
      },
    ];
  }

  private getDefaultStakeholders() {
    return [
      { code: 'BOD', label: 'Ban Giám Đốc', sortOrder: 1 },
      { code: 'FIN', label: 'Phòng Tài Chính - Kế Toán', sortOrder: 2 },
      { code: 'CBD', label: 'Khối Phát Triển Kinh Doanh (Sales)', sortOrder: 3 },
      { code: 'MKT', label: 'Phòng Marketing', sortOrder: 4 },
      { code: 'PARTNER', label: 'Đối Tác / Khách Mời', sortOrder: 5 },
      { code: 'DEV', label: 'Đội Ngũ Kỹ Thuật / Dev', sortOrder: 6 },
      { code: 'CS', label: 'Chăm Sóc Khách Hàng', sortOrder: 7 },
    ];
  }

  async ensureChecklistDefaults() {
    try {
      const templateModel = (this.prisma as any).checklistTemplate;
      const stakeholderModel = (this.prisma as any).checklistStakeholderOption;
      // Both counts are independent reads; results are evaluated in the
      // original order so a failing template count still skips everything.
      const [countResult, sCountResult] = await Promise.allSettled([
        templateModel ? templateModel.count() : Promise.resolve(null),
        stakeholderModel ? stakeholderModel.count() : Promise.resolve(null),
      ]);
      if (templateModel) {
        if (countResult.status === 'rejected') throw countResult.reason;
        const count = countResult.value;
        if (count === 0) {
          const defaults = this.getDefaultChecklistTemplates();
          for (const t of defaults) {
            await templateModel.upsert({
              where: { key: t.key },
              update: {},
              create: {
                key: t.key,
                name: t.name,
                appliesToTypes: t.appliesToTypes,
                leadTimeDays: t.leadTimeDays,
                tasks: t.tasks,
              },
            });
          }
        }
      }

      if (stakeholderModel) {
        if (sCountResult.status === 'rejected') throw sCountResult.reason;
        const sCount = sCountResult.value;
        if (sCount === 0) {
          const defaults = this.getDefaultStakeholders();
          for (const s of defaults) {
            await stakeholderModel.upsert({
              where: { code: s.code },
              update: {},
              create: {
                code: s.code,
                label: s.label,
                sortOrder: s.sortOrder,
              },
            });
          }
        }
      }
    } catch (error) {
      // Ignore if table not yet migrated
    }
  }

  async getChecklistTemplates() {
    await this.ensureChecklistDefaults();

    let dbTemplates: any[] = [];
    let dbStakeholders: any[] = [];

    try {
      const templateModel = (this.prisma as any).checklistTemplate;
      const stakeholderModel = (this.prisma as any).checklistStakeholderOption;
      // Independent reads run together; evaluated in the original order so a
      // template failure still leaves dbStakeholders empty as before.
      const [templatesResult, stakeholdersResult] = await Promise.allSettled([
        templateModel
          ? templateModel.findMany({ orderBy: { createdAt: 'asc' } })
          : Promise.resolve(null),
        stakeholderModel
          ? stakeholderModel.findMany({ orderBy: { sortOrder: 'asc' } })
          : Promise.resolve(null),
      ]);
      if (templateModel) {
        if (templatesResult.status === 'rejected') throw templatesResult.reason;
        dbTemplates = templatesResult.value;
      }
      if (stakeholderModel) {
        if (stakeholdersResult.status === 'rejected') throw stakeholdersResult.reason;
        dbStakeholders = stakeholdersResult.value;
      }
    } catch (e) {}

    if (!dbTemplates || dbTemplates.length === 0) {
      dbTemplates = this.getDefaultChecklistTemplates();
    }
    if (!dbStakeholders || dbStakeholders.length === 0) {
      dbStakeholders = this.getDefaultStakeholders();
    }

    const templates = dbTemplates.map((t) => {
      const tasks = Array.isArray(t.tasks) ? t.tasks : [];
      return {
        key: t.key,
        name: t.name,
        appliesToTypes: t.appliesToTypes || [],
        leadTimeDays: t.leadTimeDays ?? 30,
        totalTasks: tasks.length,
        tasks,
      };
    });

    const stakeholderOptions = dbStakeholders.map((s) => ({
      code: s.code,
      label: s.label,
    }));

    return {
      templates,
      stakeholderOptions,
    };
  }

  async createChecklistTemplate(dto: CreateChecklistTemplateDto) {
    await this.ensureChecklistDefaults();

    if (!dto.key || !dto.key.trim()) {
      throw new BadRequestException('Mã mẫu checklist (key) là bắt buộc');
    }
    const cleanKey = dto.key.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanKey)) {
      throw new BadRequestException(
        'Mã mẫu (key) chỉ được chứa các ký tự chữ cái, số, gạch dưới (_) và gạch ngang (-)',
      );
    }

    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên mẫu checklist (name) là bắt buộc');
    }

    if (dto.leadTimeDays !== undefined && dto.leadTimeDays < 0) {
      throw new BadRequestException(
        'Số ngày chuẩn bị (leadTimeDays) phải lớn hơn hoặc bằng 0',
      );
    }

    // Kiểm tra trùng key (case-insensitive)
    const existing = await (this.prisma as any).checklistTemplate.findFirst({
      where: {
        key: {
          equals: cleanKey,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`Mã mẫu checklist '${cleanKey}' đã tồn tại`);
    }

    const sanitizedTasks = this.sanitizeChecklistTasks(dto.tasks);
    const appliesToTypes = Array.isArray(dto.appliesToTypes)
      ? dto.appliesToTypes.map((t) => String(t).trim()).filter(Boolean)
      : [];

    const created = await (this.prisma as any).checklistTemplate.create({
      data: {
        key: cleanKey,
        name: dto.name.trim(),
        appliesToTypes,
        leadTimeDays: dto.leadTimeDays ?? 30,
        tasks: sanitizedTasks,
      },
    });

    return {
      key: created.key,
      name: created.name,
      appliesToTypes: created.appliesToTypes,
      leadTimeDays: created.leadTimeDays,
      totalTasks: sanitizedTasks.length,
      tasks: sanitizedTasks,
    };
  }

  async updateChecklistTemplate(key: string, dto: UpdateChecklistTemplateDto) {
    await this.ensureChecklistDefaults();

    if (!key || !key.trim()) {
      throw new BadRequestException('Mã mẫu checklist (key) trên URL là bắt buộc');
    }
    const cleanKey = key.trim();

    if (dto.key && dto.key.trim().toLowerCase() !== cleanKey.toLowerCase()) {
      throw new BadRequestException(
        'Mã key trong payload không khớp với key trên URL',
      );
    }

    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Tên mẫu checklist (name) là bắt buộc');
    }

    if (dto.leadTimeDays !== undefined && dto.leadTimeDays < 0) {
      throw new BadRequestException(
        'Số ngày chuẩn bị (leadTimeDays) phải lớn hơn hoặc bằng 0',
      );
    }

    const existing = await (this.prisma as any).checklistTemplate.findFirst({
      where: {
        key: {
          equals: cleanKey,
          mode: 'insensitive',
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Không tìm thấy mẫu checklist với mã '${cleanKey}'`,
      );
    }

    const sanitizedTasks = this.sanitizeChecklistTasks(dto.tasks);
    const appliesToTypes = Array.isArray(dto.appliesToTypes)
      ? dto.appliesToTypes.map((t) => String(t).trim()).filter(Boolean)
      : [];

    const updated = await (this.prisma as any).checklistTemplate.update({
      where: { id: existing.id },
      data: {
        name: dto.name.trim(),
        appliesToTypes,
        leadTimeDays: dto.leadTimeDays ?? 30,
        tasks: sanitizedTasks,
      },
    });

    return {
      key: updated.key,
      name: updated.name,
      appliesToTypes: updated.appliesToTypes,
      leadTimeDays: updated.leadTimeDays,
      totalTasks: sanitizedTasks.length,
      tasks: sanitizedTasks,
    };
  }

  async deleteChecklistTemplate(key: string) {
    await this.ensureChecklistDefaults();

    if (!key || !key.trim()) {
      throw new BadRequestException('Mã mẫu checklist (key) là bắt buộc');
    }
    const cleanKey = key.trim();

    const existing = await (this.prisma as any).checklistTemplate.findFirst({
      where: {
        key: {
          equals: cleanKey,
          mode: 'insensitive',
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Không tìm thấy mẫu checklist với mã '${cleanKey}'`,
      );
    }

    await (this.prisma as any).checklistTemplate.delete({
      where: { id: existing.id },
    });

    return { success: true };
  }

  async updateStakeholderOptions(dto: UpdateStakeholderOptionsDto) {
    await this.ensureChecklistDefaults();

    if (!Array.isArray(dto.stakeholderOptions)) {
      throw new BadRequestException(
        'Danh sách stakeholderOptions phải là một mảng',
      );
    }

    const seenCodes = new Set<string>();
    const cleanedOptions: { code: string; label: string; sortOrder: number }[] =
      [];

    for (let i = 0; i < dto.stakeholderOptions.length; i++) {
      const item = dto.stakeholderOptions[i];
      if (!item.code || !item.code.trim()) {
        throw new BadRequestException(
          `Mã stakeholder (code) ở vị trí ${i + 1} là bắt buộc`,
        );
      }
      if (!item.label || !item.label.trim()) {
        throw new BadRequestException(
          `Tên stakeholder (label) ở vị trí ${i + 1} là bắt buộc`,
        );
      }
      const codeTrimmed = item.code.trim();
      const codeLower = codeTrimmed.toLowerCase();
      if (seenCodes.has(codeLower)) {
        throw new BadRequestException(
          `Mã stakeholder '${codeTrimmed}' bị trùng lặp`,
        );
      }
      seenCodes.add(codeLower);
      cleanedOptions.push({
        code: codeTrimmed,
        label: item.label.trim(),
        sortOrder: i + 1,
      });
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.checklistStakeholderOption.deleteMany({});
      for (const opt of cleanedOptions) {
        await tx.checklistStakeholderOption.create({
          data: opt,
        });
      }
    });

    return {
      stakeholderOptions: cleanedOptions.map((o) => ({
        code: o.code,
        label: o.label,
      })),
    };
  }

  async resolveTemplateTasks(templateType?: string, projectType?: string) {
    await this.ensureChecklistDefaults();

    let templates: any[] = [];
    try {
      if ((this.prisma as any).checklistTemplate) {
        templates = await (this.prisma as any).checklistTemplate.findMany();
      }
    } catch (e) {}

    if (!templates || templates.length === 0) {
      const { templates: fallbackTemplates } = await this.getChecklistTemplates();
      templates = fallbackTemplates;
    }

    const normType = (projectType || '').trim().toLowerCase();

    // 1. Trường hợp có gửi templateType (key)
    if (templateType && templateType.trim()) {
      const targetKey = templateType.trim().toLowerCase();
      const matched = templates.find(
        (t) => (t.key || '').toLowerCase() === targetKey,
      );
      if (!matched) {
        throw new BadRequestException(
          `Mẫu checklist '${templateType}' không tồn tại`,
        );
      }
      const applies = (matched.appliesToTypes || []).some(
        (type: string) => type.trim().toLowerCase() === normType,
      );
      if (!applies) {
        throw new BadRequestException(
          'Checklist template chỉ áp dụng cho Workshop, Event, Exhibition hoặc Webinar',
        );
      }
      return {
        templateTasks: Array.isArray(matched.tasks) ? matched.tasks : [],
        leadTimeDays: matched.leadTimeDays ?? 30,
      };
    }

    // 2. Trường hợp không gửi templateType -> fallback tự chọn template theo type
    const matched = templates.find((t) =>
      (t.appliesToTypes || []).some(
        (type: string) => type.trim().toLowerCase() === normType,
      ),
    );

    if (!matched) {
      throw new BadRequestException(
        'Checklist template chỉ áp dụng cho Workshop, Event, Exhibition hoặc Webinar',
      );
    }

    return {
      templateTasks: Array.isArray(matched.tasks) ? matched.tasks : [],
      leadTimeDays: matched.leadTimeDays ?? 30,
    };
  }


  private getIsoWeek(value: Date) {
    const date = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return {
      week: Math.ceil(
        ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
      ),
      year: date.getUTCFullYear(),
    };
  }

  private present(project: ProjectWithDetails): PresentedProject {
    const tasks = project.tasks ?? [];
    const now = this.startOfToday();
    const done = tasks.filter((task) => task.status === 'Done').length;
    const processing = tasks.filter(
      (task) => task.status === 'In Progress',
    ).length;
    const overdue = tasks.filter(
      (task) => Boolean(task.dueDate && task.dueDate < now && task.status !== 'Done'),
    ).length;
    const percentage = tasks.length
      ? Number(((done / tasks.length) * 100).toFixed(1))
      : 0;
    const number = (value: unknown) => (value == null ? 0 : Number(value));

    const deadlineDate = parseSafeDate(project.deadline);
    const projectYear = deadlineDate
      ? deadlineDate.getFullYear()
      : new Date().getFullYear();

    const dists: any[] = (project as any).kpiDistributions || [];
    const yearDists = dists.filter((d) => d.year === projectYear);

    const planDists = yearDists.filter((d) => d.type === 'plan');
    const actualDists = yearDists.filter((d) => d.type === 'actual');

    const hasPlanDist = planDists.length > 0;
    const hasActualDist = actualDists.length > 0;

    const sumDist = (arr: any[], field: string) =>
      arr.reduce((sum, item) => sum + number(item[field]), 0);

    const dailyRecords: any[] = (project as any).dailyActuals || [];
    const dailyYearRecords = dailyRecords.filter((d) => {
      const y = d.actualDate ? new Date(d.actualDate).getFullYear() : projectYear;
      return y === projectYear;
    });

    const sumDaily = (field: string) =>
      dailyYearRecords.reduce((sum, item) => sum + number(item[field]), 0);

    const hasDaily = dailyYearRecords.length > 0;

    const rawLeadsPlan = hasPlanDist
      ? sumDist(planDists, 'rawLeads')
      : number(project.kpiRawLeadsPlan);
    const rawLeadsActual = hasDaily
      ? Math.max(sumDaily('rawLeads'), hasActualDist ? sumDist(actualDists, 'rawLeads') : 0)
      : hasActualDist
      ? sumDist(actualDists, 'rawLeads')
      : number(project.kpiRawLeadsActual);

    const mqlPlan = hasPlanDist
      ? sumDist(planDists, 'mql')
      : number(project.kpiMqlPlan);
    const mqlActual = hasDaily
      ? Math.max(sumDaily('mql'), hasActualDist ? sumDist(actualDists, 'mql') : 0)
      : hasActualDist
      ? sumDist(actualDists, 'mql')
      : number(project.kpiMqlActual);

    const sqlPlan = hasPlanDist
      ? sumDist(planDists, 'sql')
      : number(project.kpiSqlPlan);
    const sqlActual = hasDaily
      ? Math.max(sumDaily('sql'), hasActualDist ? sumDist(actualDists, 'sql') : 0)
      : hasActualDist
      ? sumDist(actualDists, 'sql')
      : number(project.kpiSqlActual);

    const oppPlan = hasPlanDist
      ? sumDist(planDists, 'oppCount')
      : number(project.kpiOppPlan);
    const oppActual = hasDaily
      ? Math.max(sumDaily('opp'), hasActualDist ? sumDist(actualDists, 'oppCount') : 0)
      : hasActualDist
      ? sumDist(actualDists, 'oppCount')
      : number(project.kpiOppActual);

    const closedDealPlan = hasPlanDist
      ? sumDist(planDists, 'closedCount')
      : number(project.kpiClosedDealPlan);
    const closedDealActual = hasDaily
      ? Math.max(sumDaily('closedDeal'), hasActualDist ? sumDist(actualDists, 'closedCount') : 0)
      : hasActualDist
      ? sumDist(actualDists, 'closedCount')
      : number(project.kpiClosedDealActual);

    const pipelineValuePlan = hasPlanDist
      ? sumDist(planDists, 'pipelineValue')
      : number(project.kpiPipelineValuePlan);
    const pipelineValueActual = hasActualDist
      ? sumDist(actualDists, 'pipelineValue')
      : number(project.kpiPipelineValueActual);

    const kpis: ProjectKpiSummary[] = [
      { key: 'rawLeads', plan: rawLeadsPlan, actual: rawLeadsActual },
      { key: 'mql', plan: mqlPlan, actual: mqlActual },
      { key: 'sql', plan: sqlPlan, actual: sqlActual },
      { key: 'opp', plan: oppPlan, actual: oppActual },
      { key: 'closedDeal', plan: closedDealPlan, actual: closedDealActual },
      { key: 'pipelineValue', plan: pipelineValuePlan, actual: pipelineValueActual },
    ].map(({ key, plan, actual }) => ({
      key,
      plan: Math.max(0, number(plan)),
      actual: Math.max(0, number(actual)),
      percent: number(plan)
        ? Number(((number(actual) / number(plan)) * 100).toFixed(1))
        : 0,
    }));

    const documentsCount =
      (project as any)._count?.documents ?? (project as any).documents?.length ?? 0;

    let budgetPlanTotal =
      number(project.budgetPlanDirect) + number(project.budgetPlanOverhead);
    if (!budgetPlanTotal && (project as any).budgetValues?.length) {
      const yearBudgetValues = (project as any).budgetValues.filter(
        (bv: any) => bv.year === projectYear,
      );
      const targetBvs = yearBudgetValues.length
        ? yearBudgetValues
        : (project as any).budgetValues;
      budgetPlanTotal = targetBvs.reduce(
        (sum: number, bv: any) => sum + number(bv.amount),
        0,
      );
    }
    budgetPlanTotal = Math.max(0, budgetPlanTotal);

    let actualCostTotal = 0;
    if ((project as any).expenseRecords?.length) {
      for (const exp of (project as any).expenseRecords) {
        if (exp.lines?.length) {
          for (const l of exp.lines) {
            const qty = l.actualQuantity || l.quantity || 0;
            const price = number(l.unitPriceAfterVatSnapshot ?? l.actualUnitPrice ?? 0);
            actualCostTotal += qty * price;
          }
        } else {
          const expDirect = number(exp.directCost);
          const expOverhead = number(exp.overheadCost);
          actualCostTotal += expDirect + expOverhead;
        }
      }
    }
    if (!actualCostTotal) {
      actualCostTotal =
        number(project.actualCostDirect) + number(project.actualCostOverhead);
    }
    actualCostTotal = Math.max(0, actualCostTotal);

    return {
      ...project,
      budgetPlanTotal,
      actualCostTotal,
      documentsCount,
      kpis,
      progress: { percentage, total: tasks.length, done, processing, overdue },
    };
  }

  private startOfToday() {
    return startOfBusinessToday();
  }
}
