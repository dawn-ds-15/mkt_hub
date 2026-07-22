import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { updateTask } from '../../services/api';

const statusBadge = (locale) => ({
  overdue: { label: locale === 'vi' ? 'Quá hạn' : 'Overdue', cls: 'bg-red-100 text-red-700' },
  Planning: { label: locale === 'vi' ? 'Chưa làm' : 'To Do', cls: 'bg-slate-100 text-slate-700' },
  Processing: { label: locale === 'vi' ? 'Đang làm' : 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  Done: { label: locale === 'vi' ? 'Hoàn thành' : 'Done', cls: 'bg-green-100 text-green-700' },
  Backlog: { label: locale === 'vi' ? 'Tồn đọng' : 'Backlog', cls: 'bg-amber-100 text-amber-700' },
  Pending: { label: locale === 'vi' ? 'Đang chờ' : 'Pending', cls: 'bg-purple-100 text-purple-700' },
  Cancel: { label: locale === 'vi' ? 'Đã huỷ' : 'Cancelled', cls: 'bg-gray-100 text-gray-600' },
});

const priorityLabel = (locale) => ({ high: locale === 'vi' ? 'Cao' : 'High', medium: locale === 'vi' ? 'Trung bình' : 'Medium', low: locale === 'vi' ? 'Thấp' : 'Low' });

export default function TaskViewModal({ task, onClose, onEdit, onSaved }) {
  const { locale } = useDashboard();
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [completedDate, setCompletedDate] = useState(task.completedDate || '');
  const [saving, setSaving] = useState(false);

  if (!task) return null;
  const st = statusBadge(locale)[task.status] || statusBadge(locale).Planning;

  const handleSaveDate = async (field, value) => {
    setSaving(true);
    try {
      const payload = { [field]: value || null };
      await updateTask(task.id, payload);
      if (onSaved) onSaved();
    } catch {
      if (field === 'startDate') setStartDate(task.startDate || '');
      else if (field === 'dueDate') setDueDate(task.dueDate || '');
      else if (field === 'completedDate') setCompletedDate(task.completedDate || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-base font-bold">{locale === 'vi' ? 'Thông tin Task' : 'Task Information'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Tên task' : 'Task Name'}</label>
              <p className="mt-1 text-sm font-medium text-gray-900">{task.taskName || task.title || '-'}</p>
            </div>

            {task.description && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Mô tả' : 'Description'}</label>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Dự án' : 'Project'}</label>
                <p className="mt-1 text-sm text-gray-900">{task.project || '-'}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Người phụ trách' : 'Assignee'}</label>
                <p className="mt-1 text-sm text-gray-900">{task.assignee?.name || task.assignee || '-'}</p>
              </div>
            </div>

            {task.stakeholders && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Người liên quan' : 'Stakeholders'}</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {task.stakeholders.split(', ').filter(Boolean).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${st.cls}`}>{st.label}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ưu tiên' : 'Priority'}</label>
                <p className="mt-1 text-sm text-gray-900">{priorityLabel(locale)[task.priority] || task.priority || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Bắt đầu' : 'Start'}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleSaveDate('startDate', e.target.value);
                  }}
                  disabled={saving}
                  className="mt-1 w-full px-2 py-1 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    handleSaveDate('dueDate', e.target.value);
                  }}
                  disabled={saving}
                  className={`mt-1 w-full px-2 py-1 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none ${task.status === 'overdue' ? 'text-red-600' : ''}`}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Hoàn thành' : 'Completed'}</label>
                <input
                  type="date"
                  value={completedDate}
                  onChange={(e) => {
                    setCompletedDate(e.target.value);
                    handleSaveDate('completedDate', e.target.value);
                  }}
                  disabled={saving}
                  className="mt-1 w-full px-2 py-1 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                />
              </div>
            </div>

            {task.linkUrl && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Link' : 'Link'}</label>
                <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm text-blue-600 underline">{task.linkUrl}</a>
              </div>
            )}

            {task.remark && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ghi chú' : 'Notes'}</label>
                <p className="mt-1 text-sm text-gray-700">{task.remark}</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200 transition-all">
              {locale === 'vi' ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
