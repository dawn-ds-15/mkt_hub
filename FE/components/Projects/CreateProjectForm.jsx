import { useEffect, useState } from 'react';
import { updateProject, getMembers, getDropdownKeys, createProject, getChecklistTemplates } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { useDropdownOptions } from '../../hooks/useDropdownOptions';

const FALLBACK_TYPES = ['Internal', 'Client', 'Workshop', 'Event', 'Exhibition', 'Webinar', 'Online Campaign', 'Lead Generation', 'Awards', 'Production'];
const FALLBACK_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];

// Checklist mẫu lấy từ BE (GET /v1/projects/checklist-templates) — cache module-level vì là nội dung chuẩn ít đổi
let checklistCache = null;
const fetchChecklists = async () => {
  if (checklistCache) return checklistCache;
  const res = await getChecklistTemplates();
  checklistCache = res.data;
  return checklistCache;
};

const PRIORITY_CHIP = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-gray-100 text-gray-600',
};

export default function CreateProjectForm({ project, onClose, onSuccess }) {
  const { locale } = useDashboard();
  const addToast = useToast();
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
  const [templateKey, setTemplateKey] = useState('');
  const [checklists, setChecklists] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
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
    if (isEditing || checklists) return undefined;
    let cancelled = false;
    fetchChecklists()
      .then((d) => { if (!cancelled) setChecklists(d); })
      .catch(() => { if (!cancelled) setChecklists({ templates: [], stakeholderOptions: [] }); });
    return () => { cancelled = true; };
  }, [isEditing, checklists]);

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
      setInitialized(true);
    }
  }, [project, initialized]);

  const typeTemplates = (checklists?.templates || []).filter(
    (t) => (t.appliesToTypes || []).some((x) => String(x).toLowerCase() === String(type).toLowerCase()),
  );
  const selectedTemplate = templateKey ? typeTemplates.find((t) => t.key === templateKey) : null;
  const stakeholderMap = {};
  (checklists?.stakeholderOptions || []).forEach((s) => { stakeholderMap[s.code] = s.label; });

  const groupTasksOf = (tpl) => {
    const order = [];
    const byGroup = new Map();
    tpl.tasks.forEach((t) => {
      const g = t.group || 'Khác';
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
      byGroup.get(g).push(t);
    });
    return order.map((g) => ({ name: g, tasks: byGroup.get(g) }));
  };

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
      };
      if (isEditing) {
        await updateProject(project.id, payload);
      } else {
        if (templateKey && selectedTemplate) {
          payload.applyTemplate = true;
          payload.templateType = templateKey;
        }
        const created = await createProject(payload);
        const raw = created?.data?.data ?? created?.data ?? {};
        const taskCount = Number(raw?.createdTasksCount) || 0;
        addToast(
          locale === 'vi'
            ? (taskCount > 0 ? `Tạo dự án thành công và đã sinh ${taskCount} công việc` : 'Tạo dự án thành công')
            : (taskCount > 0 ? `Project created with ${taskCount} tasks generated` : 'Project created'),
          'success',
        );
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
            <select className="w-full px-3 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none" value={type} onChange={(e) => { setType(e.target.value); setTemplateKey(''); }}>
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
        {!isEditing && typeTemplates.length > 0 && (
          <div className="border border-outline-variant rounded-lg p-3 bg-surface-container-low/40">
            <div className="flex items-center justify-between mb-2">
              <label className="text-label-sm font-bold text-on-surface-variant uppercase">{locale === 'vi' ? 'Mẫu checklist' : 'Checklist template'}</label>
              <span className="text-[11px] leading-[14px] text-on-surface-variant italic">
                {locale === 'vi' ? 'Chọn mẫu để hệ thống tự sinh danh sách việc chuẩn bị' : 'Pick a template to auto-generate prep tasks'}
              </span>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">auto_awesome</span>
              <select
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low text-body-md border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
              >
                <option value="">{locale === 'vi' ? 'Không dùng mẫu checklist' : 'No checklist template'}</option>
                {typeTemplates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name} — {t.totalTasks} {locale === 'vi' ? 'việc' : 'tasks'} (T-{t.leadTimeDays})
                  </option>
                ))}
              </select>
            </div>
            {selectedTemplate && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[12px] leading-[16px] text-on-surface-variant truncate">
                  {selectedTemplate.totalTasks} {locale === 'vi' ? 'việc sẽ được sinh tự động theo hạn chót' : 'tasks will be generated from deadline'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1 shrink-0 text-[12px] leading-[16px] font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  {locale === 'vi' ? 'Xem trước mẫu' : 'Preview template'}
                </button>
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
        {error && (
          <div className="bg-red-50 border-l-4 border-danger p-3 rounded">
            {error.split('\n').map((line, i) => (
              <p key={i} className="text-body-sm text-red-800">{line}</p>
            ))}
          </div>
        )}
        <button className="w-full py-3 bg-primary text-on-primary rounded font-bold text-label-md mt-6 hover:shadow-lg transition-all active:scale-[0.98]" type="submit" disabled={saving}>
          {saving
            ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...')
            : (locale === 'vi' ? (isEditing ? 'Cập nhật dự án' : 'Tạo dự án') : (isEditing ? 'Update Project' : 'Create Project'))}
        </button>
      </form>
      {showPreview && selectedTemplate && (() => {
        const groups = groupTasksOf(selectedTemplate);
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-4 border-b border-outline-variant">
                <div>
                  <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">{selectedTemplate.name}</h4>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    {selectedTemplate.totalTasks} {locale === 'vi' ? 'việc · thời gian chuẩn bị khoảng T-' : 'tasks · lead time about T-'}{selectedTemplate.leadTimeDays} {locale === 'vi' ? 'ngày trước hạn chót' : 'days before deadline'}
                  </p>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-4">
                {groups.map((g) => (
                  <div key={g.name}>
                    <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest mb-2">{g.name}</p>
                    <ul className="space-y-1.5">
                      {g.tasks.map((t, i) => (
                        <li key={`${g.name}-${i}`} className="flex items-start gap-2 text-body-sm">
                          <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_CHIP[t.priority] || PRIORITY_CHIP.Low}`}>{t.priority}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-on-surface font-medium leading-snug">{t.name}</p>
                            <p className="text-[11px] leading-[15px] text-on-surface-variant mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                {(t.startOffset && t.endOffset && t.startOffset !== t.endOffset)
                                  ? `${t.startOffset} – ${t.endOffset}`
                                  : (t.startOffset || t.endOffset || `T-${t.daysBeforeDeadline} ${locale === 'vi' ? 'ngày' : 'days'}`)}
                              </span>
                              {!!(t.stakeholders || '').trim() && (
                                <span>· {t.stakeholders.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean).map((s) => stakeholderMap[s] || s).join(', ')}</span>
                              )}
                            </p>
                            {!!(t.description || '').trim() && (
                              <p className="text-[11px] leading-[15px] text-on-surface-variant/80 mt-0.5">{t.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-outline-variant text-right">
                <button onClick={() => setShowPreview(false)} className="px-4 py-2 rounded border border-outline-variant text-label-md font-semibold text-on-surface hover:bg-surface-container-low transition-colors">
                  {locale === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
