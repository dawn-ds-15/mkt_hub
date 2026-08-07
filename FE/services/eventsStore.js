import {
  getEvents as apiGetEvents,
  addEvent as apiAddEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
} from './api';

const store = new Map();

const uid = () => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const scopeKey = (projectId, week) => `${projectId || ''}|${week || ''}`;

const parseWeek = (week) => {
  const m = /(\d{4})-W(\d{1,2})/i.exec(week || '');
  return m ? { year: Number(m[1]), week: Number(m[2]) } : null;
};

const normalizePayload = (projectId, week, { name, date, description, rawLeads, mql, sql }) => ({
  projectId,
  ...parseWeek(week),
  name,
  date: date || new Date().toISOString().split('T')[0],
  description: description || '',
  rawLeads: Number(rawLeads) || 0,
  mql: Number(mql) || 0,
  sql: Number(sql) || 0,
});

const write = (projectId, week, list) => {
  store.set(scopeKey(projectId, week), list);
};

export const fetchEvents = async (projectId, week) => {
  const parsed = parseWeek(week);
  if (!projectId || !parsed) return [];
  try {
    const res = await apiGetEvents(projectId, parsed.week, parsed.year);
    const list = res?.data || [];
    write(projectId, week, list);
    return list;
  } catch (err) {
    return getEvents(projectId, week);
  }
};

export const getEvents = (projectId, week) => {
  if (!projectId) return [];
  return store.get(scopeKey(projectId, week)) || [];
};

export const getAllEventsByWeek = (week) => {
  if (!week) return [];
  return [...store.entries()]
    .filter(([key]) => key.endsWith(`|${week}`))
    .flatMap(([key, list]) => list.map((e) => ({ ...e, projectId: key.split('|')[0] })));
};

export const addEvent = async (projectId, week, { name, date, description, rawLeads, mql, sql }) => {
  const parsed = parseWeek(week);
  if (!projectId || !parsed) return;
  const payload = normalizePayload(projectId, week, { name, date, description, rawLeads, mql, sql });
  try {
    const res = await apiAddEvent(payload);
    const evt = res?.data;
    if (evt?.id) {
      const key = scopeKey(projectId, week);
      write(projectId, week, [...(store.get(key) || []), evt]);
      return evt;
    }
    throw new Error('No event id returned');
  } catch (err) {
    const evt = { id: uid(), ...payload };
    const key = scopeKey(projectId, week);
    write(projectId, week, [...(store.get(key) || []), evt]);
    return evt;
  }
};

export const updateEvent = async (projectId, week, eventId, { name, date, description, rawLeads, mql, sql }) => {
  const parsed = parseWeek(week);
  if (!projectId || !parsed || !eventId) return;
  const payload = normalizePayload(projectId, week, { name, date, description, rawLeads, mql, sql });
  try {
    await apiUpdateEvent(eventId, payload);
  } catch (err) {
    // offline fallback — keep local
  }
  const key = scopeKey(projectId, week);
  const list = store.get(key) || [];
  const idx = list.findIndex((e) => e.id === eventId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...payload };
    write(projectId, week, list);
  }
  return list[idx];
};

export const deleteEvent = async (projectId, week, eventId) => {
  if (!projectId || !eventId) return;
  try {
    await apiDeleteEvent(eventId);
  } catch (err) {
    // offline fallback — keep local
  }
  const key = scopeKey(projectId, week);
  write(projectId, week, (store.get(key) || []).filter((e) => e.id !== eventId));
};

export const clearEvents = (projectId, week) => {
  if (projectId && week) store.delete(scopeKey(projectId, week));
  else if (projectId) {
    for (const key of [...store.keys()]) {
      if (key.startsWith(`${projectId}|`)) store.delete(key);
    }
  } else store.clear();
};
