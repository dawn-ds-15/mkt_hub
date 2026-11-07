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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateProjectDto,
  CreateProjectResponseDto,
  ProjectResponseDto,
  UpdateProjectDto,
} from './dto/project.dto';
import {
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  UpdateStakeholderOptionsDto,
} from './dto/checklist-template.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('checklist-templates')
  @ApiOperation({ summary: 'Lấy danh sách template checklist sự kiện' })
  getTemplates() {
    return this.projectsService.getChecklistTemplates();
  }

  @Put('checklist-templates/stakeholder-options')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({ summary: 'Cập nhật danh sách stakeholder options' })
  updateStakeholderOptions(@Body() dto: UpdateStakeholderOptionsDto) {
    return this.projectsService.updateStakeholderOptions(dto);
  }

  @Post('checklist-templates')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({ summary: 'Tạo mẫu checklist mới' })
  createChecklistTemplate(@Body() dto: CreateChecklistTemplateDto) {
    return this.projectsService.createChecklistTemplate(dto);
  }

  @Put('checklist-templates/:key')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({ summary: 'Cập nhật/ghi đè toàn bộ mẫu checklist' })
  updateChecklistTemplate(
    @Param('key') key: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    return this.projectsService.updateChecklistTemplate(key, dto);
  }

  @Delete('checklist-templates/:key')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({ summary: 'Xoá mẫu checklist' })
  deleteChecklistTemplate(@Param('key') key: string) {
    return this.projectsService.deleteChecklistTemplate(key);
  }


  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả dự án' })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Lọc theo loại dự án (Exhibition, Event, Workshop, Webinar, ...)',
  })
  @ApiOkResponse({
    description: 'Danh sách dự án',
    type: [ProjectResponseDto],
  })
  findAll(@Query('type') type?: string) {
    return this.projectsService.findAll(type);
  }

  @Get(':id/expense-summary')
  @ApiOperation({
    summary: 'Tổng chi phí kế hoạch / thực tế của dự án (snapshot chi phí mới nhất)',
  })
  @ApiOkResponse({
    description: '{ plannedBeforeVat, plannedAfterVat, actualBeforeVat, actualAfterVat }',
  })
  getExpenseSummary(@Param('id') id: string) {
    return this.projectsService.getExpenseSummary(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết dự án' })
  @ApiOkResponse({
    description: 'Chi tiết dự án',
    type: ProjectResponseDto,
  })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới dự án' })
  @ApiCreatedResponse({
    description: 'Dự án vừa tạo',
    type: CreateProjectResponseDto,
  })
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin dự án' })
  @ApiOkResponse({
    description: 'Dự án sau khi cập nhật',
    type: ProjectResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, dto, user?.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa mềm (lưu trữ) dự án' })
  @ApiOkResponse({
    description: 'Kết quả xóa dự án',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Lưu trữ (Soft delete) project thành công' },
      },
    },
  })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.remove(id, user.id);
  }
}
