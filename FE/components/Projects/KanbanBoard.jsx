import { useEffect, useState, useCallback, useMemo } from 'react';
import { getKanbanData, updateTask, getProjects, getMembers } from '../../services/api';

const STATUS_TO_API = {
  planning: 'Planning',
  processing: 'Processing',
  done: 'Done',
  backlog: 'Backlog',
  pending: 'Pending',
  cancel: 'Cancel',
};

const priorityBorders = {
  High: 'border-l-red-500',
  Medium: 'border-l-amber-300',
  Low: 'border-l-gray-200',
};

function KanbanCard({ task, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all space-y-2 border-l-4 ${priorityBorders[task.priority]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <button className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="material-symbols-outlined text-[15px]">folder</span>
        <span>{task.project}</span>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-white">
          {task.avatar}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`material-symbols-outlined text-[16px] ${task.statusColor}`}>
            {task.statusIcon}
          </span>
          <span className={`font-medium ${task.dueColor}`}>{task.due}</span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, onDragStart, onDrop, onDragOver, onDragEnter, onDragLeave, isOver }) {
  return (
    <div
      className="flex flex-col"
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-900 tracking-wider">{column.title}</h3>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${column.badgeColor}`}>
          {column.badgeCount}
        </span>
      </div>
      <div
        className={`flex-1 space-y-3 p-3 rounded-xl min-h-[450px] transition-colors ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-transparent'
        }`}
      >
        {column.tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onDragStart={onDragStart} />
        ))}
        {column.tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm italic">
            Kéo thả task vào đây
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [columns, setColumns] = useState([]);
  const [allRawTasks, setAllRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overColId, setOverColId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedFromCol, setDraggedFromCol] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);

  const [projectFilter, setProjectFilter] = useState('Tất cả dự án');
  const [assigneeFilter, setAssigneeFilter] = useState('Tất cả mọi người');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    getProjects().then(r => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    getMembers().then(r => {
      const m = Array.isArray(r.data) ? r.data : (r.data?.members || []);
      setMembers(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getKanbanData().then((res) => {
      setAllRawTasks([]);
      setColumns(res.data);
      setLoading(false);
    });
  }, []);

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
    setOverColId(colId);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setOverColId(null);
  }, []);

  const handleDrop = useCallback((e, targetColId) => {
    e.preventDefault();
    setOverColId(null);
    if (!draggedTaskId || !draggedFromCol || draggedFromCol === targetColId) {
      setDraggedTaskId(null);
      setDraggedFromCol(null);
      return;
    }

    const prevColumns = columns;
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));
      const fromCol = next.find((c) => c.id === draggedFromCol);
      const toCol = next.find((c) => c.id === targetColId);
      if (!fromCol || !toCol) return prev;

      const taskIdx = fromCol.tasks.findIndex((t) => t.id === draggedTaskId);
      if (taskIdx === -1) return prev;

      const [movedTask] = fromCol.tasks.splice(taskIdx, 1);
      toCol.tasks.push(movedTask);

      return next.map(c => ({ ...c, badgeCount: c.tasks.length }));
    });

    const apiStatus = STATUS_TO_API[targetColId];
    if (apiStatus) {
      updateTask(draggedTaskId, { status: apiStatus }).catch(() => {
        setColumns(prevColumns);
      });
    }

    setDraggedTaskId(null);
    setDraggedFromCol(null);
  }, [draggedTaskId, draggedFromCol, columns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-5 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dự án</label>
          <select
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium outline-none cursor-pointer"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option>Tất cả dự án</option>
            {projects.map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Người phụ trách</label>
          <select
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium outline-none cursor-pointer"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option>Tất cả mọi người</option>
            {members.map(m => <option key={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Khoảng thời gian</label>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm">
            <span className="material-symbols-outlined text-lg text-gray-400">calendar_today</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
              placeholder="Từ ngày"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border-none bg-transparent focus:ring-0 outline-none text-xs w-[130px]"
              placeholder="Đến ngày"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" style={{ minHeight: 'calc(100vh - 280px)' }}>
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
          />
        ))}
      </div>
    </div>
  );
}
