import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('Expense Date Flow Acceptance Suite (BE-yeu-cau-9-9-26.md)', () => {
  let service: ExpenseService;
  let mockPrisma: any;
  let mockAudit: any;

  const sampleExpenseRecord = {
    id: 'exp-rec-001',
    projectId: 'proj-001',
    month: 9,
    year: 2026,
    recognizedDate: new Date('2026-09-17T00:00:00.000Z'),
    status: 'draft',
    directCost: new Decimal(0),
    directNotes: null,
    overheadCost: new Decimal(0),
    overheadNotes: null,
    createdById: 'user-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    project: {
      id: 'proj-001',
      name: 'Project Test',
      status: 'Active',
      cancelledAt: null,
    },
    lines: [],
  };

  beforeEach(async () => {
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj-001',
          name: 'Project Test',
          status: 'Active',
          cancelledAt: null,
        }),
      },
      expenseRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      expenseLine: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      budgetItem: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      budgetCategory: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      annualExpensePlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', year: 2026, status: 'active' }),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  // Acceptance Criterion 1:
  // POST lines 2 dòng ngày khác nhau → GET /v1/expenses/:id trả từng line đúng ngày riêng
  it('Criterion 1: POST lines with different dates persists line-specific expenseDate and recognizedDate', async () => {
    const line1DateStr = '2026-09-10';
    const line2DateStr = '2026-09-18';

    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce({
      ...sampleExpenseRecord,
    });

    mockPrisma.expenseLine.findMany.mockResolvedValue([]);
    mockPrisma.expenseLine.create.mockImplementationOnce(({ data }: any) => ({
      id: 'line-001',
      ...data,
      actualUnitPrice: new Decimal(100000),
      plannedAmount: new Decimal(100000),
      unitPriceBeforeVatSnapshot: new Decimal(100000),
      vatRateSnapshot: new Decimal(0),
      unitPriceAfterVatSnapshot: new Decimal(100000),
      recognizedDate: new Date(`${line1DateStr}T00:00:00.000Z`),
    }));

    const resLine1 = await service.createExpenseLine(
      'exp-rec-001',
      {
        name: 'Dòng 1',
        expenseDate: line1DateStr,
        quantity: 1,
        actualUnitPrice: 100000,
      },
      'user-001',
    );

    expect(resLine1.expenseDate).toBe(line1DateStr);
    expect(resLine1.recognizedDate).toBe(line1DateStr);

    // Create line 2
    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce({
      ...sampleExpenseRecord,
    });
    mockPrisma.expenseLine.create.mockImplementationOnce(({ data }: any) => ({
      id: 'line-002',
      ...data,
      actualUnitPrice: new Decimal(200000),
      plannedAmount: new Decimal(200000),
      unitPriceBeforeVatSnapshot: new Decimal(200000),
      vatRateSnapshot: new Decimal(0),
      unitPriceAfterVatSnapshot: new Decimal(200000),
      recognizedDate: new Date(`${line2DateStr}T00:00:00.000Z`),
    }));

    const resLine2 = await service.createExpenseLine(
      'exp-rec-001',
      {
        name: 'Dòng 2',
        expenseDate: line2DateStr,
        quantity: 1,
        actualUnitPrice: 200000,
      },
      'user-001',
    );

    expect(resLine2.expenseDate).toBe(line2DateStr);
    expect(resLine2.recognizedDate).toBe(line2DateStr);

    // When GET /v1/expenses/:id
    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce({
      ...sampleExpenseRecord,
      lines: [
        {
          id: 'line-001',
          name: 'Dòng 1',
          expenseId: 'exp-rec-001',
          status: 'draft',
          recognizedDate: new Date(`${line1DateStr}T00:00:00.000Z`),
          quantity: 1,
          actualUnitPrice: new Decimal(100000),
        },
        {
          id: 'line-002',
          name: 'Dòng 2',
          expenseId: 'exp-rec-001',
          status: 'draft',
          recognizedDate: new Date(`${line2DateStr}T00:00:00.000Z`),
          quantity: 1,
          actualUnitPrice: new Decimal(200000),
        },
      ],
    });

    const fullRecord = await service.getExpense('exp-rec-001');
    expect(fullRecord.lines).toHaveLength(2);
    expect(fullRecord.lines[0].expenseDate).toBe(line1DateStr);
    expect(fullRecord.lines[1].expenseDate).toBe(line2DateStr);
  });

  // Acceptance Criterion 2:
  // PATCH lines đổi ngày dòng A → GET vẫn giữ ngày dòng B cũ; record không đổi
  it('Criterion 2: PATCH line A date updates only line A; line B remains intact and record is not modified', async () => {
    const line1OriginalDate = '2026-09-10';
    const line2OriginalDate = '2026-09-18';
    const line1NewDate = '2026-09-15';

    const existingLineA = {
      id: 'line-001',
      expenseId: 'exp-rec-001',
      name: 'Dòng A',
      status: 'draft',
      recognizedDate: new Date(`${line1OriginalDate}T00:00:00.000Z`),
      actualUnitPrice: new Decimal(100000),
      quantity: 1,
      expense: { projectId: 'proj-001' },
    };

    mockPrisma.expenseLine.findFirst.mockResolvedValueOnce(existingLineA);
    mockPrisma.expenseLine.findMany.mockResolvedValueOnce([]); // for recalculateDirectCost
    mockPrisma.expenseRecord.update.mockResolvedValueOnce({}); // for recalculateDirectCost
    mockPrisma.expenseLine.update.mockImplementationOnce(({ data }: any) => ({
      ...existingLineA,
      recognizedDate: data.recognizedDate,
    }));

    const updateRes = await service.updateExpenseLine(
      'line-001',
      { expenseDate: line1NewDate },
      'user-001',
    );

    expect(updateRes.expenseDate).toBe(line1NewDate);
    expect(updateRes.recognizedDate).toBe(line1NewDate);

    // Confirm that expenseRecord.update was NOT called to modify recognizedDate
    expect(mockPrisma.expenseRecord.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recognizedDate: expect.anything() }),
      }),
    );
  });

  // Acceptance Criterion 3:
  // PATCH /v1/expenses/:id record ngày mới nhất → ngày từng line KHÔNG bị đè về ngày record
  it('Criterion 3: PATCH /v1/expenses/:id does NOT overwrite lines recognizedDate', async () => {
    const line1Date = '2026-09-10';
    const line2Date = '2026-09-18';
    const newRecordDate = '2026-09-25';

    const existingRecord = {
      ...sampleExpenseRecord,
      lines: [
        {
          id: 'line-001',
          name: 'Dòng 1',
          status: 'draft',
          recognizedDate: new Date(`${line1Date}T00:00:00.000Z`),
          quantity: 1,
          actualUnitPrice: new Decimal(100000),
        },
        {
          id: 'line-002',
          name: 'Dòng 2',
          status: 'draft',
          recognizedDate: new Date(`${line2Date}T00:00:00.000Z`),
          quantity: 1,
          actualUnitPrice: new Decimal(200000),
        },
      ],
    };

    mockPrisma.expenseRecord.findFirst.mockResolvedValue(existingRecord);
    mockPrisma.expenseRecord.update.mockResolvedValueOnce({
      ...existingRecord,
      recognizedDate: new Date(`${newRecordDate}T00:00:00.000Z`),
    });

    await service.updateExpense('exp-rec-001', {
      expenseDate: newRecordDate,
    }, 'user-001');

    // CRITICAL ASSERTION: expenseLine.updateMany must NEVER be called to overwrite line dates
    expect(mockPrisma.expenseLine.updateMany).not.toHaveBeenCalled();
  });

  // Acceptance Criterion 4:
  // GET /v1/expenses (có projectId) vẫn trả lines[] đủ ngày format YYYY-MM-DD
  it('Criterion 4: GET /v1/expenses returns lines[] with YYYY-MM-DD expenseDate and recognizedDate', async () => {
    mockPrisma.expenseRecord.findMany.mockResolvedValueOnce([
      {
        ...sampleExpenseRecord,
        lines: [
          {
            id: 'line-001',
            name: 'Test Line',
            hangMucLon: 'Chào hàng',
            categoryId: 'cat_01',
            status: 'draft',
            recognizedDate: new Date('2026-09-17T00:00:00.000Z'),
            plannedQuantity: 1,
            actualQuantity: 1,
            vatRateSnapshot: new Decimal(5),
            unitPriceBeforeVatSnapshot: new Decimal(100000),
            unitPriceAfterVatSnapshot: new Decimal(105000),
            note: 'Ghi chú',
          },
        ],
      },
    ]);
    mockPrisma.expenseRecord.count = jest.fn().mockResolvedValue(1);

    const result = await service.getExpenses('proj-001');
    expect(result).toHaveLength(1);
    const line = result[0].lines[0];
    expect(line.expenseDate).toBe('2026-09-17');
    expect(line.recognizedDate).toBe('2026-09-17');
    expect(line.hangMucLon).toBe('Chào hàng');
    expect(line.unitPriceBeforeVat).toBe(100000);
    expect(line.unitPriceAfterVat).toBe(105000);
  });

  // Acceptance Criterion 5:
  // Cột "Ngày phát sinh" bản ghi = ngày lớn nhất trong các line khi record chưa có ngày cố định
  it('Criterion 5: formatExpense falls back record date to max line date when record date is null', () => {
    const expenseWithNoDate = {
      id: 'exp-rec-empty-date',
      recognizedDate: null,
      directCost: new Decimal(0),
      overheadCost: new Decimal(0),
      lines: [
        {
          id: 'line-1',
          recognizedDate: new Date('2026-09-10T00:00:00.000Z'),
        },
        {
          id: 'line-2',
          recognizedDate: new Date('2026-09-22T00:00:00.000Z'),
        },
        {
          id: 'line-3',
          recognizedDate: new Date('2026-09-15T00:00:00.000Z'),
        },
      ],
    };

    const formatted = service.formatExpense(expenseWithNoDate);
    expect(formatted.expenseDate).toBe('2026-09-22');
    expect(formatted.recognizedDate).toBe('2026-09-22');
  });

  // Acceptance Criterion 6:
  // Audit history: snapshot so với bản trước đúng expenseDate từng dòng
  it('Criterion 6: Audit log snapshots include line-specific expenseDate and recognizedDate', async () => {
    const lineDate = '2026-09-19';

    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce(sampleExpenseRecord);
    mockPrisma.expenseLine.findMany.mockResolvedValueOnce([]);
    mockPrisma.expenseLine.create.mockImplementationOnce(({ data }: any) => ({
      id: 'line-audit-01',
      ...data,
      actualUnitPrice: new Decimal(50000),
      plannedAmount: new Decimal(50000),
      unitPriceBeforeVatSnapshot: new Decimal(50000),
      vatRateSnapshot: new Decimal(0),
      unitPriceAfterVatSnapshot: new Decimal(50000),
      recognizedDate: new Date(`${lineDate}T00:00:00.000Z`),
    }));

    await service.createExpenseLine(
      'exp-rec-001',
      {
        name: 'Dòng Audit',
        expenseDate: lineDate,
        quantity: 1,
        actualUnitPrice: 50000,
      },
      'user-001',
    );

    // Verify auditService.log received formatted line snapshot with line-specific date
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'ExpenseLine',
        entityId: 'line-audit-01',
        newValue: expect.objectContaining({
          expenseDate: lineDate,
          recognizedDate: lineDate,
        }),
      }),
    );
  });
});
