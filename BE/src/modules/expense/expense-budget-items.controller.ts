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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CategoryBudgetService } from './category-budget.service';
import {
  CreateBudgetItemDto,
  QueryBudgetItemDto,
  UpdateBudgetItemDto,
} from './dto/category-budget.dto';

@ApiTags('Expense Budget Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/expense-budget-items')
export class ExpenseBudgetItemsController {
  constructor(private readonly budgetService: CategoryBudgetService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách dòng chi tiết ngân sách' })
  @ApiQuery({ name: 'subcategoryId', required: false, type: String })
  async getItems(@Query() query: QueryBudgetItemDto) {
    const data = await this.budgetService.getItems(query.subcategoryId);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới dòng chi tiết ngân sách' })
  async createItem(
    @Body() dto: CreateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.createItem(dto, user.id);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật dòng chi tiết ngân sách' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.updateItem(id, dto, user.id);
    return { data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa dòng chi tiết ngân sách (Soft-delete)' })
  async deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.budgetService.deleteItem(id, user.id);
    return { data };
  }
}
