import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ChecklistTaskDto {
  @ApiPropertyOptional({ description: 'Nhóm công việc', default: 'Khác' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiProperty({ description: 'Tên đầu việc' })
  @IsNotEmpty({ message: 'Tên đầu việc (name) trong task là bắt buộc' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết', default: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Độ ưu tiên',
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Các stakeholder liên quan (mã phân tách bằng dấu phẩy)',
    default: '',
  })
  @IsOptional()
  @IsString()
  stakeholders?: string;

  @ApiPropertyOptional({
    description: 'Số ngày hoàn thành trước hạn chót',
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'daysBeforeDeadline phải là số nguyên' })
  @Min(0, { message: 'daysBeforeDeadline phải >= 0' })
  daysBeforeDeadline?: number;

  @ApiPropertyOptional({ description: 'Offset bắt đầu hiển thị (ví dụ: T-75 ngày)' })
  @IsOptional()
  @IsString()
  startOffset?: string;

  @ApiPropertyOptional({ description: 'Offset kết thúc hiển thị (ví dụ: T-60 ngày)' })
  @IsOptional()
  @IsString()
  endOffset?: string;
}

export class CreateChecklistTemplateDto {
  @ApiProperty({
    description: 'Mã định danh mẫu (chỉ gồm a-z, 0-9, _, -)',
    example: 'workshop_quang_ba',
  })
  @IsNotEmpty({ message: 'Mã mẫu (key) là bắt buộc' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Mã mẫu (key) chỉ được chứa các ký tự a-z, A-Z, 0-9, gạch dưới (_) và gạch ngang (-)',
  })
  key: string;

  @ApiProperty({ description: 'Tên mẫu checklist', example: 'Checklist Workshop Quảng bá' })
  @IsNotEmpty({ message: 'Tên mẫu checklist (name) là bắt buộc' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Danh sách các loại dự án áp dụng',
    type: [String],
    example: ['Workshop'],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliesToTypes?: string[];

  @ApiPropertyOptional({
    description: 'Số ngày chuẩn bị (lead time)',
    default: 30,
    example: 45,
  })
  @IsOptional()
  @IsInt({ message: 'leadTimeDays phải là số nguyên' })
  @Min(0, { message: 'leadTimeDays phải lớn hơn hoặc bằng 0' })
  leadTimeDays?: number;

  @ApiPropertyOptional({
    description: 'Danh sách các task trong mẫu checklist',
    type: [ChecklistTaskDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTaskDto)
  tasks?: ChecklistTaskDto[];
}

export class UpdateChecklistTemplateDto {
  @ApiPropertyOptional({
    description: 'Mã định danh mẫu (nếu gửi phải khớp với key trên URL)',
    example: 'workshop_quang_ba',
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ description: 'Tên mẫu checklist', example: 'Checklist Workshop Quảng bá' })
  @IsNotEmpty({ message: 'Tên mẫu checklist (name) là bắt buộc' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Danh sách các loại dự án áp dụng',
    type: [String],
    example: ['Workshop'],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliesToTypes?: string[];

  @ApiPropertyOptional({
    description: 'Số ngày chuẩn bị (lead time)',
    default: 30,
    example: 45,
  })
  @IsOptional()
  @IsInt({ message: 'leadTimeDays phải là số nguyên' })
  @Min(0, { message: 'leadTimeDays phải lớn hơn hoặc bằng 0' })
  leadTimeDays?: number;

  @ApiPropertyOptional({
    description: 'Danh sách các task trong mẫu checklist',
    type: [ChecklistTaskDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTaskDto)
  tasks?: ChecklistTaskDto[];
}

export class StakeholderOptionItemDto {
  @ApiProperty({ description: 'Mã vai trò/stakeholder', example: 'PM' })
  @IsNotEmpty({ message: 'Mã stakeholder (code) là bắt buộc' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Tên vai trò/stakeholder', example: 'Project Manager' })
  @IsNotEmpty({ message: 'Tên stakeholder (label) là bắt buộc' })
  @IsString()
  label: string;
}

export class UpdateStakeholderOptionsDto {
  @ApiProperty({
    description: 'Danh sách stakeholder options',
    type: [StakeholderOptionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StakeholderOptionItemDto)
  stakeholderOptions: StakeholderOptionItemDto[];
}
