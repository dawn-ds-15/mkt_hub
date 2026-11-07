import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProjectExpensePlanItemDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'template', enum: ['template', 'custom'] })
  @IsEnum(['template', 'custom'])
  source: 'template' | 'custom';

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ example: 'Tổ chức sự kiện ra mắt' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 30000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  planAmount: number;

  @ApiPropertyOptional({ example: 'Ghi chú cho hạng mục này' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class SaveProjectExpensePlanDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiPropertyOptional({ example: 'Kế hoạch chi phí dự án quý 3' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [ProjectExpensePlanItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectExpensePlanItemDto)
  items: ProjectExpensePlanItemDto[];
}

export class ProjectExpensePlanItemResponseDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'template', enum: ['template', 'custom'] })
  source: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  templateId?: string | null;

  @ApiProperty({ example: 'Tổ chức sự kiện' })
  name: string;

  @ApiProperty({ example: 30000000 })
  planAmount: number;

  @ApiPropertyOptional({ example: 25000000 })
  actualAmount?: number;

  @ApiPropertyOptional({ example: 5000000 })
  variance?: number;

  @ApiPropertyOptional({ example: 'Ghi chú' })
  note?: string | null;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}

export class ProjectExpensePlanDetailDataDto {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  projectId: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 50000000 })
  totalPlan: number;

  @ApiProperty({ example: 45000000 })
  totalActual: number;

  @ApiProperty({ example: 5000000 })
  variance: number;

  @ApiProperty({ example: 'Active' })
  projectStatus: string;

  @ApiPropertyOptional({ example: null })
  cancelledAt?: Date | null;

  @ApiProperty({ type: [ProjectExpensePlanItemResponseDto] })
  items: ProjectExpensePlanItemResponseDto[];
}

export class ProjectExpensePlanResponseDto {
  @ApiProperty({ type: ProjectExpensePlanDetailDataDto })
  data: ProjectExpensePlanDetailDataDto;

  @ApiPropertyOptional()
  permissions?: any;
}

