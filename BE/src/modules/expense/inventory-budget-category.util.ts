import { BadRequestException } from '@nestjs/common';

export const BUDGET_GROUP_GIFT_PRINT = 'QUÀ TẶNG/ IN ẤN' as const;
export const BUDGET_GROUP_VAT_PHAM = 'Vật phẩm' as const;

export type InventoryTargetBudgetGroup =
  | typeof BUDGET_GROUP_GIFT_PRINT
  | typeof BUDGET_GROUP_VAT_PHAM;

/**
 * Normalizes a budget category / group name for comparison:
 * - trims and normalizes Unicode (NFC),
 * - normalizes spacing around `/` to `"/ "`,
 * - collapses multiple whitespace characters,
 * - uppercases in Vietnamese locale.
 */
export function normalizeBudgetGroupKey(
  name: string | null | undefined,
): string {
  if (typeof name !== 'string') return '';
  return name
    .normalize('NFC')
    .trim()
    .replace(/\s*\/\s*/g, '/ ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Checks whether an inventory item has an explicitly assigned category (`gift`, `print`, `posm`, `uniform`, etc.).
 */
export function hasDefinedInventoryCategory(
  inventoryCategory: string | null | undefined,
): boolean {
  return (
    typeof inventoryCategory === 'string' &&
    inventoryCategory.trim().length > 0
  );
}

/**
 * Maps an inventory item category (`gift`, `print`, `posm`, `uniform`, or `null`/unknown)
 * to its target budget group name according to BE_requirement_07_11_26_budget_category.md §1:
 * - `gift` / `print` -> `QUÀ TẶNG/ IN ẤN`
 * - `posm` / `uniform` / `null` / unknown -> `Vật phẩm`
 */
export function getInventoryBudgetGroup(
  inventoryCategory: string | null | undefined,
): InventoryTargetBudgetGroup {
  const raw =
    typeof inventoryCategory === 'string'
      ? inventoryCategory.normalize('NFC').trim().toLowerCase()
      : '';

  if (
    raw === 'gift' ||
    raw === 'print' ||
    raw === 'quà tặng' ||
    raw === 'qua tang' ||
    raw === 'ấn phẩm in' ||
    raw === 'an pham in' ||
    raw === 'in ấn' ||
    raw === 'in an' ||
    raw === 'quà tặng/ in ấn' ||
    raw === 'quà tặng / in ấn' ||
    raw === 'quà tặng/in ấn'
  ) {
    return BUDGET_GROUP_GIFT_PRINT;
  }

  return BUDGET_GROUP_VAT_PHAM;
}

/**
 * Checks if a candidate budget category name matches the target budget group.
 */
export function matchesBudgetGroupName(
  candidateName: string | null | undefined,
  targetGroup: InventoryTargetBudgetGroup,
): boolean {
  const normalizedCandidate = normalizeBudgetGroupKey(candidateName);
  if (!normalizedCandidate) return false;
  return normalizedCandidate === normalizeBudgetGroupKey(targetGroup);
}

export interface ResolvedBudgetNode {
  id: string;
  name: string;
  rootCategoryId: string;
  rootCategoryName: string;
  year?: number | null;
}

/**
 * Looks up a budget tree node (`BudgetCategory`, `BudgetSubcategory`, or `BudgetItem`) by ID.
 */
export async function findBudgetNodeById(
  db: any,
  nodeId: string,
): Promise<ResolvedBudgetNode | null> {
  if (!db || !nodeId) return null;

  if (typeof db.budgetCategory?.findFirst === 'function') {
    const cat = await db.budgetCategory.findFirst({
      where: { id: nodeId, archivedAt: null },
    });
    if (cat && (!cat.id || cat.id === nodeId)) {
      return {
        id: cat.id || nodeId,
        name: cat.name || '',
        rootCategoryId: cat.id || nodeId,
        rootCategoryName: cat.name || '',
        year: cat.year ?? null,
      };
    }
  }

  if (typeof db.budgetSubcategory?.findFirst === 'function') {
    const sub = await db.budgetSubcategory.findFirst({
      where: { id: nodeId, archivedAt: null },
    });
    if (sub && (!sub.id || sub.id === nodeId)) {
      let rootCat: any = null;
      if (sub.categoryId && typeof db.budgetCategory?.findFirst === 'function') {
        rootCat = await db.budgetCategory.findFirst({
          where: { id: sub.categoryId, archivedAt: null },
        });
      }
      return {
        id: sub.id || nodeId,
        name: sub.name || '',
        rootCategoryId: rootCat?.id || sub.categoryId || sub.id || nodeId,
        rootCategoryName: rootCat?.name || sub.name || '',
        year: rootCat?.year ?? null,
      };
    }
  }

  if (typeof db.budgetItem?.findFirst === 'function') {
    const item = await db.budgetItem.findFirst({
      where: { id: nodeId, archivedAt: null },
    });
    if (item && (!item.id || item.id === nodeId)) {
      let sub: any = null;
      let rootCat: any = null;
      if (
        item.subcategoryId &&
        typeof db.budgetSubcategory?.findFirst === 'function'
      ) {
        sub = await db.budgetSubcategory.findFirst({
          where: { id: item.subcategoryId, archivedAt: null },
        });
      }
      if (
        sub?.categoryId &&
        typeof db.budgetCategory?.findFirst === 'function'
      ) {
        rootCat = await db.budgetCategory.findFirst({
          where: { id: sub.categoryId, archivedAt: null },
        });
      }
      return {
        id: item.id || nodeId,
        name: item.name || '',
        rootCategoryId:
          rootCat?.id || sub?.categoryId || item.id || nodeId,
        rootCategoryName: rootCat?.name || sub?.name || item.name || '',
        year: rootCat?.year ?? null,
      };
    }
  }

  return null;
}

/**
 * Finds the active `BudgetCategory` in the given year's budget tree matching `targetGroup`.
 * Never creates a new `BudgetCategory` (§1).
 */
export async function findBudgetCategoryByGroupName(
  db: any,
  targetGroup: InventoryTargetBudgetGroup,
  year?: number | null,
): Promise<{ id: string; name: string } | null> {
  if (!db?.budgetCategory) return null;

  if (typeof db.budgetCategory.findMany === 'function') {
    const yearCats = await db.budgetCategory.findMany({
      where: {
        archivedAt: null,
        ...(year ? { year } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (Array.isArray(yearCats) && yearCats.length > 0) {
      const activeMatch =
        yearCats.find(
          (c: any) =>
            c &&
            c.isActive !== false &&
            matchesBudgetGroupName(c.name, targetGroup),
        ) ||
        yearCats.find(
          (c: any) => c && matchesBudgetGroupName(c.name, targetGroup),
        );
      if (activeMatch) {
        return { id: activeMatch.id, name: activeMatch.name };
      }
    }

    if (year) {
      const allCats = await db.budgetCategory.findMany({
        where: { archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (Array.isArray(allCats) && allCats.length > 0) {
        const fallbackMatch =
          allCats.find(
            (c: any) =>
              c &&
              c.isActive !== false &&
              matchesBudgetGroupName(c.name, targetGroup),
          ) ||
          allCats.find(
            (c: any) => c && matchesBudgetGroupName(c.name, targetGroup),
          );
        if (fallbackMatch) {
          return { id: fallbackMatch.id, name: fallbackMatch.name };
        }
      }
    }
  }

  if (typeof db.budgetCategory.findFirst === 'function') {
    const first = await db.budgetCategory.findFirst({
      where: {
        name: targetGroup,
        archivedAt: null,
        ...(year ? { year } : {}),
      },
    });
    if (first && matchesBudgetGroupName(first.name, targetGroup)) {
      return { id: first.id, name: first.name };
    }
  }

  return null;
}

export interface ResolveInventoryBudgetCategoryOptions {
  inventoryCategory: string | null | undefined;
  year?: number | null;
  clientCategoryId?: string | null;
  clientHangMucLon?: string | null;
  explicitExpenseCategoryId?: string | null;
}

export interface ResolveInventoryBudgetCategoryResult {
  categoryId: string | null;
  hangMucLon: string;
  targetGroup: InventoryTargetBudgetGroup;
  warning: string | null;
}

/**
 * Resolves `(categoryId, hangMucLon)` for an expense line or stock-out linked to an inventory item
 * according to BE_requirement_07_11_26_budget_category.md (§1, §3.1, §3.2):
 * 1. If `explicitExpenseCategoryId` is provided (optional stock-out override, §3.1.1):
 *    validates it exists in the budget tree (and matches the target year if `year` is set on both) and uses it.
 * 2. If the inventory item has a defined category (`gift`, `print`, `posm`, `uniform`):
 *    derives the target budget group (`QUÀ TẶNG/ IN ẤN` or `Vật phẩm`) and resolves its `BudgetCategory` in the tree.
 *    If the client sent a `categoryId` or `hangMucLon` that does not match the derived group (§3.2),
 *    ignores the client's group, assigns the derived group, and produces a non-blocking warning.
 * 3. If the inventory item has NO category (`null` / empty) and the client sent a valid `categoryId` (§3.2):
 *    preserves the client's `categoryId` (avoiding breaking legacy data).
 *    Otherwise assigns `Vật phẩm` (`categoryId` of real `Vật phẩm` category if present in tree, else `null`).
 */
export async function resolveInventoryBudgetCategory(
  db: any,
  options: ResolveInventoryBudgetCategoryOptions,
): Promise<ResolveInventoryBudgetCategoryResult> {
  const targetGroup = getInventoryBudgetGroup(options.inventoryCategory);
  const itemHasCategory = hasDefinedInventoryCategory(options.inventoryCategory);

  const matchedTreeCat = await findBudgetCategoryByGroupName(
    db,
    targetGroup,
    options.year,
  );
  const derivedCategoryId = matchedTreeCat ? matchedTreeCat.id : null;
  const derivedHangMucLon = matchedTreeCat ? matchedTreeCat.name : targetGroup;

  const trimmedExplicitId =
    typeof options.explicitExpenseCategoryId === 'string'
      ? options.explicitExpenseCategoryId.trim()
      : '';

  // §3.1.1: Optional explicit expenseCategoryId in stock-out API
  if (trimmedExplicitId) {
    const explicitNode = await findBudgetNodeById(db, trimmedExplicitId);
    if (!explicitNode) {
      throw new BadRequestException(
        `Hạng mục chi phí với ID "${trimmedExplicitId}" không tồn tại hoặc đã bị lưu trữ.`,
      );
    }
    if (
      explicitNode.year &&
      options.year &&
      Number(explicitNode.year) !== Number(options.year)
    ) {
      throw new BadRequestException(
        `Hạng mục chi phí với ID "${trimmedExplicitId}" không thuộc cây ngân sách năm ${options.year}.`,
      );
    }
    let warning: string | null = null;
    if (
      itemHasCategory &&
      !matchesBudgetGroupName(
        explicitNode.rootCategoryName || explicitNode.name,
        targetGroup,
      )
    ) {
      warning = `Danh mục vật phẩm "${options.inventoryCategory}" gợi ý nhóm "${targetGroup}", nhưng đang dùng expenseCategoryId="${trimmedExplicitId}" ("${explicitNode.name}").`;
    }
    return {
      categoryId: explicitNode.id,
      hangMucLon:
        explicitNode.rootCategoryName || explicitNode.name || derivedHangMucLon,
      targetGroup,
      warning,
    };
  }

  const trimmedClientCatId =
    typeof options.clientCategoryId === 'string'
      ? options.clientCategoryId.trim()
      : '';
  const trimmedClientHangMuc =
    typeof options.clientHangMucLon === 'string'
      ? options.clientHangMucLon.trim()
      : '';

  // §3.2: Item has NO category (null / empty)
  if (!itemHasCategory) {
    if (trimmedClientCatId) {
      const hasBudgetLookup =
        typeof db?.budgetItem?.findFirst === 'function' ||
        typeof db?.budgetSubcategory?.findFirst === 'function' ||
        typeof db?.budgetCategory?.findFirst === 'function';
      if (hasBudgetLookup) {
        const clientNode = await findBudgetNodeById(db, trimmedClientCatId);
        if (!clientNode) {
          throw new BadRequestException(
            `Hạng mục chi phí với ID "${trimmedClientCatId}" không tồn tại hoặc đã bị lưu trữ.`,
          );
        }
        return {
          categoryId: trimmedClientCatId,
          hangMucLon:
            trimmedClientHangMuc || clientNode.name || derivedHangMucLon,
          targetGroup,
          warning: null,
        };
      }
      return {
        categoryId: trimmedClientCatId,
        hangMucLon: trimmedClientHangMuc || derivedHangMucLon,
        targetGroup,
        warning: null,
      };
    }

    return {
      categoryId: derivedCategoryId,
      hangMucLon: trimmedClientHangMuc || derivedHangMucLon,
      targetGroup,
      warning: null,
    };
  }

  // §3.1.2 & §3.2: Item HAS a category (`gift`, `print`, `posm`, `uniform`)
  let warning: string | null = null;
  if (trimmedClientCatId) {
    const clientNode = await findBudgetNodeById(db, trimmedClientCatId);
    const clientMatchesTarget =
      (derivedCategoryId && trimmedClientCatId === derivedCategoryId) ||
      (clientNode &&
        matchesBudgetGroupName(
          clientNode.rootCategoryName || clientNode.name,
          targetGroup,
        ));

    if (clientMatchesTarget) {
      return {
        categoryId: derivedCategoryId || clientNode?.id || trimmedClientCatId,
        hangMucLon: derivedHangMucLon,
        targetGroup,
        warning: null,
      };
    }

    warning = `Danh mục vật phẩm "${options.inventoryCategory}" thuộc nhóm ngân sách "${targetGroup}"; đã bỏ qua categoryId="${trimmedClientCatId}"${
      clientNode?.name ? ` ("${clientNode.name}")` : ''
    } và tự động gán nhóm "${derivedHangMucLon}".`;
  } else if (
    trimmedClientHangMuc &&
    !matchesBudgetGroupName(trimmedClientHangMuc, targetGroup)
  ) {
    warning = `Danh mục vật phẩm "${options.inventoryCategory}" thuộc nhóm ngân sách "${targetGroup}"; đã bỏ qua hangMucLon="${trimmedClientHangMuc}" và tự động gán nhóm "${derivedHangMucLon}".`;
  }

  return {
    categoryId: derivedCategoryId,
    hangMucLon: derivedHangMucLon,
    targetGroup,
    warning,
  };
}
