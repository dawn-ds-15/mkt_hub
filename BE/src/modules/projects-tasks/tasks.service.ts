import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';
import { CreateTaskDto, TaskFilterDto, UpdateTaskDto } from './dto/task.dto';
import { TASK_STATUSES } from './projects-tasks.constants';

type TaskWithDetails = Prisma.TaskGetPayload<{
  include: {
    project: { select: { id: true; name: true; type: true } };
    assignee: { select: { id: true; name: true; avatarUrl: true } };
  };
}>;

type PresentedTask = Omit<TaskWithDetails, 'stakeholders'> & {
  stakeholders: string[];
  isOverdue: boolean;
  isUpcoming: boolean;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: TaskFilterDto): Promise<{
    data: PresentedTask[];
    stats: Record<string, number>;
  }> {
    const tasks = await this.query(filters);
    const presented = tasks.map((task) => this.present(task));
    presented.sort(
      (a, b) =>
        this.sortRank(a) - this.sortRank(b) ||
        a.dueDate.getTime() - b.dueDate.getTime(),
    );
    return { data: presented, stats: this.stats(presented) };
  }

  async findOne(id: string): Promise<PresentedTask> {
    const task = (await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    })) as TaskWithDetails | null;
    if (!task) throw new NotFoundException('Không tìm thấy task');
    return this.present(task);
  }

  async kanban(filters: TaskFilterDto) {
    const tasks = (await this.query(filters)).map((task) => this.present(task));
    return TASK_STATUSES.map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
      tasks: tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    }));
  }

  async create(dto: CreateTaskDto) {
    this.validateBusinessRules(dto.status ?? 'To Do', dto.reason);
    const data = this.toCreateData(dto);
    const task = await this.prisma.task.create({
      data,
    });
    return this.findOne(task.id);
  }

  async update(id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy task');
    const status = dto.status ?? existing.status;
    const reason = dto.reason === undefined ? existing.reason : dto.reason;
    this.validateBusinessRules(status, reason);

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...dto,
      stakeholders:
        dto.stakeholders === undefined
          ? undefined
          : JSON.stringify(dto.stakeholders),
      startDate:
        dto.startDate === undefined ? undefined : new Date(dto.startDate),
      dueDate: dto.dueDate === undefined ? undefined : new Date(dto.dueDate),
      completedDate:
        status === 'Done'
          ? dto.completedDate
            ? new Date(dto.completedDate)
            : (existing.completedDate ?? new Date())
          : null,
    };
    await this.prisma.task.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!task) throw new NotFoundException('Không tìm thấy task');
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Xóa task thành công' };
  }

  toCreateData(dto: CreateTaskDto): Prisma.TaskUncheckedCreateInput {
    const status = dto.status ?? 'Planning';
    return {
      ...dto,
      status,
      stakeholders: dto.stakeholders ? JSON.stringify(dto.stakeholders) : null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      dueDate: new Date(dto.dueDate),
      completedDate:
        status === 'Done'
          ? dto.completedDate
            ? new Date(dto.completedDate)
            : new Date()
          : null,
    };
  }

  validateBusinessRules(status: string, reason?: string | null) {
    if ((status === 'Backlog' || status === 'Pending' || status === 'Cancel') && !reason?.trim()) {
      throw new BadRequestException(
        `Reason là bắt buộc khi task có status ${status}`,
      );
    }
  }

  private async query(filters: TaskFilterDto): Promise<TaskWithDetails[]> {
    const dueDate: Prisma.DateTimeFilter = {};
    if (filters.dueDateFrom) dueDate.gte = new Date(filters.dueDateFrom);
    if (filters.dueDateTo) {
      const end = new Date(filters.dueDateTo);
      end.setUTCDate(end.getUTCDate() + 1);
      dueDate.lt = end;
    }
    return await this.prisma.task.findMany({
      where: {
        projectId: filters.projectId,
        status: filters.status,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        dueDate: Object.keys(dueDate).length ? dueDate : undefined,
      },
      include: {
        project: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  private present(task: TaskWithDetails): PresentedTask {
    const today = this.startOfToday();
    const upcomingEnd = new Date(today);
    upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 6);
    const open = !['Done', 'Cancel'].includes(task.status);
    const isOverdue = open && task.dueDate < today;
    const isUpcoming =
      open && task.dueDate >= today && task.dueDate < upcomingEnd;
    let stakeholders: string[] = [];
    try {
      const parsed: unknown = task.stakeholders
        ? JSON.parse(task.stakeholders)
        : [];
      stakeholders = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [];
    } catch {
      stakeholders = task.stakeholders ? [task.stakeholders] : [];
    }
    return { ...task, stakeholders, isOverdue, isUpcoming };
  }

  private stats(tasks: PresentedTask[]): Record<string, number> {
    const byStatus = Object.fromEntries(
      TASK_STATUSES.map((status) => [status, 0]),
    );
    for (const task of tasks)
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    return {
      total: tasks.length,
      ...byStatus,
      overdue: tasks.filter((task) => task.isOverdue).length,
      upcoming: tasks.filter((task) => task.isUpcoming).length,
    };
  }

  private sortRank(task: PresentedTask) {
    if (task.isOverdue) return 0;
    if (task.isUpcoming) return 1;
    if (task.status === 'In Progress') return 2;
    if (task.status === 'To Do') return 3;
    if (task.status === 'Review') return 4;
    return 5;
  }

  private startOfToday() {
    return startOfBusinessToday();
  }
}
