import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CheckBatchCodeQueryDto,
  CheckBatchCodeResponseDto,
  CreateBatchDto,
  CreateInventoryEntryDto,
  CreateInventoryItemDto,
  CreateInventoryTransactionDto,
  GetInventoryItemsQueryDto,
  GetTransactionsQueryDto,
  InventoryBatchListResponseDto,
  InventoryBatchSingleResponseDto,
  InventoryDeleteSuccessResponseDto,
  InventoryEntryResponseDto,
  InventoryItemListResponseDto,
  InventoryItemSingleResponseDto,
  InventoryOverviewResponseDto,
  InventoryTransactionDeleteResponseDto,
  InventoryTransactionsListResponseDto,
  UpdateBatchDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
  }),
)
@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // 1. GET /api/v1/inventory/overview
  @Get('overview')
  @ApiOperation({ summary: 'Lấy số liệu tổng quan kho vật phẩm' })
  @ApiOkResponse({
    description: 'Thống kê tổng quan kho',
    type: InventoryOverviewResponseDto,
  })
  async getOverview() {
    const overview = await this.inventoryService.getOverview();
    return { data: overview };
  }

  // 2. GET /api/v1/inventory/items
  @Get('items')
  @ApiOperation({ summary: 'Lấy danh sách vật phẩm trong kho (có phân trang & lọc)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Mã / tên vật phẩm hoặc mã batch' })
  @ApiQuery({ name: 'receivedFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'receivedTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'batchCode', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'Danh sách vật phẩm',
    type: InventoryItemListResponseDto,
  })
  async getItems(@Query() query: GetInventoryItemsQueryDto) {
    const result = await this.inventoryService.getItems(query);
    return { data: result };
  }

  // 3. GET /api/v1/inventory/items/{id}
  @Get('items/:id')
  @ApiOperation({ summary: 'Chi tiết một vật phẩm kèm các lô hàng' })
  @ApiOkResponse({
    description: 'Chi tiết vật phẩm',
    type: InventoryItemSingleResponseDto,
  })
  async getItem(@Param('id') id: string) {
    const item = await this.inventoryService.getItem(id);
    return { data: item };
  }

  // 4. POST /api/v1/inventory/items
  @Post('items')
  @ApiOperation({ summary: 'Tạo mới vật phẩm trong kho' })
  @ApiCreatedResponse({
    description: 'Vật phẩm vừa tạo',
    type: InventoryItemSingleResponseDto,
  })
  async createItem(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const item = await this.inventoryService.createItem(dto, user.id);
    return { data: item };
  }

  // 5. PATCH /api/v1/inventory/items/{id}
  @Patch('items/:id')
  @ApiOperation({ summary: 'Cập nhật thông tin vật phẩm' })
  @ApiOkResponse({
    description: 'Vật phẩm sau khi cập nhật',
    type: InventoryItemSingleResponseDto,
  })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const item = await this.inventoryService.updateItem(id, dto, user.id);
    return { data: item };
  }

  // 6. DELETE /api/v1/inventory/items/{id}
  @Delete('items/:id')
  @ApiOperation({ summary: 'Xóa mềm vật phẩm (kèm các batch liên quan)' })
  @ApiOkResponse({
    description: 'Kết quả xóa mềm',
    type: InventoryDeleteSuccessResponseDto,
  })
  async deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.inventoryService.deleteItem(id, user.id);
    return { data: res };
  }

  // 7. GET /api/v1/inventory/items/{id}/batches
  @Get('items/:id/batches')
  @ApiOperation({ summary: 'Lấy danh sách các lô hàng (batches) của một vật phẩm' })
  @ApiOkResponse({
    description: 'Danh sách batch của vật phẩm',
    type: InventoryBatchListResponseDto,
  })
  async getItemBatches(@Param('id') id: string) {
    const batches = await this.inventoryService.getItemBatches(id);
    return { data: Array.isArray(batches) ? batches : batches ? [batches] : [] };
  }

  // 8. POST /api/v1/inventory/items/{id}/batches
  @Post('items/:id/batches')
  @ApiOperation({ summary: 'Tạo lô hàng mới cho vật phẩm' })
  @ApiCreatedResponse({
    description: 'Lô hàng vừa tạo',
    type: InventoryBatchSingleResponseDto,
  })
  async createBatch(
    @Param('id') id: string,
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const batch = await this.inventoryService.createBatch(id, dto, user.id);
    return { data: batch };
  }

  // 8b. GET /api/v1/inventory/batches/check-code?code=&excludeId=
  // Static route, declared before any `batches/:id` route so it is never captured as an id.
  @Get('batches/check-code')
  @ApiOperation({
    summary: 'Kiểm tra mã batch đã tồn tại chưa (bỏ khoảng trắng, không phân biệt hoa thường)',
  })
  @ApiQuery({ name: 'code', required: true, type: String })
  @ApiQuery({ name: 'excludeId', required: false, type: String })
  @ApiOkResponse({
    description: 'Kết quả kiểm tra mã batch',
    type: CheckBatchCodeResponseDto,
  })
  async checkBatchCode(@Query() query: CheckBatchCodeQueryDto) {
    const result = await this.inventoryService.checkBatchCode(query.code, query.excludeId);
    // Spec contract is `{ exists, itemName }`; `data` kept for the module's usual envelope
    return { ...result, data: result };
  }

  // 9. PATCH /api/v1/inventory/batches/{id}
  @Patch('batches/:id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @ApiOperation({ summary: 'Cập nhật thông tin lô hàng' })
  @ApiOkResponse({
    description: 'Lô hàng sau khi cập nhật',
    type: InventoryBatchSingleResponseDto,
  })
  async updateBatch(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const batch = await this.inventoryService.updateBatch(id, dto, user.id);
    return { data: batch };
  }

  // 9b. POST /api/v1/inventory/recalculate
  @Post('recalculate')
  @ApiOperation({ summary: 'Tính lại số lượng tồn kho của toàn bộ lô hàng theo lịch sử giao dịch xuất kho' })
  async recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('itemId') itemIdQuery?: string,
    @Query('batchId') batchIdQuery?: string,
    @Body() body?: { itemId?: string; batchId?: string },
  ) {
    const itemId = itemIdQuery || body?.itemId;
    const batchId = batchIdQuery || body?.batchId;
    return this.inventoryService.recalculateAllBatches(user.id, { itemId, batchId });
  }

  // 10. DELETE /api/v1/inventory/batches/{id}
  @Delete('batches/:id')
  @ApiOperation({ summary: 'Xóa mềm một lô hàng' })
  @ApiOkResponse({
    description: 'Kết quả xóa mềm batch',
    type: InventoryDeleteSuccessResponseDto,
  })
  async deleteBatch(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.inventoryService.deleteBatch(id, user.id);
    return { data: res };
  }

  // 11. POST /api/v1/inventory/entries
  @Post('entries')
  @ApiOperation({ summary: 'Tạo phiếu nhập kho (tạo batch + ghi transaction + tính lại tồn kho)' })
  @ApiCreatedResponse({
    description: 'Kết quả phiếu nhập kho',
    type: InventoryEntryResponseDto,
  })
  async createEntry(
    @Body() dto: CreateInventoryEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const entry = await this.inventoryService.createEntry(dto, user.id);
    return { data: entry };
  }

  // 12. GET /api/v1/inventory/transactions
  @Get('transactions')
  @ApiOperation({ summary: 'Lịch sử xuất / nhập kho' })
  @ApiQuery({ name: 'itemId', required: false, type: String })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'batchId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiOkResponse({
    description: 'Danh sách giao dịch kho',
    type: InventoryTransactionsListResponseDto,
  })
  async getTransactions(@Query() query: GetTransactionsQueryDto) {
    const transactions = await this.inventoryService.getTransactions(query);
    return { data: transactions };
  }

  // 13. POST /api/v1/inventory/transactions
  @Post('transactions')
  @ApiOperation({ summary: 'Tạo giao dịch xuất/nhập kho (xuất cho dự án trừ tồn kho)' })
  @ApiCreatedResponse({
    description: 'Kết quả tạo giao dịch kho',
  })
  async createTransaction(
    @Body() dto: CreateInventoryTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.inventoryService.createTransaction(dto, user.id);
    return { data: res };
  }

  // 14. DELETE /api/v1/inventory/transactions/{id}
  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Xóa giao dịch kho (tự động hoàn tác tồn kho)' })
  @ApiOkResponse({
    description: 'Kết quả xóa giao dịch kho và hoàn tác tồn kho',
    type: InventoryTransactionDeleteResponseDto,
  })
  async deleteTransaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.inventoryService.deleteTransaction(id, user.id);
    return { data: res };
  }
}
