const statusConfig = {
  near_deadline: { label: 'Sắp hết hạn', bg: 'bg-amber-100', text: 'text-amber-700' },
  active: { label: 'Đang thực hiện', bg: 'bg-primary/10', text: 'text-primary' },
  planning: { label: 'Lên kế hoạch', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Hoàn thành', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Đã huỷ', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'Tạm dừng', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const taskStatusConfig = {
  Done: { label: 'Hoàn thành', bg: 'bg-green-100', text: 'text-green-700' },
  Processing: { label: 'Đang làm', bg: 'bg-blue-100', text: 'text-blue-700' },
  Planning: { label: 'Chưa bắt đầu', bg: 'bg-slate-100', text: 'text-slate-600' },
  Backlog: { label: 'Backlog', bg: 'bg-amber-100', text: 'text-amber-700' },
  Pending: { label: 'Đang chờ', bg: 'bg-purple-100', text: 'text-purple-700' },
  Cancel: { label: 'Đã huỷ', bg: 'bg-gray-100', text: 'text-gray-600' },
  overdue: { label: 'Quá hạn', bg: 'bg-red-100', text: 'text-red-700' },
};

export default function ProjectOverview({ project, onClose }) {
  const st = statusConfig[project.status] || statusConfig.active;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-outline-variant">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">folder</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">{project.name}</h2>
              <p className="text-body-sm text-on-surface-variant">Chủ sở hữu: {project.owner}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status & Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-low rounded-lg p-4 text-center">
            <span className={`inline-block px-3 py-1 ${st.bg} ${st.text} text-xs font-bold rounded-full`}>{st.label}</span>
            <p className="text-label-sm text-on-surface-variant mt-2">Trạng thái</p>
          </div>
          <div className="bg-surface-container-low rounded-lg p-4 text-center">
            <span className="text-headline-sm font-bold text-on-surface">{project.type}</span>
            <p className="text-label-sm text-on-surface-variant mt-1">Loại</p>
          </div>
          <div className="bg-surface-container-low rounded-lg p-4 text-center">
            <span className="text-headline-sm font-bold text-on-surface">{project.deadline}</span>
            <p className="text-label-sm text-on-surface-variant mt-1">Hạn chót</p>
          </div>
          <div className="bg-surface-container-low rounded-lg p-4 text-center">
            <span className="text-headline-sm font-bold text-on-surface">{project.progress}%</span>
            <p className="text-label-sm text-on-surface-variant mt-1">Tiến độ</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-label-sm font-semibold text-on-surface-variant uppercase">Tiến độ dự án</span>
            <span className="text-label-sm font-bold text-on-surface">{project.tasksCompleted}/{project.tasksTotal} task</span>
          </div>
          <div className="w-full h-2.5 bg-outline-variant/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        {/* Tasks */}
        <div>
          <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest mb-3">Danh sách Task</h4>
          {project.tasks && project.tasks.length > 0 ? (
            <div className="overflow-x-auto border border-outline-variant rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
                    <th className="px-4 py-3 font-semibold">Tên Task</th>
                    <th className="px-4 py-3 font-semibold">Người phụ trách</th>
                    <th className="px-4 py-3 font-semibold">Hạn chót</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {project.tasks.map((task, idx) => {
                    const ts = taskStatusConfig[task.status] || taskStatusConfig.todo;
                    return (
                      <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-body-md text-on-surface">{task.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-white">
                              {task.assignee.split(' ').map(w => w[0]).join('')}
                            </div>
                            <span className="text-body-md">{task.assignee}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body-md text-on-surface-variant">{task.due}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 ${ts.bg} ${ts.text} text-[10px] font-bold rounded uppercase`}>
                            {ts.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-on-surface-variant text-body-md italic">Chưa có task nào.</p>
          )}
        </div>
      </div>
    </div>
  );
}