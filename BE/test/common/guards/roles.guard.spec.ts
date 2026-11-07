import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { Role } from '../../../src/common/enums/role.enum';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
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

  it('should allow manager to perform any actions', () => {
    const context = createMockContext(
      { role: Role.manager },
      'DELETE',
      '/api/v1/tasks/1',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block specialist from deleting tasks', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'DELETE',
      '/api/v1/tasks/1',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow specialist to save expenses, expense lines, and attachments', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const createExpenseCtx = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/expenses',
    );
    expect(guard.canActivate(createExpenseCtx)).toBe(true);

    const createLineCtx = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/expenses/exp-123/lines',
    );
    expect(guard.canActivate(createLineCtx)).toBe(true);

    const uploadAttachmentCtx = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/expenses/lines/line-123/attachments',
    );
    expect(guard.canActivate(uploadAttachmentCtx)).toBe(true);
  });

  it('should still block specialist from modifying expense budgets', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'POST',
      '/api/v1/expense-budgets',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow specialist to fetch dashboard overview', () => {
    const context = createMockContext(
      { role: Role.specialist },
      'GET',
      '/api/v1/dashboard/overview',
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(guard.canActivate(context)).toBe(true);
  });
});
