import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getDropdownKeys, addDropdownValue, reorderDropdownValues } from '../../services/api';
import { markDeleted, restoreDeleted, getDeletedIds } from '../../utils/softDelete';

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
  const [showDeleted, setShowDeleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  // Soft-delete markers dùng composite id `${keyId}:${valueId}` để tránh trùng value id giữa các khóa
  // Giữ làm state để UI tự cập nhật ngay khi xóa/khôi phục
  const [deletedIds, setDeletedIds] = useState(() => getDeletedIds('dropdown_values'));

  const syncDeletedIds = () => setDeletedIds(getDeletedIds('dropdown_values'));

  useEffect(() => {
    getDropdownKeys().then((res) => {
      setKeys(res.data);
      if (res.data.length > 0) setActiveKey(res.data[0]);
    }).catch(e => console.error('[DropdownConfig] getDropdownKeys:', e)).finally(() => setLoading(false));
  }, []);

  const deletedSet = deletedIds;
  const visibleValues = activeKey ? activeKey.values.filter(v => !deletedSet.has(`${activeKey.id}:${v.id}`)) : [];
  const deletedValues = activeKey ? activeKey.values.filter(v => deletedSet.has(`${activeKey.id}:${v.id}`)) : [];
  const visibleCountOf = (k) => k.values.filter(v => !deletedSet.has(`${k.id}:${v.id}`)).length;

  const updateKeyValues = (keyId, newValues) => {
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, values: newValues } : k));
    setActiveKey(prev => prev?.id === keyId ? { ...prev, values: newValues } : prev);
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    addDropdownValue(activeKey.id, newValue).then((res) => {
      updateKeyValues(activeKey.id, [...activeKey.values, res.data]);
      setNewValue('');
      addToast(locale === 'vi' ? 'Đã thêm giá trị mới' : 'Value added');
    }).catch(() => {
      addToast(locale === 'vi' ? 'Thêm giá trị thất bại' : 'Failed to add value', 'error');
    });
  };

  // Xóa (mềm): chỉ ẩn khỏi UI (localStorage), giữ nguyên trên backend — có thể khôi phục
  const handleSoftDelete = (val) => {
    markDeleted('dropdown_values', `${activeKey.id}:${val.id}`);
    syncDeletedIds();
    addToast(locale === 'vi' ? `Đã xóa "${val.label}" (có thể khôi phục)` : `Deleted "${val.label}" (restorable)`);
  };

  // Khôi phục giá trị đã xóa
  const handleRestore = (val) => {
    restoreDeleted('dropdown_values', `${activeKey.id}:${val.id}`);
    syncDeletedIds();
    addToast(locale === 'vi' ? `Đã khôi phục "${val.label}"` : `Restored "${val.label}"`);
  };

  // Đặt lại: tải lại dữ liệu gốc từ BE cho khóa hiện tại + gỡ marker xóa mềm của khóa đó
  const handleReset = async () => {
    if (!activeKey || resetting) return;
    const msg = locale === 'vi'
      ? 'Đặt lại khóa này về dữ liệu gốc trên máy chủ? Các thay đổi chưa lưu sẽ bị mất.'
      : 'Reset this key to server data? Unsaved changes will be lost.';
    if (!window.confirm(msg)) return;
    setResetting(true);
    try {
      const res = await getDropdownKeys();
      const list = res.data || [];
      setKeys(list);
      const fresh = list.find(k => k.id === activeKey.id) || null;
      ((fresh && fresh.values) || []).forEach(v => restoreDeleted('dropdown_values', `${activeKey.id}:${v.id}`));
      setActiveKey(fresh);
      setShowDeleted(false);
      syncDeletedIds();
      addToast(locale === 'vi' ? 'Đã đặt lại về dữ liệu gốc' : 'Reset to server data');
    } catch (e) {
      console.error('[DropdownConfig] reset:', e);
      addToast(locale === 'vi' ? 'Đặt lại thất bại. Vui lòng thử lại.' : 'Reset failed. Please try again.', 'error');
    } finally {
      setResetting(false);
    }
  };

  // Lưu thay đổi: PUT full values array của khóa hiện tại lên BE (thứ tự + danh sách hiện tại)
  const handleSave = async () => {
    if (!activeKey || saving) return;
    setSaving(true);
    try {
      await reorderDropdownValues(activeKey.id, activeKey.values);
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
    const reordered = [...visibleValues];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    // Giữ nguyên slot của các giá trị đang bị xóa mềm trong mảng full
    const visibleIds = new Set(visibleValues.map(v => v.id));
    const slots = [];
    activeKey.values.forEach((v, i) => { if (visibleIds.has(v.id)) slots.push(i); });
    const full = [...activeKey.values];
    reordered.forEach((v, j) => { full[slots[j]] = v; });
    const prevValues = activeKey.values;
    updateKeyValues(activeKey.id, full);
    reorderDropdownValues(activeKey.id, full).catch((e) => {
      console.error('[DropdownConfig] reorder:', e);
      updateKeyValues(activeKey.id, prevValues);
      addToast(locale === 'vi' ? 'Lưu thứ tự thất bại' : 'Failed to save order', 'error');
    });
  };

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
                onClick={() => { setActiveKey(key); setShowDeleted(false); syncDeletedIds(); }}
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
                <p className="text-body-md text-on-surface-variant">{locale === 'vi' ? 'Kéo thả để sắp xếp thứ tự. Xóa mềm có thể khôi phục.' : 'Drag & drop to reorder. Soft-deleted values can be restored.'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-lg transition-all border border-outline-variant disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className={`material-symbols-outlined text-sm ${resetting ? 'animate-spin' : ''}`}>{resetting ? 'sync' : 'undo'}</span>
                  <span className="text-body-md">{locale === 'vi' ? 'Đặt lại' : 'Reset'}</span>
                </button>
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
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 bg-surface-container-low border rounded-xl group hover:border-primary/30 transition-all ${
                    dragOverIndex === index ? 'border-primary bg-primary/5' : 'border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant/40 cursor-grab active:cursor-grabbing" title={locale === 'vi' ? 'Kéo để di chuyển' : 'Drag to move'}>drag_indicator</span>
                  <div className="flex-1 text-body-md text-on-surface">{valueDisplayLabel(val, locale)}</div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleSoftDelete(val)}
                      className="p-1.5 hover:bg-error/10 rounded-lg text-error"
                      title={locale === 'vi' ? 'Xóa (có thể khôi phục)' : 'Delete (restorable)'}
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

            {/* Deleted (soft) Values */}
            {deletedValues.length > 0 && (
              <div className="mb-8 pt-4 border-t border-dashed border-outline-variant">
                <button
                  onClick={() => setShowDeleted(!showDeleted)}
                  className="flex items-center gap-2 text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className={`material-symbols-outlined text-lg transition-transform ${showDeleted ? 'rotate-90' : ''}`}>chevron_right</span>
                  {locale === 'vi' ? `Giá trị đã xóa (${deletedValues.length})` : `Deleted values (${deletedValues.length})`}
                </button>
                {showDeleted && (
                  <div className="mt-3 space-y-2">
                    {deletedValues.map((val) => (
                      <div key={val.id} className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/60 rounded-xl opacity-75">
                        <span className="material-symbols-outlined text-on-surface-variant">archive</span>
                        <div className="flex-1 text-body-md text-on-surface line-through">{valueDisplayLabel(val, locale)}</div>
                        <button
                          onClick={() => handleRestore(val)}
                          className="p-1.5 hover:bg-surface-container-high rounded-lg text-secondary"
                          title={locale === 'vi' ? 'Khôi phục' : 'Restore'}
                        >
                          <span className="material-symbols-outlined text-lg">undo</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    className="px-6 bg-surface-container-high hover:bg-surface-container text-primary border border-primary/20 rounded-lg transition-all font-bold flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">add</span>
                    <span className="text-body-md">{locale === 'vi' ? 'Thêm' : 'Add'}</span>
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
    </div>
  );
}
