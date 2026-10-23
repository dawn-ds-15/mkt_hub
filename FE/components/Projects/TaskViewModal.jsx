import { useState } from 'react';
import { Info } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { updateTask } from '../../services/api';
import { mergeSubtasks, saveSubtasks } from '../../utils/subtasks';
import { useTaskStatusOptions, statusLabelOf } from '../../hooks/useTaskStatusOptions';

// Chỉ giữ màu theo khóa chuẩn — nhãn lấy nguyên văn từ tab Cấu hình Dropdown.
const statusBadgeCls = {
  overdue: 'bg-red-100 text-red-700',
  Planning: 'bg-slate-100 text-slate-700',
  Processing: 'bg-blue-100 text-blue-700',
  Done: 'bg-green-100 text-green-700',
  Backlog: 'bg-amber-100 text-amber-700',
  Pending: 'bg-purple-100 text-purple-700',
  Cancel: 'bg-gray-100 text-gray-600',
};

const priorityLabel = (locale) => ({ high: locale === 'vi' ? 'Cao' : 'High', medium: locale === 'vi' ? 'Trung bình' : 'Medium', low: locale === 'vi' ? 'Thấp' : 'Low' });

function toDateInput(v) {
  if (!v || typeof v !== 'string') return '';
  return v.length >= 10 ? v.slice(0, 10) : '';
}

export default function TaskViewModal({ task, onClose, onEdit, onSaved }) {
  const { locale } = useDashboard();
  const addToast = useToast();
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [completedDate, setCompletedDate] = useState(toDateInput(task.completedDate));
  const [subtasks, setSubtasks] = useState(() => mergeSubtasks(task.id, task.subtasks));
  const [saving, setSaving] = useState(false);

  if (!task) return null;
  const statusOptions = useTaskStatusOptions();
  // task.status bị gộp thành 'overdue' khi trễ hạn -> hiện trạng thái thật,
  // còn quá hạn tách ra thành nhãn phụ để khớp với form sửa task.
  const isOverdue = task.status === 'overdue';
  const realStatus = task.statusKey || (isOverdue ? 'Overdue' : task.status);
  const st = {
    cls: statusBadgeCls[realStatus] || 'bg-slate-100 text-slate-700',
    label: statusLabelOf(statusOptions, realStatus),
  };

  const handleSaveDate = async (field, value) => {
    setSaving(true);
    try {
      const payload = { [field]: value || null };
      await updateTask(task.id, payload);
      if (onSaved) onSaved({ ...task, ...payload });
    } catch (e) {
      console.error('[TaskViewModal] updateTask failed:', e, e?.response?.data);
      const beMsg = e?.response?.data?.message;
      addToast(
        `${locale === 'vi' ? 'Lưu ngày thất bại' : 'Failed to save date'}${beMsg ? `: ${Array.isArray(beMsg) ? beMsg.join(', ') : beMsg}` : ''}`,
        'error'
      );
      if (field === 'startDate') setStartDate(toDateInput(task.startDate));
      else if (field === 'dueDate') setDueDate(toDateInput(task.dueDate));
      else if (field === 'completedDate') setCompletedDate(toDateInput(task.completedDate));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtask = async (index) => {
    const next = subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    setSubtasks(next);
    saveSubtasks(task.id, next);
    setSaving(true);
    try {
      await updateTask(task.id, { subtasks: next });
      if (onSaved) onSaved({ ...task, subtasks: next });
    } catch (e) {
      console.error('[TaskViewModal] updateTask failed:', e, e?.response?.data);
      setSubtasks(subtasks);
      saveSubtasks(task.id, subtasks);
    } finally {
      setSaving(false);
    }
  };

  const fmtShortDate = (v) => {
    if (!v || typeof v !== 'string') return '';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
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

            {subtasks.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  {locale === 'vi' ? 'Task nhỏ' : 'Sub-tasks'} ({subtasks.filter(s => s.done).length}/{subtasks.length})
                </label>
                <div className="mt-1 space-y-1">
                  {subtasks.map((s, i) => (
                    <label key={`${s.id ?? 's'}-${i}`} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={s.done} onChange={() => handleToggleSubtask(i)} disabled={saving} className="w-4 h-4 accent-blue-600 shrink-0" />
                      <span className={`text-sm ${s.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{s.text}</span>
                      {s.doneDate && (
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtShortDate(s.doneDate)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${st.cls}`}>{st.label}</span>
                  {isOverdue && realStatus !== 'Overdue' && (
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-red-100 text-red-700">
                      {statusLabelOf(statusOptions, 'Overdue')}
                    </span>
                  )}
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
                {task.status !== 'Done' && (
                  <p className="mt-1 text-[11px] leading-[15px] text-amber-600 flex items-start gap-0.5">
                    <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                    {locale === 'vi'
                      ? 'Chuyển trạng thái sang "Hoàn thành" thì ô này mới có hiệu lực.'
                      : 'Switch status to "Done" for this field to take effect.'}
                  </p>
                )}
              </div>
            </div>

            {task.linkUrl && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Link' : 'Link'}</label>
                <a href={/^https?:\/\//i.test(task.linkUrl) ? task.linkUrl : `https://${task.linkUrl}`} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm text-blue-600 underline break-all">{task.linkUrl}</a>
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
