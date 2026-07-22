import { useEffect, useState } from 'react';
import { createProject, updateProject, getMembers } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';

const typeMap = {
  'Nội bộ': 'Internal', 'Khách hàng': 'Client', 'Nghiên cứu': 'Research',
};
const statusMap = { 'Lên kế hoạch': 'Planning', 'Đang thực hiện': 'Active', 'Tạm dừng': 'On Hold', 'Hoàn thành': 'Completed', 'Đã huỷ': 'Cancelled' };

const reverseTypeMap = Object.fromEntries(Object.entries(typeMap).map(([k, v]) => [v, k]));
const reverseStatusMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, k]));

export default function CreateProjectForm({ project, onClose, onSuccess }) {
  const { locale } = useDashboard();
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    getMembers().then(res => {
      setMembers(res.data || []);
      setMembersLoading(false);
    }).catch(() => {
      setMembersLoading(false);
      setMembers([]);
    });
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
      setError(locale === 'vi' ? 'Vui lòng nhập tên dự án và chọn chủ sở hữu' : 'Please enter project name and select owner');
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
      setError(Array.isArray(msg) ? msg.join('\n') : msg || (locale === 'vi' ? 'Lưu thất bại' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">{locale === 'vi' ? (isEditing ? 'Chỉnh sửa Dự án' : 'Tạo Dự án Mới') : (isEditing ? 'Edit Project' : 'New Project')}</h3>
        {onClose && (
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Tên Dự án' : 'Project Name'}</label>
          <input
            className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder={locale === 'vi' ? 'VD: Báo cáo thường niên 2024' : 'E.g. Annual Report 2024'}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Loại' : 'Type'}</label>
            <select className="w-full px-3 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.keys(typeMap).map((k) => <option key={k} value={k}>{locale === 'vi' ? k : ({ 'Nội bộ': 'Internal', 'Khách hàng': 'Client', 'Nghiên cứu': 'Research' })[k]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
            <select className="w-full px-3 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.keys(statusMap).map((k) => <option key={k} value={k}>{locale === 'vi' ? k : ({ 'Lên kế hoạch': 'Planning', 'Đang thực hiện': 'Active', 'Tạm dừng': 'On Hold', 'Hoàn thành': 'Completed', 'Đã huỷ': 'Cancelled' })[k]}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Chủ sở hữu' : 'Owner'}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
            <select
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">{locale === 'vi' ? (membersLoading ? 'Đang tải...' : 'Chọn chủ sở hữu...') : (membersLoading ? 'Loading...' : 'Select owner...')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Hạn chót' : 'Deadline'}</label>
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
              <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">{locale === 'vi' ? 'Tài chính' : 'Finance'}</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Ngân sách' : 'Budget'}</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Chi phí phát sinh' : 'Overhead Cost'}</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">{locale === 'vi' ? 'KPI Hiệu suất' : 'KPI Performance'}</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Kế hoạch (Mục tiêu)' : 'Plan (Target)'}</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="100,000" type="number" value={kpiPlan} onChange={(e) => setKpiPlan(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Thực tế (Đạt được)' : 'Actual (Achieved)'}</label>
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
          {locale === 'vi' ? (saving ? 'Đang lưu...' : (isEditing ? 'Cập nhật dự án' : 'Tạo dự án')) : (saving ? 'Saving...' : (isEditing ? 'Update Project' : 'Create Project'))}
        </button>
      </form>
    </div>
  );
}
