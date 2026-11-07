import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ModulePermissionInterceptor } from '../../../src/modules/permissions/module-permission.interceptor';
import {
  isWriteMethod,
  pickRecordFields,
  resolvePermissionRule,
  resolveSlimSharedRead,
} from '../../../src/modules/permissions/permissions.constants';
import { PermissionsService } from '../../../src/modules/permissions/permissions.service';

describe('Permission matrix (BE_requirement_29_09_26 §2)', () => {
  describe('resolvePermissionRule (map endpoint -> module)', () => {
    const modulesOf = (method: string, path: string) =>
      resolvePermissionRule(method, path)?.modules ?? null;

    it.each([
      ['POST', '/api/v1/projects', ['projects']],
      ['GET', '/api/v1/projects/p1', ['projects']],
      ['PUT', '/api/v1/projects/checklist-templates/k1', ['projects']],
      ['GET', '/api/v1/projects/p1/expense-summary', ['expense']],
      ['PUT', '/api/v1/projects/p1/expense-plan', ['expense']],
      ['POST', '/api/v1/projects/p1/documents', ['projects', 'expense']],
      ['GET', '/api/v1/projects/documents/d1/file', ['projects', 'expense']],
      ['DELETE', '/api/v1/projects/documents/d1', ['projects', 'expense']],
      ['POST', '/api/v1/expenses/e1/lines', ['expense']],
      ['GET', '/api/v1/expenses', ['expense']],
      ['GET', '/api/v1/expenses?projectId=p1', ['expense']],
      ['GET', '/api/v1/expenses/report', ['expense']],
      ['PUT', '/api/v1/expense-budgets/values', ['expense']],
      ['GET', '/api/v1/category-budget/values', ['expense']],
      ['GET', '/api/v1/tasks/kanban/board', ['tasks']],
      ['POST', '/api/v1/tasks', ['tasks']],
      ['GET', '/api/v1/weekly-reports', ['tasks']],
      ['GET', '/api/v1/leads-kpis/reports/weekly', ['leads']],
      ['POST', '/api/v1/leads-kpis/opportunities', ['leads']],
      ['GET', '/api/v1/dashboard/kpi-cards?period_type=quarter', ['leads']],
      ['GET', '/api/v1/dashboard/funnel', ['leads']],
      ['GET', '/api/v1/dashboard/pipeline-by-segment', ['leads']],
      ['GET', '/api/v1/dashboard/overview', ['dashboard']],
      ['GET', '/api/v1/inventory/overview', ['inventory']],
      ['POST', '/api/v1/inventory/items', ['inventory']],
      ['GET', '/API/V1//Inventory/transactions/', ['inventory']],
    ])('%s %s -> %j', (method, path, modules) => {
      expect(modulesOf(method, path)).toEqual(modules);
    });

    it.each([
      // shared reads: open to every signed-in user, even with `none`
      ['GET', '/api/v1/projects'],
      ['GET', '/api/v1/projects/'],
      ['GET', '/api/v1/projects/checklist-templates'],
      ['GET', '/api/v1/tasks?assigneeId=u1'],
      ['GET', '/api/v1/inventory/items'],
      ['GET', '/api/v1/inventory/items/i1'],
      ['GET', '/api/v1/expenses/overview?period=2026-Q3'],
      ['GET', '/api/v1/expense-budgets/tree?year=2026'],
      ['GET', '/api/v1/leads-kpis/closed-deals'],
      ['GET', '/api/v1/leads-kpis/daily-actuals'],
      ['GET', '/api/v1/leads-kpis/opportunities'],
      // outside the matrix
      ['GET', '/api/v1/data-management/members'],
      ['GET', '/api/v1/data-management/dropdowns'],
      ['GET', '/api/v1/permissions/matrix'],
      ['PUT', '/api/v1/permissions/matrix'],
      ['POST', '/api/auth/login'],
      ['POST', '/api/v1/leads/from-event-site'],
      ['GET', '/api/v1/dashboard/alerts'],
      ['GET', '/api/v1/notifications'],
      ['GET', '/api/v1/projectsx'],
    ])('%s %s is not restricted', (method, path) => {
      expect(modulesOf(method, path)).toBeNull();
    });

    it('shared reads are GET only', () => {
      expect(modulesOf('POST', '/api/v1/projects')).toEqual(['projects']);
      expect(modulesOf('PATCH', '/api/v1/inventory/items/i1')).toEqual([
        'inventory',
      ]);
      expect(modulesOf('GET', '/api/v1/inventory/items/i1/batches')).toEqual([
        'inventory',
      ]);
    });

    it('slim shared reads: GET /v1/projects only', () => {
      expect(resolveSlimSharedRead('GET', '/api/v1/projects?type=x')).toEqual({
        module: 'projects',
        fields: ['id', 'name', 'type', 'status', 'isLeadSource'],
      });
      expect(resolveSlimSharedRead('GET', '/api/v1/projects/p1')).toBeNull();
      expect(resolveSlimSharedRead('POST', '/api/v1/projects')).toBeNull();
      expect(resolveSlimSharedRead('GET', '/api/v1/tasks')).toBeNull();
      expect(
        pickRecordFields({ data: [{ id: 1, x: 2 }], total: 1 }, ['id']),
      ).toEqual({
        data: [{ id: 1 }],
        total: 1,
      });
    });

    it('write methods', () => {
      expect(isWriteMethod('GET')).toBe(false);
      expect(isWriteMethod('head')).toBe(false);
      expect(['POST', 'PUT', 'PATCH', 'DELETE'].every(isWriteMethod)).toBe(
        true,
      );
    });
  });

  describe('PermissionsService', () => {
    const makeService = (row: any = null) => {
      const prisma: any = {
        permissionMatrix: {
          findUnique: jest.fn().mockResolvedValue(row),
          upsert: jest.fn().mockResolvedValue({}),
        },
        member: {
          findMany: jest.fn(async ({ where }: any) =>
            where.id.in
              .filter((id: string) => id.startsWith('u'))
              .map((id: string) => ({ id })),
          ),
        },
      };
      return { prisma, service: new PermissionsService(prisma) };
    };

    it('GET returns stored cells only (invalid ones dropped) and updatedAt', async () => {
      const { service } = makeService({
        matrix: {
          u1: {
            expense: 'view',
            inventory: 'none',
            bogus: 'edit',
            tasks: 'admin',
          },
          u2: {},
        },
        updatedAt: new Date('2026-09-29T01:00:00Z'),
      });
      expect(await service.getMatrix()).toEqual({
        matrix: { u1: { expense: 'view', inventory: 'none' } },
        updatedAt: '2026-09-29T01:00:00.000Z',
      });
    });

    it('empty matrix before anything is saved; every module defaults to edit', async () => {
      const { service } = makeService(null);
      expect(await service.getMatrix()).toEqual({
        matrix: {},
        updatedAt: null,
      });
      expect(await service.getUserPermissions('u1', 'specialist')).toEqual({
        dashboard: 'edit',
        projects: 'edit',
        tasks: 'edit',
        leads: 'edit',
        expense: 'edit',
        inventory: 'edit',
      });
    });

    it('PUT replaces the matrix, drops empty users and refreshes the cache', async () => {
      const { service, prisma } = makeService(null);
      await service.getMatrix(); // cached empty matrix
      const saved = await service.saveMatrix(
        { u1: { expense: 'view' }, u2: {}, u3: null },
        'manager-1',
      );
      expect(saved.matrix).toEqual({ u1: { expense: 'view' } });
      expect(prisma.permissionMatrix.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'default' },
          update: expect.objectContaining({
            matrix: { u1: { expense: 'view' } },
            updatedBy: 'manager-1',
          }),
        }),
      );
      expect(await service.getLevel('u1', 'expense')).toBe('view');
      expect(prisma.permissionMatrix.findUnique).toHaveBeenCalledTimes(1);
    });

    it('PUT rejects unknown modules, levels and accounts', async () => {
      const { service, prisma } = makeService(null);
      await expect(
        service.saveMatrix({ u1: { finance: 'view' } }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.saveMatrix({ u1: { expense: 'admin' } }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.saveMatrix({ x9: { expense: 'none' } }),
      ).rejects.toThrow('x9');
      await expect(service.saveMatrix([] as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.permissionMatrix.upsert).not.toHaveBeenCalled();
    });
  });

  describe('ModulePermissionInterceptor', () => {
    const cells: Record<string, Record<string, string>> = {
      viewer: { expense: 'view' },
      blocked: { inventory: 'none', expense: 'none' },
      expenseOnly: { projects: 'none', expense: 'edit' },
      projectsView: { projects: 'view', expense: 'view' },
    };
    const permissions: any = {
      getUserPermissions: jest.fn(async (userId: string) => ({
        dashboard: 'edit',
        projects: 'edit',
        tasks: 'edit',
        leads: 'edit',
        expense: 'edit',
        inventory: 'edit',
        ...(cells[userId] || {}),
      })),
    };
    const interceptor = new ModulePermissionInterceptor(permissions);
    const next = { handle: jest.fn(() => of('handled')) };
    const context = (method: string, url: string, user: any) =>
      ({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ method, originalUrl: url, user }),
        }),
      }) as any;
    const run = async (method: string, url: string, user: any) =>
      lastValueFrom(
        await interceptor.intercept(context(method, url, user), next),
      );

    it('view: reads pass, writes of the module get 403', async () => {
      await expect(
        run('GET', '/api/v1/expenses/report', { id: 'viewer' }),
      ).resolves.toBe('handled');
      await expect(
        run('POST', '/api/v1/expenses/e1/lines', { id: 'viewer' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ERR_MODULE_VIEW_ONLY',
          module: 'expense',
        }),
      });
      await expect(
        run('PUT', '/api/v1/projects/p1/expense-plan', { id: 'viewer' }),
      ).rejects.toThrow(ForbiddenException);
      // other modules are unaffected
      await expect(
        run('POST', '/api/v1/projects', { id: 'viewer' }),
      ).resolves.toBe('handled');
    });

    it('none: GETs of the module get 403, except the shared reads', async () => {
      await expect(
        run('GET', '/api/v1/inventory/overview', { id: 'blocked' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ERR_MODULE_NO_ACCESS',
          module: 'inventory',
          level: 'none',
        }),
      });
      await expect(
        run('GET', '/api/v1/inventory/items', { id: 'blocked' }),
      ).resolves.toBe('handled');
      await expect(
        run('GET', '/api/v1/inventory/items/i1', { id: 'blocked' }),
      ).resolves.toBe('handled');
      await expect(
        run('POST', '/api/v1/inventory/items', { id: 'blocked' }),
      ).rejects.toThrow(ForbiddenException);
      // R5 (BE_requirement_02_11_26 §3): GET /v1/expenses returns 403 when expense = 'none' (both manager and specialist)
      await expect(
        run('GET', '/api/v1/expenses', { id: 'blocked', role: 'manager' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ERR_MODULE_NO_ACCESS',
          module: 'expense',
          level: 'none',
        }),
      });
      await expect(
        run('GET', '/api/v1/expenses', { id: 'blocked', role: 'specialist' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ERR_MODULE_NO_ACCESS',
          module: 'expense',
          level: 'none',
        }),
      });
    });

    it('project documents: edit on projects OR expense is enough (temporary exception)', async () => {
      await expect(
        run('POST', '/api/v1/projects/p1/documents', { id: 'expenseOnly' }),
      ).resolves.toBe('handled');
      await expect(
        run('GET', '/api/v1/projects/documents/d1/file', { id: 'expenseOnly' }),
      ).resolves.toBe('handled');
      // the rest of /projects stays closed
      await expect(
        run('GET', '/api/v1/projects/p1', { id: 'expenseOnly' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        run('GET', '/api/v1/projects', { id: 'expenseOnly' }),
      ).resolves.toBe('handled');
      // view on both -> can read the files, cannot upload
      await expect(
        run('GET', '/api/v1/projects/p1/documents', { id: 'projectsView' }),
      ).resolves.toBe('handled');
      await expect(
        run('POST', '/api/v1/projects/p1/documents', { id: 'projectsView' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ERR_MODULE_VIEW_ONLY',
        }),
      });
    });

    it('GET /v1/projects is slimmed down for users with none on projects', async () => {
      const full = [
        {
          id: 'p1',
          name: 'LEAD GENERATION 2026',
          type: 'Digital',
          status: 'Active',
          isLeadSource: true,
          budgetPlanDirect: 100,
          kpis: { mql: 5 },
          expenseRecords: [{ id: 'e1' }],
        },
      ];
      const projectsNext = { handle: jest.fn(() => of(full)) };
      const runProjects = async (userId: string, url = '/api/v1/projects') =>
        lastValueFrom(
          await interceptor.intercept(
            context('GET', url, { id: userId }),
            projectsNext,
          ),
        );

      expect(await runProjects('expenseOnly')).toEqual([
        {
          id: 'p1',
          name: 'LEAD GENERATION 2026',
          type: 'Digital',
          status: 'Active',
          isLeadSource: true,
        },
      ]);
      expect(
        await runProjects('expenseOnly', '/api/v1/projects?type=all'),
      ).toHaveLength(1);
      // view / edit on projects: full list
      expect(await runProjects('projectsView')).toBe(full);
      expect(await runProjects('viewer')).toBe(full);
    });

    it('skips unauthenticated requests and paths outside the matrix', async () => {
      permissions.getUserPermissions.mockClear();
      await expect(run('POST', '/api/auth/login', undefined)).resolves.toBe(
        'handled',
      );
      await expect(
        run('PUT', '/api/v1/permissions/matrix', { id: 'blocked' }),
      ).resolves.toBe('handled');
      await expect(
        run('GET', '/api/v1/dashboard/alerts', { id: 'blocked' }),
      ).resolves.toBe('handled');
      expect(permissions.getUserPermissions).not.toHaveBeenCalled();
    });
  });
});
