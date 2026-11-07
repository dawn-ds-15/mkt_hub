import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SaveProjectKpiPlanDto {
  @ApiPropertyOptional({ example: 400, description: 'Raw Leads target' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeadsPlan?: number;

  @ApiPropertyOptional({ example: 250, description: 'MQL target' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mqlPlan?: number;

  @ApiPropertyOptional({ example: 100, description: 'SQL target' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sqlPlan?: number;

  @ApiPropertyOptional({ example: 40, description: 'Opportunity target' })
  @IsOptional()
  @IsInt()
  @Min(0)
  oppPlan?: number;

  @ApiPropertyOptional({ example: 12, description: 'Closed deal target' })
  @IsOptional()
  @IsInt()
  @Min(0)
  closedDealPlan?: number;

  @ApiPropertyOptional({ example: 500000000, description: 'Pipeline value target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pipelineValuePlan?: number;

  @ApiPropertyOptional({ description: 'Chỉ số KPI theo định dạng chuẩn mới' })
  @IsOptional()
  metrics?: {
    raw_leads?: number;
    rawLeads?: number;
    mql?: number;
    sql?: number;
    opp?: number;
    closed_deal?: number;
    closedDeal?: number;
    pipeline_value?: number;
    pipelineValue?: number;
  };
}

export class SaveDailyActualDto {
  @ApiPropertyOptional({ example: '2026-09-03', description: 'Ngày phát sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  actualDate?: string;

  @ApiPropertyOptional({ example: 12, description: 'Raw Leads thực tế phát sinh trong ngày' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeads?: number;

  @ApiPropertyOptional({ example: 8, description: 'MQL thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mql?: number;

  @ApiPropertyOptional({ example: 3, description: 'SQL thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sql?: number;

  @ApiPropertyOptional({ example: 2, description: 'Opportunity thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  opp?: number;

  @ApiPropertyOptional({ example: 0, description: 'Closed deal thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  closedDeal?: number;

  @ApiPropertyOptional({ example: 'Chạy chiến dịch test', description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Chỉ số phát sinh theo định dạng metrics mới' })
  @IsOptional()
  metrics?: {
    raw_leads?: number;
    rawLeads?: number;
    mql?: number;
    sql?: number;
    opp?: number;
    closed_deal?: number;
    closedDeal?: number;
    note?: string;
  };

  @ApiPropertyOptional({ description: 'Idempotency Key chống ghi lặp' })
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}

export class UpdateDailyActualByIdDto {
  @ApiPropertyOptional({ example: 12, description: 'Raw Leads thực tế phát sinh trong ngày' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rawLeads?: number;

  @ApiPropertyOptional({ example: 8, description: 'MQL thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mql?: number;

  @ApiPropertyOptional({ example: 3, description: 'SQL thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sql?: number;

  @ApiPropertyOptional({ example: 2, description: 'Opportunity thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  opp?: number;

  @ApiPropertyOptional({ example: 0, description: 'Closed deal thực tế' })
  @IsOptional()
  @IsInt()
  @Min(0)
  closedDeal?: number;

  @ApiPropertyOptional({ example: 'Chạy chiến dịch test', description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Chỉ số phát sinh theo định dạng metrics mới' })
  @IsOptional()
  metrics?: {
    raw_leads?: number;
    rawLeads?: number;
    mql?: number;
    sql?: number;
    opp?: number;
    closed_deal?: number;
    closedDeal?: number;
    note?: string;
  };
}

export class QueryDailyActualDto {
  @ApiPropertyOptional({ example: '2026-09-03', description: 'Lấy chính xác theo ngày' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Từ ngày (fromDate)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Từ ngày (alias from)' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Đến ngày (toDate)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Đến ngày (alias to)' })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ example: 2026, description: 'Năm' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: 9, description: 'Tháng' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @ApiPropertyOptional({ description: 'ID dự án' })
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class QueryKpiProgressDto {
  @ApiPropertyOptional({ example: 2026, description: 'Năm tính toán' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class QueryDailyReportDto {
  @ApiProperty({ example: 2026, description: 'Năm báo cáo' })
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiPropertyOptional({ example: 36, description: 'Số tuần ISO (1-53)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  week?: number;

  @ApiPropertyOptional({ example: 9, description: 'Tháng (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @ApiPropertyOptional({ description: 'ID dự án' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
