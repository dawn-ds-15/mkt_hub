import { filterDeleted, markDeleted, getDeletedIds } from '../utils/softDelete';
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
  if (config.method === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const body = err.response?.data;
    const isUnauthorized = err.response?.status === 401 || body?.statusCode === 401 || body?.message === 'Unauthorized';
    if (isUnauthorized && !err.config?.url?.includes('/auth/login')) {
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
  if (isOverdue || status === 'Overdue') return 'overdue';
  const beToFe = { 'To Do': 'Planning', 'In Progress': 'Processing', 'Review': 'Pending', 'Done': 'Done', 'Cancel': 'Cancel', 'Backlog': 'Backlog' };
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
  let rawAlerts = d.alerts ?? [];
  if (Array.isArray(rawAlerts)) {
    rawAlerts = filterDeleted('tasks', rawAlerts);
  } else {
    if (rawAlerts.overdue) rawAlerts = { ...rawAlerts, overdue: filterDeleted('tasks', rawAlerts.overdue) };
  }
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
    projectProgress: filterDeleted('projects', transformProjectProgress(d.progress ?? {}).projects),
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
  const res = await api.delete(`/v1/projects/${id}`);
  return { data: res.data };
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
  const rawTasks = res.data?.data ?? res.data?.tasks ?? res.data ?? [];
  const tasks = Array.isArray(rawTasks) ? rawTasks : [];
  return {
    data: tasks.map((t) => {
      const now = new Date();
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      const completed = t.completedDate || t.status === 'Done' || t.status === 'Cancel';
      const isOverdueLocal = dueDate && dueDate < now && !completed;
      return {
        id: t.id,
        project: t.project?.name || '-',
        taskName: t.name,
        description: t.description || '',
        assignee: { initials: getInitials(t.assignee?.name || ''), name: t.assignee?.name || 'Unknown' },
        stakeholders: (t.stakeholders || []).join(', '),
        status: taskStatusToMock(t.status, isOverdueLocal || t.isOverdue),
        priority: t.priority?.toLowerCase() || 'medium',
        start: t.startDate ? formatDate(t.startDate) : '-',
        startDate: t.startDate || '',
        due: t.dueDate ? formatDate(t.dueDate) : '-',
        dueDate: t.dueDate || '',
        done: t.completedDate ? formatDate(t.completedDate) : null,
        completedDate: t.completedDate || '',
        execWeek: t.execWeek || '',
        execYear: t.execYear || '',
        link: typeof t.link === 'object' ? t.link : (t.link ? { url: t.link } : null),
        linkUrl: typeof t.link === 'string' ? t.link : (t.link?.url || null),
        remark: t.remark || '',
        reason: t.reason || '',
        neededSupportBod: t.neededSupportBod || '',
      };
    }),
    total: res.data?.stats?.total || tasks.length,
  };
};

export const getTasks = async (filters) => {
  const params = {};
  if (filters?.project) params.projectId = filters.project;
  if (filters?.status) params.status = filters.status;
  const res = await api.get('/v1/tasks', { params });
  const items = Array.isArray(res.data?.data) ? res.data.data : [];
  return { data: items };
};

export const getTask = async (id) => {
  const res = await api.get(`/v1/tasks/${id}`);
  const t = res.data?.data ?? res.data;
  return {
    data: {
      id: t.id,
      project: t.project?.name || '-',
      taskName: t.name,
      description: t.description || '',
      assignee: { name: t.assignee?.name || 'Unknown' },
      stakeholders: Array.isArray(t.stakeholders) ? t.stakeholders.join(', ') : (t.stakeholders || ''),
      status: taskStatusToMock(t.status, t.isOverdue),
      priority: t.priority?.toLowerCase() || 'medium',
      start: t.startDate ? formatDate(t.startDate) : '-',
      startDate: t.startDate || '',
      due: t.dueDate ? formatDate(t.dueDate) : '-',
      dueDate: t.dueDate || '',
      done: t.completedDate ? formatDate(t.completedDate) : null,
      completedDate: t.completedDate || '',
      linkUrl: typeof t.link === 'string' ? t.link : (t.link?.url || null),
      remark: t.remark || '',
    },
  };
};

export const createTask = async (data) => {
  const statusMap = { Planning: 'To Do', Processing: 'In Progress', Pending: 'Review', Backlog: 'Backlog', Done: 'Done', Cancel: 'Cancel' };
  const beStatus = statusMap[data.status] || data.status || 'To Do';
  const res = await api.post('/v1/tasks', {
    name: data.title || data.name,
    description: data.description || '',
    status: beStatus,
    priority: data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1) : 'Medium',
    startDate: data.startDate,
    dueDate: data.dueDate,
    completedDate: data.completedDate,
    projectId: data.projectId,
    assigneeId: data.assigneeId,
    execWeek: data.execWeek ? Number(data.execWeek) : undefined,
    execYear: data.execYear ? Number(data.execYear) : undefined,
    stakeholders: data.stakeholders || [],
    link: data.link,
    remark: data.remark,
    neededSupportBod: data.neededSupportBod,
  });
  return { data: res.data };
};

export const updateTask = async (id, data) => {
  console.log(`[API] updateTask(${id}) payload:`, data);
  const res = await api.patch(`/v1/tasks/${id}`, data);
  console.log(`[API] updateTask(${id}) response:`, res.status, res.data);
  return { data: res.data };
};

export const deleteTask = async (id) => {
  const res = await api.delete(`/v1/tasks/${id}`);
  return { data: res.data };
};

// ===================== KANBAN =====================


const beToFeStatus = {
  'Planning': 'Planning', 'To Do': 'Planning',
  'Processing': 'Processing', 'In Progress': 'Processing',
  'Pending': 'Pending', 'Review': 'Pending',
  'Done': 'Done',
  'Cancel': 'Cancel',
  'Backlog': 'Backlog',
  'Overdue': 'Overdue',
};

const feStatusMeta = {
  planning: { title: 'CHƯA LÀM', badge: 'bg-slate-100 text-slate-700' },
  processing: { title: 'ĐANG LÀM', badge: 'bg-blue-100 text-blue-700' },
  done: { title: 'HOÀN THÀNH', badge: 'bg-green-100 text-green-700' },
  pending: { title: 'CHỜ XỬ LÝ', badge: 'bg-purple-100 text-purple-700' },
  cancel: { title: 'ĐÃ HUỶ', badge: 'bg-gray-100 text-gray-600' },
  backlog: { title: 'TỒN ĐỌNG', badge: 'bg-amber-100 text-amber-700' },
  overdue: { title: 'QUÁ HẠN', badge: 'bg-red-100 text-red-700' },
};

export const getKanbanData = async () => {
  const res = await api.get('/v1/tasks/kanban/board');
  const columns = res.data;
  const merged = {};
  if (!merged.overdue) {
    merged.overdue = { id: 'overdue', title: 'QUÁ HẠN', badgeColor: 'bg-red-100 text-red-700', badgeCount: 0, tasks: [] };
  }
  for (const col of columns) {
    const feStatus = beToFeStatus[col.status] || col.status;
    const id = feStatus.toLowerCase();
    if (!merged[id]) {
      const meta = feStatusMeta[id] || { title: feStatus.toUpperCase(), badge: 'bg-gray-50 text-gray-600' };
      merged[id] = { id, title: meta.title, badgeColor: meta.badge, badgeCount: 0, tasks: [] };
    }
    const deletedTasks = getDeletedIds('tasks');
    for (const t of col.tasks) {
      if (deletedTasks.has(t.id)) continue;
      const isOverdue = t.isOverdue;
      const isDone = t.status === 'Done' || t.status === 'done' || t.status === 'Cancel' || t.status === 'cancel';
      const targetId = isOverdue && !isDone ? 'overdue' : id;
      merged[targetId].tasks.push({
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
      });
    }
  }
  for (const col of Object.values(merged)) {
    col.badgeCount = col.tasks.length;
  }
  return { data: Object.values(merged) };
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
      completed: filterDeleted('tasks', (sections.done || [])).map((t) => ({
        code: t.id?.slice(0, 8) || '-',
        name: t.name,
        result: 'Hoàn thành',
        assignee: t.assignee?.name || 'Unknown',
      })),
      nextWeek: filterDeleted('tasks', (sections.nextWeekPlan || [])).map((t) => ({
        schedule: t.startDate ? formatDate(t.startDate) : '-',
        item: t.name,
        deadline: t.dueDate ? formatDate(t.dueDate) : '-',
        priority: t.priority === 'High' ? 'High' : 'Normal',
      })),
      backlog: filterDeleted('tasks', (sections.backlog || [])).map((t) => ({
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

export const getKpiCardsData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const res = await api.get('/v1/dashboard/kpi-cards', {
    params: { period_type: periodType, period_value: periodValue, year },
  });
  const apiCards = res.data?.data ?? res.data ?? [];
  return { data: apiCards };
};

export const getFunnelData = async (periodType = 'year', periodValue = '2026', year = '2026') => {
  const res = await api.get('/v1/dashboard/funnel', {
    params: { period_type: periodType, period_value: periodValue, year },
  });
  const apiData = res.data?.data ?? res.data ?? [];
  return { data: apiData };
};

// ===================== KPI ROLLOVER =====================

export const getKPIRollover = async (year, week) => {
  const res = await api.get('/v1/leads-kpis/weekly', { params: { year, week } });
  const d = res.data?.data ?? res.data ?? {};
  const p = d.planGoc ?? {};
  const a = d.actual ?? {};
  const labelMap = { rawLeads: 'Raw Leads', mql: 'MQL', sql: 'SQL', oppCount: 'Cơ hội (OPP)', closedCount: 'Closed Deal' };
  const items = Object.keys(labelMap).map(key => ({
    label: labelMap[key],
    weeklyTarget: p[key] ?? 0,
    currentActual: a[key] ?? 0,
  }));
  return { data: items };
};

// ===================== COMPARE PERIODS =====================

export const getCompareData = async (years = ['2026', '2025'], periodType = 'year', periodValue = '2026') => {
  const res = await api.get('/v1/leads-kpis/comparison', {
    params: { periodType, currentPeriodValue: periodValue, year1: years[0], year2: years[1], year3: years[2] }
  });
  const raw = res.data?.data ?? res.data ?? {};
  return { data: (raw && typeof raw === 'object') ? raw : {} };
};

export const getQuarterlyCompareData = async (selectedYears, metric = 'Raw Leads') => {
  const colors = ['bg-primary', 'bg-secondary-fixed-dim', 'bg-surface-container-highest', 'bg-gray-300'];
  const labelToKey = { 'Raw Leads': 'Raw Leads', 'MQL': 'MQL', 'SQL': 'SQL', 'Won Value': 'Won Value', 'Closed Deal': 'Closed Deal', 'OPP': 'OPP' };
  const apiMetric = labelToKey[metric] || 'Raw Leads';

  const datasets = await Promise.all(selectedYears.map(async (year, idx) => {
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
  }));

  return { data: { quarters: ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'], datasets } };
};

// ===================== PLAN KPIs =====================

export const getPlanKPIs = async (year) => {
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
};

export const savePlanKPIs = async (data) => {
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
};

export const saveActuals = async (data) => {
  const { year, week: weekNum } = parseWeekString(data.week);
  const payload = {
    year,
    week: weekNum,
    rawLeads: Number(data.rawLeads) || 0,
    mql: Number(data.mqlActual) || 0,
    sql: Number(data.sqlActual) || 0,
    oppCount: Number(data.oppCount) || 0,
    closedCount: Number(data.closedCount) || 0,
  };
  const res = await api.post('/v1/leads-kpis/weekly', payload);
  return { data: res.data?.data ?? res.data };
};

// ===================== OPPORTUNITIES =====================

function mapOppFromBE(o) {
  const sizeMap = { 'Enterprise': 'S', 'Medium': 'M' };
  return {
    id: o.id,
    companyName: o.companyName || '',
    size: sizeMap[o.size] || o.size || 'S',
    project: o.project?.name || o.projectName || '',
    projectId: o.projectId || '',
    fees: o.setupFee ?? 0,
    expectedCloseDate: o.expectedCloseDate || '',
    status: o.status || 'active',
  };
}

export const getOpportunities = async (year) => {
  try {
    const res = await api.get('/v1/leads-kpis/opportunities', { params: { year } });
    const list = res.data?.data ?? res.data ?? [];
    return { data: Array.isArray(list) ? list.map(mapOppFromBE) : [] };
  } catch {
    return { data: [] };
  }
};

export const addOpportunity = async (data) => {
  const feToBeSize = { 'S': 'Enterprise', 'M': 'Medium', 'L': 'Enterprise' };
  const res = await api.post('/v1/leads-kpis/opportunities', {
    companyName: data.companyName,
    size: feToBeSize[data.size] || 'Enterprise',
    projectId: data.projectId || undefined,
    setupFee: Number(data.fees) || 0,
    expectedCloseDate: data.expectedCloseDate || undefined,
  });
  return { data: mapOppFromBE(res.data?.data ?? res.data) };
};

export const updateOpportunity = async (id, data) => {
  const feToBeSize = { 'S': 'Enterprise', 'M': 'Medium', 'L': 'Enterprise' };
  const res = await api.patch(`/v1/leads-kpis/opportunities/${id}`, {
    companyName: data.companyName,
    size: feToBeSize[data.size] || 'Enterprise',
    setupFee: Number(data.fees) || 0,
    expectedCloseDate: data.expectedCloseDate || undefined,
  });
  return { data: res.data?.data ?? data };
};

export const deleteOpportunity = async (id) => {
  const res = await api.delete(`/v1/leads-kpis/opportunities/${id}`);
  return { data: res.data };
};

export const convertToWon = async (id) => {
  return convertOpportunityToWon(id, new Date().toISOString().split('T')[0]);
};

export const convertOpportunityToWon = async (id, signedDate) => {
  const res = await api.post(`/v1/leads-kpis/opportunities/${id}/won`, { signedDate });
  return { data: res.data?.data ?? { id, status: 'won', signedDate } };
};

// ===================== CLOSED DEALS =====================

export const getClosedDeals = async () => {
  try {
    const res = await api.get('/v1/leads-kpis/closed-deals');
    const list = res.data?.data ?? res.data ?? [];
    return { data: Array.isArray(list) ? list.map(d => ({
      id: d.id,
      customer: d.companyName || d.customer || '',
      contract: d.project?.name || d.projectName || d.contract || '',
      finalFees: d.setupFee ?? d.finalFees ?? 0,
      signedDate: d.closedDate || d.signedDate || '',
      status: 'completed',
    })) : [] };
  } catch {
    return { data: [] };
  }
};

export const updateClosedDeal = async (id, data) => {
  const res = await api.put(`/v1/leads-kpis/closed-deals/${id}`, {
    companyName: data.companyName || data.customer,
    size: data.size,
    setupFee: Number(data.setupFee ?? data.finalFees ?? 0),
    monthlyFee: Number(data.monthlyFee ?? 0),
    closedDate: data.closedDate || data.signedDate,
  });
  return { data: res.data?.data ?? res.data };
};

export const deleteClosedDeal = async (id) => {
  const res = await api.delete(`/v1/leads-kpis/closed-deals/${id}`);
  return { data: res.data };
};

// ===================== EXPENSES =====================

export const getExpenseSystemParams = async () => {
  const res = await api.get('/v1/expenses/system-configs');
  const raw = res.data?.data ?? res.data ?? [];
  const list = Array.isArray(raw) ? raw : [];
  const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const grouped = {};
  for (const item of sorted) {
    const year = item.year;
    const periodValue = item.periodValue != null ? item.periodValue : item.month;
    if (year == null || periodValue == null) continue;
    const key = `${year}-${String(periodValue).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = { period: key, id: item.id, churnRate: 0, grossMargin: 0, note: '' };
    const val = parseFloat(item.value) || 0;
    const noteVal = item.notes ?? item.note ?? '';
    if (item.key === 'churn_rate' && !grouped[key]._churnSet) { grouped[key].churnRate = val; grouped[key]._churnSet = true; if (noteVal) grouped[key].note = noteVal; }
    if (item.key === 'gross_margin' && !grouped[key]._marginSet) { grouped[key].grossMargin = val; grouped[key]._marginSet = true; if (noteVal && !grouped[key].note) grouped[key].note = noteVal; }
  }
  for (const g of Object.values(grouped)) { delete g._churnSet; delete g._marginSet; }
  return {
    data: Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period)),
    raw: list.map(item => ({
      id: item.id,
      key: item.key,
      value: parseFloat(item.value) || 0,
      year: item.year,
      periodValue: item.periodValue != null ? item.periodValue : item.month,
      period: `${item.year}-${String(item.periodValue ?? item.month ?? 1).padStart(2, '0')}`,
      notes: item.notes ?? item.note ?? '',
      effectiveFrom: item.effectiveFrom || item.createdAt || '',
      createdAt: item.createdAt || '',
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
};

export const saveExpenseSystemParam = async (data) => {
  const [year, month] = data.period.split('-').map(Number);
  const effectiveFrom = `${data.period}-01T00:00:00.000Z`;
  const notes = data.note || '';
  const results = [];
  if (data.churnRate != null) {
    const churnPayload = {
      key: 'churn_rate',
      periodType: 'month',
      year,
      periodValue: month,
      value: Number(data.churnRate),
      effectiveFrom,
      notes,
    };
    const res = await api.post('/v1/expenses/system-configs', churnPayload);
    results.push(res.data?.data ?? res.data);
  }
  if (data.grossMargin != null) {
    const grossPayload = {
      key: 'gross_margin',
      periodType: 'month',
      year,
      periodValue: month,
      value: Number(data.grossMargin),
      effectiveFrom,
      notes,
    };
    const res = await api.post('/v1/expenses/system-configs', grossPayload);
    results.push(res.data?.data ?? res.data);
  }
  return { data: results };
};

function normalizeExpenseItem(item) {
  if (!item || typeof item !== 'object') return null;
  const projObj = item.project;
  const projectName = typeof projObj === 'object' && projObj ? (projObj.name || '') : (item.project || item.projectName || '');
  return {
    id: item.id ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    period: item.period ?? (item.month && item.year ? `${item.year}-${String(item.month).padStart(2, '0')}` : item.month ?? `${item.year || ''}`),
    project: projectName,
    projectId: item.projectId ?? (projObj?.id || ''),
    directCost: Number(item.directCost ?? item.direct_cost ?? item.budgetPlanDirect ?? 0),
    overhead: Number(item.overhead ?? item.overheadCost ?? item.overhead_cost ?? item.budgetPlanOverhead ?? item.actualCostOverhead ?? 0),
    total: Number(item.total ?? item.totalCost ?? 0) || (Number(item.directCost ?? item.budgetPlanDirect ?? 0) + Number(item.overhead ?? item.overheadCost ?? item.budgetPlanOverhead ?? 0)),
    note: item.note ?? item.notes ?? item.directNotes ?? item.overheadNotes ?? item.directNote ?? item.overheadNote ?? '',
    directNote: item.directNote ?? item.directNotes ?? '',
    overheadNote: item.overheadNote ?? item.overheadNotes ?? '',
    status: item.status ?? 'pending',
  };
}

export const getExpenseList = async (project) => {
  const params = {};
  if (project) params.projectId = project;
  const res = await api.get('/v1/expenses', { params });
  const raw = res.data?.data ?? res.data ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return { data: list.map(normalizeExpenseItem) };
};

export const saveExpense = async (data) => {
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
};

export const updateExpense = async (id, data) => {
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
  const res = await api.patch(`/v1/expenses/${id}`, payload);
  return { data: res.data?.data ?? res.data };
};

export const deleteExpense = async (id) => {
  const res = await api.delete(`/v1/expenses/${id}`);
  return { data: res.data };
};

export const getExpenseReports = async (period) => {
  const res = await api.get('/v1/expenses/report', { params: { period: period || String(new Date().getFullYear()) } });
  const raw = res.data?.data ?? res.data;
  return { data: raw };
};

export const getExpenseOverview = async (period) => {
  const res = await api.get('/v1/expenses/overview', { params: { period: period || String(new Date().getFullYear()) } });
  const raw = res.data?.data ?? res.data;
  return { data: raw };
};

// ===================== DATA MANAGEMENT =====================

// --- Import (BE: /v1/tasks/import cho tasks, /v1/data-management/import/* cho kpi/deals) ---
export const importPreview = async (formData, type = 'kpi') => {
  const res = await api.post(`/v1/data-management/import/preview?type=${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { data: res.data?.data ?? { totalRows: 0, validRows: 0, errorRows: 0, preview: [], errors: [] } };
};

export const importConfirm = async (rows) => {
  const res = await api.post('/v1/data-management/import/confirm', { rows });
  return { data: res.data?.data ?? { imported: 0, errors: 0 } };
};

export const importTasks = async (formData) => {
  const res = await api.post('/v1/tasks/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
};

export const importKPIHistory = async (formData) => {
  const res = await api.post('/v1/data-management/import/preview?type=kpi', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
};

export const importClosedDeals = async (formData) => {
  const res = await api.post('/v1/data-management/import/preview?type=deal', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { data: res.data?.data ?? { imported: 0, errors: 0, errorList: [] } };
};

export const downloadTemplate = async (type) => {
  try {
    const endpoint = type === 'tasks' ? '/v1/tasks/import/template' : '/v1/data-management/import/template';
    const res = await api.get(endpoint, { responseType: 'blob' });
    const contentType = res.headers?.['content-type'] || '';
    const ext = contentType.includes('spreadsheetml') || contentType.includes('officedocument') ? 'xlsx' : 'csv';
    const filename = `${type}_template.${ext}`;
    const blob = new Blob([res.data], { type: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return { success: true };
  } catch {
    const fallbackUrl = `/templates/${type}_template.xlsx`;
    try {
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${type}_template.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        return { success: true };
      }
    } catch {}
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
  }
};

// --- Export (BE: /v1/data-management/export/*) ---
export const exportWeeklyReportPDF = async (params) => {
  const res = await api.get('/v1/data-management/export/pdf', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-report-w${params.week || '00'}-${params.year || '2026'}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
  return { success: true };
};

export const exportDashboardExcel = async (params) => {
  const res = await api.get('/v1/data-management/export/excel', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-report-${params.period || 'year'}-${params.year || '2026'}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
  return { success: true };
};

export const exportFullData = async () => {
  const res = await api.get('/v1/data-management/export/full', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mkthub-full-export-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  window.URL.revokeObjectURL(url);
  return { success: true };
};

// --- Team Members ---

export const getMembers = async () => {
  const res = await api.get('/v1/data-management/members');
  const raw = res.data?.data ?? res.data ?? [];
  const list = filterDeleted('members', Array.isArray(raw) ? raw : []);
  return { data: list.map(m => ({
    ...m,
    active: m.isActive ?? m.active ?? true,
    role: m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : 'Specialist',
    locked: m.locked === true || m.protected === true || m.role === 'Super Admin',
  })) };
};

export const createMember = async (data) => {
  const res = await api.post('/v1/data-management/members', {
    name: data.name,
    email: data.email,
    password: data.password,
    role: (data.role || 'specialist').toLowerCase(),
    isActive: data.active !== false,
  });
  return { data: res.data?.data ?? res.data };
};

export const updateMember = async (id, data) => {
  const res = await api.put(`/v1/data-management/members/${id}`, {
    name: data.name,
    email: data.email,
    role: (data.role || 'specialist').toLowerCase(),
    isActive: data.active !== false,
  });
  return { data: res.data?.data ?? res.data };
};

export const deleteMember = async (id) => {
  markDeleted('members', id);
  return { success: true };
};

export const changePassword = async (oldPassword, newPassword) => {
  const res = await api.post('/auth/change-password', { oldPassword, newPassword });
  return { data: res.data?.data ?? res.data };
};

// --- Slack Settings ---

const SLACK_DEFAULTS = { webhookUrl: '', channel: 'mkt-alerts', enabled: true, notifyDays: 3, sendTime: '08:00', days: { monFri: true, sat: true, sun: false } };
let slackHistoryCache = [];

export const getSlackSettings = async () => {
  const res = await api.get('/v1/data-management/slack/config');
  const d = res.data?.data ?? res.data ?? {};
  if (d.webhookUrl !== undefined) return { data: d };
  return { data: { ...SLACK_DEFAULTS } };
};

export const saveSlackSettings = async (data) => {
  const res = await api.post('/v1/data-management/slack/config', data);
  return { data: res.data?.data ?? res.data };
};

export const testSlackWebhook = async () => {
  const res = await api.post('/v1/data-management/slack/test');
  return { data: res.data?.data ?? { success: true } };
};

export const getSlackNotificationHistory = async () => {
  const res = await api.get('/v1/data-management/slack/logs');
  const list = res.data?.data ?? res.data ?? [];
  if (Array.isArray(list)) { slackHistoryCache = list; return { data: list }; }
  return { data: slackHistoryCache };
};

// --- Backup & Reset ---
let backupSnapshotsCache = [];

export const getBackupData = async () => {
  const res = await api.get('/v1/data-management/backups');
  const raw = res.data?.data ?? res.data ?? {};
  const snapshots = filterDeleted('backups', Array.isArray(raw.snapshots) ? raw.snapshots : (Array.isArray(raw) ? raw : []));
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
  const res = await api.post('/v1/data-management/backups/create');
  const b = res.data?.data ?? res.data;
  if (b?.id) { backupSnapshotsCache.unshift(b); if (backupSnapshotsCache.length > 10) backupSnapshotsCache.length = 10; }
  return { data: b };
};

export const deleteBackup = async (id) => {
  markDeleted('backups', id);
  backupSnapshotsCache = backupSnapshotsCache.filter(b => b.id !== id);
  return { success: true };
};

export const restoreBackup = async (formData) => {
  const res = await api.post('/v1/data-management/backups/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { data: res.data?.data ?? { success: true } };
};

export const resetSandbox = async () => {
  const res = await api.post('/v1/data-management/reset');
  return { data: res.data?.data ?? { success: true } };
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
  const res = await api.get('/v1/data-management/dropdowns');
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
  return { data: dropdownCache.length ? dropdownCache : DROPDOWN_DEFAULTS };
};

export const addDropdownValue = async (keyId, label) => {
  const entry = dropdownCache.find(k => k.id === keyId);
  if (!entry) return { data: { id: Date.now(), label } };
  const newVal = { id: `opt_${Date.now()}`, label };
  const updatedValues = [...(entry.values || []), newVal];
  const res = await api.put(`/v1/data-management/dropdowns/${entry.key}`, { values: updatedValues.map(v => v.label) });
  const entryIdx = dropdownCache.findIndex(k => k.id === keyId);
  if (entryIdx >= 0) dropdownCache[entryIdx].values = updatedValues;
  return { data: newVal };
};

export const deleteDropdownValue = async (keyId, valueId) => {
  const entry = dropdownCache.find(k => k.id === keyId);
  if (!entry) return { success: true };
  const updatedValues = (entry.values || []).filter(v => v.id !== valueId);
  await api.put(`/v1/data-management/dropdowns/${entry.key}`, { values: updatedValues.map(v => v.label) });
  const entryIdx = dropdownCache.findIndex(k => k.id === keyId);
  if (entryIdx >= 0) dropdownCache[entryIdx].values = updatedValues;
  return { success: true };
};

export const getProjectsDropdown = async () => {
  const res = await getProjects();
  const projects = Array.isArray(res.data) ? res.data : [];
  return { data: projects.map(p => ({ id: p.id, name: p.name })) };
};

export const deleteCompareData = async (years) => {
  markDeleted('compare', years);
  return { success: true };
};

export const generateAIReport = async (params) => {
  const payload = {
    data: params.compareData,
    years: params.years,
    periodType: params.periodType,
    periodValue: params.periodValue,
    period_type: params.periodType,
    period_value: params.periodValue,
    insights: (params.insights || []).map(i => ({
      title: i.title,
      description: i.desc || i.description,
    })),
  };
  const res = await api.post('/v1/ai/report', payload);
  return { data: res.data };
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
  updateExpense,
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
  importPreview,
  importConfirm,
  updateClosedDeal,
  deleteClosedDeal,
  updateOpportunity,
  addOpportunity,
};
