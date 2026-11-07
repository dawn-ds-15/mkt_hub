import { Decimal } from '@prisma/client/runtime/library';
import {
  getDealPeriodDate,
  lineActualAfterVat,
  lineActualBeforeVat,
  linePlannedAfterVat,
  linePlannedBeforeVat,
  loadLatestExpenseSnapshots,
  resolveLeadSourceProjectIds,
  toExpenseCostEntries,
} from '../../../src/modules/expense/expense-snapshot.util';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';

describe('expense-snapshot.util (BE_requirement_26_09_26 §1)', () => {
  describe('line amounts', () => {
    // 50,000,000 x 1, VAT 8% -> plannedAmount stored after VAT = 54,000,000 (spec §9.5)
    const regular = {
      plannedQuantity: 1,
      actualQuantity: 1,
      unitPriceBeforeVatSnapshot: new Decimal(50000000),
      vatRateSnapshot: new Decimal(8),
      unitPriceAfterVatSnapshot: new Decimal(54000000),
      actualUnitPrice: new Decimal(54000000),
      plannedAmount: new Decimal(54000000),
    };

    it('regular line = unitPriceBeforeVat x quantity', () => {
      expect(linePlannedBeforeVat(regular)).toBe(50000000);
      expect(lineActualBeforeVat(regular)).toBe(50000000);
      expect(linePlannedAfterVat(regular)).toBe(54000000);
      expect(lineActualAfterVat(regular)).toBe(54000000);
    });

    it('uses planned and actual quantities separately', () => {
      const l = { ...regular, plannedQuantity: 3, actualQuantity: 2, plannedAmount: new Decimal(162000000) };
      expect(linePlannedBeforeVat(l)).toBe(150000000);
      expect(lineActualBeforeVat(l)).toBe(100000000);
    });

    it('amount-only line (VAT 0) = plannedAmount / actual amount', () => {
      const l = {
        plannedQuantity: 1,
        actualQuantity: 1,
        unitPriceBeforeVatSnapshot: new Decimal(8000000),
        vatRateSnapshot: new Decimal(0),
        unitPriceAfterVatSnapshot: new Decimal(8000000),
        actualUnitPrice: new Decimal(8000000),
        plannedAmount: new Decimal(10000000),
      };
      expect(linePlannedBeforeVat(l)).toBe(10000000);
      expect(lineActualBeforeVat(l)).toBe(8000000);
    });

    it('planned amount without actual yet', () => {
      const l = {
        plannedQuantity: 0,
        actualQuantity: 0,
        unitPriceBeforeVatSnapshot: new Decimal(0),
        unitPriceAfterVatSnapshot: new Decimal(0),
        actualUnitPrice: new Decimal(0),
        plannedAmount: new Decimal(7000000),
      };
      expect(linePlannedBeforeVat(l)).toBe(7000000);
      expect(lineActualBeforeVat(l)).toBe(0);
    });

    it('explicit after-VAT planned amount on a VAT line is converted back to before VAT', () => {
      const l = { ...regular, plannedQuantity: 1, plannedAmount: new Decimal(108000000) };
      expect(linePlannedBeforeVat(l)).toBe(100000000);
    });

    it('legacy line without price snapshots uses actualUnitPrice', () => {
      const l = { actualQuantity: 2, actualUnitPrice: new Decimal(2500000) };
      expect(lineActualBeforeVat(l)).toBe(5000000);
      expect(lineActualAfterVat(l)).toBe(5000000);
    });
  });

  describe('loadLatestExpenseSnapshots', () => {
    const prisma: any = {
      expenseRecord: { findMany: jest.fn() },
      expenseLine: { findMany: jest.fn() },
    };

    it('keeps only the latest record with lines per project and legacy records of projects without snapshots', async () => {
      mockExpenseSnapshots(prisma, [
        { id: 'a1', projectId: 'A', year: 2026, month: 1, createdAt: new Date('2026-01-01'), lines: [{ id: 'x', recognizedDate: new Date('2026-01-02'), actualQuantity: 1, actualUnitPrice: new Decimal(1) }] },
        { id: 'a2', projectId: 'A', year: 2026, month: 2, createdAt: new Date('2026-02-01'), lines: [{ id: 'y', recognizedDate: new Date('2026-01-02'), actualQuantity: 1, actualUnitPrice: new Decimal(2) }] },
        // newest record of A has no lines -> not a snapshot
        { id: 'a3', projectId: 'A', year: 2026, month: 3, createdAt: new Date('2026-03-01'), directCost: new Decimal(99), lines: [] },
        { id: 'b1', projectId: 'B', year: 2026, month: 4, createdAt: new Date('2026-04-01'), directCost: new Decimal(10), overheadCost: new Decimal(5), lines: [] },
      ]);

      const set = await loadLatestExpenseSnapshots(prisma);
      expect(set.snapshots.map((r) => r.id)).toEqual(['a2']);
      expect(set.snapshots[0].lines.map((l: any) => l.id)).toEqual(['y']);
      expect(set.legacyRecords.map((r) => r.id)).toEqual(['b1']);
      expect(prisma.expenseLine.findMany).toHaveBeenCalledWith({
        where: { expenseId: { in: ['a2'] }, archivedAt: null },
      });

      const entries = toExpenseCostEntries(set);
      expect(entries).toEqual([
        expect.objectContaining({ projectId: 'A', year: 2026, month: 1, actualBeforeVat: 2 }),
        expect.objectContaining({ projectId: 'B', year: 2026, month: 4, actualBeforeVat: 15, overhead: 5 }),
      ]);
    });

    it('filters by project when given', async () => {
      mockExpenseSnapshots(prisma, []);
      await loadLatestExpenseSnapshots(prisma, { projectId: 'A' });
      expect(prisma.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { archivedAt: null, projectId: 'A' } }),
      );
    });
  });

  describe('won deal period date (§3)', () => {
    it('prefers deal.initiationDate, then the opportunity, then closedDate', () => {
      expect(getDealPeriodDate({ initiationDate: new Date('2026-01-05'), closedDate: new Date('2026-03-01') })).toEqual(new Date('2026-01-05'));
      expect(getDealPeriodDate({ initiationDate: null, opportunity: { initiationDate: new Date('2026-02-05') }, closedDate: new Date('2026-03-01') })).toEqual(new Date('2026-02-05'));
      expect(getDealPeriodDate({ closedDate: new Date('2026-03-01') })).toEqual(new Date('2026-03-01'));
      expect(getDealPeriodDate({})).toBeNull();
    });
  });

  describe('resolveLeadSourceProjectIds (§2)', () => {
    it('uses flagged projects when any', async () => {
      const prisma: any = { project: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) } };
      await expect(resolveLeadSourceProjectIds(prisma, [])).resolves.toEqual({ ids: ['p1'], mode: 'configured' });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isLeadSource: true, archivedAt: null } }),
      );
    });

    it('falls back to projects with raw leads, opportunities or won deals', async () => {
      const prisma: any = {
        project: { findMany: jest.fn().mockResolvedValue([]) },
        projectDailyActual: { findMany: jest.fn().mockResolvedValue([{ projectId: 'lead' }]) },
        opportunity: { findMany: jest.fn().mockResolvedValue([{ projectId: 'opp' }, { projectId: 'lead' }]) },
      };
      const res = await resolveLeadSourceProjectIds(prisma, [{ projectId: 'deal' }, { projectId: null }]);
      expect(res.mode).toBe('default');
      expect(res.ids.sort()).toEqual(['deal', 'lead', 'opp']);
    });
  });
});
