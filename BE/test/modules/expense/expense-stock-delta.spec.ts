import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ExpenseService - Inventory Stock Delta Logic', () => {
  let service: ExpenseService;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockPrismaService: any = {
    expenseRecord: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    expenseLine: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('Inventory stock deduction & delta adjustments', () => {
    it('1. (T1) Create new expense line with actualQuantity > 0 -> deducts actualQuantity from batches and creates out transaction', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp_01',
        projectId: 'proj_01',
      });
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({
        id: 'item_A',
        name: 'Túi Tote',
        totalStock: 100,
        avgUnitPrice: new Decimal(50000),
      });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item_A',
        name: 'Túi Tote',
        totalStock: 100,
      });
      mockPrismaService.inventoryBatch.findMany
        .mockResolvedValueOnce([
          { id: 'batch_01', currentStock: 100, unitPrice: new Decimal(50000) },
        ])
        .mockResolvedValueOnce([
          { id: 'batch_01', currentStock: 90, unitPrice: new Decimal(50000) },
        ]);

      mockPrismaService.expenseLine.create.mockImplementation(({ data }: any) => ({
        id: 'line_01',
        ...data,
      }));

      const res = await service.createExpenseLine(
        'exp_01',
        {
          name: 'Túi Tote',
          inventoryItemId: 'item_A',
          plannedQuantity: 10,
          actualQuantity: 10,
        },
        'user_01',
      );

      // Verify batch deducted 10 (new stock = 90)
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_01' },
        data: { currentStock: 90, status: 'active' },
      });

      // Verify out transaction created for 10
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          projectId: 'proj_01',
          type: 'out',
          quantity: 10,
        }),
      });
      expect(res.actualQuantity).toBe(10);
      expect(res.deductedQuantity).toBe(10);
    });

    it('1b. (T2 & T9b - BUG-1 fix) Create expense line with plannedQuantity > 0 and actualQuantity = 0 -> does NOT deduct stock or throw 409 even when plannedQuantity > totalStock', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp_01',
        projectId: 'proj_01',
      });
      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({
        id: 'item_A',
        name: 'Túi Tote',
        totalStock: 100,
        avgUnitPrice: new Decimal(50000),
      });
      mockPrismaService.expenseLine.create.mockImplementation(({ data }: any) => ({
        id: 'line_plan_only',
        ...data,
      }));

      const res = await service.createExpenseLine(
        'exp_01',
        {
          name: 'Túi Tote',
          inventoryItemId: 'item_A',
          plannedQuantity: 500,
          actualQuantity: 0,
          plannedAmount: 25000000,
        },
        'user_01',
      );

      expect(mockPrismaService.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryTransaction.create).not.toHaveBeenCalled();
      expect(res.plannedQuantity).toBe(500);
      expect(res.actualQuantity).toBe(0);
      expect(res.deductedQuantity).toBe(0);
      expect(res.totalAmount).toBe(0);
      expect(res.plannedAmount).toBe(25000000);
    });

    it('2. Update line: Increase quantity (50 -> 60) -> deducts delta (+10) from stock', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_01',
        expenseId: 'exp_01',
        inventoryItemId: 'item_A',
        plannedQuantity: 50,
        actualQuantity: 50,
        expense: { projectId: 'proj_01' },
      });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item_A',
        name: 'Item A',
        totalStock: 450,
      });
      mockPrismaService.inventoryBatch.findMany
        .mockResolvedValueOnce([
          { id: 'batch_01', currentStock: 450, unitPrice: new Decimal(10000) },
        ])
        .mockResolvedValueOnce([
          { id: 'batch_01', currentStock: 440, unitPrice: new Decimal(10000) },
        ]);
      mockPrismaService.expenseLine.update.mockResolvedValue({
        id: 'line_01',
        actualQuantity: 60,
      });

      await service.updateExpenseLine(
        'line_01',
        { actualQuantity: 60 },
        'user_01',
      );

      // Delta is +10: batch updated with -10 (450 -> 440)
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_01' },
        data: { currentStock: 440, status: 'active' },
      });
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'out',
          quantity: 10,
        }),
      });
    });

    it('3. Update line: Decrease quantity (60 -> 40) -> returns delta (20) back to stock', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_01',
        expenseId: 'exp_01',
        inventoryItemId: 'item_A',
        plannedQuantity: 60,
        actualQuantity: 60,
        expense: { projectId: 'proj_01' },
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_01',
        currentStock: 440,
        unitPrice: new Decimal(10000),
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch_01', currentStock: 460, unitPrice: new Decimal(10000) },
      ]);
      mockPrismaService.expenseLine.update.mockResolvedValue({
        id: 'line_01',
        actualQuantity: 40,
      });

      await service.updateExpenseLine(
        'line_01',
        { actualQuantity: 40 },
        'user_01',
      );

      // Delta is -20: batch returned 20 (440 -> 460)
      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_01' },
        data: { currentStock: 460, status: 'active' },
      });
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 20,
        }),
      });
    });

    it('4. Update line: Switch from item A (50) to item B (60) -> returns 50 to A and deducts 60 from B', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_01',
        expenseId: 'exp_01',
        inventoryItemId: 'item_A',
        plannedQuantity: 50,
        actualQuantity: 50,
        expense: { projectId: 'proj_01' },
      });
      // Item A return
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_A',
        currentStock: 100,
        unitPrice: new Decimal(10000),
      });
      mockPrismaService.inventoryBatch.findMany
        .mockResolvedValueOnce([{ id: 'batch_A', currentStock: 150, unitPrice: new Decimal(10000) }])
        // Item B deduct
        .mockResolvedValueOnce([{ id: 'batch_B', currentStock: 200, unitPrice: new Decimal(15000) }])
        .mockResolvedValueOnce([{ id: 'batch_B', currentStock: 140, unitPrice: new Decimal(15000) }]);

      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item_B',
        name: 'Item B',
        totalStock: 200,
      });

      mockPrismaService.expenseLine.update.mockResolvedValue({
        id: 'line_01',
        inventoryItemId: 'item_B',
        actualQuantity: 60,
      });

      await service.updateExpenseLine(
        'line_01',
        { inventoryItemId: 'item_B', actualQuantity: 60 },
        'user_01',
      );

      // Verify item A returned 50
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 50,
        }),
      });

      // Verify item B deducted 60
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_B',
          type: 'out',
          quantity: 60,
        }),
      });
    });

    it('5. Delete line -> returns full quantity to inventory stock', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_01',
        expenseId: 'exp_01',
        inventoryItemId: 'item_A',
        plannedQuantity: 20,
        actualQuantity: 20,
        expense: { projectId: 'proj_01' },
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_01',
        currentStock: 80,
        unitPrice: new Decimal(10000),
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch_01', currentStock: 100, unitPrice: new Decimal(10000) },
      ]);
      mockPrismaService.expenseLine.update.mockResolvedValue({
        id: 'line_01',
        archivedAt: new Date(),
      });

      await service.deleteExpenseLine('line_01', 'user_01');

      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 20,
        }),
      });
    });

    it('6. Delete entire expense record (removeExpense) -> returns stock for all linked lines', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp_01',
        projectId: 'proj_01',
        lines: [
          {
            id: 'line_01',
            inventoryItemId: 'item_A',
            actualQuantity: 15,
            plannedQuantity: 15,
          },
          {
            id: 'line_02',
            inventoryItemId: 'item_B',
            actualQuantity: 25,
            plannedQuantity: 25,
          },
          {
            id: 'line_03',
            inventoryItemId: null, // custom line
            actualQuantity: 5,
            plannedQuantity: 5,
          },
        ],
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_01',
        currentStock: 50,
        unitPrice: new Decimal(10000),
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch_01', currentStock: 65, unitPrice: new Decimal(10000) },
      ]);
      mockPrismaService.expenseLine.update.mockResolvedValue({});
      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      await service.removeExpense('exp_01', 'user_01');

      // Verify return for line 1 (item A: 15)
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 15,
        }),
      });

      // Verify return for line 2 (item B: 25)
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_B',
          type: 'in',
          quantity: 25,
        }),
      });

      // Verify expenseRecord soft-deleted
      expect(mockPrismaService.expenseRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exp_01' },
          data: expect.objectContaining({
            archivedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('7. (T3 - BUG-2 fix) Two POST /v1/expenses/:id/lines with the same inventoryItemId create 2 separate lines and deduct stock cumulatively (10 + 5 = 15)', async () => {
      let currentStock = 100;
      const createdLines: any[] = [];
      const transactions: any[] = [];

      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp_t3',
        projectId: 'proj_t3',
      });
      mockPrismaService.inventoryItem.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: 'item_A',
          name: 'POSM A',
          totalStock: currentStock,
          avgUnitPrice: new Decimal(50000),
        }),
      );
      mockPrismaService.inventoryItem.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 'item_A',
          name: 'POSM A',
          totalStock: currentStock,
        }),
      );
      mockPrismaService.inventoryBatch.findMany.mockImplementation(() =>
        Promise.resolve([
          { id: 'batch_01', currentStock, unitPrice: new Decimal(50000) },
        ]),
      );
      mockPrismaService.inventoryBatch.update.mockImplementation(({ data }: any) => {
        currentStock = data.currentStock;
        return Promise.resolve({ id: 'batch_01', currentStock });
      });
      mockPrismaService.inventoryTransaction.create.mockImplementation(({ data }: any) => {
        const txRec = { id: `tx_${transactions.length + 1}`, ...data };
        transactions.push(txRec);
        return Promise.resolve(txRec);
      });
      mockPrismaService.expenseLine.create.mockImplementation(({ data }: any) => {
        const rec = { id: `line_${createdLines.length + 1}`, ...data };
        createdLines.push(rec);
        return Promise.resolve(rec);
      });

      const line1 = await service.createExpenseLine(
        'exp_t3',
        {
          name: 'Đợt 1',
          inventoryItemId: 'item_A',
          plannedQuantity: 10,
          actualQuantity: 10,
        },
        'user_01',
      );

      const line2 = await service.createExpenseLine(
        'exp_t3',
        {
          name: 'Đợt 2',
          inventoryItemId: 'item_A',
          plannedQuantity: 5,
          actualQuantity: 5,
        },
        'user_01',
      );

      expect(line1.id).not.toBe(line2.id);
      expect(createdLines).toHaveLength(2);
      expect(currentStock).toBe(85);
      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toMatchObject({ type: 'out', quantity: 10 });
      expect(transactions[1]).toMatchObject({ type: 'out', quantity: 5 });
      expect(mockPrismaService.expenseLine.update).not.toHaveBeenCalled();
    });

    it('8. (T5 - BUG-1 fix) PATCH line actualQuantity from 10 -> 0 (while plannedQuantity = 10) returns 10 to stock (90 -> 100)', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_t5',
        expenseId: 'exp_01',
        inventoryItemId: 'item_A',
        plannedQuantity: 10,
        actualQuantity: 10,
        deductedQuantity: 10,
        expense: { projectId: 'proj_01' },
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_01',
        currentStock: 90,
        unitPrice: new Decimal(50000),
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch_01', currentStock: 100, unitPrice: new Decimal(50000) },
      ]);
      mockPrismaService.expenseLine.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'line_t5',
          expenseId: 'exp_01',
          inventoryItemId: 'item_A',
          plannedQuantity: 10,
          ...data,
        }),
      );

      const updated = await service.updateExpenseLine(
        'line_t5',
        { actualQuantity: 0 },
        'user_01',
      );

      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_01' },
        data: { currentStock: 100, status: 'active' },
      });
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 10,
          note: 'Hoàn kho từ dòng chi phí',
        }),
      });
      expect(updated.actualQuantity).toBe(0);
      expect(updated.deductedQuantity).toBe(0);
    });

    it('9. (T10 - Idempotency & Concurrency) Parallel POST /v1/expenses/:id/lines with same Idempotency-Key creates 1 line (-10), while parallel POST without key creates 2 lines (-20) atomically', async () => {
      let currentStock = 100;
      let lineCounter = 0;

      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp_t10',
        projectId: 'proj_t10',
      });
      mockPrismaService.inventoryItem.findFirst.mockImplementation(async () => ({
        id: 'item_A',
        name: 'POSM T10',
        totalStock: currentStock,
        avgUnitPrice: new Decimal(50000),
      }));
      mockPrismaService.inventoryItem.findUnique.mockImplementation(async () => ({
        id: 'item_A',
        name: 'POSM T10',
        totalStock: currentStock,
      }));
      mockPrismaService.inventoryBatch.findMany.mockImplementation(async () => [
        { id: 'batch_01', currentStock, unitPrice: new Decimal(50000) },
      ]);
      mockPrismaService.inventoryBatch.update.mockImplementation(async ({ data }: any) => {
        // Simulate async DB delay to expose any race condition if not locked
        await new Promise((r) => setTimeout(r, 10));
        currentStock = data.currentStock;
        return { id: 'batch_01', currentStock };
      });
      mockPrismaService.inventoryTransaction.create.mockImplementation(async ({ data }: any) => ({
        id: `tx_${Date.now()}`,
        ...data,
      }));
      mockPrismaService.expenseLine.create.mockImplementation(async ({ data }: any) => {
        lineCounter += 1;
        return {
          id: `line_t10_${lineCounter}`,
          ...data,
        };
      });

      // Part A: Same idempotencyKey in Promise.all -> only 1 line created, stock 100 -> 90
      const [dup1, dup2] = await Promise.all([
        service.createExpenseLine(
          'exp_t10',
          {
            name: 'Idempotent Line',
            inventoryItemId: 'item_A',
            plannedQuantity: 10,
            actualQuantity: 10,
            idempotencyKey: 'idem-key-001',
          },
          'user_01',
        ),
        service.createExpenseLine(
          'exp_t10',
          {
            name: 'Idempotent Line',
            inventoryItemId: 'item_A',
            plannedQuantity: 10,
            actualQuantity: 10,
            idempotencyKey: 'idem-key-001',
          },
          'user_01',
        ),
      ]);

      expect(dup1.id).toBe(dup2.id);
      expect(lineCounter).toBe(1);
      expect(currentStock).toBe(90);

      // Part B: Two parallel requests WITHOUT idempotencyKey in Promise.all -> 2 lines created, stock 90 -> 70 (no lost update)
      const [par1, par2] = await Promise.all([
        service.createExpenseLine(
          'exp_t10',
          {
            name: 'Parallel Line 1',
            inventoryItemId: 'item_A',
            plannedQuantity: 10,
            actualQuantity: 10,
          },
          'user_01',
        ),
        service.createExpenseLine(
          'exp_t10',
          {
            name: 'Parallel Line 2',
            inventoryItemId: 'item_A',
            plannedQuantity: 10,
            actualQuantity: 10,
          },
          'user_01',
        ),
      ]);

      expect(par1.id).not.toBe(par2.id);
      expect(lineCounter).toBe(3);
      expect(currentStock).toBe(70);
    });

    it('10. (Project Snapshot Delta Fix) Saving new project snapshots reconciles previous snapshot stock: 1 -> 10 deducts only delta (+9, total lost = 10 not 11) and 10 -> 1 ("back lại") returns 9 (90 -> 99)', async () => {
      const stocks: Record<string, number> = {
        item_voucher: 80,
        item_haidang: 100,
      };
      const batches: Record<string, { id: string; itemId: string; currentStock: number; unitPrice: Decimal }> = {
        batch_voucher: { id: 'batch_voucher', itemId: 'item_voucher', currentStock: 80, unitPrice: new Decimal(50000) },
        batch_haidang: { id: 'batch_haidang', itemId: 'item_haidang', currentStock: 100, unitPrice: new Decimal(100000) },
      };
      const records: Record<string, any> = {
        snap_1: { id: 'snap_1', projectId: 'proj_test', archivedAt: null, lines: [] },
        snap_2: { id: 'snap_2', projectId: 'proj_test', archivedAt: null, lines: [] },
        snap_3: { id: 'snap_3', projectId: 'proj_test', archivedAt: null, lines: [] },
      };
      const linesById: Record<string, any> = {};
      const txsById: Record<string, any> = {};
      let lineSeq = 0;
      let txSeq = 0;

      mockPrismaService.expenseRecord.findFirst.mockImplementation(async ({ where }: any) => {
        return records[where.id] || null;
      });
      mockPrismaService.expenseRecord.findMany = jest.fn().mockImplementation(async ({ where }: any) => {
        return Object.values(records)
          .filter(
            (r: any) =>
              r.projectId === where.projectId &&
              r.id !== where.id?.not &&
              !r.archivedAt,
          )
          .map((r: any) => ({
            ...r,
            lines: r.lines.filter(
              (l: any) => !l.archivedAt && l.status !== 'cancelled' && l.inventoryItemId,
            ),
          }));
      });
      mockPrismaService.inventoryItem.findFirst.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        name: where.id === 'item_haidang' ? 'Hải Đăng' : 'VOUCHER GIẤY 50.000',
        totalStock: stocks[where.id],
        avgUnitPrice: new Decimal(50000),
      }));
      mockPrismaService.inventoryItem.findUnique.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        name: where.id === 'item_haidang' ? 'Hải Đăng' : 'VOUCHER GIẤY 50.000',
        totalStock: stocks[where.id],
      }));
      mockPrismaService.inventoryItem.update.mockImplementation(async ({ where, data }: any) => {
        stocks[where.id] = data.totalStock;
        return { id: where.id, ...data };
      });
      mockPrismaService.inventoryBatch.findMany.mockImplementation(async ({ where }: any) => {
        const b = where.itemId === 'item_haidang' ? batches.batch_haidang : batches.batch_voucher;
        return [b];
      });
      mockPrismaService.inventoryBatch.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id) {
          return Object.values(batches).find((b) => b.id === where.id) || null;
        }
        return where.itemId === 'item_haidang' ? batches.batch_haidang : batches.batch_voucher;
      });
      mockPrismaService.inventoryBatch.update.mockImplementation(async ({ where, data }: any) => {
        const b = Object.values(batches).find((x) => x.id === where.id)!;
        b.currentStock = data.currentStock;
        return b;
      });
      mockPrismaService.inventoryTransaction.create.mockImplementation(async ({ data }: any) => {
        txSeq += 1;
        const txRec = { id: `tx_${txSeq}`, ...data };
        txsById[txRec.id] = txRec;
        return txRec;
      });
      mockPrismaService.inventoryTransaction.update = jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (txsById[where.id]) {
          Object.assign(txsById[where.id], data);
        }
        return txsById[where.id];
      });
      mockPrismaService.inventoryTransaction.delete = jest.fn().mockImplementation(async ({ where }: any) => {
        delete txsById[where.id];
        return {};
      });
      mockPrismaService.expenseLine.create.mockImplementation(async ({ data }: any) => {
        lineSeq += 1;
        const rec = { id: `line_${lineSeq}`, ...data };
        linesById[rec.id] = rec;
        records[data.expenseId].lines.push(rec);
        return rec;
      });
      mockPrismaService.expenseLine.update.mockImplementation(async ({ where, data }: any) => {
        if (linesById[where.id]) {
          Object.assign(linesById[where.id], data);
        }
        return linesById[where.id];
      });
      mockPrismaService.expenseLine.findMany.mockImplementation(async ({ where }: any) => {
        return records[where.expenseId]?.lines || [];
      });

      // Save #1 (snap_1): VOUCHER = 10 (80 -> 70), Hải Đăng = 1 (100 -> 99)
      await service.createExpenseLine(
        'snap_1',
        { name: 'VOUCHER GIẤY 50.000', inventoryItemId: 'item_voucher', plannedQuantity: 10, actualQuantity: 10 },
        'user_01',
      );
      await service.createExpenseLine(
        'snap_1',
        { name: 'Hải Đăng', inventoryItemId: 'item_haidang', plannedQuantity: 1, actualQuantity: 1 },
        'user_01',
      );
      expect(stocks.item_voucher).toBe(70);
      expect(stocks.item_haidang).toBe(99);

      // Save #2 (snap_2): VOUCHER = 10 (unchanged), Hải Đăng = 1 + 9 = 10 (totalstock must be 90, NOT 89!)
      await service.createExpenseLine(
        'snap_2',
        { name: 'VOUCHER GIẤY 50.000', inventoryItemId: 'item_voucher', plannedQuantity: 10, actualQuantity: 10 },
        'user_01',
      );
      await service.createExpenseLine(
        'snap_2',
        { name: 'Hải Đăng', inventoryItemId: 'item_haidang', plannedQuantity: 1, actualQuantity: 1 },
        'user_01',
      );
      await service.createExpenseLine(
        'snap_2',
        { name: 'Hải Đăng', inventoryItemId: 'item_haidang', plannedQuantity: 9, actualQuantity: 9 },
        'user_01',
      );
      expect(stocks.item_voucher).toBe(70);
      expect(stocks.item_haidang).toBe(90); // Lost 10 total (100 -> 90), NOT 11!
      expect(records.snap_1.lines.every((l: any) => l.deductedQuantity === 0)).toBe(true);

      // Save #3 (snap_3 - "anh back lại"): VOUCHER = 10, Hải Đăng = 1 (returns 9 to stock: 90 -> 99!)
      await service.createExpenseLine(
        'snap_3',
        { name: 'VOUCHER GIẤY 50.000', inventoryItemId: 'item_voucher', plannedQuantity: 10, actualQuantity: 10 },
        'user_01',
      );
      await service.createExpenseLine(
        'snap_3',
        { name: 'Hải Đăng', inventoryItemId: 'item_haidang', plannedQuantity: 1, actualQuantity: 1 },
        'user_01',
      );
      expect(stocks.item_voucher).toBe(70);
      expect(stocks.item_haidang).toBe(99); // Returned 9 (90 -> 99)!
      expect(records.snap_2.lines.every((l: any) => l.deductedQuantity === 0)).toBe(true);
      delete mockPrismaService.expenseRecord.findMany;
    });

    it('11. (Section 20 - Category Change) Updating line hangMucLon from "Vật phẩm" to "Vận chuyển" returns old_actual_quantity and clears inventoryItemId', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line_cat_01',
        expenseId: 'exp_01',
        hangMucLon: 'Vật phẩm',
        inventoryItemId: 'item_A',
        isCustom: false,
        plannedQuantity: 10,
        actualQuantity: 10,
        deductedQuantity: 10,
        expense: { projectId: 'proj_01' },
      });
      mockPrismaService.inventoryBatch.findFirst.mockResolvedValue({
        id: 'batch_01',
        currentStock: 90,
        unitPrice: new Decimal(50000),
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch_01', currentStock: 100, unitPrice: new Decimal(50000) },
      ]);
      mockPrismaService.inventoryBatch.update.mockResolvedValue({});
      mockPrismaService.inventoryItem.update.mockResolvedValue({});
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({ id: 'tx_cat_01' });
      mockPrismaService.expenseLine.update.mockImplementation(async ({ data }: any) => ({
        id: 'line_cat_01',
        expenseId: 'exp_01',
        ...data,
      }));

      const res = await service.updateExpenseLine(
        'line_cat_01',
        {
          hangMucLon: 'Vận chuyển',
          name: 'Cước xe tải',
          actualQuantity: 1,
          actualUnitPrice: 500000,
        },
        'user_01',
      );

      expect(mockPrismaService.inventoryBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_01' },
        data: { currentStock: 100, status: 'active' },
      });
      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'item_A',
          type: 'in',
          quantity: 10,
        }),
      });
      expect(res.inventoryItemId).toBeNull();
      expect(res.deductedQuantity).toBe(0);
      expect(res.isCustom).toBe(true);
      expect(res.hangMucLon).toBe('Vận chuyển');
    });
  });
});
