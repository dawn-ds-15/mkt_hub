import { useEffect, useState, useCallback, useMemo } from 'react';
import { getTaskList, createTask, deleteTask, getProjects, getMembers } from '../../services/api';
import TaskEditDrawer from './TaskEditDrawer';
import TaskViewModal from './TaskViewModal';

function getISOWeek() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

const CURRENT_WEEK = getISOWeek();
const CURRENT_YEAR = new Date().getFullYear();

const statusStyles = {
  overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Quá hạn', row: 'bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100', icon: 'error', iconColor: 'text-red-600', fill: true },
  Planning: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Chưa làm', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Processing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Đang làm', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Hoàn thành', row: 'opacity-70 hover:opacity-100', icon: 'check_circle', iconColor: 'text-green-600' },
  Backlog: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Tồn đọng', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Pending: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Đang chờ', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Cancel: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Đã huỷ', row: 'opacity-60 hover:opacity-80', icon: 'cancel', iconColor: 'text-gray-500' },
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

const priorityWeight = { high: 3, medium: 2, low: 1 };

const statsMeta = [
  { key: 'total', label: 'Tổng cộng', color: 'text-primary' },
  { key: 'Planning', label: 'Chưa làm', color: 'text-secondary' },
  { key: 'Processing', label: 'Đang làm', color: 'text-primary-container' },
  { key: 'Done', label: 'Hoàn thành', color: 'text-green-700' },
  { key: 'Backlog', label: 'Tồn đọng', color: 'text-amber-600' },
  { key: 'Pending', label: 'Đang chờ', color: 'text-purple-600' },
  { key: 'Cancel', label: 'Đã huỷ', color: 'text-gray-500' },
  { key: 'overdue', label: 'Quá hạn', color: 'text-red-700' },
];

const statusFilterOptions = ['Tất cả', 'Planning', 'Processing', 'Done', 'Backlog', 'Pending', 'overdue'];

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editTask, setEditTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [draftFilters, setDraftFilters] = useState({
    project: 'Tất cả',
    status: 'Tất cả',
    priority: 'Tất cả',
    assignee: 'Tất cả',
    dateFrom: '',
    dateTo: '',
  });
  const [filters, setFilters] = useState({ ...draftFilters });
  const perPage = 10;

  const [showQuickAddPopup, setShowQuickAddPopup] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [quickTask, setQuickTask] = useState({
    name: '',
    projectId: '',
    assigneeId: '',
    priority: '',
    due: '',
    execWeek: CURRENT_WEEK,
    execYear: CURRENT_YEAR,
  });

  useEffect(() => {
    getProjects().then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    getMembers().then(r => {
      const m = Array.isArray(r.data) ? r.data : (r.data?.members || []);
      setMembers(m);
    }).catch(() => {});
  }, []);

  const fetchTasks = useCallback(() => {
    getTaskList().then((res) => {
      setTasks(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    let result = [...tasks];
    if (filters.project !== 'Tất cả') {
      result = result.filter(t => t.project === filters.project);
    }
    if (filters.status !== 'Tất cả') {
      if (filters.status === 'overdue') {
        result = result.filter(t => t.status === 'overdue');
      } else {
        result = result.filter(t => t.status === filters.status);
      }
    }
    if (filters.priority !== 'Tất cả') {
      result = result.filter(t => t.priority === filters.priority);
    }
    if (filters.assignee !== 'Tất cả') {
      result = result.filter(t => t.assignee?.name === filters.assignee);
    }
    if (filters.dateFrom) {
      result = result.filter(t => t.due && t.due !== '-' && new Date(t.due) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(t => t.due && t.due !== '-' && new Date(t.due) <= new Date(filters.dateTo));
    }
    result.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    setFilteredTasks(result);
    setPage(1);
  }, [filters, tasks]);

  const stats = useCallback(() => {
    const total = tasks.length;
    const st = { total, Planning: 0, Processing: 0, Done: 0, Backlog: 0, Pending: 0, Cancel: 0, overdue: 0 };
    tasks.forEach(t => {
      if (t.status === 'overdue') st.overdue++;
      else if (st[t.status] !== undefined) st[t.status]++;
    });
    return st;
  }, [tasks]);

  const applyFilters = () => {
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    const cleared = { project: 'Tất cả', status: 'Tất cả', priority: 'Tất cả', assignee: 'Tất cả', dateFrom: '', dateTo: '' };
    setDraftFilters(cleared);
    setFilters(cleared);
  };

  const totalPages = Math.ceil(filteredTasks.length / perPage);
  const pagedTasks = filteredTasks.slice((page - 1) * perPage, page * perPage);

  const handleQuickAdd = async () => {
    if (!quickTask.name.trim()) return;
    setQuickAddError('');
    const q = { ...quickTask };
    const pid = q.projectId || (projects.length > 0 ? projects[0].id : null);
    const aid = q.assigneeId || (members.length > 0 ? members[0].id : null);
    if (!pid || !aid) {
      setQuickAddError('Vui lòng chọn dự án và người phụ trách');
      return;
    }
    setQuickTask({ name: '', projectId: '', assigneeId: '', priority: '', due: '', execWeek: CURRENT_WEEK, execYear: CURRENT_YEAR });
    try {
      await createTask({
        title: q.name.trim(),
        projectId: pid,
        assigneeId: aid,
        priority: q.priority ? q.priority.charAt(0).toUpperCase() + q.priority.slice(1) : 'Medium',
        dueDate: q.due || undefined,
        execWeek: q.execWeek,
        execYear: q.execYear,
      });
      setShowQuickAddPopup(false);
      fetchTasks();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Tạo task thất bại';
      setQuickAddError(Array.isArray(msg) ? msg.join('; ') : msg);
    }
  };

  const userRole = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
      return u?.role || 'specialist';
    } catch { return 'specialist'; }
  })();

  const handleDeleteTask = async (task) => {
    if (!window.confirm('Xác nhận xóa task này?')) return;
    try {
      await deleteTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch {
      setTasks(prev => prev.filter(t => t.id !== task.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-outline">Đang tải dữ liệu...</p>
      </div>
    );
  }

  const s = stats();
  const filterDefs = [
    { key: 'project', label: 'Dự án:', options: ['Tất cả', ...projects.map(p => p.name)] },
    { key: 'status', label: 'Trạng thái:', options: statusFilterOptions },
    { key: 'priority', label: 'Ưu tiên:', options: ['Tất cả', 'high', 'medium', 'low'] },
    { key: 'assignee', label: 'Người phụ trách:', options: ['Tất cả', ...members.map(m => m.name)] },
  ];

  return (
    <>
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex flex-nowrap gap-2">
          {statsMeta.map((meta) => {
            const val = s[meta.key] ?? 0;
            const isActive = meta.key === 'total'
              ? filters.status === 'Tất cả'
              : filters.status === meta.key;
            let bgClass = 'bg-white';
            if (meta.key === 'Done') bgClass = 'bg-green-50 border-green-200 hover:border-green-400';
            else if (meta.key === 'Pending') bgClass = 'bg-purple-50 border-purple-200 hover:border-purple-400';
            else if (meta.key === 'overdue') bgClass = 'bg-red-50 border-red-200 hover:border-red-400';
            if (isActive) bgClass = bgClass.replace('border-outline-variant', 'border-primary').replace('hover:border-primary', '') + ' ring-2 ring-primary/30';
            return (
              <div
                key={meta.key}
                onClick={() => {
                  const status = meta.key === 'total' ? 'Tất cả' : meta.key;
                  setDraftFilters(prev => ({ ...prev, status }));
                  setFilters(prev => ({ ...prev, status }));
                }}
                className={`${bgClass} border ${isActive ? 'border-primary' : 'border-outline-variant'} p-2.5 rounded-lg flex flex-col items-center justify-center transition-all hover:border-primary cursor-pointer flex-1 min-w-0`}
              >
                <span className="text-[10px] text-outline uppercase tracking-wider mb-0.5 whitespace-nowrap">{meta.label}</span>
                <span className={`text-headline-sm font-bold ${meta.color}`}>{val}</span>
              </div>
            );
          })}
      </div>

      {/* Filter Bar + Quick Add */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
        {filterDefs.map((def) => (
          <div key={def.key} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm cursor-pointer hover:bg-surface-container-high transition-colors relative group">
            <span className="text-outline">{def.label}</span>
            <select
              className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6 appearance-none cursor-pointer"
              value={draftFilters[def.key]}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, [def.key]: e.target.value }))}
            >
              {def.options.map((opt) => {
                const statusLabels = { 'Tất cả': 'Tất cả', Planning: 'Chưa làm', Processing: 'Đang làm', Done: 'Hoàn thành', Backlog: 'Tồn đọng', Pending: 'Chờ xử lý', overdue: 'Quá hạn' };
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
            value={draftFilters.dateFrom || ''}
            onChange={(e) => setDraftFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder="Từ ngày"
          />
          <span className="text-outline">-</span>
          <input
            type="date"
            value={draftFilters.dateTo || ''}
            onChange={(e) => setDraftFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder="Đến ngày"
          />
        </div>
        <button
          onClick={applyFilters}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">filter_alt</span>
          Lọc
        </button>
        <button
          onClick={clearFilters}
          className="text-error font-semibold text-sm flex items-center gap-1 hover:underline whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">close</span>
          Xóa lọc
        </button>
        <button
          onClick={() => setShowQuickAddPopup(true)}
          className="ml-auto bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Thêm task
        </button>
      </div>

      {/* Quick Add Popup */}
      {showQuickAddPopup && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowQuickAddPopup(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Thêm task mới</h3>
              <button onClick={() => setShowQuickAddPopup(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tên task</label>
              <input
                className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                placeholder="Tên task mới..."
                type="text"
                value={quickTask.name}
                onChange={(e) => setQuickTask(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Dự án</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={quickTask.projectId}
                onChange={(e) => setQuickTask(prev => ({ ...prev, projectId: e.target.value }))}
              >
                <option value="">Chọn dự án</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Assignee</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={quickTask.assigneeId}
                onChange={(e) => setQuickTask(prev => ({ ...prev, assigneeId: e.target.value }))}
              >
                <option value="">Chọn người</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Độ ưu tiên</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={quickTask.priority}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="">Chọn</option>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hạn chót</label>
                <input
                  className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  type="date"
                  value={quickTask.due}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, due: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tuần thực hiện</label>
                <input
                  className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  type="number" min="1" max="53"
                  value={quickTask.execWeek}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, execWeek: +e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Năm thực hiện</label>
                <input
                  className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  type="number" min="2024" max="2030"
                  value={quickTask.execYear}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, execYear: +e.target.value }))}
                />
              </div>
            </div>
            {quickAddError && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {quickAddError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowQuickAddPopup(false); setQuickAddError(''); }}
                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleQuickAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all"
              >
                Thêm
              </button>
            </div>
          </div>
        </>
      )}

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
                  const st = statusStyles[task.status] || statusStyles.todo;
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
                        {task.linkUrl ? (
                          <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="material-symbols-outlined text-outline cursor-pointer hover:text-primary no-underline">open_in_new</a>
                        ) : (
                          <span className="material-symbols-outlined text-outline-variant">link_off</span>
                        )}
                      </td>
                      <td className="p-3 text-xs italic text-outline">{task.remark}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setViewTask(task)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </button>
                          <button
                            onClick={() => setEditTask(task)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          {userRole === 'manager' && (
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg text-red-500">delete</span>
                            </button>
                          )}
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

      {viewTask && (
        <TaskViewModal
          task={viewTask}
          onClose={() => setViewTask(null)}
        />
      )}
      {editTask && (
        <TaskEditDrawer
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => {
            fetchTasks();
            setEditTask(null);
          }}
          onDeleted={() => {
            if (editTask) setTasks(prev => prev.filter(t => t.id !== editTask.id));
            setEditTask(null);
          }}
        />
      )}
    </>
  );
}
