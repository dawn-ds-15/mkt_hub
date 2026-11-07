import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getOverview(periodType, periodValue, year, projectId);
  }

  @Get('kpi-cards')
  async getKpiCards(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getKpiCardsData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
  }

  @Get('funnel')
  async getFunnel(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getFunnelData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
  }

  @Get('activities')
  async getActivities(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getActivitiesData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
  }

  @Get('progress')
  async getProgress(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getProgressData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
  }

  @Get('task-status')
  async getTaskStatus(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    return this.dashboardService.getTaskStatusData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
  }

  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getAlertsData();
  }

  @Get('pipeline-by-segment')
  async getPipelineBySegment(@Query() query: OverviewQueryDto) {
    const { periodType, periodValue, year, projectId } = query.getNormalized();
    const data = await this.dashboardService.getPipelineBySegmentData(
      periodType,
      periodValue,
      parseInt(year, 10),
      projectId,
    );
    return { data };
  }
}
