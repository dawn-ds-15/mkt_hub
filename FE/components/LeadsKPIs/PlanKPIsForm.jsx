import { useState, useEffect } from 'react';
import { getPlanKPIs } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';

const years = [2024, 2025, 2026];

function MetricTile({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">{label}</label>
      <div className="bg-surface-container rounded-md px-3 py-2 text-data-display text-on-surface font-bold tabular-nums">
        {Number(value || 0).toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

export default function PlanKPIsForm() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPlanKPIs(selectedYear)
      .then((r) => {
        if (!cancelled) setPlan(r.data || {});
      })
      .catch((e) => {
        console.error('Error loading plan KPIs:', e);
        if (!cancelled) setPlan({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  return (
    <section className="lg:col-span-4 w-full bg-white border border-border-light p-6 rounded-lg flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">ads_click</span>
          {t('Kế hoạch KPIs', 'KPI Plan')}
        </h3>
        <select
          className="bg-surface-container-low text-body-sm border border-border-light rounded px-2 py-1 focus:ring-primary focus:border-primary"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map(year => (
            <option key={year} value={year}>{t(`Năm ${year}`, `Year ${year}`)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-sm gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          {t('Đang tải...', 'Loading...')}
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1">
          <MetricTile label={t('Mục tiêu Raw Leads', 'Raw Leads Target')} value={plan?.targetLeads} />
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label={t('Mục tiêu MQL', 'MQL Target')} value={plan?.mqlTarget} />
            <MetricTile label={t('Mục tiêu SQL', 'SQL Target')} value={plan?.sqlTarget} />
          </div>
          <MetricTile label={t('Số lượng Cơ hội (OPP)', 'Opportunities (OPP)')} value={plan?.opportunityCount} />
          <MetricTile label={t('Số lượng Closed Deal', 'Closed Deal Count')} value={plan?.closedDealCount} />
          <MetricTile label={t('Giá trị Pipeline', 'Pipeline Value')} value={plan?.pipelineValue} />
          <MetricTile label={t('Giá trị Won', 'Won Value')} value={plan?.wonValue} />
        </div>
      )}
    </section>
  );
}
