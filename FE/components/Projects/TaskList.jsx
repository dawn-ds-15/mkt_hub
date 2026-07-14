import { useEffect, useState, useCallback } from 'react';
import { getTaskList } from '../../services/api';

const statusStyles = {
  overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Quá hạn', row: 'bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100', icon: 'error', iconColor: 'text-red-600', fill: true },
  todo: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Chưa bắt đầu', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Đang làm', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Đang review', row: 'hover:bg-surface-container-low', icon: 'visibility', iconColor: 'text-amber-500' },
  done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Hoàn thành', row: 'opacity-70 hover:opacity-100', icon: 'check_circle', iconColor: 'text-green-600' },
};

const priorityColors = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-slate-600',
};

const priorityLabels = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const statsMeta = [
  { key: 'total', label: 'Tổng cộng', color: 'text-primary' },
  { key: 'todo', label: 'Chưa bắt đầu', color: 'text-secondary' },
  { key: 'in_progress', label: 'Đang làm', color: 'text-primary-container' },
  { key: 'review', label: 'Đang review', color: 'text-amber-600' },
  { key: 'done', label: 'Hoàn thành', color: 'text-green-700' },
  { key: 'overdue', label: 'Quá hạn', color: 'text-red-700' },
];

const filterDefs = [
  { key: 'project', label: 'Dự án:', options: ['Tất cả', 'Social Q4', 'Web Redesign', 'PR Hub', 'Chiến dịch'] },
  { key: 'status', label: 'Trạng thái:', options: ['Tất cả', 'todo', 'in_progress', 'review', 'done', 'overdue'] },
  { key: 'priority', label: 'Ưu tiên:', options: ['Tất cả', 'high', 'medium', 'low'] },
  { key: 'assignee', label: 'Người phụ trách:', options: ['Tất cả', 'An Nguyen', 'Minh Le', 'Thu Ha', 'Khoa Vo', 'Trang Mai'] },
];

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    project: 'Tất cả',
    status: 'Tất cả',
    priority: 'Tất cả',
    assignee: 'Tất cả',
    dateFrom: '',
    dateTo: '',
  });
  const perPage = 10;

  const [quickTask, setQuickTask] = useState({
    name: '',
    project: '',
    assignee: '',
    priority: '',
    due: '',
  });

  useEffect(() => {
    getTaskList().then((res) => {
      setTasks(res.data);
      setFilteredTasks(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = [...tasks];
    if (filters.project !== 'Tất cả') {
      result = result.filter(t => t.project === filters.project);
    }
    if (filters.status !== 'Tất cả') {
      result = result.filter(t => t.status === filters.status);
    }
    if (filters.priority !== 'Tất cả') {
      result = result.filter(t => t.priority === filters.priority);
    }
    if (filters.assignee !== 'Tất cả') {
      result = result.filter(t => t.assignee.name === filters.assignee);
    }
    if (filters.dateFrom) {
      result = result.filter(t => t.due && t.due !== '-' && new Date(t.due) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(t => t.due && t.due !== '-' && new Date(t.due) <= new Date(filters.dateTo));
    }
    setFilteredTasks(result);
    setPage(1);
  }, [filters, tasks]);

  const stats = useCallback(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const in_progress = tasks.filter(t => t.status === 'in_progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    return { total, todo, in_progress, review, done, overdue };
  }, [tasks]);

  const clearFilters = () => {
    setFilters({ project: 'Tất cả', status: 'Tất cả', priority: 'Tất cả', assignee: 'Tất cả', dateFrom: '', dateTo: '' });
  };

  const totalPages = Math.ceil(filteredTasks.length / perPage);
  const pagedTasks = filteredTasks.slice((page - 1) * perPage, page * perPage);

  const handleQuickAdd = () => {
    if (!quickTask.name.trim()) return;
    const newTask = {
      id: Date.now(),
      project: quickTask.project || 'Social Q4',
      taskName: quickTask.name,
      assignee: { initials: 'ME', name: quickTask.assignee || 'Me' },
      stakeholders: '-',
      status: 'planning',
      priority: quickTask.priority || 'medium',
      start: '-',
      due: quickTask.due || '-',
      done: null,
      link: null,
      remark: 'New task',
    };
    setTasks(prev => [...prev, newTask]);
    setQuickTask({ name: '', project: '', assignee: '', priority: '', due: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-outline">Đang tải dữ liệu...</p>
      </div>
    );
  }

  const s = stats();

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsMeta.map((meta) => {
          const val = s[meta.key];
          let bgClass = 'bg-white';
          if (meta.key === 'done') bgClass = 'bg-green-50 border-green-200 hover:border-green-400';
          else if (meta.key === 'overdue') bgClass = 'bg-red-50 border-red-200 hover:border-red-400';
          else if (meta.key === 'near_deadline') bgClass = 'bg-amber-50 border-amber-200 hover:border-amber-400';
          return (
            <div
              key={meta.key}
              className={`${bgClass} border border-outline-variant p-4 rounded-lg flex flex-col items-center justify-center transition-hover hover:border-primary cursor-default`}
            >
              <span className="text-label-sm text-outline uppercase tracking-wider mb-1">{meta.label}</span>
              <span className={`text-headline-md font-bold ${meta.color}`}>{val}</span>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
        {filterDefs.map((def) => (
          <div key={def.key} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm cursor-pointer hover:bg-surface-container-high transition-colors relative group">
            <span className="text-outline">{def.label}</span>
            <select
              className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6 appearance-none cursor-pointer"
              value={filters[def.key]}
              onChange={(e) => setFilters(prev => ({ ...prev, [def.key]: e.target.value }))}
            >
              {def.options.map((opt) => {
                const statusLabels = { 'Tất cả': 'Tất cả', todo: 'Chưa bắt đầu', in_progress: 'Đang làm', review: 'Đang review', done: 'Hoàn thành', overdue: 'Quá hạn' };
                const priorityLabelsMap = { 'Tất cả': 'Tất cả', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
                const label = def.key === 'status' ? (statusLabels[opt] || opt) : def.key === 'priority' ? (priorityLabelsMap[opt] || opt) : opt;
                return (
                  <option key={opt} value={opt}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span className="material-symbols-outlined text-sm absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm">
          <span className="material-symbols-outlined text-sm text-outline">calendar_today</span>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder="Từ ngày"
          />
          <span className="text-outline">-</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder="Đến ngày"
          />
        </div>
        <button
          onClick={clearFilters}
          className="ml-auto text-error font-semibold text-sm flex items-center gap-1 hover:underline"
        >
          <span className="material-symbols-outlined text-sm">close</span>
          Xóa lọc
        </button>
      </div>

      {/* Quick Add Task */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-outline-variant shadow-sm">
        <input
          className="flex-1 border-none focus:ring-0 text-body-md placeholder:text-outline-variant outline-none"
          placeholder="Tên task mới..."
          type="text"
          value={quickTask.name}
          onChange={(e) => setQuickTask(prev => ({ ...prev, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
        />
        <div className="h-8 w-[1px] bg-outline-variant mx-1" />
        <select
          className="border-none bg-transparent focus:ring-0 text-sm font-medium pr-8 outline-none"
          value={quickTask.project}
          onChange={(e) => setQuickTask(prev => ({ ...prev, project: e.target.value }))}
        >
          <option value="">Dự án</option>
          <option>Social Q4</option>
          <option>Web Redesign</option>
          <option>PR Hub</option>
          <option>Campaigns</option>
        </select>
        <select
          className="border-none bg-transparent focus:ring-0 text-sm font-medium pr-8 outline-none"
          value={quickTask.assignee}
          onChange={(e) => setQuickTask(prev => ({ ...prev, assignee: e.target.value }))}
        >
          <option value="">Assignee</option>
          <option>An Nguyen</option>
          <option>Minh Le</option>
          <option>Thu Ha</option>
          <option>Khoa Vo</option>
        </select>
        <select
          className="border-none bg-transparent focus:ring-0 text-sm font-medium pr-8 outline-none"
          value={quickTask.priority}
          onChange={(e) => setQuickTask(prev => ({ ...prev, priority: e.target.value }))}
        >
           <option value="">Độ ưu tiên</option>
          <option>high</option>
          <option>medium</option>
          <option>low</option>
        </select>
        <input
          className="border-none bg-transparent focus:ring-0 text-sm font-medium outline-none"
          type="date"
          value={quickTask.due}
          onChange={(e) => setQuickTask(prev => ({ ...prev, due: e.target.value }))}
        />
        <button
          onClick={handleQuickAdd}
          className="bg-primary text-on-primary px-4 py-2 rounded font-label-md flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Thêm
        </button>
      </div>

      {/* Task Table */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="w-12 p-3"><span className="material-symbols-outlined text-outline">warning</span></th>
                <th className="p-3 text-label-sm text-outline uppercase whitespace-nowrap">Dự án</th>
                <th className="p-3 text-label-sm text-outline uppercase min-w-[250px]">Tên Task</th>
                <th className="p-3 text-label-sm text-outline uppercase">Người phụ trách</th>
                <th className="p-3 text-label-sm text-outline uppercase">Liên quan</th>
                <th className="p-3 text-label-sm text-outline uppercase">Trạng thái</th>
                <th className="p-3 text-label-sm text-outline uppercase">Ưu tiên</th>
                <th className="p-3 text-label-sm text-outline uppercase">Bắt đầu</th>
                <th className="p-3 text-label-sm text-outline uppercase">Hạn chót</th>
                <th className="p-3 text-label-sm text-outline uppercase">Hoàn thành</th>
                <th className="p-3 text-label-sm text-outline uppercase text-center"><span className="material-symbols-outlined">link</span></th>
                <th className="p-3 text-label-sm text-outline uppercase">Ghi chú</th>
                <th className="p-3 text-label-sm text-outline uppercase text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {pagedTasks.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-10 text-center text-outline">Không tìm thấy task</td>
                </tr>
              ) : (
                pagedTasks.map((task) => {
                  const st = statusStyles[task.status] || statusStyles.planning;
                  return (
                    <tr key={task.id} className={`${st.row} transition-colors`}>
                      <td className="p-3 text-center">
                        {st.icon ? (
                          <span
                            className={`material-symbols-outlined ${st.iconColor}`}
                            style={st.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          >
                            {st.icon}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 font-semibold text-sm">{task.project}</td>
                      <td className={`p-3 font-medium ${task.status === 'done' ? 'line-through text-outline' : ''}`}>
                        {task.taskName}
                      </td>
                      <td className="p-3">
                        <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                          {task.assignee.initials}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-outline">{task.stakeholders}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 ${st.bg} ${st.text} rounded text-xs font-bold uppercase tracking-tight`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-bold ${priorityColors[task.priority] || 'text-slate-600'}`}>
                          {priorityLabels[task.priority] || 'Medium'}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{task.start}</td>
                      <td className={`p-3 text-xs font-bold ${task.status === 'overdue' ? 'text-red-600' : task.status === 'done' ? '' : ''}`}>
                        {task.due}
                      </td>
                      <td className={`p-3 text-xs ${task.done ? 'text-green-700 font-bold' : ''}`}>
                        {task.done || '-'}
                      </td>
                      <td className="p-3 text-center">
                        {task.link ? (
                          <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary">{task.link.type}</span>
                        ) : (
                          <span className="material-symbols-outlined text-outline-variant cursor-pointer hover:text-primary">open_in_new</span>
                        )}
                      </td>
                      <td className="p-3 text-xs italic text-outline">{task.remark}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded transition-colors">
                            <span className="material-symbols-outlined text-lg">{task.status === 'done' ? 'visibility' : 'edit'}</span>
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded transition-colors">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface flex items-center justify-between">
          <span className="text-label-md text-outline">
            Hiển thị {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredTasks.length)} trong {filteredTasks.length} task
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                  p === page
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant hover:bg-surface-container-high'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
