import * as crypto from 'crypto';
import { normalizeDomain } from './masking.util';

/**
 * 05-backend-anonymous-tracking §5.3 & §10.1:
 * Chuẩn hoá phone Việt Nam: bỏ khoảng trắng/gạch nối, +84/84 -> 0, đúng 10 số,
 * loại số giả (toàn số lặp sau đầu số như 0900000000, 0999999999).
 */
export function normalizeVietnamesePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let cleaned = String(raw)
    .trim()
    .replace(/[\s\-.()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  if (!/^0[35789]\d{8}$/.test(cleaned)) {
    return null;
  }
  // Reject obvious fake repeated numbers like 0900000000, 0999999999, 0911111111
  const tail = cleaned.slice(2);
  if (/^(\d)\1{7}$/.test(tail)) {
    return null;
  }
  return cleaned;
}

/**
 * 05-backend-anonymous-tracking §6.8: Bot / crawler detection by User-Agent.
 */
const BOT_UA_REGEX =
  /\b(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|headlesschrome|phantomjs|crawler|spider|lighthouse|gtmetrix|pingdom|uptimerobot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider)\b/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_REGEX.test(String(userAgent));
}

/**
 * 05-backend-anonymous-tracking §6.8: CIDR / Internal IP matching.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (n < 0 || n > 255) return null;
    num = ((num << 8) | n) >>> 0;
  }
  return num;
}

export function isIpInCidr(ip: string, cidrOrIp: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/i, '').trim();
  const target = cidrOrIp.trim();
  if (!cleanIp || !target) return false;
  if (!target.includes('/')) {
    return cleanIp === target;
  }
  const [rangeIp, prefixStr] = target.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(cleanIp);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (prefix === 0) return true;
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function isInternalClientIp(
  clientIp: string | null | undefined,
  internalCidrs: unknown,
): boolean {
  if (!clientIp) return false;
  const cleanIp = String(clientIp)
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/i, '');
  if (!cleanIp) return false;
  const list = Array.isArray(internalCidrs) ? internalCidrs : [];
  for (const cidr of list) {
    if (typeof cidr === 'string' && isIpInCidr(cleanIp, cidr)) {
      return true;
    }
  }
  return false;
}

/**
 * 05-backend-anonymous-tracking §5.2 & §9.1: Check Origin against site.allowedOrigins & site.domain.
 */
export function isOriginAllowedForSite(
  originHeader: string | null | undefined,
  site: { domain?: string | null; allowedOrigins?: unknown },
): boolean {
  if (!originHeader) return true;
  const rawOrigin = String(originHeader).trim().toLowerCase();
  if (!rawOrigin || rawOrigin === 'null') return true;

  const allowedList = Array.isArray(site.allowedOrigins)
    ? (site.allowedOrigins as string[])
        .map((o) => String(o || '').trim().toLowerCase())
        .filter(Boolean)
    : [];

  const originDomain = normalizeDomain(rawOrigin);
  const siteDomain = normalizeDomain(site.domain);

  if (allowedList.length === 0) {
    // If allowedOrigins not explicitly restricted, allow matching domain or localhost
    if (!siteDomain) return true;
    return (
      originDomain === siteDomain ||
      originDomain.endsWith(`.${siteDomain}`) ||
      originDomain.startsWith('localhost') ||
      originDomain.startsWith('127.0.0.1')
    );
  }

  for (const allowed of allowedList) {
    if (allowed === '*') return true;
    const normAllowed = allowed.replace(/\/+$/, '');
    const normOrigin = rawOrigin.replace(/\/+$/, '');
    if (normOrigin === normAllowed) return true;
    const allowedDom = normalizeDomain(normAllowed);
    if (allowedDom && originDomain === allowedDom) return true;
  }

  if (siteDomain && originDomain === siteDomain) {
    return true;
  }

  return false;
}

export function hashIp(ip: string | null | undefined): string {
  const clean = String(ip || '0.0.0.0')
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/i, '');
  const pepper = process.env.IP_HASH_PEPPER || 'mkt-hub-pepper-2026';
  return crypto
    .createHash('sha256')
    .update(`${clean}:${pepper}`)
    .digest('hex');
}

export function hashServerKey(key: string): string {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

export function computeEventScoreDelta(
  eventType: string,
  metadata?: Record<string, any> | null,
): number {
  const t = String(eventType || '').toLowerCase();
  switch (t) {
    case 'page_view': {
      const path = String(metadata?.path || '').toLowerCase();
      if (path.includes('bang-gia') || path.includes('pricing')) return 15;
      return 5;
    }
    case 'pricing_view':
      return 20;
    case 'document_download':
    case 'download':
      return 15;
    case 'cta_click':
      return 10;
    case 'form_submit':
    case 'form_attempt':
      return 25;
    case 'chat_interaction':
    case 'tool_interaction':
      return 15;
    case 'time_on_page': {
      const dur = Number(metadata?.durationSec || 0);
      return dur >= 30 ? 5 : 2;
    }
    default:
      return 5;
  }
}

export function computeTierFromScore(score: number): 'Hot' | 'Warm' | 'Cold' {
  if (score >= 75) return 'Hot';
  if (score >= 45) return 'Warm';
  return 'Cold';
}

export function buildScriptInfo(siteId: string, trackingKey: string) {
  const baseScriptUrl =
    process.env.TRACKING_SCRIPT_URL || 'https://cdn.mkthub.vn/t.js';
  const scriptUrl = `${baseScriptUrl}?site=${encodeURIComponent(siteId)}&key=${encodeURIComponent(trackingKey)}`;
  const snippet = `<script async src="${scriptUrl}"></script>`;
  return { scriptUrl, snippet };
}

/**
 * 05-backend-anonymous-tracking §8: Production-ready MKT Hub Tracker Script (t.js)
 */
export function buildTrackerScriptSource(): string {
  return `(function () {
  try {
    var script = document.currentScript || (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('t.js') !== -1) return scripts[i];
      }
      return null;
    })();
    if (!script || !script.src) return;

    var urlObj = new URL(script.src, location.href);
    var siteId = urlObj.searchParams.get('site') || script.getAttribute('data-site-id');
    var trackingKey = urlObj.searchParams.get('key') || script.getAttribute('data-key');
    if (!siteId || !trackingKey) return;

    var endpoint = script.getAttribute('data-endpoint') || urlObj.href.replace(/\\/(api\\/v1\\/tracking\\/)?t\\.js.*$/, '/api/v1/tracking/collect');
    var QUEUE_KEY = '_mkt_retry_queue';
    var pageEnteredAt = Date.now();

    function uuid() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function getCookie(name) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\\]\\\\/+^])/g, '\\\\$1') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    }

    function setCookie(name, value, days) {
      var expires = '';
      if (days) {
        var d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        expires = '; expires=' + d.toUTCString();
      }
      var secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax' + secure;
    }

    function getUtm() {
      var sp = new URLSearchParams(location.search);
      var source = sp.get('utm_source');
      var medium = sp.get('utm_medium');
      var campaign = sp.get('utm_campaign');
      var term = sp.get('utm_term');
      var content = sp.get('utm_content');
      if (!source && !medium && !campaign) return null;
      return { source: source, medium: medium, campaign: campaign, term: term, content: content };
    }

    var cid = getCookie('_mkt_cid') || 'ck_' + uuid().replace(/-/g, '').slice(0, 16);
    setCookie('_mkt_cid', cid, 365);

    var did = null;
    try {
      did = localStorage.getItem('_mkt_did') || 'fp_' + uuid().replace(/-/g, '').slice(0, 16);
      localStorage.setItem('_mkt_did', did);
    } catch (e) {}

    function ensureSession() {
      var sid = getCookie('_mkt_sid');
      if (!sid) {
        try { sid = sessionStorage.getItem('_mkt_sid'); } catch (e) {}
      }
      if (!sid) sid = 's_' + uuid().replace(/-/g, '').slice(0, 16);
      setCookie('_mkt_sid', sid, 1 / 48); // 30 minutes rolling
      try { sessionStorage.setItem('_mkt_sid', sid); } catch (e) {}
      return sid;
    }

    function enqueueRetry(evt) {
      try {
        var raw = localStorage.getItem(QUEUE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        list.push(evt);
        if (list.length > 20) list = list.slice(list.length - 20);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
      } catch (e) {}
    }

    function flushRetryQueue() {
      try {
        var raw = localStorage.getItem(QUEUE_KEY);
        if (!raw) return;
        var list = JSON.parse(raw);
        if (!Array.isArray(list) || !list.length) return;
        localStorage.removeItem(QUEUE_KEY);
        dispatchEvents(list);
      } catch (e) {}
    }

    function dispatchEvents(events) {
      if (window.MKT_CONSENT && window.MKT_CONSENT.analytics === false) return;
      var payload = JSON.stringify({
        siteId: siteId,
        trackingKey: trackingKey,
        events: events
      });
      if (navigator.sendBeacon) {
        var ok = navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
        if (!ok) {
          events.forEach(enqueueRetry);
        }
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {
          events.forEach(enqueueRetry);
        });
      }
    }

    function send(eventType, metadata) {
      try {
        var sid = ensureSession();
        var sp = new URLSearchParams(location.search);
        var evt = {
          eventId: uuid(),
          eventType: eventType,
          occurredAt: new Date().toISOString(),
          url: location.href,
          referrer: document.referrer || null,
          title: document.title || null,
          sessionId: sid,
          cookieId: cid,
          deviceId: did,
          projectCode: sp.get('projectCode') || sp.get('project_code') || null,
          utm: getUtm(),
          metadata: Object.assign({ path: location.pathname }, metadata || {}),
          consent: window.MKT_CONSENT || { analytics: true }
        };
        dispatchEvents([evt]);
      } catch (e) {}
    }

    flushRetryQueue();
    send('page_view', { path: location.pathname });

    // SPA route tracking
    var lastHref = location.href;
    function checkRouteChange() {
      if (location.href !== lastHref) {
        lastHref = location.href;
        pageEnteredAt = Date.now();
        send('page_view', { path: location.pathname, spa: true });
      }
    }
    window.addEventListener('popstate', checkRouteChange);
    var origPush = history.pushState;
    if (origPush) {
      history.pushState = function () {
        origPush.apply(this, arguments);
        checkRouteChange();
      };
    }

    // Time on page
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        var durationSec = Math.max(1, Math.round((Date.now() - pageEnteredAt) / 1000));
        send('time_on_page', { path: location.pathname, durationSec: durationSec });
      }
    });

    // CTA click & Document download tracking
    document.addEventListener('click', function (ev) {
      try {
        var target = ev.target && ev.target.closest ? ev.target.closest('[data-mkt-event], a[href]') : null;
        if (!target) return;
        var customEvent = target.getAttribute('data-mkt-event');
        if (customEvent) {
          send(customEvent || 'cta_click', {
            label: (target.innerText || '').trim().slice(0, 80),
            targetId: target.id || null
          });
          return;
        }
        var href = target.getAttribute('href') || '';
        if (/\\.(pdf|docx?|xlsx?|zip)(\\?|$)/i.test(href)) {
          send('document_download', { fileUrl: href });
        }
      } catch (e) {}
    }, true);

    // Form submit metadata only (never collects field values)
    document.addEventListener('submit', function (ev) {
      try {
        var form = ev.target;
        send('form_submit', {
          formId: (form && (form.id || form.getAttribute('name'))) || 'form',
          path: location.pathname
        });
      } catch (e) {}
    }, true);

    window.MKTHubTracker = { track: send, getCookieId: function () { return cid; }, getDeviceId: function () { return did; }, getSessionId: ensureSession };
  } catch (e) {
    // Never interrupt host website
  }
})();
`;
}
