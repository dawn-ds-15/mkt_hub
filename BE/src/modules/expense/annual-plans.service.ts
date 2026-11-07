import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ActivateAnnualPlanDto,
  BulkUpdateAnnualPlanItemsDto,
  CreateAnnualPlanDto,
  CreateAnnualPlanItemNodeDto,
} from './dto/annual-plans.dto';
import {
  EXPENSE_ERROR_CODES,
  getExpensePermissions,
} from './expense-permissions.helper';

@Injectable()
export class AnnualPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnnualPlans(year?: number, user?: AuthenticatedUser) {
    const where: any = {};
    if (year !== undefined) {
      where.year = Number(year);
    }

    const plans = await this.prisma.annualExpensePlan.findMany({
      where,
      orderBy: [{ year: 'desc' }, { version: 'desc' }],
    });

    return {
      data: plans.map((p) => ({
        id: p.id,
        year: p.year,
        version: p.version,
        name: p.name,
        status: p.status,
        activatedAt: p.activatedAt,
        replacedByVersion: p.replacedByVersion,
        totalPlan: Number(p.totalPlan || 0),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      permissions: getExpensePermissions(user),
    };
  }

  async createAnnualPlan(dto: CreateAnnualPlanDto, user?: AuthenticatedUser) {
    const year = Number(dto.year);

    // Find default createdBy user ID
    let createdById = user?.id;
    const needsFallbackMember = !createdById;

    // Both lookups are independent reads: run them concurrently (same start
    // order; if both fail, the max-version error is surfaced as before).
    const [lastPlanResult, fallbackMemberResult] = await Promise.allSettled([
      // Get max version for this year
      this.prisma.annualExpensePlan.findFirst({
        where: { year },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
      needsFallbackMember ? this.prisma.member.findFirst() : null,
    ]);
    if (lastPlanResult.status === 'rejected') throw lastPlanResult.reason;
    if (fallbackMemberResult.status === 'rejected') {
      throw fallbackMemberResult.reason;
    }
    const lastPlan = lastPlanResult.value;
    const nextVersion = (lastPlan?.version || 0) + 1;

    if (!createdById) {
      const fallbackMember = fallbackMemberResult.value;
      createdById = fallbackMember?.id || 'system';
    }

    const newPlan = await this.prisma.annualExpensePlan.create({
      data: {
        year,
        version: nextVersion,
        name: dto.name.trim(),
        status: 'draft',
        totalPlan: new Decimal(0),
        createdById,
      },
    });

    // Clone tree if requested
    if (dto.template?.cloneTree) {
      let sourcePlanId = dto.template.fromPlanId;
      if (!sourcePlanId) {
        // Fallback: search for active plan in the same year or previous year
        const activePlan = await this.prisma.annualExpensePlan.findFirst({
          where: { year, status: 'active' },
        });
        if (activePlan) {
          sourcePlanId = activePlan.id;
        }
      }

      if (sourcePlanId) {
        await this.clonePlanItems(sourcePlanId, newPlan.id);
      } else {
        // Fallback 2: clone from legacy BudgetCategory structure if available
        await this.seedFromLegacyCategories(year, newPlan.id);
      }
    }

    // Rollup total
    await this.recalculatePlanTotal(newPlan.id);

    const updated = await this.prisma.annualExpensePlan.findUnique({
      where: { id: newPlan.id },
    });

    return {
      data: {
        id: updated!.id,
        year: updated!.year,
        version: updated!.version,
        name: updated!.name,
        status: updated!.status,
        activatedAt: updated!.activatedAt,
        replacedByVersion: updated!.replacedByVersion,
        totalPlan: Number(updated!.totalPlan || 0),
        createdAt: updated!.createdAt,
        updatedAt: updated!.updatedAt,
      },
      permissions: getExpensePermissions(user),
    };
  }

  async getAnnualPlanTree(planId: string, user?: AuthenticatedUser) {
    const plan = await this.prisma.annualExpensePlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Không tìm thấy kế hoạch năm ID: ${planId}`);
    }

    const items = await this.prisma.annualExpensePlanItem.findMany({
      where: { planId, isActive: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Build hierarchy
    const level1Nodes = items.filter((i) => i.level === 1);
    const level2Nodes = items.filter((i) => i.level === 2);
    const level3Nodes = items.filter((i) => i.level === 3);

    // Index children by parentId once (keeps original relative order) instead
    // of re-filtering the whole level list for every parent.
    const groupByParent = (nodes: typeof items) => {
      const map = new Map<string | null, typeof items>();
      for (const n of nodes) {
        const list = map.get(n.parentId);
        if (list) list.push(n);
        else map.set(n.parentId, [n]);
      }
      return map;
    };
    const level2ByParent = groupByParent(level2Nodes);
    const level3ByParent = groupByParent(level3Nodes);

    const tree = level1Nodes.map((l1) => {
      const l2Children = (level2ByParent.get(l1.id) || [])
        .map((l2) => {
          const l3Children = (level3ByParent.get(l2.id) || [])
            .map((l3) => ({
              id: l3.id,
              name: l3.name,
              level: 3,
              amount: Number(l3.amount || 0),
              sortOrder: l3.sortOrder,
            }));

          const l2Total = l3Children.reduce((sum, c) => sum + c.amount, 0);
          return {
            id: l2.id,
            name: l2.name,
            level: 2,
            totalAmount: l2Total,
            sortOrder: l2.sortOrder,
            children: l3Children,
          };
        });

      const l1Total = l2Children.reduce((sum, c) => sum + c.totalAmount, 0);
      return {
        id: l1.id,
        name: l1.name,
        level: 1,
        totalAmount: l1Total,
        sortOrder: l1.sortOrder,
        children: l2Children,
      };
    });

    return {
      data: {
        id: plan.id,
        year: plan.year,
        version: plan.version,
        name: plan.name,
        status: plan.status,
        totalPlan: Number(plan.totalPlan || 0),
        tree,
      },
      permissions: getExpensePermissions(user),
    };
  }

  async updateAnnualPlanItems(
    planId: string,
    dto: BulkUpdateAnnualPlanItemsDto,
    user?: AuthenticatedUser,
  ) {
    const plan = await this.prisma.annualExpensePlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Không tìm thấy kế hoạch năm ID: ${planId}`);
    }

    if (plan.status !== 'draft') {
      throw new ForbiddenException({
        code: EXPENSE_ERROR_CODES.ERR_NOT_DRAFT,
        message: 'Chỉ được chỉnh sửa khi kế hoạch ở trạng thái Draft.',
      });
    }

    for (const item of dto.items) {
      if (item.amount < 0) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_BUDGET_AMOUNT_NEGATIVE,
          message: 'Ngân sách không được là số âm.',
        });
      }

      const node = await this.prisma.annualExpensePlanItem.findUnique({
        where: { id: item.itemId },
      });
      if (!node || node.planId !== planId) {
        throw new NotFoundException({
          code: EXPENSE_ERROR_CODES.ERR_ITEM_NOT_FOUND,
          message: `Hạng mục ${item.itemId} không thuộc kế hoạch này.`,
        });
      }

      if (node.level !== 3) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: `Chỉ được nhập ngân sách ở hạng mục chi tiết (level 3). Hạng mục "${node.name}" là level ${node.level}.`,
        });
      }

      await this.prisma.annualExpensePlanItem.update({
        where: { id: item.itemId },
        data: { amount: new Decimal(item.amount) },
      });
    }

    await this.recalculatePlanTotal(planId);
    return this.getAnnualPlanTree(planId, user);
  }

  async activateAnnualPlan(
    planId: string,
    dto?: ActivateAnnualPlanDto,
    ifMatch?: string,
    user?: AuthenticatedUser,
  ) {
    const plan = await this.prisma.annualExpensePlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException({
        code: EXPENSE_ERROR_CODES.ERR_ITEM_NOT_FOUND,
        message: `Không tìm thấy kế hoạch năm ID: ${planId}`,
      });
    }

    if (plan.status !== 'draft' && plan.status !== 'archived') {
      throw new ConflictException({
        code: EXPENSE_ERROR_CODES.ERR_PLAN_NOT_DRAFT,
        message: 'Chỉ kế hoạch ở trạng thái Draft hoặc Archived mới có thể kích hoạt.',
      });
    }

    if (ifMatch) {
      const cleanMatch = ifMatch.replace(/["']/g, '').trim().toLowerCase();
      const planVer = `v${plan.version}`.toLowerCase();
      const planNum = `${plan.version}`.toLowerCase();
      if (cleanMatch !== planVer && cleanMatch !== planNum) {
        throw new ConflictException({
          code: EXPENSE_ERROR_CODES.ERR_PLAN_STATUS_CHANGE_DENIED,
          message: `Phiên bản kế hoạch (${plan.version}) không khớp với điều kiện If-Match (${ifMatch}).`,
        });
      }
    }

    const existingActive = await this.prisma.annualExpensePlan.findFirst({
      where: {
        year: plan.year,
        status: 'active',
        id: { not: planId },
      },
    });

    if (existingActive && !dto?.confirmReplace) {
      throw new ConflictException({
        code: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_ALREADY_ACTIVE,
        message: `Năm ${plan.year} đã có kế hoạch đang Active (v${existingActive.version}). Cần xác nhận thay thế (confirmReplace: true).`,
        params: {
          currentActiveVersion: existingActive.version,
          targetVersion: plan.version,
        },
      });
    }

    // Archive all current active plans for this year
    await this.prisma.annualExpensePlan.updateMany({
      where: {
        year: plan.year,
        status: 'active',
        id: { not: planId },
      },
      data: {
        status: 'archived',
        replacedByVersion: plan.version,
      },
    });

    // Make this plan active
    const activated = await this.prisma.annualExpensePlan.update({
      where: { id: planId },
      data: {
        status: 'active',
        activatedAt: new Date(),
        replacedByVersion: null,
      },
    });

    return {
      data: {
        id: activated.id,
        year: activated.year,
        version: activated.version,
        name: activated.name,
        status: activated.status,
        activatedAt: activated.activatedAt,
        replacedByVersion: activated.replacedByVersion,
        totalPlan: Number(activated.totalPlan || 0),
      },
      permissions: getExpensePermissions(user),
    };
  }

  async getActiveAnnualPlan(year: number, user?: AuthenticatedUser) {
    const plan = await this.prisma.annualExpensePlan.findFirst({
      where: {
        year: Number(year),
        status: 'active',
      },
    });

    if (!plan) {
      throw new NotFoundException({
        code: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_NOT_ACTIVE,
        message: `Chưa có kế hoạch chi phí năm nào đang Active cho năm ${year}.`,
      });
    }

    return {
      data: {
        id: plan.id,
        year: plan.year,
        version: plan.version,
        name: plan.name,
        status: plan.status,
        activatedAt: plan.activatedAt,
        totalPlan: Number(plan.totalPlan || 0),
      },
      permissions: getExpensePermissions(user),
    };
  }

  async addItemNode(planId: string, dto: CreateAnnualPlanItemNodeDto) {
    const plan = await this.prisma.annualExpensePlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException({
        code: EXPENSE_ERROR_CODES.ERR_ITEM_NOT_FOUND,
        message: 'Kế hoạch không tồn tại.',
      });
    }
    if (plan.status !== 'draft') {
      throw new ForbiddenException({
        code: EXPENSE_ERROR_CODES.ERR_NOT_DRAFT,
        message: 'Chỉ được thêm hạng mục khi kế hoạch ở trạng thái Draft.',
      });
    }

    if (dto.level < 1 || dto.level > 3) {
      throw new UnprocessableEntityException({
        code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
        message: 'Cấp độ node phải từ 1 đến 3.',
      });
    }

    if (dto.amount !== undefined && dto.amount < 0) {
      throw new UnprocessableEntityException({
        code: EXPENSE_ERROR_CODES.ERR_BUDGET_AMOUNT_NEGATIVE,
        message: 'Ngân sách không được là số âm.',
      });
    }

    if (dto.level === 1) {
      if (dto.parentId) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: 'Hạng mục cấp 1 không được có parentId.',
        });
      }
      if (dto.amount && dto.amount > 0) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: 'Chỉ được nhập ngân sách ở hạng mục chi tiết (level 3).',
        });
      }
    } else {
      if (!dto.parentId) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: `Hạng mục cấp ${dto.level} bắt buộc phải có parentId.`,
        });
      }
      const parent = await this.prisma.annualExpensePlanItem.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.planId !== planId) {
        throw new NotFoundException({
          code: EXPENSE_ERROR_CODES.ERR_ITEM_NOT_FOUND,
          message: 'Hạng mục cha không tồn tại trong kế hoạch này.',
        });
      }
      if (parent.level !== dto.level - 1) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: `Hạng mục cha phải ở cấp ${dto.level - 1} (hiện tại là cấp ${parent.level}).`,
        });
      }
      if (dto.level === 2 && dto.amount && dto.amount > 0) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_NODE_LEVEL_INVALID,
          message: 'Chỉ được nhập ngân sách ở hạng mục chi tiết (level 3).',
        });
      }
    }

    const item = await this.prisma.annualExpensePlanItem.create({
      data: {
        planId,
        level: dto.level,
        parentId: dto.parentId || null,
        name: dto.name.trim(),
        amount: dto.level === 3 ? new Decimal(dto.amount || 0) : null,
        sortOrder: dto.sortOrder || 0,
      },
    });

    if (dto.level === 3 && dto.amount) {
      await this.recalculatePlanTotal(planId);
    }

    return item;
  }

  private async clonePlanItems(sourcePlanId: string, targetPlanId: string) {
    const sourceItems = await this.prisma.annualExpensePlanItem.findMany({
      where: { planId: sourcePlanId, isActive: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });

    const idMap = new Map<string, string>();

    for (const item of sourceItems) {
      const newParentId = item.parentId ? idMap.get(item.parentId) || null : null;
      const created = await this.prisma.annualExpensePlanItem.create({
        data: {
          planId: targetPlanId,
          level: item.level,
          parentId: newParentId,
          name: item.name,
          sortOrder: item.sortOrder,
          amount: item.amount,
          isActive: item.isActive,
        },
      });
      idMap.set(item.id, created.id);
    }
  }

  private async seedFromLegacyCategories(year: number, targetPlanId: string) {
    const categories = await this.prisma.budgetCategory.findMany({
      where: { year, archivedAt: null },
      include: {
        subcategories: {
          where: { archivedAt: null },
          include: {
            items: { where: { archivedAt: null } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    for (const cat of categories) {
      const l1 = await this.prisma.annualExpensePlanItem.create({
        data: {
          planId: targetPlanId,
          level: 1,
          name: cat.name,
          sortOrder: cat.sortOrder,
        },
      });

      for (const sub of cat.subcategories) {
        const l2 = await this.prisma.annualExpensePlanItem.create({
          data: {
            planId: targetPlanId,
            level: 2,
            parentId: l1.id,
            name: sub.name,
            sortOrder: sub.sortOrder,
          },
        });

        for (const itm of sub.items) {
          await this.prisma.annualExpensePlanItem.create({
            data: {
              planId: targetPlanId,
              level: 3,
              parentId: l2.id,
              name: itm.name,
              sortOrder: itm.sortOrder,
              amount: new Decimal(0),
            },
          });
        }
      }
    }
  }

  private async recalculatePlanTotal(planId: string) {
    const level3Items = await this.prisma.annualExpensePlanItem.findMany({
      where: { planId, level: 3, isActive: true },
      select: { amount: true },
    });

    const total = level3Items.reduce(
      (sum, itm) => sum + Number(itm.amount || 0),
      0,
    );

    await this.prisma.annualExpensePlan.update({
      where: { id: planId },
      data: { totalPlan: new Decimal(total) },
    });
  }
}
