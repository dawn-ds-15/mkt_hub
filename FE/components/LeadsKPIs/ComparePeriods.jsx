import React, { useState, useEffect, useRef } from 'react';
import { getCompareData, getQuarterlyCompareData, deleteCompareData, generateAIReport } from '../../services/api';

function formatNum(n) {
  if (n == null) return '\u2014';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatCurrency(n) {
  if (n == null) return '\u2014';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toLocaleString();
}

const metricsConfig = [
  { key: 'Raw Leads', label: 'Raw Leads', format: formatNum },
  { key: 'MQL', label: 'MQL', format: formatNum },
  { key: 'SQL', label: 'SQL', format: formatNum },
  { key: 'Won Value', label: 'Won Value ($)', format: formatCurrency },
  { key: 'CAC / LTV', label: 'CAC ($)', format: (v) => v != null ? '$' + v.toFixed(1) : '\u2014', subField: 'cac' },
  { key: 'CAC / LTV', label: 'LTV ($)', format: (v) => v != null ? '$' + v.toLocaleString() : '\u2014', subField: 'ltv' },
];

const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

const CURRENT_YEAR = String(new Date().getFullYear());
const YEAR_OPTIONS = [CURRENT_YEAR, String(Number(CURRENT_YEAR) - 1), String(Number(CURRENT_YEAR) - 2)];

function buildInsights(compareData) {
  const base = compareData?.[YEAR_OPTIONS[0]] || {};
  const rl = base['Raw Leads'];
  const mql = base['MQL'];
  const sql = base['SQL'];
  const growthInsight = rl?.percentVsPlan != null && rl?.percentVsPlan > 100
    ? `Raw Leads in ${YEAR_OPTIONS[0]} exceeds plan by ${Math.round(rl.percentVsPlan - 100)}%. Focus on mid-funnel conversion (MQL \u2192 SQL) to optimize ROI.`
    : `Raw Leads in ${YEAR_OPTIONS[0]} reached ${Math.round(rl?.percentVsPlan || 0)}% of plan. Boost lead generation campaigns to meet targets.`;
  const sqlWarn = sql?.percentVsPlan != null && sql?.percentVsPlan < 100
    ? `SQL rate is declining vs plan. Review lead qualification criteria with the Sales team.`
    : `SQL rate is on track vs plan.`;
  return [
    {
      title: 'Growth Opportunity',
      color: 'border-l-primary bg-primary/5',
      textColor: 'text-primary',
      desc: growthInsight,
    },
    {
      title: 'Performance Alert',
      color: 'border-l-warning bg-warning/5',
      textColor: 'text-warning',
      desc: sqlWarn,
    },
    {
      title: 'Financial Highlight',
      color: 'border-l-success bg-success/5',
      textColor: 'text-success',
      desc: `Analysis based on ${YEAR_OPTIONS[0]} data. Update Plan, Actuals, Opportunities and Closed Deals for accurate assessment.`,
    },
  ];
}

const periodOptions = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export default function ComparePeriods({ year: currentYear }) {
  const [periodType, setPeriodType] = useState('quarter');
  const [periodValue, setPeriodValue] = useState('1');
  const [selectedYears, setSelectedYears] = useState([CURRENT_YEAR, String(Number(CURRENT_YEAR) - 1)]);
  const [compareData, setCompareData] = useState({});
  const [quarterlyData, setQuarterlyData] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('Raw Leads');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [loadError, setLoadError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, [periodType, periodValue, selectedYears, selectedMetric]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [compareRes, quarterlyRes] = await Promise.all([
        getCompareData(selectedYears.length ? selectedYears : [currentYear], periodType, periodValue),
        getQuarterlyCompareData(selectedYears.length ? selectedYears : [currentYear], selectedMetric),
      ]);
      setCompareData(compareRes.data || {});
      setQuarterlyData(quarterlyRes.data || null);
      if (!compareRes.data || Object.keys(compareRes.data).length === 0) {
        setLoadError('API returned no comparison data for this period');
      }
    } catch (error) {
      console.error('Error loading compare data:', error);
      setLoadError('Unable to load comparison data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (yr) => {
    setSelectedYears(prev =>
      prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]
    );
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleExportCSV = () => {
    const headers = ['Metric', ...selectedYears.flatMap(yr => [`Actual ${yr}`, `Plan ${yr}`, `% Plan`]), ...(selectedYears.length >= 2 ? ['YoY Growth'] : [])];
    const rows = metricsConfig.map(metric => {
      const baseYear = selectedYears[0];
      const compareYear = selectedYears[1];
      const baseData = compareData[baseYear]?.[metric.key];
      const compareData_ = compareData[compareYear]?.[metric.key];
      const baseVal = metric.subField ? (baseData ? baseData[metric.subField] : null) : (baseData?.actual);
      const compareVal = metric.subField ? (compareData_ ? compareData_[metric.subField] : null) : (compareData_?.actual);
      const planVal = baseData?.plan;
      const pctPlan = baseData?.percentVsPlan;
      const yoyGrowth = (baseVal != null && compareVal != null)
        ? (compareVal !== 0 ? ((baseVal - compareVal) / compareVal) * 100 : (baseVal !== 0 ? 100 : 0))
        : 0;
      return [metric.label, metric.format(baseVal ?? 0), metric.format(planVal ?? 0), (pctPlan != null ? Math.round(pctPlan) + '%' : '0%'), ...(selectedYears.length >= 2 ? [(yoyGrowth >= 0 ? '+' : '') + yoyGrowth.toFixed(1) + '%'] : [])];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-metric-comparison-${selectedYears.join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const handleDeleteData = async () => {
    if (!window.confirm('Delete selected comparison data?')) return;
    await deleteCompareData(selectedYears);
    setCompareData({});
    setQuarterlyData(null);
    setMenuOpen(false);
  };

  const handleGenerateAIReport = async () => {
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await generateAIReport({
        compareData,
        years: selectedYears,
        periodType,
        periodValue,
        insights: computedInsights,
      });
      setAiReport(res.data?.report || 'Unable to generate report.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Unable to generate AI report. Please try again later.';
      setAiReport(Array.isArray(msg) ? '\u2022 ' + msg.join('\n\u2022 ') : String(msg));
    } finally {
      setAiLoading(false);
    }
  };

  const computedInsights = buildInsights(compareData);
  const chartMaxHeight = 200;
  const datasets = quarterlyData?.datasets || [];
  const safeDatasets = datasets.map(d => ({
    ...d,
    values: d.values.map(v => v ?? 0),
  }));
  const maxVal = safeDatasets.length > 0
    ? Math.max(...safeDatasets.flatMap(d => d.values))
    : 1;

  return (
    <div className="space-y-6">
      {/* Section Filter */}
      <section className="bg-white border border-border-light rounded p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Show by:</span>
          <div className="flex bg-surface-container rounded p-1">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setPeriodType(opt.key); setPeriodValue('1'); }}
                className={`px-4 py-1.5 rounded text-body-sm font-semibold transition-all ${
                  periodType === opt.key ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-on-surface-variant">Compare years:</span>
            <div className="flex gap-2">
              {YEAR_OPTIONS.map((yr) => (
                <label
                  key={yr}
                  className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded border transition-colors ${
                    selectedYears.includes(yr)
                      ? 'bg-surface-container border-primary'
                      : 'bg-surface-container border-transparent hover:border-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(yr)}
                    onChange={() => toggleYear(yr)}
                    className="w-4 h-4 text-primary focus:ring-primary rounded"
                  />
                  <span className="text-body-sm font-medium">{yr}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>{loading ? 'sync' : 'refresh'}</span>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </section>

      {loadError && (
        <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-error text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {loadError}
        </div>
      )}

      {/* Multi-metric comparison table */}
      <section className="bg-white border border-border-light rounded overflow-hidden">
        <div className="px-4 py-4 border-b border-border-light flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Multi-Metric Comparison
          </h3>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="p-2 hover:bg-surface-container rounded transition-colors" title="Export CSV">
              <span className="material-symbols-outlined text-on-surface-variant">download</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(o => !o)} className="p-2 hover:bg-surface-container rounded transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border-light rounded-lg shadow-lg z-50 py-1">
                  <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">file_download</span>
                    Export CSV
                  </button>
                  <button onClick={handleDeleteData} className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm hover:bg-surface-container transition-colors text-danger">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Delete data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-border-light">
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider sticky left-0 bg-surface-container-low z-10 min-w-[200px]">Metric</th>
                {selectedYears.map((yr, yi) => (
                  <React.Fragment key={yr}>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actual {yr}</th>
                    {yi === 0 && (
                      <>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Plan {yr}</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">% Plan</th>
                      </>
                    )}
                  </React.Fragment>
                ))}
                {selectedYears.length >= 2 && (
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">YoY Growth</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {metricsConfig.map((metric) => {
                const baseYear = selectedYears[0];
                const compareYear = selectedYears[1];
                const baseData = compareData[baseYear]?.[metric.key];
                const compareData_ = compareData[compareYear]?.[metric.key];
                const baseVal = metric.subField ? (baseData ? baseData[metric.subField] : null) : (baseData?.actual);
                const compareVal = metric.subField ? (compareData_ ? compareData_[metric.subField] : null) : (compareData_?.actual);
                const planVal = baseData?.plan;
                const pctPlan = baseData?.percentVsPlan;
                const yoyGrowth = (baseVal != null && compareVal != null)
                  ? (compareVal !== 0 ? ((baseVal - compareVal) / compareVal) * 100 : (baseVal !== 0 ? 100 : 0))
                  : 0;

                return (
                  <tr key={metric.label} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4 text-[12px] font-semibold text-on-surface sticky left-0 bg-white group-hover:bg-surface-container-lowest">
                      {metric.label}
                    </td>
                    <td className="px-6 py-4 text-data-mono text-right">{metric.format(baseVal ?? 0)}</td>
                    {selectedYears.includes(baseYear) && (
                      <>
                        <td className="px-6 py-4 text-data-mono text-right">
                          {metric.subField ? metric.format(baseData?.[metric.subField] ?? 0) : metric.format(planVal ?? 0)}
                        </td>
                        <td className={`px-6 py-4 text-data-mono text-right ${pctPlan != null ? (pctPlan >= 100 ? 'text-success' : 'text-danger') : 'text-on-surface-variant'}`}>
                          {pctPlan != null ? Math.round(pctPlan) + '%' : '0%'}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-data-mono text-right">{metric.format(compareVal ?? 0)}</td>
                    {selectedYears.length >= 2 && (
                      <td className={`px-6 py-4 text-data-mono text-right ${yoyGrowth >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(yoyGrowth >= 0 ? '+' : '') + yoyGrowth.toFixed(1) + '%'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Chart & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grouped Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-border-light rounded p-4 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <h3 className="text-headline-sm font-semibold text-on-surface">Comparison by {periodOptions.find(o => o.key === periodType)?.label || 'Quarter'}</h3>
              <p className="text-body-sm text-on-surface-variant">Multi-year trend analysis</p>
            </div>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-surface-container text-body-sm font-semibold rounded px-4 py-2 focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              {['Raw Leads', 'MQL', 'SQL', 'OPP', 'Closed Deal', 'Won Value'].map(m => (
                <option key={m} value={m}>Metric: {m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 flex items-end justify-around border-b border-border-light pb-2 mb-4" style={{ minHeight: 320 }}>
            {quarterLabels.map((qlabel, qi) => (
              <div key={qlabel} className="flex flex-col items-center gap-4 w-1/4">
                <div className="flex items-end gap-1" style={{ height: chartMaxHeight }}>
                  {safeDatasets.map((ds) => {
                    const val = ds.values[qi];
                    const h = maxVal > 0 ? (val / maxVal) * chartMaxHeight : 0;
                    return (
                      <div key={ds.year} className="flex flex-col items-center">
                        <span className="text-[10px] font-semibold text-on-surface mb-0.5 whitespace-nowrap">
                          {formatNum(val)}
                        </span>
                        <div
                          className={`bar ${ds.color}`}
                          style={{
                            width: 20,
                            height: Math.max(h, 4),
                            borderRadius: '2px 2px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                          title={`${ds.year}: ${formatNum(val)}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="text-[12px] font-bold text-on-surface uppercase">{qlabel}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 pt-4 border-t border-border-light/50">
            {safeDatasets.map((ds) => (
              <div key={ds.year} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm ${ds.color}`}></span>
                <span className="text-body-sm font-medium">{ds.year}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insights Column */}
        <div className="bg-white border border-border-light rounded p-4 space-y-4">
          <h3 className="text-headline-sm font-semibold text-on-surface">Quick Insights</h3>
          <div className="space-y-4">
            {computedInsights.map((item) => (
              <div key={item.title} className={`p-4 ${item.color} border-l-4 rounded-r`}>
                <h4 className={`text-[12px] font-semibold ${item.textColor} mb-1`}>{item.title}</h4>
                <p className="text-body-sm text-on-surface">{item.desc}</p>
              </div>
            ))}
          </div>
          {aiReport ? (
            <div className="bg-surface-container rounded p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-bold text-on-surface">AI Report</h4>
                <button onClick={() => setAiReport(null)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <pre className="text-[11px] text-on-surface whitespace-pre-wrap font-sans leading-relaxed">{aiReport}</pre>
            </div>
          ) : (
            <button onClick={handleGenerateAIReport} disabled={aiLoading} className="w-full py-2.5 bg-surface-container hover:bg-secondary-container transition-colors rounded font-semibold text-secondary flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">{aiLoading ? 'sync' : 'smart_toy'}</span>
              {aiLoading ? 'Generating...' : 'AI Report Generator'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
