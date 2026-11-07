import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SaveWeeklyLogDto, WeeklyReportQueryDto } from './dto/task.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@ApiTags('Weekly Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/weekly-reports')
export class WeeklyReportsController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Get()
  getReport(@Query() query: WeeklyReportQueryDto) {
    return this.weeklyReportsService.getReport(query);
  }

  @Post('logs')
  saveLog(
    @Body() dto: SaveWeeklyLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.weeklyReportsService.saveLog(dto, user.id);
  }

  @Get('export.txt')
  async exportText(
    @Query() query: WeeklyReportQueryDto,
    @Res() response: Response,
  ) {
    const text = await this.weeklyReportsService.exportText(query);
    response
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="weekly-report-${query.year}-W${query.week}.txt"`,
      )
      .send(text);
  }
}
