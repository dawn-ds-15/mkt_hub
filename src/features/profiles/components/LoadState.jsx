import { useDashboard } from '@/shared/stores/DashboardContext';

export default function LoadState({ loading, error, onRetry }) {
  const { locale } = useDashboard();
  const t = (vi, en) => locale === 'vi' ? vi : en;
  return (
    <div className="p-6 text-center space-y-3" role={error ? 'alert' : 'status'}>
      <p className="text-on-surface">{loading ? t('Đang tải dữ liệu…', 'Loading data…') : t('Không thể tải dữ liệu. Vui lòng thử lại.', 'Unable to load data. Please retry.')}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && <button className="px-4 py-2 rounded-lg bg-primary-container text-on-primary" onClick={onRetry}>{t('Thử lại', 'Retry')}</button>}
    </div>
  );
}
