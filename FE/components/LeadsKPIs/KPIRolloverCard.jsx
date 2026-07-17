import { useState, useEffect } from 'react';
import { getKPIRollover } from '../../services/api';

export default function KPIRolloverCard({ year, week }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (year && week) {
      loadData();
    }
  }, [year, week]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getKPIRollover(year, week);
      setData(response.data);
    } catch (error) {
      console.error('Error loading KPI rollover:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNum = (n) => Number(n).toLocaleString();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border-light p-5">
        <p className="text-on-surface-variant text-sm">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-light overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">hdr_weak</span>
          Cộng dồn KPI - Tuần {week}
        </h3>
      </div>

      <div className="divide-y divide-border-light">
        {data.map((item, idx) => {
          const deficit = Math.max(0, item.weeklyTarget - item.currentActual);
          const totalTarget = item.weeklyTarget + deficit;

          return (
            <div key={idx} className="px-5 py-4 hover:bg-surface-container-lowest transition-colors">
              <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                {item.label === 'Cơ hội (OPP)' ? 'OPP' :
                 item.label === 'Closed Deal' ? 'Closed Deal' :
                 item.label === 'Pipeline Value' ? 'Giá trị Pipeline' :
                 item.label}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <div className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wide mb-1">
                    Mục tiêu gốc
                  </div>
                  <div className="text-lg font-bold text-on-surface">
                    {formatNum(item.weeklyTarget)}
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">
                    /tuần
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-[10px] text-amber-700 font-medium uppercase tracking-wide mb-1">
                    Thiếu hụt tích lũy
                  </div>
                  <div className="text-lg font-bold text-amber-600 flex items-center gap-1">
                    <span>+</span>{formatNum(deficit)}
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5">
                    Chuyển từ kỳ trước
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="text-[10px] text-primary font-medium uppercase tracking-wide mb-1">
                    Tổng mục tiêu kỳ này
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatNum(totalTarget)}
                  </div>
                  <div className="text-[10px] text-primary/70 mt-0.5">
                    Cần đạt được
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
