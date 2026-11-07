import type { Request } from 'express';

const isLocalHost = (value: string) =>
  /(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value);

/**
 * Base URL used to build absolute attachment URLs. Unlike project documents (env first), the
 * incoming request (proxy headers first) wins, so links are never hard-wired to a localhost
 * APP_URL in production. Env vars are only a fallback (ignored when they point to localhost),
 * and an empty string yields a URL relative to the API host.
 */
export function resolveRequestBaseUrl(req?: Request): string {
  const header = (name: string) => {
    const value = req?.headers?.[name];
    const first = Array.isArray(value) ? value[0] : value;
    return first ? String(first).split(',')[0].trim() : '';
  };

  const host =
    header('x-forwarded-host') || (req?.get ? req.get('host') || '' : '');
  if (host) {
    return `${header('x-forwarded-proto') || req?.protocol || 'http'}://${host}`;
  }

  const envUrl = (
    process.env.APP_URL ||
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ''
  ).replace(/\/+$/, '');
  return envUrl && !isLocalHost(envUrl) ? envUrl : '';
}
