import axios from 'axios';

const TOKEN_KEY = 'mkt_hub_token';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('mkt_hub_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

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
  if (['Planning', 'Processing', 'Done', 'Backlog', 'Pending', 'Cancel'].includes(status)) return status;
  return 'Planning';
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
  if (!progress || !Array.isArray(progress.projects)) {
    return { totalPct: 0, projects: [] };
  }
  return {
    totalPct: progress.totalPct ?? 0,
    projects: (progress.projects ?? []).map((p) => ({
      name: p.name || '',
      progress: p.progressPct ?? 0,
      id: p.id,
      color: p.color === 'green' ? 'bg-success'
        : p.color === 'yellow' ? 'bg-warning'
          : p.color === 'red' ? 'bg-danger'
            : 'bg-primary',
    })),
  };
}

function transformTaskStatus(taskStatus) {
  if (!taskStatus || !taskStatus.byStatus) {
    return { total: 0, completed: 0, inProgress: 0, pending: 0, waiting: 0, canceled: 0, overdue: 0 };
  }
  const by = taskStatus.byStatus;
  return {
    total: taskStatus.total ?? 0,
    completed: by.Done || 0,
    inProgress: by.Processing || 0,
    pending: by.Planning || 0,
    waiting: (by.Pending || 0) + (by.Backlog || 0),
    canceled: by.Cancel || 0,
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
  const rawAlerts = d.alerts ?? [];
  const overdueRaw = Array.isArray(rawAlerts) ? rawAlerts : rawAlerts?.overdue ?? [];
  const upcomingRaw = Array.isArray(rawAlerts) ? [] : rawAlerts?.upcoming ?? [];
  const filterByYear = (items) => items.filter(a => {
    const d = a.dueDate || a.due;
    return d ? String(new Date(d).getFullYear()) === String(year) : true;
  });
  const filteredAlerts = Array.isArray(rawAlerts)
    ? filterByYear(rawAlerts)
    : { overdue: filterByYear(overdueRaw), upcoming: filterByYear(upcomingRaw) };
  const alerts = transformAlerts(filteredAlerts);
  const taskStatus = transformTaskStatus(d.taskStatus ?? d.task_status ?? {});
  taskStatus.overdue = alerts.filter(a => a.type === 'error').length;

  return {
    kpis: transformKpiCards(d.kpiCards ?? d.kpi_cards ?? []),
    funnel: transformFunnel(d.funnel ?? []),
    marketingActivities: transformActivities(d.activities ?? d.marketingActivities ?? d.marketing_activities ?? []),
    projectProgress: transformProjectProgress(d.progress ?? {}).projects,
    totalPct: d.progress?.totalPct ?? 0,
    taskStatus,
    alerts,
  };
};

// ===================== AUTH =====================

export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  const data = res.data?.data ?? res.data;
  const token = data.access_token || data.token || data.idToken || '';
  const user = data.user || data.profile || {};
  if (!token) {
    throw new Error('Không nhận được token từ máy chủ. Vui lòng thử lại.');
  }
  localStorage.setItem(TOKEN_KEY, token);
  return { data: { token, user } };
};

export const register = async (name, email, password) => {
  const regRes = await api.post('/auth/register', { name, email, password });
  const regData = regRes.data?.data ?? regRes.data;
  if (regData.access_token || regData.token) {
    const token = regData.access_token || regData.token;
    const user = regData.user || regData.profile || {};
    localStorage.setItem(TOKEN_KEY, token);
    return { data: { token, user } };
  }
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
      ownerId: p.ownerId || p.owner?.id || '',
      deadline: p.deadline ? formatDate(p.deadline) : 'No deadline',
      deadlineRaw: p.deadline || null,
      status: projectStatusToMock(p.status, p.deadline),
      statusLabel: p.status,
      tasksCompleted: p.progress?.done || 0,
      tasksTotal: p.progress?.total || 0,
      progress: p.progress?.percentage || 0,
      budgetPlanDirect: p.budgetPlanDirect || 0,
      budgetPlanOverhead: p.budgetPlanOverhead || 0,
      actualCostDirect: p.actualCostDirect || 0,
      actualCostOverhead: p.actualCostOverhead || 0,
      kpiRawLeadsPlan: p.kpiRawLeadsPlan || 0,
      kpiRawLeadsActual: p.kpiRawLeadsActual || 0,
      tasks: (p.tasks || []).map((t) => ({
        name: t.name,
        assignee: t.assignee?.name || 'Unknown',
        due: t.dueDate ? formatDate(t.dueDate) : '-',
        dueDate: t.dueDate || null,
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
  if (filters.status && filters.status !== 'Tất cả' && filters.status !== 'All Status' && filters.status !== 'overdue') {
    const statusMap = { todo: 'Planning', in_progress: 'Processing', pending: 'Planning', waiting: 'Pending', done: 'Done', canceled: 'Cancel', backlog: 'Backlog' };
    params.status = statusMap[filters.status] || filters.status;
  }
  if (filters.priority && filters.priority !== 'Tất cả' && filters.priority !== 'All Priorities') {
    const priorityMap = { high: 'High', medium: 'Medium', low: 'Low' };
    params.priority = priorityMap[filters.priority] || filters.priority;
  }
  if (filters.assignee && filters.assignee !== 'Tất cả' && filters.assignee !== 'Everyone') {
    params.assigneeId = filters.assignee;
  }
  if (filters.dateFrom) params.dueDateFrom = filters.dateFrom;
  if (filters.dateTo) params.dueDateTo = filters.dateTo;
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
      link: t.link || null,
      linkUrl: t.link || null,
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
  const res = await api.post('/v1/tasks', {
    name: data.title || data.name,
    description: data.description || '',
    status: data.status || 'Planning',
    priority: data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1) : 'Medium',
    dueDate: data.dueDate,
    projectId: data.projectId,
    assigneeId: data.assigneeId,
    execWeek: data.execWeek ? Number(data.execWeek) : undefined,
    execYear: data.execYear ? Number(data.execYear) : undefined,
    tags: data.tags || [],
  });
  return { data: res.data };
};

export const updateTask = async (id, data) => {
  if (data.status) {
    const statusMap = { todo: 'Planning', in_progress: 'Processing', review: 'Processing', pending: 'Pending', waiting: 'Pending', done: 'Done', canceled: 'Cancel', backlog: 'Backlog' };
    data.status = statusMap[data.status] || data.status;
  }
  const res = await api.patch(`/v1/tasks/${id}`, data);
  return { data: res.data };
};

export const deleteTask = async (id) => {
  await api.delete(`/v1/tasks/${id}`);
  return { success: true };
};

// ===================== KANBAN =====================

const columnMeta = {
  Planning: { title: 'CHƯA LÀM', badgeColor: 'bg-slate-50 text-slate-600' },
  Processing: { title: 'ĐANG LÀM', badgeColor: 'bg-blue-50 text-blue-600' },
  Done: { title: 'HOÀN THÀNH', badgeColor: 'bg-green-50 text-green-600' },
  Backlog: { title: 'TỒN ĐỌNG', badgeColor: 'bg-amber-50 text-amber-600' },
  Pending: { title: 'CHỜ XỬ LÝ', badgeColor: 'bg-purple-50 text-purple-600' },
  Cancel: { title: 'ĐÃ HUỶ', badgeColor: 'bg-gray-100 text-gray-600' },
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
            dueDate: t.dueDate || '',
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
      logNotes: r.log ? {
        doneNotes: r.log.doneNotes || '',
        planNotes: r.log.planNotes || '',
        backlogNotes: r.log.backlogNotes || '',
        bodNotes: r.log.bodNotes || '',
      } : null,
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

export const saveWeeklyLog = async (data) => {
  const res = await api.post('/v1/weekly-reports/logs', {
    week: data.week,
    year: data.year,
    projectId: data.projectId || undefined,
    memberId: data.memberId || undefined,
    doneNotes: data.doneNotes || '',
    planNotes: data.planNotes || '',
    backlogNotes: data.backlogNotes || '',
    bodNotes: data.bodNotes || '',
  });
  return { data: res.data };
};

export const exportWeeklyReport = async (week, year, projectId) => {
  const params = { week, year };
  if (projectId) params.projectId = projectId;
  const res = await api.get('/v1/weekly-reports/export.txt', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-report-w${week}-${year}.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
  return { success: true };
};

// ===================== MEMBERS =====================

export const getMembers = async () => {
  const res = await api.get('/auth/members');
  return { data: res.data };
};

// ===================== FUNNEL DATA =====================

function getWeekNumbersFromPeriod(periodType, periodValue, year) {
  const weeks = [];
  if (periodType === 'week') {
    const w = parseInt(periodValue, 10);
    if (w >= 1 && w <= 53) weeks.push(w);
  } else if (periodType === 'month') {
    const m = parseInt(periodValue, 10);
    for (let w = 1; w <= 53; w++) {
      const d = new Date(year, 0, 4);
      d.setDate(d.getDate() + (4 - (d.getDay() || 7)) + (w - 1) * 7);
      if (d.getFullYear() === year && d.getMonth() + 1 === m) weeks.push(w);
    }
  } else if (periodType === 'quarter') {
    const q = parseInt(periodValue, 10);
    const startM = (q - 1) * 3 + 1;
    for (let m = startM; m < startM + 3; m++) {
      weeks.push(...getWeekNumbersFromPeriod('month', m, year));
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      weeks.push(...getWeekNumbersFromPeriod('month', m, year));
    }
  }
  return [...new Set(weeks)].sort((a, b) => a - b);
}

function getLocalActualsForWeeks(weeks, year) {
  const totals = { rawLeads: 0, mqlActual: 0, sqlActual: 0, oppCount: 0, closedCount: 0, pipelineValue: 0, wonValue: 0 };
  for (const w of weeks) {
    const key = `mkt_hub_actuals_${year}-W${String(w).padStart(2, '0')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const d = JSON.parse(stored);
        totals.rawLeads += Number(d.rawLeads || 0);
        totals.mqlActual += Number(d.mqlActual || 0);
        totals.sqlActual += Number(d.sqlActual || 0);
      }
    } catch { }
  }
  return totals;
}

function getLocalPlanForYear(year) {
  const key = `mkt_hub_plan_kpis_${year}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { }
  return null;
}

function getLocalOpportunitiesForYear(year) {
  const oppKey = 'mkt_hub_opportunities';
  try {
    const stored = localStorage.getItem(oppKey);
    const list = stored ? JSON.parse(stored) : [];
    return list.filter(o => {
      if (o.year) return Number(o.year) === Number(year);
      return true;
    });
  } catch { return []; }
}

function getLocalClosedDealsForYear(year) {
  const dealKey = 'mkt_hub_closed_deals';
  try {
    const stored = localStorage.getItem(dealKey);
    const list = stored ? JSON.parse(stored) : [];
    return list.filter(d => {
      if (d.year) return Number(d.year) === Number(year);
      const yr = d.signedDate ? new Date(d.signedDate).getFullYear() : null;
      return yr ? yr === Number(year) : true;
    });
  } catch { return []; }
}

function calcPercentVsPlan(actual, plan) {
  if (!plan || plan === 0) return 0;
  return Number(((actual / plan) * 100).toFixed(1));
}

function getLocalOverrideCards(periodType, periodValue, numericYear) {
  const weeks = getWeekNumbersFromPeriod(periodType, periodValue, numericYear);
  const plan = getLocalPlanForYear(numericYear);
  const actuals = getLocalActualsForWeeks(weeks, numericYear);
  const opps = getLocalOpportunitiesForYear(numericYear);
  const deals = getLocalClosedDealsForYear(numericYear);
  const hasLocalPlan = plan && (plan.targetLeads || plan.mqlTarget || plan.sqlTarget);
  const hasLocalActuals = actuals.rawLeads > 0 || actuals.mqlActual > 0 || actuals.sqlActual > 0;
  if (!hasLocalPlan && !hasLocalActuals && !opps.length && !deals.length) return null;
  return {
    plan, actuals, opps, deals,
    targetLeads: plan?.targetLeads || 0, mqlTarget: plan?.mqlTarget || 0, sqlTarget: plan?.sqlTarget || 0,
    oppTarget: plan?.opportunityCount || 0, closedTarget: plan?.closedDealCount || 0,
    rawLeads: actuals.rawLeads, mql: actuals.mqlActual, sql: actuals.sqlActual,
    oppCount: opps.length, closedCount: deals.length,
    pipelineValue: opps.reduce((s, o) => s + Number(o.fees || 0), 0),
    wonValue: deals.reduce((s, d) => s + Number(d.finalFees || 0), 0),
  };
}

function buildCardsFromLocal(loc) {
  if (!loc) return null;
  const { targetLeads, mqlTarget, sqlTarget, oppTarget, closedTarget, rawLeads, mql, sql, oppCount, closedCount, pipelineValue, wonValue } = loc;
  const pipelinePlan = loc.pipelinePlan || 0;
  const totalDealFees = loc.deals.reduce((s, d) => s + Number(d.finalFees || 0), 0);
  const cac = closedCount > 0 && totalDealFees > 0 ? Math.round(totalDealFees / closedCount * 0.3) : 0;
  const ltv = closedCount > 0 ? Math.round(totalDealFees / closedCount * 3) : 0;
  const ratio = cac > 0 ? Number((ltv / cac).toFixed(1)) : 0;
  let health = 'gray';
  if (ratio > 0) {
    if (ratio < 1.5) health = 'red';
    else if (ratio < 2.5) health = 'yellow';
    else if (ratio < 4.0) health = 'green';
    else health = 'blue';
  }
  return [
    { label: 'Raw Leads', color: 'blue', actual: rawLeads, plan: targetLeads, percentVsPlan: calcPercentVsPlan(rawLeads, targetLeads), convPct: null },
    { label: 'MQL', color: 'yellow', actual: mql, plan: mqlTarget, percentVsPlan: calcPercentVsPlan(mql, mqlTarget), convPct: rawLeads > 0 ? Number(((mql / rawLeads) * 100).toFixed(1)) : null },
    { label: 'SQL', color: 'orange', actual: sql, plan: sqlTarget, percentVsPlan: calcPercentVsPlan(sql, sqlTarget), convPct: mql > 0 ? Number(((sql / mql) * 100).toFixed(1)) : null },
    { label: 'OPP', color: 'purple-light', actual: oppCount, plan: oppTarget, percentVsPlan: calcPercentVsPlan(oppCount, oppTarget), convPct: sql > 0 ? Number(((oppCount / sql) * 100).toFixed(1)) : null },
    { label: 'Closed Deal', color: 'green', actual: closedCount, plan: closedTarget, percentVsPlan: calcPercentVsPlan(closedCount, closedTarget), convPct: oppCount > 0 ? Number(((closedCount / oppCount) * 100).toFixed(1)) : null },
    { label: 'Pipeline Value', color: 'purple', actual: pipelineValue, plan: pipelinePlan, percentVsPlan: calcPercentVsPlan(pipelineValue, pipelinePlan), convPct: null },
    { label: 'CAC / LTV', color: 'gray', cac, ltv, ratio, health },
  ];
}

export const getKpiCardsData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const numericYear = parseInt(year, 10);
  try {
    const res = await api.get('/v1/dashboard/kpi-cards', {
      params: { period_type: periodType, period_value: periodValue, year },
    });
    const apiCards = res.data?.data ?? res.data ?? [];
    if (apiCards.length > 0) return { data: apiCards };
  } catch { /* fallback to local */ }

  const localOverride = getLocalOverrideCards(periodType, periodValue, numericYear);
  if (localOverride) return { data: buildCardsFromLocal(localOverride) };
  return { data: [] };
};

export const getFunnelData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const numericYear = parseInt(year, 10);
  try {
    const res = await api.get('/v1/dashboard/funnel', {
      params: { period_type: periodType, period_value: periodValue, year },
    });
    const apiData = res.data?.data ?? res.data ?? [];
    if (apiData.length > 0) return { data: apiData };
  } catch { /* fallback to local */ }

  const localOverride = getLocalOverrideCards(periodType, periodValue, numericYear);
  if (localOverride) {
    const cards = buildCardsFromLocal(localOverride);
    const funnelSteps = ['Raw Leads', 'MQL', 'SQL', 'OPP', 'Closed Deal'];
    const data = cards.filter(c => funnelSteps.includes(c.label)).map(c => ({
      step: c.label, actual: c.actual, plan: c.plan,
      convPct: c.convPct, percentVsPlan: c.percentVsPlan,
      widthPct: cards[0]?.actual > 0 ? Number(((c.actual / cards[0].actual) * 100).toFixed(1)) : 0,
    }));
    return { data };
  }
  return { data: [] };
};

// ===================== KPI ROLLOVER =====================

export const getKPIRollover = async (year, week) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const numericYear = parseInt(year, 10);
  const weekNum = parseInt(week, 10);
  const plan = getLocalPlanForYear(numericYear);
  const weekKey = `${numericYear}-W${String(weekNum).padStart(2, '0')}`;
  const weekKeyStorage = `mkt_hub_actuals_${weekKey}`;
  let actuals = { rawLeads: 0, mqlActual: 0, sqlActual: 0 };
  try {
    const stored = localStorage.getItem(weekKeyStorage);
    if (stored) actuals = { ...actuals, ...JSON.parse(stored) };
  } catch { }

  const totalWeeks = 52;
  const weeklyTargetRawLeads = Math.round((plan?.targetLeads || 0) / totalWeeks);
  const weeklyTargetMQL = Math.round((plan?.mqlTarget || 0) / totalWeeks);
  const weeklyTargetSQL = Math.round((plan?.sqlTarget || 0) / totalWeeks);
  const weeklyTargetOPP = Math.round((plan?.opportunityCount || 0) / totalWeeks);
  const weeklyTargetClosed = Math.round((plan?.closedDealCount || 0) / totalWeeks);

  return {
    data: [
      { label: 'Raw Leads', weeklyTarget: weeklyTargetRawLeads, currentActual: actuals.rawLeads || 0 },
      { label: 'MQL', weeklyTarget: weeklyTargetMQL, currentActual: actuals.mqlActual || 0 },
      { label: 'SQL', weeklyTarget: weeklyTargetSQL, currentActual: actuals.sqlActual || 0 },
      { label: 'OPP', weeklyTarget: weeklyTargetOPP, currentActual: 0 },
      { label: 'Closed Deal', weeklyTarget: weeklyTargetClosed, currentActual: 0 },
    ],
  };
};

// ===================== COMPARE PERIODS =====================

export const getCompareData = async (years = ['2026', '2025'], periodType = 'year', periodValue = '2026') => {
  try {
    const res = await api.get('/v1/leads-kpis/comparison', {
      params: { years: years.join(','), period_type: periodType, period_value: periodValue }
    });
    return { data: res.data?.data ?? res.data ?? {} };
  } catch {
    const results = await Promise.all(
      years.map(year =>
        getKpiCardsData(periodType, periodValue, year).then(r => ({ year, data: r.data }))
      )
    );
    const byYear = {};
    for (const { year, data } of results) {
      byYear[year] = {};
      for (const kpi of data) {
        byYear[year][kpi.label] = {
          actual: kpi.actual,
          plan: kpi.plan,
          percentVsPlan: kpi.percentVsPlan,
          cac: kpi.cac,
          ltv: kpi.ltv,
          ratio: kpi.ratio,
          health: kpi.health,
        };
      }
    }
    return { data: byYear };
  }
};

export const getQuarterlyCompareData = async (selectedYears, metric = 'Raw Leads') => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const colors = ['bg-primary', 'bg-secondary-fixed-dim', 'bg-surface-container-highest', 'bg-gray-300'];
  const labelToKey = { 'Raw Leads': 'Raw Leads', 'MQL': 'MQL', 'SQL': 'SQL', 'Won Value': 'Won Value', 'Closed Deal': 'Closed Deal', 'OPP': 'OPP' };
  const apiMetric = labelToKey[metric] || 'Raw Leads';

  const datasets = await Promise.all(selectedYears.map(async (year, idx) => {
    const numericYear = parseInt(year, 10);
    const hasLocal = getLocalPlanForYear(numericYear) ||
      getLocalActualsForWeeks(getWeekNumbersFromPeriod('year', '1', numericYear), numericYear).rawLeads > 0;

    if (hasLocal) {
      const values = [];
      for (let q = 1; q <= 4; q++) {
        const weeks = getWeekNumbersFromPeriod('quarter', q, numericYear);
        const actuals = getLocalActualsForWeeks(weeks, numericYear);
        const opps = getLocalOpportunitiesForYear(numericYear);
        const deals = getLocalClosedDealsForYear(numericYear);
        let val = 0;
        if (metric === 'Raw Leads') val = actuals.rawLeads;
        else if (metric === 'MQL') val = actuals.mqlActual;
        else if (metric === 'SQL') val = actuals.sqlActual;
        else if (metric === 'Won Value') val = deals.reduce((s, d) => s + Number(d.finalFees || 0), 0);
        else if (metric === 'Closed Deal') val = deals.length;
        else if (metric === 'OPP') val = opps.length;
        values.push(val);
      }
      return { year, color: colors[idx % colors.length], values, isEstimated: [false, false, false, false] };
    }

    try {
      const res = await api.get('/v1/dashboard/kpi-cards', {
        params: { period_type: 'year', period_value: year, year },
      });
      const cards = res.data?.data ?? res.data ?? [];
      const total = cards.find(c => c.label === apiMetric)?.actual || 0;
      const qVals = await Promise.all([1, 2, 3, 4].map(async (q) => {
        const qRes = await api.get('/v1/dashboard/kpi-cards', {
          params: { period_type: 'quarter', period_value: q, year },
        });
        const qCards = qRes.data?.data ?? qRes.data ?? [];
        return qCards.find(c => c.label === apiMetric)?.actual || 0;
      }));
      return { year, color: colors[idx % colors.length], values: qVals, isEstimated: [false, false, false, false] };
    } catch {
      return { year, color: colors[idx % colors.length], values: [0, 0, 0, 0], isEstimated: [false, false, false, false] };
    }
  }));

  return { data: { quarters: ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'], datasets } };
};

// ===================== LOCAL STORAGE HELPERS =====================

const LS_PREFIX = 'mkt_hub_';

function lsGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

function lsGetList(key) {
  const v = lsGet(key);
  return Array.isArray(v) ? v : [];
}

function lsSaveList(key, list) {
  lsSet(key, list);
}

// ===================== PLAN KPIs =====================

export const getPlanKPIs = async (year) => {
  try {
    const res = await api.get(`/v1/leads-kpis/plan/${year}`);
    const d = res.data?.data ?? res.data ?? {};
    return {
      data: {
        year: Number(year),
        targetLeads: d.totalRawLeads ?? d.targetLeads ?? 0,
        mqlTarget: d.targetMql ?? d.mqlTarget ?? 0,
        sqlTarget: d.targetSql ?? d.sqlTarget ?? 0,
        opportunityCount: d.targetOpp ?? d.opportunityCount ?? 0,
        closedDealCount: d.targetClosedDeal ?? d.closedDealCount ?? 0,
        pipelineValue: d.targetPipelineVal ?? d.pipelineValue ?? 0,
        wonValue: d.targetWonVal ?? d.wonValue ?? 0,
      }
    };
  } catch {
    const key = `${LS_PREFIX}plan_kpis_${year}`;
    const stored = lsGet(key);
    if (stored) return { data: stored };
    return { data: { year: Number(year), targetLeads: 0, mqlTarget: 0, sqlTarget: 0, opportunityCount: 0, closedDealCount: 0, pipelineValue: 0, wonValue: 0 } };
  }
};

export const savePlanKPIs = async (data) => {
  try {
    const payload = {
      year: data.year,
      totalRawLeads: Number(data.targetLeads) || 0,
      targetMql: Number(data.mqlTarget) || 0,
      targetSql: Number(data.sqlTarget) || 0,
      targetOpp: Number(data.opportunityCount) || 0,
      targetClosedDeal: Number(data.closedDealCount) || 0,
      targetPipelineVal: Number(data.pipelineValue) || 0,
      targetWonVal: Number(data.wonValue) || 0,
    };
    const res = await api.post('/v1/leads-kpis/plan', payload);
    return { data: res.data?.data ?? res.data };
  } catch {
    const year = data.year || new Date().getFullYear();
    const key = `${LS_PREFIX}plan_kpis_${year}`;
    const existing = lsGet(key) || {};
    const saved = { ...existing, ...data, id: Date.now(), year };
    lsSet(key, saved);
    return { data: saved };
  }
};

// ===================== ACTUALS =====================

function parseWeekString(weekStr) {
  const parts = String(weekStr).split('-W');
  if (parts.length === 2) {
    return { year: parseInt(parts[0], 10), week: parseInt(parts[1], 10) };
  }
  const fallback = weekStr.split('W');
  if (fallback.length === 2) {
    return { year: parseInt(fallback[0], 10), week: parseInt(fallback[1], 10) };
  }
  return { year: new Date().getFullYear(), week: 1 };
}

export const getActuals = async (week) => {
  try {
    const { year, week: weekNum } = parseWeekString(week);
    const res = await api.get('/v1/leads-kpis/weekly', { params: { year, week: weekNum } });
    const d = res.data?.data ?? res.data ?? {};
    return {
      data: {
        week,
        rawLeads: d.rawLeads ?? 0,
        mqlActual: d.mql ?? d.mqlActual ?? 0,
        sqlActual: d.sql ?? d.sqlActual ?? 0,
      }
    };
  } catch {
    const key = `${LS_PREFIX}actuals_${week}`;
    const stored = lsGet(key);
    if (stored) return { data: stored };
    return { data: { week, rawLeads: 0, mqlActual: 0, sqlActual: 0 } };
  }
};

export const saveActuals = async (data) => {
  try {
    const { year, week: weekNum } = parseWeekString(data.week);
    const payload = {
      year,
      week: weekNum,
      rawLeads: Number(data.rawLeads) || 0,
      mql: Number(data.mqlActual) || 0,
      sql: Number(data.sqlActual) || 0,
    };
    const res = await api.post('/v1/leads-kpis/weekly', payload);
    return { data: res.data?.data ?? res.data };
  } catch {
    const week = data.week;
    const key = `${LS_PREFIX}actuals_${week}`;
    const existing = lsGet(key) || {};
    const saved = { ...existing, ...data, id: Date.now() };
    lsSet(key, saved);
    return { data: saved };
  }
};

// ===================== OPPORTUNITIES =====================

const OPP_KEY = `${LS_PREFIX}opportunities`;
const DEAL_KEY = `${LS_PREFIX}closed_deals`;

export const getOpportunities = async () => {
  try {
    const res = await api.get('/v1/leads-kpis/opportunities');
    const list = res.data?.data ?? res.data ?? [];
    return { data: Array.isArray(list) ? list.map(o => ({
      id: o.id,
      companyName: o.companyName || o.company_name || '',
      size: o.size || 'S',
      project: o.project?.name || o.project || '',
      fees: o.setupFee ?? o.fees ?? 0,
      expectedCloseDate: o.expectedCloseDate || o.expected_close_date || '',
      status: o.status || 'open',
    })) : [] };
  } catch {
    return { data: lsGetList(OPP_KEY) };
  }
};

export const addOpportunity = async (data) => {
  try {
    const payload = {
      companyName: data.companyName,
      size: data.size || 'S',
      projectId: data.projectId || undefined,
      setupFee: Number(data.fees) || 0,
      expectedCloseDate: data.expectedCloseDate || undefined,
    };
    const res = await api.post('/v1/leads-kpis/opportunities', payload);
    return { data: res.data?.data ?? res.data };
  } catch {
    const list = lsGetList(OPP_KEY);
    const newItem = { ...data, id: Date.now(), status: 'open' };
    list.push(newItem);
    lsSaveList(OPP_KEY, list);
    return { data: newItem };
  }
};

export const updateOpportunity = async (id, data) => {
  try {
    const res = await api.patch(`/v1/leads-kpis/opportunities/${id}`, {
      companyName: data.companyName,
      size: data.size,
      setupFee: Number(data.fees) || 0,
      expectedCloseDate: data.expectedCloseDate || undefined,
    });
    return { data: res.data?.data ?? res.data };
  } catch {
    const list = lsGetList(OPP_KEY);
    const idx = list.findIndex(o => o.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data };
      lsSaveList(OPP_KEY, list);
      return { data: list[idx] };
    }
    return { data: { ...data, id } };
  }
};

export const convertToWon = async (id) => {
  return convertOpportunityToWon(id, new Date().toISOString().split('T')[0]);
};

export const convertOpportunityToWon = async (id, signedDate) => {
  try {
    const res = await api.post(`/v1/leads-kpis/opportunities/${id}/won`, { signedDate });
    return { data: res.data?.data ?? { id, status: 'won', signedDate } };
  } catch {
    const list = lsGetList(OPP_KEY);
    const opp = list.find(o => o.id === id);
    if (opp) {
      opp.status = 'won';
      opp.wonDate = signedDate;
      lsSaveList(OPP_KEY, list);
    }

    const deals = lsGetList(DEAL_KEY);
    const newDeal = {
      id: Date.now() + Math.random(),
      customer: opp?.companyName || 'Unknown',
      contract: opp?.project || '-',
      finalFees: Number(opp?.fees || 0),
      signedDate: signedDate || new Date().toISOString().split('T')[0],
      status: 'completed',
    };
    deals.push(newDeal);
    lsSaveList(DEAL_KEY, deals);

    return { data: { id, status: 'won', signedDate } };
  }
};

// ===================== CLOSED DEALS =====================

export const getClosedDeals = async () => {
  try {
    const res = await api.get('/v1/leads-kpis/closed-deals');
    const list = res.data?.data ?? res.data ?? [];
    return { data: Array.isArray(list) ? list.map(d => ({
      id: d.id,
      customer: d.companyName || d.company_name || d.customer || '',
      contract: d.project?.name || d.contract || '',
      finalFees: d.setupFee ?? d.finalFees ?? 0,
      signedDate: d.closedDate || d.signedDate || d.closed_date || '',
      status: 'completed',
    })) : [] };
  } catch {
    return { data: lsGetList(DEAL_KEY) };
  }
};

// ===================== EXPENSES =====================

export const getExpenseSystemParams = async () => {
  try {
    const res = await api.get('/v1/system-configs', { params: { key: 'expense_params' } });
    return { data: res.data?.data ?? res.data ?? [] };
  } catch {
    const key = `${LS_PREFIX}expense_params`;
    return { data: lsGet(key) || [] };
  }
};

export const saveExpenseSystemParam = async (data) => {
  try {
    const payload = {
      key: 'expense_params',
      periodType: 'month',
      year: data.period ? parseInt(data.period.split('-')[0], 10) : new Date().getFullYear(),
      periodValue: data.period ? parseInt(data.period.split('-')[1], 10) : null,
      value: data.churnRate || 0,
      notes: data.note || '',
    };
    const res = await api.post('/v1/system-configs', payload);
    return { data: res.data?.data ?? res.data };
  } catch {
    const key = `${LS_PREFIX}expense_params`;
    const list = lsGetList(key);
    const newItem = { ...data, id: Date.now() };
    list.push(newItem);
    lsSaveList(key, list);
    return { data: newItem };
  }
};

export const getExpenseList = async (project) => {
  try {
    const params = {};
    if (project) params.projectId = project;
    const res = await api.get('/v1/expense-records', { params });
    return { data: res.data?.data ?? res.data ?? [] };
  } catch {
    const key = `${LS_PREFIX}expense_list`;
    let list = lsGetList(key);
    if (project) list = list.filter(e => e.project === project || e.projectId === project);
    return { data: list };
  }
};

export const saveExpense = async (data) => {
  try {
    const periodParts = (data.period || '').split('-');
    const payload = {
      projectId: data.projectId || data.project,
      month: parseInt(periodParts[1], 10) || new Date().getMonth() + 1,
      year: parseInt(periodParts[0], 10) || new Date().getFullYear(),
      directCost: Number(data.directCost) || 0,
      directNotes: data.directNote || '',
      overheadCost: Number(data.overhead) || 0,
      overheadNotes: data.overheadNote || '',
    };
    const res = await api.post('/v1/expense-records', payload);
    return { data: res.data?.data ?? res.data };
  } catch {
    const key = `${LS_PREFIX}expense_list`;
    const list = lsGetList(key);
    const newItem = { ...data, id: Date.now() };
    list.push(newItem);
    lsSaveList(key, list);
    return { data: newItem };
  }
};

export const getExpenseReports = async () => {
  try {
    const res = await api.get('/v1/expense-reports');
    return { data: res.data?.data ?? res.data };
  } catch {
    return { data: { costByProjectType: [], trendData: [], budgetVsActual: [], detailRows: [], totalProjects: 0 } };
  }
};

export const getExpenseOverview = async () => {
  try {
    const res = await api.get('/v1/expense-overview');
    return { data: res.data?.data ?? res.data };
  } catch {
    const key = `${LS_PREFIX}expense_overview`;
    return { data: lsGet(key) || { kpis: [], budgetAllocation: [], projectExpenses: [], totalProjects: 0 } };
  }
};

export const getProjectsDropdown = async () => {
  try {
    const res = await getProjects();
    const projects = Array.isArray(res.data) ? res.data : [];
    return { data: projects.map(p => ({ id: p.id, name: p.name })) };
  } catch {
    return { data: lsGet(`${LS_PREFIX}projects_dropdown`) || [] };
  }
};

export const getBackupData = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { data: { snapshots: [], totalSize: '0 B', lastBackup: null, integrityCheck: 'N/A', diskUsage: '0 / 0 GB', autoSnapshot: 'None' } };
};

export const getDropdownKeys = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const key = `${LS_PREFIX}dropdown_keys`;
  const stored = lsGet(key);
  return { data: stored || [] };
};

export const addDropdownValue = async (keyId, label) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const keys = lsGetList(`${LS_PREFIX}dropdown_keys`);
  const k = keys.find(k => k.id === keyId);
  if (k) {
    const newVal = { id: Date.now(), label };
    if (!k.values) k.values = [];
    k.values.push(newVal);
    lsSaveList(`${LS_PREFIX}dropdown_keys`, keys);
    return { data: newVal };
  }
  return { data: { id: Date.now(), label } };
};

export const deleteDropdownValue = async (keyId, valueId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const keys = lsGetList(`${LS_PREFIX}dropdown_keys`);
  const k = keys.find(k => k.id === keyId);
  if (k && k.values) {
    k.values = k.values.filter(v => v.id !== valueId);
    lsSaveList(`${LS_PREFIX}dropdown_keys`, keys);
  }
  return { success: true };
};

export const deleteCompareData = async (years) => {
  try {
    await api.delete('/v1/compare/data', { data: { years } });
  } catch {
    // backend may not support this endpoint
  }
  return { success: true };
};

export const generateAIReport = async (params) => {
  const payload = {
    data: params.compareData,
    years: params.years,
    periodType: params.periodType,
    periodValue: params.periodValue,
    insights: params.insights,
  };
  try {
    const res = await api.post('/v1/ai/report', payload);
    return { data: res.data };
  } catch {
    const report = buildLocalAIReport(payload);
    return { data: report };
  }
};

function buildLocalAIReport({ data, years, insights }) {
  const baseYear = years?.[0] || '2026';
  const base = data?.[baseYear] || {};
  const rl = base['Raw Leads'];
  const mql = base['MQL'];
  const sql = base['SQL'];
  const won = base['Won Value'];
  const lines = [];
  lines.push(`BÁO CÁO PHÂN TÍCH MARKETING - ${baseYear}\n`);
  lines.push(`1. Tổng quan`);
  lines.push(`   - Raw Leads: ${rl?.actual?.toLocaleString() || 0} (đạt ${Math.round(rl?.percentVsPlan || 0)}% kế hoạch)`);
  lines.push(`   - MQL: ${mql?.actual?.toLocaleString() || 0}`);
  lines.push(`   - SQL: ${sql?.actual?.toLocaleString() || 0}`);
  lines.push(`   - Giá trị thắng: $${(won?.actual || 0).toLocaleString()}\n`);
  lines.push(`2. Hiệu suất chuyển đổi`);
  const mqlRate = rl?.actual > 0 ? ((mql?.actual || 0) / rl.actual * 100).toFixed(1) : '0.0';
  const sqlRate = mql?.actual > 0 ? ((sql?.actual || 0) / mql.actual * 100).toFixed(1) : '0.0';
  lines.push(`   - Tỷ lệ MQL/Raw Leads: ${mqlRate}%`);
  lines.push(`   - Tỷ lệ SQL/MQL: ${sqlRate}%\n`);
  lines.push(`3. Khuyến nghị`);
  if (rl?.percentVsPlan < 100) lines.push(`   - Tăng cường chiến dịch tạo Lead để đạt chỉ tiêu.`);
  else lines.push(`   - Duy trì hiệu suất tạo Lead hiện tại.`);
  if (sql?.percentVsPlan < 100) lines.push(`   - Cải thiện chất lượng Lead để nâng tỷ lệ SQL.`);
  lines.push(`   - Rà soát ngân sách CAC/LTV để tối ưu ROI.`);
  return { report: lines.join('\n'), generatedAt: new Date().toISOString() };
}

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
  getFunnelData,
  getKpiCardsData,
  getKPIRollover,
  getCompareData,
  getQuarterlyCompareData,
  convertOpportunityToWon,
  getMembers,
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
  deleteCompareData,
  generateAIReport,
};
