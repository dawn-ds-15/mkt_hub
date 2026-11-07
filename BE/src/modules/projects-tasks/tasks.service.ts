import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calcDurationWeeks,
  getIsoWeekAndYear,
  startOfBusinessToday,
} from '../../common/utils/date.util';
import { randomUUID } from 'crypto';
import { CreateTaskDto, SubtaskDto, TaskFilterDto, UpdateTaskDto } from './dto/task.dto';
import { TASK_STATUSES, TaskStatus } from './projects-tasks.constants';
import { NotificationsService } from '../notifications/notifications.service';

export function normalizeTaskStatus(rawStatus?: string | null): TaskStatus {
  if (!rawStatus) return 'To Do';
  const s = rawStatus.trim();
  const lower = s.toLowerCase();
  if (
    lower === 'đang làm' ||
    lower === 'dang lam' ||
    lower === 'processing' ||
    lower === 'in progress'
  ) {
    return 'In Progress';
  }
  if (
    lower === 'chưa làm' ||
    lower === 'chua lam' ||
    lower === 'to do' ||
    lower === 'todo'
  ) {
    return 'To Do';
  }
  if (
    lower === 'kế hoạch' ||
    lower === 'ke hoach' ||
    lower === 'planning'
  ) {
    return 'Planning';
  }
  if (
    lower === 'chờ duyệt' ||
    lower === 'cho duyet' ||
    lower === 'đang duyệt' ||
    lower === 'review'
  ) {
    return 'Review';
  }
  if (
    lower === 'hoàn thành' ||
    lower === 'hoan thanh' ||
    lower === 'done'
  ) {
    return 'Done';
  }
  if (
    lower === 'tồn đọng' ||
    lower === 'ton dong' ||
    lower === 'backlog'
  ) {
    return 'Backlog';
  }
  if (
    lower === 'hủy' ||
    lower === 'huy' ||
    lower === 'cancel' ||
    lower === 'cancelled'
  ) {
    return 'Cancel';
  }
  if (
    lower === 'tạm dừng' ||
    lower === 'tam dung' ||
    lower === 'pending'
  ) {
    return 'Pending';
  }
  if ((TASK_STATUSES as readonly string[]).includes(s)) {
    return s as TaskStatus;
  }
  return 'To Do';
}

type TaskWithDetails = Prisma.TaskGetPayload<{
  include: {
    project: { select: { id: true; name: true; type: true } };
    assignee: { select: { id: true; name: true; avatarUrl: true } };
    stakeholderMembers: {
      include: {
        user: { select: { id: true; name: true; email: true; avatarUrl: true } };
      };
    };
  };
}>;

type PresentedTask = Omit<TaskWithDetails, 'stakeholders' | 'subtasks'> & {
  stakeholders: string[];
  stakeholderUsers: Array<{ id: string; name: string; email: string; avatarUrl: string | null }>;
  stakeholderUserIds: string[];
  subtasks: SubtaskDto[];
  durationWeeks: number;
  isOverdue: boolean;
  isUpcoming: boolean;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  normalizeTaskStatus(status?: string | null): TaskStatus | undefined {
    return normalizeTaskStatus(status);
  }

  async findAll(filters: TaskFilterDto): Promise<{
    data: PresentedTask[];
    stats: Record<string, number>;
  }> {
    const tasks = await this.query(filters);
    // Compute "today" once: startOfBusinessToday builds an Intl.DateTimeFormat per call.
    const today = this.startOfToday();
    const presented = tasks.map((task) => this.present(task, today));
    presented.sort(
      (a, b) =>
        this.sortRank(a) - this.sortRank(b) ||
        a.dueDate.getTime() - b.dueDate.getTime(),
    );
    return { data: presented, stats: this.stats(presented) };
  }

  async findOne(id: string): Promise<PresentedTask> {
    const [task = null] = await this.findTasksWithDetails(
      { id, archivedAt: null },
      true,
    );
    if (!task) throw new NotFoundException('Không tìm thấy task');
    return this.present(task);
  }

  async kanban(filters: TaskFilterDto) {
    const today = this.startOfToday();
    const tasks = (await this.query(filters)).map((task) =>
      this.present(task, today),
    );
    return TASK_STATUSES.map((status) => {
      const statusTasks = tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      return { status, count: statusTasks.length, tasks: statusTasks };
    });
  }

  toCreateData(dto: CreateTaskDto): Prisma.TaskUncheckedCreateInput {
    let execWeek = dto.execWeek;
    let execYear = dto.execYear;
    if (dto.dueDate && (execWeek === undefined || execYear === undefined)) {
      const iso = getIsoWeekAndYear(new Date(dto.dueDate));
      if (execWeek === undefined) execWeek = iso.week;
      if (execYear === undefined) execYear = iso.year;
    }

    const rawStatus = dto.status ?? 'To Do';
    const status = normalizeTaskStatus(rawStatus);
    const isDone = status === 'Done';
    const completedDate = isDone
      ? dto.completedDate
        ? new Date(dto.completedDate)
        : new Date()
      : null;

    const resolvedName = dto.name || dto.title || '';

    return {
      name: resolvedName,
      description: dto.description ?? null,
      projectId: dto.projectId,
      assigneeId: dto.assigneeId,
      status,
      priority: dto.priority ?? 'Medium',
      execWeek: execWeek ?? 1,
      execYear: execYear ?? new Date().getFullYear(),
      stakeholders: dto.stakeholders ? JSON.stringify(dto.stakeholders) : null,
      subtasks:
        dto.subtasks !== undefined
          ? JSON.stringify(this.normalizeSubtasks(dto.subtasks))
          : '[]',
      reason: dto.reason || null,
      neededSupportBod: dto.neededSupportBod || null,
      link: dto.link || null,
      remark: dto.remark || null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      dueDate: new Date(dto.dueDate),
      completedDate,
    };
  }

  async create(dto: CreateTaskDto, actor?: string | { id?: string }) {
    const actorId = typeof actor === 'object' && actor !== null ? actor.id : actor;
    if (dto.status) {
      dto.status = normalizeTaskStatus(dto.status);
    }
    this.validateBusinessRules(dto.status ?? 'To Do', dto.reason, dto.startDate, dto.dueDate);

    // Validate stakeholderUserIds if provided
    let uniqueUserIds: string[] = [];
    let memberNames: string[] = [];
    if (dto.stakeholderUserIds && dto.stakeholderUserIds.length > 0) {
      uniqueUserIds = Array.from(new Set(dto.stakeholderUserIds.map((s) => String(s).trim()))).filter(Boolean);
      const members = await this.prisma.member.findMany({
        where: { id: { in: uniqueUserIds }, isActive: true },
        select: { id: true, name: true },
      });
      if (members.length !== uniqueUserIds.length) {
        throw new BadRequestException('Một hoặc nhiều người liên quan không tồn tại hoặc đã bị vô hiệu hóa.');
      }
      memberNames = members.map((m) => m.name);
    }

    if ((!dto.stakeholders || dto.stakeholders.length === 0) && memberNames.length > 0) {
      dto.stakeholders = memberNames;
    }

    const data = this.toCreateData(dto);
    const task = await this.prisma.task.create({
      data,
    });

    if (uniqueUserIds.length > 0) {
      try {
        await (this.prisma as any).taskStakeholder.createMany({
          data: uniqueUserIds.map((uid) => ({
            taskId: task.id,
            userId: uid,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn('Failed to insert task stakeholders:', err);
      }
    }

    // Trigger in-app notifications
    if (task.assigneeId && task.assigneeId !== actorId) {
      await this.notificationsService.createNotification({
        userId: task.assigneeId,
        actorId: actorId,
        type: 'task_assigned',
        taskId: task.id,
        projectId: task.projectId,
      });
    }

    for (const uid of uniqueUserIds) {
      if (uid !== actorId && uid !== task.assigneeId) {
        await this.notificationsService.createNotification({
          userId: uid,
          actorId: actorId,
          type: 'task_stakeholder_added',
          taskId: task.id,
          projectId: task.projectId,
        });
      }
    }

    return this.findOne(task.id);
  }

  async update(id: string, dto: UpdateTaskDto, actor?: string | { id?: string }) {
    const actorId = typeof actor === 'object' && actor !== null ? actor.id : actor;
    const existing = await this.prisma.task.findUnique({
      where: { id },
      include: {
        stakeholderMembers: { select: { userId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy task');

    if (dto.status) {
      dto.status = normalizeTaskStatus(dto.status);
    }

    const { title, ...restDto } = dto;
    const resolvedName = restDto.name ?? title;

    const status = restDto.status ?? existing.status;
    const reason = restDto.reason === undefined ? existing.reason : restDto.reason;
    const startDate = restDto.startDate !== undefined ? (restDto.startDate ? new Date(restDto.startDate) : null) : existing.startDate;
    const dueDate = restDto.dueDate !== undefined ? new Date(restDto.dueDate) : existing.dueDate;

    this.validateBusinessRules(status, reason, startDate, dueDate);

    const checkAssignee = Boolean(
      restDto.assigneeId && restDto.assigneeId !== existing.assigneeId,
    );
    const prefetchIds = Array.isArray(restDto.stakeholderUserIds)
      ? Array.from(new Set(restDto.stakeholderUserIds.map((s) => String(s).trim()))).filter(Boolean)
      : [];

    // The assignee and stakeholder lookups are independent reads: fetch them
    // together, then evaluate in the original order so the same error wins.
    const [assigneeResult, stakeholdersResult] = await Promise.allSettled([
      checkAssignee
        ? this.prisma.member.findUnique({
            where: { id: restDto.assigneeId },
          })
        : Promise.resolve(null),
      prefetchIds.length > 0
        ? this.prisma.member.findMany({
            where: { id: { in: prefetchIds }, isActive: true },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
    ]);

    if (checkAssignee) {
      if (assigneeResult.status === 'rejected') throw assigneeResult.reason;
      const member = assigneeResult.value;
      if (!member || !member.isActive) {
        throw new BadRequestException('Người phụ trách không tồn tại hoặc đã bị vô hiệu hóa');
      }
    }

    // Process stakeholderUserIds if provided
    let uniqueUserIds: string[] | undefined = undefined;
    let memberNames: string[] = [];
    if (restDto.stakeholderUserIds !== undefined) {
      uniqueUserIds = Array.from(new Set(restDto.stakeholderUserIds.map((s) => String(s).trim()))).filter(Boolean);
      if (uniqueUserIds.length > 0) {
        // uniqueUserIds === prefetchIds here (same array input, same derivation)
        if (stakeholdersResult.status === 'rejected') throw stakeholdersResult.reason;
        const members = stakeholdersResult.value!;
        if (members.length !== uniqueUserIds.length) {
          throw new BadRequestException('Một hoặc nhiều người liên quan không tồn tại hoặc đã bị vô hiệu hóa.');
        }
        memberNames = members.map((m) => m.name);
      }
    }

    let execWeek = restDto.execWeek;
    let execYear = restDto.execYear;
    if (restDto.dueDate && (execWeek === undefined || execYear === undefined)) {
      const iso = getIsoWeekAndYear(new Date(restDto.dueDate));
      if (execWeek === undefined) execWeek = iso.week;
      if (execYear === undefined) execYear = iso.year;
    }

    let updatedStakeholdersString: string | undefined = undefined;
    if (restDto.stakeholders !== undefined) {
      updatedStakeholdersString = JSON.stringify(restDto.stakeholders);
    } else if (uniqueUserIds !== undefined && memberNames.length > 0) {
      updatedStakeholdersString = JSON.stringify(memberNames);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...restDto,
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      status,
      execWeek,
      execYear,
      stakeholders: updatedStakeholdersString,
      subtasks:
        restDto.subtasks === undefined
          ? undefined
          : JSON.stringify(this.normalizeSubtasks(restDto.subtasks)),
      startDate:
        restDto.startDate === undefined ? undefined : (restDto.startDate ? new Date(restDto.startDate) : null),
      dueDate: restDto.dueDate === undefined ? undefined : new Date(restDto.dueDate),
      completedDate:
        status === 'Done'
          ? restDto.completedDate
            ? new Date(restDto.completedDate)
            : (existing.completedDate ?? new Date())
          : null,
    };
    await this.prisma.task.update({ where: { id }, data });

    // Update join table & notifications if stakeholderUserIds was provided
    if (uniqueUserIds !== undefined) {
      const oldIds: string[] = ((existing as any).stakeholderMembers || []).map((sm: any) => sm.userId);
      try {
        await (this.prisma as any).taskStakeholder.deleteMany({ where: { taskId: id } });
        if (uniqueUserIds.length > 0) {
          await (this.prisma as any).taskStakeholder.createMany({
            data: uniqueUserIds.map((uid) => ({
              taskId: id,
              userId: uid,
            })),
            skipDuplicates: true,
          });
        }
      } catch (err) {
        console.warn('Failed to update task stakeholders table:', err);
      }

      // Notify newly added stakeholders (difference)
      const newlyAddedIds = uniqueUserIds.filter((uid) => !oldIds.includes(uid));
      for (const uid of newlyAddedIds) {
        if (uid !== actorId && uid !== (restDto.assigneeId || existing.assigneeId)) {
          await this.notificationsService.createNotification({
            userId: uid,
            actorId: actorId,
            type: 'task_stakeholder_added',
            taskId: id,
            projectId: existing.projectId,
          });
        }
      }
    }

    // If assigneeId changed to a new user
    if (restDto.assigneeId && restDto.assigneeId !== existing.assigneeId && restDto.assigneeId !== actorId) {
      await this.notificationsService.createNotification({
        userId: restDto.assigneeId,
        actorId: actorId,
        type: 'task_assigned',
        taskId: id,
        projectId: existing.projectId,
      });
    }

    return this.findOne(id);
  }

  async remove(id: string, userId?: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, archivedAt: null },
    });
    if (!task) throw new NotFoundException('Không tìm thấy task');
    await this.prisma.task.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId,
      },
    });
    return { message: 'Lưu trữ (Soft delete) task thành công' };
  }

  validateBusinessRules(
    status: string,
    reason?: string | null,
    startDate?: Date | string | null,
    dueDate?: Date | string | null,
  ) {
    if ((status === 'Backlog' || status === 'Pending' || status === 'Cancel') && !reason?.trim()) {
      throw new BadRequestException(
        `Reason là bắt buộc khi task có status ${status}`,
      );
    }
    if (startDate && dueDate) {
      const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
      const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
      if (!isNaN(start.getTime()) && !isNaN(due.getTime()) && due.getTime() < start.getTime()) {
        throw new BadRequestException('Hạn chót (due_date) phải lớn hơn hoặc bằng ngày bắt đầu (start_date)');
      }
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
    return await this.findTasksWithDetails(
      {
        archivedAt: null,
        projectId: filters.projectId,
        status: filters.status,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        dueDate: Object.keys(dueDate).length ? dueDate : undefined,
      },
      false,
    );
  }

  /**
   * Same result as one `include` of project/assignee/stakeholderMembers.user,
   * split into 2 concurrent queries: Prisma resolves each included relation
   * with its own sequential round-trip (5 serial queries -> 3).
   * `first` = findFirst semantics, otherwise findMany.
   */
  private async findTasksWithDetails(
    where: Prisma.TaskWhereInput,
    first: boolean,
  ): Promise<TaskWithDetails[]> {
    const find = (args: any): Promise<any[]> =>
      first
        ? this.prisma.task
            .findFirst(args)
            .then((row: any) => (row ? [row] : []))
        : this.prisma.task.findMany(args);

    const [baseRows, stakeholderRows] = await Promise.all([
      find({
        where,
        include: {
          project: { select: { id: true, name: true, type: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      find({
        where,
        select: {
          id: true,
          stakeholderMembers: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      }),
    ]);

    const stakeholdersById = new Map(
      stakeholderRows.map((row) => [row.id, row.stakeholderMembers]),
    );
    return baseRows.map((task) => ({
      ...task,
      stakeholderMembers: stakeholdersById.get(task.id) ?? [],
    })) as TaskWithDetails[];
  }

  private present(
    task: TaskWithDetails,
    today: Date = this.startOfToday(),
  ): PresentedTask {
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

    const sm = (task as any).stakeholderMembers || [];
    const stakeholderUsers = sm
      .map((item: any) => item.user)
      .filter((u: any) => Boolean(u));
    const stakeholderUserIds = stakeholderUsers.map((u: any) => u.id);
    const userNames = stakeholderUsers.map((u: any) => u.name);
    const combinedStakeholderNames = Array.from(
      new Set([...userNames, ...stakeholders]),
    );

    let subtasks: SubtaskDto[] = [];
    try {
      const parsed: unknown = (task as any).subtasks
        ? JSON.parse((task as any).subtasks)
        : [];
      subtasks = Array.isArray(parsed)
        ? parsed.map((item: any) => ({
            id: item?.id ? String(item.id) : randomUUID(),
            text: String(item?.text || '').trim(),
            done: Boolean(item?.done),
            doneDate:
              item?.doneDate !== undefined && item?.doneDate !== null && String(item.doneDate).trim()
                ? String(item.doneDate).trim()
                : null,
          }))
        : [];
    } catch {
      subtasks = [];
    }
    const durationWeeks = calcDurationWeeks(task.startDate, task.dueDate);
    return {
      ...task,
      stakeholders: combinedStakeholderNames,
      stakeholderUsers,
      stakeholderUserIds,
      subtasks,
      durationWeeks,
      isOverdue,
      isUpcoming,
    };
  }

  private normalizeSubtasks(
    subtasks?: SubtaskDto[] | null,
  ): Array<{ id: string; text: string; done: boolean; doneDate: string | null }> {
    if (!Array.isArray(subtasks)) return [];
    return subtasks.map((st) => ({
      id: st.id && String(st.id).trim() ? String(st.id).trim() : randomUUID(),
      text: String(st.text || '').trim(),
      done: Boolean(st.done),
      doneDate:
        st.doneDate !== undefined && st.doneDate !== null && String(st.doneDate).trim()
          ? String(st.doneDate).trim()
          : null,
    }));
  }

  private stats(tasks: PresentedTask[]): Record<string, number> {
    const byStatus = Object.fromEntries(
      TASK_STATUSES.map((status) => [status, 0]),
    );
    for (const task of tasks)
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

    // Combine To Do and Planning to maintain consistency between List stats and Kanban board
    const combinedTodoPlanning = (byStatus['To Do'] ?? 0) + (byStatus['Planning'] ?? 0);
    byStatus['To Do'] = combinedTodoPlanning;
    byStatus['Planning'] = combinedTodoPlanning;

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
