import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ALL_PERMISSION_MODULES,
  getRoleDefaultLevel,
  isPermissionLevel,
  isPermissionModule,
  MODULE_ACTION_MAP,
  PERMISSION_MODULES,
  PermissionLevel,
  PermissionMatrixData,
  PermissionModule,
  PROFILE_PERMISSION_ACTIONS,
  PROFILE_PERMISSION_MODULES,
  ProfilePermissionAction,
} from './permissions.constants';

const MATRIX_ROW_ID = 'default';
/** The matrix is read on every request of a governed module: keep it in memory for a short while. */
const CACHE_TTL_MS = 30_000;

export interface MatrixState {
  matrix: PermissionMatrixData;
  updatedAt: string | null;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private cache: { state: MatrixState; loadedAt: number } | null = null;
  private loading: Promise<MatrixState> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Keeps valid cells only (known modules and levels, non-empty users). */
  private normalize(raw: unknown): PermissionMatrixData {
    const matrix: PermissionMatrixData = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return matrix;
    for (const [userId, cells] of Object.entries(
      raw as Record<string, unknown>,
    )) {
      if (
        !userId ||
        !cells ||
        typeof cells !== 'object' ||
        Array.isArray(cells)
      )
        continue;
      const row: Partial<Record<PermissionModule, PermissionLevel>> = {};
      for (const [module, level] of Object.entries(
        cells as Record<string, unknown>,
      )) {
        if (isPermissionModule(module) && isPermissionLevel(level))
          row[module] = level;
      }
      if (Object.keys(row).length > 0) matrix[userId] = row;
    }
    return matrix;
  }

  private async load(): Promise<MatrixState> {
    const delegate = (this.prisma as any).permissionMatrix;
    if (!delegate?.findUnique) return { matrix: {}, updatedAt: null };
    const row = await delegate.findUnique({ where: { id: MATRIX_ROW_ID } });
    return {
      matrix: this.normalize(row?.matrix),
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  // GET /v1/permissions/matrix
  async getMatrix(): Promise<MatrixState> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.state;
    }
    if (!this.loading) {
      this.loading = this.load()
        .then((state) => {
          this.cache = { state, loadedAt: Date.now() };
          return state;
        })
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  // PUT /v1/permissions/matrix (manager only, checked by the controller)
  async saveMatrix(input: unknown, actorId?: string): Promise<MatrixState> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException(
        'matrix phải là object { [userId]: { [module]: level } }.',
      );
    }

    const matrix: PermissionMatrixData = {};
    for (const [userId, cells] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (cells === null || cells === undefined) continue;
      if (typeof cells !== 'object' || Array.isArray(cells)) {
        throw new BadRequestException(
          `Quyền của tài khoản "${userId}" phải là object { [module]: level }.`,
        );
      }
      const row: Partial<Record<PermissionModule, PermissionLevel>> = {};
      for (const [module, level] of Object.entries(
        cells as Record<string, unknown>,
      )) {
        if (!isPermissionModule(module)) {
          throw new BadRequestException(
            `Module "${module}" không hợp lệ. Chỉ nhận: ${ALL_PERMISSION_MODULES.join(', ')}.`,
          );
        }
        if (!isPermissionLevel(level)) {
          throw new BadRequestException(
            `Mức quyền "${String(level)}" của module "${module}" không hợp lệ. Chỉ nhận: none, view, edit.`,
          );
        }
        row[module] = level;
      }
      if (Object.keys(row).length > 0) matrix[userId] = row;
    }

    const userIds = Object.keys(matrix);
    if (userIds.length > 0) {
      const members = await this.prisma.member.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      });
      const known = new Set(members.map((m) => m.id));
      const unknown = userIds.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Không tìm thấy tài khoản: ${unknown.join(', ')}.`,
        );
      }
    }

    const updatedAt = new Date();
    await this.prisma.permissionMatrix.upsert({
      where: { id: MATRIX_ROW_ID },
      create: {
        id: MATRIX_ROW_ID,
        matrix,
        updatedAt,
        updatedBy: actorId ?? null,
      },
      update: { matrix, updatedAt, updatedBy: actorId ?? null },
    });

    const state: MatrixState = { matrix, updatedAt: updatedAt.toISOString() };
    this.cache = { state, loadedAt: Date.now() };
    return state;
  }

  /** Effective level of every module for a user: explicit cell, else the role default. */
  async getUserPermissions(
    userId: string,
    role?: string,
  ): Promise<Record<PermissionModule, PermissionLevel>> {
    let cells: Partial<Record<PermissionModule, PermissionLevel>> = {};
    try {
      cells = (await this.getMatrix()).matrix[userId] || {};
    } catch (err) {
      this.logger.warn(`Could not read the permission matrix: ${err}`);
    }
    const result = {} as Record<PermissionModule, PermissionLevel>;
    for (const module of PERMISSION_MODULES) {
      result[module] = cells[module] ?? getRoleDefaultLevel(role, module);
    }
    for (const module of PROFILE_PERMISSION_MODULES) {
      if (cells[module] !== undefined) {
        result[module] = cells[module]!;
      }
    }
    return result;
  }

  /**
   * BE_requirement_24_10_26 §5: Full permissions returned in /auth/me and /auth/login.
   * Includes:
   * - All module levels (`dashboard`, `projects`, `tasks`, `leads`, `expense`, `inventory`)
   * - Profile modules (`anonymous_profiles`, `identified_profiles`, `company_master`, `sla_queue`)
   *   with action-level flags (`view`, `edit`, `export`, `convert`, `resolve_conflict`,
   *   `handover`, `merge_lead`, `merge_company`, `claim`, `resolve`)
   * - Top-level action booleans for convenience.
   */
  async getAuthPermissions(userId: string, role?: string): Promise<any> {
    const base = await this.getUserPermissions(userId, role);
    const out: Record<string, any> = { ...base };

    const actionSummary: Record<ProfilePermissionAction, boolean> = {
      view: false,
      edit: false,
      export: false,
      convert: false,
      resolve_conflict: false,
      handover: false,
      merge_lead: false,
      merge_company: false,
      claim: false,
      resolve: false,
    };

    for (const mod of PROFILE_PERMISSION_MODULES) {
      const level = base[mod] ?? getRoleDefaultLevel(role, mod);
      const isEdit = level === 'edit';
      const isView = level === 'view' || isEdit;
      const modActions = MODULE_ACTION_MAP[mod];
      const modObj: Record<string, any> = { level };
      for (const act of PROFILE_PERMISSION_ACTIONS) {
        if (act === 'view') {
          modObj[act] = isView;
        } else if (act === 'export') {
          modObj[act] = isView;
        } else if ((modActions as readonly string[]).includes(act)) {
          modObj[act] = isEdit;
        } else {
          modObj[act] = isEdit;
        }
        if ((modActions as readonly string[]).includes(act) && modObj[act]) {
          actionSummary[act] = true;
        }
      }
      out[mod] = modObj;
    }

    for (const act of PROFILE_PERMISSION_ACTIONS) {
      out[act] = actionSummary[act];
    }

    return out;
  }

  async getLevel(
    userId: string,
    module: PermissionModule,
    role?: string,
  ): Promise<PermissionLevel> {
    const perms = await this.getUserPermissions(userId, role);
    return perms[module] ?? getRoleDefaultLevel(role, module);
  }
}
