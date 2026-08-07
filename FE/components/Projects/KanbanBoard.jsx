import { useEffect, useState, useCallback, useMemo } from 'react';
import { getKanbanData, updateTask, getProjects, getMembers, getTask } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import TaskViewModal from './TaskViewModal';
import TaskEditDrawer from './TaskEditDrawer';

const STATUS_TO_API = {
  planning: 'To Do',
  processing: 'In Progress',
  done: 'Done',
  pending: 'Review',
  backlog: 'Backlog',
  cancel: 'Cancel',
  overdue: 'Overdue',
};

const ALLOWED_TRANSITIONS = {
  planning: ['processing', 'done', 'pending', 'backlog', 'cancel', 'overdue'],
  processing: ['done', 'pending', 'backlog', 'cancel', 'overdue'],
  done: [],
  pending: ['processing', 'done', 'backlog', 'cancel', 'overdue'],
  backlog: ['planning', 'processing', 'done', 'cancel', 'overdue'],
  cancel: [],
  overdue: ['processing', 'done', 'pending', 'backlog'],
};

const priorityColors = {
  High: { bar: 'bg-red-500', dot: 'text-red-500', bg: 'bg-red-50' },
  Medium: { bar: 'bg-amber-400', dot: 'text-amber-500', bg: 'bg-amber-50' },
  Low: { bar: 'bg-gray-300', dot: 'text-gray-400', bg: 'bg-gray-50' },
};

const columnBg = {
  planning: 'bg-slate-50',
  processing: 'bg-blue-50/40',
  done: 'bg-emerald-50/40',
  pending: 'bg-purple-50/40',
  backlog: 'bg-amber-50/40',
  cancel: 'bg-gray-50',
  overdue: 'bg-red-50/40',
};

const columnHeaderAccent = {
  planning: 'bg-slate-200 text-slate-700',
  processing: 'bg-blue-200 text-blue-700',
  done: 'bg-emerald-200 text-emerald-700',
  pending: 'bg-purple-200 text-purple-700',
  backlog: 'bg-amber-200 text-amber-700',
  cancel: 'bg-gray-200 text-gray-600',
  overdue: 'bg-red-200 text-red-700',
};

const COLUMN_LABELS = {
  planning: { vi: 'Chưa làm', en: 'To Do' },
  processing: { vi: 'Đang làm', en: 'In Progress' },
  done: { vi: 'Hoàn thành', en: 'Done' },
  pending: { vi: 'Chờ xử lý', en: 'Pending' },
  backlog: { vi: 'Tồn đọng', en: 'Backlog' },
  cancel: { vi: 'Đã huỷ', en: 'Cancelled' },
  overdue: { vi: 'Quá hạn', en: 'Overdue' },
};

function getTaskId(task) {
  const id = String(task.id || '');
  if (id.includes('-')) return id.split('-').pop();
  return id.length > 7 ? '#' + id.slice(0, 7) : '#' + id;
}

function PriorityDot({ priority }) {
  const c = priorityColors[priority] || priorityColors.Medium;
  return <span className={`inline-block w-2 h-2 rounded-full ${c.bar}`} />;
}

function KanbanCard({ task, onDragStart, onCardClick }) {
  const pColor = priorityColors[task.priority] || priorityColors.Medium;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onCardClick(task.id)}
      className="bg-white rounded-lg border border-gray-200/80 p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300 transition-all space-y-1.5"
    >
      <div className="flex items-center gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className="text-[10px] font-mono text-gray-400 font-medium">{getTaskId(task)}</span>
      </div>
      <p className={`text-xs font-medium leading-snug text-gray-800 line-clamp-2 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
        {task.title}
      </p>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.avatar ? (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary-fixed flex items-center justify-center text-[8px] font-bold text-white shrink-0">
              {task.avatar}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 shrink-0">
              ?
            </div>
          )}
          <span className="text-[10px] text-gray-500 truncate">{task.assignee}</span>
        </div>
        <span className={`text-[10px] font-medium shrink-0 ${task.dueColor || 'text-gray-400'}`}>
          {task.due}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({ column, onDragStart, onDrop, onDragOver, onDragEnter, onDragLeave, isOver, onCardClick }) {
  const { locale } = useDashboard();
  const bg = columnBg[column.id] || 'bg-gray-50';
  const accent = columnHeaderAccent[column.id] || 'bg-gray-200 text-gray-700';
  const title = COLUMN_LABELS[column.id]?.[locale === 'vi' ? 'vi' : 'en'] || column.title;

  return (
    <div
      className={`flex flex-col flex-1 min-w-[160px] w-0 rounded-xl ${bg}`}
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider truncate">{title}</h3>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accent}`}>
            {column.badgeCount}
          </span>
        </div>
      </div>
      <div
        className={`flex-1 space-y-1.5 p-2 rounded-b-xl min-h-[400px] transition-colors ${
          isOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''
        }`}
      >
        {column.tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onDragStart={onDragStart} onCardClick={onCardClick} />
        ))}
        {column.tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-[11px] italic">
            {locale === 'vi' ? 'Không có task' : 'No tasks'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const { locale } = useDashboard();
  const [columns, setColumns] = useState([]);
  const [allRawTasks, setAllRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overColId, setOverColId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedFromCol, setDraggedFromCol] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [reasonPopup, setReasonPopup] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [warningPopup, setWarningPopup] = useState(null);

  const [viewTask, setViewTask] = useState(null);
  const [viewTaskData, setViewTaskData] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const [projectFilter, setProjectFilter] = useState('Tất cả dự án');
  const [assigneeFilter, setAssigneeFilter] = useState('Tất cả mọi người');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getProjects().then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(e => console.error('[Kanban] getProjects failed:', e));
    getMembers().then(r => {
      const m = Array.isArray(r.data) ? r.data : (r.data?.members || []);
      setMembers(m);
    }).catch(e => console.error('[Kanban] getMembers failed:', e));
  }, []);

  const loadKanban = useCallback(() => {
    getKanbanData().then((res) => {
      setAllRawTasks([]);
      setColumns(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadKanban(); }, [loadKanban]);

  const filteredColumns = useMemo(() => {
    if (!columns.length) return [];
    return columns.map(col => {
      let tasks = col.tasks;
      if (projectFilter !== 'Tất cả dự án') {
        tasks = tasks.filter(t => t.project === projectFilter || t.projectName === projectFilter);
      }
      if (assigneeFilter !== 'Tất cả mọi người') {
        tasks = tasks.filter(t => t.assignee?.name === assigneeFilter);
      }
      if (dateFrom) {
        tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= new Date(dateFrom));
      }
      if (dateTo) {
        tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(dateTo));
      }
      return { ...col, tasks, badgeCount: tasks.length };
    });
  }, [columns, projectFilter, assigneeFilter, dateFrom, dateTo]);

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDragStart = useCallback((e, taskId) => {
    setDraggedTaskId(taskId);
    for (const col of columns) {
      if (col.tasks.some((t) => t.id === taskId)) {
        setDraggedFromCol(col.id);
        break;
      }
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
  }, [columns]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    setOverColId(colId);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setOverColId(null);
  }, []);

  const doMoveTask = useCallback((targetColId, reason) => {
    const apiStatus = STATUS_TO_API[targetColId];
    if (!apiStatus) return;
    const taskId = draggedTaskId;
    const prevColumns = columns;
    const prevColsCopy = columns.map(c => ({ ...c, tasks: [...c.tasks] }));
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));
      const fromCol = next.find((c) => c.id === draggedFromCol);
      const toCol = next.find((c) => c.id === targetColId);
      if (!fromCol || !toCol) return prev;
      const taskIdx = fromCol.tasks.findIndex((t) => t.id === taskId);
      if (taskIdx === -1) return prev;
      const [movedTask] = fromCol.tasks.splice(taskIdx, 1);
      toCol.tasks.push(movedTask);
      return next.map(c => ({ ...c, badgeCount: c.tasks.length }));
    });
    const payload = reason ? { status: apiStatus, reason } : { status: apiStatus };
    console.log(`[Kanban] doMoveTask -> PATCH /v1/tasks/${taskId}`, payload);
    updateTask(taskId, payload).then((res) => {
      console.log(`[Kanban] PATCH response for task ${taskId}:`, res.data);
      return getTask(taskId);
    }).then((taskRes) => {
      console.log(`[Kanban] Refetched task ${taskId} status:`, taskRes.data?.status);
      if (taskRes.data?.status !== apiStatus) {
        console.warn(`[Kanban] STATUS MISMATCH: PATCH sent "${apiStatus}" but GET returned "${taskRes.data?.status}"`);
        showToast(locale === 'vi' ? `Status vẫn là "${taskRes.data?.status}", không phải "${apiStatus}"` : `Status is still "${taskRes.data?.status}", not "${apiStatus}"`, 'error');
      } else {
        console.log(`[Kanban] Status confirmed: "${apiStatus}" — PATCH persisted OK`);
      }
    }).catch((err) => {
      console.error(`[Kanban] PATCH failed for task ${taskId}:`, err?.response?.status, err?.response?.data || err);
      setColumns(prevColsCopy);
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Không thể cập nhật trạng thái' : 'Cannot update status');
      showToast(msg);
    });
    setDraggedTaskId(null);
    setDraggedFromCol(null);
  }, [draggedTaskId, draggedFromCol, columns, locale]);

  const handleCardClick = useCallback(async (taskId) => {
    setViewTask(taskId);
    setViewTaskData(null);
    try {
      const res = await getTask(taskId);
      setViewTaskData(res.data);
    } catch {
      setViewTaskData(null);
    }
  }, []);

  const handleEdit = useCallback((task) => {
    setEditingTask(task);
  }, []);

  const handleEditSaved = useCallback(() => {
    setEditingTask(null);
    setViewTask(null);
    setViewTaskData(null);
    loadKanban();
  }, [loadKanban]);

  const handleEditDeleted = useCallback(() => {
    setEditingTask(null);
    setViewTask(null);
    setViewTaskData(null);
    loadKanban();
  }, [loadKanban]);

  const handleDrop = useCallback((e, targetColId) => {
    e.preventDefault();
    setOverColId(null);
    if (!draggedTaskId || !draggedFromCol || draggedFromCol === targetColId) {
      setDraggedTaskId(null);
      setDraggedFromCol(null);
      return;
    }
    const allowed = ALLOWED_TRANSITIONS[draggedFromCol];
    if (!allowed || !allowed.includes(targetColId)) {
      setWarningPopup({ from: draggedFromCol, to: targetColId });
      setDraggedTaskId(null);
      setDraggedFromCol(null);
      return;
    }
    if (['backlog', 'pending', 'cancel'].includes(targetColId)) {
      setReasonPopup({ targetColId });
      setReasonText('');
      return;
    }
    doMoveTask(targetColId);
  }, [draggedTaskId, draggedFromCol, doMoveTask]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none cursor-pointer hover:border-gray-300 transition-colors"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="Tất cả dự án">{locale === 'vi' ? 'Tất cả dự án' : 'All Projects'}</option>
            {projects.map(p => <option key={p.id}>{p.name}</option>)}
          </select>
          <select
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none cursor-pointer hover:border-gray-300 transition-colors"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="Tất cả mọi người">{locale === 'vi' ? 'Tất cả mọi người' : 'All People'}</option>
            {members.map(m => <option key={m.id}>{m.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
            <span className="material-symbols-outlined text-sm text-gray-400">calendar_today</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border-none bg-transparent focus:ring-0 outline-none text-[11px] w-[110px]"
              placeholder={locale === 'vi' ? 'Từ ngày' : 'From date'}
            />
            <span className="text-gray-300">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border-none bg-transparent focus:ring-0 outline-none text-[11px] w-[110px]"
              placeholder={locale === 'vi' ? 'Đến ngày' : 'To date'}
            />
          </div>
        </div>

        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">dashboard</span>
          {filteredColumns.reduce((s, c) => s + c.tasks.length, 0)} {locale === 'vi' ? 'task' : 'tasks'} • {filteredColumns.length} {locale === 'vi' ? 'cột' : 'columns'}
        </div>
        <div className="flex flex-row flex-nowrap gap-3 pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {filteredColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              isOver={overColId === column.id}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </div>

      {viewTask && viewTaskData && (
        <TaskViewModal task={viewTaskData} onClose={() => { setViewTask(null); setViewTaskData(null); }} onSaved={loadKanban} />
      )}

      {editingTask && (
        <TaskEditDrawer
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={handleEditSaved}
          onDeleted={handleEditDeleted}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}

      {reasonPopup && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setReasonPopup(null); setDraggedTaskId(null); setDraggedFromCol(null); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl z-50 p-6 space-y-4">
            <h3 className="text-base font-bold">{locale === 'vi' ? 'Nhập lý do' : 'Enter Reason'}</h3>
            <p className="text-sm text-gray-500">{locale === 'vi' ? 'Vui lòng nhập lý do khi chuyển task sang trạng thái này' : 'Please enter a reason when moving task to this status'}</p>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-20"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={locale === 'vi' ? 'Nhập lý do...' : 'Enter reason...'}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setReasonPopup(null); setDraggedTaskId(null); setDraggedFromCol(null); }}
                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50"
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const target = reasonPopup.targetColId;
                  setReasonPopup(null);
                  doMoveTask(target, reasonText.trim());
                }}
                disabled={!reasonText.trim()}
                className={`px-4 py-2 rounded text-xs font-bold text-white ${reasonText.trim() ? 'bg-blue-600 hover:opacity-90' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {locale === 'vi' ? 'Xác nhận' : 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}

      {warningPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setWarningPopup(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
              <h3 className="text-base font-bold">{locale === 'vi' ? 'Không thể di chuyển' : 'Cannot move task'}</h3>
            </div>
            <p className="text-sm text-gray-600">
              {locale === 'vi'
                ? `Không được phép kéo task từ "${COLUMN_LABELS[warningPopup.from]?.[locale === 'vi' ? 'vi' : 'en'] || warningPopup.from}" sang "${COLUMN_LABELS[warningPopup.to]?.[locale === 'vi' ? 'vi' : 'en'] || warningPopup.to}"`
                : `Cannot drag task from "${COLUMN_LABELS[warningPopup.from]?.en || warningPopup.from}" to "${COLUMN_LABELS[warningPopup.to]?.en || warningPopup.to}"`
              }
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setWarningPopup(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90"
              >
                {locale === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
