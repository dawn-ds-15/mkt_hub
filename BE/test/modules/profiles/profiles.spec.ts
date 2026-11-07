import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ProfilesService } from '../../../src/modules/profiles/profiles.service';
import {
  companyNameSimilarity,
  computeSlaMetrics,
  maskCookie,
  maskDevice,
  maskIp,
  maskTrackingKey,
} from '../../../src/modules/profiles/utils/masking.util';
import {
  buildScriptInfo,
  buildTrackerScriptSource,
  computeEventScoreDelta,
  computeTierFromScore,
  hashServerKey,
  isBotUserAgent,
  isInternalClientIp,
  isIpInCidr,
  isOriginAllowedForSite,
  normalizeVietnamesePhone,
} from '../../../src/modules/profiles/utils/tracking.util';

describe('BE_requirement_24_10_26 — Anonymous Profiles, Leads 360, Company Master & SLA Queue', () => {
  describe('Masking & SLA Utilities (§4 & §5)', () => {
    it('masks IP, Cookie, Device Fingerprint, and Tracking Key properly', () => {
      expect(maskIp('113.161.72.45')).toBe('113.161.***.45');
      expect(maskCookie('ck_9f8a7b6c5d4e3b1c')).toBe('ck_9f8a****3b1c');
      expect(maskDevice('fp_7d2e1a4b8c9f90a4')).toBe('fp_7d2e****90a4');
      expect(maskTrackingKey('trk_live_9a8b7c6d5e4f1029')).toBe(
        'trk_live_****1029',
      );
    });

    it('calculates SLA overdue alerts every 4 hours (24h conflict, 48h missing data)', () => {
      const now = Date.now();
      const overdue6h = computeSlaMetrics({
        status: 'pending',
        dueAt: new Date(now - 6 * 3600_000),
        createdAt: new Date(now - 30 * 3600_000),
        slaHours: 24,
        type: 'conflict',
      });
      expect(overdue6h.isOverdue).toBe(true);
      expect(overdue6h.overdueAlertsCount).toBe(2); // 0h and +4h
      expect(overdue6h.slaState).toBe('overdue');

      const dueSoon2h = computeSlaMetrics({
        status: 'pending',
        dueAt: new Date(now + 2 * 3600_000),
        createdAt: new Date(now - 22 * 3600_000),
        slaHours: 24,
        type: 'fuzzy_company',
      });
      expect(dueSoon2h.isOverdue).toBe(false);
      expect(dueSoon2h.isDueSoon).toBe(true);
      expect(dueSoon2h.slaState).toBe('dueSoon');
    });

    it('computes fuzzy company name similarity accurately', () => {
      const sim = companyNameSimilarity(
        'Công ty Cổ phần Hệ thống Thông tin FPT',
        'CTCP Hệ thống Thông tin FPT Chi nhánh HCM',
      );
      expect(sim).toBeGreaterThan(0.65);
    });
  });

  describe('ProfilesService Business Rules (§1–§5)', () => {
    const createMockSetup = () => {
      const audits: any[] = [];
      const slaItems: any[] = [];
      const companies: any[] = [
        {
          id: 'comp-101',
          code: 'COMP-000101',
          name: 'Công ty Cổ phần Hệ thống Thông tin FPT',
          aliases: ['FPT IS'],
          taxCode: '0101248141',
          domain: 'fpt-is.com',
          industry: 'Công nghệ thông tin',
          city: 'Hà Nội',
          size: 'Enterprise',
          leadCount: 1,
          mqlCount: 0,
          sqlCount: 0,
          oppCount: 1,
          pipelineValue: 500_000_000,
          wonCount: 1,
          wonValue: 200_000_000,
          status: 'active',
        },
        {
          id: 'comp-105',
          code: 'COMP-000105',
          name: 'CTCP Hệ thống Thông tin FPT - Chi nhánh TP.HCM',
          aliases: ['FIS HCM'],
          taxCode: '0101248141-002',
          domain: 'hcm.fpt-is.com',
          industry: 'Công nghệ thông tin',
          city: 'TP.HCM',
          size: 'Enterprise',
          leadCount: 1,
          mqlCount: 0,
          sqlCount: 0,
          oppCount: 1,
          pipelineValue: 300_000_000,
          wonCount: 0,
          wonValue: 0,
          status: 'active',
        },
      ];

      const prisma: any = {
        member: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            name: 'Nguyễn Văn A',
            role: 'manager',
          }),
        },
        profileAuditLog: {
          create: jest.fn(async ({ data }) => {
            const row = { id: `audit-${audits.length + 1}`, ...data, createdAt: new Date() };
            audits.push(row);
            return row;
          }),
          findMany: jest.fn(async () => audits),
        },
        anonymousProfile: {
          findFirst: jest.fn(async () => ({
            id: 'anon-1',
            anonymousId: 'ANON-884210',
            cookieId: 'ck_9f8a7b6c5d4e3b1c',
            deviceId: 'fp_7d2e1a4b8c9f90a4',
            ip: '113.161.72.45',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            siteId: 'SITE-001',
            status: 'active',
            score: 80,
            tier: 'Hot',
            firstSeenAt: new Date('2026-10-10T00:00:00Z'),
            lastSeenAt: new Date('2026-10-24T00:00:00Z'),
            events: [],
          })),
          update: jest.fn(async ({ data }) => ({
            id: 'anon-1',
            anonymousId: 'ANON-884210',
            cookieId: 'ck_9f8a7b6c5d4e3b1c',
            deviceId: 'fp_7d2e1a4b8c9f90a4',
            ip: '113.161.72.45',
            ...data,
          })),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        anonymousConflict: {
          findFirst: jest.fn(async () => ({
            id: 'conf-1',
            code: 'CONF-001',
            keyType: 'cookie',
            keyValue: 'ck_9f8a7b6c5d4e3b1c',
            status: 'pending',
            phones: ['0901234567', '0987654321'],
            profiles: [],
            detectedAt: new Date(),
            slaDueAt: new Date(Date.now() + 12 * 3600_000),
          })),
          create: jest.fn(async ({ data }) => ({ id: 'conf-new', ...data })),
          update: jest.fn(async ({ data }) => ({
            id: 'conf-1',
            code: 'CONF-001',
            keyType: 'cookie',
            keyValue: 'ck_9f8a7b6c5d4e3b1c',
            phones: ['0901234567', '0987654321'],
            detectedAt: new Date(),
            slaDueAt: new Date(),
            ...data,
          })),
        },
        identifiedLead: {
          findMany: jest.fn(async () => []),
          findFirst: jest.fn(async () => ({
            id: 'lead-1',
            code: 'LEAD-2026-001',
            anonymousId: 'ANON-884210',
            name: 'Lê Hoàng Lan',
            phone: '0918223344',
            funnelStage: 'Raw Lead',
            score: 84,
            tier: 'Hot',
            companyCode: 'COMP-000101',
            journey: [],
          })),
          create: jest.fn(async ({ data }) => ({
            id: 'lead-created',
            ...data,
          })),
          update: jest.fn(async ({ data }) => ({
            id: 'lead-1',
            code: 'LEAD-2026-001',
            name: 'Lê Hoàng Lan',
            phone: '0918223344',
            score: 84,
            tier: 'Hot',
            ...data,
          })),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        companyMaster: {
          findMany: jest.fn(async () => companies),
          findFirst: jest.fn(async ({ where }) => {
            const codeOrId = where?.OR?.[0]?.code || where?.code;
            return companies.find((c) => c.code === codeOrId || c.id === codeOrId) || null;
          }),
          create: jest.fn(async ({ data }) => ({ id: 'comp-new', ...data })),
          update: jest.fn(async ({ where, data }) => {
            const target = companies.find((c) => c.id === where.id) || companies[0];
            return { ...target, ...data };
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        ipCluster: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        slaQueueItem: {
          findMany: jest.fn(async () => slaItems),
          findFirst: jest.fn(async () => ({
            id: 'sla-1',
            code: 'SLA-001',
            type: 'conflict',
            status: 'pending',
            slaHours: 24,
            dueAt: new Date(Date.now() + 4 * 3600_000),
            createdAt: new Date(),
          })),
          create: jest.fn(async ({ data }) => {
            const row = { id: `sla-${slaItems.length + 1}`, ...data };
            slaItems.push(row);
            return row;
          }),
          update: jest.fn(async ({ data }) => ({
            id: 'sla-1',
            code: 'SLA-001',
            type: 'conflict',
            slaHours: 24,
            dueAt: new Date(Date.now() + 4 * 3600_000),
            createdAt: new Date(),
            ...data,
          })),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        trackingSite: {
          findMany: jest.fn(async () => []),
          create: jest.fn(async ({ data }) => ({ id: 'site-1', ...data })),
        },
      };

      const auditService: any = { log: jest.fn().mockResolvedValue({}) };
      const permissionsService: any = {
        getAuthPermissions: jest.fn().mockResolvedValue({ view: true, edit: true }),
      };

      const service = new ProfilesService(prisma, auditService, permissionsService);
      return { service, prisma, audits, slaItems };
    };

    it('converts anonymous profile to Lead, keeps anonymousId, and logs audit (§1)', async () => {
      const { service, audits } = createMockSetup();
      const res = await service.convertAnonymousProfile(
        'ANON-884210',
        {
          phone: '0901234567',
          name: 'Nguyễn Văn Minh',
          company: 'Công ty Cổ phần Hệ thống Thông tin FPT',
          taxCode: '0101248141',
        },
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Nguyễn Văn A' },
      );

      expect(res.anonymousId).toBe('ANON-884210');
      expect(res.lead.anonymousId).toBe('ANON-884210');
      expect(res.lead.companyCode).toBe('COMP-000101');
      expect(audits.some((a) => a.action === 'convert')).toBe(true);
    });

    it('blocks auto-merge when 1 key maps to >= 2 phone numbers (§1)', async () => {
      const { service } = createMockSetup();
      await expect(
        service.resolveConflict('CONF-001', {
          action: 'merge',
          autoMerge: true,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resolveConflict('CONF-001', {
          action: 'merge',
          // missing primaryProfileId when 2 phones exist
        }),
      ).rejects.toThrow(BadRequestException);

      const resolved = await service.resolveConflict('CONF-001', {
        action: 'keep',
        note: 'Giữ riêng 2 hồ sơ',
      });
      expect(resolved.status).toBe('resolved');
    });

    it('handover saves snapshot (handoverScore/tier/at) and transitions Raw Lead -> MQL automatically (§2)', async () => {
      const { service, audits } = createMockSetup();
      const res = await service.handoverLead(
        'LEAD-2026-001',
        {
          salesId: 'sales-01',
          salesName: 'Trần Quốc Bảo',
          note: 'Bàn giao ngay',
        },
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Nguyễn Văn A' },
      );

      expect(res.funnelStage).toBe('MQL');
      expect(res.handoverScore).toBe(84);
      expect(res.handoverTier).toBe('Hot');
      expect(res.handoverSnapshot).toMatchObject({
        handoverScore: 84,
        tier: 'Hot',
        salesName: 'Trần Quốc Bảo',
        previousStage: 'Raw Lead',
        newStage: 'MQL',
      });
      expect(audits.some((a) => a.action === 'handover')).toBe(true);
    });

    it('merges companies (fromCode -> toCode), combines pipeline/won/aliases, updates leads, and logs audit (§3)', async () => {
      const { service, audits } = createMockSetup();
      const res = await service.mergeCompanies(
        {
          fromCode: 'COMP-000105',
          toCode: 'COMP-000101',
          note: 'MKT xác nhận cùng pháp nhân FPT IS',
        },
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Nguyễn Văn A' },
      );

      expect(res.code).toBe('COMP-000101');
      expect(res.pipelineValue).toBe(800_000_000);
      expect(res.aliases).toContain('FIS HCM');
      expect(res.reassignedLeadsCount).toBe(2);
      expect(audits.some((a) => a.action === 'merge_company')).toBe(true);
    });

    it('creates tracking site with auto-generated siteId and masked trackingKey (§1)', async () => {
      const { service, audits } = createMockSetup();
      const res = await service.createTrackingSite({
        name: 'Microsite AI',
        domain: 'https://ai.mkthub.vn',
      });
      expect(res.siteId).toMatch(/^SITE-\d{3}$/);
      expect(res.trackingKey).toContain('****');
      expect(audits.some((a) => a.action === 'create_site')).toBe(true);
    });

    it('claims, resolves, skips, and exports SLA queue items with mandatory audit (§4)', async () => {
      const { service, audits } = createMockSetup();
      const claimed = await service.claimSlaItem('SLA-001', {
        id: 'u1',
        name: 'Lê Thị B',
      });
      expect(claimed.status).toBe('processing');

      const resolved = await service.resolveSlaItem(
        'SLA-001',
        { note: 'Đã xử lý xong', resolution: 'merged' },
        { id: 'u1', name: 'Lê Thị B' },
      );
      expect(resolved.status).toBe('done');

      const exported = await service.exportSlaQueue({}, { id: 'u1', name: 'Lê Thị B' });
      expect(exported.filename).toContain('sla-queue-export');
      expect(exported.buffer.length).toBeGreaterThan(10);
      expect(audits.some((a) => a.action === 'claim_sla')).toBe(true);
      expect(audits.some((a) => a.action === 'resolve_sla')).toBe(true);
      expect(audits.some((a) => a.action === 'export_sla')).toBe(true);
    });
  });

  describe('05-backend-anonymous-tracking-implementation.md (§5–§10)', () => {
    it('normalizes Vietnamese phone numbers & rejects invalid/fake numbers (§5.3 & §10.1)', () => {
      expect(normalizeVietnamesePhone('+84 912-345-678')).toBe('0912345678');
      expect(normalizeVietnamesePhone('84987654321')).toBe('0987654321');
      expect(normalizeVietnamesePhone('0901.234.567')).toBe('0901234567');
      expect(normalizeVietnamesePhone('0900000000')).toBeNull();
      expect(normalizeVietnamesePhone('0999999999')).toBeNull();
      expect(normalizeVietnamesePhone('12345')).toBeNull();
    });

    it('detects bot user-agents, internal CIDRs, allowed origins, and scoring rules (§6 & §10.1)', () => {
      expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
      expect(isBotUserAgent('HeadlessChrome/120.0.0.0')).toBe(true);
      expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0')).toBe(false);

      expect(isIpInCidr('10.20.30.40', '10.0.0.0/8')).toBe(true);
      expect(isIpInCidr('113.161.72.45', '10.0.0.0/8')).toBe(false);
      expect(isInternalClientIp('192.168.1.99', ['10.0.0.0/8', '192.168.0.0/16'])).toBe(true);

      expect(
        isOriginAllowedForSite('https://mkthub.vn', {
          domain: 'https://mkthub.vn',
          allowedOrigins: ['https://mkthub.vn', 'https://cloud.mkthub.vn'],
        }),
      ).toBe(true);
      expect(
        isOriginAllowedForSite('https://evil.example.com', {
          domain: 'https://mkthub.vn',
          allowedOrigins: ['https://mkthub.vn'],
        }),
      ).toBe(false);

      expect(computeEventScoreDelta('pricing_view')).toBe(20);
      expect(computeEventScoreDelta('form_submit')).toBe(25);
      expect(computeTierFromScore(80)).toBe('Hot');
      expect(computeTierFromScore(55)).toBe('Warm');
      expect(computeTierFromScore(20)).toBe('Cold');

      const scriptInfo = buildScriptInfo('SITE-001', 'trk_live_1234567890');
      expect(scriptInfo.snippet).toContain('SITE-001');
      expect(scriptInfo.snippet).toContain('trk_live_1234567890');
      expect(buildTrackerScriptSource()).toContain('MKTHubTracker');
    });

    const createTrackingMockSetup = () => {
      const eventsStore: any[] = [];
      const sessionsStore: any[] = [];
      const profilesStore: any[] = [];
      const identifiersStore: any[] = [];
      const alertsStore: any[] = [];
      const conflictsStore: any[] = [];
      const auditsStore: any[] = [];
      const touchpointsStore: any[] = [];
      const ipClustersStore: any[] = [];

      const activeSite: any = {
        id: 'site-1',
        siteId: 'SITE-001',
        name: 'Website Chính MKT Hub',
        domain: 'https://mkthub.vn',
        trackingKey: 'trk_live_9a8b7c6d5e4f1029',
        serverKey: 'srv_live_9a8b7c6d5e4f1029abcdef01',
        serverKeyHash: '',
        allowedOrigins: ['https://mkthub.vn'],
        internalCidrs: ['10.0.0.0/8'],
        retentionDays: 180,
        isActive: true,
        status: 'active',
        eventsCount: 10,
        profilesCount: 2,
      };

      const prisma: any = {
        member: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            name: 'Nguyễn Văn A',
            role: 'admin',
          }),
        },
        profileAuditLog: {
          create: jest.fn(async ({ data }) => {
            const row = { id: `aud-${auditsStore.length + 1}`, ...data, createdAt: new Date() };
            auditsStore.push(row);
            return row;
          }),
        },
        trackingSite: {
          findFirst: jest.fn(async ({ where }) => {
            if (where?.siteId && where.siteId !== activeSite.siteId) return null;
            return activeSite;
          }),
          update: jest.fn(async ({ data }) => {
            Object.assign(activeSite, data);
            return activeSite;
          }),
          findMany: jest.fn(async () => [activeSite]),
        },
        trackingEvent: {
          findFirst: jest.fn(async ({ where }) => {
            return eventsStore.find((e) => e.eventId === where?.eventId) || null;
          }),
          findUnique: jest.fn(async ({ where }) => {
            return eventsStore.find((e) => e.eventId === where.eventId) || null;
          }),
          create: jest.fn(async ({ data }) => {
            eventsStore.push(data);
            return data;
          }),
          findMany: jest.fn(async () => eventsStore),
          count: jest.fn(async () => eventsStore.length),
          deleteMany: jest.fn(async () => ({ count: 2 })),
        },
        trackingSession: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              sessionsStore.find(
                (s) =>
                  (s.profileId === where?.profileId ||
                    s.anonymousId === where?.anonymousId) &&
                  s.siteId === where?.siteId,
              ) || null
            );
          }),
          create: jest.fn(async ({ data }) => {
            const row = { id: `sess-${sessionsStore.length + 1}`, ...data };
            sessionsStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target = sessionsStore.find((s) => s.id === where.id) || sessionsStore[0];
            if (target) Object.assign(target, data);
            return target;
          }),
          findMany: jest.fn(async () => sessionsStore),
          deleteMany: jest.fn(async () => ({ count: 1 })),
        },
        profileIdentifier: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              identifiersStore.find(
                (i) => i.keyType === where?.keyType && i.keyValue === where?.keyValue,
              ) || null
            );
          }),
          findMany: jest.fn(async ({ where }) => {
            if (!where) return identifiersStore;
            return identifiersStore.filter(
              (i) => i.keyType === where.keyType && i.keyValue === where.keyValue,
            );
          }),
          create: jest.fn(async ({ data }) => {
            const row = { id: `id-${identifiersStore.length + 1}`, ...data };
            identifiersStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target =
              identifiersStore.find((i) => i.id === where.id) || identifiersStore[0];
            if (target) Object.assign(target, data);
            return target;
          }),
          updateMany: jest.fn(async () => ({ count: 1 })),
        },
        anonymousProfile: {
          count: jest.fn(async () => profilesStore.length),
          findFirst: jest.fn(async ({ where }) => {
            return (
              profilesStore.find(
                (p) =>
                  p.anonymousId === where?.anonymousId ||
                  p.cookieId === where?.cookieId ||
                  p.deviceId === where?.deviceId ||
                  p.id === where?.OR?.[0]?.id ||
                  p.anonymousId === where?.OR?.[1]?.anonymousId,
              ) ||
              profilesStore[0] ||
              null
            );
          }),
          findMany: jest.fn(async () => profilesStore),
          create: jest.fn(async ({ data }) => {
            const row = { id: `anon-${profilesStore.length + 1}`, ...data };
            profilesStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target =
              profilesStore.find((p) => p.id === where.id || p.anonymousId === where.anonymousId) ||
              profilesStore[0];
            if (target) Object.assign(target, data);
            return target;
          }),
          updateMany: jest.fn(async () => ({ count: 1 })),
          deleteMany: jest.fn(async () => ({ count: 1 })),
        },
        profileTouchpoint: {
          create: jest.fn(async ({ data }) => {
            touchpointsStore.push(data);
            return data;
          }),
          findMany: jest.fn(async () => touchpointsStore),
        },
        ipCluster: {
          findFirst: jest.fn(async () => ipClustersStore[0] || null),
          create: jest.fn(async ({ data }) => {
            const row = { id: 'ipc-1', ...data };
            ipClustersStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ data }) => {
            if (ipClustersStore[0]) Object.assign(ipClustersStore[0], data);
            return ipClustersStore[0];
          }),
          findMany: jest.fn(async () => ipClustersStore),
        },
        ipSession: {
          create: jest.fn(async ({ data }) => data),
          deleteMany: jest.fn(async () => ({ count: 1 })),
        },
        anonymousAlert: {
          findFirst: jest.fn(async ({ where }) => {
            if (where?.id) return alertsStore.find((a) => a.id === where.id) || null;
            return null;
          }),
          create: jest.fn(async ({ data }) => {
            const row = { id: data.id || `ALT-00${alertsStore.length + 1}`, ...data };
            alertsStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const row = alertsStore.find((a) => a.id === where.id) || alertsStore[0];
            if (row) Object.assign(row, data);
            return row;
          }),
          findMany: jest.fn(async () => alertsStore),
        },
        anonymousConflict: {
          count: jest.fn(async () => conflictsStore.length),
          findFirst: jest.fn(async ({ where }) => {
            return (
              conflictsStore.find(
                (c) =>
                  c.code === where?.OR?.[1]?.code ||
                  c.id === where?.OR?.[0]?.id ||
                  (c.keyType === where?.keyType && c.keyValue === where?.keyValue),
              ) ||
              conflictsStore[0] ||
              null
            );
          }),
          create: jest.fn(async ({ data }) => {
            const row = { id: `conf-${conflictsStore.length + 1}`, ...data };
            conflictsStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const row = conflictsStore.find((c) => c.id === where.id) || conflictsStore[0];
            if (row) Object.assign(row, data);
            return row;
          }),
          findMany: jest.fn(async () => conflictsStore),
        },
        slaQueueItem: {
          count: jest.fn(async () => 0),
          findMany: jest.fn(async () => []),
          create: jest.fn(async ({ data }) => data),
          updateMany: jest.fn(async () => ({ count: 1 })),
        },
        identifiedLead: {
          count: jest.fn(async () => 0),
          findMany: jest.fn(async () => []),
          findFirst: jest.fn(async () => null),
          create: jest.fn(async ({ data }) => ({ id: 'lead-1', ...data })),
          update: jest.fn(async ({ data }) => ({ id: 'lead-1', ...data })),
        },
        companyMaster: {
          findMany: jest.fn(async () => []),
        },
        landingPageMapping: {
          findFirst: jest.fn(async () => null),
          findMany: jest.fn(async () => []),
          create: jest.fn(async ({ data }) => ({ id: 'lpm-1', ...data })),
        },
      };

      const auditService: any = { log: jest.fn().mockResolvedValue({}) };
      const permissionsService: any = {
        getAuthPermissions: jest.fn().mockResolvedValue({ view: true, edit: true }),
      };

      const service = new ProfilesService(prisma, auditService, permissionsService);
      return {
        service,
        prisma,
        activeSite,
        eventsStore,
        sessionsStore,
        profilesStore,
        identifiersStore,
        alertsStore,
        conflictsStore,
        auditsStore,
      };
    };

    it('collectEvents handles idempotency, firstTouch preservation, late events, and hot_anonymous alerts (§5.2 & §6)', async () => {
      const { service, eventsStore, profilesStore, alertsStore } = createTrackingMockSetup();
      const t1 = new Date(Date.now() - 10 * 60_000).toISOString();
      const t2 = new Date(Date.now() - 5 * 60_000).toISOString();
      const t3 = new Date(Date.now() - 4 * 60_000).toISOString();
      const t4 = new Date(Date.now() - 1 * 60_000).toISOString();

      const batch1 = await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          cookieId: 'ck_visitor_001',
          deviceId: 'fp_visitor_001',
          events: [
            {
              eventId: 'evt-001',
              type: 'pricing_view',
              timestamp: t1,
              url: 'https://mkthub.vn/bang-gia?utm_source=Google_Ads&utm_campaign=Q4_Launch',
              path: '/bang-gia',
            },
            {
              eventId: 'evt-002',
              type: 'form_submit',
              timestamp: t2,
              url: 'https://mkthub.vn/bang-gia',
              path: '/bang-gia',
            },
            {
              eventId: 'evt-003',
              type: 'document_download',
              timestamp: t3,
              url: 'https://mkthub.vn/tai-lieu',
              path: '/tai-lieu',
            },
          ],
        },
        {
          clientIp: '113.161.72.45',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          origin: 'https://mkthub.vn',
        },
      );

      expect(batch1.accepted).toBe(3);
      expect(batch1.deduped).toBe(0);
      expect(eventsStore.length).toBe(3);
      expect(profilesStore.length).toBe(1);
      // 35 base + 20 + 25 + 15 = 95 -> Hot -> triggers hot_anonymous alert
      expect(profilesStore[0].score).toBeGreaterThanOrEqual(75);
      expect(profilesStore[0].tier).toBe('Hot');
      expect(alertsStore.some((a) => a.type === 'hot_anonymous')).toBe(true);

      // Re-sending evt-001 is deduped, and sending a later event updates lastTouch without overwriting firstTouch
      const batch2 = await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          cookieId: 'ck_visitor_001',
          deviceId: 'fp_visitor_001',
          events: [
            {
              eventId: 'evt-001',
              type: 'pricing_view',
              timestamp: t1,
            },
            {
              eventId: 'evt-004',
              type: 'page_view',
              timestamp: t4,
              url: 'https://mkthub.vn/blog?utm_source=Facebook_Ads&utm_campaign=Retarget',
              path: '/blog',
            },
          ],
        },
        {
          clientIp: '113.161.72.45',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          origin: 'https://mkthub.vn',
        },
      );

      expect(batch2.accepted).toBe(1);
      expect(batch2.deduped).toBe(1);
      expect(profilesStore[0].firstTouch?.utmSource).toBe('Google_Ads');
      expect(profilesStore[0].lastTouch?.utmSource).toBe('Facebook_Ads');
    });

    it('collectEvents ignores bot traffic, internal IP CIDR, and inactive site (§5.2 & §6.8)', async () => {
      const { service, activeSite } = createTrackingMockSetup();

      const botRes = await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          events: [{ eventId: 'evt-bot', type: 'page_view' }],
        },
        {
          clientIp: '113.161.72.45',
          userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          origin: 'https://mkthub.vn',
        },
      );
      expect(botRes.ignoredReason).toBe('bot_traffic');

      const internalIpRes = await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          events: [{ eventId: 'evt-int', type: 'page_view' }],
        },
        {
          clientIp: '10.10.1.25',
          userAgent: 'Mozilla/5.0 Chrome/120.0',
          origin: 'https://mkthub.vn',
        },
      );
      expect(internalIpRes.ignoredReason).toBe('internal_ip');

      activeSite.status = 'inactive';
      const inactiveRes = await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          events: [{ eventId: 'evt-inact', type: 'page_view' }],
        },
        {
          clientIp: '113.161.72.45',
          userAgent: 'Mozilla/5.0 Chrome/120.0',
          origin: 'https://mkthub.vn',
        },
      );
      expect(inactiveRes.ignoredReason).toBe('site_inactive');
    });

    it('identifyVisitor validates phone, converts clean profile, and creates conflict (without auto-merge) on 2nd phone (§5.3 & §6.5)', async () => {
      const { service, profilesStore, conflictsStore } = createTrackingMockSetup();

      // Create initial anonymous profile via collect
      await service.collectEvents(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          cookieId: 'ck_shared_device',
          deviceId: 'fp_shared_device',
          events: [{ eventId: 'evt-init-1', type: 'page_view' }],
        },
        {
          clientIp: '113.161.72.45',
          userAgent: 'Mozilla/5.0 Chrome/120.0',
          origin: 'https://mkthub.vn',
        },
      );

      // Invalid phone -> 422 UnprocessableEntityException
      await expect(
        service.identifyVisitor(
          {
            siteId: 'SITE-001',
            trackingKey: 'trk_live_9a8b7c6d5e4f1029',
            cookieId: 'ck_shared_device',
            phone: '0900000000',
          },
          { origin: 'https://mkthub.vn' },
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      // 1st valid phone -> identified / converted
      const id1 = await service.identifyVisitor(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          cookieId: 'ck_shared_device',
          deviceId: 'fp_shared_device',
          phone: '+84 912 345 678',
          name: 'Trần Văn X',
        },
        { origin: 'https://mkthub.vn' },
      );
      expect(id1.status).toBe('identified');
      expect(id1.conflictCode).toBeNull();

      // 2nd distinct phone on same cookieId -> conflict_created (never auto-merged!)
      const id2 = await service.identifyVisitor(
        {
          siteId: 'SITE-001',
          trackingKey: 'trk_live_9a8b7c6d5e4f1029',
          cookieId: 'ck_shared_device',
          deviceId: 'fp_shared_device',
          phone: '0987654321',
          name: 'Lê Thị Y',
        },
        { origin: 'https://mkthub.vn' },
      );
      expect(id2.status).toBe('conflict');
      expect(id2.conflictCode).toMatch(/^CONF-\d{3}$/);
      expect(conflictsStore.length).toBe(1);
      expect(profilesStore[0].hasConflict).toBe(true);
    });

    it('supports getTrackingSiteScript, rotateTrackingSiteKeys, undoConflict, and runRetentionCleanup (§5.1, §5.4, §9)', async () => {
      const { service, conflictsStore, auditsStore } = createTrackingMockSetup();

      const script = await service.getTrackingSiteScript('SITE-001', {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Admin',
      });
      expect(script.trackingKey).toBe('trk_live_9a8b7c6d5e4f1029');
      expect(script.snippet).toContain('<script async src=');

      const rotated = await service.rotateTrackingSiteKeys('SITE-001', {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Admin',
      });
      expect(rotated.trackingKey).not.toBe('trk_live_9a8b7c6d5e4f1029');
      expect(rotated.serverKey).toMatch(/^(srv|sk)_live_/);

      // Seed a resolved conflict within 7 days and undo it
      conflictsStore.push({
        id: 'conf-undo-1',
        code: 'CONF-999',
        keyType: 'cookie',
        keyValue: 'ck_undo',
        status: 'resolved',
        resolution: 'keep',
        detectedAt: new Date(Date.now() - 10 * 3600_000),
        slaDueAt: new Date(Date.now() + 14 * 3600_000),
        resolvedAt: new Date(Date.now() - 2 * 3600_000),
        undoExpiresAt: new Date(Date.now() + 5 * 86400_000),
        undoPayload: {
          previousConflictStatus: 'pending',
          profilesBefore: [],
        },
        phones: ['0912345678', '0987654321'],
        profiles: [],
      });

      const undone = await service.undoConflict(
        'CONF-999',
        { note: 'Hoàn tác quyết định' },
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Admin' },
      );
      expect(undone.status).toBe('pending');
      expect(auditsStore.some((a) => a.action === 'undo_conflict')).toBe(true);

      const cleanup = await service.runRetentionCleanup();
      expect(cleanup).toHaveProperty('deletedEvents');
      expect(cleanup).toHaveProperty('deletedProfiles');
    });
  });

  // =========================================================================
  // 06-be-request-lead-from-tonghoplink.md — POST /api/v1/leads/from-event-site
  // =========================================================================
  describe('POST /api/v1/leads/from-event-site (06-be-request-lead-from-tonghoplink.md)', () => {
    const createTonghoplinkMockSetup = () => {
      const eventsStore: any[] = [];
      const sessionsStore: any[] = [];
      const profilesStore: any[] = [];
      const identifiersStore: any[] = [];
      const conflictsStore: any[] = [];
      const slaStore: any[] = [];
      const leadsStore: any[] = [];
      const auditsStore: any[] = [];

      const tonghopSite: any = {
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
        ],
        internalCidrs: ['10.0.0.0/8'],
        retentionDays: 365,
        isActive: true,
        status: 'active',
        eventsCount: 0,
        profilesCount: 0,
      };

      const prisma: any = {
        member: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        profileAuditLog: {
          create: jest.fn(async ({ data }) => {
            const row = {
              id: `aud-${auditsStore.length + 1}`,
              ...data,
              createdAt: new Date(),
            };
            auditsStore.push(row);
            return row;
          }),
        },
        trackingSite: {
          findFirst: jest.fn(async ({ where }) => {
            const targetId =
              where?.siteId ||
              where?.OR?.[0]?.siteId ||
              where?.OR?.[1]?.id ||
              '';
            if (targetId && targetId !== tonghopSite.siteId && targetId !== tonghopSite.id) {
              return null;
            }
            return tonghopSite;
          }),
          update: jest.fn(async ({ data }) => {
            if (data?.eventsCount?.increment) {
              tonghopSite.eventsCount += data.eventsCount.increment;
            }
            return tonghopSite;
          }),
          findMany: jest.fn(async () => [tonghopSite]),
        },
        trackingEvent: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              eventsStore.find((e) => e.eventId === where?.eventId) || null
            );
          }),
          create: jest.fn(async ({ data }) => {
            const row = { id: `ev-${eventsStore.length + 1}`, ...data };
            eventsStore.push(row);
            return row;
          }),
          findMany: jest.fn(async ({ where }) => {
            if (where?.eventType) {
              return eventsStore.filter((e) => e.eventType === where.eventType);
            }
            return eventsStore;
          }),
        },
        trackingSession: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              sessionsStore.find(
                (s) =>
                  s.clientSessionId === where?.OR?.[0]?.clientSessionId ||
                  s.id === where?.OR?.[1]?.id ||
                  s.profileId === where?.profileId,
              ) || null
            );
          }),
          findMany: jest.fn(async ({ where }) => {
            if (where?.profileId) {
              return sessionsStore.filter(
                (s) => s.profileId === where.profileId,
              );
            }
            return sessionsStore;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target = sessionsStore.find((s) => s.id === where.id);
            if (target) Object.assign(target, data);
            return target;
          }),
        },
        profileIdentifier: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              identifiersStore.find(
                (i) =>
                  i.keyType === where?.keyType &&
                  i.keyValue === where?.keyValue &&
                  (!where?.siteId || i.siteId === where.siteId),
              ) || null
            );
          }),
          findMany: jest.fn(async ({ where }) => {
            if (where?.profileId) {
              return identifiersStore.filter(
                (i) => i.profileId === where.profileId,
              );
            }
            if (Array.isArray(where?.OR)) {
              return identifiersStore.filter((i) =>
                where.OR.some(
                  (c: any) =>
                    c.keyType === i.keyType && c.keyValue === i.keyValue,
                ),
              );
            }
            return identifiersStore;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target = identifiersStore.find((i) => i.id === where.id);
            if (target) Object.assign(target, data);
            return target;
          }),
        },
        anonymousProfile: {
          findFirst: jest.fn(async ({ where }) => {
            return (
              profilesStore.find((p) => {
                if (where?.id && p.id === where.id) return true;
                if (where?.cookieId && p.cookieId === where.cookieId)
                  return true;
                if (where?.deviceId && p.deviceId === where.deviceId)
                  return true;
                return false;
              }) || null
            );
          }),
          findMany: jest.fn(async ({ where }) => {
            if (Array.isArray(where?.OR)) {
              return profilesStore.filter((p) =>
                where.OR.some(
                  (c: any) =>
                    (c.cookieId && p.cookieId === c.cookieId) ||
                    (c.deviceId && p.deviceId === c.deviceId),
                ),
              );
            }
            return profilesStore;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target = profilesStore.find((p) => p.id === where.id);
            if (target) Object.assign(target, data);
            return target;
          }),
        },
        anonymousConflict: {
          findMany: jest.fn(async () => conflictsStore),
          create: jest.fn(async ({ data }) => {
            const row = { id: `conf-${conflictsStore.length + 1}`, ...data };
            conflictsStore.push(row);
            return row;
          }),
        },
        slaQueueItem: {
          findMany: jest.fn(async () => slaStore),
          create: jest.fn(async ({ data }) => {
            const row = { id: `sla-${slaStore.length + 1}`, ...data };
            slaStore.push(row);
            return row;
          }),
        },
        identifiedLead: {
          findMany: jest.fn(async ({ where }) => {
            if (Array.isArray(where?.OR)) {
              return leadsStore.filter((l) =>
                where.OR.some(
                  (c: any) =>
                    (c.cookieId && l.cookieId === c.cookieId) ||
                    (c.deviceId && l.deviceId === c.deviceId),
                ),
              );
            }
            return leadsStore;
          }),
          findFirst: jest.fn(async ({ where }) => {
            return (
              leadsStore.find(
                (l) =>
                  l.phone === where?.phone &&
                  (where?.mergedIntoId === undefined ||
                    l.mergedIntoId === where.mergedIntoId),
              ) || null
            );
          }),
          create: jest.fn(async ({ data }) => {
            const row = {
              id: `lead-${leadsStore.length + 1}`,
              mergedIntoId: null,
              ...data,
            };
            leadsStore.push(row);
            return row;
          }),
          update: jest.fn(async ({ where, data }) => {
            const target = leadsStore.find((l) => l.id === where.id);
            if (target) Object.assign(target, data);
            return target;
          }),
        },
        companyMaster: {
          findMany: jest.fn(async () => []),
        },
        landingPageMapping: {
          findFirst: jest.fn(async () => null),
        },
      };

      const auditService: any = { log: jest.fn().mockResolvedValue({}) };
      const permissionsService: any = {
        getAuthPermissions: jest
          .fn()
          .mockResolvedValue({ view: true, edit: true }),
      };

      const service = new ProfilesService(
        prisma,
        auditService,
        permissionsService,
      );

      const defaultHeaders = {
        siteId: 'SITE-TONGHOP',
        serverKey: 'sk_live_tonghoplink_secret_2026',
        origin: 'https://smartlog-event.github.io',
        clientIp: '113.161.72.99',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      return {
        service,
        tonghopSite,
        defaultHeaders,
        eventsStore,
        sessionsStore,
        profilesStore,
        identifiersStore,
        conflictsStore,
        slaStore,
        leadsStore,
        auditsStore,
      };
    };

    it('EVT-001 & EVT-002: creates new IdentifiedLead with source="tonghoplink" on new phone, and updates only empty fields on existing phone', async () => {
      const { service, defaultHeaders, leadsStore } =
        createTonghoplinkMockSetup();

      // EVT-001: New lead with +84 phone format & whitespace in name/email
      const res1 = await service.createLeadFromEventSite(
        {
          eventId: 'evt-001',
          fullName: '  Nguyễn   Văn  A ',
          phone: '+84 909 123 456',
          email: '  NguyenVanA@Company.vn ',
          company: '',
          eventCode: 'EVT-2026-LOGISTICS-AI',
          utm: {
            source: 'facebook',
            medium: 'cpc',
            campaign: 'logistics_summit_q2',
          },
        },
        defaultHeaders,
      );

      expect(res1.data.created).toBe(true);
      expect(res1.data.updated).toBe(false);
      expect(res1.data.leadCode).toMatch(/^LEAD-2026-\d{3}$/);
      expect(res1.data.eventCounted).toBe(true);
      expect(res1.data.registrationId).toMatch(/^REG-2026-\d{4}$/);
      expect(res1.data.duplicate).toBe(false);
      expect(leadsStore).toHaveLength(1);
      expect(leadsStore[0].phone).toBe('0909123456');
      expect(leadsStore[0].name).toBe('Nguyễn Văn A');
      expect(leadsStore[0].email).toBe('nguyenvana@company.vn');
      expect(leadsStore[0].source).toBe('facebook');
      expect(leadsStore[0].companyName).toBeNull();

      // EVT-002: Same phone submits again with different name/email + new company & title
      // Existing name & email must NOT be overwritten; empty company & title MUST be filled!
      const res2 = await service.createLeadFromEventSite(
        {
          eventId: 'evt-002',
          fullName: 'Tên Khác Không Ghi Đè',
          phone: '0909-123-456',
          email: 'other@company.vn',
          company: 'Công ty TNHH Logistics ABC',
          title: 'Supply Chain Manager',
          eventCode: 'EVT-2026-WAREHOUSE-AUTO',
        },
        defaultHeaders,
      );

      expect(res2.data.created).toBe(false);
      expect(res2.data.updated).toBe(true);
      expect(res2.data.leadId).toBe(res1.data.leadId);
      expect(res2.data.eventCounted).toBe(true);
      expect(leadsStore).toHaveLength(1);
      expect(leadsStore[0].name).toBe('Nguyễn Văn A');
      expect(leadsStore[0].email).toBe('nguyenvana@company.vn');
      expect(leadsStore[0].companyName).toBe('Công ty TNHH Logistics ABC');
      expect(leadsStore[0].title).toBe('Supply Chain Manager');
    });

    it('EVT-003 & EVT-010: links and converts AnonymousProfile when cookieId matches, or creates Lead cleanly when tracker is blocked (no cookieId/deviceId)', async () => {
      const {
        service,
        defaultHeaders,
        profilesStore,
        identifiersStore,
        sessionsStore,
      } = createTonghoplinkMockSetup();

      profilesStore.push({
        id: 'anon-123',
        anonymousId: 'ANON-884900',
        siteId: 'SITE-TONGHOP',
        cookieId: 'ck_9f8a7b6c5d4e3f2a',
        deviceId: 'fp_1a2b3c4d5e6f7a8b',
        status: 'active',
        score: 65,
        tier: 'Warm',
        events: [
          {
            id: 'ev-a1',
            type: 'page_view',
            title: 'Xem trang Sự kiện Logistics 2026',
            page: '/tonghoplink/index.html',
            scoreDelta: 10,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      identifiersStore.push({
        id: 'pi-123',
        siteId: 'SITE-TONGHOP',
        profileId: 'anon-123',
        keyType: 'cookie',
        keyValue: 'ck_9f8a7b6c5d4e3f2a',
        phone: null,
        conflictLocked: false,
      });
      sessionsStore.push({
        id: 'ses-123',
        siteId: 'SITE-TONGHOP',
        profileId: 'anon-123',
        clientSessionId: 'ses_20260417_abcd',
        converted: false,
        engaged: false,
      });

      // EVT-003: Submit with cookieId
      const resConvert = await service.createLeadFromEventSite(
        {
          eventId: 'evt-003',
          fullName: 'Trần Thị B',
          phone: '0912345678',
          cookieId: 'ck_9f8a7b6c5d4e3f2a',
          deviceId: 'fp_1a2b3c4d5e6f7a8b',
          sessionId: 'ses_20260417_abcd',
        },
        defaultHeaders,
      );

      expect(resConvert.data.created).toBe(true);
      expect(resConvert.data.converted).toBe(true);
      expect(resConvert.data.anonymousProfileId).toBe('anon-123');
      expect(profilesStore[0].status).toBe('identified');
      expect(profilesStore[0].convertedLeadId).toBe(resConvert.data.leadCode);
      expect(identifiersStore[0].phone).toBe('0912345678');
      expect(sessionsStore[0].converted).toBe(true);

      // EVT-010: Submit without cookieId/deviceId (AdBlock / no tracker)
      const resNoTracker = await service.createLeadFromEventSite(
        {
          eventId: 'evt-010',
          fullName: 'Lê Văn C',
          phone: '0987654321',
        },
        defaultHeaders,
      );

      expect(resNoTracker.data.created).toBe(true);
      expect(resNoTracker.data.converted).toBe(false);
      expect(resNoTracker.data.anonymousProfileId).toBeNull();
    });

    it('EVT-004 & EVT-005: deduplicates event registrations by phone + eventCode and enforces idempotency by eventId', async () => {
      const { service, defaultHeaders, leadsStore } =
        createTonghoplinkMockSetup();

      const first = await service.createLeadFromEventSite(
        {
          eventId: 'evt-idempotent-1',
          fullName: 'Phạm Văn D',
          phone: '0933445566',
          eventCode: 'EVT-2026-LOGISTICS-AI',
        },
        defaultHeaders,
      );

      expect(first.data.created).toBe(true);
      expect(first.data.eventCounted).toBe(true);
      expect(first.data.duplicate).toBe(false);
      const regId = first.data.registrationId;
      expect(regId).toMatch(/^REG-2026-\d{4}$/);

      // EVT-005: Exact same eventId re-sent -> idempotent duplicate
      const retrySameEventId = await service.createLeadFromEventSite(
        {
          eventId: 'evt-idempotent-1',
          fullName: 'Phạm Văn D',
          phone: '0933445566',
          eventCode: 'EVT-2026-LOGISTICS-AI',
        },
        defaultHeaders,
      );
      expect(retrySameEventId.data.duplicate).toBe(true);
      expect(retrySameEventId.data.leadId).toBe(first.data.leadId);
      expect(retrySameEventId.data.registrationId).toBe(regId);
      expect(leadsStore).toHaveLength(1);

      // EVT-004: Different eventId, but same phone + same eventCode -> eventCounted: false, duplicate: true
      const secondSameEventCode = await service.createLeadFromEventSite(
        {
          eventId: 'evt-idempotent-2',
          fullName: 'Phạm Văn D',
          phone: '0933445566',
          eventCode: 'EVT-2026-LOGISTICS-AI',
        },
        defaultHeaders,
      );
      expect(secondSameEventCode.data.leadId).toBe(first.data.leadId);
      expect(secondSameEventCode.data.eventCounted).toBe(false);
      expect(secondSameEventCode.data.duplicate).toBe(true);
      expect(secondSameEventCode.data.registrationId).toBe(regId);
    });

    it('EVT-006, EVT-007, EVT-008, EVT-009: enforces phone validation (422), multi-phone conflict (409), serverKey auth (401), and allowedOrigins (403)', async () => {
      const {
        service,
        defaultHeaders,
        profilesStore,
        identifiersStore,
        conflictsStore,
        slaStore,
      } = createTonghoplinkMockSetup();

      // Missing phone -> 400 ERR_LEAD_INVALID_PAYLOAD
      await expect(
        service.createLeadFromEventSite(
          { fullName: 'No Phone' },
          defaultHeaders,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 400,
          errorCode: 'ERR_LEAD_INVALID_PAYLOAD',
        }),
      });

      // EVT-006: Invalid phone ('12345' & '0999999999') -> 422 ERR_ANON_PHONE_INVALID
      for (const badPhone of ['12345', '0999999999']) {
        await expect(
          service.createLeadFromEventSite(
            { fullName: 'Bad Phone', phone: badPhone },
            defaultHeaders,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            statusCode: 422,
            errorCode: 'ERR_ANON_PHONE_INVALID',
          }),
        });
      }

      // EVT-008: Invalid X-MKT-Server-Key -> 401 ERR_TRACKING_INVALID_KEY
      await expect(
        service.createLeadFromEventSite(
          { fullName: 'Test', phone: '0901234567' },
          { ...defaultHeaders, serverKey: 'wrong_key' },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 401,
          errorCode: 'ERR_TRACKING_INVALID_KEY',
        }),
      });

      // EVT-009: Origin not in allowedOrigins -> 403 ERR_TRACKING_ORIGIN_NOT_ALLOWED
      await expect(
        service.createLeadFromEventSite(
          { fullName: 'Test', phone: '0901234567' },
          { ...defaultHeaders, origin: 'https://evil-phishing.example.com' },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 403,
          errorCode: 'ERR_TRACKING_ORIGIN_NOT_ALLOWED',
        }),
      });

      // EVT-007: cookieId already linked to 0901111111, new submission sends 0902222222 -> 409 ERR_ANON_IDENTITY_CONFLICT
      profilesStore.push({
        id: 'anon-conflict-1',
        anonymousId: 'ANON-884999',
        siteId: 'SITE-TONGHOP',
        cookieId: 'ck_shared_tonghop',
        deviceId: 'fp_shared_tonghop',
        status: 'identified',
        identifiedPhone: '0901111111',
        score: 70,
        tier: 'Hot',
      });
      identifiersStore.push({
        id: 'pi-shared-1',
        siteId: 'SITE-TONGHOP',
        profileId: 'anon-conflict-1',
        keyType: 'cookie',
        keyValue: 'ck_shared_tonghop',
        phone: '0901111111',
        conflictLocked: false,
      });

      await expect(
        service.createLeadFromEventSite(
          {
            eventId: 'evt-007',
            fullName: 'Người Dùng Thứ Hai',
            phone: '0902222222',
            cookieId: 'ck_shared_tonghop',
          },
          defaultHeaders,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          statusCode: 409,
          errorCode: 'ERR_ANON_IDENTITY_CONFLICT',
          canAutoMerge: false,
        }),
      });

      expect(conflictsStore).toHaveLength(1);
      expect(conflictsStore[0].status).toBe('pending');
      expect(conflictsStore[0].phones).toEqual(
        expect.arrayContaining(['0901111111', '0902222222']),
      );
      expect(slaStore).toHaveLength(1);
      expect(slaStore[0].metadata.canAutoMerge).toBe(false);
      expect(identifiersStore[0].conflictLocked).toBe(true);
      expect(profilesStore[0].status).toBe('conflict');
      expect(profilesStore[0].hasConflict).toBe(true);
    });
  });
});
