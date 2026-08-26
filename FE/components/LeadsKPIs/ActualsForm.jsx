import { useState, useEffect, useRef } from 'react';
import { saveActuals, getActuals, saveMonthlyActuals, getMonthlyActuals, getPeriodPlan, getProjects, savePeriodPlanEstimate } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import EventsModal from '../ExpenseManagement/EventsModal';
import { getEvents, getAllEventsByWeek, fetchEvents, updateEvent } from '../../services/eventsStore';
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
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const getCurrentWeek = () => {
    const now = new Date();
    const week = getISOWeek(now);
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [projects, setProjects] = useState([]);
  const [savingActual, setSavingActual] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [eventsModal, setEventsModal] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventsVersion, setEventsVersion] = useState(0);

  const [actualForm, setActualForm] = useState({ rawLeads: '', mql: '', sql: '', oppCount: '', closedCount: '' });
  const actualDirtyRef = useRef(false);
  const editActual = (field, value) => {
    actualDirtyRef.current = true;
    setActualForm((p) => ({ ...p, [field]: value }));
  };
  const clearActualDirty = () => { actualDirtyRef.current = false; };
  const [savedWeekly, setSavedWeekly] = useState(null);
  const [weeklyVersion, setWeeklyVersion] = useState(0);
  const [periodPlan, setPeriodPlan] = useState(null);
  const [estimatedPlan, setEstimatedPlan] = useState({ rawLeads: '', mql: '', sql: '', oppCount: '', closedCount: '' });
  const estimatedDirtyRef = useRef(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const isLeadGen = !!selectedProject && String(selectedProject.type || '').trim().toLowerCase() === 'lead generation';
  const activePeriod = isLeadGen ? selectedMonth : selectedWeek;

  useEffect(() => {
    getProjects()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    setPeriodPlan(null);
    if (!selectedProjectId || !activePeriod) return undefined;
    let cancelled = false;
    getPeriodPlan(activePeriod, selectedProjectId, isLeadGen)
      .then((r) => { if (!cancelled) setPeriodPlan(r.data); })
      .catch(() => { if (!cancelled) setPeriodPlan(null); });
    return () => { cancelled = true; };
  }, [selectedProjectId, activePeriod, isLeadGen]);

  useEffect(() => {
    if (estimatedDirtyRef.current) return;
    if (periodPlan?.effectivePlan) {
      const ep = periodPlan.effectivePlan;
      setEstimatedPlan({
        rawLeads: ep.rawLeads != null ? String(ep.rawLeads) : '',
        mql: ep.mql != null ? String(ep.mql) : '',
        sql: ep.sql != null ? String(ep.sql) : '',
        oppCount: ep.oppCount != null ? String(ep.oppCount) : '',
        closedCount: ep.closedCount != null ? String(ep.closedCount) : '',
      });
    }
  }, [periodPlan]);

  const loadEvents = async () => {
    if (isLeadGen) return;
    if (selectedProjectId) {
      await fetchEvents(selectedProjectId, selectedWeek);
    } else if (projects.length > 0) {
      await Promise.all(projects.map(p => fetchEvents(p.id, selectedWeek)));
    }
    setEventsVersion(v => v + 1);
  };

  useEffect(() => {
    loadEvents();
  }, [selectedProjectId, selectedWeek, projects, isLeadGen]);

  useEffect(() => {
    setSelectedEventId('');
  }, [selectedProjectId, selectedWeek]);

  const events = selectedProjectId ? getEvents(selectedProjectId, selectedWeek) : getAllEventsByWeek(selectedWeek);
  const eventTotals = events.reduce((acc, e) => ({
    rawLeads: acc.rawLeads + (Number(e.rawLeads) || 0),
    mql: acc.mql + (Number(e.mql) || 0),
    sql: acc.sql + (Number(e.sql) || 0),
  }), { rawLeads: 0, mql: 0, sql: 0 });

  useEffect(() => {
    if (!isLeadGen) return;
    let cancelled = false;
    setActualForm({ rawLeads: '', mql: '', sql: '', oppCount: '', closedCount: '' });
    getMonthlyActuals(selectedMonth, selectedProjectId)
      .then((r) => {
        if (cancelled || actualDirtyRef.current) return;
        const d = r.data || {};
        setActualForm({
          rawLeads: Number(d.rawLeads) || '',
          mql: Number(d.mql) || '',
          sql: Number(d.sql) || '',
          oppCount: Number(d.oppCount) || '',
          closedCount: Number(d.closedCount) || '',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLeadGen, selectedMonth, selectedProjectId]);

  useEffect(() => {
    if (isLeadGen || !selectedProjectId) {
      setSavedWeekly(null);
      return;
    }
    let cancelled = false;
    setSavedWeekly(null);
    getActuals(selectedWeek, selectedProjectId)
      .then((r) => { if (!cancelled) setSavedWeekly(r.data || null); })
      .catch(() => { if (!cancelled) setSavedWeekly(null); });
    return () => { cancelled = true; };
  }, [isLeadGen, selectedProjectId, selectedWeek, weeklyVersion]);

  useEffect(() => {
    if (isLeadGen) return;
    if (actualDirtyRef.current) return;
    if (selectedEventId) {
      const evt = events.find(e => e.id === selectedEventId);
      if (evt) {
        setActualForm({
          rawLeads: evt.rawLeads || '',
          mql: evt.mql || '',
          sql: evt.sql || '',
          oppCount: evt.oppCount || '',
          closedCount: evt.closedCount || '',
        });
      }
      return;
    }
    const s = savedWeekly;
    if (s && ((Number(s.rawLeads) || 0) || (Number(s.mqlActual) || 0) || (Number(s.sqlActual) || 0) || (Number(s.oppCount) || 0) || (Number(s.closedCount) || 0))) {
      setActualForm({
        rawLeads: Number(s.rawLeads) || '',
        mql: Number(s.mqlActual) || '',
        sql: Number(s.sqlActual) || '',
        oppCount: Number(s.oppCount) || '',
        closedCount: Number(s.closedCount) || '',
      });
    } else {
      setActualForm({
        rawLeads: eventTotals.rawLeads || '',
        mql: eventTotals.mql || '',
        sql: eventTotals.sql || '',
        oppCount: '',
        closedCount: '',
      });
    }
  }, [isLeadGen, selectedEventId, savedWeekly, eventsVersion, selectedWeek, selectedProjectId]);

  const refreshEvents = () => loadEvents();

  const handleSaveActual = async () => {
    setSavingActual(true);
    try {
      if (isLeadGen) {
        if (!selectedProjectId) {
          addToast(t('Vui lòng chọn dự án trước khi lưu Thực tế!', 'Please select a project before saving actuals!'), 'error');
          return;
        }
        await saveMonthlyActuals({
          period: selectedMonth,
          projectId: selectedProjectId,
          rawLeads: actualForm.rawLeads,
          mql: actualForm.mql,
          sql: actualForm.sql,
          oppCount: actualForm.oppCount,
          closedCount: actualForm.closedCount,
        });
        clearActualDirty();
        addToast(t('Đã lưu Thực tế tháng thành công!', 'Monthly actuals saved successfully!'), 'success');
      } else if (selectedEventId && selectedProjectId) {
        const evt = events.find(e => e.id === selectedEventId);
        if (evt) {
          await updateEvent(selectedProjectId, selectedWeek, selectedEventId, {
            name: evt.name,
            date: evt.date,
            description: evt.description,
            rawLeads: actualForm.rawLeads,
            mql: actualForm.mql,
            sql: actualForm.sql,
            oppCount: actualForm.oppCount,
            closedCount: actualForm.closedCount,
          });
          clearActualDirty();
          addToast(t('Đã cập nhật sự kiện thành công!', 'Event updated successfully!'), 'success');
          refreshEvents();
        }
      } else {
        await saveActuals({
          rawLeads: actualForm.rawLeads,
          mqlActual: actualForm.mql,
          sqlActual: actualForm.sql,
          oppCount: actualForm.oppCount,
          closedCount: actualForm.closedCount,
          week: selectedWeek,
          projectId: selectedProjectId,
        });
        clearActualDirty();
        addToast(t('Đã lưu Thực tế thành công!', 'Actuals saved successfully!'), 'success');
        setWeeklyVersion(v => v + 1);
      }
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
      await savePeriodPlanEstimate({
        period: activePeriod,
        projectId: selectedProjectId,
        monthly: isLeadGen,
        rawLeads: estimatedPlan.rawLeads,
        mql: estimatedPlan.mql,
        sql: estimatedPlan.sql,
        oppCount: estimatedPlan.oppCount,
        closedCount: estimatedPlan.closedCount,
      });
      estimatedDirtyRef.current = false;
      addToast(t('Đã lưu Kế hoạch dự kiến thành công!', 'Estimated plan saved successfully!'), 'success');
      setPeriodPlan(null);
      getPeriodPlan(activePeriod, selectedProjectId, isLeadGen)
        .then((r) => setPeriodPlan(r.data))
        .catch(() => {});
    } catch (error) {
      console.error('Error saving plan estimate:', error);
      addToast(t('Có lỗi xảy ra khi lưu Kế hoạch!', 'An error occurred while saving plan!'), 'error');
    } finally {
      setSavingPlan(false);
    }
  };

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
            <span className="text-body-sm text-on-surface-variant italic whitespace-nowrap">{t('Lựa chọn áp dụng cho cả Kế hoạch và Thực tế', 'Selection applies to both Plan and Actual')}</span>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-surface-container/40 rounded-xl border border-slate-200 dark:border-border-light/80 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{t('Dự án', 'Project')}</label>
              <select className={selectCls} value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); clearActualDirty(); }}>
                <option value="">{t('Chọn dự án...', 'Select project...')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{t('Sự kiện', 'Event')}</label>
              {isLeadGen ? (
                <p className="text-xs text-on-surface-variant italic px-1 py-1.5">{t('Dự án Lead Generation nhập theo tháng — không dùng sự kiện', 'Lead Generation projects are entered monthly — no events')}</p>
              ) : (
                <div className="flex items-center gap-1.5">
                  <select className={`${selectCls} flex-1`} value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); clearActualDirty(); }} disabled={!selectedProjectId}>
                    <option value="">{t('Chọn sự kiện...', 'Select event...')}</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEventsModal('add')}
                    disabled={!selectedProjectId}
                    className="p-1.5 border border-outline-variant rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                    title={t('Thêm sự kiện', 'Add event')}
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventsModal('list')}
                    disabled={!selectedProjectId}
                    className="p-1.5 border border-outline-variant rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                    title={t('Danh sách sự kiện', 'Event list')}
                  >
                    <span className="material-symbols-outlined text-[20px]">event_note</span>
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{isLeadGen ? t('Chọn tháng', 'Select month') : t('Chọn kỳ', 'Select period')}</label>
              <input
                className={`${selectCls} w-full`}
                type={isLeadGen ? 'month' : 'week'}
                value={activePeriod}
                onChange={(e) => { clearActualDirty(); if (isLeadGen) setSelectedMonth(e.target.value); else setSelectedWeek(e.target.value); }}
              />
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
              <EntryField
                disabled={!selectedProjectId}
                label="OPP"
                value={actualForm.oppCount}
                onChange={(e) => editActual('oppCount', e.target.value)}
                theme="actual"
              />
              <EntryField
                disabled={!selectedProjectId}
                label={t('CLOSED DEAL', 'CLOSED DEAL')}
                value={actualForm.closedCount}
                onChange={(e) => editActual('closedCount', e.target.value)}
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

      {eventsModal && (
        <EventsModal
          projectId={selectedProjectId}
          week={selectedWeek}
          projectName={projects.find(p => p.id === selectedProjectId)?.name}
          initialMode={eventsModal}
          onClose={() => { setEventsModal(null); refreshEvents(); }}
        />
      )}

      {editingEvent && (
        <EventsModal
          projectId={editingEvent.projectId || selectedProjectId}
          week={selectedWeek}
          projectName={projects.find(p => p.id === (editingEvent.projectId || selectedProjectId))?.name}
          initialEvent={editingEvent}
          onClose={() => { setEditingEvent(null); refreshEvents(); }}
        />
      )}
    </>
  );
}
