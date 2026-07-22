import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const statusConfig = {
  near_deadline: { label: 'Sắp hết hạn', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  on_track: { label: 'Đúng tiến độ', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

const taskStatusConfig = {
  done: { label: 'Hoàn thành', bg: 'bg-green-100', text: 'text-green-700' },
  in_progress: { label: 'Đang làm', bg: 'bg-blue-100', text: 'text-blue-700' },
  todo: { label: 'Chưa làm', bg: 'bg-slate-100', text: 'text-slate-600' },
  review: { label: 'Đang review', bg: 'bg-amber-100', text: 'text-amber-700' },
  overdue: { label: 'Quá hạn', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function ProjectCard({ project, onEdit, onViewOverview }) {
  const { locale } = useDashboard();
  const [open, setOpen] = useState(project.id === 1);
  const status = statusConfig[project.status] || statusConfig.on_track;

  return (
    <div className={`border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden transition-all duration-300 hover:shadow-sm ${open ? 'active' : ''}`}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-4 flex items-center gap-4">
            <span className={`material-symbols-outlined text-outline-variant transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
              expand_more
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface">{project.name}</span>
                <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-fixed text-[10px] font-bold rounded uppercase tracking-wider">
                  {project.type}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold text-white">
                  {project.owner.split(' ').map(w => w[0]).join('')}
                </div>
                <span className="text-label-sm text-on-surface-variant">{locale === 'vi' ? 'Chủ sở hữu: ' : 'Owner: '}{project.owner}</span>
              </div>
            </div>
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-outline text-[16px]">calendar_month</span>
              <span className="text-label-md text-on-surface-variant">{project.deadline}</span>
            </div>
            <span className={`px-3 py-1 ${status.bg} ${status.text} text-[11px] font-bold rounded-full border ${status.border}`}>
              {locale === 'vi' ? status.label : (project.status === 'near_deadline' ? 'Near Deadline' : 'On Track')}
            </span>
          </div>
          <div className="col-span-3">
            <div className="flex justify-between items-center mb-2">
                <span className="text-label-sm text-on-surface-variant">{project.tasksCompleted} / {project.tasksTotal} {locale === 'vi' ? 'Task' : 'Tasks'}</span>
              <span className="text-label-sm font-bold text-on-surface">{project.progress}%</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); if (onViewOverview) onViewOverview(project); }}
              className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary"
              title={locale === 'vi' ? 'Xem overview' : 'View Overview'}
            >
              <span className="material-symbols-outlined text-[20px]">add_task</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(project); }}
              className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary"
              title={locale === 'vi' ? 'Chỉnh sửa' : 'Edit'}
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-outline-variant bg-surface">
          <div className="p-6">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest mb-4">Task Overview</h4>
            {project.tasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
                      <th className="px-4 py-3 font-semibold">{locale === 'vi' ? 'Tên Task' : 'Task Name'}</th>
                        <th className="px-4 py-3 font-semibold">{locale === 'vi' ? 'Người phụ trách' : 'Assignee'}</th>
                        <th className="px-4 py-3 font-semibold">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</th>
                        <th className="px-4 py-3 font-semibold">{locale === 'vi' ? 'Trạng thái' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {project.tasks.map((task, idx) => {
                      const ts = taskStatusConfig[task.status] || taskStatusConfig.todo;
                      return (
                        <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3 font-body-md text-on-surface">{task.name}</td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-white">
                              {task.assignee.split(' ').map(w => w[0]).join('')}
                            </div>
                            <span className="text-body-md">{task.assignee}</span>
                          </td>
                          <td className="px-4 py-3 text-body-md text-on-surface-variant">{task.due}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 ${ts.bg} ${ts.text} text-[10px] font-bold rounded uppercase`}>
                              {locale === 'vi' ? ts.label : ({ done: 'Done', in_progress: 'In Progress', todo: 'To Do', review: 'Review', overdue: 'Overdue' })[task.status] || 'To Do'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-on-surface-variant text-body-md italic">{locale === 'vi' ? 'Chưa có task nào cho giai đoạn dự án này.' : 'No tasks for this project phase yet.'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
