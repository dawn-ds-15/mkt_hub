/**
 * Per-account module permissions (BE_requirement_29_09_26 §2 & BE_requirement_24_10_26 §5).
 *
 * Each cell of the matrix is one of:
 *  - edit: full access (default)
 *  - view: read only, create / update / delete requests of the module get 403
 *  - none: no access, every request of the module gets 403 (except the shared reads below)
 *
 * "Quản lý dữ liệu" is not part of the matrix: it stays manager-only by role.
 */

export const PERMISSION_MODULES = [
  'dashboard',
  'projects',
  'tasks',
  'leads',
  'expense',
  'inventory',
] as const;

export const PROFILE_PERMISSION_MODULES = [
  'anonymous_profiles',
  'identified_profiles',
  'company_master',
  'sla_queue',
] as const;

export const ALL_PERMISSION_MODULES = [
  ...PERMISSION_MODULES,
  ...PROFILE_PERMISSION_MODULES,
] as const;

export type PermissionModule = (typeof ALL_PERMISSION_MODULES)[number];

export const PERMISSION_LEVELS = ['none', 'view', 'edit'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PROFILE_PERMISSION_ACTIONS = [
  'view',
  'edit',
  'export',
  'convert',
  'resolve_conflict',
  'handover',
  'merge_lead',
  'merge_company',
  'claim',
  'resolve',
] as const;
export type ProfilePermissionAction =
  (typeof PROFILE_PERMISSION_ACTIONS)[number];

export const MODULE_ACTION_MAP: Record<
  (typeof PROFILE_PERMISSION_MODULES)[number],
  readonly ProfilePermissionAction[]
> = {
  anonymous_profiles: ['view', 'edit', 'export', 'convert', 'resolve_conflict'],
  identified_profiles: ['view', 'edit', 'export', 'handover', 'merge_lead'],
  company_master: ['view', 'edit', 'export', 'merge_company'],
  sla_queue: ['view', 'edit', 'export', 'claim', 'resolve'],
};

/** { [userId]: { [module]: level } } — only cells set explicitly. */
export type PermissionMatrixData = Record<
  string,
  Partial<Record<PermissionModule, PermissionLevel>>
>;

export const isPermissionModule = (value: unknown): value is PermissionModule =>
  typeof value === 'string' &&
  (ALL_PERMISSION_MODULES as readonly string[]).includes(value);

export const isPermissionLevel = (value: unknown): value is PermissionLevel =>
  typeof value === 'string' &&
  (PERMISSION_LEVELS as readonly string[]).includes(value);

/** Level of a cell that is not set explicitly. Currently `edit` for every role and module. */
export function getRoleDefaultLevel(
  _role: string | undefined,
  _module: PermissionModule,
): PermissionLevel {
  return 'edit';
}

/**
 * Endpoint -> module(s), by kind of data rather than URL prefix only. Paths are matched
 * without the global `/api` prefix, lower-cased (Express routing is case-insensitive).
 * The first matching rule wins; aliases of the same controllers are listed so a module cannot
 * be reached through another path. Endpoints that match nothing are not restricted.
 *
 * `modules` with several entries = allowed when ANY of them allows the request.
 */
const MODULE_ROUTES: { pattern: RegExp; modules: PermissionModule[] }[] = [
  // expense data served under /projects
  {
    pattern: /^\/v1\/projects\/[^/]+\/(expense-plan|expense-summary)(\/|$)/,
    modules: ['expense'],
  },
  // Temporary cross-module exception (until the FE moves to the §1 endpoints): expense line
  // files are uploaded as project documents, so `edit` on projects OR expense is enough
  {
    pattern: /^\/v1\/projects\/(documents(\/|$)|[^/]+\/documents(\/|$))/,
    modules: ['projects', 'expense'],
  },
  { pattern: /^\/v1\/projects(\/|$)/, modules: ['projects'] },
  {
    // expense-budgets and its aliases (category-budget, budget), budget items, annual plans
    pattern:
      /^\/v1\/(expenses|expense-budgets|category-budget|budget|expense-budget-items|annual-plans)(\/|$)/,
    modules: ['expense'],
  },
  { pattern: /^\/budgets(\/|$)/, modules: ['expense'] },
  { pattern: /^\/v1\/(tasks|weekly-reports)(\/|$)/, modules: ['tasks'] },
  { pattern: /^\/v1\/leads-kpis(\/|$)/, modules: ['leads'] },
  {
    pattern: /^\/v1\/dashboard\/(kpi-cards|funnel|pipeline-by-segment)(\/|$)/,
    modules: ['leads'],
  },
  { pattern: /^\/v1\/inventory(\/|$)/, modules: ['inventory'] },
  { pattern: /^\/v1\/dashboard\/overview(\/|$)/, modules: ['dashboard'] },
  // BE_requirement_24_10_26 §5: 4 new modules (excluding public tracking endpoints collect, identify, t.js)
  {
    pattern:
      /^\/v1\/(anonymous-profiles(\/|$)|tracking\/(?!(collect|identify|t\.js)(\/|$)))/,
    modules: ['anonymous_profiles'],
  },
  {
    pattern: /^\/v1\/leads(?!\/from-event-site(\/|$))(\/|$)/,
    modules: ['identified_profiles', 'leads'],
  },
  {
    pattern: /^\/v1\/companies(\/|$)/,
    modules: ['company_master'],
  },
  {
    pattern: /^\/v1\/sla-queue(\/|$)/,
    modules: ['sla_queue'],
  },
];

/**
 * Shared reads: GET requests other screens use for dropdowns or figures. They stay open to every
 * signed-in user, even with `none` on the module: `none` blocks the module's screens and actions,
 * it does not hide its data everywhere else.
 */
const SHARED_READS: RegExp[] = [
  /^\/v1\/projects$/,
  /^\/v1\/projects\/checklist-templates(\/|$)/,
  /^\/v1\/tasks$/,
  /^\/v1\/inventory\/items(\/[^/]+)?$/,
  /^\/v1\/expenses\/overview$/,
  /^\/v1\/(expense-budgets|category-budget|budget)\/tree$/,
  /^\/v1\/leads-kpis\/(closed-deals|daily-actuals|opportunities)$/,
];

/**
 * Shared reads answered with fewer fields when the user has `none` on the module: enough for the
 * dropdowns of other screens, field names unchanged.
 */
const SLIM_SHARED_READS: {
  pattern: RegExp;
  module: PermissionModule;
  fields: string[];
}[] = [
  {
    pattern: /^\/v1\/projects$/,
    module: 'projects',
    fields: ['id', 'name', 'type', 'status', 'isLeadSource'],
  },
];

function normalizeApiPath(rawPath: string): string {
  let p = String(rawPath)
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()
    .replace(/\/{2,}/g, '/');
  if (p === '/api' || p.startsWith('/api/')) p = p.slice(4) || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

/** Create / update / delete requests (blocked for `view`). */
export function isWriteMethod(method: string | undefined): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(
    String(method || 'GET').toUpperCase(),
  );
}

/**
 * Modules governing a request, or null when the matrix does not apply to it
 * (path outside the matrix, or a shared read).
 */
export function resolvePermissionRule(
  method: string | undefined,
  rawPath: string | undefined | null,
): { modules: PermissionModule[] } | null {
  if (!rawPath) return null;
  const p = normalizeApiPath(rawPath);
  if (!isWriteMethod(method) && SHARED_READS.some((re) => re.test(p))) {
    return null;
  }
  const route = MODULE_ROUTES.find((r) => r.pattern.test(p));
  return route ? { modules: route.modules } : null;
}

/** Slim version of a shared read for users with `none` on its module, or null. */
export function resolveSlimSharedRead(
  method: string | undefined,
  rawPath: string | undefined | null,
): { module: PermissionModule; fields: string[] } | null {
  if (!rawPath || isWriteMethod(method)) return null;
  const p = normalizeApiPath(rawPath);
  const slim = SLIM_SHARED_READS.find((r) => r.pattern.test(p));
  return slim ? { module: slim.module, fields: slim.fields } : null;
}

/** Keeps only `fields` of each record (array body, or { data: [...] }). */
export function pickRecordFields(body: unknown, fields: string[]): unknown {
  const pick = (record: any) => {
    if (!record || typeof record !== 'object') return record;
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in record) out[field] = record[field];
    }
    return out;
  };
  if (Array.isArray(body)) return body.map(pick);
  if (body && typeof body === 'object' && Array.isArray((body as any).data)) {
    return { ...(body as any), data: (body as any).data.map(pick) };
  }
  return body;
}
