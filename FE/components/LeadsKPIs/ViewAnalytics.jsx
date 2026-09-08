import { useState, useEffect } from 'react';
import { getProjects, getKpiCardsData, getFunnelData, getClosedDeals, getPlanKPIs, getPipelineBySegment, getExpenseOverview } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { t } from '../../utils/i18n';

const PERIOD_TABS = [
  { key: 'week', vi: 'Tuần', en: 'Week' },
  { key: 'month', vi: 'Tháng', en: 'Month' },
  { key: 'year', vi: 'Năm', en: 'Year' },
];

function getPeriodOptions(periodType, year) {
  if (periodType === 'week') return Array.from({ length: 53 }, (_, i) => String(i + 1));
  if (periodType === 'month') return Array.from({ length: 12 }, (_, i) => String(i + 1));
  return Array.from({ length: 10 }, (_, i) => String((Number(year) || new Date().getFullYear()) - i));
}

function formatNum(n) {
  if (n == null) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatCurrency(n) {
  if (n == null) return '\u2014';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function pctColor(pct) {
  if (pct == null) return 'text-on-surface-variant';
  if (pct >= 100) return 'text-success';
  if (pct >= 80) return 'text-warning';
  return 'text-danger';
}

function isMetricHidden(metric) {
  if (!metric || typeof metric !== 'object') return false;
  if (metric.hidden === true || metric.isHidden === true) return true;
  if (metric.isActive === false || metric.visible === false || metric.isVisible === false) return true;
  if (metric.show === false || metric.display === false || metric.enabled === false) return true;
  return false;
}

function targetLabel(locale, target) {
  const map = {
    'Beat': t(locale, { vi: 'Vượt mục tiêu', en: 'Beat' }),
    'On Track': t(locale, { vi: 'Đúng tiến độ', en: 'On Track' }),
    'Baseline': t(locale, { vi: 'Đường cơ sở', en: 'Baseline' }),
  };
  return map[target] || target;
}

const SEGMENT_LABELS = {
  enterprise: { vi: 'Doanh nghiệp lớn', en: 'Enterprise' },
  mid_market: { vi: 'Tầm trung', en: 'Mid-Market' },
  smb: { vi: 'SMB', en: 'SMB' },
};

const QUARTERS = [1, 2, 3, 4];

function buildClosedQuarters(deals, year, yearlyTarget) {
  const perQ = { 1: { count: 0, revenue: 0 }, 2: { count: 0, revenue: 0 }, 3: { count: 0, revenue: 0 }, 4: { count: 0, revenue: 0 } };
  (deals || []).forEach((d) => {
    const m = /^(\d{4})-(\d{2})/.exec(d.signedDate || '');
    if (!m || m[1] !== String(year)) return;
    const q = Math.ceil(Number(m[2]) / 3);
    if (!perQ[q]) return;
    perQ[q].count += 1;
    perQ[q].revenue += Number(d.finalFees) || 0;
  });
  const now = new Date();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);
  const baseline = (Number(yearlyTarget) || 0) / 4;
  return QUARTERS.map((q) => {
    const { count, revenue } = perQ[q];
    const ratio = baseline > 0 ? count / baseline : null;
    let target = 'Baseline';
    let targetClass = 'bg-secondary/10 text-secondary';
    if (ratio != null && ratio >= 1) {
      target = 'Beat';
      targetClass = 'bg-success/10 text-success';
    } else if (ratio != null && ratio >= 0.8) {
      target = 'On Track';
      targetClass = 'bg-primary/10 text-primary';
    }
    const isCurrent = Number(year) === now.getFullYear() && q === curQ;
    return {
      quarter: `Q${q} ${year}${isCurrent ? ' (Current)' : ''}`,
      count,
      revenue,
      target,
      targetClass,
    };
  });
}

export default function ViewAnalytics({ year: propYear, periodType: propPeriodType, periodValue: propPeriodValue }) {
  const { locale } = useDashboard();
  const [kpiCards, setKpiCards] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [closedQuarters, setClosedQuarters] = useState([]);
  const [segments, setSegments] = useState([]);
  const [cac, setCac] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [year, setYear] = useState(propYear || String(new Date().getFullYear()));
  const [periodType, setPeriodType] = useState(propPeriodType || 'week');
  const [periodValue, setPeriodValue] = useState(propPeriodValue || '1');

  const [menuOpen, setMenuOpen] = useState(false);
  const periodOptions = getPeriodOptions(periodType, year);

  useEffect(() => {
    getProjects()
      .then((res) => { const list = Array.isArray(res.data) ? res.data : []; setProjects(list); })
      .catch(() => {});
  }, []);

  const handleChangePeriodType = (type) => {
    setPeriodType(type);
    const now = new Date();
    if (type === 'week') setPeriodValue('1');
    else if (type === 'month') setPeriodValue(String(now.getMonth() + 1));
    else if (type === 'year') setPeriodValue(year);
  };

  const exportCSV = (rows, filename, columns) => {
    const header = columns.map(c => c.label).join(',');
    const body = rows.map(r => columns.map(c => (typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadData();
  }, [year, periodType, periodValue, projectId]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const pid = projectId || undefined;
    try {
      const [kpiRes, funnelRes] = await Promise.all([
        getKpiCardsData(periodType, periodValue, year, pid),
        getFunnelData(periodType, periodValue, year, pid),
      ]);
      setKpiCards(kpiRes.data);
      setFunnel(funnelRes.data);
      let deals = [];
      let planData = null;
      try {
        deals = (await getClosedDeals(pid)).data || [];
      } catch { /* ignore */ }
      try {
        planData = (await getPlanKPIs(year)).data;
      } catch { /* ignore */ }
      setClosedQuarters(buildClosedQuarters(deals, year, planData?.closedDealCount));
      let segData = [];
      try {
        segData = (await getPipelineBySegment(periodType, periodValue, year, pid)).data || [];
      } catch { /* ignore */ }
      setSegments(segData);
      try {
        const expensePeriod = periodType === 'month'
          ? `${year}-${String(periodValue).padStart(2, '0')}`
          : periodType === 'week' ? `${year}-W${periodValue}` : String(year);
        const ov = (await getExpenseOverview(expensePeriod)).data;
        setCac(ov?.metrics?.cac != null ? Number(ov.metrics.cac) : null);
      } catch { setCac(null); }
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || t(locale, { vi: 'Không thể tải dữ liệu phân tích', en: 'Unable to load analytics data' });
      setLoadError(Array.isArray(msg) ? msg.join('; ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !kpiCards.length && !funnel.length && !loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">{t(locale, { vi: 'Đang tải dữ liệu...', en: 'Loading data...' })}</p>
      </div>
    );
  }

  const kpiDisplayLabels = {
    'Raw Leads': t(locale, { vi: 'RAW LEADS', en: 'RAW LEADS' }),
    'MQL': 'MQL',
    'SQL': 'SQL',
    'OPP': 'OPP',
    'Closed Deal': t(locale, { vi: 'CLOSED DEAL', en: 'CLOSED DEAL' }),
    'Pipeline Value': t(locale, { vi: 'PIPELINE VALUE', en: 'PIPELINE VALUE' }),
    'Won Value': t(locale, { vi: 'WON VALUE', en: 'WON VALUE' }),
  };

  const kpiConvLabel = {
    'Raw Leads': t(locale, { vi: 'Conv to MQL', en: 'Conv to MQL' }),
    'MQL': t(locale, { vi: 'Conv to SQL', en: 'Conv to SQL' }),
    'SQL': t(locale, { vi: 'Conv to OPP', en: 'Conv to OPP' }),
    'OPP': t(locale, { vi: 'Conv to Won', en: 'Conv to Won' }),
  };

  function formatFullCurrency(n) {
    n = n ?? 0;
    return Number(n).toLocaleString('vi-VN');
  }

  const funnelSteps = funnel.length
    ? funnel.map((f) => ({ ...f })).filter((f) => !isMetricHidden(f))
    : [];

  return (
    <div className="space-y-6">
      {/* Filter bar: Project + Period */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-border-light rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-on-surface-variant whitespace-nowrap">{t(locale, { vi: 'Dự án:', en: 'Project:' })}</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-border-light rounded px-2 py-1.5 text-[12px] text-on-surface bg-white focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">{t(locale, { vi: 'Toàn hệ thống', en: 'All projects' })}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleChangePeriodType(tab.key)}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-colors ${periodType === tab.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              {tab[locale]}
            </button>
          ))}
          {periodOptions.length > 0 && (
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border-light">
              <select
                value={periodType === 'year' ? year : periodValue}
                onChange={(e) => {
                  if (periodType === 'year') setYear(e.target.value);
                  else setPeriodValue(e.target.value);
                }}
                className="border border-border-light rounded px-1.5 py-1 text-[12px] text-on-surface bg-white focus:ring-1 focus:ring-primary outline-none"
              >
                {periodOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {periodType !== 'year' && (
                <span className="text-[11px] text-on-surface-variant font-medium ml-0.5 whitespace-nowrap">/ {year}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border-l-4 border-danger p-4 rounded flex items-start gap-3">
          <span className="material-symbols-outlined text-danger mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-body-sm text-red-800">{loadError}</p>
            <button onClick={loadData} className="mt-2 text-body-xs text-red-700 underline hover:no-underline">{t(locale, { vi: 'Thử lại', en: 'Retry' })}</button>
          </div>
        </div>
      )}

      {/* Row 1: KPI Cards — tất cả nằm trên cùng một dòng, không scroll */}
      <div className="grid grid-flow-col auto-cols-[minmax(0,1fr)] gap-3">
        {kpiCards.filter(k => k.label !== 'CAC / LTV' && k.label !== 'CAC/LTV' && k.label !== 'CAC' && k.label !== 'LTV' && !isMetricHidden(k)).map((kpi) => {
          const pct = kpi.percentVsPlan;
          const isCurrency = kpi.label === 'Pipeline Value' || kpi.label === 'Won Value';
          const planVal = isCurrency ? formatCurrency(kpi.plan) : formatNum(kpi.plan);
          const hasConv = kpi.label === 'Raw Leads' || kpi.label === 'MQL' || kpi.label === 'SQL' || kpi.label === 'OPP';
          return (
            <div key={kpi.label} className="min-w-0 bg-white border border-border-light rounded-lg p-4 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                  {kpiDisplayLabels[kpi.label] || kpi.label.toUpperCase()}
                </h3>
                <span className="material-symbols-outlined text-on-surface-variant text-base">
                  {kpi.label === 'Raw Leads' ? 'groups' : kpi.label === 'MQL' ? 'filter_alt' : kpi.label === 'SQL' ? 'fact_check' : kpi.label === 'OPP' ? 'lightbulb' : kpi.label === 'Closed Deal' ? 'handshake' : kpi.label === 'Pipeline Value' ? 'monetization_on' : 'account_balance_wallet'}
                </span>
              </div>
              <div className="mb-2">
                <span className="text-[28px] leading-[34px] font-bold text-on-surface">
                  {isCurrency ? formatCurrency(kpi.actual) : formatNum(kpi.actual)}
                </span>
                <span className="text-[12px] text-on-surface-variant ml-1">/ {planVal}</span>
              </div>
              <div className={`flex items-center mt-auto pt-3 border-t border-border-light ${hasConv ? 'justify-between' : ''}`}>
                <div className={`flex items-center ${pctColor(pct)}`}>
                  <span className="material-symbols-outlined text-sm mr-1">{pct != null && pct > 100 ? 'arrow_upward' : pct != null && pct < 100 ? 'arrow_downward' : 'remove'}</span>
                  <span className="text-[12px] font-bold">{pct != null ? Math.round(pct) + '%' : '—'}</span>
                  <span className="text-[12px] text-on-surface-variant ml-1">{t(locale, { vi: 'vs Plan', en: 'vs Plan' })}</span>
                </div>
                {hasConv && (
                  <div className="text-right">
                    <span className="text-[12px] text-on-surface-variant block">{kpiConvLabel[kpi.label] || '\u2014'}</span>
                    <span className="text-[12px] font-bold text-on-surface">
                      {kpi.convPct != null ? kpi.convPct + '%' : '\u2014'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Health Metrics Row: chỉ hiển thị CAC (đã bỏ LTV, LTV:CAC) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-border-light rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">CAC</p>
            <p className="text-headline-sm font-bold text-on-surface">
              {cac != null ? formatFullCurrency(Math.round(cac)) : '\u2014'} <span className="text-[12px] text-on-surface-variant font-normal">{t(locale, { vi: 'VNĐ/khách', en: 'VND/customer' })}</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">trending_down</span>
          </div>
        </div>
      </div>

      {/* Bento Grid: Funnel + Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Funnel Chart (8 cols) */}
        <section className="lg:col-span-8 bg-white border border-border-light rounded-lg p-5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-headline-sm font-semibold text-on-surface">{t(locale, { vi: 'Conversion Funnel', en: 'Conversion Funnel' })}</h3>
          </div>

          {funnelSteps.length > 0 && (
            <div className="space-y-6">
              {funnelSteps.map((step, idx) => {
                const baseline = funnelSteps[0]?.actual || 1;
                const barWidth = ((step.actual || 0) / baseline) * 100;
                const pct = step.plan > 0 ? ((step.actual || 0) / step.plan) * 100 : null;
                const isFirst = idx === 0;
                const stepLabel = step.step === 'Raw Leads' ? t(locale, { vi: 'Raw Leads', en: 'Raw Leads' }) :
                  step.step === 'MQL' ? 'MQL' :
                  step.step === 'SQL' ? 'SQL' :
                  step.step === 'OPP' ? 'OPP' :
                  step.step === 'Closed Deal' ? t(locale, { vi: 'Closed Deal', en: 'Closed Deal' }) :
                  step.step;
                const prevLabel = idx > 0
                  ? (funnelSteps[idx - 1].step === 'Raw Leads'
                      ? t(locale, { vi: 'Raw Leads', en: 'Raw Leads' })
                      : funnelSteps[idx - 1].step === 'MQL' ? 'MQL'
                        : funnelSteps[idx - 1].step === 'SQL' ? 'SQL'
                          : funnelSteps[idx - 1].step === 'OPP' ? 'OPP'
                            : funnelSteps[idx - 1].step)
                  : '';
                return (
                  <div key={step.step} className="relative group">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[12px] font-bold text-on-surface">{stepLabel}</span>
                      <div className="text-right">
                        <span className="text-[14px] font-medium text-on-surface">{formatNum(step.actual)}</span>
                        <span className="text-[12px] text-on-surface-variant mx-1">/</span>
                        <span className="text-[14px] font-medium text-on-surface-variant">{formatNum(step.plan)}</span>
                      </div>
                    </div>
                    <div className="h-8 bg-surface-container rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md transition-all duration-300 ${isFirst ? 'bg-primary' : 'bg-secondary'}`}
                        style={{ width: `${Math.min(Math.max(barWidth, 1.5), 100)}%` }}
                      />
                      {isFirst && pct != null && (
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                          <span className="text-[11px] font-bold text-on-primary whitespace-nowrap">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      )}
                      {!isFirst && step.convPct != null && (
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                          <span className="text-[11px] font-bold text-on-primary whitespace-nowrap">
                            {Math.round(step.convPct)}% {t(locale, { vi: 'cđ.', en: 'conv.' })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-1 flex justify-between items-center">
                      <span className="text-[12px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isFirst && step.convPct != null
                          ? `${Math.round(step.convPct)}% ${t(locale, { vi: 'từ', en: 'from' })} ${prevLabel}`
                          : ''}
                      </span>
                      <span className={`text-[12px] font-semibold ${pctColor(pct)}`}>
                        {pct != null ? `${Math.round(pct)}% ${t(locale, { vi: 'vs Plan', en: 'vs Plan' })}` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tables (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Pipeline Value by Segment */}
          <div className="bg-white border border-border-light rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border-light flex justify-between items-center relative">
              <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">{t(locale, { vi: 'Pipeline Value (OPP)', en: 'Pipeline Value (OPP)' })}</h4>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px] cursor-pointer hover:text-primary relative" onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}>more_horiz</span>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute top-full right-2 mt-1 bg-white border border-border-light rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (!segments.length) {
                          alert(t(locale, { vi: 'Chưa có dữ liệu phân khúc để xuất', en: 'No segment data to export yet' }));
                          return;
                        }
                        exportCSV(segments, 'pipeline-by-segment.csv', [
                          { key: 'segment', label: t(locale, { vi: 'Phân khúc', en: 'Segment' }), value: (r) => SEGMENT_LABELS[r.segment]?.en || r.segment },
                          { key: 'openDeals', label: t(locale, { vi: 'Deal đang mở', en: 'Open deals' }) },
                          { key: 'value', label: t(locale, { vi: 'Giá trị', en: 'Value' }) },
                          { key: 'growthPct', label: t(locale, { vi: 'Tăng trưởng %', en: 'Growth %' }) },
                        ]);
                      }}
                      className="w-full px-4 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">file_download</span>
                      {t(locale, { vi: 'Xuất CSV', en: 'Export CSV' })}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); alert(t(locale, { vi: 'Tính năng đang phát triển', en: 'Feature in development' })); }}
                      className="w-full px-4 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      {t(locale, { vi: 'Xem chi tiết', en: 'View details' })}
                    </button>
                  </div>
                </>
              )}
            </div>
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border-light">
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'SEGMENT', en: 'SEGMENT' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'COUNT', en: 'COUNT' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'VALUE', en: 'VALUE' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'GROWTH', en: 'GROWTH' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {segments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-body-sm text-on-surface-variant italic">
                      {t(locale, { vi: 'Không có deal đang mở trong kỳ này.', en: 'No open deals in this period.' })}
                    </td>
                  </tr>
                ) : segments.map((s) => (
                  <tr key={s.segment} className="hover:bg-surface-container transition-colors">
                    <td className="px-3 py-2.5 text-body-sm text-on-surface">{SEGMENT_LABELS[s.segment]?.[locale] || s.segment}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{Number(s.openDeals) || 0}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{formatCurrency(s.value)}</td>
                    <td className={`px-3 py-2.5 text-data-mono text-right font-semibold ${pctColor((Number(s.growthPct) || 0) + 100)}`}>
                      {s.growthPct != null ? `${Math.round(s.growthPct)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Won Value by Segment */}
          <div className="bg-white border border-border-light rounded-lg overflow-hidden border-t-4 border-t-success">
            <div className="p-4 border-b border-border-light flex justify-between items-center">
              <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">{t(locale, { vi: 'Won Value', en: 'Won Value' })}</h4>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px] cursor-pointer hover:text-primary" onClick={() => exportCSV(closedQuarters, 'closed-deals.csv', [{ key: 'quarter', label: t(locale, { vi: 'Quý', en: 'Quarter' }) }, { key: 'count', label: t(locale, { vi: 'Số lượng thắng', en: 'Won Count' }) }, { key: 'revenue', label: t(locale, { vi: 'Doanh thu', en: 'Revenue' }) }, { key: 'target', label: t(locale, { vi: 'so với Mục tiêu', en: 'vs Target' }), value: (r) => targetLabel(locale, r.target) }])}>download</span>
            </div>
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border-light">
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'QUÝ', en: 'QUARTER' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'WON COUNT', en: 'WON COUNT' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'REVENUE', en: 'REVENUE' })}</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'VS TARGET', en: 'VS TARGET' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {closedQuarters.map((row) => (
                  <tr key={row.quarter} className="hover:bg-surface-container transition-colors">
                    <td className="px-3 py-2.5 text-body-sm text-on-surface">{row.quarter}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{row.count}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${row.targetClass}`}>{targetLabel(locale, row.target)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
