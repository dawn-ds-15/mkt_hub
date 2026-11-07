import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';
import {
  AppNotificationItemDto,
  NotificationItemDto,
  NotificationsResponseDto,
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create an in-app notification with 1-minute anti-spam throttle
  async createNotification(data: {
    userId: string;
    actorId?: string;
    type: string;
    taskId?: string;
    projectId?: string;
  }) {
    if (!data.userId) return null;
    if (data.actorId && data.actorId === data.userId) return null;

    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const recent = await (this.prisma as any).notification.findFirst({
        where: {
          userId: data.userId,
          taskId: data.taskId || null,
          type: data.type,
          createdAt: { gte: oneMinuteAgo },
        },
      });
      if (recent) return recent;

      return await (this.prisma as any).notification.create({
        data: {
          userId: data.userId,
          actorId: data.actorId || null,
          type: data.type,
          taskId: data.taskId || null,
          projectId: data.projectId || null,
        },
      });
    } catch (err) {
      console.warn('Failed to create notification:', err);
      return null;
    }
  }

  // GET /v1/notifications
  async getAppNotifications(
    userId: string,
    unreadOnly = false,
    limit = 50,
  ): Promise<AppNotificationItemDto[]> {
    const where: any = {
      userId,
      task: {
        archivedAt: null,
      },
    };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await (this.prisma as any).notification.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        task: {
          select: {
            id: true,
            name: true,
            dueDate: true,
            status: true,
            archivedAt: true,
          },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 100),
    });

    return notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
      actor: n.actor
        ? { id: n.actor.id, name: n.actor.name, avatarUrl: n.actor.avatarUrl }
        : null,
      task: n.task
        ? {
            id: n.task.id,
            name: n.task.name,
            dueDate: n.task.dueDate
              ? (n.task.dueDate instanceof Date
                  ? n.task.dueDate.toISOString().slice(0, 10)
                  : String(n.task.dueDate).slice(0, 10))
              : null,
          }
        : null,
      project: n.project
        ? { id: n.project.id, name: n.project.name }
        : null,
    }));
  }

  // PATCH /v1/notifications/:id/read
  async markAsRead(id: string, userId: string) {
    const existing = await (this.prisma as any).notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo hoặc không có quyền.');
    }

    const updated = await (this.prisma as any).notification.update({
      where: { id },
      data: { isRead: true },
    });
    return { success: true, id: updated.id, isRead: updated.isRead };
  }

  // POST /v1/notifications/read-all
  async markAllAsRead(userId: string) {
    const result = await (this.prisma as any).notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, count: result.count };
  }

  // Legacy fallback
  async getUserNotifications(userId: string): Promise<NotificationsResponseDto> {
    const today = startOfBusinessToday();
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Independent reads: run concurrently instead of three sequential round-trips.
    const [user, tasks, projects] = await Promise.all([
      this.prisma.member.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatarUrl: true },
      }),
      this.prisma.task.findMany({
        where: {
          assigneeId: userId,
          archivedAt: null,
        },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.project.findMany({
        where: {
          ownerId: userId,
          archivedAt: null,
        },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const defaultAssignee = {
      id: user?.id ?? userId,
      name: user?.name ?? 'User',
      avatarUrl: user?.avatarUrl ?? null,
    };

    const items: NotificationItemDto[] = [];
    let overdueCount = 0;
    let upcomingCount = 0;

    for (const task of tasks) {
      if (task.status === 'Done') continue;

      const isOverdue = task.dueDate < today;
      const isUpcoming = !isOverdue && task.dueDate <= threeDaysLater;

      if (isOverdue) overdueCount++;
      if (isUpcoming) upcomingCount++;

      let type: 'overdue' | 'upcoming' | 'assigned' = 'assigned';
      if (isOverdue) type = 'overdue';
      else if (isUpcoming) type = 'upcoming';

      const assigneeObj = task.assignee
        ? { id: task.assignee.id, name: task.assignee.name, avatarUrl: task.assignee.avatarUrl }
        : defaultAssignee;

      items.push({
        id: task.id,
        title: task.name,
        type,
        date: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        isOverdue,
        isUpcoming,
        projectId: task.projectId,
        projectName: task.project?.name ?? null,
        assigneeId: task.assigneeId,
        assignee: assigneeObj,
      });
    }

    for (const p of projects) {
      items.push({
        id: p.id,
        title: `Dự án bạn phụ trách: ${p.name} (${p.status})`,
        type: 'project',
        date: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        isOverdue: false,
        isUpcoming: false,
        projectId: p.id,
        projectName: p.name,
        assigneeId: userId,
        assignee: defaultAssignee,
      });
    }

    return {
      totalCount: items.length,
      overdueCount,
      upcomingCount,
      items,
    };
  }
}

