import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  getRoleDefaultLevel,
  isWriteMethod,
  PermissionModule,
  pickRecordFields,
  resolvePermissionRule,
  resolveSlimSharedRead,
} from './permissions.constants';
import { PermissionsService } from './permissions.service';

const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: 'Dashboard',
  projects: 'Dự án',
  tasks: 'Công việc',
  leads: 'Leads & KPIs',
  expense: 'Chi phí',
  inventory: 'Kho',
  anonymous_profiles: 'Hồ sơ ẩn danh',
  identified_profiles: 'Hồ sơ định danh 360',
  company_master: 'Company Master',
  sla_queue: 'Hàng chờ SLA',
};

/**
 * Applies the per-account permission matrix (BE_requirement_29_09_26 §2 & BE_requirement_24_10_26 §5) to every request.
 * Runs as a global interceptor, i.e. after the route guards, so `request.user` is already set by
 * JwtAuthGuard; unauthenticated routes and paths outside the matrix are left alone.
 */
@Injectable()
export class ModulePermissionInterceptor implements NestInterceptor {
  constructor(private readonly permissionsService: PermissionsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    if (!user?.id) return next.handle();

    const path = request.originalUrl || request.url || request.path;
    const rule = resolvePermissionRule(request.method, path);
    if (!rule) {
      // Shared read: open to everyone, but slimmed down for users with `none` on its module
      const slim = resolveSlimSharedRead(request.method, path);
      if (!slim) return next.handle();
      const permissions = await this.permissionsService.getUserPermissions(
        user.id,
        user.role,
      );
      const slimLevel =
        permissions[slim.module] ?? getRoleDefaultLevel(user.role, slim.module);
      if (slimLevel !== 'none') return next.handle();
      return next
        .handle()
        .pipe(map((body) => pickRecordFields(body, slim.fields)));
    }

    const permissions = await this.permissionsService.getUserPermissions(
      user.id,
      user.role,
    );
    const isWrite = isWriteMethod(request.method);
    const levels = rule.modules.map(
      (module) =>
        permissions[module] ?? getRoleDefaultLevel(user.role, module),
    );
    // Several modules = allowed when any of them allows it
    const allowed = levels.some((level) =>
      isWrite ? level === 'edit' : level !== 'none',
    );
    if (allowed) return next.handle();

    const viewOnly = isWrite && levels.includes('view');
    const module = rule.modules[viewOnly ? levels.indexOf('view') : 0];
    const labels = rule.modules.map((m) => MODULE_LABELS[m]).join(' / ');
    const effectiveLevel =
      permissions[module] ?? getRoleDefaultLevel(user.role, module);
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      errorCode: viewOnly ? 'ERR_MODULE_VIEW_ONLY' : 'ERR_MODULE_NO_ACCESS',
      module,
      level: effectiveLevel,
      message: viewOnly
        ? `Tài khoản chỉ có quyền xem module ${labels}, không được tạo / sửa / xoá.`
        : `Tài khoản không có quyền truy cập module ${labels}.`,
    });
  }
}
