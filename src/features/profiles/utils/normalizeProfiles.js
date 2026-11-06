const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const asStr = (value, fallback = '') => (value == null ? fallback : String(value));

const asNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pick = (source, keys, fallback) => {
  if (!source || typeof source !== 'object') return fallback;
  for (const key of keys) {
    if (source[key] != null && source[key] !== '') return source[key];
  }
  return fallback;
};

const TEXT_KEYS = ['name', 'label', 'title', 'text', 'value', 'anonymousId', 'code', 'id', 'phone', 'email', 'domain', 'url', 'path'];

const asText = (value, fallback = '') => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      const candidate = value[key];
      if (candidate != null && candidate !== '' && typeof candidate !== 'object') return String(candidate);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
};

const asTextArray = (value) => asArray(value).map((item) => asText(item)).filter(Boolean);

const profileLabel = (value) => {
  if (value == null) return '';
  if (typeof value !== 'object') return asText(value);
  const name = asText(pick(value, ['name', 'anonymousId', 'code', 'id'], ''));
  const phone = asText(pick(value, ['phone', 'phoneNumber'], ''));
  if (name && phone && name !== phone) return `${name} · ${phone}`;
  return name || phone || asText(value);
};

const confidenceLevel = (value) => {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['high', 'medium', 'low'].includes(normalized)) return normalized;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return 'low';
  if (n >= 80) return 'high';
  if (n >= 60) return 'medium';
  return 'low';
};

const formatDateTime = (value) => {
  const text = asText(value);
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const slaLabel = (raw) => {
  if (raw?.slaLabel) return asText(raw.slaLabel);
  const sla = raw?.sla;
  if (sla == null) return asText(raw?.sla, '');
  if (typeof sla !== 'object') return asText(sla);
  const hours = Number(sla.overdueHours ?? sla.remainingHours);
  if (!Number.isFinite(hours)) return asText(sla.slaState, '');
  const value = Math.abs(hours).toFixed(1);
  return sla.isOverdue ? `Overdue ${value}h` : `${value}h`;
};

export const normalizeLead = (raw = {}) => ({
  ...raw,
  id: asStr(pick(raw, ['id', 'leadId', 'lead_id'], '')),
  name: asStr(pick(raw, ['name', 'fullName', 'full_name'], '')),
  phone: asStr(pick(raw, ['phone', 'phoneNumber', 'phone_number'], '')),
  phones: asArray(pick(raw, ['phones', 'phoneNumbers', 'phone_numbers'], [])),
  email: asStr(pick(raw, ['email', 'primaryEmail', 'primary_email'], '')),
  emails: asArray(pick(raw, ['emails', 'secondaryEmails', 'secondary_emails'], [])),
  products: asArray(raw.products),
  funnel: asStr(pick(raw, ['funnel', 'funnelStage', 'funnel_stage'], 'Raw Lead'), 'Raw Lead'),
  tier: asStr(raw.tier, 'cold'),
  score: asNum(raw.score),
  oppValue: asNum(pick(raw, ['oppValue', 'opp_value'], 0)),
  wonValue: asNum(pick(raw, ['wonValue', 'won_value'], 0)),
  company: asStr(raw.company, ''),
  companyCode: asStr(pick(raw, ['companyCode', 'company_code'], '')),
  title: asStr(raw.title, ''),
  owner: asStr(raw.owner, ''),
  sales: asStr(raw.sales, ''),
  project: asStr(raw.project, '—'),
  need: asStr(raw.need, ''),
  country: asStr(raw.country, ''),
  source: asStr(raw.source, ''),
  initials: asStr(raw.initials, ''),
  isReturn: Boolean(pick(raw, ['isReturn', 'is_return'], false)),
});

const normalizeSessionItem = (raw, index = 0) => {
  if (raw == null || typeof raw !== 'object') {
    return { id: `SES-${index + 1}`, start: asText(raw), duration: '', pages: 0, engaged: false, source: '' };
  }
  return {
    id: asText(pick(raw, ['id', 'sessionId'], `SES-${index + 1}`)),
    start: asText(pick(raw, ['start', 'startedAt', 'startTime'], '')),
    duration: asText(pick(raw, ['duration', 'durationLabel'], '')),
    pages: asNum(pick(raw, ['pages', 'pageViews'], 0)),
    engaged: Boolean(pick(raw, ['engaged'], false)),
    source: asText(pick(raw, ['source', 'channel'], '')),
  };
};

const normalizeTimelineItem = (raw) => {
  if (raw == null) return { event: '', detail: '', time: '', channel: '' };
  if (typeof raw !== 'object') return { event: asText(raw), detail: '', time: '', channel: '' };
  return {
    event: asText(pick(raw, ['event', 'type', 'name'], '')),
    detail: asText(pick(raw, ['detail', 'title', 'page', 'path', 'url'], '')),
    time: formatDateTime(pick(raw, ['time', 'timestamp', 'createdAt', 'at'], '')),
    channel: asText(pick(raw, ['channel', 'source', 'page'], '')),
  };
};

export const normalizeAnonProfile = (raw = {}) => {
  const sessions = asNum(pick(raw, ['sessions', 'sessionCount', 'session_count', 'visitCount'], 0));
  const firstUtm = [asText(raw.utmSource), asText(raw.utmMedium)].filter(Boolean).join(' · ');
  const lastPage = asTextArray(raw.topPages)[0] || '';
  const timeline = asArray(pick(raw, ['timeline', 'events', 'journey', 'activities'], []));
  const company = pick(raw, ['company', 'suspectedCompany', 'identifiedCompany'], '');
  return {
    ...raw,
    id: asStr(raw.id, ''),
    displayId: asText(pick(raw, ['anonymousId', 'code', 'id'], '')),
    status: asStr(raw.status, 'active'),
    tier: asStr(raw.tier, 'cold').toLowerCase(),
    score: asNum(raw.score),
    sessions,
    sessionList: asArray(pick(raw, ['sessionList', 'session_list'], [])).map(normalizeSessionItem),
    timeline: timeline.map(normalizeTimelineItem),
    cookie: asText(pick(raw, ['cookie', 'cookieId'], '')),
    device: asText(pick(raw, ['deviceFingerprint', 'deviceId', 'device'], '')),
    deviceLabel: asText(pick(raw, ['deviceLabel'], '')) || [asText(raw.os), asText(raw.browser)].filter(Boolean).join(' · ') || asText(raw.device),
    ip: asText(pick(raw, ['ip', 'ipAddress', 'maskedIp'], '')),
    ipLabel: asText(pick(raw, ['ipLabel', 'isp'], '')),
    site: asText(pick(raw, ['site', 'domain', 'siteName'], '')),
    company: asText(company),
    companyConfidence: asText(pick(raw, ['companyConfidence'], confidenceLevel(raw.companyConfidence || raw.companyScore))),
    companyConfirmed: Boolean(pick(raw, ['companyConfirmed'], false)),
    userType: asText(pick(raw, ['userType'], sessions > 1 ? 'returning' : 'new')),
    engaged: Boolean(pick(raw, ['engaged'], (raw.totalDurationSec || 0) > 10 || sessions > 1)),
    conflict: Boolean(pick(raw, ['conflict', 'hasConflict'], false)),
    location: asText(pick(raw, ['location', 'city'], '')),
    firstTouch: asText(pick(raw, ['firstTouch'], '')) || firstUtm,
    lastTouch: asText(pick(raw, ['lastTouch'], '')) || lastPage,
    firstSeen: formatDateTime(pick(raw, ['firstSeen', 'firstSeenAt', 'firstVisit'], '')),
    lastActive: formatDateTime(pick(raw, ['lastActive', 'lastSeenAt', 'lastVisit', 'lastActiveAt'], '')),
  };
};

export const normalizeSlaItem = (raw = {}, index = 0) => ({
  ...raw,
  id: asStr(raw.id, `SLA-${index + 1}`),
  status: asStr(raw.status, 'new'),
  group: asStr(pick(raw, ['group', 'type', 'queueGroup', 'queue_group'], 'missing-data'), 'missing-data'),
  sla: asStr(pick(raw, ['sla', 'slaLabel', 'sla_label', 'deadline'], ''), ''),
  overdue: Boolean(pick(raw, ['overdue', 'isOverdue', 'is_overdue'], false)),
  title: asStr(raw.title, ''),
  description: asStr(raw.description, ''),
  lead: asStr(raw.lead, ''),
  owner: asStr(raw.owner, ''),
  createdAt: asStr(pick(raw, ['createdAt', 'created_at'], '')),
});

export const normalizeConflict = (raw = {}) => {
  const profiles = asArray(raw.profiles).map(profileLabel);
  const keys = asTextArray(raw.keys);
  const fallbackKeys = [...new Set([raw.maskedKey, raw.keyValue].map((value) => asText(value)).filter(Boolean))];
  const candidates = asTextArray(raw.candidates);
  return {
    ...raw,
    keys: keys.length ? keys : fallbackKeys,
    profiles,
    candidates: candidates.length ? candidates : profiles,
    phones: asTextArray(raw.phones),
    sla: slaLabel(raw),
    reason: asStr(raw.reason, ''),
    createdAt: formatDateTime(pick(raw, ['createdAt', 'detectedAt'], '')),
    status: asStr(raw.status, 'pending'),
    severity: asText(raw.severity, ''),
  };
};

export const normalizeCluster = (raw = {}) => {
  const companyList = [
    ...asTextArray(raw.companies),
    asText(raw.suspectedCompany, ''),
    asText(raw.companyName, ''),
  ].filter(Boolean);
  const profileCount = asNum(
    pick(raw, ['profileCount', 'anonymousCount'], Array.isArray(raw.profiles) ? raw.profiles.length : 0)
  );
  return {
    ...raw,
    companies: [...new Set(companyList)],
    sessions: asNum(pick(raw, ['sessions', 'totalSessions', 'totalVisits'], 0)),
    profiles: profileCount,
    identified: asNum(pick(raw, ['identified', 'identifiedCount'], 0)),
    suggestion: asText(pick(raw, ['suggestion', 'suspectedCompany', 'companyName'], '')),
    confidence: confidenceLevel(raw.confidence),
    status: asStr(raw.status, 'pending'),
    lastSeen: formatDateTime(pick(raw, ['lastSeen', 'lastSeenAt', 'detectedAt', 'updatedAt'], '')),
    ip: asText(pick(raw, ['ip', 'maskedIp', 'ipRange'], '')),
  };
};

export const normalizeSite = (raw = {}) => ({
  ...raw,
  name: asStr(raw.name, ''),
  domain: asStr(raw.domain, ''),
  siteId: asStr(raw.siteId, ''),
  trackingKey: asStr(raw.trackingKey, ''),
  status: asStr(raw.status, (raw.enabled ?? raw.isActive) ? 'active' : 'inactive'),
  events: asNum(pick(raw, ['events', 'eventsCount', 'totalEvents'], 0)),
  lastEvent: formatDateTime(pick(raw, ['lastEvent', 'lastEventAt', 'lastPingAt'], '')),
});

export const normalizeAudit = (raw = {}) => ({
  ...raw,
  actor: asText(pick(raw, ['actor', 'actorName', 'user'], '')),
  action: asText(raw.action, ''),
  target: asText(pick(raw, ['target'], '')) || [asText(raw.entityType), asText(raw.entityId)].filter(Boolean).join(' · '),
  before: asText(pick(raw, ['before', 'beforeData'], '')),
  after: asText(pick(raw, ['after', 'afterData'], '')),
  time: formatDateTime(pick(raw, ['time', 'createdAt', 'timestamp'], '')),
});

export const normalizeCompany = (raw = {}) => ({
  ...raw,
  code: asStr(raw.code, ''),
  name: asStr(raw.name, ''),
  domain: asStr(raw.domain, ''),
  taxCode: asStr(pick(raw, ['taxCode', 'tax_code'], '')),
  aliases: asArray(raw.aliases),
  leads: asNum(raw.leads),
  pipeline: asNum(raw.pipeline),
  won: asNum(raw.won),
  industry: asStr(raw.industry, ''),
  city: asStr(raw.city, ''),
});
