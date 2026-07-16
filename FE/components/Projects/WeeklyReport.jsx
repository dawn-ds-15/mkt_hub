import { useEffect, useState } from 'react';
import { getWeeklyReport } from '../../services/api';

const projects = ['All Projects', 'Q3 Brand Campaign', 'Social Media Audit', 'Email Automation'];
const members = ['All Members', 'Nguyễn Văn A', 'Trần Thị B', 'Minh Tú', 'Hoàng Nam'];

const priorityStyles = {
  High: 'bg-primary-fixed text-primary',
  Normal: 'bg-surface-container-highest text-on-surface-variant',
};

export default function WeeklyReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ week: 23, year: 2026, project: 'All Projects', member: 'All Members' });

  useEffect(() => {
    getWeeklyReport(filters).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, []);

  const [log, setLog] = useState({ note: '', suggestion: '', lesson: '', reminder: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      {/* Filter Bar */}
      <section className="bg-white border border-outline-variant p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tuần</label>
            <input
              className="w-20 border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0"
              type="number" value={filters.week}
              onChange={(e) => setFilters(p => ({ ...p, week: +e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Năm</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[100px]"
              value={filters.year}
              onChange={(e) => setFilters(p => ({ ...p, year: +e.target.value }))}>
              <option>2026</option>
              <option>2025</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Dự án</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[180px]"
              value={filters.project}
              onChange={(e) => setFilters(p => ({ ...p, project: e.target.value }))}>
              {projects.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Người phụ trách</label>
            <select className="border border-outline-variant rounded p-1.5 text-body-md focus:border-primary focus:ring-0 min-w-[150px]"
              value={filters.member}
              onChange={(e) => setFilters(p => ({ ...p, member: e.target.value }))}>
              {members.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-surface-container-high text-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-surface-variant transition-colors border border-outline-variant">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Tự động điền
          </button>
          <button className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất TXT
          </button>
        </div>
      </section>

      {/* Report Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-headline-lg text-headline-lg text-primary flex items-center gap-3">
          <span className="text-[32px]">📊</span> Báo cáo Tuần — Tuần {data.week}/{data.year}
        </h3>
          <span className="text-label-md font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
            Trạng thái: {data.status}
          </span>
      </div>

      {/* 4 Sections 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className="mb-4">
        {/* Section 1: Completed */}
        <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">✅ 1. Công việc đã hoàn thành</h4>
            <span className="text-[11px] text-gray-400">{data.completed.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Mã</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Tên công việc</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">Kết quả</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-right">Người phụ trách</th>
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

        {/* Section 2: Next Week Plan */}
        <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">📌 2. Kế hoạch tuần {data.week + 1}</h4>
            <span className="text-[11px] text-gray-400">{data.nextWeek.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Thời gian</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Hạng mục</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Deadline</th>
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
                      <span className={`${priorityStyles[item.priority] || priorityStyles.Normal} px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{item.priority}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Backlog */}
        <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">🚧 3. Backlog / Vấn đề</h4>
            <span className="text-[11px] text-gray-400">{data.backlog.length}</span>
          </div>
          <div className="p-3 space-y-2">
            {data.backlog.map((item, i) => (
              <div key={i} className={`p-3 border border-gray-200 rounded-lg ${item.cardClass || ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h5 className="text-xs font-bold text-gray-900">{item.title}</h5>
                  <span className={`${item.tagClass || 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap`}>{item.tag || 'BLOCKER'}</span>
                </div>
                <p className="text-xs text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: BOD Support */}
        <section className="bg-white border border-outline-variant overflow-hidden rounded-xl">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900">🤝 4. Cần BOD hỗ trợ</h4>
            <span className="text-[11px] text-gray-400">{data.bod.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Dự án</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase">Nội dung cần hỗ trợ</th>
                  <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.bod.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-800">{item.project}</td>
                    <td className="px-3 py-2 text-gray-600">{item.description}</td>
                    <td className="px-3 py-2 text-center">
                      <button className="text-blue-600 text-[10px] font-semibold flex items-center gap-1 hover:underline mx-auto">
                        💬 Thảo luận
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Weekly Log */}
      <section>
        <div className="flex items-center justify-between mb-stack_md">
          <h3 className="font-headline-md text-headline-md">Nhật ký Tuần</h3>
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
            {saving ? 'Đang lưu...' : saved ? 'Đã lưu thành công' : 'Lưu Log'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">comment</span> Ghi chú chi tiết công việc
            </label>
            <textarea
              className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
              placeholder="Nhập chi tiết các đầu việc trong tuần..."
              value={log.note}
              onChange={(e) => setLog(p => ({ ...p, note: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">trending_up</span> Đề xuất cải tiến quy trình
            </label>
            <textarea
              className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
              placeholder="Đề xuất các bước tối ưu hóa vận hành..."
              value={log.suggestion}
              onChange={(e) => setLog(p => ({ ...p, suggestion: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">psychology</span> Bài học kinh nghiệm (Lesson Learned)
            </label>
            <textarea
              className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
              placeholder="Các bài học rút ra từ chiến dịch/dự án..."
              value={log.lesson}
              onChange={(e) => setLog(p => ({ ...p, lesson: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">notifications_active</span> Thông báo / Nhắc nhở
            </label>
            <textarea
              className="bg-white border border-outline-variant w-full h-32 p-3 text-body-md focus:border-primary focus:ring-0 resize-none"
              placeholder="Các lưu ý quan trọng cho các phòng ban..."
              value={log.reminder}
              onChange={(e) => setLog(p => ({ ...p, reminder: e.target.value }))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
