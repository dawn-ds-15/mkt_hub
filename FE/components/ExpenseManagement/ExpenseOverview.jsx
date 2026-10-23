import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../contexts/DashboardContext';
import { getProjects, getClosedDealsRaw, getExpenseOverview, updateProject } from '../../services/api';
import { periodRange, dealStartDate, dealPeriodDate, dealValue } from '../../utils/marketingCostMetrics';

const CURRENT_YEAR = new Date().getFullYear();
const FIRST_YEAR = 2022;
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - FIRST_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_QUARTER = Math.ceil(CURRENT_MONTH / 3);

// Bảng màu phân loại (thứ tự cố định, đã kiểm định CVD) — sáng / tối
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_LIGHT = '#a3a29c';
const OTHER_DARK = '#6f6e69';
const MAX_SLICES = 7;

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function formatFull(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} ₫`;
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return Math.round(v).toLocaleString('vi-VN');
}

// BE trả null khi kỳ không có won deal (CAC) / không có chi phí → hiển thị "N/A"
const formatRoas = (v) => (v == null ? 'N/A' : `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}x`);
const formatMoneyOrDash = (v) => (v == null ? 'N/A' : formatFull(v));

const METRICS = [
  { key: 'totalCost', vi: 'Tổng chi phí', en: 'Total cost', fmt: formatCompact, full: formatFull },
  { key: 'roas', vi: 'ROAS', en: 'ROAS', fmt: formatRoas, full: formatRoas },
  { key: 'cac', vi: 'CAC', en: 'CAC', fmt: (v) => (v == null ? 'N/A' : formatCompact(v)), full: formatMoneyOrDash },
  { key: 'cpmql', vi: 'CPMQL', en: 'CPMQL', fmt: (v) => (v == null ? 'N/A' : formatCompact(v)), full: formatMoneyOrDash },
  { key: 'cpsql', vi: 'CPSQL', en: 'CPSQL', fmt: (v) => (v == null ? 'N/A' : formatCompact(v)), full: formatMoneyOrDash },
];

const numOrNull = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

// Tham số period của /v1/expenses/overview: YYYY | YYYY-QX | YYYY-MM
function overviewPeriod(year, type, value) {
  if (type === 'quarter') return `${year}-Q${value}`;
  if (type === 'month') return `${year}-${String(value).padStart(2, '0')}`;
  return String(year);
}

// Số liệu tab Tổng quan lấy từ BE /v1/expenses/overview (snapshot mới nhất, trước VAT, đã cộng batch kho ghi vào hạng mục;
// ROAS / CAC / CPMQL / CPSQL theo dự án "tính chỉ số lead", won deal xếp kỳ theo ngày bắt đầu opportunity).
function mapOverview(ov) {
  const m = ov?.metrics || {};
  const totalCost = Number(m.actualTotalBeforeVat ?? m.totalExpense) || 0;
  const generalCost = Number(m.inventoryCategoryCost) || 0;
  return {
    totalCost,
    generalCost,
    projectCost: totalCost - generalCost,
    leadCost: Number(m.leadCost) || 0,
    leadSourceIds: Array.isArray(m.leadSourceProjectIds) ? m.leadSourceProjectIds : [],
    usingDefault: m.leadSourceMode === 'default',
    mql: Number(m.mql) || 0,
    sql: Number(m.sql) || 0,
    wonCount: Number(m.wonCount ?? m.newCustomers) || 0,
    wonValue: Number(m.wonValue ?? m.totalWonValue) || 0,
    roas: numOrNull(m.roas ?? m.roa),
    cac: numOrNull(m.cac),
    cpmql: numOrNull(m.cpmql),
    cpsql: numOrNull(m.cpsql),
    perProject: (Array.isArray(ov?.projects) ? ov.projects : []).map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      projectType: p.projectType || '',
      planned: Number(p.plannedTotal ?? p.budgetTotal) || 0,
      actual: Number(p.actualTotal) || 0,
      wonCount: Number(p.newCustomers) || 0,
      cac: numOrNull(p.cac),
      isLeadSource: Boolean(p.isLeadSource),
    })),
  };
}

export default function ExpenseOverview({ refreshKey }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const isDark = useIsDark();
  const navigate = useNavigate();
  const [dealsModal, setDealsModal] = useState(null);

  const [periodType, setPeriodType] = useState('year');
  const [periodValue, setPeriodValue] = useState(CURRENT_QUARTER);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [projects, setProjects] = useState(null);
  const [deals, setDeals] = useState([]);
  const [overview, setOverview] = useState(null);
  const [yearly, setYearly] = useState({});
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingPicker, setSavingPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [compareMetric, setCompareMetric] = useState('totalCost');
  const [compareYears, setCompareYears] = useState(() => YEAR_OPTIONS.slice(0, 3).reverse());
  const rowsPerPage = 8;

  const range = periodRange({ year, type: periodType, value: periodValue });
  const period = overviewPeriod(year, periodType, periodValue);

  // Danh sách dự án (chọn dự án tính chỉ số) + won deal (chỉ để liệt kê trong popup chi tiết ROAS / CAC)
  useEffect(() => {
    let cancelled = false;
    Promise.all([getProjects(), getClosedDealsRaw().catch(() => ({ data: [] }))])
      .then(([projRes, dealRes]) => {
        if (cancelled) return;
        setProjects(Array.isArray(projRes.data) ? projRes.data : []);
        setDeals(dealRes.data || []);
      })
      .catch(() => { if (!cancelled) setProjects([]); });
    return () => { cancelled = true; };
  }, [refreshKey, reloadTick]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getExpenseOverview(period)
      .then((res) => { if (!cancelled) setOverview({ period, data: mapOverview(res.data) }); })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.status === 403
          ? t('Bạn không có quyền xem tổng quan chi phí.', 'You do not have permission to view expense overview.')
          : t('Không thể tải tổng quan. Vui lòng thử lại.', 'Could not load overview. Please try again.'));
      });
    return () => { cancelled = true; };
  }, [period, refreshKey, reloadTick]);

  // So sánh các năm: mỗi năm 1 lần gọi overview?period=YYYY (cache theo năm, xoá khi dữ liệu đổi)
  useEffect(() => { setYearly({}); }, [refreshKey, reloadTick]);
  useEffect(() => {
    const missing = compareYears.filter((y) => !(y in yearly));
    if (missing.length === 0) return undefined;
    let cancelled = false;
    Promise.all(missing.map((y) => getExpenseOverview(String(y)).then((res) => [y, mapOverview(res.data)]).catch(() => [y, null])))
      .then((pairs) => { if (!cancelled) setYearly((prev) => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { cancelled = true; };
  }, [compareYears, yearly]);

  const base = overview?.data || null;
  const selectedIds = base?.leadSourceIds || [];
  const usingDefaultSelection = Boolean(base?.usingDefault);

  // Won deal trong kỳ (theo ngày bắt đầu opp; thiếu thì ngày ký) — chỉ để liệt kê, số liệu tính là của BE
  const metrics = useMemo(() => {
    if (!base) return null;
    const wonDeals = deals.filter((d) => {
      const date = dealPeriodDate(d);
      return date && date >= range.from && date <= range.to;
    });
    return { ...base, wonDeals, dealsMissingStartDate: wonDeals.filter((d) => !dealStartDate(d)).length };
  }, [base, deals, range.from, range.to]);

  const compareData = useMemo(() => [...compareYears].sort((a, b) => a - b).map((y) => ({
    year: y,
    value: yearly[y] ? yearly[y][compareMetric] : null,
  })), [yearly, compareYears, compareMetric]);

  const handlePeriodTypeChange = (type) => {
    setPeriodType(type);
    setPeriodValue(type === 'month' ? CURRENT_MONTH : CURRENT_QUARTER);
    setPage(1);
  };

  // Lưu = bật/tắt isLeadSource trên từng dự án thay đổi. "Khôi phục mặc định" (ids = null) tắt hết để BE dùng bộ mặc định.
  const saveSelection = async (ids) => {
    const want = new Set(ids || []);
    const changes = (projects || []).filter((p) => Boolean(p.isLeadSource) !== want.has(p.id));
    if (changes.length === 0) { setPickerOpen(false); return; }
    setSavingPicker(true);
    try {
      await Promise.all(changes.map((p) => updateProject(p.id, { isLeadSource: want.has(p.id) })));
      setPickerOpen(false);
      setReloadTick((n) => n + 1);
    } catch (err) {
      window.alert(err?.response?.status === 403
        ? t('Chỉ quản lý mới được đổi dự án tính chỉ số.', 'Only managers can change metric projects.')
        : t('Không lưu được cấu hình dự án tính chỉ số.', 'Could not save metric projects.'));
      setReloadTick((n) => n + 1);
    } finally {
      setSavingPicker(false);
    }
  };

  const filterBar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 bg-surface-container-lowest rounded-lg border border-border-light p-1">
        {[
          { key: 'year', vi: 'Năm', en: 'Year' },
          { key: 'quarter', vi: 'Quý', en: 'Quarter' },
          { key: 'month', vi: 'Tháng', en: 'Month' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handlePeriodTypeChange(tab.key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
              periodType === tab.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            {t(tab.vi, tab.en)}
          </button>
        ))}
      </div>
      {periodType !== 'year' && (
        <select
          value={periodValue}
          onChange={(e) => { setPeriodValue(Number(e.target.value)); setPage(1); }}
          className="border border-border-light rounded-lg text-xs px-2 py-1.5 bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none"
        >
          {Array.from({ length: periodType === 'month' ? 12 : 4 }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>{periodType === 'month' ? t(`Tháng ${v}`, `Month ${v}`) : t(`Quý ${v}`, `Q${v}`)}</option>
          ))}
        </select>
      )}
      <select
        value={year}
        onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
        className="border border-border-light rounded-lg text-xs px-2 py-1.5 bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none"
      >
        {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{t(`Năm ${y}`, `Year ${y}`)}</option>)}
      </select>
      {projects && base && (
        <button
          onClick={() => setPickerOpen(true)}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 border border-border-light rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
          title={t('Chọn các dự án trực tiếp mang lại lead — chi phí của chúng dùng để tính ROAS, CAC, CPMQL, CPSQL', 'Pick the projects that directly bring leads')}
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          {t(`Dự án tính chỉ số (${selectedIds.length}${usingDefaultSelection ? ' · mặc định' : ''})`, `Metric projects (${selectedIds.length}${usingDefaultSelection ? ' · default' : ''})`)}
        </button>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        {filterBar}
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-[64px] text-outline-variant">error</span>
          <p className="font-headline-sm">{error}</p>
          <button onClick={() => setReloadTick((n) => n + 1)} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:brightness-110 transition-all">
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] text-outline-variant animate-spin">sync</span>
        <p className="font-headline-sm ml-3">{t('Đang tải tổng quan...', 'Loading overview...')}</p>
      </div>
    );
  }

  const leadCaption = t(
    `Chi phí ${selectedIds.length} dự án lead: ${formatFull(metrics.leadCost)}`,
    `Cost of ${selectedIds.length} lead projects: ${formatFull(metrics.leadCost)}`
  );
  const kpis = [
    {
      key: 'totalCost',
      value: formatFull(metrics.totalCost),
      caption: metrics.generalCost > 0
        ? t(`Dự án ${formatCompact(metrics.projectCost)} + kho ghi vào hạng mục ${formatCompact(metrics.generalCost)} (trước VAT)`, `Projects ${formatCompact(metrics.projectCost)} + inventory booked to categories ${formatCompact(metrics.generalCost)}`)
        : t('Chi phí thực tế (trước VAT)', 'Actual cost (pre-VAT)'),
    },
    { key: 'roas', value: formatRoas(metrics.roas), caption: t(`Won ${formatCompact(metrics.wonValue)} / chi phí lead`, `Won ${formatCompact(metrics.wonValue)} / lead cost`), onClick: () => setDealsModal('roas') },
    { key: 'cac', value: formatMoneyOrDash(metrics.cac), caption: t(`Chi phí lead / ${metrics.wonCount} won deal`, `Lead cost / ${metrics.wonCount} won deals`), onClick: () => setDealsModal('cac') },
    { key: 'cpmql', value: formatMoneyOrDash(metrics.cpmql), caption: t(`Chi phí lead / ${metrics.mql} MQL`, `Lead cost / ${metrics.mql} MQL`) },
    { key: 'cpsql', value: formatMoneyOrDash(metrics.cpsql), caption: t(`Chi phí lead / ${metrics.sql} SQL`, `Lead cost / ${metrics.sql} SQL`) },
  ];

  const sortedProjects = [...metrics.perProject]
    .filter((p) => p.actual > 0 || p.planned > 0)
    .sort((a, b) => b.actual - a.actual || b.planned - a.planned);
  const filteredRows = sortedProjects.filter((r) => (r.projectName || '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  // Tỷ lệ chi phí theo phân loại dự án — lớn nhất trước, gộp phần đuôi vào "Khác"
  const byType = {};
  for (const p of metrics.perProject) {
    if (p.actual <= 0) continue;
    const key = p.projectType || t('Chưa phân loại', 'Unclassified');
    byType[key] = (byType[key] || 0) + p.actual;
  }
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const palette = isDark ? SERIES_DARK : SERIES_LIGHT;
  const slices = typeEntries.slice(0, MAX_SLICES).map(([label, value], i) => ({ label, value, color: palette[i] }));
  const rest = typeEntries.slice(MAX_SLICES).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) slices.push({ label: t('Khác', 'Other'), value: rest, color: isDark ? OTHER_DARK : OTHER_LIGHT });
  if (metrics.generalCost > 0) {
    slices.push({ label: t('Chi phí chung (kho ghi vào hạng mục)', 'General cost (inventory)'), value: metrics.generalCost, color: isDark ? '#4f4e4a' : '#d4d3cd' });
  }

  const exportCsv = () => {
    const header = ['Dự án', 'Loại', 'Ngân sách (trước VAT)', 'Thực tế (trước VAT)', 'Chênh lệch', 'KH mới', 'CAC', 'Tính chỉ số lead'];
    const rows = sortedProjects.map((r) => [r.projectName, r.projectType, r.planned, r.actual, r.planned - r.actual, r.wonCount, r.wonCount ? Math.round(r.actual / r.wonCount) : '', r.isLeadSource ? 'x' : '']);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tong-quan-chi-phi-${range.from}_${range.to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {filterBar}

      {metrics.dealsMissingStartDate > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg border border-warning/40 bg-warning/5 text-[12px] text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-warning shrink-0">info</span>
          <span>
            {t(
              `${metrics.dealsMissingStartDate} won deal chưa có ngày bắt đầu opportunity — tạm xếp kỳ theo ngày ký hợp đồng.`,
              `${metrics.dealsMissingStartDate} won deals have no opportunity start date — grouped by signed date for now.`
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const def = METRICS.find((m) => m.key === kpi.key);
          const body = (
            <>
              <p className="text-outline font-label-md text-label-md mb-2 uppercase tracking-wide flex items-center justify-between gap-2">
                {t(def.vi, def.en)}
                {kpi.onClick && (
                  <span className="inline-flex items-center gap-0.5 normal-case tracking-normal text-[11px] font-semibold text-primary">
                    {t('Chi tiết', 'Details')}
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </span>
                )}
              </p>
              <h3 className="font-headline-sm text-[22px] leading-8 font-semibold text-on-surface tabular-nums break-words">{kpi.value}</h3>
              <p className="text-body-sm font-body-sm text-outline mt-1">{kpi.caption}</p>
            </>
          );
          const cls = 'bg-surface-container-lowest border border-border-subtle p-5 rounded-lg border-t-4 border-t-primary shadow-sm text-left';
          return kpi.onClick ? (
            <button
              key={kpi.key}
              type="button"
              onClick={kpi.onClick}
              className={`${cls} hover:border-primary/50 hover:shadow-md transition-all`}
              title={t('Xem danh sách won deal đang dùng để tính', 'Show the won deals used in this metric')}
            >
              {body}
            </button>
          ) : (
            <div key={kpi.key} className={cls}>{body}</div>
          );
        })}
      </div>
      <p className="text-[11px] text-outline -mt-3">{leadCaption}</p>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
          <h4 className="font-title-lg text-title-lg text-on-surface mb-4">{t('Tỷ lệ chi phí theo phân loại dự án', 'Cost share by project type')}</h4>
          <DonutChart slices={slices} total={metrics.totalCost} t={t} />
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-border-subtle flex flex-wrap gap-2 justify-between items-center bg-surface-muted">
              <h4 className="font-title-lg text-title-lg text-on-surface">{t('Bảng chi phí theo dự án', 'Cost by project')}</h4>
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    className="pl-9 pr-4 py-2 border border-border-subtle rounded-lg text-body-sm focus:ring-1 focus:ring-primary focus:border-primary w-48 outline-none bg-surface-container-lowest"
                    placeholder={t('Tìm dự án...', 'Search project...')}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                </div>
                <button onClick={exportCsv} className="px-3 py-2 border border-border-subtle rounded-lg text-xs font-semibold hover:bg-surface-container-low inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">download</span>CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-muted border-b border-border-subtle">
                  <tr>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline">{t('Dự án', 'Project')}</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline">{t('Loại', 'Type')}</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-right">{t('Ngân sách', 'Budget')}</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-right">{t('Thực tế', 'Actual')} ↓</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-right">{t('Chênh lệch', 'Variance')}</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-center" title={t('Số won deal của dự án (theo ngày bắt đầu opportunity)', 'Won deals of the project')}>{t('KH mới', 'New cust')}</th>
                    <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-right" title={t('Chi phí thực tế dự án / số KH mới', 'Project cost / new customers')}>CAC</th>
                    <th className="px-2 py-2.5" aria-label={t('Chi tiết', 'Details')} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant text-body-sm">
                        {t('Chưa có chi phí trong kỳ này', 'No expenses in this period')}
                      </td>
                    </tr>
                  ) : pageRows.map((row) => {
                    const variance = row.planned - row.actual;
                    return (
                      <tr key={row.projectId} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-2.5 text-body-sm text-on-surface font-semibold">
                          {row.projectName}
                          {row.isLeadSource && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary align-middle" title={t('Chi phí dự án này được tính vào ROAS/CAC/CPMQL/CPSQL', 'Counted in lead metrics')}>LEAD</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-body-sm text-on-surface-variant">{row.projectType || '—'}</td>
                        <td className="px-4 py-2.5 font-data-mono text-[13px] text-right text-on-surface whitespace-nowrap">{formatFull(row.planned)}</td>
                        <td className="px-4 py-2.5 font-data-mono text-[13px] text-right text-on-surface font-semibold whitespace-nowrap">{formatFull(row.actual)}</td>
                        <td className={`px-4 py-2.5 font-data-mono text-[13px] text-right whitespace-nowrap ${variance < 0 ? 'text-danger' : 'text-on-surface-variant'}`}>
                          {variance > 0 ? '+' : ''}{Math.round(variance).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-2.5 font-data-mono text-[13px] text-center text-on-surface">{row.wonCount || '—'}</td>
                        <td className="px-4 py-2.5 font-data-mono text-[13px] text-right text-on-surface whitespace-nowrap">{formatMoneyOrDash(row.cac ?? (row.wonCount ? row.actual / row.wonCount : null))}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/expense?tab=input&projectId=${encodeURIComponent(row.projectId)}`)}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[12px] font-semibold text-primary hover:bg-primary/10 whitespace-nowrap"
                            title={t('Mở bảng chi tiết chi phí của dự án', 'Open the project cost detail')}
                          >
                            {t('Chi tiết', 'Details')}
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border-subtle bg-surface-muted flex justify-between items-center">
              <span className="text-body-sm text-outline">
                {t(`${filteredRows.length} dự án có chi phí`, `${filteredRows.length} projects with cost`)}
              </span>
              <div className="flex gap-1">
                <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="p-1 px-2 border border-border-subtle rounded hover:bg-surface-container disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="px-2 py-1 text-body-sm text-on-surface-variant tabular-nums">{safePage}/{totalPages}</span>
                <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} className="p-1 px-2 border border-border-subtle rounded hover:bg-surface-container disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h4 className="font-title-lg text-title-lg text-on-surface">{t('So sánh các năm', 'Year comparison')}</h4>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={compareMetric}
              onChange={(e) => setCompareMetric(e.target.value)}
              className="border border-border-light rounded-lg text-xs px-2 py-1.5 bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none"
            >
              {METRICS.map((m) => <option key={m.key} value={m.key}>{t(m.vi, m.en)}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {[...YEAR_OPTIONS].reverse().map((y) => {
                const on = compareYears.includes(y);
                return (
                  <button
                    key={y}
                    onClick={() => setCompareYears((prev) => (on ? (prev.length > 1 ? prev.filter((v) => v !== y) : prev) : [...prev, y]))}
                    aria-pressed={on}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      on ? 'bg-primary text-on-primary border-primary' : 'border-border-light text-on-surface-variant hover:border-primary'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <BarChart
          data={compareData}
          metric={METRICS.find((m) => m.key === compareMetric)}
          color={isDark ? SERIES_DARK[0] : SERIES_LIGHT[0]}
          t={t}
        />
        <p className="text-[11px] text-outline mt-3">
          {t(
            'Số liệu cả năm. ROAS, CAC, CPMQL, CPSQL dùng chi phí các dự án đang chọn ở "Dự án tính chỉ số"; won deal xếp năm theo ngày bắt đầu opportunity.',
            'Full-year figures. Lead metrics use the cost of the projects selected in "Metric projects"; won deals are grouped by opportunity start date.'
          )}
        </p>
      </div>

      {dealsModal && (
        <WonDealsModal
          metric={dealsModal}
          metrics={metrics}
          projects={projects || []}
          range={range}
          onClose={() => setDealsModal(null)}
          t={t}
        />
      )}

      {pickerOpen && (
        <LeadProjectPicker
          projects={projects || []}
          selectedIds={selectedIds}
          usingDefault={usingDefaultSelection}
          saving={savingPicker}
          onSave={saveSelection}
          onClose={() => setPickerOpen(false)}
          t={t}
        />
      )}
    </div>
  );
}

function DonutChart({ slices, total, t }) {
  const [active, setActive] = useState(null);
  const sum = slices.reduce((s, x) => s + x.value, 0);
  if (sum <= 0) {
    return <p className="py-16 text-center text-body-sm text-on-surface-variant">{t('Chưa có chi phí trong kỳ này', 'No expenses in this period')}</p>;
  }
  const size = 200;
  const r = 80;
  const stroke = 30;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = (s.value / sum) * c;
    const arc = { ...s, i, dash: Math.max(0, len - (slices.length > 1 ? 2 : 0)), offset };
    offset += len;
    return arc;
  });
  const shown = active != null ? slices[active] : null;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('Biểu đồ tỷ lệ chi phí theo phân loại dự án', 'Cost share by project type')} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.i ? stroke + 4 : stroke}
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={-a.offset}
              onMouseEnter={() => setActive(a.i)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer transition-all"
            >
              <title>{`${a.label}: ${formatFull(a.value)} (${((a.value / sum) * 100).toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        <text x="50%" y="46%" textAnchor="middle" className="fill-current text-on-surface-variant" style={{ fontSize: 11 }}>
          {shown ? shown.label : t('Tổng chi phí', 'Total')}
        </text>
        <text x="50%" y="58%" textAnchor="middle" className="fill-current text-on-surface" style={{ fontSize: 16, fontWeight: 600 }}>
          {shown ? `${((shown.value / sum) * 100).toFixed(1)}%` : formatCompact(total)}
        </text>
      </svg>
      <ul className="flex-1 w-full space-y-1.5">
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 text-[12px] rounded px-1.5 py-1 ${active === i ? 'bg-surface-container-low' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="flex-1 text-on-surface truncate" title={s.label}>{s.label}</span>
            <span className="tabular-nums text-on-surface-variant">{formatCompact(s.value)}</span>
            <span className="tabular-nums text-on-surface font-semibold w-12 text-right">{((s.value / sum) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ data, metric, color, t }) {
  const [hover, setHover] = useState(null);
  const values = data.map((d) => (d.value == null ? 0 : d.value));
  const max = Math.max(...values, 0);
  const height = 220;
  const padTop = 24;
  const padBottom = 28;
  const plotH = height - padTop - padBottom;
  const niceMax = max > 0 ? max * 1.1 : 1;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const n = Math.max(data.length, 1);
  const slot = 100 / n;
  const barW = Math.min(slot * 0.5, 14);
  if (data.every((d) => d.value == null || d.value === 0)) {
    return <p className="py-16 text-center text-body-sm text-on-surface-variant">{t('Chưa có dữ liệu cho các năm đã chọn', 'No data for the selected years')}</p>;
  }
  return (
    <div className="relative">
      <svg width="100%" height={height} role="img" aria-label={`${t('So sánh', 'Compare')} ${metric.vi}`}>
        {gridLines.map((g) => {
          const y = padTop + plotH * (1 - g);
          return (
            <g key={g}>
              <line x1="0" x2="100%" y1={y} y2={y} className="stroke-current text-border-light" strokeWidth="1" strokeDasharray={g === 0 ? '' : '3 3'} />
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = d.value == null ? 0 : d.value;
          const h = (v / niceMax) * plotH;
          const cx = slot * i + slot / 2;
          const y = padTop + plotH - h;
          return (
            <g key={d.year} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={`${slot * i}%`} y={padTop} width={`${slot}%`} height={plotH} fill="transparent" />
              {h > 0 && (
                <rect
                  x={`${cx - barW / 2}%`}
                  y={y}
                  width={`${barW}%`}
                  height={h}
                  rx="4"
                  fill={color}
                  opacity={hover == null || hover === i ? 1 : 0.55}
                />
              )}
              <text x={`${cx}%`} y={Math.max(12, y - 6)} textAnchor="middle" className="fill-current text-on-surface" style={{ fontSize: 11, fontWeight: 600 }}>
                {metric.fmt(d.value)}
              </text>
              <text x={`${cx}%`} y={height - 8} textAnchor="middle" className="fill-current text-on-surface-variant" style={{ fontSize: 11 }}>
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div
          className="absolute top-0 pointer-events-none px-2.5 py-1.5 rounded-md shadow-md bg-surface-container-lowest border border-border-light text-[12px] text-on-surface whitespace-nowrap"
          style={{ left: `${slot * hover + slot / 2}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-on-surface-variant">{data[hover].year} · {metric.vi}: </span>
          <span className="font-semibold tabular-nums">{metric.full(data[hover].value)}</span>
        </div>
      )}
    </div>
  );
}

function LeadProjectPicker({ projects, selectedIds, usingDefault, saving, onSave, onClose, t }) {
  const [picked, setPicked] = useState(() => new Set(selectedIds));
  const [q, setQ] = useState('');
  const list = [...projects]
    .filter((p) => (p.name || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)) || String(a.name).localeCompare(String(b.name)));
  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border-light">
          <h3 className="text-base font-bold text-on-surface">{t('Dự án tính chỉ số lead', 'Lead metric projects')}</h3>
          <p className="text-[12px] text-on-surface-variant mt-1">
            {t(
              'Chọn các dự án trực tiếp mang lại lead. Tổng chi phí thực tế của các dự án này dùng để tính ROAS, CAC, CPMQL, CPSQL. Cấu hình áp dụng cho mọi người dùng.',
              'Pick projects that directly bring leads. Their actual cost is used for ROAS, CAC, CPMQL, CPSQL.'
            )}
          </p>
          {usingDefault && (
            <p className="mt-2 px-3 py-2 rounded-lg bg-warning/10 text-[12px] text-on-surface">
              {t(
                'Chưa có dự án nào được đánh dấu — đang dùng bộ mặc định (dự án có lead / opp / won deal). Bấm "Áp dụng" để lưu danh sách này thành cấu hình chung.',
                'No project is flagged yet — using the default set. Click "Apply" to save this list as the shared config.'
              )}
            </p>
          )}
          <input
            className="mt-3 w-full border border-border-light rounded-lg px-3 py-2 text-body-sm bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none"
            placeholder={t('Tìm dự án...', 'Search project...')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {list.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low cursor-pointer">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="accent-primary w-4 h-4" />
                <span className="flex-1 text-body-sm text-on-surface">{p.name}</span>
                <span className="text-[11px] text-on-surface-variant">{p.type || ''}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t border-border-light flex items-center justify-between gap-2">
          <button
            onClick={() => onSave(null)}
            disabled={saving || usingDefault}
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            title={t('Bỏ cấu hình, dùng bộ mặc định của BE (dự án có lead / opp / won deal)', 'Clear config and use the default set')}
          >
            {t('Khôi phục mặc định', 'Reset to default')}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border-light rounded-lg text-xs font-medium hover:bg-surface-container-low">{t('Hủy', 'Cancel')}</button>
            <button
              onClick={() => onSave([...picked])}
              disabled={saving || picked.size === 0}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50"
            >
              {saving ? t('Đang lưu...', 'Saving...') : t(`Áp dụng (${picked.size})`, `Apply (${picked.size})`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Danh sách won deal đang dùng để tính ROAS / CAC trong kỳ (feedback 25/09 T06 lần 2) — để double check số liệu
function WonDealsModal({ metric, metrics, projects, range, onClose, t }) {
  const projectName = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p.name])), [projects]);
  const rows = [...metrics.wonDeals].sort((a, b) => dealPeriodDate(a).localeCompare(dealPeriodDate(b)));
  const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const formula = metric === 'roas'
    ? `ROAS = ${formatFull(metrics.wonValue)} / ${formatFull(metrics.leadCost)} = ${formatRoas(metrics.roas)}`
    : t(`CAC = ${formatFull(metrics.leadCost)} / ${metrics.wonCount} won deal = ${formatMoneyOrDash(metrics.cac)}`,
      `CAC = ${formatFull(metrics.leadCost)} / ${metrics.wonCount} won deals = ${formatMoneyOrDash(metrics.cac)}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border-light flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-on-surface">
              {t(`Won deal tính ${metric === 'roas' ? 'ROAS' : 'CAC'}`, `Won deals in ${metric === 'roas' ? 'ROAS' : 'CAC'}`)}
              <span className="ml-2 text-[12px] font-medium text-on-surface-variant">{fmtDate(range.from)} – {fmtDate(range.to)}</span>
            </h3>
            <p className="text-[13px] text-on-surface mt-1 font-data-mono">{formula}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {t('Won deal xếp kỳ theo ngày bắt đầu opportunity; deal chưa có ngày bắt đầu tạm xếp theo ngày ký.', 'Deals are grouped by opportunity start date; deals without it use the signed date.')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-low text-on-surface-variant" aria-label={t('Đóng', 'Close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-muted border-b border-border-subtle sticky top-0">
              <tr>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline w-10">#</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline">{t('Khách hàng', 'Customer')}</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline">{t('Hợp đồng', 'Contract')}</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline">{t('Dự án', 'Project')}</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline whitespace-nowrap">{t('Ngày bắt đầu opp', 'Opp start')}</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline whitespace-nowrap">{t('Ngày ký', 'Signed')}</th>
                <th className="px-4 py-2.5 font-label-md text-label-md text-outline text-right">{t('Giá trị', 'Value')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-body-sm text-on-surface-variant">{t('Không có won deal trong kỳ này', 'No won deals in this period')}</td></tr>
              ) : rows.map((d, i) => {
                const start = dealStartDate(d);
                return (
                  <tr key={d.id || i} className="hover:bg-primary/5">
                    <td className="px-4 py-2 text-[12px] text-on-surface-variant tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2 text-body-sm text-on-surface font-semibold">{d.companyName || d.customer || '—'}</td>
                    <td className="px-4 py-2 text-body-sm text-on-surface-variant">{d.contractName || '—'}</td>
                    <td className="px-4 py-2 text-body-sm text-on-surface-variant">{projectName[d.projectId] || d.project?.name || '—'}</td>
                    <td className="px-4 py-2 text-[13px] font-data-mono whitespace-nowrap">
                      {start ? fmtDate(start) : <span className="text-warning" title={t('Chưa có ngày bắt đầu opportunity', 'No opportunity start date')}>—</span>}
                    </td>
                    <td className="px-4 py-2 text-[13px] font-data-mono whitespace-nowrap">{fmtDate(String(d.closedDate || d.signedDate || '').slice(0, 10))}</td>
                    <td className="px-4 py-2 text-[13px] font-data-mono text-right whitespace-nowrap">{formatFull(dealValue(d))}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border-light bg-surface-muted/60">
                  <td colSpan={6} className="px-4 py-2.5 text-[13px] font-bold text-on-surface">{t(`Tổng ${rows.length} won deal`, `Total ${rows.length} won deals`)}</td>
                  <td className="px-4 py-2.5 text-[13px] font-bold font-data-mono text-right whitespace-nowrap">{formatFull(metrics.wonValue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
