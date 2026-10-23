import { useState, useEffect } from 'react';
import { getProjects, getKpiCardsData, getFunnelData, getClosedDealsRaw, getPlanKPIs, getProjectKPIPlan, getPipelineBySegment, getOpportunities } from '../../services/api';
import { periodRange, dealValue } from '../../utils/marketingCostMetrics';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDropdownOptions } from '../../hooks/useDropdownOptions';
import { t } from '../../utils/i18n';

const PERIOD_TABS = [
  { key: 'week', vi: 'Tuần', en: 'Week' },
  { key: 'month', vi: 'Tháng', en: 'Month' },
  { key: 'quarter', vi: 'Quý', en: 'Quarter' },
  { key: 'year', vi: 'Năm', en: 'Year' },
];

function getISOWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getPeriodOptions(periodType, year) {
  if (periodType === 'week') return Array.from({ length: 53 }, (_, i) => String(i + 1));
  if (periodType === 'month') return Array.from({ length: 12 }, (_, i) => String(i + 1));
  if (periodType === 'quarter') return ['1', '2', '3', '4'];
  return Array.from({ length: 10 }, (_, i) => String((Number(year) || new Date().getFullYear()) - i));
}

function getCurrentPeriodValue(periodType) {
  const now = new Date();
  switch (periodType) {
    case 'week': return String(getISOWeek(now));
    case 'month': return String(now.getMonth() + 1);
    case 'quarter': return String(Math.ceil((now.getMonth() + 1) / 3));
    default: return String(now.getFullYear());
  }
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

const isCacCard = (metric) => String(metric?.label || '').trim().toUpperCase() === 'CAC';

// Thẻ ROA/ROAS do BE trả trong kpi-cards (label 'ROA') — hiển thị ở hàng Health Metrics cạnh CAC
function isRoaCard(metric) {
  const l = String(metric?.label || '').trim().toUpperCase();
  return l === 'ROA' || l === 'ROAS';
}

function targetLabel(locale, target) {
  const map = {
    'Beat': t(locale, { vi: 'Vượt mục tiêu', en: 'Beat' }),
    'On Track': t(locale, { vi: 'Đúng tiến độ', en: 'On Track' }),
    'Below': t(locale, { vi: 'Dưới mục tiêu', en: 'Below target' }),
    'No KPI': t(locale, { vi: 'Chưa có KPI', en: 'No KPI' }),
  };
  return map[target] || target;
}

const QUARTERS = [1, 2, 3, 4];

// Won deal theo quý ký hợp đồng. Mục tiêu quý = KPI Closed Deal cả năm / 4 (KPI dự án nếu đang lọc dự án).
// So với mục tiêu: ≥ 100% "Vượt mục tiêu", 80–99% "Đúng tiến độ", < 80% "Dưới mục tiêu", chưa đặt KPI → "Chưa có KPI".
function buildClosedQuarters(deals, year, yearlyTarget) {
  const perQ = { 1: { count: 0, revenue: 0 }, 2: { count: 0, revenue: 0 }, 3: { count: 0, revenue: 0 }, 4: { count: 0, revenue: 0 } };
  (deals || []).forEach((d) => {
    const m = /^(\d{4})-(\d{2})/.exec(d.closedDate || d.signedDate || '');
    if (!m || m[1] !== String(year)) return;
    const q = Math.ceil(Number(m[2]) / 3);
    if (!perQ[q]) return;
    perQ[q].count += 1;
    perQ[q].revenue += dealValue(d);
  });
  const now = new Date();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);
  const quarterTarget = (Number(yearlyTarget) || 0) / 4;
  return QUARTERS.map((q) => {
    const { count, revenue } = perQ[q];
    const ratio = quarterTarget > 0 ? count / quarterTarget : null;
    let target = 'No KPI';
    let targetClass = 'bg-surface-container text-on-surface-variant';
    if (ratio != null && ratio >= 1) {
      target = 'Beat';
      targetClass = 'bg-success/10 text-success';
    } else if (ratio != null && ratio >= 0.8) {
      target = 'On Track';
      targetClass = 'bg-primary/10 text-primary';
    } else if (ratio != null) {
      target = 'Below';
      targetClass = 'bg-danger/10 text-danger';
    }
    const isCurrent = Number(year) === now.getFullYear() && q === curQ;
    return {
      quarter: `Q${q} ${year}${isCurrent ? ' (Current)' : ''}`,
      count,
      revenue,
      quarterTarget,
      ratioPct: ratio != null ? Math.round(ratio * 100) : null,
      target,
      targetClass,
    };
  });
}

function effectiveOppDateStr(opp) {
  if (opp?.initiationDate) return opp.initiationDate;
  if (opp?.createdAt) return String(opp.createdAt).slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function oppInPeriod(opp, periodType, periodValue, year) {
  const d = new Date(effectiveOppDateStr(opp));
  if (Number.isNaN(d.getTime())) return false;
  if (String(d.getFullYear()) !== String(year)) return false;
  const pv = Number(periodValue);
  if (periodType === 'week') return getISOWeek(d) === pv;
  if (periodType === 'month') return d.getMonth() + 1 === pv;
  if (periodType === 'quarter') return Math.ceil((d.getMonth() + 1) / 3) === pv;
  return true;
}

function prevPeriodKey(periodType, periodValue, year) {
  const pv = Number(periodValue);
  let y = Number(year);
  if (periodType === 'week') {
    let w = pv - 1;
    if (w < 1) { w = 52; y -= 1; }
    return { periodType: 'week', periodValue: String(w), year: String(y) };
  }
  if (periodType === 'month') {
    let m = pv - 1;
    if (m < 1) { m = 12; y -= 1; }
    return { periodType: 'month', periodValue: String(m), year: String(y) };
  }
  if (periodType === 'quarter') {
    let q = pv - 1;
    if (q < 1) { q = 4; y -= 1; }
    return { periodType: 'quarter', periodValue: String(q), year: String(y) };
  }
  return { periodType: 'year', periodValue: String(pv - 1), year: String(pv - 1) };
}

function buildSizeOptions(companySizeOpts) {
  return companySizeOpts.length > 0
    ? companySizeOpts.map(o => ({ value: o.label, label: o.label }))
    : [{ value: 'S', label: 'S (Enterprise)' }, { value: 'M', label: 'M (Medium)' }, { value: 'L', label: 'L (Enterprise)' }];
}

function sizeDisplayLabel(size, sizeOptions) {
  const opts = sizeOptions.length ? sizeOptions : buildSizeOptions([]);
  if (!size) return opts[0].label;
  const exact = opts.find(o => o.value === size || o.label === size);
  if (exact) return exact.label;
  const s = String(size).toLowerCase();
  for (const o of opts) {
    const v = String(o.value).toLowerCase();
    if (s && (v.includes(s) || s.includes(v))) return o.label;
    const l = String(o.label).toLowerCase();
    if (s && (l.includes(s) || l.includes(v))) return o.label;
  }
  return String(size);
}

function buildSegmentsFromOpps(opps, sizeOptions, periodType, periodValue, year) {
  const opts = sizeOptions.length ? sizeOptions : buildSizeOptions([]);
  const cur = {};
  const prev = {};
  opts.forEach((o) => {
    cur[o.label] = { openDeals: 0, value: 0 };
    prev[o.label] = 0;
  });
  const prevKey = prevPeriodKey(periodType, periodValue, year);
  (opps || []).forEach((o) => {
    const st = String(o.status || 'active').toLowerCase();
    if (st !== 'active' && st !== 'open') return;
    const key = sizeDisplayLabel(o.size, opts);
    if (!(key in cur)) cur[key] = { openDeals: 0, value: 0 };
    if (!(key in prev)) prev[key] = 0;
    if (oppInPeriod(o, periodType, periodValue, year)) {
      cur[key].openDeals += 1;
      cur[key].value += Number(o.fees) || 0;
    }
    if (oppInPeriod(o, prevKey.periodType, prevKey.periodValue, prevKey.year)) prev[key] += 1;
  });
  return opts.map((o) => {
    const c = (cur[o.label] || { openDeals: 0 }).openDeals;
    const p = prev[o.label] || 0;
    let growthPct = 0;
    if (p === 0 && c > 0) growthPct = 100;
    else if (p > 0) growthPct = Math.round(((c - p) / p) * 100);
    return { segment: o.label, openDeals: c, prevDeals: p, value: (cur[o.label] || { value: 0 }).value || 0, growthPct };
  });
}

export default function ViewAnalytics({ year: propYear, periodType: propPeriodType, periodValue: propPeriodValue }) {
  const { locale } = useDashboard();
  const sizeOptions = buildSizeOptions(useDropdownOptions('company_size'));
  const [kpiCards, setKpiCards] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [closedQuarters, setClosedQuarters] = useState([]);
  const [segments, setSegments] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [year, setYear] = useState(propYear || String(new Date().getFullYear()));
  const [periodType, setPeriodType] = useState(propPeriodType || 'week');
  const [periodValue, setPeriodValue] = useState(propPeriodValue || getCurrentPeriodValue(periodType || 'week'));

  const [menuOpen, setMenuOpen] = useState(false);
  const periodOptions = getPeriodOptions(periodType, year);

  useEffect(() => {
    getProjects()
      .then((res) => { const list = Array.isArray(res.data) ? res.data : []; setProjects(list); })
      .catch(() => {});
  }, []);

  const handleChangePeriodType = (type) => {
    setPeriodType(type);
    if (type === 'year') setPeriodValue(year);
    else setPeriodValue(getCurrentPeriodValue(type));
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
      setFunnel(funnelRes.data);
      let deals = [];
      let planData = null;
      let projectPlan = null;
      try {
        deals = ((await getClosedDealsRaw()).data || []).filter((d) => !pid || d.projectId === pid);
      } catch { /* ignore */ }
      try {
        planData = (await getPlanKPIs(year)).data;
      } catch { /* ignore */ }
      if (pid) {
        try { projectPlan = (await getProjectKPIPlan(year, pid)).data; } catch { /* ignore */ }
      }
      setClosedQuarters(buildClosedQuarters(deals, year, pid ? projectPlan?.closedCount : planData?.closedDealCount));
      // Won Value theo đúng kỳ đang lọc (ngày ký); KPI năm chia đều cho tuần / tháng / quý
      const range = periodRange({ year, type: periodType, value: periodType === 'year' ? year : periodValue });
      const wonValueTotal = deals
        .filter((d) => {
          const sd = String(d.closedDate || d.signedDate || '').slice(0, 10);
          return sd && sd >= range.from && sd <= range.to;
        })
        .reduce((sum, d) => sum + dealValue(d), 0);
      const periodsPerYear = { week: 52, month: 12, quarter: 4, year: 1 }[periodType] || 1;
      const wonPlan = !pid && Number(planData?.wonValue) ? Number(planData.wonValue) / periodsPerYear : null;
      const apiCards = Array.isArray(kpiRes.data) ? kpiRes.data : [];
      setKpiCards([
        ...apiCards.filter((k) => !['Won Value', 'wonvalue'].includes((k.label || '').trim())),
        {
          label: 'Won Value',
          actual: wonValueTotal,
          plan: wonPlan,
          percentVsPlan: wonPlan && wonPlan > 0 ? Math.round((wonValueTotal / wonPlan) * 100) : null,
        },
      ]);
      let segData = [];
      try {
        segData = (await getPipelineBySegment(periodType, periodValue, year, pid)).data || [];
      } catch { /* ignore */ }
      let computedSegments = [];
      try {
        const oppRes = await getOpportunities(year, pid);
        const oppList = Array.isArray(oppRes.data) ? oppRes.data : [];
        oppList.sort((a, b) => {
          const da = a.initiationDate || '';
          const db = b.initiationDate || '';
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        });
        setOpportunities(oppList);
        computedSegments = buildSegmentsFromOpps(oppList, sizeOptions, periodType, periodValue, year);
      } catch { setOpportunities([]); }
      setSegments(computedSegments.length ? computedSegments : segData);
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
    'MQL': t(locale, { vi: 'Conv to MQL', en: 'Conv to MQL' }),
    'SQL': t(locale, { vi: 'Conv to SQL', en: 'Conv to SQL' }),
    'OPP': t(locale, { vi: 'Conv to OPP', en: 'Conv to OPP' }),
    'Closed Deal': t(locale, { vi: 'Conv to Closed Deal', en: 'Conv to Closed Deal' }),
  };

  function formatFullCurrency(n) {
    n = n ?? 0;
    return Number(n).toLocaleString('vi-VN');
  }

  // CAC / ROAS theo kỳ + dự án đang lọc (BE kpi-cards; lọc 1 dự án → chi phí + won deal của riêng dự án đó, feedback 26/09 T02).
  // Cùng quy tắc với tab Tổng quan chi phí: chi phí dự án lead, won deal xếp kỳ theo ngày bắt đầu opportunity.
  const roaCard = kpiCards.find((k) => isRoaCard(k) && !isMetricHidden(k)) || null;
  const cacCard = kpiCards.find(isCacCard) || null;
  const numOrNull = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  // Thẻ có trường riêng (cac / roas) thì dùng đúng trường đó: null = N/A (không có won deal / không có chi phí),
  // không rơi về `actual` để khỏi hiện 0 thay cho N/A.
  const cardValue = (card, key, ...fallbacks) => {
    if (!card) return null;
    if (key in card) return numOrNull(card[key]);
    for (const k of fallbacks) if (card[k] != null) return numOrNull(card[k]);
    return null;
  };
  const cac = cardValue(cacCard, 'cac', 'actual');
  const roaValue = cardValue(roaCard, 'roas', 'roa', 'actual');
  const metricSrc = cacCard || roaCard;
  const leadMetrics = metricSrc
    ? { leadCost: Number(metricSrc.leadCost ?? metricSrc.totalCost) || 0, wonCount: Number(metricSrc.wonCount) || 0, wonValue: Number(metricSrc.wonValue) || 0 }
    : null;
  const selectedProjectName = projectId ? (projects.find((p) => p.id === projectId)?.name || '') : '';
  const costLabel = projectId
    ? t(locale, { vi: `Chi phí dự án ${formatCurrency(leadMetrics?.leadCost || 0)}`, en: `Project cost ${formatCurrency(leadMetrics?.leadCost || 0)}` })
    : t(locale, { vi: `Chi phí dự án lead ${formatCurrency(leadMetrics?.leadCost || 0)}`, en: `Lead project cost ${formatCurrency(leadMetrics?.leadCost || 0)}` });

  const funnelSteps = funnel.length
    ? funnel.map((f) => ({ ...f })).filter((f) => !isMetricHidden(f))
    : [];

  const wonTotals = closedQuarters.reduce(
    (acc, row) => ({ count: acc.count + (Number(row.count) || 0), revenue: acc.revenue + (Number(row.revenue) || 0) }),
    { count: 0, revenue: 0 },
  );

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
                  <option key={v} value={v}>{periodType === 'quarter' ? `Q${v}` : v}</option>
                ))}
              </select>
              {periodType !== 'year' && (
                <>
                  <span className="text-[11px] text-on-surface-variant font-medium ml-0.5 whitespace-nowrap">/</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="border border-border-light rounded px-1.5 py-1 text-[12px] text-on-surface bg-white focus:ring-1 focus:ring-primary outline-none ml-0.5 cursor-pointer"
                    title={t(locale, { vi: 'Chọn năm', en: 'Select year' })}
                  >
                    {getPeriodOptions('year', year).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </>
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
        {kpiCards.filter(k => k.label !== 'CAC / LTV' && k.label !== 'CAC/LTV' && k.label !== 'CAC' && k.label !== 'LTV' && !isRoaCard(k) && !isMetricHidden(k)).map((kpi) => {
          const pct = kpi.percentVsPlan;
          const isCurrency = kpi.label === 'Pipeline Value' || kpi.label === 'Won Value';
          const planVal = isCurrency ? formatCurrency(kpi.plan) : formatNum(kpi.plan);
          const hasConv = kpi.label === 'MQL' || kpi.label === 'SQL' || kpi.label === 'OPP' || kpi.label === 'Closed Deal';
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

      {/* Health Metrics Row: CAC + ROA đặt cạnh nhau (đã bỏ LTV, LTV:CAC) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-border-light rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              CAC{selectedProjectName && <span className="normal-case tracking-normal font-medium"> · {selectedProjectName}</span>}
            </p>
            <p className="text-headline-sm font-bold text-on-surface">
              {cac != null ? formatFullCurrency(Math.round(cac)) : 'N/A'} <span className="text-[12px] text-on-surface-variant font-normal">{t(locale, { vi: 'VNĐ/khách', en: 'VND/customer' })}</span>
            </p>
            {leadMetrics && (
              <p className="text-[11px] text-on-surface-variant mt-0.5">{costLabel} / {leadMetrics.wonCount} won deal</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">trending_down</span>
          </div>
        </div>
        {roaCard && (
          <div className="bg-white border border-border-light rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                ROAS{selectedProjectName && <span className="normal-case tracking-normal font-medium"> · {selectedProjectName}</span>}
              </p>
              <p className="text-headline-sm font-bold text-on-surface">
                {roaValue != null ? roaValue.toFixed(2) : 'N/A'} <span className="text-[12px] text-on-surface-variant font-normal">x</span>
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {leadMetrics ? `Won ${formatCurrency(leadMetrics.wonValue)} / ${costLabel.charAt(0).toLowerCase()}${costLabel.slice(1)}` : t(locale, { vi: 'Giá trị won / Chi phí', en: 'Won value / Cost' })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined">monitoring</span>
            </div>
          </div>
        )}
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
                // Tỷ lệ chuyển đổi so với bước trước (vd MQL/Raw Leads) — ưu tiên convPct BE trả, thiếu thì tự tính
                const prevActual = idx > 0 ? Number(funnelSteps[idx - 1].actual) || 0 : 0;
                const convRate = idx === 0 ? null
                  : step.convPct != null && Number.isFinite(Number(step.convPct)) ? Number(step.convPct)
                    : prevActual > 0 ? Math.round(((Number(step.actual) || 0) / prevActual) * 1000) / 10 : null;
                const barPct = Math.min(Math.max(barWidth, 1.5), 100);
                const labelInside = barPct >= 12;
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
                        style={{ width: `${barPct}%` }}
                      />
                      {/* Số trong thanh: % đạt so với KPI (thực tế / KPI × 100%); KPI = 0 → "—" */}
                      <div
                        className="absolute inset-y-0 flex items-center pointer-events-none"
                        style={labelInside ? { left: '12px' } : { left: `calc(${barPct}% + 8px)` }}
                        title={t(locale, { vi: '% đạt so với KPI', en: '% of KPI achieved' })}
                      >
                        <span className={`text-[11px] font-bold whitespace-nowrap ${labelInside ? 'text-on-primary' : pctColor(pct)}`}>
                          {pct != null ? `${Math.round(pct)}%` : '—'}
                        </span>
                      </div>
                    </div>
                    {/* Số dưới thanh: tỷ lệ chuyển đổi so với bước trước (vd MQL/Raw Leads) */}
                    <div className="mt-1 flex justify-between items-center">
                      <span className="text-[12px] text-on-surface-variant">
                        {!isFirst ? `${t(locale, { vi: 'Tỷ lệ chuyển đổi', en: 'Conversion rate' })} ${stepLabel}/${prevLabel}:` : ''}
                      </span>
                      {!isFirst && (
                        <span className="text-[12px] font-semibold text-on-surface">
                          {convRate != null ? `${convRate}%` : '—'}
                        </span>
                      )}
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
                          { key: 'segment', label: t(locale, { vi: 'Phân khúc', en: 'Segment' }), value: (r) => r.segment },
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
                  <th
                    className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right cursor-help"
                    title={t(locale, { vi: 'Tăng trưởng = (số OPP đang mở kỳ này − kỳ trước) / kỳ trước. OPP xếp kỳ theo ngày bắt đầu; kỳ trước = tuần / tháng / quý / năm liền trước. Kỳ trước = 0 mà kỳ này có OPP → 100%.', en: 'Growth = (open OPPs this period − previous period) / previous period, by OPP start date.' })}
                  >
                    {t(locale, { vi: 'GROWTH', en: 'GROWTH' })} <span className="material-symbols-outlined text-[13px] align-middle">info</span>
                  </th>
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
                    <td className="px-3 py-2.5 text-body-sm text-on-surface">{s.segment}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{Number(s.openDeals) || 0}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{formatCurrency(s.value)}</td>
                    <td
                      className={`px-3 py-2.5 text-data-mono text-right font-semibold ${pctColor((Number(s.growthPct) || 0) + 100)}`}
                      title={s.prevDeals != null ? t(locale, { vi: `${Number(s.openDeals) || 0} OPP kỳ này so với ${s.prevDeals} OPP kỳ trước`, en: `${Number(s.openDeals) || 0} OPPs vs ${s.prevDeals} in the previous period` }) : undefined}
                    >
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
                  <th
                    className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right cursor-help"
                    title={t(locale, { vi: 'Mục tiêu quý = KPI Closed Deal cả năm / 4 (KPI của dự án khi đang lọc dự án). ≥ 100%: Vượt mục tiêu · 80–99%: Đúng tiến độ · < 80%: Dưới mục tiêu.', en: 'Quarter target = yearly Closed Deal KPI / 4. ≥100% Beat · 80–99% On track · <80% Below target.' })}
                  >
                    {t(locale, { vi: 'VS TARGET', en: 'VS TARGET' })} <span className="material-symbols-outlined text-[13px] align-middle">info</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {closedQuarters.map((row) => (
                  <tr key={row.quarter} className="hover:bg-surface-container transition-colors">
                    <td className="px-3 py-2.5 text-body-sm text-on-surface">{row.quarter}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{row.count}</td>
                    <td className="px-3 py-2.5 text-data-mono text-on-surface text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase whitespace-nowrap ${row.targetClass}`}>{targetLabel(locale, row.target)}</span>
                      {row.quarterTarget > 0 && (
                        <span className="block mt-1 text-[10px] text-on-surface-variant tabular-nums whitespace-nowrap">
                          {row.count}/{Number(row.quarterTarget.toFixed(1))} · {row.ratioPct}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container-low">
                  <td className="px-3 py-2.5 text-body-sm font-bold text-on-surface uppercase tracking-wider">
                    {t(locale, { vi: 'Tổng (năm)', en: 'Total (year)' })}
                  </td>
                  <td className="px-3 py-2.5 text-data-mono font-bold text-on-surface text-right">{wonTotals.count}</td>
                  <td className="px-3 py-2.5 text-data-mono font-bold text-on-surface text-right">{formatCurrency(wonTotals.revenue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Opportunities List sorted by Start Date */}
      {opportunities.length > 0 && (
        <div className="bg-white border border-border-light rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border-light">
            <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">
              {t(locale, { vi: 'Danh sách Cơ hội (theo Ngày bắt đầu)', en: 'Opportunities List (by Start Date)' })}
            </h4>
          </div>
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-border-light">
              <tr>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">#</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'Khách hàng', en: 'Customer' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'Dự án', en: 'Project' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'Hợp đồng', en: 'Contract' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'Fees', en: 'Fees' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'Ngày bắt đầu', en: 'Start Date' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'Dự kiến đóng', en: 'Expected Close' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {opportunities.map((opp, idx) => (
                <tr key={opp.id || idx} className="hover:bg-surface-container transition-colors">
                  <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-on-surface">{opp.companyName || '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{opp.project || '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{opp.contractName || '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-on-surface text-right font-data-mono">{opp.fees ? Number(opp.fees).toLocaleString('vi-VN') : '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-on-surface-variant whitespace-nowrap">{opp.initiationDate || '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-on-surface-variant whitespace-nowrap">{opp.expectedCloseDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
