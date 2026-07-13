import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  STAKEHOLDERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../projects-tasks.constants';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsUUID() projectId: string;
  @IsUUID() assigneeId: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(STAKEHOLDERS, { each: true })
  stakeholders?: string[];

  @IsOptional()
  @IsEnum(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @IsEnum(TASK_PRIORITIES)
  priority: (typeof TASK_PRIORITIES)[number];

  @IsOptional() @IsDateString() startDate?: string;
  @IsDateString() dueDate: string;
  @IsOptional() @IsDateString() completedDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  execWeek: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  execYear: number;

  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() neededSupportBod?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) link?: string;
  @IsOptional() @IsString() remark?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class TaskFilterDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsEnum(TASK_STATUSES) status?: string;
  @IsOptional() @IsEnum(TASK_PRIORITIES) priority?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsDateString() dueDateFrom?: string;
  @IsOptional() @IsDateString() dueDateTo?: string;
}

export class WeeklyReportQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(53) week: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(9999) year: number;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() memberId?: string;
}

export class SaveWeeklyLogDto extends WeeklyReportQueryDto {
  @IsOptional() @IsString() doneNotes?: string;
  @IsOptional() @IsString() planNotes?: string;
  @IsOptional() @IsString() backlogNotes?: string;
  @IsOptional() @IsString() bodNotes?: string;
}
