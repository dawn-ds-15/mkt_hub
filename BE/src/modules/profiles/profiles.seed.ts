import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashServerKey } from './utils/tracking.util';

@Injectable()
export class ProfilesSeedService implements OnModuleInit {
  private readonly logger = new Logger(ProfilesSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureProfileTables();
    await this.seedIfEmpty();
    await this.backfillTrackingData();
  }

  async ensureProfileTables() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TrackingSite" (
          "id" TEXT PRIMARY KEY,
          "siteId" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "domain" TEXT NOT NULL,
          "trackingKey" TEXT NOT NULL UNIQUE,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "eventsCount" INTEGER NOT NULL DEFAULT 0,
          "profilesCount" INTEGER NOT NULL DEFAULT 0,
          "lastPingAt" TIMESTAMP(3),
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnonymousProfile" (
          "id" TEXT PRIMARY KEY,
          "anonymousId" TEXT NOT NULL UNIQUE,
          "cookieId" TEXT NOT NULL,
          "deviceId" TEXT NOT NULL,
          "ip" TEXT NOT NULL,
          "trackingKey" TEXT,
          "siteId" TEXT,
          "siteName" TEXT,
          "domain" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "score" INTEGER NOT NULL DEFAULT 0,
          "tier" TEXT NOT NULL DEFAULT 'Cold',
          "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "visitCount" INTEGER NOT NULL DEFAULT 1,
          "pageViews" INTEGER NOT NULL DEFAULT 1,
          "totalDurationSec" INTEGER NOT NULL DEFAULT 0,
          "device" TEXT NOT NULL DEFAULT 'Desktop',
          "os" TEXT,
          "browser" TEXT,
          "city" TEXT,
          "isp" TEXT,
          "utmSource" TEXT,
          "utmMedium" TEXT,
          "utmCampaign" TEXT,
          "topPages" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "events" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "suspectedCompany" TEXT,
          "ipClusterId" TEXT,
          "hasConflict" BOOLEAN NOT NULL DEFAULT false,
          "conflictId" TEXT,
          "convertedLeadId" TEXT,
          "convertedAt" TIMESTAMP(3),
          "identifiedPhone" TEXT,
          "identifiedName" TEXT,
          "identifiedCompany" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnonymousConflict" (
          "id" TEXT PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "keyType" TEXT NOT NULL,
          "keyValue" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "severity" TEXT NOT NULL DEFAULT 'high',
          "reason" TEXT NOT NULL,
          "phones" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "profiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "primaryProfileId" TEXT,
          "moveKey" TEXT,
          "resolutionAction" TEXT,
          "resolutionNote" TEXT,
          "resolvedBy" TEXT,
          "resolvedByName" TEXT,
          "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "slaDueAt" TIMESTAMP(3) NOT NULL,
          "resolvedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "IpCluster" (
          "id" TEXT PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "ipRange" TEXT NOT NULL,
          "isp" TEXT,
          "orgName" TEXT,
          "suspectedCompany" TEXT NOT NULL,
          "companyCode" TEXT,
          "city" TEXT,
          "profileCount" INTEGER NOT NULL DEFAULT 0,
          "totalVisits" INTEGER NOT NULL DEFAULT 0,
          "confidence" INTEGER NOT NULL DEFAULT 80,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "profiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "note" TEXT,
          "updatedBy" TEXT,
          "updatedByName" TEXT,
          "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "confirmedAt" TIMESTAMP(3),
          "rejectedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CompanyMaster" (
          "id" TEXT PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "aliases" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "taxCode" TEXT,
          "domain" TEXT,
          "website" TEXT,
          "industry" TEXT,
          "city" TEXT,
          "address" TEXT,
          "size" TEXT NOT NULL DEFAULT 'SME',
          "leadCount" INTEGER NOT NULL DEFAULT 0,
          "mqlCount" INTEGER NOT NULL DEFAULT 0,
          "sqlCount" INTEGER NOT NULL DEFAULT 0,
          "oppCount" INTEGER NOT NULL DEFAULT 0,
          "pipelineValue" DECIMAL(15, 2) NOT NULL DEFAULT 0,
          "wonCount" INTEGER NOT NULL DEFAULT 0,
          "wonValue" DECIMAL(15, 2) NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'active',
          "mergedIntoCode" TEXT,
          "note" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "IdentifiedLead" (
          "id" TEXT PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "anonymousId" TEXT,
          "name" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "email" TEXT,
          "title" TEXT,
          "companyName" TEXT,
          "companyCode" TEXT,
          "taxCode" TEXT,
          "domain" TEXT,
          "industry" TEXT,
          "companySize" TEXT,
          "city" TEXT,
          "funnelStage" TEXT NOT NULL DEFAULT 'Raw Lead',
          "score" INTEGER NOT NULL DEFAULT 0,
          "demographicScore" INTEGER NOT NULL DEFAULT 0,
          "behaviorScore" INTEGER NOT NULL DEFAULT 0,
          "tier" TEXT NOT NULL DEFAULT 'Cold',
          "ownerId" TEXT,
          "ownerName" TEXT,
          "salesId" TEXT,
          "salesName" TEXT,
          "projectId" TEXT,
          "projectName" TEXT,
          "source" TEXT,
          "utmSource" TEXT,
          "utmMedium" TEXT,
          "utmCampaign" TEXT,
          "isReturn" BOOLEAN NOT NULL DEFAULT false,
          "silentDays" INTEGER NOT NULL DEFAULT 0,
          "returnedAt" TIMESTAMP(3),
          "returnTrigger" TEXT,
          "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "hasMissingData" BOOLEAN NOT NULL DEFAULT false,
          "missingFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "handoverScore" INTEGER,
          "handoverTier" TEXT,
          "handoverAt" TIMESTAMP(3),
          "handoverBy" TEXT,
          "handoverNote" TEXT,
          "handoverSnapshot" JSONB,
          "journey" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "scoreHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "ip" TEXT,
          "cookieId" TEXT,
          "deviceId" TEXT,
          "trackingKey" TEXT,
          "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "note" TEXT,
          "mergedIntoId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SlaQueueItem" (
          "id" TEXT PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "entityName" TEXT,
          "priority" TEXT NOT NULL DEFAULT 'high',
          "slaHours" INTEGER NOT NULL DEFAULT 24,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "assigneeId" TEXT,
          "assigneeName" TEXT,
          "claimedAt" TIMESTAMP(3),
          "dueAt" TIMESTAMP(3) NOT NULL,
          "lastAlertAt" TIMESTAMP(3),
          "alertCount" INTEGER NOT NULL DEFAULT 0,
          "resolvedAt" TIMESTAMP(3),
          "resolvedBy" TEXT,
          "resolvedByName" TEXT,
          "resolution" TEXT,
          "note" TEXT,
          "skippedAt" TIMESTAMP(3),
          "skippedBy" TEXT,
          "skipReason" TEXT,
          "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProfileAuditLog" (
          "id" TEXT PRIMARY KEY,
          "module" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "actorId" TEXT,
          "actorName" TEXT,
          "beforeData" JSONB,
          "afterData" JSONB,
          "note" TEXT,
          "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add new columns to existing tables (idempotent, single statement per $executeRawUnsafe)
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "TrackingSite"
          ADD COLUMN IF NOT EXISTS "serverKey" TEXT,
          ADD COLUMN IF NOT EXISTS "serverKeyHash" TEXT,
          ADD COLUMN IF NOT EXISTS "allowedOrigins" JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS "retentionDays" INTEGER NOT NULL DEFAULT 365,
          ADD COLUMN IF NOT EXISTS "internalCidrs" JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "AnonymousProfile"
          ADD COLUMN IF NOT EXISTS "externalUserId" TEXT,
          ADD COLUMN IF NOT EXISTS "userType" TEXT NOT NULL DEFAULT 'new',
          ADD COLUMN IF NOT EXISTS "engaged" BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS "firstTouch" JSONB,
          ADD COLUMN IF NOT EXISTS "lastTouch" JSONB,
          ADD COLUMN IF NOT EXISTS "companyConfidence" INTEGER NOT NULL DEFAULT 0
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "AnonymousConflict"
          ADD COLUMN IF NOT EXISTS "undoPayload" JSONB,
          ADD COLUMN IF NOT EXISTS "lastReviewedAt" TIMESTAMP(3)
      `);

      // New tables per 05-backend-anonymous-tracking-implementation.md
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProfileIdentifier" (
          "id" TEXT PRIMARY KEY,
          "siteId" TEXT NOT NULL,
          "profileId" TEXT NOT NULL,
          "keyType" TEXT NOT NULL,
          "keyValue" TEXT NOT NULL,
          "maskedValue" TEXT,
          "phone" TEXT,
          "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "conflictLocked" BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT "ProfileIdentifier_siteId_keyType_keyValue_key" UNIQUE ("siteId", "keyType", "keyValue")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TrackingSession" (
          "id" TEXT PRIMARY KEY,
          "siteId" TEXT NOT NULL,
          "profileId" TEXT,
          "clientSessionId" TEXT NOT NULL,
          "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "endedAt" TIMESTAMP(3),
          "pageViews" INTEGER NOT NULL DEFAULT 0,
          "durationSec" INTEGER NOT NULL DEFAULT 0,
          "engaged" BOOLEAN NOT NULL DEFAULT false,
          "converted" BOOLEAN NOT NULL DEFAULT false,
          "userType" TEXT NOT NULL DEFAULT 'new',
          "source" TEXT,
          "medium" TEXT,
          "campaign" TEXT,
          "referrer" TEXT,
          "landingUrl" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TrackingSession_siteId_clientSessionId_key" UNIQUE ("siteId", "clientSessionId")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TrackingEvent" (
          "id" TEXT PRIMARY KEY,
          "eventId" TEXT NOT NULL UNIQUE,
          "siteId" TEXT NOT NULL,
          "profileId" TEXT,
          "sessionId" TEXT,
          "eventType" TEXT NOT NULL,
          "occurredAt" TIMESTAMP(3) NOT NULL,
          "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "url" TEXT,
          "referrer" TEXT,
          "title" TEXT,
          "utm" JSONB,
          "metadata" JSONB,
          "consent" JSONB,
          "projectCode" TEXT,
          "status" TEXT NOT NULL DEFAULT 'accepted',
          "dropReason" TEXT,
          "scoreDelta" INTEGER NOT NULL DEFAULT 0,
          "ipHash" TEXT,
          "userAgent" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProfileTouchpoint" (
          "id" TEXT PRIMARY KEY,
          "profileId" TEXT NOT NULL,
          "sessionId" TEXT,
          "occurredAt" TIMESTAMP(3) NOT NULL,
          "source" TEXT,
          "medium" TEXT,
          "campaign" TEXT,
          "referrer" TEXT,
          "url" TEXT,
          "isFirst" BOOLEAN NOT NULL DEFAULT false,
          "isLast" BOOLEAN NOT NULL DEFAULT false
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "IpSession" (
          "id" TEXT PRIMARY KEY,
          "siteId" TEXT NOT NULL,
          "ipHash" TEXT NOT NULL,
          "clientSessionId" TEXT NOT NULL,
          "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "pageViews" INTEGER NOT NULL DEFAULT 0,
          "engaged" BOOLEAN NOT NULL DEFAULT false,
          CONSTRAINT "IpSession_siteId_ipHash_clientSessionId_key" UNIQUE ("siteId", "ipHash", "clientSessionId")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnonymousAlert" (
          "id" TEXT PRIMARY KEY,
          "profileId" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'website_return',
          "status" TEXT NOT NULL DEFAULT 'new',
          "severity" TEXT NOT NULL DEFAULT 'medium',
          "assigneeId" TEXT,
          "assigneeName" TEXT,
          "scoreAtCreation" INTEGER,
          "message" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "resolvedAt" TIMESTAMP(3)
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "LandingPageMapping" (
          "id" TEXT PRIMARY KEY,
          "siteId" TEXT NOT NULL,
          "landingPageId" TEXT NOT NULL,
          "projectId" TEXT NOT NULL,
          "eventProjectId" TEXT,
          "startAt" TIMESTAMP(3) NOT NULL,
          "endAt" TIMESTAMP(3),
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err) {
      this.logger.warn(`ensureProfileTables warning: ${err}`);
    }
  }

  async seedIfEmpty() {
    try {
      const siteCount = await this.prisma.trackingSite.count();
      if (siteCount > 0) return;

      const now = Date.now();
      const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000);
      const d = (daysAgo: number) => new Date(now - daysAgo * 86400_000);

      // 1. Tracking Sites
      await this.prisma.trackingSite.createMany({
        data: [
          {
            id: 'site-001',
            siteId: 'SITE-001',
            name: 'MKT Hub Corporate Website',
            domain: 'mkthub.vn',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            isActive: true,
            eventsCount: 14820,
            profilesCount: 1245,
            lastPingAt: h(0.1),
          },
          {
            id: 'site-002',
            siteId: 'SITE-002',
            name: 'Landing Page Giải pháp Cloud & AI 2026',
            domain: 'cloud.mkthub.vn',
            trackingKey: 'trk_live_3f2e1d0c9b8a4451',
            isActive: true,
            eventsCount: 6390,
            profilesCount: 512,
            lastPingAt: h(0.3),
          },
          {
            id: 'site-003',
            siteId: 'SITE-003',
            name: 'Cổng Tài liệu & Whitepaper B2B',
            domain: 'docs.mkthub.vn',
            trackingKey: 'trk_live_7c6b5a4f3e2d8812',
            isActive: false,
            eventsCount: 2150,
            profilesCount: 198,
            lastPingAt: d(3),
          },
          {
            id: 'site-tonghop',
            siteId: 'SITE-TONGHOP',
            name: 'Smartlog Event - Tonghoplink',
            domain: 'smartlog-event.github.io',
            trackingKey: 'trk_live_tonghoplink_2026',
            isActive: true,
            eventsCount: 0,
            profilesCount: 0,
            lastPingAt: h(0.5),
          },
        ],
        skipDuplicates: true,
      });

      // 2. Company Master
      await this.prisma.companyMaster.createMany({
        data: [
          {
            id: 'comp-101',
            code: 'COMP-000101',
            name: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            aliases: ['FPT IS', 'FPT Information System', 'FIS'],
            taxCode: '0101248141',
            domain: 'fpt-is.com',
            website: 'https://fpt-is.com',
            industry: 'Công nghệ thông tin',
            city: 'Hà Nội',
            address: 'Tòa nhà FPT, Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội',
            size: 'Enterprise',
            leadCount: 2,
            mqlCount: 2,
            sqlCount: 2,
            oppCount: 2,
            pipelineValue: 850000000,
            wonCount: 1,
            wonValue: 420000000,
            status: 'active',
          },
          {
            id: 'comp-102',
            code: 'COMP-000102',
            name: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            aliases: ['Techcombank', 'TCB', 'Ngân hàng Kỹ Thương'],
            taxCode: '0100230800',
            domain: 'techcombank.com.vn',
            website: 'https://techcombank.com.vn',
            industry: 'Tài chính - Ngân hàng',
            city: 'Hà Nội',
            address: 'Số 6 Quang Trung, Hoàn Kiếm, Hà Nội',
            size: 'Enterprise',
            leadCount: 2,
            mqlCount: 1,
            sqlCount: 1,
            oppCount: 1,
            pipelineValue: 1200000000,
            wonCount: 1,
            wonValue: 650000000,
            status: 'active',
          },
          {
            id: 'comp-103',
            code: 'COMP-000103',
            name: 'Công ty Cổ phần Tập đoàn Masan',
            aliases: ['Masan Group', 'MSN', 'Masan Consumer'],
            taxCode: '0303576603',
            domain: 'masangroup.com',
            website: 'https://masangroup.com',
            industry: 'Bán lẻ & FMCG',
            city: 'TP.HCM',
            address: 'Suite 802, Central Plaza, 17 Lê Duẩn, Quận 1, TP.HCM',
            size: 'Enterprise',
            leadCount: 1,
            mqlCount: 1,
            sqlCount: 0,
            oppCount: 1,
            pipelineValue: 540000000,
            wonCount: 0,
            wonValue: 0,
            status: 'active',
          },
          {
            id: 'comp-104',
            code: 'COMP-000104',
            name: 'Công ty Cổ phần Dịch vụ Giao Hàng Nhanh',
            aliases: ['GHN', 'Giao Hang Nhanh', 'GHN Express'],
            taxCode: '0311907295',
            domain: 'ghn.vn',
            website: 'https://ghn.vn',
            industry: 'Logistics & Vận tải',
            city: 'TP.HCM',
            address: '405/15 Xô Viết Nghệ Tĩnh, Phường 24, Bình Thạnh, TP.HCM',
            size: 'Mid-Market',
            leadCount: 1,
            mqlCount: 0,
            sqlCount: 0,
            oppCount: 1,
            pipelineValue: 320000000,
            wonCount: 1,
            wonValue: 180000000,
            status: 'active',
          },
          {
            id: 'comp-105',
            code: 'COMP-000105',
            name: 'CTCP Hệ thống Thông tin FPT - Chi nhánh TP.HCM',
            aliases: ['FPT IS HCM', 'FIS South'],
            taxCode: '0101248141-002',
            domain: 'hcm.fpt-is.com',
            website: 'https://fpt-is.com',
            industry: 'Công nghệ thông tin',
            city: 'TP.HCM',
            address: 'Lô L.29B-31B-33B Đường Tân Thuận, KCX Tân Thuận, Quận 7, TP.HCM',
            size: 'Enterprise',
            leadCount: 1,
            mqlCount: 1,
            sqlCount: 0,
            oppCount: 0,
            pipelineValue: 210000000,
            wonCount: 0,
            wonValue: 0,
            status: 'active',
            note: 'Nghi ngờ trùng pháp nhân với COMP-000101 (FPT IS)',
          },
        ],
        skipDuplicates: true,
      });

      // 3. Anonymous Profiles
      await this.prisma.anonymousProfile.createMany({
        data: [
          {
            id: 'anon-1',
            anonymousId: 'ANON-884210',
            cookieId: 'ck_9f8a7b6c5d4e3b1c',
            deviceId: 'fp_7d2e1a4b8c9f90a4',
            ip: '113.161.72.45',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            siteId: 'SITE-001',
            siteName: 'MKT Hub Corporate Website',
            domain: 'mkthub.vn',
            status: 'active',
            score: 86,
            tier: 'Hot',
            firstSeenAt: d(12),
            lastSeenAt: h(1.5),
            visitCount: 7,
            pageViews: 24,
            totalDurationSec: 1840,
            device: 'Desktop',
            os: 'Windows 11',
            browser: 'Chrome 129',
            city: 'Hà Nội',
            isp: 'VNPT Business Fiber',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'b2b_enterprise_q4_2026',
            topPages: [
              '/bang-gia-enterprise',
              '/tai-lieu-ky-thuat-api',
              '/case-study-ngan-hang',
              '/lien-he-tu-van',
            ],
            events: [
              {
                id: 'ev-1',
                type: 'page_view',
                title: 'Xem trang Giải pháp Doanh nghiệp',
                page: '/giai-phap-enterprise',
                timestamp: d(12).toISOString(),
                durationSec: 180,
                scoreDelta: 10,
              },
              {
                id: 'ev-2',
                type: 'download',
                title: 'Tải Whitepaper Kiến trúc Bảo mật B2B',
                page: '/tai-lieu-ky-thuat-api',
                timestamp: d(5).toISOString(),
                durationSec: 320,
                scoreDelta: 30,
              },
              {
                id: 'ev-3',
                type: 'pricing_view',
                title: 'Xem Bảng giá gói Enterprise (3 lần)',
                page: '/bang-gia-enterprise',
                timestamp: h(1.5).toISOString(),
                durationSec: 410,
                scoreDelta: 46,
              },
            ],
            suspectedCompany: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            ipClusterId: 'IPC-001',
            hasConflict: true,
            conflictId: 'CONF-001',
          },
          {
            id: 'anon-2',
            anonymousId: 'ANON-884211',
            cookieId: 'ck_4c3b2a1f9e8d7712',
            deviceId: 'fp_2a1b3c4d5e6f8821',
            ip: '113.161.72.46',
            trackingKey: 'trk_live_3f2e1d0c9b8a4451',
            siteId: 'SITE-002',
            siteName: 'Landing Page Giải pháp Cloud & AI 2026',
            domain: 'cloud.mkthub.vn',
            status: 'active',
            score: 78,
            tier: 'Hot',
            firstSeenAt: d(8),
            lastSeenAt: h(3),
            visitCount: 5,
            pageViews: 18,
            totalDurationSec: 1420,
            device: 'Desktop',
            os: 'macOS Sonoma',
            browser: 'Safari 17',
            city: 'Hà Nội',
            isp: 'VNPT Business Fiber',
            utmSource: 'linkedin',
            utmMedium: 'paid_social',
            utmCampaign: 'cloud_ai_cto_2026',
            topPages: [
              '/cloud-ai-overview',
              '/roi-calculator',
              '/bang-gia-enterprise',
            ],
            events: [
              {
                id: 'ev-21',
                type: 'page_view',
                title: 'Truy cập Landing Page Cloud & AI',
                page: '/cloud-ai-overview',
                timestamp: d(8).toISOString(),
                durationSec: 210,
                scoreDelta: 15,
              },
              {
                id: 'ev-22',
                type: 'tool_interaction',
                title: 'Sử dụng công cụ tính ROI cho 500 nhân sự',
                page: '/roi-calculator',
                timestamp: h(3).toISOString(),
                durationSec: 540,
                scoreDelta: 63,
              },
            ],
            suspectedCompany: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            ipClusterId: 'IPC-001',
            hasConflict: false,
          },
          {
            id: 'anon-3',
            anonymousId: 'ANON-884212',
            cookieId: 'ck_8e7d6c5b4a3f2209',
            deviceId: 'fp_9f8e7d6c5b4a1103',
            ip: '14.241.120.22',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            siteId: 'SITE-001',
            siteName: 'MKT Hub Corporate Website',
            domain: 'mkthub.vn',
            status: 'active',
            score: 62,
            tier: 'Warm',
            firstSeenAt: d(15),
            lastSeenAt: d(1),
            visitCount: 4,
            pageViews: 11,
            totalDurationSec: 790,
            device: 'Desktop',
            os: 'Windows 10',
            browser: 'Edge 128',
            city: 'TP.HCM',
            isp: 'Viettel Leased Line',
            utmSource: 'facebook',
            utmMedium: 'retargeting',
            utmCampaign: 'fmcg_digital_2026',
            topPages: ['/case-study-ban-le', '/tich-hop-erp'],
            events: [
              {
                id: 'ev-31',
                type: 'page_view',
                title: 'Xem Case Study chuỗi bán lẻ FMCG',
                page: '/case-study-ban-le',
                timestamp: d(1).toISOString(),
                durationSec: 360,
                scoreDelta: 35,
              },
            ],
            suspectedCompany: 'Công ty Cổ phần Tập đoàn Masan',
            ipClusterId: 'IPC-002',
            hasConflict: false,
          },
          {
            id: 'anon-4',
            anonymousId: 'ANON-884213',
            cookieId: 'ck_1a2b3c4d5e6f7788',
            deviceId: 'fp_7d2e1a4b8c9f90a4',
            ip: '27.72.88.19',
            trackingKey: 'trk_live_3f2e1d0c9b8a4451',
            siteId: 'SITE-002',
            siteName: 'Landing Page Giải pháp Cloud & AI 2026',
            domain: 'cloud.mkthub.vn',
            status: 'conflict',
            score: 55,
            tier: 'Warm',
            firstSeenAt: d(6),
            lastSeenAt: h(8),
            visitCount: 3,
            pageViews: 9,
            totalDurationSec: 610,
            device: 'Mobile',
            os: 'iOS 18',
            browser: 'Mobile Safari',
            city: 'Đà Nẵng',
            isp: 'FPT Telecom',
            utmSource: 'event_qr',
            utmMedium: 'offline',
            utmCampaign: 'tech_summit_2026',
            topPages: ['/su-kien-tech-summit', '/dang-ky-demo'],
            events: [
              {
                id: 'ev-41',
                type: 'form_attempt',
                title: 'Điền form đăng ký tại quầy sự kiện Tech Summit',
                page: '/dang-ky-demo',
                timestamp: h(8).toISOString(),
                durationSec: 190,
                scoreDelta: 40,
              },
            ],
            suspectedCompany: null,
            ipClusterId: null,
            hasConflict: true,
            conflictId: 'CONF-002',
          },
          {
            id: 'anon-5',
            anonymousId: 'ANON-884209',
            cookieId: 'ck_5f4e3d2c1b0a9988',
            deviceId: 'fp_6a5b4c3d2e1f0099',
            ip: '203.162.4.101',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            siteId: 'SITE-001',
            siteName: 'MKT Hub Corporate Website',
            domain: 'mkthub.vn',
            status: 'converted',
            score: 92,
            tier: 'Hot',
            firstSeenAt: d(25),
            lastSeenAt: d(4),
            visitCount: 9,
            pageViews: 31,
            totalDurationSec: 2640,
            device: 'Desktop',
            os: 'Windows 11',
            browser: 'Chrome 129',
            city: 'Hà Nội',
            isp: 'FPT Telecom Corp',
            utmSource: 'google',
            utmMedium: 'organic',
            utmCampaign: 'seo_brand',
            topPages: ['/bang-gia-enterprise', '/dang-ky-demo', '/tai-lieu-api'],
            events: [
              {
                id: 'ev-51',
                type: 'form_submit',
                title: 'Gửi form Đăng ký Demo Giải pháp Enterprise',
                page: '/dang-ky-demo',
                timestamp: d(4).toISOString(),
                durationSec: 240,
                scoreDelta: 50,
              },
            ],
            suspectedCompany: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            ipClusterId: 'IPC-003',
            hasConflict: false,
            convertedLeadId: 'LEAD-2026-001',
            convertedAt: d(4),
            identifiedPhone: '0901234567',
            identifiedName: 'Nguyễn Minh Quân',
            identifiedCompany: 'Công ty Cổ phần Hệ thống Thông tin FPT',
          },
        ],
        skipDuplicates: true,
      });

      // 4. Anonymous Conflicts
      await this.prisma.anonymousConflict.createMany({
        data: [
          {
            id: 'conf-1',
            code: 'CONF-001',
            keyType: 'cookie',
            keyValue: 'ck_9f8a7b6c5d4e3b1c',
            status: 'pending',
            severity: 'high',
            reason:
              '1 Cookie ID ghi nhận 2 SĐT khác nhau (0901234567 và 0987654321) trong 24h — chặn auto-merge theo quy tắc BDD-02',
            phones: ['0901234567', '0987654321'],
            profiles: [
              {
                id: 'anon-1',
                anonymousId: 'ANON-884210',
                name: 'Nguyễn Minh Quân (Nghi ngờ)',
                phone: '0901234567',
                company: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
                score: 86,
                tier: 'Hot',
                lastSeenAt: h(1.5).toISOString(),
              },
              {
                id: 'anon-2',
                anonymousId: 'ANON-884211',
                name: 'Lê Hoàng Lan (Nghi ngờ)',
                phone: '0987654321',
                company: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
                score: 78,
                tier: 'Hot',
                lastSeenAt: h(3).toISOString(),
              },
            ],
            detectedAt: h(30),
            slaDueAt: h(6), // Overdue by 6h
          },
          {
            id: 'conf-2',
            code: 'CONF-002',
            keyType: 'device',
            keyValue: 'fp_7d2e1a4b8c9f90a4',
            status: 'pending',
            severity: 'medium',
            reason:
              '1 Device Fingerprint dùng chung tại iPad sự kiện Tech Summit map với 2 SĐT khác nhau (0912345678, 0938112233)',
            phones: ['0912345678', '0938112233'],
            profiles: [
              {
                id: 'anon-4',
                anonymousId: 'ANON-884213',
                name: 'Khách tham quan Booth A1',
                phone: '0912345678',
                company: 'Công ty TNHH Giao Hàng Nhanh',
                score: 55,
                tier: 'Warm',
                lastSeenAt: h(8).toISOString(),
              },
            ],
            detectedAt: h(10),
            slaDueAt: new Date(now + 14 * 3600_000),
          },
        ],
        skipDuplicates: true,
      });

      // 5. IP Clusters
      await this.prisma.ipCluster.createMany({
        data: [
          {
            id: 'ipc-1',
            code: 'IPC-001',
            ipRange: '113.161.72.40/29',
            isp: 'VNPT Business Fiber',
            orgName: 'TECHCOMBANK-HO-QUANGTRUNG',
            suspectedCompany: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            companyCode: 'COMP-000102',
            city: 'Hà Nội',
            profileCount: 4,
            totalVisits: 19,
            confidence: 92,
            status: 'pending',
            profiles: [
              {
                anonymousId: 'ANON-884210',
                score: 86,
                tier: 'Hot',
                device: 'Desktop',
                pageViews: 24,
                lastSeenAt: h(1.5).toISOString(),
              },
              {
                anonymousId: 'ANON-884211',
                score: 78,
                tier: 'Hot',
                device: 'Desktop',
                pageViews: 18,
                lastSeenAt: h(3).toISOString(),
              },
            ],
            detectedAt: d(2),
          },
          {
            id: 'ipc-2',
            code: 'IPC-002',
            ipRange: '14.241.120.16/28',
            isp: 'Viettel Leased Line',
            orgName: 'MASAN-TOWER-Q1-HCM',
            suspectedCompany: 'Công ty Cổ phần Tập đoàn Masan',
            companyCode: 'COMP-000103',
            city: 'TP.HCM',
            profileCount: 3,
            totalVisits: 14,
            confidence: 87,
            status: 'pending',
            profiles: [
              {
                anonymousId: 'ANON-884212',
                score: 62,
                tier: 'Warm',
                device: 'Desktop',
                pageViews: 11,
                lastSeenAt: d(1).toISOString(),
              },
            ],
            detectedAt: d(3),
          },
          {
            id: 'ipc-3',
            code: 'IPC-003',
            ipRange: '203.162.4.100/30',
            isp: 'FPT Telecom Corp',
            orgName: 'FPT-TOWER-PHAMVANBACH',
            suspectedCompany: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            companyCode: 'COMP-000101',
            city: 'Hà Nội',
            profileCount: 5,
            totalVisits: 27,
            confidence: 96,
            status: 'confirmed',
            confirmedAt: d(4),
            updatedByName: 'Nguyễn Văn A (MKT Manager)',
            profiles: [
              {
                anonymousId: 'ANON-884209',
                score: 92,
                tier: 'Hot',
                device: 'Desktop',
                pageViews: 31,
                lastSeenAt: d(4).toISOString(),
              },
            ],
            detectedAt: d(7),
          },
        ],
        skipDuplicates: true,
      });

      // 6. Identified Leads 360
      await this.prisma.identifiedLead.createMany({
        data: [
          {
            id: 'lead-001',
            code: 'LEAD-2026-001',
            anonymousId: 'ANON-884209',
            name: 'Nguyễn Minh Quân',
            phone: '0901234567',
            email: 'quan.nm@fpt-is.com',
            title: 'Giám đốc Chuyển đổi số',
            companyName: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            companyCode: 'COMP-000101',
            taxCode: '0101248141',
            domain: 'fpt-is.com',
            industry: 'Công nghệ thông tin',
            companySize: 'Enterprise',
            city: 'Hà Nội',
            funnelStage: 'SQL',
            score: 92,
            demographicScore: 40,
            behaviorScore: 52,
            tier: 'Hot',
            ownerId: 'mkt-01',
            ownerName: 'Nguyễn Văn A',
            salesId: 'sales-01',
            salesName: 'Trần Quốc Bảo',
            projectId: 'proj-lead-2026',
            projectName: 'LEAD GENERATION 2026',
            source: 'Website Form / Organic Search',
            utmSource: 'google',
            utmMedium: 'organic',
            utmCampaign: 'seo_brand',
            isReturn: false,
            silentDays: 2,
            lastActivityAt: d(2),
            hasMissingData: false,
            missingFields: [],
            handoverScore: 85,
            handoverTier: 'Hot',
            handoverAt: d(4),
            handoverBy: 'Nguyễn Văn A',
            handoverNote:
              'Khách hàng Enterprise cấp C-level, đã tải tài liệu tích hợp API và yêu cầu demo trực tiếp.',
            handoverSnapshot: {
              handoverScore: 85,
              tier: 'Hot',
              at: d(4).toISOString(),
              salesId: 'sales-01',
              salesName: 'Trần Quốc Bảo',
              note: 'Khách hàng Enterprise cấp C-level, đã tải tài liệu tích hợp API và yêu cầu demo trực tiếp.',
              previousStage: 'Raw Lead',
              newStage: 'MQL',
            },
            journey: [
              {
                id: 'j-1',
                phase: 'anonymous',
                isAnonymousPhase: true,
                type: 'page_view',
                channel: 'Web Tracking (SITE-001)',
                title: '[Ẩn danh ANON-884209] Xem trang Giải pháp Enterprise',
                page: '/giai-phap-enterprise',
                scoreDelta: 15,
                timestamp: d(25).toISOString(),
              },
              {
                id: 'j-2',
                phase: 'anonymous',
                isAnonymousPhase: true,
                type: 'download',
                channel: 'Web Tracking (SITE-001)',
                title: '[Ẩn danh ANON-884209] Tải Whitepaper Kiến trúc Tích hợp',
                page: '/tai-lieu-api',
                scoreDelta: 25,
                timestamp: d(10).toISOString(),
              },
              {
                id: 'j-3',
                phase: 'conversion',
                isAnonymousPhase: false,
                type: 'convert',
                channel: 'Form Đăng ký Demo',
                title: 'Chuyển đổi từ Hồ sơ ẩn danh ANON-884209 thành Lead định danh',
                page: '/dang-ky-demo',
                scoreDelta: 45,
                timestamp: d(4).toISOString(),
              },
              {
                id: 'j-4',
                phase: 'identified',
                isAnonymousPhase: false,
                type: 'handover',
                channel: 'CRM Handover',
                title: 'Bàn giao cho Sales Trần Quốc Bảo (Raw Lead -> MQL tự động)',
                page: null,
                scoreDelta: 7,
                timestamp: d(4).toISOString(),
              },
            ],
            scoreHistory: [
              {
                id: 'sh-1',
                date: d(25).toISOString().slice(0, 10),
                timestamp: d(25).toISOString(),
                score: 15,
                delta: 15,
                tier: 'Cold',
                reason: 'Truy cập lần đầu qua tìm kiếm tự nhiên',
              },
              {
                id: 'sh-2',
                date: d(10).toISOString().slice(0, 10),
                timestamp: d(10).toISOString(),
                score: 40,
                delta: 25,
                tier: 'Warm',
                reason: 'Tải tài liệu kỹ thuật API',
              },
              {
                id: 'sh-3',
                date: d(4).toISOString().slice(0, 10),
                timestamp: d(4).toISOString(),
                score: 85,
                delta: 45,
                tier: 'Hot',
                reason: 'Điền form Đăng ký Demo + khớp công ty Enterprise FPT IS',
              },
              {
                id: 'sh-4',
                date: d(2).toISOString().slice(0, 10),
                timestamp: d(2).toISOString(),
                score: 92,
                delta: 7,
                tier: 'Hot',
                reason: 'Tham gia buổi Demo kỹ thuật cùng đội ngũ Sales',
              },
            ],
            ip: '203.162.4.101',
            cookieId: 'ck_5f4e3d2c1b0a9988',
            deviceId: 'fp_6a5b4c3d2e1f0099',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            tags: ['Enterprise', 'FPT IS', 'High Intent'],
            note: 'Đang chuẩn bị đề xuất kỹ thuật (Proposal) cho giai đoạn POC.',
          },
          {
            id: 'lead-002',
            code: 'LEAD-2026-002',
            anonymousId: 'ANON-884201',
            name: 'Lê Hoàng Lan',
            phone: '0918223344',
            email: 'lan.lh@techcombank.com.vn',
            title: 'Trưởng phòng Mua sắm CNTT',
            companyName: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            companyCode: 'COMP-000102',
            taxCode: '0100230800',
            domain: 'techcombank.com.vn',
            industry: 'Tài chính - Ngân hàng',
            companySize: 'Enterprise',
            city: 'Hà Nội',
            funnelStage: 'Raw Lead',
            score: 84,
            demographicScore: 38,
            behaviorScore: 46,
            tier: 'Hot',
            ownerId: 'mkt-01',
            ownerName: 'Nguyễn Văn A',
            salesId: null,
            salesName: null,
            projectId: 'proj-lead-2026',
            projectName: 'LEAD GENERATION 2026',
            source: 'LinkedIn Lead Gen',
            utmSource: 'linkedin',
            utmMedium: 'paid_social',
            utmCampaign: 'banking_dx_2026',
            isReturn: false,
            silentDays: 1,
            lastActivityAt: h(5),
            hasMissingData: false,
            missingFields: [],
            journey: [
              {
                id: 'j-201',
                phase: 'anonymous',
                isAnonymousPhase: true,
                type: 'page_view',
                channel: 'Landing Page Cloud',
                title: 'Xem giải pháp Bảo mật Ngân hàng & Bảng giá',
                page: '/bang-gia-enterprise',
                scoreDelta: 44,
                timestamp: d(3).toISOString(),
              },
              {
                id: 'j-202',
                phase: 'conversion',
                isAnonymousPhase: false,
                type: 'form_submit',
                channel: 'LinkedIn Lead Form',
                title: 'Đăng ký nhận báo giá gói Enterprise Ngân hàng',
                page: '/cloud-ai-overview',
                scoreDelta: 40,
                timestamp: h(5).toISOString(),
              },
            ],
            scoreHistory: [
              {
                id: 'sh-201',
                date: d(3).toISOString().slice(0, 10),
                timestamp: d(3).toISOString(),
                score: 44,
                delta: 44,
                tier: 'Warm',
                reason: 'Tương tác sâu trên trang giải pháp Tài chính - Ngân hàng',
              },
              {
                id: 'sh-202',
                date: h(5).toISOString().slice(0, 10),
                timestamp: h(5).toISOString(),
                score: 84,
                delta: 40,
                tier: 'Hot',
                reason: 'Gửi form yêu cầu báo giá chính thức',
              },
            ],
            ip: '113.161.72.48',
            cookieId: 'ck_7a6b5c4d3e2f1100',
            deviceId: 'fp_1f2e3d4c5b6a9900',
            trackingKey: 'trk_live_3f2e1d0c9b8a4451',
            tags: ['Banking', 'Ready for Handover'],
            note: 'Đủ điểm chuẩn Hot Lead, sẵn sàng bàn giao cho Sales.',
          },
          {
            id: 'lead-003',
            code: 'LEAD-2026-003',
            anonymousId: 'ANON-881044',
            name: 'Phạm Tuấn Anh',
            phone: '0983445566',
            email: 'tuananh.pham@masangroup.com',
            title: 'IT Infrastructure Manager',
            companyName: 'Công ty Cổ phần Tập đoàn Masan',
            companyCode: 'COMP-000103',
            taxCode: '0303576603',
            domain: 'masangroup.com',
            industry: 'Bán lẻ & FMCG',
            companySize: 'Enterprise',
            city: 'TP.HCM',
            funnelStage: 'MQL',
            score: 76,
            demographicScore: 34,
            behaviorScore: 42,
            tier: 'Hot',
            ownerId: 'mkt-02',
            ownerName: 'Lê Thị B',
            salesId: 'sales-02',
            salesName: 'Hoàng Minh Đức',
            projectId: 'proj-event-2026',
            projectName: 'HỘI THẢO CHUYỂN ĐỔI SỐ BÁN LẺ',
            source: 'Returning Visitor / Retargeting',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'reengage_q4_2026',
            isReturn: true,
            silentDays: 112,
            returnedAt: h(6),
            returnTrigger: 'Xem lại trang Bảng giá Enterprise & tải tài liệu tích hợp SAP ERP sau 112 ngày im lặng',
            lastActivityAt: h(6),
            hasMissingData: false,
            missingFields: [],
            handoverScore: 68,
            handoverTier: 'Warm',
            handoverAt: d(120),
            handoverBy: 'Lê Thị B',
            handoverNote: 'Đã bàn giao từ Quý 2, khách tạm hoãn ngân sách đến Quý 4.',
            handoverSnapshot: {
              handoverScore: 68,
              tier: 'Warm',
              at: d(120).toISOString(),
              salesId: 'sales-02',
              salesName: 'Hoàng Minh Đức',
              note: 'Đã bàn giao từ Quý 2, khách tạm hoãn ngân sách đến Quý 4.',
              previousStage: 'Raw Lead',
              newStage: 'MQL',
            },
            journey: [
              {
                id: 'j-301',
                phase: 'identified',
                isAnonymousPhase: false,
                type: 'event',
                channel: 'Webinar Q2',
                title: 'Tham dự Hội thảo Chuyển đổi số Chuỗi cung ứng',
                page: '/webinar-fmcg',
                scoreDelta: 68,
                timestamp: d(120).toISOString(),
              },
              {
                id: 'j-302',
                phase: 'identified',
                isAnonymousPhase: false,
                type: 're_engagement',
                channel: 'Web Tracking (SITE-001)',
                title: 'Quay lại sau 112 ngày im lặng: Xem Bảng giá & Tích hợp ERP',
                page: '/bang-gia-enterprise',
                scoreDelta: 28,
                timestamp: h(6).toISOString(),
              },
            ],
            scoreHistory: [
              {
                id: 'sh-301',
                date: d(120).toISOString().slice(0, 10),
                timestamp: d(120).toISOString(),
                score: 68,
                delta: 68,
                tier: 'Warm',
                reason: 'Đăng ký tại Webinar Q2',
              },
              {
                id: 'sh-302',
                date: d(30).toISOString().slice(0, 10),
                timestamp: d(30).toISOString(),
                score: 48,
                delta: -20,
                tier: 'Warm',
                reason: 'Giảm điểm tự động do >90 ngày không tương tác (Score Decay)',
              },
              {
                id: 'sh-303',
                date: h(6).toISOString().slice(0, 10),
                timestamp: h(6).toISOString(),
                score: 76,
                delta: 28,
                tier: 'Hot',
                reason: 'Tương tác trở lại sau 112 ngày im lặng (Re-engagement Boost)',
              },
            ],
            ip: '14.241.120.25',
            cookieId: 'ck_3c4d5e6f7a8b9911',
            deviceId: 'fp_5a6b7c8d9e0f2233',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            tags: ['Re-engaged >90d', 'FMCG', 'Masan'],
            note: 'Khách hàng quay lại đúng dịp mở ngân sách Q4, cần Sales liên hệ lại ngay.',
          },
          {
            id: 'lead-004',
            code: 'LEAD-2026-004',
            anonymousId: 'ANON-883910',
            name: 'Trần Thu Hà',
            phone: '0939778899',
            email: null,
            title: 'Quản lý Vận hành',
            companyName: 'Công ty Cổ phần Dịch vụ Giao Hàng Nhanh',
            companyCode: 'COMP-000104',
            taxCode: null,
            domain: 'ghn.vn',
            industry: null,
            companySize: null,
            city: 'TP.HCM',
            funnelStage: 'Raw Lead',
            score: 58,
            demographicScore: 20,
            behaviorScore: 38,
            tier: 'Warm',
            ownerId: 'mkt-02',
            ownerName: 'Lê Thị B',
            salesId: null,
            salesName: null,
            projectId: 'proj-lead-2026',
            projectName: 'LEAD GENERATION 2026',
            source: 'Facebook Lead Ads',
            utmSource: 'facebook',
            utmMedium: 'cpc',
            utmCampaign: 'logistics_automation_2026',
            isReturn: false,
            silentDays: 1,
            lastActivityAt: d(1),
            hasMissingData: true,
            missingFields: ['email', 'taxCode', 'industry', 'companySize'],
            journey: [
              {
                id: 'j-401',
                phase: 'conversion',
                isAnonymousPhase: false,
                type: 'form_submit',
                channel: 'Facebook Lead Ads',
                title: 'Để lại SĐT tư vấn nhanh (thiếu Email & MST công ty)',
                page: '/lp-logistics',
                scoreDelta: 58,
                timestamp: d(1).toISOString(),
              },
            ],
            scoreHistory: [
              {
                id: 'sh-401',
                date: d(1).toISOString().slice(0, 10),
                timestamp: d(1).toISOString(),
                score: 58,
                delta: 58,
                tier: 'Warm',
                reason: 'Điền form tư vấn nhanh',
              },
            ],
            ip: '27.72.100.55',
            cookieId: 'ck_6d7e8f9a0b1c4455',
            deviceId: 'fp_8b9c0d1e2f3a6677',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            tags: ['Missing Data', 'Logistics'],
            note: 'Cần SDR gọi xác minh bổ sung Email doanh nghiệp và Quy mô nhân sự trong SLA 48h.',
          },
          {
            id: 'lead-005',
            code: 'LEAD-2026-005',
            anonymousId: 'ANON-880112',
            name: 'Vũ Đức Thịnh',
            phone: '0972112233',
            email: 'thinh.vd@fpt-is.com',
            title: 'Solution Architect',
            companyName: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            companyCode: 'COMP-000101',
            taxCode: '0101248141',
            domain: 'fpt-is.com',
            industry: 'Công nghệ thông tin',
            companySize: 'Enterprise',
            city: 'Hà Nội',
            funnelStage: 'Opportunity',
            score: 89,
            demographicScore: 39,
            behaviorScore: 50,
            tier: 'Hot',
            ownerId: 'mkt-01',
            ownerName: 'Nguyễn Văn A',
            salesId: 'sales-01',
            salesName: 'Trần Quốc Bảo',
            projectId: 'proj-lead-2026',
            projectName: 'LEAD GENERATION 2026',
            source: 'Referral / Partner',
            utmSource: 'partner',
            utmMedium: 'referral',
            utmCampaign: 'enterprise_alliance',
            isReturn: true,
            silentDays: 98,
            returnedAt: d(1),
            returnTrigger: 'Tải bộ tài liệu triển khai On-Premise mới sau 98 ngày tạm dừng',
            lastActivityAt: d(1),
            hasMissingData: false,
            missingFields: [],
            handoverScore: 82,
            handoverTier: 'Hot',
            handoverAt: d(110),
            handoverBy: 'Nguyễn Văn A',
            handoverSnapshot: {
              handoverScore: 82,
              tier: 'Hot',
              at: d(110).toISOString(),
              salesId: 'sales-01',
              salesName: 'Trần Quốc Bảo',
              note: 'Bàn giao Opportunity dự án tích hợp hệ thống.',
              previousStage: 'MQL',
              newStage: 'Opportunity',
            },
            journey: [],
            scoreHistory: [],
            ip: '203.162.4.102',
            cookieId: 'ck_9988776655443322',
            deviceId: 'fp_1122334455667788',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            tags: ['Enterprise', 'Re-engaged >90d'],
          },
          {
            id: 'lead-006',
            code: 'LEAD-2026-006',
            anonymousId: 'ANON-879005',
            name: 'Đỗ Bích Ngọc',
            phone: '0945667788',
            email: 'ngoc.db@techcombank.com.vn',
            title: 'VP Digital Banking',
            companyName: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
            companyCode: 'COMP-000102',
            taxCode: '0100230800',
            domain: 'techcombank.com.vn',
            industry: 'Tài chính - Ngân hàng',
            companySize: 'Enterprise',
            city: 'Hà Nội',
            funnelStage: 'Won',
            score: 96,
            demographicScore: 42,
            behaviorScore: 54,
            tier: 'Hot',
            ownerId: 'mkt-01',
            ownerName: 'Nguyễn Văn A',
            salesId: 'sales-01',
            salesName: 'Trần Quốc Bảo',
            projectId: 'proj-lead-2026',
            projectName: 'LEAD GENERATION 2026',
            source: 'Executive Dinner Event',
            utmSource: 'event',
            utmMedium: 'vip_dinner',
            utmCampaign: 'c_level_q3_2026',
            isReturn: false,
            silentDays: 0,
            lastActivityAt: d(3),
            hasMissingData: false,
            missingFields: [],
            handoverScore: 90,
            handoverTier: 'Hot',
            handoverAt: d(45),
            handoverBy: 'Nguyễn Văn A',
            handoverSnapshot: {
              handoverScore: 90,
              tier: 'Hot',
              at: d(45).toISOString(),
              salesId: 'sales-01',
              salesName: 'Trần Quốc Bảo',
              note: 'VIP Lead từ sự kiện C-Level, chốt hợp đồng năm.',
              previousStage: 'SQL',
              newStage: 'Won',
            },
            journey: [],
            scoreHistory: [],
            ip: '113.161.72.42',
            cookieId: 'ck_2233445566778899',
            deviceId: 'fp_9900112233445566',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            tags: ['Won Deal', 'Banking VIP'],
          },
        ],
        skipDuplicates: true,
      });

      // 7. SLA Queue Items
      await this.prisma.slaQueueItem.createMany({
        data: [
          {
            id: 'sla-001',
            code: 'SLA-001',
            type: 'conflict',
            title: 'Xung đột Cookie ck_9f8a****3b1c map với 2 SĐT khác nhau',
            description:
              'Cookie ID ghi nhận 0901234567 và 0987654321 trong 24h. Không được auto-merge, cần MKT Ops phân xử thủ công.',
            entityType: 'anonymous_conflict',
            entityId: 'CONF-001',
            entityName: 'CONF-001 (ANON-884210 / ANON-884211)',
            priority: 'high',
            slaHours: 24,
            status: 'pending',
            dueAt: h(6), // Overdue by 6 hours -> triggers 4h overdue warning
            lastAlertAt: h(2),
            alertCount: 2,
            createdAt: h(30),
            metadata: {
              conflictCode: 'CONF-001',
              phones: ['0901234567', '0987654321'],
              keyType: 'cookie',
              maskedKey: 'ck_9f8a****3b1c',
            },
          },
          {
            id: 'sla-002',
            code: 'SLA-002',
            type: 'fuzzy_company',
            title: 'Nghi ngờ trùng tên công ty (Fuzzy Match 88%): FPT IS Chi nhánh TP.HCM',
            description:
              'Công ty "CTCP Hệ thống Thông tin FPT - Chi nhánh TP.HCM" (COMP-000105) khớp mờ với "Công ty Cổ phần Hệ thống Thông tin FPT" (COMP-000101). Chờ MKT xác nhận gộp.',
            entityType: 'company',
            entityId: 'COMP-000105',
            entityName: 'COMP-000105 -> COMP-000101',
            priority: 'high',
            slaHours: 24,
            status: 'pending',
            dueAt: new Date(now + 2.5 * 3600_000), // Due soon (<4h)
            createdAt: h(21.5),
            metadata: {
              fromCode: 'COMP-000105',
              toCode: 'COMP-000101',
              similarity: 0.88,
            },
          },
          {
            id: 'sla-003',
            code: 'SLA-003',
            type: 'missing_data',
            title: 'Thiếu dữ liệu định danh B2B: Lead Trần Thu Hà (LEAD-2026-004)',
            description:
              'Hồ sơ thiếu Email doanh nghiệp, Mã số thuế, Ngành nghề và Quy mô công ty (SLA bổ sung dữ liệu: 48h).',
            entityType: 'lead',
            entityId: 'LEAD-2026-004',
            entityName: 'Trần Thu Hà (0939778899)',
            priority: 'medium',
            slaHours: 48,
            status: 'processing',
            assigneeId: 'mkt-02',
            assigneeName: 'Lê Thị B',
            claimedAt: h(4),
            dueAt: new Date(now + 24 * 3600_000),
            createdAt: h(24),
            metadata: {
              leadCode: 'LEAD-2026-004',
              missingFields: ['email', 'taxCode', 'industry', 'companySize'],
            },
          },
          {
            id: 'sla-004',
            code: 'SLA-004',
            type: 'conflict',
            title: 'Xung đột Device fp_7d2e****90a4 tại sự kiện Tech Summit',
            description:
              'Thiết bị dùng chung ghi nhận 2 SĐT khác nhau (0912345678, 0938112233). Cần tách key hoặc xác nhận giữ riêng.',
            entityType: 'anonymous_conflict',
            entityId: 'CONF-002',
            entityName: 'CONF-002 (ANON-884213)',
            priority: 'medium',
            slaHours: 24,
            status: 'pending',
            dueAt: new Date(now + 14 * 3600_000),
            createdAt: h(10),
            metadata: {
              conflictCode: 'CONF-002',
              phones: ['0912345678', '0938112233'],
              keyType: 'device',
              maskedKey: 'fp_7d2e****90a4',
            },
          },
          {
            id: 'sla-005',
            code: 'SLA-005',
            type: 'ip_cluster',
            title: 'Xác nhận Cụm IP doanh nghiệp IPC-003 (FPT IS)',
            description: 'Đã xác nhận dải IP 203.162.***.100 thuộc văn phòng FPT IS.',
            entityType: 'ip_cluster',
            entityId: 'IPC-003',
            entityName: 'IPC-003 (FPT IS)',
            priority: 'low',
            slaHours: 24,
            status: 'done',
            assigneeId: 'mkt-01',
            assigneeName: 'Nguyễn Văn A',
            claimedAt: d(5),
            dueAt: d(4),
            resolvedAt: d(4),
            resolvedBy: 'mkt-01',
            resolvedByName: 'Nguyễn Văn A',
            resolution: 'confirmed',
            note: 'Đã đối chiếu ASN và domain email, xác nhận thuộc FPT IS.',
            createdAt: d(5),
          },
        ],
        skipDuplicates: true,
      });

      // 8. Initial Audit Trail entries
      await this.prisma.profileAuditLog.createMany({
        data: [
          {
            id: 'paudit-1',
            module: 'anonymous_profiles',
            action: 'convert',
            entityType: 'anonymous_profile',
            entityId: 'ANON-884209',
            actorId: 'mkt-01',
            actorName: 'Nguyễn Văn A',
            beforeData: { status: 'active', anonymousId: 'ANON-884209' },
            afterData: {
              status: 'converted',
              anonymousId: 'ANON-884209',
              convertedLeadId: 'LEAD-2026-001',
              phone: '0901234567',
              company: 'Công ty Cổ phần Hệ thống Thông tin FPT',
            },
            note: 'Chuyển đổi Hồ sơ ẩn danh ANON-884209 thành Lead LEAD-2026-001, giữ nguyên anonymousId để truy vết.',
            createdAt: d(4),
          },
          {
            id: 'paudit-2',
            module: 'anonymous_profiles',
            action: 'confirm_ip_cluster',
            entityType: 'ip_cluster',
            entityId: 'IPC-003',
            actorId: 'mkt-01',
            actorName: 'Nguyễn Văn A',
            beforeData: { status: 'pending', code: 'IPC-003' },
            afterData: {
              status: 'confirmed',
              code: 'IPC-003',
              companyCode: 'COMP-000101',
            },
            note: 'Xác nhận cụm IP thuộc Công ty Cổ phần Hệ thống Thông tin FPT.',
            createdAt: d(4),
          },
          {
            id: 'paudit-3',
            module: 'identified_profiles',
            action: 'handover',
            entityType: 'lead',
            entityId: 'LEAD-2026-001',
            actorId: 'mkt-01',
            actorName: 'Nguyễn Văn A',
            beforeData: { funnelStage: 'Raw Lead', salesId: null, score: 85 },
            afterData: {
              funnelStage: 'MQL',
              salesId: 'sales-01',
              salesName: 'Trần Quốc Bảo',
              handoverScore: 85,
              handoverTier: 'Hot',
            },
            note: 'Bàn giao Lead cho Sales Trần Quốc Bảo, tự động chuyển Raw Lead -> MQL.',
            createdAt: d(4),
          },
        ],
        skipDuplicates: true,
      });

      this.logger.log(
        'Seeded initial data for Anonymous Profiles, Identified Leads 360, Company Master & SLA Queue',
      );
    } catch (err) {
      this.logger.warn(`seedIfEmpty warning: ${err}`);
    }
  }

  async backfillTrackingData() {
    try {
      const now = Date.now();
      const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000);
      const d = (daysAgo: number) => new Date(now - daysAgo * 86400_000);

      // 1. Backfill serverKey, allowedOrigins, internalCidrs on seeded TrackingSites
      const siteDefaults: Record<
        string,
        {
          serverKey: string;
          allowedOrigins: string[];
          internalCidrs: string[];
          retentionDays: number;
        }
      > = {
        'SITE-001': {
          serverKey: 'sk_live_site001_secret_2026',
          allowedOrigins: [
            'https://mkthub.vn',
            'https://www.mkthub.vn',
            'http://localhost:3000',
            'http://localhost:5173',
          ],
          internalCidrs: ['10.0.0.0/8', '192.168.0.0/16'],
          retentionDays: 365,
        },
        'SITE-002': {
          serverKey: 'sk_live_site002_secret_2026',
          allowedOrigins: [
            'https://cloud.mkthub.vn',
            'https://mkthub.vn',
            'http://localhost:3000',
            'http://localhost:5173',
          ],
          internalCidrs: ['10.0.0.0/8', '192.168.0.0/16'],
          retentionDays: 365,
        },
        'SITE-003': {
          serverKey: 'sk_live_site003_secret_2026',
          allowedOrigins: [
            'https://docs.mkthub.vn',
            'https://mkthub.vn',
            'http://localhost:3000',
          ],
          internalCidrs: ['10.0.0.0/8', '192.168.0.0/16'],
          retentionDays: 365,
        },
        'SITE-TONGHOP': {
          serverKey: 'sk_live_tonghoplink_secret_2026',
          allowedOrigins: [
            'https://smartlog-event.github.io',
            'http://localhost:3000',
            'http://localhost:5173',
          ],
          internalCidrs: ['10.0.0.0/8', '192.168.0.0/16'],
          retentionDays: 365,
        },
      };

      const existingTonghop = await this.prisma.trackingSite.findFirst({
        where: { siteId: 'SITE-TONGHOP' },
      });
      if (!existingTonghop) {
        await this.prisma.trackingSite.create({
          data: {
            id: 'site-tonghop',
            siteId: 'SITE-TONGHOP',
            name: 'Smartlog Event - Tonghoplink',
            domain: 'smartlog-event.github.io',
            trackingKey: 'trk_live_tonghoplink_2026',
            serverKey: 'sk_live_tonghoplink_secret_2026',
            serverKeyHash: hashServerKey('sk_live_tonghoplink_secret_2026'),
            allowedOrigins: [
              'https://smartlog-event.github.io',
              'http://localhost:3000',
              'http://localhost:5173',
            ],
            internalCidrs: ['10.0.0.0/8', '192.168.0.0/16'],
            retentionDays: 365,
            isActive: true,
            eventsCount: 0,
            profilesCount: 0,
            lastPingAt: h(0.5),
          },
        });
      }

      const sites = await this.prisma.trackingSite.findMany();
      for (const s of sites) {
        const def = siteDefaults[s.siteId];
        if (def && !s.serverKeyHash) {
          await this.prisma.trackingSite.update({
            where: { id: s.id },
            data: {
              serverKey: def.serverKey,
              serverKeyHash: hashServerKey(def.serverKey),
              allowedOrigins: def.allowedOrigins,
              internalCidrs: def.internalCidrs,
              retentionDays: def.retentionDays,
            },
          });
        }
      }

      // 2. Backfill AnonymousProfile userType, engaged, firstTouch, lastTouch & ProfileIdentifiers
      const profiles = await this.prisma.anonymousProfile.findMany();
      for (const p of profiles) {
        const isReturning = (p.visitCount || 1) >= 2;
        const isEngaged =
          (p.totalDurationSec || 0) > 10 ||
          (p.pageViews || 0) >= 2 ||
          p.status === 'converted' ||
          p.status === 'identified';
        const firstTouch = p.firstTouch || {
          source: p.utmSource || 'direct',
          medium: p.utmMedium || 'none',
          campaign: p.utmCampaign || null,
          landingPath: Array.isArray(p.topPages) && (p.topPages as string[])[0] ? (p.topPages as string[])[0] : '/',
          touchedAt: p.firstSeenAt.toISOString(),
        };
        const lastTouch = p.lastTouch || {
          source: p.utmSource || 'direct',
          medium: p.utmMedium || 'none',
          campaign: p.utmCampaign || null,
          landingPath:
            Array.isArray(p.topPages) && (p.topPages as string[]).length > 0
              ? (p.topPages as string[])[(p.topPages as string[]).length - 1]
              : '/',
          touchedAt: p.lastSeenAt.toISOString(),
        };

        if (!p.firstTouch || !p.lastTouch) {
          await this.prisma.anonymousProfile.update({
            where: { id: p.id },
            data: {
              userType: isReturning ? 'returning' : 'new',
              engaged: isEngaged,
              firstTouch,
              lastTouch,
              companyConfidence: p.suspectedCompany ? 88 : 0,
            },
          });
        }

        const siteId = p.siteId || 'SITE-001';
        if (p.cookieId) {
          const existingCk = await this.prisma.profileIdentifier.findFirst({
            where: {
              siteId,
              keyType: 'cookie',
              keyValue: p.cookieId,
            },
          });
          if (!existingCk) {
            await this.prisma.profileIdentifier.create({
              data: {
                id: `pi-ck-${p.id}`,
                siteId,
                profileId: p.id,
                keyType: 'cookie',
                keyValue: p.cookieId,
                phone: p.identifiedPhone || null,
                firstSeenAt: p.firstSeenAt,
                lastSeenAt: p.lastSeenAt,
              },
            });
          }
        }
        if (p.deviceId) {
          const existingFp = await this.prisma.profileIdentifier.findFirst({
            where: {
              siteId,
              keyType: 'device',
              keyValue: p.deviceId,
            },
          });
          if (!existingFp) {
            await this.prisma.profileIdentifier.create({
              data: {
                id: `pi-fp-${p.id}`,
                siteId,
                profileId: p.id,
                keyType: 'device',
                keyValue: p.deviceId,
                phone: p.identifiedPhone || null,
                firstSeenAt: p.firstSeenAt,
                lastSeenAt: p.lastSeenAt,
              },
            });
          }
        }
      }

      // 3. Seed initial AnonymousAlerts if empty
      const alertCount = await this.prisma.anonymousAlert.count();
      if (alertCount === 0) {
        await this.prisma.anonymousAlert.createMany({
          data: [
            {
              id: 'alert-001',
              profileId: 'anon-1',
              type: 'website_return',
              severity: 'high',
              status: 'new',
              scoreAtCreation: 86,
              message:
                'Hồ sơ Hot ANON-884210 quay lại sau 7 ngày — Xem Bảng giá Enterprise (Ngân hàng TMCP Kỹ Thương Việt Nam)',
              createdAt: h(1.5),
            },
            {
              id: 'alert-002',
              profileId: 'anon-2',
              type: 'high_intent_pricing',
              severity: 'medium',
              status: 'new',
              scoreAtCreation: 78,
              message:
                'Tín hiệu mua hàng cao: ANON-884211 tính ROI cho 500 nhân sự trên Landing Page Cloud & AI',
              createdAt: h(3),
            },
          ],
          skipDuplicates: true,
        });
      }

      // 4. Seed initial LandingPageMappings if empty
      const lpCount = await this.prisma.landingPageMapping.count();
      if (lpCount === 0) {
        await this.prisma.landingPageMapping.createMany({
          data: [
            {
              id: 'lpm-001',
              siteId: 'SITE-001',
              landingPageId: 'LP-ENTERPRISE-2026',
              projectId: 'proj-lead-2026',
              eventProjectId: null,
              startAt: d(60),
            },
            {
              id: 'lpm-002',
              siteId: 'SITE-002',
              landingPageId: 'LP-CLOUD-AI-2026',
              projectId: 'proj-event-2026',
              eventProjectId: 'EVT-2026-01',
              startAt: d(30),
            },
          ],
          skipDuplicates: true,
        });
      }
    } catch (err) {
      this.logger.warn(`backfillTrackingData warning: ${err}`);
    }
  }
}
