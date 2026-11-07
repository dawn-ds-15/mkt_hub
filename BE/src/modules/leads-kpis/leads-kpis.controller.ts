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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { LeadsKpisService } from './leads-kpis.service';
import {
  SaveKpiPlanDto,
  SaveMonthlyKpiPlanDto,
  GetWeeklyKpisDto,
  SaveWeeklyKpisDto,
  SavePriorYearDealsDto,
  AnalysisQueryDto,
  ComparisonQueryDto,
  GetClosedDealsDto,
  UpdateClosedDealDto,
  CreateOpportunityDto,
  UpdateOpportunityDto,
  MarkOpportunityWonDto,
  CreateEventDto,
  GetEventsDto,
  UpdateEventDto,
} from './dto/leads-kpis.dto';
import {
  SaveProjectKpiPlanDto,
  SaveDailyActualDto,
  UpdateDailyActualByIdDto,
  QueryDailyActualDto,
  QueryDailyReportDto,
  QueryKpiProgressDto,
} from './dto/leads-kpis-daily.dto';

@ApiTags('Leads & KPIs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/leads-kpis')
export class LeadsKpisController {
  constructor(private readonly leadsKpisService: LeadsKpisService) {}

  @Post('plan')
  async savePlan(
    @Body() dto: SaveKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.savePlan(dto, user.id);
  }

  @Get('plan/:year/months')
  async getMonthlyPlan(@Param('year') year: string) {
    return this.leadsKpisService.getMonthlyPlan(parseInt(year, 10));
  }

  @Get('plan/:year')
  async getPlan(@Param('year') year: string) {
    return this.leadsKpisService.getPlan(parseInt(year, 10));
  }

  // --- SEPTEMBER SPEC: ANNUAL ALLOCATION & PROJECT KPI ---
  @Get('annual-allocation')
  async getAnnualAllocation(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : 2026;
    return this.leadsKpisService.getAnnualAllocation(y);
  }

  @Get('kpi-plans/annual')
  async getAnnualKpiPlanSpec(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : 2026;
    return this.leadsKpisService.getPlan(y);
  }

  @Put('kpi-plans/annual')
  async saveAnnualKpiPlanSpec(
    @Body() dto: SaveKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.savePlan(dto, user.id);
  }

  @Put('kpi-plans/annual/:year')
  async saveAnnualKpiPlanWithYearSpec(
    @Param('year') year: string,
    @Body() dto: SaveKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.savePlan(
      { ...dto, year: parseInt(year, 10) },
      user.id,
    );
  }

  @Get('projects/:projectId/kpi')
  async getProjectKpiPlan(
    @Param('projectId') projectId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    return this.leadsKpisService.getProjectKpiPlan(projectId, y);
  }

  @Put('projects/:projectId/kpi')
  async saveProjectKpiPlan(
    @Param('projectId') projectId: string,
    @Body() dto: SaveProjectKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveProjectKpiPlan(projectId, dto, user.id);
  }

  @Get('projects/:projectId/kpi-plan')
  async getProjectKpiPlanSpec(
    @Param('projectId') projectId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    return this.leadsKpisService.getProjectKpiPlan(projectId, y);
  }

  @Put('projects/:projectId/kpi-plan')
  async saveProjectKpiPlanSpec(
    @Param('projectId') projectId: string,
    @Body() dto: SaveProjectKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveProjectKpiPlan(projectId, dto, user.id);
  }

  @Put('projects/:projectId/kpi-plan/:year')
  async saveProjectKpiPlanWithYearSpec(
    @Param('projectId') projectId: string,
    @Param('year') year: string,
    @Body() dto: SaveProjectKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveProjectKpiPlan(projectId, dto, user.id);
  }

  // --- SEPTEMBER SPEC: DAILY ACTUALS ---
  @Get('projects/:projectId/actual')
  async getDailyActual(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
    @Query() query?: QueryDailyActualDto,
  ) {
    if (date) {
      return this.leadsKpisService.getDailyActual(projectId, date);
    }
    return this.leadsKpisService.getDailyActualsForProject(projectId, query);
  }

  @Post('projects/:projectId/actual')
  async saveDailyActual(
    @Param('projectId') projectId: string,
    @Body() dto: SaveDailyActualDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveDailyActual(projectId, dto, user.id);
  }

  @Patch('projects/:projectId/actual/:actualId')
  async updateDailyActualById(
    @Param('projectId') projectId: string,
    @Param('actualId') actualId: string,
    @Body() dto: UpdateDailyActualByIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.updateDailyActualById(
      projectId,
      actualId,
      dto,
      user.id,
    );
  }

  @Delete('projects/:projectId/actual/:actualId')
  async deleteDailyActualById(
    @Param('projectId') projectId: string,
    @Param('actualId') actualId: string,
  ) {
    return this.leadsKpisService.deleteDailyActualById(projectId, actualId);
  }

  // Aliases for daily-actual / kpi-actuals
  @Get('projects/:projectId/kpi-actuals')
  async getProjectKpiActualsSpec(
    @Param('projectId') projectId: string,
    @Query() query: QueryDailyActualDto,
  ) {
    return this.leadsKpisService.getDailyActualsForProject(projectId, query);
  }

  @Post('projects/:projectId/kpi-actuals')
  async saveProjectKpiActualsPostSpec(
    @Param('projectId') projectId: string,
    @Body() dto: SaveDailyActualDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveDailyActual(projectId, dto, user.id);
  }

  @Put('projects/:projectId/kpi-actuals/:date')
  async saveProjectKpiActualsPutSpec(
    @Param('projectId') projectId: string,
    @Param('date') date: string,
    @Body() dto: SaveDailyActualDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveDailyActual(
      projectId,
      { ...dto, actualDate: date },
      user.id,
    );
  }

  @Get('projects/:projectId/daily-actual')
  async getDailyActualAlias(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
    @Query() query?: QueryDailyActualDto,
  ) {
    if (date) {
      return this.leadsKpisService.getDailyActual(projectId, date);
    }
    return this.leadsKpisService.getDailyActualsForProject(projectId, query);
  }

  @Post('projects/:projectId/daily-actual')
  async saveDailyActualAlias(
    @Param('projectId') projectId: string,
    @Body() dto: SaveDailyActualDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveDailyActual(projectId, dto, user.id);
  }

  @Get('daily-actuals')
  async getDailyActualsList(@Query() query: QueryDailyActualDto) {
    return this.leadsKpisService.getDailyActualsList(query);
  }

  @Get('projects/:projectId/progress')
  async getProjectKpiProgress(
    @Param('projectId') projectId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year, 10) : 2026;
    return this.leadsKpisService.getProjectKpiProgress(projectId, y);
  }

  // --- SEPTEMBER SPEC: REPORTS DERIVED FROM DAILY ACTUALS ---
  @Get('reports/weekly')
  async getWeeklyReportFromDaily(@Query() query: QueryDailyReportDto) {
    const week = query.week || 1;
    return this.leadsKpisService.getWeeklyReportFromDaily(
      query.year,
      week,
      query.projectId,
    );
  }

  @Get('reports/monthly')
  async getMonthlyReportFromDaily(@Query() query: QueryDailyReportDto) {
    const month = query.month || 1;
    return this.leadsKpisService.getMonthlyReportFromDaily(
      query.year,
      month,
      query.projectId,
    );
  }

  @Put('plan/:year/months')
  async saveMonthlyPlan(
    @Param('year') year: string,
    @Body() dto: SaveMonthlyKpiPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveMonthlyPlan(parseInt(year, 10), dto, user.id);
  }

  @Post('plan/:year/apply-monthly-total')
  async applyMonthlyTotal(
    @Param('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.applyMonthlyTotal(parseInt(year, 10), user.id);
  }

  @Get('weekly')
  async getWeeklyData(@Query() query: GetWeeklyKpisDto) {
    return this.leadsKpisService.getWeeklyData(
      query.year,
      query.week,
      query.projectId,
      query.month,
    );
  }

  @Post('weekly')
  async saveWeeklyData(
    @Body() dto: SaveWeeklyKpisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.saveWeeklyData(dto, user.id);
  }

  @Post('events')
  async createEvent(@Body() dto: CreateEventDto) {
    return this.leadsKpisService.createEvent(dto);
  }

  @Get('events')
  async getEvents(@Query() query: GetEventsDto) {
    return this.leadsKpisService.getEvents(query);
  }

  @Patch('events/:id')
  async updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.leadsKpisService.updateEvent(id, dto);
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    return this.leadsKpisService.deleteEvent(id);
  }

  @Get('opportunities')
  async getOpportunities(@Query('projectId') projectId?: string) {
    return this.leadsKpisService.getOpportunities(projectId);
  }

  @Get('pipeline-by-segment')
  async getPipelineBySegment(
    @Query('period_type') period_type?: 'week' | 'month' | 'quarter' | 'year',
    @Query('periodType') periodType?: 'week' | 'month' | 'quarter' | 'year',
    @Query('period_value') period_value?: string,
    @Query('periodValue') periodValue?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('week') week?: string,
    @Query('projectId') projectId?: string,
    @Query('project_id') project_id?: string,
  ) {
    const finalType = periodType || period_type || (month ? 'month' : week ? 'week' : 'year');
    const finalValue = periodValue || period_value || (month ? String(month) : week ? String(week) : '1');
    const finalYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const finalProjectId = projectId || project_id;

    return this.leadsKpisService.getPipelineBySegmentData(
      finalType,
      finalValue,
      finalYear,
      finalProjectId,
    );
  }

  @Post('opportunities')
  async createOpportunity(
    @Body() dto: CreateOpportunityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.createOpportunity(dto, user.id);
  }

  @Patch('opportunities/:id')
  @Put('opportunities/:id')
  async updateOpportunity(
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.leadsKpisService.updateOpportunity(id, dto);
  }

  @Post('opportunities/:id/won')
  async markOpportunityWon(
    @Param('id') id: string,
    @Body() dto: MarkOpportunityWonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.markOpportunityWon(id, user.id, dto);
  }

  @Post('prior-year-deals')
  async savePriorYearDeals(
    @Body() dto: SavePriorYearDealsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.savePriorYearDeals(dto, user.id);
  }

  @Get('analysis')
  async getAnalysis(@Query() query: AnalysisQueryDto) {
    return this.leadsKpisService.getAnalysis(query);
  }

  @Get('comparison')
  async getComparison(@Query() query: ComparisonQueryDto) {
    return this.leadsKpisService.getComparison(query);
  }

  @Get('closed-deals')
  async getClosedDeals(@Query() query: GetClosedDealsDto) {
    return this.leadsKpisService.getClosedDeals(query);
  }

  @Put('closed-deals/:id')
  async updateClosedDeal(
    @Param('id') id: string,
    @Body() dto: UpdateClosedDealDto,
  ) {
    return this.leadsKpisService.updateClosedDeal(id, dto);
  }

  @Delete('closed-deals/:id')
  @Delete('closed-deals/:id/delete')
  async deleteClosedDeal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.deleteClosedDeal(id, user?.id);
  }

  @Delete('opportunities/:id')
  async deleteOpportunity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsKpisService.deleteOpportunity(id, user?.id);
  }
}
