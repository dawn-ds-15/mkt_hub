import { useState, useEffect, useMemo } from 'react';
import { CircleAlert, Info, Plus, Trash2 } from 'lucide-react';
import { updateTask, deleteTask, getMembers, normalizeTaskStatus } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { translateTaskErrors } from '../../utils/taskErrors';
import { useDropdownOptions } from '../../hooks/useDropdownOptions';
import { useTaskStatusOptions, statusLabelOf } from '../../hooks/useTaskStatusOptions';
import { mergeSubtasks, saveSubtasks } from '../../utils/subtasks';

function toDateInput(v) {
  if (!v || typeof v !== 'string') return '';
  return v.length >= 10 ? v.slice(0, 10) : '';
}

function getUserRole() {
  try {
    const raw = localStorage.getItem('mkt_hub_user');
    if (raw) {
      const u = JSON.parse(raw);
      return u.role || 'manager';
    }
  } catch {}
  return 'manager';
}

export default function TaskEditDrawer({ task, onClose, onSaved, onDeleted, readOnly }) {
  const { locale } = useDashboard();
  const [name, setName] = useState(task.taskName || task.title || '');
  const [description, setDescription] = useState(task.description || '');
  // task.status bị gộp thành 'overdue' khi task trễ hạn -> đọc statusKey để ra trạng thái thật.
  const [status, setStatus] = useState(() => normalizeTaskStatus(task.statusKey ?? task.status) || task.statusKey || 'Planning');
  const [priority, setPriority] = useState(task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium');
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [completedDate, setCompletedDate] = useState(toDateInput(task.completedDate));
  const [link, setLink] = useState(() => {
    if (!task.link) return '';
    if (typeof task.link === 'string') return task.link;
    return task.link.url || '';
  });
  const [remark, setRemark] = useState(task.remark || '');
  const [reason, setReason] = useState(task.reason || '');
  const [neededSupportBod, setNeededSupportBod] = useState(task.neededSupportBod || '');
  const [stakeholders, setStakeholders] = useState(() => {
    const raw = Array.isArray(task.stakeholders) ? task.stakeholders : (task.stakeholders ? task.stakeholders.split(', ').filter(Boolean) : []);
    return raw.map(s => s.trim()).filter(Boolean);
  });
  const [subtasks, setSubtasks] = useState(() => mergeSubtasks(task.id, task.subtasks));
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || task.assignee?.id || '');
  const [members, setMembers] = useState([]);
  const taskStatusOptions = useTaskStatusOptions();
  const taskPriorityOptions = useDropdownOptions('task_priority');
  // Trạng thái hiện tại không nằm trong cấu hình dropdown thì select sẽ tự nhảy về
  // mục đầu tiên và hiển thị sai -> bổ sung đúng trạng thái đó vào danh sách.
  const statusSelectOptions = useMemo(() => {
    if (!status || taskStatusOptions.some((o) => o.key === status)) return taskStatusOptions;
    return [...taskStatusOptions, { key: status, id: `current_${status}`, label: statusLabelOf(taskStatusOptions, status) }];
  }, [taskStatusOptions, status]);

  const role = getUserRole();

  useEffect(() => {
    getMembers().then(r => {
      const m = Array.isArray(r.data) ? r.data : (r.data?.members || []);
      setMembers(m);
    }).catch(() => setMembers([]));
  }, []);
  const isSpecialist = role === 'specialist';
  const showReason = ['Backlog', 'Pending', 'Cancel'].includes(status);
  const reasonRequired = showReason && !reason.trim();
  const reasonLabel = status === 'Backlog'
    ? (locale === 'vi' ? 'Lý do chuyển Tồn đọng' : 'Reason for Backlog')
    : (locale === 'vi' ? 'Lý do Chờ xử lý / Đã huỷ' : 'Reason for Pending / Cancelled');
  const needBod = stakeholders.some(s => s.trim().toLowerCase() === 'bod');

  useEffect(() => {
    if (status === 'Done' && !completedDate) {
      const today = new Date().toISOString().split('T')[0];
      setCompletedDate(today);
    }
  }, [status]);

  useEffect(() => {
    saveSubtasks(task.id, subtasks);
  }, [subtasks, task.id]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const addStakeholder = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const duplicate = stakeholders.some(s => s.toLowerCase() === normalized);
    if (!duplicate) {
      setStakeholders([...stakeholders, trimmed]);
    }
  };

  const removeStakeholder = (value) => {
    setStakeholders(stakeholders.filter((s) => s.toLowerCase() !== value.toLowerCase()));
  };

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    setSubtasks([...subtasks, { id: null, text, done: false, doneDate: null }]);
    setNewSubtask('');
  };

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const toggleSubtask = (index) => {
    setSubtasks(subtasks.map((st, i) => (i === index ? { ...st, done: !st.done } : st)));
  };

  const setSubtaskDoneDate = (index, value) => {
    setSubtasks(subtasks.map((st, i) => (i === index ? { ...st, doneDate: value || null } : st)));
  };

  const removeSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const subtaskDoneCount = subtasks.filter(s => s.done).length;

  const handleSave = async () => {
    if (reasonRequired) {
      setError(locale === 'vi' ? 'Bắt buộc nhập lý do' : 'Reason is required');
      return;
    }
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      setError(locale === 'vi' ? 'Hạn chót không được trước ngày bắt đầu' : 'Due date cannot be before start date');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        name,
        title: name,
        description,
        status,
        priority,
        assigneeId: assigneeId || undefined,
        stakeholders,
        subtasks: subtasks.map(s => ({ id: s.id, text: s.text, done: s.done, doneDate: s.doneDate })),
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        completedDate: completedDate || undefined,
        link: link || undefined,
        remark,
        neededSupportBod: needBod ? (neededSupportBod || undefined) : undefined,
      };
      if (showReason) payload.reason = reason;
      await updateTask(task.id, payload);
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || (locale === 'vi' ? 'Lưu thất bại' : 'Save failed');
      setError(translateTaskErrors(msg, locale));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(locale === 'vi' ? 'Xác nhận xóa task này?' : 'Confirm delete this task?')) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      if (onDeleted) onDeleted();
      if (onClose) onClose();
    } catch (err) {
      setError(locale === 'vi' ? 'Xóa thất bại' : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold">{locale === 'vi' ? (readOnly ? 'Xem chi tiết Task' : 'Chi tiết Task') : (readOnly ? 'Task Details' : 'Task Details')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <input type="hidden" id="modal-task-id" />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Tên task *' : 'Task Name *'}</label>
            <input
              className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={locale === 'vi' ? 'Tên task...' : 'Task name...'}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Mô tả' : 'Description'}</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={locale === 'vi' ? 'Mô tả chi tiết...' : 'Detailed description...'}
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Dự án' : 'Project'}</label>
              <p className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-900">{task.project || '-'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Người phụ trách' : 'Assignee'}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={readOnly}
              >
                <option value="">{locale === 'vi' ? 'Chọn người phụ trách' : 'Select assignee'}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Người liên quan (thành viên)' : 'Stakeholders (members)'}</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {stakeholders.map((s) => {
                const isMember = members.some(m => m.name.toLowerCase() === s.toLowerCase());
                return (
                  <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${isMember ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400 italic'}`}>
                    {s}{!isMember && <span className="text-[9px] ml-0.5">({locale === 'vi' ? 'cũ' : 'legacy'})</span>}
                    <button onClick={() => removeStakeholder(s)} className={`${isMember ? 'text-blue-400 hover:text-blue-700' : 'text-gray-300 hover:text-gray-500'}`} disabled={readOnly}>×</button>
                  </span>
                );
              })}
            </div>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded text-xs focus:border-blue-500 focus:ring-0 outline-none"
              value=""
              onChange={(e) => { addStakeholder(e.target.value); e.target.value = ''; }}
              disabled={readOnly}
            >
              <option value="">{locale === 'vi' ? '+ Thêm thành viên liên quan' : '+ Add related member'}</option>
              {members
                .filter((m) => !stakeholders.some(s => s.toLowerCase() === m.name.toLowerCase()))
                .map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Task nhỏ (checklist)' : 'Sub-tasks (checklist)'}</label>
            <div className="space-y-1">
              {subtasks.map((st, i) => (
                <div key={`${st.id ?? 'new'}-${i}`} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
                  <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(i)} disabled={readOnly} className="w-4 h-4 accent-blue-600 shrink-0" />
                  <span className={`text-sm flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{st.text}</span>
                  <input
                    type="date"
                    value={st.doneDate || ''}
                    onChange={(e) => setSubtaskDoneDate(i, e.target.value)}
                    disabled={readOnly}
                    className="w-[140px] px-1.5 py-1 border border-gray-200 rounded text-[11px] focus:border-blue-500 focus:ring-0 outline-none"
                    title={locale === 'vi' ? 'Ngày cần hoàn thành task nhỏ' : 'Sub-task required date'}
                  />
                  <button onClick={() => removeSubtask(i)} disabled={readOnly} className="text-gray-400 hover:text-red-500 disabled:opacity-40" title={locale === 'vi' ? 'Xóa' : 'Remove'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
                  placeholder={locale === 'vi' ? 'Tên task nhỏ...' : 'Sub-task name...'}
                />
                <button
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {locale === 'vi' ? 'Thêm' : 'Add'}
                </button>
              </div>
            )}
            {subtasks.length > 0 && (
              <p className="text-[11px] text-on-surface-variant">{locale === 'vi' ? `Đã hoàn thành ${subtaskDoneCount}/${subtasks.length}` : `Done ${subtaskDoneCount}/${subtasks.length}`}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setError(''); }}
                disabled={readOnly}
              >
                {statusSelectOptions.map((opt) => (
                  <option key={opt.id} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ưu tiên' : 'Priority'}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={readOnly}
              >
                {taskPriorityOptions.map((opt) => (
                  <option key={opt.id} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {showReason && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {reasonLabel} <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-20"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={locale === 'vi' ? 'Nhập lý do...' : 'Enter reason...'}
                disabled={readOnly}
              />
            </div>
          )}

          {error && (
            <p className="text-red-600 text-xs flex items-center gap-1 mt-1">
              <CircleAlert className="w-4 h-4" />
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ngày bắt đầu' : 'Start Date'}</label>
              <input type="date" className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</label>
              <input type="date" className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>

          {(task.execWeek || task.durationWeeks) && (
            <div className="flex gap-4 px-3 py-2 bg-gray-50 rounded text-[11px] text-on-surface-variant">
              {task.execWeek && <span>{locale === 'vi' ? 'Tuần thực hiện:' : 'Exec Week:'} <span className="font-bold text-on-surface">{task.execWeek}</span></span>}
              {task.durationWeeks && <span>{locale === 'vi' ? 'Thời lượng:' : 'Duration:'} <span className="font-bold text-on-surface">{task.durationWeeks} {locale === 'vi' ? 'tuần' : 'weeks'}</span></span>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ngày hoàn thành' : 'Completed Date'}</label>
              <input type="date" className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} disabled={readOnly} />
              {status !== 'Done' && (
                <div className="text-[11px] leading-[15px] text-amber-600 flex items-start gap-0.5 mt-0.5">
                  <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>{locale === 'vi'
                    ? 'Chuyển trạng thái sang "Hoàn thành" thì ô này mới có hiệu lực.'
                    : 'Switch status to "Done" for this field to take effect.'}</span>
                </div>
              )}
            </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Link (Drive / Công cụ)' : 'Link (Drive / Tool)'}</label>
            <input className="w-full px-3 py-2 border border-primary rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." disabled={readOnly} />
            {link && (
              <a
                href={/^https?:\/\//i.test(link) ? link : `https://${link}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {locale === 'vi' ? 'Mở link ↗' : 'Open link ↗'}
              </a>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Ghi chú' : 'Notes'}</label>
            <textarea className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-16" value={remark} onChange={(e) => setRemark(e.target.value)}               placeholder={locale === 'vi' ? 'Ghi chú thêm...' : 'Additional notes...'} disabled={readOnly} />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needBod}
                disabled={readOnly}
                onChange={(e) => {
                  if (e.target.checked) {
                    addStakeholder('BOD');
                  } else {
                    setStakeholders(stakeholders.filter(s => s.toLowerCase() !== 'bod'));
                  }
                }}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{locale === 'vi' ? 'Cần BOD hỗ trợ' : 'BOD support needed'}</span>
            </label>
            {needBod && (
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-20"
                value={neededSupportBod}
                onChange={(e) => setNeededSupportBod(e.target.value)}
                placeholder={locale === 'vi' ? 'Mô tả nội dung cần BOD hỗ trợ...' : 'Describe what BOD support is needed...'}
                disabled={readOnly}
              />
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3">
          {!readOnly && !isSpecialist && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all"
            >
              {locale === 'vi' ? 'Xóa Task' : 'Delete Task'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">
            {locale === 'vi' ? (readOnly ? 'Đóng' : 'Hủy') : (readOnly ? 'Close' : 'Cancel')}
          </button>
          {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving || reasonRequired}
            className={`px-6 py-2 rounded text-xs font-bold transition-all ${
              reasonRequired ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:opacity-90'
            }`}
          >
            {locale === 'vi' ? (saving ? 'Đang lưu...' : 'Lưu') : (saving ? 'Saving...' : 'Save')}
          </button>
          )}
        </div>
      </div>
    </>
  );
}
