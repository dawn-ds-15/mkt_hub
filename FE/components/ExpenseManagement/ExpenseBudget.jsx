import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getCategoryBudgetDashboard, getCategoryBudgetTree } from '../../services/api';

const CURRENT_YEAR = String(new Date().getFullYear());

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatPercent(p) {
  if (p === null || p === undefined || p === '' || Number.isNaN(Number(p))) return '---';
  const rounded = Math.round(Number(p) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

const sumMonths = (months) => (Array.isArray(months)
  ? months.reduce((s, v) => s + (Number(v) || 0), 0)
  : Object.values(months || {}).reduce((s, v) => s + (Number(v) || 0), 0));

// Giá trị của 1 tháng trong map { "1": .., ..., "12": .. } (hoặc mảng 12 phần tử)
const monthOf = (months, m) => Number(Array.isArray(months) ? months[m - 1] : months?.[m] ?? months?.[String(m)]) || 0;

function getMonthOptions(year = CURRENT_YEAR) {
  return Array.from({ length: 12 }, (_, i) => ({
    value: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: `Tháng ${i + 1}/${year}`,
  }));
}

export default function ExpenseBudget({ refreshKey, onSaved }) {
  const { locale } = useDashboard();
  const addToast = useToast();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [treeCategories, setTreeCategories] = useState([]);
  const [permissions, setPermissions] = useState(null);
  const [periodType, setPeriodType] = useState('year');
  const [periodValue, setPeriodValue] = useState(CURRENT_YEAR);
  const budgetSeqRef = useRef(0);

  useEffect(() => {
    const seq = ++budgetSeqRef.current;
    setLoading(true);
    setDashboard(null);
    setTreeCategories([]);
    const apiYear = periodType === 'month' ? (periodValue.split('-')[0] || CURRENT_YEAR)
      : periodType === 'year' ? periodValue : CURRENT_YEAR;
    getCategoryBudgetDashboard(apiYear)
      .then((res) => {
        if (seq !== budgetSeqRef.current) return;
        setDashboard(res.data);
        setPermissions(res.permissions);
      })
      .catch(() => {
        if (seq !== budgetSeqRef.current) return;
        setDashboard(null);
      })
      .finally(() => {
        if (seq === budgetSeqRef.current) setLoading(false);
      });
    getCategoryBudgetTree(apiYear)
      .then((res) => {
        if (seq !== budgetSeqRef.current) return;
        setTreeCategories(Array.isArray(res.data?.categories) ? res.data.categories : []);
      })
      .catch(() => {
        if (seq !== budgetSeqRef.current) return;
        setTreeCategories([]);
      });
    return () => {};
  }, [periodType, periodValue, refreshKey]);

  const periodYear = periodType === 'month' ? (periodValue.split('-')[0] || CURRENT_YEAR) : periodValue;
  const monthOptions = useMemo(() => getMonthOptions(periodYear), [periodYear]);
  const periodMonth = periodType === 'month' ? Number(String(periodValue).split('-')[1]) || 0 : 0;

  const handlePeriodTypeChange = (newType) => {
    setPeriodType(newType);
    if (newType === 'year') setPeriodValue(CURRENT_YEAR);
    else if (newType === 'month') setPeriodValue(`${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  };

  // Kế hoạch = cây ngân sách (tab "Nhập chi phí tổng hạng mục"); Thực tế = BE tổng hợp trong cây
  // (actuals/actualTotal, TRƯỚC VAT: dòng chi phí dự án ở snapshot mới nhất + batch kho ghi thẳng vào nhóm;
  // dòng không gắn nhóm nằm ở nhóm ảo `unassigned`) → tổng khớp "Tổng chi phí" ở tab Tổng quan.
  // Kỳ tháng: lấy đúng cột tháng đó của cả kế hoạch lẫn thực tế.
  const categoryRows = useMemo(() => {
    const fromTree = Array.isArray(treeCategories) && treeCategories.length > 0;
    const sourceCats = fromTree ? treeCategories : (dashboard?.categories || []);
    const rows = [];
    for (const c of sourceCats) {
      const name = String(fromTree ? (c.name || '') : (c.categoryName || c.name || '')).trim();
      if (!name) continue;
      let budgetPlan;
      let actual;
      let percent;
      if (fromTree) {
        budgetPlan = periodMonth ? monthOf(c.months, periodMonth) : sumMonths(c.months);
        actual = periodMonth ? monthOf(c.actuals, periodMonth) : (Number(c.actualTotal) || sumMonths(c.actuals));
        percent = Number(c.percent) || 0;
      } else {
        budgetPlan = Number(c.budget) || 0;
        actual = Number(c.actual ?? c.actualSpent) || 0;
        percent = c.percentage != null ? Number(c.percentage) : 0;
      }
      rows.push({
        name,
        budgetPlan,
        actual,
        percent,
        remaining: budgetPlan - actual,
        usagePercent: budgetPlan > 0 ? (actual / budgetPlan * 100) : null,
        // Nhóm ảo BE gom dòng chi phí dự án không gắn nhóm hạng mục (vd. "Vật phẩm" xuất kho cho dự án)
        unassigned: Boolean(fromTree && c.unassigned),
      });
    }
    return rows;
  }, [treeCategories, dashboard, periodMonth]);

  const planTotal = categoryRows.reduce((s, r) => s + r.budgetPlan, 0);
  const actualTotal = categoryRows.reduce((s, r) => s + r.actual, 0);
  const dashboardTotal = Number(dashboard?.totalBudget) || 0;
  const dashboardActual = Number(dashboard?.actualSpent) || 0;
  const totalBudget = planTotal > 0 ? planTotal : dashboardTotal;
  const actualSpent = actualTotal > 0 ? actualTotal : dashboardActual;
  const remaining = totalBudget - actualSpent;
  const usedPercentage = totalBudget > 0
    ? (actualSpent / totalBudget) * 100
    : (dashboard?.usedPercentage != null ? Number(dashboard.usedPercentage) : null);

  const budgetCards = [
    { label: locale === 'vi' ? 'Tổng ngân sách' : 'Total budget', value: formatCurrency(totalBudget) },
    { label: locale === 'vi' ? 'Thực tế đã chi' : 'Actual spent', value: formatCurrency(actualSpent), warn: usedPercentage != null && usedPercentage > 100 },
    { label: locale === 'vi' ? 'Ngân sách còn lại' : 'Remaining budget', value: formatCurrency(remaining), negative: remaining < 0 },
    { label: locale === 'vi' ? '% đã sử dụng' : 'Usage', value: usedPercentage == null ? '---' : `${formatPercent(usedPercentage)}%`, over: usedPercentage != null && usedPercentage > 100 },
  ];

  const canExport = permissions?.export !== false;

  const handleExportExcel = () => {
    addToast(t('Chức năng xuất Excel đang phát triển', 'Excel export is under development'));
  };

  const selectCls =
    'bg-surface border border-border-light text-[14px] leading-[20px] font-body-sm rounded px-3 py-1.5 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none text-on-surface';

  const periodTypeOptions = [
    { value: 'month', label: t('Tháng', 'Month') },
    { value: 'year', label: t('Năm', 'Year') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] leading-[16px] font-medium text-on-surface-variant">
              {locale === 'vi' ? 'Thời gian' : 'Period'}
            </label>
            <div className="flex items-center gap-2">
              <select
                className={`${selectCls} w-28`}
                value={periodType}
                onChange={(e) => handlePeriodTypeChange(e.target.value)}
              >
                {periodTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {periodType === 'year' && (
                <input
                  type="number"
                  className={`${selectCls} w-24`}
                  value={periodValue}
                  min="2020"
                  max="2099"
                  onChange={(e) => setPeriodValue(e.target.value)}
                />
              )}
              {periodType === 'month' && (
                <select
                  className={`${selectCls} w-44`}
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        {canExport && (
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-border-light text-on-surface rounded text-[12px] leading-[16px] font-medium hover:bg-surface-bright transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {locale === 'vi' ? 'Xuất Excel' : 'Export Excel'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] text-outline-variant animate-spin">sync</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {budgetCards.map((card) => {
              const cls = card.negative || card.over ? 'text-danger' : (card.warn ? 'text-warning' : 'text-on-surface');
              const bg = card.negative ? 'bg-error-container' : 'bg-surface';
              return (
                <div key={card.label} className={`${bg} border border-border-light rounded-xl p-4`}>
                  <p className="text-[12px] leading-[16px] font-medium text-on-surface-variant mb-1 uppercase tracking-wider">{card.label}</p>
                  <p className={`font-data-mono text-[24px] leading-[32px] font-semibold tabular-nums ${cls}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between bg-surface-muted/20">
              <h3 className="text-sm font-bold text-on-surface">
                {locale === 'vi' ? 'Chi phí theo nhóm hạng mục' : 'Expense by Category Group'}
              </h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                {categoryRows.length} {locale === 'vi' ? 'nhóm hạng mục' : 'category groups'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-background-subtle border-b border-border-light">
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Nhóm hạng mục' : 'Category group'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Chi phí kế hoạch' : 'Plan Cost'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Chi phí thực tế' : 'Actual Cost'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Còn lại' : 'Remaining'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Sử dụng %' : 'Usage %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {categoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                        {locale === 'vi' ? 'Chưa có dữ liệu chi phí' : 'No expense data'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {categoryRows.map((row) => (
                        <tr key={row.name} className="hover:bg-surface-bright transition-colors">
                          <td className="px-4 py-3 text-[13px] font-medium text-on-surface truncate" title={row.unassigned ? t(`${row.name}: dòng chi phí dự án không thuộc nhóm hạng mục nào (vd. xuất kho vật phẩm cho dự án)`, `${row.name}: project cost lines without a category group`) : row.name}>
                            <span className="uppercase">{row.name}</span>
                            {row.unassigned && (
                              <span className="block text-[11px] font-normal normal-case text-on-surface-variant">{t('Chi phí dự án chưa gắn nhóm hạng mục', 'Project cost without category group')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-data-mono text-[13px] text-on-surface">{row.unassigned ? '—' : formatCurrency(row.budgetPlan)}</td>
                          <td className={`px-4 py-3 text-right font-data-mono text-[13px] ${row.budgetPlan > 0 && row.actual > row.budgetPlan ? 'text-danger' : 'text-on-surface'}`}>{formatCurrency(row.actual)}</td>
                          <td className={`px-4 py-3 text-right font-data-mono text-[13px] font-semibold ${row.remaining < 0 ? 'text-danger' : 'text-on-surface'}`}>
                            {formatCurrency(row.remaining)}
                          </td>
                          <td className={`px-4 py-3 text-right font-data-mono text-[13px] font-semibold ${row.usagePercent != null && row.usagePercent > 100 ? 'text-danger' : 'text-on-surface'}`}>
                            {row.usagePercent != null ? `${formatPercent(row.usagePercent)}%` : '---'}
                            {row.usagePercent != null && (
                              <div className="mt-1.5 h-1.5 w-full max-w-[120px] ml-auto bg-surface-container rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${row.usagePercent > 100 ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${Math.min(100, row.usagePercent)}%` }} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border-light bg-surface-muted/60">
                        <td className="px-4 py-3 font-bold text-on-surface text-[13px]">{locale === 'vi' ? 'Tổng cộng' : 'Total'}</td>
                        <td className="px-4 py-3 text-right font-bold font-data-mono text-on-surface text-[13px]">{formatCurrency(totalBudget)}</td>
                        <td className="px-4 py-3 text-right font-bold font-data-mono text-on-surface text-[13px]">{formatCurrency(actualSpent)}</td>
                        <td className={`px-4 py-3 text-right font-bold font-data-mono text-[13px] ${remaining < 0 ? 'text-danger' : 'text-on-surface'}`}>
                          {formatCurrency(remaining)}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold font-data-mono text-[13px] ${usedPercentage != null && usedPercentage > 100 ? 'text-danger' : 'text-on-surface'}`}>
                          {usedPercentage != null ? `${formatPercent(usedPercentage)}%` : '---'}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}