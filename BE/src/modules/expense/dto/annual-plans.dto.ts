import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

export class CreateAnnualPlanTemplateDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  fromPlanId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  cloneTree?: boolean;
}

export class CreateAnnualPlanDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 'Bản kế hoạch chi phí năm 2026 v1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: CreateAnnualPlanTemplateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAnnualPlanTemplateDto)
  template?: CreateAnnualPlanTemplateDto;
}

export class UpdateAnnualPlanItemAmountDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: 10000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}

export class BulkUpdateAnnualPlanItemsDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiProperty({ type: [UpdateAnnualPlanItemAmountDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAnnualPlanItemAmountDto)
  items: UpdateAnnualPlanItemAmountDto[];
}

export class CreateAnnualPlanItemNodeDto {
  @ApiProperty({ example: 1, description: '1: L1, 2: L2, 3: Chi tiết' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  level: number;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ example: 'Campaign Marketing' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class ActivateAnnualPlanDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Xác nhận thay thế nếu đã có bản kế hoạch active khác trong cùng năm',
  })
  @IsOptional()
  @IsBoolean()
  confirmReplace?: boolean;
}

export class AnnualPlanResponseDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: 'Kế hoạch chi phí năm 2026 v1' })
  name: string;

  @ApiProperty({ example: 'active', enum: ['draft', 'active', 'archived'] })
  status: string;

  @ApiPropertyOptional({ example: '2026-09-06T10:00:00.000Z' })
  activatedAt?: Date | null;

  @ApiPropertyOptional({ example: null })
  replacedByVersion?: number | null;

  @ApiProperty({ example: 500000000 })
  totalPlan: number;

  @ApiPropertyOptional({ example: '2026-09-06T10:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-09-06T10:00:00.000Z' })
  updatedAt?: Date;
}

export class AnnualPlanListResponseDto {
  @ApiProperty({ type: [AnnualPlanResponseDto] })
  data: AnnualPlanResponseDto[];

  @ApiPropertyOptional()
  permissions?: any;
}

export class AnnualPlanSingleResponseDto {
  @ApiProperty({ type: AnnualPlanResponseDto })
  data: AnnualPlanResponseDto;

  @ApiPropertyOptional()
  permissions?: any;
}

export class AnnualPlanTreeNodeL3Dto {
  @ApiProperty({ example: 'node_l3' })
  id: string;

  @ApiProperty({ example: 'Facebook Ads' })
  name: string;

  @ApiProperty({ example: 3 })
  level: number;

  @ApiProperty({ example: 50000000 })
  amount: number;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}

export class AnnualPlanTreeNodeL2Dto {
  @ApiProperty({ example: 'node_l2' })
  id: string;

  @ApiProperty({ example: 'Quảng cáo số' })
  name: string;

  @ApiProperty({ example: 2 })
  level: number;

  @ApiProperty({ example: 50000000 })
  totalAmount: number;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ type: [AnnualPlanTreeNodeL3Dto] })
  children: AnnualPlanTreeNodeL3Dto[];
}

export class AnnualPlanTreeNodeL1Dto {
  @ApiProperty({ example: 'node_l1' })
  id: string;

  @ApiProperty({ example: 'Chi phí Marketing' })
  name: string;

  @ApiProperty({ example: 1 })
  level: number;

  @ApiProperty({ example: 50000000 })
  totalAmount: number;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ type: [AnnualPlanTreeNodeL2Dto] })
  children: AnnualPlanTreeNodeL2Dto[];
}

export class AnnualPlanTreeDetailDataDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: 'Kế hoạch năm 2026' })
  name: string;

  @ApiProperty({ example: 'draft' })
  status: string;

  @ApiProperty({ example: 50000000 })
  totalPlan: number;

  @ApiProperty({ type: [AnnualPlanTreeNodeL1Dto] })
  tree: AnnualPlanTreeNodeL1Dto[];
}

export class AnnualPlanTreeResponseDto {
  @ApiProperty({ type: AnnualPlanTreeDetailDataDto })
  data: AnnualPlanTreeDetailDataDto;

  @ApiPropertyOptional()
  permissions?: any;
}
