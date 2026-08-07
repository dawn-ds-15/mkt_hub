import { useDashboard } from '../../contexts/DashboardContext';

const METRIC_LABEL = (locale) => ({
  rawLeads: 'Raw Leads Actual',
  mql: 'MQL',
  sql: 'SQL',
});

const fmt = (val) => (val ?? 0).toLocaleString('vi-VN');

export default function MetricBreakdownModal({ metric, events, projects, projectName, week, groupByProject = false, onSelectEvent, onSelectProject, onClose }) {
  const { locale } = useDashboard();

  const total = events.reduce((sum, e) => sum + (Number(e[metric]) || 0), 0);

  const projectTotals = Object.values(
    events.reduce((acc, e) => {
      const pid = e.projectId || '';
      if (!acc[pid]) acc[pid] = { projectId: pid, projectName: (projects.find(p => p.id === pid)?.name) || (pid ? pid : (locale === 'vi' ? 'Chưa rõ dự án' : 'Unknown project')), total: 0 };
      acc[pid].total += Number(e[metric]) || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-base font-bold">
              {groupByProject
                ? (locale === 'vi' ? `Theo dự án — ${METRIC_LABEL(locale)[metric]}` : `By project — ${METRIC_LABEL(locale)[metric]}`)
                : `${METRIC_LABEL(locale)[metric]} — ${locale === 'vi' ? 'Chi tiết sự kiện' : 'Event Details'}`}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 pt-4">
            <p className="text-xs text-on-surface-variant">
              {locale === 'vi' ? 'Phạm vi:' : 'Scope:'} <span className="font-semibold text-on-surface">{projectName || (locale === 'vi' ? 'Tất cả dự án' : 'All projects')}</span>
              {week && <span className="text-on-surface-variant"> — {week}</span>}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              {groupByProject
                ? (locale === 'vi' ? 'Chọn một dự án để chuyển đến form nhập' : 'Click a project to open its entry form')
                : (locale === 'vi' ? 'Chọn một sự kiện để sửa' : 'Click an event to edit')}
              {' '}· <span className="font-semibold text-primary">{fmt(total)}</span>
            </p>
          </div>

          <div className="px-6 py-4 space-y-3">
            {events.length === 0 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[40px] text-outline mb-2 block">event_busy</span>
                <p className="text-sm text-on-surface-variant">{locale === 'vi' ? 'Chưa có dữ liệu nào' : 'No data yet'}</p>
              </div>
            )}

            {groupByProject && projectTotals.map((p) => (
              <button
                key={p.projectId}
                onClick={() => onSelectProject && onSelectProject(p.projectId)}
                className="w-full border border-border-light rounded-lg p-3 flex items-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">folder</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{p.projectName}</p>
                  <p className="text-xs text-on-surface-variant">{p.total > 0 ? `${fmt(p.total)}` : '0'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{fmt(p.total)}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase">{METRIC_LABEL(locale)[metric]}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
            ))}

            {!groupByProject && events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => onSelectEvent && onSelectEvent(evt)}
                className="w-full border border-border-light rounded-lg p-3 flex items-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary">event</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{evt.name}</p>
                  <p className="text-xs text-on-surface-variant">{evt.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{fmt(evt[metric])}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase">{METRIC_LABEL(locale)[metric]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
