import { useEffect, useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, Search, CalendarDays, SlidersHorizontal, X, Plus, CircleAlert, ListChecks, Loader2, Trash2, TriangleAlert, Link2, CheckCircle2, CircleX, ExternalLink, Unlink, Eye, Pencil, ChevronLeft, ChevronRight, FileSpreadsheet, Upload, Download } from 'lucide-react';
import { getTaskList, createTask, deleteTask, getProjects, getMembers, importTasks, downloadTemplate, normalizeTaskStatus, TASK_STATUS_FALLBACK_LABELS, taskDateKey, isTaskDueSoon } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { translateTaskErrors } from '../../utils/taskErrors';
import { useDropdownOptions } from '../../hooks/useDropdownOptions';
import { useTaskStatusOptions, statusLabelOf } from '../../hooks/useTaskStatusOptions';
import TaskEditDrawer from './TaskEditDrawer';
import TaskViewModal from './TaskViewModal';

const statusIcons = {
  error: <CircleAlert className="w-[15px] h-[15px]" />,
  check_circle: <CheckCircle2 className="w-[15px] h-[15px]" />,
  cancel: <CircleX className="w-[15px] h-[15px]" />,
};

// Chỉ giữ MÀU/ICON theo khóa chuẩn — nhãn luôn lấy từ cấu hình dropdown, không hardcode ở đây.
const statusStyles = {
  overdue: { bg: 'bg-red-100', text: 'text-red-700', row: 'bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100', icon: 'error', iconColor: 'text-red-600', fill: true },
  Planning: { bg: 'bg-slate-100', text: 'text-slate-700', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Processing: { bg: 'bg-blue-100', text: 'text-blue-700', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Done: { bg: 'bg-green-100', text: 'text-green-700', row: 'opacity-70 hover:opacity-100', icon: 'check_circle', iconColor: 'text-green-600' },
  Backlog: { bg: 'bg-amber-100', text: 'text-amber-700', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Pending: { bg: 'bg-purple-100', text: 'text-purple-700', row: 'hover:bg-surface-container-low', icon: null, iconColor: null },
  Cancel: { bg: 'bg-gray-100', text: 'text-gray-600', row: 'opacity-60 hover:opacity-80', icon: 'cancel', iconColor: 'text-gray-500' },
};

// Trạng thái người dùng tự thêm (không thuộc 7 khóa chuẩn) vẫn hiển thị được, màu trung tính.
const neutralStatusStyle = { bg: 'bg-slate-100', text: 'text-slate-700', row: 'hover:bg-surface-container-low', icon: null, iconColor: null };

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

// Màu ô thống kê theo khóa chuẩn; trạng thái lạ dùng màu trung tính.
const statTileStyles = {
  Planning: { color: 'text-secondary', bg: 'bg-blue-50' },
  Processing: { color: 'text-primary-container', bg: 'bg-amber-50' },
  Done: { color: 'text-green-700', bg: 'bg-emerald-50' },
  Backlog: { color: 'text-amber-600', bg: 'bg-yellow-50' },
  Pending: { color: 'text-purple-600', bg: 'bg-purple-50' },
  Cancel: { color: 'text-gray-500', bg: 'bg-slate-50' },
  overdue: { color: 'text-red-700', bg: 'bg-rose-50' },
};
const neutralTileStyle = { color: 'text-on-surface', bg: 'bg-white' };

export default function TaskList({ projectId: projectIdProp, focusTaskId, onFocusHandled, dueFilter, onDueFilterHandled }) {
  const { locale } = useDashboard();
  const showToast = useToast();
  const taskStatusOpts = useTaskStatusOptions();
  const taskPriorityOpts = useDropdownOptions('task_priority');
  const stakeholderOpts = useDropdownOptions('stakeholder');
  // t.status dùng 'overdue' viết thường (xem taskStatusToMock), các khóa còn lại viết hoa.
  const statusKeyOf = (o) => (o.key === 'Overdue' ? 'overdue' : o.key);
  const statusFilterOptions = useMemo(() => ['Tất cả', ...taskStatusOpts.map(statusKeyOf)], [taskStatusOpts]);
  // Chế độ tiếng Việt: ưu tiên nhãn Việt chuẩn theo khóa (đừng phụ thuộc nhãn trong dropdown config,
  // vì config có thể đang chứa tiếng Anh). Tiếng Anh / trạng thái lạ: dùng nhãn cấu hình như cũ.
  const statusLabelFor = (key) => {
    const canonical = key === 'overdue' ? 'Overdue' : normalizeTaskStatus(key);
    if (locale === 'vi' && canonical && TASK_STATUS_FALLBACK_LABELS[canonical]) {
      return TASK_STATUS_FALLBACK_LABELS[canonical];
    }
    return statusLabelOf(taskStatusOpts, key === 'overdue' ? 'Overdue' : key);
  };
  // Thứ tự sắp xếp = thứ tự trong tab Cấu hình Dropdown.
  const statusOrder = useMemo(() => {
    const order = {};
    taskStatusOpts.forEach((o, i) => { order[statusKeyOf(o)] = i; });
    return order;
  }, [taskStatusOpts]);
  // Số ô thống kê = 1 ô "Tổng cộng" + đúng số trạng thái đang cấu hình.
  const statsMeta = useMemo(() => [
    { key: 'total', label: locale === 'vi' ? 'Tổng cộng' : 'Total', color: 'text-primary', bg: 'bg-white' },
    ...taskStatusOpts.map((o) => {
      const key = statusKeyOf(o);
      const tile = statTileStyles[key] || neutralTileStyle;
      return { key, label: statusLabelFor(statusKeyOf(o)), color: tile.color, bg: tile.bg };
    }),
  ], [taskStatusOpts, locale]);
  const priorityFilterOptions = useMemo(() => ['Tất cả', ...taskPriorityOpts.map(o => o.label.toLowerCase())], [taskPriorityOpts]);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
  const perPage = 10;

  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');

  const [showQuickAddPopup, setShowQuickAddPopup] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [quickAddMode, setQuickAddMode] = useState('manual');
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [quickTask, setQuickTask] = useState({
    name: '',
    projectId: '',
    assigneeId: '',
    priority: '',
    due: '',
    startDate: '',
    status: '',
    description: '',
    link: '',
    remark: '',
  });
  const [quickStakeholders, setQuickStakeholders] = useState([]);
  const [quickSubtasks, setQuickSubtasks] = useState([]);
  const [newQuickSubtask, setNewQuickSubtask] = useState('');
  const [quickSubtaskSeq, setQuickSubtaskSeq] = useState(0);

  useEffect(() => {
    getProjects().then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(e => console.error('[TaskList] getProjects:', e));
    getMembers().then(r => {
      const m = Array.isArray(r.data) ? r.data : (r.data?.members || []);
      setMembers(m);
    }).catch(e => console.error('[TaskList] getMembers:', e));
  }, []);

  useEffect(() => {
    if (projectIdProp && projects.length > 0) {
      const matched = projects.find(p => p.id === projectIdProp);
      if (matched) {
        const projectName = matched.name;
        setDraftFilters(prev => ({ ...prev, project: projectName }));
        setFilters(prev => ({ ...prev, project: projectName }));
      }
    }
  }, [projectIdProp, projects]);

  const fetchTasks = useCallback(() => {
    getTaskList({}).then((res) => {
      setTasks(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Mở sẵn task được chỉ định qua URL (?taskId=...), vd. bấm task từ Báo cáo tuần.
  useEffect(() => {
    if (!focusTaskId || loading) return;
    const found = tasks.find(t => String(t.id) === String(focusTaskId));
    if (found) setViewTask(found);
    else showToast(locale === 'vi' ? 'Không tìm thấy task (có thể đã bị xoá)' : 'Task not found (it may have been deleted)', 'error');
    onFocusHandled?.();
  }, [focusTaskId, loading, tasks]);

  // Bấm badge Quá hạn / Sắp hạn trên Topbar (?due=overdue|soon): bỏ mọi bộ lọc khác để danh sách
  // khớp đúng số trên badge.
  useEffect(() => {
    if (dueFilter !== 'overdue' && dueFilter !== 'soon') return;
    const next = { project: 'Tất cả', status: dueFilter === 'overdue' ? 'overdue' : 'Tất cả', priority: 'Tất cả', assignee: 'Tất cả', dateFrom: '', dateTo: '' };
    setDraftFilters(next);
    setFilters(next);
    setSearchTerm('');
    setDueSoonOnly(dueFilter === 'soon');
    onDueFilterHandled?.();
  }, [dueFilter]);

  useEffect(() => {
    let result = [...tasks];
    if (dueSoonOnly) {
      result = result.filter(t => isTaskDueSoon(t));
    }
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
      result = result.filter(t => { const k = taskDateKey(t.dueDate); return k && k >= filters.dateFrom; });
    }
    if (filters.dateTo) {
      result = result.filter(t => { const k = taskDateKey(t.dueDate); return k && k <= filters.dateTo; });
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(t => t.taskName && t.taskName.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });
    setFilteredTasks(result);
    setPage(1);
  }, [filters, tasks, searchTerm, dueSoonOnly]);

  const stats = useCallback(() => {
    const st = { total: tasks.length };
    taskStatusOpts.forEach((o) => { st[statusKeyOf(o)] = 0; });
    tasks.forEach(t => {
      if (st[t.status] !== undefined) st[t.status]++;
    });
    return st;
  }, [tasks, taskStatusOpts]);

  const applyFilters = () => {
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    const cleared = { project: 'Tất cả', status: 'Tất cả', priority: 'Tất cả', assignee: 'Tất cả', dateFrom: '', dateTo: '' };
    setDraftFilters(cleared);
    setFilters(cleared);
    setDueSoonOnly(false);
  };

  const totalPages = Math.ceil(filteredTasks.length / perPage);
  const pagedTasks = filteredTasks.slice((page - 1) * perPage, page * perPage);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const items = [];
    if (start > 1) {
      items.push(1);
      if (start > 2) items.push('...');
    }
    for (let i = start; i <= end; i++) items.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) items.push('...');
      items.push(totalPages);
    }
    return items;
  }, [page, totalPages]);

  const handlePageJump = () => {
    const num = parseInt(pageJumpValue, 10);
    if (!Number.isNaN(num)) {
      setPage(Math.min(totalPages, Math.max(1, num)));
    }
    setShowPageJump(false);
  };

  const handleQuickAdd = async () => {
    if (!quickTask.name.trim()) return;
    setQuickAddError('');
    if (quickTask.startDate && quickTask.due && new Date(quickTask.due) < new Date(quickTask.startDate)) {
      setQuickAddError(locale === 'vi' ? 'Hạn chót không được trước ngày bắt đầu' : 'Due date cannot be before start date');
      return;
    }
    const q = { ...quickTask };
    const pid = q.projectId || (projects.length > 0 ? projects[0].id : null);
    const aid = q.assigneeId || (members.length > 0 ? members[0].id : null);
    if (!pid || !aid) {
      setQuickAddError(locale === 'vi' ? 'Vui lòng chọn dự án và người phụ trách' : 'Please select project and assignee');
      return;
    }
    setQuickTask({ name: '', projectId: '', assigneeId: '', priority: '', due: '', startDate: '', status: '', description: '', link: '', remark: '' });
    setQuickStakeholders([]);
    setQuickSubtasks([]);
    setNewQuickSubtask('');
    try {
      await createTask({
        title: q.name.trim(),
        projectId: pid,
        assigneeId: aid,
        priority: q.priority ? q.priority.charAt(0).toUpperCase() + q.priority.slice(1) : 'Medium',
        dueDate: q.due || undefined,
        startDate: q.startDate || undefined,
        status: q.status || undefined,
        description: q.description || undefined,
        link: q.link || undefined,
        remark: q.remark || undefined,
        stakeholders: quickStakeholders.length ? quickStakeholders : undefined,
        subtasks: quickSubtasks.length ? quickSubtasks.map(s => ({ id: s.id, text: s.text, done: s.done, doneDate: s.doneDate })) : undefined,
      });
      setShowQuickAddPopup(false);
      setQuickStakeholders([]);
      fetchTasks();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Tạo task thất bại' : 'Create task failed');
      setQuickAddError(translateTaskErrors(msg, locale));
    }
  };

  const importColMap = useMemo(() => ({
    NUMBER: 'number',
    TASK: 'task',
    'START-DAY': 'startDay',
    'END-DAY': 'endDay',
    PIC: 'pic',
    STAKEHOLDER: 'stakeholder',
    STATUS: 'status',
    'OUTPUT REQUIRE': 'outputRequire',
    FILE: 'file',
    NOTE: 'note',
  }), []);

  const openImportPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => { if (input.files[0]) handleImportFile(input.files[0]); };
    input.click();
  };

  const handleImportFile = async (file) => {
    setImportResult(null);
    setImportError('');
    setImportFile(file);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) {
        setImportError(locale === 'vi' ? 'File không có dữ liệu hàng loạt' : 'File has no data rows');
        setImportPreview([]);
        return;
      }
      const headers = rows[0].map((h, i) => ({ raw: String(h).trim(), idx: i }));
      const findCol = (key) => {
        const norm = key.toUpperCase().replace(/\s+/g, ' ');
        return headers.find(({ raw }) => raw.toUpperCase().replace(/\s+/g, ' ') === norm)?.idx;
      };
      if (findCol('TASK') === undefined) {
        setImportError(locale === 'vi'
          ? 'File không đúng định dạng template (thiếu cột TASK). Vui lòng dùng template kế hoạch task chiến dịch.'
          : 'File does not match the template (missing TASK column). Please use the campaign task plan template.');
        setImportPreview([]);
        return;
      }
      const col = Object.fromEntries(Object.keys(importColMap).map((k) => [importColMap[k], findCol(k)]));
      const preview = rows.slice(1).map((r) => ({
        task: r[col.task] != null ? String(r[col.task]) : '',
        startDay: r[col.startDay] != null ? String(r[col.startDay]) : '',
        endDay: r[col.endDay] != null ? String(r[col.endDay]) : '',
        pic: r[col.pic] != null ? String(r[col.pic]) : '',
        status: r[col.status] != null ? String(r[col.status]) : '',
        outputRequire: r[col.outputRequire] != null ? String(r[col.outputRequire]) : '',
        file: r[col.file] != null ? String(r[col.file]) : '',
        note: r[col.note] != null ? String(r[col.note]) : '',
      })).filter((r) => r.task.trim());
      if (preview.length === 0) {
        setImportError(locale === 'vi' ? 'File không có task nào để import' : 'File has no tasks to import');
      }
      setImportPreview(preview);
    } catch (e) {
      setImportError(locale === 'vi' ? 'Không đọc được file Excel' : 'Cannot read Excel file');
      setImportPreview([]);
    }
  };

  const handleImportSubmit = async () => {
    if (!quickTask.projectId) {
      setImportError(locale === 'vi' ? 'Vui lòng chọn dự án trước khi import' : 'Please select a project before importing');
      return;
    }
    if (!importFile) {
      setImportError(locale === 'vi' ? 'Vui lòng chọn file Excel' : 'Please select an Excel file');
      return;
    }
    setImporting(true);
    setImportError('');
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('projectId', quickTask.projectId);
    fd.append('year', new Date().getFullYear().toString());
    fd.append('confirm', 'true');
    try {
      const res = await importTasks(fd);
      setImportResult(res.data);
      if (res.data.imported > 0) {
        showToast(locale === 'vi'
          ? `Import thành công ${res.data.imported} dòng${res.data.errors > 0 ? `, ${res.data.errors} dòng lỗi` : ''}`
          : `Successfully imported ${res.data.imported} rows${res.data.errors > 0 ? `, ${res.data.errors} error rows` : ''}`, res.data.errors > 0 ? 'error' : 'success');
        fetchTasks();
      }
      if (res.data.imported > 0 && res.data.errors === 0) {
        setShowQuickAddPopup(false);
        setQuickAddMode('manual');
        setImportFile(null);
        setImportPreview([]);
        setImportResult(null);
      }
      if (res.data.imported === 0) {
        setImportError(res.data.errorList?.[0] || (locale === 'vi' ? 'Import thất bại' : 'Import failed'));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || (locale === 'vi' ? 'Lỗi khi import dữ liệu' : 'Error importing data');
      setImportError(locale === 'vi' ? `Import thất bại: ${msg}` : `Import failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadTemplate('tasks').catch(() => {
      showToast(locale === 'vi' ? 'Tải template thất bại' : 'Failed to download template', 'error');
    });
  };

  const userRole = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
      return u?.role || 'specialist';
    } catch { return 'specialist'; }
  })();

  const handleDeleteTask = async (task) => {
    if (!window.confirm(locale === 'vi' ? 'Xác nhận xóa task này?' : 'Confirm delete this task?')) return;
    try {
      await deleteTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Xóa task thất bại' : 'Delete task failed');
      alert(msg);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const pageIds = pagedTasks.map(t => t.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id));
    setSelected(prev => allSelected ? prev.filter(id => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]);
  };

  const selectedNames = filteredTasks.filter(t => selected.includes(t.id)).map(t => t.taskName);

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(locale === 'vi' ? `Xác nhận xóa ${selected.length} task đã chọn?` : `Delete ${selected.length} selected tasks?`)) return;
    setDeleting(true);
    try {
      await Promise.all(selected.map(id => deleteTask(id)));
      setSelected([]);
      setTasks(prev => prev.filter(t => !selected.includes(t.id)));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Xóa task thất bại' : 'Delete task failed');
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-outline">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
      </div>
    );
  }

  const s = stats();
  const filterDefs = [
    { key: 'project', label: locale === 'vi' ? 'Dự án:' : 'Project:', options: ['Tất cả', ...projects.map(p => p.name)] },
    { key: 'status', label: locale === 'vi' ? 'Trạng thái:' : 'Status:', options: statusFilterOptions },
    { key: 'priority', label: locale === 'vi' ? 'Ưu tiên:' : 'Priority:', options: priorityFilterOptions },
    { key: 'assignee', label: locale === 'vi' ? 'Người phụ trách:' : 'Assignee:', options: ['Tất cả', ...members.map(m => m.name)] },
  ];

  return (
    <>
    <div className="space-y-6">
      {/* Stats Bar */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:[grid-template-columns:repeat(var(--stat-cols),minmax(0,1fr))]"
        style={{ '--stat-cols': statsMeta.length }}
      >
          {statsMeta.map((meta) => {
            const val = s[meta.key] ?? 0;
            const isActive = meta.key === 'total'
              ? filters.status === 'Tất cả'
              : filters.status === meta.key;
            const bgClass = meta.bg;
            const borderCls = isActive
              ? (meta.key === 'overdue' ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-primary ring-2 ring-primary/30')
              : 'border-outline-variant';
            return (
              <div
                key={meta.key}
                onClick={() => {
                  const status = meta.key === 'total' ? 'Tất cả' : meta.key;
                  setDraftFilters(prev => ({ ...prev, status }));
                  setFilters(prev => ({ ...prev, status }));
                }}
                className={`${bgClass} ${borderCls} p-2.5 rounded-lg flex flex-col items-center justify-center transition-all hover:border-primary cursor-pointer border`}
              >
                <span className="text-[10px] text-outline uppercase tracking-wider whitespace-nowrap">{meta.label}</span>
                <span className={`text-lg font-extrabold tracking-tight mt-0.5 leading-tight ${meta.color}`}>{val}</span>
              </div>
            );
          })}
      </div>

      {/* Filter Bar + Quick Add */}
      <div className="flex flex-wrap items-center gap-2 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant">
        {dueSoonOnly && (
          <button
            onClick={() => setDueSoonOnly(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition-colors"
            title={locale === 'vi' ? 'Bỏ lọc sắp hạn' : 'Remove due-soon filter'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {locale === 'vi' ? 'Sắp hạn (3 ngày tới)' : 'Due soon (next 3 days)'}
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {filterDefs.map((def) => (
          <div key={def.key} className="flex items-center gap-2 px-2.5 py-1 bg-white border border-outline-variant rounded text-xs cursor-pointer hover:bg-surface-container-high transition-colors relative group">
            <span className="text-outline hidden sm:inline">{def.label}</span>
            <select
              className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6 appearance-none cursor-pointer"
              value={draftFilters[def.key]}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, [def.key]: e.target.value }))}
            >
              {def.options.map((opt) => {
                const allLabel = locale === 'vi' ? 'Tất cả' : 'All';
                const priorityLabelsMap = { 'Tất cả': allLabel, high: locale === 'vi' ? 'Cao' : 'High', medium: locale === 'vi' ? 'Trung bình' : 'Medium', low: locale === 'vi' ? 'Thấp' : 'Low' };
                const label = def.key === 'status' ? (opt === 'Tất cả' ? allLabel : statusLabelFor(opt)) : def.key === 'priority' ? (priorityLabelsMap[opt] || opt) : (opt === 'Tất cả' ? allLabel : opt);
                return (
                  <option key={opt} value={opt}>
                    {label}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
          </div>
        ))}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-outline-variant rounded text-xs min-w-[180px]">
          <Search className="w-4 h-4 text-outline" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-full"
            placeholder={locale === 'vi' ? 'Tìm tên task...' : 'Search task name...'}
          />
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-outline-variant rounded text-xs">
          <CalendarDays className="w-4 h-4 text-outline" />
          <input
            type="date"
            value={draftFilters.dateFrom || ''}
            onChange={(e) => setDraftFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder={locale === 'vi' ? 'Từ ngày' : 'From date'}
          />
          <span className="text-outline">-</span>
          <input
            type="date"
            value={draftFilters.dateTo || ''}
            onChange={(e) => setDraftFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
            placeholder={locale === 'vi' ? 'Đến ngày' : 'To date'}
          />
        </div>
        <button
          onClick={applyFilters}
          className="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-label-md flex items-center gap-1.5 hover:bg-primary/90 transition-transform active:scale-95"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {locale === 'vi' ? 'Lọc' : 'Filter'}
        </button>
        <button
          onClick={clearFilters}
          className="text-error font-semibold text-xs flex items-center gap-1 hover:underline whitespace-nowrap"
        >
          <X className="w-4 h-4" />
          {locale === 'vi' ? 'Xóa lọc' : 'Clear Filters'}
        </button>
        <button
          onClick={() => { setShowQuickAddPopup(true); setQuickAddMode('manual'); setImportFile(null); setImportPreview([]); setImportResult(null); setImportError(''); }}
          className="ml-auto bg-primary text-on-primary px-3 py-1.5 rounded-lg font-label-md flex items-center gap-1.5 hover:bg-primary/90 transition-transform active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {locale === 'vi' ? 'Thêm task' : 'Add Task'}
        </button>
      </div>

      {/* Quick Add Popup */}
      {showQuickAddPopup && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowQuickAddPopup(false)} />
          <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] ${quickAddMode === 'excel' ? 'max-w-2xl' : 'max-w-lg'} bg-white rounded-xl shadow-2xl z-50 p-6 space-y-4 max-h-[85vh] overflow-y-auto`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{locale === 'vi' ? 'Thêm task mới' : 'New Task'}</h3>
              <button onClick={() => setShowQuickAddPopup(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="flex p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setQuickAddMode('manual')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${quickAddMode === 'manual' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {locale === 'vi' ? 'Thêm thủ công' : 'Manual'}
              </button>
              <button
                onClick={() => {
                  setQuickAddMode('excel');
                  setQuickAddError('');
                }}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${quickAddMode === 'excel' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                {locale === 'vi' ? 'Import Excel' : 'Excel Import'}
              </button>
            </div>
            {quickAddMode === 'manual' ? (
            <>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Tên task' : 'Task Name'}</label>
              <input
                className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                placeholder={locale === 'vi' ? 'Tên task mới...' : 'New task name...'}
                type="text"
                value={quickTask.name}
                onChange={(e) => setQuickTask(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Dự án' : 'Project'}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={quickTask.projectId}
                onChange={(e) => setQuickTask(prev => ({ ...prev, projectId: e.target.value }))}
              >
                <option value="">{locale === 'vi' ? 'Chọn dự án' : 'Select project'}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Assignee' : 'Assignee'}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={quickTask.assigneeId}
                onChange={(e) => setQuickTask(prev => ({ ...prev, assigneeId: e.target.value }))}
              >
                <option value="">{locale === 'vi' ? 'Chọn người' : 'Select person'}</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Độ ưu tiên' : 'Priority'}</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={quickTask.priority}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="">{locale === 'vi' ? 'Chọn' : 'Select'}</option>
                  {taskPriorityOpts.map(o => (
                    <option key={o.id} value={o.label.toLowerCase()}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={quickTask.status}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">{locale === 'vi' ? 'Chọn' : 'Select'}</option>
                  {taskStatusOpts.map(o => (
                    <option key={o.id} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</label>
                <input
                  className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  type="date"
                  value={quickTask.due}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, due: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ngày bắt đầu' : 'Start Date'}</label>
                <input
                  className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  type="date"
                  value={quickTask.startDate}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Đầu ra yêu cầu (Output Requirement)' : 'Output Requirement'}</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-none"
                rows={2}
                value={quickTask.description}
                onChange={(e) => setQuickTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder={locale === 'vi' ? 'Mô tả đầu ra yêu cầu...' : 'Describe the required output...'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'File (link)' : 'File (link)'}</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                type="text"
                value={quickTask.link}
                onChange={(e) => setQuickTask(prev => ({ ...prev, link: e.target.value }))}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ghi chú' : 'Note'}</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                type="text"
                value={quickTask.remark}
                onChange={(e) => setQuickTask(prev => ({ ...prev, remark: e.target.value }))}
                placeholder={locale === 'vi' ? 'Ghi chú...' : 'Note...'}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Stakeholders (người liên quan)' : 'Stakeholders (related)'}</label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickStakeholders.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                    {s}
                    <button onClick={() => setQuickStakeholders(prev => prev.filter(x => x !== s))} className="text-gray-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-xs focus:border-blue-500 focus:ring-0 outline-none"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setQuickStakeholders(prev => [...prev, v]);
                  e.target.value = '';
                }}
              >
                <option value="">{locale === 'vi' ? '+ Thêm stakeholder' : '+ Add stakeholder'}</option>
                {stakeholderOpts
                  .filter(o => !quickStakeholders.some(s => s.toLowerCase() === o.label.toLowerCase()))
                  .map(o => <option key={o.id || o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Task nhỏ (checklist)' : 'Sub-tasks (checklist)'}</label>
              <div className="space-y-1">
                {quickSubtasks.map((st, i) => (
                  <div key={st.id} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
                    <input type="checkbox" checked={st.done} onChange={() => setQuickSubtasks(prev => prev.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="w-4 h-4 accent-blue-600 shrink-0" />
                    <span className={`text-sm flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{st.text}</span>
                    <button onClick={() => setQuickSubtasks(prev => prev.filter(x => x.id !== st.id))} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={newQuickSubtask}
                  onChange={(e) => setNewQuickSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newQuickSubtask.trim()) {
                      setQuickSubtasks(prev => [...prev, { id: `q-${quickSubtaskSeq}`, text: newQuickSubtask.trim(), done: false, doneDate: null }]);
                      setQuickSubtaskSeq(n => n + 1);
                      setNewQuickSubtask('');
                    }
                  }}
                  placeholder={locale === 'vi' ? 'Tên task nhỏ...' : 'Sub-task name...'}
                />
                <button
                  onClick={() => {
                    if (newQuickSubtask.trim()) {
                      setQuickSubtasks(prev => [...prev, { id: `q-${quickSubtaskSeq}`, text: newQuickSubtask.trim(), done: false, doneDate: null }]);
                      setQuickSubtaskSeq(n => n + 1);
                      setNewQuickSubtask('');
                    }
                  }}
                  disabled={!newQuickSubtask.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {locale === 'vi' ? 'Thêm' : 'Add'}
                </button>
              </div>
            </div>
            {quickAddError && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <CircleAlert className="w-4 h-4" />
                {quickAddError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowQuickAddPopup(false); setQuickAddError(''); }}
                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={handleQuickAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all"
              >
                {locale === 'vi' ? 'Thêm' : 'Add'}
              </button>
            </div>
            </>
            ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Dự án (áp dụng cho toàn bộ dòng import)' : 'Project (applies to all imported rows)'}</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={quickTask.projectId}
                  onChange={(e) => setQuickTask(prev => ({ ...prev, projectId: e.target.value }))}
                >
                  <option value="">{locale === 'vi' ? 'Chọn dự án' : 'Select project'}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'File kế hoạch task chiến dịch (.xlsx/.csv)' : 'Campaign task plan file (.xlsx/.csv)'}</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImportDragOver(false);
                    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
                  }}
                  onClick={openImportPicker}
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 text-center cursor-pointer transition-all ${
                    importDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  {importFile ? (
                    <>
                      <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                      <p className="text-sm font-semibold text-gray-800">{importFile.name}</p>
                      <p className="text-xs text-gray-500">{locale === 'vi' ? 'Click để chọn file khác' : 'Click to choose another file'}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm text-gray-600">{locale === 'vi' ? 'Kéo thả file vào đây hoặc click để chọn' : 'Drag & drop file here or click to select'}</p>
                    </>
                  )}
                </div>
              </div>

              {importPreview.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    {locale === 'vi' ? `Xem trước (${importPreview.length} dòng)` : `Preview (${importPreview.length} rows)`}
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] uppercase text-gray-500">
                          <th className="px-2 py-1.5">#</th>
                          <th className="px-2 py-1.5">{locale === 'vi' ? 'Tên task' : 'Task'}</th>
                          <th className="px-2 py-1.5">{locale === 'vi' ? 'Bắt đầu' : 'Start'}</th>
                          <th className="px-2 py-1.5">{locale === 'vi' ? 'Kết thúc' : 'End'}</th>
                          <th className="px-2 py-1.5">{locale === 'vi' ? 'PIC' : 'PIC'}</th>
                          <th className="px-2 py-1.5">{locale === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                            <td className="px-2 py-1.5 font-medium text-gray-800 max-w-[180px] truncate">{r.task}</td>
                            <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{r.startDay}</td>
                            <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{r.endDay}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.pic}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.length > 5 && (
                      <p className="text-[10px] text-gray-400 px-2 py-1 border-t border-gray-100">
                        {locale === 'vi' ? `và ${importPreview.length - 5} dòng khác` : `and ${importPreview.length - 5} more rows`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importResult && importResult.errors > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">
                    {locale === 'vi' ? `Lỗi (${importResult.errors})` : `Errors (${importResult.errors})`}
                  </label>
                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
                    {importResult.errorList?.slice(0, 20).map((err, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-100">
                        <CircleAlert className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700 break-words">{err}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importError && (
                <p className="text-red-600 text-xs flex items-center gap-1">
                  <CircleAlert className="w-4 h-4 shrink-0" />
                  {importError}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {locale === 'vi' ? 'Tải template' : 'Download Template'}
                </button>
                <button
                  onClick={() => { setShowQuickAddPopup(false); setQuickAddMode('manual'); setQuickAddError(''); setImportFile(null); setImportPreview([]); setImportResult(null); setImportError(''); }}
                  className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  {locale === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={!importFile || importing}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {importing
                    ? (locale === 'vi' ? 'Đang import...' : 'Importing...')
                    : (locale === 'vi' ? 'Import hàng loạt' : 'Import Batch')}
                </button>
              </div>
            </div>
            )}
          </div>
        </>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-on-surface">
              {locale === 'vi' ? `Đã chọn ${selected.length} task` : `${selected.length} tasks selected`}
            </span>
            <span className="text-xs text-on-surface-variant truncate hidden md:inline">
              {selectedNames.slice(0, 2).join(', ')}{selectedNames.length > 2 ? ` +${selectedNames.length - 2}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-lg border border-outline-variant bg-white text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {locale === 'vi' ? 'Bỏ chọn' : 'Clear'}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting
                ? (locale === 'vi' ? 'Đang xóa...' : 'Deleting...')
                : (locale === 'vi' ? 'Xóa hàng loạt' : 'Delete selected')}
            </button>
          </div>
        </div>
      )}

      {/* Task Table */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-outline">
                <th className="w-10 p-2.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                    checked={pagedTasks.length > 0 && pagedTasks.every(t => selected.includes(t.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="w-10 p-2.5"><TriangleAlert className="w-4 h-4 text-outline" /></th>
                <th className="p-2.5 whitespace-nowrap">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                <th className="p-2.5 min-w-[240px]">{locale === 'vi' ? 'Tên Task' : 'Task Name'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Người phụ trách' : 'Assignee'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Liên quan' : 'Related'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Ưu tiên' : 'Priority'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Bắt đầu' : 'Start'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Tuần' : 'Week'}</th>
                <th className="p-2.5">{locale === 'vi' ? 'Hoàn thành' : 'Completed'}</th>
                <th className="p-2.5 text-center"><Link2 className="w-4 h-4" /></th>
                <th className="p-2.5">{locale === 'vi' ? 'Ghi chú' : 'Notes'}</th>
                <th className="p-2.5 text-center">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {pagedTasks.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-10 text-center text-outline">{locale === 'vi' ? 'Không tìm thấy task' : 'No tasks found'}</td>
                </tr>
              ) : (
                pagedTasks.map((task) => {
                  const st = statusStyles[task.status] || neutralStatusStyle;
                  return (
                    <tr key={task.id} className={`${st.row} transition-colors`}>
                      <td className="p-2.5 text-center align-middle">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                          checked={selected.includes(task.id)}
                          onChange={() => toggleSelect(task.id)}
                        />
                      </td>
                      <td className="p-2.5 text-center align-middle">
                        {st.icon ? (
                          <span className={`inline-flex ${st.iconColor}`}>
                            {statusIcons[st.icon]}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2.5 font-medium align-middle">{task.project}</td>
                      <td className={`p-2.5 font-semibold align-middle ${task.status === 'Done' ? 'line-through text-outline' : ''}`}>
                        {task.taskName}
                      </td>
                      <td className="p-2.5 align-middle">
                        <div className="w-6 h-6 rounded-full border border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                          {task.assignee.initials}
                        </div>
                      </td>
                      <td className="p-2.5 text-xs text-outline align-middle">{task.stakeholders}</td>
                      <td className="p-2.5 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 ${st.bg} ${st.text} rounded text-[10px] font-bold uppercase tracking-tight leading-none`}>
                          {statusLabelFor(task.status)}
                        </span>
                      </td>
                      <td className="p-2.5 align-middle">
                        <span className={`text-xs font-bold ${priorityColors[task.priority] || 'text-slate-600'}`}>
                          {locale === 'vi' ? (priorityLabels[task.priority] || 'Medium') : ({ high: 'High', medium: 'Medium', low: 'Low' })[task.priority] || 'Medium'}
                        </span>
                      </td>
                      <td className="p-2.5 align-middle">{task.start}</td>
                      <td className={`p-2.5 font-bold align-middle ${task.status === 'overdue' ? 'text-red-600' : ''}`}>
                        {task.due}
                      </td>
                      <td className="p-2.5 text-outline align-middle">
                        {task.execWeek ? `W${task.execWeek}` : (task.durationWeeks ? `${task.durationWeeks}w` : '—')}
                      </td>
                      <td className={`p-2.5 align-middle ${task.done ? 'text-green-700 font-bold' : ''}`}>
                        {task.done || '-'}
                      </td>
                      <td className="p-2.5 text-center align-middle">
                        {task.linkUrl ? (
                          <a href={/^https?:\/\//i.test(task.linkUrl) ? task.linkUrl : `https://${task.linkUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex text-outline cursor-pointer hover:text-primary no-underline">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <Unlink className="w-4 h-4 text-outline-variant" />
                        )}
                      </td>
                      <td className="p-2.5 italic text-outline align-middle">{task.remark}</td>
                      <td className="p-2.5 align-middle">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => setViewTask(task)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/5 rounded transition-colors"
                            title={locale === 'vi' ? 'Xem chi tiết' : 'View Details'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditTask(task)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/5 rounded transition-colors"
                            title={locale === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {userRole === 'manager' && (
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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
        <div className="p-3 border-t border-outline-variant bg-surface items-center justify-between hidden lg:flex">
          <span className="text-xs text-outline">
            {locale === 'vi' ? `Hiển thị ${(page - 1) * perPage + 1}-${Math.min(page * perPage, filteredTasks.length)} trong ${filteredTasks.length} task` : `Showing ${(page - 1) * perPage + 1}-${Math.min(page * perPage, filteredTasks.length)} of ${filteredTasks.length} tasks`}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageItems.map((p) => (
              p === '...' ? (
                <button
                  key="..."
                  onClick={() => { setPageJumpValue(''); setShowPageJump(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold text-outline border border-dashed border-outline-variant hover:bg-surface-container-high transition-colors"
                  title={locale === 'vi' ? 'Nhập số trang' : 'Enter page number'}
                >
                  ...
                </button>
              ) : (
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
              )
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>

      {viewTask && (
        <TaskViewModal
          task={viewTask}
          onClose={() => setViewTask(null)}
          onSaved={(updated) => {
            setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
            setViewTask(updated);
            fetchTasks();
          }}
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

      {showPageJump && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowPageJump(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xs bg-white rounded-xl shadow-2xl z-50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{locale === 'vi' ? 'Nhập số trang' : 'Enter page number'}</h3>
              <button onClick={() => setShowPageJump(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? `Trang (1 - ${totalPages})` : `Page (1 - ${totalPages})`}</label>
              <input
                type="number"
                min={1}
                max={totalPages}
                className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={pageJumpValue}
                onChange={(e) => setPageJumpValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPageJump(false)}
                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={handlePageJump}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all"
              >
                {locale === 'vi' ? 'Đến trang' : 'Go'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
