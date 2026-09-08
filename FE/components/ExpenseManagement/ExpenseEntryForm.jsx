import { useEffect, useState, useRef } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getProjects,
  getInventoryItems,
  getExpenseById,
  saveExpense,
  updateExpense,
  addExpenseLine,
  updateExpenseLine,
  deleteExpenseLine,
  getCategoryBudgetTree,
} from '../../services/api';
import NumberInput from '../common/NumberInput';

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
    expenseDate: '',
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

const mapLineToRow = (ln) => {
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
    expenseDate: ln.expenseDate || ln.recognizedDate || '',
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

async function loadLatestAsTemplate(projectId) {
  try {
    const res = await getExpenseList(projectId);
    const list = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
    if (list.length === 0) return null;
    const latest = [...list].sort((a, b) => {
      const da = a.recognizedDate || a.expenseDate || '';
      const db = b.recognizedDate || b.expenseDate || '';
      const c = String(db).localeCompare(String(da));
      return c !== 0 ? c : String(b.period || '').localeCompare(String(a.period || ''));
    })[0];
    let lines = Array.isArray(latest.lines) && latest.lines.length > 0 ? latest.lines : null;
    if (!lines || lines.length === 0) {
      try {
        const detail = await getExpenseById(latest.id);
        lines = Array.isArray(detail.data?.lines) ? detail.data.lines : [];
      } catch { lines = []; }
    }
    return { expense: latest, lines: lines || [] };
  } catch {
    return null;
  }
}

export default function ExpenseEntryForm({ onSaved, editingExpense, onEditDone, onExitEdit }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  getUserRole();

  const isEditMode = Boolean(editingExpense);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [hangMucOptions, setHangMucOptions] = useState([]);
  const [categoryIdMap, setCategoryIdMap] = useState({});
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [expenseId, setExpenseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [deletedLineIds, setDeletedLineIds] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [templateSource, setTemplateSource] = useState(null);
  const [categoryNameById, setCategoryNameById] = useState({});
  const snapRef = useRef(null);

  const period = (() => {
    const [y, m] = String(date || '').split('-').map(Number);
    return { year: y || new Date().getFullYear(), month: m || new Date().getMonth() + 1 };
  })();

  useEffect(() => {
    getProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
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

  useEffect(() => {
    if (editingExpense && editingExpense.id) {
      if (editingExpense.projectId) setProjectId(editingExpense.projectId);
      const d = editingExpense.recognizedDate || editingExpense.expenseDate || '';
      if (d) setDate(String(d).slice(0, 10));
      else {
        const p = String(editingExpense.period || '').split('-');
        if (p.length === 2) setDate(`${p[0]}-${p[1]}-01`);
      }
    }
  }, [editingExpense]);

  const markDirty = (nextRows, deleted) => {
    if (!snapRef.current) {
      setDirty(false);
      return;
    }
    const snap = JSON.stringify(snapRef.current);
    const cur = JSON.stringify(dirtySnapshot(nextRows));
    setDirty(snap !== cur || deleted.length > 0);
  };

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;

    const resetToNew = () => {
      setExpenseId(null);
      setRows([emptyRow()]);
      snapRef.current = null;
      setDeletedLineIds([]);
      setDirty(false);
    };

    if (isEditMode && editingExpense?.id) {
      const loadEdit = async () => {
        let lines = Array.isArray(editingExpense.lines) && editingExpense.lines.length > 0 ? editingExpense.lines : null;
        if (!lines) {
          try {
            const res = await getExpenseById(editingExpense.id);
            const rec = res.data || {};
            lines = Array.isArray(rec.lines) ? rec.lines : [];
          } catch { lines = []; }
        }
        if (cancelled) return;
        setExpenseId(editingExpense.id);
        const mapped = (lines || [])
          .filter(Boolean)
          .map(mapLineToRow)
          .map((r) => {
            if (r.hangMucLon || !r.categoryId) return r;
            const name = categoryNameById[r.categoryId];
            return name ? { ...r, hangMucLon: normalizeHml(name) } : r;
          });
        setRows(mapped.length > 0 ? mapped : [emptyRow()]);
        snapRef.current = mapped.length > 0 ? mapped.map((r) => ({ ...r })) : null;
        setDeletedLineIds([]);
        setDirty(false);
      };
      loadEdit();
      return () => { cancelled = true; };
    }

    resetToNew();
    return () => { cancelled = true; };
  }, [projectId, period.month, period.year, reloadKey, isEditMode, editingExpense]);

  // Nạp thông tin lần nhập gần nhất của dự án làm template cho bản ghi mới (không sửa bản cũ)
  useEffect(() => {
    if (!projectId || isEditMode) return undefined;
    let cancelled = false;
    const run = async () => {
      const template = await loadLatestAsTemplate(projectId);
      if (cancelled) return;
      if (!template || !template.lines.some(Boolean)) {
        setTemplateSource(null);
        return;
      }
      const mapped = template.lines
        .filter(Boolean)
        .map(mapLineToRow)
        .map((r) => ({ ...r, lineId: null }));
      if (mapped.length === 0) {
        setTemplateSource(null);
        return;
      }
      setRows(mapped);
      snapRef.current = null;
      setDirty(false);
      const srcDate = template.expense.recognizedDate || template.expense.expenseDate || '';
      setTemplateSource({
        expenseDate: srcDate ? String(srcDate).slice(0, 10) : '',
        projectName: typeof template.expense.project === 'string' ? template.expense.project : (template.expense.project?.name || ''),
        lineCount: mapped.length,
      });
    };
    run();
    return () => { cancelled = true; };
  }, [projectId, reloadKey, isEditMode]);

  // BE không lưu hangMucLon ở dòng chi phí — khi edit, khôi phục tên hạng mục từ categoryId để dropdown hiển thị đúng
  useEffect(() => {
    if (!isEditMode || !editingExpense?.id) return undefined;
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
  }, [isEditMode, editingExpense, categoryNameById]);

  const fmtCurrency = (n) => (Number(n) || 0).toLocaleString('vi-VN');

  const calcRowPlanned = (r) => {
    if (r.isCustom || !r.inventoryItemId) return (Number(r.unitPrice) || 0) * (Number(r.plannedQty) || 0);
    const item = inventoryItems.find((i) => i.id === r.inventoryItemId);
    return item ? preVatOf(item) * (Number(r.plannedQty) || 0) : 0;
  };
  const totalPlanned = rows.reduce((s, r) => s + calcRowPlanned(r), 0);
  const totalActual = rows.reduce((s, r) => s + lineTotalOf(r, inventoryItems), 0);
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
      markDirty(next, deletedLineIds);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, emptyRow()];
      markDirty(next, deletedLineIds);
      return next;
    });
  };

  const removeRow = (rowId) => {
    const target = rows.find((r) => r.rowId === rowId);
    if (!target) return;
    if (target.lineId) {
      setDeletedLineIds((prev) => {
        const next = [...prev, target.lineId];
        markDirty(rows.filter((r) => r.rowId !== rowId), next);
        return next;
      });
      showToast(t('Dòng sẽ bị xóa khi bấm "Lưu chi phí"', 'Line will be deleted when you click "Save Expense"'));
    } else {
      markDirty(rows.filter((r) => r.rowId !== rowId), deletedLineIds);
    }
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const resetForm = () => {
    setRows([emptyRow()]);
    setExpenseId(null);
    setDeletedLineIds([]);
    snapRef.current = null;
    setDirty(false);
  };

  const exitEdit = onExitEdit || onEditDone;

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
      expenseDate: date || null,
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
    if (!date) return t('Vui lòng chọn ngày phát sinh', 'Please select an expense date');
    for (const r of rows) {
      if (!hasContent(r)) continue;
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
    if (validRows.length === 0 && deletedLineIds.length === 0) {
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
      let recId = expenseId;
      if (!recId) {
        const res = await saveExpense({
          projectId,
          period: `${period.year}-${String(period.month).padStart(2, '0')}`,
          recognizedDate: date || undefined,
          expenseDate: date || undefined,
          directCost: 0,
          directNote: '',
        });
        recId = res?.data?.id || null;
        if (!recId) throw new Error('Failed to create expense record');
        setExpenseId(recId);
      }
      for (const id of deletedLineIds) {
        try {
          await deleteExpenseLine(id);
        } catch (err) {
          console.error('[ExpenseEntryForm] deleteExpenseLine failed:', err);
        }
      }
      for (const r of validRows) {
        const payload = buildLinePayload(r);
        if (r.lineId) {
          try {
            await updateExpenseLine(r.lineId, payload);
          } catch (err) {
            console.error('[ExpenseEntryForm] updateExpenseLine failed:', err);
            showToast(t('Lỗi cập nhật dòng chi phí', 'Error updating expense line'), 'error');
          }
        } else {
          try {
            const res = await addExpenseLine(recId, payload);
            const newLineId = res?.data?.id || null;
            if (newLineId !== null && r.lineId === null) {
              setRows((prev) => prev.map((row) => (row.rowId === r.rowId ? { ...row, lineId: newLineId } : row)));
            }
          } catch (err) {
            console.error('[ExpenseEntryForm] addExpenseLine failed:', err);
            showToast(t('Lỗi thêm dòng chi phí', 'Error adding expense line'), 'error');
          }
        }
      }
      // Cập nhật ngày phát sinh ở mức bản ghi (BE không lưu ngày trên line) để cột "Ngày phát sinh" đổi sau khi sửa
      if (recId && isEditMode) {
        const curDate = String(editingExpense?.recognizedDate || editingExpense?.expenseDate || '').slice(0, 10);
        const newDate = String(date || '').slice(0, 10);
        if (newDate && curDate !== newDate) {
          try {
            await updateExpense(recId, {
              projectId,
              period: `${period.year}-${String(period.month).padStart(2, '0')}`,
              recognizedDate: newDate,
              expenseDate: newDate,
            });
          } catch (err) {
            console.error('[ExpenseEntryForm] updateExpense date failed:', err);
          }
        }
      }
      showToast(
        deletedLineIds.length > 0
          ? t('Đã lưu và xóa dòng chi phí', 'Saved and deleted expense lines')
          : t('Đã lưu chi phí thành công', 'Expense saved successfully')
      );
      setDeletedLineIds([]);
      snapRef.current = dirtySnapshot(rows);
      resetForm();
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
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isEditMode && (
            <div className="mb-4 px-4 py-3 rounded-lg border-2 border-secondary/40 bg-secondary/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-secondary">edit</span>
                <div>
                  <p className="font-label-md text-secondary">{t('Đã chuyển sang chế độ chỉnh sửa', 'Switched to edit mode')}</p>
                  <p className="text-xs text-on-surface-variant">
                    {t('Bấm "Cập nhật chi phí" để lưu thay đổi, hoặc chuyển sang nhập chi phí dự án để nhập mới.', 'Click "Update Expense" to save changes, or switch to project expense entry to create a new record.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (exitEdit) exitEdit(); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary font-bold text-body-sm hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                {t('Chuyển chế độ nhập chi phí dự án', 'Switch to project entry mode')}
              </button>
            </div>
          )}

          {!isEditMode && (
            <div className="mb-4 px-4 py-2.5 rounded-lg border bg-primary/5 border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
                <span className="font-label-md text-primary">{t('Đang tạo bản ghi chi phí mới', 'Creating a new expense record')}</span>
              </div>
              {dirty && (
                <span className="text-xs font-semibold text-warning flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  {t('Có thay đổi chưa được cập nhật', 'Unsaved changes')}
                </span>
              )}
            </div>
          )}

          {!isEditMode && templateSource && (
            <div className="mb-4 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">content_copy</span>
              <div>
                <p className="font-label-md text-primary">{t('Đã nạp từ lần nhập gần nhất', 'Loaded from the latest entry')}</p>
                <p className="text-xs text-on-surface-variant">
                  {t(
                    `Đã nạp ${templateSource.lineCount} dòng từ bản ghi gần nhất (${templateSource.expenseDate || '—'}) của dự án "${templateSource.projectName}". Ngày phát sinh đặt về hôm nay; bạn có thể chỉnh sửa và bấm "Lưu chi phí" để tạo bản ghi mới — bản cũ không bị thay đổi.`,
                    `Loaded ${templateSource.lineCount} line(s) from the latest record (${templateSource.expenseDate || '—'}) of project "${templateSource.projectName}". Expense date is set to today; edit then click "Save Expense" to create a new record — the old one stays intact.`
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 flex gap-4 items-end">
            <div>
              <label className="font-label-md text-on-surface-variant block mb-1">{t('Ngày phát sinh', 'Expense date')}</label>
              <input
                className={`${inputCls} text-body-md w-[200px]`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-light shadow-sm mb-6">
            <table className="w-full min-w-[1100px] table-fixed divide-y divide-border-light">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[7%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[48px]" />
              </colgroup>
              <thead className="bg-background-subtle">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Hạng mục lớn', 'Large Category')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Chi tiết', 'Detail')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Mô tả', 'Description')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('VAT (%)', 'VAT (%)')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá trước VAT', 'Unit Price (pre-VAT)')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('SL KH / SL Thực', 'Plan Qty / Actual Qty')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền KH', 'Planned Cost')}</th>
                  <th className="px-3 py-3 text-left font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Thành tiền TT', 'Actual Cost')}</th>
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
                  const overStock = selectedItem && Number(row.actualQty) > Number(selectedItem.currentStock || selectedItem.quantity || 0);
                  return (
                    <tr key={row.rowId} className="align-top">
                      <td className="py-3 pl-4 pr-3">
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
                          placeholder={t('Nhập mô tả...', 'Enter description...')}
                          value={row.note || ''}
                          onChange={(e) => updateRow(row.rowId, 'note', e.target.value)}
                        />
                        {overStock && (
                          <p className="text-[10px] text-danger mt-0.5">{t('Vượt tồn kho!', 'Exceeds stock!')}</p>
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
                  <td colSpan={6} className="px-4 py-3 text-on-surface">{t('Tổng cộng', 'Total')}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCurrency(totalPlanned)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCurrency(totalActual)}</td>
                  <td></td>
                </tr>
                <tr className="border-t border-border-light bg-surface-container-lowest">
                  <td colSpan={9} className="px-4 py-3">
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
              {saving
                ? (expenseId ? t('Đang cập nhật...', 'Updating...') : t('Đang lưu...', 'Saving...'))
                : (expenseId ? t('Cập nhật chi phí', 'Update Expense') : t('Lưu chi phí', 'Save Expense'))}
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