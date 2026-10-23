import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Download, BarChart3, CheckCircle2, ClipboardList, CircleAlert, LifeBuoy, Save, Loader2, Check, MessageSquare, TrendingUp, Brain, BellRing, ListChecks } from 'lucide-react';
import { getWeeklyReport, saveWeeklyLog, exportWeeklyReport, exportWeeklyReportPDF, getProjects, getMembers } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';

function getISOWeek() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_WEEK = getISOWeek();

function formatDoneDate(v) {
  if (!v || typeof v !== 'string') return '';
  const [y, m, d] = v.split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

function taskStatusMeta(status, locale) {
  const vi = {
    'To Do': { label: 'Chưa làm', cls: 'bg-slate-100 text-slate-700' },
    'In Progress': { label: 'Đang làm', cls: 'bg-blue-100 text-blue-700' },
    'Review': { label: 'Chờ xử lý', cls: 'bg-purple-100 text-purple-700' },
    'Done': { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700' },
    'Backlog': { label: 'Tồn đọng', cls: 'bg-amber-100 text-amber-700' },
    'Cancel': { label: 'Đã huỷ', cls: 'bg-gray-100 text-gray-600' },
  };
  const en = {
    'To Do': 'To Do',
    'In Progress': 'In Progress',
    'Review': 'Review',
    'Done': 'Done',
    'Backlog': 'Backlog',
    'Cancel': 'Cancelled',
  };
  const key = status || 'To Do';
  const meta = vi[key] || { label: key, cls: 'bg-slate-100 text-slate-700' };
  return { ...meta, label: locale === 'en' ? (en[key] || key) : meta.label };
}

export default function WeeklyReport() {
  const { locale } = useDashboard();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({ week: CURRENT_WEEK, year: CURRENT_YEAR, projectId: '', memberId: '' });
  const [log, setLog] = useState({ doneNotes: '', planNotes: '', backlogNotes: '', bodNotes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getProjects().then(r => setProjects(r.data)).catch(e => console.error('[WeeklyReport] getProjects:', e));
    getMembers().then(r => setMembers(r.data)).catch(e => console.error('[WeeklyReport] getMembers:', e));
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getWeeklyReport(filters);
      setData(res.data);
      if (res.data.logNotes) {
        setLog({
          doneNotes: res.data.logNotes.doneNotes || '',
          planNotes: res.data.logNotes.planNotes || '',
          backlogNotes: res.data.logNotes.backlogNotes || '',
          bodNotes: res.data.logNotes.bodNotes || '',
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Không thể tải báo cáo' : 'Cannot load report');
      setError(Array.isArray(msg) ? msg.join('; ') : msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await saveWeeklyLog({
        week: filters.week,
        year: filters.year,
        projectId: filters.projectId,
        memberId: filters.memberId,
        ...log,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadReport();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Lưu thất bại' : 'Save failed');
      setSaveError(Array.isArray(msg) ? msg.join('; ') : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = () => {
    loadReport();
  };

  const handleExport = () => {
    exportWeeklyReport(filters.week, filters.year, filters.projectId, filters.memberId);
  };

  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportWeeklyReportPDF({ week: filters.week, year: filters.year, project: filters.projectId || 'all', member: filters.memberId || undefined });
    } catch (err) {
      setError(`${locale === 'vi' ? 'Xuất PDF thất bại' : 'PDF export failed'}${err?.response?.status ? ` (HTTP ${err.response.status})` : ''}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Bấm vào task -> mở tab Danh sách task, lọc theo dự án của task và mở sẵn task đó để cập nhật.
  const openTask = (item) => {
    if (!item?.id) return;
    const qs = new URLSearchParams({ tab: 'tasks' });
    if (item.projectId) qs.set('projectId', item.projectId);
    qs.set('taskId', item.id);
    navigate(`/tasks?${qs.toString()}`);
  };
  const openTitle = locale === 'vi' ? 'Mở task để xem / cập nhật' : 'Open task to view / update';
  const rowProps = (item) => (item?.id
    ? { onClick: () => openTask(item), title: openTitle, className: 'hover:bg-blue-50/60 align-top cursor-pointer' }
    : { className: 'hover:bg-gray-50 align-top' });
  const taskNameCls = (item) => (item?.id ? 'text-primary hover:underline' : 'text-gray-800');

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) yearOptions.push(y);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <section className="bg-white border border-outline-variant p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">{locale === 'vi' ? 'Tuần' : 'Week'}</label>
            <input
              className="w-20 border border-primary rounded p-1.5 text-body-md focus:border-primary focus:ring-0"
              type="number" value={filters.week}
              onChange={(e) => setFilters(p => ({ ...p, week: +e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">{locale === 'vi' ? 'Năm' : 'Year'}</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[100px]"
              value={filters.year}
              onChange={(e) => setFilters(p => ({ ...p, year: +e.target.value }))}>
              {yearOptions.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[180px]"
              value={filters.projectId}
              onChange={(e) => setFilters(p => ({ ...p, projectId: e.target.value }))}>
              <option value="">{locale === 'vi' ? 'Tất cả dự án' : 'All Projects'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">{locale === 'vi' ? 'Người phụ trách' : 'Assignee'}</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[150px]"
              value={filters.memberId}
              onChange={(e) => setFilters(p => ({ ...p, memberId: e.target.value }))}>
              <option value="">{locale === 'vi' ? 'Tất cả thành viên' : 'All Members'}</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAutoFill} className="px-4 py-2 bg-surface-container-high text-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant">
            <Zap className="w-[18px] h-[18px]" />
            {locale === 'vi' ? 'Tự động điền' : 'Auto Fill'}
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf} className="px-4 py-2 bg-surface-container-high text-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant disabled:opacity-50">
            {exportingPdf ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Download className="w-[18px] h-[18px]" />}
            {locale === 'vi' ? 'Xuất PDF' : 'Export PDF'}
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Download className="w-[18px] h-[18px]" />
            {locale === 'vi' ? 'Xuất TXT' : 'Export TXT'}
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border-l-4 border-danger p-3 rounded">
          <p className="text-body-sm text-red-800">{error}</p>
        </div>
      )}

      {loading && <div className="text-center py-8 text-on-surface-variant">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</div>}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg text-headline-lg text-primary flex items-center gap-3">
              <BarChart3 className="w-[30px] h-[30px] text-brand-600" /> {locale === 'vi' ? `Báo cáo tuần ${data.week}/${data.year}` : `Weekly Report ${data.week}/${data.year}`}
            </h3>
            <span className="text-label-md font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
              {locale === 'vi' ? 'Trạng thái:' : 'Status:'} {data.status === 'Đã lưu' ? (locale === 'vi' ? 'Đã lưu' : 'Saved') : (locale === 'vi' ? 'Nháp' : 'Draft')}
            </span>
          </div>

          <div className="space-y-4">
            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><CheckCircle2 className="w-[18px] h-[18px] text-green-600 align-text-bottom" /> {locale === 'vi' ? '1. Công việc đã làm' : '1. Completed Work'}</h4>
                <span className="text-[11px] text-gray-400">{data.completed.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[27%]" />
                    <col className="w-[30%]" />
                    <col className="w-[16%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Task</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Hoạt động' : 'Activity'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Người thực hiện' : 'Assignee'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">{locale === 'vi' ? 'Tình trạng' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.completed.map((item, i) => (
                      <tr key={item.id || i} {...rowProps(item)}>
                        <td className="px-3 py-2 text-gray-600 break-words">{item.project}</td>
                        <td className={`px-3 py-2 font-medium break-words ${taskNameCls(item)}`}>{item.name}</td>
                        <td className="px-3 py-2">
                          {item.subtasks && item.subtasks.length > 0 ? (
                            <div className="space-y-1 min-w-0">
                              {item.subtasks.map((st, j) => (
                                <div key={j} className="flex items-center gap-1.5 min-w-0">
                                  <input type="checkbox" checked={st.done} readOnly disabled className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                                  <span className={`text-[11px] flex-1 min-w-0 break-words ${st.done ? 'line-through text-gray-400' : 'text-gray-600'}`}>{st.text}</span>
                                  {st.doneDate && (
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDoneDate(st.doneDate)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 break-words">{item.assignee}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{locale === 'vi' ? 'Hoàn thành' : 'Completed'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.completed.length === 0 && (
                  <div className="p-4 text-center text-gray-400">{locale === 'vi' ? 'Không có công việc hoàn thành' : 'No completed work'}</div>
                )}
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><ListChecks className="w-[18px] h-[18px] text-indigo-600 align-text-bottom" /> {locale === 'vi' ? 'Task nhỏ cần làm trong tuần' : 'Sub-tasks to do this week'}</h4>
                <span className="text-[11px] text-gray-400">
                  {(() => { const total = (data.weekSubTasks || []).reduce((n, g) => n + g.subtasks.length, 0); const done = (data.weekSubTasks || []).reduce((n, g) => n + g.subtasks.filter(s => s.done).length, 0); return `${done}/${total}`; })()}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[45%]" />
                    <col className="w-[10%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Task' : 'Task'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Task nhỏ' : 'Sub-task'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">{locale === 'vi' ? 'Hoàn thành' : 'Done'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Ngày cần hoàn thành' : 'Required date'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data.weekSubTasks || []).map((group, gi) => (
                      group.subtasks.map((st, si) => (
                        <tr key={`${gi}-${si}`} {...rowProps(group)}>
                          {si === 0 && (
                            <td rowSpan={group.subtasks.length} className="px-3 py-2 text-gray-600 break-words align-top">
                              {group.project}
                            </td>
                          )}
                          {si === 0 && (
                            <td rowSpan={group.subtasks.length} className={`px-3 py-2 font-medium break-words align-top ${taskNameCls(group)}`}>
                              {group.taskName}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <span className={`block whitespace-normal break-words ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{st.text}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {st.done
                              ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{locale === 'vi' ? 'Xong' : 'Done'}</span>
                              : <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{locale === 'vi' ? 'Chưa' : 'Pending'}</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{st.doneDate ? formatDoneDate(st.doneDate) : '—'}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
                {(!data.weekSubTasks || data.weekSubTasks.length === 0) && (
                  <div className="p-4 text-center text-gray-400">{locale === 'vi' ? 'Không có task nhỏ nào trong tuần này' : 'No sub-tasks for this week'}</div>
                )}
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><ClipboardList className="w-[18px] h-[18px] text-blue-600 align-text-bottom" /> {locale === 'vi' ? `2. Kế hoạch tuần ${data.week + 1}` : `2. Next Week Plan ${data.week + 1}`}</h4>
                <span className="text-[11px] text-gray-400">{data.nextWeek.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[27%]" />
                    <col className="w-[30%]" />
                    <col className="w-[16%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Task</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Hoạt động' : 'Activity'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Người thực hiện' : 'Assignee'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">{locale === 'vi' ? 'Tình trạng' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.nextWeek.map((item, i) => (
                      <tr key={item.id || i} {...rowProps(item)}>
                        <td className="px-3 py-2 text-gray-600 break-words">{item.project}</td>
                        <td className={`px-3 py-2 font-medium ${taskNameCls(item)}`}>{item.item}</td>
                        <td className="px-3 py-2">
                          {item.subtasks && item.subtasks.length > 0 ? (
                            <div className="space-y-1 min-w-0">
                              {item.subtasks.map((st, j) => (
                                <div key={j} className="flex items-center gap-1.5 min-w-0">
                                  <input type="checkbox" checked={st.done} readOnly disabled className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                                  <span className={`text-[11px] flex-1 min-w-0 break-words ${st.done ? 'line-through text-gray-400' : 'text-gray-600'}`}>{st.text}</span>
                                  {st.doneDate && (
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDoneDate(st.doneDate)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-600 break-words">{item.activity || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 break-words">{item.assignee}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${taskStatusMeta(item.status, locale).cls}`}>{taskStatusMeta(item.status, locale).label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.nextWeek.length === 0 && (
                  <div className="p-4 text-center text-gray-400">{locale === 'vi' ? 'Không có kế hoạch cho tuần này' : 'No plan for this week'}</div>
                )}
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><CircleAlert className="w-[18px] h-[18px] text-orange-600 align-text-bottom" /> {locale === 'vi' ? '3. Tồn đọng / Vấn đề' : '3. Backlog / Issues'}</h4>
                <span className="text-[11px] text-gray-400">{data.backlog.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Trình bày với BOD' : 'Present to BOD'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Mô tả vấn đề' : 'Description'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.backlog.map((item, i) => (
                      <tr key={item.id || i} {...rowProps(item)}>
                        <td className="px-3 py-2 font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className={item.id ? 'text-primary hover:underline' : ''}>{item.title}</span>
                            <span className="bg-error text-on-error px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">{item.tag || 'BLOCKER'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.backlog.length === 0 && (
                  <div className="p-4 text-center text-gray-400">{locale === 'vi' ? 'Không có vấn đề tồn đọng' : 'No backlog issues'}</div>
                )}
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><LifeBuoy className="w-[18px] h-[18px] text-purple-600 align-text-bottom" /> {locale === 'vi' ? '4. Cần BOD hỗ trợ' : '4. BOD Support Needed'}</h4>
                <span className="text-[11px] text-gray-400">{data.bod.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Yêu cầu hỗ trợ' : 'Support Request'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.bod.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-bold text-gray-800">{item.project}</td>
                        <td className="px-3 py-2 text-gray-600">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.bod.length === 0 && (
                  <div className="p-4 text-center text-gray-400">{locale === 'vi' ? 'Không có yêu cầu hỗ trợ' : 'No support requests'}</div>
                )}
              </div>
            </section>
          </div>

          <section>
            <div className="flex items-center justify-between mb-stack_md">
              <h3 className="font-headline-md text-headline-md">{locale === 'vi' ? 'Nhật ký tuần' : 'Weekly Log'}</h3>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2 rounded font-label-md text-label-md flex items-center gap-2 transition-all shadow-lg shadow-primary/20 ${
                  saved ? 'bg-green-600 text-on-primary' : 'bg-primary text-on-primary hover:opacity-90'
                }`}
              >
                <span className="text-[18px] h-[18px] w-[18px] inline-flex items-center justify-center">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </span>
                {saving ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : saved ? (locale === 'vi' ? 'Đã lưu' : 'Saved') : (locale === 'vi' ? 'Lưu nhật ký' : 'Save Log')}
              </button>
            </div>
            {saveError && (
              <div className="bg-red-50 border-l-4 border-danger p-3 rounded mb-4">
                <p className="text-body-sm text-red-800">{saveError}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <MessageSquare className="w-[18px] h-[18px]" /> {locale === 'vi' ? 'Ghi chú công việc' : 'Work Notes'}
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder={locale === 'vi' ? 'Nhập chi tiết công việc trong tuần...' : 'Enter this week\'s work details...'}
                  value={log.doneNotes}
                  onChange={(e) => setLog(p => ({ ...p, doneNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <TrendingUp className="w-[18px] h-[18px]" /> {locale === 'vi' ? 'Đề xuất cải tiến' : 'Improvement Suggestions'}
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder={locale === 'vi' ? 'Đề xuất tối ưu quy trình...' : 'Suggest process improvements...'}
                  value={log.planNotes}
                  onChange={(e) => setLog(p => ({ ...p, planNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <Brain className="w-[18px] h-[18px]" /> {locale === 'vi' ? 'Bài học kinh nghiệm' : 'Lessons Learned'}
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder={locale === 'vi' ? 'Rút kinh nghiệm từ chiến dịch/dự án...' : 'Lessons from campaigns/projects...'}
                  value={log.backlogNotes}
                  onChange={(e) => setLog(p => ({ ...p, backlogNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <BellRing className="w-[18px] h-[18px]" /> {locale === 'vi' ? 'Thông báo / Nhắc nhở' : 'Notifications / Reminders'}
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder={locale === 'vi' ? 'Thông báo quan trọng cho các phòng ban...' : 'Important notices for departments...'}
                  value={log.bodNotes}
                  onChange={(e) => setLog(p => ({ ...p, bodNotes: e.target.value }))}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
