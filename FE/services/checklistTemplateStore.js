import { getChecklistTemplates } from './api';

let cache = null;

export const loadChecklistTemplates = async (force = false) => {
  if (cache && !force) return cache;
  const res = await getChecklistTemplates();
  cache = res.data;
  return cache;
};

export const invalidateChecklistTemplates = () => {
  cache = null;
};

export const getCachedChecklistTemplates = () => cache;