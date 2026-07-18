import { useEffect, useState } from 'react';
import { createProject, updateProject, getMembers } from '../../services/api';

const typeMap = {
  'Lead Generation': 'Lead Generation', 'Workshop': 'Workshop', 'Online Campaign': 'Online Campaign',
  'Webinar': 'Webinar', 'Event': 'Event', 'Exhibition': 'Exhibition', 'Awards': 'Awards', 'Production': 'Production',
};
const statusMap = { 'Lên kế hoạch': 'Planning', 'Đang thực hiện': 'Active', 'Tạm dừng': 'On Hold', 'Hoàn thành': 'Completed', 'Đã huỷ': 'Cancelled' };
const eventTypes = ['Workshop', 'Event', 'Exhibition', 'Webinar'];

const isUUID = (s) => s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const reverseTypeMap = Object.fromEntries(Object.entries(typeMap).map(([k, v]) => [v, k]));
const reverseStatusMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, k]));

export default function CreateProjectForm({ project, onClose, onSuccess }) {
  const isEditing = !!project;
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('Nội bộ');
  const [status, setStatus] = useState('Lên kế hoạch');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [budget, setBudget] = useState('');
  const [overhead, setOverhead] = useState('');
  const [kpiPlan, setKpiPlan] = useState('');
  const [kpiActual, setKpiActual] = useState('');
  const [applyChecklist, setApplyChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    getMembers().then(res => setMembers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (project && !initialized) {
      setName(project.name || '');
      setType(reverseTypeMap[project.type] || 'Nội bộ');
      setStatus(reverseStatusMap[project.statusLabel] || 'Lên kế hoạch');
      setOwnerId(project.ownerId || '');
      const rawDeadline = project.deadlineRaw || project.deadline;
      setDeadline(rawDeadline ? rawDeadline.split('T')[0] : '');
      setBudget(String(project.budgetPlanDirect || ''));
      setOverhead(String(project.budgetPlanOverhead || ''));
      setKpiPlan(String(project.kpiRawLeadsPlan || ''));
      setKpiActual(String(project.kpiRawLeadsActual || ''));
      setInitialized(true);
    }
  }, [project, initialized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !ownerId) {
      setError('Vui lòng nhập tên dự án và chọn chủ sở hữu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        type: typeMap[type],
        status: statusMap[status],
        ownerId,
        deadline: deadline || undefined,
        budgetPlanDirect: parseFloat(budget) || 0,
        budgetPlanOverhead: parseFloat(overhead) || 0,
        kpiRawLeadsPlan: parseFloat(kpiPlan) || 0,
        kpiRawLeadsActual: parseFloat(kpiActual) || 0,
      };
      if (isEditing) {
        await updateProject(project.id, payload);
      } else {
        await createProject(payload);
      }
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join('\n') : msg || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">{isEditing ? 'Chỉnh sửa Dự án' : 'Tạo Dự án Mới'}</h3>
        {onClose && (
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Tên Dự án</label>
          <input
            className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="VD: Báo cáo thường niên 2024"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Loại</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.keys(typeMap).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Trạng thái</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.keys(statusMap).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
        </div>
        {eventTypes.includes(type) && (
          <label className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyChecklist}
              onChange={(e) => setApplyChecklist(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-body-md font-medium text-on-surface">Áp dụng checklist sự kiện chuẩn</span>
          </label>
        )}
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Chủ sở hữu</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
            <select
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">Chọn chủ sở hữu...</option>
              {members.filter((m) => isUUID(m.id)).map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Hạn chót</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">event</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
              <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Tài chính</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Ngân sách</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Chi phí phát sinh</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">KPI Hiệu suất</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Kế hoạch (Mục tiêu)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="100,000" type="number" value={kpiPlan} onChange={(e) => setKpiPlan(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Thực tế (Đạt được)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="number" value={kpiActual} onChange={(e) => setKpiActual(e.target.value)} />
            </div>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border-l-4 border-danger p-3 rounded">
            {error.split('\n').map((line, i) => (
              <p key={i} className="text-body-sm text-red-800">{line}</p>
            ))}
          </div>
        )}
        <button className="w-full py-3 bg-primary text-on-primary rounded font-bold text-label-md mt-6 hover:shadow-lg transition-all active:scale-[0.98]" type="submit" disabled={saving}>
          {saving ? 'Đang lưu...' : (isEditing ? 'Cập nhật dự án' : 'Tạo dự án')}
        </button>
      </form>
    </div>
  );
}
