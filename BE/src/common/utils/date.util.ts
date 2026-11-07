const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function startOfBusinessToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)),
  );
}

export function getIsoWeekAndYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year };
}

export function calcDurationWeeks(
  startDate?: Date | string | null,
  dueDate?: Date | string | null,
): number {
  if (!dueDate) return 1;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const start = startDate ? (typeof startDate === 'string' ? new Date(startDate) : startDate) : due;
  if (isNaN(due.getTime()) || isNaN(start.getTime())) return 1;

  const diffTime = due.getTime() - start.getTime();
  if (diffTime <= 0) return 1;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}

export function parseSafeDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
