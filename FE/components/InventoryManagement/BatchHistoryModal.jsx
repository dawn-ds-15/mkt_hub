import { useDashboard } from '../../contexts/DashboardContext';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB');
}

export default function BatchHistoryModal({ item, batch, rows, error, onClose }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const typeMeta = {
    in: { vi: 'Nhập', en: 'In', badge: 'bg-success/10 text-success border-success/20' },
    out: { vi: 'Xuất', en: 'Out', badge: 'bg-warning/10 text-warning border-warning/20' },
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl pointer-events-auto mx-4 p-6 space-y-5 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">{t('Lịch sử xuất nhập', 'In/Out History')}</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                {item?.name} {batch?.batchCode ? `— ${batch.batchCode}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
          </div>

          <div className="overflow-auto flex-1">
            {error && (
              <div className="p-4 rounded bg-danger/10 text-danger text-body-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {t('Không tải được lịch sử. Vui lòng kiểm tra backend.', 'Failed to load history. Check backend.')}
              </div>
            )}
            {!error && rows.length === 0 && (
              <div className="p-10 text-center text-on-surface-variant text-body-sm">
                {t('Chưa có giao dịch xuất/nhập.', 'No transactions yet.')}
              </div>
            )}
            {!error && rows.length > 0 && (
              <table className="w-full text-left border-collapse">
                <thead className="bg-background-subtle">
                  <tr>
                    <th className="p-md font-label-md text-label-md text-on-surface-variant border-b border-border-light uppercase tracking-wider">{t('Loại', 'Type')}</th>
                    <th className="p-md font-label-md text-label-md text-on-surface-variant border-b border-border-light text-right uppercase tracking-wider">{t('Số lượng', 'Qty')}</th>
                    <th className="p-md font-label-md text-label-md text-on-surface-variant border-b border-border-light uppercase tracking-wider">{t('Ngày', 'Date')}</th>
                    <th className="p-md font-label-md text-label-md text-on-surface-variant border-b border-border-light uppercase tracking-wider">{t('Ghi chú', 'Note')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                  {rows.map((row) => {
                    const meta = typeMeta[row.type] || typeMeta.in;
                    return (
                      <tr key={row.id || `${row.type}-${row.date}-${row.quantity}`} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${meta.badge}`}>
                            <span className="material-symbols-outlined text-[12px] mr-1">{row.type === 'out' ? 'outgoing' : 'incoming'}</span>
                            {meta[locale]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{Number(row.quantity) || 0}</td>
                        <td className="px-3 py-2.5">{formatDate(row.date || row.createdAt)}</td>
                        <td className="px-3 py-2.5 text-on-surface-variant max-w-[220px] truncate">{row.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

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
