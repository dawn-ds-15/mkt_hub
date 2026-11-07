/**
 * BE_requirement_24_10_26 §3, §4, §5:
 * - Masking helpers for IP, Cookie, Device Fingerprint, and Tracking Key
 * - Company name normalization & fuzzy similarity helpers
 * - Dynamic SLA status & 4h overdue alert calculation
 */

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '';
  const trimmed = String(ip).trim();
  if (trimmed.includes('*')) return trimmed;
  // IPv4: 113.161.72.45 -> 113.161.***.45
  const parts = trimmed.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
  }
  // IPv6 or range
  if (trimmed.length > 8) {
    return `${trimmed.slice(0, 6)}****${trimmed.slice(-3)}`;
  }
  return '***';
}

export function maskCookie(cookie: string | null | undefined): string {
  if (!cookie) return '';
  const trimmed = String(cookie).trim();
  if (trimmed.includes('*')) return trimmed;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 7)}****${trimmed.slice(-4)}`;
}

export function maskDevice(device: string | null | undefined): string {
  if (!device) return '';
  const trimmed = String(device).trim();
  if (trimmed.includes('*')) return trimmed;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 7)}****${trimmed.slice(-4)}`;
}

export function maskTrackingKey(key: string | null | undefined): string {
  if (!key) return '';
  const trimmed = String(key).trim();
  if (trimmed.includes('*')) return trimmed;
  if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}****`;
  return `${trimmed.slice(0, 9)}****${trimmed.slice(-4)}`;
}

/**
 * Strips common Vietnamese & English corporate prefixes/suffixes for fuzzy company matching.
 */
export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(
      /\b(cong ty|cty|tnhh|co phan|cp|tap doan|group|jsc|ltd|co|corp|corporation|viet nam|vietnam|vn|one member|mtv|thuong mai|dich vu|tm dv|dau tu|phat trien|cong nghe)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  return String(domain)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim();
}

/**
 * Dice coefficient / token overlap similarity (0..1) between two normalized company names.
 */
export function companyNameSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    if (minLen >= 4) return Math.max(0.8, minLen / maxLen);
  }
  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      out.push(s.slice(i, i + 2));
    }
    return out;
  };
  const bgA = bigrams(normA);
  const bgB = bigrams(normB);
  if (bgA.length === 0 || bgB.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of bgA) counts.set(g, (counts.get(g) || 0) + 1);
  let matches = 0;
  for (const g of bgB) {
    const c = counts.get(g) || 0;
    if (c > 0) {
      matches++;
      counts.set(g, c - 1);
    }
  }
  return (2 * matches) / (bgA.length + bgB.length);
}

/**
 * SLA calculation helper (BE_requirement_24_10_26 §4):
 * - Conflict / duplicate / fuzzy company: 24h
 * - Missing data: 48h
 * - Overdue warning every 4h
 */
export function computeSlaMetrics(item: {
  status: string;
  dueAt: Date | string;
  createdAt?: Date | string;
  slaHours?: number;
  type?: string;
}) {
  const now = Date.now();
  const dueMs = new Date(item.dueAt).getTime();
  const createdMs = item.createdAt ? new Date(item.createdAt).getTime() : dueMs - (item.slaHours || 24) * 3600_000;
  const isCompleted = item.status === 'done' || item.status === 'resolved' || item.status === 'skipped';
  const diffMs = dueMs - now;
  const remainingHours = Number((diffMs / 3600_000).toFixed(1));
  const isOverdue = !isCompleted && diffMs < 0;
  const isDueSoon = !isCompleted && !isOverdue && diffMs <= 4 * 3600_000;

  const FOUR_HOURS_MS = 4 * 3600_000;
  const overdueMs = isOverdue ? Math.abs(diffMs) : 0;
  const overdueAlertsCount = isOverdue
    ? Math.floor(overdueMs / FOUR_HOURS_MS) + 1
    : 0;
  const lastAlertAt = isOverdue
    ? new Date(
        dueMs + (overdueAlertsCount - 1) * FOUR_HOURS_MS,
      ).toISOString()
    : null;
  const nextAlertAt = isOverdue
    ? new Date(dueMs + overdueAlertsCount * FOUR_HOURS_MS).toISOString()
    : !isCompleted
      ? new Date(dueMs).toISOString()
      : null;

  let slaState: 'overdue' | 'dueSoon' | 'processing' | 'done' | 'pending' | 'skipped' =
    'pending';
  if (item.status === 'done' || item.status === 'resolved') {
    slaState = 'done';
  } else if (item.status === 'skipped') {
    slaState = 'skipped';
  } else if (isOverdue) {
    slaState = 'overdue';
  } else if (isDueSoon) {
    slaState = 'dueSoon';
  } else if (item.status === 'processing') {
    slaState = 'processing';
  } else {
    slaState = 'pending';
  }

  return {
    slaHours: item.slaHours || (item.type === 'missing_data' ? 48 : 24),
    isOverdue,
    isDueSoon,
    remainingHours,
    overdueHours: isOverdue ? Number((overdueMs / 3600_000).toFixed(1)) : 0,
    alertIntervalHours: 4,
    overdueAlertsCount,
    lastAlertAt,
    nextAlertAt,
    slaState,
    elapsedHours: Number(((now - createdMs) / 3600_000).toFixed(1)),
  };
}
