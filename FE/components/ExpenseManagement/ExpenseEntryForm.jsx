import { useEffect, useState, useRef } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getProjects,
  getInventoryItems,
  getExpenseById,
  getExpenseList,
  saveExpense,
  addExpenseLine,
  getCategoryBudgetTree,
} from '../../services/api';
import NumberInput from '../common/NumberInput';
import { getExpenseMeta, setExpenseMeta } from '../../utils/expenseMeta';

let rowSeq = 0;

const VAT_PHAM = 'Vật phẩm';
const OTHER_HANG_MUC = 'Hạng mục khác';

const normalizeHml = (raw) => {
  const s = String(raw || '');
  const lower = s.trim().toLowerCase();
  if (lower && lower === String(VAT_PHAM).trim().toLowerCase()) return VAT_PHAM;
  if (lower && lower === String(OTHER_HANG_MUC).trim().toLowerCase()) return OTHER_HANG_MUC;
  return s;
};

const preVatOf = (item) => {
  if (!item) return 0;
  if (item.unitPriceBeforeVat != null && item.unitPriceBeforeVat !== '') return Number(item.unitPriceBeforeVat) || 0;
  const vat = item.vatRate != null ? Number(item.vatRate) : 0;
  const after = Number(item.unitPriceAfterVat || item.unitPrice || 0);
  return vat > 0 ? Math.round(after / (1 + vat / 100)) : after;
};

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayStr = () => toDateStr(new Date());

const emptyRow = () => {
  rowSeq += 1;
  return {
    rowId: rowSeq,
    lineId: null,
    expenseDate: todayStr(),
    hangMucLon: '',
    categoryId: '',
    name: '',
    inventoryItemId: '',
    plannedQty: '',
    actualQty: '',
    unitPrice: 0,
    vatRate: '',
    isCustom: false,
    note: '',
  };
};

const lineTotalOf = (row, items) => {
  const item = (items || []).find((x) => x.id === row.inventoryItemId);
  let unitPrice;
  if (row.hangMucLon === VAT_PHAM) {
    unitPrice = item ? preVatOf(item) : (Number(row.unitPrice) || 0);
  } else {
    unitPrice = row.isCustom || !row.inventoryItemId
      ? (Number(row.unitPrice) || 0)
      : item
        ? preVatOf(item)
        : (Number(row.unitPrice) || 0);
  }
  return unitPrice * (Number(row.actualQty) || 0);
};

function getUserRole() {
  try {
    const u = JSON.parse(localStorage.getItem('mkt_hub_user'));
    return u?.role || 'specialist';
  } catch { return 'specialist'; }
}

const dirtySnapshot = (rows) => rows.map((r) => ({
  lineId: r.lineId,
  expenseDate: r.expenseDate,
  hangMucLon: r.hangMucLon,
  categoryId: r.categoryId,
  name: r.name,
  inventoryItemId: r.inventoryItemId,
  plannedQty: r.plannedQty,
  actualQty: r.actualQty,
  unitPrice: r.unitPrice,
  vatRate: r.vatRate,
  isCustom: r.isCustom,
  note: r.note,
}));

const mapLineToRow = (ln, lineDates = {}) => {
  const isVatPhamLine = Boolean(ln.inventoryItemId || ln.isVatPham);
  const vat = ln.vatRateSnapshot != null ? Number(ln.vatRateSnapshot) : (ln.vatRate != null ? Number(ln.vatRate) : 0);
  const base = ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== ''
    ? Number(ln.unitPriceBeforeVat)
    : Number(ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? ln.unitPriceAfterVatSnapshot ?? 0);
  const price = ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== ''
    ? base
    : (vat > 0 ? Math.round(base / (1 + vat / 100)) : base);
  const rawHml = ln.hangMucLon || (isVatPhamLine ? VAT_PHAM : '');
  const hml = normalizeHml(rawHml);
  return {
    rowId: ++rowSeq,
    lineId: ln.id,
    expenseDate: lineDates[ln.id] || ln.expenseDate || ln.recognizedDate || '',
    hangMucLon: hml,
    categoryId: ln.categoryId || '',
    name: ln.name || '',
    inventoryItemId: ln.inventoryItemId || '',
    plannedQty: ln.plannedQuantity != null ? String(ln.plannedQuantity) : '',
    actualQty: ln.actualQuantity != null ? String(ln.actualQuantity) : '',
    unitPrice: price,
    vatRate: vat != null && ln.vatRate != null ? (ln.vatRateSnapshot != null ? String(ln.vatRateSnapshot) : String(ln.vatRate)) : (vat ? String(vat) : ''),
    isCustom: Boolean(ln.isCustom) || !ln.inventoryItemId,
    note: ln.note || '',
  };
};

async function loadProjectLines(projectId) {
  try {
    const res = await getExpenseList(projectId);
    const list = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
    if (list.length === 0) return [];
    const sorted = [...list].sort((a, b) => {
      const da = a.recognizedDate || a.expenseDate || '';
      const db = b.recognizedDate || b.expenseDate || '';
      const c = String(db).localeCompare(String(da));
      return c !== 0 ? c : String(b.period || '').localeCompare(String(a.period || ''));
    });
    const seen = new Set();
    const out = [];
    for (const exp of sorted) {
      let lines = Array.isArray(exp.lines) && exp.lines.length > 0 ? exp.lines : null;
      if (!lines || lines.length === 0) {
        try {
          const detail = await getExpenseById(exp.id);
          lines = Array.isArray(detail.data?.lines) ? detail.data.lines : [];
        } catch { lines = []; }
      }
      const lineDates = (getExpenseMeta(exp.id) || {}).lineDates || {};
      for (const ln of (lines || [])) {
        if (!ln) continue;
        const key = [
          String(ln.name || '').trim().toLowerCase(),
          String(ln.hangMucLon || '').trim().toLowerCase(),
          ln.inventoryItemId || '',
          ln.plannedQuantity ?? ln.plannedQty ?? '',
          ln.actualQuantity ?? ln.actualQty ?? '',
          ln.vatRateSnapshot ?? ln.vatRate ?? '',
          ln.unitPriceBeforeVat ?? ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? '',
          String(ln.note || '').trim().toLowerCase(),
        ].join('~');
        if (seen.has(key)) continue;
        seen.add(key);
        const row = mapLineToRow(ln, lineDates);
        row.lineId = null;
        if (!String(row.expenseDate || '').slice(0, 10)) row.expenseDate = todayStr();
        out.push(row);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export default function ExpenseEntryForm({ onSaved, projectId, onProjectChange }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  getUserRole();

  const [projects, setProjects] = useState([]);
  const [hangMucOptions, setHangMucOptions] = useState([]);
  const [categoryIdMap, setCategoryIdMap] = useState({});
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [categoryNameById, setCategoryNameById] = useState({});
  const snapRef = useRef(null);

  // Ngày nhập = ngày ấn nút Lưu; mỗi lần lưu sẽ tạo một bản ghi chi phí mới
  const recordDate = todayStr();
  const period = (() => {
    const [y, m] = String(recordDate || '').split('-').map(Number);
    return { year: y || new Date().getFullYear(), month: m || new Date().getMonth() + 1 };
  })();

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0 && !projectId && onProjectChange) {
        onProjectChange(list[0].id);
      }
    });
    getInventoryItems().then((res) => {
      setInventoryItems(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getCategoryBudgetTree(period.year, projectId || undefined)
      .then((res) => {
        const cats = Array.isArray(res.data?.categories) ? res.data.categories : [];
        const names = Array.from(new Set(cats.map((c) => c?.name).filter(Boolean)));
        const lowerVp = String(VAT_PHAM).trim().toLowerCase();
        const lowerOther = String(OTHER_HANG_MUC).trim().toLowerCase();
        // Link option đặc biệt "Vật phẩm" vào nhóm ngân sách cùng tên (không phân biệt hoa/thường) nếu có
        const vpCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerVp);
        // Gộp nhóm ngân sách "Hạng Mục Khác" (bất kể hoa thường) vào option "Hạng mục khác"
        const otherCat = cats.find((c) => c?.name && String(c.name).trim().toLowerCase() === lowerOther);
        const options = [
          VAT_PHAM,
          ...names.filter((n) => {
            const lower = String(n).trim().toLowerCase();
            return lower !== lowerVp && lower !== lowerOther;
          }),
          OTHER_HANG_MUC,
        ];
        setHangMucOptions(options);
        const map = {};
        cats.forEach((c) => { if (c.name) map[c.name] = c.id; });
        if (vpCat) map[VAT_PHAM] = vpCat.id;
        if (otherCat) map[OTHER_HANG_MUC] = otherCat.id;
        setCategoryIdMap(map);
        const nameById = {};
        cats.forEach((c) => { if (c.id && c.name) nameById[c.id] = c.name; });
        setCategoryNameById(nameById);
      })
      .catch(() => {
        setHangMucOptions([VAT_PHAM, OTHER_HANG_MUC]);
        setCategoryIdMap({});
        setCategoryNameById({});
      });
  }, [period.year, projectId]);

  const markDirty = (nextRows) => {
    if (!snapRef.current) {
      setDirty(false);
      return;
    }
    const snap = JSON.stringify(snapRef.current);
    const cur = JSON.stringify(dirtySnapshot(nextRows));
    setDirty(snap !== cur);
  };

  // Khi chọn dự án: nạp TẤT CẢ dòng chi phí của dự án vào bảng nhập. Các dòng này chỉ là bản gốc;
  // khi bấm "Lưu chi phí" sẽ tạo bản ghi mới chứa các dòng này — các bản ghi cũ không bị thay đổi.
  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    const run = async () => {
      const mapped = await loadProjectLines(projectId);
      if (cancelled) return;
      setRows(mapped.length > 0 ? mapped : [emptyRow()]);
      snapRef.current = null;
      setDirty(false);
    };
    run();
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  // BE không lưu hangMucLon ở dòng chi phí — khôi phục tên hạng mục từ categoryId để dropdown hiển thị đúng
  useEffect(() => {
    if (!categoryNameById || Object.keys(categoryNameById).length === 0) return undefined;
    setRows((prev) => (prev || []).map((r) => {
      if (r.hangMucLon || !r.categoryId) return r;
      const name = categoryNameById[r.categoryId];
      if (!name) return r;
      const hml = normalizeHml(name);
      if (hml === r.hangMucLon) return r;
      return { ...r, hangMucLon: hml };
    }));
    return undefined;
  }, [categoryNameById]);

  const fmtCurrency = (n) => (Number(n) || 0).toLocaleString('vi-VN');

  const calcRowPlanned = (r) => {
    if (r.isCustom || !r.inventoryItemId) return (Number(r.unitPrice) || 0) * (Number(r.plannedQty) || 0);
    const item = inventoryItems.find((i) => i.id === r.inventoryItemId);
    return item ? preVatOf(item) * (Number(r.plannedQty) || 0) : 0;
  };
  const totalPlanned = rows.reduce((s, r) => s + calcRowPlanned(r), 0);
  const totalActual = rows.reduce((s, r) => s + lineTotalOf(r, inventoryItems), 0);
  const totalAfterVat = rows.reduce((s, r) => s + Math.round(lineTotalOf(r, inventoryItems) * (1 + (Number(r.vatRate) || 0) / 100)), 0);
  const itemNames = Array.from(new Set(inventoryItems.map((i) => i.name))).filter(Boolean);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => {
      const next = typeof field === 'object'
        ? prev.map((r) => (r.rowId === id ? { ...r, ...field } : r))
        : prev.map((r) => (r.rowId === id ? { ...r, [field]: value } : r));
      markDirty(next);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, emptyRow()];
      markDirty(next);
      return next;
    });
  };

  const removeRow = (rowId) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const resetForm = () => {
    setRows([emptyRow()]);
    snapRef.current = null;
    setDirty(false);
  };

  const hasContent = (r) => Boolean(
    (r.name && r.name.trim()) ||
    (Number(r.actualQty) > 0) ||
    (Number(r.plannedQty) > 0)
  );

  const isVatPham = (r) => r.hangMucLon === VAT_PHAM;

  const buildLinePayload = (r) => {
    const item = inventoryItems.find((it) => it.id === r.inventoryItemId);
    const isVp = isVatPham(r);
    const isCustomLine = !isVp || !item;
    const vatRate = (r.vatRate !== '' && r.vatRate != null)
      ? Number(r.vatRate)
      : (item && item.vatRate != null ? Number(item.vatRate) : undefined);
    const unitPrice = isVp && item
      ? preVatOf(item)
      : (Number(r.unitPrice) || 0);
    const afterVat = vatRate != null && vatRate > 0
      ? Math.round(unitPrice * (1 + vatRate / 100))
      : unitPrice;
    return {
      name: isVp && item ? (item.name || '').trim() : (r.name || '').trim(),
      hangMucLon: r.hangMucLon || null,
      categoryId: r.categoryId || null,
      expenseDate: r.expenseDate || null,
      inventoryItemId: (isVp && r.inventoryItemId) || null,
      isCustom: isCustomLine,
      plannedQuantity: Number(r.plannedQty) || 0,
      actualQuantity: Number(r.actualQty) || 0,
      vatRate,
      unitPriceBeforeVat: unitPrice,
      unitPriceAfterVat: afterVat,
      actualUnitPrice: unitPrice,
      note: r.note || '',
    };
  };

  const validateRows = () => {
    for (const r of rows) {
      if (!hasContent(r)) continue;
      if (!r.expenseDate) return t('Mỗi dòng chi phí phải chọn ngày phát sinh', 'Each expense line must have an expense date');
      if (!r.hangMucLon) return t('Mỗi dòng chi phí phải chọn Hạng mục lớn', 'Each expense line must have a large category');
      if (r.vatRate !== '' && r.vatRate != null) {
        const vat = Number(r.vatRate);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) return t('VAT phải nằm trong khoảng 0-100 (%)', 'VAT must be between 0-100 (%)');
      }
      if (isVatPham(r) && !r.inventoryItemId) return t('Hạng mục "Vật phẩm" phải chọn 1 vật phẩm từ kho', '"Vật phẩm" category requires picking an inventory item');
      const planned = Number(r.plannedQty);
      const actual = Number(r.actualQty);
      const price = Number(r.unitPrice);
      if (r.plannedQty !== '' && r.plannedQty != null && (Number.isNaN(planned) || planned < 0)) return t('Số lượng kế hoạch không được âm', 'Planned quantity cannot be negative');
      if (r.actualQty !== '' && r.actualQty != null && (Number.isNaN(actual) || actual < 0)) return t('Số lượng thực tế không được âm', 'Actual quantity cannot be negative');
      if (!isVatPham(r) && r.unitPrice !== '' && r.unitPrice != null && r.unitPrice !== 0 && (Number.isNaN(price) || price < 0)) return t('Đơn giá không được âm', 'Unit price cannot be negative');
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) {
      showToast(t('Vui lòng chọn dự án', 'Please select a project'), 'error');
      return;
    }
    const validRows = rows.filter(hasContent);
    if (validRows.length === 0) {
      showToast(t('Nhập ít nhất một dòng chi phí', 'Enter at least one expense line'), 'error');
      return;
    }
    const errMsg = validateRows();
    if (errMsg) {
      showToast(errMsg, 'error');
      return;
    }
    setSaving(true);
    try {
      // Mỗi lần lưu tạo một bản ghi chi phí MỚI (ngày nhập = hôm nay); không sửa bản ghi cũ
      const res = await saveExpense({
        projectId,
        period: `${period.year}-${String(period.month).padStart(2, '0')}`,
        recognizedDate: recordDate,
        expenseDate: recordDate,
        directCost: 0,
        directNote: '',
      });
      const recId = res?.data?.id || null;
      if (!recId) throw new Error('Failed to create expense record');
      const savedLineDates = {};
      for (const r of validRows) {
        const payload = buildLinePayload(r);
        try {
          const lineRes = await addExpenseLine(recId, payload);
          const newLineId = lineRes?.data?.id || null;
          if (String(r.expenseDate || '').slice(0, 10)) {
            savedLineDates[newLineId || r.rowId] = String(r.expenseDate).slice(0, 10);
          }
        } catch (err) {
          console.error('[ExpenseEntryForm] addExpenseLine failed:', err);
          showToast(t('Lỗi thêm dòng chi phí', 'Error adding expense line'), 'error');
        }
      }
      // Lưu ngày phát sinh theo từng dòng vào meta (BE xác nhận lưu được nhưng FE giữ hậu thuẫn khi BE trả thiếu)
      if (recId) setExpenseMeta(recId, { lineDates: savedLineDates });
      showToast(t('Đã lưu chi phí thành công', 'Expense saved successfully'));
      snapRef.current = null;
      setDirty(false);
      setReloadKey((k) => k + 1);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[ExpenseEntryForm] save error:', err);
      const http = err?.response?.status ? ` (HTTP ${err.response.status})` : '';
      showToast(t(`Lỗi khi lưu chi phí${http}`, `Error saving expense${http}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-border-light rounded-md px-3 py-2 text-body-sm bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <div className="bg-surface-container-lowest border border-border-light rounded-xl relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary rounded-t-xl" />
      <form onSubmit={handleSubmit}>
        <div className="p-widget-padding">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border-light">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{t('Nhập chi phí dự án', 'Enter Project Expense')}</h2>
            <div className="flex items-center gap-3">
              <label className="font-label-md text-on-surface-variant whitespace-nowrap">{t('Chọn dự án:', 'Select project:')}</label>
              <select
                className="bg-background-subtle border border-border-light rounded-lg px-4 py-1.5 text-body-md font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none min-w-[200px]"
                value={projectId}
                onChange={(e) => onProjectChange && onProjectChange(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-light shadow-sm mb-6">
            <table className="w-full min-w-[1280px] table-fixed divide-y divide-border-light">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[48px]" />
              </colgroup>
              <thead className="bg-background-subtle">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ngày phát sinh', 'Expense Date')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hạng mục lớn', 'Large Category')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Chi tiết', 'Detail')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Ghi chú', 'Note')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá', 'Unit Price')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('VAT (%)', 'VAT (%)')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('SL KH / SL Thực', 'Plan Qty / Actual Qty')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền KH', 'Planned Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền TT', 'Actual Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Tổng Cộng', 'Total')}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light bg-surface-container-lowest">
                {rows.map((row) => {
                  const isVp = row.hangMucLon === VAT_PHAM;
                  const customLine = (!isVp && (row.isCustom || !row.inventoryItemId)) || (isVp && !row.inventoryItemId);
                  const selectedItem = inventoryItems.find((i) => i.id === row.inventoryItemId);
                  const unitPrice = customLine
                    ? (Number(row.unitPrice) || 0)
                    : selectedItem
                      ? preVatOf(selectedItem)
                      : (Number(row.unitPrice) || 0);
                  const planAmount = unitPrice * (Number(row.plannedQty) || 0);
                  const actAmount = unitPrice * (Number(row.actualQty) || 0);
                  const totalLineAfterVat = Math.round(actAmount * (1 + (Number(row.vatRate) || 0) / 100));
                  const overStock = selectedItem && Number(row.actualQty) > Number(selectedItem.currentStock || selectedItem.quantity || 0);
                  return (
                    <tr key={row.rowId} className="align-top">
                      <td className="py-3 pl-4 pr-3">
                        <input
                          className={`${inputCls} text-[12px] text-right`}
                          type="date"
                          value={row.expenseDate || ''}
                          onChange={(e) => updateRow(row.rowId, 'expenseDate', e.target.value)}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          className={`${inputCls} text-[12px]`}
                          value={row.hangMucLon || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const wasVp = row.hangMucLon === VAT_PHAM;
                            const catId = categoryIdMap[v] || '';
                            updateRow(row.rowId, {
                              hangMucLon: v,
                              categoryId: catId,
                              ...(v === VAT_PHAM
                                ? { inventoryItemId: row.inventoryItemId || '', isCustom: Boolean(row.inventoryItemId) }
                                : wasVp
                                  ? { inventoryItemId: '', isCustom: true }
                                  : {}),
                            });
                          }}
                        >
                          <option value="">{t('-- Chọn hạng mục lớn --', '-- Select large category --')}</option>
                          {hangMucOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        {isVp ? (
                          <select
                            className={`${inputCls} text-[12px]`}
                            value={row.inventoryItemId || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const item = inventoryItems.find((u) => u.id === v);
                              updateRow(row.rowId, {
                                inventoryItemId: v,
                                name: item ? item.name : row.name,
                                isCustom: !item,
                                ...(item
                                  ? { unitPrice: preVatOf(item), vatRate: item.vatRate != null ? item.vatRate : row.vatRate }
                                  : {}),
                              });
                            }}
                          >
                            <option value="">{t('-- Chọn vật phẩm từ kho --', '-- Pick an inventory item --')}</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={`${inputCls} text-[12px]`}
                            list="mkt-cat-options"
                            placeholder={t('Nhập chi tiết...', 'Enter detail...')}
                            value={row.name || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const item = inventoryItems.find((u) => u.name === v);
                              if (item) {
                                updateRow(row.rowId, {
                                  name: v,
                                  inventoryItemId: item.id,
                                  isCustom: false,
                                  unitPrice: preVatOf(item),
                                  vatRate: item.vatRate != null ? item.vatRate : row.vatRate,
                                });
                              } else {
                                updateRow(row.rowId, { name: v, inventoryItemId: '', isCustom: true });
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <input
                          className={inputCls}
                          placeholder={t('Nhập ghi chú...', 'Enter note...')}
                          value={row.note || ''}
                          onChange={(e) => updateRow(row.rowId, 'note', e.target.value)}
                        />
                        {overStock && (
                          <p className="text-[10px] text-danger mt-0.5">{t('Vượt tồn kho!', 'Exceeds stock!')}</p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {customLine ? (
                          <NumberInput
                            className={`${inputCls} text-right`}
                            placeholder="0"
                            value={row.unitPrice || ''}
                            onChange={(e) => updateRow(row.rowId, 'unitPrice', e.target.value)}
                          />
                        ) : (
                          <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={unitPrice ? unitPrice.toLocaleString('vi-VN') : '—'} />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <NumberInput
                            className={`${inputCls} text-right`}
                            placeholder="0"
                            value={row.vatRate}
                            onChange={(e) => updateRow(row.rowId, 'vatRate', e.target.value)}
                          />
                          <span className="text-[12px] text-on-surface-variant">%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1">
                          <NumberInput
                            className={`${inputCls} text-right w-1/2`}
                            placeholder={t('KH', 'Plan')}
                            value={row.plannedQty}
                            onChange={(e) => updateRow(row.rowId, 'plannedQty', e.target.value)}
                          />
                          <NumberInput
                            className={`${inputCls} text-right w-1/2`}
                            placeholder={t('Thực', 'Actual')}
                            value={row.actualQty}
                            onChange={(e) => updateRow(row.rowId, 'actualQty', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={planAmount ? planAmount.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={actAmount ? actAmount.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3">
                        <input readOnly className={`${inputCls} text-right bg-surface-container-low cursor-not-allowed`} value={totalLineAfterVat ? totalLineAfterVat.toLocaleString('vi-VN') : '—'} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          className="p-1.5 rounded-md text-on-surface-variant hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                          title={t('Xóa dòng', 'Remove row')}
                        >
                          <span className="material-symbols-outlined text-body-lg">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary bg-primary/10 font-bold">
                  <td colSpan={7} className="px-4 py-3 text-on-surface">{t('Tổng cộng', 'Total')}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCurrency(totalPlanned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCurrency(totalActual)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCurrency(totalAfterVat)}</td>
                  <td></td>
                </tr>
                <tr className="border-t border-border-light bg-surface-container-lowest">
                  <td colSpan={11} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-label-md text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-body-lg">add</span>
                      {t('Thêm dòng', 'Add Row')}
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
            <datalist id="mkt-cat-options">
              {itemNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-light">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 border border-border-light rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {t('Hủy bỏ', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-10 py-2.5 bg-primary text-on-primary rounded-lg font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-body-md">{saving ? 'hourglass_top' : 'save'}</span>
              {saving ? t('Đang lưu...', 'Saving...') : t('Lưu chi phí', 'Save Expense')}
            </button>
          </div>
        </div>
      </form>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}