import { Test, TestingModule } from '@nestjs/testing';
import { DataManagementService } from '../../../src/modules/data-management/data-management.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

describe('DataManagementService', () => {
  let service: DataManagementService;

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockPrismaService = {
    member: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    dropdownConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dropdownOption: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    slackConfig: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notificationLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    project: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    opportunity: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    closedDeal: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      deleteMany: jest.fn(),
    },
    expenseRecord: {
      deleteMany: jest.fn(),
    },
    kpiDistribution: {
      deleteMany: jest.fn(),
    },
    weeklyReportLog: {
      deleteMany: jest.fn(),
    },
    kpiPlan: {
      deleteMany: jest.fn(),
    },
    kpiActual: {
      deleteMany: jest.fn(),
    },
    systemConfig: {
      deleteMany: jest.fn(),
    },
    importLog: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    backupLog: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataManagementService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DataManagementService>(DataManagementService);
    jest.clearAllMocks();
  });

  describe('Member Role Constraints', () => {
    it('should throw BadRequestException if member tries to edit own role', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue({ id: 'user-1', role: 'manager', isActive: true });

      await expect(
        service.updateMember('user-1', { role: 'specialist' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if member tries to deactivate themselves', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue({ id: 'user-1', role: 'manager', isActive: true });

      await expect(
        service.updateMember('user-1', { isActive: false }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sandbox Reset Validation', () => {
    it('should throw BadRequestException if confirmation text is incorrect', async () => {
      await expect(
        service.resetSandbox({ confirmText: 'WRONG' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear data models but preserve Member and DropdownConfig on RESET', async () => {
      const result = await service.resetSandbox({ confirmText: 'RESET' }, 'user-1');
      expect(result.success).toBe(true);
      expect(mockPrismaService.task.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.project.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.member.delete).not.toHaveBeenCalled();
    });
  });

  describe('Dropdown Config', () => {
    it('should parse values column to JSON array in getDropdowns', async () => {
      mockPrismaService.dropdownConfig.findMany.mockResolvedValue([
        { id: '1', key: 'project_type', label: 'Loại Project', values: '["Workshop","Event"]' }
      ]);

      const result = await service.getDropdowns();
      expect(result[0].values).toEqual(['Workshop', 'Event']);
    });
  });

  describe('Won-deal import: "Ngày bắt đầu" column (BE_REQUIREMENT_26_09_26 §3)', () => {
    const baseRow = {
      year: 2026,
      week: 10,
      company_name: 'Công ty ABC',
      size: 'Enterprise',
      project: '',
      setup_fee: 50000000,
      monthly_fee: 5000000,
      closed_date: '2026-03-10',
    };

    it('stores initiationDate parsed from the column and its aliases; invalid -> null + warning', async () => {
      mockPrismaService.importLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrismaService.closedDeal.create.mockResolvedValue({ id: 'deal' });

      const result: any = await service.importConfirm(
        {
          importType: 'deal',
          rows: [
            { ...baseRow, 'Ngày bắt đầu': '15/01/2026' },
            { ...baseRow, 'Ngay bat dau': 46037 }, // Excel serial for 2026-01-15
            { ...baseRow, initiationDate: '2026-01-15' },
            { ...baseRow, ngayBatDau: 'không rõ' },
            { ...baseRow, 'Ngày bắt đầu': '' },
            { ...baseRow },
          ],
        },
        'user-1',
      );

      expect(result.imported).toBe(6);
      const created = mockPrismaService.closedDeal.create.mock.calls.map(
        (c: any[]) => c[0].data.initiationDate,
      );
      const jan15 = new Date('2026-01-15T00:00:00.000Z');
      expect(created).toEqual([jan15, jan15, jan15, null, null, null]);
      // single-row creates only (audit hook)
      expect(mockPrismaService.closedDeal.create).toHaveBeenCalledTimes(6);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Dòng 4');
    });

    it('does not add warnings when every initiation date is valid', async () => {
      mockPrismaService.importLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrismaService.closedDeal.create.mockResolvedValue({ id: 'deal' });

      const result: any = await service.importConfirm(
        { importType: 'deal', rows: [{ ...baseRow, 'Ngày bắt đầu': '2026-01-15' }] },
        'user-1',
      );
      expect(result).not.toHaveProperty('warnings');
    });

    it('preview accepts the optional column (Date cells, text) and warns on bad values without failing the row', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Deals');
      sheet.addRow([
        'year', 'week', 'company_name', 'size', 'project',
        'setup_fee', 'monthly_fee', 'closed_date', 'Ngày bắt đầu',
      ]);
      sheet.addRow([2026, 10, 'A', 'SME', '', 1, 1, '2026-03-10', new Date(Date.UTC(2026, 0, 15))]);
      sheet.addRow([2026, 10, 'B', 'SME', '', 1, 1, '2026-03-10', 'sai ngày']);
      sheet.addRow([2026, 10, 'C', 'SME', '', 1, 1, '2026-03-10', '']);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result: any = await service.parseImportFile(buffer, 'deal', false);

      expect(result.validRows).toBe(3);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Dòng 3');
      expect(result.allRows[0].data['Ngày bắt đầu']).toBe('2026-01-15');
    });

    it('template includes the "Ngày bắt đầu" column', async () => {
      const wb = await service.generateTemplate('deal');
      const headers = (wb.worksheets[0].getRow(1).values as any[]).filter(Boolean);
      expect(headers).toContain('Ngày bắt đầu');
    });
  });
});
