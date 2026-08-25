import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getClosedDeals, deleteClosedDeal } from '../../services/api';

const INITIAL_DISPLAY = 5;

export default function ClosedDealsTable() {
  const { locale } = useDashboard();
  const addToast = useToast();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadClosedDeals();
  }, []);

  const loadClosedDeals = async () => {
    setLoading(true);
    try {
      const response = await getClosedDeals();
      setDeals(response.data);
    } catch (error) {
      console.error('Error loading closed deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeal = async (deal) => {
    const msg = locale === 'vi'
      ? `Xoá mềm closed deal "${deal.customer}"? (Có thể khôi phục từ dữ liệu)`
      : `Soft delete closed deal "${deal.customer}"?`;
    if (!window.confirm(msg)) return;
    setDeletingId(deal.id);
    try {
      await deleteClosedDeal(deal.id);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
      addToast(locale === 'vi' ? 'Đã xoá closed deal' : 'Closed deal deleted');
      await loadClosedDeals();
    } catch (error) {
      console.error('Error deleting closed deal:', error);
      const beMsg = error?.response?.data?.message;
      addToast(
        `${locale === 'vi' ? 'Xoá closed deal thất bại' : 'Failed to delete closed deal'}${beMsg ? `: ${Array.isArray(beMsg) ? beMsg.join(', ') : beMsg}` : ''}`,
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('en-US');
  };

  const displayedDeals = deals.slice(0, INITIAL_DISPLAY);

  const renderTable = (list, allowDelete = false) => (
    <table className="w-full text-left border-collapse">
      <thead className="bg-surface-container-low border-b border-border-light">
        <tr>
          <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Khách hàng' : 'Customer'}</th>
          <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Hợp đồng' : 'Contract'}</th>
          <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Final Fees</th>
          <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Ngày ký' : 'Signed Date'}</th>
          <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Trạng thái' : 'Status'}</th>
          {allowDelete && (
            <th className="p-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">{locale === 'vi' ? 'Thao tác' : 'Actions'}</th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-light">
        {list.map((deal) => (
          <tr key={deal.id} className={`hover:bg-surface-container-lowest transition-colors ${deletingId === deal.id ? 'opacity-50' : ''}`}>
            <td className="p-3 text-body-md font-medium">{deal.customer}</td>
            <td className="p-3 text-body-md">{deal.contract}</td>
            <td className="p-3 text-data-display">{formatCurrency(deal.finalFees)}</td>
            <td className="p-3 text-body-md">{formatDate(deal.signedDate)}</td>
            <td className="p-3">
              <span className="text-success font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {locale === 'vi' ? 'Hoàn tất' : 'Completed'}
              </span>
            </td>
            {allowDelete && (
              <td className="p-3 text-center">
                <button
                  onClick={() => handleDeleteDeal(deal)}
                  disabled={deletingId === deal.id}
                  title={locale === 'vi' ? 'Xoá mềm closed deal' : 'Soft delete closed deal'}
                  className="w-8 h-8 rounded flex items-center justify-center mx-auto text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">{deletingId === deal.id ? 'sync' : 'delete'}</span>
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md font-semibold text-on-surface uppercase tracking-wider">
          {locale === 'vi' ? 'Chi tiết Closed Deal' : 'Closed Deal Detail'} {!loading && `(${deals.length})`}
        </h4>
        {deals.length > INITIAL_DISPLAY && (
          <button onClick={() => setShowAll(true)} className="text-primary flex items-center gap-1 text-body-sm font-semibold hover:underline">
            <span className="material-symbols-outlined text-[18px]">open_in_full</span>
            {locale === 'vi' ? 'Xem tất cả' : 'View all'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</p>
      ) : deals.length === 0 ? (
        <p className="text-on-surface-variant text-sm">{locale === 'vi' ? 'Chưa có dữ liệu' : 'No data yet'}</p>
      ) : (
        <div className="overflow-x-auto border border-border-light rounded-lg">
          {renderTable(displayedDeals)}
        </div>
      )}

      {showAll && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowAll(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-4xl max-h-[80vh] bg-white rounded-xl shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border-light">
              <h3 className="text-lg font-bold text-on-surface">{locale === 'vi' ? 'Tất cả Closed Deal' : 'All Closed Deals'} ({deals.length})</h3>
              <button onClick={() => setShowAll(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-auto p-4 flex-1">
              {renderTable(deals, true)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
