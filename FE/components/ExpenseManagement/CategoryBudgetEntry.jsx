import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';
import {
  getCategoryBudgetTree,
  saveCategoryBudgetValues,
  createCategoryBudgetCategory,
  updateCategoryBudgetCategory,
  deleteCategoryBudgetCategory,
  getProjects,
} from '../../services/api';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

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

function apiErrorMsg(err, fallback) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m) && m.length) return m.join('; ');
  if (typeof m === 'string' && m) return m;
  return fallback;
}

function calcRowTotal(rowMonths) {
  return MONTHS.reduce((sum, m) => sum + monthValue(rowMonths, m), 0);
}

function mergeMonths(serverMonths, localMonths) {
  return serverMonths && Object.keys(serverMonths).length > 0 ? serverMonths : (localMonths || {});
}

function mapTreeToState(tree, prev) {
  if (!tree) return [];
  const mapped = (tree.categories || []).map(cat => {
    const prevCat = (prev || []).find(c => c.id === cat.id);
    return {
      ...cat,
      months: mergeMonths(cat.months, prevCat?.months),
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
  const [saveProjectId, setSaveProjectId] = useState('');
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
    setCellErrors(new Map());
    getCategoryBudgetTree(year)
      .then(res => {
        if (seq !== loadSeqRef.current) return;
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
  }, [year, reloadTick, refreshKey]);
  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        if (list.length > 0) setSaveProjectId(list[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    return categories.reduce((sum, cat) => sum + calcRowTotal(cat.months), 0);
  }, [categories]);

  const refreshTree = async () => {
    try {
      const res = await getCategoryBudgetTree(year);
      setCategories(prev => mapTreeToState(res.data, prev));
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

  const updateCategoryMonth = (catId, month, value) => {
    const clean = sanitizeDigits(value);
    setCategories(prev => prev.map(cat =>
      cat.id === catId ? { ...cat, months: { ...(cat.months || {}), [month]: clean } } : cat
    ));
    const key = `${catId}:plan:${month}`;
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

  const collectValues = () => {
    const values = [];
    for (const cat of categories) {
      for (const m of MONTHS) {
        const amount = Number(cat.months?.[m]) || 0;
        if (amount !== 0) values.push({ categoryId: cat.id, month: m, amount });
      }
    }
    return values;
  };

  const handleSave = async () => {
    if (!hasDirty || saving) return;
    setSaving(true);
    try {
      await saveCategoryBudgetValues(year, collectValues(), {
        projectId: saveProjectId || undefined,
        baseUpdatedAt: updatedAtRef.current || undefined,
      });
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
          const catId = e.categoryId;
          errMap.set(`${catId || ''}:plan:${e.month}`, e.message || '');
        }
        setCellErrors(errMap);
        addToast(err.response.data.message || t('Một số ô không hợp lệ. Vui lòng kiểm tra lại.', 'Some cells are invalid. Please review.'), 'error');
      } else {
        addToast(apiErrorMsg(err, t('Lỗi khi lưu', 'Error saving')), 'error');
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
    if (type !== 'category') {
      setConfirmDelete(null);
      return;
    }
    try {
      await deleteCategoryBudgetCategory(id);
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
                      {Array.from({ length: 13 }, () => (
                        <td key={r} className="px-2"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded" /></td>
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
                    <th key={m} colSpan={1} className="p-2 text-center border-r border-slate-300 bg-slate-50 tracking-wider">
                      {t(`THÁNG ${m}`, `MONTH ${m}`)}
                    </th>
                  ))}
                  <th colSpan={1} className="p-2 text-center bg-amber-600 text-white font-bold tracking-wider">
                    {t(`Total Y${year}`, `Total Y${year}`)}
                  </th>
                </tr>
                {/* Level 2: Kế hoạch */}
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-300 select-none">
                  {MONTHS.map(m => (
                    <th key={m} className="py-1 px-1.5 text-center w-[84px] min-w-[84px] border-r border-slate-200 bg-blue-50/50 text-blue-900 font-medium">
                      {t('Kế hoạch', 'Plan')}
                    </th>
                  ))}
                  <th className="py-1 px-1.5 text-center w-[90px] min-w-[90px] bg-amber-500 text-white font-bold">
                    {t('Tổng KH', 'Total Plan')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* MASTER SUMMARY ROW: Budget Marketing */}
                {(() => {
                  const ratio = categories.reduce((s, c) => s + (Number(c.percent) || 0), 0);
                  return (
                    <tr className="bg-amber-50/40 font-bold border-b border-slate-300 text-slate-800 hover:bg-amber-50 transition-colors">
                      <td className="budget-col-sticky bg-amber-50/80 p-2.5 text-red-600 font-bold tracking-tight border-r border-slate-200 z-10">
                        {t('Budget Marketing', 'Budget Marketing')}
                      </td>
                      <td className="budget-col-sticky-2 bg-amber-50/80 p-2.5 text-center text-red-600 font-bold border-r border-slate-200 z-10">
                        {formatPercent(ratio)}%
                      </td>
                      <td className="budget-col-sticky-3 bg-amber-50/80 p-2.5 text-center border-r border-slate-200 sticky-border-right z-10 text-slate-400">
                        —
                      </td>
                      {MONTHS.map(m => {
                        const plan = categories.reduce((s, cat) => s + monthValue(cat.months, m), 0);
                        return (
                          <td key={m} className="p-1.5 text-right font-medium border-r border-slate-200 text-blue-900">
                            {plan > 0 ? formatCurrency(plan) : formatCurrency(0)}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right bg-amber-100 text-red-700 font-extrabold">
                        {formatMoney(grandTotal)}
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
                    updateCategoryMonth={updateCategoryMonth}
                    refreshTree={refreshTree}
                    setConfirmDelete={setConfirmDelete}
                    t={t}
                  />
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
                  colSpan={16}
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

function CategoryRow({ cat, mode, dirtyKeys, cellErrors, canManage, canEdit, onEnterEdit, updateCategoryMonth, refreshTree, setConfirmDelete, t }) {
  const addToast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cat.name);
  const [editPercent, setEditPercent] = useState(cat.percent);

  const saveEdit = async () => {
    try {
      await updateCategoryBudgetCategory(cat.id, { name: editName, percent: Number(editPercent) });
      setEditing(false);
      await refreshTree();
    } catch { addToast(t('Lỗi', 'Error'), 'error'); }
  };

  return (
    <tr className="bg-blue-50 text-blue-900 font-medium transition hover:bg-blue-100">
      <td className="budget-col-sticky bg-blue-100 p-2.5 flex items-center space-x-2 border-r border-blue-200 z-10">
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
          <button
            className="text-blue-700 hover:text-red-600 transition-colors"
            title={t('Xóa', 'Delete')}
            onClick={() => setConfirmDelete({ type: 'category', id: cat.id, name: cat.name })}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
        )}
      </td>
      {MONTHS.map(m => {
        const isDirty = dirtyKeys.has(`${cat.id}:plan:${m}`);
        const errMsg = cellErrors.get(`${cat.id}:plan:${m}`);
        const planVal = cat.months?.[m];
        return (
          <td
            key={m}
            className={`p-1 border-r border-blue-200/70 ${errMsg ? 'bg-red-100 text-red-600' : isDirty ? 'bg-blue-200/70' : ''}`}
            onClick={() => { if (mode === 'view' && canEdit) onEnterEdit?.(); }}
          >
            {mode === 'edit' ? (
              <NumberInput
                aria-label={`${cat.name} - ${t('Kế hoạch', 'Plan')} - ${t('Tháng', 'Month')} ${m}`}
                className="w-full bg-white/80 text-blue-900 font-medium text-right text-[11px] px-1.5 py-0.5 rounded border border-blue-200 focus:ring-1 focus:ring-blue-500"
                value={planVal || planVal === 0 ? planVal : ''}
                onChange={(e) => updateCategoryMonth(cat.id, m, e.target.value)}
              />
            ) : (
              <span className="block text-right px-1 py-0.5 text-[11px] tabular-nums text-blue-900 font-medium cursor-pointer">
                {monthValue(cat.months, m) ? formatCurrency(monthValue(cat.months, m)) : formatCurrency(0)}
              </span>
            )}
          </td>
        );
      })}
      <td className="p-2 text-right bg-blue-100 font-bold">
        {formatMoney(calcRowTotal(cat.months))}
      </td>
    </tr>
  );
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