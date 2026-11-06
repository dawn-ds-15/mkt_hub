const STORE_KEY = 'mkt_hub_deleted';

const LEGACY_KEYS = {
  members: 'mkt_hub_deleted_members',
  expenses: 'mkt_hub_deleted_expenses',
  backups: 'mkt_hub_deleted_backups',
};

function getAll() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const data = {};
  for (const [type, legacyKey] of Object.entries(LEGACY_KEYS)) {
    try {
      const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      if (legacy.length) {
        data[type] = legacy;
        localStorage.removeItem(legacyKey);
      }
    } catch {}
  }
  if (Object.keys(data).length) saveAll(data);
  return data;
}

function saveAll(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

export function getDeletedIds(entityType) {
  const all = getAll();
  return new Set(all[entityType] || []);
}

export function markDeleted(entityType, id) {
  const all = getAll();
  if (!all[entityType]) all[entityType] = [];
  if (!all[entityType].includes(id)) all[entityType].push(id);
  saveAll(all);
}

export function restoreDeleted(entityType, id) {
  const all = getAll();
  if (all[entityType]) {
    all[entityType] = all[entityType].filter(v => v !== id);
    saveAll(all);
  }
}

export function filterDeleted(entityType, items) {
  if (!Array.isArray(items)) return items;
  const deleted = getDeletedIds(entityType);
  if (!deleted.size) return items;
  return items.filter(item => item && !deleted.has(item.id));
}
