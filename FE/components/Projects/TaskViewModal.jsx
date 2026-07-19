const statusBadge = {
  overdue: { label: 'Quá hạn', cls: 'bg-red-100 text-red-700' },
  Planning: { label: 'Chưa làm', cls: 'bg-slate-100 text-slate-700' },
  Processing: { label: 'Đang làm', cls: 'bg-blue-100 text-blue-700' },
  Done: { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700' },
  Backlog: { label: 'Tồn đọng', cls: 'bg-amber-100 text-amber-700' },
  Pending: { label: 'Đang chờ', cls: 'bg-purple-100 text-purple-700' },
  Cancel: { label: 'Đã huỷ', cls: 'bg-gray-100 text-gray-600' },
};

const priorityLabel = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

export default function TaskViewModal({ task, onClose }) {
  if (!task) return null;
  const st = statusBadge[task.status] || statusBadge.Planning;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-base font-bold">Thông tin Task</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tên task</label>
              <p className="mt-1 text-sm font-medium text-gray-900">{task.taskName || task.title || '-'}</p>
            </div>

            {task.description && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mô tả</label>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Dự án</label>
                <p className="mt-1 text-sm text-gray-900">{task.project || '-'}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Người phụ trách</label>
                <p className="mt-1 text-sm text-gray-900">{task.assignee?.name || task.assignee || '-'}</p>
              </div>
            </div>

            {task.stakeholders && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Người liên quan</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {task.stakeholders.split(', ').filter(Boolean).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${st.cls}`}>{st.label}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ưu tiên</label>
                <p className="mt-1 text-sm text-gray-900">{priorityLabel[task.priority] || task.priority || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Bắt đầu</label>
                <p className="mt-1 text-sm text-gray-900">{task.start || '-'}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hạn chót</label>
                <p className={`mt-1 text-sm font-bold ${task.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>{task.due || '-'}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hoàn thành</label>
                <p className="mt-1 text-sm text-gray-900">{task.done || '-'}</p>
              </div>
            </div>

            {task.linkUrl && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Link</label>
                <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm text-blue-600 underline">{task.linkUrl}</a>
              </div>
            )}

            {task.remark && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ghi chú</label>
                <p className="mt-1 text-sm text-gray-700">{task.remark}</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200 transition-all">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
