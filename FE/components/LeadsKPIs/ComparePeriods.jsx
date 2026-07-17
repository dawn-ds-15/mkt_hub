import React, { useState, useEffect } from 'react';
import { getCompareData, getQuarterlyCompareData } from '../../services/api';

function formatNum(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'Tr';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'N';
  return n.toLocaleString();
}

function formatCurrency(n) {
  if (n == null) return '—';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'Tr';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'N';
  return '$' + n.toLocaleString();
}

const metricsConfig = [
  { key: 'Raw Leads', label: 'Raw Leads', format: formatNum },
  { key: 'MQL', label: 'MQL', format: formatNum },
  { key: 'SQL', label: 'SQL', format: formatNum },
  { key: 'Won Value', label: 'Giá trị thắng ($)', format: formatCurrency },
  { key: 'CAC / LTV', label: 'CAC ($)', format: (v) => v != null ? '$' + v.toFixed(1) : '—', subField: 'cac' },
  { key: 'CAC / LTV', label: 'LTV ($)', format: (v) => v != null ? '$' + v.toLocaleString() : '—', subField: 'ltv' },
];

const quarterLabels = ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'];

const insights = [
  {
    title: 'Cơ hội Tăng trưởng',
    color: 'border-l-primary bg-primary/5',
    textColor: 'text-primary',
    desc: 'Raw Leads năm 2026 đang vượt kế hoạch 13%. Tập trung chuyển đổi ở phễu giữa (MQL → SQL) để tối ưu hóa ROI.',
  },
  {
    title: 'Cảnh báo Hiệu suất',
    color: 'border-l-warning bg-warning/5',
    textColor: 'text-warning',
    desc: 'Tỷ lệ SQL đang giảm nhẹ 2.6% so với cùng kỳ. Cần rà soát lại tiêu chuẩn đánh giá chất lượng Lead của bộ phận Bán hàng.',
  },
  {
    title: 'Điểm sáng Tài chính',
    color: 'border-l-success bg-success/5',
    textColor: 'text-success',
    desc: 'LTV tăng trưởng 14.2% cho thấy chiến lược giữ chân khách hàng đang phát huy hiệu quả tốt.',
  },
];

const periodOptions = [
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
];

export default function ComparePeriods({ year: currentYear }) {
  const [periodType, setPeriodType] = useState('quarter');
  const [periodValue, setPeriodValue] = useState('1');
  const [selectedYears, setSelectedYears] = useState(['2026', '2025']);
  const [compareData, setCompareData] = useState({});
  const [quarterlyData, setQuarterlyData] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('Raw Leads');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [periodType, periodValue, selectedYears, selectedMetric]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compareRes, quarterlyRes] = await Promise.all([
        getCompareData(selectedYears.length ? selectedYears : [currentYear], periodType, periodValue),
        getQuarterlyCompareData(selectedYears.length ? selectedYears : [currentYear], selectedMetric),
      ]);
      setCompareData(compareRes.data);
      setQuarterlyData(quarterlyRes.data);
    } catch (error) {
      console.error('Error loading compare data:', error);
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
          <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Hiển thị theo:</span>
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
            <span className="text-[12px] font-semibold text-on-surface-variant">Năm so sánh:</span>
            <div className="flex gap-2">
              {['2026', '2025', '2024'].map((yr) => (
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
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-body-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Cập nhật
          </button>
        </div>
      </section>

      {/* Bảng so sánh đa chỉ số */}
      <section className="bg-white border border-border-light rounded overflow-hidden">
        <div className="px-4 py-4 border-b border-border-light flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            Bảng so sánh đa chỉ số
          </h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-surface-container rounded transition-colors" title="Xuất Excel">
              <span className="material-symbols-outlined text-on-surface-variant">download</span>
            </button>
            <button className="p-2 hover:bg-surface-container rounded transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-border-light">
                <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider sticky left-0 bg-surface-container-low z-10 min-w-[200px]">Chỉ số</th>
                {selectedYears.map((yr, yi) => (
                  <React.Fragment key={yr}>
                    <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Thực tế {yr}</th>
                    {yi === 0 && (
                      <>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">KH {yr}</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">% KH</th>
                      </>
                    )}
                  </React.Fragment>
                ))}
                {selectedYears.length >= 2 && (
                  <th className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Tăng trưởng YoY</th>
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
                          {metric.key === 'CAC / LTV' ? '0' : metric.format(planVal ?? 0)}
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

      {/* Biểu đồ & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grouped Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-border-light rounded p-4 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <h3 className="text-headline-sm font-semibold text-on-surface">So sánh theo {periodOptions.find(o => o.key === periodType)?.label || 'Quý'}</h3>
              <p className="text-body-sm text-on-surface-variant">Phân tích xu hướng đa năm</p>
            </div>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-surface-container border-none text-body-sm font-semibold rounded px-4 py-2 focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              {['Raw Leads', 'MQL', 'SQL', 'Won Value'].map(m => (
                <option key={m} value={m}>Chỉ số: {m}</option>
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
          <h3 className="text-headline-sm font-semibold text-on-surface">Phân tích Nhanh</h3>
          <div className="space-y-4">
            {insights.map((item) => (
              <div key={item.title} className={`p-4 ${item.color} border-l-4 rounded-r`}>
                <h4 className={`text-[12px] font-semibold ${item.textColor} mb-1`}>{item.title}</h4>
                <p className="text-body-sm text-on-surface">{item.desc}</p>
              </div>
            ))}
          </div>
          <button className="w-full py-2.5 bg-surface-container hover:bg-secondary-container transition-colors rounded font-semibold text-secondary flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
            Trình tạo Báo cáo AI
          </button>
        </div>
      </div>
    </div>
  );
}
