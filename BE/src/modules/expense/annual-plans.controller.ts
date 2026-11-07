import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnnualPlansService } from './annual-plans.service';
import {
  ActivateAnnualPlanDto,
  AnnualPlanListResponseDto,
  AnnualPlanSingleResponseDto,
  AnnualPlanTreeResponseDto,
  BulkUpdateAnnualPlanItemsDto,
  CreateAnnualPlanDto,
  CreateAnnualPlanItemNodeDto,
} from './dto/annual-plans.dto';

@ApiTags('Annual Expense Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/annual-plans')
export class AnnualPlansController {
  constructor(private readonly annualPlansService: AnnualPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các bản kế hoạch năm' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiOkResponse({
    description: 'Danh sách kế hoạch năm',
    type: AnnualPlanListResponseDto,
  })
  async getAnnualPlans(@Query('year') year?: number, @Req() req?: any) {
    return this.annualPlansService.getAnnualPlans(
      year ? Number(year) : undefined,
      req?.user,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Tạo một bản kế hoạch năm mới (trạng thái Draft)' })
  @ApiCreatedResponse({
    description: 'Kế hoạch năm vừa tạo',
    type: AnnualPlanSingleResponseDto,
  })
  async createAnnualPlan(@Body() dto: CreateAnnualPlanDto, @Req() req?: any) {
    return this.annualPlansService.createAnnualPlan(dto, req?.user);
  }

  @Get('active')
  @ApiOperation({ summary: 'Lấy bản kế hoạch năm đang Active' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiOkResponse({
    description: 'Kế hoạch năm đang Active',
    type: AnnualPlanSingleResponseDto,
  })
  async getActiveAnnualPlan(@Query('year') year: number, @Req() req?: any) {
    return this.annualPlansService.getActiveAnnualPlan(Number(year), req?.user);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: 'Lấy toàn bộ cây chi phí 3 cấp và ngân sách của một bản kế hoạch' })
  @ApiOkResponse({
    description: 'Toàn bộ cây chi phí và ngân sách của kế hoạch',
    type: AnnualPlanTreeResponseDto,
  })
  async getAnnualPlanTree(@Param('id') id: string, @Req() req?: any) {
    return this.annualPlansService.getAnnualPlanTree(id, req?.user);
  }

  @Put(':id/items')
  @ApiOperation({ summary: 'Nhập ngân sách cho các hạng mục chi tiết (level 3)' })
  @ApiOkResponse({
    description: 'Cây chi phí sau khi cập nhật ngân sách',
    type: AnnualPlanTreeResponseDto,
  })
  async updateAnnualPlanItems(
    @Param('id') id: string,
    @Body() dto: BulkUpdateAnnualPlanItemsDto,
    @Req() req?: any,
  ) {
    return this.annualPlansService.updateAnnualPlanItems(id, dto, req?.user);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Kích hoạt bản kế hoạch năm (chuyển Draft sang Active)' })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description: 'ETag hoặc version kế hoạch (ví dụ "v1" hoặc "1") để kiểm tra xung đột',
  })
  @ApiOkResponse({
    description: 'Kế hoạch sau khi kích hoạt',
    type: AnnualPlanSingleResponseDto,
  })
  async activateAnnualPlan(
    @Param('id') id: string,
    @Body() dto?: ActivateAnnualPlanDto,
    @Headers('if-match') ifMatch?: string,
    @Req() req?: any,
  ) {
    return this.annualPlansService.activateAnnualPlan(id, dto, ifMatch, req?.user);
  }

  @Post(':id/nodes')
  @ApiOperation({ summary: 'Thêm một node vào cây chi phí (dành cho Draft)' })
  @ApiCreatedResponse({
    description: 'Node chi phí vừa thêm',
  })
  async addItemNode(
    @Param('id') id: string,
    @Body() dto: CreateAnnualPlanItemNodeDto,
  ) {
    return this.annualPlansService.addItemNode(id, dto);
  }
}

