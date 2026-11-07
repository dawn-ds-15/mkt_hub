/**
 * Feeds expense-record fixtures (records with embedded `lines`) to a mocked Prisma client the
 * way `loadLatestExpenseSnapshots` reads them: record headers with a line count, then the lines
 * of the chosen snapshots.
 */
export function mockExpenseSnapshots(prisma: any, records: any[]) {
  prisma.expenseRecord.findMany.mockResolvedValue(
    records.map((r) => ({
      ...r,
      _count: { lines: (r.lines || []).filter((l: any) => !l.archivedAt).length },
    })),
  );
  if (!prisma.expenseLine) prisma.expenseLine = {};
  if (!prisma.expenseLine.findMany) prisma.expenseLine.findMany = jest.fn();
  prisma.expenseLine.findMany.mockImplementation(({ where }: any) =>
    Promise.resolve(
      records
        .filter((r) => where?.expenseId?.in?.includes(r.id))
        .flatMap((r) =>
          (r.lines || [])
            .filter((l: any) => !l.archivedAt)
            .map((l: any) => ({ ...l, expenseId: r.id })),
        ),
    ),
  );
}
