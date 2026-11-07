import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectExpensePlanService } from './project-expense-plan.service';
import {
  ProjectExpensePlanResponseDto,
  SaveProjectExpensePlanDto,
} from './dto/project-expense-plan.dto';

@ApiTags('Project Expense Plan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/projects/:projectId/expense-plan')
export class ProjectExpensePlanController {
  constructor(
    private readonly projectExpensePlanService: ProjectExpensePlanService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy kế hoạch chi phí và tiến độ thực chi của dự án' })
  @ApiOkResponse({
    description: 'Kế hoạch chi phí và tiến độ thực chi của dự án',
    type: ProjectExpensePlanResponseDto,
  })
  async getProjectExpensePlan(
    @Param('projectId') projectId: string,
    @Req() req?: any,
  ) {
    return this.projectExpensePlanService.getProjectExpensePlan(
      projectId,
      req?.user,
    );
  }

  @Put()
  @ApiOperation({ summary: 'Lưu hoặc cập nhật toàn bộ kế hoạch chi phí dự án' })
  @ApiOkResponse({
    description: 'Kế hoạch chi phí dự án sau khi lưu',
    type: ProjectExpensePlanResponseDto,
  })
  async saveProjectExpensePlan(
    @Param('projectId') projectId: string,
    @Body() dto: SaveProjectExpensePlanDto,
    @Req() req?: any,
  ) {
    return this.projectExpensePlanService.saveProjectExpensePlan(
      projectId,
      dto,
      req?.user,
    );
  }
}

