import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday, getIsoWeekAndYear } from '../../common/utils/date.util';
import {
  getDealPeriodDate,
  loadLatestExpenseSnapshots,
  resolveLeadSourceProjectIds,
  toExpenseCostEntries,
} from '../expense/expense-snapshot.util';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    yearStr: string,
    projectId?: string,
  ) {
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      throw new BadRequestException('Năm (year) không hợp lệ.');
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    // Alerts are independent reads, so they run alongside the other widgets
    const [alerts, kpiCards, funnel, activities, progress, taskStatus] =
      await Promise.all([
        this.getAlertsData(),
        this.getKpiCardsData(periodType, periodValue, year, projectId),
        this.getFunnelData(periodType, periodValue, year, projectId),
        this.getActivitiesData(periodType, periodValue, year, projectId),
        this.getProgressData(periodType, periodValue, year, projectId),
        this.getTaskStatusData(periodType, periodValue, year, projectId),
      ]);
    const topbar = {
      periodLabel: this.getPeriodLabel(periodType, periodValue, year),
      overdueCount: alerts.overdue.length,
      upcomingCount: alerts.upcoming.length,
    };

    return {
      success: true,
      data: {
        topbar,
        kpiCards,
        funnel,
        activities,
        progress,
        taskStatus,
        alerts,
        syncStatus: {
          status: 'synced',
          syncedAt: new Date().toISOString(),
        },
      },
    };
  }

  getWeeksInMonth(year: number, month: number): number[] {
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

  getWeeksInQuarter(year: number, quarter: number): number[] {
    const startMonth = (quarter - 1) * 3 + 1;
    const weeks: number[] = [];
    for (let m = startMonth; m < startMonth + 3; m++) {
      weeks.push(...this.getWeeksInMonth(year, m));
    }
    return weeks;
  }

  getWeeksInYear(year: number): number[] {
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

  private getWeekNumbers(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ): number[] {
    if (periodType === 'week') {
      if (!periodValue) {
        throw new BadRequestException(
          'Thiếu period_value cho period_type = week.',
        );
      }
      const val = parseInt(periodValue, 10);
      if (isNaN(val) || val < 1 || val > 53) {
        throw new BadRequestException(
          'Tuần (period_value) không hợp lệ (1-53).',
        );
      }
      return [val];
    } else if (periodType === 'month') {
      if (!periodValue) {
        throw new BadRequestException(
          'Thiếu period_value cho period_type = month.',
        );
      }
      const val = parseInt(periodValue, 10);
      if (isNaN(val) || val < 1 || val > 12) {
        throw new BadRequestException(
          'Tháng (period_value) không hợp lệ (1-12).',
        );
      }
      return this.getWeeksInMonth(year, val);
    } else if (periodType === 'quarter') {
      if (!periodValue) {
        throw new BadRequestException(
          'Thiếu period_value cho period_type = quarter.',
        );
      }
      const val = parseInt(periodValue, 10);
      if (isNaN(val) || val < 1 || val > 4) {
        throw new BadRequestException('Quý (period_value) không hợp lệ (1-4).');
      }
      return this.getWeeksInQuarter(year, val);
    } else if (periodType === 'year') {
      return this.getWeeksInYear(year);
    } else {
      throw new BadRequestException('period_type không hợp lệ.');
    }
  }

  getPeriodLabel(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ): string {
    if (periodType === 'week') {
      const w = parseInt(periodValue || '1', 10);
      const thursday = this.getThursdayOfWeek(year, w);
      const month = thursday.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      return `Tuần ${w} · Tháng ${month}/${year} · Q${quarter}/${year}`;
    } else if (periodType === 'month') {
      const m = parseInt(periodValue || '1', 10);
      const quarter = Math.ceil(m / 3);
      return `Tháng ${m}/${year} · Q${quarter}/${year}`;
    } else if (periodType === 'quarter') {
      const q = parseInt(periodValue || '1', 10);
      return `Quý ${q}/${year}`;
    } else {
      return `Năm ${year}`;
    }
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

  async getAlertsData() {
    const today = startOfBusinessToday();
    // Only the fields mapped below are loaded
    const alertTaskSelect = {
      id: true,
      name: true,
      dueDate: true,
      assignee: { select: { name: true } },
    } as const;

    // Upcoming: dueDate >= today AND dueDate <= today + 5 days AND status NOT IN ('Done', 'Cancel')
    const sixDaysLater = new Date(today);
    sixDaysLater.setUTCDate(today.getUTCDate() + 6);

    const [overdueTasks, upcomingTasks] = await Promise.all([
      // Overdue: dueDate < today AND status NOT IN ('Done', 'Cancel')
      this.prisma.task.findMany({
        where: {
          archivedAt: null,
          dueDate: { lt: today },
          status: { notIn: ['Done', 'Cancel'] },
        },
        select: alertTaskSelect,
        orderBy: {
          dueDate: 'asc',
        },
      }),
      this.prisma.task.findMany({
        where: {
          archivedAt: null,
          dueDate: {
            gte: today,
            lt: sixDaysLater,
          },
          status: { notIn: ['Done', 'Cancel'] },
        },
        select: alertTaskSelect,
        orderBy: {
          dueDate: 'asc',
        },
      }),
    ]);

    const overdue = overdueTasks.map((t) => {
      const diffTime = today.getTime() - t.dueDate.getTime();
      const overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        taskId: t.id,
        taskName: t.name,
        assigneeName: t.assignee?.name || 'Chưa phân công',
        overdueDays,
        dueDate: t.dueDate.toISOString().split('T')[0],
      };
    });

    const upcoming = upcomingTasks.map((t) => {
      const diffTime = t.dueDate.getTime() - today.getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        taskId: t.id,
        taskName: t.name,
        assigneeName: t.assignee?.name || 'Chưa phân công',
        remainingDays,
        dueDate: t.dueDate.toISOString().split('T')[0],
      };
    });

    return { overdue, upcoming };
  }

  // Identical concurrent calls (kpi-cards + funnel, or overview which calls both)
  // share one in-flight computation instead of hitting the DB twice.
  private readonly kpiCardsInFlight = new Map<string, Promise<any[]>>();

  getKpiCardsData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ): Promise<any[]> {
    const key = `${periodType}|${periodValue ?? ''}|${year}|${projectId ?? ''}`;
    const pending = this.kpiCardsInFlight.get(key);
    if (pending) return pending;

    const promise = this.computeKpiCardsData(
      periodType,
      periodValue,
      year,
      projectId,
    ).finally(() => this.kpiCardsInFlight.delete(key));
    this.kpiCardsInFlight.set(key, promise);
    return promise;
  }

  private async computeKpiCardsData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

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

    const dateRange = this.getPeriodDateRange(periodType, periodValue, year);

    const actual = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };
    const plan = {
      rawLeads: 0,
      mql: 0,
      sql: 0,
      oppCount: 0,
      closedCount: 0,
      pipelineValue: 0,
      wonValue: 0,
    };

    // Same project scope as GET /leads-kpis/reports/weekly: the project, or every non-archived one
    const dailyScope: any = projectId
      ? { projectId }
      : { project: { archivedAt: null } };

    let actuals: any[] = [];
    if (periodType === 'week') {
      const targetWeek = parseInt(periodValue || '1', 10);
      try {
        if ((this.prisma as any).projectDailyActual?.findMany) {
          const dailyActuals = await (this.prisma as any).projectDailyActual.findMany({
            where: {
              ...dailyScope,
              actualDate: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
              archivedAt: null,
            },
          });

          for (const d of dailyActuals) {
            const iso = getIsoWeekAndYear(d.actualDate);
            if (iso.year === year && iso.week === targetWeek) {
              actual.rawLeads += d.rawLeads || 0;
              actual.mql += d.mql || 0;
              actual.sql += d.sql || 0;
              actual.oppCount += d.opp || 0;
              actual.closedCount += d.closedDeal || 0;
            }
          }
        }
      } catch (err) {
        console.warn('Query dailyActuals for week in getKpiCardsData failed:', err);
      }
    } else {
      if (projectId) {
        const distRecords = await this.prisma.kpiDistribution.findMany({
          where: {
            year,
            week: { in: weekNumbers },
            projectId,
            type: 'actual',
          },
        });
        for (const dist of distRecords) {
          actual.rawLeads += dist.rawLeads;
          actual.mql += dist.mql;
          actual.sql += dist.sql;
        }
      } else {
        const distRecords = await this.prisma.kpiDistribution.findMany({
          where: {
            year,
            week: { in: weekNumbers },
            projectId: { in: activeProjectIds },
            type: 'actual',
          },
        });
        for (const dist of distRecords) {
          actual.rawLeads += dist.rawLeads;
          actual.mql += dist.mql;
          actual.sql += dist.sql;
        }
      }

      // Also include ProjectDailyActual within period to guarantee live visibility
      try {
        const dailyActuals = await (this.prisma as any).projectDailyActual.findMany({
          where: {
            ...dailyScope,
            actualDate: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
            archivedAt: null,
          },
        });

        let dailySumRawLeads = 0;
        let dailySumMql = 0;
        let dailySumSql = 0;
        let dailySumOpp = 0;
        let dailySumClosedDeal = 0;

        for (const d of dailyActuals) {
          dailySumRawLeads += d.rawLeads || 0;
          dailySumMql += d.mql || 0;
          dailySumSql += d.sql || 0;
          dailySumOpp += d.opp || 0;
          dailySumClosedDeal += d.closedDeal || 0;
        }

        // Daily actuals are the source of truth for leads (BE_requirement_22_09_26 §2.1):
        // week-level rows are only a fallback when daily actuals cannot be read
        actual.rawLeads = dailySumRawLeads;
        actual.mql = dailySumMql;
        actual.sql = dailySumSql;
        actual.oppCount = Math.max(actual.oppCount, dailySumOpp);
        actual.closedCount = Math.max(actual.closedCount, dailySumClosedDeal);
      } catch (err) {
        console.warn('Query dailyActuals for KPI cards failed:', err);
      }
    }

    // Auto-count Closed Deals by closedDate within period (+ setupFee as revenue)
    const dealWhere: any = {
      closedDate: { gte: dateRange.startDate, lte: dateRange.endDate },
      archivedAt: null,
    };
    if (projectId) {
      dealWhere.projectId = projectId;
    } else {
      dealWhere.OR = [
        { projectId: { in: activeProjectIds } },
        { projectId: null },
      ];
    }
    const oppsWhere: any = {
      status: 'active',
      archivedAt: null,
      AND: [
        this.getOpportunityPeriodCondition(dateRange),
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

    // CAC / ROAS inputs (BE_requirement_29_09_26 §4, rules of BE_requirement_26_09_26 §2–3):
    // won deals of the whole system (or of the selected project), counted in the period of the
    // source opportunity start date, and the latest expense snapshots (before VAT)
    const wonScopeWhere: any = projectId
      ? { archivedAt: null, projectId }
      : { archivedAt: null };

    // Independent queries run in parallel instead of one round-trip after another
    const [deals, opps, snapshotSet, wonScopeDeals, churnRate, grossMargin] = await Promise.all([
      this.prisma.closedDeal.findMany({
        where: dealWhere,
        select: { setupFee: true, monthlyFee: true },
      }),
      this.prisma.opportunity.findMany({
        where: oppsWhere,
        select: { setupFee: true, monthlyFee: true },
      }),
      loadLatestExpenseSnapshots(this.prisma, { projectId }),
      this.prisma.closedDeal.findMany({
        where: wonScopeWhere,
        select: {
          projectId: true,
          setupFee: true,
          monthlyFee: true,
          closedDate: true,
          initiationDate: true,
          opportunity: { select: { initiationDate: true } },
        },
      }),
      this.getSystemConfigValue('churn_rate', periodType, periodValue, year),
      this.getSystemConfigValue('gross_margin', periodType, periodValue, year),
    ]);

    actual.closedCount = deals.length;
    for (const d of deals) {
      actual.wonValue += Number(d.setupFee);
    }

    // Auto-count OPPs by initiationDate (fallback to createdAt) within period
    actual.oppCount = opps.length;
    for (const o of opps) {
      actual.pipelineValue += Number(o.setupFee) + Number(o.monthlyFee);
    }

    if (projectId) {
      const planDistRecords = await this.prisma.kpiDistribution.findMany({
        where: {
          year,
          week: { in: weekNumbers },
          projectId,
          type: 'plan',
        },
      });

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
      } else {
        const proj = await this.prisma.project.findUnique({
          where: { id: projectId },
        });
        const factor = weekNumbers.length / 52;
        if (
          proj &&
          (proj.kpiRawLeadsPlan !== null ||
            proj.kpiMqlPlan !== null ||
            proj.kpiSqlPlan !== null ||
            proj.kpiOppPlan !== null ||
            proj.kpiClosedDealPlan !== null ||
            proj.kpiPipelineValuePlan !== null)
        ) {
          plan.rawLeads = Math.round(Number(proj.kpiRawLeadsPlan || 0) * factor);
          plan.mql = Math.round(Number(proj.kpiMqlPlan || 0) * factor);
          plan.sql = Math.round(Number(proj.kpiSqlPlan || 0) * factor);
          plan.oppCount = Math.round(Number(proj.kpiOppPlan || 0) * factor);
          plan.closedCount = Math.round(Number(proj.kpiClosedDealPlan || 0) * factor);
          plan.pipelineValue = Number(proj.kpiPipelineValuePlan || 0) * factor;
        } else {
          const kpiPlan = await this.prisma.kpiPlan.findFirst({ where: { year } });
          if (kpiPlan) {
            plan.rawLeads = Math.round(Number(kpiPlan.totalRawLeads) * factor);
            plan.mql = Math.round(Number(kpiPlan.targetMql) * factor);
            plan.sql = Math.round(Number(kpiPlan.targetSql) * factor);
            plan.oppCount = Math.round(Number(kpiPlan.targetOpp) * factor);
            plan.closedCount = Math.round(Number(kpiPlan.targetClosedDeal) * factor);
            plan.pipelineValue = Number(kpiPlan.targetPipelineVal) * factor;
            plan.wonValue = Number(kpiPlan.targetWonVal) * factor;
          }
        }
      }
    } else {
      const kpiPlan =
        (await this.prisma.kpiPlan.findFirst({
          where: { year },
        })) || (await this.prisma.kpiPlan.findFirst());

      if (kpiPlan) {
        const factor = weekNumbers.length / 52;
        plan.rawLeads = Math.round(Number(kpiPlan.totalRawLeads) * factor);
        plan.mql = Math.round(Number(kpiPlan.targetMql) * factor);
        plan.sql = Math.round(Number(kpiPlan.targetSql) * factor);
        plan.oppCount = Math.round(Number(kpiPlan.targetOpp) * factor);
        plan.closedCount = Math.round(Number(kpiPlan.targetClosedDeal) * factor);
        plan.pipelineValue = Number(kpiPlan.targetPipelineVal) * factor;
        plan.wonValue = Number(kpiPlan.targetWonVal) * factor;
      } else {
        for (const a of actuals) {
          plan.rawLeads += a.planRawLeads;
          plan.mql += a.planMql;
          plan.sql += a.planSql;
          plan.oppCount += a.planOpp;
          plan.closedCount += a.planClosedDeal;
        }
      }
    }

    const calcPercentVsPlan = (act: number, pl: number) => {
      if (!pl) return 0;
      return Number(((act / pl) * 100).toFixed(1));
    };

    // CAC / LTV / ROAS (§2): Chi phí lead = actual cost (before VAT) of lead-source projects,
    // or of the selected project; won deals by opportunity start date
    const leadProjectIds = projectId
      ? new Set<string>([projectId])
      : new Set<string>(
          (await resolveLeadSourceProjectIds(this.prisma, wonScopeDeals)).ids,
        );
    // Each line counts on its own expense date (exact day, so week / quarter filters are exact)
    const periodStart = dateRange.startDate.toISOString().slice(0, 10);
    const periodEnd = dateRange.endDate.toISOString().slice(0, 10);
    let totalCost = 0;
    for (const e of toExpenseCostEntries(snapshotSet)) {
      if (!e.date || e.date < periodStart || e.date > periodEnd) continue;
      if (leadProjectIds.has(e.projectId)) {
        totalCost += e.actualBeforeVat;
      }
    }

    const wonDeals = wonScopeDeals.filter((d) => {
      const dt = getDealPeriodDate(d);
      return !!dt && dt >= dateRange.startDate && dt <= dateRange.endDate;
    });
    const closedDealsCount = wonDeals.length;
    const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.setupFee), 0);

    const cac =
      closedDealsCount > 0
        ? Number((totalCost / closedDealsCount).toFixed(0))
        : 0;

    const avgSetupFee =
      closedDealsCount > 0 ? wonValue / closedDealsCount : 0;
    const avgMonthlyFee =
      closedDealsCount > 0
        ? wonDeals.reduce((sum, d) => sum + Number(d.monthlyFee), 0) /
          closedDealsCount
        : 0;

    const churnDecimal = churnRate / 100;
    const marginDecimal = grossMargin / 100;
    const ltv =
      churnDecimal > 0
        ? Number(
            (
              (avgSetupFee + avgMonthlyFee * (1 / churnDecimal)) *
              marginDecimal
            ).toFixed(0),
          )
        : 0;

    const ratio = cac > 0 ? Number((ltv / cac).toFixed(1)) : 0;

    let health = 'gray';
    if (ratio > 0) {
      if (ratio < 1.5) health = 'red';
      else if (ratio < 2.5) health = 'yellow';
      else if (ratio <= 4.0) health = 'green';
      else health = 'blue';
    }

    const roas =
      totalCost > 0 ? Number((wonValue / totalCost).toFixed(2)) : 0;
    const roa = roas;
    const cpmql =
      actual.mql > 0 ? Number((totalCost / actual.mql).toFixed(0)) : 0;
    const cpsql =
      actual.sql > 0 ? Number((totalCost / actual.sql).toFixed(0)) : 0;

    const isRawLeadsHidden = false;

    const cards = [
      {
        label: 'Raw Leads',
        color: 'blue',
        actual: actual.rawLeads,
        plan: plan.rawLeads,
        percentVsPlan: calcPercentVsPlan(actual.rawLeads, plan.rawLeads),
        ratio: calcPercentVsPlan(actual.rawLeads, plan.rawLeads),
        convPct: null,
        hidden: false,
        isHidden: false,
      },
      {
        label: 'MQL',
        color: 'yellow',
        actual: actual.mql,
        plan: plan.mql,
        percentVsPlan: calcPercentVsPlan(actual.mql, plan.mql),
        ratio: calcPercentVsPlan(actual.mql, plan.mql),
        convPct:
          actual.rawLeads > 0
            ? Number(((actual.mql / actual.rawLeads) * 100).toFixed(1))
            : null,
        hidden: false,
        isHidden: false,
      },
      {
        label: 'SQL',
        color: 'orange',
        actual: actual.sql,
        plan: plan.sql,
        percentVsPlan: calcPercentVsPlan(actual.sql, plan.sql),
        ratio: calcPercentVsPlan(actual.sql, plan.sql),
        convPct:
          actual.mql > 0
            ? Number(((actual.sql / actual.mql) * 100).toFixed(1))
            : null,
        hidden: false,
        isHidden: false,
      },
      {
        label: 'OPP',
        color: 'purple-light',
        actual: actual.oppCount,
        plan: plan.oppCount,
        percentVsPlan: calcPercentVsPlan(actual.oppCount, plan.oppCount),
        ratio: calcPercentVsPlan(actual.oppCount, plan.oppCount),
        convPct:
          actual.sql > 0
            ? Number(((actual.oppCount / actual.sql) * 100).toFixed(1))
            : null,
        hidden: false,
        isHidden: false,
      },
      {
        label: 'Closed Deal',
        color: 'green',
        actual: actual.closedCount,
        plan: plan.closedCount,
        percentVsPlan: calcPercentVsPlan(actual.closedCount, plan.closedCount),
        ratio: calcPercentVsPlan(actual.closedCount, plan.closedCount),
        convPct:
          actual.oppCount > 0
            ? Number(((actual.closedCount / actual.oppCount) * 100).toFixed(1))
            : null,
        hidden: false,
        isHidden: false,
      },
      {
        label: 'Pipeline Value',
        color: 'purple',
        actual: actual.pipelineValue,
        plan: plan.pipelineValue,
        percentVsPlan: calcPercentVsPlan(
          actual.pipelineValue,
          plan.pipelineValue,
        ),
        ratio: calcPercentVsPlan(
          actual.pipelineValue,
          plan.pipelineValue,
        ),
        convPct: null,
        hidden: false,
        isHidden: false,
      },
      {
        // ROAS = won deal value / lead cost (§2); there is no plan for it (§9.3)
        label: 'ROAS',
        color: 'gray',
        roa,
        roas,
        cac,
        ltv,
        ratio: roa,
        leadCost: totalCost,
        totalCost,
        totalExpense: totalCost,
        wonValue,
        wonCount: closedDealsCount,
        numerator: wonValue,
        denominator: totalCost,
        cpmql,
        cpsql,
        actual: roa,
        plan: 0,
        percentVsPlan: null,
        health,
        hidden: false,
        isHidden: false,
      },
      {
        // CAC = lead cost / won deals (§4); null when the period has no won deal
        label: 'CAC',
        color: 'gray',
        cac: closedDealsCount > 0 ? cac : null,
        leadCost: totalCost,
        totalCost,
        wonCount: closedDealsCount,
        wonValue,
        numerator: totalCost,
        denominator: closedDealsCount,
        ltv,
        ratio,
        health,
        costScope: projectId ? 'project' : 'lead_source',
        actual: closedDealsCount > 0 ? cac : null,
        plan: 0,
        percentVsPlan: null,
        hidden: false,
        isHidden: false,
      },
    ];

    return cards;
  }

  private async getSystemConfigValue(
    key: string,
    periodType: string,
    periodValue: string | undefined,
    year: number,
  ): Promise<number> {
    const pVal = periodValue ? parseInt(periodValue, 10) : null;
    let config = await this.prisma.systemConfig.findFirst({
      where: {
        key,
        year,
        periodType,
        periodValue: pVal !== null ? pVal : undefined,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!config && periodType !== 'year') {
      config = await this.prisma.systemConfig.findFirst({
        where: {
          key,
          year,
          periodType: 'year',
        },
        orderBy: { effectiveFrom: 'desc' },
      });
    }

    if (!config) {
      config = await this.prisma.systemConfig.findFirst({
        where: { key },
        orderBy: { effectiveFrom: 'desc' },
      });
    }

    return config ? Number(config.value) : key === 'churn_rate' ? 2.0 : 60.0;
  }

  private emptyKpiCards() {
    return [
      {
        label: 'Raw Leads',
        color: 'blue',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'MQL',
        color: 'yellow',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'SQL',
        color: 'orange',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'OPP',
        color: 'purple-light',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'Closed Deal',
        color: 'green',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'Pipeline Value',
        color: 'purple',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        ratio: 0,
        convPct: null,
      },
      {
        label: 'ROAS',
        color: 'gray',
        roa: 0,
        roas: 0,
        cac: 0,
        ltv: 0,
        ratio: 0,
        totalCost: 0,
        totalExpense: 0,
        wonValue: 0,
        numerator: 0,
        denominator: 0,
        cpmql: 0,
        cpsql: 0,
        actual: 0,
        plan: 0,
        percentVsPlan: null,
        health: 'gray',
        hidden: false,
        isHidden: false,
      },
      {
        label: 'CAC',
        color: 'gray',
        cac: null,
        leadCost: 0,
        totalCost: 0,
        wonCount: 0,
        wonValue: 0,
        numerator: 0,
        denominator: 0,
        ltv: 0,
        ratio: 0,
        health: 'gray',
        actual: null,
        plan: 0,
        percentVsPlan: null,
        hidden: false,
        isHidden: false,
      },
    ];
  }

  async getFunnelData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    const cards = await this.getKpiCardsData(periodType, periodValue, year, projectId);
    const funnelSteps = ['Raw Leads', 'MQL', 'SQL', 'OPP', 'Closed Deal'];
    return cards
      .filter((c: any) => funnelSteps.includes(c.label))
      .map((c: any) => ({
        step: c.label,
        actual: c.actual,
        plan: c.plan,
        convPct: c.convPct,
        percentVsPlan: c.percentVsPlan,
        hidden: c.hidden ?? false,
        isHidden: c.isHidden ?? false,
        widthPct:
          Number(cards[0]?.actual) > 0
            ? Number(((c.actual / Number(cards[0].actual)) * 100).toFixed(1))
            : 0,
      }));
  }

  async getActivitiesData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    // Get active projects
    const projectWhere: any = { archivedAt: null, status: { not: 'Cancelled' } };
    if (projectId) {
      projectWhere.id = projectId;
    }
    const activeProjects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, type: true },
    });

    if (activeProjects.length === 0) {
      return [];
    }

    if (projectId) {
      const [distActuals, distPlans] = await Promise.all([
        this.prisma.kpiDistribution.findMany({
          where: {
            year,
            week: { in: weekNumbers },
            projectId,
            type: 'actual',
          },
          select: { rawLeads: true },
        }),
        this.prisma.kpiDistribution.findMany({
          where: {
            year,
            week: { in: weekNumbers },
            projectId,
            type: 'plan',
          },
          select: { rawLeads: true },
        }),
      ]);
      const totalActualLeads = distActuals.reduce((sum, a) => sum + a.rawLeads, 0);
      const totalPlanLeads = distPlans.reduce((sum, a) => sum + a.rawLeads, 0);

      return activeProjects.map((p) => ({
        type: p.type,
        plan: totalPlanLeads,
        actual: totalActualLeads,
      }));
    }

    const activeProjIds = activeProjects.map((p) => p.id);
    const [distActuals, distPlans] = await Promise.all([
      this.prisma.kpiDistribution.findMany({
        where: {
          year,
          week: { in: weekNumbers },
          projectId: { in: activeProjIds },
          type: 'actual',
        },
        select: { rawLeads: true },
      }),
      this.prisma.kpiDistribution.findMany({
        where: {
          year,
          week: { in: weekNumbers },
          projectId: { in: activeProjIds },
          type: 'plan',
        },
        select: { rawLeads: true },
      }),
    ]);
    const totalActualLeads = distActuals.reduce((sum, a) => sum + a.rawLeads, 0);
    const totalPlanLeads = distPlans.reduce((sum, a) => sum + a.rawLeads, 0);

    const typeCount = new Map<string, number>();
    for (const p of activeProjects) {
      typeCount.set(p.type, (typeCount.get(p.type) || 0) + 1);
    }

    const result = [];
    for (const [type, count] of typeCount.entries()) {
      const ratio = count / activeProjects.length;
      result.push({
        type,
        plan: Math.round(totalPlanLeads * ratio),
        actual: Math.round(totalActualLeads * ratio),
      });
    }

    return result;
  }

  async getProgressData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    // Get active projects
    const projectWhere: any = { status: { not: 'Cancelled' }, archivedAt: null };
    if (projectId) {
      projectWhere.id = projectId;
    }
    const activeProjects = await this.prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true },
    });

    if (activeProjects.length === 0) {
      return { totalPct: 0, projects: [] };
    }

    const projectProgresses: {
      id: string;
      name: string;
      progressPct: number;
      color: string;
    }[] = [];
    let totalProgressSum = 0;

    // One grouped query instead of 2 count queries per project
    const taskGroups = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: {
        archivedAt: null,
        projectId: { in: activeProjects.map((p) => p.id) },
        execYear: year,
        execWeek: { in: weekNumbers },
      },
      _count: { _all: true },
    });
    const taskCounts = new Map<string, { total: number; done: number }>();
    for (const g of taskGroups) {
      if (!g.projectId) continue;
      const entry = taskCounts.get(g.projectId) || { total: 0, done: 0 };
      entry.total += g._count._all;
      if (g.status === 'Done') entry.done += g._count._all;
      taskCounts.set(g.projectId, entry);
    }

    for (const proj of activeProjects) {
      const { total: totalTasks, done: doneTasks } = taskCounts.get(proj.id) || {
        total: 0,
        done: 0,
      };

      const progressPct =
        totalTasks > 0
          ? Number(((doneTasks / totalTasks) * 100).toFixed(1))
          : 0;
      totalProgressSum += progressPct;

      let color = 'red';
      if (progressPct >= 70) color = 'green';
      else if (progressPct >= 40) color = 'yellow';

      projectProgresses.push({
        id: proj.id,
        name: proj.name,
        progressPct,
        color,
      });
    }

    const totalPct =
      activeProjects.length > 0
        ? Number((totalProgressSum / activeProjects.length).toFixed(1))
        : 0;

    return {
      totalPct,
      projects: projectProgresses.slice(0, 5),
    };
  }

  async getTaskStatusData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    let activeProjectIds: string[] = [];
    if (projectId) {
      activeProjectIds = [projectId];
    } else {
      const activeProjects = await this.prisma.project.findMany({
        where: { status: { not: 'Cancelled' }, archivedAt: null },
        select: { id: true },
      });
      activeProjectIds = activeProjects.map((p) => p.id);
    }

    if (activeProjectIds.length === 0) {
      return {
        total: 0,
        byStatus: {
          'To Do': 0,
          'In Progress': 0,
          Review: 0,
          Done: 0,
        },
      };
    }

    const tasksGrouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        archivedAt: null,
        projectId: { in: activeProjectIds },
        execYear: year,
        execWeek: { in: weekNumbers },
      },
      _count: {
        id: true,
      },
    });

    const statusCounts = {
      'To Do': 0,
      'In Progress': 0,
      Review: 0,
      Done: 0,
    };
    let total = 0;

    for (const group of tasksGrouped) {
      const status = group.status;
      let targetStatus: keyof typeof statusCounts | null = null;
      if (status === 'To Do' || status === 'Planning' || status === 'Backlog') {
        targetStatus = 'To Do';
      } else if (status === 'In Progress' || status === 'Processing' || status === 'Pending') {
        targetStatus = 'In Progress';
      } else if (status === 'Review') {
        targetStatus = 'Review';
      } else if (status === 'Done' || status === 'Completed') {
        targetStatus = 'Done';
      }

      if (targetStatus) {
        statusCounts[targetStatus] += group._count.id;
        total += group._count.id;
      }
    }

    return {
      total,
      byStatus: statusCounts,
    };
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
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
    projectId?: string,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
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
      AND: [
        this.getOpportunityPeriodCondition(currRange),
        projectId
          ? { projectId }
          : {
              OR: [
                { projectId: null },
                { project: { archivedAt: null, status: { not: 'Cancelled' } } },
              ],
            },
      ],
    };
    const prevWhere: any = {
      status: 'active',
      archivedAt: null,
      AND: [
        this.getOpportunityPeriodCondition(prevRange),
        projectId
          ? { projectId }
          : {
              OR: [
                { projectId: null },
                { project: { archivedAt: null, status: { not: 'Cancelled' } } },
              ],
            },
      ],
    };

    // Only the fields aggregated below are loaded
    const oppSelect = { size: true, setupFee: true, monthlyFee: true } as const;
    const [currOpps, prevOpps] = await Promise.all([
      this.prisma.opportunity.findMany({
        where: currWhere,
        select: oppSelect,
      }),
      this.prisma.opportunity.findMany({
        where: prevWhere,
        select: oppSelect,
      }),
    ]);

    const segments: Array<'enterprise' | 'mid_market' | 'smb'> = [
      'enterprise',
      'mid_market',
      'smb',
    ];

    return segments.map((seg) => {
      const segCurrOpps = currOpps.filter(
        (o) => this.normalizeSegment(o.size) === seg,
      );
      const segPrevOpps = prevOpps.filter(
        (o) => this.normalizeSegment(o.size) === seg,
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
  }
}
