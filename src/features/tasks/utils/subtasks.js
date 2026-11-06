const STORE_PREFIX = 'mkt_hub_subtasks';

function keyFor(taskId) {
  return `${STORE_PREFIX}:${taskId}`;
}

export function normalizeSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => {
      if (s === null || s === undefined) return null;
      if (typeof s === 'string') return { id: null, text: s, done: false, doneDate: null };
      return {
        id: s.id ?? null,
        text: String(s.text || s.name || s.title || '').trim(),
        done: Boolean(s.done || s.checked || s.completed),
        doneDate: s.doneDate || s.completedDate || null,
      };
    })
    .filter(s => s && s.text);
}

export function loadSubtasks(taskId) {
  if (!taskId) return [];
  try {
    const raw = localStorage.getItem(keyFor(taskId));
    if (!raw) return [];
    return normalizeSubtasks(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSubtasks(taskId, subtasks) {
  if (!taskId) return;
  try {
    localStorage.setItem(keyFor(taskId), JSON.stringify(normalizeSubtasks(subtasks)));
  } catch {}
}

export function mergeSubtasks(taskId, backendSubtasks) {
  const fromBackend = normalizeSubtasks(backendSubtasks);
  if (fromBackend.length) return fromBackend;
  return loadSubtasks(taskId);
}