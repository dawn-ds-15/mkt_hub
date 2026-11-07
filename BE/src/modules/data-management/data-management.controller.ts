import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateMemberDto,
  UpdateMemberDto,
  SaveSlackConfigDto,
  ResetSandboxDto,
  BulkImportConfirmDto,
  UpdateDropdownDto,
  CreateDropdownOptionDto,
  UpdateDropdownOptionDto,
} from './dto/data-management.dto';
import { DataManagementService } from './data-management.service';

@ApiTags('Data Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/data-management')
export class DataManagementController {
  constructor(private readonly dataService: DataManagementService) {}

  // --- TEAM MEMBERS (Manager only) ---
  @Get('members')
  async getMembers() {
    return this.dataService.getMembers();
  }

  @Roles(Role.manager)
  @Post('members')
  async createMember(
    @Body() dto: CreateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.createMember(dto, user.id);
  }

  @Roles(Role.manager)
  @Put('members/:id')
  async updateMember(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.updateMember(id, dto, user.id);
  }

  @Roles(Role.manager)
  @Delete('members/:id')
  async removeMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.removeMember(id, user.id);
  }

  // --- DROPDOWN CONFIG (Manager only) ---
  @Get('dropdowns')
  async getDropdowns() {
    return this.dataService.getDropdowns();
  }

  @Roles(Role.manager)
  @Put('dropdowns/:key')
  async updateDropdown(
    @Param('key') key: string,
    @Body() dto: UpdateDropdownDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.updateDropdown(key, dto.values, user.id);
  }

  @Roles(Role.manager)
  @Post('dropdowns/:key/options')
  async createDropdownOption(
    @Param('key') key: string,
    @Body() dto: CreateDropdownOptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.createDropdownOption(key, dto, user.id);
  }

  @Roles(Role.manager)
  @Patch('dropdowns/:key/options/:optionId')
  async updateDropdownOption(
    @Param('key') key: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateDropdownOptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.updateDropdownOption(key, optionId, dto, user.id);
  }

  @Roles(Role.manager)
  @Delete('dropdowns/:key/options/:optionId')
  async deleteDropdownOption(
    @Param('key') key: string,
    @Param('optionId') optionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.deleteDropdownOption(key, optionId, user.id);
  }

  @Get('dropdowns/:key/options/:optionId/impact')
  async getDropdownOptionImpact(
    @Param('key') key: string,
    @Param('optionId') optionId: string,
  ) {
    return this.dataService.getDropdownOptionImpact(key, optionId);
  }

  // --- SLACK SETTINGS (Manager only) ---
  @Get('slack/config')
  async getSlackConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.dataService.getSlackConfig(user.role);
  }

  @Roles(Role.manager)
  @Post('slack/config')
  async saveSlackConfig(
    @Body() dto: SaveSlackConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.saveSlackConfig(dto, user.id);
  }

  @Roles(Role.manager)
  @Post('slack/test')
  async testSlackWebhook(@CurrentUser() user: AuthenticatedUser) {
    return this.dataService.testSlackWebhook(user.id);
  }

  @Roles(Role.manager)
  @Get('slack/logs')
  async getSlackLogs() {
    return this.dataService.getSlackLogs();
  }

  // --- BULK IMPORT (Manager + Specialist) ---
  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx) hoặc CSV dữ liệu import',
        },
      },
    },
  })
  @ApiQuery({ name: 'type', enum: ['task', 'kpi', 'deal'] })
  @ApiQuery({
    name: 'confirm',
    type: Boolean,
    required: false,
    description: 'true = lưu vào DB ngay trong 1 step, false = chỉ preview',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: 'task' | 'kpi' | 'deal',
    @Query('confirm') confirm?: string | boolean,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Vui lòng upload file.');
    const isCsv = file.originalname.endsWith('.csv');
    const result = await this.dataService.parseImportFile(file.buffer, type, isCsv);
    if (String(confirm) === 'true') {
      if (result.errors.length > 0) {
        throw new BadRequestException({
          message: 'File còn dòng không hợp lệ; chưa được import vào database',
          errors: result.errors,
        });
      }
      const confirmDto: BulkImportConfirmDto = {
        importType: type,
        rows: result.allRows.map((r: any) => r.data),
      };
      const confirmResult = await this.dataService.importConfirm(
        confirmDto,
        user?.id || 'system',
      );
      return {
        ...result,
        confirmResult,
        createdRows: result.validRows,
      };
    }
    return result;
  }

  @Post('import/confirm')
  async importConfirm(
    @Body() dto: BulkImportConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.importConfirm(dto, user.id);
  }

  @Get('import/template')
  @ApiQuery({ name: 'type', enum: ['task', 'kpi', 'deal'] })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'File Excel mẫu import',
    schema: { type: 'string', format: 'binary' },
  })
  async downloadTemplate(
    @Query('type') type: 'task' | 'kpi' | 'deal',
    @Res() res: Response,
  ) {
    const workbook = await this.dataService.generateTemplate(type);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${type}_template.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  // --- EXPORTS (Manager + Specialist) ---
  @Get('export/pdf')
  @ApiQuery({ name: 'year', type: Number })
  @ApiQuery({ name: 'week', type: Number })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 200,
    description: 'File PDF báo cáo tuần',
    schema: { type: 'string', format: 'binary' },
  })
  async exportPdf(
    @Query('year') year: string,
    @Query('week') week: string,
    @Query('projectId') projectId: string,
    @Query('memberId') memberId: string,
    @Res() res: Response,
  ) {
    const pdfDoc = await this.dataService.exportPdfWeeklyReport(
      parseInt(year, 10),
      parseInt(week, 10),
      projectId,
      memberId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=weekly_report_W${week}.pdf`);
    pdfDoc.pipe(res);
  }

  @Get('export/excel')
  @ApiQuery({ name: 'year', type: Number })
  @ApiQuery({ name: 'period', description: 'Format: YYYY, YYYY-MM, YYYY-QX' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'File Excel báo cáo dashboard',
    schema: { type: 'string', format: 'binary' },
  })
  async exportExcel(
    @Query('year') year: string,
    @Query('period') period: string,
    @Res() res: Response,
  ) {
    const workbook = await this.dataService.exportExcelDashboard(parseInt(year, 10), period);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=dashboard_report_${period}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  @Roles(Role.manager)
  @Get('export/full')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'File Excel xuất toàn bộ dữ liệu hệ thống',
    schema: { type: 'string', format: 'binary' },
  })
  async exportFull(@Res() res: Response) {
    const workbook = await this.dataService.exportFullData();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=mkthub_full_data.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  }

  // --- BACKUP & RESTORE (Manager only) ---
  @Roles(Role.manager)
  @Get('backups')
  async getBackups() {
    return this.dataService.getBackups();
  }

  @Roles(Role.manager)
  @Post('backups/create')
  async createBackup(@CurrentUser() user: AuthenticatedUser) {
    return this.dataService.createBackup(user.id);
  }

  @Roles(Role.manager)
  @Delete('backups/:id')
  async deleteBackup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.deleteBackup(id, user.id);
  }

  @Roles(Role.manager)
  @Post('backups/restore')
  @UseInterceptors(FileInterceptor('file'))
  async restoreBackup(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new Error('Vui lòng upload file backup.');
    return this.dataService.restoreBackup(file.buffer, user.id);
  }

  @Roles(Role.manager)
  @Post('reset')
  async resetSandbox(
    @Body() dto: ResetSandboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dataService.resetSandbox(dto, user.id);
  }

  // --- AUDIT LOGS (Manager only) ---
  @Roles(Role.manager)
  @Get('audit-logs')
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dataService.getAuditLogs(
      userId,
      action,
      entityType,
      startDate,
      endDate,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
