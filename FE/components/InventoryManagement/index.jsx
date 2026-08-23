import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getInventoryOverview, getInventoryItems } from '../../services/api';
import InventoryMetrics from './InventoryMetrics';
import InventoryTable from './InventoryTable';
import InventoryFormModal from './InventoryFormModal';
import StockBreakdownModal from './StockBreakdownModal';

export default function InventoryManagement() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showStockBreakdown, setShowStockBreakdown] = useState(false);
  const [toast, setToast] = useState(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await getInventoryOverview();
      const overview = res.data || {};
      if (overview.totalStock == null) {
        try {
          const itemsRes = await getInventoryItems({ limit: 100000 });
          overview.totalStock = (itemsRes.data || []).reduce((sum, it) => sum + (Number(it.totalStock) || 0), 0);
        } catch (e) {
          console.error('[Inventory] compute totalStock:', e);
        }
      }
      setOverview(overview);
      setOverviewError(false);
    } catch (e) {
      console.error('[Inventory] getInventoryOverview:', e);
      setOverviewError(true);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshKey]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openForm = (mode, item) => {
    setFormMode(mode);
    setEditing(item);
    setShowForm(true);
  };

  const handleSaved = (msg) => {
    showToast(msg);
    setShowForm(false);
    setEditing(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <div className="mt-lg flex flex-col md:flex-row justify-between items-start md:items-center mb-lg gap-md">
        <div>
          <h1 className="font-display-lg text-display-lg font-bold text-on-surface mb-xs">
            {t('Quản lý Kho Vật Phẩm', 'Inventory Management')}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {t('Theo dõi tồn kho, quản lý nhập xuất và theo dõi batch vật phẩm marketing.', 'Track stock, manage in/out flows and marketing item batches.')}
          </p>
        </div>
        <button
          onClick={() => openForm('create', null)}
          className="bg-secondary text-on-secondary px-lg py-sm rounded-lg font-title-lg text-title-lg font-semibold flex items-center gap-xs hover:bg-secondary/90 transition-colors shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined">add_circle</span>
          {t('Nhập kho mới', 'New inventory')}
        </button>
      </div>

      {overviewError && (
        <div className="mb-xl p-md bg-danger/5 border border-danger/20 text-danger text-body-sm flex items-center gap-2 rounded-lg">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {t('Không tải được số liệu tổng quan kho.', 'Failed to load inventory overview.')}
          <button onClick={loadOverview} className="ml-auto font-semibold hover:underline cursor-pointer">
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}
      <InventoryMetrics overview={overview} onOpenStock={() => setShowStockBreakdown(true)} />
      <div className="mb-xl">
        <InventoryTable refreshKey={refreshKey} onRequestOpen={openForm} />
      </div>

      {showStockBreakdown && (
        <StockBreakdownModal onClose={() => setShowStockBreakdown(false)} />
      )}

      {showForm && (
        <InventoryFormModal
          item={editing}
          mode={formMode}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-danger text-on-error' : 'bg-success text-on-error'
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
