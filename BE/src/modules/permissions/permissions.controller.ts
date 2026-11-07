import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PermissionsService } from './permissions.service';

const MATRIX_EXAMPLE = {
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11': {
    expense: 'view',
    inventory: 'none',
  },
};

export class SavePermissionMatrixDto {
  @ApiProperty({
    description:
      '{ [userId]: { [module]: "none" | "view" | "edit" } }. Module: dashboard, projects, tasks, leads, expense, inventory. Chỉ gửi ô đặt riêng; ô không có = mặc định của vai trò (edit).',
    example: MATRIX_EXAMPLE,
  })
  @IsObject({
    message: 'matrix phải là object { [userId]: { [module]: level } }.',
  })
  matrix: Record<string, Record<string, string>>;
}

class PermissionMatrixDataDto {
  @ApiProperty({ example: MATRIX_EXAMPLE })
  matrix: Record<string, Record<string, string>>;

  @ApiProperty({ example: '2026-09-29T08:00:00.000Z', nullable: true })
  updatedAt: string | null;
}

class PermissionMatrixResponseDto {
  @ApiProperty({ type: PermissionMatrixDataDto })
  data: PermissionMatrixDataDto;
}

/** Per-account module permission matrix (BE_requirement_29_09_26 §2). */
@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // GET /api/v1/permissions/matrix — every signed-in user (the FE hides menus with it)
  @Get('matrix')
  @ApiOperation({
    summary: 'Ma trận quyền theo tài khoản (mọi tài khoản đã đăng nhập)',
  })
  @ApiOkResponse({ type: PermissionMatrixResponseDto })
  async getMatrix() {
    return { data: await this.permissionsService.getMatrix() };
  }

  // PUT /api/v1/permissions/matrix — manager only
  @Put('matrix')
  @Roles(Role.manager)
  @ApiOperation({
    summary: 'Lưu ma trận quyền (chỉ quản lý). Thay thế toàn bộ ma trận.',
  })
  @ApiOkResponse({ type: PermissionMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Không phải quản lý' })
  async saveMatrix(
    @Body() dto: SavePermissionMatrixDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.permissionsService.saveMatrix(dto.matrix, user?.id),
    };
  }
}
