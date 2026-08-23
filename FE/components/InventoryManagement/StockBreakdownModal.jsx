import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getInventoryItems, getInventoryItem } from '../../services/api';

function formatNumber(val) {
  return (Number(val) || 0).toLocaleString('vi-VN');
}

const STATUS_META = {
  instock: { vi: 'Còn hàng', en: 'In stock', icon: 'check_circle', badge: 'bg-success/10 text-success border-success/20' },
  low: { vi: 'Sắp hết', en: 'Low stock', icon: 'warning', badge: 'bg-warning/10 text-warning border-warning/20' },
  out: { vi: 'Hết hàng', en: 'Out of stock', icon: 'error', badge: 'bg-danger/10 text-danger border-danger/20' },
};

export default function StockBreakdownModal({ onClose }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getInventoryItems({ page: 1, limit: 100000 });
      setItems(res.data || []);
    } catch (e) {
      console.error('[StockBreakdown] getInventoryItems:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openDetail = async (item) => {
    setSelected(item);
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      const res = await getInventoryItem(item.id);
      setDetail(res.data || null);
    } catch (e) {
      console.error('[StockBreakdown] getInventoryItem:', e);
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalValue = items.reduce((sum, it) => sum + (Number(it.totalStock) || 0) * (Number(it.avgUnitPrice) || 0), 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl pointer-events-auto mx-4 p-6 space-y-5 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {selected ? t(`Chi tiết — ${selected.name}`, `Detail — ${selected.name}`) : t('Tổng kho hàng', 'Total stock')}
              </h3>
              {!selected && (
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  {t('Danh sách vật phẩm và giá trị tồn kho.', 'Items and their inventory value.')}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
          </div>

          {selected ? (
            <div className="overflow-auto flex-1">
              {detailLoading && (
                <div className="p-10 text-center text-on-surface-variant text-body-sm">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                  {t('Đang tải...', 'Loading...')}
                </div>
              )}
              {detailError && (
                <div className="p-4 rounded bg-danger/10 text-danger text-body-sm">
                  {t('Không tải được thông tin vật phẩm.', 'Failed to load item detail.')}
                </div>
              )}
              {detail && (
                <div className="space-y-5">
                  <div className="flex items-center gap-md">
                    <div className="w-14 h-14 rounded bg-surface-container-high flex items-center justify-center shrink-0 border border-border-light overflow-hidden">
                      {detail.image ? (
                        <img className="w-full h-full object-cover" src={detail.image} alt={detail.name} />
                      ) : (
                        <span className="material-symbols-outlined text-on-surface-variant text-2xl">inventory_2</span>
                      )}
                    </div>
                    <div>
                      <div className="font-title-lg text-title-lg font-semibold text-on-surface">{detail.name}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Tồn kho', 'Stock')}</div>
                      <div className="font-headline-sm text-headline-sm font-bold text-on-surface tabular-nums">{formatNumber(detail.totalStock)} <span className="text-body-sm font-normal text-on-surface-variant">{detail.unit}</span></div>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Đơn giá TB', 'Avg price')}</div>
                      <div className="font-headline-sm text-headline-sm font-bold text-on-surface tabular-nums">{formatNumber(detail.avgUnitPrice)} <span className="text-body-sm font-normal text-on-surface-variant">VND</span></div>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Giá trị', 'Value')}</div>
                      <div className="font-headline-sm text-headline-sm font-bold text-secondary tabular-nums">{formatNumber((Number(detail.totalStock) || 0) * (Number(detail.avgUnitPrice) || 0))} <span className="text-body-sm font-normal text-on-surface-variant">VND</span></div>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t('Trạng thái', 'Status')}</div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-md text-label-md border ${(STATUS_META[detail.status] || STATUS_META.instock).badge}`}>
                        <span className="material-symbols-outlined text-[14px]">{(STATUS_META[detail.status] || STATUS_META.instock).icon}</span>
                        {(STATUS_META[detail.status] || STATUS_META.instock)[locale]}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">{t('Lô hàng / Batch', 'Batches')}</h4>
                    {(!detail.batches || detail.batches.length === 0) ? (
                      <div className="p-6 text-center text-on-surface-variant text-body-sm bg-surface-container-lowest rounded-lg border border-border-light">
                        {t('Chưa có batch nào.', 'No batches yet.')}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-border-light rounded-lg">
                        <table className="w-full text-left">
                          <thead className="bg-surface-container-low border-b border-border-light">
                            <tr>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Mã Batch', 'Batch code')}</th>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('SL nhập', 'Qty in')}</th>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Đơn giá', 'Unit price')}</th>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Tồn hiện tại', 'Current stock')}</th>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Nhà cung cấp', 'Supplier')}</th>
                              <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Trạng thái', 'Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                            {(detail.batches || []).map((b) => (
                              <tr key={b.id} className="hover:bg-surface-container-lowest">
                                <td className="px-3 py-2.5 font-data-mono text-data-mono font-medium text-secondary">{b.batchCode}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.quantityIn)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.unitPrice)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatNumber(b.currentStock)}</td>
                                <td className="px-3 py-2.5">{b.supplier || '—'}</td>
                                <td className="px-3 py-2.5">{b.status === 'depleted' ? t('Đã hết', 'Depleted') : t('Đang dùng', 'Active')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setSelected(null)} className="text-secondary font-title-lg text-title-lg flex items-center gap-1 hover:underline cursor-pointer">
                    <span className="material-symbols-outlined text-sm">arrow_back</span> {t('Quay lại danh sách', 'Back to list')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              {error && (
                <div className="p-4 rounded bg-danger/10 text-danger text-body-sm">
                  {t('Không tải được danh sách vật phẩm.', 'Failed to load items.')}
                </div>
              )}
              {loading && (
                <div className="p-10 text-center text-on-surface-variant text-body-sm">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle mr-2" />
                  {t('Đang tải...', 'Loading...')}
                </div>
              )}
              {!loading && !error && items.length === 0 && (
                <div className="p-10 text-center text-on-surface-variant text-body-sm">
                  {t('Chưa có vật phẩm nào trong kho.', 'No items in warehouse yet.')}
                </div>
              )}
              {!loading && !error && items.length > 0 && (
                <div className="overflow-x-auto border border-border-light rounded-lg">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low border-b border-border-light">
                      <tr>
                        <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant">{t('Vật phẩm', 'Item')}</th>
                        <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Tồn kho', 'Stock')}</th>
                        <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-right">{t('Giá trị', 'Value')}</th>
                        <th className="px-3 py-2.5 font-label-md text-label-md text-on-surface-variant text-center">{t('Trạng thái', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                      {items.map((item) => {
                        const st = STATUS_META[item.status] || STATUS_META.instock;
                        const value = (Number(item.totalStock) || 0) * (Number(item.avgUnitPrice) || 0);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => openDetail(item)}
                            className="hover:bg-surface-container-low cursor-pointer transition-colors"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center shrink-0 border border-border-light overflow-hidden">
                                  {item.image ? (
                                    <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                                  ) : (
                                    <span className="material-symbols-outlined text-on-surface-variant text-sm">{item.category === 'print' ? 'description' : item.category === 'gift' ? 'card_giftcard' : 'inventory_2'}</span>
                                  )}
                                </div>
                                <span className="font-medium text-on-surface">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(item.totalStock)} <span className="text-on-surface-variant">{item.unit}</span></td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatNumber(value)} <span className="text-on-surface-variant font-normal">VND</span></td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${st.badge}`}>
                                <span className="material-symbols-outlined text-[12px]">{st.icon}</span>
                                {st[locale]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loading && !error && items.length > 0 && (
                <div className="mt-3 flex justify-end items-center gap-2 text-body-sm">
                  <span className="text-on-surface-variant">{t('Tổng giá trị', 'Total value')}:</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-secondary tabular-nums">{formatNumber(totalValue)} VND</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-surface-container-low text-on-surface rounded text-body-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer">
              {t('Đóng', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}