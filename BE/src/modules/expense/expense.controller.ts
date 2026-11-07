import { inlineContentDisposition, sendStoredFile } from '../../common/storage/file-storage';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AnnualOverviewTreeResponseDto,
  CancelExpenseLineDto,
  CreateExpenseLineDto,
  ExpenseActualDetailResponseDto,
  ExpenseActualsPaginationResponseDto,
  ExpenseLineActionResponseDto,
  ExpenseLineDto,
  ExpenseOverviewResponseDto,
  ExpenseRecordDto,
  ExpenseRecordResponseDto,
  ProjectOverviewTreeResponseDto,
  QueryActualExpensesDto,
  SaveExpenseRecordDto,
  SaveSystemConfigDto,
  UpdateExpenseDto,
  UpdateExpenseLineDto,
  ExpenseHistoryResponseDto,
} from './dto/expense.dto';
import { getExpensePermissions } from './expense-permissions.helper';
import { ExpenseService } from './expense.service';

@ApiTags('Expenses')
@Controller('v1/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  private getBaseUrl(req: Request): string {
    const appUrl =
      process.env.APP_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL;
    if (appUrl) {
      return appUrl.replace(/\/+$/, '');
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${protocol}://${host}`;
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lưu hoặc tạo mới bản ghi chi phí tháng của dự án' })
  @ApiCreatedResponse({
    description: 'Bản ghi chi phí sau khi lưu',
    type: ExpenseRecordResponseDto,
  })
  async saveExpense(
    @Body() dto: SaveExpenseRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const record = await this.expenseService.saveExpense(dto, user.id);
    return {
      ...record,
      data: record,
      permissions: getExpensePermissions(user),
    };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy danh sách chi phí theo bộ lọc' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({
    name: 'recognizedDate',
    required: false,
    type: String,
    description: 'Ngày ghi nhận chi phí (YYYY-MM-DD)',
  })
  async getExpenses(
    @Query('projectId') projectId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('recognizedDate') recognizedDate?: string,
    @Req() req?: Request,
  ) {
    const parsedMonth = month ? parseInt(month, 10) : undefined;
    const parsedYear = year ? parseInt(year, 10) : undefined;
    const baseUrl = req ? this.getBaseUrl(req) : undefined;
    return this.expenseService.getExpenses(
      projectId,
      parsedMonth,
      parsedYear,
      baseUrl,
      recognizedDate,
    );
  }

  // --- SYSTEM CONFIGS & OVERVIEW & REPORTS ---

  @Post('system-configs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async saveSystemConfig(
    @Body() dto: SaveSystemConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseService.saveSystemConfig(dto, user.id);
  }

  @Get('system-configs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiQuery({
    name: 'key',
    required: false,
    enum: ['churn_rate', 'gross_margin'],
  })
  async getSystemConfigHistory(
    @Query('key') key?: 'churn_rate' | 'gross_margin',
  ) {
    return this.expenseService.getSystemConfigHistory(key);
  }

  @Get('overview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.manager)
  @ApiOperation({
    summary:
      'Lấy tổng quan chi phí theo kỳ (totalExpense, wonValue, roas, cac, ltv...)',
  })
  @ApiOkResponse({
    description: 'Báo cáo tổng quan chi phí',
    type: ExpenseOverviewResponseDto,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Format: YYYY, YYYY-MM, YYYY-QX (Mặc định: tháng hiện tại)',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Chỉ tính chi phí, won deal, MQL/SQL của dự án này (CAC/ROAS theo dự án)',
  })
  async getOverview(
    @Query('period') period?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.expenseService.getOverview(period, projectId?.trim() || undefined);
  }

  @Get('report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.manager)
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Format: YYYY, YYYY-MM, YYYY-QX (Mặc định: tháng hiện tại)',
  })
  @ApiQuery({ name: 'projectId', required: false, description: 'Chỉ tính dự án này' })
  async getReports(
    @Query('period') period?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.expenseService.getReports(period, projectId?.trim() || undefined);
  }

  // --- ACTUALS & DRILL-DOWN ---

  @Get('actuals')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy danh sách các khoản chi phí thực tế (phẳng, có phân trang và lọc)' })
  @ApiOkResponse({
    description: 'Danh sách chi phí thực tế phân trang',
    type: ExpenseActualsPaginationResponseDto,
  })
  async getActualExpenses(
    @Query() query: QueryActualExpensesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.getActualExpenses(query, user, baseUrl);
  }

  @Get('actuals/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Chi tiết một khoản chi phí thực tế (phục vụ drill-down từ số liệu tổng hợp)' })
  @ApiOkResponse({
    description: 'Chi tiết khoản chi phí thực tế',
    type: ExpenseActualDetailResponseDto,
  })
  async getActualExpenseDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.getActualExpenseDetail(id, user, baseUrl);
  }

  @Post('lines/:id/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xác nhận khoản chi phí (chuyển Draft sang Confirmed)' })
  @ApiOkResponse({
    description: 'Khoản chi phí sau khi xác nhận',
    type: ExpenseLineActionResponseDto,
  })
  async confirmExpenseLine(
    @Param('id') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.confirmExpenseLine(lineId, user, baseUrl);
  }

  @Post('lines/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Hủy khoản chi phí đã xác nhận (kèm lý do)' })
  @ApiOkResponse({
    description: 'Khoản chi phí sau khi hủy',
    type: ExpenseLineActionResponseDto,
  })
  async cancelExpenseLine(
    @Param('id') lineId: string,
    @Body() dto: CancelExpenseLineDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.cancelExpenseLine(lineId, dto, user, baseUrl);
  }

  @Get('overview/tree/annual')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy cây chi phí kế hoạch năm kèm số thực chi, còn lại và tỉ lệ tiêu ngân sách' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiOkResponse({
    description: 'Cây chi phí kế hoạch năm',
    type: AnnualOverviewTreeResponseDto,
  })
  async getAnnualOverviewTree(
    @Query('year') year: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!year || isNaN(Number(year))) {
      throw new BadRequestException('Năm (year) là bắt buộc và phải là số hợp lệ.');
    }
    return this.expenseService.getAnnualOverviewTree(Number(year), user);
  }

  @Get('overview/tree/annual/:year')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy cây chi phí kế hoạch năm kèm số thực chi, còn lại và tỉ lệ tiêu ngân sách (qua param)' })
  @ApiParam({ name: 'year', required: true, type: Number })
  @ApiOkResponse({
    description: 'Cây chi phí kế hoạch năm',
    type: AnnualOverviewTreeResponseDto,
  })
  async getAnnualOverviewTreeByParam(
    @Param('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const numYear = Number(year);
    if (!year || isNaN(numYear)) {
      throw new BadRequestException('Năm (year) là bắt buộc và phải là số hợp lệ.');
    }
    return this.expenseService.getAnnualOverviewTree(numYear, user);
  }

  @Get('overview/tree/project')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy cây chi phí kế hoạch dự án kèm số thực chi, chênh lệch và phát sinh ngoài kế hoạch' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiOkResponse({
    description: 'Cây chi phí kế hoạch dự án',
    type: ProjectOverviewTreeResponseDto,
  })
  async getProjectOverviewTree(
    @Query('projectId') projectId: string,
    @Query('year') year: number | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new BadRequestException('projectId là bắt buộc.');
    }
    return this.expenseService.getProjectOverviewTree(
      projectId.trim(),
      year ? Number(year) : undefined,
      user,
    );
  }

  @Get('overview/tree/project/:projectId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy cây chi phí kế hoạch dự án kèm số thực chi, chênh lệch và phát sinh ngoài kế hoạch (qua param)' })
  @ApiParam({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiOkResponse({
    description: 'Cây chi phí kế hoạch dự án',
    type: ProjectOverviewTreeResponseDto,
  })
  async getProjectOverviewTreeByParam(
    @Param('projectId') projectId: string,
    @Query('year') year: number | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new BadRequestException('projectId là bắt buộc.');
    }
    return this.expenseService.getProjectOverviewTree(
      projectId.trim(),
      year ? Number(year) : undefined,
      user,
    );
  }

  // --- EXPENSE LINES ---

  @Patch('lines/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Cập nhật dòng chi phí' })
  async updateExpenseLine(
    @Param('id') lineId: string,
    @Body() dto: UpdateExpenseLineDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.updateExpenseLine(lineId, dto, user.id, baseUrl);
  }

  @Delete('lines/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xóa dòng chi phí (Soft delete)' })
  async deleteExpenseLine(
    @Param('id') lineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseService.deleteExpenseLine(lineId, user.id);
  }

  @Post('lines/:id/attachment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Tải lên hợp đồng / hóa đơn đính kèm cho dòng chi phí (PDF, PNG, JPG)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLineAttachment(
    @Param('id') lineId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    return this.expenseService.uploadLineAttachment(
      lineId,
      file,
      user.id,
      baseUrl,
    );
  }

  @Get('lines/:id/attachment')
  @ApiOperation({
    summary:
      'Xem hoặc tải file hợp đồng / hóa đơn đính kèm của dòng chi phí (mở trực tiếp)',
  })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/octet-stream',
  )
  async getLineAttachment(
    @Param('id') lineId: string,
    @Res() res: Response,
  ) {
    const { filePath, buffer, fileName, mimeType } =
      await this.expenseService.getLineAttachmentFile(lineId);

    res.setHeader('Content-Disposition', inlineContentDisposition(fileName));
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    return sendStoredFile(res, { localPath: filePath, buffer });
  }

  // --- PARAMETERIZED EXPENSE RECORD ROUTES (:id) ---

  @Get(':id/history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Lấy lịch sử các phiên bản sửa đổi của bản ghi chi phí (Audit snapshot)',
  })
  @ApiParam({ name: 'id', required: true, description: 'ID bản ghi chi phí' })
  @ApiOkResponse({
    description: 'Lịch sử phiên bản sửa đổi của bản ghi sắp xếp cũ đến mới (at ASC)',
    type: ExpenseHistoryResponseDto,
  })
  async getExpenseHistory(@Param('id') id: string) {
    return this.expenseService.getExpenseHistory(id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy chi tiết bản ghi chi phí và các dòng chi phí' })
  @ApiOkResponse({
    description: 'Chi tiết bản ghi chi phí',
    type: ExpenseRecordDto,
  })
  async getExpense(@Param('id') id: string, @Req() req?: Request) {
    const baseUrl = req ? this.getBaseUrl(req) : undefined;
    return this.expenseService.getExpense(id, baseUrl);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Cập nhật bản ghi chi phí' })
  async updateExpense(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseService.updateExpense(id, dto, user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xóa bản ghi chi phí (Soft delete)' })
  async removeExpense(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenseService.removeExpense(id, user.id);
  }

  @Post(':id/lines')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Thêm dòng chi phí mới vào bản ghi' })
  @ApiCreatedResponse({
    description: 'Dòng chi phí vừa tạo',
    type: ExpenseLineDto,
  })
  async createExpenseLine(
    @Param('id') expenseId: string,
    @Body() dto: CreateExpenseLineDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const rawHeaderKey =
      req?.headers?.['idempotency-key'] ?? req?.headers?.['x-idempotency-key'];
    const headerKey = Array.isArray(rawHeaderKey)
      ? rawHeaderKey[0]
      : rawHeaderKey;
    if (
      headerKey &&
      typeof headerKey === 'string' &&
      headerKey.trim() &&
      dto &&
      !dto.idempotencyKey &&
      !dto.clientRequestId
    ) {
      dto.idempotencyKey = headerKey.trim();
    }
    return this.expenseService.createExpenseLine(
      expenseId,
      dto,
      user.id,
      baseUrl,
    );
  }
}
