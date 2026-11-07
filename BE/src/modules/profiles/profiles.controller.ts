import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CollectEventsDto,
  ConfirmIpClusterDto,
  ConvertAnonymousProfileDto,
  CreateCompanyDto,
  CreateLandingPageMappingDto,
  CreateTrackingSiteDto,
  FullIpExportDto,
  HandoverLeadDto,
  IdentifyTrackingDto,
  LeadFromEventSiteDto,
  MergeCompaniesDto,
  MergeLeadsDto,
  RejectIpClusterDto,
  ResolveConflictDto,
  ResolveSlaDto,
  SkipSlaDto,
  ToggleTrackingSiteDto,
  UndoConflictDto,
  UpdateAnonymousAlertDto,
  UpdateCompanyDto,
  UpdateLandingPageMappingDto,
  UpdateLeadDto,
  UpdateTrackingSiteDto,
} from './dto/profiles.dto';
import { ProfilesService } from './profiles.service';

// ============================================================================
// 0. PUBLIC TRACKING INGESTION (/api/v1/tracking/collect, /identify, /t.js)
// ============================================================================
@ApiTags('Public Website Tracking (BDD-02)')
@Controller('v1/tracking')
export class PublicTrackingController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('t.js')
  @ApiOperation({ summary: 'Phục vụ file tracker JS (t.js) nhúng lên website' })
  getTrackerJs(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res
      .status(HttpStatus.OK)
      .send(this.profilesService.getTrackerScriptContent());
  }

  @Post('collect')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Public endpoint nhận batch sự kiện từ t.js (Idempotent theo eventId, lọc bot/internal IP, cookieless mode)',
  })
  async collect(
    @Body() dto: CollectEventsDto,
    @Headers('origin') origin: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-forwarded-for') xForwardedFor: string | undefined,
    @Req() req: Request,
  ) {
    const clientIp =
      xForwardedFor?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const rawSize = req.headers['content-length']
      ? parseInt(String(req.headers['content-length']), 10)
      : JSON.stringify(dto || {}).length;
    return this.profilesService.collectEvents(dto, {
      origin,
      userAgent,
      clientIp,
      rawSize,
    });
  }

  @Post('identify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Endpoint định danh khách từ form/server-to-server (X-MKT-Site-Id + X-MKT-Server-Key)',
  })
  async identify(
    @Body() dto: IdentifyTrackingDto,
    @Headers('x-mkt-site-id') headerSiteId: string | undefined,
    @Headers('x-mkt-server-key') headerServerKey: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-forwarded-for') xForwardedFor: string | undefined,
    @Req() req: Request,
  ) {
    const clientIp =
      xForwardedFor?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    return this.profilesService.identifyVisitor(dto, {
      siteId: headerSiteId,
      serverKey: headerServerKey,
      userAgent,
      clientIp,
    });
  }
}

// ============================================================================
// 0b. PUBLIC LEAD INGESTION FROM EVENT SITE (/api/v1/leads/from-event-site)
// ============================================================================
@ApiTags('Public Lead Ingestion (tonghoplink)')
@Controller('v1/leads')
export class PublicLeadsController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post('from-event-site')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Public endpoint nhận Lead trực tiếp từ Website sự kiện tonghoplink (X-MKT-Site-Id + X-MKT-Server-Key)',
  })
  async createFromEventSite(
    @Body() dto: LeadFromEventSiteDto,
    @Headers('x-mkt-site-id') headerSiteId: string | undefined,
    @Headers('x-mkt-server-key') headerServerKey: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-forwarded-for') xForwardedFor: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const clientIp =
      xForwardedFor?.split(',')[0]?.trim() ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';
    try {
      return await this.profilesService.createLeadFromEventSite(dto, {
        siteId: headerSiteId,
        serverKey: headerServerKey,
        origin,
        userAgent,
        clientIp,
      });
    } catch (err: any) {
      const resp = err?.getResponse?.();
      if (
        err?.getStatus?.() === HttpStatus.TOO_MANY_REQUESTS &&
        resp?.retryAfter &&
        res?.setHeader
      ) {
        res.setHeader('Retry-After', String(resp.retryAfter));
      }
      throw err;
    }
  }
}

// ============================================================================
// 1. HỒ SƠ ẨN DANH (/api/v1/anonymous-profiles)
// ============================================================================
@ApiTags('Anonymous Profiles (BDD-02)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/anonymous-profiles')
export class AnonymousProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'KPI tổng quan Hồ sơ ẩn danh (active, new30d, returning, engagedRate, identitySignals, pendingAlerts, conflicts)',
  })
  async getStats(@Query() query: any) {
    return this.profilesService.getAnonymousStats(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất CSV Hồ sơ ẩn danh (IP/Key đã che)' })
  async exportProfiles(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.profilesService.exportAnonymousProfiles(query, user);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.status(HttpStatus.OK).send(file.buffer);
  }

  @Post('export/full-ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xuất Full IP Hồ sơ ẩn danh (Yêu cầu nhập reason & ghi audit bắt buộc)',
  })
  async exportFullIp(
    @Body() dto: FullIpExportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.profilesService.exportAnonymousProfilesFullIp(
      dto,
      user,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.status(HttpStatus.OK).send(file.buffer);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Danh sách cảnh báo Hồ sơ ẩn danh (website_return, ...)' })
  async getAlerts(@Query() query: any) {
    return this.profilesService.getAnonymousAlerts(query);
  }

  @Patch('alerts/:id')
  @ApiOperation({ summary: 'Cập nhật trạng thái cảnh báo Hồ sơ ẩn danh' })
  async updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAnonymousAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.updateAnonymousAlert(id, dto, user);
  }

  @Post('alerts/:id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận xử lý cảnh báo Hồ sơ ẩn danh' })
  async claimAlert(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.claimAnonymousAlert(id, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ ẩn danh + filter + phân trang' })
  async getList(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getAnonymousProfiles(query, user);
  }

  @Get('conflicts')
  @ApiOperation({ summary: 'Danh sách xung đột định danh' })
  async getConflicts(@Query() query: any) {
    return this.profilesService.getConflicts(query);
  }

  @Post('conflicts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Xử lý xung đột (merge|keep|move|insufficient). Không auto-merge khi 1 key map >= 2 SĐT. Ghi audit.',
  })
  async resolveConflict(
    @Param('id') id: string,
    @Body() dto: ResolveConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.resolveConflict(id, dto, user);
  }

  @Post('conflicts/:id/undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Hoàn tác xử lý xung đột từ undoPayload, khôi phục trạng thái hồ sơ và ghi audit.',
  })
  async undoConflict(
    @Param('id') id: string,
    @Body() dto: UndoConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.undoConflict(id, dto, user);
  }

  @Get('ip-clusters')
  @ApiOperation({ summary: 'Danh sách cụm IP doanh nghiệp' })
  async getIpClusters(@Query() query: any) {
    return this.profilesService.getIpClusters(query);
  }

  @Post('ip-clusters/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận cụm IP doanh nghiệp' })
  async confirmIpCluster(
    @Param('id') id: string,
    @Body() dto: ConfirmIpClusterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.confirmIpCluster(id, dto, user);
  }

  @Post('ip-clusters/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối cụm IP (không merge người)' })
  async rejectIpCluster(
    @Param('id') id: string,
    @Body() dto: RejectIpClusterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.rejectIpCluster(id, dto, user);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Audit trail cho module Hồ sơ ẩn danh' })
  async getAudit(@Query() query: any) {
    return this.profilesService.getAnonymousAudit(query);
  }

  @Get(':id/timeline')
  @ApiOperation({
    summary: 'Timeline sự kiện chi tiết của 1 Hồ sơ ẩn danh (lọc theo type, phân trang)',
  })
  async getTimeline(@Param('id') id: string, @Query() query: any) {
    return this.profilesService.getAnonymousTimeline(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ ẩn danh' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getAnonymousProfileById(id, user);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Chuyển hồ sơ ẩn danh thành Lead định danh. Body: {phone, name, company}. Giữ anonymousId để audit.',
  })
  async convertToLead(
    @Param('id') id: string,
    @Body() dto: ConvertAnonymousProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.convertAnonymousProfile(id, dto, user);
  }
}

// ============================================================================
// 1b. TRACKING SITES (/api/v1/tracking/sites & /api/v1/tracking/landing-pages)
// ============================================================================
@ApiTags('Tracking Sites (BDD-02)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/tracking/sites')
export class TrackingSitesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách site tracking' })
  async getSites() {
    return this.profilesService.getTrackingSites();
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo site tracking mới. Tự sinh siteId, trackingKey, serverKey, snippet',
  })
  async createSite(
    @Body() dto: CreateTrackingSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.createTrackingSite(dto, user);
  }

  @Get(':id/script')
  @ApiOperation({ summary: 'Lấy mã nhúng <script> và thông tin cấu hình của site' })
  async getSiteScript(@Param('id') id: string) {
    return this.profilesService.getTrackingSiteScript(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Bật / tắt site tracking' })
  async toggleSite(
    @Param('id') id: string,
    @Body() dto: ToggleTrackingSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.toggleTrackingSite(id, dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Cập nhật cấu hình site tracking (allowedOrigins, retentionDays, internalCidrs, isActive)',
  })
  async updateSite(
    @Param('id') id: string,
    @Body() dto: UpdateTrackingSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.updateTrackingSite(id, dto, user);
  }

  @Post(':id/rotate-keys')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoay khóa (rotate trackingKey & serverKey) cho site' })
  async rotateKeys(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.rotateTrackingSiteKeys(id, user);
  }
}

@ApiTags('Tracking Landing Pages (BDD-02)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/tracking/landing-pages')
export class LandingPagesTrackingController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách cấu hình mapping Landing Page -> Dự án' })
  async getMappings(@Query() query: any) {
    return this.profilesService.getLandingPageMappings(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo / cập nhật mapping Landing Page -> Dự án' })
  async createMapping(
    @Body() dto: CreateLandingPageMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.createLandingPageMapping(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật mapping Landing Page' })
  async updateMapping(
    @Param('id') id: string,
    @Body() dto: UpdateLandingPageMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.updateLandingPageMapping(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa mapping Landing Page' })
  async deleteMapping(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.deleteLandingPageMapping(id, user);
  }
}

// ============================================================================
// 2. HỒ SƠ ĐỊNH DANH 360 (/api/v1/leads)
// ============================================================================
@ApiTags('Identified Leads 360 (BDD-03)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/leads')
export class Leads360Controller {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('funnel/overview')
  @ApiOperation({ summary: 'Tổng quan funnel theo kỳ' })
  async getFunnelOverview(@Query() query: any) {
    return this.profilesService.getLeadsFunnelOverview(query);
  }

  @Get('returns')
  @ApiOperation({ summary: 'Lead quay lại sau > 90 ngày im lặng' })
  async getReturningLeads(@Query() query: any) {
    return this.profilesService.getReturningLeads(query);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gộp 2 hồ sơ Lead định danh' })
  async mergeLeads(
    @Body() dto: MergeLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.mergeLeads(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Danh sách hồ sơ định danh 360 + filter (funnel, tier, owner, sales, project, isReturn, hasMissingData)',
  })
  async getLeads(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getLeads(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết Lead 360 + journey + score history' })
  async getLeadById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getLeadById(id, user);
  }

  @Post(':id/handover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bàn giao Lead cho Sales. Lưu snapshot handoverScore/tier/at. Raw Lead -> MQL tự động. Ghi audit.',
  })
  async handoverLead(
    @Param('id') id: string,
    @Body() dto: HandoverLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.handoverLead(id, dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Lead 360. Ghi audit trước/sau.' })
  async updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.updateLead(id, dto, user);
  }
}

// ============================================================================
// 3. COMPANY MASTER (/api/v1/companies)
// ============================================================================
@ApiTags('Company Master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/companies')
export class CompaniesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách Company Master (search/industry/city)' })
  async getCompanies(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getCompanies(query, user);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Merge 2 công ty (fromCode -> toCode). Chỉ merge khi MKT xác nhận. Gộp leads/pipeline/won/aliases. Ghi audit.',
  })
  async mergeCompanies(
    @Body() dto: MergeCompaniesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.mergeCompanies(dto, user);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo công ty mới. BE sinh code COMP-XXXXXX' })
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.createCompany(dto, user);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Chi tiết công ty + danh sách lead liên kết' })
  async getCompanyByCode(
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getCompanyByCode(code, user);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Cập nhật thông tin công ty' })
  async updateCompany(
    @Param('code') code: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.updateCompany(code, dto, user);
  }
}

// ============================================================================
// 4. SLA QUEUE (/api/v1/sla-queue)
// ============================================================================
@ApiTags('SLA Queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/sla-queue')
export class SlaQueueController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('export')
  @ApiOperation({ summary: 'Xuất Excel/CSV danh sách Hàng chờ SLA' })
  async exportQueue(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.profilesService.exportSlaQueue(query, user);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.status(HttpStatus.OK).send(file.buffer);
  }

  @Get()
  @ApiOperation({
    summary:
      'Danh sách Hàng chờ SLA + stats (overdue/dueSoon/processing/total/done)',
  })
  async getQueue(
    @Query() query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.getSlaQueue(query, user);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nhận xử lý SLA item (gán cho user hiện tại nếu chưa có)',
  })
  async claimItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.claimSlaItem(id, user);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hoàn tất xử lý SLA item. Body: {note, resolution}' })
  async resolveItem(
    @Param('id') id: string,
    @Body() dto: ResolveSlaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.resolveSlaItem(id, dto, user);
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ qua SLA item. Body: {reason}' })
  async skipItem(
    @Param('id') id: string,
    @Body() dto: SkipSlaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profilesService.skipSlaItem(id, dto, user);
  }
}
