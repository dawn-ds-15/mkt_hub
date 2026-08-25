import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getInventoryItems,
  getItemBatches,
  deleteInventoryItem,
  getInventoryTransactions,
} from '../../services/api';
import BatchHistoryModal from './BatchHistoryModal';
import StockOutModal from './StockOutModal';

const CATEGORY_META = {
  posm: { vi: 'POSM', en: 'POSM' },
  gift: { vi: 'Quà tặng', en: 'Gift' },
  print: { vi: 'Ấn phẩm in', en: 'Printed materials' },
};

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
  return (Number(val) || 0).toLocaleString('vi-VN');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB');
}

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

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [expandedId, setExpandedId] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [stockOutFor, setStockOutFor] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInventoryItems({ search: search || undefined, category: category || undefined, page, limit: pageSize });
      setItems(res.data || []);
      setTotal(res.total ?? (res.data || []).length);
    } catch (e) {
      console.error('[Inventory] getInventoryItems:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search, category, page, pageSize]);

  useEffect(() => {
    loadItems();
  }, [loadItems, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [search, category]);

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
      setHistoryFor({ item, batch, rows: res.data || [] });
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
      'Tồn hiện tại': b.currentStock,
      'Trạng thái': BATCH_STATUS_META[b.status]?.[locale] || b.status,
    })));
  };

  const expandedItem = items.find((i) => i.id === expandedId);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
              placeholder={t('Tìm vật phẩm...', 'Search items...')}
            />
          </div>
        </div>
        <div className="flex items-center gap-sm w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-surface-container-lowest rounded-lg border border-border-light text-body-sm text-on-surface outline-none focus:border-secondary min-w-[120px]"
          >
            <option value="">{t('Tất cả danh mục', 'All categories')}</option>
            {Object.entries(CATEGORY_META).map(([key, m]) => (
              <option key={key} value={key}>{m[locale]}</option>
            ))}
          </select>
          <button className="p-2 border border-border-light rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors" title={t('Bộ lọc', 'Filters')}>
            <span className="material-symbols-outlined text-md">filter_list</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-md bg-danger/5 border-b border-danger/20 text-danger text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {t('Không tải được dữ liệu kho. Vui lòng kiểm tra kết nối backend.', 'Failed to load inventory data. Check backend connection.')}
          <button onClick={loadItems} className="ml-auto font-semibold hover:underline cursor-pointer">{t('Thử lại', 'Retry')}</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-background-subtle border-b border-border-light">
            <tr>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium">{t('Vật phẩm', 'Item')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium">{t('Danh mục', 'Category')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-right">{t('Tổng tồn kho', 'Total stock')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-right">{t('Đơn giá TB (sau VAT)', 'Avg. price (post-VAT)')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-center">{t('Trạng thái', 'Status')}</th>
              <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium text-center">{t('Thao tác', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-md text-center text-on-surface-variant text-body-sm">
                  {t('Không có vật phẩm nào.', 'No items found.')}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="p-md text-center text-on-surface-variant text-body-sm">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                  {t('Đang tải...', 'Loading...')}
                </td>
              </tr>
            )}
            {items.map((item) => {
              const st = STATUS_META[item.status] || STATUS_META.instock;
              const isExpanded = item.id === expandedId;
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  st={st}
                  isExpanded={isExpanded}
                  locale={locale}
                  t={t}
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
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-surface-container-low border-b border-border-light">
                  <tr>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Mã Batch', 'Batch code')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Ngày nhập', 'Received')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('SL nhập', 'Qty in')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Đơn giá', 'Unit price')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Nhà cung cấp', 'Supplier')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Hợp đồng', 'Contract')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Tồn hiện tại', 'Current stock')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Trạng thái', 'Status')}</th>
                    <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Lịch sử', 'History')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                  {batchesLoading && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2.5 text-center text-on-surface-variant">
                        <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                        {t('Đang tải...', 'Loading...')}
                      </td>
                    </tr>
                  )}
                  {!batchesLoading && batches.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2.5 text-center text-on-surface-variant">
                        {t('Chưa có batch nào.', 'No batches yet.')}
                      </td>
                    </tr>
                  )}
                  {batches.map((batch) => {
                    const bs = BATCH_STATUS_META[batch.status] || BATCH_STATUS_META.active;
                    return (
                      <tr key={batch.id} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2.5 font-data-mono text-data-mono font-medium text-secondary">{batch.batchCode}</td>
                        <td className="px-3 py-2.5">{formatDate(batch.receivedDate)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(batch.quantityIn)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(batch.unitPrice)}</td>
                        <td className="px-3 py-2.5">{batch.supplier || '—'}</td>
                        <td className="px-3 py-2.5 text-secondary hover:underline cursor-pointer">{batch.contractCode || '—'}</td>
                        <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${batch.currentStock === 0 ? 'text-danger' : batch.status === 'active' && batch.currentStock < (batch.quantityIn * 0.3) ? 'text-warning' : ''}`}>
                          {formatNumber(batch.currentStock)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={bs.badge}>{bs[locale]}</span>
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
                className="text-secondary font-title-lg text-title-lg flex items-center gap-1 hover:underline cursor-pointer"
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
          onClose={() => setHistoryFor(null)}
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

function ItemRow({ item, st, isExpanded, locale, t, onToggle, onEdit, onDelete, onStockOut }) {
  const cat = CATEGORY_META[item.category] || { vi: item.category, en: item.category };
  const statusTone = { instock: '', low: 'text-warning', out: 'text-danger' }[item.status] || '';
  return (
    <>
      <tr className={`bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer ${isExpanded ? 'border-l-2 border-l-secondary' : ''}`} onClick={onToggle}>
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
              <div className="font-title-lg text-title-lg font-semibold text-on-surface">{item.name}</div>
            </div>
          </div>
        </td>
        <td className="p-md font-body-sm text-body-sm">{cat[locale]}</td>
        <td className={`p-md font-data-mono text-data-mono text-right font-medium tabular-nums ${statusTone}`}>
          {formatNumber(item.totalStock)} <span className="text-on-surface-variant font-normal">{item.unit}</span>
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
              className={`flex items-center gap-1 font-title-lg text-title-lg hover:underline cursor-pointer ${isExpanded ? 'text-on-surface-variant' : 'text-secondary'}`}
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