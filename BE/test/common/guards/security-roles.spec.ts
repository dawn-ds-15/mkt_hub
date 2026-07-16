import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { Role } from '../../../src/common/enums/role.enum';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('Security Audit - RolesGuard Boundaries', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (
    user: any,
    method: string,
    path: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          method,
          path,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should block specialist from bypassing member management APIs via case variations', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/Members',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should block specialist from bypassing task deletion via case variations', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'DELETE',
      '/api/v1/tAsKs/123',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should block specialist from backup/reset endpoints', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/backups/export',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
