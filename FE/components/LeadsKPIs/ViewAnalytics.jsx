import { useState, useEffect } from 'react';
import { getKpiCardsData, getFunnelData, getClosedDeals, getPlanKPIs, getPipelineBySegment } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { t } from '../../utils/i18n';
import KPIRolloverCard from './KPIRolloverCard';

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

function pctSign(pct) {
  if (pct == null) return '\u2014';
  const diff = pct - 100;
  if (diff > 0) return '+' + diff.toFixed(1) + '%';
  if (diff < 0) return diff.toFixed(1) + '%';
  return '0%';
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

export default function ViewAnalytics({ year, periodType, periodValue }) {
  const { locale } = useDashboard();
  const [kpiCards, setKpiCards] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [closedQuarters, setClosedQuarters] = useState([]);
  const [segments, setSegments] = useState([]);
  const [funnelMode, setFunnelMode] = useState('volume');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const currentWeek = periodType === 'week' ? periodValue : '1';
  const [menuOpen, setMenuOpen] = useState(false);

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
  }, [year, periodType, periodValue]);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [kpiRes, funnelRes] = await Promise.all([
        getKpiCardsData(periodType, periodValue, year),
        getFunnelData(periodType, periodValue, year),
      ]);
      setKpiCards(kpiRes.data);
      setFunnel(funnelRes.data);
      let deals = [];
      let planData = null;
      try {
        deals = (await getClosedDeals()).data || [];
      } catch { /* ignore */ }
      try {
        planData = (await getPlanKPIs(year)).data;
      } catch { /* ignore */ }
      setClosedQuarters(buildClosedQuarters(deals, year, planData?.closedDealCount));
      let segData = [];
      try {
        segData = (await getPipelineBySegment(periodType, periodValue, year)).data || [];
      } catch { /* ignore */ }
      setSegments(segData);
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

  const kpiFieldLabels = {
    'Pipeline Value': t(locale, { vi: 'TB/Deal:', en: 'Avg/Deal:' }),
    'Won Value': t(locale, { vi: 'Tỷ lệ thắng:', en: 'Win Rate:' }),
  };
  const defaultFieldLabel = t(locale, { vi: 'Tỷ lệ CĐ:', en: 'Conv Rate:' });

  const funnelSteps = funnel.length
    ? funnel.map((f) => ({
        ...f,
        flex: funnelMode === 'volume' ? (f.actual || 1) : (f.plan || 1),
      }))
    : [];

  const maxFlex = funnelSteps.length > 0 ? Math.max(...funnelSteps.map(f => f.flex)) : 1;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-red-50 border-l-4 border-danger p-4 rounded flex items-start gap-3">
          <span className="material-symbols-outlined text-danger mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-body-sm text-red-800">{loadError}</p>
            <button onClick={loadData} className="mt-2 text-body-xs text-red-700 underline hover:no-underline">{t(locale, { vi: 'Thử lại', en: 'Retry' })}</button>
          </div>
        </div>
      )}
      {/* Row 1: 7 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {kpiCards.filter(k => k.label !== 'CAC / LTV' && k.label !== 'CAC/LTV').map((kpi) => (
          <div key={kpi.label} className="bg-white border border-border-light px-3 py-3 rounded-lg shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 min-h-[130px] flex flex-col justify-between w-full">
            <div>
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 whitespace-nowrap">
                {kpiDisplayLabels[kpi.label] || kpi.label.toUpperCase()}
              </p>
              <div className="text-headline-md font-bold text-on-surface">
                {kpi.label === 'Pipeline Value' || kpi.label === 'Won Value'
                  ? formatCurrency(kpi.actual)
                  : formatNum(kpi.actual)}
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant">{t(locale, { vi: 'KH:', en: 'Plan:' })}</span>
                <span className="text-on-surface font-medium">
                  {kpi.label === 'Pipeline Value' || kpi.label === 'Won Value'
                    ? formatCurrency(kpi.plan)
                    : formatNum(kpi.plan)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant">{t(locale, { vi: '% so KH:', en: '% vs Plan:' })}</span>
                <span className={`font-bold ${pctColor(kpi.percentVsPlan)}`}>
                  {pctSign(kpi.percentVsPlan)}
                </span>
              </div>
              <div className="pt-1.5 border-t border-border-light flex justify-between text-[11px] font-semibold">
                <span className="text-on-surface-variant">
                  {kpiFieldLabels[kpi.label] || defaultFieldLabel}
                </span>
                <span className="text-primary">
                  {kpi.convPct != null ? kpi.convPct + '%' : kpi.label === 'Pipeline Value'
                    ? (kpi.actual != null && kpi.plan != null && kpi.plan > 0
                      ? formatCurrency(kpi.actual / kpi.plan * 1000)
                      : '\u2014')
                    : kpi.label === 'Won Value' && kpi.percentVsPlan != null
                      ? Math.round(kpi.percentVsPlan) + '%'
                      : '\u2014'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Section: Horizontal Funnel Chart */}
      <section className="bg-white border border-border-light rounded-lg p-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-headline-sm font-semibold text-on-surface">{t(locale, { vi: 'Phễu chuyển đổi Pipeline', en: 'Pipeline Conversion Funnel' })}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFunnelMode('volume')}
              className={`px-4 py-2 border border-border-light rounded text-[12px] font-semibold transition-colors ${funnelMode === 'volume' ? 'bg-primary text-white' : 'hover:bg-surface-container'}`}
            >
              {t(locale, { vi: 'Theo số lượng', en: 'By Volume' })}
            </button>
            <button
              onClick={() => setFunnelMode('value')}
              className={`px-4 py-2 rounded text-[12px] font-semibold transition-colors ${funnelMode === 'value' ? 'bg-primary text-white' : 'border border-border-light hover:bg-surface-container'}`}
            >
              {t(locale, { vi: 'Theo giá trị', en: 'By Value' })}
            </button>
          </div>
        </div>

        {funnelSteps.length > 0 && (
          <>
            <div className="relative w-full flex items-center mt-8">
              <div className="flex w-full h-28">
                {funnelSteps.map((step, idx) => {
                  const ratio = step.flex / maxFlex;
                  const flexVal = Math.max(0.15, ratio);
                  const opacity = 20 + (idx / (funnelSteps.length - 1)) * 60;
                  const isLast = idx === funnelSteps.length - 1;
                  const conv = step.convPct;
                  return (
                    <div
                      key={step.step}
                      className={`flex-1 flex flex-col items-center justify-center border-y relative transition-all duration-300 ${isLast ? 'border-primary bg-primary' : 'border-primary/30'}`}
                      style={{
                        flex: flexVal,
                        backgroundColor: isLast ? undefined : `rgba(0, 35, 111, ${opacity / 100})`,
                      }}
                    >
                      {idx === 0 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center text-on-surface-variant text-[12px] font-semibold whitespace-nowrap">
                          <span className="material-symbols-outlined text-[16px] mr-1">group</span>
                          {funnelMode === 'volume'
                            ? t(locale, { vi: 'Số lượng', en: 'Volume' })
                            : t(locale, { vi: 'Giá trị', en: 'Value' })}
                        </div>
                      )}
                      <span className="text-[11px] font-semibold uppercase mb-1" style={{ color: isLast ? '#fff' : idx < 2 ? '#00236f' : '#fff' }}>
                        {step.step === 'Raw Leads' ? t(locale, { vi: 'Raw Leads', en: 'Raw Leads' }) :
                         step.step === 'MQL' ? 'MQL' :
                         step.step === 'SQL' ? 'SQL' :
                         step.step === 'OPP' ? 'OPP' :
                         step.step === 'Closed Deal' ? t(locale, { vi: 'Closed Deal', en: 'Closed Deal' }) :
                         step.step}
                      </span>
                      <span className="text-headline-md font-semibold" style={{ color: isLast ? '#fff' : idx < 2 ? '#00236f' : '#fff' }}>
                        {funnelMode === 'volume' ? formatNum(step.actual) : formatCurrency(step.plan || step.actual)}
                      </span>
                      {idx > 0 && conv != null && (
                        <div className="absolute -bottom-10 left-0 w-px h-10 bg-border-light flex items-center justify-center">
                          <div className="bg-white px-2 border border-border-light rounded-full text-xs font-bold text-success translate-y-5 whitespace-nowrap shadow-sm">
                            {Math.round(conv)}% {t(locale, { vi: 'CĐ', en: 'Conv' })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-14 grid grid-cols-5 text-center px-4">
              <p className="text-body-sm text-on-surface-variant">{t(locale, { vi: 'Nhận biết', en: 'Awareness' })}</p>
              <p className="text-body-sm text-on-surface-variant">{t(locale, { vi: 'Đủ điều kiện', en: 'Qualified' })}</p>
              <p className="text-body-sm text-on-surface-variant">{t(locale, { vi: 'Sẵn sàng mua', en: 'Ready to Buy' })}</p>
              <p className="text-body-sm text-on-surface-variant">{t(locale, { vi: 'Đàm phán', en: 'Negotiating' })}</p>
              <p className="text-body-sm text-on-surface-variant">{t(locale, { vi: 'Đã chốt', en: 'Closed' })}</p>
            </div>
          </>
        )}
      </section>

      {/* KPI Rollover */}
      <KPIRolloverCard year={year} week={currentWeek} />

      {/* Bottom Section: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Value by Segment */}
        <div className="bg-white border border-border-light rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border-light bg-surface-container-lowest flex justify-between items-center relative">
            <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">{t(locale, { vi: 'Giá trị Pipeline theo Phân khúc', en: 'Pipeline Value by Segment' })}</h4>
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
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'PHÂN KHÚC', en: 'SEGMENT' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'DEAL ĐANG MỞ', en: 'OPEN DEALS' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'GIÁ TRỊ', en: 'VALUE' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'TĂNG TRƯỞNG', en: 'GROWTH' })}</th>
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

        {/* Closed Deal Value */}
        <div className="bg-white border border-border-light rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border-light bg-surface-container-lowest flex justify-between items-center">
            <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">{t(locale, { vi: 'Giá trị Deal đã chốt', en: 'Closed Deal Value' })}</h4>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] cursor-pointer hover:text-primary" onClick={() => exportCSV(closedQuarters, 'closed-deals.csv', [{ key: 'quarter', label: t(locale, { vi: 'Quý', en: 'Quarter' }) }, { key: 'count', label: t(locale, { vi: 'Số lượng thắng', en: 'Won Count' }) }, { key: 'revenue', label: t(locale, { vi: 'Doanh thu', en: 'Revenue' }) }, { key: 'target', label: t(locale, { vi: 'so với Mục tiêu', en: 'vs Target' }), value: (r) => targetLabel(locale, r.target) }])}>download</span>
          </div>
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-border-light">
              <tr>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{t(locale, { vi: 'QUÝ', en: 'QUARTER' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'SỐ LƯỢNG THẮNG', en: 'WON COUNT' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'DOANH THU', en: 'REVENUE' })}</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">{t(locale, { vi: 'SO VỚI MỤC TIÊU', en: 'VS TARGET' })}</th>
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
  );
}
