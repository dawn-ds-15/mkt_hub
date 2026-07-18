import { useState, useEffect } from 'react';
import { updateTask, deleteTask } from '../../services/api';

const statusOptions = [
  { value: 'Planning', label: 'Chưa làm' },
  { value: 'Processing', label: 'Đang làm' },
  { value: 'Done', label: 'Hoàn thành' },
  { value: 'Backlog', label: 'Tồn đọng' },
  { value: 'Pending', label: 'Chờ xử lý' },
  { value: 'Cancel', label: 'Đã huỷ' },
];

const priorityOptions = [
  { value: 'High', label: 'Cao' },
  { value: 'Medium', label: 'Trung bình' },
  { value: 'Low', label: 'Thấp' },
];

const stakeholderOptions = ['BOD', 'Sales Team', 'Dev Team', 'Design Team', 'Content Team'];

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

export default function TaskEditDrawer({ task, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(task.taskName || task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(() => {
    const backendValue = task.status;
    if (['Planning', 'Processing', 'Done', 'Backlog', 'Pending', 'Cancel'].includes(backendValue)) return backendValue;
    return 'Planning';
  });
  const [priority, setPriority] = useState(task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [completedDate, setCompletedDate] = useState(task.completedDate || '');
  const [execWeek, setExecWeek] = useState(task.execWeek || '');
  const [link, setLink] = useState(task.link?.url || '');
  const [remark, setRemark] = useState(task.remark || '');
  const [reason, setReason] = useState(task.reason || '');
  const [neededSupportBod, setNeededSupportBod] = useState(task.neededSupportBod || '');
  const [stakeholders, setStakeholders] = useState(() => {
    if (Array.isArray(task.stakeholders)) return task.stakeholders;
    return task.stakeholders ? task.stakeholders.split(', ').filter(Boolean) : [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const role = getUserRole();
  const isSpecialist = role === 'specialist';
  const showReason = ['Backlog', 'Pending', 'Cancel'].includes(status);
  const reasonRequired = showReason && !reason.trim();
  const reasonLabel = status === 'Backlog' ? 'Lý do chuyển Tồn đọng' : 'Lý do Chờ xử lý / Đã huỷ';
  const showBodSupport = stakeholders.includes('BOD');

  useEffect(() => {
    if (status === 'Done' && !completedDate) {
      const today = new Date().toISOString().split('T')[0];
      setCompletedDate(today);
    }
  }, [status]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const addStakeholder = (value) => {
    if (value && !stakeholders.includes(value)) {
      setStakeholders([...stakeholders, value]);
    }
  };

  const removeStakeholder = (value) => {
    setStakeholders(stakeholders.filter((s) => s !== value));
  };

  const handleSave = async () => {
    if (reasonRequired) {
      setError('Bắt buộc nhập lý do');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        title: name,
        description,
        status,
        priority,
        stakeholders,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        completedDate: completedDate || undefined,
        execWeek: execWeek ? parseInt(execWeek) : undefined,
        link: link || undefined,
        remark,
        neededSupportBod: neededSupportBod || undefined,
      };
      if (showReason) payload.reason = reason;
      await updateTask(task.id, payload);
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lưu thất bại';
      setError(Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Xác nhận xóa task này?')) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      if (onDeleted) onDeleted();
      if (onClose) onClose();
    } catch (err) {
      setError('Xóa thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold">Chi tiết Task</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <input type="hidden" id="modal-task-id" />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tên task *</label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên task..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mô tả</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Dự án</label>
              <p className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-900">{task.project || '-'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Người phụ trách</label>
              <p className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-900">{task.assignee?.name || task.assignee || '-'}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Người liên quan</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {stakeholders.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium">
                  {s}
                  <button onClick={() => removeStakeholder(s)} className="text-blue-400 hover:text-blue-700">×</button>
                </span>
              ))}
            </div>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded text-xs focus:border-blue-500 focus:ring-0 outline-none"
              value=""
              onChange={(e) => { addStakeholder(e.target.value); e.target.value = ''; }}
            >
              <option value="">+ Thêm người liên quan</option>
              {stakeholderOptions.filter((o) => !stakeholders.includes(o)).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setError(''); }}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ưu tiên</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                placeholder="Nhập lý do..."
              />
            </div>
          )}

          {error && (
            <p className="text-red-600 text-xs flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ngày bắt đầu</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hạn chót</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ngày hoàn thành</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tuần thực hiện</label>
              <input type="number" min="1" max="53" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={execWeek} onChange={(e) => setExecWeek(e.target.value)} placeholder="VD: 24" />
              <div className="text-[10px] text-gray-400 mt-0.5">→ Dùng để lọc trong báo cáo tuần</div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Link (Drive / Công cụ)</label>
            <input className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ghi chú</label>
            <textarea className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-16" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Ghi chú thêm..." />
          </div>

          {showBodSupport && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cần BOD hỗ trợ</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none resize-vertical h-20"
                value={neededSupportBod}
                onChange={(e) => setNeededSupportBod(e.target.value)}
                placeholder="Mô tả nội dung cần BOD hỗ trợ..."
              />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3">
          {!isSpecialist && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all"
            >
              Xóa Task
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || reasonRequired}
            className={`px-6 py-2 rounded text-xs font-bold transition-all ${
              reasonRequired ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:opacity-90'
            }`}
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </>
  );
}
