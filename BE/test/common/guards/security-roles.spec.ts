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

  it('should block specialist from writing to leads-kpis endpoints', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/leads-kpis/plan',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow specialist to read leads-kpis endpoints', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'GET',
      '/api/v1/leads-kpis/weekly',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block specialist from reading expense reports and overview', () => {
    const reportContext = createMockContext(
      { role: Role.specialist },
      'GET',
      '/api/v1/expenses/report?period=2026',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(reportContext)).toThrow(ForbiddenException);

    const overviewContext = createMockContext(
      { role: Role.specialist },
      'GET',
      '/api/v1/expenses/overview?period=2026',
    );
    expect(() => guard.canActivate(overviewContext)).toThrow(ForbiddenException);
  });

  it('should allow specialist to write expense records, lines, and attachments while blocking system-configs', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    expect(
      guard.canActivate(
        createMockContext({ role: Role.specialist }, 'POST', '/api/v1/expenses'),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createMockContext(
          { role: Role.specialist },
          'POST',
          '/api/v1/expenses/11111111-1111-1111-1111-111111111111/lines',
        ),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createMockContext(
          { role: Role.specialist },
          'POST',
          '/api/v1/expenses/lines/22222222-2222-2222-2222-222222222222/attachments',
        ),
      ),
    ).toBe(true);

    expect(() =>
      guard.canActivate(
        createMockContext(
          { role: Role.specialist },
          'POST',
          '/api/v1/expenses/system-configs',
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('should deny access to users with unknown or database-only roles (e.g., admin) on protected endpoints', () => {
    const context = createMockContext(
      { role: 'admin' },
      'POST',
      '/api/v1/tasks',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.manager]);
    expect(guard.canActivate(context)).toBe(false);
  });
});
