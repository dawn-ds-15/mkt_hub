import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { getExpenseList, getCategoryBudgetDashboard } from '../../services/api';

const CURRENT_YEAR = String(new Date().getFullYear());

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
}

function formatPercent(p) {
  if (p === null || p === undefined || p === '' || Number.isNaN(Number(p))) return '---';
  const rounded = Math.round(Number(p) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

// Đơn giá quy ước TRƯỚC VAT (xem ExpenseReports "trước VAT", getCategoryBudgetActuals)
function preVatPrice(ln) {
  if (ln.unitPriceBeforeVat != null && ln.unitPriceBeforeVat !== '') return Number(ln.unitPriceBeforeVat) || 0;
  const base = Number(ln.actualUnitPrice ?? ln.unitPriceAfterVat ?? ln.unitPriceAfterVatSnapshot ?? 0);
  const vatRate = ln.vatRateSnapshot != null ? Number(ln.vatRateSnapshot) : (ln.vatRate != null ? Number(ln.vatRate) : 0);
  return vatRate > 0 ? Math.round(base / (1 + vatRate / 100)) : base;
}

function matchesCategory(ln, cat) {
  const sameId = ln.categoryId && cat.categoryId && String(ln.categoryId) === String(cat.categoryId);
  const lName = String(ln.hangMucLon || '').trim().toLowerCase();
  const cName = String(cat.categoryName || '').trim().toLowerCase();
  const sameName = lName && cName && lName === cName;
  return Boolean(sameId || sameName);
}

function matchesYear(p) {
  return String(p).includes(CURRENT_YEAR);
}

function matchesPeriodFilter(expensePeriod, periodType, periodValue, filterYear) {
  if (!expensePeriod) return false;
  const pStr = String(expensePeriod);
  const pYear = parseInt(pStr.split('-')[0], 10);
  const pMonth = parseInt(pStr.split('-')[1], 10);
  if (periodType === 'year') {
    return pYear === parseInt(filterYear, 10);
  }
  if (periodType === 'month') {
    const [fv, fm] = (periodValue || '').split('-').map(Number);
    return pYear === fv && pMonth === fm;
  }
  return true;
}

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
  const [expenses, setExpenses] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [periodType, setPeriodType] = useState('year');
  const [periodValue, setPeriodValue] = useState(CURRENT_YEAR);
  const budgetSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const fetchYear = periodType === 'month' ? (periodValue.split('-')[0] || CURRENT_YEAR)
      : periodType === 'year' ? periodValue : CURRENT_YEAR;
    getExpenseList(undefined, undefined, fetchYear)
      .then((res) => {
        if (!cancelled) setExpenses(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});
    return () => { cancelled = true };
  }, [periodType, periodValue]);

  useEffect(() => {
    const seq = ++budgetSeqRef.current;
    setLoading(true);
    setDashboard(null);
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
    return () => {};
  }, [periodType, periodValue, refreshKey]);

  const expenseFiltered = useMemo(() => (
    expenses.filter((e) => matchesPeriodFilter(e.period, periodType, periodValue, CURRENT_YEAR))
  ), [expenses, periodType, periodValue]);

  const handlePeriodTypeChange = (newType) => {
    setPeriodType(newType);
    if (newType === 'year') setPeriodValue(CURRENT_YEAR);
    else if (newType === 'month') setPeriodValue(`${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  };

  const periodYear = periodType === 'month' ? (periodValue.split('-')[0] || CURRENT_YEAR) : periodValue;
  const monthOptions = useMemo(() => getMonthOptions(periodYear), [periodYear]);

  const totalBudget = Number(dashboard?.totalBudget) || 0;

  const categoryRows = useMemo(() => {
    if (dashboard?.categories && Array.isArray(dashboard.categories) && dashboard.categories.length > 0) {
      return dashboard.categories.map((c) => {
        const budgetPlan = totalBudget > 0 ? Math.round(totalBudget * (Number(c.percentage) || 0) / 100) : 0;
        // Chi phí thực tế đã trừ vào nhóm: khớp line chi phí dự án theo categoryId/hạng mục lớn (trước VAT)
        const actual = (expenseFiltered || []).reduce((sum, exp) => {
          const lines = Array.isArray(exp.lines) ? exp.lines : [];
          for (const ln of lines) {
            if (!matchesCategory(ln, c)) continue;
            const qty = Number(ln.actualQuantity) || Number(ln.actualQty) || 0;
            sum += qty * preVatPrice(ln);
          }
          return sum;
        }, 0);
        const catRemaining = budgetPlan - actual;
        const catUsage = budgetPlan > 0 ? (actual / budgetPlan * 100) : null;
        return {
          name: c.categoryName || '',
          budgetPlan,
          actual,
          percent: c.percentage != null ? Number(c.percentage) : 0,
          remaining: catRemaining,
          usagePercent: catUsage,
        };
      });
    }
    return [];
  }, [dashboard, totalBudget, expenseFiltered]);

  const actualSpent = Number(dashboard?.actualSpent) || 0;
  const remaining = Number(dashboard?.remainingBudget) || 0;
  const usedPercentage = dashboard?.usedPercentage;

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
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-background-subtle border-b border-border-light">
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{locale === 'vi' ? 'Nhóm hạng mục' : 'Category group'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Chi phí kế hoạch' : 'Plan Cost'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Còn lại' : 'Remaining'}</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-right">{locale === 'vi' ? 'Sử dụng %' : 'Usage %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {categoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">
                        {locale === 'vi' ? 'Chưa có dữ liệu chi phí' : 'No expense data'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {categoryRows.map((row) => (
                        <tr key={row.name} className="hover:bg-surface-bright transition-colors">
                          <td className="px-4 py-3 text-[13px] font-medium text-on-surface truncate" title={row.name}>{row.name}</td>
                          <td className="px-4 py-3 text-right font-data-mono text-[13px] text-on-surface">{formatCurrency(row.budgetPlan)}</td>
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