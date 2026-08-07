import { useEffect, useState, useCallback } from 'react';
import { getWeeklyReport, saveWeeklyLog, exportWeeklyReport, getProjects, getMembers } from '../../services/api';
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

export default function WeeklyReport() {
  const { locale } = useDashboard();
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
    exportWeeklyReport(filters.week, filters.year, filters.projectId);
  };

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
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            {locale === 'vi' ? 'Tự động điền' : 'Auto Fill'}
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
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
              <span className="material-symbols-outlined text-[32px]">bar_chart</span> {locale === 'vi' ? `Báo cáo tuần ${data.week}/${data.year}` : `Weekly Report ${data.week}/${data.year}`}
            </h3>
            <span className="text-label-md font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
              {locale === 'vi' ? 'Trạng thái:' : 'Status:'} {data.status === 'Đã lưu' ? (locale === 'vi' ? 'Đã lưu' : 'Saved') : (locale === 'vi' ? 'Nháp' : 'Draft')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className="mb-4">
            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-green-600">check_circle</span> {locale === 'vi' ? '1. Công việc đã hoàn thành' : '1. Completed Work'}</h4>
                <span className="text-[11px] text-gray-400">{data.completed.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Mã' : 'Code'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Task</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">{locale === 'vi' ? 'Kết quả' : 'Result'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-right">{locale === 'vi' ? 'Người làm' : 'Assignee'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.completed.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.code}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{item.result === 'Hoàn thành' ? (locale === 'vi' ? 'Hoàn thành' : 'Completed') : item.result}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.assignee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-blue-600">assignment</span> {locale === 'vi' ? `2. Kế hoạch tuần ${data.week + 1}` : `2. Next Week Plan ${data.week + 1}`}</h4>
                <span className="text-[11px] text-gray-400">{data.nextWeek.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Lịch' : 'Schedule'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Hạng mục' : 'Item'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-right">{locale === 'vi' ? 'Ưu tiên' : 'Priority'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.nextWeek.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.schedule}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.item}</td>
                        <td className="px-3 py-2 text-gray-600">{item.deadline}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.priority === 'High' ? 'bg-primary-fixed text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>{item.priority}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-orange-600">error_outline</span> {locale === 'vi' ? '3. Tồn đọng / Vấn đề' : '3. Backlog / Issues'}</h4>
                <span className="text-[11px] text-gray-400">{data.backlog.length}</span>
              </div>
              <div className="p-3 space-y-2">
                {data.backlog.map((item, i) => (
                  <div key={i} className="p-3 border border-gray-200 rounded-lg bg-error-container/10 border-error/20">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h5 className="text-xs font-bold text-gray-900">{item.title}</h5>
                      <span className="bg-error text-on-error px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">BLOCKER</span>
                    </div>
                    <p className="text-xs text-gray-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-purple-600">support</span> {locale === 'vi' ? '4. Cần BOD hỗ trợ' : '4. BOD Support Needed'}</h4>
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
                <span className="material-symbols-outlined text-[18px]">
                  {saving ? 'sync' : saved ? 'check' : 'save'}
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
                  <span className="material-symbols-outlined text-[18px]">comment</span> {locale === 'vi' ? 'Ghi chú công việc' : 'Work Notes'}
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
                  <span className="material-symbols-outlined text-[18px]">trending_up</span> {locale === 'vi' ? 'Đề xuất cải tiến' : 'Improvement Suggestions'}
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
                  <span className="material-symbols-outlined text-[18px]">psychology</span> {locale === 'vi' ? 'Bài học kinh nghiệm' : 'Lessons Learned'}
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
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span> {locale === 'vi' ? 'Thông báo / Nhắc nhở' : 'Notifications / Reminders'}
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
