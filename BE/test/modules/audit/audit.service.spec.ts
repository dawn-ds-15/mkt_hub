import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log-1', ...data })),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create an audit log with stringified values', async () => {
    const logData = {
      userId: 'user-123',
      action: 'update' as const,
      entityType: 'project',
      entityId: 'proj-123',
      fieldChanged: 'name',
      oldValue: { name: 'Old Name' },
      newValue: { name: 'New Name' },
    };

    const result = await service.log(logData);

    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'update',
        entityType: 'project',
        entityId: 'proj-123',
        fieldChanged: 'name',
        oldValue: JSON.stringify({ name: 'Old Name' }),
        newValue: JSON.stringify({ name: 'New Name' }),
      },
    });

    expect(result).toEqual({
      id: 'log-1',
      userId: 'user-123',
      action: 'update',
      entityType: 'project',
      entityId: 'proj-123',
      fieldChanged: 'name',
      oldValue: JSON.stringify({ name: 'Old Name' }),
      newValue: JSON.stringify({ name: 'New Name' }),
    });
  });

  it('should save null for optional fields if not provided', async () => {
    const logData = {
      userId: 'user-123',
      action: 'create' as const,
      entityType: 'task',
      entityId: 'task-123',
    };

    await service.log(logData);

    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'create',
        entityType: 'task',
        entityId: 'task-123',
        fieldChanged: null,
        oldValue: null,
        newValue: null,
      },
    });
  });
});
