import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getInventoryItems,
  getItemBatches,
  deleteInventoryItem,
  getInventoryTransactions,
  deleteInventoryTransaction,
  getExpenseList,
  deleteExpense,
} from '../../services/api';
import { useInventoryCategories } from '../../hooks/useInventoryCategories';
import { parseExpenseLines } from '../../utils/expenseMeta';
import { getBatchExpenseCategory } from '../../utils/inventoryBudgetCategory';
import BatchHistoryModal from './BatchHistoryModal';
import StockOutModal from './StockOutModal';
import { BatchAttachmentsModal } from './BatchAttachments';

const STATUS_META = {
  instock: { vi: 'Còn hàng', en: 'In stock', icon: 'check_circle', badge: 'bg-success/10 text-success border-success/20' },
  low: { vi: 'Sắp hết', en: 'Low stock', icon: 'warning', badge: 'bg-warning/10 text-warning border-warning/20' },
  out: { vi: 'Hết hàng', en: 'Out of stock', icon: 'error', badge: 'bg-danger/10 text-danger border-danger/20' },
};

const BATCH_STATUS_META = {
  active: { vi: 'Đang dùng', en: 'Active', badge: 'text-success text-xs bg-success/10 px-2.5 py-1.5 rounded border border-success/20' },
  depleted: { vi: 'Đã hết', en: 'Depleted', badge: 'text-on-surface-variant text-xs bg-surface-container-high px-2.5 py-1.5 rounded' },
};

function formatNumber(val) {
  return Math.round(Number(val) || 0).toLocaleString('vi-VN');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB');
}

const dayKey = (iso) => (iso ? String(iso).slice(0, 10) : '');
const batchPrice = (b) => Number(b.unitPriceAfterVat ?? b.unitPrice) || 0;
const sortByReceivedDesc = (a, b) => dayKey(b.receivedDate).localeCompare(dayKey(a.receivedDate));

function exportCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InventoryTable({ refreshKey, onRequestOpen }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const { categories: categoryOptions, categoryValueOf, categoryDisplay } = useInventoryCategories();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [batchQuery, setBatchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [expandedId, setExpandedId] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [stockOutFor, setStockOutFor] = useState(null);
  const [attachmentsFor, setAttachmentsFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleRestoreTransaction = async (row) => {
    const periodMatch = row.note?.match(/chi phí\s*\(([^)]+)\)/i);
    const txPeriod = periodMatch ? periodMatch[1] : null;

    let matchedExpense = null;
    if (txPeriod || row.projectId) {
      try {
        const res = await getExpenseList();
        const list = Array.isArray(res.data) ? res.data : [];
        matchedExpense = list.find((exp) => {
          const matchPeriod = txPeriod ? String(exp.period || '').includes(txPeriod) : true;
          const matchProject = row.projectId ? String(exp.projectId || '') === String(row.projectId) : true;
          if (!matchPeriod || !matchProject) return false;
          const note = String(exp.directNote || exp.note || '');
          return note.includes(`ItemID: ${row.itemId}`);
        });
      } catch (e) {
        console.error('[InventoryTable] getExpenseList for restore:', e);
      }
    }

    const warnParts = [
      t(
        `Hoàn tác giao dịch ${row.type === 'out' ? 'xuất' : 'nhập'} ${row.quantity} ${historyFor?.item?.name || ''}?`,
        `Reverse this ${row.type} transaction (${row.quantity} ${historyFor?.item?.name || ''})?`
      ),
    ];
    if (matchedExpense) {
      warnParts.push('');
      warnParts.push(t(
        `⚠️ Bản ghi chi phí "${matchedExpense.period} — ${matchedExpense.project?.name || matchedExpense.projectId || ''}" sẽ bị xóa.`,
        `⚠️ Expense record "${matchedExpense.period} — ${matchedExpense.project?.name || matchedExpense.projectId || ''}" will be deleted.`
      ));
      warnParts.push(t('Thao tác này không thể hoàn tác.', 'This action cannot be undone.'));
    }
    if (!window.confirm(warnParts.join('\n'))) return;

    setRestoringId(row.id);
    try {
      if (matchedExpense) {
        try {
          await deleteExpense(matchedExpense.id);
        } catch (delErr) {
          console.error('[InventoryTable] deleteExpense during restore:', delErr?.response?.data || delErr);
          showToast(t('Không xóa được bản ghi chi phí liên quan', 'Could not delete associated expense'), 'error');
          setRestoringId(null);
          return;
        }
      }

      await deleteInventoryTransaction(row.id);
      showToast(t('Đã hoàn tác giao dịch và xóa chi phí liên quan', 'Transaction reversed, associated expense deleted'));

      openHistory(historyFor.item, historyFor.batch);
      loadItems();
    } catch (err) {
      console.error('[InventoryTable] restore transaction failed:', err?.response?.data || err);
      showToast(t('Lỗi khi hoàn tác. Vui lòng thử lại.', 'Restore failed. Please try again.'), 'error');
    } finally {
      setRestoringId(null);
    }
  };

  // Ô gõ (tìm kiếm, mã batch) chờ người dùng ngừng gõ 300ms rồi mới gọi BE
  const [debounced, setDebounced] = useState({ search: '', batchQuery: '' });
  useEffect(() => {
    const next = { search: search.trim(), batchQuery: batchQuery.trim() };
    const id = setTimeout(() => setDebounced((prev) => (
      prev.search === next.search && prev.batchQuery === next.batchQuery ? prev : next
    )), 300);
    return () => clearTimeout(id);
  }, [search, batchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debounced, category, dateFrom, dateTo]);

  // Lọc + phân trang ở BE (search khớp cả mã batch; batchCode / receivedFrom / receivedTo lọc theo batch).
  // Mỗi item BE trả vẫn kèm MỌI batch → FE chỉ đánh dấu / cộng các batch khớp bộ lọc ở `rows`.
  const loadSeqRef = useRef(0);
  const loadItems = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: pageSize };
      if (debounced.search) params.search = debounced.search;
      if (category) params.category = category;
      if (debounced.batchQuery) params.batchCode = debounced.batchQuery;
      if (dateFrom) params.receivedFrom = dateFrom;
      if (dateTo) params.receivedTo = dateTo;
      const res = await getInventoryItems(params);
      if (seq !== loadSeqRef.current) return;
      setItems(res.data || []);
      setTotal(Number(res.total) || 0);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      console.error('[Inventory] getInventoryItems:', e);
      setError(e);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [page, pageSize, debounced, category, dateFrom, dateTo]);

  useEffect(() => {
    loadItems();
  }, [loadItems, refreshKey]);

  const batchFilterActive = !!(batchQuery.trim() || dateFrom || dateTo);
  const anyFilterActive = batchFilterActive || !!search.trim() || !!category;

  const allBatchCodes = useMemo(() => {
    const set = new Set();
    for (const it of items) for (const b of it.batches || []) if (b.batchCode) set.add(b.batchCode);
    return [...set].sort();
  }, [items]);

  // Mỗi dòng = 1 vật phẩm; `matched` = các batch thỏa bộ lọc ngày nhập / mã batch (hoặc tất cả nếu không lọc).
  const rows = useMemo(() => {
    const bq = batchQuery.trim().toLowerCase();
    const out = [];
    for (const it of items) {
      const batches = (Array.isArray(it.batches) ? it.batches : []).filter((b) => !b.archivedAt);
      const matched = batches.filter((b) => {
        const d = dayKey(b.receivedDate);
        if (dateFrom && (!d || d < dateFrom)) return false;
        if (dateTo && (!d || d > dateTo)) return false;
        if (bq && !String(b.batchCode || '').toLowerCase().includes(bq)) return false;
        return true;
      }).sort(sortByReceivedDesc);
      const hasBatches = Array.isArray(it.batches);
      out.push({
        item: it,
        matched,
        batchCodes: matched.map((b) => b.batchCode).filter(Boolean),
        qtyIn: hasBatches ? matched.reduce((sum, b) => sum + (Number(b.quantityIn) || 0), 0) : null,
        stock: batchFilterActive ? matched.reduce((sum, b) => sum + (Number(b.currentStock) || 0), 0) : (Number(it.totalStock) || 0),
      });
    }
    return out;
  }, [items, batchQuery, dateFrom, dateTo, batchFilterActive]);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setBatchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const loadBatches = async (itemId) => {
    setExpandedId(itemId === expandedId ? null : itemId);
    if (itemId === expandedId) return;
    setBatchesLoading(true);
    setBatches([]);
    try {
      const res = await getItemBatches(itemId);
      setBatches(res.data || []);
    } catch (e) {
      console.error('[Inventory] getItemBatches:', e);
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(t(`Xóa vật phẩm "${item.name}"?`, `Delete item "${item.name}"?`))) return;
    try {
      await deleteInventoryItem(item.id);
      showToast(t('Đã xóa vật phẩm', 'Item deleted'));
      loadItems();
    } catch (e) {
      console.error('[Inventory] deleteInventoryItem:', e);
      showToast(t('Lỗi khi xóa vật phẩm', 'Error deleting item'), 'error');
    }
  };

  const openHistory = async (item, batch) => {
    setHistoryFor(null);
    try {
      const res = await getInventoryTransactions({ batchId: batch?.id, itemId: item.id });
      const allRows = res.data || [];

      // Lọc bỏ giao dịch đã bị reverse (đã xóa/chỉnh sửa chi phí):
      // Bước 1: tìm các transaction type='in' có note chứa "Hoàn kho từ" → đánh dấu là reverse
      const reverseRows = allRows.filter(
        (r) => r.type === 'in' && /hoàn kho từ/i.test(r.note || '')
      );
      // Bước 2: tìm transaction type='out' gốc đã bị reverse (cùng itemId + số lượng)
      const reversedKeys = new Set();
      for (const rev of reverseRows) {
        for (const orig of allRows) {
          if (
            orig.type === 'out' &&
            orig.itemId === rev.itemId &&
            Number(orig.quantity) === Number(rev.quantity)
          ) {
            reversedKeys.add(orig.id);
            reversedKeys.add(rev.id);
          }
        }
      }
      // Bước 3: nếu reverse không match quantity nào → vẫn ẩn reverse (bookkeeping entry)
      for (const rev of reverseRows) {
        reversedKeys.add(rev.id);
      }

      const filteredRows = allRows.filter((r) => !reversedKeys.has(r.id));
      setHistoryFor({ item, batch, rows: filteredRows });
    } catch (e) {
      console.error('[Inventory] getInventoryTransactions:', e);
      setHistoryFor({ item, batch, rows: [], error: true });
    }
  };

  const exportBatches = () => {
    exportCSV(`batches-${(expandedItem?.name || 'item').toLowerCase().replace(/\s+/g, '-')}.csv`, batches.map((b) => ({
      'Mã batch': b.batchCode,
      'Ngày nhập': formatDate(b.receivedDate),
      'SL nhập': b.quantityIn,
      'Đơn giá': b.unitPrice,
      'Nhà cung cấp': b.supplier,
      'Hợp đồng': b.contractCode,
      'Hạng mục chi phí': getBatchExpenseCategory(b)?.name || '',
      'Tồn hiện tại': b.currentStock,
      'Trạng thái': BATCH_STATUS_META[b.status]?.[locale] || b.status,
    })));
  };

  const expandedItem = items.find((i) => i.id === expandedId);
  const expandedMatchedIds = new Set((rows.find((r) => r.item.id === expandedId)?.matched || []).map((b) => b.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-border-light shadow-sm overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="p-md border-b border-border-light bg-surface-bright flex flex-col sm:flex-row justify-between items-center gap-md">
        <div className="flex items-center gap-sm w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-xl pr-3 py-2 bg-surface-container-lowest rounded-lg border border-border-light focus:border-secondary outline-none text-body-sm w-full"
              placeholder={t('Tìm vật phẩm / mã batch...', 'Search item / batch code...')}
            />
          </div>
        </div>
        <div className="flex items-center gap-sm w-full sm:w-auto flex-wrap">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-surface-container-lowest rounded-lg border border-border-light text-body-sm text-on-surface outline-none focus:border-secondary min-w-[120px]"
          >
            <option value="">{t('Tất cả danh mục', 'All categories')}</option>
            {categoryOptions.map(o => (
              <option key={o.id} value={String(o.value).toLowerCase()}>{o.label}</option>
            ))}
          </select>
          <input
            value={batchQuery}
            onChange={(e) => setBatchQuery(e.target.value)}
            list="inventory-batch-codes"
            className="px-3 py-2 bg-surface-container-lowest rounded-lg border border-border-light text-body-sm text-on-surface outline-none focus:border-secondary w-40"
            placeholder={t('Mã batch', 'Batch code')}
            title={t('Lọc theo mã batch', 'Filter by batch code')}
          />
          <datalist id="inventory-batch-codes">
            {allBatchCodes.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="flex items-center gap-1" title={t('Lọc theo ngày nhập kho', 'Filter by received date')}>
            <span className="text-body-sm text-on-surface-variant whitespace-nowrap">{t('Ngày nhập', 'Received')}</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-2 bg-surface-container-lowest rounded-lg border border-border-light text-body-sm text-on-surface outline-none focus:border-secondary"
            />
            <span className="text-on-surface-variant">–</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-2 bg-surface-container-lowest rounded-lg border border-border-light text-body-sm text-on-surface outline-none focus:border-secondary"
            />
          </div>
          {anyFilterActive && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 border border-border-light rounded-lg text-body-sm text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center gap-1 cursor-pointer"
              title={t('Xóa bộ lọc', 'Clear filters')}
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              {t('Xóa lọc', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {batchFilterActive && (
        <div className="px-md py-2 border-b border-border-light bg-secondary/5 text-body-sm text-on-surface-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
          {t('Số lượng nhập, tồn kho và các thẻ tổng quan đang tính theo các batch khớp bộ lọc.', 'Imported qty, stock and summary cards reflect only the batches matching the filters.')}
        </div>
      )}

      {error && (
        <div className="p-md bg-danger/5 border-b border-danger/20 text-danger text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {t('Không tải được dữ liệu kho. Vui lòng kiểm tra kết nối backend.', 'Failed to load inventory data. Check backend connection.')}
          <button onClick={loadItems} className="ml-auto font-semibold hover:underline cursor-pointer">{t('Thử lại', 'Retry')}</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-background-subtle border-b border-border-light">
            <tr>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium">{t('Mã batch', 'Batch code')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium">{t('Vật phẩm', 'Item')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium">{t('Danh mục', 'Category')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-right">{t('Số lượng nhập', 'Qty imported')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-right">{t('Tổng tồn kho', 'Total stock')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-right">{t('Đơn giá TB (sau VAT)', 'Avg. price (post-VAT)')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-center">{t('Trạng thái', 'Status')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-center">{t('Thao tác', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-md text-center text-on-surface-variant text-body-sm">
                  {t('Không có vật phẩm nào.', 'No items found.')}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="p-md text-center text-on-surface-variant text-body-sm">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                  {t('Đang tải...', 'Loading...')}
                </td>
              </tr>
            )}
            {!loading && pageRows.map((row) => {
              const { item } = row;
              const st = STATUS_META[item.status] || STATUS_META.instock;
              const isExpanded = item.id === expandedId;
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  row={row}
                  st={st}
                  isExpanded={isExpanded}
                  locale={locale}
                  t={t}
                  categoryDisplay={categoryDisplay}
                  onToggle={() => loadBatches(item.id)}
                  onEdit={() => onRequestOpen('edit', item)}
                  onDelete={() => handleDeleteItem(item)}
                  onStockOut={() => setStockOutFor(item)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch management (expanded row) */}
      {expandedId && (
        <div className="bg-background-subtle border-t-2 border-border-light p-lg">
          <div className="bg-surface-container-lowest rounded-lg border border-border-light p-md shadow-inner">
            <div className="flex justify-between items-center mb-md flex-wrap gap-sm">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary">layers</span>
                {t('Quản lý theo Batch — ', 'Batch management — ')}{expandedItem?.name}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={exportBatches}
                  className="bg-surface-container-lowest border border-border-light text-on-surface px-3 py-1.5 rounded font-label-md text-label-md hover:bg-surface-container-low flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">download</span> {t('Xuất dữ liệu', 'Export')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-border-light rounded-lg">
              <table className="w-full text-left min-w-[1050px]">
                <thead className="bg-surface-container-low border-b border-border-light">
                  <tr>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Mã Batch', 'Batch code')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Ngày nhập', 'Received')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('SL nhập', 'Qty in')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Đơn giá', 'Unit price')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Nhà cung cấp', 'Supplier')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Hợp đồng', 'Contract')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Hạng mục chi phí', 'Expense category')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Tồn hiện tại', 'Current stock')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Trạng thái', 'Status')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Hồ sơ', 'Documents')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Lịch sử', 'History')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                  {batchesLoading && (
                    <tr>
                      <td colSpan={11} className="px-3 py-2.5 text-center text-on-surface-variant">
                        <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                        {t('Đang tải...', 'Loading...')}
                      </td>
                    </tr>
                  )}
                  {!batchesLoading && batches.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-2.5 text-center text-on-surface-variant">
                        {t('Chưa có batch nào.', 'No batches yet.')}
                      </td>
                    </tr>
                  )}
                  {batches.map((batch) => {
                    const bs = BATCH_STATUS_META[batch.status] || BATCH_STATUS_META.active;
                    return (
                      <tr key={batch.id} className={`hover:bg-surface-container-lowest ${batchFilterActive && !expandedMatchedIds.has(batch.id) ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2.5 font-data-mono text-data-mono font-medium text-secondary">{batch.batchCode}</td>
                        <td className="px-3 py-2.5">{formatDate(batch.receivedDate)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(batch.quantityIn)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(batch.unitPrice)}</td>
                        <td className="px-3 py-2.5">{batch.supplier || '—'}</td>
                        <td className="px-3 py-2.5 text-secondary hover:underline cursor-pointer">{batch.contractCode || '—'}</td>
                        <td className="px-3 py-2.5">{getBatchExpenseCategory(batch)?.name || <span className="text-on-surface-variant">—</span>}</td>
                        <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${batch.currentStock === 0 ? 'text-danger' : batch.status === 'active' && batch.currentStock < (batch.quantityIn * 0.3) ? 'text-warning' : ''}`}>
                          {formatNumber(batch.currentStock)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={bs.badge}>{bs[locale]}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => setAttachmentsFor({ item: expandedItem, batch })}
                            className="p-1 text-on-surface-variant hover:text-secondary rounded hover:bg-surface-container-low transition-colors cursor-pointer"
                            title={t('Hồ sơ liên quan', 'Related documents')}
                          >
                            <span className="material-symbols-outlined text-[16px]">attach_file</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => openHistory(expandedItem, batch)}
                            className="p-1 text-on-surface-variant hover:text-secondary rounded hover:bg-surface-container-low transition-colors cursor-pointer"
                            title={t('Lịch sử xuất nhập', 'In/out history')}
                          >
                            <span className="material-symbols-outlined text-[16px]">history</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-sm flex justify-end">
              <button
                onClick={() => openHistory(expandedItem, null)}
                className="text-secondary font-body-md text-body-md font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                {t('Xem lịch sử xuất nhập', 'View in/out history')} <span className="material-symbols-outlined text-sm">history</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="px-3 py-2.5 border-t border-border-light bg-surface-container-lowest flex flex-col sm:flex-row justify-between items-center gap-2 text-body-sm text-on-surface-variant">
        <div>{t('Hiển thị', 'Showing')} {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} {t('của', 'of')} {total} {t('vật phẩm', 'items')}</div>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-8 h-8 flex items-center justify-center rounded border border-border-light hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded font-medium cursor-pointer ${
                p === page ? 'bg-secondary text-on-secondary' : 'border border-border-light hover:bg-surface-container-low'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded border border-border-light hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      {historyFor && (
        <BatchHistoryModal
          item={historyFor.item}
          batch={historyFor.batch}
          rows={historyFor.rows}
          error={historyFor.error}
          restoringId={restoringId}
          onClose={() => setHistoryFor(null)}
          onRestore={handleRestoreTransaction}
        />
      )}

      {attachmentsFor && (
        <BatchAttachmentsModal
          item={attachmentsFor.item}
          batch={attachmentsFor.batch}
          onClose={() => setAttachmentsFor(null)}
        />
      )}

      {stockOutFor && (
        <StockOutModal
          item={stockOutFor}
          onClose={() => setStockOutFor(null)}
          onSaved={(msg) => {
            setStockOutFor(null);
            showToast(msg);
            loadItems();
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-danger text-on-error' : 'bg-success text-on-error'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, row, st, isExpanded, locale, t, categoryDisplay, onToggle, onEdit, onDelete, onStockOut }) {
  const cat = categoryDisplay(item.category);
  const statusTone = { instock: '', low: 'text-warning', out: 'text-danger' }[item.status] || '';
  return (
    <>
      <tr className={`bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer ${isExpanded ? 'border-l-2 border-l-secondary' : ''}`} onClick={onToggle}>
        <td className="p-md font-data-mono text-data-mono text-secondary whitespace-nowrap" title={row.batchCodes.join(', ')}>
          {row.batchCodes.length === 0 ? (
            <span className="text-on-surface-variant">—</span>
          ) : (
            <>
              {row.batchCodes[0]}
              {row.batchCodes.length > 1 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-xs font-body-sm">
                  +{row.batchCodes.length - 1}
                </span>
              )}
            </>
          )}
        </td>
        <td className="p-md">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center shrink-0 border border-border-light overflow-hidden">
              {item.image ? (
                <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant text-xl">{item.category === 'print' ? 'description' : item.category === 'gift' ? 'card_giftcard' : 'inventory_2'}</span>
              )}
            </div>
            <div>
              <div className="font-body-md text-body-md font-semibold text-on-surface">{item.name}</div>
            </div>
          </div>
        </td>
        <td className="p-md font-body-sm text-body-sm">{cat}</td>
        <td className="p-md font-data-mono text-data-mono text-right tabular-nums">
          {row.qtyIn == null ? '—' : <>{formatNumber(row.qtyIn)} <span className="text-on-surface-variant font-normal">{item.unit}</span></>}
        </td>
        <td className={`p-md font-data-mono text-data-mono text-right font-medium tabular-nums ${statusTone}`}>
          {formatNumber(row.stock)} <span className="text-on-surface-variant font-normal">{item.unit}</span>
        </td>
        <td className="p-md font-data-mono text-data-mono text-right tabular-nums">{formatNumber(item.avgUnitPrice)} <span className="text-on-surface-variant font-normal">VND</span></td>
        <td className="p-md text-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md border ${st.badge}`}>
            <span className="material-symbols-outlined text-[14px]">{st.icon}</span> {st[locale]}
          </span>
        </td>
        <td className="p-md text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1 mx-auto">
            <button
              onClick={onToggle}
              className={`flex items-center gap-1 font-body-sm text-body-sm font-semibold hover:underline cursor-pointer ${isExpanded ? 'text-on-surface-variant' : 'text-secondary'}`}
            >
              {isExpanded ? t('Đóng', 'Close') : t('Chi tiết', 'Detail')}
              <span className="material-symbols-outlined text-sm">{isExpanded ? 'expand_less' : 'arrow_forward'}</span>
            </button>
            <button onClick={onStockOut} className="p-1 text-on-surface-variant hover:text-secondary transition-colors hover:bg-secondary/10 rounded cursor-pointer" title={t('Xuất cho dự án', 'Issue to project')}>
              <span className="material-symbols-outlined text-[16px]">outbound</span>
            </button>
            <button onClick={onEdit} className="p-1 text-on-surface-variant hover:text-secondary transition-colors hover:bg-surface-container-low rounded cursor-pointer" title={t('Sửa', 'Edit')}>
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button onClick={onDelete} className="p-1 text-on-surface-variant hover:text-danger transition-colors hover:bg-danger/10 rounded cursor-pointer" title={t('Xóa', 'Delete')}>
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}