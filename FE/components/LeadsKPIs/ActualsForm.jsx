import { useState, useEffect } from 'react';
import { saveActuals, getActuals, saveMonthlyActuals, getMonthlyActuals, getPeriodPlan, getProjects, updateProject } from '../../services/api';
import OpportunitiesTable from './OpportunitiesTable';
import ClosedDealsTable from './ClosedDealsTable';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import EventsModal from '../ExpenseManagement/EventsModal';
import { getEvents, getAllEventsByWeek, fetchEvents, updateEvent } from '../../services/eventsStore';
import NumberInput from '../common/NumberInput';

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function EntryField({ label, value, onChange, disabled, placeholder }) {
  const { locale } = useDashboard();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">{label}</label>
      <NumberInput
        className="w-full border border-border-light rounded-md px-3 py-2 text-body-md font-bold text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:bg-background-subtle disabled:text-on-surface-variant"
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
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingActual, setSavingActual] = useState(false);
  const [eventsModal, setEventsModal] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventsVersion, setEventsVersion] = useState(0);

  const EMPTY_PLAN = { targetLeads: '', mqlTarget: '', sqlTarget: '', opportunityCount: '', closedDealCount: '' };
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [actualForm, setActualForm] = useState({ rawLeads: '', mql: '', sql: '' });
  const [savedWeekly, setSavedWeekly] = useState(null);
  const [weeklyVersion, setWeeklyVersion] = useState(0);
  const [periodPlan, setPeriodPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const isLeadGen = !!selectedProject && String(selectedProject.type || '').trim().toLowerCase() === 'lead generation';
  const activePeriod = isLeadGen ? selectedMonth : selectedWeek;

  useEffect(() => {
    getProjects()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProjects([]));
  }, []);

  // Kế hoạch theo TỪNG DỰ ÁN (lưu trên Project — BUG-L02) + phân bổ CHO KỲ ĐANG CHỌN (BE tự tính).
  // Reset & hiện loading mỗi khi đổi dự án / tuần / tháng — giống Form Nhập Thực tế (BUG-L01)
  useEffect(() => {
    setPeriodPlan(null);
    setPlanForm(EMPTY_PLAN);
    if (!selectedProjectId || !activePeriod) return;
    let cancelled = false;
    setPlanLoading(true);
    getPeriodPlan(activePeriod, selectedProjectId, isLeadGen)
      .then((r) => { if (!cancelled) setPeriodPlan(r.data); })
      .catch(() => { if (!cancelled) setPeriodPlan(null); })
      .finally(() => {
        if (cancelled) return;
        const p = projects.find(x => x.id === selectedProjectId);
        setPlanForm(p ? {
          targetLeads: p.kpiRawLeadsPlan || '',
          mqlTarget: p.kpiMqlPlan || '',
          sqlTarget: p.kpiSqlPlan || '',
          opportunityCount: p.kpiOppPlan || '',
          closedDealCount: p.kpiClosedDealPlan || '',
        } : EMPTY_PLAN);
        setPlanLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedProjectId, activePeriod, isLeadGen, projects]);

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

  // Lead Generation: load Thực tế ĐÃ LƯU theo tháng + dự án đang chọn (BUG-L01)
  useEffect(() => {
    if (!isLeadGen) return;
    let cancelled = false;
    setActualForm({ rawLeads: '', mql: '', sql: '' });
    getMonthlyActuals(selectedMonth, selectedProjectId)
      .then((r) => {
        if (cancelled) return;
        const d = r.data || {};
        setActualForm({
          rawLeads: Number(d.rawLeads) || '',
          mql: Number(d.mql) || '',
          sql: Number(d.sql) || '',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLeadGen, selectedMonth, selectedProjectId]);

  // Load Thực tế tuần ĐÃ LƯU theo dự án + tuần đang chọn (BUG-L01)
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
    if (selectedEventId) {
      const evt = events.find(e => e.id === selectedEventId);
      if (evt) {
        setActualForm({ rawLeads: evt.rawLeads || '', mql: evt.mql || '', sql: evt.sql || '' });
      }
      return;
    }
    const s = savedWeekly;
    if (s && ((Number(s.rawLeads) || 0) || (Number(s.mqlActual) || 0) || (Number(s.sqlActual) || 0))) {
      setActualForm({
        rawLeads: Number(s.rawLeads) || '',
        mql: Number(s.mqlActual) || '',
        sql: Number(s.sqlActual) || '',
      });
    } else {
      setActualForm({
        rawLeads: eventTotals.rawLeads || '',
        mql: eventTotals.mql || '',
        sql: eventTotals.sql || '',
      });
    }
  }, [isLeadGen, selectedEventId, savedWeekly, eventsVersion, selectedWeek, selectedProjectId]);

  const refreshEvents = () => loadEvents();

  const handleSavePlan = async () => {
    if (!selectedProjectId) {
      addToast(t('Vui lòng chọn dự án để lưu Kế hoạch!', 'Please select a project to save the plan!'), 'error');
      return;
    }
    setSavingPlan(true);
    try {
      const planPayload = {
        kpiRawLeadsPlan: Number(planForm.targetLeads) || 0,
        kpiMqlPlan: Number(planForm.mqlTarget) || 0,
        kpiSqlPlan: Number(planForm.sqlTarget) || 0,
        kpiOppPlan: Number(planForm.opportunityCount) || 0,
        kpiClosedDealPlan: Number(planForm.closedDealCount) || 0,
      };
      await updateProject(selectedProjectId, planPayload);
      setProjects(prev => prev.map(p => (p.id === selectedProjectId ? { ...p, ...planPayload } : p)));
      addToast(t('Đã lưu Kế hoạch của dự án thành công!', 'Project plan saved successfully!'), 'success');
    } catch (error) {
      console.error('Error saving plan:', error);
      addToast(t('Có lỗi xảy ra khi lưu Kế hoạch!', 'Error saving plan!'), 'error');
    } finally {
      setSavingPlan(false);
    }
  };

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
        });
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
          });
          addToast(t('Đã cập nhật sự kiện thành công!', 'Event updated successfully!'), 'success');
          refreshEvents();
        }
      } else {
        await saveActuals({
          rawLeads: actualForm.rawLeads,
          mqlActual: actualForm.mql,
          sqlActual: actualForm.sql,
          week: selectedWeek,
          projectId: selectedProjectId,
        });
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

  const selectCls =
    'border border-border-light rounded-md px-3 py-2 text-body-sm bg-white focus:ring-1 focus:ring-primary focus:border-primary outline-none min-w-[140px]';

  return (
    <section className="lg:col-span-8 flex flex-col gap-6 min-w-0">
      {/* Card: Nhập Dữ Liệu */}
      <section className="bg-white border border-border-light p-6 rounded-lg">
        <div className="flex flex-col gap-4 border-b border-border-light pb-4 mb-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit_document</span>
              {t('Nhập Dữ Liệu', 'Data Entry')}
            </h3>
            <span className="text-xs text-on-surface-variant">{t('Lựa chọn áp dụng cho cả Kế hoạch và Thực tế', 'Selection applies to both Plan and Actual')}</span>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">{t('Dự án', 'Project')}</label>
              <select className={selectCls} value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                <option value="">{t('Tất cả dự án', 'All projects')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">{t('Sự kiện', 'Event')}</label>
              {isLeadGen ? (
                <p className="text-xs text-on-surface-variant italic px-1 py-2">{t('Dự án Lead Generation nhập theo tháng — không dùng sự kiện', 'Lead Generation projects are entered monthly — no events')}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <select className={`${selectCls} w-full`} value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} disabled={!selectedProjectId}>
                    <option value="">{t('Tất cả sự kiện (tổng hợp)', 'All events (aggregated)')}</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEventsModal('add')}
                    disabled={!selectedProjectId}
                    className="p-2 border border-border-light rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                    title={t('Thêm sự kiện', 'Add event')}
                  >
                    <span className="material-symbols-outlined text-body-lg">add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventsModal('list')}
                    disabled={!selectedProjectId}
                    className="p-2 border border-border-light rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                    title={t('Danh sách sự kiện', 'Event list')}
                  >
                    <span className="material-symbols-outlined text-body-lg">event_note</span>
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">{isLeadGen ? t('Chọn tháng', 'Select month') : t('Chọn kỳ', 'Select period')}</label>
              <input
                className={selectCls}
                type={isLeadGen ? 'month' : 'week'}
                value={activePeriod}
                onChange={(e) => (isLeadGen ? setSelectedMonth(e.target.value) : setSelectedWeek(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Nhập Kế Hoạch */}
          <div className="flex flex-col gap-4 md:border-r md:border-border-light md:pr-6">
            <h4 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 border-b border-border-light pb-2">
              <span className="material-symbols-outlined text-primary">edit_document</span>
              {t('Form Nhập Kế Hoạch', 'Plan Entry Form')}
            </h4>
            <p className="text-xs text-on-surface-variant italic -mt-2">
              {selectedProjectId
                ? t(`Dự án: ${selectedProject?.name || ''} — kỳ: ${activePeriod}`, `Project: ${selectedProject?.name || ''} — period: ${activePeriod}`)
                : t('Chọn một dự án để nhập kế hoạch theo dự án. KPI cả năm xem ở panel "Kế hoạch KPIs".', 'Select a project to enter its plan. Year-wide KPI targets are shown in the "KPI Plan" panel.')}
            </p>
            {periodPlan && (
              <div className="bg-background-subtle border border-border-light rounded-md p-3">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
                  {t('Kế hoạch kỳ này', "This period's plan")}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    ['Raw Leads', periodPlan.effectivePlan?.rawLeads],
                    ['MQL', periodPlan.effectivePlan?.mql],
                    ['SQL', periodPlan.effectivePlan?.sql],
                    ['OPP', periodPlan.effectivePlan?.oppCount],
                    [t('Deal', 'Deals'), periodPlan.effectivePlan?.closedCount],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-[10px] font-medium text-on-surface-variant uppercase truncate">{label}</p>
                      <p className="text-body-md font-bold text-on-surface tabular-nums">{Number(val || 0).toLocaleString('vi-VN')}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-on-surface-variant italic mt-2">
                  {t('Hệ thống phân bổ từ kế hoạch năm (plan gốc + rollover).', 'Auto-distributed by the system from the yearly plan (base plan + rollover).')}
                </p>
              </div>
            )}
            {planLoading ? (
              <div className="flex-1 flex items-center justify-center py-10 text-on-surface-variant text-body-sm gap-2">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                {t('Đang tải kế hoạch...', 'Loading plan...')}
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{t('Mục tiêu năm của dự án', 'Yearly project targets')}</p>
                <div className="flex flex-col gap-3">
                  <EntryField disabled={!selectedProjectId} label={t('Raw Leads', 'Raw Leads')} value={planForm.targetLeads} onChange={(e) => setPlanForm(p => ({ ...p, targetLeads: e.target.value }))} />
                  <EntryField disabled={!selectedProjectId} label="MQL" value={planForm.mqlTarget} onChange={(e) => setPlanForm(p => ({ ...p, mqlTarget: e.target.value }))} />
                  <EntryField disabled={!selectedProjectId} label="SQL" value={planForm.sqlTarget} onChange={(e) => setPlanForm(p => ({ ...p, sqlTarget: e.target.value }))} />
                  <EntryField disabled={!selectedProjectId} label="OPP" value={planForm.opportunityCount} onChange={(e) => setPlanForm(p => ({ ...p, opportunityCount: e.target.value }))} />
                  <EntryField disabled={!selectedProjectId} label={t('Closed Deal', 'Closed Deal')} value={planForm.closedDealCount} onChange={(e) => setPlanForm(p => ({ ...p, closedDealCount: e.target.value }))} />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSavePlan}
                    disabled={savingPlan || planLoading || !selectedProjectId}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm disabled:opacity-50 cursor-pointer text-body-sm"
                  >
                    <span className="material-symbols-outlined text-body-md">save</span>
                    {savingPlan ? t('Đang lưu...', 'Saving...') : t('Lưu Kế hoạch', 'Save Plan')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Form Nhập Thực Tế */}
          <div className="flex flex-col gap-4 md:pl-2">
            <h4 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 border-b border-border-light pb-2">
              <span className="material-symbols-outlined text-primary">fact_check</span>
              {t('Form Nhập Thực Tế', 'Actual Entry Form')}
            </h4>
            {!selectedProjectId && (
              <p className="text-xs text-on-surface-variant italic -mt-2">
                {t('Chọn một dự án để nhập thực tế.', 'Select a project to enter actuals.')}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <EntryField disabled={!selectedProjectId} label={t('Raw Leads Actual', 'Raw Leads Actual')} value={actualForm.rawLeads} onChange={(e) => setActualForm(p => ({ ...p, rawLeads: e.target.value }))} />
              <EntryField disabled={!selectedProjectId} label="MQL Actual" value={actualForm.mql} onChange={(e) => setActualForm(p => ({ ...p, mql: e.target.value }))} />
              <EntryField disabled={!selectedProjectId} label="SQL Actual" value={actualForm.sql} onChange={(e) => setActualForm(p => ({ ...p, sql: e.target.value }))} />
              <p className="text-xs text-on-surface-variant italic bg-background-subtle border border-border-light rounded-md px-3 py-2">
                {t('OPP & Closed Deal được đếm tự động từ bảng Chi tiết Opportunities và Chi tiết Closed Deal (theo thời điểm nhập / ngày ký).', 'OPP & Closed Deal are auto-counted from the Opportunities and Closed Deal detail tables (by entry time / signed date).')}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveActual}
                disabled={savingActual || !selectedProjectId}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm disabled:opacity-50 cursor-pointer text-body-sm"
              >
                <span className="material-symbols-outlined text-body-md">publish</span>
                {savingActual ? t('Đang lưu...', 'Saving...') : t('Lưu Thực tế', 'Save Actuals')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <OpportunitiesTable onConvertSuccess={refreshEvents} />
      <ClosedDealsTable />

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
    </section>
  );
}
