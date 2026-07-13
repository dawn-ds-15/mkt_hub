import { useEffect, useState, useCallback } from 'react';
import { getKanbanData } from '../../services/api';

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
  const [loading, setLoading] = useState(true);
  const [overColId, setOverColId] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedFromCol, setDraggedFromCol] = useState(null);

  useEffect(() => {
    getKanbanData().then((res) => {
      setColumns(res.data);
      setLoading(false);
    });
  }, []);

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

    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));
      const fromCol = next.find((c) => c.id === draggedFromCol);
      const toCol = next.find((c) => c.id === targetColId);
      if (!fromCol || !toCol) return prev;

      const taskIdx = fromCol.tasks.findIndex((t) => t.id === draggedTaskId);
      if (taskIdx === -1) return prev;

      const [movedTask] = fromCol.tasks.splice(taskIdx, 1);
      toCol.tasks.push(movedTask);
      return next;
    });

    setDraggedTaskId(null);
    setDraggedFromCol(null);
  }, [draggedTaskId, draggedFromCol]);

  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [assigneeFilter, setAssigneeFilter] = useState('Everyone');
  const [dateRange, setDateRange] = useState('Oct 12 - Oct 28, 2023');

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
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Project</label>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm cursor-pointer hover:border-gray-400 transition-colors">
            <span className="font-medium text-gray-800">{projectFilter}</span>
            <span className="material-symbols-outlined text-lg text-gray-400">expand_more</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Assignee</label>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm cursor-pointer hover:border-gray-400 transition-colors">
            <span className="font-medium text-gray-800">{assigneeFilter}</span>
            <span className="material-symbols-outlined text-lg text-gray-400">expand_more</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm cursor-pointer hover:border-gray-400 transition-colors">
            <span className="material-symbols-outlined text-lg text-gray-400">calendar_today</span>
            <span className="font-medium text-gray-800">{dateRange}</span>
            <span className="material-symbols-outlined text-lg text-gray-400">expand_more</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {columns.map((column) => (
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
