import { Test, TestingModule } from '@nestjs/testing';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ExpenseService', () => {
  let service: ExpenseService;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockPrismaService = {
    systemConfig: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    closedDeal: {
      findMany: jest.fn(),
    },
    expenseRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    expenseLine: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    budgetItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    budgetSubcategory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    budgetCategory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  // project.findMany serves active projects and the isLeadSource lookup
  const mockLeadProjects = (projects: any[]) => {
    mockPrismaService.project.findMany.mockImplementation(({ where }: any = {}) =>
      Promise.resolve(
        where?.isLeadSource ? projects.filter((p) => p.isLeadSource) : projects,
      ),
    );
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
    jest.clearAllMocks();
  });

  describe('Health Check Status Ratios', () => {
    it('should return red for LTV:CAC < 1.5', () => {
      const status = service.getHealthStatus(1.2);
      expect(status.visual).toBe('red');
    });

    it('should return yellow for 1.5 <= LTV:CAC <= 2.5', () => {
      const status = service.getHealthStatus(2.0);
      expect(status.visual).toBe('yellow');
    });

    it('should return green for 2.5 < LTV:CAC <= 4.0', () => {
      const status = service.getHealthStatus(3.2);
      expect(status.visual).toBe('green');
    });

    it('should return blue for LTV:CAC > 4.0', () => {
      const status = service.getHealthStatus(4.5);
      expect(status.visual).toBe('blue');
    });
  });

  describe('Overview Calculations (CAC & LTV)', () => {
    it('should return roas = 0, cac = null when period has expense but no closed deals (wonCount = 0)', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockLeadProjects([{ id: 'p1', name: 'P1', type: 'webinar', isLeadSource: true }]);
      mockExpenseSnapshots(mockPrismaService, [
        { id: 'r1', year: 2026, month: 6, directCost: new Decimal(50000), overheadCost: new Decimal(10000), projectId: 'p1', lines: [] },
      ]);

      const result = await service.getOverview('2026-06');
      expect(result.metrics.wonCount).toBe(0);
      expect(result.metrics.wonValue).toBe(0);
      expect(result.metrics.totalExpense).toBe(60000);
      expect(result.metrics.cac).toBeNull();
      // same as the kpi-cards ROAS card (req 29-09 follow-up)
      expect(result.metrics.roas).toBe(0);
      expect(result.metrics.roa).toBe(0);
      expect(result.metrics.ltv).toBe(0);
      expect(result.metrics.ltvCacRatio).toBeNull();
    });

    it('should keep roas = null when the period has no lead cost', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { setupFee: new Decimal(100), monthlyFee: new Decimal(0), closedDate: new Date('2026-06-15') },
      ]);
      mockLeadProjects([{ id: 'p1', name: 'P1', type: 'webinar', isLeadSource: true }]);
      mockExpenseSnapshots(mockPrismaService, []);

      const result = await service.getOverview('2026-06');
      expect(result.metrics.leadCost).toBe(0);
      expect(result.metrics.roas).toBeNull();
    });

    it('should calculate roas and cac correctly for 2 deals (setupFee 100 + 200) and totalExpense = 150', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { setupFee: new Decimal(100), monthlyFee: new Decimal(0), closedDate: new Date('2026-06-15') },
        { setupFee: new Decimal(200), monthlyFee: new Decimal(0), closedDate: new Date('2026-06-30') },
      ]);
      mockLeadProjects([{ id: 'p1', name: 'P1', type: 'event', isLeadSource: true }]);
      mockExpenseSnapshots(mockPrismaService, [
        { id: 'r1', year: 2026, month: 6, directCost: new Decimal(100), overheadCost: new Decimal(50), projectId: 'p1', lines: [] },
      ]);

      const result = await service.getOverview('2026-06');
      expect(result.metrics.wonCount).toBe(2);
      expect(result.metrics.wonValue).toBe(300); // 100 + 200
      expect(result.metrics.totalExpense).toBe(150); // 100 + 50
      expect(result.metrics.roas).toBe(2); // 300 / 150 = 2
      expect(result.metrics.cac).toBe(75); // 150 / 2 = 75
    });

    it('should calculate CAC and LTV correctly based on rules', async () => {
      // Setup fee avg = 50M, Monthly Fee avg = 5M, Churn Rate = 2%, Gross Margin = 60%
      // LTV = (50M + 5M * (1 / 0.02)) * 0.6 = (50M + 250M) * 0.6 = 180M
      mockPrismaService.systemConfig.findFirst
        .mockResolvedValueOnce({ value: new Decimal(2) }) // Churn Rate
        .mockResolvedValueOnce({ value: new Decimal(60) }); // Gross Margin

      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { setupFee: new Decimal(50000000), monthlyFee: new Decimal(5000000), closedDate: new Date('2026-06-10') },
      ]);

      mockLeadProjects([{ id: 'proj-1', name: 'Proj 1', type: 'webinar', isLeadSource: true }]);
      mockExpenseSnapshots(mockPrismaService, [
        { id: 'r1', year: 2026, month: 6, directCost: new Decimal(50000000), overheadCost: new Decimal(20000000), projectId: 'proj-1', lines: [] },
      ]);

      const result = await service.getOverview('2026-06');
      expect(result.metrics.totalExpense).toBe(70000000);
      expect(result.metrics.wonCount).toBe(1);
      expect(result.metrics.wonValue).toBe(50000000);
      expect(result.metrics.roas).toBeCloseTo(0.71, 2); // 50M / 70M ≈ 0.71
      expect(result.metrics.cac).toBe(70000000); // 70M / 1 deal = 70M
      expect(result.metrics.ltv).toBe(180000000); // 180M
      expect(result.metrics.ltvCacRatio).toBeCloseTo(2.57, 2); // 180M / 70M ≈ 2.57
      expect(result.metrics.health.visual).toBe('green');
      expect(mockPrismaService.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: null,
          }),
        }),
      );
    });

    it('uses only the latest snapshot per project, before-VAT amounts, lead cost and won deals by opportunity start date (§1–§3)', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockLeadProjects([
        { id: 'lead', name: 'LEAD GENERATION 2026', type: 'Digital', isLeadSource: true },
        { id: 'brand', name: 'YEAR END PARTY', type: 'Event', isLeadSource: false },
      ]);
      const line = (id: string, date: string, qty: number, before: number, vat: number, extra: any = {}) => {
        const after = Math.round(before * (1 + vat / 100));
        return {
          id,
          status: 'draft',
          recognizedDate: new Date(date),
          plannedQuantity: qty,
          actualQuantity: qty,
          unitPriceBeforeVatSnapshot: new Decimal(before),
          vatRateSnapshot: new Decimal(vat),
          unitPriceAfterVatSnapshot: new Decimal(after),
          actualUnitPrice: new Decimal(after),
          plannedAmount: new Decimal(qty * after),
          ...extra,
        };
      };
      mockExpenseSnapshots(mockPrismaService, [
        // older snapshot of "lead": must be ignored
        {
          id: 'lead-v1', projectId: 'lead', year: 2026, month: 6, createdAt: new Date('2026-06-01'),
          lines: [line('old', '2026-06-05', 1, 999999, 0)],
        },
        {
          id: 'lead-v2', projectId: 'lead', year: 2026, month: 6, createdAt: new Date('2026-06-20'),
          lines: [
            line('l1', '2026-06-05', 1, 50000000, 8), // 50M before VAT (54M after)
            line('l2', '2026-05-20', 2, 1000000, 10), // May: outside the period
            line('l3', '2026-06-25', 1, 100, 0, { status: 'cancelled' }),
            // amount entered directly: planned 10M, actual 8M (VAT 0)
            line('l4', '2026-06-28', 1, 8000000, 0, { plannedAmount: new Decimal(10000000) }),
          ],
        },
        {
          id: 'brand-v1', projectId: 'brand', year: 2026, month: 6, createdAt: new Date('2026-06-10'),
          lines: [line('b1', '2026-06-15', 3, 1000000, 8)],
        },
      ]);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        // started in June, signed in July -> June
        { projectId: 'lead', setupFee: new Decimal(29000000), monthlyFee: new Decimal(0), closedDate: new Date('2026-07-10'), initiationDate: new Date('2026-06-03') },
        // signed in June but started in April -> not June
        { projectId: 'lead', setupFee: new Decimal(1), monthlyFee: new Decimal(0), closedDate: new Date('2026-06-15'), initiationDate: new Date('2026-04-01') },
        // date comes from the source opportunity
        { projectId: 'lead', setupFee: new Decimal(87000000), monthlyFee: new Decimal(0), closedDate: new Date('2026-08-01'), initiationDate: null, opportunity: { initiationDate: new Date('2026-06-30') } },
      ]);
      (mockPrismaService as any).projectDailyActual = {
        findMany: jest.fn().mockResolvedValue([
          { actualDate: new Date('2026-06-02'), mql: 40, sql: 10 },
          { actualDate: new Date('2026-06-15'), mql: 60, sql: 6 },
          { actualDate: new Date('2026-07-01'), mql: 999, sql: 999 },
        ]),
      };

      try {
        const { metrics, projects } = await service.getOverview('2026-06');

        // lead: 50M + 8M; brand: 3 x 1M (before VAT; May / cancelled / old snapshot excluded)
        expect(metrics.actualTotalBeforeVat).toBe(61000000);
        expect(metrics.totalExpense).toBe(61000000);
        expect(metrics.actualTotalAfterVat).toBe(54000000 + 8000000 + 3240000);
        expect(metrics.leadCost).toBe(58000000);
        expect(metrics.leadSourceMode).toBe('configured');
        expect(metrics.wonCount).toBe(2);
        expect(metrics.wonValue).toBe(116000000);
        expect(metrics.roas).toBe(2); // 116M / 58M
        expect(metrics.cac).toBe(29000000); // 58M / 2
        expect(metrics.mql).toBe(100);
        expect(metrics.sql).toBe(16);
        expect(metrics.cpmql).toBe(580000);
        expect(metrics.cpsql).toBe(3625000);

        const lead = projects.find((p) => p.projectId === 'lead')!;
        expect(lead.actualTotal).toBe(58000000);
        expect(lead.budgetTotal).toBe(60000000); // 50M + 10M planned before VAT
        expect(lead.isLeadSource).toBe(true);
        const brand = projects.find((p) => p.projectId === 'brand')!;
        expect(brand.actualTotal).toBe(3000000);
        expect(brand.isLeadSource).toBe(false);
      } finally {
        delete (mockPrismaService as any).projectDailyActual;
      }
    });
  });

  describe('Overview total and project filter (req 29-09 §3, §4)', () => {
    const records = [
      {
        id: 'r-lead', projectId: 'lead', year: 2026, month: 7, createdAt: new Date('2026-07-10'),
        lines: [{ id: 'l1', recognizedDate: new Date('2026-07-05'), actualQuantity: 1, unitPriceBeforeVatSnapshot: new Decimal(1000), unitPriceAfterVatSnapshot: new Decimal(1100), actualUnitPrice: new Decimal(1100) }],
      },
      {
        id: 'r-other', projectId: 'other', year: 2026, month: 8, createdAt: new Date('2026-08-10'),
        lines: [{ id: 'l2', recognizedDate: new Date('2026-08-05'), actualQuantity: 1, unitPriceBeforeVatSnapshot: new Decimal(4000), unitPriceAfterVatSnapshot: new Decimal(4000), actualUnitPrice: new Decimal(4000) }],
      },
    ];
    const setup = () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockLeadProjects([
        { id: 'lead', name: 'LEAD', type: 'Digital', isLeadSource: true },
        { id: 'other', name: 'OTHER', type: 'Event', isLeadSource: false },
      ]);
      (mockPrismaService.project as any).findFirst = jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(['lead', 'other'].includes(where?.id) ? { id: where.id } : null),
      );
      mockExpenseSnapshots(mockPrismaService, records);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([
        { projectId: 'lead', setupFee: new Decimal(3000), monthlyFee: new Decimal(0), closedDate: new Date('2026-07-20'), initiationDate: new Date('2026-07-01') },
        { projectId: 'other', setupFee: new Decimal(8000), monthlyFee: new Decimal(0), closedDate: new Date('2026-08-20'), initiationDate: new Date('2026-08-01') },
      ]);
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { receivedDate: new Date('2026-08-12'), quantityIn: 2, unitPriceBeforeVat: new Decimal(130), unitPriceAfterVat: new Decimal(143) },
      ]);
    };
    afterEach(() => {
      mockPrismaService.inventoryBatch.findMany.mockReset();
      delete (mockPrismaService.project as any).findFirst;
    });

    it('total actual = project lines + inventory batches booked to a category; lead cost unchanged', async () => {
      setup();
      const { metrics } = await service.getOverview('2026-Q3');
      expect(metrics.actualTotalBeforeVat).toBe(1000 + 4000 + 260);
      expect(metrics.totalExpense).toBe(5260);
      expect(metrics.actualTotalAfterVat).toBe(1100 + 4000 + 286);
      expect(metrics.inventoryCategoryCost).toBe(260);
      expect(metrics.leadCost).toBe(1000);
      expect(metrics.wonCount).toBe(2);
      expect(metrics.cac).toBe(500); // lead cost / won deals of the whole system
      expect(mockPrismaService.inventoryBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ expenseCategoryId: { not: null } }) }),
      );
    });

    it('projectId: cost, won deals and lead cost of that project only', async () => {
      setup();
      const { metrics, projects } = await service.getOverview('2026-Q3', 'other');
      expect(metrics.totalExpense).toBe(4000);
      expect(metrics.inventoryCategoryCost).toBe(0);
      expect(metrics.leadCost).toBe(4000);
      expect(metrics.wonCount).toBe(1);
      expect(metrics.cac).toBe(4000);
      expect(metrics.roas).toBe(2);
      expect(projects.map((p: any) => p.projectId)).toEqual(['other']);
    });

    it('projectId of an unknown project -> 404', async () => {
      setup();
      await expect(service.getOverview('2026-Q3', 'nope')).rejects.toThrow('Dự án không tồn tại.');
    });
  });

  describe('updateExpense', () => {
    it('should throw NotFoundException if expense record is not found', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue(null);
      await expect(service.updateExpense('exp-1', { directCost: 100 }, 'user-1')).rejects.toThrow(
        'Không tìm thấy bản ghi chi phí.',
      );
    });

    it('should update expense record successfully', async () => {
      const existing = {
        id: 'exp-1',
        projectId: 'proj-1',
        month: 6,
        year: 2026,
        directCost: new Decimal(50000),
        directNotes: 'old note',
        overheadCost: new Decimal(10000),
        overheadNotes: 'overhead',
        archivedAt: null,
        lines: [],
      };
      const updated = {
        ...existing,
        directCost: new Decimal(100000),
        directNotes: 'new note',
        lines: [],
      };
      mockPrismaService.expenseRecord.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated)
        .mockResolvedValueOnce(updated);
      mockPrismaService.expenseRecord.update.mockResolvedValue(updated);

      const result = await service.updateExpense(
        'exp-1',
        { directCost: 100000, directNotes: 'new note' },
        'user-1',
      );

      expect(mockPrismaService.expenseRecord.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({
          directCost: new Decimal(100000),
          directNotes: 'new note',
        }),
      });
      expect(result.directNotes).toBe('new note');
    });
  });

  describe('saveExpense (Multiple records per period)', () => {
    it('should create a new expense record with unique ID for (projectId, month, year)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        status: 'Active',
      });
      const createdRecord = {
        id: 'exp-new-1',
        projectId: 'proj-1',
        month: 8,
        year: 2026,
        directCost: new Decimal(2000000),
        overheadCost: new Decimal(0),
        lines: [],
      };
      mockPrismaService.expenseRecord.findFirst.mockResolvedValueOnce(createdRecord);
      mockPrismaService.expenseRecord.create.mockResolvedValue(createdRecord);

      const result = await service.saveExpense(
        {
          projectId: 'proj-1',
          month: 8,
          year: 2026,
          directCost: 2000000,
          directNotes: 'Chạy ads',
        },
        'user-1',
      );

      expect(mockPrismaService.expenseRecord.create).toHaveBeenCalled();
      expect(result.id).toBe('exp-new-1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create' }),
      );
    });

    it('should always create a new expense record even if one exists for the same period', async () => {
      const createdRecord = {
        id: 'exp-new-2',
        projectId: 'proj-1',
        month: 9,
        year: 2026,
        directCost: new Decimal(5000),
        directNotes: 'mới',
        overheadCost: new Decimal(0),
        overheadNotes: '',
        lines: [],
      };
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        status: 'Active',
      });
      mockPrismaService.expenseRecord.findFirst.mockResolvedValueOnce(createdRecord);
      mockPrismaService.expenseRecord.create.mockResolvedValue(createdRecord);

      const result = await service.saveExpense(
        {
          projectId: 'proj-1',
          month: 9,
          year: 2026,
          directCost: 5000,
          directNotes: 'mới',
        },
        'user-1',
      );

      expect(mockPrismaService.expenseRecord.create).toHaveBeenCalled();
      expect(mockPrismaService.expenseRecord.update).not.toHaveBeenCalled();
      expect(result.id).toBe('exp-new-2');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create' }),
      );
    });
  });

  describe('getExpenses', () => {
    it('should retrieve non-archived expenses ordered by newest', async () => {
      const records = [
        { id: 'exp-1', projectId: 'proj-1', month: 8, year: 2026 },
        { id: 'exp-2', projectId: 'proj-1', month: 8, year: 2026 },
      ];
      mockPrismaService.expenseRecord.findMany.mockResolvedValue(records);

      const result = await service.getExpenses('proj-1');
      expect(result).toHaveLength(2);
      expect(mockPrismaService.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { archivedAt: null, projectId: 'proj-1' },
          orderBy: [
            { recognizedDate: 'desc' },
            { createdAt: 'desc' },
            { year: 'desc' },
            { month: 'desc' },
          ],
        }),
      );
    });
  });

  describe('Expense Lines (Mục 4 & 5)', () => {
    it('should create an expense line and recalculate directCost of parent expense', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        month: 8,
        year: 2026,
        archivedAt: null,
      });

      mockPrismaService.expenseLine.create.mockResolvedValue({
        id: 'line-1',
        expenseId: 'exp-1',
        name: 'Chi phí marketing event',
        plannedAmount: new Decimal(10000000),
        actualUnitPrice: new Decimal(9000000),
        quantity: 2,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      });

      mockPrismaService.expenseLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          actualUnitPrice: new Decimal(9000000),
          quantity: 2,
        },
      ]);

      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      const result = await service.createExpenseLine(
        'exp-1',
        {
          name: 'Chi phí marketing event',
          plannedAmount: 10000000,
          actualUnitPrice: 9000000,
          quantity: 2,
        },
        'user-1',
      );

      expect(result.id).toBe('line-1');
      expect(result.totalAmount).toBe(18000000);
      expect(mockPrismaService.expenseRecord.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { directCost: new Decimal(18000000), overheadCost: new Decimal(0) },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'ExpenseLine',
        }),
      );
    });

    it('re-attaches the files of the copied line (attachmentIds) and returns them (req 29-09 §1)', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({ id: 'exp-2', projectId: 'proj-1', month: 9, year: 2026, archivedAt: null });
      mockPrismaService.expenseLine.create.mockResolvedValue({
        id: 'line-new', expenseId: 'exp-2', name: 'In ấn', actualUnitPrice: new Decimal(100), quantity: 1,
        createdAt: new Date(), updatedAt: new Date(), archivedAt: null,
      });
      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({ id: 'line-new', attachmentPath: null, attachmentName: null, attachmentUrl: null });
      mockPrismaService.expenseRecord.update.mockResolvedValue({});
      const rows: any[] = [
        { id: 'a1', lineId: 'line-old', name: 'HĐ.pdf', size: 9, mimeType: 'application/pdf', filePath: 'uploads/expenses/hd.pdf', archivedAt: null, uploadedAt: new Date('2026-09-01') },
      ];
      (mockPrismaService as any).expenseLineAttachment = {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter(
            (r) =>
              (where.id ? where.id.in.includes(r.id) : true) &&
              (where.lineId === undefined || (where.lineId.in ? where.lineId.in.includes(r.lineId) : r.lineId === where.lineId)) &&
              (where.archivedAt === undefined || r.archivedAt === where.archivedAt),
          ),
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `copy-${rows.length}`, archivedAt: null, ...data };
          rows.push(row);
          return row;
        }),
      };

      try {
        const result: any = await service.createExpenseLine(
          'exp-2',
          { name: 'In ấn', actualUnitPrice: 100, quantity: 1, attachmentIds: ['a1'] } as any,
          'user-1',
          'https://api.test',
        );
        expect(result.attachments).toEqual([
          expect.objectContaining({
            id: 'copy-1',
            lineId: 'line-new',
            name: 'HĐ.pdf',
            url: 'https://api.test/api/v1/expenses/attachments/copy-1/file',
          }),
        ]);
        // same stored file, not copied; the old line keeps its row
        expect(rows.map((r) => [r.lineId, r.filePath])).toEqual([
          ['line-old', 'uploads/expenses/hd.pdf'],
          ['line-new', 'uploads/expenses/hd.pdf'],
        ]);
      } finally {
        delete (mockPrismaService as any).expenseLineAttachment;
        mockPrismaService.expenseLine.findFirst.mockReset();
      }
    });

    it('should soft delete expense line and recalculate directCost', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line-1',
        expenseId: 'exp-1',
        archivedAt: null,
      });

      mockPrismaService.expenseLine.update.mockResolvedValue({
        id: 'line-1',
        archivedAt: new Date(),
      });

      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);

      const result = await service.deleteExpenseLine('line-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockPrismaService.expenseLine.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: expect.objectContaining({
          archivedBy: 'user-1',
        }),
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'ExpenseLine',
        }),
      );
    });

    it('should NOT deduct stock when creating line with plannedQuantity > 0 and actualQuantity = 0 (BUG-1 fix)', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'proj-1',
        archivedAt: null,
      });

      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({
        id: 'item-1',
        name: 'Túi Tote',
        avgUnitPrice: new Decimal(50000),
        archivedAt: null,
      });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({
        id: 'item-1',
        totalStock: 92,
        archivedAt: null,
      });
      mockPrismaService.inventoryBatch.findMany.mockResolvedValue([
        { id: 'batch-1', currentStock: 92, unitPrice: new Decimal(50000) },
      ]);
      mockPrismaService.inventoryBatch.update.mockResolvedValue({});
      mockPrismaService.inventoryTransaction.create.mockResolvedValue({});
      mockPrismaService.expenseLine.findFirst.mockResolvedValue(null);
      mockPrismaService.expenseLine.create.mockResolvedValue({
        id: 'line-plan-1',
        expenseId: 'exp-1',
        name: 'Túi Tote',
        inventoryItemId: 'item-1',
        plannedQuantity: 20,
        actualQuantity: 0,
        deductedQuantity: 0,
        plannedAmount: new Decimal(1000000),
        actualUnitPrice: new Decimal(50000),
        quantity: 0,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      });

      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      const result = await service.createExpenseLine(
        'exp-1',
        {
          name: 'Túi Tote',
          inventoryItemId: 'item-1',
          plannedQuantity: 20,
          actualQuantity: 0,
        },
        'user-1',
      );

      expect(mockPrismaService.inventoryTransaction.create).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryBatch.update).not.toHaveBeenCalled();
      expect(result.plannedQuantity).toBe(20);
      expect(result.actualQuantity).toBe(0);
      expect(result.deductedQuantity).toBe(0);
    });
  });

  describe('parsePeriod and getOverview robustness', () => {
    it('should parse various period formats correctly and safely without NaN', () => {
      expect(service.parsePeriod('2026')).toEqual({ year: 2026, periodType: 'year' });
      expect(service.parsePeriod('2026-')).toEqual({ year: 2026, periodType: 'year' });
      expect(service.parsePeriod('2026-all')).toEqual({ year: 2026, periodType: 'year' });
      expect(service.parsePeriod('2026-09')).toEqual({ year: 2026, periodType: 'month', periodValue: 9 });
      expect(service.parsePeriod('2026-Q3')).toEqual({ year: 2026, periodType: 'quarter', periodValue: 3 });
      
      const defaultParsed = service.parsePeriod(undefined);
      expect(defaultParsed.year).toBeDefined();
      expect(defaultParsed.periodType).toBe('month');
      expect(defaultParsed.periodValue).toBeGreaterThanOrEqual(1);

      const weekParsed = service.parsePeriod('2026-W10');
      expect(weekParsed.year).toBe(2026);
      expect(weekParsed.periodType).toBe('month');
      expect(weekParsed.periodValue).toBeGreaterThanOrEqual(1);
    });

    it('should query expense records without month: NaN in where clause for year period', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.findMany.mockResolvedValue([]);

      await service.getOverview('2026');

      // Latest snapshot per project is chosen across all records; lines are filtered by their own date
      expect(mockPrismaService.expenseRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            archivedAt: null,
          },
        }),
      );
      // month should NOT be NaN or present if year
      const lastCall = mockPrismaService.expenseRecord.findMany.mock.calls.slice(-1)[0][0];
      expect(lastCall.where.month).toBeUndefined();
    });

    it('should query expense records for the year and filter non-archived', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.findMany.mockResolvedValue([]);

      await service.getOverview('2026-05');

      const lastCall = mockPrismaService.expenseRecord.findMany.mock.calls.slice(-1)[0][0];
      expect(lastCall.where.month).toBeUndefined();
      expect(lastCall.where.archivedAt).toBeNull();
    });
  });

  describe('ExpenseLine Improvements (BE-can-sua-8-9-26)', () => {
    it('formatLine should return status draft by default, expenseDate alias, hangMucLon, and categoryName', () => {
      const line = {
        id: 'line-1',
        expenseId: 'exp-1',
        name: 'Test item',
        status: null,
        recognizedDate: new Date('2026-09-04'),
        hangMucLon: 'Hạng mục POSM',
      };
      const formatted = service.formatLine(line);
      expect(formatted.status).toBe('draft');
      expect(formatted.recognizedDate).toBe('2026-09-04');
      expect(formatted.expenseDate).toBe('2026-09-04');
      expect(formatted.hangMucLon).toBe('Hạng mục POSM');
      expect(formatted.categoryName).toBe('Hạng mục POSM');
    });

    it('createExpenseLine should default status to draft, save hangMucLon, and support expenseDate', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'p-1',
        project: { status: 'In Progress' },
      });
      mockPrismaService.expenseLine.findFirst.mockResolvedValue(null);
      mockPrismaService.expenseLine.create.mockImplementation((args) => ({
        id: 'line-created-1',
        ...args.data,
      }));
      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      const result = await service.createExpenseLine(
        'exp-1',
        {
          name: 'Standee',
          hangMucLon: 'POSM & Vật phẩm',
          expenseDate: '2026-09-08',
          actualUnitPrice: 100000,
          quantity: 2,
        } as any,
        'user-1',
      );

      expect(mockPrismaService.expenseLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'draft',
            hangMucLon: 'POSM & Vật phẩm',
            recognizedDate: new Date('2026-09-08'),
            confirmedAt: null,
            confirmedBy: null,
          }),
        }),
      );
      expect(result.status).toBe('draft');
      expect(result.expenseDate).toBe('2026-09-08');
      expect(result.hangMucLon).toBe('POSM & Vật phẩm');
      expect(result.categoryName).toBe('POSM & Vật phẩm');
    });

    it('createExpenseLine should auto-resolve hangMucLon from budgetCategory when only categoryId is given', async () => {
      mockPrismaService.expenseRecord.findFirst.mockResolvedValue({
        id: 'exp-1',
        projectId: 'p-1',
        project: { status: 'In Progress' },
      });
      mockPrismaService.expenseLine.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetItem.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetSubcategory.findFirst.mockResolvedValue(null);
      mockPrismaService.budgetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        name: 'Chi phí Marketing Online',
      });
      mockPrismaService.expenseLine.create.mockImplementation((args) => ({
        id: 'line-created-2',
        ...args.data,
      }));
      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      const result = await service.createExpenseLine(
        'exp-1',
        {
          name: 'Facebook Ads',
          categoryId: 'cat-1',
          expenseDate: '2026-09-05',
          actualUnitPrice: 500000,
          quantity: 1,
        } as any,
        'user-1',
      );

      expect(mockPrismaService.expenseLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'draft',
            hangMucLon: 'Chi phí Marketing Online',
          }),
        }),
      );
      expect(result.hangMucLon).toBe('Chi phí Marketing Online');
    });

    it('updateExpenseLine should allow updating draft line with expenseDate and hangMucLon', async () => {
      mockPrismaService.expenseLine.findFirst.mockResolvedValue({
        id: 'line-draft-1',
        expenseId: 'exp-1',
        status: 'draft',
        projectId: 'p-1',
      });
      mockPrismaService.expenseLine.update.mockImplementation((args) => ({
        id: 'line-draft-1',
        expenseId: 'exp-1',
        status: 'draft',
        ...args.data,
      }));
      mockPrismaService.expenseLine.findMany.mockResolvedValue([]);
      mockPrismaService.expenseRecord.update.mockResolvedValue({});

      const result = await service.updateExpenseLine(
        'line-draft-1',
        {
          expenseDate: '2026-09-10',
          hangMucLon: 'Sự kiện & Hội thảo',
        } as any,
        'user-1',
      );

      expect(mockPrismaService.expenseLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line-draft-1' },
          data: expect.objectContaining({
            recognizedDate: new Date('2026-09-10'),
            hangMucLon: 'Sự kiện & Hội thảo',
          }),
        }),
      );
      expect(result.expenseDate).toBe('2026-09-10');
      expect(result.hangMucLon).toBe('Sự kiện & Hội thảo');
    });
  });

  describe('Rollup Expense Lines (BE_REQUIREMENT_11-09-26)', () => {
    it('formatExpense should rollup directCost from active lines (including draft) and set overheadCost to 0', () => {
      const recordWithLines: any = {
        id: 'exp-rollup-1',
        projectId: 'p-1',
        month: 9,
        year: 2026,
        directCost: new Decimal(5000000), // old manual value
        overheadCost: new Decimal(2000000), // old manual value
        lines: [
          {
            id: 'line-1',
            status: 'draft',
            totalAmount: new Decimal(3000000),
            actualUnitPrice: new Decimal(3000000),
            quantity: 1,
            actualQuantity: 1,
            archivedAt: null,
          },
          {
            id: 'line-2',
            status: 'confirmed',
            totalAmount: new Decimal(4500000),
            actualUnitPrice: new Decimal(1500000),
            quantity: 3,
            actualQuantity: 3,
            archivedAt: null,
          },
          {
            id: 'line-3',
            status: 'cancelled',
            totalAmount: new Decimal(99000000),
            actualUnitPrice: new Decimal(99000000),
            quantity: 1,
            actualQuantity: 1,
            archivedAt: null,
          },
        ],
      };

      const formatted = service.formatExpense(recordWithLines);
      // Cancelled line (99,000,000) excluded, draft (3,000,000) + confirmed (4,500,000) = 7,500,000
      expect(formatted.directCost).toBe(7500000);
      expect(formatted.overheadCost).toBe(0);
    });

    it('formatExpense should preserve manual directCost and overheadCost when no lines exist', () => {
      const recordNoLines: any = {
        id: 'exp-legacy-1',
        projectId: 'p-1',
        month: 8,
        year: 2026,
        directCost: new Decimal(12000000),
        overheadCost: new Decimal(4000000),
        lines: [],
      };

      const formatted = service.formatExpense(recordNoLines);
      expect(formatted.directCost).toBe(12000000);
      expect(formatted.overheadCost).toBe(4000000);
    });
  });

  describe('getReports', () => {
    it('should rollup actual from lines and return 12 months trend and distribution', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.project.findMany.mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Project 1',
          type: 'Event',
          budgetPlanDirect: new Decimal(12000000),
          budgetPlanOverhead: new Decimal(0),
        },
      ]);
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'rec-1',
          projectId: 'proj-1',
          month: 8,
          year: 2026,
          directCost: new Decimal(0),
          overheadCost: new Decimal(0),
          lines: [
            {
              id: 'l-1',
              status: 'draft',
              totalAmount: new Decimal(3000000),
              actualUnitPrice: new Decimal(3000000),
              quantity: 1,
              actualQuantity: 1,
              archivedAt: null,
            },
            {
              id: 'l-2',
              status: 'confirmed',
              totalAmount: new Decimal(5000000),
              actualUnitPrice: new Decimal(5000000),
              quantity: 1,
              actualQuantity: 1,
              archivedAt: null,
            },
            {
              id: 'l-3',
              status: 'cancelled',
              totalAmount: new Decimal(90000000),
              actualUnitPrice: new Decimal(90000000),
              quantity: 1,
              actualQuantity: 1,
              archivedAt: null,
            },
          ],
        },
      ]);

      const report = await service.getReports('2026-08');

      // Overview checks: 3M (draft) + 5M (confirmed), cancelled 90M excluded
      expect(report.overview.metrics.totalExpense).toBe(8000000);
      expect(report.overview.projects).toHaveLength(1);
      expect(report.overview.projects[0].actualTotal).toBe(8000000);
      expect(report.overview.projects[0].actualDirect).toBe(8000000);
      expect(report.overview.projects[0].actualOverhead).toBe(0);
      // For 1 month, budget is scaled: (12M * 1) / 12 = 1,000,000
      expect(report.overview.projects[0].budgetTotal).toBe(1000000);
      expect(report.overview.projects[0].variance).toBe(1000000 - 8000000);

      // Trend check: exactly 12 months for 2026
      expect(report.trend).toHaveLength(12);
      expect(report.trend[0].period).toBe('2026-01');
      expect(report.trend[11].period).toBe('2026-12');

      // Distribution check
      expect(report.distribution).toEqual([
        {
          projectType: 'Event',
          cost: 8000000,
          percentage: 100,
        },
      ]);
    });

    it('should attribute expense lines by recognizedDate/expenseDate across months, quarters, and trend', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockPrismaService.closedDeal.findMany.mockResolvedValue([]);
      mockPrismaService.project.findMany.mockResolvedValue([
        {
          id: 'proj-lead',
          name: 'LEAD',
          type: 'Digital',
          budgetPlanDirect: null,
          budgetPlanOverhead: null,
        },
        {
          id: 'proj-innoex',
          name: 'INNOEX',
          type: 'Event',
          budgetPlanDirect: null,
          budgetPlanOverhead: null,
        },
        {
          id: 'proj-test',
          name: 'test',
          type: 'General',
          budgetPlanDirect: null,
          budgetPlanOverhead: null,
        },
      ]);

      // All records in DB have header month: 9, but lines have different recognizedDate
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'rec-lead',
          projectId: 'proj-lead',
          month: 9,
          year: 2026,
          directCost: new Decimal(0),
          overheadCost: new Decimal(0),
          lines: [
            {
              id: 'l-lead-1',
              status: 'draft',
              recognizedDate: new Date('2026-04-29'),
              actualUnitPrice: new Decimal(16632000),
              plannedAmount: new Decimal(16632000),
              actualQuantity: 1,
              quantity: 1,
              archivedAt: null,
            },
          ],
        },
        {
          id: 'rec-innoex',
          projectId: 'proj-innoex',
          month: 9,
          year: 2026,
          directCost: new Decimal(0),
          overheadCost: new Decimal(0),
          lines: [
            {
              id: 'l-innoex-1',
              status: 'draft',
              recognizedDate: new Date('2026-08-17'),
              actualUnitPrice: new Decimal(8316),
              plannedAmount: new Decimal(2494800),
              actualQuantity: 200,
              quantity: 200,
              archivedAt: null,
            },
          ],
        },
        {
          id: 'rec-test',
          projectId: 'proj-test',
          month: 9,
          year: 2026,
          directCost: new Decimal(0),
          overheadCost: new Decimal(0),
          lines: [
            {
              id: 'l-test-1',
              status: 'draft',
              recognizedDate: new Date('2026-09-10'),
              actualUnitPrice: new Decimal(8316),
              plannedAmount: new Decimal(8316),
              actualQuantity: 1,
              quantity: 1,
              archivedAt: null,
            },
            {
              id: 'l-test-2',
              status: 'draft',
              recognizedDate: new Date('2026-09-10'),
              actualUnitPrice: new Decimal(8316),
              plannedAmount: new Decimal(8316),
              actualQuantity: 1,
              quantity: 1,
              archivedAt: null,
            },
          ],
        },
      ]);

      // 1. Check month 2026-09: only month 9 lines (8316 + 8316 = 16,632)
      const repSep = await service.getReports('2026-09');
      expect(repSep.overview.metrics.totalExpense).toBe(16632);
      expect(repSep.overview.metrics.plannedTotalAfterVat).toBe(16632);

      // 2. Check quarter 2026-Q3: month 8 (1,663,200) + month 9 (16,632) = 1,679,832
      const repQ3 = await service.getReports('2026-Q3');
      expect(repQ3.overview.metrics.totalExpense).toBe(1679832);
      expect(repQ3.overview.metrics.plannedTotalAfterVat).toBe(2494800 + 16632);

      // 3. Check month 2026-04: only month 4 lines (16,632,000)
      const repApr = await service.getReports('2026-04');
      expect(repApr.overview.metrics.totalExpense).toBe(16632000);
      expect(repApr.overview.metrics.plannedTotalAfterVat).toBe(16632000);

      // 4. Check whole year 2026: 16,632,000 + 1,663,200 + 16,632 = 18,311,832
      const repYear = await service.getReports('2026');
      expect(repYear.overview.metrics.totalExpense).toBe(18311832);
      expect(repYear.overview.metrics.plannedTotalAfterVat).toBe(16632000 + 2494800 + 16632);

      // 5. Check trend in 12 months
      expect(repYear.trend[0].totalExpense).toBe(0); // Jan
      expect(repYear.trend[3].totalExpense).toBe(16632000); // Apr
      expect(repYear.trend[7].totalExpense).toBe(1663200); // Aug
      expect(repYear.trend[8].totalExpense).toBe(16632); // Sep
      expect(repYear.trend[11].totalExpense).toBe(0); // Dec
    });

    it('trend (single pass) should equal calling getOverview for each month', async () => {
      mockPrismaService.systemConfig.findFirst.mockResolvedValue(null);
      mockLeadProjects([
        { id: 'p1', name: 'P1', type: 'Event', budgetPlanDirect: null, budgetPlanOverhead: null, isLeadSource: true },
        { id: 'p2', name: 'P2', type: 'Event', budgetPlanDirect: null, budgetPlanOverhead: null, isLeadSource: false },
      ]);
      const deals = [
        { projectId: 'p1', closedDate: new Date(Date.UTC(2026, 1, 10)), setupFee: new Decimal(1000), monthlyFee: new Decimal(10) },
        { projectId: 'p1', closedDate: new Date(Date.UTC(2026, 1, 20)), setupFee: new Decimal(2000), monthlyFee: new Decimal(20) },
        { projectId: 'p1', closedDate: new Date(Date.UTC(2026, 4, 1)), setupFee: new Decimal(3000), monthlyFee: new Decimal(30) }, // boundary Apr/May
        { projectId: 'p1', closedDate: new Date(Date.UTC(2026, 8, 15)), setupFee: new Decimal(4000), monthlyFee: new Decimal(40) },
      ];
      // Won deals are bucketed in memory by their period date (no DB date filter)
      mockPrismaService.closedDeal.findMany.mockResolvedValue(deals);
      mockExpenseSnapshots(mockPrismaService, [
        {
          id: 'r1', projectId: 'p1', month: 2, year: 2026, createdAt: new Date('2026-02-01'),
          directCost: new Decimal(0), overheadCost: new Decimal(0),
          lines: [
            { id: 'a', status: 'draft', expenseDate: new Date('2026-02-05'), actualUnitPrice: new Decimal(7000), actualQuantity: 1, archivedAt: null },
            { id: 'b', status: 'draft', recognizedDate: '2026-05-03', actualUnitPrice: new Decimal(1234), actualQuantity: 1, archivedAt: null },
            { id: 'c', status: 'draft', recognizedDate: new Date('2025-12-30'), actualUnitPrice: new Decimal(999), actualQuantity: 1, archivedAt: null },
            { id: 'd', status: 'draft', actualUnitPrice: new Decimal(50), actualQuantity: 3, archivedAt: null },
            { id: 'e', status: 'cancelled', actualUnitPrice: new Decimal(88888), actualQuantity: 1, archivedAt: null },
          ],
        },
        // legacy record (no lines) of p1: superseded by p1's snapshot
        { id: 'r0', projectId: 'p1', month: 3, year: 2026, createdAt: new Date('2026-01-01'), directCost: new Decimal(111), overheadCost: new Decimal(0), lines: [] },
        // legacy record of a project without snapshots: still counted
        { id: 'r2', projectId: 'p2', month: 9, year: 2026, directCost: new Decimal(500), overheadCost: new Decimal(250), lines: [] },
      ]);

      const report = await service.getReports('2026');

      const expected: any[] = [];
      for (let m = 1; m <= 12; m++) {
        const mStr = `2026-${m.toString().padStart(2, '0')}`;
        const mData = await service.getOverview(mStr);
        expected.push({
          period: mStr,
          totalExpense: mData.metrics.totalExpense,
          leadCost: mData.metrics.leadCost,
          cac: typeof mData.metrics.cac === 'number' ? mData.metrics.cac : 0,
          newCustomers: mData.metrics.newCustomers,
        });
      }

      expect(report.trend).toEqual(expected);
      expect(report.trend[1].totalExpense).toBe(7000 + 150); // Feb: line a + line d (header month)
      expect(report.trend[1].leadCost).toBe(7150);
      expect(report.trend[1].newCustomers).toBe(2);
      expect(report.trend[2].totalExpense).toBe(0); // superseded legacy record of p1
      expect(report.trend[4].totalExpense).toBe(1234);
      expect(report.trend[8].totalExpense).toBe(750); // legacy record of p2
      expect(report.trend[8].leadCost).toBe(0); // p2 is not a lead source
    });
  });
});

