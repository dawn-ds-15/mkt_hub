import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { createInventoryItem, updateInventoryItem, createInventoryEntry } from '../../services/api';
import NumberInput from '../common/NumberInput';

const CATEGORY_META = {
  posm: { vi: 'POSM', en: 'POSM' },
  gift: { vi: 'Quà tặng', en: 'Gift' },
  print: { vi: 'Ấn phẩm in', en: 'Printed materials' },
};

function generateCode(name) {
  const base = (name || 'ITEM').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9-_]/g, '').slice(0, 20) || 'ITEM';
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

export default function InventoryFormModal({ item, mode, onClose, onSaved }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

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

  const unitPriceAfterVat = Math.round((Number(unitPriceBeforeVat) || 0) * (1 + (Number(vatRate) || 0) / 100));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [missingFields, setMissingFields] = useState({});

  const title = isCreate ? t('Nhập kho mới', 'New inventory item')
    : t(`Sửa vật phẩm — ${item.name}`, `Edit item — ${item.name}`);

  const handleSubmit = async () => {
    setFormError(null);
    setMissingFields({});

    const missing = {};
    if (!name.trim()) missing.name = true;
    if (!unit.trim()) missing.unit = true;

    if (isCreate) {
      if (!batchCode.trim()) missing.batchCode = true;
      if (!receivedDate) missing.receivedDate = true;
      if (!quantity && quantity !== '0') missing.quantity = true;
      if (!unitPriceBeforeVat && unitPriceBeforeVat !== '0') missing.unitPriceBeforeVat = true;
      if (!supplier.trim()) missing.supplier = true;
      if (!contractCode.trim()) missing.contractCode = true;
    }

    if (Object.keys(missing).length > 0) {
      setMissingFields(missing);
      const fieldNames = {
        name: t('Tên vật phẩm', 'Item name'),
        unit: t('Đơn vị tính', 'Unit'),
        batchCode: t('Mã', 'Code'),
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

    try {
      if (isCreate) {
        const itemPayload = {
          code: generateCode(name),
          name: name.trim(),
          category,
          unit: unit.trim(),
        };
        const res = await createInventoryItem(itemPayload);
        const newItem = res.data;
        const itemId = newItem?.id;
        if (itemId && (batchCode.trim() || Number(quantity) > 0)) {
          await createInventoryEntry({
            itemId,
            receivedDate,
            batchCode: batchCode.trim(),
            quantity: Number(quantity) || 0,
            unitPriceBeforeVat: Number(unitPriceBeforeVat) || 0,
            vatRate: Number(vatRate) || 0,
            supplier: supplier.trim(),
            contractCode: contractCode.trim(),
            note: note.trim(),
          });
        }
        onSaved(t('Đã tạo vật phẩm mới', 'Item created'));
      } else {
        await updateInventoryItem(item.id, {
          name: name.trim(),
          category,
          unit: unit.trim(),
        });
        onSaved(t('Đã cập nhật vật phẩm', 'Item updated'));
      }
    } catch (e) {
      console.error('[Inventory] save:', e);
      setFormError(t('Lưu không thành công. Vui lòng kiểm tra backend.', 'Save failed. Check backend connection.'));
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
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {Object.entries(CATEGORY_META).map(([key, m]) => (
                    <option key={key} value={key}>{m[locale]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn vị tính', 'Unit')}</label>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`${inputCls} ${missingFields.unit ? errCls : ''}`} placeholder={t('con, bộ, tờ...', 'pcs, set, sheet...')} />
              </div>
            </div>
          </div>

          {isCreate && (
            <div className="border-t border-border-light pt-5">
              <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">{t('Nhập kho', 'Stock entry')}</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Mã', 'Code')}</label>
                    <input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className={`${inputCls} ${missingFields.batchCode ? errCls : ''}`} placeholder="BATCH-2026-001" />
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
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Note')}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} h-20 resize-none`} />
                </div>
              </div>
            </div>
          )}

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
              disabled={saving}
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
