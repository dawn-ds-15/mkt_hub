import { useState, useEffect } from 'react';
import { getDropdownKeys } from '../services/api';

// Trả về { options, loaded } để component phân biệt "chưa tải xong" với "cấu hình rỗng".
export function useDropdownOptionsState(key) {
  const [state, setState] = useState({ options: [], loaded: false });
  useEffect(() => {
    let cancelled = false;
    setState({ options: [], loaded: false });
    getDropdownKeys().then((res) => {
      if (cancelled) return;
      const keys = res.data || [];
      const entry = keys.find(k => k.key === key);
      const vals = entry?.values || [];
      setState({
        options: vals.filter(v => v.isActive !== false).map(v => ({ id: v.id, label: v.label || '' })),
        loaded: true,
      });
    }).catch(() => {
      if (!cancelled) setState({ options: [], loaded: true });
    });
    return () => { cancelled = true; };
  }, [key]);
  return state;
}

export function useDropdownOptions(key) {
  return useDropdownOptionsState(key).options;
}
