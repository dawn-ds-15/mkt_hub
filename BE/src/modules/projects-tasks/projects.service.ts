import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import {
  EVENT_CHECKLIST,
  EVENT_PROJECT_TYPES,
} from './projects-tasks.constants';

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
  kpis: ProjectKpiSummary[];
  progress: {
    percentage: number;
    total: number;
    done: number;
    processing: number;
    overdue: number;
  };
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PresentedProject[]> {
    const projects = (await this.prisma.project.findMany({
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })) as ProjectWithDetails[];
    return projects.map((project) => this.present(project));
  }

  async findOne(id: string): Promise<PresentedProject> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Không tìm thấy project');
    return this.present(project);
  }

  async create(dto: CreateProjectDto, userId: string) {
    this.validateDeadline(dto.type, dto.deadline);
    if (dto.applyTemplate && !EVENT_PROJECT_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        'Checklist template chỉ áp dụng cho Workshop, Event, Exhibition hoặc Webinar',
      );
    }

    const { applyTemplate, ...input } = dto;
    const project = await this.prisma.project.create({
      data: {
        ...input,
        deadline: input.deadline ? new Date(input.deadline) : null,
        createdBy: userId,
      },
    });

    if (applyTemplate) {
      try {
        await this.createEventChecklist(
          project.id,
          project.ownerId,
          project.deadline,
        );
      } catch (error) {
        await this.prisma.$transaction([
          this.prisma.task.deleteMany({ where: { projectId: project.id } }),
          this.prisma.project.delete({ where: { id: project.id } }),
        ]);
        throw error;
      }
    }
    return this.findOne(project.id);
  }

  async update(id: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy project');

    const type = dto.type ?? existing.type;
    const deadline = dto.deadline ?? existing.deadline?.toISOString();
    this.validateDeadline(type, deadline);
    const input = { ...dto };
    delete input.applyTemplate;
    const data: Prisma.ProjectUncheckedUpdateInput = {
      ...input,
      deadline: dto.deadline === undefined ? undefined : new Date(dto.deadline),
    };
    await this.prisma.project.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!project) throw new NotFoundException('Không tìm thấy project');
    const tasks = (await this.prisma.task.findMany({
      where: { projectId: id },
      select: { id: true },
    })) as Array<{ id: string }>;
    await this.prisma.$transaction([
      ...tasks.map((task) =>
        this.prisma.task.delete({ where: { id: task.id } }),
      ),
      this.prisma.project.delete({ where: { id } }),
    ]);
    return { message: 'Xóa project thành công' };
  }

  private validateDeadline(type: string, deadline?: string | null) {
    if (type !== 'Lead Generation' && !deadline) {
      throw new BadRequestException(
        'Deadline là bắt buộc với project không phải Lead Generation',
      );
    }
  }

  private async createEventChecklist(
    projectId: string,
    assigneeId: string,
    deadline: Date | null,
  ) {
    const now = new Date();
    const end =
      deadline && deadline > now
        ? deadline
        : new Date(now.getTime() + 30 * 86400000);
    for (let index = 0; index < EVENT_CHECKLIST.length; index += 1) {
      const ratio = (index + 1) / EVENT_CHECKLIST.length;
      const dueDate = new Date(
        now.getTime() + (end.getTime() - now.getTime()) * ratio,
      );
      const { week, year } = this.getIsoWeek(dueDate);
      await this.prisma.task.create({
        data: {
          name: EVENT_CHECKLIST[index],
          projectId,
          assigneeId,
          status: 'To Do',
          priority: 'Medium',
          dueDate,
          execWeek: week,
          execYear: year,
        },
      });
    }
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
      (task) => task.dueDate < now && task.status !== 'Done',
    ).length;
    const percentage = tasks.length
      ? Number(((done / tasks.length) * 100).toFixed(1))
      : 0;
    const number = (value: unknown) => (value == null ? 0 : Number(value));
    const kpis: ProjectKpiSummary[] = [
      {
        key: 'rawLeads',
        plan: project.kpiRawLeadsPlan,
        actual: project.kpiRawLeadsActual,
      },
      { key: 'mql', plan: project.kpiMqlPlan, actual: project.kpiMqlActual },
      { key: 'sql', plan: project.kpiSqlPlan, actual: project.kpiSqlActual },
      { key: 'opp', plan: project.kpiOppPlan, actual: project.kpiOppActual },
      {
        key: 'closedDeal',
        plan: project.kpiClosedDealPlan,
        actual: project.kpiClosedDealActual,
      },
      {
        key: 'pipelineValue',
        plan: project.kpiPipelineValuePlan,
        actual: project.kpiPipelineValueActual,
      },
    ].map(({ key, plan, actual }) => ({
      key,
      plan: number(plan),
      actual: number(actual),
      percent: number(plan)
        ? Number(((number(actual) / number(plan)) * 100).toFixed(1))
        : 0,
    }));

    return {
      ...project,
      budgetPlanTotal:
        number(project.budgetPlanDirect) + number(project.budgetPlanOverhead),
      actualCostTotal:
        number(project.actualCostDirect) + number(project.actualCostOverhead),
      kpis,
      progress: { percentage, total: tasks.length, done, processing, overdue },
    };
  }

  private startOfToday() {
    return startOfBusinessToday();
  }
}
