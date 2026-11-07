import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
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
import {
  companyNameSimilarity,
  computeSlaMetrics,
  maskCookie,
  maskDevice,
  maskIp,
  maskTrackingKey,
  normalizeDomain,
} from './utils/masking.util';
import {
  buildScriptInfo,
  buildTrackerScriptSource,
  computeEventScoreDelta,
  computeTierFromScore,
  hashIp,
  hashServerKey,
  isBotUserAgent,
  isInternalClientIp,
  isIpInCidr,
  isOriginAllowedForSite,
  normalizeVietnamesePhone,
} from './utils/tracking.util';

export interface ActorInfo {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // ============================================================================
  // HELPERS: AUDIT, PERMISSIONS, MASKING & COMPANY MATCHING
  // ============================================================================

  private async resolveActor(user?: ActorInfo): Promise<{
    id: string;
    name: string;
    role: string;
  }> {
    if (!user?.id) {
      return { id: 'system', name: 'System / MKT Ops', role: 'manager' };
    }
    if (user.name) {
      return {
        id: user.id,
        name: user.name,
        role: user.role || 'specialist',
      };
    }
    try {
      const m = await this.prisma.member.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, role: true },
      });
      if (m) return { id: m.id, name: m.name, role: m.role };
    } catch {
      // ignore
    }
    return {
      id: user.id,
      name: user.email || 'MKT User',
      role: user.role || 'specialist',
    };
  }

  private async writeMandatoryAudit(params: {
    module:
      | 'anonymous_profiles'
      | 'identified_profiles'
      | 'company_master'
      | 'sla_queue';
    action: string;
    entityType: string;
    entityId: string;
    user?: ActorInfo;
    beforeData?: any;
    afterData?: any;
    note?: string;
    metadata?: any;
  }) {
    const actor = await this.resolveActor(params.user);
    const created = await this.prisma.profileAuditLog.create({
      data: {
        module: params.module,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: actor.id,
        actorName: actor.name,
        beforeData: params.beforeData ?? null,
        afterData: params.afterData ?? null,
        note: params.note ?? null,
        metadata: params.metadata ?? null,
      },
    });

    // Also record in global AuditLog if actor.id is a valid member UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(actor.id)) {
      await this.auditService
        .log({
          userId: actor.id,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValue: params.beforeData,
          newValue: params.afterData,
        })
        .catch(() => {});
    }
    return created;
  }

  private formatAnonymousProfile(row: any) {
    if (!row) return null;
    const maskedIpVal = maskIp(row.ip);
    const maskedCookieVal = maskCookie(row.cookieId);
    const maskedDeviceVal = maskDevice(row.deviceId);
    const maskedKeyVal = maskTrackingKey(row.trackingKey);
    const events = Array.isArray(row.events) ? row.events : [];
    const topPages = Array.isArray(row.topPages) ? row.topPages : [];
    const userType =
      row.userType || ((row.visitCount || 1) >= 2 ? 'returning' : 'new');
    const engaged =
      row.engaged !== undefined
        ? Boolean(row.engaged)
        : (row.totalDurationSec || 0) > 10 ||
          (row.pageViews || 0) >= 2 ||
          row.status === 'converted' ||
          row.status === 'identified';

    return {
      ...row,
      code: row.anonymousId,
      userType,
      engaged,
      firstTouch: row.firstTouch || null,
      lastTouch: row.lastTouch || null,
      companyConfidence: row.companyConfidence ?? (row.suspectedCompany ? 88 : 0),
      ip: maskedIpVal,
      ipAddress: maskedIpVal,
      maskedIp: maskedIpVal,
      cookieId: maskedCookieVal,
      cookie: maskedCookieVal,
      maskedCookie: maskedCookieVal,
      deviceId: maskedDeviceVal,
      deviceFingerprint: maskedDeviceVal,
      maskedDevice: maskedDeviceVal,
      trackingKey: maskedKeyVal,
      maskedTrackingKey: maskedKeyVal,
      sessions: row.visitCount,
      avgDuration:
        row.visitCount > 0
          ? Math.round((row.totalDurationSec || 0) / row.visitCount)
          : 0,
      firstVisit: row.firstSeenAt,
      lastVisit: row.lastSeenAt,
      lastActiveAt: row.lastSeenAt,
      pagesVisited: topPages,
      journey: events,
      activities: events,
    };
  }

  private formatConflict(row: any) {
    if (!row) return null;
    const maskedKey =
      row.keyType === 'ip'
        ? maskIp(row.keyValue)
        : row.keyType === 'cookie'
          ? maskCookie(row.keyValue)
          : row.keyType === 'device'
            ? maskDevice(row.keyValue)
            : maskTrackingKey(row.keyValue);
    const phones = Array.isArray(row.phones) ? row.phones : [];
    const profiles = Array.isArray(row.profiles) ? row.profiles : [];
    const sla = computeSlaMetrics({
      status: row.status === 'resolved' ? 'done' : 'pending',
      dueAt: row.slaDueAt,
      createdAt: row.detectedAt,
      slaHours: 24,
      type: 'conflict',
    });

    return {
      ...row,
      keyValue: maskedKey,
      maskedKey,
      phones,
      phoneCount: phones.length,
      canAutoMerge: phones.length < 2 && profiles.length < 2,
      canUndo: row.status === 'resolved' && Boolean(row.undoPayload),
      profiles,
      sla,
    };
  }

  private formatIpCluster(row: any) {
    if (!row) return null;
    const maskedRange = maskIp(row.ipRange);
    const profiles = Array.isArray(row.profiles) ? row.profiles : [];
    return {
      ...row,
      ipRange: maskedRange,
      ip: maskedRange,
      maskedIp: maskedRange,
      anonymousCount: row.profileCount,
      totalSessions: row.totalVisits,
      profiles,
    };
  }

  private formatTrackingSite(
    row: any,
    opts?: { includePlaintextKeys?: boolean; baseUrl?: string },
  ) {
    if (!row) return null;
    const maskedKey = maskTrackingKey(row.trackingKey);
    const displayTrackingKey = opts?.includePlaintextKeys
      ? row.trackingKey
      : maskedKey;
    const scriptInfo = buildScriptInfo(row.siteId, displayTrackingKey);
    const allowedOrigins = Array.isArray(row.allowedOrigins)
      ? row.allowedOrigins
      : [];
    const internalCidrs = Array.isArray(row.internalCidrs)
      ? row.internalCidrs
      : [];
    const { serverKeyHash: _omitHash, serverKey: rawServerKey, ...rest } = row;
    return {
      ...rest,
      trackingKey: displayTrackingKey,
      maskedTrackingKey: maskedKey,
      ...(opts?.includePlaintextKeys && rawServerKey
        ? { serverKey: rawServerKey }
        : rawServerKey
          ? { maskedServerKey: maskTrackingKey(rawServerKey) }
          : {}),
      allowedOrigins,
      internalCidrs,
      retentionDays: row.retentionDays ?? 365,
      timezone: row.timezone || 'Asia/Ho_Chi_Minh',
      enabled: row.isActive,
      status: row.isActive ? 'active' : 'inactive',
      totalEvents: row.eventsCount,
      activeProfiles: row.profilesCount,
      lastEventAt: row.lastPingAt,
      scriptUrl: scriptInfo.scriptUrl,
      snippet: scriptInfo.snippet,
    };
  }

  private formatLead(row: any) {
    if (!row) return null;
    const maskedIpVal = maskIp(row.ip);
    const maskedCookieVal = maskCookie(row.cookieId);
    const maskedDeviceVal = maskDevice(row.deviceId);
    const maskedKeyVal = maskTrackingKey(row.trackingKey);
    const journey = Array.isArray(row.journey) ? row.journey : [];
    const scoreHistory = Array.isArray(row.scoreHistory)
      ? row.scoreHistory
      : [];
    const missingFields = Array.isArray(row.missingFields)
      ? row.missingFields
      : [];
    const tags = Array.isArray(row.tags) ? row.tags : [];

    return {
      ...row,
      company: row.companyName,
      funnel: row.funnelStage,
      stage: row.funnelStage,
      owner: row.ownerName,
      sales: row.salesName,
      project: row.projectName,
      ip: maskedIpVal,
      maskedIp: maskedIpVal,
      cookieId: maskedCookieVal,
      maskedCookie: maskedCookieVal,
      deviceId: maskedDeviceVal,
      maskedDevice: maskedDeviceVal,
      trackingKey: maskedKeyVal,
      maskedTrackingKey: maskedKeyVal,
      journey,
      scoreHistory,
      missingFields,
      tags,
    };
  }

  private formatCompany(row: any) {
    if (!row) return null;
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    const pipelineValue = Number(row.pipelineValue || 0);
    const wonValue = Number(row.wonValue || 0);
    return {
      ...row,
      aliases,
      companySize: row.size,
      leadsCount: row.leadCount,
      wonDealsCount: row.wonCount,
      pipelineValue,
      wonValue,
      totalRevenue: wonValue,
    };
  }

  private formatSlaItem(row: any) {
    if (!row) return null;
    const metrics = computeSlaMetrics({
      status: row.status,
      dueAt: row.dueAt,
      createdAt: row.createdAt,
      slaHours: row.slaHours,
      type: row.type,
    });
    return {
      ...row,
      ...metrics,
      category: row.type,
      assignee: row.assigneeName,
    };
  }

  private computeLeadMissingFields(data: {
    email?: string | null;
    taxCode?: string | null;
    companyName?: string | null;
    industry?: string | null;
    companySize?: string | null;
  }): string[] {
    const missing: string[] = [];
    if (!data.email || !String(data.email).trim()) missing.push('email');
    if (!data.companyName || !String(data.companyName).trim())
      missing.push('company');
    if (!data.taxCode || !String(data.taxCode).trim()) missing.push('taxCode');
    if (!data.industry || !String(data.industry).trim())
      missing.push('industry');
    if (!data.companySize || !String(data.companySize).trim())
      missing.push('companySize');
    return missing;
  }

  private async nextCompanyCode(): Promise<string> {
    const all = await this.prisma.companyMaster.findMany({
      select: { code: true },
    });
    let maxNum = 100;
    for (const c of all) {
      const m = String(c.code || '').match(/^COMP-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `COMP-${String(maxNum + 1).padStart(6, '0')}`;
  }

  private async nextLeadCode(): Promise<string> {
    const all = await this.prisma.identifiedLead.findMany({
      select: { code: true },
    });
    let maxNum = 0;
    for (const l of all) {
      const m = String(l.code || '').match(/^LEAD-\d{4}-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `LEAD-2026-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private async nextSlaCode(): Promise<string> {
    const all = await this.prisma.slaQueueItem.findMany({
      select: { code: true },
    });
    let maxNum = 0;
    for (const s of all) {
      const m = String(s.code || '').match(/^SLA-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `SLA-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private async nextSiteId(): Promise<string> {
    const all = await this.prisma.trackingSite.findMany({
      select: { siteId: true },
    });
    let maxNum = 0;
    for (const s of all) {
      const m = String(s.siteId || '').match(/^SITE-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `SITE-${String(maxNum + 1).padStart(3, '0')}`;
  }

  /**
   * BE_requirement_24_10_26 §3: Company Matching rules:
   * 1. domain exact -> auto-assign
   * 2. tax code exact -> auto-assign + merge alias
   * 3. fuzzy name -> đưa vào SLA queue (24h)
   */
  async matchOrAssignCompany(input: {
    companyName?: string | null;
    domain?: string | null;
    taxCode?: string | null;
    email?: string | null;
    entityId?: string;
  }): Promise<{
    matchType: 'domain_exact' | 'tax_code_exact' | 'fuzzy_sla' | 'none';
    company: any | null;
    slaQueueItem?: any;
  }> {
    const activeCompanies = await this.prisma.companyMaster.findMany({
      where: { status: 'active' },
    });

    const rawName = input.companyName?.trim() || '';
    const rawTax = input.taxCode?.trim() || '';
    const emailDomain = input.email?.includes('@')
      ? normalizeDomain(input.email.split('@')[1])
      : '';
    const publicDomains = new Set([
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'icloud.com',
    ]);
    const effectiveDomain =
      normalizeDomain(input.domain) ||
      (emailDomain && !publicDomains.has(emailDomain) ? emailDomain : '');

    // 1. Tax code exact -> auto-assign + merge alias
    if (rawTax) {
      const byTax = activeCompanies.find(
        (c) =>
          c.taxCode &&
          c.taxCode.trim().toLowerCase() === rawTax.toLowerCase(),
      );
      if (byTax) {
        const aliases = Array.isArray(byTax.aliases)
          ? [...(byTax.aliases as string[])]
          : [];
        if (
          rawName &&
          rawName.toLowerCase() !== byTax.name.toLowerCase() &&
          !aliases.some((a) => a.toLowerCase() === rawName.toLowerCase())
        ) {
          aliases.push(rawName);
          await this.prisma.companyMaster.update({
            where: { id: byTax.id },
            data: { aliases },
          });
          byTax.aliases = aliases;
        }
        return { matchType: 'tax_code_exact', company: byTax };
      }
    }

    // 2. Domain exact -> auto-assign
    if (effectiveDomain) {
      const byDomain = activeCompanies.find(
        (c) => c.domain && normalizeDomain(c.domain) === effectiveDomain,
      );
      if (byDomain) {
        return { matchType: 'domain_exact', company: byDomain };
      }
    }

    // 3. Fuzzy name -> SLA queue
    if (rawName) {
      let bestMatch: any = null;
      let bestScore = 0;
      for (const comp of activeCompanies) {
        const candidates = [
          comp.name,
          ...(Array.isArray(comp.aliases) ? (comp.aliases as string[]) : []),
        ];
        for (const cand of candidates) {
          const sim = companyNameSimilarity(rawName, cand);
          if (sim > bestScore) {
            bestScore = sim;
            bestMatch = comp;
          }
        }
      }
      if (bestMatch && bestScore >= 0.65) {
        const slaCode = await this.nextSlaCode();
        const slaItem = await this.prisma.slaQueueItem.create({
          data: {
            code: slaCode,
            type: 'fuzzy_company',
            title: `Nghi ngờ trùng tên công ty (${Math.round(bestScore * 100)}%): "${rawName}" vs "${bestMatch.name}"`,
            description: `Tên công ty "${rawName}" khớp mờ (${Math.round(bestScore * 100)}%) với "${bestMatch.name}" (${bestMatch.code}). Cần MKT xác nhận trước khi gộp.`,
            entityType: 'company',
            entityId: input.entityId || bestMatch.code,
            entityName: `${rawName} -> ${bestMatch.code}`,
            priority: 'high',
            slaHours: 24,
            status: 'pending',
            dueAt: new Date(Date.now() + 24 * 3600_000),
            metadata: {
              inputName: rawName,
              matchedCode: bestMatch.code,
              matchedName: bestMatch.name,
              similarity: Number(bestScore.toFixed(2)),
            },
          },
        });
        return {
          matchType: 'fuzzy_sla',
          company: bestMatch,
          slaQueueItem: slaItem,
        };
      }
    }

    return { matchType: 'none', company: null };
  }

  // ============================================================================
  // 1. MODULE HỒ SƠ ẨN DANH (/anonymous-profiles & /tracking/sites)
  // ============================================================================

  async getAnonymousProfiles(query: any = {}, user?: ActorInfo) {
    const all = await this.prisma.anonymousProfile.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });

    const search = String(query.search || query.q || '')
      .trim()
      .toLowerCase();
    const status = query.status ? String(query.status).toLowerCase() : '';
    const tier = query.tier ? String(query.tier).toLowerCase() : '';
    const siteId = query.siteId || query.site || '';
    const source = query.source || query.utmSource || '';
    const device = query.device ? String(query.device).toLowerCase() : '';
    const hasConflict = query.hasConflict;
    const ipClusterId = query.ipClusterId || '';

    const filtered = all.filter((row) => {
      if (status && status !== 'all' && row.status.toLowerCase() !== status) {
        return false;
      }
      if (tier && tier !== 'all' && row.tier.toLowerCase() !== tier) {
        return false;
      }
      if (siteId && siteId !== 'all' && row.siteId !== siteId) {
        return false;
      }
      if (
        source &&
        source !== 'all' &&
        String(row.utmSource || '').toLowerCase() !==
          String(source).toLowerCase()
      ) {
        return false;
      }
      if (device && device !== 'all' && row.device.toLowerCase() !== device) {
        return false;
      }
      if (hasConflict !== undefined && hasConflict !== '') {
        const want = String(hasConflict) === 'true';
        if (Boolean(row.hasConflict) !== want) return false;
      }
      if (ipClusterId && row.ipClusterId !== ipClusterId) {
        return false;
      }
      if (search) {
        const hay = `${row.anonymousId} ${row.suspectedCompany || ''} ${row.city || ''} ${row.utmSource || ''} ${row.utmCampaign || ''} ${row.siteName || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const limit = Math.max(
      1,
      Math.min(200, parseInt(String(query.limit || query.pageSize || '20'), 10) || 20),
    );
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = filtered
      .slice((page - 1) * limit, page * limit)
      .map((r) => this.formatAnonymousProfile(r));

    const stats = {
      total: all.length,
      active: all.filter((r) => r.status === 'active').length,
      converted: all.filter((r) => r.status === 'converted').length,
      conflict: all.filter((r) => r.hasConflict || r.status === 'conflict')
        .length,
      hot: all.filter((r) => r.tier === 'Hot').length,
      warm: all.filter((r) => r.tier === 'Warm').length,
      cold: all.filter((r) => r.tier === 'Cold').length,
    };

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      data: items,
      items,
      stats,
      pagination: { page, limit, total, totalPages },
      total,
      page,
      limit,
      totalPages,
      permissions,
    };
  }

  async getAnonymousProfileById(idOrCode: string, user?: ActorInfo) {
    const row = await this.prisma.anonymousProfile.findFirst({
      where: {
        OR: [{ id: idOrCode }, { anonymousId: idOrCode }],
      },
    });
    if (!row) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ ẩn danh "${idOrCode}".`,
      );
    }

    const formatted = this.formatAnonymousProfile(row);
    const conflict = row.conflictId
      ? await this.prisma.anonymousConflict.findFirst({
          where: {
            OR: [{ id: row.conflictId }, { code: row.conflictId }],
          },
        })
      : null;
    const ipCluster = row.ipClusterId
      ? await this.prisma.ipCluster.findFirst({
          where: {
            OR: [{ id: row.ipClusterId }, { code: row.ipClusterId }],
          },
        })
      : null;
    const convertedLead = row.convertedLeadId
      ? await this.prisma.identifiedLead.findFirst({
          where: {
            OR: [{ id: row.convertedLeadId }, { code: row.convertedLeadId }],
          },
        })
      : null;
    const auditLogs = await this.prisma.profileAuditLog.findMany({
      where: {
        OR: [{ entityId: row.id }, { entityId: row.anonymousId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const detail = {
      ...formatted,
      conflict: conflict ? this.formatConflict(conflict) : null,
      ipCluster: ipCluster ? this.formatIpCluster(ipCluster) : null,
      convertedLead: convertedLead ? this.formatLead(convertedLead) : null,
      auditLogs,
    };

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      ...detail,
      data: detail,
      permissions,
    };
  }

  /**
   * POST /api/v1/anonymous-profiles/:id/convert
   * Chuyển thành Lead. Body: {phone, name, company}. Giữ anonymousId để audit.
   * Không auto-merge khi 1 key map >= 2 SĐT.
   */
  async convertAnonymousProfile(
    idOrCode: string,
    dto: ConvertAnonymousProfileDto,
    user?: ActorInfo,
  ) {
    const profile = await this.prisma.anonymousProfile.findFirst({
      where: {
        OR: [{ id: idOrCode }, { anonymousId: idOrCode }],
      },
    });
    if (!profile) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ ẩn danh "${idOrCode}".`,
      );
    }
    const phone = String(dto.phone || '').trim();
    const name = String(dto.name || '').trim();
    if (!phone || !name) {
      throw new BadRequestException(
        'Số điện thoại (phone) và Họ tên (name) là bắt buộc khi chuyển đổi thành Lead.',
      );
    }

    // Rule BDD-02: Không auto-merge khi 1 key map >= 2 SĐT
    const sameCookieLeads = await this.prisma.identifiedLead.findMany({
      where: {
        OR: [
          { cookieId: profile.cookieId },
          { deviceId: profile.deviceId },
        ],
      },
    });
    const distinctPhones = new Set<string>([phone]);
    for (const l of sameCookieLeads) {
      if (l.phone) distinctPhones.add(l.phone.trim());
    }
    if (profile.identifiedPhone) {
      distinctPhones.add(profile.identifiedPhone.trim());
    }

    let createdConflict: any = null;
    if (distinctPhones.size >= 2) {
      if (dto.autoMerge) {
        throw new BadRequestException(
          'Không được auto-merge khi 1 tracking key (Cookie/Device) map với >= 2 số điện thoại khác nhau.',
        );
      }
      // Record conflict + SLA 24h queue item
      const conflictCode = `CONF-${String(Date.now()).slice(-4)}`;
      createdConflict = await this.prisma.anonymousConflict.create({
        data: {
          code: conflictCode,
          keyType: 'cookie',
          keyValue: profile.cookieId,
          status: 'pending',
          severity: 'high',
          reason: `Cookie/Device của ${profile.anonymousId} ghi nhận ${distinctPhones.size} SĐT khác nhau (${Array.from(distinctPhones).join(', ')}) — chặn auto-merge.`,
          phones: Array.from(distinctPhones),
          profiles: [
            {
              id: profile.id,
              anonymousId: profile.anonymousId,
              name,
              phone,
              company: dto.company || profile.suspectedCompany,
              score: profile.score,
              tier: profile.tier,
            },
          ],
          detectedAt: new Date(),
          slaDueAt: new Date(Date.now() + 24 * 3600_000),
        },
      });
      const slaCode = await this.nextSlaCode();
      await this.prisma.slaQueueItem.create({
        data: {
          code: slaCode,
          type: 'conflict',
          title: `Xung đột định danh ${conflictCode}: 1 key map ${distinctPhones.size} SĐT`,
          description: createdConflict.reason,
          entityType: 'anonymous_conflict',
          entityId: conflictCode,
          entityName: `${profile.anonymousId} (${name})`,
          priority: 'high',
          slaHours: 24,
          status: 'pending',
          dueAt: new Date(Date.now() + 24 * 3600_000),
          metadata: {
            conflictCode,
            anonymousId: profile.anonymousId,
            phones: Array.from(distinctPhones),
          },
        },
      });
    }

    // Company Master matching
    const companyName =
      dto.company?.trim() || profile.suspectedCompany || null;
    const matchRes = await this.matchOrAssignCompany({
      companyName,
      domain: dto.domain || profile.domain,
      taxCode: dto.taxCode,
      email: dto.email,
      entityId: profile.anonymousId,
    });

    const assignedCompany =
      matchRes.matchType === 'domain_exact' ||
      matchRes.matchType === 'tax_code_exact'
        ? matchRes.company
        : null;

    const leadCode = await this.nextLeadCode();
    const actor = await this.resolveActor(user);
    const missingFields = this.computeLeadMissingFields({
      email: dto.email,
      taxCode: dto.taxCode || assignedCompany?.taxCode,
      companyName: assignedCompany?.name || companyName,
      industry: assignedCompany?.industry,
      companySize: assignedCompany?.size,
    });
    const hasMissingData = missingFields.length > 0;

    const existingEvents = Array.isArray(profile.events)
      ? (profile.events as any[])
      : [];
    const journey = [
      ...existingEvents.map((ev, idx) => ({
        id: ev.id || `anon-ev-${idx + 1}`,
        phase: 'anonymous',
        isAnonymousPhase: true,
        type: ev.type || 'page_view',
        channel: `Web Tracking (${profile.siteId || 'SITE-001'})`,
        title: `[Ẩn danh ${profile.anonymousId}] ${ev.title || ev.page || 'Hoạt động ẩn danh'}`,
        page: ev.page || null,
        scoreDelta: ev.scoreDelta || 0,
        timestamp: ev.timestamp || profile.firstSeenAt.toISOString(),
      })),
      {
        id: `conv-${Date.now()}`,
        phase: 'conversion',
        isAnonymousPhase: false,
        type: 'convert',
        channel: 'Profile Conversion',
        title: `Chuyển đổi từ Hồ sơ ẩn danh ${profile.anonymousId} thành Lead (${name} - ${phone})`,
        page: null,
        scoreDelta: 15,
        timestamp: new Date().toISOString(),
      },
    ];

    const newScore = Math.min(100, (profile.score || 40) + 15);
    const newTier =
      newScore >= 75 ? 'Hot' : newScore >= 45 ? 'Warm' : 'Cold';

    const scoreHistory = [
      {
        id: `sh-init-${Date.now()}`,
        date: profile.firstSeenAt.toISOString().slice(0, 10),
        timestamp: profile.firstSeenAt.toISOString(),
        score: profile.score,
        delta: profile.score,
        tier: profile.tier,
        reason: `Điểm hành vi tích lũy từ giai đoạn ẩn danh (${profile.anonymousId})`,
      },
      {
        id: `sh-conv-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toISOString(),
        score: newScore,
        delta: 15,
        tier: newTier,
        reason: 'Xác thực định danh (SĐT & Công ty)',
      },
    ];

    const createdLead = await this.prisma.identifiedLead.create({
      data: {
        code: leadCode,
        anonymousId: profile.anonymousId, // Giữ anonymousId để audit
        name,
        phone,
        email: dto.email || null,
        title: dto.title || null,
        companyName: assignedCompany?.name || companyName,
        companyCode: assignedCompany?.code || null,
        taxCode: dto.taxCode || assignedCompany?.taxCode || null,
        domain: dto.domain || assignedCompany?.domain || null,
        industry: assignedCompany?.industry || null,
        companySize: assignedCompany?.size || null,
        city: assignedCompany?.city || profile.city || null,
        funnelStage: 'Raw Lead',
        score: newScore,
        demographicScore: 25,
        behaviorScore: Math.max(0, newScore - 25),
        tier: newTier,
        ownerId: actor.id,
        ownerName: actor.name,
        projectId: dto.projectId || 'proj-lead-2026',
        projectName: 'LEAD GENERATION 2026',
        source: profile.utmSource
          ? `Web Tracking (${profile.utmSource})`
          : 'Web Tracking Conversion',
        utmSource: profile.utmSource,
        utmMedium: profile.utmMedium,
        utmCampaign: profile.utmCampaign,
        isReturn: false,
        silentDays: 0,
        lastActivityAt: new Date(),
        hasMissingData,
        missingFields,
        journey,
        scoreHistory,
        ip: profile.ip,
        cookieId: profile.cookieId,
        deviceId: profile.deviceId,
        trackingKey: profile.trackingKey,
        tags: ['Converted from Anonymous', profile.anonymousId],
        note: dto.note || null,
      },
    });

    if (assignedCompany) {
      await this.prisma.companyMaster.update({
        where: { id: assignedCompany.id },
        data: { leadCount: { increment: 1 } },
      });
    }

    // If missing data, enqueue 48h SLA item
    if (hasMissingData) {
      const slaCode = await this.nextSlaCode();
      await this.prisma.slaQueueItem.create({
        data: {
          code: slaCode,
          type: 'missing_data',
          title: `Thiếu dữ liệu Lead mới chuyển đổi: ${name} (${leadCode})`,
          description: `Lead ${leadCode} (từ ${profile.anonymousId}) thiếu: ${missingFields.join(', ')}. SLA bổ sung: 48h.`,
          entityType: 'lead',
          entityId: leadCode,
          entityName: `${name} (${phone})`,
          priority: 'medium',
          slaHours: 48,
          status: 'pending',
          dueAt: new Date(Date.now() + 48 * 3600_000),
          metadata: {
            leadCode,
            anonymousId: profile.anonymousId,
            missingFields,
          },
        },
      });
    }

    const updatedProfile = await this.prisma.anonymousProfile.update({
      where: { id: profile.id },
      data: {
        status: 'converted',
        convertedLeadId: createdLead.code,
        convertedAt: new Date(),
        identifiedPhone: phone,
        identifiedName: name,
        identifiedCompany: assignedCompany?.name || companyName,
        hasConflict: Boolean(createdConflict) || profile.hasConflict,
        conflictId: createdConflict?.code || profile.conflictId,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'convert',
      entityType: 'anonymous_profile',
      entityId: profile.anonymousId,
      user,
      beforeData: {
        anonymousId: profile.anonymousId,
        status: profile.status,
      },
      afterData: {
        anonymousId: profile.anonymousId,
        status: 'converted',
        leadId: createdLead.id,
        leadCode: createdLead.code,
        phone,
        name,
        company: assignedCompany?.name || companyName,
        companyCode: assignedCompany?.code || null,
        companyMatchType: matchRes.matchType,
      },
      note:
        dto.note ||
        `Chuyển đổi hồ sơ ẩn danh ${profile.anonymousId} thành Lead ${createdLead.code}`,
    });

    const formattedProfile = this.formatAnonymousProfile(updatedProfile);
    const formattedLead = this.formatLead(createdLead);

    return {
      data: {
        profile: formattedProfile,
        lead: formattedLead,
        anonymousId: profile.anonymousId,
        companyMatch: matchRes.matchType,
        conflict: createdConflict
          ? this.formatConflict(createdConflict)
          : null,
      },
      profile: formattedProfile,
      lead: formattedLead,
      anonymousId: profile.anonymousId,
    };
  }

  async getConflicts(query: any = {}) {
    const all = await this.prisma.anonymousConflict.findMany({
      orderBy: { detectedAt: 'desc' },
    });
    const status = query.status ? String(query.status).toLowerCase() : '';
    const keyType = query.keyType ? String(query.keyType).toLowerCase() : '';

    const filtered = all.filter((c) => {
      if (status && status !== 'all' && c.status.toLowerCase() !== status)
        return false;
      if (keyType && keyType !== 'all' && c.keyType.toLowerCase() !== keyType)
        return false;
      return true;
    });

    const items = filtered.map((c) => this.formatConflict(c));
    return {
      data: items,
      items,
      total: items.length,
      stats: {
        total: all.length,
        pending: all.filter((c) => c.status === 'pending').length,
        resolved: all.filter((c) => c.status === 'resolved').length,
        insufficient: all.filter((c) => c.status === 'insufficient').length,
      },
    };
  }

  /**
   * POST /api/v1/anonymous-profiles/conflicts/:id/resolve
   * Body: {action: merge|keep|move|insufficient, primaryProfileId?, moveKey?, note?}.
   * Không auto-merge khi 1 key map >= 2 SĐT. Ghi audit.
   */
  async resolveConflict(
    idOrCode: string,
    dto: ResolveConflictDto,
    user?: ActorInfo,
  ) {
    const conflict = await this.prisma.anonymousConflict.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!conflict) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy xung đột "${idOrCode}".`,
      });
    }
    if (conflict.status === 'resolved') {
      throw new ConflictException({
        code: 'ERR_ANON_CONFLICT_RESOLVED',
        message: `Xung đột "${conflict.code}" đã được xử lý trước đó.`,
      });
    }

    const phones = Array.isArray(conflict.phones)
      ? (conflict.phones as string[])
      : [];
    if (dto.autoMerge && phones.length >= 2) {
      throw new BadRequestException({
        code: 'ERR_ANON_MERGE_BLOCKED',
        message:
          'Không được auto-merge khi 1 key map với >= 2 số điện thoại khác nhau. Vui lòng xác nhận thủ công.',
      });
    }
    if (dto.action === 'merge' && phones.length >= 2 && !dto.primaryProfileId) {
      throw new BadRequestException({
        code: 'ERR_ANON_MERGE_BLOCKED',
        message:
          'Khi 1 key map >= 2 SĐT, thao tác merge bắt buộc chỉ định rõ primaryProfileId (không auto-merge).',
      });
    }

    // Snapshot linked profiles before resolution so undoConflict can restore them
    const linkedProfiles = this.prisma.anonymousProfile?.findMany
      ? await this.prisma.anonymousProfile.findMany({
          where: { conflictId: conflict.code },
        })
      : [];
    const undoPayload = {
      previousStatus: conflict.status,
      previousProfiles: linkedProfiles.map((p) => ({
        id: p.id,
        anonymousId: p.anonymousId,
        status: p.status,
        hasConflict: p.hasConflict,
        conflictId: p.conflictId,
      })),
      snapshotAt: new Date().toISOString(),
    };

    const actor = await this.resolveActor(user);
    const newStatus =
      dto.action === 'insufficient' ? 'insufficient' : 'resolved';

    const updated = await this.prisma.anonymousConflict.update({
      where: { id: conflict.id },
      data: {
        status: newStatus,
        resolutionAction: dto.action,
        primaryProfileId: dto.primaryProfileId || null,
        moveKey: dto.moveKey || null,
        resolutionNote: dto.note || null,
        resolvedBy: actor.id,
        resolvedByName: actor.name,
        resolvedAt: newStatus === 'resolved' ? new Date() : null,
        lastReviewedAt: new Date(),
        undoPayload:
          newStatus === 'resolved'
            ? (undoPayload as any)
            : (conflict.undoPayload as any),
      },
    });

    // Clear hasConflict flag on linked anonymous profiles when resolved
    if (newStatus === 'resolved') {
      await this.prisma.anonymousProfile.updateMany({
        where: { conflictId: conflict.code },
        data: {
          hasConflict: false,
          status: dto.action === 'merge' ? 'merged' : 'active',
        },
      });
      if (dto.action === 'move' && dto.moveKey && this.prisma.profileIdentifier?.updateMany) {
        await this.prisma.profileIdentifier.updateMany({
          where: { keyValue: dto.moveKey },
          data: {
            conflictLocked: true,
          },
        });
      }
      await this.prisma.slaQueueItem.updateMany({
        where: {
          entityId: conflict.code,
          status: { in: ['pending', 'processing'] },
        },
        data: {
          status: 'done',
          resolvedAt: new Date(),
          resolvedBy: actor.id,
          resolvedByName: actor.name,
          resolution: dto.action,
          note: dto.note || `Đã xử lý xung đột (${dto.action})`,
        },
      });
    }

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'resolve_conflict',
      entityType: 'anonymous_conflict',
      entityId: conflict.code,
      user,
      beforeData: {
        code: conflict.code,
        status: conflict.status,
        phones,
      },
      afterData: {
        code: conflict.code,
        status: newStatus,
        action: dto.action,
        primaryProfileId: dto.primaryProfileId || null,
        moveKey: dto.moveKey || null,
        note: dto.note || null,
      },
      note: dto.note || `Xử lý xung đột ${conflict.code}: ${dto.action}`,
    });

    const formatted = this.formatConflict(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * POST /api/v1/anonymous-profiles/conflicts/:id/undo
   * Hoàn tác xử lý xung đột từ undoPayload, khôi phục trạng thái hồ sơ và ghi audit.
   */
  async undoConflict(
    idOrCode: string,
    dto: UndoConflictDto = {},
    user?: ActorInfo,
  ) {
    const conflict = await this.prisma.anonymousConflict.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!conflict) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy xung đột "${idOrCode}".`,
      });
    }
    if (conflict.status !== 'resolved' || !conflict.undoPayload) {
      throw new HttpException(
        {
          code: 'ERR_ANON_UNDO_NOT_AVAILABLE',
          message: `Xung đột "${conflict.code}" không ở trạng thái có thể hoàn tác.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const payload = conflict.undoPayload as any;
    const prevProfiles = Array.isArray(payload?.previousProfiles)
      ? payload.previousProfiles
      : [];

    for (const snap of prevProfiles) {
      if (snap?.id) {
        await this.prisma.anonymousProfile
          .update({
            where: { id: snap.id },
            data: {
              status: snap.status || 'conflict',
              hasConflict: snap.hasConflict !== undefined ? Boolean(snap.hasConflict) : true,
              conflictId: snap.conflictId || conflict.code,
            },
          })
          .catch(() => {});
      }
    }

    if (conflict.moveKey && this.prisma.profileIdentifier?.updateMany) {
      await this.prisma.profileIdentifier.updateMany({
        where: { keyValue: conflict.moveKey },
        data: {
          conflictLocked: false,
        },
      });
    }

    const updated = await this.prisma.anonymousConflict.update({
      where: { id: conflict.id },
      data: {
        status: payload?.previousStatus || 'pending',
        resolutionAction: null,
        primaryProfileId: null,
        moveKey: null,
        resolutionNote:
          dto.reason || (dto as any).note || 'Đã hoàn tác xử lý xung đột',
        resolvedBy: null,
        resolvedByName: null,
        resolvedAt: null,
        undoPayload: null as any,
      },
    });

    await this.prisma.slaQueueItem.updateMany({
      where: { entityId: conflict.code },
      data: {
        status: 'pending',
        resolvedAt: null,
        resolvedBy: null,
        resolvedByName: null,
        resolution: null,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'undo_conflict',
      entityType: 'anonymous_conflict',
      entityId: conflict.code,
      user,
      beforeData: {
        code: conflict.code,
        status: conflict.status,
        resolutionAction: conflict.resolutionAction,
      },
      afterData: {
        code: updated.code,
        status: updated.status,
        reason: dto.reason || dto.note || 'Hoàn tác xử lý xung đột',
      },
      note:
        dto.reason ||
        dto.note ||
        `Hoàn tác xử lý xung đột ${conflict.code}, khôi phục trạng thái pending`,
    });

    const formatted = this.formatConflict(updated);
    return { ...formatted, data: formatted };
  }

  async getIpClusters(query: any = {}) {
    const all = await this.prisma.ipCluster.findMany({
      orderBy: { detectedAt: 'desc' },
    });
    const status = query.status ? String(query.status).toLowerCase() : '';
    const filtered = all.filter((c) => {
      if (status && status !== 'all' && c.status.toLowerCase() !== status)
        return false;
      return true;
    });
    const items = filtered.map((c) => this.formatIpCluster(c));
    return {
      data: items,
      items,
      total: items.length,
      stats: {
        total: all.length,
        pending: all.filter((c) => c.status === 'pending').length,
        confirmed: all.filter((c) => c.status === 'confirmed').length,
        rejected: all.filter((c) => c.status === 'rejected').length,
      },
    };
  }

  async confirmIpCluster(
    idOrCode: string,
    dto: ConfirmIpClusterDto = {},
    user?: ActorInfo,
  ) {
    const cluster = await this.prisma.ipCluster.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!cluster) {
      throw new NotFoundException(`Không tìm thấy cụm IP "${idOrCode}".`);
    }

    const actor = await this.resolveActor(user);
    const updated = await this.prisma.ipCluster.update({
      where: { id: cluster.id },
      data: {
        status: 'confirmed',
        suspectedCompany: dto.companyName || cluster.suspectedCompany,
        companyCode: dto.companyCode || cluster.companyCode,
        note: dto.note || cluster.note,
        confirmedAt: new Date(),
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    });

    // Associate company Hint to anonymous profiles in this IP cluster (without merging individuals!)
    await this.prisma.anonymousProfile.updateMany({
      where: { ipClusterId: cluster.code },
      data: {
        suspectedCompany: updated.suspectedCompany,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'confirm_ip_cluster',
      entityType: 'ip_cluster',
      entityId: cluster.code,
      user,
      beforeData: { status: cluster.status, suspectedCompany: cluster.suspectedCompany },
      afterData: {
        status: 'confirmed',
        suspectedCompany: updated.suspectedCompany,
        companyCode: updated.companyCode,
      },
      note:
        dto.note ||
        `Xác nhận cụm IP ${cluster.code} thuộc doanh nghiệp ${updated.suspectedCompany}`,
    });

    const formatted = this.formatIpCluster(updated);
    return { ...formatted, data: formatted };
  }

  async rejectIpCluster(
    idOrCode: string,
    dto: RejectIpClusterDto = {},
    user?: ActorInfo,
  ) {
    const cluster = await this.prisma.ipCluster.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!cluster) {
      throw new NotFoundException(`Không tìm thấy cụm IP "${idOrCode}".`);
    }

    const actor = await this.resolveActor(user);
    const reason = dto.reason || dto.note || 'Từ chối cụm IP (không gộp người)';
    const updated = await this.prisma.ipCluster.update({
      where: { id: cluster.id },
      data: {
        status: 'rejected',
        note: reason,
        rejectedAt: new Date(),
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'reject_ip_cluster',
      entityType: 'ip_cluster',
      entityId: cluster.code,
      user,
      beforeData: { status: cluster.status },
      afterData: { status: 'rejected', reason },
      note: reason,
    });

    const formatted = this.formatIpCluster(updated);
    return { ...formatted, data: formatted };
  }

  async getTrackingSites() {
    const all = await this.prisma.trackingSite.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const items = all.map((s) => this.formatTrackingSite(s));
    return {
      data: items,
      items,
      total: items.length,
    };
  }

  async createTrackingSite(dto: CreateTrackingSiteDto, user?: ActorInfo) {
    const name = String(dto.name || '').trim();
    const domain = normalizeDomain(dto.domain);
    if (!name || !domain) {
      throw new BadRequestException('Tên site (name) và domain là bắt buộc.');
    }

    const siteId = await this.nextSiteId();
    const trackingKey = `trk_live_${crypto.randomBytes(8).toString('hex')}`;
    const serverKey = `sk_live_${crypto.randomBytes(12).toString('hex')}`;
    const serverKeyHash = hashServerKey(serverKey);
    const allowedOrigins = Array.isArray((dto as any).allowedOrigins)
      ? (dto as any).allowedOrigins
      : [
          `https://${domain}`,
          `https://www.${domain}`,
          'http://localhost:3000',
          'http://localhost:5173',
        ];
    const retentionDays = Number((dto as any).retentionDays || 365);
    const internalCidrs = Array.isArray((dto as any).internalCidrs)
      ? (dto as any).internalCidrs
      : ['10.0.0.0/8', '192.168.0.0/16'];
    const timezone = String((dto as any).timezone || 'Asia/Ho_Chi_Minh');
    const actor = await this.resolveActor(user);

    const created = await this.prisma.trackingSite.create({
      data: {
        siteId,
        name,
        domain,
        trackingKey,
        serverKey,
        serverKeyHash,
        allowedOrigins,
        retentionDays,
        internalCidrs,
        timezone,
        isActive: true,
        eventsCount: 0,
        profilesCount: 0,
        lastPingAt: new Date(),
        createdBy: actor.id,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'create_site',
      entityType: 'tracking_site',
      entityId: created.siteId,
      user,
      beforeData: null,
      afterData: {
        siteId: created.siteId,
        name: created.name,
        domain: created.domain,
        trackingKey: maskTrackingKey(created.trackingKey),
        isActive: created.isActive,
        allowedOrigins,
        retentionDays,
      },
      note: `Tạo site tracking mới ${created.siteId} (${created.domain})`,
    });

    const formatted = this.formatTrackingSite(created);
    const scriptInfo = buildScriptInfo(created.siteId, created.trackingKey);
    const out = {
      ...formatted,
      publicTrackingKey: created.trackingKey,
      serverKey,
      scriptUrl: scriptInfo.scriptUrl,
      snippet: scriptInfo.snippet,
    };
    return { ...out, data: out };
  }

  async getTrackingSiteScript(idOrSiteId: string) {
    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ id: idOrSiteId }, { siteId: idOrSiteId }],
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy site "${idOrSiteId}".`,
      });
    }
    const scriptInfo = buildScriptInfo(site.siteId, site.trackingKey);
    const out = {
      id: site.id,
      siteId: site.siteId,
      name: site.name,
      domain: site.domain,
      isActive: site.isActive,
      trackingKey: site.trackingKey,
      maskedTrackingKey: maskTrackingKey(site.trackingKey),
      maskedServerKey: site.serverKey ? maskTrackingKey(site.serverKey) : null,
      allowedOrigins: Array.isArray(site.allowedOrigins)
        ? site.allowedOrigins
        : [],
      retentionDays: site.retentionDays ?? 365,
      internalCidrs: Array.isArray(site.internalCidrs)
        ? site.internalCidrs
        : [],
      ...scriptInfo,
    };
    return { ...out, data: out };
  }

  async updateTrackingSite(
    idOrSiteId: string,
    dto: UpdateTrackingSiteDto,
    user?: ActorInfo,
  ) {
    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ id: idOrSiteId }, { siteId: idOrSiteId }],
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy site "${idOrSiteId}".`,
      });
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = String(dto.name).trim();
    if (dto.domain !== undefined)
      updateData.domain = normalizeDomain(dto.domain);
    if (dto.allowedOrigins !== undefined)
      updateData.allowedOrigins = dto.allowedOrigins;
    if (dto.retentionDays !== undefined)
      updateData.retentionDays = Number(dto.retentionDays);
    if (dto.internalCidrs !== undefined)
      updateData.internalCidrs = dto.internalCidrs;
    if (dto.timezone !== undefined) updateData.timezone = String(dto.timezone);
    if (dto.isActive !== undefined) updateData.isActive = Boolean(dto.isActive);
    else if (dto.enabled !== undefined)
      updateData.isActive = Boolean(dto.enabled);

    const updated = await this.prisma.trackingSite.update({
      where: { id: site.id },
      data: updateData,
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'update_site',
      entityType: 'tracking_site',
      entityId: site.siteId,
      user,
      beforeData: {
        name: site.name,
        domain: site.domain,
        isActive: site.isActive,
        allowedOrigins: site.allowedOrigins,
        retentionDays: site.retentionDays,
        internalCidrs: site.internalCidrs,
      },
      afterData: updateData,
      note: `Cập nhật cấu hình site tracking ${site.siteId}`,
    });

    const formatted = this.formatTrackingSite(updated);
    return { ...formatted, data: formatted };
  }

  async rotateTrackingSiteKeys(idOrSiteId: string, user?: ActorInfo) {
    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ id: idOrSiteId }, { siteId: idOrSiteId }],
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy site "${idOrSiteId}".`,
      });
    }

    const newTrackingKey = `trk_live_${crypto.randomBytes(8).toString('hex')}`;
    const newServerKey = `sk_live_${crypto.randomBytes(12).toString('hex')}`;
    const newServerKeyHash = hashServerKey(newServerKey);

    const updated = await this.prisma.trackingSite.update({
      where: { id: site.id },
      data: {
        trackingKey: newTrackingKey,
        serverKey: newServerKey,
        serverKeyHash: newServerKeyHash,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'rotate_site_keys',
      entityType: 'tracking_site',
      entityId: site.siteId,
      user,
      beforeData: {
        trackingKey: maskTrackingKey(site.trackingKey),
      },
      afterData: {
        trackingKey: maskTrackingKey(newTrackingKey),
      },
      note: `Xoay khóa (rotate keys) cho site ${site.siteId}`,
    });

    const formatted = this.formatTrackingSite(updated, {
      includePlaintextKeys: true,
    });
    const out = {
      ...formatted,
      trackingKey: newTrackingKey,
      publicTrackingKey: newTrackingKey,
      serverKey: newServerKey,
    };
    return { ...out, data: out };
  }

  getTrackerScriptContent(_defaultApiBase?: string): string {
    return buildTrackerScriptSource();
  }

  async toggleTrackingSite(
    idOrSiteId: string,
    dto: ToggleTrackingSiteDto = {},
    user?: ActorInfo,
  ) {
    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ id: idOrSiteId }, { siteId: idOrSiteId }],
      },
    });
    if (!site) {
      throw new NotFoundException(`Không tìm thấy site "${idOrSiteId}".`);
    }

    const nextActive =
      dto.isActive !== undefined
        ? Boolean(dto.isActive)
        : dto.enabled !== undefined
          ? Boolean(dto.enabled)
          : !site.isActive;

    const updated = await this.prisma.trackingSite.update({
      where: { id: site.id },
      data: { isActive: nextActive },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'toggle_site',
      entityType: 'tracking_site',
      entityId: site.siteId,
      user,
      beforeData: { isActive: site.isActive },
      afterData: { isActive: updated.isActive },
      note: `${updated.isActive ? 'Bật' : 'Tắt'} tracking cho site ${site.siteId} (${site.domain})`,
    });

    const formatted = this.formatTrackingSite(updated);
    return { ...formatted, data: formatted };
  }

  async getAnonymousAudit(query: any = {}) {
    const where: any = {};
    if (query.module) where.module = String(query.module);
    if (query.action) where.action = String(query.action);
    if (query.entityId) where.entityId = String(query.entityId);

    const logs = await this.prisma.profileAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const items = logs.map((l) => ({
      ...l,
      before: l.beforeData,
      after: l.afterData,
      user: l.actorName || l.actorId || 'System',
      timestamp: l.createdAt,
    }));

    return {
      data: items,
      items,
      total: items.length,
    };
  }

  // ============================================================================
  // 2. MODULE HỒ SƠ ĐỊNH DANH 360 (/leads)
  // ============================================================================

  private normalizeFunnelStage(raw?: string): string {
    const s = String(raw || '')
      .trim()
      .toLowerCase();
    if (!s || s === 'all') return '';
    if (s === 'raw' || s === 'raw_lead' || s === 'raw lead' || s === 'rawlead')
      return 'Raw Lead';
    if (s === 'mql') return 'MQL';
    if (s === 'sql') return 'SQL';
    if (s === 'opp' || s === 'opportunity') return 'Opportunity';
    if (s === 'won' || s === 'closed_won' || s === 'closed deal') return 'Won';
    if (s === 'lost' || s === 'closed_lost') return 'Lost';
    return String(raw).trim();
  }

  async getLeads(query: any = {}, user?: ActorInfo) {
    const all = await this.prisma.identifiedLead.findMany({
      where: { mergedIntoId: null },
      orderBy: { updatedAt: 'desc' },
    });

    const funnel = this.normalizeFunnelStage(
      query.funnel || query.stage || query.funnelStage,
    );
    const tier = query.tier ? String(query.tier).trim().toLowerCase() : '';
    const owner = query.owner || query.ownerId || '';
    const sales = query.sales || query.salesId || '';
    const project = query.project || query.projectId || '';
    const isReturn = query.isReturn;
    const hasMissingData = query.hasMissingData;
    const companyCode = query.companyCode || '';
    const search = String(query.search || query.q || '')
      .trim()
      .toLowerCase();

    const filtered = all.filter((lead) => {
      if (
        funnel &&
        lead.funnelStage.toLowerCase() !== funnel.toLowerCase()
      ) {
        return false;
      }
      if (tier && tier !== 'all' && lead.tier.toLowerCase() !== tier) {
        return false;
      }
      if (owner && owner !== 'all') {
        const qOwner = String(owner).toLowerCase();
        const matchOwner =
          String(lead.ownerId || '').toLowerCase() === qOwner ||
          String(lead.ownerName || '')
            .toLowerCase()
            .includes(qOwner);
        if (!matchOwner) return false;
      }
      if (sales && sales !== 'all') {
        const qSales = String(sales).toLowerCase();
        const matchSales =
          String(lead.salesId || '').toLowerCase() === qSales ||
          String(lead.salesName || '')
            .toLowerCase()
            .includes(qSales);
        if (!matchSales) return false;
      }
      if (project && project !== 'all') {
        const qProj = String(project).toLowerCase();
        const matchProj =
          String(lead.projectId || '').toLowerCase() === qProj ||
          String(lead.projectName || '')
            .toLowerCase()
            .includes(qProj);
        if (!matchProj) return false;
      }
      if (isReturn !== undefined && isReturn !== '' && isReturn !== 'all') {
        const want = String(isReturn) === 'true';
        if (Boolean(lead.isReturn || lead.silentDays > 90) !== want)
          return false;
      }
      if (
        hasMissingData !== undefined &&
        hasMissingData !== '' &&
        hasMissingData !== 'all'
      ) {
        const want = String(hasMissingData) === 'true';
        if (Boolean(lead.hasMissingData) !== want) return false;
      }
      if (companyCode && lead.companyCode !== companyCode) {
        return false;
      }
      if (search) {
        const hay = `${lead.code} ${lead.name} ${lead.phone} ${lead.email || ''} ${lead.companyName || ''} ${lead.companyCode || ''} ${lead.anonymousId || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const limit = Math.max(
      1,
      Math.min(200, parseInt(String(query.limit || query.pageSize || '25'), 10) || 25),
    );
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = filtered
      .slice((page - 1) * limit, page * limit)
      .map((l) => this.formatLead(l));

    const stats = {
      total: all.length,
      rawLead: all.filter((l) => l.funnelStage === 'Raw Lead').length,
      mql: all.filter((l) => l.funnelStage === 'MQL').length,
      sql: all.filter((l) => l.funnelStage === 'SQL').length,
      opportunity: all.filter((l) => l.funnelStage === 'Opportunity').length,
      won: all.filter((l) => l.funnelStage === 'Won').length,
      hot: all.filter((l) => l.tier === 'Hot').length,
      warm: all.filter((l) => l.tier === 'Warm').length,
      cold: all.filter((l) => l.tier === 'Cold').length,
      returns: all.filter((l) => l.isReturn || l.silentDays > 90).length,
      missingData: all.filter((l) => l.hasMissingData).length,
    };

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      data: items,
      items,
      stats,
      pagination: { page, limit, total, totalPages },
      total,
      page,
      limit,
      totalPages,
      permissions,
    };
  }

  async getLeadById(idOrCode: string, user?: ActorInfo) {
    const lead = await this.prisma.identifiedLead.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!lead) {
      throw new NotFoundException(`Không tìm thấy Lead "${idOrCode}".`);
    }

    const formatted = this.formatLead(lead);
    const company = lead.companyCode
      ? await this.prisma.companyMaster.findFirst({
          where: { code: lead.companyCode },
        })
      : null;
    const anonymousProfile = lead.anonymousId
      ? await this.prisma.anonymousProfile.findFirst({
          where: { anonymousId: lead.anonymousId },
        })
      : null;
    const auditLogs = await this.prisma.profileAuditLog.findMany({
      where: {
        OR: [
          { entityId: lead.id },
          { entityId: lead.code },
          ...(lead.anonymousId ? [{ entityId: lead.anonymousId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const detail = {
      ...formatted,
      companyDetail: company ? this.formatCompany(company) : null,
      anonymousProfile: anonymousProfile
        ? this.formatAnonymousProfile(anonymousProfile)
        : null,
      auditLogs,
    };

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      ...detail,
      data: detail,
      permissions,
    };
  }

  /**
   * POST /api/v1/leads/:id/handover
   * Body: {salesId, salesName, note}.
   * Lưu snapshot handoverScore/tier/at. Raw Lead -> MQL tự động. Ghi audit.
   */
  async handoverLead(
    idOrCode: string,
    dto: HandoverLeadDto,
    user?: ActorInfo,
  ) {
    const lead = await this.prisma.identifiedLead.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!lead) {
      throw new NotFoundException(`Không tìm thấy Lead "${idOrCode}".`);
    }

    const actor = await this.resolveActor(user);
    const now = new Date();
    const beforeStage = lead.funnelStage;
    // Raw Lead -> MQL tự động
    const nextStage =
      beforeStage.toLowerCase() === 'raw lead' ||
      beforeStage.toLowerCase() === 'raw_lead' ||
      beforeStage.toLowerCase() === 'raw'
        ? 'MQL'
        : beforeStage;

    const snapshot = {
      handoverScore: lead.score,
      tier: lead.tier,
      at: now.toISOString(),
      salesId: dto.salesId || 'sales-01',
      salesName: dto.salesName,
      note: dto.note || '',
      handoverBy: actor.name,
      handoverById: actor.id,
      previousStage: beforeStage,
      newStage: nextStage,
    };

    const existingJourney = Array.isArray(lead.journey)
      ? [...(lead.journey as any[])]
      : [];
    existingJourney.push({
      id: `j-ho-${Date.now()}`,
      phase: 'identified',
      isAnonymousPhase: false,
      type: 'handover',
      channel: 'Sales Handover',
      title: `Bàn giao cho Sales ${dto.salesName}${beforeStage !== nextStage ? ` (${beforeStage} -> ${nextStage} tự động)` : ''}`,
      description: dto.note || null,
      scoreDelta: 0,
      timestamp: now.toISOString(),
    });

    const updated = await this.prisma.identifiedLead.update({
      where: { id: lead.id },
      data: {
        salesId: dto.salesId || 'sales-01',
        salesName: dto.salesName,
        funnelStage: nextStage,
        handoverScore: lead.score,
        handoverTier: lead.tier,
        handoverAt: now,
        handoverBy: actor.name,
        handoverNote: dto.note || null,
        handoverSnapshot: snapshot,
        journey: existingJourney,
        lastActivityAt: now,
      },
    });

    // Update company MQL count if transitioned from Raw Lead -> MQL
    if (beforeStage !== 'MQL' && nextStage === 'MQL' && lead.companyCode) {
      await this.prisma.companyMaster
        .updateMany({
          where: { code: lead.companyCode },
          data: { mqlCount: { increment: 1 } },
        })
        .catch(() => {});
    }

    await this.writeMandatoryAudit({
      module: 'identified_profiles',
      action: 'handover',
      entityType: 'lead',
      entityId: lead.code,
      user,
      beforeData: {
        funnelStage: beforeStage,
        salesId: lead.salesId,
        salesName: lead.salesName,
        handoverScore: lead.handoverScore,
        handoverTier: lead.handoverTier,
        handoverAt: lead.handoverAt,
      },
      afterData: {
        funnelStage: nextStage,
        salesId: updated.salesId,
        salesName: updated.salesName,
        handoverScore: updated.handoverScore,
        handoverTier: updated.handoverTier,
        handoverAt: updated.handoverAt,
        handoverSnapshot: snapshot,
      },
      note:
        dto.note ||
        `Bàn giao Lead ${lead.code} cho ${dto.salesName} (Score: ${lead.score}, Tier: ${lead.tier}, Stage: ${beforeStage} -> ${nextStage})`,
    });

    const formatted = this.formatLead(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * PATCH /api/v1/leads/:id
   * Cập nhật. Ghi audit trước/sau.
   */
  async updateLead(
    idOrCode: string,
    dto: UpdateLeadDto,
    user?: ActorInfo,
  ) {
    const lead = await this.prisma.identifiedLead.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!lead) {
      throw new NotFoundException(`Không tìm thấy Lead "${idOrCode}".`);
    }

    const beforeSnapshot = {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      title: lead.title,
      companyName: lead.companyName,
      companyCode: lead.companyCode,
      taxCode: lead.taxCode,
      domain: lead.domain,
      industry: lead.industry,
      companySize: lead.companySize,
      city: lead.city,
      funnelStage: lead.funnelStage,
      score: lead.score,
      tier: lead.tier,
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
      salesId: lead.salesId,
      salesName: lead.salesName,
      projectId: lead.projectId,
      projectName: lead.projectName,
      hasMissingData: lead.hasMissingData,
      missingFields: lead.missingFields,
      note: lead.note,
    };

    const nextCompanyName =
      dto.companyName !== undefined
        ? dto.companyName
        : dto.company !== undefined
          ? dto.company
          : lead.companyName;
    const nextEmail = dto.email !== undefined ? dto.email : lead.email;
    const nextTaxCode = dto.taxCode !== undefined ? dto.taxCode : lead.taxCode;
    const nextDomain = dto.domain !== undefined ? dto.domain : lead.domain;
    const nextIndustry =
      dto.industry !== undefined ? dto.industry : lead.industry;
    const nextCompanySize =
      dto.companySize !== undefined ? dto.companySize : lead.companySize;

    // Auto-match company if company/taxCode/domain changed and companyCode not explicitly set
    let nextCompanyCode =
      dto.companyCode !== undefined ? dto.companyCode : lead.companyCode;
    if (
      dto.companyCode === undefined &&
      (dto.company !== undefined ||
        dto.companyName !== undefined ||
        dto.taxCode !== undefined ||
        dto.domain !== undefined)
    ) {
      const m = await this.matchOrAssignCompany({
        companyName: nextCompanyName,
        domain: nextDomain,
        taxCode: nextTaxCode,
        email: nextEmail,
        entityId: lead.code,
      });
      if (
        (m.matchType === 'domain_exact' || m.matchType === 'tax_code_exact') &&
        m.company
      ) {
        nextCompanyCode = m.company.code;
      }
    }

    const missingFields = this.computeLeadMissingFields({
      email: nextEmail,
      taxCode: nextTaxCode,
      companyName: nextCompanyName,
      industry: nextIndustry,
      companySize: nextCompanySize,
    });
    const hasMissingData =
      dto.hasMissingData !== undefined
        ? Boolean(dto.hasMissingData)
        : missingFields.length > 0;

    const nextStage =
      dto.funnelStage || dto.funnel
        ? this.normalizeFunnelStage(dto.funnelStage || dto.funnel)
        : lead.funnelStage;

    const nextScore = dto.score !== undefined ? Number(dto.score) : lead.score;
    const nextTier =
      dto.tier ||
      (dto.score !== undefined
        ? nextScore >= 75
          ? 'Hot'
          : nextScore >= 45
            ? 'Warm'
            : 'Cold'
        : lead.tier);

    const updated = await this.prisma.identifiedLead.update({
      where: { id: lead.id },
      data: {
        name: dto.name !== undefined ? dto.name : lead.name,
        phone: dto.phone !== undefined ? dto.phone : lead.phone,
        email: nextEmail,
        title: dto.title !== undefined ? dto.title : lead.title,
        companyName: nextCompanyName,
        companyCode: nextCompanyCode,
        taxCode: nextTaxCode,
        domain: nextDomain,
        industry: nextIndustry,
        companySize: nextCompanySize,
        city: dto.city !== undefined ? dto.city : lead.city,
        funnelStage: nextStage,
        score: nextScore,
        tier: nextTier,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : lead.ownerId,
        ownerName:
          dto.ownerName !== undefined
            ? dto.ownerName
            : dto.owner !== undefined
              ? dto.owner
              : lead.ownerName,
        salesId: dto.salesId !== undefined ? dto.salesId : lead.salesId,
        salesName:
          dto.salesName !== undefined
            ? dto.salesName
            : dto.sales !== undefined
              ? dto.sales
              : lead.salesName,
        projectId: dto.projectId !== undefined ? dto.projectId : lead.projectId,
        projectName:
          dto.projectName !== undefined
            ? dto.projectName
            : dto.project !== undefined
              ? dto.project
              : lead.projectName,
        source: dto.source !== undefined ? dto.source : lead.source,
        isReturn: dto.isReturn !== undefined ? dto.isReturn : lead.isReturn,
        hasMissingData,
        missingFields,
        tags: dto.tags !== undefined ? dto.tags : (lead.tags as any),
        note: dto.note !== undefined ? dto.note : lead.note,
        lastActivityAt: new Date(),
      },
    });

    // If missing data was resolved, mark SLA item done
    if (lead.hasMissingData && !hasMissingData) {
      const actor = await this.resolveActor(user);
      await this.prisma.slaQueueItem.updateMany({
        where: {
          entityId: lead.code,
          type: 'missing_data',
          status: { in: ['pending', 'processing'] },
        },
        data: {
          status: 'done',
          resolvedAt: new Date(),
          resolvedBy: actor.id,
          resolvedByName: actor.name,
          resolution: 'data_completed',
          note: 'Đã bổ sung đầy đủ thông tin hồ sơ Lead.',
        },
      });
    }

    const afterSnapshot = {
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      title: updated.title,
      companyName: updated.companyName,
      companyCode: updated.companyCode,
      taxCode: updated.taxCode,
      domain: updated.domain,
      industry: updated.industry,
      companySize: updated.companySize,
      city: updated.city,
      funnelStage: updated.funnelStage,
      score: updated.score,
      tier: updated.tier,
      ownerId: updated.ownerId,
      ownerName: updated.ownerName,
      salesId: updated.salesId,
      salesName: updated.salesName,
      projectId: updated.projectId,
      projectName: updated.projectName,
      hasMissingData: updated.hasMissingData,
      missingFields: updated.missingFields,
      note: updated.note,
    };

    await this.writeMandatoryAudit({
      module: 'identified_profiles',
      action: 'edit_lead',
      entityType: 'lead',
      entityId: lead.code,
      user,
      beforeData: beforeSnapshot,
      afterData: afterSnapshot,
      note: dto.note || `Cập nhật hồ sơ Lead ${lead.code}`,
    });

    const formatted = this.formatLead(updated);
    return { ...formatted, data: formatted };
  }

  async mergeLeads(dto: MergeLeadsDto, user?: ActorInfo) {
    const fromLead = await this.prisma.identifiedLead.findFirst({
      where: {
        OR: [{ id: dto.fromLeadId }, { code: dto.fromLeadId }],
      },
    });
    const toLead = await this.prisma.identifiedLead.findFirst({
      where: {
        OR: [{ id: dto.toLeadId }, { code: dto.toLeadId }],
      },
    });
    if (!fromLead || !toLead) {
      throw new NotFoundException('Không tìm thấy Lead nguồn hoặc Lead đích.');
    }
    if (fromLead.id === toLead.id) {
      throw new BadRequestException('Không thể gộp cùng 1 Lead.');
    }

    const combinedJourney = [
      ...(Array.isArray(toLead.journey) ? (toLead.journey as any[]) : []),
      ...(Array.isArray(fromLead.journey) ? (fromLead.journey as any[]) : []),
    ];

    const updatedTo = await this.prisma.identifiedLead.update({
      where: { id: toLead.id },
      data: {
        email: toLead.email || fromLead.email,
        companyName: toLead.companyName || fromLead.companyName,
        companyCode: toLead.companyCode || fromLead.companyCode,
        taxCode: toLead.taxCode || fromLead.taxCode,
        domain: toLead.domain || fromLead.domain,
        score: Math.max(toLead.score, fromLead.score),
        journey: combinedJourney,
      },
    });

    await this.prisma.identifiedLead.update({
      where: { id: fromLead.id },
      data: { mergedIntoId: toLead.code },
    });

    await this.writeMandatoryAudit({
      module: 'identified_profiles',
      action: 'merge_lead',
      entityType: 'lead',
      entityId: toLead.code,
      user,
      beforeData: { fromLead: fromLead.code, toLead: toLead.code },
      afterData: { mergedInto: toLead.code },
      note: dto.note || `Gộp Lead ${fromLead.code} vào ${toLead.code}`,
    });

    const formatted = this.formatLead(updatedTo);
    return { ...formatted, data: formatted };
  }

  /**
   * GET /api/v1/leads/funnel/overview
   * Tổng quan funnel theo kỳ
   */
  async getLeadsFunnelOverview(query: any = {}) {
    const all = await this.prisma.identifiedLead.findMany({
      where: { mergedIntoId: null },
    });

    const projectId = query.projectId || query.project || '';
    const leads = projectId
      ? all.filter(
          (l) =>
            l.projectId === projectId ||
            String(l.projectName || '')
              .toLowerCase()
              .includes(String(projectId).toLowerCase()),
        )
      : all;

    const total = leads.length;
    const rawCount = leads.filter((l) => l.funnelStage === 'Raw Lead').length;
    const mqlCount = leads.filter((l) => l.funnelStage === 'MQL').length;
    const sqlCount = leads.filter((l) => l.funnelStage === 'SQL').length;
    const oppCount = leads.filter(
      (l) => l.funnelStage === 'Opportunity',
    ).length;
    const wonCount = leads.filter((l) => l.funnelStage === 'Won').length;

    // Cumulative funnel counts (every MQL was once a Raw Lead, etc.)
    const cumulativeRaw = total;
    const cumulativeMql = mqlCount + sqlCount + oppCount + wonCount;
    const cumulativeSql = sqlCount + oppCount + wonCount;
    const cumulativeOpp = oppCount + wonCount;
    const cumulativeWon = wonCount;

    const pct = (num: number, den: number) =>
      den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0;

    const stages = [
      {
        stage: 'Raw Lead',
        key: 'raw_lead',
        count: rawCount,
        cumulativeCount: cumulativeRaw,
        percentage: 100,
        conversionToNext: pct(cumulativeMql, cumulativeRaw),
        avgDaysInStage: 2.4,
      },
      {
        stage: 'MQL',
        key: 'mql',
        count: mqlCount,
        cumulativeCount: cumulativeMql,
        percentage: pct(cumulativeMql, cumulativeRaw),
        conversionToNext: pct(cumulativeSql, cumulativeMql),
        avgDaysInStage: 5.1,
      },
      {
        stage: 'SQL',
        key: 'sql',
        count: sqlCount,
        cumulativeCount: cumulativeSql,
        percentage: pct(cumulativeSql, cumulativeRaw),
        conversionToNext: pct(cumulativeOpp, cumulativeSql),
        avgDaysInStage: 8.7,
      },
      {
        stage: 'Opportunity',
        key: 'opportunity',
        count: oppCount,
        cumulativeCount: cumulativeOpp,
        percentage: pct(cumulativeOpp, cumulativeRaw),
        conversionToNext: pct(cumulativeWon, cumulativeOpp),
        avgDaysInStage: 14.2,
      },
      {
        stage: 'Won',
        key: 'won',
        count: wonCount,
        cumulativeCount: cumulativeWon,
        percentage: pct(cumulativeWon, cumulativeRaw),
        conversionToNext: 100,
        avgDaysInStage: 0,
      },
    ];

    const overview = {
      period: query.period || query.period_type || '2026-Q4',
      totalLeads: total,
      stages,
      counts: {
        rawLead: rawCount,
        mql: mqlCount,
        sql: sqlCount,
        opportunity: oppCount,
        won: wonCount,
      },
      conversionRates: {
        rawToMql: pct(cumulativeMql, cumulativeRaw),
        mqlToSql: pct(cumulativeSql, cumulativeMql),
        sqlToOpp: pct(cumulativeOpp, cumulativeSql),
        oppToWon: pct(cumulativeWon, cumulativeOpp),
        overall: pct(cumulativeWon, cumulativeRaw),
      },
      byTier: {
        Hot: leads.filter((l) => l.tier === 'Hot').length,
        Warm: leads.filter((l) => l.tier === 'Warm').length,
        Cold: leads.filter((l) => l.tier === 'Cold').length,
      },
      returningLeadsCount: leads.filter((l) => l.isReturn || l.silentDays > 90)
        .length,
      missingDataCount: leads.filter((l) => l.hasMissingData).length,
    };

    return {
      ...overview,
      data: overview,
    };
  }

  /**
   * GET /api/v1/leads/returns
   * Lead quay lại sau > 90 ngày im lặng
   */
  async getReturningLeads(query: any = {}) {
    const minSilentDays = parseInt(String(query.minDays || '90'), 10) || 90;
    const all = await this.prisma.identifiedLead.findMany({
      where: { mergedIntoId: null },
      orderBy: { silentDays: 'desc' },
    });

    const returning = all
      .filter((l) => l.isReturn || l.silentDays >= minSilentDays)
      .map((l) => ({
        ...this.formatLead(l),
        silentDays: l.silentDays || 95,
        returnedAt: l.returnedAt || l.lastActivityAt,
        returnTrigger:
          l.returnTrigger ||
          'Quay lại truy cập trang Bảng giá & Tài liệu kỹ thuật sau >90 ngày im lặng',
      }));

    return {
      data: returning,
      items: returning,
      total: returning.length,
      thresholdDays: minSilentDays,
    };
  }

  // ============================================================================
  // 3. MODULE COMPANY MASTER (/companies)
  // ============================================================================

  async getCompanies(query: any = {}, user?: ActorInfo) {
    const all = await this.prisma.companyMaster.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const search = String(query.search || query.q || '')
      .trim()
      .toLowerCase();
    const industry = query.industry
      ? String(query.industry).trim().toLowerCase()
      : '';
    const city = query.city ? String(query.city).trim().toLowerCase() : '';
    const status = query.status
      ? String(query.status).trim().toLowerCase()
      : '';

    const filtered = all.filter((c) => {
      if (status && status !== 'all' && c.status.toLowerCase() !== status) {
        return false;
      }
      if (!status && c.status === 'merged') {
        return false;
      }
      if (
        industry &&
        industry !== 'all' &&
        String(c.industry || '').toLowerCase() !== industry
      ) {
        return false;
      }
      if (
        city &&
        city !== 'all' &&
        String(c.city || '').toLowerCase() !== city
      ) {
        return false;
      }
      if (search) {
        const aliases = Array.isArray(c.aliases)
          ? (c.aliases as string[]).join(' ')
          : '';
        const hay = `${c.code} ${c.name} ${aliases} ${c.taxCode || ''} ${c.domain || ''} ${c.industry || ''} ${c.city || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const items = filtered.map((c) => this.formatCompany(c));
    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      data: items,
      items,
      total: items.length,
      stats: {
        total: items.length,
        totalPipelineValue: items.reduce(
          (sum, c) => sum + (c.pipelineValue || 0),
          0,
        ),
        totalWonValue: items.reduce((sum, c) => sum + (c.wonValue || 0), 0),
        totalLeads: items.reduce((sum, c) => sum + (c.leadCount || 0), 0),
      },
      permissions,
    };
  }

  async getCompanyByCode(codeOrId: string, user?: ActorInfo) {
    const company = await this.prisma.companyMaster.findFirst({
      where: {
        OR: [{ code: codeOrId }, { id: codeOrId }],
      },
    });
    if (!company) {
      throw new NotFoundException(`Không tìm thấy công ty "${codeOrId}".`);
    }

    const leads = await this.prisma.identifiedLead.findMany({
      where: {
        companyCode: company.code,
        mergedIntoId: null,
      },
      orderBy: { score: 'desc' },
    });

    const ipClusters = await this.prisma.ipCluster.findMany({
      where: { companyCode: company.code },
    });

    const auditLogs = await this.prisma.profileAuditLog.findMany({
      where: {
        OR: [{ entityId: company.code }, { entityId: company.id }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = this.formatCompany(company);
    const detail = {
      ...formatted,
      leads: leads.map((l) => this.formatLead(l)),
      ipClusters: ipClusters.map((c) => this.formatIpCluster(c)),
      auditLogs,
    };

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      ...detail,
      data: detail,
      permissions,
    };
  }

  /**
   * POST /api/v1/companies
   * Tạo. BE sinh code COMP-XXXXXX.
   * Matching: domain exact -> auto-assign; tax code exact -> auto-assign + merge alias; fuzzy name -> đưa vào SLA queue.
   */
  async createCompany(dto: CreateCompanyDto, user?: ActorInfo) {
    const name = String(dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('Tên công ty (name) là bắt buộc.');
    }

    // Check matching rules before creating
    const matchRes = await this.matchOrAssignCompany({
      companyName: name,
      domain: dto.domain,
      taxCode: dto.taxCode,
    });

    if (
      (matchRes.matchType === 'tax_code_exact' ||
        matchRes.matchType === 'domain_exact') &&
      matchRes.company
    ) {
      const formatted = this.formatCompany(matchRes.company);
      return {
        ...formatted,
        matchType: matchRes.matchType,
        autoAssigned: true,
        data: {
          ...formatted,
          matchType: matchRes.matchType,
          autoAssigned: true,
        },
      };
    }

    const code = await this.nextCompanyCode();
    const actor = await this.resolveActor(user);
    const created = await this.prisma.companyMaster.create({
      data: {
        code,
        name,
        aliases: Array.isArray(dto.aliases) ? dto.aliases : [],
        taxCode: dto.taxCode?.trim() || null,
        domain: dto.domain ? normalizeDomain(dto.domain) : null,
        website: dto.website || (dto.domain ? `https://${normalizeDomain(dto.domain)}` : null),
        industry: dto.industry || null,
        city: dto.city || null,
        address: dto.address || null,
        size: dto.size || 'SME',
        note: dto.note || null,
        createdBy: actor.id,
      },
    });

    await this.writeMandatoryAudit({
      module: 'company_master',
      action: 'create_company',
      entityType: 'company',
      entityId: created.code,
      user,
      beforeData: null,
      afterData: {
        code: created.code,
        name: created.name,
        taxCode: created.taxCode,
        domain: created.domain,
        matchType: matchRes.matchType,
      },
      note: `Tạo mới Company Master ${created.code} (${created.name})`,
    });

    const formatted = this.formatCompany(created);
    return {
      ...formatted,
      matchType: matchRes.matchType,
      slaQueueItem: matchRes.slaQueueItem || null,
      data: {
        ...formatted,
        matchType: matchRes.matchType,
        slaQueueItem: matchRes.slaQueueItem || null,
      },
    };
  }

  async updateCompany(
    codeOrId: string,
    dto: UpdateCompanyDto,
    user?: ActorInfo,
  ) {
    const company = await this.prisma.companyMaster.findFirst({
      where: {
        OR: [{ code: codeOrId }, { id: codeOrId }],
      },
    });
    if (!company) {
      throw new NotFoundException(`Không tìm thấy công ty "${codeOrId}".`);
    }

    const beforeSnapshot = {
      name: company.name,
      aliases: company.aliases,
      taxCode: company.taxCode,
      domain: company.domain,
      industry: company.industry,
      city: company.city,
      size: company.size,
      note: company.note,
    };

    const updated = await this.prisma.companyMaster.update({
      where: { id: company.id },
      data: {
        name: dto.name !== undefined ? dto.name : company.name,
        aliases:
          dto.aliases !== undefined ? dto.aliases : (company.aliases as any),
        taxCode: dto.taxCode !== undefined ? dto.taxCode : company.taxCode,
        domain:
          dto.domain !== undefined
            ? normalizeDomain(dto.domain)
            : company.domain,
        website: dto.website !== undefined ? dto.website : company.website,
        industry: dto.industry !== undefined ? dto.industry : company.industry,
        city: dto.city !== undefined ? dto.city : company.city,
        address: dto.address !== undefined ? dto.address : company.address,
        size: dto.size !== undefined ? dto.size : company.size,
        note: dto.note !== undefined ? dto.note : company.note,
      },
    });

    if (dto.name && dto.name !== company.name) {
      await this.prisma.identifiedLead.updateMany({
        where: { companyCode: company.code },
        data: { companyName: updated.name },
      });
    }

    await this.writeMandatoryAudit({
      module: 'company_master',
      action: 'edit_company',
      entityType: 'company',
      entityId: company.code,
      user,
      beforeData: beforeSnapshot,
      afterData: {
        name: updated.name,
        aliases: updated.aliases,
        taxCode: updated.taxCode,
        domain: updated.domain,
        industry: updated.industry,
        city: updated.city,
        size: updated.size,
        note: updated.note,
      },
      note: dto.note || `Cập nhật thông tin công ty ${company.code}`,
    });

    const formatted = this.formatCompany(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * POST /api/v1/companies/merge
   * Body: {fromCode,toCode,note}. Chỉ merge khi MKT xác nhận.
   * Gộp leads/pipeline/won/aliases. Cập nhật lead liên quan. Ghi audit.
   */
  async mergeCompanies(dto: MergeCompaniesDto, user?: ActorInfo) {
    if (dto.confirmed === false) {
      throw new BadRequestException(
        'Chỉ được phép merge công ty khi MKT xác nhận.',
      );
    }

    const fromCompany = await this.prisma.companyMaster.findFirst({
      where: {
        OR: [{ code: dto.fromCode }, { id: dto.fromCode }],
      },
    });
    const toCompany = await this.prisma.companyMaster.findFirst({
      where: {
        OR: [{ code: dto.toCode }, { id: dto.toCode }],
      },
    });

    if (!fromCompany || !toCompany) {
      throw new NotFoundException(
        `Không tìm thấy công ty nguồn (${dto.fromCode}) hoặc công ty đích (${dto.toCode}).`,
      );
    }
    if (fromCompany.id === toCompany.id) {
      throw new BadRequestException('Không thể gộp cùng 1 mã công ty.');
    }

    const toAliases = Array.isArray(toCompany.aliases)
      ? [...(toCompany.aliases as string[])]
      : [];
    const fromAliases = Array.isArray(fromCompany.aliases)
      ? (fromCompany.aliases as string[])
      : [];
    for (const candidate of [fromCompany.name, ...fromAliases]) {
      if (
        candidate &&
        candidate.toLowerCase() !== toCompany.name.toLowerCase() &&
        !toAliases.some((a) => a.toLowerCase() === candidate.toLowerCase())
      ) {
        toAliases.push(candidate);
      }
    }

    // Reassign linked leads from fromCode -> toCode
    const updatedLeadsRes = await this.prisma.identifiedLead.updateMany({
      where: { companyCode: fromCompany.code },
      data: {
        companyCode: toCompany.code,
        companyName: toCompany.name,
      },
    });

    await this.prisma.ipCluster.updateMany({
      where: { companyCode: fromCompany.code },
      data: {
        companyCode: toCompany.code,
        suspectedCompany: toCompany.name,
      },
    });

    const allTargetLeads = await this.prisma.identifiedLead.findMany({
      where: { companyCode: toCompany.code, mergedIntoId: null },
    });
    const newLeadCount = allTargetLeads.length;
    const newMqlCount = allTargetLeads.filter(
      (l) => l.funnelStage === 'MQL',
    ).length;
    const newSqlCount = allTargetLeads.filter(
      (l) => l.funnelStage === 'SQL',
    ).length;

    const mergedPipeline =
      Number(toCompany.pipelineValue || 0) +
      Number(fromCompany.pipelineValue || 0);
    const mergedWon =
      Number(toCompany.wonValue || 0) + Number(fromCompany.wonValue || 0);

    const updatedTarget = await this.prisma.companyMaster.update({
      where: { id: toCompany.id },
      data: {
        aliases: toAliases,
        taxCode: toCompany.taxCode || fromCompany.taxCode,
        domain: toCompany.domain || fromCompany.domain,
        industry: toCompany.industry || fromCompany.industry,
        city: toCompany.city || fromCompany.city,
        leadCount: newLeadCount,
        mqlCount: newMqlCount,
        sqlCount: newSqlCount,
        oppCount: (toCompany.oppCount || 0) + (fromCompany.oppCount || 0),
        wonCount: (toCompany.wonCount || 0) + (fromCompany.wonCount || 0),
        pipelineValue: mergedPipeline,
        wonValue: mergedWon,
      },
    });

    await this.prisma.companyMaster.update({
      where: { id: fromCompany.id },
      data: {
        status: 'merged',
        mergedIntoCode: toCompany.code,
        leadCount: 0,
      },
    });

    const actor = await this.resolveActor(user);
    await this.prisma.slaQueueItem.updateMany({
      where: {
        type: 'fuzzy_company',
        entityId: fromCompany.code,
        status: { in: ['pending', 'processing'] },
      },
      data: {
        status: 'done',
        resolvedAt: new Date(),
        resolvedBy: actor.id,
        resolvedByName: actor.name,
        resolution: 'merged_company',
        note:
          dto.note ||
          `Đã gộp ${fromCompany.code} vào ${toCompany.code}`,
      },
    });

    await this.writeMandatoryAudit({
      module: 'company_master',
      action: 'merge_company',
      entityType: 'company',
      entityId: toCompany.code,
      user,
      beforeData: {
        fromCode: fromCompany.code,
        fromName: fromCompany.name,
        toCode: toCompany.code,
        toName: toCompany.name,
        toPipelineBefore: Number(toCompany.pipelineValue || 0),
        toWonBefore: Number(toCompany.wonValue || 0),
      },
      afterData: {
        mergedFrom: fromCompany.code,
        intoCode: toCompany.code,
        aliases: toAliases,
        leadCount: updatedTarget.leadCount,
        reassignedLeads: updatedLeadsRes.count,
        pipelineValue: mergedPipeline,
        wonValue: mergedWon,
      },
      note:
        dto.note ||
        `MKT xác nhận gộp công ty ${fromCompany.code} (${fromCompany.name}) vào ${toCompany.code} (${toCompany.name})`,
    });

    const formatted = this.formatCompany(updatedTarget);
    return {
      ...formatted,
      mergedFrom: fromCompany.code,
      reassignedLeadsCount: updatedLeadsRes.count,
      data: {
        ...formatted,
        mergedFrom: fromCompany.code,
        reassignedLeadsCount: updatedLeadsRes.count,
      },
    };
  }

  // ============================================================================
  // 4. MODULE SLA QUEUE (/sla-queue)
  // ============================================================================

  async getSlaQueue(query: any = {}, user?: ActorInfo) {
    const all = await this.prisma.slaQueueItem.findMany({
      orderBy: { dueAt: 'asc' },
    });

    const formattedAll = all.map((item) => this.formatSlaItem(item));

    const stats = {
      overdue: formattedAll.filter((i) => i.isOverdue).length,
      dueSoon: formattedAll.filter((i) => i.isDueSoon).length,
      processing: formattedAll.filter((i) => i.status === 'processing').length,
      pending: formattedAll.filter((i) => i.status === 'pending').length,
      done: formattedAll.filter(
        (i) => i.status === 'done' || i.status === 'resolved',
      ).length,
      skipped: formattedAll.filter((i) => i.status === 'skipped').length,
      total: formattedAll.length,
    };

    const status = query.status ? String(query.status).trim().toLowerCase() : '';
    const type = query.type || query.category || '';
    const priority = query.priority
      ? String(query.priority).trim().toLowerCase()
      : '';
    const assigneeId = query.assigneeId || query.owner || '';
    const search = String(query.search || query.q || '')
      .trim()
      .toLowerCase();

    const filtered = formattedAll.filter((item) => {
      if (status && status !== 'all') {
        if (status === 'overdue' && !item.isOverdue) return false;
        else if (
          (status === 'duesoon' || status === 'due_soon') &&
          !item.isDueSoon
        )
          return false;
        else if (
          status !== 'overdue' &&
          status !== 'duesoon' &&
          status !== 'due_soon' &&
          item.status.toLowerCase() !== status
        ) {
          return false;
        }
      }
      if (
        type &&
        type !== 'all' &&
        item.type.toLowerCase() !== String(type).toLowerCase()
      ) {
        return false;
      }
      if (
        priority &&
        priority !== 'all' &&
        item.priority.toLowerCase() !== priority
      ) {
        return false;
      }
      if (assigneeId && assigneeId !== 'all') {
        const qAssignee = String(assigneeId).toLowerCase();
        const match =
          String(item.assigneeId || '').toLowerCase() === qAssignee ||
          String(item.assigneeName || '')
            .toLowerCase()
            .includes(qAssignee);
        if (!match) return false;
      }
      if (search) {
        const hay = `${item.code} ${item.title} ${item.description || ''} ${item.entityId || ''} ${item.entityName || ''} ${item.assigneeName || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const permissions = user?.id
      ? await this.permissionsService.getAuthPermissions(user.id, user.role)
      : undefined;

    return {
      data: filtered,
      items: filtered,
      stats,
      total: filtered.length,
      slaPolicy: {
        conflictHours: 24,
        duplicateHours: 24,
        missingDataHours: 48,
        overdueAlertIntervalHours: 4,
      },
      permissions,
    };
  }

  /**
   * POST /api/v1/sla-queue/:id/claim
   * Nhận xử lý (gán cho user hiện tại nếu chưa có)
   */
  async claimSlaItem(idOrCode: string, user?: ActorInfo) {
    const item = await this.prisma.slaQueueItem.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!item) {
      throw new NotFoundException(`Không tìm thấy SLA item "${idOrCode}".`);
    }

    const actor = await this.resolveActor(user);
    const beforeSnapshot = {
      status: item.status,
      assigneeId: item.assigneeId,
      assigneeName: item.assigneeName,
    };

    const updated = await this.prisma.slaQueueItem.update({
      where: { id: item.id },
      data: {
        assigneeId: item.assigneeId || actor.id,
        assigneeName: item.assigneeName || actor.name,
        status: 'processing',
        claimedAt: item.claimedAt || new Date(),
      },
    });

    await this.writeMandatoryAudit({
      module: 'sla_queue',
      action: 'claim_sla',
      entityType: 'sla_queue',
      entityId: item.code,
      user,
      beforeData: beforeSnapshot,
      afterData: {
        status: updated.status,
        assigneeId: updated.assigneeId,
        assigneeName: updated.assigneeName,
        claimedAt: updated.claimedAt,
      },
      note: `${actor.name} nhận xử lý SLA ${item.code}`,
    });

    const formatted = this.formatSlaItem(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * POST /api/v1/sla-queue/:id/resolve
   * Body: {note, resolution}
   */
  async resolveSlaItem(
    idOrCode: string,
    dto: ResolveSlaDto,
    user?: ActorInfo,
  ) {
    const item = await this.prisma.slaQueueItem.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!item) {
      throw new NotFoundException(`Không tìm thấy SLA item "${idOrCode}".`);
    }

    const actor = await this.resolveActor(user);
    const beforeSnapshot = {
      status: item.status,
      resolution: item.resolution,
      note: item.note,
    };

    const updated = await this.prisma.slaQueueItem.update({
      where: { id: item.id },
      data: {
        status: 'done',
        assigneeId: item.assigneeId || actor.id,
        assigneeName: item.assigneeName || actor.name,
        resolvedAt: new Date(),
        resolvedBy: actor.id,
        resolvedByName: actor.name,
        resolution: dto.resolution || dto.action || 'resolved',
        note: dto.note || null,
      },
    });

    await this.writeMandatoryAudit({
      module: 'sla_queue',
      action: 'resolve_sla',
      entityType: 'sla_queue',
      entityId: item.code,
      user,
      beforeData: beforeSnapshot,
      afterData: {
        status: 'done',
        resolution: updated.resolution,
        note: updated.note,
        resolvedBy: actor.name,
        resolvedAt: updated.resolvedAt,
      },
      note: dto.note || `Hoàn tất xử lý SLA ${item.code}`,
    });

    const formatted = this.formatSlaItem(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * POST /api/v1/sla-queue/:id/skip
   * Body: {reason}
   */
  async skipSlaItem(idOrCode: string, dto: SkipSlaDto, user?: ActorInfo) {
    const item = await this.prisma.slaQueueItem.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
    });
    if (!item) {
      throw new NotFoundException(`Không tìm thấy SLA item "${idOrCode}".`);
    }

    const reason = String(dto.reason || dto.note || 'Bỏ qua xử lý').trim();
    const actor = await this.resolveActor(user);
    const beforeSnapshot = { status: item.status };

    const updated = await this.prisma.slaQueueItem.update({
      where: { id: item.id },
      data: {
        status: 'skipped',
        skippedAt: new Date(),
        skippedBy: actor.name,
        skipReason: reason,
        note: reason,
      },
    });

    await this.writeMandatoryAudit({
      module: 'sla_queue',
      action: 'skip_sla',
      entityType: 'sla_queue',
      entityId: item.code,
      user,
      beforeData: beforeSnapshot,
      afterData: {
        status: 'skipped',
        skipReason: reason,
        skippedBy: actor.name,
        skippedAt: updated.skippedAt,
      },
      note: `Bỏ qua SLA ${item.code}: ${reason}`,
    });

    const formatted = this.formatSlaItem(updated);
    return { ...formatted, data: formatted };
  }

  /**
   * GET /api/v1/sla-queue/export
   * Xuất Excel/CSV
   */
  async exportSlaQueue(query: any = {}, user?: ActorInfo): Promise<{
    filename: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const queue = await this.getSlaQueue(query, user);
    const items = queue.items || [];

    await this.writeMandatoryAudit({
      module: 'sla_queue',
      action: 'export_sla',
      entityType: 'sla_queue',
      entityId: 'export',
      user,
      beforeData: null,
      afterData: { exportedRows: items.length },
      note: `Xuất dữ liệu Hàng chờ SLA (${items.length} bản ghi)`,
    });

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const headers = [
      'Mã SLA',
      'Loại',
      'Tiêu đề',
      'Đối tượng',
      'Mức ưu tiên',
      'SLA (Giờ)',
      'Trạng thái',
      'Tình trạng hạn',
      'Người xử lý',
      'Hạn xử lý',
      'Cảnh báo quá hạn (4h/lần)',
      'Ghi chú / Kết quả',
    ];

    const rows = items.map((item: any) => [
      item.code,
      item.type,
      item.title,
      item.entityName || item.entityId,
      item.priority,
      item.slaHours,
      item.status,
      item.slaState,
      item.assigneeName || 'Chưa gán',
      item.dueAt ? new Date(item.dueAt).toISOString() : '',
      item.overdueAlertsCount || 0,
      item.note || item.skipReason || item.resolution || '',
    ]);

    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r: any[]) => r.map(escapeCsv).join(',')),
    ];
    // Prepend UTF-8 BOM so Microsoft Excel opens Vietnamese text properly
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);

    return {
      filename: `sla-queue-export-${dateStr}.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csvContent, 'utf-8'),
    };
  }

  // ============================================================================
  // 5. WEBSITE TRACKING INGESTION, IDENTIFY, STATS, TIMELINE, ALERTS & RETENTION
  // (05-backend-anonymous-tracking-implementation.md)
  // ============================================================================

  private readonly rateLimitBuckets = new Map<
    string,
    { count: number; windowStart: number }
  >();

  public resetRateLimits() {
    this.rateLimitBuckets.clear();
  }

  private checkRateLimit(siteId: string, clientIp: string, limitPerMin = 120) {
    const key = `${siteId}:${clientIp || '0.0.0.0'}`;
    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      this.rateLimitBuckets.set(key, { count: 1, windowStart: now });
      return;
    }
    bucket.count += 1;
    if (bucket.count > limitPerMin) {
      throw new HttpException(
        {
          code: 'ERR_TRACKING_RATE_LIMITED',
          message: `Quá giới hạn tần suất gửi sự kiện (${limitPerMin} requests/phút).`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async nextAnonymousCode(): Promise<string> {
    const all = this.prisma.anonymousProfile?.findMany
      ? await this.prisma.anonymousProfile.findMany({
          select: { anonymousId: true },
        })
      : [];
    let maxNum = 884215;
    for (const p of all) {
      const m = String(p.anonymousId || '').match(/^ANON-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `ANON-${String(maxNum + 1).padStart(6, '0')}`;
  }

  private async nextSessionCode(): Promise<string> {
    return `SES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private async nextConflictCode(): Promise<string> {
    const all = this.prisma.anonymousConflict?.findMany
      ? await this.prisma.anonymousConflict.findMany({
          select: { code: true },
        })
      : [];
    let maxNum = 2;
    for (const c of all) {
      const m = String(c.code || '').match(/^CONF-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `CONF-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private extractPathFromUrl(url?: string, path?: string): string {
    if (path && String(path).trim()) {
      const p = String(path).trim();
      return p.startsWith('/') ? p : `/${p}`;
    }
    if (!url) return '/';
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      const s = String(url).trim();
      return s.startsWith('/') ? s : '/';
    }
  }

  private inferDeviceAndBrowser(
    ua: string,
    _screen?: string,
  ): { device: string; os: string; browser: string } {
    const u = String(ua || '');
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(u);
    const device = isMobile ? 'Mobile' : 'Desktop';
    let os = 'Windows';
    if (/Mac OS X|Macintosh/i.test(u)) os = 'macOS';
    else if (/iPhone|iPad|iOS/i.test(u)) os = 'iOS';
    else if (/Android/i.test(u)) os = 'Android';
    else if (/Linux/i.test(u)) os = 'Linux';

    let browser = 'Chrome';
    if (/Edg\//i.test(u)) browser = 'Edge';
    else if (/Firefox\//i.test(u)) browser = 'Firefox';
    else if (/Safari\//i.test(u) && !/Chrome\//i.test(u)) browser = 'Safari';
    return { device, os, browser };
  }

  /**
   * POST /api/v1/tracking/collect (Public endpoint — HTTP 202)
   */
  async collectEvents(
    dto: CollectEventsDto,
    reqContext: {
      origin?: string;
      clientIp?: string;
      userAgent?: string;
      rawSize?: number;
    } = {},
  ) {
    if (reqContext.rawSize && reqContext.rawSize > 32768) {
      throw new BadRequestException({
        code: 'ERR_TRACKING_INVALID_PAYLOAD',
        message: 'Payload vượt quá giới hạn tối đa 32KB.',
      });
    }

    if (
      !dto ||
      !dto.siteId ||
      !dto.trackingKey ||
      !Array.isArray(dto.events) ||
      dto.events.length === 0 ||
      dto.events.length > 50
    ) {
      throw new BadRequestException({
        code: 'ERR_TRACKING_INVALID_PAYLOAD',
        message:
          'Payload không hợp lệ: bắt buộc có siteId, trackingKey và mảng events (1..50 phần tử).',
      });
    }

    const clientIp = String(reqContext.clientIp || '127.0.0.1')
      .split(',')[0]
      .trim();
    this.checkRateLimit(dto.siteId, clientIp);

    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ siteId: dto.siteId }, { id: dto.siteId }],
      },
    });
    if (!site || site.trackingKey !== dto.trackingKey) {
      throw new UnauthorizedException({
        code: 'ERR_TRACKING_INVALID_KEY',
        message: 'siteId hoặc trackingKey không hợp lệ.',
      });
    }

    if (
      reqContext.origin &&
      !isOriginAllowedForSite(reqContext.origin, {
        domain: site.domain,
        allowedOrigins: site.allowedOrigins,
      })
    ) {
      throw new ForbiddenException({
        code: 'ERR_TRACKING_ORIGIN_NOT_ALLOWED',
        message: `Origin "${reqContext.origin}" không nằm trong danh sách được phép của site ${site.siteId}.`,
      });
    }

    // Site inactive -> drop all events (HTTP 202, no profile created)
    if (
      site.isActive === false ||
      String((site as any).status || '').toLowerCase() === 'inactive'
    ) {
      return {
        status: 'dropped',
        dropReason: 'site_inactive',
        ignoredReason: 'site_inactive',
        accepted: 0,
        duplicates: 0,
        deduped: 0,
        dropped: dto.events.length,
        aggregateOnly: 0,
        results: dto.events.map((ev) => ({
          eventId: ev.eventId,
          status: 'dropped',
          dropReason: 'site_inactive',
        })),
      };
    }

    // Validate all events before processing
    const nowMs = Date.now();
    const minMs = nowMs - 7 * 86400_000;
    const maxMs = nowMs + 5 * 60_000;

    for (const ev of dto.events) {
      const evType = ev?.eventType || ev?.type;
      const rawTs = ev?.occurredAt || ev?.timestamp || new Date().toISOString();
      ev.occurredAt = rawTs;
      if (!ev || !ev.eventId || !evType) {
        throw new BadRequestException({
          code: 'ERR_TRACKING_INVALID_PAYLOAD',
          message: 'Mỗi sự kiện bắt buộc có eventId, eventType/type và occurredAt.',
        });
      }
      const ts = new Date(rawTs).getTime();
      if (Number.isNaN(ts) || ts < minMs || ts > maxMs) {
        throw new BadRequestException({
          code: 'ERR_TRACKING_INVALID_PAYLOAD',
          message: `Timestamp occurredAt "${rawTs}" nằm ngoài cửa sổ hợp lệ (-7 ngày .. +5 phút).`,
        });
      }
    }

    const userAgent =
      reqContext.userAgent || (dto.context as any)?.userAgent || '';
    const isBot = isBotUserAgent(userAgent);
    const internalCidrs = Array.isArray(site.internalCidrs)
      ? (site.internalCidrs as string[])
      : [];
    const isInternal = isInternalClientIp(clientIp, internalCidrs);
    const ipHash = hashIp(clientIp);

    // Sort events chronologically by occurredAt so session & touchpoints process in order
    const sortedEvents = [...dto.events].sort(
      (a, b) =>
        new Date(String(a.occurredAt)).getTime() -
        new Date(String(b.occurredAt)).getTime(),
    );

    let accepted = 0;
    let duplicates = 0;
    let dropped = 0;
    let aggregateOnly = 0;
    const resultsByEventId = new Map<string, any>();

    for (const ev of sortedEvents) {
      const eventId = String(ev.eventId);
      const eventType = String(ev.eventType || ev.type || 'page_view');
      const occurredAt = new Date(String(ev.occurredAt));
      const meta = (ev.metadata || ev.props || {}) as Record<string, any>;
      const path = this.extractPathFromUrl(
        ev.url,
        ev.path || meta.path,
      );
      const evDuration = Math.max(
        0,
        Number(ev.durationSec ?? meta.durationSec ?? 0),
      );

      // 1. Idempotency check by eventId
      const existingEvent = this.prisma.trackingEvent?.findFirst
        ? await this.prisma.trackingEvent.findFirst({
            where: { eventId },
          })
        : this.prisma.trackingEvent?.findUnique
          ? await this.prisma.trackingEvent.findUnique({
              where: { eventId },
            })
          : null;
      if (existingEvent) {
        duplicates += 1;
        resultsByEventId.set(eventId, {
          eventId,
          status: 'duplicate',
          profileId: existingEvent.profileId || null,
        });
        continue;
      }

      // 2. Bot or Internal IP -> drop without creating profile or scoring
      if (isBot || isInternal) {
        const dropReason = isBot ? 'bot_traffic' : 'internal_ip';
        dropped += 1;
        if (this.prisma.trackingEvent?.create) {
          await this.prisma.trackingEvent.create({
            data: {
              siteId: site.siteId,
              eventId,
              eventType,
              title: ev.title || null,
              url: ev.url || null,
              referrer: ev.referrer || null,
              occurredAt,
              scoreDelta: 0,
              utm: (ev.utm as any) || undefined,
              metadata: { ...meta, path, durationSec: evDuration },
              consent: (ev.consent as any) || undefined,
              projectCode: ev.projectCode || null,
              ipHash,
              userAgent,
              status: 'dropped',
              dropReason,
            },
          });
        }
        resultsByEventId.set(eventId, {
          eventId,
          status: 'dropped',
          dropReason,
        });
        continue;
      }

      const cookieId = String(
        ev.cookieId ||
          (ev.visitor as any)?.cookieId ||
          (dto.visitor as any)?.cookieId ||
          dto.cookieId ||
          '',
      ).trim();
      const deviceId = String(
        ev.deviceId ||
          (ev.visitor as any)?.deviceId ||
          (dto.visitor as any)?.deviceId ||
          dto.deviceId ||
          '',
      ).trim();
      const externalUserId = String(
        ev.externalUserId ||
          (ev.visitor as any)?.externalUserId ||
          (dto.visitor as any)?.externalUserId ||
          dto.externalUserId ||
          '',
      ).trim();

      // 3. Cookieless / deviceless mode -> aggregate_only + IpSession upsert
      if (!cookieId && !deviceId && !externalUserId) {
        aggregateOnly += 1;
        if (this.prisma.trackingEvent?.create) {
          await this.prisma.trackingEvent.create({
            data: {
              siteId: site.siteId,
              eventId,
              eventType,
              title: ev.title || null,
              url: ev.url || null,
              referrer: ev.referrer || null,
              occurredAt,
              scoreDelta: 0,
              utm: (ev.utm as any) || undefined,
              metadata: { ...meta, path, durationSec: evDuration },
              consent: (ev.consent as any) || undefined,
              projectCode: ev.projectCode || null,
              ipHash,
              userAgent,
              status: 'aggregate_only',
            },
          });
        }

        // Upsert IpSession for cookieless traffic
        if (clientIp && this.prisma.ipSession) {
          const clientSessionId = ev.sessionId || `ip_${ipHash.slice(0, 12)}`;
          const existingIpSession = await this.prisma.ipSession.findFirst({
            where: { siteId: site.siteId, ipHash },
          });
          if (existingIpSession) {
            const nextPv =
              (existingIpSession.pageViews || 0) +
              (eventType === 'page_view' ? 1 : 0);
            await this.prisma.ipSession.update({
              where: { id: existingIpSession.id },
              data: {
                pageViews: nextPv,
                engaged: Boolean(existingIpSession.engaged) || nextPv >= 2 || evDuration > 10,
                lastActivityAt:
                  occurredAt > existingIpSession.lastActivityAt
                    ? occurredAt
                    : existingIpSession.lastActivityAt,
              },
            });
          } else {
            await this.prisma.ipSession.create({
              data: {
                siteId: site.siteId,
                ipHash,
                clientSessionId,
                pageViews: eventType === 'page_view' ? 1 : 0,
                engaged: evDuration > 10,
                startedAt: occurredAt,
                lastActivityAt: occurredAt,
              },
            });
          }
        }

        resultsByEventId.set(eventId, {
          eventId,
          status: 'aggregate_only',
        });
        continue;
      }

      // 4. Resolve Profile by priority: externalUserId > cookieId > deviceId
      let profileByExt: any = null;
      let profileByCookie: any = null;
      let profileByDevice: any = null;

      if (externalUserId) {
        profileByExt = await this.prisma.anonymousProfile.findFirst({
          where: { siteId: site.siteId, externalUserId },
        });
      }
      if (cookieId) {
        if (this.prisma.profileIdentifier?.findFirst) {
          const piCk = await this.prisma.profileIdentifier.findFirst({
            where: {
              siteId: site.siteId,
              keyType: 'cookie',
              keyValue: cookieId,
              conflictLocked: false,
            },
          });
          if (piCk) {
            profileByCookie = await this.prisma.anonymousProfile.findFirst({
              where: { id: piCk.profileId },
            });
          }
        }
        if (!profileByCookie) {
          profileByCookie = await this.prisma.anonymousProfile.findFirst({
            where: { siteId: site.siteId, cookieId },
          });
        }
      }
      if (deviceId) {
        if (this.prisma.profileIdentifier?.findFirst) {
          const piFp = await this.prisma.profileIdentifier.findFirst({
            where: {
              siteId: site.siteId,
              keyType: 'device',
              keyValue: deviceId,
              conflictLocked: false,
            },
          });
          if (piFp) {
            profileByDevice = await this.prisma.anonymousProfile.findFirst({
              where: { id: piFp.profileId },
            });
          }
        }
        if (!profileByDevice) {
          profileByDevice = await this.prisma.anonymousProfile.findFirst({
            where: { siteId: site.siteId, deviceId },
          });
        }
      }

      // Check identifier mismatch conflict (cookie points to Profile A, device points to Profile B)
      let mismatchConflict: any = null;
      if (
        profileByCookie &&
        profileByDevice &&
        profileByCookie.id !== profileByDevice.id
      ) {
        const phones = Array.from(
          new Set(
            [
              profileByCookie.identifiedPhone,
              profileByDevice.identifiedPhone,
            ].filter(Boolean),
          ),
        ) as string[];
        const conflictCode = await this.nextConflictCode();
        mismatchConflict = await this.prisma.anonymousConflict.create({
          data: {
            code: conflictCode,
            keyType: 'cookie',
            keyValue: cookieId || deviceId,
            status: 'pending',
            severity: 'high',
            reason: `Xung đột định danh giữa Cookie (${maskCookie(cookieId)}) thuộc ${profileByCookie.anonymousId} và Device (${maskDevice(deviceId)}) thuộc ${profileByDevice.anonymousId} — chặn auto-merge.`,
            phones,
            profiles: [
              {
                id: profileByCookie.id,
                anonymousId: profileByCookie.anonymousId,
                score: profileByCookie.score,
                tier: profileByCookie.tier,
                phone: profileByCookie.identifiedPhone || null,
              },
              {
                id: profileByDevice.id,
                anonymousId: profileByDevice.anonymousId,
                score: profileByDevice.score,
                tier: profileByDevice.tier,
                phone: profileByDevice.identifiedPhone || null,
              },
            ],
            detectedAt: new Date(),
            slaDueAt: new Date(Date.now() + 24 * 3600_000),
          },
        });
      }

      let profile = profileByExt || profileByCookie || profileByDevice;
      let isNewProfile = false;
      const uaInfo = this.inferDeviceAndBrowser(
        userAgent,
        (dto.context as any)?.screen,
      );

      // Match IP Cluster if any
      let matchedCluster: any = null;
      if (clientIp && this.prisma.ipCluster?.findMany) {
        const clusters = await this.prisma.ipCluster.findMany();
        matchedCluster =
          clusters.find((c) => isIpInCidr(clientIp, c.ipRange)) || null;
      }

      if (!profile) {
        isNewProfile = true;
        const anonymousId = await this.nextAnonymousCode();
        profile = await this.prisma.anonymousProfile.create({
          data: {
            anonymousId,
            cookieId: cookieId || '',
            deviceId: deviceId || '',
            externalUserId: externalUserId || null,
            ip: clientIp,
            trackingKey: site.trackingKey,
            siteId: site.siteId,
            siteName: site.name,
            domain: site.domain,
            status: 'active',
            score: 35,
            tier: 'Cold',
            firstSeenAt: occurredAt,
            lastSeenAt: occurredAt,
            visitCount: 1,
            userType: 'new',
            pageViews: 0,
            totalDurationSec: 0,
            engaged: false,
            device: uaInfo.device,
            os: uaInfo.os,
            browser: uaInfo.browser,
            utmSource: ev.utm?.source || null,
            utmMedium: ev.utm?.medium || null,
            utmCampaign: ev.utm?.campaign || null,
            topPages: [],
            events: [],
            suspectedCompany:
              matchedCluster?.status === 'confirmed'
                ? matchedCluster.suspectedCompany
                : null,
            companyConfidence:
              matchedCluster?.status === 'confirmed'
                ? matchedCluster.confidence
                : 0,
            ipClusterId: matchedCluster?.code || null,
            hasConflict: Boolean(mismatchConflict),
            conflictId: mismatchConflict?.code || null,
          },
        });

        await this.prisma.trackingSite.update({
          where: { id: site.id },
          data: { profilesCount: { increment: 1 } },
        });
      }

      // Upsert ProfileIdentifiers
      if (this.prisma.profileIdentifier) {
        const idPairs: Array<{ keyType: string; keyValue: string; maskedValue: string }> = [];
        if (cookieId)
          idPairs.push({
            keyType: 'cookie',
            keyValue: cookieId,
            maskedValue: maskCookie(cookieId),
          });
        if (deviceId)
          idPairs.push({
            keyType: 'device',
            keyValue: deviceId,
            maskedValue: maskDevice(deviceId),
          });
        if (externalUserId)
          idPairs.push({
            keyType: 'external_user_id',
            keyValue: externalUserId,
            maskedValue: externalUserId,
          });

        for (const pair of idPairs) {
          const existingPi = await this.prisma.profileIdentifier.findFirst({
            where: {
              siteId: site.siteId,
              keyType: pair.keyType,
              keyValue: pair.keyValue,
            },
          });
          if (existingPi) {
            await this.prisma.profileIdentifier.update({
              where: { id: existingPi.id },
              data: {
                lastSeenAt:
                  occurredAt > existingPi.lastSeenAt
                    ? occurredAt
                    : existingPi.lastSeenAt,
              },
            });
          } else {
            await this.prisma.profileIdentifier.create({
              data: {
                siteId: site.siteId,
                profileId: profile.id,
                keyType: pair.keyType,
                keyValue: pair.keyValue,
                maskedValue: pair.maskedValue,
                phone: profile.identifiedPhone || null,
                firstSeenAt: occurredAt,
                lastSeenAt: occurredAt,
              },
            });
          }
        }
      }

      // 5. Website Return Alert (§6.10: returning after >= 7 days, deduped 24h)
      if (!isNewProfile && profile.lastSeenAt && this.prisma.anonymousAlert) {
        const prevLastSeenMs = new Date(profile.lastSeenAt).getTime();
        const gapMs = occurredAt.getTime() - prevLastSeenMs;
        if (gapMs >= 7 * 86400_000) {
          const silentDays = Math.floor(gapMs / 86400_000);
          const recentAlert = await this.prisma.anonymousAlert.findFirst({
            where: {
              profileId: profile.id,
              type: 'website_return',
              createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
            },
          });
          if (!recentAlert) {
            await this.prisma.anonymousAlert.create({
              data: {
                profileId: profile.id,
                type: 'website_return',
                severity: profile.tier === 'Hot' ? 'high' : 'medium',
                status: 'new',
                scoreAtCreation: profile.score,
                message: `Hồ sơ ${profile.anonymousId} quay lại website (${path}) sau ${silentDays} ngày im lặng`,
              },
            });
          }
        }
      }

      // 6. Session resolution (30-minute rolling window)
      let session: any = null;
      let isNewSession = false;
      const isPageView =
        eventType === 'page_view' || eventType === 'pricing_view';

      if (this.prisma.trackingSession) {
        const latestSession = await this.prisma.trackingSession.findFirst({
          where: { siteId: site.siteId, profileId: profile.id },
          orderBy: { lastActivityAt: 'desc' },
        });
        const gapFromSessionMs = latestSession
          ? Math.abs(
              occurredAt.getTime() -
                new Date(latestSession.lastActivityAt).getTime(),
            )
          : Infinity;

        if (!latestSession || gapFromSessionMs > 30 * 60_000) {
          isNewSession = true;
          const clientSessionId =
            ev.sessionId && !latestSession
              ? ev.sessionId
              : await this.nextSessionCode();
          const sessPageViews = isPageView ? 1 : 0;
          const sessEngaged =
            evDuration > 10 ||
            sessPageViews >= 2 ||
            eventType === 'form_submit';
          session = await this.prisma.trackingSession.create({
            data: {
              siteId: site.siteId,
              profileId: profile.id,
              clientSessionId,
              startedAt: occurredAt,
              lastActivityAt: occurredAt,
              durationSec: evDuration,
              pageViews: sessPageViews,
              engaged: sessEngaged,
              converted: eventType === 'form_submit',
              userType:
                !isNewProfile && (profile.visitCount || 1) >= 1
                  ? 'returning'
                  : 'new',
              source: ev.utm?.source || null,
              medium: ev.utm?.medium || null,
              campaign: ev.utm?.campaign || null,
              referrer: ev.referrer || null,
              landingUrl: ev.url || path,
            },
          });
        } else {
          const nextDuration = (latestSession.durationSec || 0) + evDuration;
          const nextPageViews =
            (latestSession.pageViews || 0) + (isPageView ? 1 : 0);
          const nextConverted =
            Boolean(latestSession.converted) || eventType === 'form_submit';
          const nextEngaged =
            Boolean(latestSession.engaged) ||
            nextDuration > 10 ||
            nextPageViews >= 2 ||
            nextConverted;
          session = await this.prisma.trackingSession.update({
            where: { id: latestSession.id },
            data: {
              lastActivityAt:
                occurredAt > latestSession.lastActivityAt
                  ? occurredAt
                  : latestSession.lastActivityAt,
              durationSec: nextDuration,
              pageViews: nextPageViews,
              engaged: nextEngaged,
              converted: nextConverted,
            },
          });
        }
      }

      // 7. Touchpoints (firstTouch preserved, lastTouch updated when attribution present)
      let urlUtmSource: string | null = null;
      let urlUtmMedium: string | null = null;
      let urlUtmCampaign: string | null = null;
      if (ev.url) {
        try {
          const parsedUrl = new URL(ev.url, 'https://mkthub.vn');
          urlUtmSource = parsedUrl.searchParams.get('utm_source');
          urlUtmMedium = parsedUrl.searchParams.get('utm_medium');
          urlUtmCampaign = parsedUrl.searchParams.get('utm_campaign');
        } catch {
          // ignore invalid url
        }
      }
      const effUtmSource = ev.utm?.source || urlUtmSource || null;
      const effUtmMedium = ev.utm?.medium || urlUtmMedium || null;
      const effUtmCampaign = ev.utm?.campaign || urlUtmCampaign || null;

      const hasAttribution = Boolean(
        effUtmSource ||
          effUtmMedium ||
          effUtmCampaign ||
          ev.clickIds?.gclid ||
          ev.clickIds?.fbclid ||
          ev.clickIds?.ttclid ||
          ev.referrer,
      );
      const touchSource =
        effUtmSource || (ev.referrer ? 'referral' : 'direct');
      const touchMedium =
        effUtmMedium || (ev.referrer ? 'referral' : 'none');
      const touchData = {
        source: touchSource,
        utmSource: effUtmSource || touchSource,
        medium: touchMedium,
        utmMedium: effUtmMedium || touchMedium,
        campaign: effUtmCampaign,
        utmCampaign: effUtmCampaign,
        referrer: ev.referrer || null,
        url: ev.url || path,
        landingPath: path,
        touchedAt: occurredAt.toISOString(),
      };

      const nextFirstTouch = profile.firstTouch || touchData;
      const nextLastTouch =
        hasAttribution || !profile.lastTouch ? touchData : profile.lastTouch;

      if (this.prisma.profileTouchpoint?.create) {
        if (!profile.firstTouch) {
          await this.prisma.profileTouchpoint
            .create({
              data: {
                profileId: profile.id,
                sessionId: session?.id || null,
                occurredAt,
                source: touchData.source,
                medium: touchData.medium,
                campaign: touchData.campaign,
                referrer: touchData.referrer,
                url: touchData.url,
                isFirst: true,
                isLast: !hasAttribution,
              },
            })
            .catch(() => {});
        } else if (hasAttribution) {
          await this.prisma.profileTouchpoint
            .create({
              data: {
                profileId: profile.id,
                sessionId: session?.id || null,
                occurredAt,
                source: touchData.source,
                medium: touchData.medium,
                campaign: touchData.campaign,
                referrer: touchData.referrer,
                url: touchData.url,
                isFirst: false,
                isLast: true,
              },
            })
            .catch(() => {});
        }
      }

      // 8. Compute score, timeline ordering & profile aggregates
      const prevScore = Number(profile.score || 0);
      const scoreDelta = computeEventScoreDelta(eventType, {
        ...meta,
        path,
        durationSec: evDuration,
      });

      const nextScore = Math.min(
        100,
        Math.max(0, prevScore + scoreDelta),
      );
      const nextTier = computeTierFromScore(nextScore);

      if (prevScore < 75 && nextScore >= 75 && this.prisma.anonymousAlert?.create) {
        await this.prisma.anonymousAlert
          .create({
            data: {
              profileId: profile.id,
              type: 'hot_anonymous',
              severity: 'high',
              status: 'new',
              scoreAtCreation: nextScore,
              message: `Hồ sơ ${profile.anonymousId} đạt ngưỡng Hot (${nextScore} điểm) tại ${path}`,
            },
          })
          .catch(() => {});
      }

      const nextVisitCount =
        !isNewProfile && isNewSession
          ? (profile.visitCount || 1) + 1
          : profile.visitCount || 1;
      const nextUserType = nextVisitCount >= 2 ? 'returning' : 'new';
      const nextPageViews = (profile.pageViews || 0) + (isPageView ? 1 : 0);
      const nextDurationSec = (profile.totalDurationSec || 0) + evDuration;
      const nextEngaged =
        Boolean(profile.engaged) ||
        Boolean(session?.engaged) ||
        nextDurationSec > 10 ||
        nextPageViews >= 2 ||
        eventType === 'form_submit';

      const existingTopPages = Array.isArray(profile.topPages)
        ? [...(profile.topPages as string[])]
        : [];
      if (path && !existingTopPages.includes(path)) {
        existingTopPages.push(path);
      }

      const existingEvents = Array.isArray(profile.events)
        ? [...(profile.events as any[])]
        : [];
      existingEvents.push({
        id: eventId,
        eventId,
        type: eventType,
        eventType,
        title: ev.title || path || eventType,
        page: path,
        url: ev.url || null,
        timestamp: occurredAt.toISOString(),
        occurredAt: occurredAt.toISOString(),
        durationSec: evDuration,
        scoreDelta,
        sessionId: session?.clientSessionId || session?.id || null,
      });
      // Sort events chronologically by occurredAt so late events appear in order
      existingEvents.sort(
        (a, b) =>
          new Date(a.occurredAt || a.timestamp).getTime() -
          new Date(b.occurredAt || b.timestamp).getTime(),
      );

      const nextFirstSeenAt =
        occurredAt < new Date(profile.firstSeenAt)
          ? occurredAt
          : new Date(profile.firstSeenAt);
      const nextLastSeenAt =
        occurredAt > new Date(profile.lastSeenAt)
          ? occurredAt
          : new Date(profile.lastSeenAt);

      profile = await this.prisma.anonymousProfile.update({
        where: { id: profile.id },
        data: {
          cookieId: cookieId || profile.cookieId,
          deviceId: deviceId || profile.deviceId,
          externalUserId: externalUserId || profile.externalUserId,
          ip: clientIp || profile.ip,
          score: nextScore,
          tier: nextTier,
          firstSeenAt: nextFirstSeenAt,
          lastSeenAt: nextLastSeenAt,
          visitCount: nextVisitCount,
          userType: nextUserType,
          pageViews: nextPageViews,
          totalDurationSec: nextDurationSec,
          engaged: nextEngaged,
          utmSource: effUtmSource || profile.utmSource,
          utmMedium: effUtmMedium || profile.utmMedium,
          utmCampaign: effUtmCampaign || profile.utmCampaign,
          firstTouch: nextFirstTouch as any,
          lastTouch: nextLastTouch as any,
          topPages: existingTopPages,
          events: existingEvents,
          hasConflict: Boolean(mismatchConflict) || profile.hasConflict,
          conflictId: mismatchConflict?.code || profile.conflictId,
        },
      });

      if (this.prisma.trackingEvent?.create) {
        await this.prisma.trackingEvent.create({
          data: {
            siteId: site.siteId,
            eventId,
            profileId: profile.id,
            sessionId: session?.id || null,
            eventType,
            title: ev.title || path || eventType,
            url: ev.url || null,
            referrer: ev.referrer || null,
            occurredAt,
            scoreDelta,
            utm: (ev.utm as any) || undefined,
            metadata: { ...meta, path, durationSec: evDuration },
            consent: (ev.consent as any) || undefined,
            projectCode: ev.projectCode || null,
            ipHash,
            userAgent,
            status: 'accepted',
          },
        });
      }

      accepted += 1;
      resultsByEventId.set(eventId, {
        eventId,
        status: 'accepted',
        profileId: profile.id,
        anonymousId: profile.anonymousId,
        sessionId: session?.clientSessionId || session?.id || null,
        scoreDelta,
        score: profile.score,
        tier: profile.tier,
        userType: profile.userType,
        engaged: profile.engaged,
        conflictCode: mismatchConflict?.code || null,
      });
    }

    if (accepted > 0) {
      await this.prisma.trackingSite.update({
        where: { id: site.id },
        data: {
          eventsCount: { increment: accepted },
          lastPingAt: new Date(),
        },
      });
    }

    const orderedResults = dto.events.map(
      (e) =>
        resultsByEventId.get(String(e.eventId)) || {
          eventId: e.eventId,
          status: 'accepted',
        },
    );
    const firstDroppedReason =
      orderedResults.find((r) => r.dropReason)?.dropReason || undefined;

    return {
      status:
        accepted > 0
          ? 'accepted'
          : duplicates > 0
            ? 'duplicate'
            : aggregateOnly > 0
              ? 'aggregate_only'
              : 'dropped',
      accepted,
      duplicates,
      deduped: duplicates,
      dropped,
      aggregateOnly,
      dropReason: firstDroppedReason,
      ignoredReason: firstDroppedReason,
      results: orderedResults,
    };
  }

  /**
   * POST /api/v1/tracking/identify (Server-to-Server / Form Identify)
   */
  async identifyVisitor(
    dto: IdentifyTrackingDto,
    headers: {
      siteId?: string;
      serverKey?: string;
      trackingKey?: string;
      origin?: string;
      clientIp?: string;
      userAgent?: string;
    } = {},
  ) {
    const siteId = String(headers.siteId || dto?.siteId || '').trim();
    const serverKey = String(headers.serverKey || dto?.serverKey || '').trim();
    const trackingKey = String(
      headers.trackingKey || dto?.trackingKey || '',
    ).trim();

    if (!siteId || (!serverKey && !trackingKey)) {
      throw new UnauthorizedException({
        code: 'ERR_TRACKING_INVALID_KEY',
        message:
          'Thiếu thông tin xác thực X-MKT-Site-Id hoặc X-MKT-Server-Key.',
      });
    }

    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ siteId }, { id: siteId }],
      },
    });
    const incomingHash = serverKey ? hashServerKey(serverKey) : '';
    const keyValid =
      site &&
      ((serverKey &&
        ((site.serverKey && site.serverKey === serverKey) ||
          (site.serverKeyHash && site.serverKeyHash === incomingHash))) ||
        (trackingKey && site.trackingKey === trackingKey));
    if (!site || !keyValid) {
      throw new UnauthorizedException({
        code: 'ERR_TRACKING_INVALID_KEY',
        message: 'X-MKT-Site-Id hoặc X-MKT-Server-Key không hợp lệ.',
      });
    }

    // Validate & normalize Vietnamese phone
    const normalizedPhone = normalizeVietnamesePhone(dto.phone);
    if (!normalizedPhone) {
      throw new UnprocessableEntityException({
        code: 'ERR_ANON_PHONE_INVALID',
        message: `Số điện thoại "${dto.phone || ''}" không đúng chuẩn Việt Nam (10 số 03/05/07/08/09, không lặp giả).`,
      });
    }

    // Idempotency check by eventId
    if (dto.eventId && this.prisma.trackingEvent?.findFirst) {
      const existingEv = await this.prisma.trackingEvent.findFirst({
        where: { eventId: dto.eventId },
      });
      if (existingEv) {
        const meta = (existingEv.metadata as any) || {};
        return {
          status: 'duplicate',
          duplicate: true,
          eventId: dto.eventId,
          phone: normalizedPhone,
          leadId: meta.leadId || null,
          anonymousId: meta.anonymousId || null,
        };
      }
    }

    const cookieId = String(
      dto.cookieId || (dto.visitor as any)?.cookieId || '',
    ).trim();
    const deviceId = String(
      dto.deviceId || (dto.visitor as any)?.deviceId || '',
    ).trim();
    const externalUserId = String(
      dto.externalUserId || (dto.visitor as any)?.externalUserId || '',
    ).trim();

    // Find matching AnonymousProfile
    let profile: any = null;
    if (dto.anonymousId) {
      profile = await this.prisma.anonymousProfile.findFirst({
        where: {
          OR: [{ anonymousId: dto.anonymousId }, { id: dto.anonymousId }],
        },
      });
    }
    if (!profile && externalUserId) {
      profile = await this.prisma.anonymousProfile.findFirst({
        where: { siteId: site.siteId, externalUserId },
      });
    }
    if (!profile && cookieId) {
      profile = await this.prisma.anonymousProfile.findFirst({
        where: { siteId: site.siteId, cookieId },
      });
    }
    if (!profile && deviceId) {
      profile = await this.prisma.anonymousProfile.findFirst({
        where: { siteId: site.siteId, deviceId },
      });
    }

    // Check multi-phone key conflict (1 cookie/device key mapped to >= 2 distinct phones)
    const distinctPhones = new Set<string>([normalizedPhone]);
    if (profile?.identifiedPhone) {
      distinctPhones.add(profile.identifiedPhone.trim());
    }

    if (cookieId || deviceId) {
      const orClauses: any[] = [];
      if (cookieId) orClauses.push({ cookieId });
      if (deviceId) orClauses.push({ deviceId });
      const matchingLeads = await this.prisma.identifiedLead.findMany({
        where: { OR: orClauses },
      });
      for (const l of matchingLeads) {
        if (l.phone) distinctPhones.add(l.phone.trim());
      }

      if (this.prisma.profileIdentifier?.findMany) {
        const piOr: any[] = [];
        if (cookieId) piOr.push({ keyType: 'cookie', keyValue: cookieId });
        if (deviceId) piOr.push({ keyType: 'device', keyValue: deviceId });
        const identifiers = await this.prisma.profileIdentifier.findMany({
          where: { siteId: site.siteId, OR: piOr },
        });
        for (const pi of identifiers) {
          if (pi.phone) distinctPhones.add(pi.phone.trim());
        }
      }
    }

    let createdConflict: any = null;
    const hasMultiPhoneConflict = distinctPhones.size >= 2;

    if (hasMultiPhoneConflict) {
      const phonesArr = Array.from(distinctPhones);
      const conflictCode = await this.nextConflictCode();
      const keyType = cookieId ? 'cookie' : 'device';
      const keyValue = cookieId || deviceId || profile?.cookieId || 'unknown';

      createdConflict = await this.prisma.anonymousConflict.create({
        data: {
          code: conflictCode,
          keyType,
          keyValue,
          status: 'pending',
          severity: 'high',
          reason: `1 ${keyType} key ghi nhận ${phonesArr.length} SĐT khác nhau (${phonesArr.join(', ')}) — chặn auto-merge theo quy tắc BDD-02.`,
          phones: phonesArr,
          profiles: profile
            ? [
                {
                  id: profile.id,
                  anonymousId: profile.anonymousId,
                  name: dto.name || profile.identifiedName || 'Khách hàng mới',
                  phone: normalizedPhone,
                  company: dto.company || profile.suspectedCompany || null,
                  score: profile.score,
                  tier: profile.tier,
                },
              ]
            : [],
          detectedAt: new Date(),
          slaDueAt: new Date(Date.now() + 24 * 3600_000),
        },
      });

      const slaCode = await this.nextSlaCode();
      await this.prisma.slaQueueItem.create({
        data: {
          code: slaCode,
          type: 'conflict',
          title: `Xung đột định danh ${conflictCode}: 1 key map ${phonesArr.length} SĐT`,
          description: createdConflict.reason,
          entityType: 'anonymous_conflict',
          entityId: conflictCode,
          entityName: `${profile?.anonymousId || site.siteId} (${phonesArr.join(', ')})`,
          priority: 'high',
          slaHours: 24,
          status: 'pending',
          dueAt: new Date(Date.now() + 24 * 3600_000),
          metadata: {
            conflictCode,
            phones: phonesArr,
            keyType,
            canAutoMerge: false,
          },
        },
      });

      // Lock ProfileIdentifier on conflict
      if (this.prisma.profileIdentifier?.findMany && (cookieId || deviceId)) {
        const piOr: any[] = [];
        if (cookieId) piOr.push({ keyType: 'cookie', keyValue: cookieId });
        if (deviceId) piOr.push({ keyType: 'device', keyValue: deviceId });
        const identifiers = await this.prisma.profileIdentifier.findMany({
          where: { siteId: site.siteId, OR: piOr },
        });
        for (const pi of identifiers) {
          await this.prisma.profileIdentifier.update({
            where: { id: pi.id },
            data: { conflictLocked: true, phone: normalizedPhone },
          });
        }
      }
    }

    // Resolve projectCode and LandingPageMapping (§6.11)
    let resolvedProjectCode: string | null = dto.projectCode || null;
    const resolvedProjectName: string | null = null;
    let projectCounted = true;

    if (!resolvedProjectCode && dto.landingPageId) {
      const mapping = this.prisma.landingPageMapping?.findFirst
        ? await this.prisma.landingPageMapping.findFirst({
            where: {
              siteId: site.siteId,
              landingPageId: dto.landingPageId,
            },
          })
        : null;
      if (mapping) {
        resolvedProjectCode = mapping.projectId;
      } else {
        projectCounted = false;
        if (this.prisma.anonymousAlert?.create) {
          await this.prisma.anonymousAlert.create({
            data: {
              profileId: profile?.id || 'unmapped',
              type: 'unmapped_landing_page',
              severity: 'medium',
              status: 'new',
              message: `Landing Page "${dto.landingPageId}" trên ${site.siteId} chưa cấu hình mapping dự án (SĐT: ${normalizedPhone}).`,
            },
          });
        }
      }
    }

    // Find or create IdentifiedLead by normalizedPhone
    let lead = await this.prisma.identifiedLead.findFirst({
      where: {
        phone: normalizedPhone,
        mergedIntoId: null,
      },
    });

    const leadName =
      dto.name?.trim() ||
      lead?.name ||
      `Khách hàng ${normalizedPhone.slice(-4)}`;
    const companyName =
      dto.company?.trim() ||
      lead?.companyName ||
      profile?.suspectedCompany ||
      null;

    const matchRes = await this.matchOrAssignCompany({
      companyName,
      domain: dto.domain || site.domain,
      taxCode: dto.taxCode,
      email: dto.email,
      entityId: profile?.anonymousId || normalizedPhone,
    });
    const assignedCompany =
      matchRes.matchType === 'domain_exact' ||
      matchRes.matchType === 'tax_code_exact'
        ? matchRes.company
        : null;

    if (lead) {
      const existingJourney = Array.isArray(lead.journey)
        ? [...(lead.journey as any[])]
        : [];
      existingJourney.push({
        id: dto.eventId || `ident-${Date.now()}`,
        phase: 'identified',
        isAnonymousPhase: false,
        type: 'identify',
        channel: dto.source || `Web Identify (${site.siteId})`,
        title: `Ghi nhận định danh từ website (${leadName} - ${normalizedPhone})`,
        page: dto.path || dto.url || null,
        scoreDelta: 15,
        timestamp: new Date().toISOString(),
      });
      const nextScore = Math.min(100, (lead.score || 50) + 15);
      lead = await this.prisma.identifiedLead.update({
        where: { id: lead.id },
        data: {
          name: dto.name?.trim() || lead.name,
          email: dto.email || lead.email,
          title: dto.title || lead.title,
          companyName: assignedCompany?.name || companyName || lead.companyName,
          companyCode: assignedCompany?.code || lead.companyCode,
          score: nextScore,
          tier: computeTierFromScore(nextScore),
          lastActivityAt: new Date(),
          journey: existingJourney,
          anonymousId:
            !hasMultiPhoneConflict && profile?.anonymousId
              ? profile.anonymousId
              : lead.anonymousId,
        },
      });
    } else {
      const leadCode = await this.nextLeadCode();
      const baseScore = profile?.score || 45;
      const newScore = Math.min(100, baseScore + 20);
      const newTier = computeTierFromScore(newScore);
      const missingFields = this.computeLeadMissingFields({
        email: dto.email,
        taxCode: dto.taxCode || assignedCompany?.taxCode,
        companyName: assignedCompany?.name || companyName,
        industry: assignedCompany?.industry,
        companySize: assignedCompany?.size,
      });

      const anonEvents =
        !hasMultiPhoneConflict && Array.isArray(profile?.events)
          ? (profile.events as any[])
          : [];
      const journey = [
        ...anonEvents.map((ev: any, idx: number) => ({
          id: ev.id || `anon-ev-${idx + 1}`,
          phase: 'anonymous',
          isAnonymousPhase: true,
          type: ev.type || 'page_view',
          channel: `Web Tracking (${site.siteId})`,
          title: `[Ẩn danh ${profile?.anonymousId}] ${ev.title || ev.page || 'Hoạt động ẩn danh'}`,
          page: ev.page || null,
          scoreDelta: ev.scoreDelta || 0,
          timestamp: ev.timestamp || new Date().toISOString(),
        })),
        {
          id: dto.eventId || `ident-${Date.now()}`,
          phase: 'conversion',
          isAnonymousPhase: false,
          type: 'identify',
          channel: dto.source || `Web Form (${site.siteId})`,
          title: `Định danh từ Website: ${leadName} (${normalizedPhone})`,
          page: dto.path || dto.url || null,
          scoreDelta: 20,
          timestamp: new Date().toISOString(),
        },
      ];

      lead = await this.prisma.identifiedLead.create({
        data: {
          code: leadCode,
          anonymousId: !hasMultiPhoneConflict
            ? profile?.anonymousId || null
            : null,
          name: leadName,
          phone: normalizedPhone,
          email: dto.email || null,
          title: dto.title || null,
          companyName: assignedCompany?.name || companyName,
          companyCode: assignedCompany?.code || null,
          taxCode: dto.taxCode || assignedCompany?.taxCode || null,
          domain: assignedCompany?.domain || dto.domain || null,
          industry: assignedCompany?.industry || null,
          companySize: assignedCompany?.size || null,
          city: assignedCompany?.city || profile?.city || null,
          funnelStage: 'Raw Lead',
          score: newScore,
          demographicScore: 25,
          behaviorScore: Math.max(0, newScore - 25),
          tier: newTier,
          projectId: projectCounted
            ? resolvedProjectCode || 'proj-lead-2026'
            : null,
          projectName: projectCounted
            ? resolvedProjectName || 'LEAD GENERATION 2026'
            : null,
          source: dto.source || `Website (${site.siteId})`,
          utmSource: dto.utm?.source || profile?.utmSource || null,
          utmMedium: dto.utm?.medium || profile?.utmMedium || null,
          utmCampaign: dto.utm?.campaign || profile?.utmCampaign || null,
          isReturn: false,
          silentDays: 0,
          lastActivityAt: new Date(),
          hasMissingData: missingFields.length > 0,
          missingFields,
          journey,
          scoreHistory: [
            {
              id: `sh-${Date.now()}`,
              date: new Date().toISOString().slice(0, 10),
              timestamp: new Date().toISOString(),
              score: newScore,
              delta: newScore,
              tier: newTier,
              reason: `Định danh qua API /tracking/identify (${site.siteId})`,
            },
          ],
          ip: profile?.ip || headers.clientIp || null,
          cookieId: cookieId || profile?.cookieId || null,
          deviceId: deviceId || profile?.deviceId || null,
          trackingKey: site.trackingKey,
          tags: [
            'Web Identify',
            ...(projectCounted ? [] : ['Unmapped Landing Page']),
          ],
          note: dto.note || null,
        },
      });
    }

    // Update AnonymousProfile status if found
    if (profile) {
      if (hasMultiPhoneConflict) {
        profile = await this.prisma.anonymousProfile.update({
          where: { id: profile.id },
          data: {
            status: 'conflict',
            hasConflict: true,
            conflictId: createdConflict?.code || profile.conflictId,
          },
        });
      } else {
        profile = await this.prisma.anonymousProfile.update({
          where: { id: profile.id },
          data: {
            status: 'identified',
            convertedLeadId: lead.code,
            convertedAt: new Date(),
            identifiedPhone: normalizedPhone,
            identifiedName: lead.name,
            identifiedCompany: lead.companyName,
          },
        });
      }
    }

    if (dto.eventId && this.prisma.trackingEvent?.create) {
      await this.prisma.trackingEvent.create({
        data: {
          siteId: site.siteId,
          eventId: dto.eventId,
          profileId: profile?.id || null,
          eventType: 'identify',
          title: `Identify ${leadName} (${normalizedPhone})`,
          url: dto.url || null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          scoreDelta: 20,
          metadata: {
            leadId: lead.code,
            anonymousId: profile?.anonymousId || null,
            phone: normalizedPhone,
            conflictCode: createdConflict?.code || null,
          },
          status: 'accepted',
        },
      });
    }

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'identify_visitor',
      entityType: 'anonymous_profile',
      entityId: profile?.anonymousId || lead.code,
      beforeData: profile
        ? { anonymousId: profile.anonymousId, status: 'active' }
        : null,
      afterData: {
        anonymousId: profile?.anonymousId || null,
        leadCode: lead.code,
        phone: normalizedPhone,
        conflictCreated: hasMultiPhoneConflict,
        conflictCode: createdConflict?.code || null,
        projectCode: resolvedProjectCode,
        projectCounted,
      },
      note: `Định danh visitor qua /tracking/identify -> Lead ${lead.code}`,
    });

    return {
      status: hasMultiPhoneConflict ? 'conflict' : 'identified',
      duplicate: false,
      phone: normalizedPhone,
      anonymousId: profile?.anonymousId || null,
      leadId: lead.code,
      leadCode: lead.code,
      lead: this.formatLead(lead),
      conflictCreated: hasMultiPhoneConflict,
      conflictCode: createdConflict?.code || null,
      canAutoMerge: !hasMultiPhoneConflict,
      projectCode: resolvedProjectCode,
      projectCounted,
    };
  }

  private checkEventSiteRateLimit(
    siteId: string,
    clientIp: string,
    limitPerMin?: number,
  ) {
    const limit =
      limitPerMin ??
      (Number(process.env.LEAD_FROM_EVENT_SITE_RATE_LIMIT) > 0
        ? Number(process.env.LEAD_FROM_EVENT_SITE_RATE_LIMIT)
        : 60);
    const key = `event-lead:${siteId}:${clientIp || '0.0.0.0'}`;
    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      this.rateLimitBuckets.set(key, { count: 1, windowStart: now });
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((60_000 - (now - bucket.windowStart)) / 1000),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'ERR_TRACKING_RATE_LIMITED',
          code: 'ERR_TRACKING_RATE_LIMITED',
          retryAfter,
          message: `Quá giới hạn tần suất gửi dữ liệu (${limit} requests/phút). Vui lòng thử lại sau ${retryAfter}s.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async nextRegistrationCode(): Promise<string> {
    let maxNum = 788;
    if (this.prisma.trackingEvent?.findMany) {
      const evs = await this.prisma.trackingEvent.findMany({
        where: { eventType: 'form_submit_tonghoplink' },
      });
      for (const ev of evs) {
        const regId = String((ev.metadata as any)?.registrationId || '');
        const m = regId.match(/^REG-\d{4}-(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
    if (this.prisma.identifiedLead?.findMany) {
      const leads = await this.prisma.identifiedLead.findMany({
        select: { journey: true },
      });
      for (const l of leads) {
        const jArr = Array.isArray(l.journey) ? (l.journey as any[]) : [];
        for (const item of jArr) {
          const regId = String(item?.registrationId || '');
          const m = regId.match(/^REG-\d{4}-(\d+)$/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
      }
    }
    return `REG-2026-${String(maxNum + 1).padStart(4, '0')}`;
  }

  /**
   * POST /api/v1/leads/from-event-site
   * Public endpoint nhận Lead trực tiếp từ Website sự kiện tonghoplink (06-be-request-lead-from-tonghoplink.md)
   */
  async createLeadFromEventSite(
    dto: LeadFromEventSiteDto,
    reqContext: {
      siteId?: string;
      serverKey?: string;
      trackingKey?: string;
      origin?: string;
      clientIp?: string;
      userAgent?: string;
    } = {},
  ) {
    // 0. Feature flag check
    if (
      String(process.env.LEAD_FROM_EVENT_SITE_ENABLED || 'true').toLowerCase() ===
      'false'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'ERR_TRACKING_SITE_INACTIVE',
        code: 'ERR_TRACKING_SITE_INACTIVE',
        message: 'Endpoint nhận Lead từ event site đang tạm tắt.',
      });
    }

    // 1. Verify siteId + serverKey + Origin + isActive
    const siteId = String(reqContext.siteId || dto?.siteId || '').trim();
    const serverKey = String(
      reqContext.serverKey || dto?.serverKey || '',
    ).trim();
    const trackingKey = String(
      reqContext.trackingKey || dto?.trackingKey || '',
    ).trim();

    if (!siteId || (!serverKey && !trackingKey)) {
      throw new UnauthorizedException({
        statusCode: 401,
        errorCode: 'ERR_TRACKING_INVALID_KEY',
        code: 'ERR_TRACKING_INVALID_KEY',
        message: 'Invalid siteId or serverKey',
      });
    }

    const site = await this.prisma.trackingSite.findFirst({
      where: {
        OR: [{ siteId }, { id: siteId }],
      },
    });
    const incomingHash = serverKey ? hashServerKey(serverKey) : '';
    const keyValid =
      site &&
      ((serverKey &&
        ((site.serverKey && site.serverKey === serverKey) ||
          (site.serverKeyHash && site.serverKeyHash === incomingHash))) ||
        (trackingKey && site.trackingKey === trackingKey));

    if (!site || !keyValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        errorCode: 'ERR_TRACKING_INVALID_KEY',
        code: 'ERR_TRACKING_INVALID_KEY',
        message: 'Invalid siteId or serverKey',
      });
    }

    if (
      site.isActive === false ||
      String((site as any).status || '').toLowerCase() === 'inactive'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'ERR_TRACKING_SITE_INACTIVE',
        code: 'ERR_TRACKING_SITE_INACTIVE',
        message: `Tracking site ${site.siteId} is inactive`,
      });
    }

    if (
      reqContext.origin &&
      !isOriginAllowedForSite(reqContext.origin, {
        domain: site.domain,
        allowedOrigins: site.allowedOrigins,
      })
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'ERR_TRACKING_ORIGIN_NOT_ALLOWED',
        code: 'ERR_TRACKING_ORIGIN_NOT_ALLOWED',
        message: `Origin "${reqContext.origin}" is not allowed for site ${site.siteId}`,
      });
    }

    const clientIp = String(reqContext.clientIp || '127.0.0.1')
      .split(',')[0]
      .trim();
    this.checkEventSiteRateLimit(site.siteId, clientIp);

    // 2. Validate & normalize payload (phone, email, fullName/name, company, title, utm/source)
    if (
      !dto ||
      dto.phone === undefined ||
      dto.phone === null ||
      !String(dto.phone).trim()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: 'ERR_LEAD_INVALID_PAYLOAD',
        code: 'ERR_LEAD_INVALID_PAYLOAD',
        message: 'Missing required field: phone',
      });
    }

    const normalizedPhone = normalizeVietnamesePhone(dto.phone);
    if (!normalizedPhone) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        errorCode: 'ERR_ANON_PHONE_INVALID',
        code: 'ERR_ANON_PHONE_INVALID',
        message: 'Invalid Vietnamese phone number',
      });
    }

    let normalizedEmail: string | null = null;
    if (
      dto.email !== undefined &&
      dto.email !== null &&
      String(dto.email).trim() !== ''
    ) {
      const candidateEmail = String(dto.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_LEAD_INVALID_PAYLOAD',
          code: 'ERR_LEAD_INVALID_PAYLOAD',
          message: 'Invalid email format',
        });
      }
      normalizedEmail = candidateEmail;
    }

    const rawName = String(dto.fullName || dto.name || '')
      .trim()
      .replace(/\s+/g, ' ');
    const rawCompany = dto.company
      ? String(dto.company).trim().replace(/\s+/g, ' ')
      : '';
    const rawTitle = dto.title
      ? String(dto.title).trim().replace(/\s+/g, ' ')
      : '';
    const resolvedEventCode = dto.eventCode
      ? String(dto.eventCode).trim()
      : null;
    const resolvedSource =
      String(dto.source || dto.utm?.source || 'tonghoplink').trim() ||
      'tonghoplink';
    const resolvedUtmSource =
      String(dto.utm?.source || dto.source || '').trim() || null;
    const resolvedUtmMedium =
      String(dto.utm?.medium || dto.medium || '').trim() || null;
    const resolvedUtmCampaign =
      String(dto.utm?.campaign || dto.campaign || '').trim() || null;
    const landingUrl = (dto.landingPageUrl || dto.url || '').trim() || null;
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    // 3. Idempotency check by eventId
    const rawEventId = dto.eventId ? String(dto.eventId).trim() : '';
    if (rawEventId && this.prisma.trackingEvent?.findFirst) {
      const existingEv = await this.prisma.trackingEvent.findFirst({
        where: { eventId: rawEventId },
      });
      if (existingEv) {
        const meta = (existingEv.metadata as any) || {};
        const savedRes = meta.responseData || {
          leadId: meta.leadId || null,
          leadCode: meta.leadCode || meta.leadId || null,
          created: false,
          updated: false,
          anonymousProfileId: meta.anonymousProfileId || null,
          converted: Boolean(meta.converted),
          projectCounted: Boolean(meta.projectCounted ?? true),
          eventCounted: false,
          registrationId: meta.registrationId || null,
          duplicate: true,
        };
        const dupPayload = {
          ...savedRes,
          created: false,
          updated: false,
          eventCounted: false,
          duplicate: true,
        };
        return {
          ...dupPayload,
          data: dupPayload,
        };
      }
    }

    // 4. Lookup AnonymousProfile by cookieId, deviceId, or sessionId & check Multi-Phone Conflict
    const cookieId = String(dto.cookieId || '').trim();
    const deviceId = String(dto.deviceId || '').trim();
    const sessionId = String(dto.sessionId || '').trim();

    let profile: any = null;
    if (cookieId) {
      if (this.prisma.profileIdentifier?.findFirst) {
        const piCk = await this.prisma.profileIdentifier.findFirst({
          where: {
            siteId: site.siteId,
            keyType: 'cookie',
            keyValue: cookieId,
          },
        });
        if (piCk) {
          profile = await this.prisma.anonymousProfile.findFirst({
            where: { id: piCk.profileId },
          });
        }
      }
      if (!profile) {
        profile = await this.prisma.anonymousProfile.findFirst({
          where: { siteId: site.siteId, cookieId },
        });
      }
      if (!profile) {
        profile = await this.prisma.anonymousProfile.findFirst({
          where: { cookieId },
        });
      }
    }

    if (!profile && deviceId) {
      if (this.prisma.profileIdentifier?.findFirst) {
        const piFp = await this.prisma.profileIdentifier.findFirst({
          where: {
            siteId: site.siteId,
            keyType: 'device',
            keyValue: deviceId,
          },
        });
        if (piFp) {
          profile = await this.prisma.anonymousProfile.findFirst({
            where: { id: piFp.profileId },
          });
        }
      }
      if (!profile) {
        profile = await this.prisma.anonymousProfile.findFirst({
          where: { siteId: site.siteId, deviceId },
        });
      }
      if (!profile) {
        profile = await this.prisma.anonymousProfile.findFirst({
          where: { deviceId },
        });
      }
    }

    if (!profile && sessionId && this.prisma.trackingSession?.findFirst) {
      const sess = await this.prisma.trackingSession.findFirst({
        where: {
          OR: [{ clientSessionId: sessionId }, { id: sessionId }],
        },
      });
      if (sess?.profileId) {
        profile = await this.prisma.anonymousProfile.findFirst({
          where: { id: sess.profileId },
        });
      }
    }

    // Check multi-phone conflict (Rule B1 / §4.3: 1 cookieId/deviceId mapped to >= 2 phones)
    const distinctPhones = new Set<string>([normalizedPhone]);
    if (profile?.identifiedPhone) {
      distinctPhones.add(String(profile.identifiedPhone).trim());
    }
    if (cookieId || deviceId) {
      const leadOr: any[] = [];
      if (cookieId) leadOr.push({ cookieId });
      if (deviceId) leadOr.push({ deviceId });
      const matchingLeads = await this.prisma.identifiedLead.findMany({
        where: { OR: leadOr },
      });
      for (const l of matchingLeads) {
        if (l.phone) distinctPhones.add(String(l.phone).trim());
      }

      const matchingProfiles = await this.prisma.anonymousProfile.findMany({
        where: { OR: leadOr },
      });
      for (const mp of matchingProfiles) {
        if (mp.identifiedPhone) {
          distinctPhones.add(String(mp.identifiedPhone).trim());
        }
      }

      if (this.prisma.profileIdentifier?.findMany) {
        const piOr: any[] = [];
        if (cookieId) piOr.push({ keyType: 'cookie', keyValue: cookieId });
        if (deviceId) piOr.push({ keyType: 'device', keyValue: deviceId });
        const identifiers = await this.prisma.profileIdentifier.findMany({
          where: { OR: piOr },
        });
        for (const pi of identifiers) {
          if (pi.phone) distinctPhones.add(String(pi.phone).trim());
        }
      }
    }

    if (distinctPhones.size >= 2) {
      const phonesArr = Array.from(distinctPhones);
      const conflictCode = await this.nextConflictCode();
      const keyType = cookieId ? 'cookie' : 'device';
      const keyValue = cookieId || deviceId || profile?.cookieId || 'unknown';

      const createdConflict = await this.prisma.anonymousConflict.create({
        data: {
          code: conflictCode,
          keyType,
          keyValue,
          status: 'pending',
          severity: 'high',
          reason: `1 ${keyType} key ghi nhận ${phonesArr.length} SĐT khác nhau (${phonesArr.join(', ')}) từ form sự kiện (${site.siteId}) — chặn auto-merge theo quy tắc BDD-02.`,
          phones: phonesArr,
          profiles: profile
            ? [
                {
                  id: profile.id,
                  anonymousId: profile.anonymousId,
                  name: rawName || profile.identifiedName || 'Khách hàng mới',
                  phone: normalizedPhone,
                  company: rawCompany || profile.suspectedCompany || null,
                  score: profile.score,
                  tier: profile.tier,
                },
              ]
            : [],
          detectedAt: new Date(),
          slaDueAt: new Date(Date.now() + 24 * 3600_000),
        },
      });

      const slaCode = await this.nextSlaCode();
      await this.prisma.slaQueueItem.create({
        data: {
          code: slaCode,
          type: 'conflict',
          title: `Xung đột định danh ${conflictCode}: 1 key map ${phonesArr.length} SĐT`,
          description: createdConflict.reason,
          entityType: 'anonymous_conflict',
          entityId: conflictCode,
          entityName: `${profile?.anonymousId || site.siteId} (${phonesArr.join(', ')})`,
          priority: 'high',
          slaHours: 24,
          status: 'pending',
          dueAt: new Date(Date.now() + 24 * 3600_000),
          metadata: {
            conflictCode,
            phones: phonesArr,
            keyType,
            canAutoMerge: false,
          },
        },
      });

      if (this.prisma.profileIdentifier?.findMany && (cookieId || deviceId)) {
        const piOr: any[] = [];
        if (cookieId) piOr.push({ keyType: 'cookie', keyValue: cookieId });
        if (deviceId) piOr.push({ keyType: 'device', keyValue: deviceId });
        const identifiers = await this.prisma.profileIdentifier.findMany({
          where: { OR: piOr },
        });
        for (const pi of identifiers) {
          await this.prisma.profileIdentifier.update({
            where: { id: pi.id },
            data: { conflictLocked: true },
          });
        }
      }

      if (profile) {
        await this.prisma.anonymousProfile.update({
          where: { id: profile.id },
          data: {
            status: 'conflict',
            hasConflict: true,
            conflictId: createdConflict.code,
          },
        });
      }

      await this.writeMandatoryAudit({
        module: 'anonymous_profiles',
        action: 'lead_from_event_site_conflict',
        entityType: 'anonymous_conflict',
        entityId: createdConflict.code,
        beforeData: profile
          ? { anonymousId: profile.anonymousId, status: profile.status }
          : null,
        afterData: {
          conflictCode: createdConflict.code,
          phones: phonesArr,
          keyType,
          canAutoMerge: false,
        },
        note: `Chặn auto-merge do xung đột định danh trên /leads/from-event-site (${site.siteId})`,
      });

      throw new ConflictException({
        statusCode: 409,
        errorCode: 'ERR_ANON_IDENTITY_CONFLICT',
        code: 'ERR_ANON_IDENTITY_CONFLICT',
        conflictCode: createdConflict.code,
        canAutoMerge: false,
        message: 'This identifier is linked to a different phone number',
      });
    }

    // 5. Resolve Project Mapping & Check Existing Lead + Event Registration Deduplication
    let resolvedProjectCode: string | null = dto.projectCode || null;
    let projectCounted = true;
    if (!resolvedProjectCode && dto.landingPageId) {
      const mapping = this.prisma.landingPageMapping?.findFirst
        ? await this.prisma.landingPageMapping.findFirst({
            where: {
              siteId: site.siteId,
              landingPageId: dto.landingPageId,
            },
          })
        : null;
      if (mapping) {
        resolvedProjectCode = mapping.projectId;
      } else {
        projectCounted = false;
      }
    }

    let lead = await this.prisma.identifiedLead.findFirst({
      where: {
        phone: normalizedPhone,
        mergedIntoId: null,
      },
    });

    let registrationId: string | null = null;
    let eventCounted = false;
    let isDuplicateEventReg = false;

    if (resolvedEventCode) {
      const leadJourney = Array.isArray(lead?.journey)
        ? (lead.journey as any[])
        : [];
      const prevJourneyReg = leadJourney.find(
        (j) =>
          j &&
          (j.eventCode === resolvedEventCode ||
            j.metadata?.eventCode === resolvedEventCode),
      );

      let prevEvReg: any = null;
      if (!prevJourneyReg && this.prisma.trackingEvent?.findMany) {
        const allEventSubmits = await this.prisma.trackingEvent.findMany({
          where: { eventType: 'form_submit_tonghoplink' },
        });
        prevEvReg = allEventSubmits.find((ev) => {
          const m = (ev.metadata as any) || {};
          return (
            m.phone === normalizedPhone && m.eventCode === resolvedEventCode
          );
        });
      }

      if (prevJourneyReg || prevEvReg) {
        registrationId =
          prevJourneyReg?.registrationId ||
          (prevEvReg?.metadata as any)?.registrationId ||
          'REG-2026-0001';
        eventCounted = false;
        isDuplicateEventReg = true;
      } else {
        registrationId = await this.nextRegistrationCode();
        eventCounted = true;
        isDuplicateEventReg = false;
      }
    }

    // 6. Match Company & Create or Update IdentifiedLead
    const candidateCompanyName =
      rawCompany || lead?.companyName || profile?.suspectedCompany || null;
    const matchRes = await this.matchOrAssignCompany({
      companyName: candidateCompanyName,
      domain: site.domain,
      email: normalizedEmail || lead?.email,
      entityId: profile?.anonymousId || normalizedPhone,
    });
    const assignedCompany =
      matchRes.matchType === 'domain_exact' ||
      matchRes.matchType === 'tax_code_exact'
        ? matchRes.company
        : null;

    let created = false;
    let updated = false;

    if (lead) {
      created = false;
      updated = true;

      // Only fill fields that are currently empty/placeholder (do not overwrite existing non-empty fields)
      const isPlaceholderName =
        !lead.name ||
        !lead.name.trim() ||
        /^Khách hàng \d{4}$/.test(lead.name.trim());
      const nextName =
        isPlaceholderName && rawName ? rawName : lead.name;
      const nextEmail =
        lead.email && String(lead.email).trim()
          ? lead.email
          : normalizedEmail || null;
      const nextTitle =
        lead.title && String(lead.title).trim()
          ? lead.title
          : rawTitle || null;
      const nextCompanyName =
        lead.companyName && String(lead.companyName).trim()
          ? lead.companyName
          : assignedCompany?.name ||
            rawCompany ||
            profile?.suspectedCompany ||
            null;
      const nextCompanyCode =
        lead.companyCode || assignedCompany?.code || null;

      const existingJourney = Array.isArray(lead.journey)
        ? [...(lead.journey as any[])]
        : [];
      if (!isDuplicateEventReg) {
        existingJourney.push({
          id: rawEventId || `evt-reg-${Date.now()}`,
          phase: 'identified',
          isAnonymousPhase: false,
          type: resolvedEventCode
            ? 'event_registration'
            : 'form_submit_tonghoplink',
          channel: resolvedSource,
          title: resolvedEventCode
            ? `Đăng ký sự kiện ${resolvedEventCode} (${registrationId})`
            : `Đăng ký từ Website Sự kiện (${site.siteId})`,
          page: landingUrl,
          eventCode: resolvedEventCode,
          registrationId,
          metadata: dto.metadata || null,
          scoreDelta: 15,
          timestamp: occurredAt.toISOString(),
        });
      }

      const existingTags = Array.isArray(lead.tags)
        ? [...(lead.tags as string[])]
        : [];
      if (!existingTags.includes('Tonghoplink')) {
        existingTags.push('Tonghoplink');
      }
      if (
        resolvedEventCode &&
        !existingTags.includes(`Event:${resolvedEventCode}`)
      ) {
        existingTags.push(`Event:${resolvedEventCode}`);
      }

      const nextScore = isDuplicateEventReg
        ? lead.score || 60
        : Math.min(100, (lead.score || 50) + 15);
      const missingFields = this.computeLeadMissingFields({
        email: nextEmail,
        taxCode: lead.taxCode || assignedCompany?.taxCode,
        companyName: nextCompanyName,
        industry: lead.industry || assignedCompany?.industry,
        companySize: lead.companySize || assignedCompany?.size,
      });

      lead = await this.prisma.identifiedLead.update({
        where: { id: lead.id },
        data: {
          name: nextName,
          email: nextEmail,
          title: nextTitle,
          companyName: nextCompanyName,
          companyCode: nextCompanyCode,
          utmSource: lead.utmSource || resolvedUtmSource || profile?.utmSource || null,
          utmMedium: lead.utmMedium || resolvedUtmMedium || profile?.utmMedium || null,
          utmCampaign:
            lead.utmCampaign || resolvedUtmCampaign || profile?.utmCampaign || null,
          score: nextScore,
          tier: computeTierFromScore(nextScore),
          lastActivityAt: occurredAt,
          hasMissingData: missingFields.length > 0,
          missingFields,
          journey: existingJourney,
          tags: existingTags,
          anonymousId: lead.anonymousId || profile?.anonymousId || null,
          cookieId: lead.cookieId || cookieId || profile?.cookieId || null,
          deviceId: lead.deviceId || deviceId || profile?.deviceId || null,
        },
      });
    } else {
      created = true;
      updated = false;

      const leadCode = await this.nextLeadCode();
      const leadName =
        rawName ||
        profile?.identifiedName ||
        `Khách hàng ${normalizedPhone.slice(-4)}`;
      const baseScore = profile?.score || 45;
      const newScore = Math.min(100, baseScore + 20);
      const newTier = computeTierFromScore(newScore);
      const finalCompanyName =
        assignedCompany?.name ||
        rawCompany ||
        profile?.suspectedCompany ||
        null;
      const missingFields = this.computeLeadMissingFields({
        email: normalizedEmail,
        taxCode: assignedCompany?.taxCode,
        companyName: finalCompanyName,
        industry: assignedCompany?.industry,
        companySize: assignedCompany?.size,
      });

      const anonEvents = Array.isArray(profile?.events)
        ? (profile.events as any[])
        : [];
      const journey = [
        ...anonEvents.map((ev: any, idx: number) => ({
          id: ev.id || `anon-ev-${idx + 1}`,
          phase: 'anonymous',
          isAnonymousPhase: true,
          type: ev.type || 'page_view',
          channel: `Web Tracking (${site.siteId})`,
          title: `[Ẩn danh ${profile?.anonymousId}] ${ev.title || ev.page || 'Hoạt động ẩn danh'}`,
          page: ev.page || null,
          scoreDelta: ev.scoreDelta || 0,
          timestamp: ev.timestamp || occurredAt.toISOString(),
        })),
        {
          id: rawEventId || `evt-reg-${Date.now()}`,
          phase: 'conversion',
          isAnonymousPhase: false,
          type: resolvedEventCode
            ? 'event_registration'
            : 'form_submit_tonghoplink',
          channel: resolvedSource,
          title: resolvedEventCode
            ? `Đăng ký sự kiện ${resolvedEventCode} (${registrationId})`
            : `Đăng ký từ Website Sự kiện (${site.siteId})`,
          page: landingUrl,
          eventCode: resolvedEventCode,
          registrationId,
          metadata: dto.metadata || null,
          scoreDelta: 20,
          timestamp: occurredAt.toISOString(),
        },
      ];

      const tags = ['Tonghoplink'];
      if (resolvedEventCode) {
        tags.push(`Event:${resolvedEventCode}`);
      }
      if (!projectCounted) {
        tags.push('Unmapped Landing Page');
      }

      lead = await this.prisma.identifiedLead.create({
        data: {
          code: leadCode,
          anonymousId: profile?.anonymousId || null,
          name: leadName,
          phone: normalizedPhone,
          email: normalizedEmail,
          title: rawTitle || null,
          companyName: finalCompanyName,
          companyCode: assignedCompany?.code || null,
          taxCode: assignedCompany?.taxCode || null,
          domain: assignedCompany?.domain || null,
          industry: assignedCompany?.industry || null,
          companySize: assignedCompany?.size || null,
          city: assignedCompany?.city || profile?.city || null,
          funnelStage: 'Raw Lead',
          score: newScore,
          demographicScore: 25,
          behaviorScore: Math.max(0, newScore - 25),
          tier: newTier,
          projectId: projectCounted
            ? resolvedProjectCode || 'proj-event-2026'
            : null,
          projectName: projectCounted
            ? resolvedProjectCode || 'SMARTLOG EVENT 2026'
            : null,
          source: resolvedSource,
          utmSource: resolvedUtmSource || profile?.utmSource || null,
          utmMedium: resolvedUtmMedium || profile?.utmMedium || null,
          utmCampaign: resolvedUtmCampaign || profile?.utmCampaign || null,
          isReturn: false,
          silentDays: 0,
          lastActivityAt: occurredAt,
          hasMissingData: missingFields.length > 0,
          missingFields,
          journey,
          scoreHistory: [
            {
              id: `sh-${Date.now()}`,
              date: occurredAt.toISOString().slice(0, 10),
              timestamp: occurredAt.toISOString(),
              score: newScore,
              delta: newScore,
              tier: newTier,
              reason: `Đăng ký từ Website Sự kiện (${resolvedSource})`,
            },
          ],
          ip: profile?.ip || clientIp || null,
          cookieId: cookieId || profile?.cookieId || null,
          deviceId: deviceId || profile?.deviceId || null,
          trackingKey: site.trackingKey,
          tags,
          note: (dto.metadata as any)?.question || null,
        },
      });
    }

    // 7. Convert / link AnonymousProfile if found
    let anonymousProfileId: string | null = null;
    let converted = false;

    if (profile) {
      profile = await this.prisma.anonymousProfile.update({
        where: { id: profile.id },
        data: {
          status: 'identified',
          convertedLeadId: lead.code,
          convertedAt: profile.convertedAt || new Date(),
          identifiedPhone: normalizedPhone,
          identifiedName: lead.name,
          identifiedCompany: lead.companyName,
        },
      });
      anonymousProfileId = profile.id;
      converted = true;

      if (this.prisma.profileIdentifier?.findMany) {
        const pis = await this.prisma.profileIdentifier.findMany({
          where: { profileId: profile.id },
        });
        for (const pi of pis) {
          await this.prisma.profileIdentifier.update({
            where: { id: pi.id },
            data: { phone: normalizedPhone, lastSeenAt: occurredAt },
          });
        }
      }

      if (this.prisma.trackingSession?.findMany) {
        const sessions = await this.prisma.trackingSession.findMany({
          where: { profileId: profile.id },
        });
        for (const s of sessions) {
          await this.prisma.trackingSession.update({
            where: { id: s.id },
            data: { converted: true, engaged: true },
          });
        }
      }
    }

    const responseData = {
      leadId: lead.code,
      leadCode: lead.code,
      created,
      updated,
      anonymousProfileId,
      anonymousId: profile?.anonymousId || null,
      converted,
      projectCounted,
      eventCounted,
      registrationId,
      duplicate: isDuplicateEventReg,
    };

    // 8. Save TrackingEvent (for idempotency and timeline) & update site stats
    const persistedEventId =
      rawEventId ||
      `evt-tonghop-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    if (this.prisma.trackingEvent?.create) {
      await this.prisma.trackingEvent.create({
        data: {
          siteId: site.siteId,
          eventId: persistedEventId,
          profileId: profile?.id || null,
          sessionId: sessionId || null,
          eventType: 'form_submit_tonghoplink',
          title: resolvedEventCode
            ? `Đăng ký sự kiện ${resolvedEventCode}`
            : `Đăng ký Lead từ ${resolvedSource}`,
          url: landingUrl,
          referrer: dto.referrer || null,
          occurredAt,
          scoreDelta: 20,
          utm: dto.utm
            ? dto.utm
            : {
                source: resolvedUtmSource,
                medium: resolvedUtmMedium,
                campaign: resolvedUtmCampaign,
              },
          projectCode: resolvedProjectCode,
          ipHash: hashIp(clientIp),
          userAgent: reqContext.userAgent || null,
          metadata: {
            leadId: lead.code,
            leadCode: lead.code,
            anonymousId: profile?.anonymousId || null,
            anonymousProfileId,
            phone: normalizedPhone,
            eventCode: resolvedEventCode,
            registrationId,
            converted,
            projectCounted,
            eventCounted,
            formMetadata: dto.metadata || null,
            responseData,
          },
          status: 'accepted',
        },
      });
    }

    if (this.prisma.trackingSite?.update) {
      await this.prisma.trackingSite.update({
        where: { id: site.id },
        data: {
          eventsCount: { increment: 1 },
          lastPingAt: new Date(),
        },
      });
    }

    await this.writeMandatoryAudit({
      module: 'identified_profiles',
      action: created
        ? 'create_lead_from_event_site'
        : 'update_lead_from_event_site',
      entityType: 'lead',
      entityId: lead.code,
      beforeData: created ? null : { leadCode: lead.code },
      afterData: {
        leadCode: lead.code,
        created,
        updated,
        anonymousProfileId,
        converted,
        eventCode: resolvedEventCode,
        registrationId,
        eventCounted,
        projectCounted,
        source: resolvedSource,
      },
      note: `Nhận Lead từ Website Sự kiện (${site.siteId}) -> ${lead.code}`,
    });

    return {
      ...responseData,
      data: responseData,
    };
  }

  /**
   * GET /api/v1/anonymous-profiles/stats
   */
  async getAnonymousStats(query: any = {}) {
    const all = await this.prisma.anonymousProfile.findMany();
    const siteId = query.siteId ? String(query.siteId) : '';
    const profiles = siteId
      ? all.filter((p) => p.siteId === siteId)
      : all;

    const nowMs = Date.now();
    const thirtyDaysAgoMs = nowMs - 30 * 86400_000;

    const total = profiles.length;
    const active = profiles.filter((p) => p.status === 'active').length;
    const identified = profiles.filter(
      (p) => p.status === 'converted' || p.status === 'identified',
    ).length;
    const new30d = profiles.filter(
      (p) => new Date(p.firstSeenAt).getTime() >= thirtyDaysAgoMs,
    ).length;
    const returning = profiles.filter(
      (p) => (p.visitCount || 1) >= 2 || p.userType === 'returning',
    ).length;
    const engagedCount = profiles.filter(
      (p) =>
        Boolean(p.engaged) ||
        (p.totalDurationSec || 0) > 10 ||
        (p.pageViews || 0) >= 2 ||
        p.status === 'converted' ||
        p.status === 'identified',
    ).length;
    const engagedRate =
      total > 0 ? Number(((engagedCount / total) * 100).toFixed(1)) : 0;

    const identitySignals = profiles.filter(
      (p) =>
        Boolean(p.suspectedCompany) ||
        Boolean(p.identifiedPhone) ||
        Boolean(p.externalUserId) ||
        p.tier === 'Hot',
    ).length;

    const pendingAlerts = this.prisma.anonymousAlert?.count
      ? await this.prisma.anonymousAlert.count({
          where: { status: { in: ['new', 'processing'] } },
        })
      : 0;

    const conflicts = this.prisma.anonymousConflict?.count
      ? await this.prisma.anonymousConflict.count({
          where: { status: 'pending' },
        })
      : profiles.filter((p) => p.hasConflict || p.status === 'conflict').length;

    const out = {
      total,
      active,
      identified,
      converted: identified,
      new30d,
      returning,
      engagedCount,
      engagedRate,
      identitySignals,
      pendingAlerts,
      conflicts,
      hot: profiles.filter((p) => p.tier === 'Hot').length,
      warm: profiles.filter((p) => p.tier === 'Warm').length,
      cold: profiles.filter((p) => p.tier === 'Cold').length,
    };
    return { ...out, data: out };
  }

  /**
   * GET /api/v1/anonymous-profiles/:id/timeline
   */
  async getAnonymousTimeline(idOrCode: string, query: any = {}) {
    const profile = await this.prisma.anonymousProfile.findFirst({
      where: {
        OR: [{ id: idOrCode }, { anonymousId: idOrCode }],
      },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy hồ sơ ẩn danh "${idOrCode}".`,
      });
    }

    const typeFilter = query.type ? String(query.type).toLowerCase() : '';
    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const limit = Math.max(
      1,
      Math.min(200, parseInt(String(query.limit || '50'), 10) || 50),
    );

    const dbEvents = this.prisma.trackingEvent?.findMany
      ? await this.prisma.trackingEvent.findMany({
          where: {
            profileId: profile.id,
            status: { in: ['accepted', 'processed'] },
          },
          orderBy: { occurredAt: 'asc' },
        })
      : [];

    const jsonEvents = Array.isArray(profile.events)
      ? (profile.events as any[])
      : [];

    // Combine without duplicates by eventId/id
    const seenIds = new Set<string>();
    const combined: any[] = [];

    for (const ev of dbEvents) {
      const eid = ev.eventId || ev.id;
      seenIds.add(eid);
      const meta = (ev.metadata as any) || {};
      combined.push({
        id: ev.id,
        eventId: ev.eventId,
        type: ev.eventType,
        eventType: ev.eventType,
        title: ev.title || meta.path || ev.eventType,
        page: meta.path || '/',
        url: ev.url,
        occurredAt: ev.occurredAt.toISOString(),
        timestamp: ev.occurredAt.toISOString(),
        durationSec: meta.durationSec || 0,
        scoreDelta: ev.scoreDelta,
        sessionId: ev.sessionId,
      });
    }

    for (const ev of jsonEvents) {
      const eid = ev.eventId || ev.id;
      if (eid && seenIds.has(eid)) continue;
      if (eid) seenIds.add(eid);
      const ts =
        ev.occurredAt || ev.timestamp || profile.firstSeenAt.toISOString();
      combined.push({
        id: eid || `ev-${combined.length + 1}`,
        eventId: eid || `ev-${combined.length + 1}`,
        type: ev.type || ev.eventType || 'page_view',
        eventType: ev.eventType || ev.type || 'page_view',
        title: ev.title || ev.page || 'Hoạt động',
        page: ev.page || ev.path || '/',
        url: ev.url || null,
        occurredAt: ts,
        timestamp: ts,
        durationSec: ev.durationSec || 0,
        scoreDelta: ev.scoreDelta || 0,
        sessionId: ev.sessionId || null,
      });
    }

    combined.sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    const filtered = typeFilter
      ? combined.filter((e) => String(e.type).toLowerCase() === typeFilter)
      : combined;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = filtered.slice((page - 1) * limit, page * limit);

    return {
      anonymousId: profile.anonymousId,
      profileId: profile.id,
      items,
      data: items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * GET /api/v1/anonymous-profiles/alerts
   */
  async getAnonymousAlerts(query: any = {}) {
    const all = this.prisma.anonymousAlert?.findMany
      ? await this.prisma.anonymousAlert.findMany({
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const status = query.status ? String(query.status).toLowerCase() : '';
    const type = query.type ? String(query.type).toLowerCase() : '';

    const items = all.filter((a) => {
      if (status && status !== 'all' && a.status.toLowerCase() !== status)
        return false;
      if (type && type !== 'all' && a.type.toLowerCase() !== type) return false;
      return true;
    });

    return {
      data: items,
      items,
      total: items.length,
      stats: {
        total: all.length,
        new: all.filter((a) => a.status === 'new').length,
        processing: all.filter((a) => a.status === 'processing').length,
        done: all.filter(
          (a) => a.status === 'done' || a.status === 'resolved',
        ).length,
      },
    };
  }

  /**
   * PATCH /api/v1/anonymous-profiles/alerts/:id
   */
  async updateAnonymousAlert(
    id: string,
    dto: UpdateAnonymousAlertDto,
    user?: ActorInfo,
  ) {
    const alert = await this.prisma.anonymousAlert.findFirst({
      where: { id },
    });
    if (!alert) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy cảnh báo "${id}".`,
      });
    }

    const actor = await this.resolveActor(user);
    const nextStatus = dto.status || alert.status;
    const updated = await this.prisma.anonymousAlert.update({
      where: { id: alert.id },
      data: {
        status: nextStatus,
        note: dto.note !== undefined ? dto.note : alert.note,
        assigneeId: dto.assigneeId || alert.assigneeId || actor.id,
        assigneeName: dto.assigneeName || alert.assigneeName || actor.name,
        resolvedAt:
          nextStatus === 'done' || nextStatus === 'resolved'
            ? new Date()
            : alert.resolvedAt,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'update_alert',
      entityType: 'anonymous_alert',
      entityId: alert.id,
      user,
      beforeData: { status: alert.status },
      afterData: { status: updated.status, note: updated.note },
      note: dto.note || `Cập nhật cảnh báo ${alert.id} -> ${updated.status}`,
    });

    return { ...updated, data: updated };
  }

  /**
   * POST /api/v1/anonymous-profiles/alerts/:id/claim
   */
  async claimAnonymousAlert(id: string, user?: ActorInfo) {
    const alert = await this.prisma.anonymousAlert.findFirst({
      where: { id },
    });
    if (!alert) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy cảnh báo "${id}".`,
      });
    }

    const actor = await this.resolveActor(user);
    const updated = await this.prisma.anonymousAlert.update({
      where: { id: alert.id },
      data: {
        status: 'processing',
        assigneeId: actor.id,
        assigneeName: actor.name,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'claim_alert',
      entityType: 'anonymous_alert',
      entityId: alert.id,
      user,
      beforeData: { status: alert.status },
      afterData: { status: 'processing', assigneeName: actor.name },
      note: `${actor.name} nhận xử lý cảnh báo ${alert.id}`,
    });

    return { ...updated, data: updated };
  }

  /**
   * GET /api/v1/tracking/landing-pages
   */
  async getLandingPageMappings(query: any = {}) {
    const where: any = {};
    if (query.siteId) where.siteId = String(query.siteId);
    const items = await this.prisma.landingPageMapping.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: items, items, total: items.length };
  }

  /**
   * POST /api/v1/tracking/landing-pages
   */
  async createLandingPageMapping(
    dto: CreateLandingPageMappingDto,
    user?: ActorInfo,
  ) {
    const projectId = dto.projectId || dto.projectCode;
    if (!dto.siteId || !dto.landingPageId || !projectId) {
      throw new BadRequestException(
        'siteId, landingPageId và projectId/projectCode là bắt buộc.',
      );
    }
    const actor = await this.resolveActor(user);
    const created = await this.prisma.landingPageMapping.create({
      data: {
        siteId: dto.siteId,
        landingPageId: dto.landingPageId,
        projectId,
        eventProjectId: dto.eventProjectId || null,
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        createdBy: actor.id,
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'create_lp_mapping',
      entityType: 'landing_page_mapping',
      entityId: created.id,
      user,
      beforeData: null,
      afterData: created,
      note: `Cấu hình Landing Page ${created.landingPageId} -> Dự án ${created.projectId}`,
    });

    return { ...created, projectCode: created.projectId, data: created };
  }

  /**
   * PATCH /api/v1/tracking/landing-pages/:id
   */
  async updateLandingPageMapping(
    id: string,
    dto: UpdateLandingPageMappingDto,
    user?: ActorInfo,
  ) {
    const existing = await this.prisma.landingPageMapping.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy cấu hình Landing Page "${id}".`,
      });
    }

    const updated = await this.prisma.landingPageMapping.update({
      where: { id },
      data: {
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        ...(dto.landingPageId !== undefined
          ? { landingPageId: dto.landingPageId }
          : {}),
        ...(dto.projectId !== undefined || dto.projectCode !== undefined
          ? { projectId: dto.projectId || dto.projectCode }
          : {}),
        ...(dto.eventProjectId !== undefined
          ? { eventProjectId: dto.eventProjectId }
          : {}),
        ...(dto.startAt !== undefined
          ? { startAt: new Date(dto.startAt) }
          : {}),
        ...(dto.endAt !== undefined
          ? { endAt: dto.endAt ? new Date(dto.endAt) : null }
          : {}),
      },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'update_lp_mapping',
      entityType: 'landing_page_mapping',
      entityId: updated.id,
      user,
      beforeData: existing,
      afterData: updated,
      note: `Cập nhật cấu hình Landing Page ${updated.landingPageId}`,
    });

    return { ...updated, projectCode: updated.projectId, data: updated };
  }

  /**
   * DELETE /api/v1/tracking/landing-pages/:id
   */
  async deleteLandingPageMapping(id: string, user?: ActorInfo) {
    const existing = await this.prisma.landingPageMapping.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ERR_ANON_NOT_FOUND',
        message: `Không tìm thấy cấu hình Landing Page "${id}".`,
      });
    }
    await this.prisma.landingPageMapping.delete({ where: { id } });
    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'delete_lp_mapping',
      entityType: 'landing_page_mapping',
      entityId: id,
      user,
      beforeData: existing,
      afterData: null,
      note: `Xóa cấu hình Landing Page ${existing.landingPageId}`,
    });
    return { deleted: true, id };
  }

  /**
   * GET /api/v1/anonymous-profiles/export (Masked IP CSV export)
   */
  async exportAnonymousProfiles(query: any = {}, user?: ActorInfo) {
    const list = await this.getAnonymousProfiles({ ...query, limit: 200 }, user);
    const items = list.items || [];

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'export_anonymous',
      entityType: 'anonymous_profile',
      entityId: 'export',
      user,
      beforeData: null,
      afterData: { exportedRows: items.length, masked: true },
      note: `Xuất danh sách Hồ sơ ẩn danh (${items.length} bản ghi, đã che IP/Key)`,
    });

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const headers = [
      'Mã ẩn danh',
      'Trạng thái',
      'Tier',
      'Điểm',
      'Loại khách',
      'Engaged',
      'Số phiên',
      'Lượt xem trang',
      'IP (Đã che)',
      'Cookie (Đã che)',
      'Công ty nghi ngờ',
      'Lần đầu truy cập',
      'Lần cuối truy cập',
    ];

    const rows = items.map((p: any) => [
      p.anonymousId,
      p.status,
      p.tier,
      p.score,
      p.userType,
      p.engaged ? 'Có' : 'Không',
      p.visitCount,
      p.pageViews,
      p.maskedIp,
      p.maskedCookie,
      p.suspectedCompany || '',
      p.firstSeenAt ? new Date(p.firstSeenAt).toISOString() : '',
      p.lastSeenAt ? new Date(p.lastSeenAt).toISOString() : '',
    ]);

    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r: any[]) => r.map(escapeCsv).join(',')),
    ];
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);

    return {
      filename: `anonymous-profiles-${dateStr}.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csvContent, 'utf-8'),
    };
  }

  /**
   * POST /api/v1/anonymous-profiles/export/full-ip (Admin only + mandatory reason audit)
   */
  async exportAnonymousProfilesFullIp(
    dto: FullIpExportDto,
    user?: ActorInfo,
  ) {
    const reason = String(dto?.reason || '').trim();
    if (!reason) {
      throw new BadRequestException(
        'Bắt buộc nhập lý do (reason) khi xuất dữ liệu Full IP để phục vụ kiểm toán bảo mật.',
      );
    }

    const all = await this.prisma.anonymousProfile.findMany({
      where: dto.siteId ? { siteId: dto.siteId } : {},
      orderBy: { lastSeenAt: 'desc' },
    });

    await this.writeMandatoryAudit({
      module: 'anonymous_profiles',
      action: 'export_full_ip',
      entityType: 'anonymous_profile',
      entityId: 'export_full_ip',
      user,
      beforeData: null,
      afterData: {
        exportedRows: all.length,
        fullIp: true,
        reason,
        siteId: dto.siteId || 'ALL',
      },
      note: `Xuất Full IP Hồ sơ ẩn danh (${all.length} bản ghi) — Lý do: ${reason}`,
    });

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const headers = [
      'Mã ẩn danh',
      'Full IP',
      'Cookie ID',
      'Device ID',
      'Site ID',
      'Điểm',
      'Tier',
      'Công ty nghi ngờ',
    ];

    const rows = all.map((p: any) => [
      p.anonymousId,
      p.ip,
      p.cookieId,
      p.deviceId,
      p.siteId,
      p.score,
      p.tier,
      p.suspectedCompany || '',
    ]);

    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r: any[]) => r.map(escapeCsv).join(',')),
    ];
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);

    return {
      filename: `anonymous-profiles-full-ip-${dateStr}.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csvContent, 'utf-8'),
    };
  }

  /**
   * Retention cleanup (§6.12):
   * Deletes expired non-converted/non-conflicted anonymous profiles and raw tracking events
   * older than each site's retentionDays, while preserving IdentifiedLeads & ProfileAuditLogs.
   */
  async runRetentionCleanup(nowDate: Date = new Date()) {
    const sites = await this.prisma.trackingSite.findMany();
    let deletedProfiles = 0;
    let deletedEvents = 0;

    for (const site of sites) {
      const retentionDays = Math.max(30, Number(site.retentionDays || 365));
      const cutoff = new Date(
        nowDate.getTime() - retentionDays * 86400_000,
      );

      if (this.prisma.trackingEvent?.deleteMany) {
        const evRes = await this.prisma.trackingEvent.deleteMany({
          where: {
            siteId: site.siteId,
            occurredAt: { lt: cutoff },
          },
        });
        deletedEvents += evRes.count || 0;
      }

      if (this.prisma.anonymousProfile?.deleteMany) {
        const profRes = await this.prisma.anonymousProfile.deleteMany({
          where: {
            siteId: site.siteId,
            lastSeenAt: { lt: cutoff },
            status: 'active',
            hasConflict: false,
            convertedLeadId: null,
          },
        });
        deletedProfiles += profRes.count || 0;
      }
    }

    return {
      deletedProfiles,
      deletedEvents,
      executedAt: nowDate.toISOString(),
    };
  }
}
