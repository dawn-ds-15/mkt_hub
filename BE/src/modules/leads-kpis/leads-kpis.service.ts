import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalysisQueryDto,
  ClosedDealDto,
  ComparisonQueryDto,
  CreateEventDto,
  CreateOpportunityDto,
  GetClosedDealsDto,
  GetEventsDto,
  MarkOpportunityWonDto,
  SaveKpiPlanDto,
  SaveMonthlyKpiPlanDto,
  SavePriorYearDealsDto,
  SaveWeeklyKpisDto,
  UpdateClosedDealDto,
  UpdateEventDto,
  UpdateOpportunityDto,
} from './dto/leads-kpis.dto';
import {
  SaveProjectKpiPlanDto,
  SaveDailyActualDto,
  UpdateDailyActualByIdDto,
  QueryDailyActualDto,
  QueryDailyReportDto,
  QueryKpiProgressDto,
} from './dto/leads-kpis-daily.dto';
import { Decimal } from '@prisma/client/runtime/library';
import {
  closedDealInitiationFields,
  formatRawClosedDeal,
  OPPORTUNITY_INITIATION_SELECT,
  parseFlexibleDate,
} from './closed-deal-initiation.util';

@Injectable()
export class LeadsKpisService {
  constructor(private readonly prisma: PrismaService) {}

  // --- EVENTS ---
  async createEvent(dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        ...dto,
        date: new Date(dto.date),
        description: dto.description ?? null,
      },
    });
    return this.serializeEvent(event);
  }

  async getEvents(query: GetEventsDto) {
    const where: any = {
      week: query.week,
      year: query.year,
      archivedAt: null,
    };
    if (query.projectId) {
      where.projectId = query.projectId;
    } else {
      where.project = { archivedAt: null };
    }
    const events = await this.prisma.event.findMany({
      where,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return events.map((event) => this.serializeEvent(event));
  }

  async updateEvent(id: string, dto: UpdateEventDto) {
    await this.getActiveEventOrThrow(id);
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
      },
    });
    return this.serializeEvent(event);
  }

  async deleteEvent(id: string) {
    await this.getActiveEventOrThrow(id);
    await this.prisma.event.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { success: true };
  }

  private async getActiveEventOrThrow(id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, archivedAt: null },
    });
    if (!event) {
      throw new NotFoundException(`Không tìm thấy Event với ID: ${id}`);
    }
    return event;
  }

  private serializeEvent<T extends { date: Date }>(event: T) {
    return { ...event, date: event.date.toISOString().slice(0, 10) };
  }

  // --- KPI PLAN ---
  async savePlan(dto: SaveKpiPlanDto, userId: string) {
    const existing = await this.prisma.kpiPlan.findUnique({
      where: { year: dto.year },
    });

    if (existing) {
      return this.prisma.kpiPlan.update({
        where: { year: dto.year },
        data: {
          totalRawLeads: dto.totalRawLeads,
          targetMql: dto.targetMql,
          targetSql: dto.targetSql,
          targetOpp: dto.targetOpp,
          targetClosedDeal: dto.targetClosedDeal,
          targetPipelineVal: dto.targetPipelineVal,
          targetWonVal: dto.targetWonVal,
          createdById: userId,
        },
      });
    }

    return this.prisma.kpiPlan.create({
      data: {
        year: dto.year,
        totalRawLeads: dto.totalRawLeads,
        targetMql: dto.targetMql,
        targetSql: dto.targetSql,
        targetOpp: dto.targetOpp,
        targetClosedDeal: dto.targetClosedDeal,
        targetPipelineVal: dto.targetPipelineVal,
        targetWonVal: dto.targetWonVal,
        createdById: userId,
      },
    });
  }

  async getPlan(year: number) {
    const plan = await this.prisma.kpiPlan.findUnique({
      where: { year },
    });
    if (!plan) {
      return {
        year,
        totalRawLeads: 0,
        targetMql: 0,
        targetSql: 0,
        targetOpp: 0,
        targetClosedDeal: 0,
        targetPipelineVal: 0,
        targetWonVal: 0,
      };
    }
    return plan;
  }

  // --- MONTHLY KPI PLAN (BE-06) ---
  async getMonthlyPlan(year: number) {
    const [monthlyRecords, annualPlan] = await Promise.all([
      this.prisma.kpiMonthlyPlan.findMany({
        where: { year },
        orderBy: { month: 'asc' },
      }),
      this.getPlan(year),
    ]);

    const monthMap = new Map<number, any>(monthlyRecords.map((m) => [m.month, m]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const rec = monthMap.get(month);
      return {
        month,
        rawLeads: rec ? Number(rec.rawLeads) : 0,
        mql: rec ? Number(rec.mql) : 0,
        sql: rec ? Number(rec.sql) : 0,
        oppCount: rec ? Number(rec.oppCount) : 0,
        closedCount: rec ? Number(rec.closedCount) : 0,
        pipelineValue: rec ? Number(rec.pipelineValue) : 0,
        wonValue: rec ? Number(rec.wonValue) : 0,
      };
    });

    const monthlyTotal = months.reduce(
      (acc, m) => ({
        rawLeads: acc.rawLeads + m.rawLeads,
        mql: acc.mql + m.mql,
        sql: acc.sql + m.sql,
        oppCount: acc.oppCount + m.oppCount,
        closedCount: acc.closedCount + m.closedCount,
        pipelineValue: acc.pipelineValue + m.pipelineValue,
        wonValue: acc.wonValue + m.wonValue,
      }),
      {
        rawLeads: 0,
        mql: 0,
        sql: 0,
        oppCount: 0,
        closedCount: 0,
        pipelineValue: 0,
        wonValue: 0,
      },
    );

    const diff = {
      rawLeads: monthlyTotal.rawLeads - (annualPlan.totalRawLeads ?? 0),
      mql: monthlyTotal.mql - (annualPlan.targetMql ?? 0),
      sql: monthlyTotal.sql - (annualPlan.targetSql ?? 0),
      oppCount: monthlyTotal.oppCount - (annualPlan.targetOpp ?? 0),
      closedCount: monthlyTotal.closedCount - (annualPlan.targetClosedDeal ?? 0),
      pipelineValue: monthlyTotal.pipelineValue - Number(annualPlan.targetPipelineVal ?? 0),
      wonValue: monthlyTotal.wonValue - Number(annualPlan.targetWonVal ?? 0),
    };

    return {
      year,
      months,
      monthlyTotal,
      annualPlan,
      diff,
      canApply: true,
    };
  }

  async saveMonthlyPlan(
    year: number,
    dto: SaveMonthlyKpiPlanDto,
    userId: string,
  ) {
    if (!dto.months || !Array.isArray(dto.months)) {
      throw new BadRequestException('Dữ liệu các tháng không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.months) {
        await tx.kpiMonthlyPlan.upsert({
          where: {
            year_month: {
              year,
              month: item.month,
            },
          },
          create: {
            year,
            month: item.month,
            rawLeads: item.rawLeads ?? 0,
            mql: item.mql ?? 0,
            sql: item.sql ?? 0,
            oppCount: item.oppCount ?? 0,
            closedCount: item.closedCount ?? 0,
            pipelineValue: item.pipelineValue ?? 0,
            wonValue: item.wonValue ?? 0,
            createdById: userId,
          },
          update: {
            rawLeads: item.rawLeads ?? 0,
            mql: item.mql ?? 0,
            sql: item.sql ?? 0,
            oppCount: item.oppCount ?? 0,
            closedCount: item.closedCount ?? 0,
            pipelineValue: item.pipelineValue ?? 0,
            wonValue: item.wonValue ?? 0,
            updatedAt: new Date(),
          },
        });
      }
    });

    return this.getMonthlyPlan(year);
  }

  async applyMonthlyTotal(year: number, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const monthlyRecords = await tx.kpiMonthlyPlan.findMany({
        where: { year },
      });

      const monthMap = new Map<number, any>(monthlyRecords.map((m) => [m.month, m]));
      const months = Array.from({ length: 12 }, (_, i) => {
        const rec = monthMap.get(i + 1);
        return {
          rawLeads: rec ? Number(rec.rawLeads) : 0,
          mql: rec ? Number(rec.mql) : 0,
          sql: rec ? Number(rec.sql) : 0,
          oppCount: rec ? Number(rec.oppCount) : 0,
          closedCount: rec ? Number(rec.closedCount) : 0,
          pipelineValue: rec ? Number(rec.pipelineValue) : 0,
          wonValue: rec ? Number(rec.wonValue) : 0,
        };
      });

      const totals = months.reduce(
        (acc, m) => ({
          rawLeads: acc.rawLeads + m.rawLeads,
          mql: acc.mql + m.mql,
          sql: acc.sql + m.sql,
          oppCount: acc.oppCount + m.oppCount,
          closedCount: acc.closedCount + m.closedCount,
          pipelineValue: acc.pipelineValue + m.pipelineValue,
          wonValue: acc.wonValue + m.wonValue,
        }),
        {
          rawLeads: 0,
          mql: 0,
          sql: 0,
          oppCount: 0,
          closedCount: 0,
          pipelineValue: 0,
          wonValue: 0,
        },
      );

      const updatedAnnualPlan = await tx.kpiPlan.upsert({
        where: { year },
        create: {
          year,
          totalRawLeads: totals.rawLeads,
          targetMql: totals.mql,
          targetSql: totals.sql,
          targetOpp: totals.oppCount,
          targetClosedDeal: totals.closedCount,
          targetPipelineVal: totals.pipelineValue,
          targetWonVal: totals.wonValue,
          createdById: userId,
        },
        update: {
          totalRawLeads: totals.rawLeads,
          targetMql: totals.mql,
          targetSql: totals.sql,
          targetOpp: totals.oppCount,
          targetClosedDeal: totals.closedCount,
          targetPipelineVal: totals.pipelineValue,
          targetWonVal: totals.wonValue,
          updatedAt: new Date(),
        },
      });

      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'APPLY_MONTHLY_KPI_PLAN',
            entityType: 'KpiPlan',
            entityId: String(year),
            newValue: JSON.stringify({
              ...updatedAnnualPlan,
              appliedFromMonths: true,
            }),
          },
        });
      }

      return {
        message: 'Áp dụng tổng KPI 12 tháng thành mục tiêu cả năm thành công',
        annualPlan: updatedAnnualPlan,
        appliedTotals: totals,
      };
    });
  }

  // --- WEEKLY ACTUALS & ROLLOVER (BR-005) ---
  async getWeeklyData(
    year?: number,
    week?: number,
    projectId?: string,
    month?: number,
  ) {
    const targetYear = year ? Number(year) : new Date().getFullYear();
    year = targetYear;
    if (month && (!week || isNaN(week))) {
      const weeks = this.getWeeksInMonth(year, month);
      const dateRange = this.getPeriodDateRange('month', String(month), year);
      const firstWeek = weeks[0] || 1;

      // All reads below are independent; run them concurrently (started in
      // the original order) and apply the results in the original order.
      const [planGoc, rollover, distRecords, dailyResult, opportunities, closedDeals] =
        await Promise.all([
          (async () => {
            let planGoc = {
              rawLeads: 0,
              mql: 0,
              sql: 0,
              oppCount: 0,
              closedCount: 0,
            };

            if (projectId) {
              const planDistRecords = await this.prisma.kpiDistribution.findMany({
                where: {
                  year,
                  week: { in: weeks },
                  projectId,
                  type: 'plan',
                },
              });

              if (planDistRecords.length > 0) {
                for (const p of planDistRecords) {
                  planGoc.rawLeads += p.rawLeads;
                  planGoc.mql += p.mql;
                  planGoc.sql += p.sql;
                  planGoc.oppCount += p.oppCount;
                  planGoc.closedCount += p.closedCount;
                }
              } else {
                const kpiPlan = await this.prisma.kpiPlan.findUnique({ where: { year } });
                if (kpiPlan) {
                  const factor = weeks.length / 52;
                  planGoc = {
                    rawLeads: Math.round(kpiPlan.totalRawLeads * factor),
                    mql: Math.round(kpiPlan.targetMql * factor),
                    sql: Math.round(kpiPlan.targetSql * factor),
                    oppCount: Math.round(kpiPlan.targetOpp * factor),
                    closedCount: Math.round(kpiPlan.targetClosedDeal * factor),
                  };
                }
              }
            } else {
              const kpiPlan = await this.prisma.kpiPlan.findUnique({ where: { year } });
              if (kpiPlan) {
                const factor = weeks.length / 52;
                planGoc = {
                  rawLeads: Math.round(kpiPlan.totalRawLeads * factor),
                  mql: Math.round(kpiPlan.targetMql * factor),
                  sql: Math.round(kpiPlan.targetSql * factor),
                  oppCount: Math.round(kpiPlan.targetOpp * factor),
                  closedCount: Math.round(kpiPlan.targetClosedDeal * factor),
                };
              }
            }
            return planGoc;
          })(),
          this.calculateRolloverForWeek(year, firstWeek),
          projectId
            ? this.prisma.kpiDistribution.findMany({
                where: {
                  year,
                  week: { in: weeks },
                  projectId,
                  type: 'actual',
                },
              })
            : this.prisma.kpiDistribution.findMany({
                where: {
                  year,
                  week: { in: weeks },
                  project: { archivedAt: null },
                  type: 'actual',
                },
              }),
          // Also include ProjectDailyActual within month dateRange to guarantee live visibility
          this.settle(async () => {
            let activeProjectIds: string[] = [];
            if (projectId) {
              activeProjectIds = [projectId];
            } else {
              const activeProjects = await this.prisma.project.findMany({
                where: { archivedAt: null, status: { not: 'Cancelled' } },
                select: { id: true },
              });
              activeProjectIds = activeProjects.map((p) => p.id);
            }

            // Same project scope as GET /reports/weekly
            return (this.prisma as any).projectDailyActual.findMany({
              where: {
                ...(projectId ? { projectId } : { project: { archivedAt: null } }),
                actualDate: {
                  gte: dateRange.startDate,
                  lte: dateRange.endDate,
                },
                archivedAt: null,
              },
            });
          }),
          this.prisma.opportunity.findMany({
            where: {
              status: 'active',
              archivedAt: null,
              AND: [
                this.getOpportunityPeriodCondition(dateRange),
                projectId
                  ? { projectId }
                  : {
                      OR: [
                        { projectId: null },
                        { project: { archivedAt: null } },
                      ],
                    },
              ],
            },
            include: {
              project: { select: { id: true, name: true } },
            },
          }),
          this.prisma.closedDeal.findMany({
            where: {
              closedDate: { gte: dateRange.startDate, lte: dateRange.endDate },
              archivedAt: null,
              ...(projectId
                ? { projectId }
                : {
                    OR: [
                      { projectId: null },
                      { project: { archivedAt: null } },
                    ],
                  }),
            },
            include: {
              project: { select: { id: true, name: true } },
              opportunity: OPPORTUNITY_INITIATION_SELECT,
            },
          }),
        ]);

      const effectivePlan = {
        rawLeads: planGoc.rawLeads + rollover.rawLeads,
        mql: planGoc.mql + rollover.mql,
        sql: planGoc.sql + rollover.sql,
        oppCount: planGoc.oppCount + rollover.oppCount,
        closedCount: planGoc.closedCount + rollover.closedCount,
      };

      let actual = {
        rawLeads: 0,
        mql: 0,
        sql: 0,
        oppCount: 0,
        closedCount: 0,
      };

      for (const dist of distRecords) {
        actual.rawLeads += dist.rawLeads;
        actual.mql += dist.mql;
        actual.sql += dist.sql;
        actual.oppCount += dist.oppCount;
        actual.closedCount += dist.closedCount;
      }

      try {
        if (dailyResult.failed) throw dailyResult.error;
        const dailyActuals = dailyResult.value;

        const safeDaily = Array.isArray(dailyActuals) ? dailyActuals : [];
        let dailySumRaw = 0, dailySumMql = 0, dailySumSql = 0, dailySumOpp = 0, dailySumClosed = 0;
        for (const d of safeDaily) {
          dailySumRaw += d.rawLeads || 0;
          dailySumMql += d.mql || 0;
          dailySumSql += d.sql || 0;
          dailySumOpp += d.opp || 0;
          dailySumClosed += d.closedDeal || 0;
        }

        // Daily actuals are the source of truth for leads (BE_requirement_22_09_26 §2.1)
        actual.rawLeads = dailySumRaw;
        actual.mql = dailySumMql;
        actual.sql = dailySumSql;
        actual.oppCount = Math.max(actual.oppCount, dailySumOpp);
        actual.closedCount = Math.max(actual.closedCount, dailySumClosed);
      } catch (err) {
        console.warn('Query dailyActuals for month in getWeeklyData failed:', err);
      }

      actual.oppCount = Math.max(actual.oppCount, opportunities.length);

      return {
        year,
        month,
        weeks,
        planGoc,
        rollover,
        effectivePlan,
        actual,
        opportunities: opportunities.map((o) => ({
          id: o.id,
          companyName: o.companyName,
          size: o.size,
          projectId: o.projectId,
          projectName: o.project?.name ?? null,
          contractName: o.contractName ?? null,
          setupFee: Number(o.setupFee),
          monthlyFee: Number(o.monthlyFee),
          dealValue: Number(o.setupFee) + Number(o.monthlyFee),
          expectedCloseDate:
            o.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
          initiationDate:
            (o as any).initiationDate?.toISOString().slice(0, 10) ??
            o.createdAt?.toISOString().slice(0, 10) ??
            null,
          status: o.status,
        })),
        closedDeals: closedDeals.map((d) => ({
          id: d.id,
          companyName: d.companyName,
          size: d.size,
          projectId: d.projectId,
          projectName: d.project?.name ?? null,
          setupFee: Number(d.setupFee),
          monthlyFee: Number(d.monthlyFee),
          dealValue: Number(d.setupFee) + Number(d.monthlyFee) * 12,
          closedDate: d.closedDate.toISOString().slice(0, 10),
          ...closedDealInitiationFields(d),
        })),
      };
    }

    const currentWeek = week || 1;
    const dateRange = this.getPeriodDateRange('week', String(currentWeek), year);

    // All reads below are independent; run them concurrently (started in the
    // original order) and apply the results in the original order.
    const [planGoc, rollover, dailyResult, opportunities, closedDeals] =
      await Promise.all([
        // 1. Calculate plan gốc & rollover
        (async () => {
          let planGoc = {
            rawLeads: 0,
            mql: 0,
            sql: 0,
            oppCount: 0,
            closedCount: 0,
          };

          if (projectId) {
            const distPlan = await this.prisma.kpiDistribution.findUnique({
              where: {
                year_week_projectId_type: {
                  year,
                  week: currentWeek,
                  projectId,
                  type: 'plan',
                },
              },
            });

            if (distPlan) {
              planGoc = {
                rawLeads: distPlan.rawLeads,
                mql: distPlan.mql,
                sql: distPlan.sql,
                oppCount: distPlan.oppCount,
                closedCount: distPlan.closedCount,
              };
            } else {
              planGoc = await this.calculatePlanGocForYear(year);
            }
          } else {
            planGoc = await this.calculatePlanGocForYear(year);
          }
          return planGoc;
        })(),
        this.calculateRolloverForWeek(year, currentWeek),
        // 2. Fetch actual record strictly from ProjectDailyActual for the ISO week (consistent with getWeeklyReportFromDaily)
        this.settle(async () => {
          let activeProjectIds: string[] = [];
          if (projectId) {
            activeProjectIds = [projectId];
          } else {
            const activeProjects = await this.prisma.project.findMany({
              where: { archivedAt: null, status: { not: 'Cancelled' } },
              select: { id: true },
            });
            activeProjectIds = (activeProjects || []).map((p) => p.id);
          }

          return (this.prisma as any).projectDailyActual.findMany({
            where: {
              projectId: { in: activeProjectIds },
              actualDate: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
              archivedAt: null,
            },
          });
        }),
        // 3. Fetch opportunities in pipeline (active opportunities, filtered by projectId if supplied)
        this.prisma.opportunity.findMany({
          where: {
            status: 'active',
            archivedAt: null,
            AND: [
              this.getOpportunityPeriodCondition(dateRange),
              projectId
                ? { projectId }
                : {
                    OR: [
                      { projectId: null },
                      { project: { archivedAt: null } },
                    ],
                  },
            ],
          },
          include: {
            project: { select: { id: true, name: true } },
          },
        }),
        // 4. Fetch closed deals for this specific week (filtered by projectId if supplied)
        this.prisma.closedDeal.findMany({
          where: {
            year,
            week: currentWeek,
            archivedAt: null,
            ...(projectId
              ? { projectId }
              : {
                  OR: [
                    { projectId: null },
                    { project: { archivedAt: null } },
                  ],
                }),
          },
          include: {
            project: { select: { id: true, name: true } },
            opportunity: OPPORTUNITY_INITIATION_SELECT,
          },
        }),
      ]);

    const effectivePlan = {
      rawLeads: planGoc.rawLeads + rollover.rawLeads,
      mql: planGoc.mql + rollover.mql,
      sql: planGoc.sql + rollover.sql,
      oppCount: planGoc.oppCount + rollover.oppCount,
      closedCount: planGoc.closedCount + rollover.closedCount,
    };

    let actual = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
    };

    try {
      if (dailyResult.failed) throw dailyResult.error;
      const dailyActuals = dailyResult.value;

      const safeDaily = Array.isArray(dailyActuals) ? dailyActuals : [];
      for (const d of safeDaily) {
        const iso = this.getIsoWeek(d.actualDate);
        if (iso.year === year && iso.week === currentWeek) {
          actual.rawLeads += d.rawLeads || 0;
          actual.mql += d.mql || 0;
          actual.sql += d.sql || 0;
          actual.oppCount += d.opp || 0;
          actual.closedCount += d.closedDeal || 0;
        }
      }
    } catch (err) {
      console.warn('Query dailyActuals for week in getWeeklyData failed:', err);
    }

    actual.oppCount = Math.max(actual.oppCount, opportunities.length);

    return {
      year,
      week: currentWeek,
      planGoc,
      rollover,
      effectivePlan,
      actual,
      opportunities: opportunities.map((o) => ({
        id: o.id,
        companyName: o.companyName,
        size: o.size,
        projectId: o.projectId,
        projectName: o.project?.name ?? null,
        contractName: o.contractName ?? null,
        setupFee: Number(o.setupFee),
        monthlyFee: Number(o.monthlyFee),
        dealValue: Number(o.setupFee) + Number(o.monthlyFee),
        expectedCloseDate:
          o.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
        initiationDate:
          (o as any).initiationDate?.toISOString().slice(0, 10) ??
          o.createdAt?.toISOString().slice(0, 10) ??
          null,
        status: o.status,
      })),
      closedDeals: closedDeals.map((d) => ({
        id: d.id,
        companyName: d.companyName,
        size: d.size,
        projectId: d.projectId,
        projectName: d.project?.name ?? null,
        setupFee: Number(d.setupFee),
        monthlyFee: Number(d.monthlyFee),
        dealValue: Number(d.setupFee) + Number(d.monthlyFee) * 12,
        closedDate: d.closedDate.toISOString().slice(0, 10),
        ...closedDealInitiationFields(d),
      })),
    };
  }

  async saveWeeklyData(dto: SaveWeeklyKpisDto, userId: string) {
    const { year } = dto;
    let targetWeek = dto.week;

    const hasPlanFields =
      dto.rawLeadsPlan !== undefined ||
      dto.mqlPlan !== undefined ||
      dto.sqlPlan !== undefined ||
      dto.oppPlan !== undefined ||
      dto.closedDealPlan !== undefined;

    const hasActualFields =
      dto.rawLeads !== undefined ||
      dto.mql !== undefined ||
      dto.sql !== undefined ||
      dto.oppCount !== undefined ||
      dto.closedCount !== undefined;

    if (dto.month && (!targetWeek || isNaN(targetWeek))) {
      const weeks = this.getWeeksInMonth(year, dto.month);
      targetWeek = weeks[0] || 1;

      const numWeeks = Math.max(1, weeks.length);

      // Handle Actuals Distribution if actual fields are provided or when no plan fields provided (default actual behavior)
      if (hasActualFields || !hasPlanFields) {
        const rawPerWeek = Math.floor((dto.rawLeads ?? 0) / numWeeks);
        const rawRemainder = (dto.rawLeads ?? 0) % numWeeks;

        const mqlPerWeek = Math.floor((dto.mql ?? 0) / numWeeks);
        const mqlRemainder = (dto.mql ?? 0) % numWeeks;

        const sqlPerWeek = Math.floor((dto.sql ?? 0) / numWeeks);
        const sqlRemainder = (dto.sql ?? 0) % numWeeks;

        const planGoc = await this.calculatePlanGocForYear(year);

        for (let i = 0; i < weeks.length; i++) {
          const w = weeks[i];
          const isLast = i === weeks.length - 1;
          const wRaw = rawPerWeek + (isLast ? rawRemainder : 0);
          const wMql = mqlPerWeek + (isLast ? mqlRemainder : 0);
          const wSql = sqlPerWeek + (isLast ? sqlRemainder : 0);

          const rollover = await this.calculateRolloverForWeek(year, w);

          const actualData = {
            rawLeads: wRaw,
            mql: wMql,
            sql: wSql,
            oppCount: 0,
            closedCount: 0,
            planRawLeads: planGoc.rawLeads,
            planMql: planGoc.mql,
            planSql: planGoc.sql,
            planOpp: planGoc.oppCount,
            planClosedDeal: planGoc.closedCount,
            rolloverLeads: rollover.rawLeads,
            rolloverMql: rollover.mql,
            rolloverSql: rollover.sql,
            rolloverOpp: rollover.oppCount,
            rolloverClosed: rollover.closedCount,
            createdById: userId,
          };

          if (!dto.projectId) {
            await this.prisma.kpiActual.upsert({
              where: { year_week: { year, week: w } },
              update: actualData,
              create: { year, week: w, ...actualData },
            });
          }

          if (dto.projectId) {
            await this.prisma.kpiDistribution.upsert({
              where: {
                year_week_projectId_type: {
                  year,
                  week: w,
                  projectId: dto.projectId,
                  type: 'actual',
                },
              },
              update: {
                rawLeads: wRaw,
                mql: wMql,
                sql: wSql,
                oppCount: 0,
                closedCount: 0,
              },
              create: {
                year,
                week: w,
                projectId: dto.projectId,
                type: 'actual',
                rawLeads: wRaw,
                mql: wMql,
                sql: wSql,
                oppCount: 0,
                closedCount: 0,
              },
            });
          }
        }
      }

      // Handle Plan Distribution if plan fields are provided
      if (hasPlanFields && dto.projectId) {
        const rawPlanPerWeek = Math.floor((dto.rawLeadsPlan ?? 0) / numWeeks);
        const rawPlanRemainder = (dto.rawLeadsPlan ?? 0) % numWeeks;

        const mqlPlanPerWeek = Math.floor((dto.mqlPlan ?? 0) / numWeeks);
        const mqlPlanRemainder = (dto.mqlPlan ?? 0) % numWeeks;

        const sqlPlanPerWeek = Math.floor((dto.sqlPlan ?? 0) / numWeeks);
        const sqlPlanRemainder = (dto.sqlPlan ?? 0) % numWeeks;

        const oppPlanPerWeek = Math.floor((dto.oppPlan ?? 0) / numWeeks);
        const oppPlanRemainder = (dto.oppPlan ?? 0) % numWeeks;

        const closedPlanPerWeek = Math.floor((dto.closedDealPlan ?? 0) / numWeeks);
        const closedPlanRemainder = (dto.closedDealPlan ?? 0) % numWeeks;

        for (let i = 0; i < weeks.length; i++) {
          const w = weeks[i];
          const isLast = i === weeks.length - 1;
          const wRawPlan = rawPlanPerWeek + (isLast ? rawPlanRemainder : 0);
          const wMqlPlan = mqlPlanPerWeek + (isLast ? mqlPlanRemainder : 0);
          const wSqlPlan = sqlPlanPerWeek + (isLast ? sqlPlanRemainder : 0);
          const wOppPlan = oppPlanPerWeek + (isLast ? oppPlanRemainder : 0);
          const wClosedPlan = closedPlanPerWeek + (isLast ? closedPlanRemainder : 0);

          await this.prisma.kpiDistribution.upsert({
            where: {
              year_week_projectId_type: {
                year,
                week: w,
                projectId: dto.projectId,
                type: 'plan',
              },
            },
            update: {
              rawLeads: wRawPlan,
              mql: wMqlPlan,
              sql: wSqlPlan,
              oppCount: wOppPlan,
              closedCount: wClosedPlan,
            },
            create: {
              year,
              week: w,
              projectId: dto.projectId,
              type: 'plan',
              rawLeads: wRawPlan,
              mql: wMqlPlan,
              sql: wSqlPlan,
              oppCount: wOppPlan,
              closedCount: wClosedPlan,
            },
          });
        }
      }
    } else {
      const week = targetWeek ?? 1;

      if (hasActualFields || !hasPlanFields) {
        const planGoc = await this.calculatePlanGocForYear(year);
        const rollover = await this.calculateRolloverForWeek(year, week);

        const actualData = {
          rawLeads: dto.rawLeads ?? 0,
          mql: dto.mql ?? 0,
          sql: dto.sql ?? 0,
          oppCount: dto.oppCount ?? 0,
          closedCount: dto.closedCount ?? 0,
          planRawLeads: planGoc.rawLeads,
          planMql: planGoc.mql,
          planSql: planGoc.sql,
          planOpp: planGoc.oppCount,
          planClosedDeal: planGoc.closedCount,
          rolloverLeads: rollover.rawLeads,
          rolloverMql: rollover.mql,
          rolloverSql: rollover.sql,
          rolloverOpp: rollover.oppCount,
          rolloverClosed: rollover.closedCount,
          createdById: userId,
        };

        if (!dto.projectId) {
          await this.prisma.kpiActual.upsert({
            where: { year_week: { year, week } },
            update: actualData,
            create: { year, week, ...actualData },
          });
        }

        if (dto.projectId) {
          await this.prisma.kpiDistribution.upsert({
            where: {
              year_week_projectId_type: {
                year,
                week,
                projectId: dto.projectId,
                type: 'actual',
              },
            },
            update: {
              rawLeads: dto.rawLeads ?? 0,
              mql: dto.mql ?? 0,
              sql: dto.sql ?? 0,
              oppCount: dto.oppCount ?? 0,
              closedCount: dto.closedCount ?? 0,
            },
            create: {
              year,
              week,
              projectId: dto.projectId,
              type: 'actual',
              rawLeads: dto.rawLeads ?? 0,
              mql: dto.mql ?? 0,
              sql: dto.sql ?? 0,
              oppCount: dto.oppCount ?? 0,
              closedCount: dto.closedCount ?? 0,
            },
          });
        }
      }

      if (hasPlanFields) {
        if (dto.projectId) {
          await this.prisma.kpiDistribution.upsert({
            where: {
              year_week_projectId_type: {
                year,
                week,
                projectId: dto.projectId,
                type: 'plan',
              },
            },
            update: {
              rawLeads: dto.rawLeadsPlan ?? 0,
              mql: dto.mqlPlan ?? 0,
              sql: dto.sqlPlan ?? 0,
              oppCount: dto.oppPlan ?? 0,
              closedCount: dto.closedDealPlan ?? 0,
            },
            create: {
              year,
              week,
              projectId: dto.projectId,
              type: 'plan',
              rawLeads: dto.rawLeadsPlan ?? 0,
              mql: dto.mqlPlan ?? 0,
              sql: dto.sqlPlan ?? 0,
              oppCount: dto.oppPlan ?? 0,
              closedCount: dto.closedDealPlan ?? 0,
            },
          });
        } else {
          await this.prisma.kpiActual.upsert({
            where: { year_week: { year, week } },
            update: {
              planRawLeads: dto.rawLeadsPlan ?? 0,
              planMql: dto.mqlPlan ?? 0,
              planSql: dto.sqlPlan ?? 0,
              planOpp: dto.oppPlan ?? 0,
              planClosedDeal: dto.closedDealPlan ?? 0,
            },
            create: {
              year,
              week,
              planRawLeads: dto.rawLeadsPlan ?? 0,
              planMql: dto.mqlPlan ?? 0,
              planSql: dto.sqlPlan ?? 0,
              planOpp: dto.oppPlan ?? 0,
              planClosedDeal: dto.closedDealPlan ?? 0,
              createdById: userId,
            },
          });
        }
      }
    }

    const effectiveWeek = targetWeek ?? 1;

    // 3. Process Opportunities
    if (dto.opportunities) {
      for (const opp of dto.opportunities) {
        const normalizedSize = this.normalizeSize(opp.size);
        const monthlyFee = opp.monthlyFee ?? 0;
        const targetProjectId = opp.projectId ?? dto.projectId ?? null;
        if (opp.id) {
          // Update
          const updateData: any = {
            companyName: opp.companyName,
            size: normalizedSize,
            projectId: targetProjectId,
            setupFee: opp.setupFee,
            monthlyFee: monthlyFee,
            expectedCloseDate: opp.expectedCloseDate
              ? new Date(opp.expectedCloseDate)
              : null,
            status: opp.status ?? 'active',
            archivedAt: null,
            archivedBy: null,
          };
          if (opp.contractName !== undefined) {
            updateData.contractName = opp.contractName ? opp.contractName.trim() : null;
          }
          if (opp.initiationDate !== undefined) {
            updateData.initiationDate = opp.initiationDate ? new Date(opp.initiationDate) : null;
          }
          await this.prisma.opportunity.update({
            where: { id: opp.id },
            data: updateData,
          });
        } else {
          // Check if an opportunity with same companyName and active status already exists for this week/year
          const existingOpp = await this.prisma.opportunity.findFirst({
            where: {
              companyName: opp.companyName,
              status: 'active',
              year,
              week: effectiveWeek,
            },
          });

          if (existingOpp) {
            // Update existing record instead of creating duplicate
            const updateExistingData: any = {
              size: normalizedSize,
              projectId: opp.projectId ?? null,
              setupFee: opp.setupFee,
              monthlyFee: monthlyFee,
              expectedCloseDate: opp.expectedCloseDate
                ? new Date(opp.expectedCloseDate)
                : null,
              archivedAt: null,
              archivedBy: null,
            };
            if (opp.contractName !== undefined) {
              updateExistingData.contractName = opp.contractName ? opp.contractName.trim() : null;
            }
            if (opp.initiationDate !== undefined) {
              updateExistingData.initiationDate = opp.initiationDate ? new Date(opp.initiationDate) : null;
            }
            await this.prisma.opportunity.update({
              where: { id: existingOpp.id },
              data: updateExistingData,
            });
          } else {
            // Create new
            await this.prisma.opportunity.create({
              data: {
                companyName: opp.companyName,
                size: normalizedSize,
                projectId: opp.projectId ?? null,
                contractName: opp.contractName ? opp.contractName.trim() : null,
                setupFee: opp.setupFee,
                monthlyFee: monthlyFee,
                expectedCloseDate: opp.expectedCloseDate
                  ? new Date(opp.expectedCloseDate)
                  : null,
                initiationDate: opp.initiationDate ? new Date(opp.initiationDate) : null,
                status: 'active',
                year,
                week: effectiveWeek,
                createdById: userId,
              },
            });
          }
        }
      }
    }

    // 4. Process Closed Deals
    if (dto.closedDeals) {
      for (const deal of dto.closedDeals) {
        const normalizedSize = this.normalizeSize(deal.size);
        const monthlyFee = deal.monthlyFee ?? 0;
        // §3: only touch initiationDate when the client sent the field.
        const initiationDateData =
          deal.initiationDate !== undefined
            ? { initiationDate: parseFlexibleDate(deal.initiationDate) }
            : {};
        if (deal.id) {
          // Update
          await this.prisma.closedDeal.update({
            where: { id: deal.id },
            data: {
              companyName: deal.companyName,
              size: normalizedSize,
              projectId: deal.projectId ?? null,
              setupFee: deal.setupFee,
              monthlyFee: monthlyFee,
              closedDate: deal.closedDate
                ? new Date(deal.closedDate)
                : new Date(),
              ...initiationDateData,
              archivedAt: null,
              archivedBy: null,
            },
          });
        } else {
          const existingDeal = await this.prisma.closedDeal.findFirst({
            where: {
              companyName: deal.companyName,
              year,
              week: effectiveWeek,
            },
          });

          if (existingDeal) {
            await this.prisma.closedDeal.update({
              where: { id: existingDeal.id },
              data: {
                size: normalizedSize,
                projectId: deal.projectId ?? null,
                setupFee: deal.setupFee,
                monthlyFee: monthlyFee,
                closedDate: deal.closedDate
                  ? new Date(deal.closedDate)
                  : new Date(),
                ...initiationDateData,
                archivedAt: null,
                archivedBy: null,
              },
            });
          } else {
            await this.prisma.closedDeal.create({
              data: {
                companyName: deal.companyName,
                size: normalizedSize,
                projectId: deal.projectId ?? null,
                setupFee: deal.setupFee,
                monthlyFee: monthlyFee,
                closedDate: deal.closedDate
                  ? new Date(deal.closedDate)
                  : new Date(),
                ...initiationDateData,
                year,
                week: effectiveWeek,
                createdById: userId,
              },
            });
          }
        }
      }
    }

    return { success: true };
  }

  async getOpportunities(projectId?: string) {
    const where: any = {
      status: 'active',
      archivedAt: null,
    };
    if (projectId) {
      where.projectId = projectId;
    } else {
      where.OR = [
        { projectId: null },
        { project: { archivedAt: null } },
      ];
    }
    const opportunities = await this.prisma.opportunity.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return opportunities.map((o) => ({
      id: o.id,
      companyName: o.companyName,
      size: o.size,
      projectId: o.projectId,
      projectName: o.project?.name ?? null,
      contractName: o.contractName ?? null,
      setupFee: Number(o.setupFee),
      monthlyFee: Number(o.monthlyFee),
      dealValue: Number(o.setupFee) + Number(o.monthlyFee),
      expectedCloseDate:
        o.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
      initiationDate:
        (o as any).initiationDate?.toISOString().slice(0, 10) ??
        o.createdAt?.toISOString().slice(0, 10) ??
        null,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

  async createOpportunity(dto: CreateOpportunityDto, userId: string) {
    let year = dto.year;
    let week = dto.week;

    if (year === undefined || week === undefined) {
      const referenceDate = dto.initiationDate
        ? new Date(dto.initiationDate)
        : dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : new Date();
      const iso = this.getIsoWeek(referenceDate);
      year = year ?? iso.year;
      week = week ?? iso.week;
    }

    const initiationDate = dto.initiationDate
      ? new Date(dto.initiationDate)
      : new Date();

    return await this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.create({
        data: {
          companyName: dto.companyName,
          size: this.normalizeSize(dto.size),
          projectId: dto.projectId ?? null,
          contractName: dto.contractName ?? null,
          setupFee: dto.setupFee,
          monthlyFee: dto.monthlyFee ?? 0,
          expectedCloseDate: dto.expectedCloseDate
            ? new Date(dto.expectedCloseDate)
            : null,
          initiationDate,
          status: dto.status ?? 'active',
          year,
          week,
          createdById: userId,
        },
      });

      return opportunity;
    });
  }

  async updateOpportunity(id: string, dto: UpdateOpportunityDto) {
    return await this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({ where: { id } });
      if (!opp) {
        throw new NotFoundException(`Không tìm thấy Opportunity với ID: ${id}`);
      }

      const data: any = {};
      if (dto.companyName !== undefined) data.companyName = dto.companyName;
      if (dto.size !== undefined) data.size = this.normalizeSize(dto.size);
      if (dto.projectId !== undefined) data.projectId = dto.projectId ?? null;
      if (dto.contractName !== undefined)
        data.contractName = dto.contractName || null;
      if (dto.setupFee !== undefined) data.setupFee = dto.setupFee;
      if (dto.monthlyFee !== undefined) data.monthlyFee = dto.monthlyFee;
      if (dto.expectedCloseDate !== undefined) {
        data.expectedCloseDate = dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null;
      }
      if (dto.initiationDate !== undefined) {
        data.initiationDate = dto.initiationDate
          ? new Date(dto.initiationDate)
          : null;
      }
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.year !== undefined) data.year = dto.year;
      if (dto.week !== undefined) data.week = dto.week;

      const updated = await tx.opportunity.update({
        where: { id },
        data,
      });

      return updated;
    });
  }

  getIsoWeek(value: Date | string): { year: number; week: number } {
    const d = new Date(value);
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return { year: target.getUTCFullYear(), week };
  }

  getOpportunityPeriodCondition(dateRange: { startDate: Date; endDate: Date }) {
    return {
      OR: [
        {
          initiationDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        {
          initiationDate: null,
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      ],
    };
  }

  normalizeSize(size?: string | null): string {
    if (!size || !size.trim()) return 'Medium';
    const s = size.trim();
    const upper = s.toUpperCase();
    if (upper === 'M' || upper === 'MEDIUM') return 'Medium';
    if (upper === 'E' || upper === 'ENTERPRISE') return 'Enterprise';
    if (upper === 'SME') return 'SME';
    if (upper === 'SMB') return 'SMB';
    if (upper === 'STARTUP') return 'Startup';
    return s;
  }

  // Chuyển OPP -> Won (BR-006)
  async markOpportunityWon(
    id: string,
    userId: string,
    dto?: MarkOpportunityWonDto,
  ) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opp) {
      throw new NotFoundException(`Không tìm thấy Opportunity với ID: ${id}`);
    }

    const wonDate = dto?.signedDate ? new Date(dto.signedDate) : new Date();
    const isoWeek = this.getIsoWeek(wonDate);
    const contractName =
      dto?.contractName !== undefined
        ? dto.contractName || null
        : opp.contractName || null;

    // Update status to won
    const updatedOpp = await this.prisma.opportunity.update({
      where: { id },
      data: {
        status: 'won',
        wonDate,
        contractName,
      },
    });

    const dealData = {
      companyName: opp.companyName,
      size: opp.size,
      projectId: opp.projectId,
      contractName,
      setupFee: opp.setupFee,
      monthlyFee: opp.monthlyFee,
      closedDate: wonDate,
      // §3: the deal is attributed to periods by the opportunity's start date.
      initiationDate: opp.initiationDate ?? null,
      year: isoWeek.year,
      week: isoWeek.week,
    };

    // ClosedDeal.opportunityId is unique: an opportunity whose deal was
    // archived (deleteClosedDeal resets it to active) re-uses that row.
    const existingDeal = await this.prisma.closedDeal.findUnique({
      where: { opportunityId: opp.id },
    });
    const closedDeal = existingDeal
      ? await this.prisma.closedDeal.update({
          where: { id: existingDeal.id },
          data: { ...dealData, archivedAt: null, archivedBy: null },
        })
      : await this.prisma.closedDeal.create({
          data: {
            ...dealData,
            opportunityId: opp.id,
            createdById: userId,
          },
        });

    return {
      success: true,
      opportunity: updatedOpp,
      closedDeal: formatRawClosedDeal({
        ...closedDeal,
        opportunityId: closedDeal?.opportunityId ?? opp.id,
        opportunity: { initiationDate: opp.initiationDate ?? null },
      }),
    };
  }

  // Nhập Closed Deal năm trước (lịch sử)
  async savePriorYearDeals(dto: SavePriorYearDealsDto, userId: string) {
    // Delete existing deals for this year to overwrite
    await this.prisma.closedDeal.deleteMany({
      where: { year: dto.year },
    });

    const createdDeals = [];
    for (const deal of dto.deals) {
      const created = await this.prisma.closedDeal.create({
        data: {
          companyName: deal.companyName,
          size: deal.size,
          projectId: deal.projectId ?? null,
          setupFee: deal.setupFee,
          monthlyFee: deal.monthlyFee ?? 0,
          closedDate: new Date(deal.closedDate),
          initiationDate: parseFlexibleDate(deal.initiationDate),
          year: dto.year,
          week: 1, // Default to week 1 for historical yearly input
          createdById: userId,
        },
      });
      createdDeals.push(created);
    }

    return { success: true, count: createdDeals.length };
  }

  // --- REPORT & ANALYSIS ---
  async getAnalysis(query: AnalysisQueryDto) {
    const year = parseInt(query.year, 10);
    const weeks = this.getWeeksForPeriod(
      query.periodType,
      query.periodValue,
      year,
    );
    const dateRange = this.getPeriodDateRange(
      query.periodType,
      query.periodValue,
      year,
    );

    let activeProjectIds: string[] = [];
    if (query.projectId) {
      activeProjectIds = [query.projectId];
    } else {
      const activeProjects = await this.prisma.project.findMany({
        where: { archivedAt: null, status: { not: 'Cancelled' } },
        select: { id: true },
      });
      activeProjectIds = activeProjects.map((p) => p.id);
    }

    // 1. Get Actual Counts
    const actual = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };

    // Active opportunities within period (for OPP count and Pipeline Value)
    const pipelineOppsWhere: any = {
      status: 'active',
      archivedAt: null,
      AND: [
        this.getOpportunityPeriodCondition(dateRange),
        query.projectId
          ? { projectId: query.projectId }
          : {
              OR: [
                { projectId: { in: activeProjectIds } },
                { projectId: null },
              ],
            },
      ],
    };

    // Auto-count Closed Deals by closedDate within period (+ setupFee as revenue)
    const closedDealsWhere: any = {
      closedDate: { gte: dateRange.startDate, lte: dateRange.endDate },
      archivedAt: null,
    };
    if (query.projectId) {
      closedDealsWhere.projectId = query.projectId;
    } else {
      closedDealsWhere.OR = [
        { projectId: { in: activeProjectIds } },
        { projectId: null },
      ];
    }

    // 3. CAC & LTV inputs
    const months = this.getMonthsForWeeks(year, weeks);
    const expenseWhere: any = {
      archivedAt: null,
      year,
      month: { in: months },
    };
    if (query.projectId) {
      expenseWhere.projectId = query.projectId;
    } else {
      expenseWhere.projectId = { in: activeProjectIds };
    }

    // Avg fees for LTV
    const avgStatsWhere: any = {
      closedDate: { gte: dateRange.startDate, lte: dateRange.endDate },
      archivedAt: null,
    };
    if (query.projectId) {
      avgStatsWhere.projectId = query.projectId;
    } else {
      avgStatsWhere.OR = [
        { projectId: { in: activeProjectIds } },
        { projectId: null },
      ];
    }

    // All reads are independent; run them concurrently. The annual kpiPlan
    // fallback is still only fetched when there are no plan distributions.
    const [
      distRecords,
      pipelineOpps,
      closedDeals,
      planSource,
      expenses,
      avgStats,
      churnRate,
      grossMargin,
    ] = await Promise.all([
      this.prisma.kpiDistribution.findMany({
        where: {
          year,
          week: { in: weeks },
          projectId: query.projectId
            ? query.projectId
            : { in: activeProjectIds },
          type: 'actual',
        },
      }),
      this.prisma.opportunity.findMany({
        where: pipelineOppsWhere,
      }),
      this.prisma.closedDeal.findMany({
        where: closedDealsWhere,
      }),
      (async () => {
        const planDistRecords = await this.prisma.kpiDistribution.findMany({
          where: {
            year,
            week: { in: weeks },
            projectId: query.projectId
              ? query.projectId
              : { in: activeProjectIds },
            type: 'plan',
          },
        });
        if (planDistRecords.length > 0) {
          return { planDistRecords, kpiPlan: null };
        }
        const kpiPlan = await this.prisma.kpiPlan.findUnique({
          where: { year },
        });
        return { planDistRecords, kpiPlan };
      })(),
      this.prisma.expenseRecord.aggregate({
        where: expenseWhere,
        _sum: {
          directCost: true,
          overheadCost: true,
        },
      }),
      this.prisma.closedDeal.aggregate({
        where: avgStatsWhere,
        _avg: {
          setupFee: true,
          monthlyFee: true,
        },
      }),
      this.getSystemConfigValue('churn_rate', year),
      this.getSystemConfigValue('gross_margin', year),
    ]);

    for (const dist of distRecords) {
      actual.rawLeads += dist.rawLeads;
      actual.mql += dist.mql;
      actual.sql += dist.sql;
    }

    // Auto-count OPPs by initiationDate within period (same filter as pipelineOpps)
    actual.oppCount = pipelineOpps.length;

    for (const o of pipelineOpps) {
      actual.pipelineValue += Number(o.setupFee) + Number(o.monthlyFee);
    }

    actual.closedCount = closedDeals.length;
    for (const d of closedDeals) {
      actual.wonValue += Number(d.setupFee);
    }

    // 2. Get Plan Values
    const plan = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };

    const { planDistRecords, kpiPlan } = planSource;
    if (planDistRecords.length > 0) {
      for (const p of planDistRecords) {
        plan.rawLeads += p.rawLeads;
        plan.mql += p.mql;
        plan.sql += p.sql;
        plan.oppCount += p.oppCount;
        plan.closedCount += p.closedCount;
        plan.pipelineValue += Number(p.pipelineValue);
        plan.wonValue += Number(p.wonValue);
      }
    } else if (kpiPlan) {
      const factor = weeks.length / 52;
      plan.rawLeads = Math.round(kpiPlan.totalRawLeads * factor);
      plan.mql = Math.round(kpiPlan.targetMql * factor);
      plan.sql = Math.round(kpiPlan.targetSql * factor);
      plan.oppCount = Math.round(kpiPlan.targetOpp * factor);
      plan.closedCount = Math.round(kpiPlan.targetClosedDeal * factor);
      plan.pipelineValue = Number(kpiPlan.targetPipelineVal) * factor;
      plan.wonValue = Number(kpiPlan.targetWonVal) * factor;
    }

    // 3. CAC & LTV
    const totalCost =
      Number(expenses._sum.directCost ?? 0) +
      Number(expenses._sum.overheadCost ?? 0);
    const totalClosed = closedDeals.length;

    const cac =
      totalClosed > 0 ? Number((totalCost / totalClosed).toFixed(0)) : 0;

    const avgSetup = Number(avgStats._avg.setupFee ?? 0);
    const avgMonthly = Number(avgStats._avg.monthlyFee ?? 0);

    const churnDecimal = churnRate / 100;
    const marginDecimal = grossMargin / 100;

    const ltv =
      churnDecimal > 0
        ? Number(
            (
              (avgSetup + avgMonthly * (1 / churnDecimal)) *
              marginDecimal
            ).toFixed(0),
          )
        : 0;
    const ratio = cac > 0 ? Number((ltv / cac).toFixed(1)) : 0;

    let healthIndicator = '🔴';
    if (ratio > 4.0) healthIndicator = '🔵';
    else if (ratio >= 2.5) healthIndicator = '🟢';
    else if (ratio >= 1.5) healthIndicator = '🟡';

    // 4. Funnel Chart data
    const funnelSteps = [
      { step: 'Raw Leads', actual: actual.rawLeads, plan: plan.rawLeads },
      { step: 'MQL', actual: actual.mql, plan: plan.mql },
      { step: 'SQL', actual: actual.sql, plan: plan.sql },
      { step: 'OPP', actual: actual.oppCount, plan: plan.oppCount },
      {
        step: 'Closed Deal',
        actual: actual.closedCount,
        plan: plan.closedCount,
      },
    ].map((item, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      let convPct = '—';
      if (prev && prev.actual > 0) {
        convPct = `${((item.actual / prev.actual) * 100).toFixed(1)}%`;
      }
      const pctVsPlan =
        item.plan > 0
          ? `${((item.actual / item.plan) * 100).toFixed(1)}%`
          : '0%';
      return {
        ...item,
        convPct,
        pctVsPlan,
      };
    });

    // 5. Segments
    const pipelineBySegment: Record<string, { count: number; value: number }> = {
      enterprise: { count: 0, value: 0 },
      mid_market: { count: 0, value: 0 },
      smb: { count: 0, value: 0 },
    };
    for (const o of pipelineOpps) {
      const seg = this.normalizeSegment(o.size);
      if (pipelineBySegment[seg]) {
        pipelineBySegment[seg].count++;
        pipelineBySegment[seg].value +=
          Number(o.setupFee) + Number(o.monthlyFee);
      }
    }

    const closedBySegment: Record<string, { count: number; value: number }> = {
      enterprise: { count: 0, value: 0 },
      mid_market: { count: 0, value: 0 },
      smb: { count: 0, value: 0 },
    };
    for (const d of closedDeals) {
      const seg = this.normalizeSegment(d.size);
      if (closedBySegment[seg]) {
        closedBySegment[seg].count++;
        closedBySegment[seg].value += Number(d.setupFee);
      }
    }

    return {
      kpiCards: {
        rawLeads: {
          actual: actual.rawLeads,
          plan: plan.rawLeads,
          pct: this.calcPct(actual.rawLeads, plan.rawLeads),
        },
        mql: {
          actual: actual.mql,
          plan: plan.mql,
          pct: this.calcPct(actual.mql, plan.mql),
        },
        sql: {
          actual: actual.sql,
          plan: plan.sql,
          pct: this.calcPct(actual.sql, plan.sql),
        },
        opp: {
          actual: actual.oppCount,
          plan: plan.oppCount,
          pct: this.calcPct(actual.oppCount, plan.oppCount),
        },
        closed: {
          actual: actual.closedCount,
          plan: plan.closedCount,
          pct: this.calcPct(actual.closedCount, plan.closedCount),
        },
        pipelineValue: {
          actual: actual.pipelineValue,
          plan: plan.pipelineValue,
          pct: this.calcPct(actual.pipelineValue, plan.pipelineValue),
        },
        wonValue: {
          actual: actual.wonValue,
          plan: plan.wonValue,
          pct: this.calcPct(actual.wonValue, plan.wonValue),
        },
        cac,
        totalCost,
        totalExpense: totalCost,
        roas:
          totalCost > 0
            ? Number((actual.wonValue / totalCost).toFixed(2))
            : 0,
        cpmql:
          actual.mql > 0
            ? Number((totalCost / actual.mql).toFixed(0))
            : 0,
        cpsql:
          actual.sql > 0
            ? Number((totalCost / actual.sql).toFixed(0))
            : 0,
        ltv,
        ratio,
        healthIndicator,
      },
      funnel: funnelSteps,
      pipelineBySegment,
      closedBySegment,
    };
  }

  // --- COMPARISON ---
  async getComparison(query: ComparisonQueryDto) {
    const year1 = parseInt(query.year1, 10);
    const year2 = query.year2 ? parseInt(query.year2, 10) : NaN;
    const year3 = query.year3 ? parseInt(query.year3, 10) : NaN;

    const w1 = this.getWeeksForPeriod(
      query.periodType,
      query.currentPeriodValue,
      year1,
    );
    const r1 = this.getPeriodDateRange(
      query.periodType,
      query.currentPeriodValue,
      year1,
    );

    const w2 = isNaN(year2)
      ? []
      : this.getWeeksForPeriod(
          query.periodType,
          query.currentPeriodValue,
          year2,
        );
    const r2 = isNaN(year2)
      ? null
      : this.getPeriodDateRange(
          query.periodType,
          query.currentPeriodValue,
          year2,
        );

    const w3 = isNaN(year3)
      ? []
      : this.getWeeksForPeriod(
          query.periodType,
          query.currentPeriodValue,
          year3,
        );
    const r3 = isNaN(year3)
      ? null
      : this.getPeriodDateRange(
          query.periodType,
          query.currentPeriodValue,
          year3,
        );

    // The active-project list does not depend on the year; load it once and
    // share it across the compared years instead of once per year.
    const activeProjectIds = query.projectId
      ? undefined
      : await this.getActiveProjectIds();

    const [data1, data2, data3] = await Promise.all([
      this.getPeriodAggregatedData(year1, w1, r1, query.projectId, activeProjectIds),
      isNaN(year2) || !r2
        ? Promise.resolve(null)
        : this.getPeriodAggregatedData(year2, w2, r2, query.projectId, activeProjectIds),
      isNaN(year3) || !r3
        ? Promise.resolve(null)
        : this.getPeriodAggregatedData(year3, w3, r3, query.projectId, activeProjectIds),
    ]);

    const yoy26vs25 =
      data1 && data2 ? this.calcYoY(data1.actual, data2.actual) : null;
    const yoy25vs24 =
      data2 && data3 ? this.calcYoY(data2.actual, data3.actual) : null;

    return {
      year1: { year: year1, data: data1 },
      year2: isNaN(year2) ? null : { year: year2, data: data2 },
      year3: isNaN(year3) ? null : { year: year3, data: data3 },
      yoy26vs25,
      yoy25vs24,
    };
  }

  // --- CLOSED DEALS LIST ---
  async getClosedDeals(query: GetClosedDealsDto) {
    const where: any = {
      archivedAt: null,
    };
    if (query.year) {
      where.year = parseInt(query.year, 10);
    }
    if (query.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: query.projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
      where.projectId = query.projectId;
    } else {
      where.OR = [
        { projectId: null },
        { project: { archivedAt: null } },
      ];
    }
    if (query.size) {
      where.size = query.size;
    }
    if (query.month && query.year) {
      const y = parseInt(query.year, 10);
      const m = parseInt(query.month, 10);
      const weeks = this.getWeeksForPeriod('month', query.month, y);
      where.week = { in: weeks };
    } else if (query.quarter && query.year) {
      const y = parseInt(query.year, 10);
      const weeks = this.getWeeksForPeriod('quarter', query.quarter, y);
      where.week = { in: weeks };
    }

    const deals = await this.prisma.closedDeal.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        opportunity: OPPORTUNITY_INITIATION_SELECT,
      },
      orderBy: { closedDate: 'desc' },
    });

    return deals.map((d) => ({
      id: d.id,
      companyName: d.companyName,
      size: d.size,
      projectId: d.projectId,
      projectName: d.project?.name ?? null,
      contractName: d.contractName ?? null,
      setupFee: Number(d.setupFee),
      monthlyFee: Number(d.monthlyFee),
      dealValue: Number(d.setupFee) + Number(d.monthlyFee) * 12,
      closedDate: d.closedDate.toISOString().slice(0, 10),
      createdBy: d.createdBy?.name ?? null,
      week: d.week,
      year: d.year,
      archivedAt: d.archivedAt ?? null,
      ...closedDealInitiationFields(d),
    }));
  }

  async updateClosedDeal(id: string, dto: UpdateClosedDealDto) {
    const deal = await this.prisma.closedDeal.findFirst({
      where: { id, archivedAt: null },
    });
    if (!deal) {
      throw new NotFoundException(`Không tìm thấy Closed Deal với ID: ${id}`);
    }

    const data: any = { ...dto };
    if (dto.closedDate) {
      data.closedDate = new Date(dto.closedDate);
    }
    // §3: 'YYYY-MM-DD' sets the deal's own initiation date, null clears it
    // (the response then falls back to the linked opportunity's date).
    if (dto.initiationDate !== undefined) {
      data.initiationDate = dto.initiationDate
        ? parseFlexibleDate(dto.initiationDate)
        : null;
    } else {
      delete data.initiationDate;
    }

    const updated = await this.prisma.closedDeal.update({
      where: { id },
      data,
      include: { opportunity: OPPORTUNITY_INITIATION_SELECT },
    });
    return formatRawClosedDeal(updated);
  }

  async deleteClosedDeal(id: string, userId?: string) {
    const deal = await this.prisma.closedDeal.findFirst({
      where: { id, archivedAt: null },
    });
    if (!deal) {
      throw new NotFoundException(`Không tìm thấy Closed Deal với ID: ${id}`);
    }

    if (deal.opportunityId) {
      await this.prisma.opportunity.updateMany({
        where: { id: deal.opportunityId },
        data: {
          status: 'active',
          wonDate: null,
        },
      });
    }

    await this.prisma.closedDeal.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId ?? null,
      },
    });

    return { success: true };
  }

  async deleteOpportunity(id: string, userId?: string) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, archivedAt: null },
    });
    if (!opp) {
      throw new NotFoundException(`Không tìm thấy Opportunity với ID: ${id}`);
    }

    await this.prisma.closedDeal.updateMany({
      where: { opportunityId: id },
      data: { opportunityId: null },
    });

    await this.prisma.opportunity.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId ?? null,
      },
    });

    return { success: true };
  }

  async deleteCompareData(years: number[]) {
    await this.prisma.$transaction([
      this.prisma.task.deleteMany({ where: { execYear: { in: years } } }),
      this.prisma.closedDeal.deleteMany({ where: { year: { in: years } } }),
      this.prisma.opportunity.deleteMany({ where: { year: { in: years } } }),
      this.prisma.expenseRecord.deleteMany({ where: { year: { in: years } } }),
      this.prisma.weeklyReportLog.deleteMany({
        where: { year: { in: years } },
      }),
      this.prisma.kpiDistribution.deleteMany({
        where: { year: { in: years } },
      }),
      this.prisma.kpiActual.deleteMany({ where: { year: { in: years } } }),
      this.prisma.kpiPlan.deleteMany({ where: { year: { in: years } } }),
      this.prisma.systemConfig.deleteMany({ where: { year: { in: years } } }),
    ]);
    return {
      success: true,
      message: `Đã xóa dữ liệu các năm: ${years.join(', ')}`,
    };
  }

  // --- HELPERS ---
  // Starts a read immediately and captures its outcome instead of rejecting, so
  // it can run inside Promise.all while its error is still handled afterwards by
  // the same try/catch as the original sequential code.
  private async settle<T>(
    fn: () => Promise<T>,
  ): Promise<{ failed: boolean; value?: T; error?: unknown }> {
    try {
      return { failed: false, value: await fn() };
    } catch (error) {
      return { failed: true, error };
    }
  }

  // [Monday of ISO week - 2 days, Monday + 9 days): a superset of every date
  // whose getIsoWeek() is (year, week). Returns null for non-integer input so
  // callers fall back to an unbounded query.
  private getIsoWeekSearchWindow(
    year: number,
    week: number,
  ): { start: Date; end: Date } | null {
    if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
    const DAY = 86400000;
    const jan4 = Date.UTC(year, 0, 4);
    if (isNaN(jan4)) return null;
    const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7; // Monday = 0
    const monday = jan4 - jan4Dow * DAY + (week - 1) * 7 * DAY;
    const start = new Date(monday - 2 * DAY);
    const end = new Date(monday + 9 * DAY);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return { start, end };
  }

  private getDeterministicWeeklyPlan(total: number, week: number, totalWeeks: number = 52): number {
    if (total <= 0 || totalWeeks <= 0) return 0;
    const base = Math.floor(total / totalWeeks);
    const remainder = total - base * totalWeeks;
    return week === totalWeeks ? base + remainder : base;
  }

  private async calculatePlanGocForYear(year: number, week: number = 1) {
    const kpiPlan = await this.prisma.kpiPlan.findUnique({
      where: { year },
    });
    if (!kpiPlan) {
      return { rawLeads: 0, mql: 0, sql: 0, oppCount: 0, closedCount: 0 };
    }
    return {
      rawLeads: this.getDeterministicWeeklyPlan(kpiPlan.totalRawLeads, week, 52),
      mql: this.getDeterministicWeeklyPlan(kpiPlan.targetMql, week, 52),
      sql: this.getDeterministicWeeklyPlan(kpiPlan.targetSql, week, 52),
      oppCount: this.getDeterministicWeeklyPlan(kpiPlan.targetOpp, week, 52),
      closedCount: this.getDeterministicWeeklyPlan(kpiPlan.targetClosedDeal, week, 52),
    };
  }

  // Rollover logic disabled per September specification (backend-leads-kpi-project-flow.md)
  private async calculateRolloverForWeek(year: number, targetWeek: number) {
    return {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
    };
  }

  private getWeeksForPeriod(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ): number[] {
    if (periodType === 'week') {
      const w = parseInt(periodValue ?? '1', 10);
      return [w];
    }
    if (periodType === 'month') {
      const m = parseInt(periodValue ?? '1', 10);
      return this.getWeeksInMonth(year, m);
    }
    if (periodType === 'quarter') {
      const q = parseInt(periodValue ?? '1', 10);
      return this.getWeeksInQuarter(year, q);
    }
    return this.getWeeksInYear(year);
  }

  private getWeeksInMonth(year: number, month: number): number[] {
    const weeks: number[] = [];
    for (let w = 1; w <= 53; w++) {
      const thursday = this.getThursdayOfWeek(year, w);
      if (
        thursday.getFullYear() === year &&
        thursday.getMonth() + 1 === month
      ) {
        weeks.push(w);
      }
    }
    return weeks;
  }

  private getWeeksInQuarter(year: number, quarter: number): number[] {
    const startMonth = (quarter - 1) * 3 + 1;
    const weeks: number[] = [];
    for (let m = startMonth; m < startMonth + 3; m++) {
      weeks.push(...this.getWeeksInMonth(year, m));
    }
    return weeks;
  }

  private getWeeksInYear(year: number): number[] {
    const weeks: number[] = [];
    for (let m = 1; m <= 12; m++) {
      weeks.push(...this.getWeeksInMonth(year, m));
    }
    return weeks;
  }

  private getThursdayOfWeek(year: number, week: number): Date {
    const target = new Date(year, 0, 4);
    const day = target.getDay();
    const diff = 4 - (day === 0 ? 7 : day);
    target.setDate(target.getDate() + diff);
    target.setDate(target.getDate() + (week - 1) * 7);
    return target;
  }

  private getMonthsForWeeks(year: number, weeks: number[]): number[] {
    const months: number[] = [];
    for (const w of weeks) {
      const thursday = this.getThursdayOfWeek(year, w);
      if (thursday.getFullYear() === year) {
        const m = thursday.getMonth() + 1;
        if (!months.includes(m)) {
          months.push(m);
        }
      }
    }
    return months;
  }

  private async getSystemConfigValue(
    key: string,
    year: number,
  ): Promise<number> {
    const config = await this.prisma.systemConfig.findFirst({
      where: { key, year },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!config) {
      return key === 'gross_margin' ? 60.0 : 2.0; // defaults
    }
    return Number(config.value);
  }

  private calcPct(actual: number, plan: number): number {
    if (!plan) return 0;
    return Number(((actual / plan) * 100).toFixed(1));
  }

  private calcYoY(val1: any, val2: any) {
    const res: any = {};
    for (const k of Object.keys(val1)) {
      const prev = val2[k] ?? 0;
      const curr = val1[k] ?? 0;
      if (prev <= 0) {
        res[k] = 0;
      } else {
        res[k] = Number((((curr - prev) / prev) * 100).toFixed(1));
      }
    }
    return res;
  }

  getPeriodDateRange(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ): { startDate: Date; endDate: Date } {
    if (periodType === 'week') {
      const w = parseInt(periodValue ?? '1', 10);
      const thursday = this.getThursdayOfWeek(year, w);
      const monday = new Date(thursday);
      monday.setUTCDate(thursday.getUTCDate() - 3);
      monday.setUTCHours(0, 0, 0, 0);

      const sunday = new Date(thursday);
      sunday.setUTCDate(thursday.getUTCDate() + 3);
      sunday.setUTCHours(23, 59, 59, 999);

      return { startDate: monday, endDate: sunday };
    }

    if (periodType === 'month') {
      const m = parseInt(periodValue ?? '1', 10);
      const startDate = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
      return { startDate, endDate };
    }

    if (periodType === 'quarter') {
      const q = parseInt(periodValue ?? '1', 10);
      const startMonth = (q - 1) * 3 + 1;
      const startDate = new Date(Date.UTC(year, startMonth - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, startMonth + 2, 0, 23, 59, 59, 999));
      return { startDate, endDate };
    }

    // year
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { startDate, endDate };
  }

  normalizeSegment(size?: string | null): 'enterprise' | 'mid_market' | 'smb' {
    if (!size) return 'mid_market';
    const s = size.trim().toLowerCase().replace(/[\s-]/g, '_');
    if (s === 's' || s === 'smb' || s === 'sme' || s === 'small' || s === 'startup') return 'smb';
    if (s === 'e' || s === 'enterprise' || s === 'large') return 'enterprise';
    return 'mid_market';
  }

  private async getActiveProjectIds(): Promise<string[]> {
    const activeProjects = await this.prisma.project.findMany({
      where: { archivedAt: null, status: { not: 'Cancelled' } },
      select: { id: true },
    });
    return (activeProjects || []).map((p) => p.id);
  }

  private async getPeriodAggregatedData(
    year: number,
    weeks: number[],
    dateRange?: { startDate: Date; endDate: Date },
    projectId?: string,
    preloadedActiveProjectIds?: string[],
  ) {
    let activeProjectIds: string[] = [];
    if (projectId) {
      activeProjectIds = [projectId];
    } else if (preloadedActiveProjectIds) {
      activeProjectIds = preloadedActiveProjectIds;
    } else {
      activeProjectIds = await this.getActiveProjectIds();
    }

    const distWhere: any = {
      year,
      week: { in: weeks },
      type: 'actual',
    };
    if (projectId) {
      distWhere.projectId = projectId;
    } else {
      distWhere.projectId = { in: activeProjectIds };
    }

    const useDailyActuals = !!(
      dateRange && (this.prisma as any).projectDailyActual?.findMany
    );

    const dealFilter: any = {
      archivedAt: null,
    };
    if (projectId) {
      dealFilter.projectId = projectId;
    } else {
      dealFilter.OR = [
        { projectId: { in: activeProjectIds } },
        { projectId: null },
      ];
    }

    const effectiveDateRange =
      dateRange || this.getPeriodDateRange('year', '1', year);

    const pipelineOppsWhere: any = {
      status: 'active',
      archivedAt: null,
      AND: [
        this.getOpportunityPeriodCondition(effectiveDateRange),
        projectId
          ? { projectId }
          : {
              OR: [
                { projectId: { in: activeProjectIds } },
                { projectId: null },
              ],
            },
      ],
    };

    // All reads are independent; run them concurrently and apply the results
    // in the original order below.
    const [distRecords, dailyResult, closedDeals, pipelineOpps, kpiPlan] =
      await Promise.all([
        this.prisma.kpiDistribution.findMany({
          where: distWhere,
        }),
        useDailyActuals
          ? this.settle(() => {
              const dailyWhere: any = {
                actualDate: {
                  gte: dateRange!.startDate,
                  lte: dateRange!.endDate,
                },
                archivedAt: null,
              };
              // Same project scope as GET /reports/weekly
              if (projectId) {
                dailyWhere.projectId = projectId;
              } else {
                dailyWhere.project = { archivedAt: null };
              }

              return (this.prisma as any).projectDailyActual.findMany({
                where: dailyWhere,
              });
            })
          : Promise.resolve(null),
        dateRange
          ? this.prisma.closedDeal.findMany({
              where: {
                ...dealFilter,
                closedDate: { gte: dateRange.startDate, lte: dateRange.endDate },
              },
            })
          : this.prisma.closedDeal.findMany({
              where: { ...dealFilter, year, week: { in: weeks } },
            }),
        this.prisma.opportunity.findMany({
          where: pipelineOppsWhere,
        }),
        this.prisma.kpiPlan.findUnique({
          where: { year },
        }),
      ]);
    const safeDistRecords = Array.isArray(distRecords) ? distRecords : [];

    const actual = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };

    for (const dist of safeDistRecords) {
      actual.rawLeads += dist.rawLeads || 0;
      actual.mql += dist.mql || 0;
      actual.sql += dist.sql || 0;
    }

    if (dailyResult) {
      try {
        if (dailyResult.failed) throw dailyResult.error;
        const dailyActuals = dailyResult.value;

        const safeDailyActuals = Array.isArray(dailyActuals) ? dailyActuals : [];
        let dailySumRawLeads = 0;
        let dailySumMql = 0;
        let dailySumSql = 0;
        let dailySumOpp = 0;
        let dailySumClosedDeal = 0;

        for (const d of safeDailyActuals) {
          dailySumRawLeads += d.rawLeads || 0;
          dailySumMql += d.mql || 0;
          dailySumSql += d.sql || 0;
          dailySumOpp += d.opp || 0;
          dailySumClosedDeal += d.closedDeal || 0;
        }

        // Daily actuals are the source of truth for leads (BE_requirement_22_09_26 §2.1)
        actual.rawLeads = dailySumRawLeads;
        actual.mql = dailySumMql;
        actual.sql = dailySumSql;
        actual.oppCount = Math.max(actual.oppCount, dailySumOpp);
        actual.closedCount = Math.max(actual.closedCount, dailySumClosedDeal);
      } catch (err) {
        console.warn('Query dailyActuals in getPeriodAggregatedData failed:', err);
      }
    }

    const safePipelineOpps = Array.isArray(pipelineOpps) ? pipelineOpps : [];

    // OPP count uses the same filter as pipelineOpps (active, not archived,
    // in period, project scope), so it equals the number of loaded rows.
    const oppCount = safePipelineOpps.length;
    actual.oppCount = Math.max(actual.oppCount, oppCount);

    const safeDeals = Array.isArray(closedDeals) ? closedDeals : [];
    actual.closedCount = Math.max(actual.closedCount, safeDeals.length);
    for (const d of safeDeals) {
      actual.wonValue += Number(d.setupFee || 0);
    }

    for (const o of safePipelineOpps) {
      actual.pipelineValue += Number(o.setupFee || 0) + Number(o.monthlyFee || 0);
    }

    const plan = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };

    if (kpiPlan) {
      const factor = weeks.length / 52;
      plan.rawLeads = Math.round(kpiPlan.totalRawLeads * factor);
      plan.mql = Math.round(kpiPlan.targetMql * factor);
      plan.sql = Math.round(kpiPlan.targetSql * factor);
      plan.oppCount = Math.round(kpiPlan.targetOpp * factor);
      plan.closedCount = Math.round(kpiPlan.targetClosedDeal * factor);
      plan.pipelineValue = Number(kpiPlan.targetPipelineVal) * factor;
      plan.wonValue = Number(kpiPlan.targetWonVal) * factor;
    }

    return {
      actual,
      plan,
      pct: {
        rawLeads: this.calcPct(actual.rawLeads, plan.rawLeads),
        mql: this.calcPct(actual.mql, plan.mql),
        sql: this.calcPct(actual.sql, plan.sql),
        oppCount: this.calcPct(actual.oppCount, plan.oppCount),
        closedCount: this.calcPct(actual.closedCount, plan.closedCount),
        pipelineValue: this.calcPct(actual.pipelineValue, plan.pipelineValue),
        wonValue: this.calcPct(actual.wonValue, plan.wonValue),
      },
    };
  }

  // ==========================================
  // SEPTEMBER SPEC: PROJECT KPI & DAILY ACTUALS
  // ==========================================

  private parseUtcDate(dateStr: string): Date {
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
    }
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  async getAllocationStatus(year: number = 2026) {
    const [annualPlan, projects] = await Promise.all([
      this.getPlan(year),
      this.prisma.project.findMany({
        where: { archivedAt: null },
        select: {
          kpiRawLeadsPlan: true,
          kpiMqlPlan: true,
          kpiSqlPlan: true,
          kpiOppPlan: true,
          kpiClosedDealPlan: true,
          kpiPipelineValuePlan: true,
        },
      }),
    ]);

    const projectsTotal = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
      pipelineValue: 0,
    };

    const safeProjects = Array.isArray(projects) ? projects : [];
    for (const p of safeProjects) {
      projectsTotal.rawLeads += p.kpiRawLeadsPlan ? Number(p.kpiRawLeadsPlan) : 0;
      projectsTotal.mql += p.kpiMqlPlan ? Number(p.kpiMqlPlan) : 0;
      projectsTotal.sql += p.kpiSqlPlan ? Number(p.kpiSqlPlan) : 0;
      projectsTotal.opp += p.kpiOppPlan ? Number(p.kpiOppPlan) : 0;
      projectsTotal.closedDeal += p.kpiClosedDealPlan ? Number(p.kpiClosedDealPlan) : 0;
      projectsTotal.pipelineValue += p.kpiPipelineValuePlan ? Number(p.kpiPipelineValuePlan) : 0;
    }

    const annualTarget = {
      rawLeads: annualPlan.totalRawLeads ?? 0,
      mql: annualPlan.targetMql ?? 0,
      sql: annualPlan.targetSql ?? 0,
      opp: annualPlan.targetOpp ?? 0,
      closedDeal: annualPlan.targetClosedDeal ?? 0,
      pipelineValue: Number(annualPlan.targetPipelineVal ?? 0),
    };

    const determineStatus = (diff: number) => {
      if (diff === 0) return 'BALANCED';
      return diff < 0 ? 'UNDER_ALLOCATED' : 'OVER_ALLOCATED';
    };

    const calcMetric = (total: number, target: number) => {
      const difference = total - target;
      return {
        annual_target: target,
        projects_total: total,
        difference,
        status: determineStatus(difference),
      };
    };

    return {
      raw_leads: calcMetric(projectsTotal.rawLeads, annualTarget.rawLeads),
      mql: calcMetric(projectsTotal.mql, annualTarget.mql),
      sql: calcMetric(projectsTotal.sql, annualTarget.sql),
      opp: calcMetric(projectsTotal.opp, annualTarget.opp),
      closed_deal: calcMetric(projectsTotal.closedDeal, annualTarget.closedDeal),
      pipeline_value: calcMetric(projectsTotal.pipelineValue, annualTarget.pipelineValue),
    };
  }

  async getProjectKpiPlan(projectId: string, year: number = 2026) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const allocationStatus = await this.getAllocationStatus(year);

    const plan = {
      rawLeads: project.kpiRawLeadsPlan ? Number(project.kpiRawLeadsPlan) : 0,
      mql: project.kpiMqlPlan ? Number(project.kpiMqlPlan) : 0,
      sql: project.kpiSqlPlan ? Number(project.kpiSqlPlan) : 0,
      opp: project.kpiOppPlan ? Number(project.kpiOppPlan) : 0,
      closedDeal: project.kpiClosedDealPlan ? Number(project.kpiClosedDealPlan) : 0,
      pipelineValue: project.kpiPipelineValuePlan ? Number(project.kpiPipelineValuePlan) : 0,
    };

    const metrics = {
      raw_leads: plan.rawLeads,
      mql: plan.mql,
      sql: plan.sql,
      opp: plan.opp,
      closed_deal: plan.closedDeal,
      pipeline_value: plan.pipelineValue,
    };

    return {
      projectId: project.id,
      project_id: project.id,
      projectName: project.name,
      projectType: project.type,
      year,
      plan,
      metrics,
      allocationStatus,
      allocation_status: allocationStatus,
      updated_at: project.updatedAt,
      version: 1,
    };
  }

  async saveProjectKpiPlan(
    projectId: string,
    dto: SaveProjectKpiPlanDto,
    userId?: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const rawLeads = dto.rawLeadsPlan ?? dto.metrics?.raw_leads ?? dto.metrics?.rawLeads;
    const mql = dto.mqlPlan ?? dto.metrics?.mql;
    const sql = dto.sqlPlan ?? dto.metrics?.sql;
    const opp = dto.oppPlan ?? dto.metrics?.opp;
    const closedDeal = dto.closedDealPlan ?? dto.metrics?.closed_deal ?? dto.metrics?.closedDeal;
    const pipelineValue = dto.pipelineValuePlan ?? dto.metrics?.pipeline_value ?? dto.metrics?.pipelineValue;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(rawLeads !== undefined ? { kpiRawLeadsPlan: new Decimal(rawLeads) } : {}),
        ...(mql !== undefined ? { kpiMqlPlan: new Decimal(mql) } : {}),
        ...(sql !== undefined ? { kpiSqlPlan: new Decimal(sql) } : {}),
        ...(opp !== undefined ? { kpiOppPlan: new Decimal(opp) } : {}),
        ...(closedDeal !== undefined ? { kpiClosedDealPlan: new Decimal(closedDeal) } : {}),
        ...(pipelineValue !== undefined ? { kpiPipelineValuePlan: new Decimal(pipelineValue) } : {}),
      },
    });

    const allocationStatus = await this.getAllocationStatus(2026);

    const plan = {
      rawLeads: updated.kpiRawLeadsPlan ? Number(updated.kpiRawLeadsPlan) : 0,
      mql: updated.kpiMqlPlan ? Number(updated.kpiMqlPlan) : 0,
      sql: updated.kpiSqlPlan ? Number(updated.kpiSqlPlan) : 0,
      opp: updated.kpiOppPlan ? Number(updated.kpiOppPlan) : 0,
      closedDeal: updated.kpiClosedDealPlan ? Number(updated.kpiClosedDealPlan) : 0,
      pipelineValue: updated.kpiPipelineValuePlan ? Number(updated.kpiPipelineValuePlan) : 0,
    };

    const metrics = {
      raw_leads: plan.rawLeads,
      mql: plan.mql,
      sql: plan.sql,
      opp: plan.opp,
      closed_deal: plan.closedDeal,
      pipeline_value: plan.pipelineValue,
    };

    return {
      projectId: updated.id,
      project_id: updated.id,
      projectName: updated.name,
      plan,
      metrics,
      allocationStatus,
      allocation_status: allocationStatus,
      updated_at: updated.updatedAt,
      version: 1,
    };
  }

  async getAnnualAllocation(year: number = 2026) {
    const [annualPlan, projects] = await Promise.all([
      this.getPlan(year),
      this.prisma.project.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          kpiRawLeadsPlan: true,
          kpiMqlPlan: true,
          kpiSqlPlan: true,
          kpiOppPlan: true,
          kpiClosedDealPlan: true,
          kpiPipelineValuePlan: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const allocatedTarget = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
      pipelineValue: 0,
    };

    const projectAllocations = projects.map((p) => {
      const pRaw = p.kpiRawLeadsPlan ? Number(p.kpiRawLeadsPlan) : 0;
      const pMql = p.kpiMqlPlan ? Number(p.kpiMqlPlan) : 0;
      const pSql = p.kpiSqlPlan ? Number(p.kpiSqlPlan) : 0;
      const pOpp = p.kpiOppPlan ? Number(p.kpiOppPlan) : 0;
      const pClosed = p.kpiClosedDealPlan ? Number(p.kpiClosedDealPlan) : 0;
      const pPipeline = p.kpiPipelineValuePlan ? Number(p.kpiPipelineValuePlan) : 0;

      allocatedTarget.rawLeads += pRaw;
      allocatedTarget.mql += pMql;
      allocatedTarget.sql += pSql;
      allocatedTarget.opp += pOpp;
      allocatedTarget.closedDeal += pClosed;
      allocatedTarget.pipelineValue += pPipeline;

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        plan: {
          rawLeads: pRaw,
          mql: pMql,
          sql: pSql,
          opp: pOpp,
          closedDeal: pClosed,
          pipelineValue: pPipeline,
        },
      };
    });

    const annualTarget = {
      rawLeads: annualPlan.totalRawLeads ?? 0,
      mql: annualPlan.targetMql ?? 0,
      sql: annualPlan.targetSql ?? 0,
      opp: annualPlan.targetOpp ?? 0,
      closedDeal: annualPlan.targetClosedDeal ?? 0,
      pipelineValue: Number(annualPlan.targetPipelineVal ?? 0),
    };

    const remainingTarget = {
      rawLeads: annualTarget.rawLeads - allocatedTarget.rawLeads,
      mql: annualTarget.mql - allocatedTarget.mql,
      sql: annualTarget.sql - allocatedTarget.sql,
      opp: annualTarget.opp - allocatedTarget.opp,
      closedDeal: annualTarget.closedDeal - allocatedTarget.closedDeal,
      pipelineValue: annualTarget.pipelineValue - allocatedTarget.pipelineValue,
    };

    const isOverAllocated =
      remainingTarget.rawLeads < 0 ||
      remainingTarget.mql < 0 ||
      remainingTarget.sql < 0 ||
      remainingTarget.opp < 0 ||
      remainingTarget.closedDeal < 0;

    return {
      year,
      annualTarget,
      allocatedTarget,
      remainingTarget,
      isOverAllocated,
      projects: projectAllocations,
    };
  }

  async getDailyActual(projectId: string, date?: string) {
    const cleanProjectId = (projectId || '').trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanProjectId },
          { name: cleanProjectId },
        ],
        archivedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    if (!date) {
      return {
        exists: false,
        id: null,
        actualId: null,
        projectId: project.id,
        actualDate: null,
        rawLeads: 0,
        mql: 0,
        sql: 0,
        opp: 0,
        closedDeal: 0,
        note: null,
        data: null,
        metrics: {
          raw_leads: 0,
          mql: 0,
          sql: 0,
          opp: 0,
          closed_deal: 0,
        },
      };
    }

    const actualDate = this.parseUtcDate(date);
    if (isNaN(actualDate.getTime())) {
      throw new BadRequestException('Ngày phát sinh không hợp lệ');
    }

    let record = null;
    try {
      record = await (this.prisma as any).projectDailyActual.findUnique({
        where: {
          projectId_actualDate: {
            projectId: project.id,
            actualDate,
          },
        },
      });

      if (!record) {
        const nextDay = new Date(actualDate);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        record = await (this.prisma as any).projectDailyActual.findFirst({
          where: {
            projectId: project.id,
            actualDate: { gte: actualDate, lt: nextDay },
            archivedAt: null,
          },
        });
      }
    } catch (err) {
      console.warn('Query projectDailyActual failed:', err);
    }

    if (!record || record.archivedAt) {
      return {
        exists: false,
        id: null,
        actualId: null,
        projectId,
        actualDate: date,
        rawLeads: 0,
        mql: 0,
        sql: 0,
        opp: 0,
        closedDeal: 0,
        note: null,
        data: null,
        metrics: {
          raw_leads: 0,
          mql: 0,
          sql: 0,
          opp: 0,
          closed_deal: 0,
        },
      };
    }

    const actualDateStr = record.actualDate
      ? record.actualDate.toISOString().slice(0, 10)
      : date;

    return {
      exists: true,
      id: record.id,
      actualId: record.id,
      projectId: record.projectId,
      actualDate: actualDateStr,
      date: actualDateStr,
      rawLeads: record.rawLeads,
      mql: record.mql,
      sql: record.sql,
      opp: record.opp,
      closedDeal: record.closedDeal,
      note: record.note,
      data: {
        rawLeads: record.rawLeads,
        mql: record.mql,
        sql: record.sql,
        opp: record.opp,
        closedDeal: record.closedDeal,
        note: record.note,
      },
      metrics: {
        raw_leads: record.rawLeads,
        mql: record.mql,
        sql: record.sql,
        opp: record.opp,
        closed_deal: record.closedDeal,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async getDailyActualsForProject(projectId: string, query?: QueryDailyActualDto) {
    const cleanProjectId = (projectId || '').trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanProjectId },
          { name: cleanProjectId },
        ],
        archivedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    if (query?.date) {
      return this.getDailyActual(project.id, query.date);
    }

    const where: any = { projectId: project.id, archivedAt: null };

    const fromDateStr = query?.from || query?.fromDate;
    const toDateStr = query?.to || query?.toDate;

    if (fromDateStr || toDateStr) {
      where.actualDate = {};
      if (fromDateStr) {
        where.actualDate.gte = this.parseUtcDate(fromDateStr);
      }
      if (toDateStr) {
        where.actualDate.lte = this.parseUtcDate(toDateStr);
      }
    } else if (query?.year && query?.month) {
      const startOfMonth = new Date(Date.UTC(query.year, query.month - 1, 1));
      const endOfMonth = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
      where.actualDate = { gte: startOfMonth, lte: endOfMonth };
    } else if (query?.year) {
      const startOfYear = new Date(Date.UTC(query.year, 0, 1));
      const endOfYear = new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999));
      where.actualDate = { gte: startOfYear, lte: endOfYear };
    }

    let records: any[] = [];
    try {
      records = await (this.prisma as any).projectDailyActual.findMany({
        where,
        orderBy: [{ actualDate: 'asc' }, { createdAt: 'asc' }],
      });
    } catch (err) {
      console.warn('Query projectDailyActual failed:', err);
    }

    const totals = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
    };

    const items = (records || []).map((r: any) => {
      totals.rawLeads += r.rawLeads || 0;
      totals.mql += r.mql || 0;
      totals.sql += r.sql || 0;
      totals.opp += r.opp || 0;
      totals.closedDeal += r.closedDeal || 0;

      const dateStr = r.actualDate.toISOString().slice(0, 10);
      const iso = this.getIsoWeek(r.actualDate);
      return {
        id: r.id,
        actualId: r.id,
        projectId: r.projectId,
        actualDate: dateStr,
        date: dateStr,
        rawLeads: r.rawLeads,
        mql: r.mql,
        sql: r.sql,
        opp: r.opp,
        closedDeal: r.closedDeal,
        note: r.note,
        metrics: {
          raw_leads: r.rawLeads,
          mql: r.mql,
          sql: r.sql,
          opp: r.opp,
          closed_deal: r.closedDeal,
        },
        isoWeek: `${iso.year}-W${String(iso.week).padStart(2, '0')}`,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return {
      projectId,
      projectName: project.name,
      from: fromDateStr || null,
      to: toDateStr || null,
      totalCount: items.length,
      totals,
      records: items,
      data: items,
    };
  }

  private async syncDailyActualsToKpiDistribution(projectId: string, actualDate: Date) {
    try {
      const d = new Date(actualDate);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const weeksInMonth = this.getWeeksInMonth(year, month);
      const iso = this.getIsoWeek(actualDate);

      // Make sure weeks to update includes the iso week as well as all weeks in that month
      const weeksToUpdate = Array.from(new Set([...weeksInMonth, iso.week]));

      const dailyRecords = await (this.prisma as any).projectDailyActual.findMany({
        where: {
          projectId,
          archivedAt: null,
        },
      });

      const safeDailyRecords = Array.isArray(dailyRecords) ? dailyRecords : [];
      const recordIsoWeeks = safeDailyRecords.map((r: any) => this.getIsoWeek(r.actualDate));
      for (const w of weeksToUpdate) {
        const weekRecords = safeDailyRecords.filter((r: any, idx: number) => {
          const itemIso = recordIsoWeeks[idx];
          return itemIso.year === year && itemIso.week === w;
        });

        const weekTotals = weekRecords.reduce(
          (acc: any, r: any) => ({
            rawLeads: acc.rawLeads + (r.rawLeads || 0),
            mql: acc.mql + (r.mql || 0),
            sql: acc.sql + (r.sql || 0),
            oppCount: acc.oppCount + (r.opp || 0),
            closedCount: acc.closedCount + (r.closedDeal || 0),
          }),
          { rawLeads: 0, mql: 0, sql: 0, oppCount: 0, closedCount: 0 },
        );

        await this.prisma.kpiDistribution.upsert({
          where: {
            year_week_projectId_type: {
              year,
              week: w,
              projectId,
              type: 'actual',
            },
          },
          create: {
            year,
            week: w,
            projectId,
            type: 'actual',
            rawLeads: weekTotals.rawLeads,
            mql: weekTotals.mql,
            sql: weekTotals.sql,
            oppCount: weekTotals.oppCount,
            closedCount: weekTotals.closedCount,
            pipelineValue: 0,
            wonValue: 0,
          },
          update: {
            rawLeads: weekTotals.rawLeads,
            mql: weekTotals.mql,
            sql: weekTotals.sql,
            oppCount: weekTotals.oppCount,
            closedCount: weekTotals.closedCount,
          },
        });
      }

      // Calculate cumulative totals for the project table
      const cumulative = safeDailyRecords.reduce(
        (acc: any, r: any) => ({
          rawLeads: acc.rawLeads + (r.rawLeads || 0),
          mql: acc.mql + (r.mql || 0),
          sql: acc.sql + (r.sql || 0),
          opp: acc.opp + (r.opp || 0),
          closedDeal: acc.closedDeal + (r.closedDeal || 0),
        }),
        { rawLeads: 0, mql: 0, sql: 0, opp: 0, closedDeal: 0 },
      );

      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          kpiRawLeadsActual: cumulative.rawLeads,
          kpiMqlActual: cumulative.mql,
          kpiSqlActual: cumulative.sql,
          kpiOppActual: cumulative.opp,
          kpiClosedDealActual: cumulative.closedDeal,
        },
      });
    } catch (err) {
      console.warn('syncDailyActualsToKpiDistribution failed:', err);
    }
  }

  async saveDailyActual(
    projectId: string,
    dto: SaveDailyActualDto,
    userId?: string,
  ) {
    const cleanProjectId = (projectId || '').trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanProjectId },
          { name: cleanProjectId },
        ],
        archivedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const dateStr =
      dto.actualDate ||
      (dto as any).date ||
      (dto as any).reportingDate ||
      (dto as any).reporting_date ||
      new Date().toISOString().slice(0, 10);

    const actualDate = this.parseUtcDate(dateStr);
    if (isNaN(actualDate.getTime())) {
      throw new BadRequestException('Ngày phát sinh không hợp lệ');
    }

    // Safely check if userId exists in Member to avoid foreign key violation
    let validUserId: string | null = null;
    if (userId) {
      try {
        const member = await this.prisma.member.findUnique({
          where: { id: userId },
        });
        if (member) {
          validUserId = member.id;
        }
      } catch (err) {
        console.warn('Validate member for daily actual failed:', err);
      }
    }

    const rawLeads = dto.rawLeads ?? dto.metrics?.raw_leads ?? dto.metrics?.rawLeads ?? 0;
    const mql = dto.mql ?? dto.metrics?.mql ?? 0;
    const sql = dto.sql ?? dto.metrics?.sql ?? 0;
    const opp = dto.opp ?? dto.metrics?.opp ?? 0;
    const closedDeal = dto.closedDeal ?? dto.metrics?.closed_deal ?? dto.metrics?.closedDeal ?? 0;
    const note = dto.note ?? dto.metrics?.note ?? null;

    const record = await (this.prisma as any).projectDailyActual.upsert({
      where: {
        projectId_actualDate: {
          projectId: project.id,
          actualDate,
        },
      },
      create: {
        projectId: project.id,
        actualDate,
        rawLeads,
        mql,
        sql,
        opp,
        closedDeal,
        note,
        createdById: validUserId,
      },
      update: {
        rawLeads,
        mql,
        sql,
        opp,
        closedDeal,
        ...(note !== undefined ? { note } : {}),
        archivedAt: null,
        updatedAt: new Date(),
      },
    });

    // Automatically sync weekly rollup to KpiDistribution and Project cumulative actuals
    await this.syncDailyActualsToKpiDistribution(project.id, actualDate);

    const iso = this.getIsoWeek(actualDate);
    const formattedDate = record.actualDate
      ? record.actualDate.toISOString().slice(0, 10)
      : dateStr;

    return {
      id: record.id,
      actualId: record.id,
      projectId: record.projectId,
      project_id: record.projectId,
      actualDate: formattedDate,
      date: formattedDate,
      reporting_date: formattedDate,
      rawLeads: record.rawLeads,
      mql: record.mql,
      sql: record.sql,
      opp: record.opp,
      closedDeal: record.closedDeal,
      note: record.note,
      data: {
        rawLeads: record.rawLeads,
        mql: record.mql,
        sql: record.sql,
        opp: record.opp,
        closedDeal: record.closedDeal,
        note: record.note,
      },
      metrics: {
        raw_leads: record.rawLeads,
        mql: record.mql,
        sql: record.sql,
        opp: record.opp,
        closed_deal: record.closedDeal,
      },
      isoWeek: `${iso.year}-W${String(iso.week).padStart(2, '0')}`,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async updateDailyActualById(
    projectId: string,
    actualId: string,
    dto: UpdateDailyActualByIdDto,
    userId?: string,
  ) {
    const cleanProjectId = (projectId || '').trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanProjectId },
          { name: cleanProjectId },
        ],
        archivedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const record = await (this.prisma as any).projectDailyActual.findFirst({
      where: { id: actualId, projectId: project.id, archivedAt: null },
    });
    if (!record) {
      throw new NotFoundException(`Không tìm thấy bản ghi actual với ID: ${actualId}`);
    }

    const rawLeads = dto.rawLeads ?? dto.metrics?.raw_leads ?? dto.metrics?.rawLeads;
    const mql = dto.mql ?? dto.metrics?.mql;
    const sql = dto.sql ?? dto.metrics?.sql;
    const opp = dto.opp ?? dto.metrics?.opp;
    const closedDeal = dto.closedDeal ?? dto.metrics?.closed_deal ?? dto.metrics?.closedDeal;
    const note = dto.note ?? dto.metrics?.note;

    const updated = await (this.prisma as any).projectDailyActual.update({
      where: { id: actualId },
      data: {
        ...(rawLeads !== undefined ? { rawLeads } : {}),
        ...(mql !== undefined ? { mql } : {}),
        ...(sql !== undefined ? { sql } : {}),
        ...(opp !== undefined ? { opp } : {}),
        ...(closedDeal !== undefined ? { closedDeal } : {}),
        ...(note !== undefined ? { note } : {}),
        updatedAt: new Date(),
      },
    });

    // Automatically sync weekly rollup to KpiDistribution and Project cumulative actuals
    await this.syncDailyActualsToKpiDistribution(project.id, updated.actualDate);

    const iso = this.getIsoWeek(updated.actualDate);
    const formattedDate = updated.actualDate.toISOString().slice(0, 10);

    return {
      id: updated.id,
      actualId: updated.id,
      projectId: updated.projectId,
      project_id: updated.projectId,
      actualDate: formattedDate,
      date: formattedDate,
      rawLeads: updated.rawLeads,
      mql: updated.mql,
      sql: updated.sql,
      opp: updated.opp,
      closedDeal: updated.closedDeal,
      note: updated.note,
      data: {
        rawLeads: updated.rawLeads,
        mql: updated.mql,
        sql: updated.sql,
        opp: updated.opp,
        closedDeal: updated.closedDeal,
        note: updated.note,
      },
      metrics: {
        raw_leads: updated.rawLeads,
        mql: updated.mql,
        sql: updated.sql,
        opp: updated.opp,
        closed_deal: updated.closedDeal,
      },
      isoWeek: `${iso.year}-W${String(iso.week).padStart(2, '0')}`,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteDailyActualById(projectId: string, actualId: string) {
    const cleanProjectId = (projectId || '').trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanProjectId },
          { name: cleanProjectId },
        ],
        archivedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const record = await (this.prisma as any).projectDailyActual.findFirst({
      where: { id: actualId, projectId: project.id, archivedAt: null },
    });
    if (!record) {
      throw new NotFoundException(`Không tìm thấy bản ghi actual với ID: ${actualId}`);
    }

    await (this.prisma as any).projectDailyActual.update({
      where: { id: actualId },
      data: { archivedAt: new Date() },
    });

    // Re-rollup to KpiDistribution and Project cumulative actuals
    await this.syncDailyActualsToKpiDistribution(project.id, record.actualDate);

    return {
      message: 'Xóa bản ghi actual thành công',
      id: actualId,
      projectId: project.id,
    };
  }

  async getDailyActualsList(query: QueryDailyActualDto) {
    const where: any = { archivedAt: null };

    if (query.projectId) {
      where.projectId = query.projectId;
    } else {
      where.project = { archivedAt: null };
    }

    if (query.date) {
      where.actualDate = new Date(query.date);
    } else if (query.fromDate || query.toDate) {
      where.actualDate = {};
      if (query.fromDate) {
        where.actualDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.actualDate.lte = new Date(query.toDate);
      }
    }

    const records = await (this.prisma as any).projectDailyActual.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ actualDate: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map((r: any) => {
      const iso = this.getIsoWeek(r.actualDate);
      return {
        id: r.id,
        actualId: r.id,
        projectId: r.projectId,
        projectName: r.project?.name ?? null,
        actualDate: r.actualDate.toISOString().slice(0, 10),
        rawLeads: r.rawLeads,
        mql: r.mql,
        sql: r.sql,
        opp: r.opp,
        closedDeal: r.closedDeal,
        note: r.note,
        isoWeek: `${iso.year}-W${String(iso.week).padStart(2, '0')}`,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  async getProjectKpiProgress(projectId: string, year: number = 2026) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // Both reads are independent; run them concurrently, keeping each one's
    // original error handling.
    const [recordsResult, oppsResult] = await Promise.all([
      this.settle(() =>
        (this.prisma as any).projectDailyActual.findMany({
          where: {
            projectId,
            actualDate: { gte: startOfYear, lte: endOfYear },
            archivedAt: null,
          },
        }),
      ),
      this.settle(() =>
        this.prisma.opportunity.findMany({
          where: {
            projectId,
            year,
            archivedAt: null,
          },
          select: { setupFee: true, monthlyFee: true },
        }),
      ),
    ]);

    let records: any[] = [];
    if (recordsResult.failed) {
      console.warn('Query projectDailyActual in getProjectKpiProgress failed:', recordsResult.error);
    } else {
      records = recordsResult.value as any[];
    }

    const actualCumulative = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
      pipelineValue: 0,
    };

    for (const r of records) {
      actualCumulative.rawLeads += r.rawLeads || 0;
      actualCumulative.mql += r.mql || 0;
      actualCumulative.sql += r.sql || 0;
      actualCumulative.opp += r.opp || 0;
      actualCumulative.closedDeal += r.closedDeal || 0;
    }

    // Accumulate pipelineValue from Opportunity
    try {
      if (oppsResult.failed) throw oppsResult.error;
      const opps = oppsResult.value!;
      for (const o of opps) {
        actualCumulative.pipelineValue +=
          Number(o.setupFee || 0) + Number(o.monthlyFee || 0);
      }
    } catch (err) {
      console.warn('Query opportunities failed:', err);
    }

    const plan = {
      rawLeads: project.kpiRawLeadsPlan ? Number(project.kpiRawLeadsPlan) : 0,
      mql: project.kpiMqlPlan ? Number(project.kpiMqlPlan) : 0,
      sql: project.kpiSqlPlan ? Number(project.kpiSqlPlan) : 0,
      opp: project.kpiOppPlan ? Number(project.kpiOppPlan) : 0,
      closedDeal: project.kpiClosedDealPlan ? Number(project.kpiClosedDealPlan) : 0,
      pipelineValue: project.kpiPipelineValuePlan ? Number(project.kpiPipelineValuePlan) : 0,
    };

    const calcCompletion = (act: number, pl: number) => {
      if (pl <= 0) return null;
      return Number(((act / pl) * 100).toFixed(2));
    };

    const completionRate = {
      rawLeads: calcCompletion(actualCumulative.rawLeads, plan.rawLeads),
      mql: calcCompletion(actualCumulative.mql, plan.mql),
      sql: calcCompletion(actualCumulative.sql, plan.sql),
      opp: calcCompletion(actualCumulative.opp, plan.opp),
      closedDeal: calcCompletion(actualCumulative.closedDeal, plan.closedDeal),
      pipelineValue: calcCompletion(actualCumulative.pipelineValue, plan.pipelineValue),
    };

    return {
      projectId: project.id,
      projectName: project.name,
      year,
      plan,
      actualCumulative,
      completionRate,
      progressPercentage: completionRate,
      recordsCount: records.length,
    };
  }

  async getWeeklyReportFromDaily(
    year: number,
    week: number,
    projectId?: string,
  ) {
    const where: any = { archivedAt: null };
    if (projectId) {
      where.projectId = projectId;
    } else {
      where.project = { archivedAt: null };
    }

    // Only rows around the requested ISO week can pass the exact ISO-week
    // filter below, so bound the scan to that window instead of loading every
    // daily row. The window is a strict superset (±2 days margin covers any
    // server-timezone shift in getIsoWeek), so the result is unchanged.
    const searchWindow = this.getIsoWeekSearchWindow(year, week);
    if (searchWindow) {
      where.actualDate = { gte: searchWindow.start, lt: searchWindow.end };
    }

    const records = await (this.prisma as any).projectDailyActual.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { actualDate: 'asc' },
    });

    // Filter by ISO week
    const matchingRecords = records.filter((r: any) => {
      const iso = this.getIsoWeek(r.actualDate);
      return iso.year === year && iso.week === week;
    });

    const total = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
    };

    for (const r of matchingRecords) {
      total.rawLeads += r.rawLeads;
      total.mql += r.mql;
      total.sql += r.sql;
      total.opp += r.opp;
      total.closedDeal += r.closedDeal;
    }

    return {
      year,
      week,
      isoWeek: `${year}-W${String(week).padStart(2, '0')}`,
      projectId: projectId || 'all',
      total,
      dailyRecords: matchingRecords.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        projectName: r.project?.name ?? null,
        actualDate: r.actualDate.toISOString().slice(0, 10),
        rawLeads: r.rawLeads,
        mql: r.mql,
        sql: r.sql,
        opp: r.opp,
        closedDeal: r.closedDeal,
        note: r.note,
      })),
    };
  }

  async getMonthlyReportFromDaily(
    year: number,
    month: number,
    projectId?: string,
  ) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const where: any = {
      actualDate: { gte: startOfMonth, lte: endOfMonth },
      archivedAt: null,
    };
    if (projectId) {
      where.projectId = projectId;
    } else {
      where.project = { archivedAt: null };
    }

    const records = await (this.prisma as any).projectDailyActual.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { actualDate: 'asc' },
    });

    const total = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      opp: 0,
      closedDeal: 0,
    };

    for (const r of records) {
      total.rawLeads += r.rawLeads;
      total.mql += r.mql;
      total.sql += r.sql;
      total.opp += r.opp;
      total.closedDeal += r.closedDeal;
    }

    return {
      year,
      month,
      projectId: projectId || 'all',
      total,
      dailyRecords: records.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        projectName: r.project?.name ?? null,
        actualDate: r.actualDate.toISOString().slice(0, 10),
        rawLeads: r.rawLeads,
        mql: r.mql,
        sql: r.sql,
        opp: r.opp,
        closedDeal: r.closedDeal,
        note: r.note,
      })),
    };
  }

  private normalizeSegmentForPipeline(size?: string | null): 'enterprise' | 'mid_market' | 'smb' {
    if (!size) return 'mid_market';
    const s = size.toLowerCase().trim();
    if (s === 's' || s === 'smb' || s === 'sme' || s === 'small' || s === 'startup') return 'smb';
    if (s === 'e' || s === 'enterprise' || s === 'large') return 'enterprise';
    return 'mid_market';
  }

  getPreviousPeriod(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ): {
    periodType: 'week' | 'month' | 'quarter' | 'year';
    periodValue: string;
    year: number;
  } {
    if (periodType === 'week') {
      const w = parseInt(periodValue || '1', 10);
      if (w > 1) {
        return { periodType: 'week', periodValue: String(w - 1), year };
      }
      return { periodType: 'week', periodValue: '52', year: year - 1 };
    }
    if (periodType === 'month') {
      const m = parseInt(periodValue || '1', 10);
      if (m > 1) {
        return { periodType: 'month', periodValue: String(m - 1), year };
      }
      return { periodType: 'month', periodValue: '12', year: year - 1 };
    }
    if (periodType === 'quarter') {
      const q = parseInt(periodValue || '1', 10);
      if (q > 1) {
        return { periodType: 'quarter', periodValue: String(q - 1), year };
      }
      return { periodType: 'quarter', periodValue: '4', year: year - 1 };
    }
    return { periodType: 'year', periodValue: '1', year: year - 1 };
  }

  async getPipelineBySegmentData(
    periodType: 'week' | 'month' | 'quarter' | 'year' = 'year',
    periodValue: string = '1',
    year: number = new Date().getFullYear(),
    projectId?: string,
  ) {
    if (projectId) {
      const cleanProjectId = projectId.trim();
      const project = await this.prisma.project.findFirst({
        where: {
          OR: [
            { id: cleanProjectId },
            { name: cleanProjectId },
          ],
          archivedAt: null,
        },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
      projectId = project.id;
    }

    const currRange = this.getPeriodDateRange(periodType, periodValue, year);
    const prev = this.getPreviousPeriod(periodType, periodValue, year);
    const prevRange = this.getPeriodDateRange(
      prev.periodType,
      prev.periodValue,
      prev.year,
    );

    const currWhere: any = {
      status: 'active',
      archivedAt: null,
      createdAt: { lte: currRange.endDate },
    };
    const prevWhere: any = {
      status: 'active',
      archivedAt: null,
      createdAt: { lte: prevRange.endDate },
    };

    if (projectId) {
      currWhere.projectId = projectId;
      prevWhere.projectId = projectId;
    } else {
      currWhere.OR = [
        { projectId: null },
        { project: { archivedAt: null, status: { not: 'Cancelled' } } },
      ];
      prevWhere.OR = [
        { projectId: null },
        { project: { archivedAt: null, status: { not: 'Cancelled' } } },
      ];
    }

    const [currOpps, prevOpps] = await Promise.all([
      this.prisma.opportunity.findMany({
        where: currWhere,
      }),
      this.prisma.opportunity.findMany({
        where: prevWhere,
      }),
    ]);

    const segments: Array<'enterprise' | 'mid_market' | 'smb'> = [
      'enterprise',
      'mid_market',
      'smb',
    ];

    const data = segments.map((seg) => {
      const segCurrOpps = currOpps.filter(
        (o) => this.normalizeSegmentForPipeline(o.size) === seg,
      );
      const segPrevOpps = prevOpps.filter(
        (o) => this.normalizeSegmentForPipeline(o.size) === seg,
      );

      const openDeals = segCurrOpps.length;
      const value = segCurrOpps.reduce(
        (sum, o) => sum + Number(o.setupFee) + Number(o.monthlyFee),
        0,
      );
      const prevValue = segPrevOpps.reduce(
        (sum, o) => sum + Number(o.setupFee) + Number(o.monthlyFee),
        0,
      );

      let growthPct = 0;
      if (prevValue > 0) {
        growthPct = Number(
          (((value - prevValue) / prevValue) * 100).toFixed(1),
        );
      } else if (value > 0) {
        growthPct = 100;
      }

      return {
        segment: seg,
        openDeals,
        value,
        growthPct,
      };
    });

    return { data };
  }
}
