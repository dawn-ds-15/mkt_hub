import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ConvertAnonymousProfileDto {
  @ApiProperty({ example: '0901234567', description: 'Số điện thoại định danh' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Nguyễn Văn Minh', description: 'Họ tên Lead' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Công ty Cổ phần Công nghệ FPT',
    description: 'Tên công ty',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: 'minh.nv@fpt.com.vn' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Giám đốc CNTT' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '0101248141' })
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional({ example: 'fpt.com.vn' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Cờ auto-merge (bị chặn nếu 1 key map >= 2 SĐT)' })
  @IsOptional()
  @IsBoolean()
  autoMerge?: boolean;
}

export class ResolveConflictDto {
  @ApiProperty({
    enum: ['merge', 'keep', 'move', 'insufficient'],
    example: 'keep',
    description:
      'Hành động xử lý xung đột: merge | keep | move | insufficient. Không auto-merge khi 1 key map >= 2 SĐT.',
  })
  @IsString()
  @IsIn(['merge', 'keep', 'move', 'insufficient'])
  action: 'merge' | 'keep' | 'move' | 'insufficient';

  @ApiPropertyOptional({ example: 'ANON-884210' })
  @IsOptional()
  @IsString()
  primaryProfileId?: string;

  @ApiPropertyOptional({ example: 'cookieId' })
  @IsOptional()
  @IsString()
  moveKey?: string;

  @ApiPropertyOptional({ example: 'Hai nhân sự dùng chung máy tính văn phòng, giữ tách biệt 2 hồ sơ.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoMerge?: boolean;
}

export class ConfirmIpClusterDto {
  @ApiPropertyOptional({ example: 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'COMP-000102' })
  @IsOptional()
  @IsString()
  companyCode?: string;

  @ApiPropertyOptional({ example: 'Xác nhận dải IP văn phòng Hội sở Quang Trung' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectIpClusterDto {
  @ApiPropertyOptional({ example: 'IP động của nhà mạng Viettel, không phải IP tĩnh doanh nghiệp' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTrackingSiteDto {
  @ApiProperty({ example: 'Landing Page Giải pháp Cloud 2026' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'cloud.mkthub.vn' })
  @IsString()
  domain: string;
}

export class ToggleTrackingSiteDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class HandoverLeadDto {
  @ApiPropertyOptional({ example: 'sales-01' })
  @IsOptional()
  @IsString()
  salesId?: string;

  @ApiProperty({ example: 'Trần Quốc Bảo (Sales Enterprise)' })
  @IsString()
  salesName: string;

  @ApiPropertyOptional({ example: 'Khách đã xem bảng giá 3 lần và tải tài liệu kỹ thuật, cần gọi ngay trong sáng nay.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  funnel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  funnelStage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sales?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salesId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salesName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  project?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isReturn?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasMissingData?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class MergeLeadsDto {
  @ApiProperty({ example: 'LEAD-2026-002' })
  @IsString()
  fromLeadId: string;

  @ApiProperty({ example: 'LEAD-2026-001' })
  @IsString()
  toLeadId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Công ty Cổ phần Giải pháp Số VNPAY' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: [String], example: ['VNPAY', 'VNPay JSC'] })
  @IsOptional()
  @IsArray()
  aliases?: string[];

  @ApiPropertyOptional({ example: '0102182292' })
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional({ example: 'vnpay.vn' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ example: 'https://vnpay.vn' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'Fintech / Tài chính' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '22 Láng Hạ, Đống Đa, Hà Nội' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Enterprise' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  aliases?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class MergeCompaniesDto {
  @ApiProperty({ example: 'COMP-000105', description: 'Mã công ty bị gộp (nguồn)' })
  @IsString()
  fromCode: string;

  @ApiProperty({ example: 'COMP-000101', description: 'Mã công ty đích (giữ lại)' })
  @IsString()
  toCode: string;

  @ApiPropertyOptional({ example: 'MKT xác nhận cùng pháp nhân FPT IS sau khi đối chiếu MST' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class ResolveSlaDto {
  @ApiPropertyOptional({ example: 'Đã liên hệ bổ sung đầy đủ MST và email doanh nghiệp.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'resolved_data_enriched' })
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;
}

export class SkipSlaDto {
  @ApiPropertyOptional({ example: 'Lead thử nghiệm nội bộ từ team QA, bỏ qua xử lý.' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}


// ============================================================================
// 05-backend-anonymous-tracking-implementation.md DTOs (§5 & §7.6)
// ============================================================================

export class CollectEventItemDto {
  @ApiProperty({ example: 'b0d1c2f4-6f1a-4b1e-9f5d-1f2a3b4c5d6e' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ example: 'page_view' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ example: 'page_view' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: '2026-10-26T08:15:00.000Z' })
  @IsOptional()
  @IsString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: '2026-10-26T08:15:00.000Z' })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({ example: 'https://mkthub.vn/bang-gia' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: '/bang-gia' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: 'https://www.google.com/' })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional({ example: 'Bảng giá Enterprise' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 's_01J884210' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ example: 'ck_01J884210' })
  @IsOptional()
  @IsString()
  cookieId?: string;

  @ApiPropertyOptional({ example: 'fp_01J884210' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  externalUserId?: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  scrollDepth?: number;

  @ApiPropertyOptional({
    example: {
      source: 'google',
      medium: 'cpc',
      campaign: 'b2b_enterprise_q4_2026',
    },
  })
  @IsOptional()
  utm?: Record<string, any>;

  @ApiPropertyOptional({
    example: { path: '/bang-gia', durationSec: 18 },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  props?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  visitor?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  clickIds?: Record<string, any>;

  @ApiPropertyOptional({ example: { analytics: true } })
  @IsOptional()
  consent?: Record<string, any>;
}

export class CollectEventsDto {
  @ApiProperty({ example: 'SITE-001' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiProperty({ example: 'trk_live_9a8b7c6d5e4f1029' })
  @IsOptional()
  @IsString()
  trackingKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cookieId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  visitor?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  context?: Record<string, any>;

  @ApiProperty({ type: [CollectEventItemDto] })
  @IsOptional()
  @IsArray()
  events?: CollectEventItemDto[];
}

export class IdentifyTrackingDto {
  @ApiPropertyOptional({ example: 'form-01J884210' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({ example: '2026-10-26T08:20:00.000Z' })
  @IsOptional()
  @IsString()
  occurredAt?: string;

  @ApiProperty({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'a@company.vn' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Công ty Cổ phần A' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anonymousId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalUserId?: string;

  @ApiPropertyOptional({ example: 'ck_01J884210' })
  @IsOptional()
  @IsString()
  cookieId?: string;

  @ApiPropertyOptional({ example: 'fp_01J884210' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: 's_01J884210' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ example: 'lp_enterprise_q4' })
  @IsOptional()
  @IsString()
  landingPageId?: string;

  @ApiPropertyOptional({ example: 'PRJ-2026-001' })
  @IsOptional()
  @IsString()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  visitor?: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      source: 'google',
      medium: 'cpc',
      campaign: 'b2b_enterprise_q4_2026',
    },
  })
  @IsOptional()
  utm?: Record<string, any>;

  @ApiPropertyOptional({ example: { formId: 'contact-enterprise' } })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Fallback siteId if header X-MKT-Site-Id is omitted' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Fallback serverKey if header X-MKT-Server-Key is omitted' })
  @IsOptional()
  @IsString()
  serverKey?: string;

  @ApiPropertyOptional({ description: 'Fallback trackingKey for form-based identify' })
  @IsOptional()
  @IsString()
  trackingKey?: string;
}

export class UpdateTrackingSiteDto {
  @ApiPropertyOptional({ example: 'MKT Hub Corporate Website' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'mkthub.vn' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://mkthub.vn', 'https://www.mkthub.vn'],
  })
  @IsOptional()
  @IsArray()
  allowedOrigins?: string[];

  @ApiPropertyOptional({ example: 365 })
  @IsOptional()
  @IsNumber()
  retentionDays?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['10.0.0.0/8', '192.168.0.0/16'],
  })
  @IsOptional()
  @IsArray()
  internalCidrs?: string[];

  @ApiPropertyOptional({ example: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UndoConflictDto {
  @ApiProperty({ example: 'Hợp nhất nhầm 2 nhân sự khác phòng ban' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateAnonymousAlertDto {
  @ApiPropertyOptional({
    enum: ['new', 'processing', 'resolved', 'skipped', 'done'],
    example: 'processing',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'mkt-01' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  assigneeName?: string;

  @ApiPropertyOptional({ example: 'Đã chuyển thông tin cho SDR gọi lại' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateLandingPageMappingDto {
  @ApiProperty({ example: 'SITE-001' })
  @IsString()
  siteId: string;

  @ApiProperty({ example: 'lp_enterprise_q4' })
  @IsString()
  landingPageId: string;

  @ApiPropertyOptional({ example: 'PRJ-2026-001' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'PRJ-2026-001' })
  @IsOptional()
  @IsString()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional({ example: 'EVT-2026-01' })
  @IsOptional()
  @IsString()
  eventProjectId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsString()
  endAt?: string;
}

export class UpdateLandingPageMappingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landingPageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventProjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endAt?: string;
}

export class FullIpExportDto {
  @ApiProperty({
    example: 'Điều tra lưu lượng bất thường và xác minh cụm IP doanh nghiệp Q4',
    description: 'Lý do bắt buộc khi xuất IP đầy đủ (ghi nhận vào Audit Trail)',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ example: 'SITE-001' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;
}

// ============================================================================
// 06-be-request-lead-from-tonghoplink.md DTO (§3.1)
// ============================================================================

export class LeadFromEventSiteDto {
  @ApiPropertyOptional({
    example: 'evt-uuid-v4-1234',
    description: 'Mã sự kiện duy nhất phục vụ idempotency',
  })
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({
    example: '2026-04-17T09:30:00.000Z',
    description: 'Thời điểm phát sinh đăng ký trên website',
  })
  @IsOptional()
  occurredAt?: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên khách hàng (alias của name)',
  })
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên khách hàng',
  })
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '0909123456',
    description: 'Số điện thoại khách hàng (bắt buộc)',
  })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'nguyenvana@company.vn',
    description: 'Email khách hàng',
  })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'Công ty TNHH Logistics ABC',
    description: 'Tên công ty',
  })
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({
    example: 'Supply Chain Manager',
    description: 'Chức danh',
  })
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'EVT-2026-LOGISTICS-AI',
    description: 'Mã sự kiện đăng ký',
  })
  @IsOptional()
  eventCode?: string;

  @ApiPropertyOptional({
    example: 'PRJ-2026-001',
    description: 'Mã dự án liên kết',
  })
  @IsOptional()
  projectCode?: string;

  @ApiPropertyOptional({
    example: 'LP-TONGHOP-2026',
    description: 'Mã Landing Page (nếu dùng cấu hình mapping)',
  })
  @IsOptional()
  landingPageId?: string;

  @ApiPropertyOptional({
    example: 'tonghoplink',
    description: 'Nguồn lead (mặc định tonghoplink)',
  })
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({
    example: 'event_hub',
    description: 'Kênh medium',
  })
  @IsOptional()
  medium?: string;

  @ApiPropertyOptional({
    example: 'smartlog_events_2026',
    description: 'Chiến dịch marketing',
  })
  @IsOptional()
  campaign?: string;

  @ApiPropertyOptional({
    example: {
      source: 'facebook',
      medium: 'cpc',
      campaign: 'logistics_summit_q2',
      content: 'banner_top',
      term: 'wms_tms',
    },
  })
  @IsOptional()
  utm?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'ck_9f8a7b6c5d4e3f2a',
    description: 'Cookie ID từ tracker t.js',
  })
  @IsOptional()
  cookieId?: string;

  @ApiPropertyOptional({
    example: 'fp_1a2b3c4d5e6f7a8b',
    description: 'Device fingerprint từ tracker t.js',
  })
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'ses_20260417_abcd',
    description: 'Session ID từ tracker t.js',
  })
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    example: 'https://smartlog-event.github.io/tonghoplink/index.html',
  })
  @IsOptional()
  landingPageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://smartlog-event.github.io/tonghoplink/index.html',
  })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({
    example: 'https://facebook.com',
  })
  @IsOptional()
  referrer?: string;

  @ApiPropertyOptional({
    example: {
      eventName: 'Hội thảo Chuyển đổi số Logistics 2026',
      ticketType: 'VIP',
      question: 'Cần tư vấn tích hợp WMS + TMS',
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Fallback siteId nếu không truyền qua header X-MKT-Site-Id',
  })
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Fallback serverKey nếu không truyền qua header X-MKT-Server-Key',
  })
  @IsOptional()
  serverKey?: string;

  @ApiPropertyOptional({
    description: 'Fallback trackingKey',
  })
  @IsOptional()
  trackingKey?: string;
}
