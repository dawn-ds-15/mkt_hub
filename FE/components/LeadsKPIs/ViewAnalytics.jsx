import { useState, useEffect } from 'react';
import { getKpiCardsData, getFunnelData } from '../../services/api';
import KPIRolloverCard from './KPIRolloverCard';

function formatNum(n) {
  if (n == null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'Tr';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'N';
  return n.toLocaleString();
}

function formatCurrency(n) {
  if (n == null) return '$0';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'Tr';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'N';
  return '$' + n.toLocaleString();
}

function pctColor(pct) {
  if (pct == null) return 'text-on-surface-variant';
  if (pct >= 100) return 'text-success';
  if (pct >= 80) return 'text-warning';
  return 'text-danger';
}

function pctSign(pct) {
  if (pct == null) return '—';
  const diff = pct - 100;
  if (diff > 0) return '+' + diff.toFixed(1) + '%';
  if (diff < 0) return diff.toFixed(1) + '%';
  return '0%';
}

function getHealthMeta(health) {
  const map = {
    green: { label: 'Tốt', dot: 'bg-success', text: 'text-success', bg: 'bg-success/10' },
    yellow: { label: 'Cảnh báo', dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' },
    red: { label: 'Nghiêm trọng', dot: 'bg-danger', text: 'text-danger', bg: 'bg-danger/10' },
    blue: { label: 'Tối ưu', dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary/10' },
    gray: { label: 'K.hả dụng', dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100' },
  };
  return map[health] || map.gray;
}

const segmentData = [
  { segment: 'Doanh nghiệp Lớn', label: 'Enterprise', activeDeals: 42, value: 2840000, growth: 14.2, growthUp: true },
  { segment: 'Doanh nghiệp Vừa', label: 'Mid-Market', activeDeals: 86, value: 1150000, growth: 3.8, growthUp: true },
  { segment: 'Doanh nghiệp Nhỏ', label: 'SMB', activeDeals: 58, value: 210000, growth: 2.1, growthUp: false },
];

const closedDealQuarters = [
  { quarter: 'Q1 2024', count: 18, revenue: 410000, target: 'Vượt', targetClass: 'bg-success/10 text-success' },
  { quarter: 'Q2 2024 (Hiện tại)', count: 52, revenue: 1100000, target: 'Đúng tiến độ', targetClass: 'bg-primary/10 text-primary' },
  { quarter: 'Trung bình trước', count: 45, revenue: 980000, target: 'Cơ sở', targetClass: 'bg-secondary/10 text-secondary' },
];

export default function ViewAnalytics({ year, periodType, periodValue }) {
  const [kpiCards, setKpiCards] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [funnelMode, setFunnelMode] = useState('volume');
  const [loading, setLoading] = useState(true);

  const currentWeek = periodType === 'week' ? periodValue : '1';
  const [menuOpen, setMenuOpen] = useState(false);

  const exportCSV = (rows, filename, columns) => {
    const header = columns.map(c => c.label).join(',');
    const body = rows.map(r => columns.map(c => r[c.key]).join(',')).join('\n');
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
    try {
      const [kpiRes, funnelRes] = await Promise.all([
        getKpiCardsData(periodType, periodValue, year),
        getFunnelData(periodType, periodValue, year),
      ]);
      setKpiCards(kpiRes.data);
      setFunnel(funnelRes.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
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

  const kpiDisplayLabels = {
    'Raw Leads': 'RAW LEADS',
    'MQL': 'MQL',
    'SQL': 'SQL',
    'OPP': 'OPP',
    'Closed Deal': 'CLOSED DEAL',
    'Pipeline Value': 'GIÁ TRỊ PIPELINE',
    'Won Value': 'GIÁ TRỊ THẮNG',
  };

  const kpiFieldLabels = {
    'Pipeline Value': 'TB/Giao dịch:',
    'Won Value': 'Hạn mức%:',
  };
  const defaultFieldLabel = 'Tỷ lệ CĐ:';

  const funnelSteps = funnel.length
    ? funnel.map((f) => ({
        ...f,
        flex: funnelMode === 'volume' ? (f.actual || 1) : (f.plan || 1),
      }))
    : [];

  const maxFlex = funnelSteps.length > 0 ? Math.max(...funnelSteps.map(f => f.flex)) : 1;

  const cacCard = kpiCards.find(k => k.label === 'CAC / LTV');

  return (
    <div className="space-y-6">
      {/* Row 1: 7 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {kpiCards.filter(k => k.label !== 'CAC / LTV').map((kpi) => (
          <div key={kpi.label} className="bg-white border border-border-light p-4 rounded-lg shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              {kpiDisplayLabels[kpi.label] || kpi.label.toUpperCase()}
            </p>
            <div className="text-headline-sm font-semibold text-on-surface">
              {kpi.label === 'Pipeline Value' || kpi.label === 'Won Value'
                ? formatCurrency(kpi.actual)
                : formatNum(kpi.actual)}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-body-sm">
                <span className="text-on-surface-variant">KH:</span>
                <span className="text-on-surface font-medium">
                  {kpi.label === 'Pipeline Value' || kpi.label === 'Won Value'
                    ? formatCurrency(kpi.plan)
                    : formatNum(kpi.plan)}
                </span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-on-surface-variant">% so KH:</span>
                <span className={`font-bold ${pctColor(kpi.percentVsPlan)}`}>
                  {pctSign(kpi.percentVsPlan)}
                </span>
              </div>
              <div className="pt-1 border-t border-border-light flex justify-between text-[11px] font-semibold">
                <span className="text-on-surface-variant">
                  {kpiFieldLabels[kpi.label] || defaultFieldLabel}
                </span>
                <span className="text-primary">
                  {kpi.convPct != null ? kpi.convPct + '%' : kpi.label === 'Pipeline Value'
                    ? (kpi.actual != null && kpi.plan != null && kpi.plan > 0
                      ? formatCurrency(kpi.actual / kpi.plan * 1000)
                      : '—')
                    : kpi.label === 'Won Value' && kpi.percentVsPlan != null
                      ? Math.round(kpi.percentVsPlan) + '%'
                      : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: CAC, LTV, Ratio */}
      {cacCard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-border-light p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">CHI PHÍ THU HÚT KHÁCH HÀNG (CAC)</p>
              <h3 className="text-display-lg font-bold text-on-surface">${formatNum(cacCard.cac)}</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">Mục tiêu: $1,500</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getHealthMeta(cacCard.health).bg}`}>
              <div className={`w-3 h-3 rounded-full ${getHealthMeta(cacCard.health).dot} ${cacCard.health === 'green' ? 'animate-pulse' : ''}`}></div>
              <span className={`text-[12px] font-semibold uppercase ${getHealthMeta(cacCard.health).text}`}>
                {getHealthMeta(cacCard.health).label}
              </span>
            </div>
          </div>
          <div className="bg-white border border-border-light p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">GIÁ TRỊ VÒNG ĐỜI (LTV)</p>
              <h3 className="text-display-lg font-bold text-on-surface">${formatNum(cacCard.ltv)}</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">Tăng trưởng: +12% so với tháng trước</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 rounded-full">
              <div className="w-3 h-3 rounded-full bg-warning"></div>
              <span className="text-[12px] font-semibold uppercase text-warning">Cảnh báo</span>
            </div>
          </div>
          <div className="bg-white border border-border-light p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">TỶ LỆ LTV : CAC</p>
              <h3 className="text-display-lg font-bold text-on-surface">{cacCard.ratio != null ? cacCard.ratio.toFixed(1) + 'x' : '—'}</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">Chuẩn: 3.0x</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getHealthMeta(cacCard.health).bg}`}>
              <div className={`w-3 h-3 rounded-full ${getHealthMeta(cacCard.health).dot}`}></div>
              <span className={`text-[12px] font-semibold uppercase ${getHealthMeta(cacCard.health).text}`}>
                {cacCard.ratio >= 3 ? 'Tối ưu' : getHealthMeta(cacCard.health).label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Section: Horizontal Funnel Chart */}
      <section className="bg-white border border-border-light rounded-lg p-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-headline-sm font-semibold text-on-surface">Phễu Chuyển Đổi Pipeline</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFunnelMode('volume')}
              className={`px-4 py-2 border border-border-light rounded text-[12px] font-semibold transition-colors ${funnelMode === 'volume' ? 'bg-primary text-white' : 'hover:bg-surface-container'}`}
            >
              Theo Số lượng
            </button>
            <button
              onClick={() => setFunnelMode('value')}
              className={`px-4 py-2 rounded text-[12px] font-semibold transition-colors ${funnelMode === 'value' ? 'bg-primary text-white' : 'border border-border-light hover:bg-surface-container'}`}
            >
              Theo Giá trị
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
                          {funnelMode === 'volume' ? 'Số lượng' : 'Giá trị'}
                        </div>
                      )}
                      <span className="text-[11px] font-semibold uppercase mb-1" style={{ color: isLast ? '#fff' : idx < 2 ? '#00236f' : '#fff' }}>
                        {step.step === 'Raw Leads' ? 'Raw Leads' :
                         step.step === 'MQL' ? 'MQL' :
                         step.step === 'SQL' ? 'SQL' :
                         step.step === 'OPP' ? 'OPP' :
                         step.step === 'Closed Deal' ? 'Closed Deal' :
                         step.step}
                      </span>
                      <span className="text-headline-md font-semibold" style={{ color: isLast ? '#fff' : idx < 2 ? '#00236f' : '#fff' }}>
                        {funnelMode === 'volume' ? formatNum(step.actual) : formatCurrency(step.plan || step.actual)}
                      </span>
                      {idx > 0 && conv != null && (
                        <div className="absolute -bottom-10 left-0 w-px h-10 bg-border-light flex items-center justify-center">
                          <div className="bg-white px-2 border border-border-light rounded-full text-xs font-bold text-success translate-y-5 whitespace-nowrap shadow-sm">
                            {Math.round(conv)}% Conv
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-14 grid grid-cols-5 text-center px-4">
              <p className="text-body-sm text-on-surface-variant">Quan tâm đầu</p>
              <p className="text-body-sm text-on-surface-variant">Đủ điều kiện</p>
              <p className="text-body-sm text-on-surface-variant">Sẵn sàng mua</p>
              <p className="text-body-sm text-on-surface-variant">Đang đàm phán</p>
              <p className="text-body-sm text-on-surface-variant">Đã chốt</p>
            </div>
          </>
        )}
      </section>

      {/* KPI Rollover */}
      <KPIRolloverCard year={year} week={currentWeek} />

      {/* Bottom Section: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Value by Segment */}
        <div className="bg-white border border-border-light rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border-light bg-surface-container-lowest flex justify-between items-center relative">
            <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">Giá trị Pipeline theo Phân khúc</h4>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] cursor-pointer hover:text-primary relative" onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}>more_horiz</span>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full right-2 mt-1 bg-white border border-border-light rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                  <button
                    onClick={() => { setMenuOpen(false); exportCSV(segmentData, 'pipeline-by-segment.csv', [{ key: 'segment', label: 'Phân khúc' }, { key: 'activeDeals', label: 'Giao dịch đang mở' }, { key: 'value', label: 'Giá trị' }, { key: 'growth', label: 'Tăng trưởng (%)' }]); }}
                    className="w-full px-4 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    Xuất CSV
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); alert('Tính năng đang phát triển'); }}
                    className="w-full px-4 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Xem chi tiết
                  </button>
                </div>
              </>
            )}
          </div>
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-border-light">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">PHÂN KHÚC</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">GIAO DỊCH ĐANG MỞ</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">GIÁ TRỊ</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">TĂNG TRƯỞNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {segmentData.map((row) => (
                <tr key={row.label} className="hover:bg-surface-container transition-colors">
                  <td className="px-4 py-4 text-body-md text-on-surface">{row.segment}</td>
                  <td className="px-4 py-4 text-data-mono text-on-surface text-right">{row.activeDeals}</td>
                  <td className="px-4 py-4 text-data-mono text-on-surface text-right">{formatCurrency(row.value)}</td>
                  <td className={`px-4 py-4 text-body-sm text-right ${row.growthUp ? 'text-success' : 'text-danger'}`}>
                    {row.growthUp ? '+' : ''}{row.growth}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Closed Deal Value */}
        <div className="bg-white border border-border-light rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border-light bg-surface-container-lowest flex justify-between items-center">
            <h4 className="text-[12px] font-semibold text-on-surface uppercase tracking-wider">Giá trị Hợp đồng đã ký</h4>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] cursor-pointer hover:text-primary" onClick={() => exportCSV(closedDealQuarters, 'closed-deals.csv', [{ key: 'quarter', label: 'Quý' }, { key: 'count', label: 'Số lượng thắng' }, { key: 'revenue', label: 'Doanh thu' }, { key: 'target', label: 'So mục tiêu' }])}>download</span>
          </div>
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-border-light">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">QUÝ</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">SỐ LƯỢNG THẮNG</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">DOANH THU</th>
                <th className="px-4 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">SO MỤC TIÊU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {closedDealQuarters.map((row) => (
                <tr key={row.quarter} className="hover:bg-surface-container transition-colors">
                  <td className="px-4 py-4 text-body-md text-on-surface">{row.quarter}</td>
                  <td className="px-4 py-4 text-data-mono text-on-surface text-right">{row.count}</td>
                  <td className="px-4 py-4 text-data-mono text-on-surface text-right">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-4 text-right">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${row.targetClass}`}>{row.target}</span>
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
