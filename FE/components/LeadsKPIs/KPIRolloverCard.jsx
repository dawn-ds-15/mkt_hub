import { useState, useEffect } from 'react';
import { getKPIRollover } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { t } from '../../utils/i18n';

export default function KPIRolloverCard({ year, week }) {
  const { locale } = useDashboard();
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
        <p className="text-on-surface-variant text-sm">{t(locale, { vi: 'Đang tải...', en: 'Loading...' })}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-light overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">hdr_weak</span>
          {t(locale, { vi: `Cộng dồn KPI - Tuần ${week}`, en: `KPI Rollover - Week ${week}` })}
        </h3>
      </div>

      <div className="divide-y divide-border-light">
        {data.map((item, idx) => {
          const deficit = Math.max(0, item.weeklyTarget - item.currentActual);
          const totalTarget = item.weeklyTarget + deficit;

          return (
            <div key={idx} className="px-5 py-4 hover:bg-surface-container-lowest transition-colors">
              <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                {item.label === 'Cơ hội (OPP)' ? t(locale, { vi: 'OPP', en: 'OPP' }) :
                 item.label === 'Closed Deal' ? t(locale, { vi: 'Closed Deal', en: 'Closed Deal' }) :
                 item.label === 'Pipeline Value' ? t(locale, { vi: 'Giá trị Pipeline', en: 'Pipeline Value' }) :
                 item.label}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <div className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wide mb-1">
                    {t(locale, { vi: 'Mục tiêu gốc', en: 'Original Target' })}
                  </div>
                  <div className="text-lg font-bold text-on-surface">
                    {formatNum(item.weeklyTarget)}
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">
                    {t(locale, { vi: '/tuần', en: '/week' })}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-[10px] text-amber-700 font-medium uppercase tracking-wide mb-1">
                    {t(locale, { vi: 'Thiếu hụt tích lũy', en: 'Cumulative Deficit' })}
                  </div>
                  <div className="text-lg font-bold text-amber-600 flex items-center gap-1">
                    <span>+</span>{formatNum(deficit)}
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5">
                    {t(locale, { vi: 'Chuyển từ kỳ trước', en: 'Carried from prior' })}
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="text-[10px] text-primary font-medium uppercase tracking-wide mb-1">
                    {t(locale, { vi: 'Tổng mục tiêu kỳ này', en: 'Total Period Target' })}
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatNum(totalTarget)}
                  </div>
                  <div className="text-[10px] text-primary/70 mt-0.5">
                    {t(locale, { vi: 'Cần đạt được', en: 'Needs to be met' })}
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
