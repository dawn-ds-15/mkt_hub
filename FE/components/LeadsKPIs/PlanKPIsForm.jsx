import { useState, useEffect, useCallback } from 'react';
import { getPlanKPIs, savePlanKPIs } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import NumberInput from '../common/NumberInput';

const years = [2024, 2025, 2026];

const FIELD_DEFS = [
  { apiKey: 'targetLeads', label: { vi: 'MỤC TIÊU RAW LEADS', en: 'RAW LEADS TARGET' }, icon: 'groups' },
  { apiKey: 'mqlTarget', label: { vi: 'MỤC TIÊU MQL', en: 'MQL TARGET' }, icon: 'filter_alt' },
  { apiKey: 'sqlTarget', label: { vi: 'MỤC TIÊU SQL', en: 'SQL TARGET' }, icon: 'fact_check' },
  { apiKey: 'opportunityCount', label: { vi: 'SỐ LƯỢNG CƠ HỘI (OPP)', en: 'OPPORTUNITY COUNT' }, icon: 'lightbulb' },
  { apiKey: 'closedDealCount', label: { vi: 'SỐ LƯỢNG CLOSED DEAL', en: 'CLOSED DEAL COUNT' }, icon: 'handshake' },
  { apiKey: 'pipelineValue', label: { vi: 'GIÁ TRỊ PIPELINE', en: 'PIPELINE VALUE' }, icon: 'payments' },
  { apiKey: 'wonValue', label: { vi: 'GIÁ TRỊ WON', en: 'WON VALUE' }, icon: 'monetization_on' },
];

function fmt(n) {
  if (n == null || isNaN(n) || n === '') return '0';
  return Number(n).toLocaleString('vi-VN');
}

export default function PlanKPIsForm() {
  const { locale } = useDashboard();
  const addToast = useToast();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [selectedYear, setSelectedYear] = useState(2026);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    targetLeads: 0,
    mqlTarget: 0,
    sqlTarget: 0,
    opportunityCount: 0,
    closedDealCount: 0,
    pipelineValue: 0,
    wonValue: 0,
  });

  const fetchPlan = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setIsEditing(false);
    getPlanKPIs(selectedYear)
      .then((r) => {
        if (!cancelled) setPlan(r.data || null);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedYear]);

  useEffect(() => { return fetchPlan(); }, [fetchPlan]);

  const getFieldValue = (apiKey) => {
    if (!plan) return 0;
    return plan[apiKey] ?? 0;
  };

  const handleStartEdit = () => {
    setEditForm({
      targetLeads: plan?.targetLeads ?? 0,
      mqlTarget: plan?.mqlTarget ?? 0,
      sqlTarget: plan?.sqlTarget ?? 0,
      opportunityCount: plan?.opportunityCount ?? 0,
      closedDealCount: plan?.closedDealCount ?? 0,
      pipelineValue: plan?.pipelineValue ?? 0,
      wonValue: plan?.wonValue ?? 0,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        year: selectedYear,
        targetLeads: editForm.targetLeads,
        mqlTarget: editForm.mqlTarget,
        sqlTarget: editForm.sqlTarget,
        opportunityCount: editForm.opportunityCount,
        closedDealCount: editForm.closedDealCount,
        pipelineValue: editForm.pipelineValue,
        wonValue: editForm.wonValue,
      };
      await savePlanKPIs(payload);
      setPlan({
        year: selectedYear,
        ...payload,
      });
      setIsEditing(false);
      if (addToast) {
        addToast(t('Cập nhật kế hoạch KPI thành công!', 'KPI plan updated successfully!'), 'success');
      }
    } catch (err) {
      console.error('Error saving KPI plan:', err);
      if (addToast) {
        addToast(t('Lỗi khi cập nhật kế hoạch KPI.', 'Error updating KPI plan.'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field) => {
    const value = isEditing ? editForm[field.apiKey] : getFieldValue(field.apiKey);
    return (
      <div key={field.apiKey} className="flex items-center gap-3 bg-slate-50/50 dark:bg-surface-container/30 px-3 py-2.5 rounded-lg border border-slate-200/80 dark:border-border-light/60">
        <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap flex items-center gap-1 min-w-0 shrink-0">
          <span className="material-symbols-outlined text-[15px] text-secondary">{field.icon}</span>
          {t(field.label.vi, field.label.en)}
        </label>
        {isEditing ? (
          <NumberInput
            className="flex-1 min-w-0 bg-white dark:bg-surface-container-lowest border-2 border-secondary/50 focus:border-secondary focus:ring-2 focus:ring-secondary/20 rounded-md py-1.5 px-3 text-body-md font-bold text-on-surface shadow-sm outline-none transition-all"
            value={value}
            onChange={(e) => setEditForm(prev => ({ ...prev, [field.apiKey]: e.target.value }))}
            placeholder="0"
            disabled={isSaving}
          />
        ) : (
          <div className="flex-1 min-w-0 bg-white dark:bg-surface-container-lowest border border-border-light rounded-md py-1.5 px-3 font-bold text-primary text-body-md tabular-nums shadow-2xs text-right">
            {fmt(value)}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 sm:p-5 flex flex-col gap-3.5">
      <div className="flex justify-between items-center border-b border-outline-variant pb-3 flex-wrap gap-2">
        <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-secondary text-2xl">ads_click</span>
          {t('Kế hoạch KPIs', 'KPI Plan')}
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="form-select text-body-sm font-semibold border-outline-variant rounded-md py-1.5 pl-3 pr-8 text-on-surface bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 disabled:opacity-60 cursor-pointer"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            disabled={isEditing || isSaving}
          >
            {years.map(year => (
              <option key={year} value={year}>{t(`Năm ${year}`, `Year ${year}`)}</option>
            ))}
          </select>

          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={loading}
              className="flex items-center gap-1 text-body-sm font-semibold px-3 py-1.5 rounded-md text-secondary bg-secondary/5 hover:bg-secondary/10 transition-colors border border-secondary/30 cursor-pointer disabled:opacity-50"
              title={t('Chỉnh sửa kế hoạch KPI', 'Edit KPI plan')}
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              <span>{t('Sửa', 'Edit')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1.5 text-body-sm font-medium rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                <span>{t('Hủy', 'Cancel')}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-body-sm rounded-md bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-1 font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                <span>{t('Lưu', 'Save')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-on-surface-variant gap-2">
          <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          <span className="text-body-md font-medium">{t('Đang tải...', 'Loading...')}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {FIELD_DEFS.map(renderField)}
          </div>

          {isEditing && (
            <div className="flex justify-end items-center gap-3 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-body-sm font-medium rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                <span>{t('Hủy', 'Cancel')}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 text-body-sm rounded-lg bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-1.5 font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                <span>{t('Lưu thay đổi', 'Save changes')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
