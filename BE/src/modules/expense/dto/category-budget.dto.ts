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

// --- CATEGORY DTOS ---

export class CreateBudgetCategoryDto {
  @ApiProperty({ example: 'Budget Brand Marketing' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 11, description: 'Tỉ lệ % trên tổng budget marketing' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBudgetCategoryDto {
  @ApiPropertyOptional({ example: 'Budget Brand Marketing' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryBudgetCategoryDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

// --- SUBCATEGORY DTOS ---

export class CreateBudgetSubcategoryDto {
  @ApiProperty({ example: 'cat_01' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ example: 'I. BRAND MARKETING' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'TOTAL BRAND MKT' })
  @IsOptional()
  @IsString()
  totalName?: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  backupPercent?: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBudgetSubcategoryDto {
  @ApiPropertyOptional({ example: 'I. BRAND MARKETING' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'TOTAL BRAND MKT' })
  @IsOptional()
  @IsString()
  totalName?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  backupPercent?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryBudgetSubcategoryDto {
  @ApiPropertyOptional({ example: 'cat_01' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

// --- ITEM DTOS ---

export class CreateBudgetItemDto {
  @ApiProperty({ example: 'sub_01' })
  @IsString()
  @IsNotEmpty()
  subcategoryId: string;

  @ApiProperty({ example: 'Campaign' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  subCount?: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBudgetItemDto {
  @ApiPropertyOptional({ example: 'Campaign' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  subCount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryBudgetItemDto {
  @ApiPropertyOptional({ example: 'sub_01' })
  @IsOptional()
  @IsString()
  subcategoryId?: string;
}

// --- VALUE DTOS ---

export class CellValidationErrorDto {
  @ApiPropertyOptional({ example: 'cat_01', nullable: true })
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'item_01', nullable: true })
  itemId?: string | null;

  @ApiPropertyOptional({ example: 'sub_01', nullable: true })
  subcategoryId?: string | null;

  @ApiPropertyOptional({ example: false })
  isBackup?: boolean;

  @ApiProperty({ example: 3 })
  month: number;

  @ApiProperty({ example: 'amount không được âm' })
  message: string;
}

export class BudgetValueItemDto {
  @ApiPropertyOptional({ example: 'cat_01', nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'item_01', nullable: true })
  @IsOptional()
  @IsString()
  itemId?: string | null;

  @ApiPropertyOptional({ example: 'sub_01', nullable: true })
  @IsOptional()
  @IsString()
  subcategoryId?: string | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isBackup?: boolean;

  @ApiPropertyOptional({ example: 'plan', description: 'Loại trường dữ liệu (plan/actual)' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({ example: 1, description: 'Tháng 1 - 12' })
  @IsInt()
  month: number;

  @ApiProperty({ example: 10000000 })
  @IsNumber()
  amount: number;
}

export class BulkSaveBudgetValuesDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  year: number;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'ID dự án (nếu lưu ngân sách riêng cho dự án, để trống hoặc null nếu là ngân sách chung)',
    nullable: true,
  })
  @IsOptional()
  projectId?: string | null;

  @ApiPropertyOptional({
    example: '2026-09-01T10:00:00.000Z',
    description: 'Timestamp phiên bản đang mở tại client để kiểm tra xung đột',
  })
  @IsOptional()
  @IsString()
  baseUpdatedAt?: string;

  @ApiProperty({ type: [BudgetValueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetValueItemDto)
  values: BudgetValueItemDto[];
}

export class QueryBudgetValuesDto {
  @ApiPropertyOptional({ example: 2026, default: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Lọc ngân sách theo dự án',
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class BudgetPermissionsDto {
  @ApiProperty({ example: true, description: 'Quyền xem ngân sách' })
  view: boolean;

  @ApiProperty({ example: true, description: 'Quyền chỉnh sửa ngân sách 12 tháng' })
  edit: boolean;

  @ApiProperty({ example: true, description: 'Quyền quản lý thêm/sửa/xóa hạng mục' })
  manageCategories: boolean;

  @ApiProperty({ example: true, description: 'Quyền xuất file Excel' })
  export: boolean;
}

export class BudgetCategoryResponseDto {
  @ApiProperty({ example: 'cat_01' })
  id: string;

  @ApiProperty({ example: 'Budget Brand Marketing' })
  name: string;

  @ApiProperty({ example: 11 })
  percent: number;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class BudgetCategoryListResponseDto {
  @ApiProperty({ type: [BudgetCategoryResponseDto] })
  data: BudgetCategoryResponseDto[];

  @ApiProperty({ type: BudgetPermissionsDto })
  permissions: BudgetPermissionsDto;
}

export class BudgetItemTreeDto {
  @ApiProperty({ example: 'item_01' })
  id: string;

  @ApiProperty({ example: 'Campaign' })
  name: string;

  @ApiPropertyOptional({ example: 2, nullable: true })
  subCount: number | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({
    example: {
      '1': 10000000,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
      '8': 0,
      '9': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    },
    description: 'Map giá trị 12 tháng kế hoạch',
  })
  months: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Map chi phí thực tế 12 tháng',
  })
  actuals?: Record<string, number>;
}

export class BudgetBackupDto {
  @ApiProperty({ example: 10 })
  percent: number;

  @ApiProperty({
    example: {
      '1': 5000000,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
      '8': 0,
      '9': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    },
    description: 'Map giá trị dự phòng 12 tháng',
  })
  months: Record<string, number>;
}

export class BudgetSubcategoryTreeDto {
  @ApiProperty({ example: 'sub_01' })
  id: string;

  @ApiProperty({ example: 'I. BRAND MARKETING' })
  name: string;

  @ApiPropertyOptional({ example: 'TOTAL BRAND MKT', nullable: true })
  totalName: string | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ type: BudgetBackupDto })
  backup: BudgetBackupDto;

  @ApiProperty({ type: [BudgetItemTreeDto] })
  items: BudgetItemTreeDto[];

  @ApiPropertyOptional({
    description: 'Map chi phí thực tế 12 tháng cấp subcategory',
  })
  actuals?: Record<string, number>;
}

export class BudgetCategoryTreeDto {
  @ApiProperty({ example: 'cat_01' })
  id: string;

  @ApiProperty({ example: 'Budget Brand Marketing' })
  name: string;

  @ApiProperty({ example: 11 })
  percent: number;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiPropertyOptional({ example: 30000000, description: 'Tổng kế hoạch cả năm của hạng mục' })
  planTotal?: number;

  @ApiPropertyOptional({ example: 25000000, description: 'Tổng thực tế cả năm của hạng mục' })
  actualTotal?: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Ngân sách còn lại (planTotal - actualTotal)' })
  remaining?: number;

  @ApiPropertyOptional({ example: 83.33, nullable: true, description: 'Tỉ lệ giải ngân (%)' })
  usagePercent?: number | null;

  @ApiProperty({
    example: {
      '1': 10000000,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
      '8': 0,
      '9': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    },
    description: 'Map giá trị 12 tháng kế hoạch cấp category (trực tiếp hoặc rollup từ subcategories)',
  })
  months: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Map chi phí thực tế 12 tháng cấp category',
  })
  actuals?: Record<string, number>;

  @ApiProperty({ type: [BudgetSubcategoryTreeDto] })
  subcategories: BudgetSubcategoryTreeDto[];
}

export class BudgetTreeDataDto {
  @ApiProperty({ type: [BudgetCategoryTreeDto] })
  categories: BudgetCategoryTreeDto[];

  @ApiPropertyOptional({ example: '2026-09-01T12:00:00.000Z', nullable: true })
  updatedAt: string | null;
}

export class BudgetTreeResponseDto {
  @ApiProperty({ type: BudgetTreeDataDto })
  data: BudgetTreeDataDto;

  @ApiProperty({ type: BudgetPermissionsDto })
  permissions: BudgetPermissionsDto;
}

export class BudgetBulkSaveSuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 24 })
  count: number;

  @ApiPropertyOptional({ example: 12 })
  created?: number;

  @ApiPropertyOptional({ example: 12 })
  updated?: number;

  @ApiPropertyOptional({ example: 'Cập nhật ngân sách thành công' })
  message?: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  projectId?: string;
}

export class BudgetBulkSaveResponseDto {
  @ApiProperty({ type: BudgetBulkSaveSuccessResponseDto })
  data: BudgetBulkSaveSuccessResponseDto;
}

export class BudgetCellValidationFailedResponseDto {
  @ApiProperty({ example: 'Có ô không hợp lệ' })
  message: string;

  @ApiProperty({ type: [CellValidationErrorDto] })
  errors: CellValidationErrorDto[];
}

export class BudgetVersionConflictResponseDto {
  @ApiProperty({
    example: 'Dữ liệu đã được cập nhật bởi người khác. Vui lòng tải lại.',
  })
  message: string;

  @ApiProperty({ example: '2026-09-02T10:00:00.000Z' })
  currentUpdatedAt: string;
}

export class BudgetDashboardCategoryDto {
  @ApiProperty({ example: 'Budget Brand Marketing' })
  categoryName: string;

  @ApiProperty({ example: 40000000 })
  budget: number;

  @ApiPropertyOptional({ example: 34.93, nullable: true })
  percentage: number | null;
}

export class BudgetDashboardDataDto {
  @ApiProperty({ example: 114529560 })
  totalBudget: number;

  @ApiProperty({ example: 88000000 })
  actualSpent: number;

  @ApiProperty({ example: 26529560 })
  remainingBudget: number;

  @ApiPropertyOptional({ example: 76.84, nullable: true })
  usedPercentage: number | null;

  @ApiProperty({ type: [BudgetDashboardCategoryDto] })
  categories: BudgetDashboardCategoryDto[];
}

export class BudgetDashboardResponseDto {
  @ApiProperty({ type: BudgetDashboardDataDto })
  data: BudgetDashboardDataDto;

  @ApiProperty({ type: BudgetPermissionsDto })
  permissions: BudgetPermissionsDto;
}

export class ProjectBudgetItemDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  projectId: string | null;

  @ApiProperty({ example: 'Dự án MKT Q1' })
  projectName: string;

  @ApiPropertyOptional({ example: 'Event' })
  projectType?: string;

  @ApiProperty({ example: 50000000 })
  totalBudget: number;

  @ApiProperty({
    example: {
      '1': 10000000,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
      '8': 0,
      '9': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    },
    description: 'Map giá trị 12 tháng kế hoạch',
  })
  months: Record<string, number>;
}

export class BudgetByProjectDataDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 250000000 })
  totalBudget: number;

  @ApiProperty({ type: [ProjectBudgetItemDto] })
  projects: ProjectBudgetItemDto[];
}

export class BudgetByProjectResponseDto {
  @ApiProperty({ type: BudgetByProjectDataDto })
  data: BudgetByProjectDataDto;

  @ApiProperty({ type: BudgetPermissionsDto })
  permissions: BudgetPermissionsDto;
}
