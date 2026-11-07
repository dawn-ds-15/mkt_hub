import { PartialType } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  STAKEHOLDERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../projects-tasks.constants';

export class SubtaskDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.doneDate !== null && o.doneDate !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'doneDate phải có định dạng YYYY-MM-DD',
  })
  doneDate?: string | null;
}

export class CreateTaskDto {
  @Transform(({ obj, value }) =>
    value !== undefined && value !== '' ? value : obj.title,
  )
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional() @IsString() description?: string;

  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsString()
  projectId: string;

  @Transform(({ obj, value }) => value ?? obj.assignee_id)
  @IsString()
  assigneeId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stakeholders?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stakeholderUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtaskDto)
  subtasks?: SubtaskDto[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  @IsNotEmpty()
  priority: string;

  @Transform(({ obj, value }) => value ?? obj.start_date)
  @IsOptional() @IsDateString() startDate?: string;

  @Transform(({ obj, value }) => value ?? obj.due_date)
  @IsDateString() dueDate: string;

  @Transform(({ obj, value }) => value ?? obj.completed_date)
  @IsOptional() @IsDateString() completedDate?: string;

  @Transform(({ obj, value }) => value ?? obj.exec_week)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  execWeek?: number;

  @Transform(({ obj, value }) => value ?? obj.exec_year)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(9999)
  execYear?: number;

  @IsOptional() @IsString() reason?: string;

  @Transform(({ obj, value }) => value ?? obj.needed_support_bod)
  @IsOptional() @IsString() neededSupportBod?: string;

  @IsOptional() @IsUrl({ require_protocol: true }) link?: string;
  @IsOptional() @IsString() remark?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class TaskFilterDto {
  @IsOptional()
  @Transform(({ obj, value }) => {
    const val = value ?? obj.project_id;
    return val === '' ? undefined : val;
  })
  @IsString()
  projectId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  priority?: string;

  @IsOptional()
  @Transform(({ obj, value }) => {
    const val = value ?? obj.assignee_id;
    return val === '' ? undefined : val;
  })
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @Transform(({ obj, value }) => {
    const val = value ?? obj.due_date_from;
    return val === '' ? undefined : val;
  })
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @Transform(({ obj, value }) => {
    const val = value ?? obj.due_date_to;
    return val === '' ? undefined : val;
  })
  @IsDateString()
  dueDateTo?: string;
}

export class WeeklyReportQueryDto {
  @Transform(({ obj, value }) => value ?? obj.week)
  @Type(() => Number) @IsInt() @Min(1) @Max(53) week: number;

  @Transform(({ obj, value }) => value ?? obj.year)
  @Type(() => Number) @IsInt() @Min(2000) @Max(9999) year: number;

  @Transform(({ obj, value }) => {
    const val = value ?? obj.project_id;
    return val === '' ? undefined : val;
  })
  @IsOptional() @IsString() projectId?: string;

  @Transform(({ obj, value }) => {
    const val = value ?? obj.member_id;
    return val === '' ? undefined : val;
  })
  @IsOptional() @IsString() memberId?: string;
}

export class SaveWeeklyLogDto extends WeeklyReportQueryDto {
  @Transform(({ obj, value }) => value ?? obj.done_notes)
  @IsOptional() @IsString() doneNotes?: string;

  @Transform(({ obj, value }) => value ?? obj.plan_notes)
  @IsOptional() @IsString() planNotes?: string;

  @Transform(({ obj, value }) => value ?? obj.backlog_notes)
  @IsOptional() @IsString() backlogNotes?: string;

  @Transform(({ obj, value }) => value ?? obj.bod_notes)
  @IsOptional() @IsString() bodNotes?: string;
}
