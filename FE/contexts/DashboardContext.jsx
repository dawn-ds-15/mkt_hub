import { createContext, useContext, useState, useCallback, useEffect } from 'react';

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

const now = new Date();
const currentYear = String(now.getFullYear());
const currentMonth = String(now.getMonth() + 1);
const currentQuarter = String(Math.floor(now.getMonth() / 3) + 1);
const currentWeek = String(getISOWeek(now));

const DASHBOARD_STORAGE_KEY = 'mkt_hub_dashboard';
const LOCALE_STORAGE_KEY = 'mkt_hub_locale';

function loadFromStorage() {
  try {
    const saved = sessionStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveToStorage(state) {
  try {
    sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || 'vi';
  } catch { return 'vi'; }
}

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const saved = loadFromStorage();
  const [year, setYear] = useState(saved?.year || currentYear);
  const [periodType, setPeriodType] = useState(saved?.periodType || 'week');
  const [periodValue, setPeriodValue] = useState(saved?.periodValue || currentWeek);
  const [locale, setLocale] = useState(loadLocale);

  useEffect(() => {
    saveToStorage({ year, periodType, periodValue });
  }, [year, periodType, periodValue]);

  useEffect(() => {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch {}
  }, [locale]);

  const updatePeriod = useCallback((type) => {
    setPeriodType(type);
    switch (type) {
      case 'week':
        setPeriodValue(currentWeek);
        break;
      case 'month':
        setPeriodValue(currentMonth);
        break;
      case 'quarter':
        setPeriodValue(currentQuarter);
        break;
      case 'year':
        setPeriodValue(currentYear);
        break;
    }
  }, []);

  const changeYear = useCallback((y) => {
    setYear(y);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(prev => prev === 'vi' ? 'en' : 'vi');
  }, []);

  return (
    <DashboardContext.Provider value={{ year, periodType, periodValue, setYear: changeYear, setPeriodType: updatePeriod, setPeriodValue, locale, toggleLocale }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
