import { useEffect, useState, useRef, useCallback } from 'react';
import { getDashboardData } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import KPICard from './KPICard';

const periodTabs = [
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
];

function getPeriodOptions(type) {
  if (type === 'week') return Array.from({ length: 53 }, (_, i) => String(i + 1));
  if (type === 'month') return Array.from({ length: 12 }, (_, i) => String(i + 1));
  if (type === 'quarter') return Array.from({ length: 4 }, (_, i) => String(i + 1));
  return [];
}

const CURRENT_YEAR = String(new Date().getFullYear());
const STATUS_LABELS = {
  completed: 'Hoàn thành',
  inProgress: 'Đang làm',
  in_progress: 'Đang làm',
  pending: 'Chưa bắt đầu',
  waiting: 'Đang chờ',
  canceled: 'Đã hủy',
  overdue: 'Quá hạn',
};
const STATUS_COLORS = {
  completed: '#10B981',
  inProgress: '#3B82F6',
  pending: '#F59E0B',
  waiting: '#8B5CF6',
  canceled: '#6B7280',
  overdue: '#EF4444',
};

export default function Dashboard() {
  const { year, periodType, periodValue, setPeriodType, setPeriodValue } = useDashboard();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [projectTasksCache, setProjectTasksCache] = useState({});
  const [projectErrors, setProjectErrors] = useState({});
  const [projectLoading, setProjectLoading] = useState({});
  const abortRef = useRef(null);

  const periodKey = `${periodType}-${periodValue}-${year}`;

  const loadData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardData(periodType, periodValue, year);
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Không thể tải dữ liệu';
        setError(Array.isArray(msg) ? msg.join('; ') : msg);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [periodType, periodValue, year]);

  useEffect(() => {
    loadData();
    setExpandedProjectId(null);
    setProjectTasksCache({});
    setProjectErrors({});
    setProjectLoading({});
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [loadData]);

  const handleToggleProject = async (projectId, projectName) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    const cacheKey = `${projectId}_${periodKey}`;
    if (projectTasksCache[cacheKey]) return;
    if (projectLoading[projectId]) return;

    setProjectLoading(prev => ({ ...prev, [projectId]: true }));
    setProjectErrors(prev => ({ ...prev, [projectId]: null }));

    try {
      const { getProjects } = await import('../../services/api');
      const res = await getProjects();
      const p = res.data.find(proj => proj.id === projectId);
      if (p) {
        const yearNum = parseInt(year, 10);
        const filtered = p.tasks.filter(t => {
          if (!t.due || t.due === '-') return true;
          const taskYear = new Date(t.due.split('/').reverse().join('-')).getFullYear();
          return taskYear === yearNum;
        });
        setProjectTasksCache(prev => ({ ...prev, [cacheKey]: filtered }));
      } else {
        setProjectTasksCache(prev => ({ ...prev, [cacheKey]: [] }));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải task';
      setProjectErrors(prev => ({ ...prev, [projectId]: Array.isArray(msg) ? msg.join('; ') : msg }));
    } finally {
      setProjectLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleRetry = () => loadData();

  const hasData = data && (
    (data.kpis && data.kpis.some(k => {
      const raw = k.value?.replace(/[$,.BMTNK]/g, '') || '0';
      return parseInt(raw, 10) > 0;
    })) ||
    (data.funnel && data.funnel.some(f => f.value > 0))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="flex items-center gap-2 text-danger">
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-body-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Thử lại
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <span className="material-symbols-outlined text-4xl text-outline">database_off</span>
          <p className="text-on-surface-variant">Chưa có dữ liệu kỳ này</p>
        </div>
      </div>
    );
  }

  const ts = data.taskStatus;
  const statusKeys = ['completed', 'inProgress', 'pending', 'waiting', 'canceled', 'overdue'].filter(k => (ts[k] || 0) > 0);
  const tsTotal = statusKeys.reduce((s, k) => s + (ts[k] || 0), 0);

  const channelMax = data.marketingActivities.length > 0
    ? Math.max(...data.marketingActivities.map((a) => Math.max(Number(a.plan) || 0, Number(a.actual) || 0)))
    : 1;

  const periodOptions = getPeriodOptions(periodType);

  return (
    <>
    <div>
      <div className="flex items-center gap-2 mb-6 bg-white rounded-lg border border-border-light p-1 w-fit">
        {periodTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPeriodType(tab.key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
              periodType === tab.key
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {periodOptions.length > 0 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border-light">
            <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">
              {periodType === 'week' ? 'Tuần' : periodType === 'month' ? 'Tháng' : 'Quý'}:
            </span>
            <select
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              className="border border-border-light rounded text-xs px-2 py-1 bg-white focus:ring-1 focus:ring-primary outline-none"
            >
              {periodOptions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <span className="text-[11px] text-on-surface-variant font-medium ml-1">/ {year}</span>
          </div>
        )}
        <button
          onClick={handleRetry}
          className="ml-2 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 rounded transition-colors flex items-center gap-1"
          title="Làm mới"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {data.kpis.map((kpi) => (
          <KPICard key={kpi.id || kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">🔻 Funnel Chuyển đổi</h3>
          </div>
          <div className="px-5 py-4 space-y-2">
            {data.funnel.map((item, idx) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-[90px] text-right font-medium">{item.stage}</span>
                <div className="flex-1 h-8 bg-gray-50 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md flex items-center px-3 text-xs font-bold text-white whitespace-nowrap transition-all ${item.color}`}
                    style={{ width: idx === 0 ? '100%' : `${(item.value / data.funnel[0].value) * 97}%` }}
                  >
                    {item.value.toLocaleString()}
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-[50px] text-right">{item.value.toLocaleString()}</span>
                <span className={`text-[10px] w-[42px] text-center ${item.cvColor || 'text-gray-400'}`}>
                  {item.cv || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">📡 Hiệu suất theo kênh</h3>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-end gap-3" style={{ height: 180 }}>
              {data.marketingActivities.map((act) => {
                const planH = channelMax > 0 ? (Number(act.plan) || 0) / channelMax * 120 : 0;
                const actualH = channelMax > 0 ? (Number(act.actual) || 0) / channelMax * 120 : 0;
                return (
                  <div key={act.label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <div className="flex gap-2 text-[9px] font-medium">
                      <span className="text-blue-500">{Number(act.plan) || 0}</span>
                      <span className="text-green-600">{Number(act.actual) || 0}</span>
                    </div>
                    <div className="w-full flex justify-center gap-[3px] items-end">
                      <div className="w-[28%] bg-blue-300 rounded-t-sm" style={{ height: Math.max(planH, 2) }} />
                      <div className="w-[28%] bg-green-500 rounded-t-sm" style={{ height: Math.max(actualH, 2) }} />
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium truncate w-full text-center mt-1">{act.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-5 mt-3 text-[10px] text-gray-500">
              <span><span className="inline-block w-2.5 h-2.5 bg-blue-300 rounded-sm mr-1.5 align-middle" />Kế hoạch</span>
              <span><span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-sm mr-1.5 align-middle" />Thực tế</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">📁 Tiến độ dự án</h3>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-gray-500 mb-3">
              Tổng tiến độ: <strong className="text-blue-600">{data.totalPct}%</strong>
            </div>
            <div className="space-y-1">
              {data.projectProgress.map((project) => (
                <div key={project.id || project.name}>
                  <div
                    className="flex items-center gap-2.5 py-1.5 px-1 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleToggleProject(project.id, project.name)}
                  >
                    <span className={`material-symbols-outlined text-sm text-gray-400 transition-transform ${expandedProjectId === project.id ? 'rotate-90' : ''}`}>chevron_right</span>
                    <span className="text-xs text-gray-700 w-[130px] truncate">{project.name}</span>
                    <div className="flex-1 h-[7px] bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${project.color}`} style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-900 w-[36px] text-right">{project.progress}%</span>
                  </div>
                  {expandedProjectId === project.id && (
                    <div className="ml-7 mb-2 space-y-1">
                      {projectLoading[project.id] ? (
                        <p className="text-[11px] text-gray-400 italic">Đang tải...</p>
                      ) : projectErrors[project.id] ? (
                        <div className="flex items-center gap-2 text-[11px] text-danger">
                          <span>{projectErrors[project.id]}</span>
                          <button
                            onClick={() => handleToggleProject(project.id, project.name)}
                            className="underline hover:no-underline"
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : (() => {
                        const cacheKey = `${project.id}_${periodKey}`;
                        const tasks = projectTasksCache[cacheKey] || [];
                        if (tasks.length === 0) {
                          return <p className="text-[11px] text-gray-400 italic">Không có task trong kỳ này</p>;
                        }
                        return tasks.map((task) => {
                          const st = task.status;
                          const stLabel = STATUS_LABELS[st] || 'Chưa bắt đầu';
                          const dotColor = st === 'done' ? 'bg-green-500' : st === 'overdue' ? 'bg-red-500' : 'bg-blue-400';
                          return (
                            <div key={task.name + task.due} className="flex items-center gap-2 py-1 px-2 rounded bg-gray-50 text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              <span className="flex-1 text-gray-700 truncate">{task.name}</span>
                              <span className="text-gray-400 w-[80px] text-right truncate">{task.assignee}</span>
                              <span className="text-gray-500 text-[10px] font-medium">{stLabel}</span>
                              <span className="text-gray-400 w-[60px] text-right">{task.due}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">✅ Trạng thái task</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-5">
                <svg width="80" height="80" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                  {tsTotal > 0 && statusKeys.map((k, i) => {
                    const offset = statusKeys.slice(0, i).reduce((s, kk) => s + (ts[kk] || 0), 0);
                    return (
                      <circle
                        key={k}
                        cx="18" cy="18" r="14" fill="none"
                        stroke={STATUS_COLORS[k]}
                        strokeWidth="5"
                        pathLength={tsTotal}
                        strokeDasharray={`${ts[k] || 0} ${tsTotal - (ts[k] || 0)}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 18 18)"
                      />
                    );
                  })}
                  <text x="18" y="21" textAnchor="middle" fontSize="6" fontWeight="700" fill="#0F172A">{tsTotal}t</text>
                </svg>
                <div className="space-y-1.5">
                  {statusKeys.map(k => (
                    <div key={k} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[k] }} />
                      <span>{STATUS_LABELS[k]}: {ts[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">🔔 Cảnh báo</h3>
            </div>
            <div className="px-4 py-3 space-y-2">
              {(data.alerts.length <= 3 ? data.alerts : data.alerts.slice(0, 3)).map((alert, idx) => (
                <div
                  key={alert.title + alert.due + idx}
                  className={`flex gap-2.5 p-2.5 rounded-lg text-xs ${
                    alert.type === 'error' ? 'bg-red-50 border-l-[3px] border-red-500' : 'bg-amber-50 border-l-[3px] border-amber-400'
                  }`}
                >
                  <span>{alert.type === 'error' ? '🔴' : '🟡'}</span>
                  <div>
                    <strong className="block text-gray-800">{alert.title}</strong>
                    <div className="text-gray-500 mt-0.5">
                      {alert.assignee} · {alert.due}
                    </div>
                  </div>
                </div>
              ))}
              {data.alerts.length > 3 && (
                <button
                  onClick={() => setShowAllAlerts(true)}
                  className="w-full mt-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Xem tất cả ({data.alerts.length})
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {showAllAlerts && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowAllAlerts(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50 p-5 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">🔔 Tất cả cảnh báo</h3>
              <button onClick={() => setShowAllAlerts(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {data.alerts.map((alert, idx) => (
                <div
                  key={alert.title + alert.due + idx}
                  className={`flex gap-2.5 p-2.5 rounded-lg text-xs ${
                    alert.type === 'error' ? 'bg-red-50 border-l-[3px] border-red-500' : 'bg-amber-50 border-l-[3px] border-amber-400'
                  }`}
                >
                  <span>{alert.type === 'error' ? '🔴' : '🟡'}</span>
                  <div>
                    <strong className="block text-gray-800">{alert.title}</strong>
                    <div className="text-gray-500 mt-0.5">{alert.assignee} · {alert.due}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
