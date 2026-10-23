import { useCallback, useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getDropdownKeys,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  updateStakeholderOptions,
} from '../../services/api';
import { loadChecklistTemplates, invalidateChecklistTemplates } from '../../services/checklistTemplateStore';

const PRIORITIES = ['High', 'Medium', 'Low'];
const PRIORITY_CHIP = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-gray-100 text-gray-600',
};

let uidSeq = 0;
const uid = () => `t_${++uidSeq}`;

const emptyTask = () => ({
  uid: uid(),
  group: '',
  name: '',
  description: '',
  priority: 'Medium',
  stakeholders: '',
  daysBeforeDeadline: 0,
  startOffset: '',
  endOffset: '',
});

const emptyTemplate = () => ({ key: '', name: '', appliesToTypes: [], leadTimeDays: 30, tasks: [] });

const slugify = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60);

const cloneTemplate = (t) => ({
  key: t.key || '',
  name: t.name || '',
  appliesToTypes: [...(t.appliesToTypes || [])],
  leadTimeDays: Number(t.leadTimeDays) || 0,
  tasks: (t.tasks || []).map((task) => ({ ...task, uid: uid() })),
});

const cloneStakeholders = (list) => (list || []).map((s) => ({ code: s.code || '', label: s.label || '' }));

function groupTasksOf(tpl) {
  const order = [];
  const byGroup = new Map();
  (tpl.tasks || []).forEach((task) => {
    const g = task.group || 'Khác';
    if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
    byGroup.get(g).push(task);
  });
  return order.map((g) => ({ name: g, tasks: byGroup.get(g) }));
}

function apiFailMsg(err, fallback) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m.join('; ');
  if (typeof m === 'string' && m) return m;
  return fallback;
}

export default function ChecklistTemplatesConfig() {
  const { locale } = useDashboard();
  const addToast = useToast();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [projectTypeOptions, setProjectTypeOptions] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [editor, setEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showStakeholderEditor, setShowStakeholderEditor] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const d = await loadChecklistTemplates(force);
      setTemplates(Array.isArray(d.templates) ? d.templates : []);
      setStakeholders(Array.isArray(d.stakeholderOptions) ? d.stakeholderOptions : []);
    } catch {
      setTemplates([]);
      setStakeholders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getDropdownKeys()
      .then((res) => {
        const keys = Array.isArray(res.data) ? res.data : [];
        const entry = keys.find((k) => k.key === 'project_type');
        setProjectTypeOptions((entry?.values || []).map((v) => v.label).filter(Boolean));
      })
      .catch(() => setProjectTypeOptions([]));
  }, [load]);

  const openCreate = () => setEditor({ mode: 'create', template: emptyTemplate() });
  const openEdit = (tpl) => setEditor({ mode: 'edit', template: cloneTemplate(tpl) });
  const openDuplicate = (tpl) =>
    setEditor({
      mode: 'create',
      template: {
        ...cloneTemplate(tpl),
        key: slugify(`${tpl.key}_copy`),
        name: `${tpl.name} (${t('bản sao', 'copy')})`,
      },
    });

  const handleSave = async () => {
    if (!editor || saving) return;
    const draft = editor.template;
    if (!String(draft.name || '').trim()) {
      addToast(t('Vui lòng nhập tên mẫu', 'Please enter template name'), 'error');
      return;
    }
    if (editor.mode === 'create' && !String(draft.key || '').trim()) {
      addToast(t('Vui lòng nhập mã mẫu (key)', 'Please enter a template key'), 'error');
      return;
    }
    if (editor.mode === 'create' && !/^[a-z0-9_-]+$/.test(draft.key)) {
      addToast(t('Key chỉ gồm chữ thường, số, gạch dưới và gạch ngang', 'Key must use lowercase letters, numbers, underscores and dashes'), 'error');
      return;
    }
    const leadTime = Number(draft.leadTimeDays) || 0;
    if (leadTime < 0) {
      addToast(t('Thời gian chuẩn bị không được âm', 'Lead time cannot be negative'), 'error');
      return;
    }
    const payload = {
      name: draft.name.trim(),
      appliesToTypes: draft.appliesToTypes || [],
      leadTimeDays: leadTime,
      tasks: (draft.tasks || []).filter((task) => String(task.name || '').trim()).map((task) => ({
        group: String(task.group || '').trim() || 'Khác',
        name: task.name.trim(),
        description: String(task.description || ''),
        priority: PRIORITIES.includes(task.priority) ? task.priority : 'Medium',
        stakeholders: String(task.stakeholders || ''),
        daysBeforeDeadline: Number(task.daysBeforeDeadline) || 0,
        startOffset: String(task.startOffset || ''),
        endOffset: String(task.endOffset || ''),
      })),
    };
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await createChecklistTemplate({ key: draft.key.trim(), ...payload });
        addToast(t('Đã tạo mẫu mới', 'Template created'), 'success');
      } else {
        await updateChecklistTemplate(draft.key, payload);
        addToast(t('Đã cập nhật mẫu', 'Template updated'), 'success');
      }
      invalidateChecklistTemplates();
      setEditor(null);
      await load(true);
    } catch (err) {
      addToast(apiFailMsg(err, t('Không thể lưu mẫu. Kiểm tra endpoint BE đã có chưa.', 'Failed to save template. Check whether the BE endpoint exists yet.')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || saving) return;
    setSaving(true);
    try {
      await deleteChecklistTemplate(confirmDelete.key);
      invalidateChecklistTemplates();
      setConfirmDelete(null);
      addToast(t(`Đã xóa mẫu "${confirmDelete.name}"`, `Template "${confirmDelete.name}" deleted`), 'success');
      await load(true);
    } catch (err) {
      addToast(apiFailMsg(err, t('Không thể xóa mẫu. Kiểm tra endpoint BE đã có chưa.', 'Failed to delete template. Check whether the BE endpoint exists yet.')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStakeholders = async () => {
    setSaving(true);
    try {
      await updateStakeholderOptions(cloneStakeholders(stakeholders));
      invalidateChecklistTemplates();
      addToast(t('Đã cập nhật danh sách stakeholder', 'Stakeholder options updated'), 'success');
      await load(true);
    } catch (err) {
      addToast(apiFailMsg(err, t('Không thể lưu danh sách stakeholder', 'Failed to save stakeholder options')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { expanded } = { expanded: templates.find((tp) => tp.key === expandedKey) || null };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">
          {locale === 'vi' ? 'Mẫu Checklist' : 'Checklist Templates'}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {locale === 'vi'
            ? 'Xem, sửa, xoá hoặc thêm mới các mẫu checklist (workshop, triển lãm, webinar...). Thay đổi sẽ áp dụng cho dự án được tạo sau khi chọn mẫu.'
            : 'View, edit, delete or add checklist templates (workshops, exhibitions, webinars...). Changes apply to projects created afterwards using the template.'}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 text-center">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">fact_check</span>
          <p className="text-body-md text-on-surface-variant">
            {locale === 'vi' ? 'Chưa có mẫu checklist nào.' : 'No checklist templates yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const isOpen = tpl.key === expandedKey;
            const groups = isOpen ? groupTasksOf(tpl) : [];
            return (
              <div key={tpl.key} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-surface-container-low transition-colors"
                  onClick={() => setExpandedKey(isOpen ? null : tpl.key)}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">{isOpen ? 'expand_more' : 'chevron_right'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-title-md text-on-surface truncate">{tpl.name}</span>
                        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{tpl.key}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-on-surface-variant">
                        <span>{tpl.totalTasks ?? (tpl.tasks || []).length} {t('việc', 'tasks')}</span>
                        <span>· T-{tpl.leadTimeDays} {t('ngày', 'days')}</span>
                        <span className="text-on-surface-variant/60">· {t('Áp cho:', 'Applies to:')}</span>
                        {(tpl.appliesToTypes || []).map((tp) => (
                          <span key={tp} className="px-1.5 py-0.5 rounded bg-primary-fixed/20 text-primary text-[10px] font-semibold">{tp}</span>
                        ))}
                        {(tpl.appliesToTypes || []).length === 0 && (
                          <span className="text-on-surface-variant/60 italic">{t('mọi loại dự án', 'all project types')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(tpl)} className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant" title={t('Sửa', 'Edit')}>
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onClick={() => openDuplicate(tpl)} className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant" title={t('Nhân bản', 'Duplicate')}>
                      <span className="material-symbols-outlined text-lg">content_copy</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ key: tpl.key, name: tpl.name })}
                      className="p-2 hover:bg-error/10 rounded-lg text-error"
                      title={t('Xóa', 'Delete')}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="px-5 pb-4 space-y-4">
                    {groups.map((g) => (
                      <div key={g.name}>
                        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">{g.name}</p>
                        <ul className="space-y-1">
                          {g.tasks.map((task, i) => (
                            <li key={`${task.name}-${i}`} className="flex items-start gap-2 text-body-sm">
                              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_CHIP[task.priority] || PRIORITY_CHIP.Medium}`}>{task.priority}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-on-surface font-medium leading-snug">{task.name}</p>
                                {(task.startOffset || task.endOffset || task.stakeholders) && (
                                  <p className="text-[11px] leading-[15px] text-on-surface-variant mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    {((task.startOffset && task.endOffset && task.startOffset !== task.endOffset)
                                      ? `${task.startOffset} – ${task.endOffset}`
                                      : (task.startOffset || task.endOffset || `T-${task.daysBeforeDeadline}`))}
                                    {!!(task.stakeholders || '').trim() && (
                                      <span>· <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">group</span>{task.stakeholders}</span></span>
                                    )}
                                  </p>
                                )}
                                {!!(task.description || '').trim() && (
                                  <p className="text-[11px] leading-[15px] text-on-surface-variant/80 mt-0.5">{task.description}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-lg font-bold shadow-lg shadow-primary/10 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {locale === 'vi' ? 'Thêm mẫu mới' : 'Add new template'}
        </button>
        <button
          onClick={() => setShowStakeholderEditor((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg font-bold text-on-surface hover:bg-surface-container-low transition-all"
        >
          <span className="material-symbols-outlined text-lg">group</span>
          {locale === 'vi' ? 'Stakeholders' : 'Stakeholders'}
          <span className={`material-symbols-outlined text-sm transition-transform ${showStakeholderEditor ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
      </div>

      {/* Stakeholder options editor */}
      {showStakeholderEditor && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              {locale === 'vi' ? 'Danh sách Stakeholder' : 'Stakeholder Options'}
            </h3>
            <button
              onClick={handleSaveStakeholders}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>{saving ? 'sync' : 'save'}</span>
              {saving ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? 'Lưu thay đổi' : 'Save changes')}
            </button>
          </div>
          <StakeholderEditor stakeholders={stakeholders} onChange={setStakeholders} t={t} />
        </div>
      )}

      {/* Template editor modal */}
      {editor && (
        <TemplateEditor
          editor={editor}
          projectTypeOptions={projectTypeOptions}
          onClose={() => { if (!saving) setEditor(null); }}
          onChange={(template) => setEditor((prev) => ({ ...prev, template }))}
          onSave={handleSave}
          saving={saving}
          t={t}
        />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!saving) setConfirmDelete(null); }}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('Xác nhận xóa', 'Confirm delete')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {t(
                `Bạn có chắc muốn xóa mẫu "${confirmDelete.name}"? Dự án đã tạo từ trước không bị ảnh hưởng.`,
                `Delete template "${confirmDelete.name}"? Already-created projects are not affected.`,
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50">
                {t('Hủy', 'Cancel')}
              </button>
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-60">
                {saving ? t('Đang xóa...', 'Deleting...') : t('Xóa', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StakeholderEditor({ stakeholders, onChange, t }) {
  const [draft, setDraft] = useState({ code: '', label: '' });

  const addRow = () => {
    if (!draft.code.trim() || !draft.label.trim()) return;
    if (stakeholders.some((s) => s.code.trim().toLowerCase() === draft.code.trim().toLowerCase())) {
      return;
    }
    onChange([...stakeholders, { code: draft.code.trim(), label: draft.label.trim() }]);
    setDraft({ code: '', label: '' });
  };

  const updateRow = (idx, code, label) => {
    const next = stakeholders.map((s, i) => (i === idx ? { code, label } : s));
    onChange(next);
  };

  const removeRow = (idx) => onChange(stakeholders.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {stakeholders.length === 0 && (
        <p className="py-4 text-center text-sm text-on-surface-variant italic">{t('Chưa có stakeholder nào.', 'No stakeholders yet.')}</p>
      )}
      {stakeholders.map((s, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono max-w-[180px]"
            value={s.code}
            onChange={(e) => updateRow(idx, e.target.value, s.label)}
            placeholder="CODE"
          />
          <input
            className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={s.label}
            onChange={(e) => updateRow(idx, s.code, e.target.value)}
            placeholder={t('Tên hiển thị', 'Display label')}
          />
          <button onClick={() => removeRow(idx)} className="p-2 hover:bg-error/10 rounded-lg text-error" title={t('Xóa', 'Delete')}>
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
        <input
          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono max-w-[180px]"
          value={draft.code}
          onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          placeholder="PM"
        />
        <input
          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          value={draft.label}
          onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          placeholder={t('Project Manager', 'Project Manager')}
        />
        <button onClick={addRow} className="p-2 hover:bg-primary/10 rounded-lg text-primary">
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({ editor, projectTypeOptions, onClose, onChange, onSave, saving, t }) {
  const { mode, template } = editor;
  const isNew = mode === 'create';

  const set = (field, value) => onChange({ ...template, [field]: value });

  const toggleType = (tp) => {
    const has = (template.appliesToTypes || []).includes(tp);
    set('appliesToTypes', has ? template.appliesToTypes.filter((x) => x !== tp) : [...(template.appliesToTypes || []), tp]);
  };

  const updateTask = (taskUid, field, value) =>
    set('tasks', template.tasks.map((task) => (task.uid === taskUid ? { ...task, [field]: value } : task)));

  const addTask = () => set('tasks', [...(template.tasks || []), emptyTask()]);

  const removeTask = (taskUid) => set('tasks', template.tasks.filter((task) => task.uid !== taskUid));

  const moveTask = (idx, dir) => {
    const next = [...template.tasks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    set('tasks', next);
  };

  const groupSets = (template.tasks || []).map((task) => String(task.group || '').trim()).filter(Boolean);
  const groupOptions = [...new Set(['Khác', ...groupSets])];

  const inputCls = 'w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-outline-variant">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {isNew ? t('Thêm mẫu mới', 'New template') : t('Sửa mẫu', 'Edit template')}
            </h3>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {t('Thay đổi sẽ áp dụng cho dự án mới chọn mẫu này.', 'Changes apply to new projects using this template.')}
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase">{t('Tên mẫu', 'Template name')}<span className="text-danger">*</span></label>
              <input
                className={inputCls}
                value={template.name}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...template, name: v };
                  if (isNew && !String(template.key || '').trim()) next.key = slugify(v);
                  onChange(next);
                }}
                placeholder={t('VD: Checklist Workshop B2B', 'E.g.: B2B Workshop Checklist')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase">{t('Mã mẫu (key)', 'Template key')}</label>
              <input
                className={inputCls}
                value={template.key}
                disabled={!isNew}
                onChange={(e) => set('key', slugify(e.target.value))}
                placeholder="workshop_b2b"
              />
              {!isNew && <p className="text-[11px] text-on-surface-variant italic">{t('Key không đổi được sau khi tạo.', 'Key cannot be changed after creation.')}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase">{t('Thời gian chuẩn bị (ngày)', 'Lead time (days)')}</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                value={template.leadTimeDays}
                onChange={(e) => set('leadTimeDays', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase">{t('Áp dụng cho loại dự án', 'Applies to project types')}</label>
              <div className="flex flex-wrap gap-1.5">
                {projectTypeOptions.map((tp) => {
                  const on = (template.appliesToTypes || []).includes(tp);
                  return (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => toggleType(tp)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        on ? 'bg-primary-fixed/20 border-primary/30 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                      }`}
                    >
                      {tp}
                    </button>
                  );
                })}
                {projectTypeOptions.length === 0 && (
                  <p className="text-[11px] text-on-surface-variant italic">{t('Không lấy được danh sách loại dự án.', 'Could not load project types.')}</p>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low px-3 py-2.5 text-[12px] text-on-surface-variant">
              {t(`Tổng cộng:`, 'Total:')} <b className="text-on-surface">{(template.tasks || []).filter((task) => String(task.name || '').trim()).length}</b> {t('việc', 'tasks')}
            </div>
          </div>

          {/* Tasks */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase">{t('Danh sách công việc', 'Tasks')}</label>
              <button type="button" onClick={addTask} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold">
                <span className="material-symbols-outlined text-sm">add</span>
                {t('Thêm việc', 'Add task')}
              </button>
            </div>
            {(template.tasks || []).length === 0 && (
              <p className="py-6 text-center text-sm text-on-surface-variant italic">{t('Chưa có công việc nào.', 'No tasks yet.')}</p>
            )}
            {(template.tasks || []).map((task, idx) => (
              <div key={task.uid} className="border border-outline-variant rounded-xl p-3 space-y-2 bg-surface-container-low/40">
                <div className="flex items-center gap-1.5">
                  <input
                    className={inputCls + ' flex-1'}
                    value={task.name}
                    onChange={(e) => updateTask(task.uid, 'name', e.target.value)}
                    placeholder={t('Tên công việc', 'Task name')}
                  />
                  <select
                    className={inputCls + ' w-[110px]'}
                    value={task.priority}
                    onChange={(e) => updateTask(task.uid, 'priority', e.target.value)}
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase block mb-0.5">{t('Nhóm', 'Group')}</label>
                    <input
                      className={inputCls}
                      value={task.group}
                      onChange={(e) => updateTask(task.uid, 'group', e.target.value)}
                      placeholder={t('VD: ĐĂNG KÝ', 'E.g.: REGISTRATION')}
                      list="template-group-options"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase block mb-0.5">{t('Số ngày trước hạn', 'Days before deadline')}</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={task.daysBeforeDeadline}
                      onChange={(e) => updateTask(task.uid, 'daysBeforeDeadline', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase block mb-0.5">T-{t('bắt đầu', 'start')}</label>
                    <input
                      className={inputCls}
                      value={task.startOffset}
                      onChange={(e) => updateTask(task.uid, 'startOffset', e.target.value)}
                      placeholder="T-75"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-on-surface-variant uppercase block mb-0.5">T-{t('kết thúc', 'end')}</label>
                    <input
                      className={inputCls}
                      value={task.endOffset}
                      onChange={(e) => updateTask(task.uid, 'endOffset', e.target.value)}
                      placeholder="T-60"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    value={task.stakeholders}
                    onChange={(e) => updateTask(task.uid, 'stakeholders', e.target.value)}
                    placeholder={t('Stakeholders (PM; QL)', 'Stakeholders (PM; QL)')}
                  />
                  <input
                    className={inputCls}
                    value={task.description}
                    onChange={(e) => updateTask(task.uid, 'description', e.target.value)}
                    placeholder={t('Mô tả (không bắt buộc)', 'Description (optional)')}
                  />
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <button type="button" onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded disabled:opacity-30">
                    <span className="material-symbols-outlined text-lg">keyboard_arrow_up</span>
                  </button>
                  <button type="button" onClick={() => moveTask(idx, 1)} disabled={idx === template.tasks.length - 1} className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded disabled:opacity-30">
                    <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
                  </button>
                  <button type="button" onClick={() => removeTask(task.uid)} className="p-1.5 text-error hover:bg-error/10 rounded">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
            <datalist id="template-group-options">
              {groupOptions.map((g) => <option key={g} value={g} />)}
            </datalist>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-outline-variant">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors">
            {t('Hủy', 'Cancel')}
          </button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold disabled:opacity-60">
            <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>{saving ? 'sync' : 'save'}</span>
            {saving ? t('Đang lưu...', 'Saving...') : t(isNew ? 'Tạo mẫu' : 'Cập nhật', isNew ? 'Create template' : 'Update')}
          </button>
        </div>
      </div>
    </div>
  );
}