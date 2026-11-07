import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../../../src/modules/projects-tasks/projects.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Role } from '../../../src/common/enums/role.enum';
import { mockExpenseSnapshots } from '../../utils/expense-snapshot-mock';
import { plainToInstance } from 'class-transformer';
import { CreateProjectDto } from '../../../src/modules/projects-tasks/dto/project.dto';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 33 }),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    budgetValue: {
      deleteMany: jest.fn(),
    },
    opportunity: {
      updateMany: jest.fn(),
    },
    closedDeal: {
      updateMany: jest.fn(),
    },
    kpiDistribution: {
      deleteMany: jest.fn(),
    },
    projectDailyActual: {
      deleteMany: jest.fn(),
    },
    event: {
      updateMany: jest.fn(),
    },
    expenseRecord: {
      updateMany: jest.fn(),
    },
    expenseLine: {
      updateMany: jest.fn(),
    },
    checklistTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn(),
    },
    checklistStakeholderOption: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((input) => {
      if (typeof input === 'function') {
        return input(mockPrismaService);
      }
      return Promise.all(input);
    }),
  };

  beforeEach(async () => {
    mockPrismaService.project.findFirst = mockPrismaService.project.findUnique;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all projects presented correctly', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'Camp 1',
          type: 'Camp',
          status: 'Active',
          ownerId: 'user-1',
          owner: { id: 'user-1', name: 'John' },
          tasks: [],
          budgetPlanDirect: 100,
          budgetPlanOverhead: 50,
          actualCostDirect: 80,
          actualCostOverhead: 40,
          kpiRawLeadsPlan: 1000,
          kpiRawLeadsActual: 500,
        },
      ];
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].budgetPlanTotal).toBe(150);
      expect(result[0].actualCostTotal).toBe(120);
      expect(result[0].kpis[0]).toEqual({
        key: 'rawLeads',
        plan: 1000,
        actual: 500,
        percent: 50,
      });
    });
  });

  describe('findOne', () => {
    it('should return project if found', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Camp 1',
        type: 'Camp',
        status: 'Active',
        ownerId: 'user-1',
        owner: { id: 'user-1', name: 'John' },
        tasks: [],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-1');
      expect(result.id).toBe('proj-1');
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if deadline is missing for non-Lead Generation type', async () => {
      await expect(
        service.create(
          {
            name: 'Workshop Project',
            type: 'Workshop',
            status: 'Active',
            ownerId: 'user-1',
            deadline: undefined,
          },
          'creator-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if deadline is missing for Workshop', async () => {
      await expect(
        service.create(
          {
            name: 'Invalid Workshop',
            type: 'Workshop',
            status: 'Planning',
            ownerId: 'user-1',
          },
          'creator-1',
        ),
      ).rejects.toThrow('Deadline là bắt buộc với project không phải Lead Generation');
    });

    it('should throw BadRequestException if applyTemplate is used for Lead Generation', async () => {
      await expect(
        service.create(
          {
            name: 'Invalid Template',
            type: 'Lead Generation',
            status: 'Planning',
            ownerId: 'user-1',
            applyTemplate: true,
          },
          'creator-1',
        ),
      ).rejects.toThrow('Checklist template chỉ áp dụng cho Workshop, Event, Exhibition hoặc Webinar');
    });

    it('should create project without template', async () => {
      const mockProj = { id: 'proj-1', ownerId: 'user-1', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);

      const result = await service.create(
        {
          name: 'Regular Project',
          type: 'Workshop',
          status: 'Active',
          ownerId: 'user-1',
          deadline: '2026-12-31',
          applyTemplate: false,
        },
        'creator-1',
      );

      expect(mockPrismaService.project.create).toHaveBeenCalled();
      expect(mockPrismaService.task.createMany).not.toHaveBeenCalled();
      expect(result.id).toBe('proj-1');
      expect(result.createdTasksCount).toBe(0);
    });

    it('should create project with event checklist template successfully in single transaction', async () => {
      const mockProj = { id: 'proj-event', ownerId: 'user-1', type: 'Workshop', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);

      const result = await service.create(
        {
          name: 'Workshop Project',
          type: 'Workshop',
          status: 'Active',
          ownerId: 'user-1',
          deadline: '2026-12-31',
          applyTemplate: true,
          templateType: 'workshop_smartlog',
        },
        'creator-1',
      );

      expect(mockPrismaService.project.create).toHaveBeenCalled();
      expect(mockPrismaService.task.createMany).toHaveBeenCalled();
      expect(result.id).toBe('proj-event');
      expect(result.createdTasksCount).toBe(33);
    });

    it('should rollback transaction if task creation fails', async () => {
      const mockProj = { id: 'proj-event', ownerId: 'user-1', type: 'Workshop', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.task.createMany.mockRejectedValue(new Error('Failed to create tasks'));

      await expect(
        service.create(
          {
            name: 'Workshop Project',
            type: 'Workshop',
            status: 'Active',
            ownerId: 'user-1',
            deadline: '2026-12-31',
            applyTemplate: true,
          },
          'creator-1',
        ),
      ).rejects.toThrow('Failed to create tasks');
    });

    it('should transform DD/MM/YYYY deadline format to ISO string in CreateProjectDto', () => {
      const dto = plainToInstance(CreateProjectDto, {
        name: 'Test Project',
        type: 'Workshop',
        status: 'Planning',
        ownerId: 'user-1',
        deadline: '29/08/2026',
      });
      expect(dto.deadline).toBe('2026-08-29T00:00:00.000Z');
    });

    it('should map Vietnamese project type and status to English canonical enums', () => {
      const dto = plainToInstance(CreateProjectDto, {
        name: 'Dự án Nội bộ',
        type: 'Nội bộ',
        status: 'Lên kế hoạch',
        ownerId: 'user-123',
      });
      expect(dto.type).toBe('Internal');
      expect(dto.status).toBe('Planning');
      expect(dto.ownerId).toBe('user-123');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if project to update does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.update('none', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update project fields successfully', async () => {
      const mockProj = { id: 'proj-1', type: 'Lead Generation' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);
      mockPrismaService.project.update.mockResolvedValue(mockProj);

      await service.update('proj-1', { name: 'Updated Name' });
      expect(mockPrismaService.project.update).toHaveBeenCalled();
    });

    it('lets a manager set isLeadSource and forbids specialists from changing it (req 26-09 §2)', async () => {
      const mockProj = { id: 'proj-1', type: 'Lead Generation', isLeadSource: false };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);
      mockPrismaService.project.update.mockResolvedValue({ ...mockProj, isLeadSource: true });

      await service.update('proj-1', { isLeadSource: true }, Role.manager);
      expect(mockPrismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isLeadSource: true }) }),
      );

      mockPrismaService.project.update.mockClear();
      await expect(
        service.update('proj-1', { isLeadSource: true }, Role.specialist),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.project.update).not.toHaveBeenCalled();

      // Sending the unchanged value (whole form) is fine for anyone
      await service.update('proj-1', { name: 'X', isLeadSource: false }, Role.specialist);
      expect(mockPrismaService.project.update).toHaveBeenCalled();
    });
  });

  describe('getExpenseSummary (req 26-09 §9.5)', () => {
    it('sums the latest expense snapshot of the project before and after VAT', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      (mockPrismaService.expenseRecord as any).findMany = jest.fn();
      (mockPrismaService.expenseLine as any).findMany = jest.fn();
      mockExpenseSnapshots(mockPrismaService, [
        { id: 'old', projectId: 'proj-1', year: 2026, month: 1, createdAt: new Date('2026-01-01'), lines: [{ id: 'o', actualQuantity: 9, actualUnitPrice: new Decimal(9) }] },
        {
          id: 'new', projectId: 'proj-1', year: 2026, month: 2, createdAt: new Date('2026-02-01'),
          lines: [{
            id: 'l1', plannedQuantity: 1, actualQuantity: 1,
            unitPriceBeforeVatSnapshot: new Decimal(50000000), vatRateSnapshot: new Decimal(8),
            unitPriceAfterVatSnapshot: new Decimal(54000000), actualUnitPrice: new Decimal(54000000),
            plannedAmount: new Decimal(54000000),
          }],
        },
      ]);

      await expect(service.getExpenseSummary('proj-1')).resolves.toEqual({
        projectId: 'proj-1',
        plannedBeforeVat: 50000000,
        plannedAfterVat: 54000000,
        actualBeforeVat: 50000000,
        actualAfterVat: 54000000,
      });
    });

    it('throws NotFound for an unknown project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);
      await expect(service.getExpenseSummary('none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if project to delete does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('none')).rejects.toThrow(NotFoundException);
    });

    it('should delete project and its tasks in transaction', async () => {
      const mockProj = { id: 'proj-1' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);
      mockPrismaService.task.findMany.mockResolvedValue([{ id: 'task-1' }]);

      const result = await service.remove('proj-1');
      expect(result).toEqual({ message: 'Lưu trữ (Soft delete) project thành công' });
      expect(mockPrismaService.task.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.expenseRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1', archivedAt: null },
        }),
      );
      expect(mockPrismaService.expenseLine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expense: { projectId: 'proj-1' }, archivedAt: null },
        }),
      );
      expect(mockPrismaService.project.update).toHaveBeenCalled();
    });
  });

  describe('Budget and Cost totals calculation', () => {
    it('should calculate budgetPlanTotal from budgetValues when budgetPlanDirect is not set', async () => {
      const mockProject = {
        id: 'proj-budget-1',
        name: 'Project BudgetValue fallback',
        type: 'Lead Generation',
        status: 'Active',
        ownerId: 'user-1',
        budgetPlanDirect: null,
        budgetPlanOverhead: null,
        budgetValues: [
          { amount: 20000000 },
          { amount: 15000000 },
        ],
        expenseRecords: [],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-budget-1');
      expect(result.budgetPlanTotal).toBe(35000000);
    });

    it('should calculate actualCostTotal from expenseRecords and expense lines', async () => {
      const mockProject = {
        id: 'proj-actual-1',
        name: 'Project Actual Cost',
        type: 'Lead Generation',
        status: 'Active',
        ownerId: 'user-1',
        budgetPlanDirect: 50000000,
        actualCostDirect: null,
        actualCostOverhead: null,
        budgetValues: [],
        expenseRecords: [
          {
            directCost: 0,
            overheadCost: 0,
            lines: [
              { actualQuantity: 10, unitPriceAfterVatSnapshot: 1000 }, // 10,000
              { quantity: 5, actualUnitPrice: 2000 }, // 10,000
            ],
          },
          {
            directCost: 5000,
            overheadCost: 2000,
            lines: [], // 7,000
          },
        ],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-actual-1');
      expect(result.actualCostTotal).toBe(27000);
      expect(result.budgetPlanTotal).toBe(50000000);
    });

    it('should calculate kpis from kpiDistributions when available', async () => {
      const mockProject = {
        id: 'proj-kpis-1',
        name: 'Project KPI Sync',
        type: 'Event',
        status: 'Active',
        ownerId: 'user-1',
        deadline: new Date('2026-10-15'),
        kpiRawLeadsPlan: 0,
        kpiRawLeadsActual: 0,
        kpiDistributions: [
          {
            year: 2026,
            week: 36,
            type: 'plan',
            rawLeads: 58,
            mql: 50,
            sql: 28,
            oppCount: 8,
            closedCount: 27,
            pipelineValue: 100000000,
          },
          {
            year: 2026,
            week: 36,
            type: 'actual',
            rawLeads: 777,
            mql: 77,
            sql: 7,
            oppCount: 5,
            closedCount: 2,
            pipelineValue: 50000000,
          },
        ],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-kpis-1');
      expect(result.kpis.find((k) => k.key === 'rawLeads')).toEqual({
        key: 'rawLeads',
        plan: 58,
        actual: 777,
        percent: 1339.7,
      });
      expect(result.kpis.find((k) => k.key === 'mql')).toEqual({
        key: 'mql',
        plan: 50,
        actual: 77,
        percent: 154,
      });
      expect(result.kpis.find((k) => k.key === 'sql')).toEqual({
        key: 'sql',
        plan: 28,
        actual: 7,
        percent: 25,
      });
      expect(result.kpis.find((k) => k.key === 'opp')).toEqual({
        key: 'opp',
        plan: 8,
        actual: 5,
        percent: 62.5,
      });
      expect(result.kpis.find((k) => k.key === 'closedDeal')).toEqual({
        key: 'closedDeal',
        plan: 27,
        actual: 2,
        percent: 7.4,
      });
      expect(result.kpis.find((k) => k.key === 'pipelineValue')).toEqual({
        key: 'pipelineValue',
        plan: 100000000,
        actual: 50000000,
        percent: 50,
      });
    });
  });

  describe('Checklist Templates & Stakeholder Options', () => {
    describe('getChecklistTemplates', () => {
      it('should return fallback templates and stakeholder options when db is empty', async () => {
        mockPrismaService.checklistTemplate.findMany.mockResolvedValue([]);
        mockPrismaService.checklistStakeholderOption.findMany.mockResolvedValue([]);

        const result = await service.getChecklistTemplates();
        expect(result.templates.length).toBeGreaterThan(0);
        expect(result.stakeholderOptions.length).toBeGreaterThan(0);
        expect(result.templates[0]).toHaveProperty('key');
        expect(result.templates[0]).toHaveProperty('totalTasks');
        expect(result.templates[0].totalTasks).toBe(result.templates[0].tasks.length);
      });

      it('should return templates from db with calculated totalTasks', async () => {
        mockPrismaService.checklistTemplate.findMany.mockResolvedValue([
          {
            key: 'custom_event',
            name: 'Custom Event',
            appliesToTypes: ['Custom'],
            leadTimeDays: 20,
            tasks: [
              { name: 'Task 1', priority: 'High', daysBeforeDeadline: 5 },
              { name: 'Task 2', priority: 'Low', daysBeforeDeadline: 2 },
            ],
          },
        ]);
        mockPrismaService.checklistStakeholderOption.findMany.mockResolvedValue([
          { code: 'LEAD', label: 'Lead' },
        ]);

        const result = await service.getChecklistTemplates();
        expect(result.templates).toHaveLength(1);
        expect(result.templates[0].totalTasks).toBe(2);
        expect(result.stakeholderOptions).toEqual([{ code: 'LEAD', label: 'Lead' }]);
      });
    });

    describe('createChecklistTemplate', () => {
      it('should throw BadRequestException if key already exists', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue({
          id: 'tpl-1',
          key: 'exhibition',
        });

        await expect(
          service.createChecklistTemplate({
            key: 'exhibition',
            name: 'New Exhibition',
          }),
        ).rejects.toThrow("Mã mẫu checklist 'exhibition' đã tồn tại");
      });

      it('should throw BadRequestException if key contains invalid characters', async () => {
        await expect(
          service.createChecklistTemplate({
            key: 'invalid key!',
            name: 'Invalid Key Template',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if task in tasks has missing name', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue(null);

        await expect(
          service.createChecklistTemplate({
            key: 'new_workshop',
            name: 'New Workshop',
            tasks: [{ name: '' }],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if leadTimeDays is negative', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue(null);

        await expect(
          service.createChecklistTemplate({
            key: 'new_workshop',
            name: 'New Workshop',
            leadTimeDays: -5,
          }),
        ).rejects.toThrow('Số ngày chuẩn bị (leadTimeDays) phải lớn hơn hoặc bằng 0');
      });

      it('should create checklist template successfully and return totalTasks', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue(null);
        mockPrismaService.checklistTemplate.create.mockResolvedValue({
          id: 'tpl-123',
          key: 'workshop_digital',
          name: 'Workshop Digital',
          appliesToTypes: ['Workshop'],
          leadTimeDays: 40,
        });

        const result = await service.createChecklistTemplate({
          key: 'workshop_digital',
          name: 'Workshop Digital',
          appliesToTypes: ['Workshop'],
          leadTimeDays: 40,
          tasks: [
            { name: 'Chuẩn bị tài liệu', priority: 'High', daysBeforeDeadline: 10 },
          ],
        });

        expect(result.key).toBe('workshop_digital');
        expect(result.totalTasks).toBe(1);
        expect(result.tasks[0].group).toBe('Khác');
        expect(result.tasks[0].priority).toBe('High');
      });
    });

    describe('updateChecklistTemplate', () => {
      it('should throw NotFoundException if template key does not exist', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue(null);

        await expect(
          service.updateChecklistTemplate('non_existent', {
            name: 'Updated Name',
          }),
        ).rejects.toThrow("Không tìm thấy mẫu checklist với mã 'non_existent'");
      });

      it('should throw BadRequestException if body key differs from url key', async () => {
        await expect(
          service.updateChecklistTemplate('workshop_old', {
            key: 'workshop_new',
            name: 'Updated Name',
          }),
        ).rejects.toThrow('Mã key trong payload không khớp với key trên URL');
      });

      it('should update checklist template successfully', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue({
          id: 'tpl-1',
          key: 'workshop_ai',
        });
        mockPrismaService.checklistTemplate.update.mockResolvedValue({
          id: 'tpl-1',
          key: 'workshop_ai',
          name: 'Updated Workshop AI',
          appliesToTypes: ['Workshop'],
          leadTimeDays: 50,
        });

        const result = await service.updateChecklistTemplate('workshop_ai', {
          name: 'Updated Workshop AI',
          appliesToTypes: ['Workshop'],
          leadTimeDays: 50,
          tasks: [{ name: 'Setup mic', priority: 'Medium' }],
        });

        expect(result.name).toBe('Updated Workshop AI');
        expect(result.totalTasks).toBe(1);
      });
    });

    describe('deleteChecklistTemplate', () => {
      it('should throw NotFoundException if template does not exist', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue(null);

        await expect(service.deleteChecklistTemplate('unknown')).rejects.toThrow(
          "Không tìm thấy mẫu checklist với mã 'unknown'",
        );
      });

      it('should delete template successfully and return success: true', async () => {
        mockPrismaService.checklistTemplate.findFirst.mockResolvedValue({
          id: 'tpl-del',
          key: 'to_delete',
        });
        mockPrismaService.checklistTemplate.delete.mockResolvedValue({});

        const result = await service.deleteChecklistTemplate('to_delete');
        expect(result).toEqual({ success: true });
        expect(mockPrismaService.checklistTemplate.delete).toHaveBeenCalledWith({
          where: { id: 'tpl-del' },
        });
      });
    });

    describe('updateStakeholderOptions', () => {
      it('should throw BadRequestException if stakeholderOptions is not an array', async () => {
        await expect(
          service.updateStakeholderOptions({ stakeholderOptions: 'invalid' as any }),
        ).rejects.toThrow('Danh sách stakeholderOptions phải là một mảng');
      });

      it('should throw BadRequestException if stakeholder code is duplicated', async () => {
        await expect(
          service.updateStakeholderOptions({
            stakeholderOptions: [
              { code: 'PM', label: 'Project Manager' },
              { code: 'pm', label: 'Product Manager' },
            ],
          }),
        ).rejects.toThrow("Mã stakeholder 'pm' bị trùng lặp");
      });

      it('should overwrite stakeholder options successfully', async () => {
        const result = await service.updateStakeholderOptions({
          stakeholderOptions: [
            { code: 'PM', label: 'Project Manager' },
            { code: 'DEV', label: 'Developer' },
          ],
        });

        expect(result.stakeholderOptions).toHaveLength(2);
        expect(mockPrismaService.checklistStakeholderOption.deleteMany).toHaveBeenCalled();
        expect(mockPrismaService.checklistStakeholderOption.create).toHaveBeenCalledTimes(2);
      });
    });
  });
});

