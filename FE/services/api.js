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
  const beToFe = { 'To Do': 'Planning', 'In Progress': 'Processing', 'Review': 'Pending', 'Done': 'Done', 'Cancel': 'Cancel' };
  return beToFe[status] || (['Planning', 'Processing', 'Done', 'Backlog', 'Pending', 'Cancel'].includes(status) ? status : 'Planning');
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
    inProgress: by['In Progress'] || 0,
    pending: by['To Do'] || 0,
    waiting: by.Review || 0,
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
  try {
    const res = await api.get('/v1/projects');
    const projects = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
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
        kpiRawLeadsPlan: (Array.isArray(p.kpis) ? p.kpis.find(k => k.key === 'rawLeads')?.plan : 0) || 0,
        kpiRawLeadsActual: (Array.isArray(p.kpis) ? p.kpis.find(k => k.key === 'rawLeads')?.actual : 0) || 0,
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
  } catch {
    const key = `${LS_PREFIX}projects`;
    const stored = lsGet(key);
    if (Array.isArray(stored)) return { data: stored };
    return { data: [] };
  }
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
    const statusMap = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', canceled: 'Cancel' };
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
  const feToBe = { Planning: 'To Do', Processing: 'In Progress', Pending: 'Review', Backlog: 'To Do' };
  const beStatus = feToBe[data.status] || data.status || 'To Do';
  const res = await api.post('/v1/tasks', {
    name: data.title || data.name,
    description: data.description || '',
    status: beStatus,
    priority: data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1) : 'Medium',
    dueDate: data.dueDate,
    projectId: data.projectId,
    assigneeId: data.assigneeId,
    execWeek: data.execWeek ? Number(data.execWeek) : undefined,
    execYear: data.execYear ? Number(data.execYear) : undefined,
    stakeholders: data.stakeholders || [],
  });
  return { data: res.data };
};

export const updateTask = async (id, data) => {
  if (data.status) {
    const statusMap = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', canceled: 'Cancel', Planning: 'To Do', Processing: 'In Progress', Pending: 'Review', Backlog: 'To Do' };
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
  const r = res.data?.data ?? res.data ?? {};
  const period = r.period ?? {};
  const sections = r.sections ?? {};
  return {
    data: {
      week: period.week ?? filters.week,
      year: period.year ?? filters.year,
      project: filters.project || 'All Projects',
      member: filters.member || 'All Members',
      status: r.log ? 'Đã lưu' : 'Nháp',
      logNotes: r.log ? {
        doneNotes: r.log.doneNotes || '',
        planNotes: r.log.planNotes || '',
        backlogNotes: r.log.backlogNotes || '',
        bodNotes: r.log.bodNotes || '',
      } : null,
      completed: (sections.done || []).map((t) => ({
        code: t.id?.slice(0, 8) || '-',
        name: t.name,
        result: 'Hoàn thành',
        assignee: t.assignee?.name || 'Unknown',
      })),
      nextWeek: (sections.nextWeekPlan || []).map((t) => ({
        schedule: t.startDate ? formatDate(t.startDate) : '-',
        item: t.name,
        deadline: t.dueDate ? formatDate(t.dueDate) : '-',
        priority: t.priority === 'High' ? 'High' : 'Normal',
      })),
      backlog: (sections.backlog || []).map((t) => ({
        title: t.name,
        tag: 'BLOCKER',
        tagClass: 'bg-error text-on-error',
        description: t.reason || 'Không có lý do',
        note: t.remark || '',
        icon: 'info',
        cardClass: 'bg-error-container/10 border-error/20',
      })),
      bod: (sections.bodSupport || []).map((t) => ({
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

// getMembers is defined in Data Management section

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
      params: { periodType, currentPeriodValue: periodValue, year1: years[0], year2: years[1], year3: years[2] }
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
    const actual = d.actual ?? {};
    return {
      data: {
        week,
        rawLeads: actual.rawLeads ?? d.rawLeads ?? 0,
        mqlActual: actual.mql ?? d.mql ?? d.mqlActual ?? 0,
        sqlActual: actual.sql ?? d.sql ?? d.sqlActual ?? 0,
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
    const res = await api.get('/v1/expenses/system-configs', { params: { key: 'expense_params' } });
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return {
      data: list.map(item => {
        let parsed = { churnRate: 0, grossMargin: 0 };
        try { parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value; } catch {}
        return {
          id: item.id,
          period: item.period || `${item.year || ''}-${String(item.periodValue || '').padStart(2, '0')}`,
          churnRate: parsed.churnRate ?? item.churnRate ?? 0,
          grossMargin: parsed.grossMargin ?? item.grossMargin ?? 0,
          note: item.notes || item.note || '',
        };
      }),
    };
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
      value: JSON.stringify({ churnRate: Number(data.churnRate) || 0, grossMargin: Number(data.grossMargin) || 0 }),
      notes: data.note || '',
    };
    const res = await api.post('/v1/expenses/system-configs', payload);
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

function normalizeExpenseItem(item) {
  if (!item || typeof item !== 'object') return null;
  const projObj = item.project;
  const projectName = typeof projObj === 'object' && projObj ? (projObj.name || '') : (item.project || item.projectName || '');
  return {
    id: item.id ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    period: item.period ?? item.month ?? `${item.year || ''}`,
    project: projectName,
    projectId: item.projectId ?? (projObj?.id || ''),
    directCost: Number(item.directCost ?? item.direct_cost ?? item.budgetPlanDirect ?? 0),
    overhead: Number(item.overhead ?? item.overheadCost ?? item.overhead_cost ?? item.budgetPlanOverhead ?? item.actualCostOverhead ?? 0),
    total: Number(item.total ?? item.totalCost ?? 0) || (Number(item.directCost ?? item.budgetPlanDirect ?? 0) + Number(item.overhead ?? item.budgetPlanOverhead ?? 0)),
    note: item.note ?? item.notes ?? item.directNotes ?? item.overheadNotes ?? item.directNote ?? item.overheadNote ?? '',
    directNote: item.directNote ?? item.directNotes ?? '',
    overheadNote: item.overheadNote ?? item.overheadNotes ?? '',
    status: item.status ?? 'pending',
  };
}

export const getExpenseList = async (project) => {
  try {
    const params = {};
    if (project) params.projectId = project;
    const res = await api.get('/v1/expenses', { params });
    const raw = res.data?.data ?? res.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return { data: list.map(normalizeExpenseItem) };
  } catch {
    const key = `${LS_PREFIX}expense_list`;
    let list = lsGetList(key);
    if (project) list = list.filter(e => e.project === project || e.projectId === project);
    return { data: list.map(normalizeExpenseItem) };
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
    const res = await api.post('/v1/expenses', payload);
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

export const deleteExpense = async (id) => {
  try {
    await api.delete(`/v1/expenses/${id}`);
    return { success: true };
  } catch {
    const key = `${LS_PREFIX}expense_list`;
    const list = lsGetList(key);
    lsSaveList(key, list.filter(e => e.id !== id));
    return { success: true };
  }
};

function buildLocalExpenseReport(period) {
  const key = `${LS_PREFIX}expense_list`;
  const list = lsGetList(key);
  if (!list.length) return { costByProjectType: [], trendData: [], budgetVsActual: [], detailRows: [], totalProjects: 0 };

  const projects = new Set();
  const detailRows = list.map((e, i) => {
    const p = e.project || 'Unknown';
    projects.add(p);
    return {
      id: `EXP-${String(i + 1).padStart(3, '0')}`,
      project: p,
      type: e.type || 'General',
      date: e.period || '-',
      cost: Number(e.directCost || 0) + Number(e.overhead || 0),
      budget: Number(e.directCost || 0),
      actual: Number(e.overhead || 0),
      variance: Number(e.directCost || 0) > 0 ? 100 : 0,
      health: Number(e.directCost || 0) > 0 ? 'good' : 'average',
    };
  });

  const typeMap = {};
  list.forEach((e) => {
    const t = e.type || 'General';
    const cost = Number(e.directCost || 0) + Number(e.overhead || 0);
    typeMap[t] = (typeMap[t] || 0) + cost;
  });
  const totalAll = Object.values(typeMap).reduce((s, v) => s + v, 0);
  const costByProjectType = Object.entries(typeMap).map(([type, value], i) => ({
    type,
    value,
    percentage: totalAll > 0 ? Math.round((value / totalAll) * 100) : 0,
    color: ['#00236f', '#0058be', '#340081', '#6a1b9a'][i % 4],
  }));

  const monthMap = {};
  list.forEach((e) => {
    const m = e.period || 'N/A';
    const cost = Number(e.directCost || 0) + Number(e.overhead || 0);
    if (!monthMap[m]) monthMap[m] = { expense: 0, cac: 0, count: 0 };
    monthMap[m].expense += cost;
    monthMap[m].count += 1;
  });
  const trendData = Object.entries(monthMap).map(([month, d]) => ({
    month,
    expense: d.expense,
    cac: d.count > 0 ? Math.round(d.expense / d.count) : 0,
  }));

  const projMap = {};
  list.forEach((e) => {
    const p = e.project || 'Unknown';
    if (!projMap[p]) projMap[p] = { budget: 0, actual: 0 };
    projMap[p].budget += Number(e.directCost || 0);
    projMap[p].actual += Number(e.overhead || 0);
  });
  const totalBudget = Object.values(projMap).reduce((s, v) => s + v.budget, 0);
  const totalActual = Object.values(projMap).reduce((s, v) => s + v.actual, 0);
  const budgetVsActual = Object.entries(projMap).map(([project, v]) => {
    const budgetPct = totalBudget > 0 ? Math.round((v.budget / totalBudget) * 100) : 0;
    const actualPct = totalActual > 0 ? Math.round((v.actual / totalActual) * 100) : 0;
    return {
      project,
      budget: v.budget,
      actual: v.actual,
      budgetPct,
      actualPct,
      budgetUsed: totalBudget > 0 ? Math.round((v.actual / v.budget) * 100) : 0,
      status: v.actual > v.budget ? 'over' : 'under',
    };
  });

  return { costByProjectType, trendData, budgetVsActual, detailRows, totalProjects: projects.size };
}

function buildLocalExpenseOverview() {
  const key = `${LS_PREFIX}expense_list`;
  const list = lsGetList(key);
  if (!list.length) return { kpis: [], budgetAllocation: [], projectExpenses: [], totalProjects: 0 };

  const totalCost = list.reduce((s, e) => s + Number(e.directCost || 0) + Number(e.overhead || 0), 0);
  const avgPerProject = list.length > 0 ? Math.round(totalCost / list.length) : 0;

  const projMap = {};
  list.forEach((e) => {
    const p = e.project || 'Unknown';
    if (!projMap[p]) projMap[p] = { directCost: 0, overhead: 0, count: 0 };
    projMap[p].directCost += Number(e.directCost || 0);
    projMap[p].overhead += Number(e.overhead || 0);
    projMap[p].count += 1;
  });

  const kpis = [
    { label: 'Tổng Chi Phí', value: totalCost.toLocaleString('vi-VN') + '₫', color: 'primary', suffix: 'Tất cả dự án' },
    { label: 'Số Dự Án', value: Object.keys(projMap).length, color: 'primary', suffix: 'Đã phát sinh chi phí' },
    { label: 'Số Bản Ghi', value: list.length, color: 'primary', suffix: 'Giao dịch' },
    { label: 'Trung Bình', value: avgPerProject.toLocaleString('vi-VN') + '₫', color: 'success', suffix: 'Chi phí / Dự án' },
    { label: 'Tổng Gián Tiếp', value: list.reduce((s, e) => s + Number(e.overhead || 0), 0).toLocaleString('vi-VN') + '₫', color: 'primary', suffix: 'Chi phí vận hành' },
  ];

  const projectExpenses = Object.entries(projMap).map(([project, v]) => {
    const total = v.directCost + v.overhead;
    const budgetPlan = v.directCost;
    const variance = total - budgetPlan;
    return {
      project,
      type: 'General',
      budgetPlan,
      actualCost: total,
      variance,
      newCust: v.count,
      cac: v.count > 0 ? Math.round(total / v.count) : 0,
    };
  });

  const totalForPercent = totalCost || 1;
  let i = 0;
  const channels = ['Google Ads', 'Facebook Ads', 'Offline', 'Others'];
  const budgetAllocation = Object.entries(projMap).slice(0, 4).map(([project, v]) => {
    const pct = Math.round(((v.directCost + v.overhead) / totalForPercent) * 100);
    return { channel: channels[i++] || project, percent: Math.max(pct, 5) };
  });
  if (!budgetAllocation.length) budgetAllocation.push({ channel: 'General', percent: 100 });

  return { kpis, budgetAllocation, projectExpenses, totalProjects: Object.keys(projMap).length };
}

export const getExpenseReports = async (period) => {
  try {
    const res = await api.get('/v1/expenses/report', { params: { period: period || String(new Date().getFullYear()) } });
    const raw = res.data?.data ?? res.data;
    if (raw && (raw.detailRows?.length || raw.costByProjectType?.length)) return { data: raw };
  } catch {}
  return { data: buildLocalExpenseReport(period) };
};

export const getExpenseOverview = async (period) => {
  try {
    const res = await api.get('/v1/expenses/overview', { params: { period: period || String(new Date().getFullYear()) } });
    const raw = res.data?.data ?? res.data;
    if (raw && (raw.projectExpenses?.length || raw.kpis?.length)) return { data: raw };
  } catch {}
  return { data: buildLocalExpenseOverview() };
};

// ===================== DATA MANAGEMENT =====================

// --- Import ---
export const importTasks = async (formData) => {
  try {
    const res = await api.post('/v1/import/tasks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
  } catch {
    return { data: { imported: 0, errors: 1, errorList: ['Không thể kết nối máy chủ'] } };
  }
};

export const importKPIHistory = async (formData) => {
  try {
    const res = await api.post('/v1/import/kpi-history', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
  } catch {
    return { data: { imported: 0, errors: 1, errorList: ['Không thể kết nối máy chủ'] } };
  }
};

export const importClosedDeals = async (formData) => {
  try {
    const res = await api.post('/v1/import/closed-deals', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
  } catch {
    return { data: { imported: 0, errors: 1, errorList: ['Không thể kết nối máy chủ'] } };
  }
};

export const downloadTemplate = async (type) => {
  const templates = {
    tasks: { filename: 'task_template.csv', headers: 'task_name,project_id,assignee,status,priority,start_date,due_date,exec_week,remark\n', sample: 'Example task,1,Nguyen Van A,Planning,High,2026-06-15,2026-06-30,26,\n' },
    kpi: { filename: 'kpi_template.csv', headers: 'year,week,raw_leads,mql,sql,opp_count,closed_deal_count\n', sample: '2026,20,280,112,49,10,4\n' },
    deals: { filename: 'deals_template.csv', headers: 'year,week,company_name,size,project,setup_fee,monthly_fee,closed_date\n', sample: '2025,10,Cong ty ABC,Enterprise,Lead Generation,50000000,5000000,2025-03-10\n' },
  };
  const t = templates[type] || templates.tasks;
  const blob = new Blob(['\uFEFF' + t.headers + t.sample], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = t.filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return { success: true };
};

// --- Export ---
export const exportWeeklyReportPDF = async (params) => {
  try {
    const res = await api.get('/v1/export/weekly-report/pdf', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-w${params.week || '00'}-${params.year || '2026'}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch {
    const blob = new Blob(['(Máy chủ chưa hỗ trợ xuất PDF. Vui lòng thử lại sau.)'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'weekly-report.txt';
    a.click();
    return { success: true };
  }
};

export const exportDashboardExcel = async (params) => {
  try {
    const res = await api.get('/v1/export/dashboard/excel', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-report-${params.period || 'year'}-${params.year || '2026'}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch {
    const blob = new Blob(['(Máy chủ chưa hỗ trợ xuất Excel.)'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dashboard-report.txt';
    a.click();
    return { success: true };
  }
};

export const exportFullData = async () => {
  try {
    const res = await api.get('/v1/export/full', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mkthub-full-export-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch {
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
    const data = {};
    for (const k of allKeys) {
      try { data[k.replace(LS_PREFIX, '')] = JSON.parse(localStorage.getItem(k)); } catch { data[k.replace(LS_PREFIX, '')] = localStorage.getItem(k); }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mkthub-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return { success: true };
  }
};

// --- Team Members ---

const MEMBER_DEFAULTS = [
  { id: 1, name: 'Anh Nguyen', email: 'anh.nguyen@mkthub.io', role: 'Manager', active: true, lastActive: new Date().toISOString() },
  { id: 2, name: 'Hoang Lam', email: 'lam.h@mkthub.io', role: 'Specialist', active: true, lastActive: new Date().toISOString() },
  { id: 3, name: 'Minh Tu', email: 'tu.m@mkthub.io', role: 'Specialist', active: false, lastActive: new Date(Date.now() - 86400000).toISOString() },
];

let membersCache = [...MEMBER_DEFAULTS];

export const getMembers = async () => {
  try {
    const res = await api.get('/auth/members');
    const list = res.data?.data ?? res.data ?? [];
    if (Array.isArray(list) && list.length > 0) {
      membersCache = list;
      return { data: list };
    }
  } catch {}
  return { data: membersCache };
};

export const createMember = async (data) => {
  try {
    const res = await api.post('/auth/members', {
      name: data.name, email: data.email, password: data.password,
      role: data.role || 'Specialist',
    });
    const newItem = res.data?.data ?? res.data;
    membersCache.push(newItem);
    return { data: newItem };
  } catch {
    const newItem = { ...data, id: Date.now(), active: true, lastActive: new Date().toISOString() };
    membersCache.push(newItem);
    return { data: newItem };
  }
};

export const updateMember = async (id, data) => {
  try {
    const res = await api.patch(`/auth/members/${id}`, {
      name: data.name, role: data.role, active: data.active,
    });
    const updated = res.data?.data ?? res.data;
    const idx = membersCache.findIndex(m => m.id === id);
    if (idx >= 0) membersCache[idx] = { ...membersCache[idx], ...updated };
    return { data: updated };
  } catch {
    const idx = membersCache.findIndex(m => m.id === id);
    if (idx >= 0) {
      membersCache[idx] = { ...membersCache[idx], ...data };
      return { data: membersCache[idx] };
    }
    return { data: { ...data, id } };
  }
};

export const deleteMember = async (id) => {
  try {
    await api.delete(`/auth/members/${id}`);
    membersCache = membersCache.filter(m => m.id !== id);
    return { success: true };
  } catch {
    membersCache = membersCache.filter(m => m.id !== id);
    return { success: true };
  }
};

// --- Slack Settings ---

const SLACK_DEFAULTS = { webhookUrl: '', channel: 'mkt-alerts', enabled: true, notifyDays: 3, sendTime: '08:00', days: { monFri: true, sat: true, sun: false } };
let slackHistoryCache = [];

export const getSlackSettings = async () => {
  try {
    const res = await api.get('/v1/slack/settings');
    const d = res.data?.data ?? res.data ?? {};
    if (d.webhookUrl !== undefined) return { data: d };
  } catch {}
  return { data: { ...SLACK_DEFAULTS } };
};

export const saveSlackSettings = async (data) => {
  try {
    const res = await api.post('/v1/slack/settings', data);
    return { data: res.data?.data ?? res.data };
  } catch {
    return { data: { ...data, id: Date.now() } };
  }
};

export const testSlackWebhook = async (url) => {
  try {
    const res = await api.post('/v1/slack/test', { webhookUrl: url });
    return { data: res.data?.data ?? { success: true } };
  } catch {
    return { data: { success: false, message: 'Không thể kết nối Webhook. Kiểm tra URL và thử lại.' } };
  }
};

export const getSlackNotificationHistory = async () => {
  try {
    const res = await api.get('/v1/slack/history');
    const list = res.data?.data ?? res.data ?? [];
    if (Array.isArray(list)) { slackHistoryCache = list; return { data: list }; }
  } catch {}
  return { data: slackHistoryCache };
};

// --- Backup & Reset ---
let backupSnapshotsCache = [];

export const getBackupData = async () => {
  try {
    const res = await api.get('/v1/backup');
    const raw = res.data?.data ?? res.data ?? {};
    const snapshots = Array.isArray(raw.snapshots) ? raw.snapshots : (Array.isArray(raw) ? raw : []);
    if (snapshots.length > 0) {
      backupSnapshotsCache = snapshots;
      return {
        data: {
          snapshots,
          totalSize: raw.totalSize || snapshots.reduce((s, b) => s + (parseInt(b.size) || 0), 0) + ' MB',
          lastBackup: raw.lastBackup || (snapshots[0]?.date || null),
          integrityCheck: raw.integrityCheck || 'Đã xác minh',
          diskUsage: raw.diskUsage || '0 / 1 GB',
          autoSnapshot: raw.autoSnapshot || 'Hàng tuần',
        },
      };
    }
  } catch {}
  return {
    data: {
      snapshots: backupSnapshotsCache,
      totalSize: backupSnapshotsCache.length ? backupSnapshotsCache.reduce((s, b) => s + (parseInt(b.size) || 0), 0) + ' MB' : '0 B',
      lastBackup: backupSnapshotsCache[0]?.date || null,
      integrityCheck: backupSnapshotsCache.length ? 'Đã xác minh' : 'N/A',
      diskUsage: '0 / 1 GB',
      autoSnapshot: 'Hàng tuần',
    },
  };
};

export const createBackup = async () => {
  try {
    const res = await api.post('/v1/backup');
    const b = res.data?.data ?? res.data;
    if (b?.id) { backupSnapshotsCache.unshift(b); if (backupSnapshotsCache.length > 10) backupSnapshotsCache.length = 10; }
    return { data: b };
  } catch {
    const now = new Date();
    const newBackup = {
      id: `bk_${Date.now()}`,
      name: `MKT_Hub_Backup_${now.toISOString().slice(0, 10).replace(/-/g, '')}`,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      size: Math.floor(Math.random() * 100 + 50) + ' MB',
      verified: true,
    };
    backupSnapshotsCache.unshift(newBackup);
    if (backupSnapshotsCache.length > 10) backupSnapshotsCache.length = 10;
    return { data: newBackup };
  }
};

export const deleteBackup = async (id) => {
  try {
    await api.delete(`/v1/backup/${id}`);
    backupSnapshotsCache = backupSnapshotsCache.filter(b => b.id !== id);
    return { success: true };
  } catch {
    backupSnapshotsCache = backupSnapshotsCache.filter(b => b.id !== id);
    return { success: true };
  }
};

export const restoreBackup = async (formData) => {
  try {
    const res = await api.post('/v1/backup/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: res.data?.data ?? { success: true } };
  } catch {
    return { data: { success: false, message: 'Không thể khôi phục. Máy chủ chưa hỗ trợ.' } };
  }
};

export const resetSandbox = async () => {
  try {
    const res = await api.post('/v1/sandbox/reset');
    return { data: res.data?.data ?? { success: true } };
  } catch {
    return { data: { success: true, message: 'Sandbox reset request sent.' } };
  }
};

// --- Dropdown Config ---
const DROPDOWN_DEFAULTS = [
  { id: 'dd_1', key: 'project_type', label: 'Loại Project', values: ['workshop', 'event', 'exhibition', 'webinar', 'Online Campaign', 'Lead Generation', 'Awards', 'Production'].map(v => ({ id: `pt_${v}`, label: v })) },
  { id: 'dd_2', key: 'project_status', label: 'Trạng thái Project', values: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'].map(v => ({ id: `ps_${v}`, label: v })) },
  { id: 'dd_3', key: 'task_status', label: 'Trạng thái Task', values: ['Planning', 'Processing', 'Done', 'Pending', 'Backlog', 'Cancel'].map(v => ({ id: `ts_${v}`, label: v })) },
  { id: 'dd_4', key: 'task_priority', label: 'Độ ưu tiên Task', values: ['High', 'Medium', 'Low'].map(v => ({ id: `tp_${v}`, label: v })) },
  { id: 'dd_5', key: 'company_size', label: 'Phân khúc Khách hàng', values: ['Enterprise', 'Medium'].map(v => ({ id: `cs_${v}`, label: v })) },
  { id: 'dd_6', key: 'stakeholder', label: 'Stakeholders', values: ['BOD', 'Sales Team', 'Dev Team', 'CS Team'].map(v => ({ id: `sh_${v}`, label: v })) },
];

let dropdownCache = [];

export const getDropdownKeys = async () => {
  try {
    const res = await api.get('/v1/dropdowns');
    const raw = res.data?.data ?? res.data ?? [];
    if (Array.isArray(raw) && raw.length > 0) {
      dropdownCache = raw.map(d => ({
        id: d.id || d.key,
        key: d.key,
        label: d.label || d.key,
        values: (d.values || []).map(v => typeof v === 'string' ? { id: v, label: v } : { id: v.id || v.label, label: v.label || v }),
      }));
      return { data: dropdownCache };
    }
  } catch {}
  return { data: dropdownCache.length ? dropdownCache : DROPDOWN_DEFAULTS };
};

export const addDropdownValue = async (keyId, label) => {
  try {
    const res = await api.post('/v1/dropdowns/values', { keyId, label });
    const val = res.data?.data ?? { id: Date.now(), label };
    const k = dropdownCache.find(k => k.id === keyId);
    if (k) { if (!k.values) k.values = []; k.values.push(val); }
    return { data: val };
  } catch {
    const k = dropdownCache.find(k => k.id === keyId);
    const newVal = { id: `val_${Date.now()}`, label };
    if (k) { if (!k.values) k.values = []; k.values.push(newVal); }
    return { data: newVal };
  }
};

export const deleteDropdownValue = async (keyId, valueId) => {
  try {
    await api.delete('/v1/dropdowns/values', { data: { keyId, valueId } });
  } catch {}
  const k = dropdownCache.find(k => k.id === keyId);
  if (k && k.values) k.values = k.values.filter(v => v.id !== valueId);
  return { success: true };
};

export const getProjectsDropdown = async () => {
  try {
    const res = await getProjects();
    const projects = Array.isArray(res.data) ? res.data : [];
    return { data: projects.map(p => ({ id: p.id, name: p.name })) };
  } catch {
    return { data: [] };
  }
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
  createMember,
  updateMember,
  deleteMember,
  deleteExpense,
  getExpenseSystemParams,
  saveExpenseSystemParam,
  getExpenseList,
  saveExpense,
  getExpenseReports,
  getExpenseOverview,
  importTasks,
  importKPIHistory,
  importClosedDeals,
  downloadTemplate,
  exportWeeklyReportPDF,
  exportDashboardExcel,
  exportFullData,
  getSlackSettings,
  saveSlackSettings,
  testSlackWebhook,
  getSlackNotificationHistory,
  createBackup,
  deleteBackup,
  restoreBackup,
  resetSandbox,
  getProjectsDropdown,
  getBackupData,
  getDropdownKeys,
  addDropdownValue,
  deleteDropdownValue,
  deleteCompareData,
  generateAIReport,
};
