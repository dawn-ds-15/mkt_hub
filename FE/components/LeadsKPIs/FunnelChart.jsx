import { useState, useEffect } from 'react';
import { getFunnelData } from '../../services/api';

const funnelStages = [
  { key: 'Raw Leads', label: 'Raw Leads', color: 'bg-primary' },
  { key: 'MQL', label: 'MQL', color: 'bg-secondary' },
  { key: 'SQL', label: 'SQL', color: 'bg-secondary-container' },
  { key: 'OPP', label: 'OPP', color: 'bg-surface-tint' },
  { key: 'Closed Deal', label: 'Closed Deal', color: 'bg-success' },
];

export default function FunnelChart({ year, periodType, periodValue }) {
  const [funnel, setFunnel] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFunnel();
  }, [year, periodType, periodValue]);

  const loadFunnel = async () => {
    setLoading(true);
    try {
      const response = await getFunnelData(periodType, periodValue, year);
      setFunnel(response.data);
    } catch (error) {
      console.error('Error loading funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!funnel.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <span className="material-symbols-outlined text-4xl text-outline">funnel</span>
          <p className="text-on-surface-variant">Chưa có dữ liệu phễu</p>
        </div>
      </div>
    );
  }

  const maxValue = funnel[0]?.actual || 1;

  return (
    <div className="bg-white rounded-xl border border-border-light overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">funnel</span>
          Biểu đồ Phễu Chuyển Đổi
        </h3>
      </div>

      <div className="px-6 py-5">
        <div className="flex flex-col items-center gap-0">
          {funnel.map((item, idx) => {
            const widthPercent = maxValue > 0 ? (item.actual / maxValue) * 100 : 0;
            const stageMeta = funnelStages[idx] || funnelStages[0];
            const convRate = item.convPct;

            return (
              <div key={item.step || idx} className="w-full">
                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="relative w-full flex justify-center">
                    <div
                      className={`${stageMeta.color} rounded-lg flex items-center justify-center text-white font-bold text-sm transition-all duration-500`}
                      style={{
                        width: `${Math.max(widthPercent, 15)}%`,
                        height: '52px',
                        clipPath: idx > 0 && idx < funnel.length - 1
                          ? 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)'
                          : idx === 0
                            ? 'polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)'
                            : 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
                      }}
                    >
                      <div className="text-center">
                        <div className="text-[13px] font-bold">{(item.actual ?? 0).toLocaleString()}</div>
                        <div className="text-[10px] opacity-80">{stageMeta.label}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {idx < funnel.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-low border border-border-light">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {stageMeta.label} {'→'} {funnelStages[idx + 1]?.label}
                      </span>
                      <span className={`text-[13px] font-bold ${getConvColor(convRate)}`}>
                        {convRate != null ? `${convRate}%` : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getConvColor(rate) {
  if (rate == null) return 'text-gray-400';
  if (rate >= 50) return 'text-success';
  if (rate >= 30) return 'text-warning';
  return 'text-danger';
}
