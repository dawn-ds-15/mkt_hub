import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QueryBudgetSummaryDto {
  @ApiPropertyOptional({
    description: 'ID dự án hoặc "all" để lấy tất cả dự án được xem',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description: 'Năm báo cáo',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  year: number = 2026;
}

export class SaveBudgetItemDto {
  @ApiProperty({
    description: 'ID hạng mục ngân sách (BudgetCategory, BudgetSubcategory hoặc BudgetItem)',
    example: 'branding',
  })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Tháng trong năm (1-12)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    description: 'Số tiền ngân sách VND (số nguyên không âm)',
    example: 5000000,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount: number;
}

export class SaveBudgetPayloadDto {
  @ApiProperty({
    description: 'Danh sách các mục ngân sách theo tháng',
    type: [SaveBudgetItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveBudgetItemDto)
  items: SaveBudgetItemDto[];
}

export class QueryBudgetDashboardDto {
  @ApiPropertyOptional({
    description: 'ID dự án hoặc "all" để lấy tất cả dự án',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description: 'Năm báo cáo',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  year: number = 2026;
}
