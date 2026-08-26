import { useState, useEffect } from 'react';
import { getDropdownKeys } from '../services/api';

export function useDropdownOptions(key) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let cancelled = false;
    getDropdownKeys().then((res) => {
      if (cancelled) return;
      const keys = res.data || [];
      const entry = keys.find(k => k.key === key);
      const vals = entry?.values || [];
      setOptions(vals.filter(v => v.isActive !== false).map(v => ({ id: v.id, label: v.label || '' })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [key]);
  return options;
}
