import { useEffect, useState } from 'react';
import { getDashboardData, getProjects } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import KPICard from './KPICard';

const periodTabs = [
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
];

export default function Dashboard() {
  const { year, periodType, periodValue, setPeriodType } = useDashboard();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState({});

  const statusStyles = {
    done: { bg: 'bg-green-50', text: 'text-green-700', label: 'Hoàn thành' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Đang làm' },
    todo: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Chưa bắt đầu' },
    overdue: { bg: 'bg-red-50', text: 'text-red-700', label: 'Quá hạn' },
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDashboardData(periodType, periodValue, year)
      .then(setData)
      .catch((err) => setError(err?.message || 'Không thể tải dữ liệu'))
      .finally(() => setLoading(false));
  }, [year, periodType, periodValue]);

  const handleToggleProject = (projectName) => {
    if (expandedProject === projectName) {
      setExpandedProject(null);
      return;
    }
    setExpandedProject(projectName);
    if (!projectTasks[projectName]) {
      getProjects().then((res) => {
        const p = res.data.find(proj => proj.name === projectName);
        if (p) {
          setProjectTasks(prev => ({ ...prev, [projectName]: p.tasks }));
        }
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (!data || (!data.kpis?.length && !data.funnel?.length)) {
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

  const channelMax = data.marketingActivities.length > 0
    ? Math.max(...data.marketingActivities.map((a) => Math.max(Number(a.plan) || 0, Number(a.actual) || 0)))
    : 1;

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {data.kpis.map((kpi) => (
          <KPICard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Funnel */}
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

        {/* Channel Performance */}
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
        {/* Projects */}
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
                <div key={project.name}>
                  <div
                    className="flex items-center gap-2.5 py-1.5 px-1 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleToggleProject(project.name)}
                  >
                    <span className={`material-symbols-outlined text-sm text-gray-400 transition-transform ${expandedProject === project.name ? 'rotate-90' : ''}`}>chevron_right</span>
                    <span className="text-xs text-gray-700 w-[130px] truncate">{project.name}</span>
                    <div className="flex-1 h-[7px] bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${project.color}`} style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-900 w-[36px] text-right">{project.progress}%</span>
                  </div>
                  {expandedProject === project.name && (
                    <div className="ml-7 mb-2 space-y-1">
                      {(projectTasks[project.name] || []).length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">Đang tải...</p>
                      ) : (
                        projectTasks[project.name].map((task, ti) => {
                          const st = statusStyles[task.status] || statusStyles.todo;
                          return (
                            <div key={ti} className="flex items-center gap-2 py-1 px-2 rounded bg-gray-50 text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'bg-green-500' : task.status === 'overdue' ? 'bg-red-500' : 'bg-blue-400'}`} />
                              <span className="flex-1 text-gray-700 truncate">{task.name}</span>
                              <span className="text-gray-400 w-[80px] text-right truncate">{task.assignee}</span>
                              <span className={`px-1.5 py-0.5 rounded font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                              <span className="text-gray-400 w-[60px] text-right">{task.due}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Status + Alerts */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">✅ Trạng thái task</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-5">
                <svg width="80" height="80" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="5" />
                  {ts.total > 0 && (
                    <>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#10B981" strokeWidth="5" pathLength={ts.total} strokeDasharray={`${ts.completed} ${ts.total - ts.completed}`} strokeDashoffset="0" transform="rotate(-90 18 18)" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#3B82F6" strokeWidth="5" pathLength={ts.total} strokeDasharray={`${ts.inProgress} ${ts.total - ts.inProgress}`} strokeDashoffset={-ts.completed} transform="rotate(-90 18 18)" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#F59E0B" strokeWidth="5" pathLength={ts.total} strokeDasharray={`${ts.pending} ${ts.total - ts.pending}`} strokeDashoffset={-(ts.completed + ts.inProgress)} transform="rotate(-90 18 18)" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#EF4444" strokeWidth="5" pathLength={ts.total} strokeDasharray={`${ts.overdue} ${ts.total - ts.overdue}`} strokeDashoffset={-(ts.completed + ts.inProgress + ts.pending)} transform="rotate(-90 18 18)" />
                    </>
                  )}
                  <text x="18" y="21" textAnchor="middle" fontSize="6" fontWeight="700" fill="#0F172A">{ts.total}t</text>
                </svg>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>Hoàn thành: {ts.completed}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Đang làm: {ts.inProgress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span>Chưa bắt đầu: {ts.pending}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Quá hạn: {ts.overdue}</span>
                  </div>
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
                  key={idx}
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
              <button onClick={() => setShowAllAlerts(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
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
