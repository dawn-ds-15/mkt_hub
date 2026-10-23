import { useMemo } from 'react';
import { useDashboard } from '../contexts/DashboardContext';
import { useDropdownOptions } from './useDropdownOptions';

const FALLBACK = {
  posm: { vi: 'POSM', en: 'POSM' },
  gift: { vi: 'Quà tặng', en: 'Gift' },
  print: { vi: 'Ấn phẩm in', en: 'Printed materials' },
};

const VI_LABELS = {
  posm: 'POSM',
  gift: 'Quà tặng',
  print: 'Ấn phẩm in',
};

export function useInventoryCategories() {
  const { locale } = useDashboard();
  const dropped = useDropdownOptions('inventory_category');

  const categories = useMemo(() => {
    const valid = (dropped || []).filter(o => o && String(o.label || '').trim());
    if (valid.length) return valid.map(o => ({ id: o.id, label: o.label, value: o.label }));
    return Object.keys(FALLBACK).map(k => ({ id: k, label: FALLBACK[k][locale], value: k }));
  }, [dropped, locale]);

  const categoryValueOf = (cat) => {
    const c = String(cat || '').trim().toLowerCase();
    if (!c) return '';
    const m = categories.find(o => String(o.value || '').trim().toLowerCase() === c);
    return m ? m.value : cat;
  };

  const categoryDisplay = (cat) => {
    const c = String(cat || '').trim().toLowerCase();
    const m = categories.find(o => String(o.value || '').trim().toLowerCase() === c);
    if (m) return locale === 'vi' && VI_LABELS[c] ? VI_LABELS[c] : m.label;
    return cat || '—';
  };

  return { categories, categoryValueOf, categoryDisplay };
}