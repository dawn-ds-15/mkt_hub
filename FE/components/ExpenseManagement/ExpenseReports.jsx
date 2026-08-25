import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getExpenseReports } from '../../services/api';

function formatCurrency(n) {
  n = n ?? 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  return n.toLocaleString('en-US');
}

function formatFullCurrency(n) {
  n = n ?? 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  return n.toLocaleString('en-US');
}

const periodTabs = [
  { key: 'Month', vi: 'Tháng', en: 'Month' },
  { key: 'Quarter', vi: 'Quý', en: 'Quarter' },
  { key: 'Year', vi: 'Năm', en: 'Year' },
];
const CHART_COLORS = ['bg-primary', 'bg-secondary', 'bg-tertiary'];

export default function ExpenseReports({ refreshKey }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('Month');
  const [page, setPage] = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [error, setError] = useState(null);
  const rowsPerPage = 4;

  function periodToParam(p) {
    const y = new Date().getFullYear();
    if (p === 'Month') return `${y}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (p === 'Quarter') return `${y}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    return String(y);
  }

  useEffect(() => {
    setError(null);
    setData(null);
    getExpenseReports(periodToParam(period))
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 404) {
          setError(t('Chưa có dữ liệu báo cáo cho kỳ này. Vui lòng nhập chi phí trước.', 'No report data for this period. Please enter expenses first.'));
        } else if (status === 403) {
          setError(t('Bạn không có quyền xem báo cáo chi phí.', 'You do not have permission to view expense reports.'));
        } else {
          setError(t('Không thể tải báo cáo. Vui lòng thử lại.', 'Could not load reports. Please try again.'));
        }
      });
  }, [period, refreshKey]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-body-md font-medium text-secondary">{t('Kỳ:', 'Period:')}</span>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              {(periodTabs).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPeriod(t.key)}
                  className={`px-4 py-1 text-label-md rounded transition-colors ${
                    period === t.key
                      ? 'bg-surface-container-lowest shadow-sm text-primary font-bold'
                      : 'text-secondary hover:bg-surface-container-lowest'
                  }`}
                >
                  {t[locale] || t.en}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-[64px] text-outline-variant">error</span>
          <p className="font-headline-sm">{error}</p>
          <button onClick={() => { setError(null); setPeriod(period); }} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:brightness-110 transition-all">
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
        <p className="font-headline-sm ml-3">{locale === 'vi' ? 'Đang tải báo cáo...' : 'Loading reports...'}</p>
      </div>
    );
  }

  const overview = data.overview || {};
  const metrics = overview.metrics || {};
  const projects = overview.projects || [];
  const trend = data.trend || [];
  const distribution = data.distribution || [];

  const totalCost = metrics.totalExpense || 0;
  const totalBudget = projects.reduce((s, p) => s + (p.budgetTotal || 0), 0);
  const totalActual = projects.reduce((s, p) => s + (p.actualTotal || 0), 0);
  const variance = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget * 100).toFixed(1) : '0.0';
  const avgCAC = trend.length > 0 ? trend.reduce((s, d) => s + (d.cac || 0), 0) / trend.length : 0;
  const maxExpense = trend.length > 0 ? Math.max(...trend.map((d) => d.totalExpense || 0)) : 1;
  const hasData = projects.length > 0 || trend.length > 0 || distribution.length > 0;

  const detailRows = projects.map(p => ({
    id: p.projectName,
    project: p.projectName,
    type: p.projectType || 'N/A',
    date: overview.period || '',
    cost: p.actualTotal || 0,
    budget: p.budgetTotal || 0,
    variance: p.budgetTotal > 0 ? (((p.actualTotal || 0) - p.budgetTotal) / p.budgetTotal * 100).toFixed(1) : '0.0',
    health: (p.variance || 0) >= 0 ? 'good' : 'over',
  }));

  const filteredDetailRows = filterText
    ? detailRows.filter(r => (r.project || '').toLowerCase().includes(filterText.toLowerCase()) || (r.type || '').toLowerCase().includes(filterText.toLowerCase()))
    : detailRows;
  const totalRows = filteredDetailRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedRows = filteredDetailRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-body-md font-medium text-secondary">{locale === 'vi' ? 'Kỳ:' : 'Period:'}</span>
            <div className="flex bg-surface-container-high rounded-lg p-1">
              {(periodTabs).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPeriod(t.key)}
                  className={`px-4 py-1 text-label-md rounded transition-colors ${
                    period === t.key
                      ? 'bg-surface-container-lowest shadow-sm text-primary font-bold'
                      : 'text-secondary hover:bg-surface-container-lowest'
                  }`}
                >
                  {t[locale] || t.en}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-[64px] text-outline-variant">bar_chart</span>
          <p className="font-headline-sm">{locale === 'vi' ? 'Chưa có dữ liệu báo cáo' : 'No report data yet'}</p>
          <p className="text-body-md text-outline">{locale === 'vi' ? 'Nhập chi phí ở tab Nhập chi phí trước, sau đó quay lại để xem báo cáo.' : 'Enter costs in the Cost Entry tab first, then return here to view reports.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-body-md font-medium text-secondary">Period:</span>
          <div className="flex bg-surface-container-high rounded-lg p-1">
            {(periodTabs).map((t) => (
              <button
                key={t.key}
                onClick={() => setPeriod(t.key)}
                className={`px-4 py-1 text-label-md rounded transition-colors ${
                  period === t.key
                    ? 'bg-surface-container-lowest shadow-sm text-primary font-bold'
                    : 'text-secondary hover:bg-surface-container-lowest'
                }`}
              >
                {t[locale] || t.en}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            const csv = [['Period', 'Project', 'Type', 'Cost', 'Budget', 'Variance'].join(',')];
            csv.push(...detailRows.map(r => [r.date, r.project, r.type, r.cost, r.budget, r.variance].join(',')));
            const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expense-report.csv'; a.click();
          }}
          className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:brightness-110 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">file_download</span>
          {locale === 'vi' ? 'Xuất dữ liệu' : 'Export Data'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm">
          <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">{locale === 'vi' ? 'Tổng ngân sách' : 'Total Budget'}</p>
          <h3 className="font-display-lg text-display-lg text-on-surface">{formatCurrency(totalBudget)}</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">{locale === 'vi' ? 'Theo kế hoạch' : 'As planned'}</p>
        </div>
        <div className="bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm">
          <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">{locale === 'vi' ? 'Thực tế (trước VAT)' : 'Actual (pre-VAT)'}</p>
          <h3 className="font-display-lg text-display-lg text-on-surface">{formatCurrency(totalActual)}</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">{locale === 'vi' ? 'Đã giải ngân' : 'Disbursed'}</p>
        </div>
        <div className={`bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 shadow-sm ${
          parseFloat(variance) > 0 ? 'border-t-success' : 'border-t-danger'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-outline font-label-md text-label-md uppercase tracking-wide">{locale === 'vi' ? 'Chênh lệch' : 'Variance'}</p>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
              parseFloat(variance) > 0
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-danger/10 text-danger border-danger/20'
            }`}>
              {parseFloat(variance) > 0 ? (locale === 'vi' ? 'Dưới' : 'Under') : (locale === 'vi' ? 'Trên' : 'Over')}
            </span>
          </div>
          <h3 className={`font-display-lg text-display-lg ${
            parseFloat(variance) > 0 ? 'text-success' : 'text-danger'
          }`}>{parseFloat(variance) > 0 ? '+' : ''}{variance}%</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">{locale === 'vi' ? 'CAC TB' : 'Avg CAC'}: {formatFullCurrency(Math.round(avgCAC))}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-xl flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">{locale === 'vi' ? '% Chi phí theo Loại Dự án' : 'Cost % by Project Type'}</h3>
          </div>
          <div className="flex flex-1 items-center justify-around flex-wrap gap-6">
            <div
              className="relative w-48 h-48 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(
                  #00236f 0% ${(distribution[0]?.percentage || 0)}%,
                  #0058be ${(distribution[0]?.percentage || 0)}% ${((distribution[0]?.percentage || 0) + (distribution[1]?.percentage || 0))}%,
                  #340081 ${((distribution[0]?.percentage || 0) + (distribution[1]?.percentage || 0))}% 100%
                )`,
              }}
            >
              <div className="w-32 h-32 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-label-md text-secondary">{locale === 'vi' ? 'Tổng' : 'Total'}</span>
                <span className="font-headline-sm text-headline-sm text-primary">{formatCurrency(totalCost)}</span>
              </div>
            </div>
            <div className="space-y-3">
              {distribution.map((item, i) => (
                <div key={item.projectType} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${CHART_COLORS[i] || 'bg-primary'}`} />
                  <span className="text-body-sm text-secondary">
                    {item.projectType} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-xl flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">{locale === 'vi' ? 'Xu hướng Chi phí & CAC Theo Thời gian' : 'Cost & CAC Trend Over Time'}</h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
                <span className="text-[10px] text-secondary uppercase">{locale === 'vi' ? 'Chi phí' : 'Cost'}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-warning rounded-full" />
                <span className="text-[10px] text-secondary uppercase">CAC</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-between gap-2 pt-4 border-l border-b border-border-subtle relative h-48">
            {trend.map((d) => {
              const heightPct = Math.max((d.totalExpense / maxExpense) * 100, 8);
              return (
                <div key={d.period} className="flex-1 flex flex-col items-center justify-end relative group">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm transition-all duration-300 hover:bg-primary/30 cursor-pointer relative max-w-[40px]"
                    style={{ height: `${heightPct}%` }}
                  >
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-warning rounded-full border-2 border-white shadow-sm"
                    />
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-10 pointer-events-none">
                    {formatCurrency(d.totalExpense)} | CAC: {formatFullCurrency(d.cac)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 px-1 text-[10px] text-outline">
            {trend.map((d) => (
              <span key={d.period}>{d.period}</span>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-xl flex flex-col lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">{locale === 'vi' ? 'Ngân sách vs Thực tế Theo Dự án' : 'Budget vs Actual by Project'}</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-body-sm text-secondary">{locale === 'vi' ? 'Ngân sách' : 'Budget'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-secondary rounded-sm" />
                <span className="text-body-sm text-secondary">{locale === 'vi' ? 'Thực tế' : 'Actual'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {projects.map((item) => {
              const budget = item.budgetTotal || 0;
              const actual = item.actualTotal || 0;
              const maxVal = Math.max(budget, actual, 1);
              const budgetPct = (budget / maxVal) * 100;
              const actualPct = (actual / maxVal) * 100;
              const budgetUsed = budget > 0 ? Math.round((actual / budget) * 100) : 0;
              const status = actual > budget ? 'over' : 'ok';
              return (
                <div key={item.projectName} className="space-y-1.5">
                  <div className="flex justify-between text-label-md text-secondary mb-1">
                    <span>{item.projectName}</span>
                    <span className={status === 'over' ? 'text-danger font-bold' : ''}>
                      {budgetUsed}% {status === 'over' ? (locale === 'vi' ? 'Vượt ngân sách' : 'Over budget') : (locale === 'vi' ? 'Đã dùng' : 'Used')}
                    </span>
                  </div>
                  <div className="flex h-5 gap-1 rounded-sm overflow-hidden">
                    <div
                      className="bg-primary rounded-sm transition-all duration-500 shadow-sm"
                      style={{ width: `${budgetPct}%` }}
                      title={`${locale === 'vi' ? 'Ngân sách' : 'Budget'}: ${formatFullCurrency(budget)}`}
                    />
                    <div
                      className="bg-secondary rounded-sm transition-all duration-500"
                      style={{ width: `${actualPct}%` }}
                      title={`${locale === 'vi' ? 'Thực tế' : 'Actual'}: ${formatFullCurrency(actual)}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-outline">
                    <span>{locale === 'vi' ? 'Ngân sách' : 'Budget'}: {formatCurrency(budget)}</span>
                    <span>{locale === 'vi' ? 'Thực tế' : 'Actual'}: {formatCurrency(actual)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-title-lg text-title-lg text-on-surface">{locale === 'vi' ? 'Chi tiết Kỳ' : 'Period Details'}</h3>
          <div className="flex gap-2 items-center">
            {showFilter && (
              <input
                autoFocus
                className="px-3 py-1.5 border border-border-subtle rounded text-sm w-44 outline-none focus:ring-1 focus:ring-primary"
                placeholder={locale === 'vi' ? 'Tìm dự án hoặc loại...' : 'Search project or type...'}
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setPage(1); }}
              />
            )}
            <button onClick={() => { setShowFilter(!showFilter); setFilterText(''); setPage(1); }} className="p-2 border border-border-subtle rounded-lg hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">filter_list</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto data-table-container">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-muted border-b border-border-subtle sticky top-0">
                <tr>
                  {[
                    { key: 'Project', vi: 'Dự án', en: 'Project' },
                    { key: 'Type', vi: 'Loại', en: 'Type' },
                    { key: 'Period', vi: 'Kỳ', en: 'Period' },
                    { key: 'Cost', vi: 'Chi phí (trước VAT)', en: 'Cost (pre-VAT)' },
                    { key: 'Budget', vi: 'Ngân sách (trước VAT)', en: 'Budget (pre-VAT)' },
                    { key: 'Variance', vi: 'Chênh lệch', en: 'Variance' },
                    { key: 'Health', vi: 'Tình trạng', en: 'Health' },
                  ].map((h) => (
                    <th
                      key={h.key}
                      className={`px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline ${
                        h.key === 'Cost' || h.key === 'Budget' || h.key === 'Variance' ? 'text-right' : ''
                      }`}
                    >
                      {h[locale] || h.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {paginatedRows.map((row) => (
                  <tr key={row.project} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-cell-padding-x py-cell-padding-y font-body-md text-body-md text-on-surface font-semibold">{row.project}</td>
                    <td className="px-cell-padding-x py-cell-padding-y">
                      <span className="px-2.5 py-0.5 bg-surface-container-high text-secondary rounded-full text-[11px] font-medium">{row.type}</span>
                    </td>
                    <td className="px-cell-padding-x py-cell-padding-y font-body-sm text-body-sm text-on-surface-variant">{row.date}</td>
                    <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.cost)}</td>
                    <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.budget)}</td>
                    <td className={`px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right ${
                      parseFloat(row.variance) > 0 ? 'text-success' : parseFloat(row.variance) < 0 ? 'text-danger' : 'text-secondary'
                    }`}>
                      {parseFloat(row.variance) > 0 ? '+' : ''}{row.variance}%
                    </td>
                    <td className="px-cell-padding-x py-cell-padding-y">
                      <div className={`flex items-center gap-1.5 font-medium text-xs ${
                        row.health === 'good' ? 'text-success' : row.health === 'over' ? 'text-danger' : 'text-warning'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          row.health === 'good' ? 'bg-success' : row.health === 'over' ? 'bg-danger' : 'bg-warning'
                        }`} />
                        {row.health === 'good' ? (locale === 'vi' ? 'Tốt' : 'Good') : row.health === 'over' ? (locale === 'vi' ? 'Vượt ngân sách' : 'Over Budget') : (locale === 'vi' ? 'Trung bình' : 'Average')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-cell-padding-x py-cell-padding-y bg-surface-muted border-t border-border-subtle flex justify-between items-center">
            <span className="text-body-sm text-outline">
              {locale === 'vi' ? `Hiển thị ${Math.min(page * rowsPerPage, totalRows)} / ${projects.length} dự án` : `Showing ${Math.min(page * rowsPerPage, totalRows)} of ${projects.length} projects`}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`p-1 px-3 border border-border-subtle rounded transition-colors ${
                    page === p ? 'bg-primary text-on-primary border-primary' : 'hover:bg-surface-container-high'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages || totalPages === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {showDetail && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDetail(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">{locale === 'vi' ? 'Chi tiết Chi phí' : 'Cost Details'}</h3>
                <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</label><p className="font-semibold">{showDetail.project}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Loại' : 'Type'}</label><p>{showDetail.type}</p></div>
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Kỳ' : 'Period'}</label><p>{showDetail.date}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Chi phí' : 'Cost'}</label><p className="font-bold">{formatFullCurrency(showDetail.cost)}</p></div>
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Ngân sách' : 'Budget'}</label><p className="font-bold">{formatFullCurrency(showDetail.budget)}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Chênh lệch' : 'Variance'}</label><p className={`font-bold ${parseFloat(showDetail.variance) > 0 ? 'text-green-600' : parseFloat(showDetail.variance) < 0 ? 'text-red-600' : ''}`}>{parseFloat(showDetail.variance) > 0 ? '+' : ''}{showDetail.variance}%</p></div>
                  <div><label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Tình trạng' : 'Health'}</label><p className={`font-bold ${showDetail.health === 'good' ? 'text-green-600' : showDetail.health === 'over' ? 'text-red-600' : 'text-amber-600'}`}>{showDetail.health === 'good' ? (locale === 'vi' ? 'Tốt' : 'Good') : showDetail.health === 'over' ? (locale === 'vi' ? 'Vượt ngân sách' : 'Over Budget') : (locale === 'vi' ? 'Trung bình' : 'Average')}</p></div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setShowDetail(null)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200 transition-all">{locale === 'vi' ? 'Đóng' : 'Close'}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
