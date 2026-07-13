import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, method, path } = request;

    // Áp dụng ma trận phân quyền cho Specialist nếu đã xác thực
    if (user && user.role === Role.specialist) {
      if (this.isForbiddenForSpecialist(method, path)) {
        throw new ForbiddenException(
          'Tài khoản chuyên viên không có quyền thực hiện hành động này.',
        );
      }
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    if (!user) {
      return false;
    }
    return requiredRoles.includes(user.role);
  }

  private isForbiddenForSpecialist(method: string, path: string): boolean {
    const normalizedPath = path.toLowerCase();

    // 1. Xóa Task
    if (method === 'DELETE' && normalizedPath.includes('/tasks')) {
      return true;
    }

    // Các hành động ghi/sửa/xóa (POST, PUT, PATCH, DELETE)
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (isWrite) {
      // 2. Thêm trường tùy chỉnh Project
      if (
        normalizedPath.includes('/projects/custom-fields') ||
        normalizedPath.includes('/projects/custom_fields')
      ) {
        return true;
      }
      // 3. Nhập/Sửa/Xóa Expense
      if (
        normalizedPath.includes('/expenses') ||
        normalizedPath.includes('/expense-records')
      ) {
        return true;
      }
      // 4. Cập nhật Gross Margin % & Churn Rate
      if (normalizedPath.includes('/system-configs')) {
        return true;
      }
      // 5. Quản lý Thành viên
      if (normalizedPath.includes('/members')) {
        return true;
      }
      // 6. Cấu hình Dropdown
      if (
        normalizedPath.includes('/dropdown-configs') ||
        normalizedPath.includes('/dropdowns')
      ) {
        return true;
      }
      // 7. Backup & Reset
      if (
        normalizedPath.includes('/backups') ||
        normalizedPath.includes('/reset')
      ) {
        return true;
      }
    }

    return false;
  }
}
