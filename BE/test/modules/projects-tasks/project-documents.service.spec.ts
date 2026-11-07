import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectDocumentsService } from '../../../src/modules/projects-tasks/project-documents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('ProjectDocumentsService', () => {
  let service: ProjectDocumentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    projectDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectDocumentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectDocumentsService>(ProjectDocumentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectDocuments', () => {
    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.getProjectDocuments('p-not-found')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return documents list for valid project with absolute url', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p-1' });
      const mockDocs = [
        { id: 'doc-1', name: 'hopdong.pdf', category: 'hopdong', projectId: 'p-1' },
      ];
      mockPrismaService.projectDocument.findMany.mockResolvedValue(mockDocs);

      const result = await service.getProjectDocuments('p-1', 'https://api.domain.com');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].url).toBe('https://api.domain.com/api/v1/projects/documents/doc-1/file');
      expect(mockPrismaService.projectDocument.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p-1', archivedAt: null },
        orderBy: { uploadedAt: 'desc' },
      });
    });
  });

  describe('uploadDocuments', () => {
    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadDocuments('p-not-found', [{ originalname: 'test.pdf' } as any]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if files array is empty', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p-1' });

      await expect(service.uploadDocuments('p-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create document records and return them with absolute url', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrismaService.projectDocument.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'doc-new', ...data }),
      );

      const mockFiles = [
        {
          originalname: 'tai_lieu.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          buffer: Buffer.from('dummy content'),
        } as Express.Multer.File,
      ];

      const result = await service.uploadDocuments(
        'p-1',
        mockFiles,
        'hopdong',
        'user-1',
        'http://localhost:3000',
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tai_lieu.pdf');
      expect(result[0].category).toBe('hopdong');
      expect(result[0].uploadedBy).toBe('user-1');
      expect(result[0].url).toBe(
        'http://localhost:3000/api/v1/projects/documents/doc-new/file',
      );
    });
  });

  describe('updateDocument', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrismaService.projectDocument.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDocument('doc-1', { category: 'hopdong' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update document category and return formatted document', async () => {
      mockPrismaService.projectDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        category: 'hoso',
      });
      mockPrismaService.projectDocument.update.mockResolvedValue({
        id: 'doc-1',
        category: 'hopdong',
      });

      const result = await service.updateDocument(
        'doc-1',
        { category: 'hopdong' },
        'user-1',
        'http://localhost:3000',
      );
      expect(result.category).toBe('hopdong');
      expect(result.url).toBe('http://localhost:3000/api/v1/projects/documents/doc-1/file');
    });
  });

  describe('deleteDocument', () => {
    it('should throw NotFoundException if document not found', async () => {
      mockPrismaService.projectDocument.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocument('doc-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should soft delete document and return success message', async () => {
      mockPrismaService.projectDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        archivedAt: null,
      });
      mockPrismaService.projectDocument.update.mockResolvedValue({
        id: 'doc-1',
        archivedAt: new Date(),
      });

      const result = await service.deleteDocument('doc-1', 'user-1');
      expect(result).toEqual({
        success: true,
        message: 'Đã xóa tài liệu thành công.',
      });
      expect(mockPrismaService.projectDocument.update).toHaveBeenCalled();
    });
  });

  describe('getDocumentFile', () => {
    it('should throw NotFoundException if document not found or archived', async () => {
      mockPrismaService.projectDocument.findFirst.mockResolvedValue(null);

      await expect(service.getDocumentFile('doc-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
