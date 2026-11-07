import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
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

const transformNumber = (
  obj: any,
  value: any,
  primaryAlias: string,
  extraAliases: string[] = [],
) => {
  let val = value;
  if (val === undefined || val === null || val === '') {
    const aliases = [primaryAlias, ...extraAliases];
    for (const alias of aliases) {
      if (obj[alias] !== undefined && obj[alias] !== null && obj[alias] !== '') {
        val = obj[alias];
        break;
      }
    }
  }
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/[^0-9.-]/g, '');
    if (cleaned === '') return undefined;
    const num = Number(cleaned);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
};

const TYPE_MAP: Record<string, string> = {
  'Nội bộ': 'Internal',
  'Nội Bộ': 'Internal',
  'Khách hàng': 'Client',
  'Nghiên cứu': 'Research',
  'Hội thảo': 'Workshop',
  'Sự kiện': 'Event',
  'Triển lãm': 'Exhibition',
  'Webinar': 'Webinar',
  Internal: 'Internal',
  Client: 'Client',
  Research: 'Research',
  Workshop: 'Workshop',
  Event: 'Event',
  Exhibition: 'Exhibition',
};

const STATUS_MAP: Record<string, string> = {
  'Lên kế hoạch': 'Planning',
  'Đang thực hiện': 'Active',
  'Đang chạy': 'Active',
  'Tạm dừng': 'On Hold',
  'Hoàn thành': 'Completed',
  'Đã hủy': 'Cancelled',
  Hủy: 'Cancelled',
  Planning: 'Planning',
  Active: 'Active',
  'On Hold': 'On Hold',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) => {
    if (typeof value === 'string' && TYPE_MAP[value.trim()]) {
      return TYPE_MAP[value.trim()];
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @Transform(({ value }) => {
    if (typeof value === 'string' && STATUS_MAP[value.trim()]) {
      return STATUS_MAP[value.trim()];
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @Transform(({ obj, value }) => {
    const raw = value ?? obj.owner_id ?? obj.owner ?? obj.ownerId;
    if (raw && typeof raw === 'object' && raw.id) {
      return raw.id;
    }
    return typeof raw === 'string' ? raw : undefined;
  })
  @IsOptional()
  @IsString()
  ownerId: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        const d = new Date(Date.UTC(+year, +month - 1, +day));
        if (!isNaN(d.getTime())) {
          return d.toISOString();
        }
      }
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    return value;
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  event?: string;

  @Transform(({ obj, value }) => value ?? obj.apply_template)
  @IsOptional()
  @IsBoolean()
  applyTemplate?: boolean;

  @Transform(({ obj, value }) => value ?? obj.template_type ?? obj.templateType)
  @IsOptional()
  @IsString()
  templateType?: string;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'budget_plan_direct', [
      'budget_plan',
      'budgetPlan',
      'budget',
      'budgetDirect',
    ]),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetPlanDirect?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'budget_plan_overhead', ['budgetOverhead']),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetPlanOverhead?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'actual_cost_direct', [
      'actual_cost',
      'actualCost',
      'cost',
      'actualDirect',
    ]),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCostDirect?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'actual_cost_overhead', ['actualOverhead']),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCostOverhead?: number;

  @Transform(({ obj, value }) => value ?? obj.budget_direct_notes)
  @IsOptional()
  @IsString()
  budgetDirectNotes?: string;

  @Transform(({ obj, value }) => value ?? obj.budget_overhead_notes)
  @IsOptional()
  @IsString()
  budgetOverheadNotes?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Dự án trực tiếp mang lại lead: chi phí được tính vào Chi phí lead (CPMQL, CPSQL, ROAS, CAC). Chỉ manager/admin được sửa.',
  })
  @Transform(({ obj, value }) => {
    const v = value ?? obj.is_lead_source;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  })
  @IsOptional()
  @IsBoolean()
  isLeadSource?: boolean;

  @Transform(({ obj, value }) => value ?? obj.actual_direct_notes)
  @IsOptional()
  @IsString()
  actualDirectNotes?: string;

  @Transform(({ obj, value }) => value ?? obj.actual_overhead_notes)
  @IsOptional()
  @IsString()
  actualOverheadNotes?: string;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_raw_leads_plan'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiRawLeadsPlan?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_raw_leads_actual'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiRawLeadsActual?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_mql_plan'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiMqlPlan?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_mql_actual'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiMqlActual?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_sql_plan'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiSqlPlan?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_sql_actual'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiSqlActual?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_opp_plan'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiOppPlan?: number;

  @Transform(({ obj, value }) => transformNumber(obj, value, 'kpi_opp_actual'))
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiOppActual?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_closed_deal_plan'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiClosedDealPlan?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_closed_deal_actual'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiClosedDealActual?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_pipeline_value_plan'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiPipelineValuePlan?: number;

  @Transform(({ obj, value }) =>
    transformNumber(obj, value, 'kpi_pipeline_value_actual'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  kpiPipelineValueActual?: number;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectOwnerDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  avatarUrl?: string | null;
}

export class ProjectKpiSummaryDto {
  @ApiProperty({ example: 'rawLeads' })
  key: string;

  @ApiProperty({ example: 100 })
  plan: number;

  @ApiProperty({ example: 85 })
  actual: number;

  @ApiProperty({ example: 85.0 })
  percent: number;
}

export class ProjectProgressDto {
  @ApiProperty({ example: 75.0 })
  percentage: number;

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 9 })
  done: number;

  @ApiProperty({ example: 3 })
  processing: number;

  @ApiProperty({ example: 0 })
  overdue: number;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  id: string;

  @ApiProperty({ example: 'Chiến dịch Q3 - Brand Awareness' })
  name: string;

  @ApiProperty({ example: 'Event' })
  type: string;

  @ApiProperty({ example: 'Active' })
  status: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  ownerId: string;

  @ApiPropertyOptional({ example: 'Workshop AI' })
  event?: string | null;

  @ApiPropertyOptional({ example: '2026-09-30T00:00:00.000Z' })
  deadline?: Date | string | null;

  @ApiPropertyOptional({ example: 50000000 })
  budgetPlanDirect?: number | null;

  @ApiPropertyOptional({ example: 10000000 })
  budgetPlanOverhead?: number | null;

  @ApiPropertyOptional({ example: 45000000 })
  actualCostDirect?: number | null;

  @ApiPropertyOptional({ example: 8000000 })
  actualCostOverhead?: number | null;

  @ApiProperty({ example: 60000000, description: 'Tổng ngân sách kế hoạch của dự án' })
  budgetPlanTotal: number;

  @ApiProperty({ example: 53000000, description: 'Tổng chi phí thực tế đã chi của dự án' })
  actualCostTotal: number;

  @ApiPropertyOptional({ example: 'Ghi chú ngân sách trực tiếp' })
  budgetDirectNotes?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú ngân sách gián tiếp' })
  budgetOverheadNotes?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú chi phí thực tế trực tiếp' })
  actualDirectNotes?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú chi phí thực tế gián tiếp' })
  actualOverheadNotes?: string | null;

  @ApiPropertyOptional({ example: 200 })
  kpiRawLeadsPlan?: number | null;

  @ApiPropertyOptional({ example: 180 })
  kpiRawLeadsActual?: number | null;

  @ApiPropertyOptional({ example: 50 })
  kpiMqlPlan?: number | null;

  @ApiPropertyOptional({ example: 40 })
  kpiMqlActual?: number | null;

  @ApiPropertyOptional({ example: 20 })
  kpiSqlPlan?: number | null;

  @ApiPropertyOptional({ example: 15 })
  kpiSqlActual?: number | null;

  @ApiPropertyOptional({ example: 10 })
  kpiOppPlan?: number | null;

  @ApiPropertyOptional({ example: 8 })
  kpiOppActual?: number | null;

  @ApiPropertyOptional({ example: 5 })
  kpiClosedDealPlan?: number | null;

  @ApiPropertyOptional({ example: 4 })
  kpiClosedDealActual?: number | null;

  @ApiPropertyOptional({ example: 500000000 })
  kpiPipelineValuePlan?: number | null;

  @ApiPropertyOptional({ example: 400000000 })
  kpiPipelineValueActual?: number | null;

  @ApiProperty({ example: 3 })
  documentsCount: number;

  @ApiProperty({ type: [ProjectKpiSummaryDto] })
  kpis: ProjectKpiSummaryDto[];

  @ApiProperty({ type: ProjectProgressDto })
  progress: ProjectProgressDto;

  @ApiPropertyOptional({ type: ProjectOwnerDto })
  owner?: ProjectOwnerDto;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  tasks?: any[];

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: null })
  archivedAt?: Date | null;

  @ApiPropertyOptional({ example: null, description: 'Thời điểm dự án chuyển sang trạng thái Cancelled' })
  cancelledAt?: Date | null;

  @ApiProperty({ example: false, description: 'Dự án trực tiếp mang lại lead (tính vào Chi phí lead)' })
  isLeadSource: boolean;
}

export class CreateProjectResponseDto extends ProjectResponseDto {
  @ApiPropertyOptional({ example: 15, description: 'Số lượng task được tạo tự động từ template' })
  createdTasksCount?: number;
}

