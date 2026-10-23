import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { createInventoryItem, updateInventoryItem, updateBatch, getItemBatches, createInventoryEntry, checkBatchCode, uploadBatchAttachments, getCategoryBudgetTree } from '../../services/api';
import { getBatchExpenseCategory } from '../../utils/inventoryBudgetCategory';
import { useInventoryCategories } from '../../hooks/useInventoryCategories';
import NumberInput from '../common/NumberInput';
import BatchAttachments, { isAttachmentApiUnsupported } from './BatchAttachments';

const normalizeBatchCode = (code) => String(code || '').trim().toLowerCase();

function generateCode(name) {
  const base = (name || 'ITEM').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9-_]/g, '').slice(0, 20) || 'ITEM';
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

export default function InventoryFormModal({ item, mode, onClose, onSaved }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const { categories: categoryOptions, categoryValueOf } = useInventoryCategories();

  const isCreate = mode === 'create';

  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'posm');
  const [unit, setUnit] = useState(item?.unit || '');

  const [batchCode, setBatchCode] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [unitPriceBeforeVat, setUnitPriceBeforeVat] = useState('');
  const [vatRate, setVatRate] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [contractCode, setContractCode] = useState('');
  const [note, setNote] = useState('');
  const [entryId, setEntryId] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  // Hạng mục chi phí (ngân sách) ghi trực tiếp cho batch — dành cho chi phí chung không chia được theo dự án.
  const [expenseCat, setExpenseCat] = useState(null); // { id, name } | null
  const [initialExpenseCat, setInitialExpenseCat] = useState(null);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const budgetYear = Number(String(receivedDate || '').slice(0, 4)) || new Date().getFullYear();
  useEffect(() => {
    let alive = true;
    getCategoryBudgetTree(budgetYear).then((res) => {
      if (!alive) return;
      const list = (res.data?.categories || []).filter((c) => c && c.id && String(c.name || '').trim());
      setBudgetCategories(list.map((c) => ({ id: c.id, name: c.name })));
    }).catch((e) => {
      console.error('[Inventory] getCategoryBudgetTree:', e);
      if (alive) setBudgetCategories([]);
    });
    return () => { alive = false; };
  }, [budgetYear]);
  const budgetOptions = expenseCat && !budgetCategories.some((c) => c.id === expenseCat.id)
    ? [...budgetCategories, expenseCat]
    : budgetCategories;

  // Mã batch duy nhất toàn kho: hỏi BE (check-code) 400ms sau khi ngừng gõ, bỏ qua chính batch đang sửa.
  // BE vẫn chặn lại bằng 409 khi lưu nếu có người vừa dùng mã này.
  const [duplicateBatch, setDuplicateBatch] = useState(null);
  useEffect(() => {
    const code = batchCode.trim();
    if (!normalizeBatchCode(code)) { setDuplicateBatch(null); return undefined; }
    let cancelled = false;
    const id = setTimeout(() => {
      checkBatchCode(code, entryId || undefined)
        .then((r) => { if (!cancelled) setDuplicateBatch(r.exists ? { itemName: r.itemName } : null); })
        .catch((e) => { if (!cancelled) { console.error('[Inventory] check batch code:', e); setDuplicateBatch(null); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(id); };
  }, [batchCode, entryId]);

  useEffect(() => {
    if (!isCreate && item?.id) {
      getItemBatches(item.id).then((res) => {
        const batches = Array.isArray(res.data) ? res.data : [];
        const latest = batches[batches.length - 1] || batches[0] || null;
        if (latest) {
          setBatchCode(latest.batchCode || '');
          setReceivedDate(latest.receivedDate ? String(latest.receivedDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
          setQuantity(latest.quantityIn != null ? String(latest.quantityIn) : '');
          const seededBeforeVat = latest.unitPriceBeforeVat != null
            ? Number(latest.unitPriceBeforeVat)
            : (latest.unitPriceAfterVat != null && Number(latest.vatRate) > 0
                ? Math.round(Number(latest.unitPriceAfterVat) / (1 + Number(latest.vatRate) / 100))
                : latest.unitPrice);
          setUnitPriceBeforeVat(seededBeforeVat != null && !isNaN(seededBeforeVat) ? String(seededBeforeVat) : '');
          setVatRate(latest.vatRate != null ? String(latest.vatRate) : '0');
          setSupplier(latest.supplier || '');
          setContractCode(latest.contractCode || '');
          setNote(latest.note || '');
          setEntryId(latest.id || null);
          const cat = getBatchExpenseCategory(latest);
          setExpenseCat(cat);
          setInitialExpenseCat(cat);
        }
      }).catch(() => {});
    }
  }, [isCreate, item?.id]);

  const unitPriceAfterVat = Math.round((Number(unitPriceBeforeVat) || 0) * (1 + (Number(vatRate) || 0) / 100));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [missingFields, setMissingFields] = useState({});

  const title = isCreate ? t('Nhập kho mới', 'New inventory item')
    : t(`Sửa vật phẩm — ${item.name}`, `Edit item — ${item.name}`);

  // Upload hồ sơ đã chọn trước khi batch tồn tại. Trả về chuỗi cảnh báo (rỗng nếu OK) để nối vào toast.
  const uploadPending = async (batchId) => {
    if (!pendingFiles.length) return '';
    if (!batchId) return t(' — chưa đính kèm được hồ sơ (không xác định được batch).', ' — attachments not uploaded (batch not found).');
    try {
      await uploadBatchAttachments(batchId, pendingFiles);
      return '';
    } catch (e) {
      console.error('[Inventory] upload pending attachments:', e);
      return isAttachmentApiUnsupported(e)
        ? t(' — BE chưa hỗ trợ lưu hồ sơ liên quan.', ' — BE does not support attachments yet.')
        : t(' — tải hồ sơ lên không thành công.', ' — attachment upload failed.');
    }
  };

  // Gửi kèm expenseCategoryId/Name khi có chọn (hoặc null khi bỏ chọn một hạng mục đã có ở batch cũ).
  // BE cộng giá trị nhập (trước VAT) của batch vào thực tế nhóm hạng mục trong cây ngân sách.
  const sendWithExpenseCategory = async (call, payload) => {
    let extra = null;
    if (expenseCat?.id) extra = { expenseCategoryId: expenseCat.id, expenseCategoryName: expenseCat.name || '' };
    else if (initialExpenseCat?.id) extra = { expenseCategoryId: null, expenseCategoryName: null };
    return call(extra ? { ...payload, ...extra } : payload);
  };

  const findBatchId = async (itemId, fromList) => {
    const code = normalizeBatchCode(batchCode);
    const hit = (Array.isArray(fromList) ? fromList : []).find((b) => normalizeBatchCode(b.batchCode) === code);
    if (hit?.id) return hit.id;
    if (!itemId) return null;
    const bRes = await getItemBatches(itemId).catch(() => ({ data: [] }));
    return (bRes.data || []).find((b) => normalizeBatchCode(b.batchCode) === code)?.id || null;
  };

  const afterBatchSaved = async (batchId) => uploadPending(batchId);

  const handleSubmit = async () => {
    setFormError(null);
    setMissingFields({});

    const missing = {};
    if (!name.trim()) missing.name = true;
    if (!unit.trim()) missing.unit = true;
    if (!batchCode.trim()) missing.batchCode = true;
    if (!receivedDate) missing.receivedDate = true;
    if (!quantity && quantity !== '0') missing.quantity = true;
    if (!unitPriceBeforeVat && unitPriceBeforeVat !== '0') missing.unitPriceBeforeVat = true;
    if (!supplier.trim()) missing.supplier = true;
    if (!contractCode.trim()) missing.contractCode = true;

    if (Object.keys(missing).length > 0) {
      setMissingFields(missing);
      const fieldNames = {
        name: t('Tên vật phẩm', 'Item name'),
        unit: t('Đơn vị tính', 'Unit'),
        batchCode: t('Mã batch', 'Batch code'),
        receivedDate: t('Ngày nhập', 'Received date'),
        quantity: t('Số lượng', 'Quantity'),
        unitPriceBeforeVat: t('Đơn giá trước VAT', 'Unit price (pre-VAT)'),
        supplier: t('Nhà cung cấp', 'Supplier'),
        contractCode: t('Hợp đồng', 'Contract'),
      };
      const labels = Object.keys(missing).map(k => fieldNames[k] || k).join(', ');
      setFormError(t(`Vui lòng nhập: ${labels}`, `Please fill in: ${labels}`));
      return;
    }

    if (Number(unitPriceBeforeVat) < 0) {
      setFormError(t('Đơn giá trước VAT không được âm.', 'Unit price before VAT cannot be negative.'));
      return;
    }
    if (Number(vatRate) < 0 || Number(vatRate) > 100) {
      setFormError(t('VAT phải từ 0 đến 100%.', 'VAT must be between 0 and 100%.'));
      return;
    }
    if (Number(quantity) < 0) {
      setFormError(t('Số lượng không được âm.', 'Quantity cannot be negative.'));
      return;
    }
    if (Number(quantity) === 0) {
      setFormError(t('Số lượng phải lớn hơn 0 khi nhập kho.', 'Quantity must be greater than 0 for stock-in.'));
      return;
    }
    if (duplicateBatch) {
      setMissingFields({ batchCode: true });
      setFormError(t(
        `Mã batch "${batchCode.trim()}" đã tồn tại (vật phẩm: ${duplicateBatch.itemName}). Vui lòng dùng mã khác.`,
        `Batch code "${batchCode.trim()}" already exists (item: ${duplicateBatch.itemName}). Please use another code.`
      ));
      return;
    }

    setSaving(true);
    try {
      const entryPayload = {
        batchCode: batchCode.trim(),
        receivedDate,
        quantity: Number(quantity) || 0,
        unitPrice: unitPriceAfterVat || 0,
        vatRate: Number(vatRate) || 0,
        supplier: supplier.trim(),
        contractCode: contractCode.trim(),
        note: note.trim(),
        unitPriceBeforeVat: Number(unitPriceBeforeVat) || 0,
        unitPriceAfterVat: unitPriceAfterVat || 0,
      };

      if (isCreate) {
        const itemPayload = {
          code: generateCode(name),
          name: name.trim(),
          category: category.trim().toLowerCase(),
          unit: unit.trim(),
          batchCode: batchCode.trim(),
          receivedDate,
          quantityIn: Number(quantity) || 0,
          unitPriceBeforeVat: Number(unitPriceBeforeVat) || 0,
          vatRate: Number(vatRate) || 0,
          unitPriceAfterVat: unitPriceAfterVat || 0,
          supplier: supplier.trim(),
          contractCode: contractCode.trim(),
          note: note.trim(),
        };
        const created = await sendWithExpenseCategory(createInventoryItem, itemPayload);
        const newItem = created.data || {};
        const needBatchId = pendingFiles.length > 0;
        const newBatchId = needBatchId ? await findBatchId(newItem.id, newItem.batches) : null;
        const warn = await afterBatchSaved(newBatchId);
        onSaved(t('Đã tạo vật phẩm mới', 'Item created') + warn);
      } else {
        await updateInventoryItem(item.id, {
          name: name.trim(),
          category: category.trim().toLowerCase(),
          unit: unit.trim(),
        });
        if (entryId) {
          // Batch đọc/ghi số lượng bằng `quantityIn`; `quantity` chỉ đúng cho POST /entries.
          // Trước đây chỉ gửi `quantity` nên BE bỏ qua -> sửa số lượng xong vẫn giữ số cũ.
          await sendWithExpenseCategory((p) => updateBatch(entryId, p), { ...entryPayload, quantityIn: Number(quantity) || 0 });
        } else {
          const entry = await sendWithExpenseCategory(createInventoryEntry, { itemId: item.id, ...entryPayload });
          const needBatchId = pendingFiles.length > 0;
          const newBatchId = entry.data?.batch?.id || (needBatchId ? await findBatchId(item.id, []) : null);
          const warn = await afterBatchSaved(newBatchId);
          onSaved(t('Đã cập nhật vật phẩm', 'Item updated') + warn);
          return;
        }
        onSaved(t('Đã cập nhật vật phẩm', 'Item updated'));
      }
    } catch (e) {
      console.error('[Inventory] save:', e);
      const raw = e?.response?.data?.message;
      const detail = Array.isArray(raw) ? raw.join(', ') : (typeof raw === 'string' && raw ? raw : '');
      setFormError(detail
        ? t(`Lưu không thành công. ${detail}`, `Save failed. ${detail}`)
        : t('Lưu không thành công. Vui lòng kiểm tra backend.', 'Save failed. Check backend connection.'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 border border-border-light rounded-lg text-body-sm text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none bg-surface-container-lowest";
  const errCls = "border-danger focus:border-danger focus:ring-danger";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">{title}</h3>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Tên vật phẩm', 'Item name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} ${missingFields.name ? errCls : ''}`} placeholder={t('Ví dụ: Mascot MKT Hub', 'e.g. MKT Hub Mascot')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Danh mục', 'Category')}</label>
                <select value={categoryValueOf(category)} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {categoryOptions.map(o => (
                    <option key={o.id} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn vị tính', 'Unit')}</label>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`${inputCls} ${missingFields.unit ? errCls : ''}`} placeholder={t('con, bộ, tờ...', 'pcs, set, sheet...')} />
              </div>
            </div>
          </div>

          <div className="border-t border-border-light pt-5">
            <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">{t('Nhập kho', 'Stock entry')}</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Mã batch', 'Batch code')}</label>
                  <input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className={`${inputCls} ${missingFields.batchCode || duplicateBatch ? errCls : ''}`} placeholder="BATCH-2026-001" />
                  {duplicateBatch && (
                    <p className="mt-1 text-xs text-danger flex items-start gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>{t(`Mã batch đã tồn tại (vật phẩm: ${duplicateBatch.itemName})`, `Batch code already exists (item: ${duplicateBatch.itemName})`)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ngày nhập', 'Received date')}</label>
                  <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${inputCls} ${missingFields.receivedDate ? errCls : ''}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Số lượng', 'Quantity')}</label>
                  <NumberInput value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputCls} ${missingFields.quantity ? errCls : ''}`} />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá trước VAT', 'Unit price (pre-VAT)')}</label>
                  <NumberInput value={unitPriceBeforeVat} onChange={(e) => setUnitPriceBeforeVat(e.target.value)} className={`${inputCls} ${missingFields.unitPriceBeforeVat ? errCls : ''}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('VAT (%)', 'VAT (%)')}</label>
                  <NumberInput value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá sau VAT', 'Unit price (post-VAT)')}</label>
                  <input readOnly value={unitPriceAfterVat ? unitPriceAfterVat.toLocaleString() : ''} className={`${inputCls} bg-surface-container-low cursor-not-allowed`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Nhà cung cấp', 'Supplier')}</label>
                  <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${inputCls} ${missingFields.supplier ? errCls : ''}`} />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hợp đồng', 'Contract')}</label>
                  <input value={contractCode} onChange={(e) => setContractCode(e.target.value)} className={`${inputCls} ${missingFields.contractCode ? errCls : ''}`} placeholder="HD-001/26" />
                </div>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi vào hạng mục chi phí', 'Record to expense category')}</label>
                <select
                  value={expenseCat?.id || ''}
                  onChange={(e) => {
                    const opt = budgetOptions.find((c) => c.id === e.target.value);
                    setExpenseCat(opt ? { id: opt.id, name: opt.name } : null);
                  }}
                  className={inputCls}
                >
                  <option value="">{t('— Không ghi (phân bổ theo dự án) —', '— None (allocate by project) —')}</option>
                  {budgetOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {t(`Dùng cho chi phí chung không chia được cho dự án — ghi thẳng vào hạng mục ngân sách năm ${budgetYear}.`, `For shared costs that can't be split by project — recorded directly to the ${budgetYear} budget category.`)}
                </p>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Note')}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} h-20 resize-none`} />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hồ sơ liên quan', 'Related documents')}</label>
                <div className="mt-1">
                  <BatchAttachments batchId={entryId} pendingFiles={pendingFiles} onPendingChange={setPendingFiles} disabled={saving} />
                </div>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded bg-danger/10 text-danger text-body-sm flex items-center gap-2">
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
              disabled={saving || !!duplicateBatch}
              className="px-6 py-2 bg-secondary text-on-secondary rounded text-body-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? t('Đang lưu...', 'Saving...') : t('Lưu', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
