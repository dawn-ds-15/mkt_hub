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
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải báo cáo';
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
      const msg = err?.response?.data?.message || err?.message || 'Lưu thất bại';
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
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <section className="bg-white border border-outline-variant p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tuần</label>
            <input
              className="w-20 border border-primary rounded p-1.5 text-body-md focus:border-primary focus:ring-0"
              type="number" value={filters.week}
              onChange={(e) => setFilters(p => ({ ...p, week: +e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Năm</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[100px]"
              value={filters.year}
              onChange={(e) => setFilters(p => ({ ...p, year: +e.target.value }))}>
              {yearOptions.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Dự án</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[180px]"
              value={filters.projectId}
              onChange={(e) => setFilters(p => ({ ...p, projectId: e.target.value }))}>
              <option value="">Tất cả dự án</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Người phụ trách</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[150px]"
              value={filters.memberId}
              onChange={(e) => setFilters(p => ({ ...p, memberId: e.target.value }))}>
              <option value="">Tất cả thành viên</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAutoFill} className="px-4 py-2 bg-surface-container-high text-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Tự động điền
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất TXT
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border-l-4 border-danger p-3 rounded">
          <p className="text-body-sm text-red-800">{error}</p>
        </div>
      )}

      {loading && <div className="text-center py-8 text-on-surface-variant">Đang tải...</div>}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg text-headline-lg text-primary flex items-center gap-3">
              <span className="material-symbols-outlined text-[32px]">bar_chart</span> Báo cáo tuần {data.week}/{data.year}
            </h3>
            <span className="text-label-md font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
              Trạng thái: {data.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className="mb-4">
            <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-green-600">check_circle</span> 1. Công việc đã hoàn thành</h4>
                <span className="text-[11px] text-gray-400">{data.completed.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Mã</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Task</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">Kết quả</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-right">Người làm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.completed.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.code}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{item.result}</span>
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
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-blue-600">assignment</span> 2. Kế hoạch tuần {data.week + 1}</h4>
                <span className="text-[11px] text-gray-400">{data.nextWeek.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Lịch</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Hạng mục</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Hạn chót</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-right">Ưu tiên</th>
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
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-orange-600">error_outline</span> 3. Tồn đọng / Vấn đề</h4>
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
                <h4 className="text-sm font-bold text-gray-900"><span className="material-symbols-outlined text-[18px] align-text-bottom text-purple-600">support</span> 4. Cần BOD hỗ trợ</h4>
                <span className="text-[11px] text-gray-400">{data.bod.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Dự án</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Yêu cầu hỗ trợ</th>
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
              <h3 className="font-headline-md text-headline-md">Nhật ký tuần</h3>
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
                {saving ? 'Đang lưu...' : saved ? 'Đã lưu' : 'Lưu nhật ký'}
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
                  <span className="material-symbols-outlined text-[18px]">comment</span> Ghi chú công việc
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder="Nhập chi tiết công việc trong tuần..."
                  value={log.doneNotes}
                  onChange={(e) => setLog(p => ({ ...p, doneNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">trending_up</span> Đề xuất cải tiến
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder="Đề xuất tối ưu quy trình..."
                  value={log.planNotes}
                  onChange={(e) => setLog(p => ({ ...p, planNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">psychology</span> Bài học kinh nghiệm
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder="Rút kinh nghiệm từ chiến dịch/dự án..."
                  value={log.backlogNotes}
                  onChange={(e) => setLog(p => ({ ...p, backlogNotes: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span> Thông báo / Nhắc nhở
                </label>
                <textarea
                  className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
                  placeholder="Thông báo quan trọng cho các phòng ban..."
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
