import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  BulkSaveBudgetValuesDto,
  CreateBudgetCategoryDto,
  CreateBudgetItemDto,
  CreateBudgetSubcategoryDto,
  ProjectBudgetItemDto,
  BudgetByProjectDataDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetItemDto,
  UpdateBudgetSubcategoryDto,
} from './dto/category-budget.dto';
import * as ExcelJS from 'exceljs';
import {
  loadLatestExpenseSnapshots,
  toExpenseCostEntries,
} from './expense-snapshot.util';

/**
 * Runs independent reads concurrently (one DB round-trip instead of N sequential
 * ones) but resolves/rejects in argument order, so if several fail the caller
 * sees the same error the former sequential awaits would have thrown first.
 */
async function settleInOrder<T extends readonly unknown[] | []>(
  values: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const results = await Promise.allSettled(values);
  return results.map((r) => {
    if (r.status === 'rejected') throw r.reason;
    return r.value;
  }) as { -readonly [P in keyof T]: Awaited<T[P]> };
}

/** Actual / planned cost (before VAT) booked on a budget node in a month of the year */
interface BudgetCostEntry {
  /** item / subcategory / category id, null when the cost has no budget category */
  nodeId: string | null;
  month: number;
  actual: number;
  planned: number;
  /** "Hạng mục lớn" (expense line) / category name (inventory batch), groups costs outside the tree */
  groupName?: string | null;
}

/** Name of the virtual group for costs that have neither a budget category nor a "hạng mục lớn". */
export const UNASSIGNED_GROUP_FALLBACK_NAME = 'Chưa gắn nhóm hạng mục';

@Injectable()
export class CategoryBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Costs of a year per budget node (BE_requirement_26_09_26 §1, §4):
   * - latest expense snapshot of each project, every line in the month of its own date, before VAT;
   * - inventory batches booked directly to a budget category (quantityIn × unitPriceBeforeVat, month
   *   of receivedDate). They are company costs, so they are left out when viewing a single project.
   */
  private async loadBudgetCostEntries(
    year: number,
    projectId?: string,
  ): Promise<BudgetCostEntry[]> {
    const specificProjectId =
      projectId && projectId !== 'all' ? projectId : undefined;
    const prismaAny = this.prisma as any;

    const [snapshotSet, batches] = await Promise.all([
      loadLatestExpenseSnapshots(this.prisma, { projectId: specificProjectId }),
      !specificProjectId && prismaAny.inventoryBatch?.findMany
        ? prismaAny.inventoryBatch.findMany({
            where: {
              archivedAt: null,
              expenseCategoryId: { not: null },
              receivedDate: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              },
              item: { archivedAt: null },
            },
            select: {
              expenseCategoryId: true,
              expenseCategoryName: true,
              receivedDate: true,
              quantityIn: true,
              unitPriceBeforeVat: true,
            },
          })
        : [],
    ]);

    const entries: BudgetCostEntry[] = [];
    for (const e of toExpenseCostEntries(snapshotSet)) {
      if (e.year !== year || e.month < 1 || e.month > 12) continue;
      entries.push({
        nodeId: e.categoryId,
        month: e.month,
        actual: e.actualBeforeVat,
        planned: e.plannedBeforeVat,
        groupName: e.hangMucLon,
      });
    }
    for (const b of Array.isArray(batches) ? batches : []) {
      const received = b.receivedDate instanceof Date ? b.receivedDate : new Date(b.receivedDate);
      if (isNaN(received.getTime())) continue;
      entries.push({
        nodeId: b.expenseCategoryId,
        month: received.getUTCMonth() + 1,
        actual: Number(b.quantityIn || 0) * Number(b.unitPriceBeforeVat || 0),
        planned: 0,
        groupName: b.expenseCategoryName ?? null,
      });
    }
    return entries;
  }

  getBudgetPermissions(user?: AuthenticatedUser) {
    if (user?.role === 'specialist') {
      return {
        view: true,
        edit: false,
        manageCategories: false,
        export: false,
      };
    }
    return {
      view: true,
      edit: true,
      manageCategories: true,
      export: true,
    };
  }

  private initMonthsMap(): Record<string, number> {
    const months: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      months[m.toString()] = 0;
    }
    return months;
  }

  // ==========================================
  // 1. BUDGET CATEGORIES
  // ==========================================

  async getCategories(year?: number) {
    const where: any = { archivedAt: null };
    if (year !== undefined) {
      where.year = year;
    }

    const categories = await this.prisma.budgetCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      percent: Number(c.percent),
      sortOrder: c.sortOrder,
      year: c.year,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async createCategory(dto: CreateBudgetCategoryDto, userId?: string) {
    const existing = await this.prisma.budgetCategory.findFirst({
      where: {
        year: dto.year,
        name: dto.name.trim(),
        archivedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Hạng mục "${dto.name}" đã tồn tại trong năm ${dto.year}.`,
      );
    }

    const category = await this.prisma.budgetCategory.create({
      data: {
        name: dto.name.trim(),
        percent: new Decimal(dto.percent || 0),
        sortOrder: dto.sortOrder ?? 0,
        year: dto.year,
        isActive: dto.isActive ?? true,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'BudgetCategory',
        entityId: category.id,
        newValue: category,
      });
    }

    return {
      id: category.id,
      name: category.name,
      percent: Number(category.percent),
      sortOrder: category.sortOrder,
      year: category.year,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async updateCategory(
    id: string,
    dto: UpdateBudgetCategoryDto,
    userId?: string,
  ) {
    const existing = await this.prisma.budgetCategory.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy hạng mục ngân sách.');
    }

    const targetYear = dto.year !== undefined ? dto.year : existing.year;
    const targetName = dto.name !== undefined ? dto.name.trim() : existing.name;

    if (
      (dto.name && dto.name.trim() !== existing.name) ||
      (dto.year !== undefined && dto.year !== existing.year)
    ) {
      const duplicate = await this.prisma.budgetCategory.findFirst({
        where: {
          year: targetYear,
          name: targetName,
          archivedAt: null,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Hạng mục "${targetName}" đã tồn tại trong năm ${targetYear}.`,
        );
      }
    }

    const updated = await this.prisma.budgetCategory.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        percent:
          dto.percent !== undefined
            ? new Decimal(dto.percent)
            : existing.percent,
        sortOrder:
          dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
        year: targetYear,
        isActive:
          dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'BudgetCategory',
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      percent: Number(updated.percent),
      sortOrder: updated.sortOrder,
      year: updated.year,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteCategory(id: string, userId?: string) {
    const existing = await this.prisma.budgetCategory.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy hạng mục ngân sách.');
    }

    const deleted = await this.prisma.budgetCategory.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'delete',
        entityType: 'BudgetCategory',
        entityId: id,
        oldValue: existing,
      });
    }

    return { success: true, id };
  }

  // ==========================================
  // 2. BUDGET SUBCATEGORIES
  // ==========================================

  async getSubcategories(categoryId?: string) {
    const where: any = { archivedAt: null };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const list = await this.prisma.budgetSubcategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return list.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
      totalName: s.totalName,
      backupPercent: s.backupPercent ? Number(s.backupPercent) : 0,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async createSubcategory(dto: CreateBudgetSubcategoryDto, userId?: string) {
    const category = await this.prisma.budgetCategory.findFirst({
      where: { id: dto.categoryId, archivedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy hạng mục cha (Category).');
    }

    const subcategory = await this.prisma.budgetSubcategory.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        totalName: dto.totalName?.trim() || null,
        backupPercent: new Decimal(dto.backupPercent || 0),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'BudgetSubcategory',
        entityId: subcategory.id,
        newValue: subcategory,
      });
    }

    return {
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      totalName: subcategory.totalName,
      backupPercent: Number(subcategory.backupPercent),
      sortOrder: subcategory.sortOrder,
      isActive: subcategory.isActive,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
    };
  }

  async updateSubcategory(
    id: string,
    dto: UpdateBudgetSubcategoryDto,
    userId?: string,
  ) {
    const existing = await this.prisma.budgetSubcategory.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy hạng mục con (Subcategory).');
    }

    const updated = await this.prisma.budgetSubcategory.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        totalName:
          dto.totalName !== undefined
            ? dto.totalName?.trim() || null
            : existing.totalName,
        backupPercent:
          dto.backupPercent !== undefined
            ? new Decimal(dto.backupPercent)
            : existing.backupPercent,
        sortOrder:
          dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
        isActive:
          dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'BudgetSubcategory',
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
    }

    return {
      id: updated.id,
      categoryId: updated.categoryId,
      name: updated.name,
      totalName: updated.totalName,
      backupPercent: Number(updated.backupPercent),
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteSubcategory(id: string, userId?: string) {
    const existing = await this.prisma.budgetSubcategory.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy hạng mục con (Subcategory).');
    }

    await this.prisma.budgetSubcategory.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'delete',
        entityType: 'BudgetSubcategory',
        entityId: id,
        oldValue: existing,
      });
    }

    return { success: true, id };
  }

  // ==========================================
  // 3. BUDGET ITEMS
  // ==========================================

  async getItems(subcategoryId?: string) {
    const where: any = { archivedAt: null };
    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    const items = await this.prisma.budgetItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      subcategoryId: item.subcategoryId,
      name: item.name,
      subCount: item.subCount,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async createItem(dto: CreateBudgetItemDto, userId?: string) {
    const subcategory = await this.prisma.budgetSubcategory.findFirst({
      where: { id: dto.subcategoryId, archivedAt: null },
    });

    if (!subcategory) {
      throw new NotFoundException('Không tìm thấy hạng mục con (Subcategory).');
    }

    const item = await this.prisma.budgetItem.create({
      data: {
        subcategoryId: dto.subcategoryId,
        name: dto.name.trim(),
        subCount: dto.subCount ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'BudgetItem',
        entityId: item.id,
        newValue: item,
      });
    }

    return {
      id: item.id,
      subcategoryId: item.subcategoryId,
      name: item.name,
      subCount: item.subCount,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async updateItem(id: string, dto: UpdateBudgetItemDto, userId?: string) {
    const existing = await this.prisma.budgetItem.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng chi tiết ngân sách (Item).');
    }

    const updated = await this.prisma.budgetItem.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        subCount:
          dto.subCount !== undefined ? dto.subCount : existing.subCount,
        sortOrder:
          dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
        isActive:
          dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'BudgetItem',
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
    }

    return {
      id: updated.id,
      subcategoryId: updated.subcategoryId,
      name: updated.name,
      subCount: updated.subCount,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteItem(id: string, userId?: string) {
    const existing = await this.prisma.budgetItem.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng chi tiết ngân sách (Item).');
    }

    await this.prisma.budgetItem.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'delete',
        entityType: 'BudgetItem',
        entityId: id,
        oldValue: existing,
      });
    }

    return { success: true, id };
  }

  // ==========================================
  // 4. BUDGET TREE & VALUES
  // ==========================================

  async getBudgetTree(
    year: number = 2026,
    projectId?: string,
    opts: { includeUnassigned?: boolean } = {},
  ) {
    if (projectId && projectId !== 'all') {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    const valueWhere: any = {
      year,
      OR: [
        { categoryId: { not: null }, category: { archivedAt: null } },
        { subcategoryId: { not: null }, subcategory: { archivedAt: null } },
        { itemId: { not: null }, item: { archivedAt: null } },
      ],
    };
    if (projectId === 'all') {
      // Aggregates global bucket (projectId IS NULL) + all ACTIVE project buckets
      valueWhere.AND = [
        {
          OR: [
            { projectId: null },
            { project: { archivedAt: null } },
          ],
        },
      ];
    } else if (projectId) {
      valueWhere.projectId = projectId;
      valueWhere.project = { archivedAt: null };
    } else {
      // Omitted / null / empty: ONLY global bucket (projectId IS NULL)
      valueWhere.projectId = null;
    }

    // The three reads are independent: run them concurrently.
    // Actual-cost failures stay non-fatal as before.
    const [categories, values, costEntries] = await settleInOrder([
      this.prisma.budgetCategory.findMany({
        where: { year, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          subcategories: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              items: {
                where: { archivedAt: null },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      }),
      this.prisma.budgetValue.findMany({
        where: valueWhere,
        orderBy: { updatedAt: 'desc' },
      }),
      (async (): Promise<BudgetCostEntry[]> => {
        try {
          return await this.loadBudgetCostEntries(year, projectId);
        } catch (err) {
          console.warn('Failed to load expense records for budget tree:', err);
          return [];
        }
      })(),
    ]);

    const categoryValueMap = new Map<string, number>();
    const categoryHasDirect = new Set<string>();
    const itemValueMap = new Map<string, number>();
    const backupValueMap = new Map<string, number>();

    let latestUpdatedAt: Date | null = null;
    for (const v of values) {
      const amount = Number(v.amount);
      if (v.categoryId) {
        categoryHasDirect.add(v.categoryId);
        const key = `${v.categoryId}_${v.month}`;
        if (projectId === 'all') {
          categoryValueMap.set(key, (categoryValueMap.get(key) || 0) + amount);
        } else {
          // Single bucket: set latest value (ordered by updatedAt desc), do not sum duplicate rows
          if (!categoryValueMap.has(key)) {
            categoryValueMap.set(key, amount);
          }
        }
      } else if (v.isBackup && v.subcategoryId) {
        const key = `${v.subcategoryId}_${v.month}`;
        if (projectId === 'all') {
          backupValueMap.set(key, (backupValueMap.get(key) || 0) + amount);
        } else {
          if (!backupValueMap.has(key)) {
            backupValueMap.set(key, amount);
          }
        }
      } else if (v.itemId) {
        const key = `${v.itemId}_${v.month}`;
        if (projectId === 'all') {
          itemValueMap.set(key, (itemValueMap.get(key) || 0) + amount);
        } else {
          if (!itemValueMap.has(key)) {
            itemValueMap.set(key, amount);
          }
        }
      }
      if (v.updatedAt && (!latestUpdatedAt || v.updatedAt > latestUpdatedAt)) {
        latestUpdatedAt = v.updatedAt;
      }
    }

    if (!latestUpdatedAt) {
      for (const cat of categories) {
        if (cat.updatedAt && (!latestUpdatedAt || cat.updatedAt > latestUpdatedAt)) {
          latestUpdatedAt = cat.updatedAt;
        }
      }
    }

    // Map: node (item/sub/cat id) -> { '1': number, ..., '12': number }
    const nodeActualMap = new Map<string, Record<string, number>>();
    for (const e of costEntries) {
      if (!e.nodeId) continue;
      if (!nodeActualMap.has(e.nodeId)) {
        nodeActualMap.set(e.nodeId, this.initMonthsMap());
      }
      const m = nodeActualMap.get(e.nodeId)!;
      const monthStr = e.month.toString();
      m[monthStr] = (m[monthStr] || 0) + e.actual;
    }

    const treeCategories = categories.map((cat) => {
      const catActualMonths = this.initMonthsMap();

      const subcategories = cat.subcategories.map((sub) => {
        const backupMonths = this.initMonthsMap();
        for (let m = 1; m <= 12; m++) {
          const val = backupValueMap.get(`${sub.id}_${m}`);
          if (val !== undefined) {
            backupMonths[m.toString()] = val;
          }
        }

        const subActualMonths = this.initMonthsMap();

        const items = sub.items.map((it) => {
          const itemMonths = this.initMonthsMap();
          for (let m = 1; m <= 12; m++) {
            const val = itemValueMap.get(`${it.id}_${m}`);
            if (val !== undefined) {
              itemMonths[m.toString()] = val;
            }
          }

          const itemActuals = nodeActualMap.get(it.id) || this.initMonthsMap();

          // Roll up item actuals to subcategory
          let itemPlanTotal = 0;
          let itemActualTotal = 0;
          for (let m = 1; m <= 12; m++) {
            const mStr = m.toString();
            subActualMonths[mStr] += itemActuals[mStr] || 0;
            itemPlanTotal += itemMonths[mStr] || 0;
            itemActualTotal += itemActuals[mStr] || 0;
          }

          const itemRemaining = itemPlanTotal - itemActualTotal;
          const itemUsagePercent =
            itemPlanTotal > 0
              ? Number(((itemActualTotal / itemPlanTotal) * 100).toFixed(2))
              : null;

          return {
            id: it.id,
            name: it.name,
            subCount: it.subCount,
            sortOrder: it.sortOrder,
            months: itemMonths,
            actuals: itemActuals,
            planTotal: itemPlanTotal,
            actualTotal: itemActualTotal,
            remaining: itemRemaining,
            usagePercent: itemUsagePercent,
          };
        });

        // Add any direct expense lines mapped directly to this subcategory
        const directSubActuals = nodeActualMap.get(sub.id);
        if (directSubActuals) {
          for (let m = 1; m <= 12; m++) {
            const mStr = m.toString();
            subActualMonths[mStr] += directSubActuals[mStr] || 0;
          }
        }

        // Roll up sub actuals to category
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString();
          catActualMonths[mStr] += subActualMonths[mStr] || 0;
        }

        // Subcategory plan total
        let subPlanTotal = 0;
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString();
          let itemSumMonth = 0;
          for (const it of items) {
            itemSumMonth += it.months[mStr] || 0;
          }
          subPlanTotal += itemSumMonth + (backupMonths[mStr] || 0);
        }

        let subActualTotal = 0;
        for (let m = 1; m <= 12; m++) {
          subActualTotal += subActualMonths[m.toString()] || 0;
        }
        const subRemaining = subPlanTotal - subActualTotal;
        const subUsagePercent =
          subPlanTotal > 0
            ? Number(((subActualTotal / subPlanTotal) * 100).toFixed(2))
            : null;

        return {
          id: sub.id,
          name: sub.name,
          totalName: sub.totalName,
          sortOrder: sub.sortOrder,
          backup: {
            percent: sub.backupPercent ? Number(sub.backupPercent) : 0,
            months: backupMonths,
          },
          actuals: subActualMonths,
          planTotal: subPlanTotal,
          actualTotal: subActualTotal,
          remaining: subRemaining,
          usagePercent: subUsagePercent,
          items,
        };
      });

      // Yêu cầu 8.1: Category months must be direct category values only.
      // If no direct (categoryId, projectId, year) values exist, return {} and catPlanTotal = 0.
      // Do NOT rollup from subcategories/items.
      const catMonths: Record<string, number> = {};
      let catPlanTotal = 0;

      if (categoryHasDirect.has(cat.id)) {
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString();
          const directVal = categoryValueMap.get(`${cat.id}_${m}`);
          const valRounded =
            directVal !== undefined ? Math.max(0, Math.round(directVal)) : 0;
          catMonths[mStr] = valRounded;
          catPlanTotal += valRounded;
        }
      }

      // Add any direct expense lines mapped directly to this category
      const directCatActuals = nodeActualMap.get(cat.id);
      if (directCatActuals) {
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString();
          catActualMonths[mStr] += directCatActuals[mStr] || 0;
        }
      }

      let catActualTotal = 0;
      for (let m = 1; m <= 12; m++) {
        catActualTotal += catActualMonths[m.toString()] || 0;
      }

      const remaining = catPlanTotal - catActualTotal;
      const usagePercent =
        catPlanTotal > 0
          ? Number(((catActualTotal / catPlanTotal) * 100).toFixed(2))
          : null;

      return {
        id: cat.id,
        name: cat.name,
        percent: Number(cat.percent),
        sortOrder: cat.sortOrder,
        year: cat.year,
        months: catMonths,
        planTotal: catPlanTotal,
        actualTotal: catActualTotal,
        remaining,
        usagePercent,
        actuals: catActualMonths,
        subcategories,
      };
    });

    // BE_requirement_29_09_26 §3: costs whose category is not in this tree (project lines without
    // categoryId, e.g. "Vật phẩm" issued from stock, or a category of another year / deleted) are
    // listed as virtual groups per "hạng mục lớn", so the tree adds up to the same total as
    // expense-budgets/dashboard.actualSpent.
    const treeNodeIds = new Set<string>();
    for (const cat of categories) {
      treeNodeIds.add(cat.id);
      for (const sub of cat.subcategories) {
        treeNodeIds.add(sub.id);
        for (const it of sub.items) treeNodeIds.add(it.id);
      }
    }
    const unassignedGroups = new Map<string, { name: string; actuals: Record<string, number> }>();
    for (const e of opts.includeUnassigned ? costEntries : []) {
      if (e.nodeId && treeNodeIds.has(e.nodeId)) continue;
      if (!e.actual) continue;
      const name = (e.groupName || '').trim() || UNASSIGNED_GROUP_FALLBACK_NAME;
      const key = name.normalize('NFC').toLowerCase();
      if (!unassignedGroups.has(key)) {
        unassignedGroups.set(key, { name, actuals: this.initMonthsMap() });
      }
      const group = unassignedGroups.get(key)!;
      const monthStr = e.month.toString();
      group.actuals[monthStr] = (group.actuals[monthStr] || 0) + e.actual;
    }
    const unassignedCategories = Array.from(unassignedGroups.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((group) => {
        let actualTotal = 0;
        for (let m = 1; m <= 12; m++) actualTotal += group.actuals[m.toString()] || 0;
        return {
          id: null,
          name: group.name,
          unassigned: true,
          percent: 0,
          sortOrder: Number.MAX_SAFE_INTEGER,
          year,
          months: {} as Record<string, number>,
          planTotal: 0,
          actualTotal,
          remaining: -actualTotal,
          usagePercent: null,
          actuals: group.actuals,
          subcategories: [],
        };
      });

    const allCategories = [...treeCategories, ...unassignedCategories];
    const actualTotal = allCategories.reduce((sum, c) => sum + (c.actualTotal || 0), 0);

    return {
      categories: allCategories,
      actualTotal,
      unassignedActualTotal: unassignedCategories.reduce((sum, c) => sum + c.actualTotal, 0),
      updatedAt: latestUpdatedAt ? latestUpdatedAt.toISOString() : null,
    };
  }

  async getCategoryBudgetActuals(year: number = 2026, projectId?: string) {
    const [categories, costEntries] = await settleInOrder([
      this.prisma.budgetCategory.findMany({
        where: { year, archivedAt: null },
        include: {
          subcategories: {
            where: { archivedAt: null },
            include: {
              items: {
                where: { archivedAt: null },
              },
            },
          },
        },
      }),
      this.loadBudgetCostEntries(year, projectId),
    ]);

    const categoryIdByNodeId = new Map<string, string>();
    for (const cat of categories) {
      categoryIdByNodeId.set(cat.id, cat.id);
      for (const sub of cat.subcategories) {
        categoryIdByNodeId.set(sub.id, cat.id);
        for (const it of sub.items) {
          categoryIdByNodeId.set(it.id, cat.id);
        }
      }
    }

    const actualsByCatId: Record<string, Record<string, number>> = {};
    for (const cat of categories) {
      actualsByCatId[cat.id] = this.initMonthsMap();
      actualsByCatId[cat.id]['total'] = 0;
    }

    for (const e of costEntries) {
      if (!e.nodeId) continue;
      const targetCatId = categoryIdByNodeId.get(e.nodeId);
      if (!targetCatId || !actualsByCatId[targetCatId]) continue;
      const monthStr = e.month.toString();
      actualsByCatId[targetCatId][monthStr] =
        (actualsByCatId[targetCatId][monthStr] || 0) + e.actual;
      actualsByCatId[targetCatId]['total'] =
        (actualsByCatId[targetCatId]['total'] || 0) + e.actual;
    }

    const result: Record<string, any> = {};
    for (const cat of categories) {
      result[cat.id] = actualsByCatId[cat.id];
      // Backward compatibility with lowercase name
      result[cat.name.toLowerCase()] = actualsByCatId[cat.id];
    }

    return result;
  }

  // ==========================================
  // SEPTEMBER SPEC: CATEGORY SUMMARY REPORT
  // ==========================================

  async getCategorySummaryReport(year: number = 2026, projectId?: string) {
    if (projectId && projectId !== 'all') {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    // Independent reads run concurrently; actual-cost failures stay non-fatal.
    const [categories, costEntries] = await settleInOrder([
      this.prisma.budgetCategory.findMany({
        where: { year, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          subcategories: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              items: {
                where: { archivedAt: null },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      }),
      (async (): Promise<BudgetCostEntry[]> => {
        try {
          return await this.loadBudgetCostEntries(year, projectId);
        } catch (err) {
          console.warn('Query expenseRecord failed in getCategorySummaryReport:', err);
          return [];
        }
      })(),
    ]);

    const itemParentMap = new Map<string, { subId: string; catId: string }>();
    const subParentMap = new Map<string, { catId: string }>();
    const validCatIds = new Set<string>();

    for (const cat of categories) {
      validCatIds.add(cat.id);
      for (const sub of cat.subcategories) {
        subParentMap.set(sub.id, { catId: cat.id });
        for (const it of sub.items) {
          itemParentMap.set(it.id, { subId: sub.id, catId: cat.id });
        }
      }
    }

    const nodeTotals = new Map<string, Array<{ planned: number; actual: number }>>();
    const getOrInitNode = (id: string) => {
      if (!nodeTotals.has(id)) {
        nodeTotals.set(
          id,
          Array.from({ length: 12 }, () => ({ planned: 0, actual: 0 })),
        );
      }
      return nodeTotals.get(id)!;
    };

    for (const e of costEntries) {
      const monthIdx = e.month - 1;
      if (monthIdx < 0 || monthIdx > 11 || !e.nodeId) continue;
      {
        const actualAmount = e.actual;
        const plannedAmount = e.planned;
        const catIdForLine = e.nodeId;

        if (itemParentMap.has(catIdForLine)) {
          const { subId, catId } = itemParentMap.get(catIdForLine)!;
          const itArr = getOrInitNode(catIdForLine);
          itArr[monthIdx].planned += plannedAmount;
          itArr[monthIdx].actual += actualAmount;

          const subArr = getOrInitNode(subId);
          subArr[monthIdx].planned += plannedAmount;
          subArr[monthIdx].actual += actualAmount;

          const catArr = getOrInitNode(catId);
          catArr[monthIdx].planned += plannedAmount;
          catArr[monthIdx].actual += actualAmount;
        } else if (subParentMap.has(catIdForLine)) {
          const { catId } = subParentMap.get(catIdForLine)!;
          const subArr = getOrInitNode(catIdForLine);
          subArr[monthIdx].planned += plannedAmount;
          subArr[monthIdx].actual += actualAmount;

          const catArr = getOrInitNode(catId);
          catArr[monthIdx].planned += plannedAmount;
          catArr[monthIdx].actual += actualAmount;
        } else if (validCatIds.has(catIdForLine)) {
          const catArr = getOrInitNode(catIdForLine);
          catArr[monthIdx].planned += plannedAmount;
          catArr[monthIdx].actual += actualAmount;
        }
      }
    }

    const buildMonthsAndYearTotal = (nodeId: string) => {
      const arr = nodeTotals.get(nodeId) || Array.from({ length: 12 }, () => ({ planned: 0, actual: 0 }));
      const months: Record<string, { planned_total: number; actual_total: number }> = {};
      let planned_total = 0;
      let actual_total = 0;

      for (let i = 0; i < 12; i++) {
        const key = String(i + 1).padStart(2, '0');
        const p = arr[i].planned;
        const a = arr[i].actual;
        months[key] = { planned_total: p, actual_total: a };
        planned_total += p;
        actual_total += a;
      }

      const remaining = planned_total - actual_total;
      const usage_percent =
        planned_total > 0
          ? Number(((actual_total / planned_total) * 100).toFixed(4))
          : null;

      return {
        months,
        year_total: {
          planned_total,
          actual_total,
          remaining,
          usage_percent,
        },
      };
    };

    let grandPlanned = 0;
    let grandActual = 0;

    const formattedCategories = categories.map((cat) => {
      const catData = buildMonthsAndYearTotal(cat.id);
      grandPlanned += catData.year_total.planned_total;
      grandActual += catData.year_total.actual_total;

      const subcategories = cat.subcategories.map((sub) => {
        const subData = buildMonthsAndYearTotal(sub.id);

        const items = sub.items.map((it) => {
          const itData = buildMonthsAndYearTotal(it.id);
          return {
            item_id: it.id,
            id: it.id,
            item_name: it.name,
            name: it.name,
            parent_id: sub.id,
            sort_order: it.sortOrder,
            months: itData.months,
            year_total: itData.year_total,
          };
        });

        return {
          subcategory_id: sub.id,
          id: sub.id,
          subcategory_name: sub.name,
          name: sub.name,
          parent_id: cat.id,
          sort_order: sub.sortOrder,
          months: subData.months,
          year_total: subData.year_total,
          items,
        };
      });

      return {
        category_id: cat.id,
        id: cat.id,
        category_name: cat.name,
        name: cat.name,
        parent_id: null,
        percent: Number(cat.percent),
        sort_order: cat.sortOrder,
        months: catData.months,
        year_total: catData.year_total,
        subcategories,
      };
    });

    const grandRemaining = grandPlanned - grandActual;
    const grandUsagePercent =
      grandPlanned > 0
        ? Number(((grandActual / grandPlanned) * 100).toFixed(4))
        : null;

    return {
      year,
      project_id: projectId && projectId !== 'all' ? projectId : null,
      currency: 'VND',
      categories: formattedCategories,
      grand_total: {
        planned_total: grandPlanned,
        actual_total: grandActual,
        remaining: grandRemaining,
        usage_percent: grandUsagePercent,
      },
      calculated_at: new Date().toISOString(),
    };
  }

  async bulkSaveValues(dto: BulkSaveBudgetValuesDto, userId?: string) {
    if (!dto.year) {
      throw new BadRequestException('Năm tài chính (year) là bắt buộc.');
    }

    let targetProjectId: string | null = null;
    if (dto.projectId !== undefined && dto.projectId !== null) {
      const pId = String(dto.projectId).trim();
      if (pId === '' || pId.toLowerCase() === 'all') {
        throw new BadRequestException(
          'Mã dự án không hợp lệ. Để lưu ngân sách chung, hãy để trống projectId hoặc gửi null.',
        );
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(pId)) {
        throw new BadRequestException(
          'Mã dự án không hợp lệ. Để lưu ngân sách chung, hãy để trống projectId hoặc gửi null.',
        );
      }

      const project = await this.prisma.project.findFirst({
        where: { id: pId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Không tìm thấy dự án với ID đã cung cấp.');
      }
      targetProjectId = pId;
    }

    const rawList = dto.values || [];
    if (!Array.isArray(rawList)) {
      throw new BadRequestException('Danh sách giá trị ngân sách không hợp lệ.');
    }

    if (rawList.length === 0) {
      return {
        success: true,
        count: 0,
        created: 0,
        updated: 0,
        message: 'Cập nhật ngân sách thành công',
        year: dto.year,
        projectId: targetProjectId,
      };
    }

    // Filter out field === 'actual' (BR-006 / B2.1: actual values are auto-aggregated from Project Expense)
    const valuesList = rawList.filter(
      (item) => (item as any).field !== 'actual',
    );

    if (valuesList.length === 0) {
      return {
        success: true,
        count: 0,
        created: 0,
        updated: 0,
        message: 'Cập nhật ngân sách thành công',
        year: dto.year,
        projectId: targetProjectId,
      };
    }

    // Pre-validate existence of IDs referenced in valuesList to prevent FK violation crashes
    const categoryIdsToCheck = Array.from(
      new Set(
        valuesList
          .map((v) => v.categoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const itemIdsToCheck = Array.from(
      new Set(
        valuesList
          .map((v) => v.itemId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const subcategoryIdsToCheck = Array.from(
      new Set(
        valuesList
          .map((v) => v.subcategoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const [existingCats, existingItems, existingSubs] = await Promise.all([
      categoryIdsToCheck.length > 0
        ? this.prisma.budgetCategory.findMany({
            where: {
              id: { in: categoryIdsToCheck },
              year: dto.year,
              archivedAt: null,
            },
            select: { id: true },
          })
        : [],
      itemIdsToCheck.length > 0
        ? this.prisma.budgetItem.findMany({
            where: { id: { in: itemIdsToCheck }, archivedAt: null },
            select: { id: true },
          })
        : [],
      subcategoryIdsToCheck.length > 0
        ? this.prisma.budgetSubcategory.findMany({
            where: { id: { in: subcategoryIdsToCheck }, archivedAt: null },
            select: { id: true },
          })
        : [],
    ]);

    const validCatIdSet = new Set(existingCats.map((c) => c.id));
    const validItemIdSet = new Set(existingItems.map((i) => i.id));
    const validSubIdSet = new Set(existingSubs.map((s) => s.id));

    const cellErrors: Array<{
      categoryId?: string | null;
      itemId: string | null;
      subcategoryId: string | null;
      isBackup: boolean;
      month: number;
      message: string;
    }> = [];

    for (const item of valuesList) {
      const categoryId = item.categoryId ?? null;
      const itemId = item.itemId ?? null;
      let subcategoryId = item.subcategoryId ?? null;
      let isBackup = Boolean(item.isBackup);
      if (!isBackup && subcategoryId && !itemId && !categoryId) {
        isBackup = true;
      }
      const month = item.month;
      const amount = item.amount;

      if (
        amount === undefined ||
        amount === null ||
        isNaN(Number(amount)) ||
        Number(amount) < 0
      ) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: 'amount không được âm',
        });
      }

      if (!month || month < 1 || month > 12) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: 'month phải từ 1 đến 12',
        });
      }

      if (isBackup && !subcategoryId) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: 'subcategoryId là bắt buộc đối với dòng BACK UP',
        });
      }

      if (!isBackup && !itemId && !categoryId && !subcategoryId) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message:
            'itemId, subcategoryId hoặc categoryId là bắt buộc đối với dòng dữ liệu kế hoạch',
        });
      }

      if (categoryId && !validCatIdSet.has(categoryId)) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: `categoryId không tồn tại hoặc không thuộc năm ${dto.year}: ${categoryId}`,
        });
      }

      if (itemId && !validItemIdSet.has(itemId)) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: `itemId không tồn tại: ${itemId}`,
        });
      }

      if (subcategoryId && !validSubIdSet.has(subcategoryId)) {
        cellErrors.push({
          categoryId,
          itemId,
          subcategoryId,
          isBackup,
          month,
          message: `subcategoryId không tồn tại: ${subcategoryId}`,
        });
      }
    }

    if (cellErrors.length > 0) {
      throw new BadRequestException({
        message: 'Có ô không hợp lệ',
        errors: cellErrors,
      });
    }

    // Version conflict check (Optimistic Concurrency)
    if (dto.baseUpdatedAt) {
      const latestExisting = await this.prisma.budgetValue.findFirst({
        where: {
          year: dto.year,
          projectId: targetProjectId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (latestExisting && latestExisting.updatedAt) {
        const baseTime = new Date(dto.baseUpdatedAt).getTime();
        const currentTime = latestExisting.updatedAt.getTime();
        if (currentTime > baseTime) {
          throw new HttpException(
            {
              message:
                'Dữ liệu đã được cập nhật bởi người khác. Vui lòng tải lại.',
              currentUpdatedAt: latestExisting.updatedAt.toISOString(),
            },
            HttpStatus.PRECONDITION_FAILED,
          );
        }
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    if (valuesList.length > 0) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const item of valuesList) {
            const amountNum = Math.max(0, Math.round(Number(item.amount || 0)));
            const amountDecimal = new Decimal(amountNum);

            if (item.itemId) {
              const existing = await tx.budgetValue.findFirst({
                where: {
                  itemId: item.itemId,
                  isBackup: false,
                  projectId: targetProjectId,
                  year: dto.year,
                  month: item.month,
                },
              });

              if (existing) {
                await tx.budgetValue.update({
                  where: { id: existing.id },
                  data: { amount: amountDecimal },
                });
                updatedCount++;
              } else {
                await tx.budgetValue.create({
                  data: {
                    itemId: item.itemId,
                    isBackup: false,
                    projectId: targetProjectId,
                    year: dto.year,
                    month: item.month,
                    amount: amountDecimal,
                  },
                });
                createdCount++;
              }
            } else if (item.isBackup || (item.subcategoryId && !item.categoryId)) {
              const subId = item.subcategoryId!;
              const existing = await tx.budgetValue.findFirst({
                where: {
                  subcategoryId: subId,
                  isBackup: true,
                  projectId: targetProjectId,
                  year: dto.year,
                  month: item.month,
                },
              });

              if (existing) {
                await tx.budgetValue.update({
                  where: { id: existing.id },
                  data: { amount: amountDecimal },
                });
                updatedCount++;
              } else {
                await tx.budgetValue.create({
                  data: {
                    subcategoryId: subId,
                    isBackup: true,
                    projectId: targetProjectId,
                    year: dto.year,
                    month: item.month,
                    amount: amountDecimal,
                  },
                });
                createdCount++;
              }
            } else if (item.categoryId) {
              const existing = await tx.budgetValue.findFirst({
                where: {
                  categoryId: item.categoryId,
                  projectId: targetProjectId,
                  year: dto.year,
                  month: item.month,
                },
              });

              if (existing) {
                await tx.budgetValue.update({
                  where: { id: existing.id },
                  data: { amount: amountDecimal },
                });
                updatedCount++;
              } else {
                await tx.budgetValue.create({
                  data: {
                    categoryId: item.categoryId,
                    projectId: targetProjectId,
                    year: dto.year,
                    month: item.month,
                    amount: amountDecimal,
                  },
                });
                createdCount++;
              }
            }
          }
        });
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2003'
        ) {
          throw new BadRequestException({
            message: 'Có ô không hợp lệ (tham chiếu ID không tồn tại)',
            errors: [
              {
                categoryId: valuesList[0]?.categoryId ?? null,
                itemId: valuesList[0]?.itemId ?? null,
                subcategoryId: valuesList[0]?.subcategoryId ?? null,
                isBackup: Boolean(valuesList[0]?.isBackup),
                month: valuesList[0]?.month ?? 1,
                message: 'Khóa ngoại không tồn tại trong cơ sở dữ liệu',
              },
            ],
          });
        }
        throw err;
      }
    }

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'BudgetValue',
        entityId: targetProjectId
          ? `project_${targetProjectId}_year_${dto.year}`
          : `year_${dto.year}`,
        newValue: {
          count: valuesList.length,
          created: createdCount,
          updated: updatedCount,
          year: dto.year,
          projectId: targetProjectId,
        },
      });
    }

    return {
      success: true,
      count: valuesList.length,
      created: createdCount,
      updated: updatedCount,
      message: 'Cập nhật ngân sách thành công',
      year: dto.year,
      projectId: targetProjectId,
    };
  }

  // ==========================================
  // 4. BUDGET SPEC APIS (SUMMARY, SAVE, DASHBOARD)
  // ==========================================

  async getBudgetSummary(projectId?: string, year: number = 2026) {
    const valueWhere: any = {
      year,
      OR: [
        { categoryId: { not: null }, category: { archivedAt: null } },
        { subcategoryId: { not: null }, subcategory: { archivedAt: null } },
        { itemId: { not: null }, item: { archivedAt: null } },
      ],
    };
    if (projectId && projectId !== 'all') {
      valueWhere.projectId = projectId;
      valueWhere.project = { archivedAt: null };
    } else if (projectId === 'all') {
      valueWhere.AND = [
        {
          OR: [
            { projectId: null },
            { project: { archivedAt: null } },
          ],
        },
      ];
    } else {
      valueWhere.projectId = null;
    }

    const [categories, values] = await settleInOrder([
      this.prisma.budgetCategory.findMany({
        where: { year, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          subcategories: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              items: {
                where: { archivedAt: null },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      }),
      this.prisma.budgetValue.findMany({
        where: valueWhere,
      }),
    ]);

    const itemMonthlySum = new Map<string, number[]>();
    const subcatBackupMonthlySum = new Map<string, number[]>();
    const subcatDirectMonthlySum = new Map<string, number[]>();
    const catDirectMonthlySum = new Map<string, number[]>();

    for (const v of values) {
      const m = v.month - 1;
      if (m < 0 || m > 11) continue;
      const amt = Number(v.amount || 0);

      if (v.categoryId) {
        if (!catDirectMonthlySum.has(v.categoryId)) {
          catDirectMonthlySum.set(v.categoryId, Array(12).fill(0));
        }
        catDirectMonthlySum.get(v.categoryId)![m] += amt;
      } else if (v.isBackup && v.subcategoryId) {
        if (!subcatBackupMonthlySum.has(v.subcategoryId)) {
          subcatBackupMonthlySum.set(v.subcategoryId, Array(12).fill(0));
        }
        subcatBackupMonthlySum.get(v.subcategoryId)![m] += amt;
      } else if (v.itemId) {
        if (!itemMonthlySum.has(v.itemId)) {
          itemMonthlySum.set(v.itemId, Array(12).fill(0));
        }
        itemMonthlySum.get(v.itemId)![m] += amt;
      } else if (v.subcategoryId) {
        if (!subcatDirectMonthlySum.has(v.subcategoryId)) {
          subcatDirectMonthlySum.set(v.subcategoryId, Array(12).fill(0));
        }
        subcatDirectMonthlySum.get(v.subcategoryId)![m] += amt;
      }
    }

    // Pass 1: compute months and yearTotal for all nodes
    const computedCategories = categories.map((cat) => {
      const catMonths = Array(12).fill(0);

      const computedSubcategories = cat.subcategories.map((sub) => {
        const subMonths = Array(12).fill(0);

        const computedItems = sub.items.map((it) => {
          const itMonths = itemMonthlySum.get(it.id) || Array(12).fill(0);
          const itYearTotal = itMonths.reduce((a, b) => a + b, 0);

          for (let m = 0; m < 12; m++) {
            subMonths[m] += itMonths[m];
          }

          return {
            id: it.id,
            name: it.name,
            parentId: sub.id,
            months: itMonths,
            yearTotal: itYearTotal,
            percentage: 0,
            children: [],
          };
        });

        // Add backup or direct values of subcategory
        const backupMonths = subcatBackupMonthlySum.get(sub.id);
        if (backupMonths) {
          for (let m = 0; m < 12; m++) {
            subMonths[m] += backupMonths[m];
          }
        }
        const directMonths = subcatDirectMonthlySum.get(sub.id);
        if (directMonths) {
          for (let m = 0; m < 12; m++) {
            subMonths[m] += directMonths[m];
          }
        }

        const subYearTotal = subMonths.reduce((a, b) => a + b, 0);

        for (let m = 0; m < 12; m++) {
          catMonths[m] += subMonths[m];
        }

        return {
          id: sub.id,
          name: sub.name,
          parentId: cat.id,
          months: subMonths,
          yearTotal: subYearTotal,
          percentage: 0,
          children: computedItems,
        };
      });

      const directCatMonths = catDirectMonthlySum.get(cat.id);
      if (directCatMonths) {
        for (let m = 0; m < 12; m++) {
          if (directCatMonths[m] > 0 || cat.subcategories.length === 0) {
            catMonths[m] = directCatMonths[m];
          }
        }
      }

      const catYearTotal = catMonths.reduce((a, b) => a + b, 0);

      return {
        id: cat.id,
        name: cat.name,
        parentId: null,
        months: catMonths,
        yearTotal: catYearTotal,
        percentage: 0,
        children: computedSubcategories,
      };
    });

    const totalBudget = computedCategories.reduce(
      (sum, cat) => sum + cat.yearTotal,
      0,
    );

    // Pass 2: compute percentage
    const finalizeNode = (node: any) => {
      node.percentage =
        totalBudget > 0
          ? Number(((node.yearTotal / totalBudget) * 100).toFixed(2))
          : 0;
      if (node.children && node.children.length > 0) {
        node.children.forEach(finalizeNode);
      }
    };

    computedCategories.forEach(finalizeNode);

    return {
      projectId: projectId || 'all',
      year,
      totalBudget,
      categories: computedCategories,
    };
  }

  async saveBudgetByProjectAndYear(
    projectId: string,
    year: number,
    items: { categoryId: string; month: number; amount: number }[],
    userId?: string,
  ) {
    if (projectId && projectId !== 'all') {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      });
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    const targetProjectId = projectId === 'all' ? null : projectId;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.amount < 0) {
          throw new BadRequestException('Số tiền không được âm.');
        }
        if (item.month < 1 || item.month > 12) {
          throw new BadRequestException('Tháng phải từ 1 đến 12.');
        }

        const amountDecimal = new Decimal(item.amount);

        // Check if categoryId is BudgetItem
        const budgetItem = await tx.budgetItem.findFirst({
          where: { id: item.categoryId, archivedAt: null },
        });

        if (budgetItem) {
          const existing = await tx.budgetValue.findFirst({
            where: {
              itemId: item.categoryId,
              isBackup: false,
              projectId: targetProjectId,
              year,
              month: item.month,
            },
          });

          if (existing) {
            await tx.budgetValue.update({
              where: { id: existing.id },
              data: { amount: amountDecimal },
            });
          } else {
            await tx.budgetValue.create({
              data: {
                itemId: item.categoryId,
                isBackup: false,
                projectId: targetProjectId,
                year,
                month: item.month,
                amount: amountDecimal,
              },
            });
          }
          continue;
        }

        // Check if categoryId is BudgetSubcategory
        const budgetSub = await tx.budgetSubcategory.findFirst({
          where: { id: item.categoryId, archivedAt: null },
        });

        if (budgetSub) {
          const existing = await tx.budgetValue.findFirst({
            where: {
              subcategoryId: item.categoryId,
              isBackup: false,
              projectId: targetProjectId,
              year,
              month: item.month,
            },
          });

          if (existing) {
            await tx.budgetValue.update({
              where: { id: existing.id },
              data: { amount: amountDecimal },
            });
          } else {
            await tx.budgetValue.create({
              data: {
                subcategoryId: item.categoryId,
                isBackup: false,
                projectId: targetProjectId,
                year,
                month: item.month,
                amount: amountDecimal,
              },
            });
          }
          continue;
        }

        // Check if categoryId is BudgetCategory
        const budgetCat = await tx.budgetCategory.findFirst({
          where: { id: item.categoryId, archivedAt: null },
        });

        if (budgetCat) {
          const existing = await tx.budgetValue.findFirst({
            where: {
              categoryId: item.categoryId,
              projectId: targetProjectId,
              year,
              month: item.month,
            },
          });

          if (item.amount === 0) {
            if (existing) {
              await tx.budgetValue.delete({
                where: { id: existing.id },
              });
            }
          } else if (existing) {
            await tx.budgetValue.update({
              where: { id: existing.id },
              data: { amount: amountDecimal },
            });
          } else {
            await tx.budgetValue.create({
              data: {
                categoryId: item.categoryId,
                projectId: targetProjectId,
                year,
                month: item.month,
                amount: amountDecimal,
              },
            });
          }
          continue;
        }

        // If not found in BudgetItem, BudgetSubcategory or BudgetCategory
        throw new NotFoundException(
          `Không tìm thấy hạng mục ngân sách với id: ${item.categoryId}`,
        );
      }
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'BudgetValue',
        entityId: `project_${projectId}_year_${year}`,
        newValue: { count: items.length, year, projectId },
      });
    }

    return {
      success: true,
      count: items.length,
      projectId,
      year,
    };
  }

  async getBudgetDashboard(projectId?: string, year: number = 2026) {
    // Summary (plan) and actual costs are independent reads.
    const [summary, costEntries] = await settleInOrder([
      this.getBudgetSummary(projectId, year),
      this.loadBudgetCostEntries(year, projectId),
    ]);
    const totalBudget = summary.totalBudget;

    let actualSpent = 0;
    for (const e of costEntries) {
      actualSpent += e.actual;
    }

    const remainingBudget = totalBudget - actualSpent;
    const usedPercentage =
      totalBudget > 0
        ? Number(((actualSpent / totalBudget) * 100).toFixed(2))
        : null;

    const categories = summary.categories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      budget: c.yearTotal,
      percentage: totalBudget > 0 ? c.percentage : null,
    }));

    return {
      totalBudget,
      actualSpent,
      remainingBudget,
      usedPercentage,
      categories,
    };
  }

  // ==========================================
  // SEPTEMBER SPEC: DYNAMIC CATEGORY BUDGET REPORT
  // ==========================================

  async getCategoryBudgetReport(
    year: number = 2026,
    month?: number,
    projectId?: string,
  ) {
    // Summary (plan) and actual costs are independent reads.
    const [summary, allCostEntries] = await settleInOrder([
      this.getBudgetSummary(projectId, year),
      this.loadBudgetCostEntries(year, projectId),
    ]);
    const costEntries = month
      ? allCostEntries.filter((e) => e.month === month)
      : allCostEntries;

    // Build map of categoryId -> Category
    const categoryMap = new Map<string, any>();
    for (const cat of summary.categories) {
      const planAmount =
        month !== undefined && month >= 1 && month <= 12
          ? cat.months[month - 1] || 0
          : cat.yearTotal;

      categoryMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        plan: planAmount,
        actual: 0,
        remaining: 0,
        usagePercent: null,
      });

      // Also map subcategories and items so lines referencing them rollup to top Category
      if (cat.children) {
        for (const sub of cat.children) {
          categoryMap.set(sub.id, categoryMap.get(cat.id));
          if (sub.children) {
            for (const it of sub.children) {
              categoryMap.set(it.id, categoryMap.get(cat.id));
            }
          }
        }
      }
    }

    let totalActual = 0;
    for (const e of costEntries) {
      totalActual += e.actual;
      if (e.nodeId && categoryMap.has(e.nodeId)) {
        const targetCat = categoryMap.get(e.nodeId);
        targetCat.actual += e.actual;
      }
    }

    // Finalize category summaries
    const uniqueCategories = summary.categories.map((c) => {
      const entry = categoryMap.get(c.id);
      const plan = entry ? entry.plan : 0;
      const actual = entry ? entry.actual : 0;
      const remaining = plan - actual;
      const usagePercent =
        plan > 0 ? Number(((actual / plan) * 100).toFixed(2)) : null;

      return {
        categoryId: c.id,
        categoryName: c.name,
        plan,
        actual,
        remaining,
        usagePercent,
      };
    });

    const totalPlan = uniqueCategories.reduce((sum, c) => sum + c.plan, 0);
    const totalRemaining = totalPlan - totalActual;
    const totalUsagePercent =
      totalPlan > 0
        ? Number(((totalActual / totalPlan) * 100).toFixed(2))
        : null;

    return {
      year,
      month: month || null,
      projectId: projectId || 'all',
      totalPlan,
      totalActual,
      totalRemaining,
      totalUsagePercent,
      categories: uniqueCategories,
    };
  }

  // ==========================================
  // 6. BUDGET BY PROJECT & EXCEL EXPORT (8-9-26)
  // ==========================================

  async getBudgetByProject(
    year: number = new Date().getFullYear(),
  ): Promise<BudgetByProjectDataDto> {
    const [projects, categories, values] = await settleInOrder([
      this.prisma.project.findMany({
        where: { archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true },
      }),
      this.prisma.budgetCategory.findMany({
        where: { year, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          subcategories: {
            where: { archivedAt: null },
            include: {
              items: { where: { archivedAt: null } },
            },
          },
        },
      }),
      this.prisma.budgetValue.findMany({
        where: {
          year,
          categoryId: { not: null },
          category: { archivedAt: null },
          OR: [
            { projectId: null },
            { project: { archivedAt: null } },
          ],
        },
      }),
    ]);

    // Group values by project (or null for global)
    const projectValuesMap = new Map<string | null, any[]>();
    for (const v of values) {
      const pId = v.projectId ?? null;
      if (!projectValuesMap.has(pId)) {
        projectValuesMap.set(pId, []);
      }
      projectValuesMap.get(pId)!.push(v);
    }

    const computeProjectBudget = (pId: string | null) => {
      const pVals = projectValuesMap.get(pId) || [];
      const categoryDirectVals = new Map<string, Record<string, number>>();
      const itemVals = new Map<string, Record<string, number>>();
      const backupVals = new Map<string, Record<string, number>>();

      for (const v of pVals) {
        const amt = Number(v.amount);
        const mStr = v.month.toString();
        if (v.categoryId) {
          if (!categoryDirectVals.has(v.categoryId)) {
            categoryDirectVals.set(v.categoryId, {});
          }
          const m = categoryDirectVals.get(v.categoryId)!;
          m[mStr] = (m[mStr] || 0) + amt;
        } else if (v.isBackup && v.subcategoryId) {
          if (!backupVals.has(v.subcategoryId)) {
            backupVals.set(v.subcategoryId, {});
          }
          const m = backupVals.get(v.subcategoryId)!;
          m[mStr] = (m[mStr] || 0) + amt;
        } else if (v.itemId) {
          if (!itemVals.has(v.itemId)) {
            itemVals.set(v.itemId, {});
          }
          const m = itemVals.get(v.itemId)!;
          m[mStr] = (m[mStr] || 0) + amt;
        }
      }

      const months = this.initMonthsMap();
      let totalBudget = 0;

      for (const cat of categories) {
        if (categoryDirectVals.has(cat.id)) {
          // Prioritize direct category value
          const catM = categoryDirectVals.get(cat.id)!;
          for (let m = 1; m <= 12; m++) {
            const mStr = m.toString();
            const val = Math.round(Number(catM[mStr] || 0));
            months[mStr] += val;
            totalBudget += val;
          }
        } else {
          // Fallback to legacy subcategories/items
          for (const sub of cat.subcategories) {
            for (const it of sub.items) {
              const itM = itemVals.get(it.id);
              if (itM) {
                for (let m = 1; m <= 12; m++) {
                  const mStr = m.toString();
                  const val = Math.round(Number(itM[mStr] || 0));
                  months[mStr] += val;
                  totalBudget += val;
                }
              }
            }
            const bkM = backupVals.get(sub.id);
            if (bkM) {
              for (let m = 1; m <= 12; m++) {
                const mStr = m.toString();
                const val = Math.round(Number(bkM[mStr] || 0));
                months[mStr] += val;
                totalBudget += val;
              }
            }
          }
        }
      }

      return { totalBudget, months };
    };

    const projectResults: ProjectBudgetItemDto[] = projects.map((p) => {
      const { totalBudget, months } = computeProjectBudget(p.id);
      return {
        projectId: p.id,
        projectName: p.name,
        projectType: p.type,
        totalBudget,
        months,
      };
    });

    // Global budget (projectId = null)
    const globalBudget = computeProjectBudget(null);
    projectResults.push({
      projectId: null,
      projectName: 'Ngân sách chung (Toàn công ty)',
      projectType: 'GLOBAL',
      totalBudget: globalBudget.totalBudget,
      months: globalBudget.months,
    });

    const overallTotal = projectResults.reduce(
      (sum, p) => sum + p.totalBudget,
      0,
    );

    return {
      year,
      totalBudget: overallTotal,
      projects: projectResults,
    };
  }

  async exportBudgetExcel(
    year: number = 2026,
    projectId?: string,
  ): Promise<Buffer> {
    const tree = await this.getBudgetTree(year, projectId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MKT Hub';
    workbook.created = new Date();

    const sheetName = `Ngân sách ${year}`.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    // Title row
    worksheet.mergeCells('A1', 'P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `KẾ HOẠCH NGÂN SÁCH MARKETING NĂM ${year}${
      projectId && projectId !== 'all' ? ` (Dự án: ${projectId})` : ''
    }`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    // Header row
    const headers = [
      'STT',
      'Mã',
      'Hạng mục ngân sách',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'T7',
      'T8',
      'T9',
      'T10',
      'T11',
      'T12',
      'Tổng năm',
    ];
    worksheet.getRow(3).values = headers;
    const headerRow = worksheet.getRow(3);
    headerRow.height = 24;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 1; c <= 16; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2B6CB0' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    let rowIndex = 4;
    let grandTotal = 0;
    const monthTotals: number[] = new Array(12).fill(0);

    for (let idx = 0; idx < tree.categories.length; idx++) {
      const cat = tree.categories[idx];
      const catRow = worksheet.getRow(rowIndex);
      const rowValues: any[] = [idx + 1, cat.id, cat.name];
      for (let m = 1; m <= 12; m++) {
        const val = cat.months[m.toString()] || 0;
        rowValues.push(val);
        monthTotals[m - 1] += val;
      }
      rowValues.push(cat.planTotal || 0);
      grandTotal += cat.planTotal || 0;

      catRow.values = rowValues;
      catRow.font = { bold: true };
      catRow.alignment = { vertical: 'middle' };
      for (let c = 4; c <= 16; c++) {
        catRow.getCell(c).numFmt = '#,##0';
        catRow.getCell(c).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
      }
      rowIndex++;

      // Subcategories if any
      if (cat.subcategories && cat.subcategories.length > 0) {
        for (const sub of cat.subcategories) {
          const subRow = worksheet.getRow(rowIndex);
          const subValues: any[] = ['', sub.id, `  ${sub.name}`];
          for (let m = 1; m <= 12; m++) {
            let mVal = 0;
            for (const it of sub.items) {
              mVal += it.months[m.toString()] || 0;
            }
            mVal += sub.backup.months[m.toString()] || 0;
            subValues.push(mVal);
          }
          subValues.push(sub.planTotal || 0);
          subRow.values = subValues;
          subRow.font = { italic: true };
          for (let c = 4; c <= 16; c++) {
            subRow.getCell(c).numFmt = '#,##0';
            subRow.getCell(c).alignment = {
              horizontal: 'right',
              vertical: 'middle',
            };
          }
          rowIndex++;
        }
      }
    }

    // Grand total row
    const totalRow = worksheet.getRow(rowIndex);
    const totalValues: any[] = ['', '', 'TỔNG CỘNG'];
    for (let m = 0; m < 12; m++) {
      totalValues.push(monthTotals[m]);
    }
    totalValues.push(grandTotal);
    totalRow.values = totalValues;
    totalRow.font = { bold: true, color: { argb: 'FF1A202C' } };
    totalRow.height = 22;
    for (let c = 1; c <= 16; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      if (c >= 4) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
      };
    }

    // Auto-fit column widths
    worksheet.columns = [
      { width: 8 }, // STT
      { width: 14 }, // Mã
      { width: 35 }, // Tên hạng mục
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 18 }, // Tổng năm
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

