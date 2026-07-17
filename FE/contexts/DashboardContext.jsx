import { createContext, useContext, useState, useCallback } from 'react';

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

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [year, setYear] = useState(currentYear);
  const [periodType, setPeriodType] = useState('week');
  const [periodValue, setPeriodValue] = useState(currentWeek);

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

  return (
    <DashboardContext.Provider value={{ year, periodType, periodValue, setYear: changeYear, setPeriodType: updatePeriod, setPeriodValue }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
