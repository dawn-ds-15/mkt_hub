import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { createInventoryTransaction, getProjectsDropdown } from '../../services/api';
import NumberInput from '../common/NumberInput';

export default function StockOutModal({ item, onClose, onSaved }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectsDropdown()
      .then((res) => { if (!cancelled) setProjects(res.data || []); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const maxQty = Number(item?.totalStock) || 0;

  const handleSubmit = async () => {
    setFormError(null);
    const qty = Number(quantity) || 0;
    if (!projectId) {
      setFormError(t('Vui lòng chọn dự án.', 'Please select a project.'));
      return;
    }
    if (qty <= 0) {
      setFormError(t('Số lượng phải lớn hơn 0.', 'Quantity must be greater than 0.'));
      return;
    }
    if (qty > maxQty) {
      setFormError(t(`Số lượng vượt tồn khả dụng (tối đa ${maxQty}).`, `Quantity exceeds available stock (max ${maxQty}).`));
      return;
    }
    setSaving(true);
    try {
      await createInventoryTransaction({
        itemId: item.id,
        projectId,
        type: 'out',
        quantity: qty,
        date,
        note: note.trim(),
      });
      onSaved(t(`Đã xuất ${qty} ${item.unit || ''} cho dự án`, `Issued ${qty} ${item.unit || ''} to project`).trim());
    } catch (e) {
      console.error('[Inventory] createInventoryTransaction:', e);
      const msg = e?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join('; ') : msg || t('Xuất kho không thành công. Vui lòng kiểm tra backend.', 'Stock issue failed. Check backend connection.'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 border border-border-light rounded-lg text-body-sm text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none bg-surface-container-lowest";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {t(`Xuất cho dự án — ${item.name}`, `Issue to project — ${item.name}`)}
            </h3>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
          </div>

          <p className="text-body-sm text-on-surface-variant -mt-2">
            {t('Tồn khả dụng', 'Available stock')}: <strong className={maxQty === 0 ? 'text-danger' : 'text-on-surface'}>{maxQty.toLocaleString('vi-VN')} {item.unit}</strong>
          </p>

          <div className="space-y-4">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Dự án', 'Project')}</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} disabled={loading}>
                <option value="">{loading ? t('Đang tải dự án...', 'Loading projects...') : t('— Chọn dự án —', '— Select a project —')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Số lượng', 'Quantity')}</label>
                <NumberInput value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ngày xuất', 'Issue date')}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Note')}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder={t('VD: Dùng cho sự kiện X', 'e.g. Used for event X')} />
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded bg-danger/10 text-danger text-body-sm flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button onClick={onClose} className="px-4 py-2 border border-border-light rounded text-body-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer">
              {t('Hủy', 'Cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || loading || maxQty === 0}
              className="px-6 py-2 bg-secondary text-on-secondary rounded text-body-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? t('Đang xuất...', 'Issuing...') : t('Xuất kho', 'Issue stock')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
