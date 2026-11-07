/**
 * Helpers for ClosedDeal.initiationDate (BE requirement 26/09/2026 §3).
 *
 * A won deal is attributed to a period by the initiation date of its source
 * opportunity. The deal keeps its own copy (`ClosedDeal.initiationDate`); when
 * that is empty we fall back to the linked opportunity's `initiationDate`.
 */

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;
// Excel serials for 1900-01-01 .. 9999-12-31.
const EXCEL_SERIAL_MIN = 1;
const EXCEL_SERIAL_MAX = 2958465;

/** Header / field names accepted for the "Ngày bắt đầu" import column. */
export const INITIATION_DATE_KEYS = [
  'initiationDate',
  'initiation_date',
  'ngayBatDau',
  'ngay_bat_dau',
  'Ngày bắt đầu',
  'Ngay bat dau',
];

const NORMALIZED_INITIATION_KEYS = new Set(['initiationdate', 'ngaybatdau']);

function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[\s_\-.]/g, '');
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null; // e.g. 31/02
  }
  return d;
}

function fromExcelSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) {
    return null;
  }
  const d = new Date(EXCEL_EPOCH_MS + Math.floor(serial) * DAY_MS);
  return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Parses an import/API date cell into a UTC-midnight Date (suitable for a
 * `@db.Date` column). Accepts Date objects, Excel serial numbers (number or
 * numeric string), `YYYY-MM-DD` / `YYYY/MM/DD` (optionally followed by a time
 * part, e.g. full ISO strings) and `DD/MM/YYYY` / `DD-MM-YYYY` / `DD.MM.YYYY`.
 * Returns null for empty or unparseable values.
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return utcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === 'number') {
    return fromExcelSerial(value);
  }

  if (typeof value === 'object') {
    const v: any = value;
    if ('result' in v) return parseFlexibleDate(v.result);
    if ('text' in v) return parseFlexibleDate(v.text);
    return null;
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    return fromExcelSerial(Number(s));
  }

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (m) {
    // Full ISO datetime with an explicit offset: honour the instant (UTC day).
    if (/[T\s]\d{1,2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
    }
    return utcDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:$|\s)/);
  if (m) {
    return utcDate(Number(m[3]), Number(m[2]), Number(m[1]));
  }

  return null;
}

/** 'YYYY-MM-DD' of a date-only value, or null. */
export function toDateOnlyString(value: Date | string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Normalises any accepted input to 'YYYY-MM-DD', or null when empty/invalid. */
export function normalizeDateOnly(value: unknown): string | null {
  return toDateOnlyString(parseFlexibleDate(value));
}

/**
 * Finds the raw "Ngày bắt đầu" value in an import row / request body, matching
 * the known aliases and any header that normalises to `ngaybatdau` /
 * `initiationdate` (case, accents, spaces and underscores ignored).
 */
export function pickInitiationDateRaw(
  row: Record<string, any> | null | undefined,
): { found: boolean; value: unknown } {
  if (!row || typeof row !== 'object') return { found: false, value: undefined };
  for (const key of INITIATION_DATE_KEYS) {
    if (row[key] !== undefined) return { found: true, value: row[key] };
  }
  for (const key of Object.keys(row)) {
    if (NORMALIZED_INITIATION_KEYS.has(normalizeKey(key)) && row[key] !== undefined) {
      return { found: true, value: row[key] };
    }
  }
  return { found: false, value: undefined };
}

type ClosedDealLike = {
  initiationDate?: Date | string | null;
  opportunityId?: string | null;
  opportunity?: { initiationDate?: Date | string | null } | null;
};

/** Effective initiation date: deal's own value, else the linked opportunity's. */
export function resolveDealInitiationDate(deal: ClosedDealLike): string | null {
  return (
    toDateOnlyString(deal.initiationDate) ??
    toDateOnlyString(deal.opportunity?.initiationDate) ??
    null
  );
}

/** The two fields every closed-deal representation adds for the client. */
export function closedDealInitiationFields(deal: ClosedDealLike): {
  initiationDate: string | null;
  opportunityId: string | null;
} {
  return {
    initiationDate: resolveDealInitiationDate(deal),
    opportunityId: deal.opportunityId ?? null,
  };
}

/**
 * Formats a raw Prisma ClosedDeal row (create/update result) for the client:
 * keeps every existing field, replaces `initiationDate` with the effective
 * 'YYYY-MM-DD' value, guarantees `opportunityId`, and drops the helper
 * `opportunity` relation if it was included only to resolve the fallback.
 */
export function formatRawClosedDeal<T extends ClosedDealLike>(
  deal: T,
): Omit<T, 'opportunity' | 'initiationDate' | 'opportunityId'> & {
  initiationDate: string | null;
  opportunityId: string | null;
} {
  if (!deal || typeof deal !== 'object') return deal as any;
  const { opportunity: _opportunity, ...rest } = deal as any;
  return { ...rest, ...closedDealInitiationFields(deal) };
}

/** Prisma include fragment used to resolve the opportunity fallback. */
export const OPPORTUNITY_INITIATION_SELECT = {
  select: { initiationDate: true },
} as const;
