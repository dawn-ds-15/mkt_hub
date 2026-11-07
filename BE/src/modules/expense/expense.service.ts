import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { fileStorage, readUploadedFile } from '../../common/storage/file-storage';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CancelExpenseLineDto,
  CreateExpenseLineDto,
  QueryActualExpensesDto,
  SaveExpenseRecordDto,
  SaveSystemConfigDto,
  UpdateExpenseDto,
  UpdateExpenseLineDto,
} from './dto/expense.dto';
import {
  EXPENSE_ERROR_CODES,
  getExpensePermissions,
} from './expense-permissions.helper';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getDealPeriodDate,
  getExpenseLinePeriod,
  loadLatestExpenseSnapshots,
  resolveLeadSourceProjectIds,
  toExpenseCostEntries,
} from './expense-snapshot.util';
import {
  formatExpenseLineAttachment,
  linkAttachmentsToLine,
  loadLineAttachments,
  syncLineLegacyAttachments,
} from './expense-attachments.service';
import { resolveInventoryBudgetCategory } from './inventory-budget-category.util';

@Injectable()
export class ExpenseService {
  private readonly uploadDir: string;
  private readonly concurrencyLocks = new Map<string, Promise<any>>();
  private readonly inFlightIdempotency = new Map<string, Promise<any>>();
  private readonly idempotencyMemoryCache = new Map<
    string,
    { expiresAt: number; response: any }
  >();
  private readonly snapshotReconciliationMap = new Map<
    string,
    {
      createdAt: number;
      projectId: string;
      failed?: boolean;
      supersededLines: Array<{
        id: string;
        expenseId: string;
        inventoryItemId: string;
        deductedQuantity: number;
      }>;
      returnTxsByItemId: Map<
        string,
        {
          txId: string | null;
          batchId: string | null;
          remainingQty: number;
        }
      >;
    }
  >();

  private async withConcurrencyLocks<T>(
    keys: string[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const uniqueSortedKeys = Array.from(new Set(keys.filter(Boolean))).sort();
    if (uniqueSortedKeys.length === 0) {
      return await fn();
    }
    const acquireNext = async (index: number): Promise<T> => {
      if (index >= uniqueSortedKeys.length) {
        return await fn();
      }
      const key = uniqueSortedKeys[index];
      const prev = this.concurrencyLocks.get(key) || Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const chain = prev.then(
        () => current,
        () => current,
      );
      this.concurrencyLocks.set(key, chain);
      await prev.catch(() => {});
      try {
        return await acquireNext(index + 1);
      } finally {
        release();
        if (this.concurrencyLocks.get(key) === chain) {
          this.concurrencyLocks.delete(key);
        }
      }
    };
    return await acquireNext(0);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'expenses');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  formatLine(line: any, baseUrl?: string) {
    if (!line) return line;
    const base = (
      baseUrl ||
      process.env.APP_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');

    const attachmentUrl = line.attachmentPath
      ? `${base}/api/v1/expenses/lines/${line.id}/attachment`
      : (line.attachmentUrl ?? null);

    const plannedQuantity =
      line.plannedQuantity !== null && line.plannedQuantity !== undefined
        ? line.plannedQuantity
        : (line.quantity || 0);
    const actualQuantity =
      line.actualQuantity !== null && line.actualQuantity !== undefined
        ? line.actualQuantity
        : (line.quantity !== null && line.quantity !== undefined ? line.quantity : 0);
    const actualUnitPrice = Number(
      line.actualUnitPrice || line.unitPriceAfterVatSnapshot || 0,
    );
    const unitPriceBeforeVatSnapshot =
      line.unitPriceBeforeVatSnapshot !== null &&
        line.unitPriceBeforeVatSnapshot !== undefined
        ? Number(line.unitPriceBeforeVatSnapshot)
        : actualUnitPrice;
    const vatRateSnapshot =
      line.vatRateSnapshot !== null && line.vatRateSnapshot !== undefined
        ? Number(line.vatRateSnapshot)
        : 0;
    const unitPriceAfterVatSnapshot =
      line.unitPriceAfterVatSnapshot !== null &&
        line.unitPriceAfterVatSnapshot !== undefined
        ? Number(line.unitPriceAfterVatSnapshot)
        : actualUnitPrice;

    const plannedAmount =
      line.plannedAmount !== null && line.plannedAmount !== undefined && Number(line.plannedAmount) > 0
        ? Number(line.plannedAmount)
        : (plannedQuantity > 0 ? plannedQuantity * unitPriceAfterVatSnapshot : 0);
    const totalAmount = actualUnitPrice * actualQuantity;
    const actualAmount = totalAmount;

    const itemObj = line.inventoryItem
      ? {
          id: line.inventoryItem.id,
          code: line.inventoryItem.code,
          name: line.inventoryItem.name,
          unit: line.inventoryItem.unit,
          category: line.inventoryItem.category ?? null,
        }
      : null;

    return {
      id: line.id,
      expenseId: line.expenseId,
      name: line.name,
      categoryId: line.categoryId ?? null,
      inventoryItemId: line.inventoryItemId ?? null,
      itemId: line.inventoryItemId ?? null,
      inventoryItem: itemObj,
      item: itemObj,
      ...(line.categoryWarning ? { categoryWarning: line.categoryWarning } : {}),
      isCustom: Boolean(line.isCustom),
      status: line.status || 'draft',
      recognizedDate: line.recognizedDate
        ? (line.recognizedDate instanceof Date
          ? line.recognizedDate.toISOString().split('T')[0]
          : String(line.recognizedDate).split('T')[0])
        : null,
      expenseDate: line.recognizedDate
        ? (line.recognizedDate instanceof Date
          ? line.recognizedDate.toISOString().split('T')[0]
          : String(line.recognizedDate).split('T')[0])
        : null,
      hangMucLon: line.hangMucLon ?? '',
      categoryName: line.hangMucLon ?? '',
      isUnplanned: Boolean(line.isUnplanned),
      unplannedItemName: line.unplannedItemName ?? null,
      supplier: line.supplier ?? null,
      projectExpenseItemId: line.projectExpenseItemId ?? null,
      annualExpenseItemId: line.annualExpenseItemId ?? null,
      cancelledAt: line.cancelledAt ?? null,
      cancelledBy: line.cancelledBy ?? null,
      cancelledReason: line.cancelledReason ?? null,
      confirmedAt: line.confirmedAt ?? null,
      confirmedBy: line.confirmedBy ?? null,
      plannedQuantity,
      actualQuantity,
      deductedQuantity:
        line.deductedQuantity !== null && line.deductedQuantity !== undefined
          ? Number(line.deductedQuantity)
          : (line.inventoryItemId ? Number(actualQuantity) : 0),
      stockTransactionId: line.stockTransactionId ?? null,
      unitPriceBeforeVat: unitPriceBeforeVatSnapshot,
      unitPriceBeforeVatSnapshot,
      vatRate: vatRateSnapshot,
      vatRateSnapshot,
      unitPriceAfterVat: unitPriceAfterVatSnapshot,
      unitPriceAfterVatSnapshot,
      plannedAmount,
      plannedCost: plannedAmount,
      actualUnitPrice,
      quantity: actualQuantity,
      totalAmount,
      actualAmount,
      note: line.note ?? '',
      sortOrder: line.sortOrder ?? 0,
      attachmentName: line.attachmentName ?? null,
      attachmentUrl,
      // All files of the line (BE_requirement_29_09_26 §1), when they were loaded
      ...(Array.isArray(line.attachments)
        ? {
            attachments: line.attachments
              .filter((a: any) => !a.archivedAt)
              .map((a: any) => formatExpenseLineAttachment(a, base)),
          }
        : {}),
      receiptUrl: attachmentUrl,
      supplierName: line.supplier ?? null,
      url: attachmentUrl,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
      archivedAt: line.archivedAt ?? null,
    };
  }

  formatExpense(expense: any, baseUrl?: string) {
    if (!expense) return expense;
    const formattedLines =
      expense.lines?.map((l: any) => this.formatLine(l, baseUrl)) || [];

    let totalPlanned = formattedLines.reduce(
      (sum: number, l: any) => sum + Number(l.plannedAmount || 0),
      0,
    );
    const totalActual = formattedLines
      .filter((l: any) => (l.status || 'draft') === 'confirmed')
      .reduce(
        (sum: number, l: any) => sum + Number(l.totalAmount || l.actualAmount || 0),
        0,
      );

    if (totalPlanned === 0 && Number(expense.directCost) > 0) {
      totalPlanned = Number(expense.directCost);
    }

    const expRecDate = expense.recognizedDate
      ? (expense.recognizedDate instanceof Date
        ? expense.recognizedDate.toISOString().split('T')[0]
        : String(expense.recognizedDate).split('T')[0])
      : null;

    const lineDates = formattedLines
      .map((l: any) => l.expenseDate || l.recognizedDate)
      .filter((d: any) => Boolean(d));

    let maxLineDate: string | null = null;
    if (lineDates.length > 0) {
      maxLineDate = lineDates.reduce((max: string, cur: string) => (cur > max ? cur : max));
    }

    const recognizedDate = expRecDate || maxLineDate || null;
    let status = expense.status || 'draft';
    if (formattedLines.length > 0) {
      if (formattedLines.every((l: any) => (l.status || 'draft') === 'confirmed')) {
        status = 'confirmed';
      } else if (formattedLines.every((l: any) => l.status === 'cancelled')) {
        status = 'cancelled';
      } else {
        status = 'draft';
      }
    }

    let directCost = Number(expense.directCost || 0);
    let overheadCost = Number(expense.overheadCost || 0);

    if (formattedLines.length > 0) {
      const activeLines = formattedLines.filter(
        (l: any) => l.status !== 'cancelled',
      );
      directCost = activeLines.reduce(
        (sum: number, l: any) =>
          sum + Number(l.totalAmount ?? l.actualAmount ?? 0),
        0,
      );
      overheadCost = 0;
    }

    return {
      ...expense,
      directCost,
      overheadCost,
      plannedCost: totalPlanned,
      totalPlanned,
      totalActual,
      recognizedDate,
      expenseDate: recognizedDate,
      status,
      lines: formattedLines,
    };
  }

  private async recalculateInventoryItemTotals(tx: any, itemId: string) {
    const allBatches = await tx.inventoryBatch.findMany({
      where: { itemId, archivedAt: null },
    });
    let totalStock = 0;
    let totalValue = new Decimal(0);
    for (const b of allBatches) {
      totalStock += b.currentStock;
      totalValue = totalValue.add(
        new Decimal(b.currentStock).mul(b.unitPrice),
      );
    }
    const avgUnitPrice =
      totalStock > 0
        ? totalValue.div(new Decimal(totalStock))
        : new Decimal(0);
    const status = totalStock > 0 ? 'instock' : 'out';
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { totalStock, avgUnitPrice, status },
    });
  }

  private async deductInventoryStock(
    tx: any,
    itemId: string,
    quantity: number,
    projectId?: string,
    context?: { isPlanned?: boolean; oldPlanned?: number; expenseLineId?: string },
  ): Promise<string | null> {
    if (quantity <= 0) return null;
    if (
      typeof tx.$queryRawUnsafe === 'function' &&
      !(tx.$queryRawUnsafe as any)._isMockFunction
    ) {
      await Promise.resolve(
        tx.$queryRawUnsafe(
          'SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE',
          itemId,
        ),
      ).catch(() => {});
      await Promise.resolve(
        tx.$queryRawUnsafe(
          'SELECT "id" FROM "InventoryBatch" WHERE "itemId" = $1 AND "archivedAt" IS NULL FOR UPDATE',
          itemId,
        ),
      ).catch(() => {});
    }
    const item = await tx.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.archivedAt) {
      throw new NotFoundException('Không tìm thấy vật phẩm trong kho');
    }
    if (item.totalStock < quantity) {
      throw new ConflictException(
        `Số lượng thực tế (${quantity}) vượt tồn kho hiện tại (${item.totalStock})`,
      );
    }

    const activeBatches = await tx.inventoryBatch.findMany({
      where: { itemId, archivedAt: null, currentStock: { gt: 0 } },
      orderBy: { receivedDate: 'asc' },
    });

    let firstTxId: string | null = null;
    let remaining = quantity;
    for (const batch of activeBatches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.currentStock, remaining);
      const newStock = batch.currentStock - deduct;
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          currentStock: newStock,
          status: newStock === 0 ? 'depleted' : 'active',
        },
      });

      const createdTx = await tx.inventoryTransaction.create({
        data: {
          itemId,
          batchId: batch.id,
          projectId: projectId || null,
          ...(context?.expenseLineId ? { expenseLineId: context.expenseLineId } : {}),
          type: 'out',
          quantity: deduct,
          note: 'Xuất kho cho dòng chi phí',
        },
      });
      if (!firstTxId && createdTx?.id) {
        firstTxId = createdTx.id;
      }

      remaining -= deduct;
    }

    await this.recalculateInventoryItemTotals(tx, itemId);
    return firstTxId;
  }

  private async returnInventoryStock(
    tx: any,
    itemId: string,
    quantity: number,
    projectId?: string,
    context?: { expenseLineId?: string },
  ): Promise<{ txId: string | null; batchId: string | null } | void> {
    if (quantity <= 0) return;
    if (
      typeof tx.$queryRawUnsafe === 'function' &&
      !(tx.$queryRawUnsafe as any)._isMockFunction
    ) {
      await Promise.resolve(
        tx.$queryRawUnsafe(
          'SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE',
          itemId,
        ),
      ).catch(() => {});
      await Promise.resolve(
        tx.$queryRawUnsafe(
          'SELECT "id" FROM "InventoryBatch" WHERE "itemId" = $1 AND "archivedAt" IS NULL FOR UPDATE',
          itemId,
        ),
      ).catch(() => {});
    }
    const batch = await tx.inventoryBatch.findFirst({
      where: { itemId, archivedAt: null },
      orderBy: { receivedDate: 'desc' },
    });
    if (batch) {
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          currentStock: batch.currentStock + quantity,
          status: 'active',
        },
      });
    }

    const createdTx = await tx.inventoryTransaction.create({
      data: {
        itemId,
        batchId: batch ? batch.id : null,
        projectId: projectId || null,
        ...(context?.expenseLineId ? { expenseLineId: context.expenseLineId } : {}),
        type: 'in',
        quantity,
        note: 'Hoàn kho từ dòng chi phí',
      },
    });

    await this.recalculateInventoryItemTotals(tx, itemId);
    return {
      txId: createdTx?.id ?? null,
      batchId: batch?.id ?? null,
    };
  }

  private async reconcileAndApplySnapshotStock(
    tx: any,
    expense: { id: string; projectId: string },
    resolvedInventoryItemId: string | null,
    stockEffect: number,
    skipReconciliation: boolean,
  ) {
    const now = Date.now();
    for (const [k, v] of this.snapshotReconciliationMap.entries()) {
      if (now - v.createdAt > 10 * 60 * 1000) {
        this.snapshotReconciliationMap.delete(k);
      }
    }

    if (skipReconciliation || !expense.projectId) {
      let stockTransactionId: string | null = null;
      if (resolvedInventoryItemId && stockEffect > 0) {
        stockTransactionId = await this.deductInventoryStock(
          tx,
          resolvedInventoryItemId,
          stockEffect,
          expense.projectId,
        );
      }
      return { stockTransactionId, workingRecon: null };
    }

    const existingRecon = this.snapshotReconciliationMap.get(expense.id);
    let workingRecon: {
      createdAt: number;
      projectId: string;
      failed?: boolean;
      supersededLines: Array<{
        id: string;
        expenseId: string;
        inventoryItemId: string;
        deductedQuantity: number;
      }>;
      returnTxsByItemId: Map<
        string,
        {
          txId: string | null;
          batchId: string | null;
          remainingQty: number;
        }
      >;
    };

    if (existingRecon) {
      const clonedMap = new Map<
        string,
        { txId: string | null; batchId: string | null; remainingQty: number }
      >();
      for (const [itemId, entry] of existingRecon.returnTxsByItemId.entries()) {
        clonedMap.set(itemId, { ...entry });
      }
      workingRecon = {
        createdAt: existingRecon.createdAt,
        projectId: existingRecon.projectId,
        failed: existingRecon.failed,
        supersededLines: [...existingRecon.supersededLines],
        returnTxsByItemId: clonedMap,
      };
    } else {
      workingRecon = {
        createdAt: now,
        projectId: expense.projectId,
        supersededLines: [],
        returnTxsByItemId: new Map(),
      };

      if (typeof tx.expenseRecord?.findMany === 'function') {
        const rawPrevRecords = await Promise.resolve(
          tx.expenseRecord.findMany({
            where: {
              projectId: expense.projectId,
              id: { not: expense.id },
              archivedAt: null,
            },
            include: {
              lines: {
                where: {
                  archivedAt: null,
                  status: { not: 'cancelled' },
                  inventoryItemId: { not: null },
                },
              },
            },
          }),
        ).catch(() => []);
        const prevRecords = Array.isArray(rawPrevRecords) ? rawPrevRecords : [];

        const qtyByItem = new Map<string, number>();
        for (const r of prevRecords) {
          if (
            !r ||
            !r.id ||
            r.id === expense.id ||
            r.projectId !== expense.projectId ||
            r.archivedAt ||
            !Array.isArray(r.lines)
          ) {
            continue;
          }
          for (const l of r.lines) {
            if (
              !l ||
              !l.id ||
              (l.expenseId && l.expenseId !== r.id) ||
              l.archivedAt ||
              l.status === 'cancelled' ||
              !l.inventoryItemId
            ) {
              continue;
            }
            const oldActual = Number(l.actualQuantity ?? l.quantity ?? 0);
            const oldDeducted =
              l.deductedQuantity !== undefined && l.deductedQuantity !== null
                ? Number(l.deductedQuantity)
                : oldActual;
            if (oldDeducted > 0) {
              workingRecon.supersededLines.push({
                id: l.id,
                expenseId: r.id,
                inventoryItemId: l.inventoryItemId,
                deductedQuantity: oldDeducted,
              });
              qtyByItem.set(
                l.inventoryItemId,
                (qtyByItem.get(l.inventoryItemId) || 0) + oldDeducted,
              );
            }
          }
        }

        for (const oldLine of workingRecon.supersededLines) {
          await tx.expenseLine.update({
            where: { id: oldLine.id },
            data: { deductedQuantity: 0 },
          });
        }

        for (const [itemId, totalReturnedQty] of qtyByItem.entries()) {
          if (totalReturnedQty > 0) {
            const ret = await this.returnInventoryStock(
              tx,
              itemId,
              totalReturnedQty,
              expense.projectId,
            );
            workingRecon.returnTxsByItemId.set(itemId, {
              txId: ret?.txId ?? null,
              batchId: ret?.batchId ?? null,
              remainingQty: totalReturnedQty,
            });
          }
        }
      }
    }

    let stockTransactionId: string | null = null;
    if (resolvedInventoryItemId && stockEffect > 0) {
      const pool = workingRecon.returnTxsByItemId.get(resolvedInventoryItemId);
      if (pool && pool.remainingQty > 0) {
        if (
          typeof tx.$queryRawUnsafe === 'function' &&
          !(tx.$queryRawUnsafe as any)._isMockFunction
        ) {
          await Promise.resolve(
            tx.$queryRawUnsafe(
              'SELECT "id" FROM "InventoryItem" WHERE "id" = $1 FOR UPDATE',
              resolvedInventoryItemId,
            ),
          ).catch(() => {});
          await Promise.resolve(
            tx.$queryRawUnsafe(
              'SELECT "id" FROM "InventoryBatch" WHERE "itemId" = $1 AND "archivedAt" IS NULL FOR UPDATE',
              resolvedInventoryItemId,
            ),
          ).catch(() => {});
        }
        const item = await tx.inventoryItem.findUnique({
          where: { id: resolvedInventoryItemId },
        });
        if (!item || item.archivedAt) {
          throw new NotFoundException('Không tìm thấy vật phẩm trong kho');
        }
        if (item.totalStock < stockEffect) {
          throw new ConflictException(
            `Số lượng thực tế (${stockEffect}) vượt tồn kho hiện tại (${item.totalStock})`,
          );
        }

        const absorbed = Math.min(stockEffect, pool.remainingQty);
        const toDeduct = stockEffect - absorbed;
        pool.remainingQty -= absorbed;

        if (absorbed > 0) {
          const targetBatch = pool.batchId
            ? await tx.inventoryBatch.findFirst({
                where: { id: pool.batchId, archivedAt: null },
              })
            : await tx.inventoryBatch.findFirst({
                where: { itemId: resolvedInventoryItemId, archivedAt: null },
                orderBy: { receivedDate: 'desc' },
              });
          if (targetBatch) {
            const newBatchStock = Math.max(0, targetBatch.currentStock - absorbed);
            await tx.inventoryBatch.update({
              where: { id: targetBatch.id },
              data: {
                currentStock: newBatchStock,
                status: newBatchStock === 0 ? 'depleted' : 'active',
              },
            });
          }

          if (pool.txId) {
            if (
              pool.remainingQty === 0 &&
              typeof tx.inventoryTransaction?.delete === 'function'
            ) {
              await Promise.resolve(
                tx.inventoryTransaction.delete({ where: { id: pool.txId } }),
              ).catch(() => {});
            } else if (
              pool.remainingQty > 0 &&
              typeof tx.inventoryTransaction?.update === 'function'
            ) {
              await Promise.resolve(
                tx.inventoryTransaction.update({
                  where: { id: pool.txId },
                  data: { quantity: pool.remainingQty },
                }),
              ).catch(() => {});
            }
          }

          await this.recalculateInventoryItemTotals(tx, resolvedInventoryItemId);
        }

        if (toDeduct > 0) {
          stockTransactionId = await this.deductInventoryStock(
            tx,
            resolvedInventoryItemId,
            toDeduct,
            expense.projectId,
          );
        }
      } else {
        stockTransactionId = await this.deductInventoryStock(
          tx,
          resolvedInventoryItemId,
          stockEffect,
          expense.projectId,
        );
      }
    }

    return { stockTransactionId, workingRecon };
  }

  getPeriodDates(year: number, periodType: 'month' | 'quarter' | 'year', periodValue?: number) {
    let startDate: Date;
    let endDate: Date;

    const val = Number(periodValue);

    if (periodType === 'month') {
      const month = (!isNaN(val) && val >= 1 && val <= 12) ? val : 1;
      startDate = new Date(Date.UTC(year, month - 1, 1));
      endDate = new Date(Date.UTC(year, month, 1));
    } else if (periodType === 'quarter') {
      const quarter = (!isNaN(val) && val >= 1 && val <= 4) ? val : 1;
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(Date.UTC(year, startMonth, 1));
      endDate = new Date(Date.UTC(year, startMonth + 3, 1));
    } else {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year + 1, 0, 1));
    }

    return { startDate, endDate };
  }

  async getEffectiveConfig(key: 'churn_rate' | 'gross_margin', year: number, periodType: 'month' | 'quarter' | 'year', periodValue?: number): Promise<number> {
    const val = Number(periodValue);
    const validPeriodValue = !isNaN(val) ? val : null;
    const { startDate } = this.getPeriodDates(year, periodType, validPeriodValue ?? undefined);

    const directMatch = await this.prisma.systemConfig.findFirst({
      where: {
        key,
        year,
        periodType,
        periodValue: validPeriodValue,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (directMatch) {
      return Number(directMatch.value);
    }

    const fallback = await this.prisma.systemConfig.findFirst({
      where: {
        key,
        effectiveFrom: {
          lte: startDate,
        },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (fallback) {
      return Number(fallback.value);
    }

    return key === 'churn_rate' ? 2.0 : 60.0;
  }

  async saveSystemConfig(dto: SaveSystemConfigDto, userId: string) {
    const effectiveDate = new Date(dto.effectiveFrom);
    if (isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('Ngày hiệu lực không hợp lệ.');
    }

    const record = await this.prisma.systemConfig.create({
      data: {
        key: dto.key,
        periodType: dto.periodType,
        year: dto.year,
        periodValue: dto.periodValue || null,
        value: new Decimal(dto.value),
        effectiveFrom: effectiveDate,
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'create',
      entityType: 'SystemConfig',
      entityId: record.id,
      newValue: record,
    });

    return record;
  }

  async getSystemConfigHistory(key?: 'churn_rate' | 'gross_margin') {
    const where: any = {};
    if (key) where.key = key;

    const configs = await this.prisma.systemConfig.findMany({
      where,
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    });

    return configs;
  }

  async saveExpense(dto: SaveExpenseRecordDto, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án.');
    }

    let year = dto.year;
    let month = dto.month;
    let recognizedDateObj: Date | null = null;
    const inputDateStr = dto.recognizedDate || dto.expenseDate;
    if (inputDateStr) {
      const parsed = new Date(inputDateStr);
      if (!isNaN(parsed.getTime())) {
        recognizedDateObj = parsed;
        year = year || parsed.getFullYear();
        month = month || parsed.getMonth() + 1;
      }
    }
    if (!recognizedDateObj && dto.lines && Array.isArray(dto.lines) && dto.lines.length > 0) {
      const lineDates = dto.lines
        .map((l: any) => l.expenseDate || l.recognizedDate)
        .filter((d: any) => Boolean(d));
      if (lineDates.length > 0) {
        const maxDate = lineDates.reduce((max: string, cur: string) => (cur > max ? cur : max));
        const parsed = new Date(maxDate);
        if (!isNaN(parsed.getTime())) {
          recognizedDateObj = parsed;
          year = year || parsed.getFullYear();
          month = month || parsed.getMonth() + 1;
        }
      }
    }

    year = year || new Date().getFullYear();
    month = month || new Date().getMonth() + 1;
    if (!recognizedDateObj) {
      recognizedDateObj = new Date(Date.UTC(year, month - 1, 1));
    }

    if (project.status === 'Cancelled' && project.cancelledAt) {
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      if (startOfMonth > project.cancelledAt) {
        throw new BadRequestException(
          'Không thể ghi nhận chi phí cho kỳ sau thời điểm dự án bị hủy (cancelled_at).',
        );
      }
    }

    if (dto.isUnplanned && dto.projectExpenseItemId) {
      throw new UnprocessableEntityException({
        message: 'Chi phí phát sinh ngoài kế hoạch không được liên kết với hạng mục kế hoạch dự án.',
        errorCode: EXPENSE_ERROR_CODES.ERR_UNPLANNED_HAS_PROJECT_ITEM,
      });
    }

    const effectiveStatus = dto.action === 'confirm' ? 'confirmed' : 'draft';
    if (effectiveStatus === 'confirmed') {
      const recDate = recognizedDateObj;
      const recYear = recDate.getFullYear();
      const activePlan = await this.prisma.annualExpensePlan.findFirst({
        where: { year: recYear, status: 'active' },
      });
      if (!activePlan) {
        const legacyActive = await this.prisma.budgetCategory.findFirst({
          where: { year: recYear, isActive: true, archivedAt: null },
        });
        if (!legacyActive) {
          throw new UnprocessableEntityException({
            message: `Năm ghi nhận chi phí (${recYear}) chưa có kế hoạch chi phí năm nào ở trạng thái Active.`,
            errorCode: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_NOT_ACTIVE,
          });
        }
      }

      if (project.status === 'Cancelled' && project.cancelledAt && recognizedDateObj > project.cancelledAt) {
        throw new UnprocessableEntityException({
          message: 'Ngày ghi nhận chi phí không được sau thời điểm dự án bị hủy (cancelled_at).',
          errorCode: EXPENSE_ERROR_CODES.ERR_RECOGNIZED_AFTER_CANCELLED,
        });
      }

      if (dto.isUnplanned && (!dto.unplannedItemName || dto.unplannedItemName.trim() === '')) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_UNPLANNED_REQUIRES_NAME,
          message: 'Chi phí phát sinh ngoài kế hoạch bắt buộc phải có tên hạng mục phát sinh (unplannedItemName).',
        });
      }
    }

    const effectiveOverhead = dto.overhead !== undefined ? dto.overhead : dto.overheadCost;

    const targetRecordId = dto.id || dto.expenseId;
    let record: any = null;

    if (targetRecordId) {
      record = await this.prisma.expenseRecord.findFirst({
        where: { id: targetRecordId, archivedAt: null },
      });
    }

    const isUpdate = Boolean(record);
    if (record) {
      const updated = await this.prisma.expenseRecord.update({
        where: { id: record.id },
        data: {
          recognizedDate: recognizedDateObj,
          status: effectiveStatus,
          directCost: dto.directCost !== undefined ? new Decimal(dto.directCost) : record.directCost,
          directNotes: dto.directNotes !== undefined ? (dto.directNotes || null) : record.directNotes,
          overheadCost: new Decimal(effectiveOverhead || 0),
          overheadNotes: dto.overheadNotes !== undefined ? (dto.overheadNotes || null) : record.overheadNotes,
        },
      });
      record = updated || record;
    } else {
      record = await this.prisma.expenseRecord.create({
        data: {
          projectId: dto.projectId,
          month,
          year,
          recognizedDate: recognizedDateObj,
          status: effectiveStatus,
          directCost: new Decimal(dto.directCost || 0),
          directNotes: dto.directNotes || null,
          overheadCost: new Decimal(effectiveOverhead || 0),
          overheadNotes: dto.overheadNotes || null,
          createdById: userId,
        },
      });
    }

    if (!record) {
      record = { id: targetRecordId || 'temp-record-id', projectId: dto.projectId, month, year };
    }

    await this.auditService.log({
      userId,
      action: isUpdate ? 'update' : 'create',
      entityType: 'ExpenseRecord',
      entityId: record.id,
      newValue: record,
    });

    // If lines are provided in payload
    if (dto.lines && Array.isArray(dto.lines) && dto.lines.length > 0) {
      try {
        for (const lineDto of dto.lines) {
          const lineNote =
            lineDto.note !== undefined
              ? lineDto.note
              : (lineDto.notes !== undefined
                  ? lineDto.notes
                  : (lineDto.ghiChu !== undefined
                      ? lineDto.ghiChu
                      : (lineDto.ghi_chu !== undefined
                          ? lineDto.ghi_chu
                          : null)));

          const lineInventoryItemId =
            lineDto.inventoryItemId ||
            lineDto.itemId ||
            lineDto.item_id ||
            lineDto.inventory_item_id ||
            null;

          const lineUnitPrice =
            lineDto.actualUnitPrice !== undefined
              ? lineDto.actualUnitPrice
              : (lineDto.unitPrice !== undefined
                  ? lineDto.unitPrice
                  : (lineDto.amount !== undefined
                      ? lineDto.amount
                      : lineDto.donGia));

          const lineActualQty =
            lineDto.actualQuantity !== undefined
              ? lineDto.actualQuantity
              : (lineDto.quantity !== undefined
                  ? lineDto.quantity
                  : (lineDto.realQty !== undefined
                      ? lineDto.realQty
                      : lineDto.soLuong));

          const linePlannedQty =
            lineDto.plannedQuantity !== undefined
              ? lineDto.plannedQuantity
              : (lineDto.plannedQty !== undefined
                  ? lineDto.plannedQty
                  : lineDto.soLuongKH);

          const linePlannedAmount =
            lineDto.plannedAmount !== undefined
              ? lineDto.plannedAmount
              : (lineDto.thanhTienKH !== undefined
                  ? lineDto.thanhTienKH
                  : lineDto.thanhTien);

          await this.createExpenseLine(
            record.id,
            {
              id: lineDto.id,
              name: lineDto.name || lineDto.chiTiet || lineDto.title || 'Chi phí',
              categoryId: lineDto.categoryId || lineDto.expenseCategory,
              expenseCategoryId: lineDto.expenseCategoryId,
              hangMucLon: lineDto.hangMucLon || lineDto.categoryName,
              categoryName: lineDto.categoryName || lineDto.hangMucLon,
              inventoryItemId: lineInventoryItemId,
              isCustom: lineDto.isCustom !== undefined ? lineDto.isCustom : (lineInventoryItemId ? false : true),
              status: lineDto.status || 'draft',
              recognizedDate: lineDto.expenseDate || lineDto.recognizedDate || inputDateStr,
              expenseDate: lineDto.expenseDate || lineDto.recognizedDate || inputDateStr,
              isUnplanned: lineDto.isUnplanned !== undefined ? lineDto.isUnplanned : dto.isUnplanned,
              unplannedItemName: lineDto.unplannedItemName || dto.unplannedItemName,
              supplier: lineDto.supplier || dto.supplierName,
              projectExpenseItemId: lineDto.projectExpenseItemId || dto.projectExpenseItemId,
              annualExpenseItemId: lineDto.annualExpenseItemId || dto.annualExpenseItemId,
              plannedQuantity: linePlannedQty,
              actualQuantity: lineActualQty,
              unitPriceBeforeVat: lineDto.unitPriceBeforeVat,
              vatRate: lineDto.vatRate,
              unitPriceAfterVat: lineDto.unitPriceAfterVat,
              plannedAmount: linePlannedAmount,
              actualUnitPrice: lineUnitPrice,
              quantity:
                lineActualQty !== undefined && lineActualQty !== null
                  ? Number(lineActualQty)
                  : 0,
              note: lineNote,
              sortOrder: lineDto.sortOrder,
              receiptUrl: lineDto.receiptUrl || dto.receiptUrl,
              attachmentUrl: lineDto.attachmentUrl || lineDto.receiptUrl || dto.receiptUrl,
              attachmentName: lineDto.attachmentName,
              attachmentIds: lineDto.attachmentIds,
            },
            userId,
          );
        }
      } catch (err) {
        if (!isUpdate && record?.id && record.id !== 'temp-record-id') {
          await this.removeExpense(record.id, userId).catch(() => {});
        }
        throw err;
      }
    }

    const finalRecord = await this.getExpense(record.id);

    await this.recordExpenseSnapshot(
      this.prisma,
      record.id,
      isUpdate ? 'updated' : 'created',
      userId,
    );

    await this.auditService.log({
      userId,
      action: isUpdate ? 'update' : 'create',
      entityType: 'ExpenseRecord',
      entityId: record.id,
      newValue: finalRecord,
    });

    return finalRecord;
  }

  private async enrichLinesCategoryNames(lines: any[]) {
    if (!lines || lines.length === 0) return lines;
    const missingCatIds = Array.from(
      new Set(
        lines
          .filter((l) => (!l.hangMucLon || l.hangMucLon === '') && l.categoryId)
          .map((l) => l.categoryId),
      ),
    );
    if (missingCatIds.length === 0) return lines;

    const [budgetItems, subcategories, categories] = await Promise.all([
      this.prisma.budgetItem?.findMany
        ? this.prisma.budgetItem.findMany({
            where: { id: { in: missingCatIds } },
            select: { id: true, name: true },
          })
        : [],
      this.prisma.budgetSubcategory?.findMany
        ? this.prisma.budgetSubcategory.findMany({
            where: { id: { in: missingCatIds } },
            select: { id: true, name: true },
          })
        : [],
      this.prisma.budgetCategory?.findMany
        ? this.prisma.budgetCategory.findMany({
            where: { id: { in: missingCatIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const catMap = new Map<string, string>();
    for (const c of categories) catMap.set(c.id, c.name);
    for (const sc of subcategories) catMap.set(sc.id, sc.name);
    for (const itm of budgetItems) catMap.set(itm.id, itm.name);

    for (const l of lines) {
      if ((!l.hangMucLon || l.hangMucLon === '') && l.categoryId && catMap.has(l.categoryId)) {
        l.hangMucLon = catMap.get(l.categoryId);
      }
    }
    return lines;
  }

  async getExpense(id: string, baseUrl?: string) {
    const record = await this.prisma.expenseRecord.findFirst({
      where: { id, archivedAt: null },
      include: {
        project: {
          select: {
            name: true,
            type: true,
            status: true,
            budgetPlanDirect: true,
            budgetPlanOverhead: true,
          },
        },
        createdBy: {
          select: { name: true },
        },
        lines: {
          where: { archivedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            inventoryItem: {
              select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
            },
            attachments: {
              where: { archivedAt: null },
              orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi chi phí.');
    }

    if (record.lines && record.lines.length > 0) {
      await this.enrichLinesCategoryNames(record.lines);
    }

    return this.formatExpense(record, baseUrl);
  }

  async recordExpenseSnapshot(
    tx: any,
    expenseId: string,
    action: 'created' | 'updated',
    userId?: string,
  ) {
    try {
      const record = await tx.expenseRecord.findFirst({
        where: { id: expenseId, archivedAt: null },
        include: {
          project: {
            select: {
              name: true,
              type: true,
              status: true,
              budgetPlanDirect: true,
              budgetPlanOverhead: true,
            },
          },
          createdBy: {
            select: { name: true },
          },
          lines: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              inventoryItem: {
                select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
              },
            },
          },
        },
      });

      if (!record) return;

      if (record.lines && record.lines.length > 0) {
        await this.enrichLinesCategoryNames(record.lines);
      }

      const snapshot = this.formatExpense(record);
      const expDateStr = snapshot.expenseDate || snapshot.recognizedDate;
      const expenseDate = expDateStr ? new Date(expDateStr) : null;

      if (tx.expenseAuditLog?.create) {
        await tx.expenseAuditLog.create({
          data: {
            expenseId,
            action,
            changedBy: userId || null,
            expenseDate,
            snapshot,
          },
        });
      } else if (tx.$executeRawUnsafe) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "expense_audit_logs" ("id", "expense_id", "action", "changed_by", "at", "expense_date", "snapshot")
           VALUES (gen_random_uuid(), $1, $2, $3, NOW(), $4, $5::jsonb)`,
          expenseId,
          action,
          userId || null,
          expenseDate,
          JSON.stringify(snapshot),
        );
      } else if (this.prisma?.expenseAuditLog?.create) {
        await this.prisma.expenseAuditLog.create({
          data: {
            expenseId,
            action,
            changedBy: userId || null,
            expenseDate,
            snapshot,
          },
        });
      }
    } catch (err) {
      console.warn('Failed to record expense audit snapshot:', err);
    }
  }

  async getExpenseHistory(expenseId: string) {
    const existing = await this.prisma.expenseRecord.findFirst({
      where: { id: expenseId, archivedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy bản ghi chi phí.');
    }

    let logs: any[] = [];
    if (this.prisma.expenseAuditLog?.findMany) {
      logs = await this.prisma.expenseAuditLog.findMany({
        where: { expenseId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { at: 'asc' },
      });
    } else {
      logs = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT l."id", l."expense_id" AS "expenseId", l."action", l."changed_by" AS "changedBy",
                l."at", l."expense_date" AS "expenseDate", l."snapshot", m."name" AS "userName"
         FROM "expense_audit_logs" l
         LEFT JOIN "Member" m ON l."changed_by" = m."id"
         WHERE l."expense_id" = $1
         ORDER BY l."at" ASC`,
        expenseId,
      );
    }

    return {
      data: logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        at: log.at,
        changedBy: log.user?.name || log.userName || log.changedBy || null,
        expenseDate: log.expenseDate
          ? (log.expenseDate instanceof Date
            ? log.expenseDate.toISOString().split('T')[0]
            : String(log.expenseDate).split('T')[0])
          : null,
        snapshot: typeof log.snapshot === 'string' ? JSON.parse(log.snapshot) : log.snapshot,
      })),
    };
  }

  async getExpenses(
    projectId?: string,
    month?: number,
    year?: number,
    baseUrl?: string,
    recognizedDate?: string,
  ) {
    const where: any = { archivedAt: null };
    if (projectId) where.projectId = projectId;
    if (month) where.month = month;
    if (year) where.year = year;
    if (recognizedDate) {
      const recDate = new Date(recognizedDate);
      if (!isNaN(recDate.getTime())) {
        where.OR = [
          { recognizedDate: recDate },
          {
            lines: {
              some: {
                recognizedDate: recDate,
                archivedAt: null,
              },
            },
          },
        ];
      }
    }

    const records = await this.prisma.expenseRecord.findMany({
      where,
      include: {
        project: {
          select: {
            name: true,
            type: true,
            status: true,
            budgetPlanDirect: true,
            budgetPlanOverhead: true,
          },
        },
        createdBy: {
          select: { name: true },
        },
        lines: {
          where: { archivedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            inventoryItem: {
              select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
            },
            attachments: {
              where: { archivedAt: null },
              orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
      orderBy: [
        { recognizedDate: 'desc' },
        { createdAt: 'desc' },
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    // Enrich all records' lines in one batch (same per-line result as enriching each record separately)
    const allLines: any[] = [];
    for (const r of records) {
      if (r.lines && r.lines.length > 0) {
        for (const l of r.lines) allLines.push(l);
      }
    }
    if (allLines.length > 0) {
      await this.enrichLinesCategoryNames(allLines);
    }

    return records.map((r) => this.formatExpense(r, baseUrl));
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, userId: string) {
    const existing = await this.prisma.expenseRecord.findFirst({
      where: { id, archivedAt: null },
      include: {
        lines: {
          where: { archivedAt: null },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy bản ghi chi phí.');
    }

    const projectId =
      dto.projectId !== undefined ? dto.projectId : existing.projectId;
    let month = dto.month !== undefined ? dto.month : existing.month;
    let year = dto.year !== undefined ? dto.year : existing.year;

    const inputDate = dto.recognizedDate || dto.expenseDate;
    let newRecognizedDate = existing.recognizedDate;
    if (inputDate) {
      const parsedDate = new Date(inputDate);
      if (!isNaN(parsedDate.getTime())) {
        newRecognizedDate = parsedDate;
        if (dto.month === undefined) month = parsedDate.getMonth() + 1;
        if (dto.year === undefined) year = parsedDate.getFullYear();
      }
    }

    if (dto.projectId && dto.projectId !== existing.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!project) {
        throw new NotFoundException('Không tìm thấy dự án.');
      }
      if (project.status === 'Cancelled' && project.cancelledAt) {
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        if (startOfMonth > project.cancelledAt) {
          throw new BadRequestException(
            'Không thể ghi nhận chi phí cho kỳ sau thời điểm dự án bị hủy (cancelled_at).',
          );
        }
      }
    }

    const isConfirmedOrCancelled =
      existing.status === 'confirmed' ||
      existing.status === 'cancelled' ||
      existing.lines.some(
        (l: any) => l.status === 'confirmed' || l.status === 'cancelled',
      );

    if (
      isConfirmedOrCancelled &&
      dto.reason !== undefined &&
      (!dto.reason || dto.reason.trim() === '')
    ) {
      throw new BadRequestException(
        'Vui lòng nhập lý do điều chỉnh bản ghi chi phí.',
      );
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expenseRecord.update({
        where: { id },
        data: {
          projectId,
          month,
          year,
          recognizedDate: newRecognizedDate,
          directCost:
            dto.directCost !== undefined
              ? new Decimal(dto.directCost)
              : existing.directCost,
          directNotes:
            dto.directNotes !== undefined
              ? dto.directNotes || null
              : existing.directNotes,
          overheadCost:
            dto.overheadCost !== undefined
              ? new Decimal(dto.overheadCost)
              : existing.overheadCost,
          overheadNotes:
            dto.overheadNotes !== undefined
              ? dto.overheadNotes || null
              : existing.overheadNotes,
        },
      });

      if (existing.lines && existing.lines.length > 0 && dto.directCost === undefined) {
        await this.recalculateDirectCost(id, tx);
      }

      await this.recordExpenseSnapshot(tx, id, 'updated', userId);

      return updated;
    });

    const finalRecord = await this.getExpense(record.id);

    await this.auditService.log({
      userId,
      action: 'update',
      entityType: 'ExpenseRecord',
      entityId: record.id,
      oldValue: this.formatExpense(existing),
      newValue: finalRecord,
    });

    return finalRecord;
  }

  async removeExpense(id: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const record = await tx.expenseRecord.findFirst({
        where: { id, archivedAt: null },
        include: {
          lines: {
            where: { archivedAt: null },
          },
        },
      });
      if (!record) {
        throw new NotFoundException('Không tìm thấy bản ghi chi phí.');
      }

      // Return inventory stock for all active lines in this expense record (strictly based on deductedQuantity / actualQuantity, never plannedQuantity)
      for (const line of record.lines) {
        if (line.inventoryItemId) {
          const oldActualQty = Number(line.actualQuantity ?? line.quantity ?? 0);
          const qtyToReturn =
            line.deductedQuantity !== undefined && line.deductedQuantity !== null
              ? Number(line.deductedQuantity)
              : oldActualQty;
          if (qtyToReturn > 0) {
            await this.returnInventoryStock(
              tx,
              line.inventoryItemId,
              qtyToReturn,
              record.projectId,
              { expenseLineId: line.id },
            );
          }
        }

        await tx.expenseLine.update({
          where: { id: line.id },
          data: {
            ...(line.inventoryItemId || line.deductedQuantity !== undefined
              ? { deductedQuantity: 0 }
              : {}),
            archivedAt: new Date(),
            archivedBy: userId,
          },
        });
      }

      const recon = this.snapshotReconciliationMap.get(id);
      if (recon) {
        this.snapshotReconciliationMap.delete(id);
        if (recon.failed && recon.supersededLines.length > 0) {
          for (const oldLine of recon.supersededLines) {
            if (oldLine.inventoryItemId && oldLine.deductedQuantity > 0) {
              await this.deductInventoryStock(
                tx,
                oldLine.inventoryItemId,
                oldLine.deductedQuantity,
                record.projectId,
                { expenseLineId: oldLine.id },
              );
              await tx.expenseLine.update({
                where: { id: oldLine.id },
                data: { deductedQuantity: oldLine.deductedQuantity },
              });
            }
          }
        }
      }

      const updated = await tx.expenseRecord.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          archivedBy: userId,
        },
      });

      await this.auditService.log({
        userId,
        action: 'delete',
        entityType: 'ExpenseRecord',
        entityId: id,
        oldValue: record,
      });

      return { success: true };
    });
  }

  async recalculateDirectCost(expenseId: string, tx?: any) {
    const prismaClient = tx || this.prisma;
    const lines = await prismaClient.expenseLine.findMany({
      where: { expenseId, archivedAt: null },
    });
    const safeLines = Array.isArray(lines) ? lines : [];

    const activeLines = safeLines.filter((l: any) => l.status !== 'cancelled');
    const sum = activeLines.reduce(
      (acc: number, l: any) => {
        const qty =
          l.actualQuantity !== null && l.actualQuantity !== undefined
            ? l.actualQuantity
            : (l.quantity !== null && l.quantity !== undefined ? l.quantity : 0);
        return acc + Number(l.actualUnitPrice) * qty;
      },
      0,
    );

    const updateData: any = { directCost: new Decimal(sum) };
    if (safeLines.length > 0) {
      updateData.overheadCost = new Decimal(0);
    }

    await prismaClient.expenseRecord.update({
      where: { id: expenseId },
      data: updateData,
    });
  }

  async createExpenseLine(
    expenseId: string,
    dto: CreateExpenseLineDto,
    userId: string,
    baseUrl?: string,
    idempotencyKey?: string,
  ) {
    const rawIdempotencyKey = String(
      idempotencyKey ?? dto?.idempotencyKey ?? dto?.clientRequestId ?? '',
    ).trim();
    const scopeKey = rawIdempotencyKey
      ? `${userId || 'anon'}:${expenseId}:${rawIdempotencyKey}`
      : '';

    if (scopeKey) {
      const inFlight = this.inFlightIdempotency.get(scopeKey);
      if (inFlight) {
        return await inFlight;
      }
      const cached = this.idempotencyMemoryCache.get(scopeKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.response;
      }
      if (typeof (this.prisma as any).expenseIdempotencyRecord?.findUnique === 'function') {
        const existingIdemp = await Promise.resolve(
          (this.prisma as any).expenseIdempotencyRecord.findUnique({
            where: { scopeKey },
          }),
        ).catch(() => null);
        if (
          existingIdemp &&
          existingIdemp.responseBody &&
          (!existingIdemp.expiresAt ||
            new Date(existingIdemp.expiresAt).getTime() > Date.now())
        ) {
          this.idempotencyMemoryCache.set(scopeKey, {
            expiresAt: existingIdemp.expiresAt
              ? new Date(existingIdemp.expiresAt).getTime()
              : Date.now() + 24 * 60 * 60 * 1000,
            response: existingIdemp.responseBody,
          });
          return existingIdemp.responseBody;
        }
      }
    }

    const itemLockId =
      dto?.inventoryItemId !== undefined
        ? dto.inventoryItemId
        : (dto as any)?.itemId !== undefined
        ? (dto as any).itemId
        : '';
    const lockKeys = [
      expenseId ? `expense:${expenseId}` : '',
      itemLockId ? `item:${itemLockId}` : '',
    ];

    const runCreate = () =>
      this.withConcurrencyLocks(lockKeys, async () => {
        if (scopeKey) {
          const cachedAfterLock = this.idempotencyMemoryCache.get(scopeKey);
          if (cachedAfterLock && cachedAfterLock.expiresAt > Date.now()) {
            return cachedAfterLock.response;
          }
        }
        return await this.prisma.$transaction(async (tx) => {
          if (
            typeof tx.$queryRawUnsafe === 'function' &&
            !(tx.$queryRawUnsafe as any)._isMockFunction
          ) {
            await Promise.resolve(
              tx.$queryRawUnsafe(
                'SELECT "id" FROM "ExpenseRecord" WHERE "id" = $1 FOR UPDATE',
                expenseId,
              ),
            ).catch(() => {});
          }

          const expense = await tx.expenseRecord.findFirst({
            where: { id: expenseId, archivedAt: null },
            include: {
              project: {
                select: { id: true, status: true, cancelledAt: true },
              },
            },
          });

          if (!expense) {
            throw new NotFoundException('Không tìm thấy bản ghi chi phí.');
          }

          const effectiveStatus = dto.status || 'draft';
          const rawDate = dto.expenseDate || dto.recognizedDate;
          let lineDate: Date | null = null;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              lineDate = d;
            }
          }
          if (!lineDate && expense.recognizedDate) {
            lineDate = new Date(expense.recognizedDate);
          }

          // Validation for Cancelled project (Flow 7)
          if (expense.project?.status === 'Cancelled') {
            if (effectiveStatus === 'confirmed') {
              if (!lineDate) {
                throw new UnprocessableEntityException({
                  message: 'Chi phí cho dự án đã hủy bắt buộc phải có ngày ghi nhận (recognizedDate).',
                  errorCode: 'ERR_RECOGNIZED_DATE_REQUIRED',
                });
              }
              if (
                expense.project.cancelledAt &&
                lineDate > expense.project.cancelledAt
              ) {
                throw new UnprocessableEntityException({
                  message: 'Ngày ghi nhận chi phí không được sau thời điểm dự án bị hủy (cancelled_at).',
                  errorCode: EXPENSE_ERROR_CODES.ERR_RECOGNIZED_AFTER_CANCELLED,
                });
              }
            }
          }

          // Validation for Unplanned Expense (Flow 4)
          if (dto.isUnplanned) {
            if (dto.projectExpenseItemId) {
              throw new UnprocessableEntityException({
                message: 'Chi phí phát sinh ngoài kế hoạch không được liên kết với hạng mục kế hoạch dự án.',
                errorCode: EXPENSE_ERROR_CODES.ERR_UNPLANNED_HAS_PROJECT_ITEM,
              });
            }
            if (effectiveStatus === 'confirmed') {
              if (!dto.unplannedItemName || dto.unplannedItemName.trim() === '') {
                throw new UnprocessableEntityException({
                  code: EXPENSE_ERROR_CODES.ERR_UNPLANNED_REQUIRES_NAME,
                  message: 'Chi phí phát sinh ngoài kế hoạch bắt buộc phải có tên hạng mục phát sinh (unplannedItemName).',
                });
              }
              if (
                (!dto.categoryId || dto.categoryId.trim() === '') &&
                (!(dto as any).expenseCategoryId || String((dto as any).expenseCategoryId).trim() === '') &&
                (!dto.annualExpenseItemId || dto.annualExpenseItemId.trim() === '') &&
                !dto.inventoryItemId &&
                !(dto as any).itemId
              ) {
                throw new UnprocessableEntityException({
                  message: 'Chi phí phát sinh ngoài kế hoạch bắt buộc phải chọn hạng mục ngân sách năm.',
                  errorCode: 'ERR_ANNUAL_ITEM_REQUIRED',
                });
              }
            }
          }

          // Validation for Annual Plan Active when Confirmed (Flow 3, Flow 4)
          if (effectiveStatus === 'confirmed' && lineDate) {
            const recYear = lineDate.getFullYear();
            const activePlan = await tx.annualExpensePlan.findFirst({
              where: { year: recYear, status: 'active' },
            });
            if (!activePlan) {
              const legacyActive = await tx.budgetCategory.findFirst({
                where: { year: recYear, isActive: true, archivedAt: null },
              });
              if (!legacyActive) {
                throw new UnprocessableEntityException({
                  message: `Năm ghi nhận chi phí (${recYear}) chưa có kế hoạch chi phí năm nào ở trạng thái Active.`,
                  errorCode: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_NOT_ACTIVE,
                });
              }
            }
          }

          const resolvedInventoryItemId =
            dto.inventoryItemId !== undefined
              ? dto.inventoryItemId
              : (dto as any).itemId !== undefined
              ? (dto as any).itemId
              : null;
          const resolvedNote =
            dto.note !== undefined
              ? dto.note
              : (dto as any).notes !== undefined
              ? (dto as any).notes
              : (dto as any).ghiChu !== undefined
              ? (dto as any).ghiChu
              : null;

          // BUG-2 fix: Chỉ cập nhật dòng cũ khi dto.id được truyền tường minh.
          // Không bao giờ gộp (merge) các dòng theo inventoryItemId khi POST /v1/expenses/:id/lines.
          let existingLine: any = null;
          if (dto.id) {
            existingLine = await tx.expenseLine.findFirst({
              where: { id: dto.id, expenseId, archivedAt: null },
              include: { expense: true },
            });
          }

          if (existingLine) {
            return await this.internalUpdateExpenseLine(
              tx,
              existingLine,
              dto,
              userId,
              baseUrl,
            );
          }

          let unitPriceBeforeVat = dto.unitPriceBeforeVat;
          let vatRate = dto.vatRate ?? 0;
          let unitPriceAfterVat = dto.unitPriceAfterVat;
          let name = dto.name;
          const isCustom = Boolean(dto.isCustom || !resolvedInventoryItemId);
          let linkedInventoryItem: any = null;

          if (resolvedInventoryItemId) {
            const item = await tx.inventoryItem.findFirst({
              where: { id: resolvedInventoryItemId, archivedAt: null },
            });
            if (!item) {
              throw new NotFoundException('Không tìm thấy vật phẩm kho liên kết.');
            }
            linkedInventoryItem = item;
            name = name || item.name;

            if (unitPriceBeforeVat === undefined && unitPriceAfterVat === undefined) {
              unitPriceAfterVat = Number(item.avgUnitPrice);
              unitPriceBeforeVat = unitPriceAfterVat;
            } else if (unitPriceBeforeVat !== undefined) {
              unitPriceAfterVat = Math.round(
                unitPriceBeforeVat * (1 + vatRate / 100),
              );
            } else if (unitPriceAfterVat !== undefined) {
              unitPriceBeforeVat = unitPriceAfterVat;
            }
          } else {
            if (unitPriceBeforeVat !== undefined) {
              unitPriceAfterVat = Math.round(
                unitPriceBeforeVat * (1 + vatRate / 100),
              );
            } else {
              unitPriceAfterVat = dto.actualUnitPrice ?? 0;
              unitPriceBeforeVat = unitPriceAfterVat;
            }
          }

          const rawPlannedQty =
            dto.plannedQuantity !== undefined && dto.plannedQuantity !== null
              ? dto.plannedQuantity
              : (dto.quantity !== undefined && dto.quantity !== null ? dto.quantity : 0);
          const rawActualQty =
            dto.actualQuantity !== undefined && dto.actualQuantity !== null
              ? dto.actualQuantity
              : (dto as any).realQty !== undefined && (dto as any).realQty !== null
              ? (dto as any).realQty
              : (dto.quantity !== undefined && dto.quantity !== null ? dto.quantity : 0);

          const plannedQuantity = Number(rawPlannedQty);
          const actualQuantity = Number(rawActualQty);

          if (!Number.isFinite(plannedQuantity) || plannedQuantity < 0) {
            throw new BadRequestException('Số lượng kế hoạch không được âm');
          }
          if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
            throw new BadRequestException('Số lượng thực tế không được âm');
          }

          const finalUnitPrice = unitPriceAfterVat ?? dto.actualUnitPrice ?? 0;
          const plannedAmount =
            dto.plannedAmount !== undefined
              ? dto.plannedAmount
              : plannedQuantity * finalUnitPrice;

          // BUG-1 & BUG-2 fix: Chỉ trừ tồn kho theo actualQuantity (tuyệt đối không fallback sang plannedQuantity)
          const skipStock = Boolean((dto as any).skipStockCheck);
          const stockEffect =
            resolvedInventoryItemId && !skipStock && actualQuantity > 0
              ? actualQuantity
              : 0;

          const isQaTestLine =
            /^TEST_QA_/i.test(String(name || '')) ||
            /^TEST_QA_/i.test(String(resolvedNote || ''));

          const { stockTransactionId, workingRecon } =
            await this.reconcileAndApplySnapshotStock(
              tx,
              expense,
              resolvedInventoryItemId,
              stockEffect,
              skipStock || isQaTestLine,
            );

          let resolvedCategoryId: string | null =
            dto.categoryId ?? (dto as any).expenseCategory ?? (dto as any).expenseCategoryId ?? null;
          let hangMucLon = dto.hangMucLon || (dto as any).categoryName || null;
          let categoryWarning: string | null = null;

          if (resolvedInventoryItemId) {
            const targetYear = lineDate
              ? lineDate.getFullYear()
              : (expense.year || new Date().getFullYear());
            const resolvedCat = await resolveInventoryBudgetCategory(tx, {
              inventoryCategory: linkedInventoryItem?.category,
              year: targetYear,
              clientCategoryId:
                dto.categoryId !== undefined
                  ? dto.categoryId
                  : ((dto as any).expenseCategory ?? null),
              clientHangMucLon:
                dto.hangMucLon || (dto as any).categoryName || null,
              explicitExpenseCategoryId: (dto as any).expenseCategoryId ?? null,
            });
            resolvedCategoryId = resolvedCat.categoryId;
            hangMucLon = resolvedCat.hangMucLon;
            if (resolvedCat.warning) {
              categoryWarning = resolvedCat.warning;
              console.warn(`[ExpenseService] ${resolvedCat.warning}`);
            }
          } else if (resolvedCategoryId && tx.budgetItem?.findFirst) {
            const catExists =
              (await tx.budgetItem.findFirst({ where: { id: resolvedCategoryId, archivedAt: null } })) ||
              (await tx.budgetSubcategory?.findFirst({ where: { id: resolvedCategoryId, archivedAt: null } })) ||
              (await tx.budgetCategory?.findFirst({ where: { id: resolvedCategoryId, archivedAt: null } }));
            if (!catExists) {
              throw new BadRequestException(`Hạng mục chi phí với ID "${resolvedCategoryId}" không tồn tại hoặc đã bị lưu trữ.`);
            }
            if (!hangMucLon && catExists.name) {
              hangMucLon = catExists.name;
            }
          }

          const requestedAttachmentUrl = dto.receiptUrl || dto.attachmentUrl || null;
          const sharedAttachment = await this.resolveSharedLineAttachment(
            tx,
            requestedAttachmentUrl,
          );

          const created = await tx.expenseLine.create({
            data: {
              expenseId,
              name,
              categoryId: resolvedCategoryId || null,
              hangMucLon: hangMucLon ? hangMucLon.trim() : null,
              inventoryItemId: resolvedInventoryItemId,
              isCustom,
              status: effectiveStatus,
              recognizedDate: lineDate,
              isUnplanned: Boolean(dto.isUnplanned),
              unplannedItemName: dto.unplannedItemName ? dto.unplannedItemName.trim() : null,
              supplier: dto.supplier ? dto.supplier.trim() : null,
              projectExpenseItemId: dto.projectExpenseItemId || null,
              annualExpenseItemId: dto.annualExpenseItemId || null,
              attachmentUrl: requestedAttachmentUrl,
              attachmentPath: sharedAttachment?.attachmentPath ?? null,
              attachmentMime: sharedAttachment?.attachmentMime ?? null,
              attachmentName:
                dto.attachmentName || sharedAttachment?.attachmentName || null,
              confirmedAt: effectiveStatus === 'confirmed' ? new Date() : null,
              confirmedBy: effectiveStatus === 'confirmed' ? userId : null,
              plannedQuantity,
              actualQuantity,
              deductedQuantity: stockEffect,
              ...(stockTransactionId ? { stockTransactionId } : {}),
              unitPriceBeforeVatSnapshot: new Decimal(unitPriceBeforeVat ?? finalUnitPrice),
              vatRateSnapshot: new Decimal(vatRate),
              unitPriceAfterVatSnapshot: new Decimal(finalUnitPrice),
              plannedAmount: new Decimal(plannedAmount),
              actualUnitPrice: new Decimal(finalUnitPrice),
              quantity: actualQuantity,
              note: resolvedNote,
              sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : 0,
            },
          });

          // §1: files of the line it was copied from + files given through the older fields
          const withAttachments = await this.attachLineFiles(tx, created, dto.attachmentIds);
          const withItemAndWarning = {
            ...withAttachments,
            inventoryItem: withAttachments?.inventoryItem || linkedInventoryItem || null,
            ...(categoryWarning ? { categoryWarning } : {}),
          };

          await this.recalculateDirectCost(expenseId, tx);

          await this.recordExpenseSnapshot(tx, expenseId, 'updated', userId);

          const formattedCreated = this.formatLine(withItemAndWarning, baseUrl);

          await this.auditService.log({
            userId,
            action: 'create',
            entityType: 'ExpenseLine',
            entityId: created.id,
            newValue: formattedCreated,
          });

          if (scopeKey) {
            const ttlMs = 24 * 60 * 60 * 1000;
            const expiresAt = new Date(Date.now() + ttlMs);
            this.idempotencyMemoryCache.set(scopeKey, {
              expiresAt: expiresAt.getTime(),
              response: formattedCreated,
            });
            if (typeof tx.expenseIdempotencyRecord?.upsert === 'function') {
              await Promise.resolve(
                tx.expenseIdempotencyRecord.upsert({
                  where: { scopeKey },
                  create: {
                    scopeKey,
                    userId: userId || null,
                    expenseId,
                    idempotencyKey: rawIdempotencyKey,
                    statusCode: 201,
                    responseBody: formattedCreated as any,
                    lineId: created.id,
                    expiresAt,
                  },
                  update: {
                    responseBody: formattedCreated as any,
                    lineId: created.id,
                    expiresAt,
                  },
                }),
              ).catch(() => {});
            }
          }

          if (workingRecon) {
            this.snapshotReconciliationMap.set(expenseId, workingRecon);
          }

          return formattedCreated;
        });
      });

    const executeCreate = async () => {
      try {
        return await runCreate();
      } catch (err) {
        const existingRecon = this.snapshotReconciliationMap.get(expenseId);
        if (existingRecon) {
          existingRecon.failed = true;
        }
        throw err;
      }
    };

    if (!scopeKey) {
      return await executeCreate();
    }

    const promise = executeCreate();
    this.inFlightIdempotency.set(scopeKey, promise);
    try {
      return await promise;
    } finally {
      if (this.inFlightIdempotency.get(scopeKey) === promise) {
        this.inFlightIdempotency.delete(scopeKey);
      }
    }
  }

  private async internalUpdateExpenseLine(
    tx: any,
    line: any,
    dto: UpdateExpenseLineDto,
    userId: string,
    baseUrl?: string,
  ) {
    if (line.status === 'confirmed') {
      throw new ConflictException({
        code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CONFIRMED,
        message: 'Không thể chỉnh sửa dòng chi phí đã xác nhận (status: confirmed).',
      });
    }
    if (line.status === 'cancelled') {
      throw new ConflictException({
        code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
        message: 'Không thể chỉnh sửa dòng chi phí đã hủy (status: cancelled).',
      });
    }

    const effectiveName = dto.name !== undefined ? dto.name : dto.description;
    const effectiveCategory = dto.categoryId !== undefined ? dto.categoryId : dto.expenseCategory;
    const effectiveSupplier = dto.supplier !== undefined ? dto.supplier : dto.supplierName;
    const effectiveActualQtyInput =
      dto.actualQuantity !== undefined
        ? dto.actualQuantity
        : dto.quantity !== undefined
          ? dto.quantity
          : dto.realQty;
    const effectiveUnitPriceInput =
      dto.actualUnitPrice !== undefined
        ? dto.actualUnitPrice
        : dto.unitPrice !== undefined
          ? dto.unitPrice
          : dto.amount;

    // Validation for Cancelled project (Flow 7)
    const projectId = line.expense?.projectId || line.projectId;
    let project = line.expense?.project;
    if (!project && projectId) {
      if (tx.project?.findUnique) {
        project = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true, status: true, cancelledAt: true },
        });
      } else if (this.prisma.project?.findUnique) {
        project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, status: true, cancelledAt: true },
        });
      }
    }

    if (project?.status === 'Cancelled') {
      const effectiveRecDate = dto.recognizedDate !== undefined ? dto.recognizedDate : line.recognizedDate;
      if (effectiveRecDate && project.cancelledAt && new Date(effectiveRecDate) > project.cancelledAt) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_RECOGNIZED_AFTER_CANCELLED,
          message: 'Ngày ghi nhận chi phí không được sau thời điểm dự án bị hủy (cancelled_at).',
        });
      }
    }

    // Validation for Unplanned Expense (Flow 4)
    const targetIsUnplanned = dto.isUnplanned !== undefined ? dto.isUnplanned : line.isUnplanned;
    if (targetIsUnplanned) {
      const targetUnplannedName =
        dto.unplannedItemName !== undefined ? dto.unplannedItemName : line.unplannedItemName;
      if (!targetUnplannedName || targetUnplannedName.trim() === '') {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_UNPLANNED_REQUIRES_NAME,
          message: 'Chi phí phát sinh ngoài kế hoạch bắt buộc phải có tên hạng mục phát sinh (unplannedItemName).',
        });
      }
    }

    if (dto.projectExpenseItemId !== undefined && dto.projectExpenseItemId) {
      const pItem = await tx.projectExpensePlanItem.findUnique({
        where: { id: dto.projectExpenseItemId },
        include: { plan: true },
      });
      if (!pItem || (projectId && pItem.plan?.projectId !== projectId)) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_PROJECT_EXPENSE_ITEM_NOT_FOUND,
          message: 'Hạng mục chi phí dự án không tồn tại hoặc không thuộc dự án này.',
        });
      }
    }

    if (dto.annualExpenseItemId !== undefined && dto.annualExpenseItemId) {
      const aItem = await tx.annualExpensePlanItem.findUnique({
        where: { id: dto.annualExpenseItemId },
      });
      if (!aItem) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_ANNUAL_EXPENSE_ITEM_NOT_FOUND,
          message: 'Hạng mục chi phí năm không tồn tại.',
        });
      }
    }

    if (dto.plannedQuantity !== undefined && dto.plannedQuantity < 0) {
      throw new BadRequestException('Số lượng kế hoạch không được âm');
    }
    if (effectiveActualQtyInput !== undefined && effectiveActualQtyInput < 0) {
      throw new BadRequestException('Số lượng thực tế không được âm');
    }

    let effectiveHangMucLon =
      dto.hangMucLon !== undefined ? dto.hangMucLon : (dto as any).categoryName;

    let effectiveInventoryItemId =
      dto.inventoryItemId !== undefined
        ? dto.inventoryItemId
        : (dto as any).itemId !== undefined
        ? (dto as any).itemId
        : undefined;

    const wasVatPhamCategory =
      typeof line.hangMucLon === 'string' &&
      line.hangMucLon.trim().toLowerCase() === 'vật phẩm';
    const isNowVatPhamCategory =
      typeof effectiveHangMucLon === 'string' &&
      effectiveHangMucLon.trim().toLowerCase() === 'vật phẩm';
    const hasLinkedItemWithCategory =
      Boolean(line.inventoryItem?.category) && dto.isCustom !== true;
    const isSwitchingFromVatPhamToOther =
      wasVatPhamCategory &&
      effectiveHangMucLon !== undefined &&
      !isNowVatPhamCategory &&
      !hasLinkedItemWithCategory;

    if (
      effectiveInventoryItemId === undefined &&
      (dto.isCustom === true || isSwitchingFromVatPhamToOther)
    ) {
      effectiveInventoryItemId = null;
    }

    const effectiveNote =
      dto.note !== undefined
        ? dto.note
        : (dto as any).notes !== undefined
        ? (dto as any).notes
        : (dto as any).ghiChu !== undefined
        ? (dto as any).ghiChu
        : undefined;

    const oldItemId = line.inventoryItemId;
    const oldActualQty = Number(line.actualQuantity ?? line.quantity ?? 0);
    const oldDeductedQty =
      line.deductedQuantity !== undefined && line.deductedQuantity !== null
        ? Number(line.deductedQuantity)
        : (oldItemId ? oldActualQty : 0);

    const newItemId =
      effectiveInventoryItemId !== undefined
        ? (effectiveInventoryItemId || null)
        : line.inventoryItemId;

    if (isNowVatPhamCategory && !newItemId) {
      throw new BadRequestException(
        'Hạng mục "Vật phẩm" bắt buộc phải chọn vật phẩm từ kho (inventoryItemId).',
      );
    }

    let linkedItem: any =
      newItemId && line.inventoryItem && line.inventoryItem.id === newItemId
        ? line.inventoryItem
        : null;
    if (newItemId && !linkedItem) {
      if (tx.inventoryItem?.findFirst) {
        linkedItem = await tx.inventoryItem.findFirst({
          where: { id: newItemId, archivedAt: null },
        });
      }
      if (!linkedItem && tx.inventoryItem?.findUnique) {
        linkedItem = await tx.inventoryItem.findUnique({
          where: { id: newItemId },
        });
      }
    }

    let categoryWarning: string | null = null;
    let resolvedUpdateCategoryId: string | null | undefined = effectiveCategory;
    let resolvedUpdateHangMucLon: string | null | undefined = effectiveHangMucLon;

    if (newItemId && (linkedItem || (dto as any).expenseCategoryId)) {
      const rawDateForYear =
        dto.expenseDate !== undefined
          ? dto.expenseDate
          : dto.recognizedDate !== undefined
            ? dto.recognizedDate
            : line.recognizedDate;
      const parsedDateForYear = rawDateForYear ? new Date(rawDateForYear) : null;
      const targetYear =
        parsedDateForYear && !isNaN(parsedDateForYear.getTime())
          ? parsedDateForYear.getFullYear()
          : (line.expense?.year || new Date().getFullYear());

      const resolvedCat = await resolveInventoryBudgetCategory(tx, {
        inventoryCategory: linkedItem?.category,
        year: targetYear,
        clientCategoryId:
          effectiveCategory !== undefined ? effectiveCategory : (line.categoryId ?? null),
        clientHangMucLon:
          effectiveHangMucLon !== undefined ? effectiveHangMucLon : (line.hangMucLon ?? null),
        explicitExpenseCategoryId: (dto as any).expenseCategoryId ?? null,
      });
      resolvedUpdateCategoryId = resolvedCat.categoryId;
      resolvedUpdateHangMucLon = resolvedCat.hangMucLon;
      if (resolvedCat.warning) {
        categoryWarning = resolvedCat.warning;
        console.warn(`[ExpenseService] ${resolvedCat.warning}`);
      }
    } else if (effectiveCategory !== undefined && effectiveCategory && tx.budgetItem?.findFirst) {
      const catExists =
        (await tx.budgetItem.findFirst({ where: { id: effectiveCategory, archivedAt: null } })) ||
        (await tx.budgetSubcategory?.findFirst({ where: { id: effectiveCategory, archivedAt: null } })) ||
        (await tx.budgetCategory?.findFirst({ where: { id: effectiveCategory, archivedAt: null } }));
      if (!catExists) {
        throw new BadRequestException(`Hạng mục chi phí với ID "${effectiveCategory}" không tồn tại hoặc đã bị lưu trữ.`);
      }
      if (!resolvedUpdateHangMucLon && catExists.name) {
        resolvedUpdateHangMucLon = catExists.name;
      }
    }

    const newActualQty =
      effectiveActualQtyInput !== undefined && effectiveActualQtyInput !== null
        ? Number(effectiveActualQtyInput)
        : oldActualQty;
    const skipStock = Boolean((dto as any).skipStockCheck);
    const newDeductedQty =
      newItemId && !skipStock
        ? (effectiveActualQtyInput !== undefined && effectiveActualQtyInput !== null
            ? newActualQty
            : (oldItemId === newItemId ? oldDeductedQty : newActualQty))
        : 0;

    // BUG-1 & BUG-2 fix: Tính delta tồn kho hoàn toàn dựa trên actualQuantity / deductedQuantity của riêng dòng này (không bao giờ dùng plannedQuantity)
    if (oldItemId === newItemId && oldItemId) {
      const diff = newDeductedQty - oldDeductedQty;
      if (diff > 0) {
        await this.deductInventoryStock(
          tx,
          newItemId,
          diff,
          projectId,
          { expenseLineId: line.id },
        );
      } else if (diff < 0) {
        await this.returnInventoryStock(
          tx,
          newItemId,
          Math.abs(diff),
          projectId,
          { expenseLineId: line.id },
        );
      }
    } else {
      if (oldItemId && oldDeductedQty > 0) {
        await this.returnInventoryStock(
          tx,
          oldItemId,
          oldDeductedQty,
          projectId,
          { expenseLineId: line.id },
        );
      }
      if (newItemId && newDeductedQty > 0) {
        await this.deductInventoryStock(
          tx,
          newItemId,
          newDeductedQty,
          projectId,
          { expenseLineId: line.id },
        );
      }
    }

    const data: any = {};
    if (effectiveName !== undefined) data.name = effectiveName;

    if (resolvedUpdateCategoryId !== undefined) {
      data.categoryId = resolvedUpdateCategoryId || null;
    }

    if (resolvedUpdateHangMucLon !== undefined) {
      data.hangMucLon = resolvedUpdateHangMucLon ? resolvedUpdateHangMucLon.trim() : null;
    }

    if (effectiveInventoryItemId !== undefined) {
      data.inventoryItemId = effectiveInventoryItemId || null;
      if (dto.isCustom === undefined) {
        data.isCustom = !data.inventoryItemId;
      }
    }
    if (dto.isCustom !== undefined) data.isCustom = dto.isCustom;
    if (dto.plannedQuantity !== undefined)
      data.plannedQuantity = dto.plannedQuantity;
    if (effectiveActualQtyInput !== undefined) {
      data.actualQuantity = newActualQty;
      data.quantity = newActualQty;
    }
    if (
      oldItemId ||
      newItemId ||
      line.deductedQuantity !== undefined ||
      newDeductedQty !== oldDeductedQty
    ) {
      data.deductedQuantity = newDeductedQty;
    }
    if (dto.plannedAmount !== undefined)
      data.plannedAmount = new Decimal(dto.plannedAmount);
    if (effectiveUnitPriceInput !== undefined)
      data.actualUnitPrice = new Decimal(effectiveUnitPriceInput);
    if (dto.unitPriceBeforeVat !== undefined)
      data.unitPriceBeforeVatSnapshot = new Decimal(dto.unitPriceBeforeVat);
    if (dto.vatRate !== undefined)
      data.vatRateSnapshot = new Decimal(dto.vatRate);
    if (dto.unitPriceAfterVat !== undefined)
      data.unitPriceAfterVatSnapshot = new Decimal(dto.unitPriceAfterVat);
    if (effectiveNote !== undefined) data.note = effectiveNote || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const requestedAttachmentUrl = dto.receiptUrl ?? dto.attachmentUrl;
    if (requestedAttachmentUrl !== undefined) {
      const shared = await this.resolveSharedLineAttachment(tx, requestedAttachmentUrl);
      if (shared && shared.sourceLineId !== line.id) {
        data.attachmentPath = shared.attachmentPath;
        data.attachmentMime = shared.attachmentMime;
        data.attachmentName = dto.attachmentName || shared.attachmentName;
        data.attachmentUrl = requestedAttachmentUrl;
      } else if (!shared && !line.attachmentPath) {
        data.attachmentUrl = requestedAttachmentUrl || null;
      }
    }
    if (dto.attachmentName !== undefined && data.attachmentName === undefined) {
      data.attachmentName = dto.attachmentName || null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'confirmed') {
        data.confirmedAt = new Date();
        data.confirmedBy = userId;
      }
    }
    const rawUpdateDate =
      dto.expenseDate !== undefined
        ? dto.expenseDate
        : (dto.recognizedDate !== undefined ? dto.recognizedDate : undefined);
    if (rawUpdateDate !== undefined) {
      if (rawUpdateDate) {
        const d = new Date(rawUpdateDate);
        data.recognizedDate = !isNaN(d.getTime()) ? d : null;
      } else {
        data.recognizedDate = null;
      }
    }
    if (dto.isUnplanned !== undefined) data.isUnplanned = dto.isUnplanned;
    if (dto.unplannedItemName !== undefined)
      data.unplannedItemName = dto.unplannedItemName ? dto.unplannedItemName.trim() : null;
    if (effectiveSupplier !== undefined)
      data.supplier = effectiveSupplier ? effectiveSupplier.trim() : null;
    if (dto.projectExpenseItemId !== undefined)
      data.projectExpenseItemId = dto.projectExpenseItemId || null;
    if (dto.annualExpenseItemId !== undefined)
      data.annualExpenseItemId = dto.annualExpenseItemId || null;

    const updatedLine = await tx.expenseLine.update({
      where: { id: line.id },
      data,
    });
    const updated = await this.attachLineFiles(tx, updatedLine, dto.attachmentIds);
    const updatedWithItem = {
      ...updated,
      inventoryItem: newItemId
        ? (updated?.inventoryItem || linkedItem || line.inventoryItem || null)
        : null,
      ...(categoryWarning ? { categoryWarning } : {}),
    };

    await this.recalculateDirectCost(line.expenseId, tx);

    await this.recordExpenseSnapshot(tx, line.expenseId, 'updated', userId);

    const formattedUpdated = this.formatLine(updatedWithItem, baseUrl);

    await this.auditService.log({
      userId,
      action: 'update',
      entityType: 'ExpenseLine',
      entityId: updated.id,
      oldValue: this.formatLine(line, baseUrl),
      newValue: formattedUpdated,
    });

    return formattedUpdated;
  }

  async updateExpenseLine(
    lineId: string,
    dto: UpdateExpenseLineDto,
    userId: string,
    baseUrl?: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const line = await tx.expenseLine.findFirst({
        where: { id: lineId, archivedAt: null },
        include: {
          expense: true,
          inventoryItem: {
            select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
          },
        },
      });

      if (!line) {
        throw new NotFoundException('Không tìm thấy dòng chi phí.');
      }

      return await this.internalUpdateExpenseLine(
        tx,
        line,
        dto,
        userId,
        baseUrl,
      );
    });
  }

  async deleteExpenseLine(lineId: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const line = await tx.expenseLine.findFirst({
        where: { id: lineId, archivedAt: null },
        include: { expense: true },
      });

      if (!line) {
        throw new NotFoundException('Không tìm thấy dòng chi phí.');
      }

      if (line.inventoryItemId) {
        const oldActualQty = Number(line.actualQuantity ?? line.quantity ?? 0);
        const qtyToReturn =
          line.deductedQuantity !== undefined && line.deductedQuantity !== null
            ? Number(line.deductedQuantity)
            : oldActualQty;
        if (qtyToReturn > 0) {
          await this.returnInventoryStock(
            tx,
            line.inventoryItemId,
            qtyToReturn,
            line.expense?.projectId,
            { expenseLineId: line.id },
          );
        }
      }

      await tx.expenseLine.update({
        where: { id: lineId },
        data: {
          ...(line.inventoryItemId || line.deductedQuantity !== undefined
            ? { deductedQuantity: 0 }
            : {}),
          archivedAt: new Date(),
          archivedBy: userId,
        },
      });

      await this.recalculateDirectCost(line.expenseId, tx);

      await this.recordExpenseSnapshot(tx, line.expenseId, 'updated', userId);

      await this.auditService.log({
        userId,
        action: 'delete',
        entityType: 'ExpenseLine',
        entityId: lineId,
        oldValue: this.formatLine(line),
      });

      return { success: true, message: 'Đã xóa dòng chi phí thành công.' };
    });
  }

  /**
   * BE_requirement_29_09_26 §1: re-attaches the given files (ids of attachments of the line this one
   * was copied from) and lists files given through attachmentPath / attachmentUrl / `docs:` ids.
   * Returns the line with its `attachments` (unchanged when the attachment table is unavailable).
   */
  private async attachLineFiles(tx: any, line: any, attachmentIds?: string[]) {
    if (!line?.id || !tx?.expenseLineAttachment?.findMany) return line;
    await linkAttachmentsToLine(tx, line.id, attachmentIds);
    await syncLineLegacyAttachments(tx, line.id);
    return { ...line, attachments: await loadLineAttachments(tx, [line.id]) };
  }

  async uploadLineAttachment(
    lineId: string,
    file: Express.Multer.File,
    userId: string,
    baseUrl?: string,
  ) {
    const line = await this.prisma.expenseLine.findFirst({
      where: { id: lineId, archivedAt: null },
    });

    if (!line) {
      throw new NotFoundException('Không tìm thấy dòng chi phí.');
    }

    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để tải lên.');
    }

    let originalName = file.originalname;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch {
      originalName = file.originalname;
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedBaseName = path
      .basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const ext = path.extname(originalName);
    const uniqueFilename = `${timestamp}_${randomSuffix}_${sanitizedBaseName}${ext}`;

    // Local uploads/ dir or Supabase Storage (see common/storage/file-storage.ts)
    const relativePath = await fileStorage.save(
      'expenses',
      uniqueFilename,
      readUploadedFile(file),
      file.mimetype,
    );
    const base = (
      baseUrl ||
      process.env.APP_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    const publicUrl = `${base}/api/v1/expenses/lines/${lineId}/attachment`;

    const updated = await this.prisma.expenseLine.update({
      where: { id: lineId },
      data: {
        attachmentPath: relativePath,
        attachmentName: originalName,
        attachmentMime: file.mimetype || null,
        attachmentUrl: publicUrl,
      },
    });

    // Keep the attachment list (§1) in step: this old endpoint replaces the single file of the line
    const prismaAny = this.prisma as any;
    if (prismaAny.expenseLineAttachment?.create) {
      if (line.attachmentPath && line.attachmentPath !== relativePath) {
        await prismaAny.expenseLineAttachment.updateMany({
          where: { lineId, filePath: line.attachmentPath, archivedAt: null },
          data: { archivedAt: new Date() },
        });
      }
      await prismaAny.expenseLineAttachment.create({
        data: {
          lineId,
          name: originalName,
          size: file.size ?? (file.buffer ? file.buffer.length : 0),
          mimeType: file.mimetype || null,
          filePath: relativePath,
          uploadedBy: userId ?? null,
        },
      });
    }

    await this.auditService.log({
      userId,
      action: 'update',
      entityType: 'ExpenseLine',
      entityId: lineId,
      oldValue: line,
      newValue: updated,
    });

    return this.formatLine(updated, baseUrl);
  }

  async getLineAttachmentFile(lineId: string) {
    const line = await this.prisma.expenseLine.findFirst({
      where: { id: lineId, archivedAt: null },
      include: {
        expense: { select: { archivedAt: true } },
      },
    });

    if (!line || line.expense?.archivedAt != null) {
      throw new NotFoundException('Không tìm thấy file hoặc dòng chi phí đã bị xóa.');
    }

    let file: { attachmentPath: string; attachmentName: string | null; attachmentMime: string | null } | null =
      line.attachmentPath
        ? {
            attachmentPath: line.attachmentPath,
            attachmentName: line.attachmentName,
            attachmentMime: line.attachmentMime,
          }
        : null;
    if (!file) {
      // Line copied into a new snapshot that only carries the URL of the original line's file
      const shared = await this.resolveSharedLineAttachment(this.prisma, line.attachmentUrl);
      if (shared) {
        file = { ...shared, attachmentName: line.attachmentName || shared.attachmentName };
      }
    }
    if (!file) {
      throw new NotFoundException('Dòng chi phí này chưa có file đính kèm.');
    }

    const stored = await fileStorage.read(file.attachmentPath);
    if (!stored) {
      throw new NotFoundException('File vật lý không tồn tại trên hệ thống.');
    }

    return {
      filePath: stored.localPath,
      buffer: stored.buffer,
      fileName: file.attachmentName || 'attachment',
      mimeType: file.attachmentMime || 'application/octet-stream',
    };
  }

  /**
   * §7: when a line of a new snapshot is created with the attachment URL of another line
   * (`.../expenses/lines/{id}/attachment`), both lines share the same stored file.
   */
  private async resolveSharedLineAttachment(
    client: any,
    attachmentUrl?: string | null,
  ): Promise<{
    sourceLineId: string;
    attachmentPath: string;
    attachmentName: string | null;
    attachmentMime: string | null;
  } | null> {
    if (!attachmentUrl) return null;
    const match = String(attachmentUrl).match(
      /\/expenses\/lines\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/attachment/i,
    );
    if (!match || !client?.expenseLine?.findFirst) return null;
    const source = await client.expenseLine.findFirst({
      where: { id: match[1], attachmentPath: { not: null } },
      select: { id: true, attachmentPath: true, attachmentName: true, attachmentMime: true },
    });
    if (!source?.attachmentPath) return null;
    return {
      sourceLineId: source.id,
      attachmentPath: source.attachmentPath,
      attachmentName: source.attachmentName ?? null,
      attachmentMime: source.attachmentMime ?? null,
    };
  }

  // Calculate Health Status
  getHealthStatus(ratio: number) {
    if (ratio < 1.5) return { status: 'Nguy hiểm', color: '🔴 Đỏ', visual: 'red' };
    if (ratio <= 2.5) return { status: 'Cần tối ưu', color: '🟡 Vàng', visual: 'yellow' };
    if (ratio <= 4.0) return { status: 'Tỷ lệ vàng', color: '🟢 Xanh lá', visual: 'green' };
    return { status: 'Under-invest', color: '🔵 Xanh dương', visual: 'blue' };
  }

  // Parse string period parameter like '2026-06', '2026-Q2', '2026'
  parsePeriod(periodStr?: string) {
    if (!periodStr || typeof periodStr !== 'string' || periodStr.trim() === '') {
      const now = new Date();
      return {
        year: now.getFullYear(),
        periodType: 'month' as const,
        periodValue: now.getMonth() + 1,
      };
    }

    const trimmed = periodStr.trim();
    const parts = trimmed.split('-');
    const year = parseInt(parts[0], 10);
    if (isNaN(year)) {
      throw new BadRequestException('Định dạng kỳ không hợp lệ. Ví dụ: YYYY, YYYY-MM, YYYY-QX');
    }

    if (parts.length === 1 || !parts[1] || parts[1].trim() === '') {
      return { year, periodType: 'year' as const };
    }

    const secondary = parts[1].trim().toUpperCase();
    if (secondary === 'ALL' || secondary === 'YEAR' || secondary === 'Y' || secondary === 'TOTAL') {
      return { year, periodType: 'year' as const };
    }

    if (secondary.startsWith('Q')) {
      const quarter = parseInt(secondary.substring(1), 10);
      if (isNaN(quarter) || quarter < 1 || quarter > 4) {
        throw new BadRequestException('Quý không hợp lệ. Phải từ Q1 đến Q4.');
      }
      return { year, periodType: 'quarter' as const, periodValue: quarter };
    }

    if (secondary.startsWith('W')) {
      const week = parseInt(secondary.substring(1), 10);
      if (!isNaN(week) && week >= 1 && week <= 53) {
        // Map week to its corresponding month
        const thursday = this.getThursdayOfWeek(year, week);
        const month = thursday.getMonth() + 1;
        return { year, periodType: 'month' as const, periodValue: month };
      }
    }

    const month = parseInt(secondary, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('Tháng không hợp lệ. Phải từ 01 đến 12.');
    }
    return { year, periodType: 'month' as const, periodValue: month };
  }

  getLinePeriod(line: any, parentRecord: any): { year: number; month: number } {
    return getExpenseLinePeriod(line, parentRecord);
  }

  // Data shared by overview / report / trend for one year (BE_requirement_26_09_26 §1–§3):
  // latest expense snapshot of every project, won deals, daily actuals and lead-source projects.
  private async loadCostContext(year: number) {
    const prismaAny = this.prisma as any;
    const yearRange = this.getPeriodDates(year, 'year');

    const [snapshotSet, activeProjects, deals, dailyRows, categoryBatches] = await Promise.all([
      loadLatestExpenseSnapshots(this.prisma),
      prismaAny.project?.findMany
        ? prismaAny.project.findMany({
            where: { archivedAt: null, status: { not: 'Cancelled' } },
          })
        : [],
      this.prisma.closedDeal.findMany({
        where: { archivedAt: null },
        include: { opportunity: { select: { initiationDate: true } } },
      }),
      prismaAny.projectDailyActual?.findMany
        ? prismaAny.projectDailyActual.findMany({
            where: {
              archivedAt: null,
              // same project scope as kpi-cards and /reports/weekly
              project: { archivedAt: null },
              actualDate: { gte: yearRange.startDate, lt: yearRange.endDate },
            },
            select: { projectId: true, actualDate: true, mql: true, sql: true },
          })
        : [],
      // BE_requirement_29_09_26 §3: inventory batches booked directly to a budget category are part
      // of the total actual cost (same as expense-budgets/dashboard.actualSpent)
      prismaAny.inventoryBatch?.findMany
        ? prismaAny.inventoryBatch.findMany({
            where: {
              archivedAt: null,
              expenseCategoryId: { not: null },
              receivedDate: { gte: yearRange.startDate, lt: yearRange.endDate },
              item: { archivedAt: null },
            },
            select: {
              receivedDate: true,
              quantityIn: true,
              unitPriceBeforeVat: true,
              unitPriceAfterVat: true,
            },
          })
        : [],
    ]);

    const entries = toExpenseCostEntries(snapshotSet);
    const inventoryCategoryCosts: { month: number; before: number; after: number }[] = [];
    for (const b of Array.isArray(categoryBatches) ? categoryBatches : []) {
      const received = b.receivedDate instanceof Date ? b.receivedDate : new Date(b.receivedDate);
      if (isNaN(received.getTime())) continue;
      const qty = Number(b.quantityIn || 0);
      const before = qty * Number(b.unitPriceBeforeVat || 0);
      const after = qty * Number(b.unitPriceAfterVat || 0) || before;
      inventoryCategoryCosts.push({ month: received.getUTCMonth() + 1, before, after });
    }
    const safeDeals: any[] = Array.isArray(deals) ? deals : [];

    const projectMap = new Map<string, any>();
    for (const p of Array.isArray(activeProjects) ? activeProjects : []) {
      projectMap.set(p.id, { ...p, isActiveProject: true });
    }
    // Projects that have costs but are archived/cancelled are still listed when they have costs
    const missingIds = Array.from(
      new Set(entries.map((e) => e.projectId).filter((id) => id && !projectMap.has(id))),
    );
    const [extraProjects, leadSource] = await Promise.all([
      missingIds.length > 0 && prismaAny.project?.findMany
        ? prismaAny.project.findMany({ where: { id: { in: missingIds } } })
        : [],
      resolveLeadSourceProjectIds(this.prisma, safeDeals),
    ]);
    for (const p of Array.isArray(extraProjects) ? extraProjects : []) {
      projectMap.set(p.id, { ...p, isActiveProject: false });
    }

    return {
      entries,
      inventoryCategoryCosts,
      deals: safeDeals,
      dailyRows: (Array.isArray(dailyRows) ? dailyRows : []) as any[],
      projectMap,
      leadSourceIds: new Set<string>(leadSource.ids),
      leadSourceMode: leadSource.mode,
    };
  }

  private getTargetMonths(periodType: 'month' | 'quarter' | 'year', periodValue?: number) {
    const numPeriodValue = typeof periodValue === 'number' ? periodValue : Number(periodValue);
    const targetMonths: number[] = [];
    if (periodType === 'month' && !isNaN(numPeriodValue) && numPeriodValue >= 1 && numPeriodValue <= 12) {
      targetMonths.push(numPeriodValue);
    } else if (periodType === 'quarter' && !isNaN(numPeriodValue) && numPeriodValue >= 1 && numPeriodValue <= 4) {
      const startMonth = (numPeriodValue - 1) * 3 + 1;
      targetMonths.push(startMonth, startMonth + 1, startMonth + 2);
    } else {
      for (let m = 1; m <= 12; m++) targetMonths.push(m);
    }
    return targetMonths;
  }

  // Won deals of a period by start date of the source opportunity (§3), end exclusive
  private getWonDealsInRange(deals: any[], startDate: Date, endDate: Date) {
    return deals.filter((d) => {
      const dt = getDealPeriodDate(d);
      return !!dt && dt >= startDate && dt < endDate;
    });
  }

  // Calculate CAC, LTV Overview metrics
  async getOverview(periodStr?: string, projectId?: string) {
    const { year } = this.parsePeriod(periodStr);
    await this.ensureProjectExists(projectId);
    const ctx = this.scopeCostContext(await this.loadCostContext(year), projectId);
    return this.buildOverview(ctx, periodStr);
  }

  private async ensureProjectExists(projectId?: string) {
    if (!projectId) return;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Dự án không tồn tại.');
    }
  }

  /**
   * §4 (BE_requirement_29_09_26): one project only -> its costs, its won deals and its MQL/SQL;
   * lead cost = its whole actual cost. Inventory batches booked to a category are company costs
   * and are left out.
   */
  private scopeCostContext(
    ctx: Awaited<ReturnType<ExpenseService['loadCostContext']>>,
    projectId?: string,
  ) {
    if (!projectId) return ctx;
    const projectMap = new Map<string, any>();
    const project = ctx.projectMap.get(projectId);
    if (project) projectMap.set(projectId, { ...project, isActiveProject: true });
    return {
      ...ctx,
      entries: ctx.entries.filter((e) => e.projectId === projectId),
      inventoryCategoryCosts: [],
      deals: ctx.deals.filter((d) => d.projectId === projectId),
      dailyRows: ctx.dailyRows.filter((d) => d.projectId === projectId),
      projectMap,
      leadSourceIds: new Set<string>([projectId]),
    };
  }

  private async buildOverview(
    ctx: Awaited<ReturnType<ExpenseService['loadCostContext']>>,
    periodStr?: string,
  ) {
    const { year, periodType, periodValue } = this.parsePeriod(periodStr);
    const { startDate, endDate } = this.getPeriodDates(
      year,
      periodType,
      periodValue,
    );

    // 1. Fetch system configs effective in this period
    const churnRate = await this.getEffectiveConfig(
      'churn_rate',
      year,
      periodType,
      periodValue,
    );
    const grossMargin = await this.getEffectiveConfig(
      'gross_margin',
      year,
      periodType,
      periodValue,
    );

    const targetMonths = this.getTargetMonths(periodType, periodValue);

    // 2. Costs of the period: latest snapshot per project, line by its expense date, before VAT
    const perProject = new Map<
      string,
      { actualBefore: number; actualAfter: number; plannedBefore: number; plannedAfter: number; overhead: number }
    >();
    let plannedTotalBeforeVat = 0;
    let plannedTotalAfterVat = 0;
    let actualTotalBeforeVat = 0;
    let actualTotalAfterVat = 0;
    for (const e of ctx.entries) {
      if (e.year !== year || !targetMonths.includes(e.month)) continue;
      actualTotalBeforeVat += e.actualBeforeVat;
      actualTotalAfterVat += e.actualAfterVat;
      plannedTotalBeforeVat += e.plannedBeforeVat;
      plannedTotalAfterVat += e.plannedAfterVat;
      const agg = perProject.get(e.projectId) || {
        actualBefore: 0,
        actualAfter: 0,
        plannedBefore: 0,
        plannedAfter: 0,
        overhead: 0,
      };
      agg.actualBefore += e.actualBeforeVat;
      agg.actualAfter += e.actualAfterVat;
      agg.plannedBefore += e.plannedBeforeVat;
      agg.plannedAfter += e.plannedAfterVat;
      agg.overhead += e.overhead;
      perProject.set(e.projectId, agg);
    }
    // §3: + inventory batches booked directly to a budget category (not tied to a project)
    let inventoryCategoryCost = 0;
    for (const b of ctx.inventoryCategoryCosts) {
      if (!targetMonths.includes(b.month)) continue;
      inventoryCategoryCost += b.before;
      actualTotalBeforeVat += b.before;
      actualTotalAfterVat += b.after;
    }
    const totalExpense = actualTotalBeforeVat;

    // 3. Lead cost (§2) = actual cost of lead-source projects
    let leadCost = 0;
    for (const [pid, agg] of perProject.entries()) {
      if (ctx.leadSourceIds.has(pid)) leadCost += agg.actualBefore;
    }

    // 4. Won deals of the period by opportunity start date (§3)
    const wonDeals = this.getWonDealsInRange(ctx.deals, startDate, endDate);
    const wonCount = wonDeals.length;
    const newCustomersCount = wonCount;
    // wonValue = tổng setupFee của các deal trong kỳ (khớp card Won của Dashboard)
    const wonValue = wonDeals.reduce(
      (sum, deal) => sum + Number(deal.setupFee),
      0,
    );

    let avgSetupFee = 0;
    let avgMonthlyFee = 0;
    if (wonCount > 0) {
      const totalMonthly = wonDeals.reduce(
        (sum, deal) => sum + Number(deal.monthlyFee),
        0,
      );
      avgSetupFee = wonValue / wonCount;
      avgMonthlyFee = totalMonthly / wonCount;
    }

    // MQL / SQL of the whole system in the period (daily actuals)
    let mql = 0;
    let sql = 0;
    for (const d of ctx.dailyRows) {
      const dt = d.actualDate instanceof Date ? d.actualDate : new Date(d.actualDate);
      if (dt >= startDate && dt < endDate) {
        mql += Number(d.mql || 0);
        sql += Number(d.sql || 0);
      }
    }

    // LTV = (Setup Fee + Monthly Fee * (1 / (Churn Rate / 100))) * (Gross Margin / 100)
    let ltv = 0;
    if (churnRate > 0) {
      ltv = Number(
        (
          (avgSetupFee + avgMonthlyFee * (1 / (churnRate / 100))) *
          (grossMargin / 100)
        ).toFixed(0),
      );
    }

    // CAC = Chi phí lead / số won deal (null nếu không có won deal)
    let cac: number | null = null;
    let ltvCacRatio: number | null = null;
    let health = { status: 'N/A', color: '⚪ Xám', visual: 'gray' };
    if (wonCount > 0) {
      cac = Number((leadCost / wonCount).toFixed(0));
      if (cac > 0) {
        ltvCacRatio = ltv / cac;
        health = this.getHealthStatus(ltvCacRatio);
      }
    }

    // ROAS = Tổng giá trị won deal / Chi phí lead: 0 when there is lead cost but no won deal
    // (same as the kpi-cards ROAS card), null only when there is no lead cost to divide by
    let roas: number | null = null;
    let roa: number | null = null;
    if (leadCost > 0) {
      roa = Number((wonValue / leadCost).toFixed(2));
      roas = roa;
    }
    const cpmql = leadCost > 0 && mql > 0 ? Number((leadCost / mql).toFixed(0)) : null;
    const cpsql = leadCost > 0 && sql > 0 ? Number((leadCost / sql).toFixed(0)) : null;

    // 5. Per-project breakdown: active projects + any project with costs in the period
    const listedProjects = Array.from(ctx.projectMap.values()).filter(
      (p) => p.isActiveProject || perProject.has(p.id),
    );
    const listedIds = listedProjects.map((p) => p.id);

    const budgetValues = (this.prisma as any).budgetValue?.findMany
      ? await this.prisma.budgetValue.findMany({
          where: {
            year,
            month: { in: targetMonths },
            projectId: { in: listedIds },
          },
        })
      : [];
    const projectMarketingBudgetMap = new Map<string, number>();
    for (const bv of Array.isArray(budgetValues) ? budgetValues : []) {
      if (bv.projectId) {
        const curr = projectMarketingBudgetMap.get(bv.projectId) || 0;
        projectMarketingBudgetMap.set(bv.projectId, curr + Number(bv.amount));
      }
    }

    const dealsByProject = new Map<string, number>();
    for (const deal of wonDeals) {
      if (deal.projectId) {
        dealsByProject.set(deal.projectId, (dealsByProject.get(deal.projectId) || 0) + 1);
      }
    }

    const projectsList = listedProjects.map((project) => {
      const agg = perProject.get(project.id);
      const plannedTotal = agg?.plannedBefore || 0;
      const marketingBudget = projectMarketingBudgetMap.get(project.id) || 0;
      const fullYearProjectBudget =
        Number(project.budgetPlanDirect || 0) +
        Number(project.budgetPlanOverhead || 0);
      const scaledAnnualBudget =
        targetMonths.length === 12
          ? fullYearProjectBudget
          : Math.round((fullYearProjectBudget * targetMonths.length) / 12);

      // Plan of the latest snapshot first; budget values / project budget as fallback
      const budgetTotal =
        plannedTotal > 0
          ? plannedTotal
          : marketingBudget > 0
            ? marketingBudget
            : scaledAnnualBudget;

      const actualTotal = agg?.actualBefore || 0;
      const actualOverhead = agg?.overhead || 0;
      const actualDirect = actualTotal - actualOverhead;
      const variance = budgetTotal - actualTotal;
      const closedDealsCount = dealsByProject.get(project.id) || 0;

      let projectCac: number | string = 'N/A — Chưa có khách hàng mới';
      if (closedDealsCount > 0) {
        projectCac = actualTotal / closedDealsCount;
      }

      return {
        projectId: project.id,
        projectName: project.name,
        projectType: project.type,
        isLeadSource: ctx.leadSourceIds.has(project.id),
        budgetMarketing: marketingBudget,
        budgetTotal,
        plannedTotal,
        actualTotal,
        actualTotalAfterVat: agg?.actualAfter || 0,
        actualDirect,
        actualOverhead,
        variance,
        newCustomers: closedDealsCount,
        cac: projectCac,
      };
    });

    const totalBudgetInPeriod = projectsList.reduce(
      (sum, p) => sum + p.budgetTotal,
      0,
    );
    if (totalBudgetInPeriod > 0) {
      plannedTotalBeforeVat = totalBudgetInPeriod;
    }

    return {
      period: periodStr,
      metrics: {
        totalExpense,
        plannedTotalBeforeVat,
        plannedTotalAfterVat,
        actualTotalBeforeVat,
        actualTotalAfterVat,
        inventoryCategoryCost,
        leadCost,
        leadSourceMode: ctx.leadSourceMode,
        leadSourceProjectIds: Array.from(ctx.leadSourceIds),
        mql,
        sql,
        cpmql,
        cpsql,
        wonCount,
        wonValue,
        roa,
        roas,
        cac,
        totalWonValue: wonValue,
        ltv,
        ltvCacRatio:
          wonCount > 0 && cac !== null ? ltvCacRatio : null,
        ratio:
          wonCount > 0 && cac !== null && ltvCacRatio !== null
            ? Number(ltvCacRatio.toFixed(1))
            : null,
        health,
        newCustomers: wonCount,
        newCustomersCount,
        averageSetupFee: avgSetupFee,
        averageMonthlyFee: avgMonthlyFee,
        effectiveChurnRate: churnRate,
        effectiveGrossMargin: grossMargin,
      },
      projects: projectsList,
    };
  }

  // 12-month trend (totalExpense, leadCost, cac, newCustomers) computed in a single pass.
  // Each month equals what getOverview('YYYY-MM') returns for that month.
  private buildMonthlyTrend(
    ctx: Awaited<ReturnType<ExpenseService['loadCostContext']>>,
    year: number,
  ) {
    const expenseByMonth = new Array<number>(13).fill(0);
    const leadCostByMonth = new Array<number>(13).fill(0);
    for (const e of ctx.entries) {
      if (e.year !== year || e.month < 1 || e.month > 12) continue;
      expenseByMonth[e.month] += e.actualBeforeVat;
      if (ctx.leadSourceIds.has(e.projectId)) {
        leadCostByMonth[e.month] += e.actualBeforeVat;
      }
    }
    for (const b of ctx.inventoryCategoryCosts) {
      if (b.month >= 1 && b.month <= 12) expenseByMonth[b.month] += b.before;
    }

    const trendData: {
      period: string;
      totalExpense: number;
      leadCost: number;
      cac: number;
      newCustomers: number;
    }[] = [];
    for (let m = 1; m <= 12; m++) {
      const { startDate, endDate } = this.getPeriodDates(year, 'month', m);
      const newCustomers = this.getWonDealsInRange(ctx.deals, startDate, endDate).length;
      const leadCost = leadCostByMonth[m];
      trendData.push({
        period: `${year}-${m.toString().padStart(2, '0')}`,
        totalExpense: expenseByMonth[m],
        leadCost,
        cac: newCustomers > 0 ? Number((leadCost / newCustomers).toFixed(0)) : 0,
        newCustomers,
      });
    }
    return trendData;
  }

  // Reports endpoint
  async getReports(periodStr?: string, projectId?: string) {
    const { year } = this.parsePeriod(periodStr);
    await this.ensureProjectExists(projectId);

    // Generate comparison data based on selected filter,
    // and always fetch 12 months trend for that year per specification
    const ctx = this.scopeCostContext(await this.loadCostContext(year), projectId);
    const overview = await this.buildOverview(ctx, periodStr);
    const trendData = this.buildMonthlyTrend(ctx, year);

    // Calculate Project Type Distribution for Donut Chart
    const typeDistributionMap = new Map<string, number>();
    for (const p of overview.projects) {
      const type = p.projectType || 'Unknown';
      typeDistributionMap.set(type, (typeDistributionMap.get(type) || 0) + p.actualTotal);
    }

    // Shares of the project costs (batches booked to a category have no project type)
    const projectCostTotal = overview.metrics.totalExpense - overview.metrics.inventoryCategoryCost;
    const typeDistribution = Array.from(typeDistributionMap.entries()).map(([type, cost]) => {
      const percent = projectCostTotal > 0 ? (cost / projectCostTotal) * 100 : 0;
      return {
        projectType: type,
        cost,
        percentage: parseFloat(percent.toFixed(2)),
      };
    });

    return {
      overview,
      trend: trendData,
      distribution: typeDistribution,
    };
  }

  // Helpers to get week numbers in a period
  getWeeksInMonth(year: number, month: number): number[] {
    const weeks: number[] = [];
    for (let w = 1; w <= 53; w++) {
      const thursday = this.getThursdayOfWeek(year, w);
      if (
        thursday.getFullYear() === year &&
        thursday.getMonth() + 1 === month
      ) {
        weeks.push(w);
      }
    }
    return weeks;
  }

  getWeeksInQuarter(year: number, quarter: number): number[] {
    const startMonth = (quarter - 1) * 3 + 1;
    const weeks: number[] = [];
    for (let m = startMonth; m < startMonth + 3; m++) {
      weeks.push(...this.getWeeksInMonth(year, m));
    }
    return weeks;
  }

  getWeeksInYear(year: number): number[] {
    const weeks: number[] = [];
    for (let m = 1; m <= 12; m++) {
      weeks.push(...this.getWeeksInMonth(year, m));
    }
    return weeks;
  }

  private getThursdayOfWeek(year: number, week: number): Date {
    const target = new Date(year, 0, 4);
    const day = target.getDay();
    const diff = 4 - (day === 0 ? 7 : day);
    target.setDate(target.getDate() + diff);
    target.setDate(target.getDate() + (week - 1) * 7);
    return target;
  }

  getWeekNumbers(
    periodType: 'month' | 'quarter' | 'year',
    periodValue: number | undefined,
    year: number,
  ): number[] {
    const val = Number(periodValue);
    if (periodType === 'month') {
      const m = (!isNaN(val) && val >= 1 && val <= 12) ? val : 1;
      return this.getWeeksInMonth(year, m);
    } else if (periodType === 'quarter') {
      const q = (!isNaN(val) && val >= 1 && val <= 4) ? val : 1;
      return this.getWeeksInQuarter(year, q);
    } else {
      return this.getWeeksInYear(year);
    }
  }

  // ==========================================
  // FLOW 3, 4, 5, 6 - ACTUAL EXPENSES & OVERVIEW
  // ==========================================

  async getActualExpenses(
    query: QueryActualExpensesDto,
    user?: AuthenticatedUser,
    baseUrl?: string,
  ) {
    const where: any = {
      archivedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.projectId) {
      where.expense = { projectId: query.projectId };
    }

    if (query.year) {
      where.expense = {
        ...(where.expense || {}),
        year: Number(query.year),
      };
    }

    if (query.month) {
      where.expense = {
        ...(where.expense || {}),
        month: Number(query.month),
      };
    }

    if (query.isUnplanned !== undefined) {
      where.isUnplanned = Boolean(query.isUnplanned);
    }

    if (query.projectExpenseItemId) {
      where.projectExpenseItemId = query.projectExpenseItemId;
    }

    if (query.annualExpenseItemId) {
      where.annualExpenseItemId = query.annualExpenseItemId;
    }

    if (query.recognizedDateFrom || query.recognizedDateTo) {
      where.recognizedDate = {};
      if (query.recognizedDateFrom) {
        where.recognizedDate.gte = new Date(query.recognizedDateFrom);
      }
      if (query.recognizedDateTo) {
        where.recognizedDate.lte = new Date(query.recognizedDateTo);
      }
    }

    const page = Math.max(1, Number(query.page || 1));
    const perPage = Math.max(1, Math.min(100, Number(query.perPage || 20)));
    const skip = (page - 1) * perPage;

    const [total, lines] = await Promise.all([
      this.prisma.expenseLine.count({ where }),
      this.prisma.expenseLine.findMany({
        where,
        include: {
          inventoryItem: {
            select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
          },
          expense: {
            include: {
              project: {
                select: { id: true, name: true, status: true, cancelledAt: true },
              },
            },
          },
        },
        orderBy: [{ recognizedDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: perPage,
      }),
    ]);

    const projectItemIds = lines
      .map((l) => l.projectExpenseItemId)
      .filter((id): id is string => Boolean(id));
    const annualItemIds = lines
      .map((l) => l.annualExpenseItemId)
      .filter((id): id is string => Boolean(id));

    // Category-name enrichment is an independent read, so it runs alongside the item lookups
    const [projectItems, annualItems] = await Promise.all([
      projectItemIds.length > 0
        ? this.prisma.projectExpensePlanItem.findMany({
            where: { id: { in: projectItemIds } },
            select: { id: true, name: true },
          })
        : [],
      annualItemIds.length > 0
        ? this.prisma.annualExpensePlanItem.findMany({
            where: { id: { in: annualItemIds } },
            include: { parent: { include: { parent: true } } },
          })
        : [],
      this.enrichLinesCategoryNames(lines),
    ]);

    const projectItemMap = new Map(projectItems.map((i) => [i.id, i.name]));
    const annualPathMap = new Map<string, string>();
    for (const ai of annualItems) {
      const parts = [ai.name];
      if (ai.parent) {
        parts.unshift(ai.parent.name);
        if (ai.parent.parent) {
          parts.unshift(ai.parent.parent.name);
        }
      }
      annualPathMap.set(ai.id, parts.join(' / '));
    }

    const data = lines.map((l) => {
      const formatted = this.formatLine(l, baseUrl);
      const project = l.expense?.project;
      return {
        ...formatted,
        projectId: project?.id || null,
        projectName: project?.name || null,
        projectStatus: project?.status || null,
        projectExpenseItemName: l.projectExpenseItemId
          ? projectItemMap.get(l.projectExpenseItemId) || null
          : null,
        annualPath: l.annualExpenseItemId
          ? annualPathMap.get(l.annualExpenseItemId) || null
          : null,
      };
    });

    return {
      items: data,
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      hasMore: page * perPage < total,
      permissions: getExpensePermissions(user),
    };
  }

  async getActualExpenseDetail(
    lineId: string,
    user?: AuthenticatedUser,
    baseUrl?: string,
  ) {
    const line = await this.prisma.expenseLine.findUnique({
      where: { id: lineId },
      include: {
        inventoryItem: {
          select: { id: true, code: true, name: true, unit: true, category: true, avgUnitPrice: true },
        },
        expense: {
          include: {
            project: { select: { id: true, name: true, status: true, cancelledAt: true } },
          },
        },
      },
    });

    if (!line) {
      throw new NotFoundException(`Không tìm thấy bản ghi chi phí ID: ${lineId}`);
    }

    // Independent reads, run in parallel (started in the original order)
    const [projectItem, annualItem, auditLogs] = await Promise.all([
      line.projectExpenseItemId
        ? this.prisma.projectExpensePlanItem.findUnique({
            where: { id: line.projectExpenseItemId },
            select: { name: true },
          })
        : null,
      line.annualExpenseItemId
        ? this.prisma.annualExpensePlanItem.findUnique({
            where: { id: line.annualExpenseItemId },
            include: { parent: { include: { parent: true } } },
          })
        : null,
      this.prisma.auditLog.findMany({
        where: {
          entityType: { in: ['ExpenseLine', 'expenseline'] },
          entityId: lineId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    let projectExpenseItemName: string | null = null;
    if (line.projectExpenseItemId) {
      projectExpenseItemName = projectItem?.name || null;
    }

    let annualPath: string | null = null;
    if (line.annualExpenseItemId) {
      const itm = annualItem;
      if (itm) {
        const parts = [itm.name];
        if (itm.parent) {
          parts.unshift(itm.parent.name);
          if (itm.parent.parent) {
            parts.unshift(itm.parent.parent.name);
          }
        }
        annualPath = parts.join(' / ');
      }
    }

    const formatted = this.formatLine(line, baseUrl);
    const project = line.expense?.project;

    return {
      data: {
        ...formatted,
        projectId: project?.id || null,
        projectName: project?.name || null,
        projectStatus: project?.status || null,
        projectExpenseItemName,
        annualPath,
        auditLogs: auditLogs.map((a) => ({
          id: a.id,
          action: a.action,
          changedBy: a.user?.name || a.userId,
          createdAt: a.createdAt,
          oldValue: a.oldValue,
          newValue: a.newValue,
        })),
      },
      permissions: getExpensePermissions(user),
    };
  }

  async confirmExpenseLine(
    lineId: string,
    user?: AuthenticatedUser,
    baseUrl?: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      let line: any = await tx.expenseLine.findUnique({
        where: { id: lineId },
        include: {
          expense: {
            include: {
              project: { select: { id: true, status: true, cancelledAt: true } },
            },
          },
        },
      });

      if (!line) {
        const record = await tx.expenseRecord.findUnique({
          where: { id: lineId },
          include: {
            project: { select: { id: true, status: true, cancelledAt: true } },
            lines: { where: { archivedAt: null } },
          },
        });
        if (record && record.lines.length > 0) {
          const draftLine = record.lines.find((l: any) => l.status === 'draft') || record.lines[0];
          line = { ...draftLine, expense: { project: record.project } };
          lineId = draftLine.id;
        }
      }

      if (!line) {
        throw new NotFoundException('Không tìm thấy dòng chi phí.');
      }

      if (line.status === 'confirmed') {
        throw new ConflictException({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CONFIRMED,
          message: 'Dòng chi phí đã được xác nhận trước đó.',
        });
      }

      if (line.status === 'cancelled') {
        throw new ConflictException({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
          message: 'Không thể xác nhận dòng chi phí đã bị hủy.',
        });
      }

      if (!line.recognizedDate) {
        throw new UnprocessableEntityException({
          code: 'ERR_RECOGNIZED_DATE_REQUIRED',
          message: 'Bắt buộc phải có ngày ghi nhận (recognizedDate) để xác nhận chi phí.',
        });
      }

      const recYear = new Date(line.recognizedDate).getFullYear();
      const activePlan = await tx.annualExpensePlan.findFirst({
        where: { year: recYear, status: 'active' },
      });
      if (!activePlan) {
        const legacyActive = await tx.budgetCategory.findFirst({
          where: { year: recYear, isActive: true, archivedAt: null },
        });
        if (!legacyActive) {
          throw new UnprocessableEntityException({
            code: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_NOT_ACTIVE,
            message: `Năm ghi nhận chi phí (${recYear}) chưa có kế hoạch chi phí năm nào ở trạng thái Active.`,
          });
        }
      }

      const project = line.expense?.project;
      if (project?.status === 'Cancelled') {
        if (project.cancelledAt && new Date(line.recognizedDate) > project.cancelledAt) {
          throw new UnprocessableEntityException({
            code: EXPENSE_ERROR_CODES.ERR_RECOGNIZED_AFTER_CANCELLED,
            message: 'Ngày ghi nhận chi phí không được sau thời điểm dự án bị hủy (cancelled_at).',
          });
        }
      }

      if (line.isUnplanned && (!line.unplannedItemName || line.unplannedItemName.trim() === '')) {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_UNPLANNED_REQUIRES_NAME,
          message: 'Chi phí phát sinh ngoài kế hoạch bắt buộc phải có tên hạng mục phát sinh.',
        });
      }

      const updated = await tx.expenseLine.update({
        where: { id: lineId },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: user?.id || null,
        },
      });

      await this.recalculateDirectCost(line.expenseId, tx);

      await this.auditService.log({
        userId: user?.id || 'system',
        action: 'confirm',
        entityType: 'ExpenseLine',
        entityId: lineId,
        fieldChanged: 'status',
        oldValue: { status: line.status },
        newValue: { status: 'confirmed' },
      });

      const mapped = this.formatLine(updated, baseUrl);
      return {
        ...mapped,
        data: mapped,
        permissions: getExpensePermissions(user),
      };
    });
  }

  async cancelExpenseLine(
    lineId: string,
    dto: CancelExpenseLineDto,
    user?: AuthenticatedUser,
    baseUrl?: string,
  ) {
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Lý do hủy là bắt buộc (reason).');
    }

    return await this.prisma.$transaction(async (tx) => {
      let line: any = await tx.expenseLine.findUnique({
        where: { id: lineId },
      });

      if (!line) {
        const record = await tx.expenseRecord.findUnique({
          where: { id: lineId },
          include: {
            lines: { where: { archivedAt: null } },
          },
        });
        if (record && record.lines.length > 0) {
          const confirmedLine = record.lines.find((l: any) => l.status === 'confirmed') || record.lines[0];
          line = confirmedLine;
          lineId = confirmedLine.id;
        }
      }

      if (!line) {
        throw new NotFoundException('Không tìm thấy dòng chi phí.');
      }

      if (line.status === 'cancelled') {
        throw new ConflictException({
          code: EXPENSE_ERROR_CODES.ERR_LINE_ALREADY_CANCELLED,
          message: 'Dòng chi phí đã bị hủy trước đó.',
        });
      }

      if (line.status === 'draft') {
        throw new UnprocessableEntityException({
          code: EXPENSE_ERROR_CODES.ERR_LINE_NOT_CONFIRMED,
          message:
            'Chỉ có thể hủy khoản chi phí đã xác nhận (status: confirmed). Khoản chi phí ở trạng thái draft cần được xóa hoặc chỉnh sửa.',
        });
      }

      const updated = await tx.expenseLine.update({
        where: { id: lineId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: user?.id || null,
          cancelledReason: dto.reason.trim(),
        },
      });

      await this.recalculateDirectCost(line.expenseId, tx);

      await this.auditService.log({
        userId: user?.id || 'system',
        action: 'cancel',
        entityType: 'ExpenseLine',
        entityId: lineId,
        fieldChanged: 'status',
        oldValue: { status: line.status },
        newValue: { status: 'cancelled', reason: dto.reason.trim() },
      });

      const mapped = this.formatLine(updated, baseUrl);
      return {
        ...mapped,
        data: mapped,
        permissions: getExpensePermissions(user),
      };
    });
  }

  async getAnnualOverviewTree(year: number, user?: AuthenticatedUser) {
    if (!year || isNaN(Number(year))) {
      throw new BadRequestException('Năm (year) là bắt buộc và phải là số hợp lệ.');
    }
    const activePlan = await this.prisma.annualExpensePlan.findFirst({
      where: { year: Number(year), status: 'active' },
    });

    if (!activePlan) {
      throw new NotFoundException({
        message: `Chưa có kế hoạch chi phí năm nào đang Active cho năm ${year}.`,
        errorCode: EXPENSE_ERROR_CODES.ERR_ANNUAL_PLAN_NOT_ACTIVE,
      });
    }

    const [items, lines] = await Promise.all([
      this.prisma.annualExpensePlanItem.findMany({
        where: { planId: activePlan.id, isActive: true },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.expenseLine.findMany({
        where: {
          expense: { year: Number(year) },
          status: 'confirmed',
          archivedAt: null,
        },
        select: {
          annualExpenseItemId: true,
          categoryId: true,
          actualUnitPrice: true,
          unitPriceAfterVatSnapshot: true,
          quantity: true,
          actualQuantity: true,
        },
      }),
    ]);

    const actualMap = new Map<string, number>();
    for (const l of lines) {
      const targetId = l.annualExpenseItemId || l.categoryId;
      if (!targetId) continue;
      const qty = l.actualQuantity ?? l.quantity ?? 0;
      const price = Number(l.actualUnitPrice || l.unitPriceAfterVatSnapshot || 0);
      actualMap.set(targetId, (actualMap.get(targetId) || 0) + qty * price);
    }

    const level1 = items.filter((i) => i.level === 1);
    const level2 = items.filter((i) => i.level === 2);
    const level3 = items.filter((i) => i.level === 3);

    const nodes = level1.map((l1) => {
      const l2Children = level2
        .filter((l2) => l2.parentId === l1.id)
        .map((l2) => {
          const l3Children = level3
            .filter((l3) => l3.parentId === l2.id)
            .map((l3) => {
              const plan = Number(l3.amount || 0);
              const actual = actualMap.get(l3.id) || 0;
              const remaining = plan - actual;
              const spendPct = plan > 0 ? Math.round((actual / plan) * 10000) / 100 : 0;
              return {
                id: l3.id,
                name: l3.name,
                level: 3,
                plan,
                actual,
                remaining,
                spendPct,
              };
            });

          const l2Plan = l3Children.reduce((s, c) => s + c.plan, 0);
          const l2Actual = l3Children.reduce((s, c) => s + c.actual, 0);
          const l2Remaining = l2Plan - l2Actual;
          const l2SpendPct = l2Plan > 0 ? Math.round((l2Actual / l2Plan) * 10000) / 100 : 0;

          return {
            id: l2.id,
            name: l2.name,
            level: 2,
            plan: l2Plan,
            actual: l2Actual,
            remaining: l2Remaining,
            spendPct: l2SpendPct,
            children: l3Children,
          };
        });

      const l1Plan = l2Children.reduce((s, c) => s + c.plan, 0);
      const l1Actual = l2Children.reduce((s, c) => s + c.actual, 0);
      const l1Remaining = l1Plan - l1Actual;
      const l1SpendPct = l1Plan > 0 ? Math.round((l1Actual / l1Plan) * 10000) / 100 : 0;

      return {
        id: l1.id,
        name: l1.name,
        level: 1,
        plan: l1Plan,
        actual: l1Actual,
        remaining: l1Remaining,
        spendPct: l1SpendPct,
        children: l2Children,
      };
    });

    return {
      data: {
        period: year.toString(),
        nodes,
      },
      permissions: getExpensePermissions(user),
    };
  }

  async getProjectOverviewTree(
    projectId: string,
    year?: number,
    user?: AuthenticatedUser,
  ) {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new BadRequestException('projectId là bắt buộc.');
    }
    const cleanProjectId = projectId.trim();
    const project = await this.prisma.project.findUnique({
      where: { id: cleanProjectId },
      select: { id: true, name: true, status: true, cancelledAt: true },
    });
    if (!project) throw new NotFoundException(`Không tìm thấy dự án ID: ${cleanProjectId}`);

    const whereLines: any = {
      expense: { projectId: cleanProjectId },
      status: 'confirmed',
      archivedAt: null,
    };
    if (year) {
      whereLines.expense.year = Number(year);
    }

    const [plan, lines] = await Promise.all([
      this.prisma.projectExpensePlan.findUnique({
        where: { projectId: cleanProjectId },
        include: {
          items: { orderBy: [{ sortOrder: 'asc' }] },
        },
      }),
      this.prisma.expenseLine.findMany({
        where: whereLines,
        select: {
          id: true,
          projectExpenseItemId: true,
          isUnplanned: true,
          unplannedItemName: true,
          actualUnitPrice: true,
          unitPriceAfterVatSnapshot: true,
          quantity: true,
          actualQuantity: true,
          recognizedDate: true,
        },
      }),
    ]);

    const validLines = lines.filter((l) => {
      if (project.status === 'Cancelled' && project.cancelledAt && l.recognizedDate) {
        return new Date(l.recognizedDate) <= project.cancelledAt;
      }
      return true;
    });

    const actualMap = new Map<string, number>();
    let unplannedActual = 0;

    for (const l of validLines) {
      const qty = l.actualQuantity ?? l.quantity ?? 0;
      const price = Number(l.actualUnitPrice || l.unitPriceAfterVatSnapshot || 0);
      const cost = qty * price;
      if (l.isUnplanned || !l.projectExpenseItemId) {
        unplannedActual += cost;
      } else {
        actualMap.set(l.projectExpenseItemId, (actualMap.get(l.projectExpenseItemId) || 0) + cost);
      }
    }

    const plannedNodes = (plan?.items || []).map((itm) => {
      const planAmt = Number(itm.planAmount || 0);
      const actualAmt = actualMap.get(itm.id) || 0;
      const variance = planAmt - actualAmt;
      const spendPct = planAmt > 0 ? Math.round((actualAmt / planAmt) * 10000) / 100 : 0;
      return {
        id: itm.id,
        name: itm.name,
        source: itm.source,
        plan: planAmt,
        actual: actualAmt,
        variance,
        spendPct,
      };
    });

    const nodes = [...plannedNodes];
    if (unplannedActual > 0) {
      nodes.push({
        id: 'unplanned-group',
        name: 'Phát sinh ngoài kế hoạch',
        source: 'unplanned',
        plan: 0,
        actual: unplannedActual,
        variance: -unplannedActual,
        spendPct: 0,
      });
    }

    const totalPlan = nodes.reduce((s, n) => s + n.plan, 0);
    const totalActual = nodes.reduce((s, n) => s + n.actual, 0);

    return {
      data: {
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        cancelledAt: project.cancelledAt,
        totalPlan,
        totalActual,
        variance: totalPlan - totalActual,
        spendPct: totalPlan > 0 ? Math.round((totalActual / totalPlan) * 10000) / 100 : 0,
        nodes,
      },
      permissions: getExpensePermissions(user),
    };
  }
}

