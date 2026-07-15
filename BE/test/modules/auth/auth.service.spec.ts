import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let auditService: AuditService;

  const mockPrismaService = {
    member: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user info without passwordHash on successful validation', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 1,
        email: 'test@example.com',
        passwordHash: 'hashed-pwd',
        isActive: true,
        role: 'manager',
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');
      expect(result).toEqual({
        id: 'user-1',
        memberId: 1,
        email: 'test@example.com',
        isActive: true,
        role: 'manager',
      });
      expect(prisma.member.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-pwd');
    });

    it('should return null if user does not exist', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);
      const result = await service.validateUser('notfound@example.com', 'pwd');
      expect(result).toBeNull();
    });

    it('should return null if user is inactive', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-pwd',
        isActive: false,
        role: 'manager',
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      const result = await service.validateUser('test@example.com', 'pwd');
      expect(result).toBeNull();
    });

    it('should return null if password compare fails', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-pwd',
        isActive: true,
        role: 'manager',
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user info on successful login', async () => {
      const mockUser = {
        id: 'user-1',
        memberId: 1,
        email: 'test@example.com',
        name: 'John Doe',
        passwordHash: 'hashed-pwd',
        isActive: true,
        role: 'manager',
        avatarUrl: null,
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@example.com', password: 'password123' });

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'test@example.com',
          role: 'manager',
          avatarUrl: null,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({ member_id: 1, role: 'manager' });
      expect(auditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'create',
        entityType: 'session',
        entityId: 'user-1',
        newValue: { email: 'test@example.com', action: 'login' },
      });
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password and log audit', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'old-hashed-pwd',
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pwd');
      mockPrismaService.member.update.mockResolvedValue(null);

      const result = await service.changePassword('user-1', {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      });

      expect(result).toEqual({ message: 'Đổi mật khẩu thành công' });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-pwd' },
      });
      expect(auditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'update',
        entityType: 'member',
        entityId: 'user-1',
        fieldChanged: 'password',
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('user-none', { oldPassword: '1', newPassword: '2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if old password does not match', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'old-hashed-pwd',
      };
      mockPrismaService.member.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', { oldPassword: 'wrongOld', newPassword: 'new' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    it('should create new specialist user', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pwd');
      const mockCreatedUser = {
        id: 'new-user',
        email: 'new@example.com',
        name: 'New User',
        passwordHash: 'hashed-pwd',
        role: 'specialist',
      };
      mockPrismaService.member.create.mockResolvedValue(mockCreatedUser);

      const result = await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'new-user',
        email: 'new@example.com',
        name: 'New User',
        role: 'specialist',
      });
      expect(prisma.member.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          name: 'New User',
          passwordHash: 'hashed-pwd',
          role: 'specialist',
        },
      });
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue({ id: 'exists' });

      await expect(
        service.register({ email: 'exist@example.com', name: 'User', password: 'pwd' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should log logout action and return success message', async () => {
      const result = await service.logout('user-1');
      expect(result).toEqual({ message: 'Đăng xuất thành công' });
      expect(auditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'delete',
        entityType: 'session',
        entityId: 'user-1',
        oldValue: { action: 'logout' },
      });
    });
  });
});
