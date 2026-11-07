import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiReportDto } from './dto/leads-kpis.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/ai')
export class AiController {
  @Post('report')
  async generateOrSaveReport(@Body() body: AiReportDto) {
    return {
      success: true,
      message: 'Xử lý báo cáo AI thành công.',
      data: {
        data: body.data,
        years: body.years,
        periodType: body.periodType,
        periodValue: body.periodValue,
        insights: body.insights || [
          'Xu hướng KPI tăng trưởng ổn định qua các chu kỳ.',
          'Cần tối ưu hóa chi phí direct cost cho dự án hiện tại.',
        ],
      },
    };
  }
}
