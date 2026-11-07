import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CategoryBudgetService } from './category-budget.service';
import { BudgetDashboardDataDto } from './dto/category-budget.dto';
import {
  QueryBudgetDashboardDto,
  QueryBudgetSummaryDto,
  SaveBudgetPayloadDto,
} from './dto/budgets.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetService: CategoryBudgetService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Lấy bảng tổng hợp ngân sách 12 tháng theo cây phân cấp',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'ID dự án hoặc "all"',
    example: 'all',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Năm báo cáo',
    example: 2026,
  })
  async getSummary(@Query() query: QueryBudgetSummaryDto) {
    const year = Number(query.year) || 2026;
    return await this.budgetService.getBudgetSummary(query.projectId, year);
  }

  @Put(':projectId/:year')
  @ApiOperation({
    summary: 'Lưu / cập nhật ngân sách theo dự án và năm',
  })
  @ApiParam({
    name: 'projectId',
    type: String,
    description: 'ID dự án hoặc "all"',
    example: 'all',
  })
  @ApiParam({
    name: 'year',
    type: Number,
    description: 'Năm báo cáo',
    example: 2026,
  })
  async saveBudget(
    @Param('projectId') projectId: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() payload: SaveBudgetPayloadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.saveBudgetByProjectAndYear(
      projectId,
      year,
      payload.items,
      user.id,
    );
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Lấy các chỉ số tổng quan ngân sách cho Dashboard',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'ID dự án hoặc "all"',
    example: 'all',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Năm báo cáo',
    example: 2026,
  })
  @ApiResponse({
    status: 200,
    type: BudgetDashboardDataDto,
    description: 'Chỉ số tổng quan ngân sách Dashboard (4 thẻ + categories)',
  })
  async getDashboard(@Query() query: QueryBudgetDashboardDto) {
    const year = Number(query.year) || 2026;
    return await this.budgetService.getBudgetDashboard(query.projectId, year);
  }
}
