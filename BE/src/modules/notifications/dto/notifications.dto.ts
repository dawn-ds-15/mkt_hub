import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationAssigneeDto {
  @ApiProperty({ example: 'uuid-user-id' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  name: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  avatarUrl?: string | null;
}

export class NotificationItemDto {
  @ApiProperty({ example: 'uuid-item-id' })
  id: string;

  @ApiProperty({ example: 'Thực hiện báo cáo tháng' })
  title: string;

  @ApiProperty({ enum: ['overdue', 'upcoming', 'assigned', 'project'], example: 'overdue' })
  type: 'overdue' | 'upcoming' | 'assigned' | 'project';

  @ApiProperty({ example: '2026-08-10' })
  date: string;

  @ApiProperty({ example: true })
  isOverdue: boolean;

  @ApiProperty({ example: false })
  isUpcoming: boolean;

  @ApiPropertyOptional({ example: 'Smartlog Website', nullable: true })
  projectName?: string | null;

  @ApiPropertyOptional({ example: 'uuid-project-id', nullable: true })
  projectId?: string | null;

  @ApiProperty({ example: 'uuid-assignee-id' })
  assigneeId: string;

  @ApiProperty({ type: NotificationAssigneeDto })
  assignee: NotificationAssigneeDto;
}

export class NotificationsResponseDto {
  @ApiProperty({ example: 5 })
  totalCount: number;

  @ApiProperty({ example: 2 })
  overdueCount: number;

  @ApiProperty({ example: 1 })
  upcomingCount: number;

  @ApiProperty({ type: [NotificationItemDto] })
  items: NotificationItemDto[];
}

export class NotificationActorDto {
  @ApiProperty({ example: 'usr_1' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Thị A' })
  name: string;

  @ApiPropertyOptional({ example: null })
  avatarUrl?: string | null;
}

export class NotificationTaskDto {
  @ApiProperty({ example: 'tsk_1' })
  id: string;

  @ApiProperty({ example: 'Thiết kế backdrop' })
  name: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  dueDate?: string | null;
}

export class NotificationProjectDto {
  @ApiProperty({ example: 'prj_1' })
  id: string;

  @ApiProperty({ example: 'Hội thảo Logistics Q4' })
  name: string;
}

export class AppNotificationItemDto {
  @ApiProperty({ example: 'ntf_1' })
  id: string;

  @ApiProperty({ example: 'task_stakeholder_added' })
  type: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2026-09-21T03:12:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({ type: NotificationActorDto })
  actor?: NotificationActorDto | null;

  @ApiPropertyOptional({ type: NotificationTaskDto })
  task?: NotificationTaskDto | null;

  @ApiPropertyOptional({ type: NotificationProjectDto })
  project?: NotificationProjectDto | null;
}

