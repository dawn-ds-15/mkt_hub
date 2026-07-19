import { useState, useEffect } from 'react';
import { getExpenseOverview } from '../../services/api';

function formatCurrency(n) {
  n = n ?? 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  return n.toLocaleString('vi-VN');
}

function formatFullCurrency(n) {
  return (n ?? 0).toLocaleString('vi-VN') + ' ₫';
}

function formatSignedCurrency(n) {
  n = n ?? 0;
  const prefix = n > 0 ? '+' : '';
  return prefix + n.toLocaleString('vi-VN');
}

export default function ExpenseOverview() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 4;

  useEffect(() => {
    getExpenseOverview().then((res) => setData(res.data));
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
        <p className="font-headline-sm ml-3">Đang tải tổng quan...</p>
      </div>
    );
  }

  const projectExpenses = data.projectExpenses || [];
  const kpis = data.kpis || [];
  const budgetAllocation = data.budgetAllocation || [];
  const hasData = projectExpenses.length > 0 || kpis.length > 0 || budgetAllocation.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-[64px] text-outline-variant">finance_chart</span>
        <p className="font-headline-sm">Chưa có dữ liệu tổng quan</p>
        <p className="text-body-md text-outline">Nhập chi phí ở tab Nhập chi phí để xem dữ liệu tổng quan và báo cáo.</p>
        <p className="text-body-sm text-outline italic">(API /v1/expenses/overview hiện chưa trả về dữ liệu)</p>
      </div>
    );
  }

  const filteredRows = projectExpenses.filter((r) =>
    r.project.toLowerCase().includes(search.toLowerCase())
  );
  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 shadow-sm ${
              kpi.color === 'success' ? 'border-t-success' : 'border-t-primary'
            }`}
          >
            {kpi.badge ? (
              <div className="flex justify-between items-start mb-2">
                <p className="text-outline font-label-md text-label-md uppercase tracking-wide">{kpi.label}</p>
                <span className="px-2 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded-full border border-success/20 whitespace-nowrap">{kpi.badge}</span>
              </div>
            ) : (
              <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide">{kpi.label}</p>
            )}
            <h3 className={`font-display-lg text-display-lg ${kpi.color === 'success' ? 'text-success' : 'text-on-surface'}`}>
              {kpi.value}
            </h3>
            <p className="text-body-sm font-body-sm text-outline mt-1 italic">{kpi.suffix}</p>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-12 gap-8">
        {/* Logic Summary + Budget Allocation */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Logic Summary */}
          <div className="bg-primary-container p-6 rounded-lg text-white shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-[120px]">calculate</span>
            </div>
            <h4 className="font-headline-sm text-headline-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">info</span>
              Logic Tính Toán
            </h4>
            <div className="space-y-4 relative z-10">
              <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-sm">
                <p className="font-label-md text-label-md uppercase text-primary-fixed mb-1">Chi phí Thu hút Khách hàng (CAC)</p>
                <p className="font-body-md text-body-md leading-relaxed">
                  CAC = Tổng chi phí Marketing / Số khách hàng mới từ nguồn trả phí.
                </p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-sm">
                <p className="font-label-md text-label-md uppercase text-primary-fixed mb-1">Giá trị Vòng đời KH (LTV)</p>
                <p className="font-body-md text-body-md leading-relaxed">
                  LTV = Giá trị đơn hàng TB × Tần suất mua × Thời gian gắn bó. (Tự động ước tính dựa trên dữ liệu lịch sử)
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    const rows = projectExpenses.map(r => [r.project, r.directCost, r.overhead, r.total].join(',')).join('\n');
                    const csv = 'Dự án,Chi phí trực tiếp,Gián tiếp,Tổng\n' + rows;
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expense-overview.csv'; a.click();
                  }}
                  className="w-full py-2 bg-white text-primary font-bold rounded hover:bg-primary-fixed transition-colors text-label-md"
                >
                  XUẤT BÁO CÁO CHI TIẾT
                </button>
              </div>
            </div>
          </div>

          {/* Budget Allocation */}
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg p-6 shadow-sm">
            <h4 className="font-title-lg text-title-lg mb-4 text-on-surface">Phân bổ Ngân sách</h4>
            <div className="space-y-4">
              {budgetAllocation.map((item) => (
                <div key={item.channel} className="space-y-2">
                  <div className="flex justify-between font-label-md text-label-md">
                    <span>{item.channel}</span>
                    <span>{item.percent}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${item.percent}%`, opacity: item.percent === 65 ? 1 : item.percent === 25 ? 0.6 : 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense Table */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-surface-muted">
              <h4 className="font-title-lg text-title-lg text-on-surface">Bảng Chi Phí Theo Project</h4>
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    id="expense-overview-search"
                    className="pl-9 pr-4 py-2 border border-border-subtle rounded-lg text-body-sm focus:ring-1 focus:ring-primary focus:border-primary w-48 outline-none"
                    placeholder="Tìm dự án..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                </div>
                <button
                  onClick={() => {
                    const input = document.querySelector('#expense-overview-search');
                    if (input) { input.focus(); input.select(); }
                  }}
                  className="p-2 border border-border-subtle rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">filter_list</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto data-table-container flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-muted border-b border-border-subtle sticky top-0">
                  <tr>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline">Dự án</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline">Loại</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline text-right">Ngân sách</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline text-right">Thực tế</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline text-right">Chênh lệch</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline text-center">KH Mới</th>
                    <th className="px-cell-padding-x py-cell-padding-y font-label-md text-label-md text-outline text-right">CAC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paginatedRows.map((row) => (
                    <tr key={row.project} className="hover:bg-primary/5 transition-colors">
                      <td className="px-cell-padding-x py-cell-padding-y font-body-md text-body-md text-on-surface font-semibold">{row.project}</td>
                      <td className="px-cell-padding-x py-cell-padding-y font-body-sm text-body-sm text-on-surface-variant">{row.type}</td>
                      <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.budgetPlan)}</td>
                      <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">{formatFullCurrency(row.actualCost)}</td>
                      <td className={`px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right font-bold ${
                        row.variance > 0 ? 'text-success' : row.variance < 0 ? 'text-danger' : 'text-secondary'
                      }`}>
                        {formatSignedCurrency(row.variance)}
                      </td>
                      <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-center text-on-surface">{row.newCust}</td>
                      <td className="px-cell-padding-x py-cell-padding-y font-data-mono text-data-mono text-right text-on-surface">
                        {row.cac > 0 ? formatFullCurrency(row.cac) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border-subtle bg-surface-muted flex justify-between items-center">
              <span className="text-body-sm text-outline">Hiển thị {Math.min(page * rowsPerPage, totalRows)} trong {(data.totalProjects || 0)} Dự án</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`p-1 px-3 border border-border-subtle rounded transition-colors ${
                      page === p ? 'bg-primary text-on-primary border-primary' : 'hover:bg-surface-container'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 px-3 border border-border-subtle rounded hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
