import { useDashboard } from '../../contexts/DashboardContext';

function formatCurrency(val) {
  return (Number(val) || 0).toLocaleString('vi-VN');
}

const METRIC_META = {
  totalStock: { icon: 'inventory_2', tone: 'secondary' },
  totalValue: { icon: 'account_balance_wallet', tone: 'secondary' },
};

export default function InventoryMetrics({ overview, onOpenStock }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const cards = [
    {
      key: 'totalStock',
      label: t('Tổng kho hàng', 'Total stock'),
      value: formatCurrency(overview?.totalStock),
      suffix: t('đơn vị', 'units'),
      caption: { icon: null, text: t('Tổng số lượng vật phẩm đang có trong kho', 'Total quantity currently in warehouse'), tone: 'muted' },
    },
    {
      key: 'totalValue',
      label: t('Tổng giá trị tồn kho', 'Total inventory value'),
      value: formatCurrency(overview?.totalValue),
      suffix: 'VND',
      caption: {
        icon: 'trending_up',
        text: overview?.totalValueTrend != null
          ? t(`+${overview.totalValueTrend}% so với tháng trước`, `+${overview.totalValueTrend}% vs last month`)
          : null,
        tone: 'success',
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter mb-xl">
      {cards.map((card) => {
        const meta = METRIC_META[card.key];
        const toneText = { secondary: 'text-secondary', warning: 'text-warning', success: 'text-success' }[meta.tone];
        const toneBg = { secondary: 'bg-surface-container-low', warning: 'bg-warning/10', success: 'bg-success/10' }[meta.tone];
        const clickable = card.key === 'totalStock' && onOpenStock;
        return (
          <div
            key={card.key}
            onClick={clickable ? onOpenStock : undefined}
            className={`bg-surface-container-lowest rounded-xl p-md border border-border-light shadow-sm ${clickable ? 'cursor-pointer hover:border-secondary hover:shadow-md transition-all group' : ''}`}
          >
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{card.label}</span>
              <span className={`material-symbols-outlined ${toneText} ${toneBg} p-xs rounded-lg`}>{meta.icon}</span>
            </div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tabular-nums">
              {card.value} <span className="text-body-sm font-normal text-on-surface-variant">{card.suffix}</span>
            </div>
            {clickable && (
              <div className="mt-xs font-body-sm text-body-sm flex items-center gap-xs text-secondary group-hover:underline">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>{t('Xem chi tiết', 'View details')}</span>
              </div>
            )}
            {!clickable && card.caption?.text && (
              <div className={`mt-xs font-body-sm text-body-sm flex items-center gap-xs ${card.caption.tone === 'success' ? 'text-success' : 'text-on-surface-variant'}`}>
                {card.caption.icon && <span className="material-symbols-outlined text-sm">{card.caption.icon}</span>}
                <span>{card.caption.text}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
