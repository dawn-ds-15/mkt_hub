import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveExpenseRecordDto {
  @ApiPropertyOptional({ example: '10000000-0000-4000-8000-000000000001' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: '10000000-0000-4000-8000-000000000001' })
  @IsOptional()
  @IsUUID()
  expenseId?: string;

  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDate?: string;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date', description: 'Alias for recognizedDate' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isUnplanned?: boolean;

  @ApiPropertyOptional({ example: 'Chi phí phát sinh thêm PG' })
  @IsOptional()
  @IsString()
  unplannedItemName?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  projectExpenseItemId?: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  annualExpenseItemId?: string;

  @ApiPropertyOptional({ example: 'confirm', enum: ['draft', 'confirm'] })
  @IsOptional()
  @IsEnum(['draft', 'confirm'])
  action?: 'draft' | 'confirm';

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  directCost?: number;

  @ApiPropertyOptional({ example: 'Chi phí quảng cáo Facebook' })
  @IsOptional()
  @IsString()
  directNotes?: string;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overheadCost?: number;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overhead?: number;

  @ApiPropertyOptional({ example: 'Chi phí văn phòng phẩm' })
  @IsOptional()
  @IsString()
  overheadNotes?: string;

  @ApiPropertyOptional({ type: () => [CreateExpenseLineDto] })
  @IsOptional()
  lines?: any[];
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ example: '10000000-0000-4000-8000-000000000001' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDate?: string;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date', description: 'Alias for recognizedDate' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: 'Điều chỉnh phân bổ ngân sách thực tế' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 18000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  directCost?: number;

  @ApiPropertyOptional({ example: 'Chi phí quảng cáo cập nhật' })
  @IsOptional()
  @IsString()
  directNotes?: string;

  @ApiPropertyOptional({ example: 6000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overheadCost?: number;

  @ApiPropertyOptional({ example: 'Chi phí phát sinh' })
  @IsOptional()
  @IsString()
  overheadNotes?: string;
}

export class ExpensePermissionsDto {
  @ApiProperty({ example: true })
  view: boolean;

  @ApiProperty({ example: true })
  createDraft: boolean;

  @ApiProperty({ example: true })
  confirm: boolean;

  @ApiProperty({ example: true })
  cancel: boolean;

  @ApiProperty({ example: true })
  managePlans: boolean;
}

export class ExpenseLineAttachmentDto {
  @ApiProperty({ example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  lineId: string;

  @ApiProperty({ example: 'hoa-don-001.pdf' })
  name: string;

  @ApiProperty({ example: 204800, description: 'Dung lượng (byte), 0 nếu là file cũ không rõ dung lượng' })
  size: number;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  mimeType: string | null;

  @ApiProperty({
    example: 'https://mkt-hub.onrender.com/api/v1/expenses/attachments/c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/file',
    description: 'Xem / tải file (cần Bearer token)',
  })
  url: string;

  @ApiPropertyOptional({ example: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', nullable: true })
  uploadedBy: string | null;

  @ApiProperty({ example: '2026-09-29T08:00:00.000Z' })
  uploadedAt: Date;
}

export class ExpenseLineAttachmentListResponseDto {
  @ApiProperty({ type: [ExpenseLineAttachmentDto] })
  data: ExpenseLineAttachmentDto[];
}

export class ExpenseLineDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  expenseId: string;

  @ApiProperty({ example: 'Thuê địa điểm tổ chức sự kiện' })
  name: string;

  @ApiPropertyOptional({ example: 'posm' })
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  inventoryItemId?: string | null;

  @ApiPropertyOptional({ example: false })
  isCustom?: boolean;

  @ApiPropertyOptional({ example: 'confirmed', enum: ['draft', 'confirmed', 'cancelled'] })
  status?: string;

  @ApiPropertyOptional({ example: '2026-08-23', type: String, format: 'date' })
  recognizedDate?: string | Date | null;

  @ApiPropertyOptional({ example: false })
  isUnplanned?: boolean;

  @ApiPropertyOptional({ example: null })
  unplannedItemName?: string | null;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  supplier?: string | null;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  supplierName?: string | null;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  projectExpenseItemId?: string | null;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  annualExpenseItemId?: string | null;

  @ApiPropertyOptional({ example: '2026-08-23T14:30:00.000Z' })
  cancelledAt?: Date | null;

  @ApiPropertyOptional({ example: 'usr_01' })
  cancelledBy?: string | null;

  @ApiPropertyOptional({ example: 'Hủy vì sự kiện hoãn' })
  cancelledReason?: string | null;

  @ApiPropertyOptional({ example: '2026-08-23T10:00:00.000Z' })
  confirmedAt?: Date | null;

  @ApiPropertyOptional({ example: 'usr_01' })
  confirmedBy?: string | null;

  @ApiPropertyOptional({ example: 10 })
  plannedQuantity?: number;

  @ApiPropertyOptional({ example: 8 })
  actualQuantity?: number;

  @ApiPropertyOptional({ example: 50000 })
  unitPriceBeforeVatSnapshot?: number | null;

  @ApiPropertyOptional({ example: 8 })
  deductedQuantity?: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  stockTransactionId?: string | null;

  @ApiPropertyOptional({ example: 10 })
  vatRateSnapshot?: number | null;

  @ApiPropertyOptional({ example: 55000 })
  unitPriceAfterVatSnapshot?: number | null;

  @ApiPropertyOptional({ example: 550000 })
  plannedAmount?: number;

  @ApiProperty({ example: 55000 })
  actualUnitPrice: number;

  @ApiProperty({ example: 8 })
  quantity: number;

  @ApiProperty({ example: 440000 })
  totalAmount: number;

  @ApiPropertyOptional({ example: 'Hội trường tầng 3' })
  note?: string | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiPropertyOptional({ example: 'hop_dong_thue_dia_diem.pdf' })
  attachmentName?: string | null;

  @ApiPropertyOptional({
    type: [ExpenseLineAttachmentDto],
    description: 'Tất cả hồ sơ của dòng (gồm cả file cũ 1-file-một-dòng)',
  })
  attachments?: ExpenseLineAttachmentDto[];

  @ApiPropertyOptional({
    example: 'http://localhost:3000/api/v1/expenses/lines/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/attachment',
    description: 'URL tuyệt đối để xem hoặc tải file đính kèm',
  })
  attachmentUrl?: string | null;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/api/v1/expenses/lines/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/attachment',
  })
  receiptUrl?: string | null;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/api/v1/expenses/lines/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/attachment',
  })
  url?: string | null;

  @ApiPropertyOptional({
    example: '2026-09-04',
    type: String,
    format: 'date',
    description: 'Alias for recognizedDate',
  })
  expenseDate?: string | Date | null;

  @ApiPropertyOptional({
    example: 'Hạng mục khác',
    description: 'Tên hạng mục lớn',
  })
  hangMucLon?: string | null;

  @ApiPropertyOptional({
    example: 'Hạng mục khác',
    description: 'Tên hạng mục lớn (alias)',
  })
  categoryName?: string | null;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  archivedAt?: Date | null;
}

export class CreateExpenseLineDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Banner đứng cuốn nhôm' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'posm', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'posm', nullable: true, description: 'Alias for categoryId' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  expenseCategory?: string | null;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
    description: 'ID hạng mục ngân sách tuỳ chọn khi tạo dòng từ xuất kho',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  expenseCategoryId?: string | null;

  @ApiPropertyOptional({ example: 'Hạng mục khác', description: 'Tên hạng mục lớn' })
  @IsOptional()
  @IsString()
  hangMucLon?: string;

  @ApiPropertyOptional({ example: 'Hạng mục khác', description: 'Tên hạng mục lớn (alias)' })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Alias for inventoryItemId' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isCustom?: boolean;

  @ApiPropertyOptional({
    example: 'draft',
    enum: ['draft', 'confirmed', 'cancelled'],
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(['draft', 'confirmed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ example: '2026-08-23', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-23',
    type: String,
    format: 'date',
    description: 'Alias for recognizedDate',
  })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isUnplanned?: boolean;

  @ApiPropertyOptional({ example: 'Chi phí phát sinh thêm PG' })
  @IsOptional()
  @IsString()
  unplannedItemName?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  projectExpenseItemId?: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  annualExpenseItemId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedQuantity?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  actualQuantity?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceBeforeVat?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 550000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedAmount?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualUnitPrice?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Hội trường tầng 3' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Hội trường tầng 3', description: 'Alias for note' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Hội trường tầng 3', description: 'Alias for note' })
  @IsOptional()
  @IsString()
  ghiChu?: string;

  @ApiPropertyOptional({ example: 8, description: 'Alias for actualQuantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  realQty?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  skipStockCheck?: boolean;

  @ApiPropertyOptional({ example: 'req-001' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: 'req-001' })
  @IsOptional()
  @IsString()
  clientRequestId?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({
    example: 'hoa-don-001.pdf',
    description: 'Tên file hồ sơ (khi chép hồ sơ từ dòng cũ sang snapshot mới)',
  })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    description:
      'Id hồ sơ (GET /v1/expenses/lines/{lineId}/attachments) của dòng cũ để gắn lại vào dòng này (không copy file)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class UpdateExpenseLineDto {
  @ApiPropertyOptional({ example: 'Thuê địa điểm tổ chức sự kiện' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Thuê địa điểm tổ chức sự kiện', description: 'Alias for name' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'posm', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'posm', nullable: true, description: 'Alias for categoryId' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  expenseCategory?: string | null;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
    description: 'ID hạng mục ngân sách tuỳ chọn khi cập nhật dòng từ xuất kho',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  expenseCategoryId?: string | null;

  @ApiPropertyOptional({ example: 'Hạng mục khác', description: 'Tên hạng mục lớn' })
  @IsOptional()
  @IsString()
  hangMucLon?: string;

  @ApiPropertyOptional({ example: 'Hạng mục khác', description: 'Tên hạng mục lớn (alias)' })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isCustom?: boolean;

  @ApiPropertyOptional({ example: 'confirmed', enum: ['draft', 'confirmed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'confirmed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ example: '2026-08-23', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-23',
    type: String,
    format: 'date',
    description: 'Alias for recognizedDate',
  })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isUnplanned?: boolean;

  @ApiPropertyOptional({ example: 'Chi phí phát sinh thêm PG' })
  @IsOptional()
  @IsString()
  unplannedItemName?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH Sự Kiện ABC', description: 'Alias for supplier' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  projectExpenseItemId?: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  annualExpenseItemId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedQuantity?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  actualQuantity?: number;

  @ApiPropertyOptional({ example: 8, description: 'Alias for actualQuantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  realQty?: number;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Alias for inventoryItemId' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  skipStockCheck?: boolean;

  @ApiPropertyOptional({ example: 'req-001' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: 'req-001' })
  @IsOptional()
  @IsString()
  clientRequestId?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceBeforeVat?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 10000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedAmount?: number;

  @ApiPropertyOptional({ example: 9500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualUnitPrice?: number;

  @ApiPropertyOptional({ example: 9500000, description: 'Alias for actualUnitPrice' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 9500000, description: 'Alias for actualUnitPrice or plannedAmount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Hội trường tầng 3' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.pdf', description: 'Alias for attachmentUrl' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'hoa-don-001.pdf', description: 'Tên file hồ sơ' })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    description:
      'Id hồ sơ (GET /v1/expenses/lines/{lineId}/attachments) của dòng cũ để gắn lại vào dòng này (không copy file)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class ExpenseRecordDto {
  @ApiProperty({ example: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  id: string;

  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  projectId: string;

  @ApiProperty({ example: 8 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date' })
  recognizedDate?: string | Date | null;

  @ApiPropertyOptional({ example: '2026-09-06', type: String, format: 'date', description: 'Alias for recognizedDate' })
  expenseDate?: string | Date | null;

  @ApiPropertyOptional({ example: 'draft', enum: ['draft', 'confirmed', 'cancelled'] })
  status?: string;

  @ApiPropertyOptional({ example: 15000000 })
  totalPlanned?: number;

  @ApiPropertyOptional({ example: 18000000 })
  totalActual?: number;

  @ApiProperty({ example: 18000000 })
  directCost: number;

  @ApiPropertyOptional({ example: 'Chi phí quảng cáo cập nhật' })
  directNotes?: string | null;

  @ApiProperty({ example: 6000000 })
  overheadCost: number;

  @ApiPropertyOptional({ example: 'Chi phí phát sinh' })
  overheadNotes?: string | null;

  @ApiPropertyOptional({ type: [ExpenseLineDto] })
  @Type(() => ExpenseLineDto)
  lines?: ExpenseLineDto[];

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  updatedAt: Date;
}

export class ExpenseOverviewMetricsDto {
  @ApiProperty({
    example: 367335735,
    description: 'Tổng chi phí thực tế trong kỳ (Direct + Overhead)',
  })
  totalExpense: number;

  @ApiProperty({
    example: 8,
    description: 'Số Closed Deal có closedDate nằm trong period đang truy vấn',
  })
  wonCount: number;

  @ApiProperty({
    example: 2611000000,
    description: 'Tổng giá trị deal thắng cùng kỳ tính theo setupFee (khớp actual của card Won trên dashboard)',
  })
  wonValue: number;

  @ApiPropertyOptional({
    example: 7.1,
    nullable: true,
    description: 'Tỉ suất hoàn vốn: wonValue / totalExpense (null nếu totalExpense <= 0 hoặc wonCount = 0)',
  })
  roas: number | null;

  @ApiPropertyOptional({
    example: 45916967,
    nullable: true,
    description: 'Chi phí sở hữu khách hàng: totalExpense / wonCount (null nếu wonCount = 0)',
  })
  cac: number | null;

  @ApiPropertyOptional({ example: 159000000, description: 'Giá trị trọn đời khách hàng' })
  ltv?: number;

  @ApiPropertyOptional({ example: 3.5, nullable: true, description: 'Tỉ số LTV/CAC' })
  ratio?: number | null;

  @ApiPropertyOptional({
    example: { status: 'Tỷ lệ vàng', color: '🟢 Xanh lá', visual: 'green' },
  })
  health?: any;
}

export class ExpenseProjectOverviewDto {
  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  projectId: string;

  @ApiProperty({ example: 'Event Launching Q2' })
  projectName: string;

  @ApiProperty({ example: 'Event' })
  projectType: string;

  @ApiProperty({ example: 50000000 })
  budgetTotal: number;

  @ApiProperty({ example: 45000000 })
  actualTotal: number;

  @ApiProperty({ example: 5000000 })
  variance: number;

  @ApiProperty({ example: 2 })
  newCustomers: number;

  @ApiProperty({ example: 22500000 })
  cac: number | string;
}

export class ExpenseOverviewResponseDto {
  @ApiProperty({ example: '2026-06' })
  period: string;

  @ApiProperty({ type: ExpenseOverviewMetricsDto })
  metrics: ExpenseOverviewMetricsDto;

  @ApiProperty({ type: [ExpenseProjectOverviewDto] })
  projects: ExpenseProjectOverviewDto[];
}

export class ExpenseRecordResponseDto {
  @ApiProperty({ type: ExpenseRecordDto })
  data: ExpenseRecordDto;

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class ExpenseLineActionResponseDto {
  @ApiProperty({ type: ExpenseLineDto })
  data: ExpenseLineDto;

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class SaveSystemConfigDto {
  @IsEnum(['churn_rate', 'gross_margin'])
  @IsNotEmpty()
  key: 'churn_rate' | 'gross_margin';

  @IsEnum(['month', 'quarter', 'year'])
  @IsNotEmpty()
  periodType: 'month' | 'quarter' | 'year';

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodValue?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsString()
  effectiveFrom: string;
}

export class CancelExpenseLineDto {
  @ApiProperty({ example: 'Khách hàng đổi địa điểm, hủy hợp đồng cũ' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class QueryActualExpensesDto {
  @ApiPropertyOptional({ enum: ['draft', 'confirmed', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @ApiPropertyOptional({ example: '2026-08-01', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  recognizedDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isUnplanned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectExpenseItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  annualExpenseItemId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number = 20;
}

export class ExpenseActualDto extends ExpenseLineDto {
  @ApiPropertyOptional({ example: '10000000-0000-4000-8000-000000000001' })
  projectId?: string | null;

  @ApiPropertyOptional({ example: 'Event Launching Q2' })
  projectName?: string | null;

  @ApiPropertyOptional({ example: 'Active' })
  projectStatus?: string | null;

  @ApiPropertyOptional({ example: 'Thuê âm thanh ánh sáng' })
  projectExpenseItemName?: string | null;

  @ApiPropertyOptional({ example: 'Chi phí Marketing > Sự kiện > Âm thanh' })
  annualPath?: string | null;
}

export class ExpenseActualsPaginationResponseDto {
  @ApiProperty({ type: [ExpenseActualDto] })
  items: ExpenseActualDto[];

  @ApiProperty({ type: [ExpenseActualDto] })
  data: ExpenseActualDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  perPage: number;

  @ApiProperty({ example: 5 })
  totalPages: number;

  @ApiProperty({ example: true, description: 'True nếu page * perPage < total' })
  hasMore: boolean;

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class AuditLogSummaryDto {
  @ApiProperty({ example: 'aud_01' })
  id: string;

  @ApiProperty({ example: 'confirm' })
  action: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  changedBy?: string | null;

  @ApiProperty({ example: '2026-09-06T10:00:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional()
  oldValue?: any;

  @ApiPropertyOptional()
  newValue?: any;
}

export class ExpenseActualDetailDataDto extends ExpenseActualDto {
  @ApiPropertyOptional({ type: [AuditLogSummaryDto] })
  auditLogs?: AuditLogSummaryDto[];
}

export class ExpenseActualDetailResponseDto {
  @ApiProperty({ type: ExpenseActualDetailDataDto })
  data: ExpenseActualDetailDataDto;

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class AnnualOverviewTreeNodeDto {
  @ApiProperty({ example: 'node_01' })
  id: string;

  @ApiProperty({ example: 'Chi phí Marketing' })
  name: string;

  @ApiProperty({ example: 1 })
  level: number;

  @ApiProperty({ example: 50000000 })
  plan: number;

  @ApiProperty({ example: 45000000 })
  actual: number;

  @ApiProperty({ example: 5000000 })
  remaining: number;

  @ApiProperty({ example: 90 })
  spendPct: number;

  @ApiPropertyOptional({ type: [AnnualOverviewTreeNodeDto] })
  children?: AnnualOverviewTreeNodeDto[];
}

export class AnnualOverviewTreeResponseDto {
  @ApiProperty({
    example: {
      period: '2026',
      nodes: [],
    },
  })
  data: {
    period: string;
    nodes: AnnualOverviewTreeNodeDto[];
  };

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class ProjectOverviewTreeNodeDto {
  @ApiProperty({ example: 'node_01' })
  id: string;

  @ApiProperty({ example: 'Thuê địa điểm' })
  name: string;

  @ApiProperty({ example: 'template' })
  source: string;

  @ApiProperty({ example: 30000000 })
  plan: number;

  @ApiProperty({ example: 25000000 })
  actual: number;

  @ApiProperty({ example: 5000000 })
  variance: number;

  @ApiProperty({ example: 83.33 })
  spendPct: number;
}

export class ProjectOverviewTreeResponseDto {
  @ApiProperty({
    example: {
      projectId: '10000000-0000-4000-8000-000000000001',
      projectName: 'Event Launching Q2',
      projectStatus: 'Active',
      cancelledAt: null,
      totalPlan: 50000000,
      totalActual: 45000000,
      variance: 5000000,
      spendPct: 90,
      nodes: [],
    },
  })
  data: {
    projectId: string;
    projectName: string;
    projectStatus: string;
    cancelledAt: Date | null;
    totalPlan: number;
    totalActual: number;
    variance: number;
    spendPct: number;
    nodes: ProjectOverviewTreeNodeDto[];
  };

  @ApiPropertyOptional({ type: ExpensePermissionsDto })
  permissions?: ExpensePermissionsDto;
}

export class ExpenseHistoryItemDto {
  @ApiProperty({ example: 'log_01' })
  id: string;

  @ApiProperty({ example: 'created', enum: ['created', 'updated'] })
  action: 'created' | 'updated' | string;

  @ApiProperty({ example: '2026-09-13T09:00:00.000Z' })
  at: Date | string;

  @ApiPropertyOptional({ example: 'user_01' })
  changedBy?: string | null;

  @ApiPropertyOptional({ example: '2026-09-13', type: String, format: 'date' })
  expenseDate?: string | null;

  @ApiProperty({ description: 'Toàn bộ record + lines[] sau thay đổi' })
  snapshot: any;
}

export class ExpenseHistoryResponseDto {
  @ApiProperty({ type: [ExpenseHistoryItemDto] })
  data: ExpenseHistoryItemDto[];
}


