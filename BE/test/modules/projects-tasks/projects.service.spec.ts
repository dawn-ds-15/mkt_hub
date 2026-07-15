import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../../../src/modules/projects-tasks/projects.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
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
            ownerId: 'user-1',
            deadline: undefined,
          },
          'creator-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if applyTemplate is true but type is not an event type', async () => {
      await expect(
        service.create(
          {
            name: 'Campaign Project',
            type: 'Camp',
            ownerId: 'user-1',
            deadline: '2026-12-31',
            applyTemplate: true,
          },
          'creator-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create project without template', async () => {
      const mockProj = { id: 'proj-1', ownerId: 'user-1', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);

      const result = await service.create(
        {
          name: 'Lead Gen Project',
          type: 'Lead Generation',
          ownerId: 'user-1',
        },
        'creator-1',
      );

      expect(mockPrismaService.project.create).toHaveBeenCalled();
      expect(result.id).toBe('proj-1');
    });

    it('should create project with event checklist template successfully', async () => {
      const mockProj = { id: 'proj-event', ownerId: 'user-1', type: 'Workshop', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProj);

      const result = await service.create(
        {
          name: 'Workshop Project',
          type: 'Workshop',
          ownerId: 'user-1',
          deadline: '2026-12-31',
          applyTemplate: true,
        },
        'creator-1',
      );

      expect(mockPrismaService.project.create).toHaveBeenCalled();
      expect(mockPrismaService.task.create).toHaveBeenCalled();
      expect(result.id).toBe('proj-event');
    });

    it('should rollback transaction by deleting tasks and project if checklist creation fails', async () => {
      const mockProj = { id: 'proj-event', ownerId: 'user-1', type: 'Workshop', deadline: new Date('2026-12-31') };
      mockPrismaService.project.create.mockResolvedValue(mockProj);
      mockPrismaService.task.create.mockRejectedValue(new Error('Failed to create task'));

      await expect(
        service.create(
          {
            name: 'Workshop Project',
            type: 'Workshop',
            ownerId: 'user-1',
            deadline: '2026-12-31',
            applyTemplate: true,
          },
          'creator-1',
        ),
      ).rejects.toThrow('Failed to create task');

      expect(mockPrismaService.task.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'proj-event' } });
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-event' } });
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
      expect(result).toEqual({ message: 'Xóa project thành công' });
      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
    });
  });
});
