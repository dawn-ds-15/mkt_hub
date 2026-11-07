/**
 * Expense snapshot rules (BE_requirement_26_09_26 §1).
 *
 * Each "Lưu chi phí" on the project expense screen creates a new ExpenseRecord that is a
 * SNAPSHOT holding all lines of the project; older records are kept as history. Totals must
 * therefore only use the latest record (with lines) of each project, and attribute every line
 * to the period of its own expense date.
 *
 * Money convention is BEFORE VAT, matching the "Thành tiền KH/TT" columns:
 *   - regular line      = unitPriceBeforeVat × quantity
 *   - amount-only line  = plannedAmount / actual amount (stored with VAT 0, so before = after)
 */

const toNum = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export function isActiveExpenseLine(l: any): boolean {
  return !!l && !l.archivedAt && !l.cancelledAt && l.status !== 'cancelled';
}

/** Year/month a line belongs to: its expense date, else the parent record period. */
export function getExpenseLinePeriod(
  line: any,
  parentRecord: any,
): { year: number; month: number } {
  const rawDate = line.expenseDate || line.recognizedDate;
  if (rawDate) {
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return { year: rawDate.getFullYear(), month: rawDate.getMonth() + 1 };
    }
    if (typeof rawDate === 'string') {
      const match = rawDate.trim().match(/^(\d{4})[-/](\d{1,2})/);
      if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          return { year: y, month: m };
        }
      }
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
      }
    }
  }
  return { year: parentRecord?.year, month: parentRecord?.month };
}

/**
 * Exact day (YYYY-MM-DD) of a line: its expense date, else the date of the parent record,
 * else the 1st day of the record period. Used to put costs into week / custom periods.
 */
export function getExpenseLineDate(line: any, parentRecord: any): string | null {
  const toDay = (raw: any): string | null => {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
    const match = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  };
  const own = toDay(line?.expenseDate || line?.recognizedDate);
  if (own) return own;
  // No own date: stay in the same month as getExpenseLinePeriod (the record period)
  const { year, month } = getExpenseLinePeriod(line || {}, parentRecord);
  if (!year || !month) return null;
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const parent = toDay(parentRecord?.recognizedDate);
  return parent && parent.startsWith(monthPrefix) ? parent : `${monthPrefix}-01`;
}

function lineUnitPrices(l: any): { before: number; after: number } {
  const after =
    toNum(l.unitPriceAfterVatSnapshot) ?? toNum(l.actualUnitPrice) ?? 0;
  const before = toNum(l.unitPriceBeforeVatSnapshot) ?? after;
  return { before, after };
}

function lineActualQuantity(l: any): number {
  return Number(l.actualQuantity ?? l.quantity ?? 0) || 0;
}

function linePlannedQuantity(l: any): number {
  return Number(l.plannedQuantity ?? 0) || 0;
}

export function lineActualBeforeVat(l: any): number {
  return lineActualQuantity(l) * lineUnitPrices(l).before;
}

export function lineActualAfterVat(l: any): number {
  // Same as formatLine().totalAmount
  const unit = Number(l.actualUnitPrice || l.unitPriceAfterVatSnapshot || 0);
  return lineActualQuantity(l) * unit;
}

export function linePlannedAfterVat(l: any): number {
  const pa = toNum(l.plannedAmount);
  if (pa !== null && pa > 0) return pa;
  return linePlannedQuantity(l) * lineUnitPrices(l).after;
}

export function linePlannedBeforeVat(l: any): number {
  const { before, after } = lineUnitPrices(l);
  const pq = linePlannedQuantity(l);
  const pa = toNum(l.plannedAmount);
  // Regular line: plannedAmount was derived from quantity × price (after VAT)
  if (pa === null || pa <= 0 || (pq > 0 && Math.abs(pa - pq * after) <= 1)) {
    return pq * before;
  }
  // Amount entered directly: stored after VAT, convert back if a VAT rate applies
  if (after > 0 && before > 0 && after !== before) {
    return Math.round((pa * before) / after);
  }
  return pa;
}

export interface ExpenseSnapshotSet {
  /** Latest record with lines of each project, `lines` = its non-archived lines */
  snapshots: any[];
  /** Records of projects that have no record with lines (legacy directCost/overheadCost) */
  legacyRecords: any[];
}

/**
 * Loads the latest snapshot of every project (or of the given project).
 * 2 queries: record headers with line counts, then the lines of the chosen snapshots.
 */
export async function loadLatestExpenseSnapshots(
  prisma: any,
  opts: { projectId?: string } = {},
): Promise<ExpenseSnapshotSet> {
  if (!prisma?.expenseRecord?.findMany) return { snapshots: [], legacyRecords: [] };
  const where: any = { archivedAt: null };
  if (opts.projectId) where.projectId = opts.projectId;

  const headers: any[] = await prisma.expenseRecord.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      year: true,
      month: true,
      directCost: true,
      overheadCost: true,
      recognizedDate: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { lines: { where: { archivedAt: null } } } },
    },
  });
  const safeHeaders = Array.isArray(headers) ? headers : [];

  const time = (d: any) => (d ? new Date(d).getTime() : 0);
  const isNewer = (a: any, b: any) =>
    time(a.createdAt) !== time(b.createdAt)
      ? time(a.createdAt) > time(b.createdAt)
      : time(a.updatedAt) !== time(b.updatedAt)
        ? time(a.updatedAt) > time(b.updatedAt)
        : String(a.id) > String(b.id);

  const latestByProject = new Map<string, any>();
  for (const h of safeHeaders) {
    if (!(h._count?.lines > 0)) continue;
    const current = latestByProject.get(h.projectId);
    if (!current || isNewer(h, current)) latestByProject.set(h.projectId, h);
  }

  const snapshotHeaders = Array.from(latestByProject.values());
  const legacyRecords = safeHeaders.filter(
    (h) => !latestByProject.has(h.projectId),
  );
  if (snapshotHeaders.length === 0) {
    return { snapshots: [], legacyRecords };
  }

  const lines: any[] = !prisma.expenseLine?.findMany
    ? []
    : await prisma.expenseLine.findMany({
        where: {
          expenseId: { in: snapshotHeaders.map((h) => h.id) },
          archivedAt: null,
        },
      });
  const linesByRecord = new Map<string, any[]>();
  for (const l of Array.isArray(lines) ? lines : []) {
    const list = linesByRecord.get(l.expenseId) || [];
    list.push(l);
    linesByRecord.set(l.expenseId, list);
  }

  return {
    snapshots: snapshotHeaders.map((h) => ({
      ...h,
      lines: linesByRecord.get(h.id) || [],
    })),
    legacyRecords,
  };
}

/**
 * Date that decides which period a won deal belongs to (§2/§3): the start date of the
 * source opportunity, falling back to the signing date when it is unknown.
 */
export function getDealPeriodDate(deal: any): Date | null {
  const raw =
    deal?.initiationDate ?? deal?.opportunity?.initiationDate ?? deal?.closedDate;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export type LeadSourceMode = 'configured' | 'default';

/**
 * Projects whose cost counts as "Chi phí lead" (§2). Uses projects flagged isLeadSource;
 * when none is flagged yet, falls back to the FE default: projects that have raw leads,
 * opportunities or won deals.
 */
export async function resolveLeadSourceProjectIds(
  prisma: any,
  deals: any[],
): Promise<{ ids: string[]; mode: LeadSourceMode }> {
  const flagged: any[] = prisma.project?.findMany
    ? await prisma.project.findMany({
        where: { isLeadSource: true, archivedAt: null },
        select: { id: true },
      })
    : [];
  if (Array.isArray(flagged) && flagged.length > 0) {
    return { ids: flagged.map((p) => p.id), mode: 'configured' };
  }

  const [leadRows, oppRows] = await Promise.all([
    prisma.projectDailyActual?.findMany
      ? prisma.projectDailyActual.findMany({
          where: { archivedAt: null, rawLeads: { gt: 0 } },
          select: { projectId: true },
          distinct: ['projectId'],
        })
      : [],
    prisma.opportunity?.findMany
      ? prisma.opportunity.findMany({
          where: { archivedAt: null, projectId: { not: null } },
          select: { projectId: true },
          distinct: ['projectId'],
        })
      : [],
  ]);
  const ids = new Set<string>();
  for (const row of [
    ...(Array.isArray(leadRows) ? leadRows : []),
    ...(Array.isArray(oppRows) ? oppRows : []),
    ...(Array.isArray(deals) ? deals : []),
  ]) {
    if (row?.projectId) ids.add(row.projectId);
  }
  return { ids: Array.from(ids), mode: 'default' };
}

export interface ExpenseCostEntry {
  projectId: string;
  year: number;
  month: number;
  /** YYYY-MM-DD, see getExpenseLineDate */
  date: string | null;
  categoryId: string | null;
  /** "Hạng mục lớn" of the line (groups lines without a budget category) */
  hangMucLon: string | null;
  plannedBeforeVat: number;
  plannedAfterVat: number;
  actualBeforeVat: number;
  actualAfterVat: number;
  /** legacy records only: overhead part of actual */
  overhead: number;
}

/** Flattens a snapshot set into per-line (or per legacy record) cost entries. */
export function toExpenseCostEntries(set: ExpenseSnapshotSet): ExpenseCostEntry[] {
  const entries: ExpenseCostEntry[] = [];
  for (const r of set.snapshots) {
    for (const l of r.lines || []) {
      if (!isActiveExpenseLine(l)) continue;
      const p = getExpenseLinePeriod(l, r);
      entries.push({
        projectId: r.projectId,
        year: p.year,
        month: p.month,
        date: getExpenseLineDate(l, r),
        categoryId: l.categoryId || null,
        hangMucLon: typeof l.hangMucLon === 'string' && l.hangMucLon.trim() ? l.hangMucLon.trim() : null,
        plannedBeforeVat: linePlannedBeforeVat(l),
        plannedAfterVat: linePlannedAfterVat(l),
        actualBeforeVat: lineActualBeforeVat(l),
        actualAfterVat: lineActualAfterVat(l),
        overhead: 0,
      });
    }
  }
  for (const r of set.legacyRecords) {
    const direct = Number(r.directCost || 0);
    const overhead = Number(r.overheadCost || 0);
    if (direct === 0 && overhead === 0) continue;
    entries.push({
      projectId: r.projectId,
      year: r.year,
      month: r.month,
      date: getExpenseLineDate({}, r),
      categoryId: null,
      hangMucLon: null,
      plannedBeforeVat: direct,
      plannedAfterVat: direct,
      actualBeforeVat: direct + overhead,
      actualAfterVat: direct + overhead,
      overhead,
    });
  }
  return entries;
}
