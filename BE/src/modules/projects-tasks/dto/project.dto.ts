import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PROJECT_STATUSES, PROJECT_TYPES } from '../projects-tasks.constants';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PROJECT_TYPES)
  type: (typeof PROJECT_TYPES)[number];

  @IsEnum(PROJECT_STATUSES)
  status: (typeof PROJECT_STATUSES)[number];

  @IsUUID()
  ownerId: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsBoolean()
  applyTemplate?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetPlanDirect?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetPlanOverhead?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualCostDirect?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualCostOverhead?: number;

  @IsOptional() @IsString() budgetDirectNotes?: string;
  @IsOptional() @IsString() budgetOverheadNotes?: string;
  @IsOptional() @IsString() actualDirectNotes?: string;
  @IsOptional() @IsString() actualOverheadNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiRawLeadsPlan?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiRawLeadsActual?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiMqlPlan?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiMqlActual?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiSqlPlan?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiSqlActual?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiOppPlan?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kpiOppActual?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiClosedDealPlan?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiClosedDealActual?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiPipelineValuePlan?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  kpiPipelineValueActual?: number;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
