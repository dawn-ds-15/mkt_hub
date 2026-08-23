import { useEffect, useState } from 'react';
import { createProject, updateProject, getMembers, getDropdownKeys, createTask } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import NumberInput from '../common/NumberInput';

const FALLBACK_TYPES = ['Internal', 'Client', 'Research', 'Workshop', 'Event', 'Exhibition', 'Webinar'];
const FALLBACK_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];

const PROJECT_TEMPLATES = {
  Workshop: {
    tasks: [
      { name: 'Xác định mục tiêu & đối tượng workshop', description: 'Xác định mục tiêu, đối tượng tham gia và phạm vi nội dung workshop', priority: 'High', dayOffset: 0.1 },
      { name: 'Xây dựng nội dung & chương trình', description: 'Soạn nội dung, kịch bản và tài liệu cho workshop', priority: 'High', dayOffset: 0.3 },
      { name: 'Chuẩn bị địa điểm & vật phẩm', description: 'Đặt địa điểm, chuẩn bị vật phẩm, banner và thiết bị', priority: 'Medium', dayOffset: 0.5 },
      { name: 'Gửi thư mời & theo dõi RSVP', description: 'Gửi thư mời, theo dõi xác nhận tham gia và nhắc lịch', priority: 'Medium', dayOffset: 0.7 },
      { name: 'Tổ chức workshop', description: 'Điều phối ngày diễn ra workshop', priority: 'High', dayOffset: 0.95 },
      { name: 'Tổng kết & báo cáo sau sự kiện', description: 'Tổng hợp feedback, hình ảnh và báo cáo kết quả', priority: 'Low', dayOffset: 1.1 },
    ],
  },
  Webinar: {
    tasks: [
      { name: 'Xác định chủ đề & khách mời', description: 'Chốt chủ đề, diễn giả và khách mời của webinar', priority: 'High', dayOffset: 0.1 },
      { name: 'Soạn kịch bản & slide', description: 'Xây dựng kịch bản, slide và nội dung trình bày', priority: 'High', dayOffset: 0.3 },
      { name: 'Chuẩn bị nền tảng & kỹ thuật', description: 'Setup phòng phát sóng, link đăng ký và kiểm tra kỹ thuật', priority: 'High', dayOffset: 0.5 },
      { name: 'Marketing & thu hút người đăng ký', description: 'Chạy kênh truyền thông, nhắc lịch và xử lý đăng ký', priority: 'Medium', dayOffset: 0.7 },
      { name: 'Tổ chức webinar', description: 'Dẫn dắt và vận hành buổi phát sóng trực tiếp', priority: 'High', dayOffset: 0.95 },
      { name: 'Follow-up & báo cáo', description: 'Gửi lại video, khảo sát và tổng hợp báo cáo', priority: 'Low', dayOffset: 1.1 },
    ],
  },
  Event: {
    tasks: [
      { name: 'Lập kế hoạch & ngân sách sự kiện', description: 'Chốt mục tiêu, ngân sách và quy mô sự kiện', priority: 'High', dayOffset: 0.1 },
      { name: 'Ký hợp đồng địa điểm & nhà cung cấp', description: 'Đặt địa điểm, ký hợp đồng nhà cung cấp và dịch vụ', priority: 'High', dayOffset: 0.25 },
      { name: 'Xây dựng nội dung & kịch bản', description: 'Soạn nội dung, kịch bản và chương trình chi tiết', priority: 'High', dayOffset: 0.4 },
      { name: 'Marketing & mời khách', description: 'Truyền thông sự kiện, gửi thư mời và theo dõi khách mời', priority: 'Medium', dayOffset: 0.6 },
      { name: 'Chuẩn bị logistics & vật phẩm', description: 'Chuẩn bị nhân sự, vật phẩm, trang thiết bị và check-in', priority: 'Medium', dayOffset: 0.8 },
      { name: 'Tổ chức sự kiện', description: 'Vận hành và điều phối ngày diễn ra sự kiện', priority: 'High', dayOffset: 0.95 },
      { name: 'Tổng kết & báo cáo', description: 'Tổng hợp feedback, số liệu và báo cáo tổng kết', priority: 'Low', dayOffset: 1.1 },
    ],
  },
};

export default function CreateProjectForm({ project, onClose, onSuccess }) {
  const { locale } = useDashboard();
  const isEditing = !!project;
  const [members, setMembers] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [budget, setBudget] = useState('');
  const [overhead, setOverhead] = useState('');
  const [kpiPlan, setKpiPlan] = useState('');
  const [kpiActual, setKpiActual] = useState('');
  const [template, setTemplate] = useState('');
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');
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
    let cancelled = false;
    const initDropdowns = (types, statuses) => {
      if (cancelled) return;
      if (project && project.type && !types.includes(project.type)) types = [...types, project.type];
      if (project && project.statusLabel && !statuses.includes(project.statusLabel)) statuses = [...statuses, project.statusLabel];
      setTypeOptions(types);
      setStatusOptions(statuses);
      setDropdownLoading(false);
      setType(project ? (types.includes(project.type) ? project.type : types[0] || '') : types[0] || '');
      setStatus(project ? (statuses.includes(project.statusLabel) ? project.statusLabel : statuses[0] || '') : statuses[0] || '');
    };
    getDropdownKeys().then(res => {
      const keys = res.data || [];
      const findValues = (key) => {
        const entry = keys.find(k => k.key === key);
        return (entry?.values || []).map(v => v.label).filter(Boolean);
      };
      const types = findValues('project_type');
      const statuses = findValues('project_status');
      initDropdowns(types.length ? types : FALLBACK_TYPES, statuses.length ? statuses : FALLBACK_STATUSES);
    }).catch(() => initDropdowns(FALLBACK_TYPES, FALLBACK_STATUSES));
    return () => { cancelled = true; };
  }, [project]);

  useEffect(() => {
    if (project && !initialized) {
      setName(project.name || '');
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
    setError('');
    setErrorField('');
    if (!name.trim()) {
      setErrorField('name');
      setError(locale === 'vi' ? 'Vui lòng nhập tên dự án' : 'Please enter project name');
      return;
    }
    if (!ownerId) {
      setErrorField('ownerId');
      setError(locale === 'vi' ? 'Vui lòng chọn chủ sở hữu' : 'Please select owner');
      return;
    }
    if (!deadline.trim()) {
      setErrorField('deadline');
      setError(locale === 'vi' ? 'Vui lòng chọn hạn chót (bắt buộc cho loại dự án này)' : 'Deadline is required for this project type');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        status,
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
        const created = await createProject(payload);
        const raw = created?.data?.data ?? created?.data ?? {};
        const templateTasks = PROJECT_TEMPLATES[type];
        if (template && templateTasks && raw?.id) {
          setCreatingTasks(true);
          const projectId = raw.id;
          const start = new Date();
          const end = deadline ? new Date(deadline) : null;
          const spanDays = end && end > start ? Math.max(1, Math.round((end - start) / 86400000)) : null;
          await Promise.all(
            templateTasks.tasks.map((t) => {
              const dueDate = spanDays ? new Date(start.getTime() + t.dayOffset * spanDays * 86400000) : null;
              return createTask({
                title: t.name,
                description: t.description,
                priority: t.priority,
                projectId,
                assigneeId: ownerId,
                startDate: dueDate ? dueDate.toISOString() : undefined,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
              });
            })
          );
        }
      }
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.message ?? data?.error?.message ?? err?.message;
      if (typeof msg === 'string' && /Internal server error/i.test(msg)) {
        setError(locale === 'vi' ? 'Lỗi hệ thống. Vui lòng kiểm tra lại Hạn chót và Người phụ trách, sau đó thử lại.' : 'System error. Please check the deadline and owner, then retry.');
      } else {
        setError(Array.isArray(msg) ? msg.join('\n') : msg || (locale === 'vi' ? 'Lưu thất bại' : 'Save failed'));
      }
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
            className={`w-full px-4 py-2 bg-surface-container-low border rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none ${errorField === 'name' ? 'border-red-400' : 'border-outline-variant'}`}
            placeholder={locale === 'vi' ? 'VD: Báo cáo thường niên 2024' : 'E.g. Annual Report 2024'}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (errorField === 'name') { setError(''); setErrorField(''); } }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Loại' : 'Type'}</label>
            <select className="w-full px-3 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none" value={type} onChange={(e) => { setType(e.target.value); setTemplate(''); }}>
              {dropdownLoading ? (
                <option value="">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</option>
              ) : (
                typeOptions.map((label) => <option key={label} value={label}>{label}</option>)
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Trạng thái' : 'Status'}</label>
            <select className="w-full px-3 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
              {dropdownLoading ? (
                <option value="">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</option>
              ) : (
                statusOptions.map((label) => <option key={label} value={label}>{label}</option>)
              )}
            </select>
          </div>
        </div>
        {!isEditing && PROJECT_TEMPLATES[type] && (
          <div className="border border-outline-variant rounded-lg p-3 bg-surface-container-low/40">
            <div className="flex items-center justify-between mb-2">
              <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Template & tự tạo Task' : 'Template & auto-create Tasks'}</label>
              <span className="text-[11px] leading-[14px] text-on-surface-variant italic">
                {locale === 'vi' ? 'Chọn template để hệ thống tự tạo task cơ bản' : 'Pick a template to auto-create base tasks'}
              </span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">auto_awesome</span>
              <select
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">{locale === 'vi' ? 'Không dùng template' : 'No template'}</option>
                <option value="default">{locale === 'vi' ? `${type} — mặc định` : `${type} — default`}</option>
              </select>
            </div>
            {template && (
              <div className="mt-2">
                <p className="text-[12px] leading-[16px] font-semibold text-on-surface mb-1">
                  {locale === 'vi' ? 'Các task sẽ được tạo:' : 'Tasks that will be created:'}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {PROJECT_TEMPLATES[type].tasks.map((t, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[12px] leading-[16px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px] text-primary">task_alt</span>
                      <span className="truncate">{t.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Chủ sở hữu' : 'Owner'}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
            <select
              className={`w-full pl-10 pr-4 py-2 bg-surface-container-low text-body-md border rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none ${errorField === 'ownerId' ? 'border-red-400' : 'border-outline-variant'}`}
              value={ownerId}
              onChange={(e) => { setOwnerId(e.target.value); if (errorField === 'ownerId') { setError(''); setErrorField(''); } }}
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
              className={`w-full pl-10 pr-4 py-2 bg-surface-container-low border rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none ${errorField === 'deadline' ? 'border-red-400' : 'border-outline-variant'}`}
              type="date"
              value={deadline}
              onChange={(e) => { setDeadline(e.target.value); if (errorField === 'deadline') { setError(''); setErrorField(''); } }}
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
              <NumberInput className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Chi phí phát sinh' : 'Overhead Cost'}</label>
              <NumberInput className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
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
              <NumberInput className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="100,000" value={kpiPlan} onChange={(e) => setKpiPlan(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Thực tế (Đạt được)' : 'Actual (Achieved)'}</label>
              <NumberInput className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="0" value={kpiActual} onChange={(e) => setKpiActual(e.target.value)} />
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
          {saving
            ? (creatingTasks
              ? (locale === 'vi' ? 'Đang tạo task từ template...' : 'Creating tasks from template...')
              : (locale === 'vi' ? 'Đang lưu...' : 'Saving...'))
            : (locale === 'vi' ? (isEditing ? 'Cập nhật dự án' : 'Tạo dự án') : (isEditing ? 'Update Project' : 'Create Project'))}
        </button>
      </form>
    </div>
  );
}
