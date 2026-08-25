import { useState, useEffect, useCallback } from 'react';
import { getMonthlyPlan, saveMonthlyPlan, applyMonthlyTotal } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';

const years = [2024, 2025, 2026];

const KPI_FIELDS = [
  { key: 'rawLeads', label: { vi: 'Raw Leads', en: 'Raw Leads' } },
  { key: 'mql', label: { vi: 'MQL', en: 'MQL' } },
  { key: 'sql', label: { vi: 'SQL', en: 'SQL' } },
  { key: 'oppCount', label: { vi: 'OPP Count', en: 'OPP Count' } },
  { key: 'closedCount', label: { vi: 'Closed', en: 'Closed' } },
  { key: 'pipelineValue', label: { vi: 'Pipeline', en: 'Pipeline' } },
  { key: 'wonValue', label: { vi: 'Won Value', en: 'Won Value' } },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const EMPTY_MONTH = () => {
  const m = { month: 0 };
  KPI_FIELDS.forEach(f => { m[f.key] = 0; });
  return m;
};

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('vi-VN');
}

function getStatus(total, annualVal) {
  if (!annualVal) return null;
  const diff = total - annualVal;
  if (diff === 0) return { key: 'enough', vi: 'Đủ', en: 'Enough', color: 'text-green-600 bg-green-50' };
  if (diff < 0) return { key: 'short', vi: 'Thiếu', en: 'Short', color: 'text-red-600 bg-red-50' };
  return { key: 'excess', vi: 'Thừa', en: 'Excess', color: 'text-blue-600 bg-blue-50' };
}

export default function PlanKPIsForm() {
  const { locale } = useDashboard();
  const addToast = useToast();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [months, setMonths] = useState([]);
  const [annualPlan, setAnnualPlan] = useState(null);
  const [diff, setDiff] = useState(null);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const fetchData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    getMonthlyPlan(selectedYear)
      .then((r) => {
        if (cancelled) return;
        const d = r.data || {};
        const raw = Array.isArray(d.months) ? d.months : [];
        const filled = MONTHS.map(m => {
          const existing = raw.find(x => x.month === m);
          const row = { month: m };
          KPI_FIELDS.forEach(f => { row[f.key] = Number(existing?.[f.key]) || 0; });
          return row;
        });
        setMonths(filled);
        setAnnualPlan(d.annualPlan || null);
        setDiff(d.diff || null);
        setCanApply(!!d.canApply);
      })
      .catch(() => {
        if (cancelled) return;
        setMonths(MONTHS.map(m => { const row = EMPTY_MONTH(); row.month = m; return row; }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedYear]);

  useEffect(() => { return fetchData(); }, [fetchData]);

  const updateCell = (monthIdx, fieldKey, value) => {
    setMonths(prev => {
      const next = [...prev];
      next[monthIdx] = { ...next[monthIdx], [fieldKey]: value };
      return next;
    });
  };

  const totals = {};
  KPI_FIELDS.forEach(f => { totals[f.key] = months.reduce((s, m) => s + (Number(m[f.key]) || 0), 0); });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMonthlyPlan(selectedYear, months);
      addToast(t('Đã lưu kế hoạch tháng', 'Monthly plan saved'), 'success');
      fetchData();
    } catch (e) {
      addToast(t('Lưu thất bại', 'Save failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyClick = () => {
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    setShowApplyModal(false);
    setApplying(true);
    try {
      const r = await applyMonthlyTotal(selectedYear);
      addToast(r.data?.message || t('Đã áp dụng thành công', 'Applied successfully'), 'success');
      fetchData();
    } catch (e) {
      addToast(t('Áp dụng thất bại', 'Apply failed'), 'error');
    } finally {
      setApplying(false);
    }
  };

  const hasAnyDiff = annualPlan && KPI_FIELDS.some(f => {
    const annualVal = annualPlan[`target${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`] || annualPlan[f.key];
    return annualVal && totals[f.key] !== Number(annualVal);
  });

  const inputCls = "w-full px-1.5 py-1 text-[13px] text-right border border-outline-variant rounded bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none tabular-nums";

  return (
    <section className="lg:col-span-4 w-full bg-white border border-border-light p-6 rounded-lg flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">ads_click</span>
          {t('Kế hoạch KPIs theo tháng', 'Monthly KPI Plan')}
        </h3>
        <div className="flex items-center gap-2">
          <select
            className="bg-surface-container-low text-body-sm border border-border-light rounded px-2 py-1 focus:ring-primary focus:border-primary"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map(year => (
              <option key={year} value={year}>{t(`Năm ${year}`, `Year ${year}`)}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-primary text-on-primary rounded text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? t('Đang lưu...', 'Saving...') : t('Lưu kế hoạch', 'Save Plan')}
          </button>
          <button
            onClick={handleApplyClick}
            disabled={applying || !canApply || !hasAnyDiff}
            className="px-3 py-1.5 bg-secondary text-on-secondary rounded text-[11px] font-bold hover:bg-secondary/90 transition-colors disabled:opacity-50"
            title={!canApply ? t('Chưa có dữ liệu hợp lệ', 'No valid data yet') : !hasAnyDiff ? t('Không có chênh lệch', 'No difference') : ''}
          >
            {applying ? t('Đang áp dụng...', 'Applying...') : t('Áp dụng vào năm', 'Apply to Year')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-sm gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          {t('Đang tải...', 'Loading...')}
        </div>
      ) : (
        <div>
          <table className="w-full text-[14px] border-collapse table-fixed">
            <colgroup>
              <col className="w-[110px]" />
              {MONTHS.map((m) => <col key={m} />)}
              <col className="w-[80px]" />
              {annualPlan && <col className="w-[80px]" />}
              {diff && <col className="w-[80px]" />}
              {annualPlan && <col className="w-[70px]" />}
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low">
                <th className="p-2 text-left font-bold text-on-surface-variant">{t('Chỉ tiêu', 'Metric')}</th>
                {MONTHS.map(m => (
                  <th key={m} className="p-2 text-center font-bold text-on-surface-variant">{t(`T${m}`, `M${m}`)}</th>
                ))}
                <th className="p-2 text-center font-bold text-primary">{t('Tổng', 'Total')}</th>
                {annualPlan && (
                  <th className="p-2 text-center font-bold text-secondary">{t('Năm', 'Annual')}</th>
                )}
                {diff && (
                  <th className="p-2 text-center font-bold">{t('±', 'Diff')}</th>
                )}
                {annualPlan && (
                  <th className="p-2 text-center font-bold">{t('Trạng thái', 'Status')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {KPI_FIELDS.map((field) => (
                <tr key={field.key} className="hover:bg-surface-container-low/50">
                  <td className="p-2 font-semibold text-on-surface-variant whitespace-nowrap overflow-hidden text-ellipsis" title={field.label[locale] || field.label.en}>{field.label[locale] || field.label.en}</td>
                  {MONTHS.map((m, idx) => (
                    <td key={m} className="p-1">
                      <input
                        type="number"
                        className={inputCls}
                        value={months[idx]?.[field.key] || ''}
                        onChange={(e) => updateCell(idx, field.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center font-bold tabular-nums text-on-surface">{fmt(totals[field.key])}</td>
                  {annualPlan && (
                    <td className="p-2 text-center tabular-nums text-on-surface-variant">
                      {fmt(annualPlan[`target${field.key.charAt(0).toUpperCase() + field.key.slice(1)}`] || annualPlan[field.key])}
                    </td>
                  )}
                  {diff && (
                    <td className={`p-2 text-center font-bold tabular-nums ${(diff[field.key] ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(diff[field.key])}
                    </td>
                  )}
                  {annualPlan && (() => {
                    const annualVal = annualPlan[`target${field.key.charAt(0).toUpperCase() + field.key.slice(1)}`] || annualPlan[field.key];
                    const status = getStatus(totals[field.key], Number(annualVal) || 0);
                    return status ? (
                      <td className="p-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${status.color}`}>
                          {t(status.vi, status.en)}
                        </span>
                      </td>
                    ) : <td className="p-2"></td>;
                  })()}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-primary">
                <td className="p-2 text-on-surface bg-primary/10">{t('Tổng', 'Total')}</td>
                {MONTHS.map((_, idx) => {
                  const monthTotal = KPI_FIELDS.reduce((s, f) => s + (Number(months[idx]?.[f.key]) || 0), 0);
                  return <td key={idx} className="p-2 text-center tabular-nums bg-primary/10">{fmt(monthTotal)}</td>;
                })}
                <td className="p-2 text-center tabular-nums text-primary font-extrabold bg-primary/10">{fmt(KPI_FIELDS.reduce((s, f) => s + totals[f.key], 0))}</td>
                <td className="p-2 bg-primary/10"></td>
                {diff && <td className="p-2 bg-primary/10"></td>}
                {annualPlan && <td className="p-2 bg-primary/10"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Apply Confirm Modal */}
      {showApplyModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowApplyModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto mx-4 p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  {t('Xác nhận Áp dụng', 'Confirm Apply')}
                </h3>
                <button onClick={() => setShowApplyModal(false)} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">&times;</button>
              </div>

              <p className="text-sm text-on-surface-variant mb-4">
                {t('Tổng 12 tháng sẽ được đặt làm mục tiêu năm:', 'Monthly totals will be applied as annual targets:')}
              </p>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-semibold">{t('KPI', 'KPI')}</th>
                    <th className="py-2 text-right font-semibold">{t('Mục tiêu hiện tại', 'Current Target')}</th>
                    <th className="py-2 text-right font-semibold">{t('Giá trị mới', 'New Value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_FIELDS.map((f) => {
                    const annualVal = Number(annualPlan?.[`target${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`] || annualPlan?.[f.key]) || 0;
                    const newVal = totals[f.key];
                    const changed = annualVal !== newVal;
                    return (
                      <tr key={f.key} className={`border-b ${changed ? 'bg-primary/5' : ''}`}>
                        <td className="py-2 font-medium">{f.label[locale] || f.label.en}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(annualVal)}</td>
                        <td className={`py-2 text-right tabular-nums font-bold ${changed ? 'text-primary' : ''}`}>{fmt(newVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 px-4 py-3 border border-border-light text-on-surface-variant font-semibold rounded-lg hover:bg-surface-container-low transition-all"
                >
                  {t('Hủy', 'Cancel')}
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-3 bg-secondary text-on-secondary font-semibold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {t('Xác nhận', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
