import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Optional link from a batch to a level-1 budget category (BE_requirement_26_09_26 §4).
 * `undefined` = not sent (leave unchanged), `null` = clear the link.
 */
export class BatchExpenseCategoryFieldsDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
    description: 'ID nhóm hạng mục ngân sách cấp 1 (null = bỏ liên kết)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID('all', { message: 'expenseCategoryId phải là UUID hợp lệ.' })
  expenseCategoryId?: string | null;

  @ApiPropertyOptional({
    example: 'EVENT',
    nullable: true,
    description: 'Tên nhóm hạng mục ngân sách (tự lấy theo expenseCategoryId nếu không gửi)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'expenseCategoryName phải là chuỗi.' })
  @MaxLength(255)
  expenseCategoryName?: string | null;
}

export class CreateBatchDto extends BatchExpenseCategoryFieldsDto {
  @ApiProperty({ example: 'BAT-202608-01' })
  @IsString()
  @IsNotEmpty()
  batchCode: string;

  @ApiProperty({ example: '2026-08-21' })
  @IsString()
  @IsNotEmpty()
  receivedDate: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityIn: number;

  @ApiPropertyOptional({ example: 50000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceBeforeVat?: number;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 55000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Xưởng in Kim Long' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'HD-2026-KL-01' })
  @IsOptional()
  @IsString()
  contractCode?: string;

  @ApiPropertyOptional({ example: 'Hàng quà tặng sự kiện đợt 1' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateInventoryItemDto extends BatchExpenseCategoryFieldsDto {
  @ApiProperty({ example: 'POSM-BAN-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Banner đứng cuốn nhôm' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'posm', enum: ['posm', 'gift', 'print', 'uniform'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'cái' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minThreshold?: number;

  @ApiPropertyOptional({ example: 'BAT-202608-01' })
  @IsOptional()
  @IsString()
  batchCode?: string;

  @ApiPropertyOptional({ example: '2026-08-29' })
  @IsOptional()
  @IsString()
  receivedDate?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityIn?: number;

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
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Nhà cung cấp ABC' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'HD-2026-01' })
  @IsOptional()
  @IsString()
  contractCode?: string;

  @ApiPropertyOptional({ example: 'Ghi chú nhập kho ban đầu' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: () => CreateBatchDto })
  @IsOptional()
  initialBatch?: CreateBatchDto;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ example: 'POSM-BAN-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Banner đứng cuốn nhôm 80x200' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'posm' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'cái' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner_new.png' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minThreshold?: number;
}

export class UpdateBatchDto extends BatchExpenseCategoryFieldsDto {
  @ApiPropertyOptional({ example: 'BAT-202608-01' })
  @IsOptional()
  @IsString()
  batchCode?: string;

  @ApiPropertyOptional({ example: '2026-08-21' })
  @IsOptional()
  @IsString()
  receivedDate?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityIn?: number;

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
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 55000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Xưởng in Kim Long' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'HD-2026-KL-01' })
  @IsOptional()
  @IsString()
  contractCode?: string;

  @ApiPropertyOptional({ example: 'Cập nhật ghi chú lô hàng' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateInventoryEntryDto extends BatchExpenseCategoryFieldsDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: '2026-08-21' })
  @IsString()
  @IsNotEmpty()
  receivedDate: string;

  @ApiProperty({ example: 'BAT-202608-02' })
  @IsString()
  @IsNotEmpty()
  batchCode: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 50000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceBeforeVat?: number;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ example: 55000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceAfterVat?: number;

  @ApiPropertyOptional({ example: 55000 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Nhà cung cấp ABC' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ example: 'HD-ABC-01' })
  @IsOptional()
  @IsString()
  contractCode?: string;

  @ApiPropertyOptional({ example: 'Nhập bổ sung sự kiện tháng 8' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class GetInventoryItemsQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã, tên vật phẩm hoặc mã batch' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc vật phẩm có batch nhập từ ngày (YYYY-MM-DD, bao gồm)',
    example: '2026-07-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'receivedFrom phải có định dạng YYYY-MM-DD.',
  })
  receivedFrom?: string;

  @ApiPropertyOptional({
    description: 'Lọc vật phẩm có batch nhập đến ngày (YYYY-MM-DD, bao gồm)',
    example: '2026-07-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'receivedTo phải có định dạng YYYY-MM-DD.',
  })
  receivedTo?: string;

  @ApiPropertyOptional({
    description: 'Lọc vật phẩm có batch chứa mã này (không phân biệt hoa thường)',
    example: 'VOUCHER-072026',
  })
  @IsOptional()
  @IsString()
  batchCode?: string;

  @ApiPropertyOptional({ description: 'Danh mục: posm, gift, print' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Trạng thái tồn: instock, low, out' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class CreateInventoryTransactionDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @ValidateIf((o) => !o.inventoryItemId)
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Alias for itemId',
  })
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    description: 'Batch cụ thể cần hoàn stock (nếu type = in). Nếu thiếu sẽ auto tìm/tạo',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiProperty({ example: 'out', enum: ['in', 'out'] })
  @IsEnum(['in', 'out'])
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: '2026-08-21' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-08-21', description: 'Alias for date' })
  @IsOptional()
  @IsString()
  expenseDate?: string;

  @ApiPropertyOptional({
    example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    nullable: true,
    description: 'ID hạng mục ngân sách tuỳ chọn khi xuất kho',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  expenseCategoryId?: string | null;

  @ApiPropertyOptional({
    example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    nullable: true,
    description: 'Alias for expenseCategoryId',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'Dùng cho sự kiện X' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class GetTransactionsQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo ID vật phẩm' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID dự án' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID batch' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Loại giao dịch: in, out' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class CheckBatchCodeQueryDto {
  @ApiProperty({ description: 'Mã batch cần kiểm tra', example: 'VOUCHER-072026-004' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã batch cần kiểm tra.' })
  code: string;

  @ApiPropertyOptional({ description: 'Bỏ qua batch đang sửa' })
  @IsOptional()
  @IsString()
  excludeId?: string;
}

// --- RESPONSE DTOS FOR SWAGGER ---

export class InventoryOverviewDto {
  @ApiProperty({ example: 125000000 })
  totalValue: number;

  @ApiProperty({ example: 0 })
  totalValueTrend: number;

  @ApiProperty({ example: 3 })
  lowStockCount: number;

  @ApiProperty({ example: 0 })
  incomingCount: number;

  @ApiProperty({ example: 'tuần này' })
  incomingNote: string;

  @ApiProperty({ example: 12 })
  activeBatches: number;

  @ApiProperty({
    example: 172152870,
    description: 'Σ quantityIn × unitPriceAfterVat của các batch chưa xoá',
  })
  totalImportValue: number;

  @ApiProperty({ example: 1250, description: 'Σ currentStock của các batch chưa xoá' })
  totalStock: number;
}

export class InventoryOverviewResponseDto {
  @ApiProperty({ type: InventoryOverviewDto })
  data: InventoryOverviewDto;
}

export class InventoryBatchDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  id: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  itemId: string;

  @ApiProperty({ example: 'BAT-202608-01' })
  batchCode: string;

  @ApiProperty({ example: '2026-08-21' })
  receivedDate: string;

  @ApiProperty({ example: 100 })
  quantityIn: number;

  @ApiProperty({ example: 80 })
  currentStock: number;

  @ApiProperty({ example: 55000 })
  unitPrice: number;

  @ApiProperty({ example: 50000 })
  unitPriceBeforeVat: number;

  @ApiProperty({ example: 10 })
  vatRate: number;

  @ApiProperty({ example: 55000 })
  unitPriceAfterVat: number;

  @ApiPropertyOptional({ example: 'Xưởng in Kim Long' })
  supplier?: string | null;

  @ApiPropertyOptional({ example: 'HD-2026-KL-01' })
  contractCode?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú lô hàng' })
  note?: string | null;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', nullable: true })
  expenseCategoryId: string | null;

  @ApiProperty({ example: 'EVENT', nullable: true })
  expenseCategoryName: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: null })
  archivedAt?: Date | null;
}

export class InventoryItemDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'POSM-BAN-01' })
  code: string;

  @ApiProperty({ example: 'Banner đứng cuốn nhôm' })
  name: string;

  @ApiProperty({ example: 'posm' })
  category: string;

  @ApiProperty({ example: 'cái' })
  unit: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
  image?: string | null;

  @ApiPropertyOptional({ example: 10 })
  minThreshold?: number | null;

  @ApiProperty({ example: 80 })
  totalStock: number;

  @ApiProperty({ example: 55000 })
  avgUnitPrice: number;

  @ApiProperty({ example: 50000 })
  unitPriceBeforeVat: number;

  @ApiProperty({ example: 10 })
  vatRate: number;

  @ApiProperty({ example: 55000 })
  unitPriceAfterVat: number;

  @ApiProperty({ example: 'instock', enum: ['instock', 'low', 'out'] })
  status: string;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: null })
  archivedAt?: Date | null;

  @ApiPropertyOptional({ type: [InventoryBatchDto] })
  batches?: InventoryBatchDto[];
}

export class InventoryItemListDataDto {
  @ApiProperty({ type: [InventoryItemDto] })
  items: InventoryItemDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class InventoryItemListResponseDto {
  @ApiProperty({ type: InventoryItemListDataDto })
  data: InventoryItemListDataDto;
}

export class InventoryItemSingleResponseDto {
  @ApiProperty({ type: InventoryItemDto })
  data: InventoryItemDto;
}

export class InventoryBatchListResponseDto {
  @ApiProperty({ type: [InventoryBatchDto] })
  data: InventoryBatchDto[];
}

export class InventoryBatchSingleResponseDto {
  @ApiProperty({ type: InventoryBatchDto })
  data: InventoryBatchDto;
}

export class InventoryTransactionDto {
  @ApiProperty({ example: 't0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  id: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  itemId: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  batchId?: string | null;

  @ApiProperty({ example: 'in', enum: ['in', 'out'] })
  type: string;

  @ApiProperty({ example: 50 })
  quantity: number;

  @ApiProperty({ example: 60000 })
  unitPrice: number;

  @ApiProperty({ example: 3000000 })
  totalAmount: number;

  @ApiPropertyOptional({ example: 'Nhập kho' })
  reason?: string | null;

  @ApiPropertyOptional({ example: 'Nhập bổ sung sự kiện' })
  note?: string | null;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  createdAt: Date;
}

export class InventoryEntryResultDto {
  @ApiProperty({ type: InventoryBatchDto })
  batch: InventoryBatchDto;

  @ApiProperty({ type: InventoryTransactionDto })
  transaction: InventoryTransactionDto;

  @ApiProperty({ type: InventoryItemDto })
  item: InventoryItemDto;
}

export class InventoryEntryResponseDto {
  @ApiProperty({ type: InventoryEntryResultDto })
  data: InventoryEntryResultDto;
}

export class InventoryTransactionsListResponseDto {
  @ApiProperty({ type: [InventoryTransactionDto] })
  data: InventoryTransactionDto[];
}

export class InventoryDeleteSuccessDataDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class InventoryDeleteSuccessResponseDto {
  @ApiProperty({ type: InventoryDeleteSuccessDataDto })
  data: InventoryDeleteSuccessDataDto;
}

export class InventoryTransactionDeleteDataDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  itemId: string;

  @ApiProperty({ example: 'out' })
  type: string;

  @ApiProperty({ example: 5 })
  quantity: number;

  @ApiProperty({ example: true })
  deleted: boolean;
}

export class InventoryTransactionDeleteResponseDto {
  @ApiProperty({ type: InventoryTransactionDeleteDataDto })
  data: InventoryTransactionDeleteDataDto;
}

export class InventoryBatchAttachmentDto {
  @ApiProperty({ example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  id: string;

  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  batchId: string;

  @ApiProperty({ example: 'Hoá đơn nhập kho.pdf' })
  name: string;

  @ApiProperty({ example: 102400 })
  size: number;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  mimeType: string | null;

  @ApiProperty({
    example:
      'https://mkt-hub.onrender.com/api/v1/inventory/attachments/d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44/file',
  })
  url: string;

  @ApiPropertyOptional({ example: 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', nullable: true })
  uploadedBy: string | null;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  uploadedAt: Date;
}

export class InventoryBatchAttachmentListResponseDto {
  @ApiProperty({ type: [InventoryBatchAttachmentDto] })
  data: InventoryBatchAttachmentDto[];
}

export class CheckBatchCodeResultDto {
  @ApiProperty({ example: true })
  exists: boolean;

  @ApiPropertyOptional({ example: 'VOUCHER GIẤY 100.000', nullable: true })
  itemName: string | null;
}

export class CheckBatchCodeResponseDto {
  @ApiProperty({ type: CheckBatchCodeResultDto })
  data: CheckBatchCodeResultDto;
}
