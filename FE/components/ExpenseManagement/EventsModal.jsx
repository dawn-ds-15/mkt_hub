import { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { fetchEvents, addEvent, updateEvent, deleteEvent } from '../../services/eventsStore';
import NumberInput from '../common/NumberInput';

const fmt = (val) => (val ?? 0).toLocaleString('vi-VN');

export default function EventsModal({ projectId, week, projectName, initialMode = 'list', initialEvent = null, onClose }) {
  const { locale } = useDashboard();
  const [events, setEvents] = useState([]);
  const [mode, setMode] = useState(initialEvent ? 'add' : initialMode);
  const [name, setName] = useState(initialEvent?.name || '');
  const [date, setDate] = useState(initialEvent?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [rawLeads, setRawLeads] = useState(initialEvent?.rawLeads ?? '');
  const [mql, setMql] = useState(initialEvent?.mql ?? '');
  const [sql, setSql] = useState(initialEvent?.sql ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const refresh = () => {
    fetchEvents(projectId, week).then((list) => setEvents(list || []));
  };

  useEffect(() => {
    refresh();
  }, [projectId, week]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), date, description: description.trim(), rawLeads, mql, sql };
      if (initialEvent) await updateEvent(projectId, week, initialEvent.id, payload);
      else await addEvent(projectId, week, payload);
      setName('');
      setDescription('');
      setRawLeads('');
      setMql('');
      setSql('');
      setToast(locale === 'vi' ? (initialEvent ? 'Đã cập nhật sự kiện!' : 'Đã thêm sự kiện!') : (initialEvent ? 'Event updated!' : 'Event added!'));
      setTimeout(() => setToast(null), 2000);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    await deleteEvent(projectId, week, eventId);
    refresh();
  };

  const renderEventCard = (evt) => (
    <div key={evt.id} className="border border-border-light rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary mt-0.5">event</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface">{evt.name}</p>
          <p className="text-xs text-on-surface-variant">{evt.date}</p>
        </div>
        <button
          onClick={() => handleDelete(evt.id)}
          className="text-gray-400 hover:text-red-600 transition-colors"
          title={locale === 'vi' ? 'Xóa' : 'Delete'}
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 pl-8">
        <div className="bg-background-subtle rounded-md px-2 py-1">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase">{locale === 'vi' ? 'Raw Leads' : 'Raw Leads'}</p>
          <p className="text-sm font-bold text-on-surface">{fmt(evt.rawLeads)}</p>
        </div>
        <div className="bg-background-subtle rounded-md px-2 py-1">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase">MQL</p>
          <p className="text-sm font-bold text-on-surface">{fmt(evt.mql)}</p>
        </div>
        <div className="bg-background-subtle rounded-md px-2 py-1">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase">SQL</p>
          <p className="text-sm font-bold text-on-surface">{fmt(evt.sql)}</p>
        </div>
      </div>
      {evt.description && <p className="text-xs text-on-surface pl-8">{evt.description}</p>}
    </div>
  );

  const numInputCls = "w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-base font-bold">{initialEvent ? (locale === 'vi' ? 'Sửa sự kiện' : 'Edit Event') : (locale === 'vi' ? 'Sự kiện dự án' : 'Project Events')}</h3>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
          </div>

          {projectName && (
            <div className="px-6 pt-4">
              <p className="text-xs text-on-surface-variant">{locale === 'vi' ? 'Dự án:' : 'Project:'} <span className="font-semibold text-on-surface">{projectName}</span> {week && <span className="text-on-surface-variant">— {week}</span>}</p>
            </div>
          )}

          <div className="px-6 py-4 space-y-3">
            {events.length === 0 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[40px] text-outline mb-2 block">event_busy</span>
                <p className="text-sm text-on-surface-variant">{locale === 'vi' ? 'Chưa có sự kiện nào' : 'No events yet'}</p>
              </div>
            )}
            {events.map(renderEventCard)}
          </div>

          {mode === 'add' && (
            <div className="border-t border-gray-200 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{locale === 'vi' ? 'Tên sự kiện' : 'Event name'}</label>
                  <input className={numInputCls} placeholder={locale === 'vi' ? 'VD: Tuần khởi động chiến dịch' : 'e.g. Campaign launch week'} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{locale === 'vi' ? 'Ngày' : 'Date'}</label>
                  <input className={numInputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{locale === 'vi' ? 'Raw Leads Actual' : 'Raw Leads Actual'}</label>
                  <NumberInput className={numInputCls} placeholder="0" value={rawLeads} onChange={(e) => setRawLeads(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">MQL</label>
                  <NumberInput className={numInputCls} placeholder="0" value={mql} onChange={(e) => setMql(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">SQL</label>
                  <NumberInput className={numInputCls} placeholder="0" value={sql} onChange={(e) => setSql(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{locale === 'vi' ? 'Mô tả' : 'Description'}</label>
                  <textarea className={`${numInputCls} h-20`} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setMode('list')} className="px-5 py-2 border border-border-light rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
                  {locale === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  {saving ? (locale === 'vi' ? 'Đang lưu...' : 'Saving...') : (locale === 'vi' ? (initialEvent ? 'Cập nhật sự kiện' : 'Thêm sự kiện') : (initialEvent ? 'Update event' : 'Add event'))}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold bg-green-600 text-white">
          {toast}
        </div>
      )}
    </>
  );
}
