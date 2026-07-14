import { useState, useEffect } from 'react';
import { getExpenseReports } from '../../services/api';

function formatCurrency(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  return n.toLocaleString('vi-VN');
}

function formatFullCurrency(n) {
  return n.toLocaleString('vi-VN') + ' ₫';
}

const periodTabs = ['Tháng', 'Quý', 'Năm'];

const CHART_COLORS = ['bg-primary', 'bg-secondary', 'bg-tertiary'];

export default function ExpenseReports() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('Tháng');
  const [page, setPage] = useState(1);
  const rowsPerPage = 4;

  useEffect(() => {
    getExpenseReports().then((res) => setData(res.data));
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
        <p className="font-headline-sm ml-3">Đang tải báo cáo...</p>
      </div>
    );
  }

  const totalCost = data.costByProjectType.reduce((s, i) => s + i.value, 0);
  const totalBudget = data.budgetVsActual.reduce((s, i) => s + i.budget, 0);
  const totalActual = data.budgetVsActual.reduce((s, i) => s + i.actual, 0);
  const variance = ((totalActual - totalBudget) / totalBudget * 100).toFixed(1);
  const avgCAC = data.trendData.reduce((s, d) => s + d.cac, 0) / data.trendData.length;
  const maxExpense = Math.max(...data.trendData.map((d) => d.expense));
  const totalRows = data.detailRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedRows = data.detailRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-6">
      {/* Header: Period filter + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-body-md font-medium text-secondary">Thời gian:</span>
          <div className="flex bg-surface-container-high rounded-lg p-1">
            {periodTabs.map((t) => (
              <button
                key={t}
                onClick={() => setPeriod(t)}
                className={`px-4 py-1 text-label-md rounded transition-colors ${
                  period === t
                    ? 'bg-surface-container-lowest shadow-sm text-primary font-bold'
                    : 'text-secondary hover:bg-surface-container-lowest'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:brightness-110 transition-all active:scale-95">
          <span className="material-symbols-outlined text-[18px]">file_download</span>
          Xuất Dữ liệu
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm">
          <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">Tổng Chi Phí</p>
          <h3 className="font-display-lg text-display-lg text-on-surface">{formatCurrency(totalCost)}</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">Từ {data.trendData.length} kỳ</p>
        </div>
        <div className="bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm">
          <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">Tổng Budget</p>
          <h3 className="font-display-lg text-display-lg text-on-surface">{formatCurrency(totalBudget)}</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">Theo kế hoạch</p>
        </div>
        <div className="bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm">
          <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">Thực Tế</p>
          <h3 className="font-display-lg text-display-lg text-on-surface">{formatCurrency(totalActual)}</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">Đã giải ngân</p>
        </div>
        <div className={`bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 shadow-sm ${
          variance > 0 ? 'border-t-success' : 'border-t-danger'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-outline font-label-md text-label-md uppercase tracking-wide">Variance</p>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
              variance > 0
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-danger/10 text-danger border-danger/20'
            }`}>
              {variance > 0 ? 'Tiết kiệm' : 'Vượt'}
            </span>
          </div>
          <h3 className={`font-display-lg text-display-lg ${
            variance > 0 ? 'text-success' : 'text-danger'
          }`}>{variance > 0 ? '+' : ''}{variance}%</h3>
          <p className="text-body-sm font-body-sm text-outline mt-1 italic">CAC TB: {formatFullCurrency(Math.round(avgCAC))}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Donut */}
        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-lg shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">Phân tích % Chi phí theo Loại Project</h3>
            <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">more_vert</span>
          </div>
          <div className="flex flex-1 items-center justify-around flex-wrap gap-6">
            <div
              className="relative w-48 h-48 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(
                  #00236f 0% ${data.costByProjectType[0].percentage}%,
                  #0058be ${data.costByProjectType[0].percentage}% ${data.costByProjectType[0].percentage + data.costByProjectType[1].percentage}%,
                  #340081 ${data.costByProjectType[0].percentage + data.costByProjectType[1].percentage}% 100%
                )`,
              }}
            >
              <div className="w-32 h-32 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-label-md text-secondary">Tổng cộng</span>
                <span className="font-headline-sm text-headline-sm text-primary">{formatCurrency(totalCost)}</span>
              </div>
            </div>
            <div className="space-y-3">
              {data.costByProjectType.map((item, i) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${CHART_COLORS[i]}`} />
                  <span className="text-body-sm text-secondary">
                    {item.type} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Trend */}
        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-lg shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">Trend Chi Phí & CAC Theo Thời Gian</h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
                <span className="text-[10px] text-secondary uppercase">Expense</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-warning rounded-full" />
                <span className="text-[10px] text-secondary uppercase">CAC</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-between gap-2 pt-4 border-l border-b border-border-subtle relative h-48">
            {data.trendData.map((d) => {
              const heightPct = Math.max((d.expense / maxExpense) * 100, 8);
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center justify-end relative group">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm transition-all duration-300 group-hover:bg-primary/30 cursor-pointer relative max-w-[40px]"
                    style={{ height: `${heightPct}%` }}
                  >
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-warning rounded-full border-2 border-white shadow-sm"
                    />
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-10 pointer-events-none">
                    {formatCurrency(d.expense)} | CAC: {d.cac.toLocaleString('vi-VN')}₫
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 px-1 text-[10px] text-outline">
            {data.trendData.map((d) => (
              <span key={d.month}>{d.month}</span>
            ))}
          </div>
        </div>

        {/* Chart 3: Budget vs Actual - full width */}
        <div className="bg-surface-container-lowest border border-border-subtle p-6 rounded-lg shadow-sm flex flex-col lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-title-lg text-title-lg text-on-surface">So Sánh Budget vs Actual by Project</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-body-sm text-secondary">Budget</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-secondary rounded-sm" />
                <span className="text-body-sm text-secondary">Actual</span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {data.budgetVsActual.map((item) => (
              <div key={item.project} className="space-y-1.5">
                <div className="flex justify-between text-label-md text-secondary mb-1">
                  <span>{item.project}</span>
                  <span className={item.status === 'over' ? 'text-danger font-bold' : ''}>
                    {item.budgetUsed}% {item.status === 'over' ? 'Over Budget' : 'Used'}
                  </span>
                </div>
                <div className="flex h-5 gap-1 rounded-sm overflow-hidden">
                  <div
                    className="bg-primary rounded-sm transition-all duration-500 shadow-sm"
                    style={{ width: `${item.budgetPct}%` }}
                    title={`Budget: ${formatFullCurrency(item.budget)}`}
                  />
                  <div
                    className="bg-secondary rounded-sm transition-all duration-500"
                    style={{ width: `${item.actualPct}%` }}
                    title={`Actual: ${formatFullCurrency(item.actual)}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-outline">
                  <span>Budget: {formatCurrency(item.budget)}</span>
                  <span>Actual: {formatCurrency(item.actual)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="font-title-lg text-title-lg text-on-surface">Chi tiết Theo Kỳ</h3>
          <div className="flex gap-2">
            <button className="p-2 border border-border-subtle rounded-lg hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">filter_list</span>
            </button>
            <button className="p-2 border border-border-subtle rounded-lg hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">settings</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto data-table-container">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-surface-muted border-b border-border-subtle sticky top-0">
                <tr>
                  {['Mã CT', 'Dự án', 'Loại', 'Ngày', 'Chi phí (VNĐ)', 'Budget (VNĐ)', 'Variance', 'Sức khỏe', 'Thao tác'].map((h) => (
                    <th
                      key={h}
                      className={`px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline ${
                        h === 'Chi phí (VNĐ)' || h === 'Budget (VNĐ)' || h === 'Variance' ? 'text-right' : h === 'Action' ? 'text-center' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-primary">{row.id}</td>
                    <td className="px-cell-padding-x py-cell-padding-y font-body-md text-body-md text-on-surface font-semibold">{row.project}</td>
                    <td className="px-cell-padding-x py-cell-padding-y">
                      <span className="px-2.5 py-0.5 bg-surface-container-high text-secondary rounded-full text-[11px] font-medium">{row.type}</span>
                    </td>
                    <td className="px-cell-padding-x py-cell-padding-y font-body-sm text-body-sm text-on-surface-variant">{row.date}</td>
                    <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.cost)}</td>
                    <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.budget)}</td>
                    <td className={`px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right ${
                      row.variance > 0 ? 'text-success' : row.variance < 0 ? 'text-danger' : 'text-secondary'
                    }`}>
                      {row.variance > 0 ? '+' : ''}{row.variance}%
                    </td>
                    <td className="px-cell-padding-x py-cell-padding-y">
                      <div className={`flex items-center gap-1.5 font-medium text-xs ${
                        row.health === 'good' ? 'text-success' : row.health === 'over' ? 'text-danger' : 'text-warning'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          row.health === 'good' ? 'bg-success' : row.health === 'over' ? 'bg-danger' : 'bg-warning'
                        }`} />
                        {row.health === 'good' ? 'Tốt' : row.health === 'over' ? 'Vượt ngân sách' : 'Trung bình'}
                      </div>
                    </td>
                    <td className="px-cell-padding-x py-cell-padding-y text-center">
                      <button className="text-outline hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-cell-padding-x py-cell-padding-y bg-surface-muted border-t border-border-subtle flex justify-between items-center">
              <span className="text-body-sm text-outline">
                Hiển thị {Math.min(page * rowsPerPage, totalRows)} trong {data.totalProjects} dự án
              </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
