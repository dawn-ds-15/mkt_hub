import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CategoryBudgetService } from './category-budget.service';
import {
  BudgetBulkSaveResponseDto,
  BudgetByProjectResponseDto,
  BudgetCategoryListResponseDto,
  BudgetCellValidationFailedResponseDto,
  BudgetDashboardResponseDto,
  BudgetTreeResponseDto,
  BudgetVersionConflictResponseDto,
  BulkSaveBudgetValuesDto,
  CreateBudgetCategoryDto,
  CreateBudgetSubcategoryDto,
  QueryBudgetCategoryDto,
  QueryBudgetSubcategoryDto,
  QueryBudgetValuesDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetSubcategoryDto,
} from './dto/category-budget.dto';

@ApiTags('Expense Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['v1/expense-budgets', 'v1/category-budget', 'v1/budget'])
export class CategoryBudgetController {
  constructor(private readonly budgetService: CategoryBudgetService) {}

  // ==========================================
  // 1. CATEGORIES
  // ==========================================

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách hạng mục ngân sách cấp cao nhất' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: BudgetCategoryListResponseDto,
    description: 'Danh sách hạng mục ngân sách cấp cao nhất kèm phân quyền',
  })
  async getCategories(
    @Query() query: QueryBudgetCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.getCategories(query.year);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo mới hạng mục ngân sách cấp cao nhất' })
  async createCategory(
    @Body() dto: CreateBudgetCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.createCategory(dto, user.id);
    return { data };
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Cập nhật hạng mục ngân sách' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.updateCategory(id, dto, user.id);
    return { data };
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Xóa hạng mục ngân sách (Soft-delete)' })
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.deleteCategory(id, user.id);
    return { data };
  }

  // ==========================================
  // 2. SUBCATEGORIES
  // ==========================================

  @Get('subcategories')
  @ApiOperation({ summary: 'Lấy danh sách hạng mục con' })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  async getSubcategories(@Query() query: QueryBudgetSubcategoryDto) {
    const data = await this.budgetService.getSubcategories(query.categoryId);
    return { data };
  }

  @Post('subcategories')
  @ApiOperation({ summary: 'Tạo mới hạng mục con' })
  async createSubcategory(
    @Body() dto: CreateBudgetSubcategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.createSubcategory(dto, user.id);
    return { data };
  }

  @Patch('subcategories/:id')
  @ApiOperation({ summary: 'Cập nhật hạng mục con' })
  async updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetSubcategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.updateSubcategory(id, dto, user.id);
    return { data };
  }

  @Delete('subcategories/:id')
  @ApiOperation({ summary: 'Xóa hạng mục con (Soft-delete)' })
  async deleteSubcategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.deleteSubcategory(id, user.id);
    return { data };
  }

  // ==========================================
  // 3. BUDGET TREE & VALUES
  // ==========================================

  @Get('values')
  @ApiOperation({ summary: 'Lấy toàn bộ cây ngân sách kèm giá trị 12 tháng' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án' })
  @ApiResponse({
    status: 200,
    type: BudgetTreeResponseDto,
    description: 'Cây ngân sách kèm giá trị 12 tháng, updatedAt và phân quyền',
  })
  async getValues(
    @Query() query: QueryBudgetValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const year = query.year || 2026;
    const data = await this.budgetService.getBudgetTree(year, query.projectId);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Put('values')
  @ApiOperation({ summary: 'Bulk save toàn bộ giá trị ngân sách 12 tháng' })
  @ApiResponse({
    status: 200,
    type: BudgetBulkSaveResponseDto,
    description: 'Lưu ngân sách 12 tháng thành công',
  })
  @ApiResponse({
    status: 400,
    type: BudgetCellValidationFailedResponseDto,
    description: 'Có ô không hợp lệ (lỗi validation per-cell)',
  })
  @ApiResponse({
    status: 412,
    type: BudgetVersionConflictResponseDto,
    description: 'Xung đột phiên bản dữ liệu (Optimistic Concurrency Conflict)',
  })
  async bulkSaveValues(
    @Body() dto: BulkSaveBudgetValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.bulkSaveValues(dto, user.id);
    return {
      ...data,
      data,
    };
  }

  @Get('by-project')
  @ApiOperation({ summary: 'Lấy tổng ngân sách theo từng dự án' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiResponse({
    status: 200,
    type: BudgetByProjectResponseDto,
    description: 'Tổng ngân sách theo từng dự án',
  })
  async getByProject(
    @Query('year') year?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    const data = await this.budgetService.getBudgetByProject(y);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Get('export-excel')
  @ApiOperation({ summary: 'Xuất file Excel ngân sách marketing' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'Lọc theo ID dự án hoặc all',
  })
  async exportExcel(
    @Query('year') year: string,
    @Query('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    const buffer = await this.budgetService.exportBudgetExcel(y, projectId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ngan-sach-mkt-${y}.xlsx`,
    );
    res.end(buffer);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Lấy full tree cấu trúc phân cấp ngân sách' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án' })
  @ApiResponse({
    status: 200,
    type: BudgetTreeResponseDto,
    description: 'Cây phân cấp ngân sách kèm giá trị 12 tháng, updatedAt và phân quyền',
  })
  async getTree(
    @Query() query: QueryBudgetValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const year = query.year || 2026;
    // §3 (BE_requirement_29_09_26): + virtual groups { id: null, unassigned: true } for costs outside the tree
    const data = await this.budgetService.getBudgetTree(year, query.projectId, {
      includeUnassigned: true,
    });
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Get('actuals')
  @ApiOperation({ summary: 'Lấy dữ liệu chi phí thực tế 12 tháng theo category_id' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án hoặc all' })
  async getActuals(
    @Query('year') year?: string,
    @Query('projectId') projectId?: string,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    return await this.budgetService.getCategoryBudgetActuals(y, projectId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Lấy các chỉ số tổng quan ngân sách cho Dashboard' })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án hoặc all' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiResponse({
    status: 200,
    type: BudgetDashboardResponseDto,
    description: 'Tổng quan ngân sách (4 thẻ + categories) kèm phân quyền',
  })
  async getDashboard(
    @Query() query: QueryBudgetValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const year = Number(query.year) || 2026;
    const data = await this.budgetService.getBudgetDashboard(query.projectId, year);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Báo cáo tổng hợp chi phí hạng mục từ các dòng chi phí dự án' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án' })
  @ApiQuery({ name: 'project_id', required: false, type: String, description: 'Lọc theo ID dự án (snake_case alias)' })
  async getCategorySummary(
    @Query('year') year?: string,
    @Query('projectId') projectId?: string,
    @Query('project_id') projectIdSnake?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    const targetProject = projectId || projectIdSnake;
    const data = await this.budgetService.getCategorySummaryReport(y, targetProject);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }

  @Get('report')
  @ApiOperation({ summary: 'Báo cáo tổng hợp Plan vs Actual động theo Hạng mục' })
  @ApiQuery({ name: 'projectId', required: false, type: String, description: 'Lọc theo ID dự án' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 9 })
  async getCategoryReport(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('projectId') projectId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    const m = month ? parseInt(month, 10) : undefined;
    const data = await this.budgetService.getCategoryBudgetReport(y, m, projectId);
    const permissions = this.budgetService.getBudgetPermissions(user);
    return { data, permissions };
  }
}

