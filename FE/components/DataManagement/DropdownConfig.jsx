import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getDropdownKeys, createDropdownOption, updateDropdownOption, getDropdownOptionImpact, deleteDropdownOption, reorderDropdownValues } from '../../services/api';

// Bản dịch tên khóa dropdown — BE có thể trả label thiếu hoặc dạng key raw (chứa "_")
const KEY_LABELS = {
  project_type: { vi: 'Loại Project', en: 'Project Type' },
  project_status: { vi: 'Trạng thái Project', en: 'Project Status' },
  task_status: { vi: 'Trạng thái Task', en: 'Task Status' },
  task_priority: { vi: 'Độ ưu tiên Task', en: 'Task Priority' },
  company_size: { vi: 'Phân khúc Khách hàng', en: 'Customer Segment' },
  customer_segment: { vi: 'Phân khúc Khách hàng', en: 'Customer Segment' },
  stakeholder: { vi: 'Stakeholders', en: 'Stakeholders' },
  contract_status: { vi: 'Trạng thái Hợp đồng', en: 'Contract Status' },
  currency: { vi: 'Tiền tệ', en: 'Currency' },
  lead_source: { vi: 'Nguồn Leads', en: 'Lead Source' },
  opportunity_status: { vi: 'Trạng thái Cơ hội', en: 'Opportunity Status' },
};

// Bản dịch giá trị hiển thị (chỉ áp dụng khi locale = vi, không đổi dữ liệu gửi lên BE)
const VALUE_LABELS = {
  // Trạng thái chung
  draft: 'Nháp',
  signed: 'Đã ký',
  expired: 'Hết hạn',
  terminated: 'Đã chấm dứt',
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  pending: 'Chờ xử lý',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  planning: 'Lên kế hoạch',
  processing: 'Đang thực hiện',
  done: 'Hoàn thành',
  backlog: 'Tồn đọng',
  'on hold': 'Tạm dừng',
  // Tiền tệ
  usd: 'USD (Đô la Mỹ)',
  vnd: 'VND (Việt Nam Đồng)',
  eur: 'EUR (Euro)',
  jpy: 'JPY (Yên Nhật)',
  gbp: 'GBP (Bảng Anh)',
  sgd: 'SGD (Đô la Singapore)',
  dollar: 'Đô la Mỹ',
  euro: 'Euro',
  yen: 'Yên Nhật',
  dong: 'Việt Nam Đồng',
  // Nguồn Leads
  website: 'Website',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  event: 'Sự kiện',
  exhibition: 'Triển lãm',
  webinar: 'Webinar',
  referral: 'Giới thiệu',
  'cold call': 'Gọi điện tư vấn',
  email: 'Email',
  'email campaign': 'Chiến dịch Email',
  advertisement: 'Quảng cáo',
  ads: 'Quảng cáo',
  workshop: 'Workshop',
  'online campaign': 'Chiến dịch Online',
  'lead generation': 'Tìm kiếm Leads',
  awards: 'Giải thưởng',
  production: 'Sản xuất',
  // Trạng thái cơ hội
  open: 'Đang mở',
  won: 'Đã chốt',
  lost: 'Đã mất',
  negotiation: 'Đang đàm phán',
  'in progress': 'Đang tiến hành',
  prospecting: 'Tiếp cận ban đầu',
  qualification: 'Đánh giá nhu cầu',
  proposal: 'Báo giá',
};

function prettifyKey(raw) {
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function keyDisplayLabel(k, locale) {
  const known = KEY_LABELS[k.key] || KEY_LABELS[String(k.label || '').trim().toLowerCase().replace(/\s+/g, '_')];
  if (known) return known[locale] || known.vi;
  const label = k.label || k.key || '';
  return label.includes('_') ? prettifyKey(label) : label;
}

function valueDisplayLabel(val, locale) {
  if (locale !== 'vi') return val.label;
  const key = String(val.label || '').trim().toLowerCase();
  return VALUE_LABELS[key] || val.label;
}

export default function DropdownConfig() {
  const { locale } = useDashboard();
  const addToast = useToast();
  const [keys, setKeys] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [impactModal, setImpactModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    getDropdownKeys().then((res) => {
      setKeys(res.data);
      if (res.data.length > 0) setActiveKey(res.data[0]);
    }).catch(e => console.error('[DropdownConfig] getDropdownKeys:', e)).finally(() => setLoading(false));
  }, []);

  const updateKeyValues = (keyId, newValues) => {
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, values: newValues } : k));
    setActiveKey(prev => prev?.id === keyId ? { ...prev, values: newValues } : prev);
  };

  const handleAdd = async () => {
    if (!newValue.trim() || !activeKey || adding) return;
    const trimmed = newValue.trim();
    const duplicate = activeKey.values.some(v => v.isActive !== false && (v.label || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      addToast(locale === 'vi' ? 'Giá trị này đã tồn tại (không phân biệt hoa/thường)' : 'This value already exists (case-insensitive)', 'error');
      return;
    }
    setAdding(true);
    try {
      await createDropdownOption(activeKey.key, trimmed);
      const res = await getDropdownKeys();
      const list = res.data || [];
      setKeys(list);
      const fresh = list.find(k => k.id === activeKey.id) || null;
      setActiveKey(fresh);
      setNewValue('');
      addToast(locale === 'vi' ? 'Đã thêm giá trị mới' : 'Value added');
    } catch (err) {
      if (err?.response?.status === 409) {
        addToast(locale === 'vi' ? 'Giá trị này đã tồn tại' : 'This value already exists', 'error');
      } else {
        addToast(locale === 'vi' ? 'Thêm giá trị thất bại' : 'Failed to add value', 'error');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRenameStart = (val) => {
    setRenamingId(val.id);
    setRenamingValue(val.label);
  };

  const handleRenameConfirm = async () => {
    if (!renamingValue.trim() || !activeKey) return;
    const trimmed = renamingValue.trim();
    const duplicate = activeKey.values.some(v => v.isActive !== false && v.id !== renamingId && (v.label || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      addToast(locale === 'vi' ? 'Tên này đã tồn tại (không phân biệt hoa/thường)' : 'This name already exists (case-insensitive)', 'error');
      return;
    }
    const originalVal = activeKey.values.find(v => v.id === renamingId);
    const originalLabel = originalVal?.label || '';
    if (trimmed !== originalLabel) {
      const msg = locale === 'vi'
        ? `Đổi tên "${originalLabel}" thành "${trimmed}" sẽ cập nhật dữ liệu ở tất cả các task, dự án, lead đang sử dụng giá trị này.`
        : `Renaming "${originalLabel}" to "${trimmed}" will update data across all tasks, projects, and leads using this value.`;
      if (!window.confirm(msg)) return;
    }
    try {
      await updateDropdownOption(activeKey.key, renamingId, trimmed);
      const res = await getDropdownKeys();
      const list = res.data || [];
      setKeys(list);
      const fresh = list.find(k => k.id === activeKey.id) || null;
      setActiveKey(fresh);
      setRenamingId(null);
      setRenamingValue('');
      addToast(locale === 'vi' ? 'Đã đổi tên' : 'Renamed successfully');
    } catch (err) {
      if (err?.response?.status === 409) {
        addToast(locale === 'vi' ? 'Tên này đã tồn tại' : 'This name already exists', 'error');
      } else {
        addToast(locale === 'vi' ? 'Đổi tên thất bại' : 'Failed to rename', 'error');
      }
    }
  };

  const handleDeleteClick = async (val) => {
    if (!activeKey) return;
    try {
      const res = await getDropdownOptionImpact(activeKey.key, val.id);
      const impact = res.data;
      setImpactModal({ val, impact });
    } catch {
      setImpactModal({ val, impact: null });
    }
  };

  const handleConfirmDelete = async () => {
    if (!impactModal || !activeKey) return;
    setDeleting(true);
    try {
      await deleteDropdownOption(activeKey.key, impactModal.val.id);
      const res = await getDropdownKeys();
      const list = res.data || [];
      setKeys(list);
      const fresh = list.find(k => k.id === activeKey.id) || null;
      setActiveKey(fresh);
      addToast(locale === 'vi' ? `Đã xóa "${impactModal.val.label}"` : `Deleted "${impactModal.val.label}"`);
      setImpactModal(null);
    } catch {
      addToast(locale === 'vi' ? 'Xóa thất bại' : 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Lưu thay đổi: PUT full values array của khóa hiện tại lên BE (thứ tự + danh sách hiện tại)
  const handleSave = async () => {
    if (!activeKey || saving) return;
    setSaving(true);
    try {
      const activeValues = activeKey.values.filter(v => v.isActive !== false);
      await reorderDropdownValues(activeKey.id, activeValues);
      const res = await getDropdownKeys();
      const list = res.data || [];
      setKeys(list);
      const fresh = list.find(k => k.id === activeKey.id) || null;
      setActiveKey(fresh);
      addToast(locale === 'vi' ? 'Đã lưu thay đổi' : 'Changes saved');
    } catch (e) {
      console.error('[DropdownConfig] save:', e);
      addToast(locale === 'vi' ? 'Lưu thay đổi thất bại. Vui lòng thử lại.' : 'Failed to save changes. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Kéo thả sắp xếp lại thứ tự values
  const handleDragStart = (index) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndexRef.current == null || dragIndexRef.current === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDrop = (index) => {
    const from = dragIndexRef.current;
    handleDragEnd();
    if (from == null || from === index) return;
    const reordered = [...activeKey.values];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    const prevValues = activeKey.values;
    updateKeyValues(activeKey.id, reordered);
    const activeOnly = reordered.filter(v => v.isActive !== false);
    reorderDropdownValues(activeKey.id, activeOnly).catch((e) => {
      console.error('[DropdownConfig] reorder:', e);
      updateKeyValues(activeKey.id, prevValues);
      addToast(locale === 'vi' ? 'Lưu thứ tự thất bại' : 'Failed to save order', 'error');
    });
  };

  const visibleValues = activeKey ? activeKey.values.filter(v => v.isActive !== false) : [];
  const visibleCountOf = (k) => k.values.filter(v => v.isActive !== false).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{locale === 'vi' ? 'Cấu hình Dropdown' : 'Dropdown Configuration'}</h2>
        <p className="text-body-md text-on-surface-variant">{locale === 'vi' ? 'Quản lý các tùy chọn toàn hệ thống trong menu thả xuống của ứng dụng.' : 'Manage system-wide options in application dropdown menus.'}</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Keys List */}
        <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-4 border-b border-outline-variant">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Khóa Dropdown' : 'Dropdown Keys'}</h3>
          </div>
          <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {keys.map((key) => (
              <button
                key={key.id}
                onClick={() => setActiveKey(key)}
                className={`w-full text-left p-4 rounded-lg flex items-center justify-between group transition-all ${
                  activeKey?.id === key.id
                    ? 'bg-primary-fixed/20 border border-primary/30 text-primary'
                    : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-title-md">{keyDisplayLabel(key, locale)}</span>
                  <span className="text-xs opacity-60">{visibleCountOf(key)} {locale === 'vi' ? 'giá trị đã định nghĩa' : 'defined values'}</span>
                </div>
                <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        {/* Values Editor */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{activeKey ? keyDisplayLabel(activeKey, locale) : ''}</h3>
                <p className="text-body-md text-on-surface-variant">{locale === 'vi' ? 'Kéo thả để sắp xếp thứ tự.' : 'Drag & drop to reorder.'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded-lg transition-all font-bold shadow-lg shadow-primary/10 active:scale-95 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className={`material-symbols-outlined text-sm ${saving ? 'animate-spin' : ''}`}>{saving ? 'sync' : 'save'}</span>
                  <span className="text-body-md">{locale === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            {/* Values List */}
            <div className="space-y-2 mb-8">
              {visibleValues.map((val, index) => (
                <div
                  key={val.id}
                  draggable={renamingId !== val.id}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 bg-surface-container-low border rounded-xl group hover:border-primary/30 transition-all ${
                    dragOverIndex === index ? 'border-primary bg-primary/5' : 'border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant/40 cursor-grab active:cursor-grabbing" title={locale === 'vi' ? 'Kéo để di chuyển' : 'Drag to move'}>drag_indicator</span>
                  {renamingId === val.id ? (
                    <input
                      autoFocus
                      className="flex-1 text-body-md text-on-surface bg-white border border-primary rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameConfirm();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={handleRenameConfirm}
                    />
                  ) : (
                    <div className="flex-1 text-body-md text-on-surface">{valueDisplayLabel(val, locale)}</div>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {renamingId !== val.id && (
                      <button
                        onClick={() => handleRenameStart(val)}
                        className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant"
                        title={locale === 'vi' ? 'Đổi tên' : 'Rename'}
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(val)}
                      className="p-1.5 hover:bg-error/10 rounded-lg text-error"
                      title={locale === 'vi' ? 'Xóa' : 'Delete'}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {visibleValues.length === 0 && (
                <div className="py-6 text-center text-body-md text-on-surface-variant italic">
                  {locale === 'vi' ? 'Chưa có giá trị nào.' : 'No values yet.'}
                </div>
              )}
            </div>

            {/* Add Value */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase px-1">{locale === 'vi' ? 'Thêm giá trị mới' : 'Add New Value'}</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-body-md"
                    placeholder={locale === 'vi' ? 'VD: Hợp tác Influencer' : 'E.g.: Influencer Collaboration'}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="px-6 bg-surface-container-high hover:bg-surface-container text-primary border border-primary/20 rounded-lg transition-all font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined ${adding ? 'animate-spin' : ''}`}>{adding ? 'sync' : 'add'}</span>
                    <span className="text-body-md">{adding ? (locale === 'vi' ? 'Đang thêm...' : 'Adding...') : (locale === 'vi' ? 'Thêm' : 'Add')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 border-l-4 border-secondary flex gap-4 items-start">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <span className="material-symbols-outlined text-secondary">info</span>
            </div>
            <div>
              <h4 className="font-title-md text-title-md text-secondary mb-1">{locale === 'vi' ? 'Cảnh báo Tác động Toàn cục' : 'Global Impact Warning'}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {locale === 'vi' ? 'Các thay đổi ở đây sẽ ảnh hưởng ngay lập tức đến tất cả' : 'Changes here will immediately affect all'} <span className="text-on-surface font-semibold underline decoration-secondary/30">{locale === 'vi' ? 'bộ lọc dự án' : 'project filters'}</span> {locale === 'vi' ? 'và' : 'and'} <span className="text-on-surface font-semibold underline decoration-secondary/30">{locale === 'vi' ? 'nhóm phân tích' : 'analysis groups'}</span> {locale === 'vi' ? 'trên toàn bộ không gian làm việc. Xóa một khóa đang được sử dụng sẽ để lại các bản ghi hiện tại với giá trị null.' : 'across the entire workspace. Deleting a key currently in use will leave existing records with a null value.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Check Modal */}
      {impactModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setImpactModal(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">warning</span>
                  {locale === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}
                </h3>
                <button onClick={() => setImpactModal(null)} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">&times;</button>
              </div>

              <div className="bg-surface-container-low rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">{locale === 'vi' ? 'Giá trị:' : 'Value:'}</span>
                  <span className="font-semibold text-on-surface">{impactModal.val.label}</span>
                </div>
                {impactModal.impact && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{locale === 'vi' ? 'Sử dụng trong Tasks:' : 'Used in Tasks:'}</span>
                      <span className="font-semibold">{impactModal.impact.breakdown?.tasks || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{locale === 'vi' ? 'Sử dụng trong Projects:' : 'Used in Projects:'}</span>
                      <span className="font-semibold">{impactModal.impact.breakdown?.projects || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{locale === 'vi' ? 'Sử dụng trong Opportunities:' : 'Used in Opportunities:'}</span>
                      <span className="font-semibold">{impactModal.impact.breakdown?.opportunities || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{locale === 'vi' ? 'Sử dụng trong Closed Deals:' : 'Used in Closed Deals:'}</span>
                      <span className="font-semibold">{impactModal.impact.breakdown?.closedDeals || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                      <span className="text-on-surface-variant font-semibold">{locale === 'vi' ? 'Tổng references:' : 'Total references:'}</span>
                      <span className="font-bold text-on-surface">{impactModal.impact.totalReferences || 0}</span>
                    </div>
                  </>
                )}
              </div>

              {(impactModal.impact?.totalReferences || 0) > 0 && (
                <div className="p-3 rounded bg-danger/10 text-danger text-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  {locale === 'vi' ? 'Giá trị này đang được sử dụng. Sau khi xóa, các bản ghi sẽ giữ nguyên giá trị cũ.' : 'This value is in use. After deletion, existing records will keep their current value.'}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setImpactModal(null)}
                  className="flex-1 px-4 py-3 border border-border-light text-on-surface-variant font-semibold rounded-lg hover:bg-surface-container-low transition-all"
                >
                  {locale === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-error text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  {deleting ? (locale === 'vi' ? 'Đang xóa...' : 'Deleting...') : (locale === 'vi' ? 'Xóa vĩnh viễn' : 'Delete Permanently')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
