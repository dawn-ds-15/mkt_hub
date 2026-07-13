import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfBusinessToday } from '../../common/utils/date.util';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    yearStr: string,
  ) {
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      throw new BadRequestException('Năm (year) không hợp lệ.');
    }

    const alerts = await this.getAlertsData();
    const topbar = {
      periodLabel: this.getPeriodLabel(periodType, periodValue, year),
      overdueCount: alerts.overdue.length,
      upcomingCount: alerts.upcoming.length,
    };

    const [kpiCards, funnel, activities, progress, taskStatus] =
      await Promise.all([
        this.getKpiCardsData(periodType, periodValue, year),
        this.getFunnelData(periodType, periodValue, year),
        this.getActivitiesData(periodType, periodValue, year),
        this.getProgressData(periodType, periodValue, year),
        this.getTaskStatusData(periodType, periodValue, year),
      ]);

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

  async getAlertsData() {
    const today = startOfBusinessToday();
    // Overdue: dueDate < today AND status NOT IN ('Done', 'Cancel')
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        dueDate: { lt: today },
        status: { notIn: ['Done', 'Cancel'] },
      },
      include: {
        assignee: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Upcoming: dueDate >= today AND dueDate <= today + 5 days AND status NOT IN ('Done', 'Cancel')
    const sixDaysLater = new Date(today);
    sixDaysLater.setUTCDate(today.getUTCDate() + 6);

    const upcomingTasks = await this.prisma.task.findMany({
      where: {
        dueDate: {
          gte: today,
          lt: sixDaysLater,
        },
        status: { notIn: ['Done', 'Cancel'] },
      },
      include: {
        assignee: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const overdue = overdueTasks.map((t) => {
      const diffTime = today.getTime() - t.dueDate.getTime();
      const overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        taskId: t.id,
        taskName: t.name,
        assigneeName: t.assignee.name,
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
        assigneeName: t.assignee.name,
        remainingDays,
        dueDate: t.dueDate.toISOString().split('T')[0],
      };
    });

    return { overdue, upcoming };
  }

  async getKpiCardsData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    // Get active projects
    const activeProjects = await this.prisma.project.findMany({
      where: { status: 'Active' },
      select: { id: true },
    });
    const activeProjectIds = activeProjects.map((p) => p.id);

    if (activeProjectIds.length === 0) {
      return this.emptyKpiCards();
    }

    // Get aggregated distributions
    const aggregations = await this.prisma.kpiDistribution.groupBy({
      by: ['type'],
      where: {
        year,
        week: { in: weekNumbers },
        projectId: { in: activeProjectIds },
      },
      _sum: {
        rawLeads: true,
        mql: true,
        sql: true,
        oppCount: true,
        closedCount: true,
        pipelineValue: true,
        wonValue: true,
      },
    });

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

    for (const group of aggregations) {
      const target = group.type === 'actual' ? actual : plan;
      target.rawLeads = group._sum.rawLeads || 0;
      target.mql = group._sum.mql || 0;
      target.sql = group._sum.sql || 0;
      target.oppCount = group._sum.oppCount || 0;
      target.closedCount = group._sum.closedCount || 0;
      target.pipelineValue = group._sum.pipelineValue
        ? Number(group._sum.pipelineValue)
        : 0;
      target.wonValue = group._sum.wonValue ? Number(group._sum.wonValue) : 0;
    }

    const calcPercentVsPlan = (act: number, pl: number) => {
      if (!pl) return 0;
      return Number(((act / pl) * 100).toFixed(1));
    };

    // CAC / LTV calculation
    const months: number[] = [];
    for (const w of weekNumbers) {
      const thursday = this.getThursdayOfWeek(year, w);
      if (thursday.getFullYear() === year) {
        const m = thursday.getMonth() + 1;
        if (!months.includes(m)) {
          months.push(m);
        }
      }
    }

    const expenses = await this.prisma.expenseRecord.aggregate({
      where: {
        projectId: { in: activeProjectIds },
        year,
        month: { in: months },
      },
      _sum: {
        directCost: true,
        overheadCost: true,
      },
    });

    const totalDirect = expenses._sum.directCost
      ? Number(expenses._sum.directCost)
      : 0;
    const totalOverhead = expenses._sum.overheadCost
      ? Number(expenses._sum.overheadCost)
      : 0;
    const totalCost = totalDirect + totalOverhead;

    const closedDealsCount = await this.prisma.closedDeal.count({
      where: {
        projectId: { in: activeProjectIds },
        year,
        week: { in: weekNumbers },
      },
    });

    const cac =
      closedDealsCount > 0
        ? Number((totalCost / closedDealsCount).toFixed(0))
        : 0;

    const closedDealsStats = await this.prisma.closedDeal.aggregate({
      where: {
        projectId: { in: activeProjectIds },
        year,
        week: { in: weekNumbers },
      },
      _avg: {
        setupFee: true,
        monthlyFee: true,
      },
    });

    const avgSetupFee = closedDealsStats._avg.setupFee
      ? Number(closedDealsStats._avg.setupFee)
      : 0;
    const avgMonthlyFee = closedDealsStats._avg.monthlyFee
      ? Number(closedDealsStats._avg.monthlyFee)
      : 0;

    const churnRate = await this.getSystemConfigValue(
      'churn_rate',
      periodType,
      periodValue,
      year,
    );
    const grossMargin = await this.getSystemConfigValue(
      'gross_margin',
      periodType,
      periodValue,
      year,
    );

    const ltv =
      churnRate > 0
        ? Number(
            (
              (avgSetupFee + avgMonthlyFee * (1 / churnRate)) *
              grossMargin
            ).toFixed(0),
          )
        : 0;

    const ratio = cac > 0 ? Number((ltv / cac).toFixed(1)) : 0;

    let health = 'gray';
    if (ratio > 0) {
      if (ratio < 1.5) health = 'red';
      else if (ratio < 2.5) health = 'yellow';
      else if (ratio < 4.0) health = 'green';
      else health = 'blue';
    }

    return [
      {
        label: 'Raw Leads',
        color: 'blue',
        actual: actual.rawLeads,
        plan: plan.rawLeads,
        percentVsPlan: calcPercentVsPlan(actual.rawLeads, plan.rawLeads),
        convPct: null,
      },
      {
        label: 'MQL',
        color: 'yellow',
        actual: actual.mql,
        plan: plan.mql,
        percentVsPlan: calcPercentVsPlan(actual.mql, plan.mql),
        convPct:
          actual.rawLeads > 0
            ? Number(((actual.mql / actual.rawLeads) * 100).toFixed(1))
            : null,
      },
      {
        label: 'SQL',
        color: 'orange',
        actual: actual.sql,
        plan: plan.sql,
        percentVsPlan: calcPercentVsPlan(actual.sql, plan.sql),
        convPct:
          actual.mql > 0
            ? Number(((actual.sql / actual.mql) * 100).toFixed(1))
            : null,
      },
      {
        label: 'OPP',
        color: 'purple-light',
        actual: actual.oppCount,
        plan: plan.oppCount,
        percentVsPlan: calcPercentVsPlan(actual.oppCount, plan.oppCount),
        convPct:
          actual.sql > 0
            ? Number(((actual.oppCount / actual.sql) * 100).toFixed(1))
            : null,
      },
      {
        label: 'Closed Deal',
        color: 'green',
        actual: actual.closedCount,
        plan: plan.closedCount,
        percentVsPlan: calcPercentVsPlan(actual.closedCount, plan.closedCount),
        convPct:
          actual.oppCount > 0
            ? Number(((actual.closedCount / actual.oppCount) * 100).toFixed(1))
            : null,
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
        convPct: null,
      },
      {
        label: 'CAC / LTV',
        color: 'gray',
        cac,
        ltv,
        ratio,
        health,
      },
    ];
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

    return config ? Number(config.value) : key === 'churn_rate' ? 0.05 : 0.8;
  }

  private emptyKpiCards() {
    return [
      {
        label: 'Raw Leads',
        color: 'blue',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'MQL',
        color: 'yellow',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'SQL',
        color: 'orange',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'OPP',
        color: 'purple-light',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'Closed Deal',
        color: 'green',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'Pipeline Value',
        color: 'purple',
        actual: 0,
        plan: 0,
        percentVsPlan: 0,
        convPct: null,
      },
      {
        label: 'CAC / LTV',
        color: 'gray',
        cac: 0,
        ltv: 0,
        ratio: 0,
        health: 'gray',
      },
    ];
  }

  async getFunnelData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ) {
    const cards = await this.getKpiCardsData(periodType, periodValue, year);
    const funnelSteps = ['Raw Leads', 'MQL', 'SQL', 'OPP', 'Closed Deal'];
    return cards
      .filter((c: any) => funnelSteps.includes(c.label))
      .map((c: any) => ({
        step: c.label,
        actual: c.actual,
        plan: c.plan,
        convPct: c.convPct,
        percentVsPlan: c.percentVsPlan,
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
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    // Get active projects
    const activeProjects = await this.prisma.project.findMany({
      where: { status: 'Active' },
      select: { id: true, type: true },
    });

    if (activeProjects.length === 0) {
      return [];
    }

    const activeProjectIds = activeProjects.map((p) => p.id);
    const projectTypeMap = new Map<string, string>();
    for (const p of activeProjects) {
      projectTypeMap.set(p.id, p.type);
    }

    const distributions = await this.prisma.kpiDistribution.findMany({
      where: {
        year,
        week: { in: weekNumbers },
        projectId: { in: activeProjectIds },
      },
    });

    const typeStats = new Map<string, { plan: number; actual: number }>();

    for (const project of activeProjects) {
      if (!typeStats.has(project.type)) {
        typeStats.set(project.type, { plan: 0, actual: 0 });
      }
    }

    for (const d of distributions) {
      const projType = projectTypeMap.get(d.projectId);
      if (!projType) continue;

      if (!typeStats.has(projType)) {
        typeStats.set(projType, { plan: 0, actual: 0 });
      }

      const stats = typeStats.get(projType)!;
      if (d.type === 'plan') {
        stats.plan += d.rawLeads || 0;
      } else {
        stats.actual += d.rawLeads || 0;
      }
    }

    const result = [];
    for (const [type, stats] of typeStats.entries()) {
      result.push({
        type,
        plan: stats.plan,
        actual: stats.actual,
      });
    }

    return result;
  }

  async getProgressData(
    periodType: 'week' | 'month' | 'quarter' | 'year',
    periodValue: string | undefined,
    year: number,
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    // Get active projects
    const activeProjects = await this.prisma.project.findMany({
      where: { status: 'Active' },
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

    for (const proj of activeProjects) {
      const totalTasks = await this.prisma.task.count({
        where: {
          projectId: proj.id,
          execYear: year,
          execWeek: { in: weekNumbers },
        },
      });

      const doneTasks = await this.prisma.task.count({
        where: {
          projectId: proj.id,
          execYear: year,
          execWeek: { in: weekNumbers },
          status: 'Done',
        },
      });

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
  ) {
    const weekNumbers = this.getWeekNumbers(periodType, periodValue, year);

    const activeProjects = await this.prisma.project.findMany({
      where: { status: 'Active' },
      select: { id: true },
    });
    const activeProjectIds = activeProjects.map((p) => p.id);

    if (activeProjectIds.length === 0) {
      return {
        total: 0,
        byStatus: {
          Done: 0,
          Processing: 0,
          Planning: 0,
          Pending: 0,
          Backlog: 0,
          Cancel: 0,
        },
      };
    }

    const tasksGrouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        projectId: { in: activeProjectIds },
        execYear: year,
        execWeek: { in: weekNumbers },
      },
      _count: {
        id: true,
      },
    });

    const statusCounts = {
      Done: 0,
      Processing: 0,
      Planning: 0,
      Pending: 0,
      Backlog: 0,
      Cancel: 0,
    };
    let total = 0;

    for (const group of tasksGrouped) {
      const status = group.status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status] = group._count.id;
        total += group._count.id;
      }
    }

    return {
      total,
      byStatus: statusCounts,
    };
  }
}
