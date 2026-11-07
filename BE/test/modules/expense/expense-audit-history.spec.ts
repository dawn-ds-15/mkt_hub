import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { ExpenseService } from '../../../src/modules/expense/expense.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('Expense Audit History Suite (BE-yeu-cau-expense-audit-9-9-26.md)', () => {
  let service: ExpenseService;
  let mockPrisma: any;
  let mockAudit: any;

  const sampleExpenseRecord = {
    id: 'exp-rec-100',
    projectId: 'proj-100',
    month: 9,
    year: 2026,
    recognizedDate: new Date('2026-09-13T00:00:00.000Z'),
    status: 'draft',
    directCost: new Decimal(100000),
    directNotes: 'Chi phí tiếp khách',
    overheadCost: new Decimal(50000),
    overheadNotes: 'Văn phòng phẩm',
    createdById: 'user-01',
    createdAt: new Date('2026-09-13T08:00:00.000Z'),
    updatedAt: new Date('2026-09-13T08:00:00.000Z'),
    archivedAt: null,
    project: {
      id: 'proj-100',
      name: 'Dự án Alpha',
      status: 'Active',
      cancelledAt: null,
    },
    lines: [
      {
        id: 'line-101',
        expenseId: 'exp-rec-100',
        name: 'Tiếp khách',
        hangMucLon: 'Chào hàng',
        categoryId: 'cat-01',
        status: 'draft',
        recognizedDate: new Date('2026-09-13T00:00:00.000Z'),
        plannedQuantity: 1,
        actualQuantity: 1,
        actualUnitPrice: new Decimal(100000),
        unitPriceBeforeVatSnapshot: new Decimal(100000),
        vatRateSnapshot: new Decimal(0),
        unitPriceAfterVatSnapshot: new Decimal(100000),
        plannedAmount: new Decimal(100000),
        note: '',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      },
    ],
  };

  beforeEach(async () => {
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(sampleExpenseRecord.project),
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
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'line-mock-id',
          ...data,
          actualUnitPrice: new Decimal(100000),
        })),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      expenseAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-created' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      budgetItem: { findFirst: jest.fn().mockResolvedValue(null) },
      budgetCategory: { findFirst: jest.fn().mockResolvedValue(null) },
      annualExpensePlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', year: 2026, status: 'active' }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('1. POST /v1/expenses records a snapshot with action="created"', async () => {
    mockPrisma.expenseRecord.create.mockResolvedValueOnce({
      ...sampleExpenseRecord,
      lines: [],
    });
    mockPrisma.expenseRecord.findFirst.mockResolvedValue(sampleExpenseRecord);

    await service.saveExpense(
      {
        projectId: 'proj-100',
        month: 9,
        year: 2026,
        expenseDate: '2026-09-13',
        lines: [
          {
            name: 'Tiếp khách',
            expenseDate: '2026-09-13',
            actualUnitPrice: 100000,
            quantity: 1,
          },
        ],
      },
      'user-01',
    );

    expect(mockPrisma.expenseAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseId: 'exp-rec-100',
          action: 'created',
          changedBy: 'user-01',
          snapshot: expect.objectContaining({
            id: 'exp-rec-100',
            expenseDate: '2026-09-13',
            lines: expect.arrayContaining([
              expect.objectContaining({
                name: 'Tiếp khách',
                expenseDate: '2026-09-13',
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it('2. PATCH /v1/expenses/:id records a snapshot with action="updated"', async () => {
    mockPrisma.expenseRecord.findFirst.mockResolvedValue(sampleExpenseRecord);
    mockPrisma.expenseRecord.update.mockResolvedValueOnce({
      ...sampleExpenseRecord,
      directNotes: 'Sửa ghi chú trực tiếp',
    });

    await service.updateExpense(
      'exp-rec-100',
      { directNotes: 'Sửa ghi chú trực tiếp' },
      'user-02',
    );

    expect(mockPrisma.expenseAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseId: 'exp-rec-100',
          action: 'updated',
          changedBy: 'user-02',
        }),
      }),
    );
  });

  it('3. POST /v1/expenses/:id/lines records a record-level snapshot with action="updated"', async () => {
    mockPrisma.expenseRecord.findFirst.mockResolvedValue(sampleExpenseRecord);
    mockPrisma.expenseLine.create.mockResolvedValueOnce({
      id: 'line-102',
      expenseId: 'exp-rec-100',
      name: 'Line mới',
      recognizedDate: new Date('2026-09-14T00:00:00.000Z'),
      quantity: 1,
      actualUnitPrice: new Decimal(50000),
    });

    await service.createExpenseLine(
      'exp-rec-100',
      {
        name: 'Line mới',
        expenseDate: '2026-09-14',
        quantity: 1,
        actualUnitPrice: 50000,
      },
      'user-03',
    );

    expect(mockPrisma.expenseAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseId: 'exp-rec-100',
          action: 'updated',
          changedBy: 'user-03',
        }),
      }),
    );
  });

  it('4. PATCH /v1/expenses/lines/:id records a record-level snapshot with action="updated"', async () => {
    mockPrisma.expenseLine.findFirst.mockResolvedValueOnce(sampleExpenseRecord.lines[0]);
    mockPrisma.expenseRecord.findFirst.mockResolvedValue(sampleExpenseRecord);
    mockPrisma.expenseLine.findMany.mockResolvedValueOnce(sampleExpenseRecord.lines);
    mockPrisma.expenseRecord.update.mockResolvedValueOnce(sampleExpenseRecord);
    mockPrisma.expenseLine.update.mockResolvedValueOnce({
      ...sampleExpenseRecord.lines[0],
      name: 'Tên dòng đã sửa',
    });

    await service.updateExpenseLine(
      'line-101',
      { name: 'Tên dòng đã sửa' },
      'user-04',
    );

    expect(mockPrisma.expenseAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseId: 'exp-rec-100',
          action: 'updated',
          changedBy: 'user-04',
        }),
      }),
    );
  });

  it('5. DELETE /v1/expenses/lines/:id records a record-level snapshot with action="updated"', async () => {
    mockPrisma.expenseLine.findFirst.mockResolvedValueOnce({
      ...sampleExpenseRecord.lines[0],
      expense: sampleExpenseRecord,
    });
    mockPrisma.expenseRecord.findFirst.mockResolvedValue(sampleExpenseRecord);
    mockPrisma.expenseLine.findMany.mockResolvedValueOnce([]);
    mockPrisma.expenseRecord.update.mockResolvedValueOnce(sampleExpenseRecord);
    mockPrisma.expenseLine.update.mockResolvedValueOnce({
      ...sampleExpenseRecord.lines[0],
      archivedAt: new Date(),
    });

    await service.deleteExpenseLine('line-101', 'user-05');

    expect(mockPrisma.expenseAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseId: 'exp-rec-100',
          action: 'updated',
          changedBy: 'user-05',
        }),
      }),
    );
  });

  it('6. GET /v1/expenses/:id/history returns versions sorted by at ASC', async () => {
    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce({ id: 'exp-rec-100' });

    mockPrisma.expenseAuditLog.findMany.mockResolvedValueOnce([
      {
        id: 'log_01',
        expenseId: 'exp-rec-100',
        action: 'created',
        at: new Date('2026-09-13T09:00:00.000Z'),
        changedBy: 'user-01',
        expenseDate: new Date('2026-09-13T00:00:00.000Z'),
        user: { name: 'Người dùng 1', email: 'user1@example.com' },
        snapshot: { id: 'exp-rec-100', lines: [{ id: 'line-101' }] },
      },
      {
        id: 'log_02',
        expenseId: 'exp-rec-100',
        action: 'updated',
        at: new Date('2026-09-13T10:30:00.000Z'),
        changedBy: 'user-02',
        expenseDate: new Date('2026-09-13T00:00:00.000Z'),
        user: { name: 'Người dùng 2', email: 'user2@example.com' },
        snapshot: { id: 'exp-rec-100', lines: [{ id: 'line-101' }, { id: 'line-102' }] },
      },
    ]);

    const res = await service.getExpenseHistory('exp-rec-100');
    expect(res.data).toHaveLength(2);
    expect(res.data[0].id).toBe('log_01');
    expect(res.data[0].action).toBe('created');
    expect(res.data[0].changedBy).toBe('Người dùng 1');
    expect(res.data[0].expenseDate).toBe('2026-09-13');
    expect(res.data[1].id).toBe('log_02');
    expect(res.data[1].action).toBe('updated');
    expect(res.data[1].changedBy).toBe('Người dùng 2');
    expect(res.data[1].snapshot.lines).toHaveLength(2);
  });

  it('7. GET /v1/expenses/:id/history throws 404 if record does not exist or is soft-deleted', async () => {
    mockPrisma.expenseRecord.findFirst.mockResolvedValueOnce(null);

    await expect(service.getExpenseHistory('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
