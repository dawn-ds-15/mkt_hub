import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform, Expose } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  normalizeDateOnly,
  pickInitiationDateRaw,
} from '../closed-deal-initiation.util';

export class SaveKpiPlanDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiProperty({ example: 12000 })
  @Transform(({ obj, value }) => value ?? obj.total_raw_leads)
  @IsInt()
  @Min(0)
  totalRawLeads: number;

  @ApiProperty({ example: 2400 })
  @Transform(({ obj, value }) => value ?? obj.target_mql)
  @IsInt()
  @Min(0)
  targetMql: number;

  @ApiProperty({ example: 1200 })
  @Transform(({ obj, value }) => value ?? obj.target_sql)
  @IsInt()
  @Min(0)
  targetSql: number;

  @ApiProperty({ example: 600 })
  @Transform(({ obj, value }) => value ?? obj.target_opp)
  @IsInt()
  @Min(0)
  targetOpp: number;

  @ApiProperty({ example: 12000 })
  @Transform(({ obj, value }) => value ?? obj.target_closed_deal)
  @IsInt()
  @Min(0)
  targetClosedDeal: number;

  @ApiProperty({ example: 1000000000 })
  @Transform(({ obj, value }) => value ?? obj.target_pipeline_val)
  @IsNumber()
  @Min(0)
  targetPipelineVal: number;

  @ApiProperty({ example: 2000000000 })
  @Transform(({ obj, value }) => value ?? obj.target_won_val)
  @IsNumber()
  @Min(0)
  targetWonVal: number;
}

export class GetWeeklyKpisDto {
  @ApiPropertyOptional({ example: 2026 })
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ''
      ? Number(value)
      : new Date().getFullYear(),
  )
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiPropertyOptional({ example: 23 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  @ApiPropertyOptional({ example: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class GetEventsDto {
  @ApiProperty({ example: 'uuid-project' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 23 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week: number;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'uuid-project' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 23 })
  @IsInt()
  @Min(1)
  @Max(53)
  week: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiProperty({ example: 'Webinar ra mắt sản phẩm' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026-06-04' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'Sự kiện thu hút khách hàng tiềm năng' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  rawLeads: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  mql: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  sql: number;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'uuid-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 23 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiPropertyOptional({ example: 'Webinar ra mắt sản phẩm' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: '2026-06-04' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'Nội dung đã cập nhật' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeads?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mql?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sql?: number;
}

export class OpportunityDto {
  @ApiPropertyOptional({ example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Doanh nghiệp A' })
  @Transform(({ obj, value }) => value ?? obj.company_name)
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'Enterprise' })
  @IsString()
  @IsNotEmpty()
  size: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiProperty({ example: 50000000 })
  @Transform(({ obj, value }) => value ?? obj.setup_fee)
  @IsNumber()
  @Min(0)
  setupFee: number;

  @ApiPropertyOptional({ example: 10000000 })
  @Transform(({ obj, value }) => value ?? obj.monthly_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @Transform(({ obj, value }) => value ?? obj.expected_close_date)
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ example: '2026-08-29' })
  @Transform(({ obj, value }) => value ?? obj.initiation_date ?? obj.initiationDate)
  @IsOptional()
  @IsDateString()
  initiationDate?: string;

  @ApiPropertyOptional({ enum: ['active', 'won', 'lost'], example: 'active' })
  @IsOptional()
  @IsEnum(['active', 'won', 'lost'])
  status?: 'active' | 'won' | 'lost';
}

export class ClosedDealDto {
  @ApiPropertyOptional({ example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Doanh nghiệp B' })
  @Transform(({ obj, value }) => value ?? obj.company_name)
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'Medium' })
  @IsString()
  @IsNotEmpty()
  size: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiProperty({ example: 30000000 })
  @Transform(({ obj, value }) => value ?? obj.setup_fee)
  @IsNumber()
  @Min(0)
  setupFee: number;

  @ApiPropertyOptional({ example: 5000000 })
  @Transform(({ obj, value }) => value ?? obj.monthly_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiProperty({ example: '2026-06-20' })
  @Transform(({ obj, value }) => value ?? obj.closed_date)
  @IsDateString()
  closedDate: string;

  // §3 (26/09/2026): "Ngày bắt đầu" of the source opportunity. Optional and
  // lenient: accepts aliases (initiation_date, ngayBatDau, 'Ngày bắt đầu', ...)
  // and Excel serials / dd/mm/yyyy / yyyy-mm-dd; unparseable or empty -> null
  // (never rejects the deal). Undefined when no such field was sent.
  @ApiPropertyOptional({ example: '2026-05-04', nullable: true })
  @Expose()
  @Transform(({ obj }) => {
    const raw = pickInitiationDateRaw(obj);
    return raw.found ? normalizeDateOnly(raw.value) : undefined;
  })
  @IsOptional()
  @IsDateString()
  initiationDate?: string | null;
}

export class SaveWeeklyKpisDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiPropertyOptional({ example: 23 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  @ApiPropertyOptional({ example: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: 150 })
  @Transform(({ obj, value }) => value ?? obj.raw_leads)
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeads?: number;

  @ApiProperty({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mql?: number;

  @ApiProperty({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sql?: number;

  @ApiProperty({ example: 10 })
  @Transform(({ obj, value }) => value ?? obj.opp_count)
  @IsOptional()
  @IsInt()
  @Min(0)
  oppCount?: number;

  @ApiProperty({ example: 5 })
  @Transform(({ obj, value }) => value ?? obj.closed_count)
  @IsOptional()
  @IsInt()
  @Min(0)
  closedCount?: number;

  @ApiPropertyOptional({ example: 100 })
  @Transform(({ obj, value }) => value ?? obj.raw_leads_plan ?? obj.rawLeadsPlan)
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeadsPlan?: number;

  @ApiPropertyOptional({ example: 40 })
  @Transform(({ obj, value }) => value ?? obj.mql_plan ?? obj.mqlPlan)
  @IsOptional()
  @IsInt()
  @Min(0)
  mqlPlan?: number;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ obj, value }) => value ?? obj.sql_plan ?? obj.sqlPlan)
  @IsOptional()
  @IsInt()
  @Min(0)
  sqlPlan?: number;

  @ApiPropertyOptional({ example: 5 })
  @Transform(({ obj, value }) => value ?? obj.opp_plan ?? obj.oppPlan)
  @IsOptional()
  @IsInt()
  @Min(0)
  oppPlan?: number;

  @ApiPropertyOptional({ example: 2 })
  @Transform(({ obj, value }) => value ?? obj.closed_deal_plan ?? obj.closedDealPlan)
  @IsOptional()
  @IsInt()
  @Min(0)
  closedDealPlan?: number;

  @ApiPropertyOptional({ type: [OpportunityDto] })
  @Transform(({ obj, value }) => value ?? obj.opportunities)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpportunityDto)
  opportunities?: OpportunityDto[];

  @ApiPropertyOptional({ type: [ClosedDealDto] })
  @Transform(({ obj, value }) => value ?? obj.closed_deals)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClosedDealDto)
  closedDeals?: ClosedDealDto[];
}

export class SavePriorYearDealsDto {
  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiProperty({ type: [ClosedDealDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClosedDealDto)
  deals: ClosedDealDto[];
}

export class AnalysisQueryDto {
  @ApiProperty({ enum: ['week', 'month', 'quarter', 'year'], example: 'month' })
  @IsEnum(['week', 'month', 'quarter', 'year'])
  periodType: 'week' | 'month' | 'quarter' | 'year';

  @ApiPropertyOptional({ example: '6' })
  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  periodValue?: string;

  @ApiProperty({ example: '2026' })
  @Transform(({ value }) => value?.toString())
  @IsString()
  @IsNotEmpty()
  year: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class ComparisonQueryDto {
  @ApiProperty({
    enum: ['week', 'month', 'quarter', 'year'],
    example: 'quarter',
  })
  @IsEnum(['week', 'month', 'quarter', 'year'])
  periodType: 'week' | 'month' | 'quarter' | 'year';

  @ApiProperty({ example: '2' })
  @Transform(({ obj, value }) => {
    if (!value && obj && obj['currentPeriodValue']) {
      return obj['currentPeriodValue']?.toString();
    }
    return value?.toString();
  })
  @IsString()
  @IsNotEmpty()
  currentPeriodValue: string;

  @ApiProperty({ example: '2026' })
  @Transform(({ value }) => value?.toString())
  @IsString()
  @IsNotEmpty()
  year1: string;

  @ApiPropertyOptional({ example: '2025' })
  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  year2?: string;

  @ApiPropertyOptional({ example: '2024' })
  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  year3?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class GetClosedDealsDto {
  @ApiPropertyOptional({ example: '2026' })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  quarter?: string;

  @ApiPropertyOptional({ example: '6' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Enterprise' })
  @IsOptional()
  @IsString()
  size?: string;
}

export class UpdateClosedDealDto {
  @ApiPropertyOptional({ example: 'Doanh nghiệp C' })
  @Transform(({ obj, value }) => value ?? obj.company_name)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Enterprise' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiPropertyOptional({ example: 45000000 })
  @Transform(({ obj, value }) => value ?? obj.setup_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupFee?: number;

  @ApiPropertyOptional({ example: 8000000 })
  @Transform(({ obj, value }) => value ?? obj.monthly_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: '2026-06-21' })
  @Transform(({ obj, value }) => value ?? obj.closed_date)
  @IsOptional()
  @IsDateString()
  closedDate?: string;

  // §3 (26/09/2026): 'YYYY-MM-DD' to set, null (or '') to clear.
  @ApiPropertyOptional({ example: '2026-05-04', nullable: true })
  @Expose()
  @Transform(({ obj, value }) => {
    const raw = value !== undefined ? value : obj.initiation_date;
    if (raw === '') return null;
    return raw;
  })
  @IsOptional()
  @IsDateString()
  initiationDate?: string | null;
}

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Doanh nghiệp A' })
  @Transform(({ obj, value }) => value ?? obj.company_name)
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'Enterprise' })
  @IsString()
  @IsNotEmpty()
  size: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiProperty({ example: 50000000 })
  @Transform(({ obj, value }) => value ?? obj.setup_fee)
  @IsNumber()
  @Min(0)
  setupFee: number;

  @ApiPropertyOptional({ example: 10000000 })
  @Transform(({ obj, value }) => value ?? obj.monthly_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @Transform(({ obj, value }) => value ?? obj.expected_close_date)
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ example: '2026-08-29' })
  @Transform(({ obj, value }) => value ?? obj.initiation_date ?? obj.initiationDate)
  @IsOptional()
  @IsDateString()
  initiationDate?: string;

  @ApiPropertyOptional({ enum: ['active', 'won', 'lost'], example: 'active' })
  @IsOptional()
  @IsEnum(['active', 'won', 'lost'])
  status?: 'active' | 'won' | 'lost';

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiPropertyOptional({ example: 23 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;
}

export class UpdateOpportunityDto {
  @ApiPropertyOptional({ example: 'Doanh nghiệp A' })
  @Transform(({ obj, value }) => value ?? obj.company_name)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Enterprise' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'uuid-project' })
  @Transform(({ obj, value }) => value ?? obj.project_id)
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiPropertyOptional({ example: 50000000 })
  @Transform(({ obj, value }) => value ?? obj.setup_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupFee?: number;

  @ApiPropertyOptional({ example: 10000000 })
  @Transform(({ obj, value }) => value ?? obj.monthly_fee)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @Transform(({ obj, value }) => value ?? obj.expected_close_date)
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ example: '2026-08-29' })
  @Transform(({ obj, value }) => value ?? obj.initiation_date ?? obj.initiationDate)
  @IsOptional()
  @IsDateString()
  initiationDate?: string;

  @ApiPropertyOptional({ enum: ['active', 'won', 'lost'], example: 'active' })
  @IsOptional()
  @IsEnum(['active', 'won', 'lost'])
  status?: 'active' | 'won' | 'lost';

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiPropertyOptional({ example: 23 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;
}

export class MarkOpportunityWonDto {
  @ApiPropertyOptional({ example: 'Hợp đồng dịch vụ tư vấn 2026' })
  @Transform(({ obj, value }) => value ?? obj.contract_name ?? obj.contractName)
  @IsOptional()
  @IsString()
  contractName?: string;

  @ApiPropertyOptional({ example: '2026-08-23' })
  @Transform(({ obj, value }) => value ?? obj.signed_date ?? obj.signedDate)
  @IsOptional()
  @IsDateString()
  signedDate?: string;
}

export class DeleteCompareDataDto {
  @ApiProperty({ type: [Number], example: [2025, 2026] })
  @IsArray()
  @IsInt({ each: true })
  years: number[];
}

export class AiReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  data?: any;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  years?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  periodValue?: any;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  insights?: string[];
}

export class MonthlyKpiItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ example: 1000 })
  @Transform(({ obj, value }) => value ?? obj.raw_leads ?? obj.rawLeads)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeads?: number;

  @ApiPropertyOptional({ example: 200 })
  @Transform(({ obj, value }) => value ?? obj.mql)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  mql?: number;

  @ApiPropertyOptional({ example: 100 })
  @Transform(({ obj, value }) => value ?? obj.sql)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sql?: number;

  @ApiPropertyOptional({ example: 50 })
  @Transform(({ obj, value }) => value ?? obj.opp_count ?? obj.oppCount ?? obj.opp)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  oppCount?: number;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ obj, value }) => value ?? obj.closed_count ?? obj.closedCount ?? obj.closedDeal)
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  closedCount?: number;

  @ApiPropertyOptional({ example: 500000000 })
  @Transform(({ obj, value }) => value ?? obj.pipeline_value ?? obj.pipelineValue)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  pipelineValue?: number;

  @ApiPropertyOptional({ example: 200000000 })
  @Transform(({ obj, value }) => value ?? obj.won_value ?? obj.wonValue)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  wonValue?: number;
}

export class SaveMonthlyKpiPlanDto {
  @ApiProperty({ type: [MonthlyKpiItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonthlyKpiItemDto)
  months: MonthlyKpiItemDto[];
}

