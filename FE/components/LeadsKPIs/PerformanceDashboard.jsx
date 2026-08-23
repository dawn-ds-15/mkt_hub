import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseOverview, getKpiCardsData, getProjects } from '../../services/api';

const NOW = new Date();
const CURRENT_YEAR = String(NOW.getFullYear());
const CURRENT_MONTH = String(NOW.getMonth() + 1).padStart(2, '0');
const CURRENT_QUARTER = Math.ceil((NOW.getMonth() + 1) / 3);

function pad(n) {
  return String(n).padStart(2, '0');
}

function periodParams(key) {
  if (key === 'year') return { type: 'year', value: CURRENT_YEAR, year: CURRENT_YEAR, periodString: CURRENT_YEAR };
  if (key === 'quarter') return { type: 'quarter', value: CURRENT_QUARTER, year: CURRENT_YEAR, periodString: `${CURRENT_YEAR}-Q${CURRENT_QUARTER}` };
  return { type: 'month', value: CURRENT_MONTH, year: CURRENT_YEAR, periodString: `${CURRENT_YEAR}-${CURRENT_MONTH}` };
}

function prevPeriodParams(key) {
  if (key === 'year') {
    const prevYear = String(Number(CURRENT_YEAR) - 1);
    return { type: 'year', value: prevYear, year: prevYear, periodString: prevYear };
  }
  if (key === 'quarter') {
    if (CURRENT_QUARTER > 1) return { type: 'quarter', value: CURRENT_QUARTER - 1, year: CURRENT_YEAR, periodString: `${CURRENT_YEAR}-Q${CURRENT_QUARTER - 1}` };
    const prevYear = String(Number(CURRENT_YEAR) - 1);
    return { type: 'quarter', value: 4, year: prevYear, periodString: `${prevYear}-Q4` };
  }
  const prev = NOW.getMonth() === 0 ? { y: Number(CURRENT_YEAR) - 1, m: 12 } : { y: Number(CURRENT_YEAR), m: NOW.getMonth() };
  return { type: 'month', value: pad(prev.m), year: String(prev.y), periodString: `${prev.y}-${pad(prev.m)}` };
}

function findCard(cards, label) {
  const c = (cards || []).find((k) => k.label === label);
  return c || { plan: 0, actual: 0 };
}

function formatMoney(n) {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

function formatCompactMoney(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return formatMoney(n);
}

function deltaPct(cur, prev) {
  if (!cur || !prev) return null;
  const d = ((cur - prev) / prev) * 100;
  return Math.abs(d) < 0.05 ? 0 : d;
}

const COMPARE_INDICATORS = [
  { key: 'Raw Leads', vi: 'Raw Leads', en: 'Raw Leads', money: false },
  { key: 'MQL', vi: 'MQL', en: 'MQL', money: false },
  { key: 'SQL', vi: 'SQL', en: 'SQL', money: false },
  { key: 'OPP', vi: 'OPP', en: 'OPP', money: false },
  { key: 'Closed Deal', vi: 'Closed Deal', en: 'Closed Deal', money: false },
  { key: 'Pipeline Value', vi: 'Giá trị Pipeline', en: 'Pipeline Value', money: true },
];

function projectStats(p, avgCac, t) {
  const sqlPlan = Number(p.kpiSqlPlan) || 0;
  const sqlActual = Number(p.kpiSqlActual) || 0;
  const ratio = sqlPlan > 0 ? sqlActual / sqlPlan : null;
  const projCac = sqlActual > 0 ? (p.actualCostDirect || 0) / sqlActual : null;
  const overCeiling = projCac != null && avgCac != null && projCac > avgCac * 1.2;
  let badge = { label: t({ vi: 'Đang chạy', en: 'Running' }), cls: 'bg-surface-variant text-on-surface-variant' };
  if (ratio != null && ratio >= 1) badge = { label: t({ vi: 'Đạt KPI', en: 'On target' }), cls: 'bg-success/10 text-success' };
  else if (ratio != null && ratio < 0.8) badge = { label: t({ vi: 'Cần chú ý', en: 'Attention' }), cls: 'bg-warning/10 text-warning' };
  return { sqlPlan, sqlActual, ratio, projCac, overCeiling, badge };
}

export default function PerformanceDashboard({ refreshKey, onViewAll }) {
  const { locale } = useDashboard();
  const t = (obj) => obj[locale] || obj.vi;

  const [projects, setProjects] = useState([]);
  const [kpiCards, setKpiCards] = useState([]);
  const [overview, setOverview] = useState(null);
  const [prevKpiCards, setPrevKpiCards] = useState([]);
  const [prevOverview, setPrevOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState('month');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showAllProjects, setShowAllProjects] = useState(false);

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch((e) => console.error('[PerformanceDashboard] getProjects:', e));
  }, []);

  useEffect(() => {
    setLoading(true);
    const cur = periodParams(periodKey);
    const prev = prevPeriodParams(periodKey);
    Promise.all([
      getKpiCardsData(cur.type, cur.value, cur.year),
      getExpenseOverview(cur.periodString),
      getKpiCardsData(prev.type, prev.value, prev.year),
      getExpenseOverview(prev.periodString),
    ])
      .then(([kpi, ov, pkpi, pov]) => {
        setKpiCards(Array.isArray(kpi.data) ? kpi.data : []);
        setOverview(ov.data);
        setPrevKpiCards(Array.isArray(pkpi.data) ? pkpi.data : []);
        setPrevOverview(pov.data);
      })
      .catch((e) => console.error('[PerformanceDashboard] load:', e))
      .finally(() => setLoading(false));
  }, [periodKey, refreshKey]);

  const cur = periodParams(periodKey);

  const closedDeal = findCard(kpiCards, 'Closed Deal');
  const wonValue = findCard(kpiCards, 'Won Value');
  const prevClosedDeal = findCard(prevKpiCards, 'Closed Deal');
  const prevWonValue = findCard(prevKpiCards, 'Won Value');

  const totalCost = Number(overview?.metrics?.totalExpense) || 0;
  const prevTotalCost = Number(prevOverview?.metrics?.totalExpense) || 0;

  const cac = totalCost > 0 && closedDeal.actual > 0 ? totalCost / closedDeal.actual : null;
  const prevCac = prevTotalCost > 0 && prevClosedDeal.actual > 0 ? prevTotalCost / prevClosedDeal.actual : null;
  const cacDelta = cac && prevCac ? deltaPct(cac, prevCac) : null;

  const roa = totalCost > 0 ? wonValue.actual / totalCost : null;
  const prevRoa = prevTotalCost > 0 ? prevWonValue.actual / prevTotalCost : null;
  const roaDelta = roa != null && prevRoa != null ? roa - prevRoa : null;

  const plan = Number(closedDeal.plan) || 0;
  const actual = Number(closedDeal.actual) || 0;
  const debt = Math.max(0, (Number(prevClosedDeal.plan) || 0) - (Number(prevClosedDeal.actual) || 0));
  const totalTarget = plan + debt;
  const progress = totalTarget > 0 ? Math.min(100, Math.round((actual / totalTarget) * 100)) : 0;

  const periodLabel = t({
    month: { vi: 'Tháng', en: 'Month' },
    quarter: { vi: 'Quý', en: 'Quarter' },
    year: { vi: 'Năm', en: 'Year' },
  });

  const avgCac = useMemo(() => {
    const withSql = projects.filter((p) => (p.kpiSqlActual || 0) > 0);
    if (!withSql.length) return null;
    const vals = withSql.map((p) => (p.actualCostDirect || 0) / p.kpiSqlActual);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [projects]);

  const filteredProjects = projectFilter === 'all' ? projects : projects.filter((p) => String(p.id) === projectFilter);

  const recentProjects = useMemo(() => {
    return [...filteredProjects]
      .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0))
      .slice(0, 5);
  }, [filteredProjects]);

  const selectCls =
    'appearance-none bg-surface-container-lowest border border-border-light text-[14px] leading-[20px] font-body-sm text-on-surface rounded-lg pl-3 pr-9 py-2 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-[24px] leading-[32px] font-semibold text-on-surface">{t({ vi: 'Hiệu suất KPI', en: 'KPI Performance' })}</h2>
          <p className="text-[14px] leading-[20px] text-on-surface-variant mt-1">
            {t({ vi: 'Theo dõi chỉ số CAC, ROA và tiến độ cộng dồn', en: 'Track CAC, ROA and cumulative progress' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-surface-container-lowest p-2 rounded-lg border border-border-light shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="relative">
            <select className={`${selectCls} w-48`} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">{t({ vi: 'Tất cả Dự án', en: 'All Projects' })}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
          </div>
          <div className="h-6 w-px bg-border-light" />
          <div className="relative">
            <select className={`${selectCls} w-32`} value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
              <option value="month">{t({ vi: 'Tháng này', en: 'This month' })}</option>
              <option value="quarter">{t({ vi: 'Quý này', en: 'This quarter' })}</option>
              <option value="year">{t({ vi: 'Năm nay', en: 'This year' })}</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* CAC Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-border-light p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[12px] leading-[16px] text-on-surface-variant uppercase tracking-wider mb-1">Customer Acquisition Cost (CAC)</div>
                  <div className="text-[24px] leading-[32px] font-semibold text-on-surface flex items-baseline gap-1">
                    <span className="font-data-mono tabular-nums">{cac != null ? formatMoney(cac) : '—'}</span>
                    <span className="text-[12px] leading-[16px] text-on-surface-variant">VND</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-secondary-fixed transition-colors">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-light">
                {cacDelta != null ? (
                  <span className={`flex items-center text-[12px] font-medium px-2 py-1 rounded ${cacDelta <= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                    <span className="material-symbols-outlined text-[14px] mr-1">{cacDelta <= 0 ? 'trending_down' : 'trending_up'}</span>
                    {cacDelta <= 0 ? '' : '+'}{cacDelta.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[12px] text-on-surface-variant">—</span>
                )}
                <span className="text-[12px] text-on-surface-variant">{t({ vi: 'so với kỳ trước', en: 'vs previous period' })}</span>
              </div>
              <div className="text-[12px] text-on-surface-variant mt-2">{t({ vi: 'Công thức: Tổng chi phí / Số deal chốt', en: 'Formula: Total cost / Closed deals' })}</div>
            </div>

            {/* ROA Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-border-light p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[12px] leading-[16px] text-on-surface-variant uppercase tracking-wider mb-1">Return on Ad Spend (ROA)</div>
                  <div className="text-[24px] leading-[32px] font-semibold text-on-surface flex items-baseline gap-1">
                    <span className="font-data-mono tabular-nums">{roa != null ? roa.toFixed(2) : '—'}</span>
                    <span className="text-[12px] leading-[16px] text-on-surface-variant">x</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-secondary-fixed transition-colors">
                  <span className="material-symbols-outlined">monitoring</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-light">
                {roaDelta != null ? (
                  <span className={`flex items-center text-[12px] font-medium px-2 py-1 rounded ${roaDelta >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                    <span className="material-symbols-outlined text-[14px] mr-1">{roaDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
                    {roaDelta >= 0 ? '+' : ''}{roaDelta.toFixed(1)}x
                  </span>
                ) : (
                  <span className="text-[12px] text-on-surface-variant">—</span>
                )}
                <span className="text-[12px] text-on-surface-variant">{t({ vi: 'so với kỳ trước', en: 'vs previous period' })}</span>
              </div>
              <div className="text-[12px] text-on-surface-variant mt-2">{t({ vi: 'Công thức: Doanh thu / Tổng chi phí', en: 'Formula: Revenue / Total cost' })}</div>
            </div>

            {/* Cumulative KPI Card (Highlight) */}
            <div className="bg-surface-container-lowest rounded-xl border-2 border-secondary-container p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-secondary-fixed-dim rounded-full opacity-20 blur-xl" />
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div>
                  <div className="text-[12px] leading-[16px] text-on-surface-variant uppercase tracking-wider mb-1">{t({ vi: `KPI Deal Cộng Dồn (${periodLabel})`, en: `Cumulative Deal KPI (${periodLabel})` })}</div>
                  <div className="text-[24px] leading-[32px] font-semibold text-on-surface tabular-nums">
                    {formatMoney(actual)} / {formatMoney(totalTarget)} Deal
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined">assignment_turned_in</span>
                </div>
              </div>
              <div className="relative z-10">
                <div className="flex justify-between text-[12px] text-on-surface-variant mb-1 mt-3">
                  <span>{t({ vi: 'Tiến độ', en: 'Progress' })}</span>
                  <span className="font-medium text-on-surface">{progress}%</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2 mb-3">
                  <div className="bg-secondary h-2 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="bg-surface-container-low p-2 rounded-lg border border-border-light">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-on-surface-variant">{t({ vi: 'Chỉ tiêu kỳ này:', en: 'This period target:' })}</span>
                    <span className="font-data-mono text-[12px] font-medium tabular-nums">{formatMoney(plan)} Deal</span>
                  </div>
                  {debt > 0 && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] text-warning flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">warning</span>{t({ vi: 'Nợ kỳ trước:', en: 'Carry-over debt:' })}
                      </span>
                      <span className="font-data-mono text-[12px] font-medium text-warning tabular-nums">+ {formatMoney(debt)} Deal</span>
                    </div>
                  )}
                  <div className="h-px bg-border-light w-full my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] font-semibold">{t({ vi: 'Tổng KPI cần đạt:', en: 'Total KPI target:' })}</span>
                    <span className="font-data-mono text-[12px] font-bold text-on-surface tabular-nums">{formatMoney(totalTarget)} Deal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Chart Area */}
            <div className="xl:col-span-2 bg-surface-container-lowest rounded-xl border border-border-light p-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{t({ vi: 'Kế hoạch vs Thực tế', en: 'Plan vs Actual' })}</h3>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-border-light" />
                    <span className="text-[12px] text-on-surface-variant">{t({ vi: 'Kế hoạch', en: 'Plan' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-secondary" />
                    <span className="text-[12px] text-on-surface-variant">{t({ vi: 'Thực tế', en: 'Actual' })}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                {COMPARE_INDICATORS.map((ind) => {
                  const card = findCard(kpiCards, ind.key);
                  const plan = Number(card.plan) || 0;
                  const actual = Number(card.actual) || 0;
                  const maxVal = Math.max(plan, actual, 1);
                  const planPct = Math.round((plan / maxVal) * 100);
                  const actualPct = Math.round((actual / maxVal) * 100);
                  const fmt = (n) => (ind.money ? formatCompactMoney(n) : formatMoney(n));
                  const reached = plan > 0 && actual >= plan;
                  return (
                    <div key={ind.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] leading-[18px] font-semibold text-on-surface">{t({ vi: ind.vi, en: ind.en })}</span>
                        <span className={`font-data-mono text-[12px] font-medium tabular-nums ${reached ? 'text-success' : plan > 0 ? 'text-warning' : 'text-on-surface-variant'}`}>
                          {fmt(actual)} <span className="text-on-surface-variant">/ {fmt(plan)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-9 text-[10px] text-on-surface-variant shrink-0">{t({ vi: 'KH', en: 'PL' })}</span>
                        <div className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-border-light rounded-full" style={{ width: `${planPct}%` }} />
                        </div>
                        <span className="w-10 text-right font-data-mono text-[11px] text-on-surface-variant shrink-0">{planPct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-9 text-[10px] text-secondary shrink-0">{t({ vi: 'TT', en: 'AC' })}</span>
                        <div className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${reached ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${actualPct}%` }} />
                        </div>
                        <span className="w-10 text-right font-data-mono text-[11px] text-on-surface-variant shrink-0">{actualPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Data List */}
            <div className="xl:col-span-1 bg-surface-container-lowest rounded-xl border border-border-light p-4 flex flex-col">
              <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface mb-4">{t({ vi: 'Chi tiết Dự án', en: 'Project Details' })}</h3>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {recentProjects.length === 0 && (
                    <p className="text-[14px] text-on-surface-variant py-6 text-center">{t({ vi: 'Chưa có dữ liệu dự án', en: 'No project data yet' })}</p>
                  )}
                  {recentProjects.map((p) => {
                    const { ratio, projCac, overCeiling, badge } = projectStats(p, avgCac, t);
                    return (
                      <div key={p.id} className={`p-2 rounded-lg border border-border-light hover:border-secondary-fixed transition-colors ${ratio != null && ratio < 0.8 ? 'bg-surface-container-high/30' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-[12px] leading-[16px] font-semibold text-on-surface">{p.name}</div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <div className="text-[10px] text-on-surface-variant">{t({ vi: 'CAC', en: 'CAC' })}</div>
                            <div className={`font-data-mono text-[12px] font-medium tabular-nums ${overCeiling ? 'text-danger' : ''}`}>
                              {projCac != null ? formatCompactMoney(projCac) + ' VND' : '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-on-surface-variant">{t({ vi: '% KPI', en: '% KPI' })}</div>
                            <div className={`font-data-mono text-[12px] font-medium tabular-nums ${ratio != null && ratio < 0.8 ? 'text-danger' : ''}`}>
                              {ratio != null ? Math.round(ratio * 100) + '%' : '—'}
                            </div>
                          </div>
                        </div>
                        {overCeiling && (
                          <div className="mt-2 text-[10px] text-warning flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">info</span>
                            {t({ vi: 'CAC cao hơn mức trần 20%', en: 'CAC exceeds the 20% ceiling' })}
                          </div>
                        )}
                        {ratio != null && ratio < 0.8 && !overCeiling && (
                          <div className="mt-2 text-[10px] text-warning flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">info</span>
                            {t({ vi: 'KPI đạt dưới 80% kế hoạch', en: 'KPI below 80% of plan' })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => setShowAllProjects(true)}
                className="w-full mt-4 pt-2 border-t border-border-light text-secondary text-[12px] hover:underline flex items-center justify-center gap-1"
              >
                {t({ vi: 'Xem tất cả dự án', en: 'View all projects' })} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </>
      )}

      {showAllProjects && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAllProjects(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl pointer-events-auto mx-4 p-6 space-y-5 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">{t({ vi: 'Tất cả Dự án', en: 'All Projects' })}</h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{t({ vi: 'Hiệu suất CAC, % KPI theo từng dự án', en: 'CAC and % KPI performance per project' })}</p>
                </div>
                <button onClick={() => setShowAllProjects(false)} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
              </div>
              <div className="overflow-auto flex-1">
                {filteredProjects.length === 0 && (
                  <p className="text-[14px] text-on-surface-variant py-10 text-center">{t({ vi: 'Chưa có dữ liệu dự án', en: 'No project data yet' })}</p>
                )}
                {filteredProjects.length > 0 && (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-background-subtle border-b border-border-light">
                      <tr>
                        <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium uppercase tracking-wider">{t({ vi: 'Dự án', en: 'Project' })}</th>
                        <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium uppercase tracking-wider text-right">{t({ vi: 'CAC', en: 'CAC' })}</th>
                        <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium uppercase tracking-wider text-right">{t({ vi: '% KPI', en: '% KPI' })}</th>
                        <th className="p-md font-label-md text-label-md text-on-surface-variant font-medium uppercase tracking-wider text-center">{t({ vi: 'Trạng thái', en: 'Status' })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light font-body-sm text-body-sm">
                      {[...filteredProjects]
                        .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0))
                        .map((p) => {
                          const { ratio, projCac, overCeiling, badge } = projectStats(p, avgCac, t);
                          return (
                            <tr key={p.id} className="hover:bg-surface-container-lowest">
                              <td className="p-md font-medium text-on-surface">{p.name}</td>
                              <td className={`p-md text-right font-data-mono tabular-nums ${overCeiling ? 'text-danger' : ''}`}>
                                {projCac != null ? formatCompactMoney(projCac) + ' VND' : '—'}
                              </td>
                              <td className={`p-md text-right font-data-mono tabular-nums ${ratio != null && ratio < 0.8 ? 'text-danger' : ''}`}>
                                {ratio != null ? Math.round(ratio * 100) + '%' : '—'}
                              </td>
                              <td className="p-md text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${badge.cls}`}>{badge.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex justify-end shrink-0">
                <button onClick={() => setShowAllProjects(false)} className="px-4 py-2 bg-surface-container-low text-on-surface rounded text-body-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer">
                  {t({ vi: 'Đóng', en: 'Close' })}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
