import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CategoryBudgetService } from './category-budget.service';

@ApiTags('Expense Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['expense-categories', 'v1/expense-categories', 'v1/categories', 'categories'])
export class ExpenseCategoriesController {
  constructor(private readonly budgetService: CategoryBudgetService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hạng mục ngân sách cấp cao nhất' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getCategories(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : undefined;
    return await this.budgetService.getCategories(y);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Lấy bảng tổng hợp chi phí hạng mục từ các dòng chi phí dự án',
  })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({
    name: 'project_id',
    required: false,
    type: String,
    description: 'Lọc theo ID dự án',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'Lọc theo ID dự án',
  })
  async getSummary(
    @Query('year') year?: string,
    @Query('project_id') projectIdSnake?: string,
    @Query('projectId') projectIdCamel?: string,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    const targetProject = projectIdSnake || projectIdCamel;
    return await this.budgetService.getCategorySummaryReport(y, targetProject);
  }
}
