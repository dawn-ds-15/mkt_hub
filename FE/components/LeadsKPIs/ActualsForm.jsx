import { useState, useEffect } from 'react';
import { saveActuals, getProjects } from '../../services/api';
import OpportunitiesTable from './OpportunitiesTable';
import ClosedDealsTable from './ClosedDealsTable';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import EventsModal from '../ExpenseManagement/EventsModal';
import MetricBreakdownModal from './MetricBreakdownModal';
import { getEvents, getAllEventsByWeek, fetchEvents } from '../../services/eventsStore';

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export default function ActualsForm() {
  const addToast = useToast();
  const { locale } = useDashboard();
  const getCurrentWeek = () => {
    const now = new Date();
    const week = getISOWeek(now);
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventsModal, setEventsModal] = useState(null);
  const [breakdownMetric, setBreakdownMetric] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventsVersion, setEventsVersion] = useState(0);

  useEffect(() => {
    getProjects()
      .then(r => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProjects([]));
  }, []);

  const loadEvents = async () => {
    if (selectedProjectId) {
      await fetchEvents(selectedProjectId, selectedWeek);
    } else if (projects.length > 0) {
      await Promise.all(projects.map(p => fetchEvents(p.id, selectedWeek)));
    }
    setEventsVersion(v => v + 1);
  };

  useEffect(() => {
    loadEvents();
  }, [selectedProjectId, selectedWeek, projects]);

  const refreshEvents = () => loadEvents();

  const events = selectedProjectId ? getEvents(selectedProjectId, selectedWeek) : getAllEventsByWeek(selectedWeek);
  const eventTotals = events.reduce((acc, e) => ({
    rawLeads: acc.rawLeads + (Number(e.rawLeads) || 0),
    mqlActual: acc.mqlActual + (Number(e.mql) || 0),
    sqlActual: acc.sqlActual + (Number(e.sql) || 0),
  }), { rawLeads: 0, mqlActual: 0, sqlActual: 0 });

  const handleSubmit = async () => {
    try {
      await saveActuals({ ...eventTotals, week: selectedWeek, projectId: selectedProjectId });
      addToast(locale === 'vi' ? 'Đã lưu Actual Data thành công!' : 'Actual Data saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving actuals:', error);
      addToast(locale === 'vi' ? 'Có lỗi xảy ra khi lưu!' : 'An error occurred while saving!', 'error');
    }
  };

  return (
    <section className="flex-1 bg-white border border-border-light p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">edit_note</span>
          {locale === 'vi' ? 'Form Nhập Actual' : 'Actual Entry Form'}
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Dự án:' : 'Project:'}
          </label>
          <select
            className="border-border-light rounded text-body-sm px-2 py-1 focus:ring-primary focus:border-primary outline-none bg-white"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">{locale === 'vi' ? 'Tất cả dự án' : 'All projects'}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
            {locale === 'vi' ? 'Chọn kỳ:' : 'Select period:'}
          </label>
          <input
            className="border-border-light rounded text-body-sm px-2 py-1 focus:ring-primary focus:border-primary outline-none"
            type="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
              {locale === 'vi' ? 'Raw Leads Actual' : 'Raw Leads Actual'}
            </label>
            <button
              type="button"
              onClick={() => setBreakdownMetric('rawLeads')}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              {locale === 'vi' ? 'Xem thêm' : 'View more'}
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
          <div className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-background-subtle text-on-surface font-bold">
            {eventTotals.rawLeads.toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
              {locale === 'vi' ? 'MQL' : 'MQL'}
            </label>
            <button
              type="button"
              onClick={() => setBreakdownMetric('mql')}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              {locale === 'vi' ? 'Xem thêm' : 'View more'}
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
          <div className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-background-subtle text-on-surface font-bold">
            {eventTotals.mqlActual.toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-label-md font-semibold text-on-surface-variant text-[12px] uppercase tracking-wide">
              {locale === 'vi' ? 'SQL' : 'SQL'}
            </label>
            <button
              type="button"
              onClick={() => setBreakdownMetric('sql')}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              {locale === 'vi' ? 'Xem thêm' : 'View more'}
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
          <div className="w-full border border-border-light rounded px-3 py-2 text-data-display bg-background-subtle text-on-surface font-bold">
            {eventTotals.sqlActual.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          onClick={() => setEventsModal('add')}
          disabled={!selectedProjectId}
          className="flex items-center gap-3 p-4 rounded-lg border border-border-light bg-background-subtle hover:border-primary/60 hover:bg-primary/5 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[28px] text-primary">add_circle</span>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-on-surface">{locale === 'vi' ? 'Thêm sự kiện' : 'Add Event'}</p>
            <p className="text-xs text-on-surface-variant">{selectedProjectId ? (locale === 'vi' ? 'Nhập Raw Leads, MQL, SQL cho sự kiện' : 'Enter Raw Leads, MQL, SQL for the event') : (locale === 'vi' ? 'Chọn dự án trước' : 'Select a project first')}</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>
        <button
          type="button"
          onClick={() => setEventsModal('list')}
          disabled={!selectedProjectId}
          className="flex items-center gap-3 p-4 rounded-lg border border-border-light bg-background-subtle hover:border-primary/60 hover:bg-primary/5 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[28px] text-primary">event_note</span>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-on-surface">{locale === 'vi' ? 'Xem sự kiện' : 'View Events'}</p>
            <p className="text-xs text-on-surface-variant">
              {!selectedProjectId
                ? (locale === 'vi' ? 'Chọn dự án trước' : 'Select a project first')
                : getEvents(selectedProjectId, selectedWeek).length > 0
                  ? (locale === 'vi' ? `${getEvents(selectedProjectId, selectedWeek).length} sự kiện` : `${getEvents(selectedProjectId, selectedWeek).length} events`)
                  : (locale === 'vi' ? 'Chưa có sự kiện' : 'No events yet')}
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      <OpportunitiesTable onConvertSuccess={refreshEvents} />
      <ClosedDealsTable />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">publish</span>
          {loading ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? 'Lưu Actual Data' : 'Save Actual Data')}
        </button>
      </div>

      {breakdownMetric && (
        <MetricBreakdownModal
          metric={breakdownMetric}
          events={events}
          projects={projects}
          projectName={projects.find(p => p.id === selectedProjectId)?.name}
          week={selectedWeek}
          groupByProject={!selectedProjectId}
          onSelectEvent={(evt) => {
            setEditingEvent({ ...evt, projectId: evt.projectId || selectedProjectId });
            setBreakdownMetric(null);
          }}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setBreakdownMetric(null);
          }}
          onClose={() => { setBreakdownMetric(null); refreshEvents(); }}
        />
      )}

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
