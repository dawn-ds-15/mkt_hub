import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';
import {
  getCategoryBudgetTree,
  saveCategoryBudgetValues,
  createCategoryBudgetCategory,
  updateCategoryBudgetCategory,
  deleteCategoryBudgetCategory,
  createCategoryBudgetSubcategory,
  updateCategoryBudgetSubcategory,
  deleteCategoryBudgetSubcategory,
  createCategoryBudgetItem,
  updateCategoryBudgetItem,
  deleteCategoryBudgetItem,
} from '../../services/api';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
// 3 cột cố định + 12 tháng × (Kế hoạch, Thực tế) + Tổng KH + Tổng TT
const TABLE_COLS = 3 + MONTHS.length * 2 + 2;

// BE lỗi 500 khi 1 request bulk save vượt ~120 dòng → chia lô an toàn.
const CHUNK_SIZE = 80;

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

function formatMoney(n) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

function formatPercent(p) {
  if (p === null || p === undefined || p === '') return '---';
  const v = Number(p);
  if (Number.isNaN(v)) return '---';
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function sanitizeDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 15);
}

function monthValue(rowMonths, m) {
  return Number(rowMonths?.[m]) || 0;
}

function subMonthTotal(cat, m) {
  let total = 0;
  for (const sub of (Array.isArray(cat.subcategories) ? cat.subcategories : [])) {
    if (Number(sub.backup?.percent) > 0) total += monthValue(sub.backup?.months, m);
    for (const it of (Array.isArray(sub.items) ? sub.items : [])) {
      total += monthValue(it.months, m);
    }
  }
  return total;
}

function categoryMonthValue(cat, m) {
  const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
  if (subs.length > 0) return subMonthTotal(cat, m);
  return monthValue(cat.months, m);
}

// Thực tế (trước VAT) do BE tổng hợp trong cây: `actuals` theo tháng ở từng cấp.
// Dòng chi phí dự án hiện chỉ gắn tới nhóm (categoryId) nên cấp nhóm con / hạng mục nhỏ thường = 0.
function actualOf(row, m) {
  return monthValue(row?.actuals, m);
}

function hasActuals(row) {
  return MONTHS.some((m) => actualOf(row, m) > 0);
}

function apiErrorMsg(err, fallback) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m.join('; ');
  if (typeof m === 'string' && m) return m;
  return fallback;
}

function calcRowTotal(rowMonths) {
  return MONTHS.reduce((sum, m) => sum + monthValue(rowMonths, m), 0);
}

function sumMonths(months) {
  return MONTHS.reduce((sum, m) => sum + monthValue(months, m), 0);
}

function mergeMonths(serverMonths, localMonths) {
  return serverMonths && Object.keys(serverMonths).length > 0 ? serverMonths : (localMonths || {});
}

function mapTreeToState(tree, prev) {
  if (!tree) return [];
  const mapped = (tree.categories || []).filter(cat => !cat.unassigned && cat.id).map(cat => {
    const prevCat = (prev || []).find(c => c.id === cat.id);
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
    const mergedSubs = subs.map(s => {
      const prevSub = ((prevCat?.subcategories) || []).find(ps => ps.id === s.id);
      const items = Array.isArray(s.items) ? s.items : [];
      const mergedItems = items.map(it => {
        const prevIt = ((prevSub?.items) || []).find(pi => pi.id === it.id);
        return { ...it, months: mergeMonths(it.months, prevIt?.months) };
      });
      return {
        ...s,
        backup: s.backup ? { ...s.backup, months: mergeMonths(s.backup.months, prevSub?.backup?.months) } : s.backup,
        items: mergedItems,
      };
    });
    return {
      ...cat,
      months: mergeMonths(cat.months, prevCat?.months),
      subcategories: mergedSubs,
    };
  });
  const isBackup = (c) => String(c.name || '').trim().toLowerCase() === 'backup';
  // Cố định "backup" luôn ở cuối bảng, giữ nguyên thứ tự các nhóm còn lại
  return [...mapped].sort((a, b) => (isBackup(a) ? 1 : 0) - (isBackup(b) ? 1 : 0));
}

export default function CategoryBudgetEntry({ onSaved, onDirtyChange, refreshKey }) {
  const { locale } = useDashboard();
  const addToast = useToast();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [mode, setMode] = useState('view');
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [cellErrors, setCellErrors] = useState(() => new Map());
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [permissions, setPermissions] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const loadSeqRef = useRef(0);
  const updatedAtRef = useRef(null);

  const canEdit = permissions?.edit !== false;
  const canManage = permissions?.manageCategories !== false;

  const hasDirty = dirtyKeys.size > 0;

  useEffect(() => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setLoadError('');
    setCategories([]);
    setUnassigned([]);
    setCellErrors(new Map());
    getCategoryBudgetTree(year)
      .then(res => {
        if (seq !== loadSeqRef.current) return;
        const allCats = res.data?.categories || [];
        const cats = allCats.filter(c => !c.unassigned && c.id);
        setUnassigned(allCats.filter(c => c.unassigned));
        if (cats.length === 0 && canManage) {
          const defaults = [
            { name: 'I.BRAND MARKETING', percent: 0, sortOrder: 1 },
            { name: 'II. DIGITAL Marketing', percent: 0, sortOrder: 2 },
            { name: 'gdfh', percent: 0, sortOrder: 3 },
            { name: 'backup', percent: 0, sortOrder: 4 },
            { name: 'Vật phẩm', percent: 0, sortOrder: 5 },
            { name: 'Hạng mục khác', percent: 0, sortOrder: 6 },
          ];
          return Promise.all(defaults.map(d => createCategoryBudgetCategory({ ...d, year })))
            .then(() => getCategoryBudgetTree(year))
            .then(res2 => {
              if (seq !== loadSeqRef.current) return;
              setCategories(prev => mapTreeToState(res2.data, prev));
              if (res2.permissions) setPermissions(res2.permissions);
              if (res2.updatedAt) updatedAtRef.current = res2.updatedAt;
            });
        }
        setCategories(prev => mapTreeToState(res.data, prev));
        if (res.permissions) setPermissions(res.permissions);
        if (res.updatedAt) updatedAtRef.current = res.updatedAt;
      })
      .catch(err => {
        if (seq !== loadSeqRef.current) return;
        setCategories([]);
        setLoadError(apiErrorMsg(err, t('Không tải được dữ liệu ngân sách', 'Could not load budget data')));
      })
      .finally(() => {
        if (seq === loadSeqRef.current) setLoading(false);
      });
  }, [year, reloadTick, refreshKey, canManage]);

  useEffect(() => {
    if (onDirtyChange) onDirtyChange(hasDirty);
  }, [hasDirty, onDirtyChange]);

  useEffect(() => {
    const handler = (e) => {
      if (!hasDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirty]);

  const grandTotal = useMemo(() => {
    return categories.reduce((sum, cat) => sum + MONTHS.reduce((s, m) => s + categoryMonthValue(cat, m), 0), 0);
  }, [categories]);
  const grandActual = useMemo(() => [...categories, ...unassigned]
    .reduce((sum, cat) => sum + MONTHS.reduce((s, m) => s + actualOf(cat, m), 0), 0), [categories, unassigned]);

  const refreshTree = async () => {
    try {
      const res = await getCategoryBudgetTree(year);
      setCategories(prev => mapTreeToState(res.data, prev));
      setUnassigned((res.data?.categories || []).filter(c => c.unassigned));
      if (res.permissions) setPermissions(res.permissions);
      if (res.updatedAt) updatedAtRef.current = res.updatedAt;
    } catch (err) {
      console.error('[CategoryBudgetEntry] refresh error:', err);
    }
  };

  const confirmLeave = () => window.confirm(
    t('Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?', 'You have unsaved changes. Discard changes and continue?')
  );

  const changeYear = (next) => {
    const n = Number(next);
    if (n !== year && hasDirty && !confirmLeave()) return;
    setDirtyKeys(new Set());
    setCellErrors(new Map());
    setMode('view');
    setYear(n);
  };

  const enterEdit = () => {
    if (loading) return;
    if (!canEdit) {
      addToast(t('Bạn không có quyền sửa ngân sách', 'You do not have permission to edit the budget'), 'error');
      return;
    }
    setDirtyKeys(new Set());
    setCellErrors(new Map());
    setMode('edit');
  };

  const cancelEdit = async () => {
    setDirtyKeys(new Set());
    setCellErrors(new Map());
    setMode('view');
    try {
      const res = await getCategoryBudgetTree(year);
      setCategories(mapTreeToState(res.data, []));
      if (res.permissions) setPermissions(res.permissions);
      if (res.updatedAt) updatedAtRef.current = res.updatedAt;
    } catch { /* giữ nguyên dữ liệu hiện tại nếu tải lại lỗi */ }
  };

  const updateSubBackupMonth = (subId, month, value) => {
    const clean = sanitizeDigits(value);
    setCategories(prev => prev.map(cat => ({
      ...cat,
      subcategories: (Array.isArray(cat.subcategories) ? cat.subcategories : []).map(s => (
        s.id === subId ? { ...s, backup: { ...(s.backup || {}), months: { ...(s.backup?.months || {}), [month]: clean } } } : s
      )),
    })));
    const key = `${subId}:backup:${month}`;
    setDirtyKeys(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setCellErrors(prev => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const updateItemMonth = (itemId, month, value) => {
    const clean = sanitizeDigits(value);
    setCategories(prev => prev.map(cat => ({
      ...cat,
      subcategories: (Array.isArray(cat.subcategories) ? cat.subcategories : []).map(s => ({
        ...s,
        items: (Array.isArray(s.items) ? s.items : []).map(it => (
          it.id === itemId ? { ...it, months: { ...(it.months || {}), [month]: clean } } : it
        )),
      })),
    })));
    const key = `${itemId}:plan:${month}`;
    setDirtyKeys(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setCellErrors(prev => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const createSub = async (catId, sortOrder, name) => {
    try {
      await createCategoryBudgetSubcategory({ categoryId: catId, name, backupPercent: 0, sortOrder });
      addToast(t('Đã thêm nhóm con', 'Subcategory added'));
      await refreshTree();
      if (onSaved) onSaved();
    } catch (err) { addToast(apiErrorMsg(err, t('Lỗi khi thêm nhóm con', 'Error adding subcategory')), 'error'); }
  };

  const createItem = async (subId, sortOrder, name) => {
    try {
      await createCategoryBudgetItem({ subcategoryId: subId, name, sortOrder });
      addToast(t('Đã thêm hạng mục con', 'Item added'));
      await refreshTree();
      if (onSaved) onSaved();
    } catch (err) { addToast(apiErrorMsg(err, t('Lỗi khi thêm hạng mục con', 'Error adding item')), 'error'); }
  };

  const buildAffectedValues = () => {
    const itemIds = new Set();
    const subIds = new Set();
    for (const key of dirtyKeys) {
      const atPlan = key.lastIndexOf(':plan:');
      const atBackup = key.lastIndexOf(':backup:');
      if (atPlan !== -1) itemIds.add(key.slice(0, atPlan));
      else if (atBackup !== -1) subIds.add(key.slice(0, atBackup));
    }
    const values = [];
    const affectedCatIds = new Set();
    for (const cat of categories) {
      for (const sub of (Array.isArray(cat.subcategories) ? cat.subcategories : [])) {
        const subTouched = subIds.has(sub.id);
        const itemTouched = (Array.isArray(sub.items) ? sub.items : []).some(it => itemIds.has(it.id));
        if (subTouched || itemTouched) affectedCatIds.add(cat.id);
        if (subTouched) {
          for (const m of MONTHS) {
            values.push({ itemId: null, subcategoryId: sub.id, isBackup: true, month: m, amount: monthValue(sub.backup?.months, m) });
          }
        }
        for (const it of (Array.isArray(sub.items) ? sub.items : [])) {
          if (itemIds.has(it.id)) {
            for (const m of MONTHS) {
              values.push({ itemId: it.id, isBackup: false, month: m, amount: monthValue(it.months, m) });
            }
          }
        }
      }
    }
    for (const cat of categories) {
      if (affectedCatIds.has(cat.id)) {
        for (const m of MONTHS) {
          values.push({ categoryId: cat.id, month: m, amount: categoryMonthValue(cat, m) });
        }
      }
    }
    return values;
  };

  const handleSave = async () => {
    if (!hasDirty || saving) return;
    setSaving(true);
    try {
      // Chỉ gửi các dòng bị sửa (+ rollup nhóm cha) rồi chia lô ≤ 80 dòng:
      // BE hiện trả 500 khi một request chứa ~>120 dòng values (giới hạn bulk insert).
      const values = buildAffectedValues();
      if (!values.length) {
        addToast(t('Không có thay đổi để lưu', 'No changes to save'));
        setDirtyKeys(new Set());
        setCellErrors(new Map());
        setMode('view');
        await refreshTree();
        if (onSaved) onSaved();
        return;
      }
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        // Lấy baseUpdatedAt mới từng lô để tránh 412 do lô trước đã làm đổi updatedAt.
        const fresh = await getCategoryBudgetTree(year);
        await saveCategoryBudgetValues(year, chunk, {
          baseUpdatedAt: fresh.updatedAt || undefined,
        });
      }
      addToast(t('Đã lưu chi phí tổng hạng mục', 'Category budget saved'));
      setDirtyKeys(new Set());
      setCellErrors(new Map());
      setMode('view');
      await refreshTree();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[CategoryBudgetEntry] save error:', err);
      const status = err?.response?.status;
      if (status === 412) {
        addToast(apiErrorMsg(err, t('Dữ liệu đã được cập nhật bằng người khác. Vui lòng tải lại.', 'Data was updated by someone else. Please reload.')), 'error');
        setDirtyKeys(new Set());
        setCellErrors(new Map());
        setMode('view');
        await refreshTree();
      } else if (status === 400 && Array.isArray(err?.response?.data?.errors)) {
        const errMap = new Map();
        for (const e of err.response.data.errors) {
          if (!e || typeof e.month === 'undefined') continue;
          let key = null;
          if (e.categoryId) key = `${e.categoryId}:plan:${e.month}`;
          else if (e.itemId) key = `${e.itemId}:plan:${e.month}`;
          else if (e.subcategoryId) key = `${e.subcategoryId}:backup:${e.month}`;
          if (key) errMap.set(key, e.message || '');
        }
        setCellErrors(errMap);
        addToast(err.response.data.message || t('Một số ô không hợp lệ. Vui lòng kiểm tra lại.', 'Some cells are invalid. Please review.'), 'error');
      } else {
        addToast(apiErrorMsg(err, t('Lỗi khi lưu', 'Error saving')), 'error');
        // Lỗi server giữa chừng (vd 500 khi chia lô): một phần dữ liệu có thể đã lưu
        // thành công → tải lại cây để UI khớp, giữ dirtyKeys để người dùng lưu lại phần còn lại.
        await refreshTree();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    addToast(t('Chức năng xuất Excel đang phát triển', 'Excel export is under development'));
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    if (!type || !id) {
      setConfirmDelete(null);
      return;
    }
    try {
      if (type === 'subcategory') {
        await deleteCategoryBudgetSubcategory(id);
      } else if (type === 'item') {
        await deleteCategoryBudgetItem(id);
      } else {
        await deleteCategoryBudgetCategory(id);
      }
      addToast(t('Đã xóa', 'Deleted'));
      await refreshTree();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[CategoryBudgetEntry] delete error:', err);
      addToast(t('Lỗi khi xóa', 'Error deleting'), 'error');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Title & Control Filter Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('Bảng tổng cập nhật tổng chi phí các hạng mục theo tháng và năm', 'Total category budget update table by month and year')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('Quản lý và phân bổ ngân sách cho các chiến dịch marketing tổng thể.', 'Manage and allocate budget for overall marketing campaigns.')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            disabled={permissions?.export === false}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm text-slate-600">download</span>
            <span>{t('Xuất Excel', 'Export Excel')}</span>
          </button>
          {mode === 'view' ? (
            <button
              onClick={enterEdit}
              disabled={loading || canEdit === false}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              <span>{t('Chỉnh sửa ngân sách', 'Edit budget')}</span>
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>{t('Hủy và xem', 'Discard & view')}</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasDirty || saving}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
            <span>{saving ? t('Đang lưu...', 'Saving...') : t('Lưu thay đổi', 'Save changes')}</span>
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2">
          <label className="text-slate-600">{t('Kỳ (Năm):', 'Period (Year):')}</label>
          <select
            value={year}
            onChange={(e) => changeYear(e.target.value)}
            className="text-xs border-slate-300 rounded px-2.5 py-1 focus:ring-1 focus:ring-navy-900 focus:border-navy-900 bg-white"
          >
            {YEAR_RANGE.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {loadError ? (
          <div className="bg-white border border-red-200 rounded-lg p-10 text-center space-y-4">
            <span className="material-symbols-outlined text-[48px] text-red-500 block mx-auto">error</span>
            <p className="text-sm font-semibold text-slate-900">{t('Không tải được dữ liệu ngân sách', 'Could not load budget data')}</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{loadError}</p>
            <button
              onClick={() => setReloadTick(tick => tick + 1)}
              className="px-4 py-2 bg-navy-900 text-white rounded text-xs font-semibold hover:bg-navy-800 transition-colors inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {t('Thử lại', 'Retry')}
            </button>
          </div>
        ) : loading ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="overflow-x-auto p-0">
              <table className="w-full text-left border-collapse min-w-[2200px]">
                <tbody>
                  {[1, 2, 3, 4].map(r => (
                    <tr key={r} className="border-b border-slate-200">
                      <td className="py-3 px-3"><div className="h-3 w-56 bg-slate-200 animate-pulse rounded" /></td>
                      <td><div className="h-3 w-8 bg-slate-200 animate-pulse rounded" /></td>
                      <td><div className="h-3 w-8 bg-slate-200 animate-pulse rounded" /></td>
                      {Array.from({ length: 26 }, (_, c) => (
                        <td key={c} className="px-2"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : categories.length === 0 && mode === 'view' ? (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500 text-xs">
            {t('Chưa có dữ liệu ngân sách hạng mục. Chọn "Chỉnh sửa ngân sách" để bắt đầu nhập.', 'No category budget data yet. Click "Edit budget" to start entering data.')}
          </div>
        ) : (
          <div className="overflow-x-auto budget-table-scroll custom-scrollbar-budget">
            <table className="w-full text-xs border-collapse border-spacing-0 budget-table">
              <thead>
                {/* Level 1: Main Column Groups */}
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 select-none">
                  <th rowSpan={2} className="budget-col-sticky bg-slate-100 p-2.5 text-left w-[280px] min-w-[280px] border-r border-slate-300 z-20">
                    {t('Hạng mục', 'Category')}
                  </th>
                  <th rowSpan={2} className="budget-col-sticky-2 bg-slate-100 p-2.5 text-center w-[80px] min-w-[80px] border-r border-slate-300 z-20">
                    {t('Tỷ lệ', 'Ratio')}
                  </th>
                  <th rowSpan={2} className="budget-col-sticky-3 bg-slate-100 p-2.5 text-center w-[80px] min-w-[80px] border-r border-slate-300 sticky-border-right z-20">
                    {t('Thao tác', 'Actions')}
                  </th>
                  {MONTHS.map(m => (
                    <th key={m} colSpan={2} className="p-2 text-center border-r border-slate-300 bg-slate-50 tracking-wider">
                      {t(`THÁNG ${m}`, `MONTH ${m}`)}
                    </th>
                  ))}
                  <th colSpan={2} className="p-2 text-center bg-amber-600 text-white font-bold tracking-wider">
                    {t(`Total Y${year}`, `Total Y${year}`)}
                  </th>
                </tr>
                {/* Level 2: Kế hoạch | Thực tế (thực tế trước VAT, BE tổng hợp từ chi phí dự án + batch kho ghi vào nhóm) */}
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-300 select-none">
                  {MONTHS.map(m => (
                    <React.Fragment key={m}>
                      <th className="py-1 px-1.5 text-center w-[84px] min-w-[84px] border-r border-slate-200 bg-blue-50/50 text-blue-900 font-medium">
                        {t('Kế hoạch', 'Plan')}
                      </th>
                      <th className="py-1 px-1.5 text-center w-[84px] min-w-[84px] border-r border-slate-300 bg-emerald-50/60 text-emerald-800 font-medium" title={t('Chi phí thực tế trước VAT', 'Actual cost before VAT')}>
                        {t('Thực tế', 'Actual')}
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="py-1 px-1.5 text-center w-[90px] min-w-[90px] bg-amber-500 text-white font-bold">
                    {t('Tổng KH', 'Total Plan')}
                  </th>
                  <th className="py-1 px-1.5 text-center w-[90px] min-w-[90px] bg-emerald-600 text-white font-bold">
                    {t('Tổng TT', 'Total Actual')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* MASTER SUMMARY ROW: Budget Marketing */}
                {(() => {
                  const ratio = categories.reduce((s, c) => s + (Number(c.percent) || 0), 0);
                  return (
                    <tr className="bg-amber-50/40 font-bold border-b border-slate-300 text-slate-800 hover:bg-amber-50 transition-colors">
                      <td className="budget-col-sticky bg-amber-50 p-2.5 text-red-600 font-bold tracking-tight border-r border-slate-200 z-10">
                        {t('Budget Marketing', 'Budget Marketing')}
                      </td>
                      <td className="budget-col-sticky-2 bg-amber-50 p-2.5 text-center text-red-600 font-bold border-r border-slate-200 z-10">
                        {formatPercent(ratio)}%
                      </td>
                      <td className="budget-col-sticky-3 bg-amber-50 p-2.5 text-center border-r border-slate-200 sticky-border-right z-10 text-slate-400">
                        —
                      </td>
                      {MONTHS.map(m => {
                        const plan = categories.reduce((s, cat) => s + categoryMonthValue(cat, m), 0);
                        const actual = [...categories, ...unassigned].reduce((s, cat) => s + actualOf(cat, m), 0);
                        return (
                          <React.Fragment key={m}>
                            <td className="p-1.5 text-right font-medium border-r border-slate-200 text-blue-900">
                              {formatCurrency(plan)}
                            </td>
                            <ActualCell value={actual} over={actual > plan} className="font-semibold border-r border-slate-300" />
                          </React.Fragment>
                        );
                      })}
                      <td className="p-2 text-right bg-amber-100 text-red-700 font-extrabold">
                        {formatMoney(grandTotal)}
                      </td>
                      <td className={`p-2 text-right bg-emerald-100 font-extrabold ${grandActual > grandTotal ? 'text-red-700' : 'text-emerald-800'}`}>
                        {formatMoney(grandActual)}
                      </td>
                    </tr>
                  );
                })()}

                {categories.map(cat => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    mode={mode}
                    dirtyKeys={dirtyKeys}
                    cellErrors={cellErrors}
                    canManage={canManage}
                    canEdit={canEdit}
                    onEnterEdit={enterEdit}
                    updateSubBackupMonth={updateSubBackupMonth}
                    updateItemMonth={updateItemMonth}
                    onCreateSub={createSub}
                    onCreateItem={createItem}
                    refreshTree={refreshTree}
                    setConfirmDelete={setConfirmDelete}
                    t={t}
                  />
                ))}

                {unassigned.map((u) => (
                  <tr key={`unassigned-${u.name}`} className="bg-slate-50 text-slate-700">
                    <td className="budget-col-sticky bg-slate-100 p-2.5 border-r border-slate-200 z-10">
                      <span className="font-bold tracking-wide uppercase text-[11px]">{u.name}</span>
                      <span className="block text-[10px] font-normal text-slate-500">{t('Chi phí dự án chưa gắn nhóm hạng mục', 'Project cost without category group')}</span>
                    </td>
                    <td className="budget-col-sticky-2 bg-slate-100 p-2 text-center border-r border-slate-200 z-10 text-slate-400">—</td>
                    <td className="budget-col-sticky-3 bg-slate-100 p-2 text-center border-r border-slate-200 sticky-border-right z-10 text-slate-400">—</td>
                    {MONTHS.map(m => (
                      <React.Fragment key={m}>
                        <td className="p-1.5 text-right border-r border-slate-200 text-slate-400">—</td>
                        <ActualCell value={actualOf(u, m)} className="border-r border-slate-300" />
                      </React.Fragment>
                    ))}
                    <td className="p-2 text-right bg-slate-100 text-slate-400">—</td>
                    <td className="p-2 text-right bg-emerald-50 font-bold text-emerald-800">{formatMoney(MONTHS.reduce((s, m) => s + actualOf(u, m), 0))}</td>
                  </tr>
                ))}

                {canManage && (
                <AddRow
                  label={t('+ Thêm nhóm hạng mục', '+ Add category group')}
                  onAdd={async (name) => {
                    try {
                      await createCategoryBudgetCategory({ name, percent: 0, sortOrder: categories.length + 1, year });
                      addToast(t('Đã thêm nhóm mới', 'Category added'));
                      await refreshTree();
                      if (onSaved) onSaved();
                    } catch (err) { addToast(apiErrorMsg(err, t('Lỗi khi thêm hạng mục', 'Error adding category')), 'error'); }
                  }}
                  t={t}
                  colSpan={TABLE_COLS}
                />
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footnote */}
      <p className="text-[11px] text-red-500 italic mt-2">
        {t('* Các mục chi phí có thể thêm bớt, thay đổi', '* Expense items can be added, removed, or modified')}
      </p>

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('Xác nhận xóa', 'Confirm delete')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {t(`Bạn có chắc muốn xóa "${confirmDelete.name}"?`, `Are you sure you want to delete "${confirmDelete.name}"?`)}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50">
                {t('Hủy', 'Cancel')}
              </button>
              <button onClick={executeDelete} className="px-4 py-2 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                {t('Xóa', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ cat, mode, dirtyKeys, cellErrors, canManage, canEdit, onEnterEdit, updateSubBackupMonth, updateItemMonth, onCreateSub, onCreateItem, refreshTree, setConfirmDelete, t }) {
  const addToast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cat.name);
  const [editPercent, setEditPercent] = useState(cat.percent);

  const isProtected = ['Vật phẩm', 'Hạng mục khác', 'backup'].some(
    n => String(cat.name || '').trim().toLowerCase() === n.toLowerCase()
  );

  const saveEdit = async () => {
    try {
      await updateCategoryBudgetCategory(cat.id, { name: editName, percent: Number(editPercent) });
      setEditing(false);
      await refreshTree();
    } catch { addToast(t('Lỗi', 'Error'), 'error'); }
  };

  const subcategories = Array.isArray(cat.subcategories) ? cat.subcategories : [];

  return (
    <React.Fragment>
      <tr className="bg-blue-50 text-blue-900 font-medium transition hover:bg-blue-100">
        <td className="budget-col-sticky bg-blue-100 p-2.5 border-r border-blue-200 z-10">
          {editing ? (
            <input
              className="bg-white/80 text-blue-900 font-bold text-[11px] px-1.5 py-0.5 rounded border border-blue-300 focus:ring-1 focus:ring-blue-500 w-full"
              value={editName}
              onClick={e => e.stopPropagation()}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
            />
          ) : (
            <span className="font-bold tracking-wide uppercase text-[11px]">{cat.name}</span>
          )}
        </td>
        <td className="budget-col-sticky-2 bg-blue-100 p-2 text-center font-semibold border-r border-blue-200 z-10" onClick={e => e.stopPropagation()}>
          {editing ? (
            <input
              type="number"
              className="w-12 text-center text-blue-900 text-[11px] px-1 py-0.5 rounded border border-blue-300 bg-white/80"
              value={editPercent}
              onChange={e => setEditPercent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            />
          ) : `${formatPercent(cat.percent)}%`}
        </td>
        <td className="budget-col-sticky-3 bg-blue-100 p-2 text-center border-r border-blue-200 sticky-border-right z-10" onClick={e => e.stopPropagation()}>
          {canManage && (
          <div className="flex items-center justify-center space-x-2">
            <button
              className="text-blue-700 hover:text-blue-900 transition-colors"
              title={t('Sửa', 'Edit')}
              onClick={() => { setEditing(!editing); setEditName(cat.name); setEditPercent(cat.percent); }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            {!isProtected && (
            <button
              className="text-blue-700 hover:text-red-600 transition-colors"
              title={t('Xóa', 'Delete')}
              onClick={() => setConfirmDelete({ type: 'category', id: cat.id, name: cat.name })}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
            )}
          </div>
          )}
        </td>
        {MONTHS.map(m => {
          const planVal = categoryMonthValue(cat, m);
          const actualVal = actualOf(cat, m);
          return (
            <React.Fragment key={m}>
              <td className="p-1 border-r border-blue-200/70 bg-blue-50/40">
                <span className="block text-right px-1 py-0.5 text-[11px] tabular-nums text-blue-900 font-bold" title={t('Tự động tính tổng từ hạng mục con', 'Auto-summed from sub items')}>
                  {formatCurrency(planVal)}
                </span>
              </td>
              <ActualCell value={actualVal} over={actualVal > planVal} className="font-bold border-r border-blue-200" />
            </React.Fragment>
          );
        })}
        <td className="p-2 text-right bg-blue-100 font-bold">
          {formatMoney(MONTHS.reduce((s, m) => s + categoryMonthValue(cat, m), 0))}
        </td>
        <ActualTotalCell row={cat} plan={MONTHS.reduce((s, m) => s + categoryMonthValue(cat, m), 0)} className="bg-emerald-100 font-bold" />
      </tr>

      {subcategories.map(sub => {
        const isBackupVisible = Number(sub.backup?.percent) > 0;
        const subTotalByMonth = MONTHS.map(m =>
          (isBackupVisible ? monthValue(sub.backup?.months, m) : 0) + (sub.items || []).reduce((s, it) => s + monthValue(it.months, m), 0)
        );
        return (
          <SubcategoryBlock
            key={sub.id}
            sub={sub}
            catId={cat.id}
            mode={mode}
            dirtyKeys={dirtyKeys}
            cellErrors={cellErrors}
            canManage={canManage}
            canEdit={canEdit}
            onEnterEdit={onEnterEdit}
            subTotalByMonth={subTotalByMonth}
            updateSubBackupMonth={updateSubBackupMonth}
            updateItemMonth={updateItemMonth}
            onCreateItem={onCreateItem}
            refreshTree={refreshTree}
            setConfirmDelete={setConfirmDelete}
            t={t}
          />
        );
      })}

      {canManage && (
        <AddRow
          label={t('+ Thêm nhóm con', '+ Add subcategory')}
          onAdd={async (name) => await onCreateSub(cat.id, subcategories.length + 1, name)}
          t={t}
          colSpan={TABLE_COLS}
        />
      )}
    </React.Fragment>
  );
}

function SubcategoryBlock({ sub, catId, mode, dirtyKeys, cellErrors, canManage, canEdit, onEnterEdit, subTotalByMonth, updateSubBackupMonth, updateItemMonth, onCreateItem, refreshTree, setConfirmDelete, t }) {
  const addToast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sub.name);
  const items = Array.isArray(sub.items) ? sub.items : [];
  const backupPercent = Number(sub.backup?.percent) || 0;

  const saveEdit = async () => {
    try {
      await updateCategoryBudgetSubcategory(sub.id, { name: editName });
      setEditing(false);
      await refreshTree();
    } catch { addToast(t('Lỗi', 'Error'), 'error'); }
  };

  return (
    <React.Fragment>
      <tr className="bg-violet-50 text-violet-900 transition hover:bg-violet-100">
        <td className="budget-col-sticky bg-violet-100 p-2 pl-6 border-r border-violet-200 z-10">
          {editing ? (
            <input
              className="bg-white/80 text-violet-900 font-bold text-[11px] px-1.5 py-0.5 rounded border border-violet-300 focus:ring-1 focus:ring-violet-500 w-full"
              value={editName}
              onClick={e => e.stopPropagation()}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
            />
          ) : (
            <span className="inline-flex items-center font-bold tracking-wide text-[11px]">
              <span className="text-violet-400 mr-1.5">└</span>{sub.name}
            </span>
          )}
        </td>
        <td className="budget-col-sticky-2 bg-violet-100 p-2 text-center text-[11px] font-semibold border-r border-violet-200 z-10">
          {t('TỔNG', 'TOTAL')}
        </td>
        <td className="budget-col-sticky-3 bg-violet-100 p-2 text-center border-r border-violet-200 sticky-border-right z-10">
          {canManage && (
          <div className="flex items-center justify-center space-x-2">
            <button
              className="text-violet-700 hover:text-violet-900 transition-colors"
              title={t('Sửa', 'Edit')}
              onClick={() => { setEditing(!editing); setEditName(sub.name); }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            <button
              className="text-violet-700 hover:text-red-600 transition-colors"
              title={t('Xóa', 'Delete')}
              onClick={() => setConfirmDelete({ type: 'subcategory', id: sub.id, name: sub.name })}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
          )}
        </td>
        {subTotalByMonth.map((val, idx) => (
          <React.Fragment key={idx}>
            <td className="p-1 border-r border-violet-200/70 bg-violet-50/40">
              <span className="block text-right px-1 py-0.5 text-[11px] tabular-nums text-violet-900 font-bold">
                {formatCurrency(val)}
              </span>
            </td>
            <ActualCell value={hasActuals(sub) ? actualOf(sub, idx + 1) : null} over={actualOf(sub, idx + 1) > val} className="font-bold border-r border-violet-200" t={t} />
          </React.Fragment>
        ))}
        <td className="p-2 text-right bg-violet-100 font-extrabold text-violet-900">
          {formatMoney(subTotalByMonth.reduce((s, v) => s + v, 0))}
        </td>
        <ActualTotalCell row={sub} plan={subTotalByMonth.reduce((s, v) => s + v, 0)} className="bg-emerald-50 font-extrabold" t={t} />
      </tr>

      {backupPercent > 0 && (
      <tr className="bg-amber-50 text-amber-900 transition hover:bg-amber-100">
        <td className="budget-col-sticky bg-amber-100 p-2 pl-10 border-r border-amber-200 z-10">
          <span className="inline-flex items-center text-[11px] font-semibold text-amber-800">
            <span className="material-symbols-outlined text-[14px] mr-1">shield_with_heart</span>
            {t('BACK UP', 'BACKUP')} ({formatPercent(backupPercent)}%)
          </span>
        </td>
        <td className="budget-col-sticky-2 bg-amber-100 p-2 text-center text-[11px] border-r border-amber-200 z-10 text-amber-700">
          {formatPercent(backupPercent)}%
        </td>
        <td className="budget-col-sticky-3 bg-amber-100 p-2 text-center border-r border-amber-200 sticky-border-right z-10">
          <span className="text-slate-300 text-sm">—</span>
        </td>
        {MONTHS.map(m => {
          const isDirty = dirtyKeys.has(`${sub.id}:backup:${m}`);
          const errMsg = cellErrors.get(`${sub.id}:backup:${m}`);
          const planVal = sub.backup?.months?.[m];
          return (
            <React.Fragment key={m}>
            <td
              className={`p-1 border-r border-amber-200/70 ${errMsg ? 'bg-red-100 text-red-600' : isDirty ? 'bg-amber-200/70' : ''}`}
              onClick={() => { if (mode === 'view' && canEdit) onEnterEdit?.(); }}
            >
              {mode === 'edit' ? (
                <NumberInput
                  aria-label={`BACK UP - ${t('Tháng', 'Month')} ${m}`}
                  className="w-full bg-white/80 text-amber-900 font-medium text-right text-[11px] px-1.5 py-0.5 rounded border border-amber-200 focus:ring-1 focus:ring-amber-500"
                  value={planVal || planVal === 0 ? planVal : ''}
                  onChange={(e) => updateSubBackupMonth(sub.id, m, e.target.value)}
                />
              ) : (
                <span className="block text-right px-1 py-0.5 text-[11px] tabular-nums text-amber-900 font-medium cursor-pointer">
                  {formatCurrency(monthValue(sub.backup?.months, m))}
                </span>
              )}
            </td>
            <td className="p-1 border-r border-amber-200 text-right text-[11px] text-slate-400">—</td>
            </React.Fragment>
          );
        })}
        <td className="p-2 text-right bg-amber-100 font-bold text-amber-900">
          {formatMoney(calcRowTotal(sub.backup?.months))}
        </td>
        <td className="p-2 text-right bg-amber-50 text-slate-400">—</td>
      </tr>
      )}

      {items.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          subId={sub.id}
          mode={mode}
          dirtyKeys={dirtyKeys}
          cellErrors={cellErrors}
          canManage={canManage}
          canEdit={canEdit}
          onEnterEdit={onEnterEdit}
          updateItemMonth={updateItemMonth}
          refreshTree={refreshTree}
          setConfirmDelete={setConfirmDelete}
          t={t}
        />
      ))}

      {canManage && (
        <AddRow
          label={t('+ Thêm hạng mục nhỏ', '+ Add sub item')}
          onAdd={async (name) => await onCreateItem(sub.id, items.length + 1, name)}
          t={t}
          colSpan={TABLE_COLS}
        />
      )}
    </React.Fragment>
  );
}

function ItemRow({ item, subId, mode, dirtyKeys, cellErrors, canManage, canEdit, onEnterEdit, updateItemMonth, refreshTree, setConfirmDelete, t }) {
  const addToast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  const saveEdit = async () => {
    try {
      await updateCategoryBudgetItem(item.id, { name: editName });
      setEditing(false);
      await refreshTree();
    } catch { addToast(t('Lỗi', 'Error'), 'error'); }
  };

  return (
    <tr className="bg-white text-slate-700 transition hover:bg-violet-50">
      <td className="budget-col-sticky bg-white p-2 pl-10 border-r border-slate-200 z-10">
        {editing ? (
          <input
            className="bg-white text-slate-800 text-[11px] px-1.5 py-0.5 rounded border border-slate-300 focus:ring-1 focus:ring-violet-500 w-full"
            value={editName}
            onClick={e => e.stopPropagation()}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        ) : (
          <span className="inline-flex items-center text-[11px] font-medium text-slate-700">
            <span className="text-slate-400 mr-1.5">•</span>{item.name}
          </span>
        )}
      </td>
      <td className="budget-col-sticky-2 bg-white p-2 text-center text-[11px] border-r border-slate-200 z-10 text-slate-300">—</td>
      <td className="budget-col-sticky-3 bg-white p-2 text-center border-r border-slate-200 sticky-border-right z-10">
        {canManage && (
        <div className="flex items-center justify-center space-x-2">
          <button
            className="text-slate-400 hover:text-violet-700 transition-colors"
            title={t('Sửa', 'Edit')}
            onClick={() => { setEditing(!editing); setEditName(item.name); }}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            className="text-slate-400 hover:text-red-600 transition-colors"
            title={t('Xóa', 'Delete')}
            onClick={() => setConfirmDelete({ type: 'item', id: item.id, name: item.name })}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
        )}
      </td>
      {MONTHS.map(m => {
        const isDirty = dirtyKeys.has(`${item.id}:plan:${m}`);
        const errMsg = cellErrors.get(`${item.id}:plan:${m}`);
        const planVal = item.months?.[m];
        return (
          <React.Fragment key={m}>
          <td
            className={`p-1 border-r border-slate-200 ${errMsg ? 'bg-red-100 text-red-600' : isDirty ? 'bg-violet-100' : ''}`}
            onClick={() => { if (mode === 'view' && canEdit) onEnterEdit?.(); }}
          >
            {mode === 'edit' ? (
              <NumberInput
                aria-label={`${item.name} - ${t('Kế hoạch', 'Plan')} - ${t('Tháng', 'Month')} ${m}`}
                className="w-full bg-white text-slate-800 font-medium text-right text-[11px] px-1.5 py-0.5 rounded border border-slate-200 focus:ring-1 focus:ring-violet-500"
                value={planVal || planVal === 0 ? planVal : ''}
                onChange={(e) => updateItemMonth(item.id, m, e.target.value)}
              />
            ) : (
              <span className="block text-right px-1 py-0.5 text-[11px] tabular-nums text-slate-700 font-medium cursor-pointer">
                {formatCurrency(monthValue(item.months, m))}
              </span>
            )}
          </td>
          <ActualCell value={hasActuals(item) ? actualOf(item, m) : null} over={actualOf(item, m) > monthValue(item.months, m)} className="border-r border-slate-300" t={t} />
          </React.Fragment>
        );
      })}
      <td className="p-2 text-right bg-slate-50 font-semibold">
        {formatMoney(calcRowTotal(item.months))}
      </td>
      <ActualTotalCell row={item} plan={calcRowTotal(item.months)} className="bg-emerald-50/60 font-semibold" t={t} />
    </tr>
  );
}

// Ô thực tế (chỉ đọc). value = null → chưa có chi phí gắn thẳng vào dòng này (thực tế tính ở cấp nhóm).
function ActualCell({ value, over, className = '', t }) {
  if (value == null) {
    return (
      <td
        className={`p-1 text-right text-[11px] text-slate-300 bg-emerald-50/20 ${className}`}
        title={t ? t('Chi phí thực tế đang được ghi nhận ở cấp nhóm hạng mục', 'Actual cost is recorded at the category group level') : undefined}
      >
        —
      </td>
    );
  }
  return (
    <td className={`p-1 text-right text-[11px] tabular-nums bg-emerald-50/40 ${over ? 'text-red-600' : 'text-emerald-800'} ${className}`}>
      {formatCurrency(value)}
    </td>
  );
}

function ActualTotalCell({ row, plan, className = '', t }) {
  const total = MONTHS.reduce((s, m) => s + actualOf(row, m), 0);
  if (!hasActuals(row) && t) {
    return <td className={`p-2 text-right text-slate-300 ${className}`}>—</td>;
  }
  return <td className={`p-2 text-right ${total > plan ? 'text-red-700' : 'text-emerald-800'} ${className}`}>{formatMoney(total)}</td>;
}

function AddRow({ label, onAdd, t, colSpan }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      setName('');
      setAdding(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <tr className="bg-white hover:bg-slate-50 transition cursor-pointer text-navy-900 font-medium">
      <td colSpan={colSpan} className="p-2.5 pl-6 border-b border-slate-200">
        {adding ? (
          <form className="flex items-center gap-2" onSubmit={submit}>
            <input
              className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setName(''); } }}
              placeholder={t('Nhập tên...', 'Enter name...')}
              autoFocus
              disabled={submitting}
            />
            <button type="submit" disabled={submitting} className="text-blue-700 hover:text-blue-900 transition-colors disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">{submitting ? 'hourglass_top' : 'check'}</span>
            </button>
            <button type="button" onClick={() => { setAdding(false); setName(''); }} disabled={submitting} className="text-slate-500 hover:text-slate-700 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center space-x-2 text-blue-700 hover:text-blue-900 font-semibold focus:outline-none text-xs"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>{label}</span>
          </button>
        )}
      </td>
    </tr>
  );
}