import { useState, useEffect, useRef } from 'react';
import { saveActuals, getActuals, saveMonthlyActuals, getProjects, getProjectKPIPlan, saveProjectKPIPlan } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('vi-VN');
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function EntryField({ label, value, onChange, disabled, placeholder, theme = 'actual' }) {
  const { locale } = useDashboard();
  const isPlan = theme === 'plan';
  return (
    <div className="flex flex-col gap-1 bg-slate-50/70 dark:bg-surface-container/30 p-2.5 rounded-lg border border-slate-200/80 dark:border-border-light/60">
      <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap truncate flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isPlan ? 'bg-secondary' : 'bg-primary'}`} />
        {label}
      </label>
      <NumberInput
        className={`w-full bg-white dark:bg-surface-container-lowest border-2 ${
          isPlan
            ? 'border-secondary/40 focus:border-secondary focus:ring-2 focus:ring-secondary/20'
            : 'border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20'
        } rounded-md py-1.5 px-3 font-bold text-on-surface text-body-lg tabular-nums shadow-sm outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-surface-container`}
        placeholder={placeholder || '0'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={locale === 'vi' ? label : label}
      />
    </div>
  );
}

export default function ActualsForm() {
  const addToast = useToast();
  const { locale, year } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const getCurrentDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [savingActual, setSavingActual] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [actualForm, setActualForm] = useState({ rawLeads: '', mql: '', sql: '' });
  const actualDirtyRef = useRef(false);
  const editActual = (field, value) => {
    actualDirtyRef.current = true;
    setActualForm((p) => ({ ...p, [field]: value }));
  };
  const clearActualDirty = () => { actualDirtyRef.current = false; };
  const [savedActual, setSavedActual] = useState(null);
  const [actualVersion, setActualVersion] = useState(0);
  const [estimatedPlan, setEstimatedPlan] = useState({ rawLeads: '', mql: '', sql: '', oppCount: '', closedCount: '' });
  const estimatedDirtyRef = useRef(false);
  const [allocation, setAllocation] = useState(null);
  const [savedProjectPlan, setSavedProjectPlan] = useState(null);

  const isoWeekLabel = (() => {
    if (!selectedDate) return '';
    const d = new Date(`${selectedDate}T00:00:00`);
    const w = getISOWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
  })();
  const isoMonthLabel = selectedDate ? selectedDate.slice(0, 7) : '';

  useEffect(() => {
    getProjects()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProjects([]));
  }, []);

  const PLAN_METRIC_MAP = {
    rawLeads: 'raw_leads',
    mql: 'mql',
    sql: 'sql',
    oppCount: 'opp',
    closedCount: 'closed_deal',
  };

  const planLoadKey = `${year}|${selectedProjectId}`;
  useEffect(() => {
    setAllocation(null);
    setSavedProjectPlan(null);
    setEstimatedPlan({ rawLeads: '', mql: '', sql: '', oppCount: '', closedCount: '' });
    estimatedDirtyRef.current = false;
    if (!selectedProjectId) return undefined;
    let cancelled = false;
    getProjectKPIPlan(year, selectedProjectId)
      .then((res) => {
        if (cancelled) return;
        const p = res.data || {};
        setEstimatedPlan({
          rawLeads: p.rawLeads != null ? String(p.rawLeads) : '',
          mql: p.mql != null ? String(p.mql) : '',
          sql: p.sql != null ? String(p.sql) : '',
          oppCount: p.oppCount != null ? String(p.oppCount) : '',
          closedCount: p.closedCount != null ? String(p.closedCount) : '',
        });
        setSavedProjectPlan(p);
        setAllocation(res.allocation);
      })
      .catch(() => { if (!cancelled) setAllocation(null); });
    return () => { cancelled = true; };
  }, [planLoadKey]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSavedActual(null);
      setActualForm({ rawLeads: '', mql: '', sql: '' });
      return;
    }
    let cancelled = false;
    setSavedActual(null);
    setActualForm({ rawLeads: '', mql: '', sql: '' });
    getActuals(selectedDate, selectedProjectId)
      .then((r) => { if (!cancelled) setSavedActual(r.data || null); })
      .catch(() => { if (!cancelled) setSavedActual(null); });
    return () => { cancelled = true; };
  }, [selectedProjectId, selectedDate, actualVersion]);

  useEffect(() => {
    if (actualDirtyRef.current) return;
    const s = savedActual;
    if (s && ((Number(s.rawLeads) || 0) || (Number(s.mql ?? s.mqlActual) || 0) || (Number(s.sql ?? s.sqlActual) || 0))) {
      setActualForm({
        rawLeads: Number(s.rawLeads) || '',
        mql: Number(s.mql ?? s.mqlActual) || '',
        sql: Number(s.sql ?? s.sqlActual) || '',
      });
    } else {
      setActualForm({ rawLeads: '', mql: '', sql: '' });
    }
  }, [savedActual, selectedDate, selectedProjectId]);

  const handleSaveActual = async () => {
    if (!selectedProjectId) {
      addToast(t('Vui lòng chọn dự án trước khi lưu Thực tế!', 'Please select a project before saving actuals!'), 'error');
      return;
    }
    if (!selectedDate) {
      addToast(t('Vui lòng chọn Ngày phát sinh trước khi lưu Thực tế!', 'Please select a record date before saving actuals!'), 'error');
      return;
    }
    setSavingActual(true);
    try {
      await saveActuals({
        rawLeads: actualForm.rawLeads,
        mql: actualForm.mql,
        sql: actualForm.sql,
        date: selectedDate,
        projectId: selectedProjectId,
        actualId: savedActual?.actualId || null,
      });
      await saveMonthlyActuals({
        period: selectedDate.slice(0, 7),
        projectId: selectedProjectId,
        rawLeads: actualForm.rawLeads,
        mql: actualForm.mql,
        sql: actualForm.sql,
      });
      clearActualDirty();
      addToast(t('Đã lưu Thực tế thành công!', 'Actuals saved successfully!'), 'success');
      setActualVersion(v => v + 1);
    } catch (error) {
      console.error('Error saving actuals:', error);
      addToast(t('Có lỗi xảy ra khi lưu!', 'An error occurred while saving!'), 'error');
    } finally {
      setSavingActual(false);
    }
  };

  const handleSavePlanEstimate = async () => {
    if (!selectedProjectId) {
      addToast(t('Vui lòng chọn dự án trước khi lưu Kế hoạch!', 'Please select a project before saving plan!'), 'error');
      return;
    }
    setSavingPlan(true);
    try {
      await saveProjectKPIPlan(year, selectedProjectId, {
        rawLeads: estimatedPlan.rawLeads,
        mql: estimatedPlan.mql,
        sql: estimatedPlan.sql,
        oppCount: estimatedPlan.oppCount,
        closedCount: estimatedPlan.closedCount,
      });
      estimatedDirtyRef.current = false;
      addToast(t('Đã lưu Kế hoạch KPI dự án thành công!', 'Project KPI plan saved successfully!'), 'success');
      const res = await getProjectKPIPlan(year, selectedProjectId);
      const p = res.data || {};
      setEstimatedPlan({
        rawLeads: p.rawLeads != null ? String(p.rawLeads) : estimatedPlan.rawLeads,
        mql: p.mql != null ? String(p.mql) : estimatedPlan.mql,
        sql: p.sql != null ? String(p.sql) : estimatedPlan.sql,
        oppCount: p.oppCount != null ? String(p.oppCount) : estimatedPlan.oppCount,
        closedCount: p.closedCount != null ? String(p.closedCount) : estimatedPlan.closedCount,
      });
      setSavedProjectPlan(p);
      setAllocation(res.allocation);
    } catch (error) {
      console.error('Error saving plan estimate:', error);
      addToast(t('Có lỗi xảy ra khi lưu Kế hoạch!', 'An error occurred while saving plan!'), 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const confirmLeaveDirty = () => {
    if (actualDirtyRef.current || estimatedDirtyRef.current) {
      const ok = window.confirm(t('Dữ liệu chưa lưu sẽ bị mất khi đổi lựa chọn. Tiếp tục?', 'Unsaved data will be lost when changing selection. Continue?'));
      if (!ok) return false;
    }
    actualDirtyRef.current = false;
    estimatedDirtyRef.current = false;
    return true;
  };

  const planWarningLines = (() => {
    const lines = [];
    const saved = savedProjectPlan || {};
    const warningFields = [
      { key: 'rawLeads', label: 'RAW LEADS' },
      { key: 'mql', label: 'MQL' },
      { key: 'sql', label: 'SQL' },
      { key: 'oppCount', label: 'OPP' },
      { key: 'closedCount', label: 'CLOSED DEAL' },
    ];
    warningFields.forEach((pf) => {
      const mk = PLAN_METRIC_MAP[pf.key];
      const base = allocation && allocation[mk];
      if (!base) return;
      let { projects_total: total, annual_target: annual, difference: diff, status } = base;
      total = Number(total) || 0;
      annual = Number(annual) || 0;
      if (estimatedDirtyRef.current) {
        const currentContribution = Number(saved[pf.key]) || 0;
        const draftContribution = Number(estimatedPlan[pf.key]) || 0;
        total = total - currentContribution + draftContribution;
      }
      diff = total - annual;
      status = diff > 0 ? 'OVER_ALLOCATED' : (diff < 0 ? 'UNDER_ALLOCATED' : 'EQUAL');
      const value = Number(estimatedPlan[pf.key]) || 0;
      const label = pf.label;
      if (status === 'OVER_ALLOCATED') {
        lines.push({ severity: 'over', text: t(`${label}: vượt kế hoạch năm ${value > 0 ? diff : Math.abs(diff)}`, `${label}: exceeds annual plan by ${value > 0 ? diff : Math.abs(diff)}`) });
      } else if (status === 'UNDER_ALLOCATED' && (Number(estimatedPlan[pf.key]) > 0 || annual > 0)) {
        lines.push({ severity: 'under', text: t(`${label}: thiếu ${Math.abs(diff)} so với kế hoạch năm`, `${label}: short ${Math.abs(diff)} of annual plan`) });
      }
    });
    return lines;
  })();

  const selectCls = "form-select font-body-md text-body-md border-outline-variant rounded-lg p-2 text-on-surface bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none cursor-pointer";

  const planFields = [
    { key: 'rawLeads', label: 'RAW LEADS' },
    { key: 'mql', label: 'MQL' },
    { key: 'sql', label: 'SQL' },
    { key: 'oppCount', label: 'OPP' },
    { key: 'closedCount', label: t('CLOSED DEAL', 'CLOSED DEAL') },
  ];

  return (
    <>
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 sm:p-5 flex flex-col gap-4">
        <div className="border-b border-outline-variant pb-3.5 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5">
            <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-1.5 whitespace-nowrap">
              <span className="material-symbols-outlined text-secondary text-2xl">edit_document</span>
              <span className="whitespace-nowrap font-bold">{t('Nhập Dữ Liệu', 'Data Entry')}</span>
            </h2>
            <span className="text-body-sm text-on-surface-variant italic whitespace-nowrap">{t('Ngày phát sinh chỉ tác động tới số liệu Thực tế; Kế hoạch dự án cố định theo Năm', 'Record date only affects Actuals; Project Plan is fixed by Year')}</span>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-surface-container/40 rounded-xl border border-slate-200 dark:border-border-light/80 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{t('Dự án', 'Project')}</label>
              <select className={selectCls} value={selectedProjectId} onChange={(e) => { if (!confirmLeaveDirty()) return; setSelectedProjectId(e.target.value); }}>
                <option value="">{t('Chọn dự án...', 'Select project...')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{t('Ngày phát sinh', 'Record date')}</label>
              <input
                className={`${selectCls} w-full`}
                type="date"
                value={selectedDate}
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                onChange={(e) => { if (!confirmLeaveDirty()) return; setSelectedDate(e.target.value); }}
              />
              {selectedDate && (
                <p className="text-[11px] text-on-surface-variant italic mt-0.5">
                  {t('Tuần báo cáo:', 'Reporting week:')} <span className="font-semibold">{isoWeekLabel}</span> · {t('Tháng báo cáo:', 'Reporting month:')} <span className="font-semibold">{isoMonthLabel}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* CỘT TRÁI: KẾ HOẠCH KỲ NÀY */}
          <div className="flex flex-col gap-3.5 border-b md:border-b-0 md:border-r border-outline-variant pb-4 md:pb-0 pr-0 md:pr-5">
            <h3 className="font-headline-sm text-headline-sm text-secondary flex items-center gap-1.5 border-b border-outline-variant/60 pb-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-secondary text-xl">ads_click</span>
              <span className="whitespace-nowrap font-bold">{t('Kế Hoạch Kỳ Này', 'Period Plan')}</span>
            </h3>

            {/* Bảng tổng quan dự kiến */}
            <div className="bg-blue-50/70 dark:bg-surface-container/40 border border-blue-200/80 dark:border-border-light/60 rounded-xl p-3 flex flex-col gap-2">
              <div className="text-[12px] font-bold text-secondary flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                <span className="material-symbols-outlined text-[16px] text-secondary">trending_up</span>
                <span className="whitespace-nowrap">{t('Dự kiến kế hoạch kỳ này', 'Period Plan Estimate')}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-center pt-1.5 border-t border-blue-200/60 dark:border-border-light/40">
                {planFields.map((f) => (
                  <div key={f.key} className="flex flex-col items-center min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap truncate w-full" title={f.label}>
                      {f.label}
                    </span>
                    <span className="font-numeric-data text-body-md text-secondary font-extrabold whitespace-nowrap">
                      {fmt(estimatedPlan[f.key]) || '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {allocation && Object.keys(allocation).length > 0 && (
              <div className="p-2.5 bg-amber-50/80 dark:bg-surface-container/40 border border-amber-300/70 dark:border-border-light/60 rounded-xl flex flex-col gap-1">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                  <span className="material-symbols-outlined text-[15px]">gpp_maybe</span>
                  <span className="whitespace-nowrap">{t('Cảnh báo phân bổ so với KPI năm', 'Allocation vs annual KPI')}</span>
                </div>
                {planWarningLines.length === 0 ? (
                  <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">{t('Đã phân bổ đủ các chỉ tiêu so với KPI năm.', 'All metrics match the annual KPI plan.')}</p>
                ) : (
                  planWarningLines.slice(0, 3).map((l, i) => (
                    <p key={i} className={`text-[12px] font-medium ${l.severity === 'over' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>{l.text}</p>
                  ))
                )}
              </div>
            )}

            {/* Các ô nhập kế hoạch (Highlight màu phụ) */}
            <div className="flex flex-col gap-2.5">
              {planFields.map((f) => (
                <EntryField
                  key={f.key}
                  disabled={!selectedProjectId}
                  label={f.label}
                  value={estimatedPlan[f.key]}
                  onChange={(e) => {
                    estimatedDirtyRef.current = true;
                    setEstimatedPlan(p => ({ ...p, [f.key]: e.target.value }));
                  }}
                  placeholder="0"
                  theme="plan"
                />
              ))}
            </div>

            {/* Nút lưu Kế hoạch */}
            <div className="flex justify-end pt-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={handleSavePlanEstimate}
                disabled={savingPlan || !selectedProjectId}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-on-secondary font-bold rounded-lg hover:brightness-110 transition-all shadow-sm disabled:opacity-50 cursor-pointer text-body-sm whitespace-nowrap"
              >
                {savingPlan ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">save</span>
                )}
                <span>{savingPlan ? t('Đang lưu...', 'Saving...') : t('Lưu Kế Hoạch', 'Save Plan')}</span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: NHẬP THỰC TẾ */}
          <div className="flex flex-col gap-3.5 pl-0 md:pl-2">
            <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-1.5 border-b border-outline-variant/60 pb-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
              <span className="whitespace-nowrap font-bold">{t('Nhập Thực Tế', 'Enter Actuals')}</span>
            </h3>

            {/* Các ô nhập thực tế (Highlight màu chính) */}
            <div className="flex flex-col gap-2.5">
              <EntryField
                disabled={!selectedProjectId}
                label="RAW LEADS"
                value={actualForm.rawLeads}
                onChange={(e) => editActual('rawLeads', e.target.value)}
                theme="actual"
              />
              <EntryField
                disabled={!selectedProjectId}
                label="MQL"
                value={actualForm.mql}
                onChange={(e) => editActual('mql', e.target.value)}
                theme="actual"
              />
              <EntryField
                disabled={!selectedProjectId}
                label="SQL"
                value={actualForm.sql}
                onChange={(e) => editActual('sql', e.target.value)}
                theme="actual"
              />
            </div>

            {/* Nút lưu Thực tế */}
            <div className="flex justify-end pt-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={handleSaveActual}
                disabled={savingActual || !selectedProjectId}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-on-primary font-bold rounded-lg hover:brightness-110 transition-all shadow-md disabled:opacity-50 cursor-pointer text-body-sm whitespace-nowrap"
              >
                {savingActual ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">publish</span>
                )}
                <span>{savingActual ? t('Đang lưu...', 'Saving...') : t('Lưu Thực Tế', 'Save Actuals')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
