import axios from 'axios';

const TOKEN_KEY = 'mkt_hub_token';

const api = axios.create({
  baseURL: 'https://mkt-hub.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function taskStatusToMock(status, isOverdue) {
  if (isOverdue) return 'overdue';
  const map = { Done: 'done', 'In Progress': 'in_progress', Review: 'review', 'To Do': 'todo', Backlog: 'backlog' };
  return map[status] || 'todo';
}

function projectStatusToMock(status, deadline) {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'On Hold') return 'on_hold';
  if (status === 'Planning') return 'planning';
  if (status === 'Active') {
    if (deadline) {
      const daysLeft = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 7) return 'near_deadline';
    }
    return 'active';
  }
  return 'planning';
}

function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toLocaleString() || '0';
}

function formatCurrency(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toLocaleString() || '0';
}

function getKpiTrend(percentVsPlan) {
  if (percentVsPlan == null) return null;
  if (percentVsPlan > 100) return 'up';
  if (percentVsPlan === 100) return 'flat';
  return 'down';
}

function getKpiBarColor(percentVsPlan) {
  if (percentVsPlan == null) return 'bg-primary';
  if (percentVsPlan >= 100) return 'bg-success';
  if (percentVsPlan >= 80) return 'bg-warning';
  return 'bg-danger';
}

function getKpiBarWidth(percentVsPlan) {
  if (percentVsPlan == null) return null;
  return `${Math.min(percentVsPlan, 100)}%`;
}

function getLtvCacBadge(ratio) {
  if (ratio < 1.5) return { label: 'Nguy hiểm', textColor: 'text-red-700', bgColor: 'bg-red-50', icon: 'dangerous' };
  if (ratio <= 2.5) return { label: 'Cần tối ưu', textColor: 'text-amber-700', bgColor: 'bg-amber-50', icon: 'warning' };
  if (ratio <= 4.0) return { label: 'Tỷ lệ vàng', textColor: 'text-green-700', bgColor: 'bg-green-50', icon: 'check_circle' };
  return { label: 'Tăng ngân sách', textColor: 'text-blue-700', bgColor: 'bg-blue-50', icon: 'trending_up' };
}

const kpiLabelVi = {
  'Raw Leads': 'Raw Leads',
  'MQL': 'MQL',
  'SQL': 'SQL',
  'Closed Deal': 'Closed Deal',
  'Pipeline Value': 'Giá trị Pipeline',
  'CAC / LTV': 'CAC / LTV',
};

const kpiDisplayMeta = {
  'Raw Leads': { emoji: '🔵', accent: 'blue', planLabel: 'KH' },
  'MQL': { emoji: '🟡', accent: 'yellow', planLabel: 'KH' },
  'SQL': { emoji: '🟠', accent: 'orange', planLabel: 'KH' },
  'Closed Deal': { emoji: '🟢', accent: 'green', planLabel: 'KH' },
  'Pipeline Value': { emoji: '💰', accent: 'purple', planLabel: 'KH' },
  'CAC / LTV': { emoji: '💎', accent: 'purple', planLabel: null },
};

function transformKpiCards(kpiCards) {
  return kpiCards.map((kpi, idx) => {
    if (kpi.label === 'CAC / LTV') {
      const ratio = kpi.ratio != null ? kpi.ratio : 0;
      const badge = getLtvCacBadge(ratio);
      const meta = kpiDisplayMeta['CAC / LTV'] || {};
      return {
        id: idx + 1,
        label: 'CAC / LTV',
        emoji: meta.emoji,
        accent: meta.accent,
        value: `1:${ratio.toFixed(1)}`,
        trend: null,
        percentage: null,
        badge,
        planValue: kpi.plan != null ? formatCurrency(kpi.plan) : null,
        planLabel: 'LTV',
        barColor: 'bg-primary',
        barWidth: '100%',
      };
    }
    const viLabel = kpiLabelVi[kpi.label] || kpi.label;
    const meta = kpiDisplayMeta[kpi.label] || { emoji: '📊', accent: 'blue', planLabel: 'KH' };
    const actual = kpi.actual ?? kpi.value ?? 0;
    const plan = kpi.plan ?? 0;
    const pct = kpi.percentVsPlan ?? kpi.ratio ?? null;
    const isCurrency = kpi.label === 'Pipeline Value';
    return {
      id: idx + 1,
      label: viLabel,
      emoji: meta.emoji,
      accent: meta.accent,
      value: isCurrency ? formatCurrency(actual) : formatNumber(actual),
      trend: getKpiTrend(pct),
      percentage: pct != null ? Math.round(pct) : null,
      suffix: 'so với KH',
      planValue: kpi.plan != null ? (isCurrency ? formatCurrency(kpi.plan) : formatNumber(kpi.plan)) : null,
      planLabel: meta.planLabel,
      barColor: getKpiBarColor(pct),
      barWidth: getKpiBarWidth(pct),
    };
  });
}

const funnelColors = ['bg-primary', 'bg-secondary', 'bg-secondary-container', 'bg-surface-tint', 'bg-success'];

function transformFunnel(funnel) {
  const firstActual = funnel[0]?.actual || 1;
  return funnel.map((item, idx) => {
    const cv = item.convPct;
    const isNa = cv === '—' || cv === 'N/A';
    return {
      stage: item.step.toUpperCase(),
      value: item.actual,
      percent: ((item.actual / firstActual) * 100).toFixed(1) + '%',
      color: funnelColors[idx] || 'bg-primary',
      cv: cv != null ? (isNa ? cv : `${cv}%`) : undefined,
      cvColor: cv != null
        ? isNa ? 'text-gray-400'
          : cv >= 50 ? 'text-success'
            : cv >= 30 ? 'text-warning'
              : 'text-danger'
        : undefined,
      cvTooltip: isNa ? 'Không thể tính tỷ lệ chuyển đổi do dữ liệu đầu vào bằng 0' : undefined,
    };
  });
}

function transformActivities(activities) {
  return activities.map((a) => ({
    label: a.type || a.label || a.name || a.channel || 'N/A',
    plan: Number(a.plan) || 0,
    actual: Number(a.actual) || 0,
  }));
}

function transformProjectProgress(progress) {
  return {
    totalPct: progress.totalPct,
    projects: progress.projects.map((p) => ({
      name: p.name,
      progress: p.progressPct,
      color: p.color === 'green' ? 'bg-success'
        : p.color === 'yellow' ? 'bg-warning'
          : p.color === 'red' ? 'bg-danger'
            : 'bg-primary',
    })),
  };
}

function transformTaskStatus(taskStatus) {
  if (!taskStatus || !taskStatus.byStatus) {
    return { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 };
  }
  return {
    total: taskStatus.total ?? 0,
    completed: taskStatus.byStatus.Done || 0,
    inProgress: (taskStatus.byStatus['In Progress'] || 0) + (taskStatus.byStatus.Review || 0),
    pending: taskStatus.byStatus['To Do'] || 0,
    overdue: 0,
  };
}

function transformAlerts(alerts) {
  const result = [];
  const overdue = Array.isArray(alerts) ? alerts : alerts?.overdue ?? [];
  const upcoming = Array.isArray(alerts) ? [] : alerts?.upcoming ?? [];
  for (const a of overdue) {
    result.push({ type: 'error', title: `Quá hạn: ${a.taskName || a.title || a.name || ''}`, assignee: a.assigneeName || a.assignee || '', due: a.dueDate || a.due || '', icon: 'error' });
  }
  for (const a of upcoming) {
    result.push({ type: 'warning', title: `Sắp tới: ${a.taskName || a.title || a.name || ''}`, assignee: a.assigneeName || a.assignee || '', due: a.dueDate || a.due || '', icon: 'schedule' });
  }
  return result;
}

// ===================== DASHBOARD =====================

export const getDashboardData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const res = await api.get('/v1/dashboard/overview', {
    params: { period_type: periodType, period_value: periodValue, year },
  });
  const d = res.data?.data ?? res.data ?? {};
  return {
    kpis: transformKpiCards(d.kpiCards ?? d.kpi_cards ?? []),
    funnel: transformFunnel(d.funnel ?? []),
    marketingActivities: transformActivities(d.activities ?? d.marketingActivities ?? d.marketing_activities ?? []),
    projectProgress: transformProjectProgress(d.progress ?? {}).projects,
    totalPct: d.progress?.totalPct ?? 0,
    taskStatus: transformTaskStatus(d.taskStatus ?? d.task_status ?? {}),
    alerts: transformAlerts(d.alerts ?? []),
  };
};

// ===================== AUTH =====================

export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  const { access_token, user } = res.data;
  localStorage.setItem(TOKEN_KEY, access_token);
  return { data: { token: access_token, user } };
};

export const register = async (name, email, password) => {
  await api.post('/auth/register', { name, email, password });
  return login(email, password);
};

export const logout = async () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('mkt_hub_user');
};

// ===================== PROJECTS =====================

export const getProjects = async () => {
  const res = await api.get('/v1/projects');
  const projects = res.data;
  return {
    data: projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      owner: p.owner?.name || 'Unknown',
      deadline: p.deadline ? formatDate(p.deadline) : 'No deadline',
      status: projectStatusToMock(p.status, p.deadline),
      statusLabel: p.status,
      tasksCompleted: p.progress?.done || 0,
      tasksTotal: p.progress?.total || 0,
      progress: p.progress?.percentage || 0,
      tasks: (p.tasks || []).map((t) => ({
        name: t.name,
        assignee: t.assignee?.name || 'Unknown',
        due: t.dueDate ? formatDate(t.dueDate) : '-',
      status: taskStatusToMock(t.status, t.isOverdue),
      statusLabel: t.status,
      })),
    })),
  };
};

export const createProject = async (data) => {
  const res = await api.post('/v1/projects', data);
  return { data: res.data };
};

export const updateProject = async (id, data) => {
  const res = await api.patch(`/v1/projects/${id}`, data);
  return { data: res.data };
};

export const deleteProject = async (id) => {
  await api.delete(`/v1/projects/${id}`);
  return { success: true };
};

// ===================== TASKS =====================

export const getTaskList = async (filters = {}) => {
  const params = {};
  if (filters.project && filters.project !== 'Tất cả' && filters.project !== 'All Projects') {
    params.projectId = filters.project;
  }
  if (filters.status && filters.status !== 'Tất cả' && filters.status !== 'All Status') {
    const statusMap = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
    params.status = statusMap[filters.status] || filters.status;
  }
  if (filters.priority && filters.priority !== 'Tất cả' && filters.priority !== 'All Priorities') {
    const priorityMap = { high: 'High', medium: 'Medium', low: 'Low' };
    params.priority = priorityMap[filters.priority] || filters.priority;
  }
  if (filters.assignee && filters.assignee !== 'Tất cả' && filters.assignee !== 'Everyone') {
    params.assigneeId = filters.assignee;
  }
  const res = await api.get('/v1/tasks', { params });
  const { data: tasks } = res.data;
  return {
    data: tasks.map((t) => ({
      id: t.id,
      project: t.project?.name || '-',
      taskName: t.name,
      description: t.description || '',
      assignee: { initials: getInitials(t.assignee?.name || ''), name: t.assignee?.name || 'Unknown' },
      stakeholders: (t.stakeholders || []).join(', '),
      status: taskStatusToMock(t.status, t.isOverdue),
      priority: t.priority?.toLowerCase() || 'medium',
      start: t.startDate ? formatDate(t.startDate) : '-',
      startDate: t.startDate || '',
      due: t.dueDate ? formatDate(t.dueDate) : '-',
      dueDate: t.dueDate || '',
      done: t.completedDate ? formatDate(t.completedDate) : null,
      completedDate: t.completedDate || '',
      link: t.link ? { type: 'link', url: t.link } : null,
      remark: t.remark || '',
    })),
    total: res.data.stats?.total || tasks.length,
  };
};

export const getTasks = async (filters) => {
  const params = {};
  if (filters?.project) params.projectId = filters.project;
  if (filters?.status) params.status = filters.status;
  const res = await api.get('/v1/tasks', { params });
  return { data: res.data.data };
};

export const createTask = async (data) => {
  const res = await api.post('/v1/tasks', data);
  return { data: res.data };
};

export const updateTask = async (id, data) => {
  const res = await api.patch(`/v1/tasks/${id}`, data);
  return { data: res.data };
};

export const deleteTask = async (id) => {
  await api.delete(`/v1/tasks/${id}`);
  return { success: true };
};

// ===================== KANBAN =====================

const columnMeta = {
  'To Do': { title: 'CHƯA BẮT ĐẦU', badgeColor: 'bg-slate-50 text-slate-600' },
  'In Progress': { title: 'ĐANG LÀM', badgeColor: 'bg-blue-50 text-blue-600' },
  Review: { title: 'ĐANG REVIEW', badgeColor: 'bg-amber-50 text-amber-600' },
  Done: { title: 'HOÀN THÀNH', badgeColor: 'bg-green-50 text-green-600' },
  Planning: { title: 'LẬP KẾ HOẠCH', badgeColor: 'bg-blue-50 text-blue-600' },
  Processing: { title: 'ĐANG XỬ LÝ', badgeColor: 'bg-blue-50 text-blue-600' },
  Pending: { title: 'ĐANG CHỜ', badgeColor: 'bg-purple-50 text-purple-600' },
  Cancel: { title: 'ĐÃ HUỶ', badgeColor: 'bg-gray-100 text-gray-600' },
  Overdue: { title: 'QUÁ HẠN', badgeColor: 'bg-red-50 text-red-600' },
};

const priorityBorders = { High: 'border-l-red-500', Medium: 'border-l-amber-300', Low: 'border-l-gray-200' };

export const getKanbanData = async () => {
  const res = await api.get('/v1/tasks/kanban/board');
  const columns = res.data;
  return {
    data: columns.map((col) => {
      const meta = columnMeta[col.status] || { title: col.status.toUpperCase(), badgeColor: 'bg-gray-50 text-gray-600' };
      return {
        id: col.status.toLowerCase(),
        title: meta.title,
        badgeCount: col.count,
        badgeColor: meta.badgeColor,
        tasks: col.tasks.map((t) => {
          const isOverdue = t.isOverdue;
          const isDone = t.status === 'Done' || t.status === 'done';
          return {
            id: t.id,
            title: t.name,
            project: t.project?.name || '-',
            assignee: t.assignee?.name || 'Unknown',
            priority: t.priority || 'Medium',
            due: t.dueDate ? formatDate(t.dueDate) : '-',
            dueColor: isOverdue ? 'text-red-500' : isDone ? 'text-green-600' : 'text-gray-400',
            statusIcon: isOverdue ? 'error' : isDone ? 'check_circle' : 'east',
            statusColor: isOverdue ? 'text-red-500' : isDone ? 'text-green-600' : 'text-amber-500',
            avatar: getInitials(t.assignee?.name || ''),
            overdue: isOverdue,
            done: isDone,
          };
        }),
      };
    }),
  };
};

// ===================== WEEKLY REPORTS =====================

export const getWeeklyReport = async (filters = {}) => {
  const params = { week: filters.week || 29, year: filters.year || 2026 };
  if (filters.projectId) params.projectId = filters.projectId;
  const res = await api.get('/v1/weekly-reports', { params });
  const r = res.data;
  return {
    data: {
      week: r.period.week,
      year: r.period.year,
      project: filters.project || 'All Projects',
      member: filters.member || 'All Members',
      status: r.log ? 'Đã lưu' : 'Nháp',
      completed: (r.sections.done || []).map((t) => ({
        code: t.id?.slice(0, 8) || '-',
        name: t.name,
        result: 'Hoàn thành',
        assignee: t.assignee?.name || 'Unknown',
      })),
      nextWeek: (r.sections.nextWeekPlan || []).map((t) => ({
        schedule: t.startDate ? formatDate(t.startDate) : '-',
        item: t.name,
        deadline: t.dueDate ? formatDate(t.dueDate) : '-',
        priority: t.priority === 'High' ? 'High' : 'Normal',
      })),
      backlog: (r.sections.backlog || []).map((t) => ({
        title: t.name,
        tag: 'BLOCKER',
        tagClass: 'bg-error text-on-error',
        description: t.reason || 'Không có lý do',
        note: t.remark || '',
        icon: 'info',
        cardClass: 'bg-error-container/10 border-error/20',
      })),
      bod: (r.sections.bodSupport || []).map((t) => ({
        project: t.project?.name || '-',
        description: t.neededSupportBod || '',
      })),
    },
  };
};

// ===================== MOCK (Legacy) =====================

import {
  mockKanbanColumns, mockPlanKPIs, mockActuals, mockOpportunities, mockClosedDeals,
  mockExpenseSystemParams, mockExpenseList, mockProjectsDropdown, mockExpenseReports,
  mockExpenseOverview, mockBackupData, mockDropdownKeys, addDropdownValueMock,
} from '../mocks/data';

// ===================== MEMBERS =====================

export const getMembers = async () => {
  const res = await api.get('/members');
  return { data: res.data };
};

// ===================== FUNNEL DATA =====================

export const getFunnelData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const res = await api.get('/v1/dashboard/funnel', {
    params: { period_type: periodType, period_value: periodValue, year },
  });
  const d = res.data?.data ?? res.data ?? [];
  return { data: d };
};

export const getKpiCardsData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const res = await api.get('/v1/dashboard/kpi-cards', {
    params: { period_type: periodType, period_value: periodValue, year },
  });
  const d = res.data?.data ?? res.data ?? [];
  return { data: d };
};

// ===================== KPI ROLLOVER =====================

export const getKPIRollover = async (year, week) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const planRes = await getPlanKPIs(year);
  const weekStr = `W${String(week).padStart(2, '0')}`;
  const actualsRes = await getActuals(weekStr);
  const plan = planRes.data;
  const actuals = actualsRes.data;

  const totalWeeks = 52;
  const weeklyTargetRawLeads = Math.round((plan.targetLeads || 0) / totalWeeks);
  const weeklyTargetMQL = Math.round((plan.mqlTarget || 0) / totalWeeks);
  const weeklyTargetSQL = Math.round((plan.sqlTarget || 0) / totalWeeks);
  const weeklyTargetOPP = Math.round((plan.opportunityCount || 0) / totalWeeks);
  const weeklyTargetClosed = Math.round((plan.closedDealCount || 0) / totalWeeks);

  return {
    data: [
      {
        label: 'Raw Leads',
        weeklyTarget: weeklyTargetRawLeads,
        currentActual: actuals.rawLeads || 0,
      },
      {
        label: 'MQL',
        weeklyTarget: weeklyTargetMQL,
        currentActual: actuals.mqlActual || 0,
      },
      {
        label: 'SQL',
        weeklyTarget: weeklyTargetSQL,
        currentActual: actuals.sqlActual || 0,
      },
      {
        label: 'OPP',
        weeklyTarget: weeklyTargetOPP,
        currentActual: 0,
      },
      {
        label: 'Closed Deal',
        weeklyTarget: weeklyTargetClosed,
        currentActual: 0,
      },
    ],
  };
};

// ===================== COMPARE PERIODS =====================

export const getCompareData = async (years = ['2026', '2025'], periodType = 'year', periodValue = '2026') => {
  const results = await Promise.all(
    years.map(year =>
      getKpiCardsData(periodType, periodValue, year).then(r => ({ year, data: r.data }))
    )
  );
  const byYear = {};
  for (const { year, data } of results) {
    byYear[year] = {};
    for (const kpi of data) {
      byYear[year][kpi.label] = { actual: kpi.actual, plan: kpi.plan, percentVsPlan: kpi.percentVsPlan };
    }
  }
  return { data: byYear };
};

export const getQuarterlyCompareData = async (selectedYears, metric = 'Raw Leads') => {
  await new Promise(resolve => setTimeout(resolve, 400));

  const baseValues = {
    'Raw Leads': [4000, 3400, 2800],
    'MQL': [2000, 1700, 1400],
    'SQL': [800, 680, 560],
    'Won Value': [350000, 290000, 240000],
  };
  const bases = baseValues[metric] || baseValues['Raw Leads'];

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const datasets = selectedYears.map((year, idx) => {
    const colors = ['bg-primary', 'bg-secondary-fixed-dim', 'bg-surface-container-highest'];
    const base = bases[idx] || bases[bases.length - 1];
    const multipliers = [0.6, 0.75, 0.85, 0.9];
    const values = multipliers.map(m => Math.round(base * m));

    const isEstimated = year === currentYear
      ? [false, currentQuarter > 1, currentQuarter > 2, currentQuarter > 3]
      : [false, false, false, false];

    return {
      year,
      color: colors[idx] || 'bg-gray-300',
      values,
      isEstimated,
    };
  });

  return {
    data: {
      quarters: ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'],
      datasets,
    },
  };
};

// ===================== CONVERT TO WON =====================

export const convertOpportunityToWon = async (id, signedDate) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { id, status: 'won', signedDate } };
};

// ===================== MOCK (Legacy) =====================

export const getPlanKPIs = async (year) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const base = savedPlanKPIs || mockPlanKPIs;
  return { data: { ...base, year: year || base.year } };
};

let savedPlanKPIs = null;
let savedActuals = {};

export const savePlanKPIs = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  savedPlanKPIs = { ...mockPlanKPIs, ...data, id: Date.now() };
  return { data: savedPlanKPIs };
};

export const getActuals = async (week) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const cached = savedActuals[week];
  if (cached) return { data: { ...cached } };
  return { data: { ...mockActuals, week: week || mockActuals.week } };
};

export const saveActuals = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const week = data.week || mockActuals.week;
  const saved = { ...mockActuals, ...data, id: Date.now() };
  savedActuals[week] = saved;
  return { data: saved };
};

export const getOpportunities = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockOpportunities] };
};

export const addOpportunity = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return { data: { ...data, id: Date.now() } };
};

export const updateOpportunity = async (id, data) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return { data: { ...data, id } };
};

export const convertToWon = async (id) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { id, status: 'won' } };
};

export const getClosedDeals = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockClosedDeals] };
};

export const getExpenseSystemParams = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockExpenseSystemParams] };
};

export const saveExpenseSystemParam = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getExpenseList = async (project) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  let list = [...mockExpenseList];
  if (project) list = list.filter(e => e.project === project);
  return { data: list };
};

export const saveExpense = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getExpenseReports = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockExpenseReports)) };
};

export const getExpenseOverview = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockExpenseOverview)) };
};

export const getProjectsDropdown = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { data: [...mockProjectsDropdown] };
};

export const getBackupData = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockBackupData)) };
};

export const getDropdownKeys = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockDropdownKeys)) };
};

export const addDropdownValue = async (keyId, label) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const newVal = addDropdownValueMock(keyId, label);
  return { data: newVal };
};

export const deleteDropdownValue = async (keyId, valueId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { success: true };
};

export default {
  getDashboardData,
  getProjects,
  getTasks,
  getTaskList,
  getKanbanData,
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  login,
  logout,
  getWeeklyReport,
  getPlanKPIs,
  savePlanKPIs,
  getActuals,
  saveActuals,
  getOpportunities,
  addOpportunity,
  updateOpportunity,
  convertToWon,
  getClosedDeals,
  getExpenseSystemParams,
  saveExpenseSystemParam,
  getExpenseList,
  saveExpense,
  getExpenseReports,
  getExpenseOverview,
  getProjectsDropdown,
  getBackupData,
  getDropdownKeys,
  addDropdownValue,
  deleteDropdownValue,
};
