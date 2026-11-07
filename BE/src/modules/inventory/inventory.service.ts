import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseSafeDate } from '../../common/utils/date.util';
import {
  CreateBatchDto,
  CreateInventoryEntryDto,
  CreateInventoryItemDto,
  CreateInventoryTransactionDto,
  GetInventoryItemsQueryDto,
  GetTransactionsQueryDto,
  UpdateBatchDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { resolveInventoryBudgetCategory } from '../expense/inventory-budget-category.util';

@Injectable()
export class InventoryService {
  static readonly MAX_ITEMS_LIMIT = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private computeVatPrices(dto: {
    unitPriceBeforeVat?: number;
    vatRate?: number;
    unitPriceAfterVat?: number;
    unitPrice?: number;
  }) {
    let vatRate = dto.vatRate !== undefined && dto.vatRate !== null ? Number(dto.vatRate) : 0;
    if (vatRate < 0 || vatRate > 100) {
      throw new BadRequestException('VAT rate phải nằm trong khoảng từ 0 đến 100%.');
    }

    let unitPriceBeforeVat = dto.unitPriceBeforeVat;
    let unitPriceAfterVat = dto.unitPriceAfterVat;

    if (unitPriceBeforeVat !== undefined && unitPriceBeforeVat !== null) {
      const priceBefore = Number(unitPriceBeforeVat);
      if (priceBefore < 0) {
        throw new BadRequestException('Đơn giá trước VAT không được âm.');
      }
      unitPriceBeforeVat = priceBefore;
      unitPriceAfterVat = Math.round(priceBefore * (1 + vatRate / 100));
    } else if (unitPriceAfterVat !== undefined && unitPriceAfterVat !== null) {
      const priceAfter = Number(unitPriceAfterVat);
      if (priceAfter < 0) {
        throw new BadRequestException('Đơn giá sau VAT không được âm.');
      }
      unitPriceAfterVat = priceAfter;
      unitPriceBeforeVat =
        vatRate > 0
          ? Math.round(priceAfter / (1 + vatRate / 100))
          : priceAfter;
    } else if (dto.unitPrice !== undefined && dto.unitPrice !== null) {
      const price = Number(dto.unitPrice);
      if (price < 0) {
        throw new BadRequestException('Đơn giá không được âm.');
      }
      unitPriceBeforeVat = price;
      unitPriceAfterVat = Math.round(price * (1 + vatRate / 100));
    } else {
      unitPriceBeforeVat = 0;
      vatRate = 0;
      unitPriceAfterVat = 0;
    }

    return {
      unitPriceBeforeVat: new Decimal(unitPriceBeforeVat),
      vatRate: new Decimal(vatRate),
      unitPriceAfterVat: new Decimal(unitPriceAfterVat),
      unitPrice: new Decimal(unitPriceAfterVat),
    };
  }

  private normalizeBatchCode(code: unknown): string {
    return typeof code === 'string' ? code.trim() : '';
  }

  /**
   * Finds a batch whose code collides with `code` (BE_requirement_26_09_26 §6): a batch that is
   * not deleted, of an item that is not deleted, whose code matches after trim, case-insensitively.
   * Codes of deleted batches / items can be reused (the DB unique index is partial, see ensureTables).
   * `contains` (not `equals`) is used so legacy codes with stray spaces are found too.
   */
  async findBatchCodeConflict(code: string, excludeId?: string, db: any = this.prisma) {
    const normalized = this.normalizeBatchCode(code);
    if (!normalized) return null;
    const lower = normalized.toLowerCase();

    const candidates: any[] = await db.inventoryBatch.findMany({
      where: {
        batchCode: { contains: normalized, mode: 'insensitive' },
        archivedAt: null,
        item: { archivedAt: null },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        batchCode: true,
        itemId: true,
        archivedAt: true,
        item: { select: { name: true, archivedAt: true } },
      },
    });

    const match = candidates.find(
      (b) =>
        !b.archivedAt &&
        !b.item?.archivedAt &&
        this.normalizeBatchCode(b.batchCode).toLowerCase() === lower,
    );
    if (!match) return null;

    return {
      id: match.id as string,
      batchCode: match.batchCode as string,
      itemId: match.itemId as string,
      itemName: (match.item?.name as string | undefined) ?? null,
      archived: !!match.archivedAt,
    };
  }

  private buildBatchCodeConflictMessage(
    code: string,
    conflict: { itemName: string | null; archived: boolean },
  ) {
    const suffix = conflict.itemName ? ` (${conflict.itemName})` : '';
    return conflict.archived
      ? `Mã batch "${code}" đã được dùng cho một batch đã xoá${suffix}`
      : `Mã batch "${code}" đã tồn tại${suffix}`;
  }

  /** Trims the code and throws 400 (empty) / 409 (duplicate) before any write. */
  private async assertBatchCodeAvailable(
    rawCode: unknown,
    excludeId?: string,
    db: any = this.prisma,
  ): Promise<string> {
    const code = this.normalizeBatchCode(rawCode);
    if (!code) {
      throw new BadRequestException('Mã batch không được để trống.');
    }
    const conflict = await this.findBatchCodeConflict(code, excludeId, db);
    if (conflict) {
      throw new ConflictException(this.buildBatchCodeConflictMessage(code, conflict));
    }
    return code;
  }

  // GET /v1/inventory/batches/check-code
  async checkBatchCode(code: string, excludeId?: string) {
    const conflict = await this.findBatchCodeConflict(code, excludeId);
    return {
      exists: !!conflict,
      itemName: conflict ? conflict.itemName : null,
    };
  }

  /**
   * Resolves the optional batch -> budget category link (BE_requirement_26_09_26 §4).
   * Returns only the keys that should be written: `{}` = leave unchanged,
   * `expenseCategoryId: null` = clear the link.
   */
  private async resolveExpenseCategory(
    dto:
      | { expenseCategoryId?: string | null; expenseCategoryName?: string | null }
      | null
      | undefined,
    db: any = this.prisma,
  ): Promise<{ expenseCategoryId?: string | null; expenseCategoryName?: string | null }> {
    if (!dto) return {};
    const rawId = dto.expenseCategoryId;
    const rawName = dto.expenseCategoryName;
    if (rawId === undefined && rawName === undefined) return {};

    const name =
      typeof rawName === 'string' ? rawName.trim() || null : rawName === null ? null : undefined;

    if (rawId === null || (typeof rawId === 'string' && rawId.trim() === '')) {
      return { expenseCategoryId: null, expenseCategoryName: null };
    }
    if (rawId === undefined) {
      return { expenseCategoryName: name ?? null };
    }

    const category = await db.budgetCategory.findFirst({
      where: { id: String(rawId).trim(), archivedAt: null },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new BadRequestException('Hạng mục chi phí không tồn tại hoặc đã bị xoá.');
    }

    return {
      expenseCategoryId: category.id,
      expenseCategoryName: name || category.name,
    };
  }

  // Helper to recalculate and sync totalStock, avgUnitPrice, status for an item
  async recalculateItemStats(itemId: string, tx?: any) {
    const db = tx || this.prisma;
    const findItem = () =>
      db.inventoryItem.findUnique({
        where: { id: itemId },
      });
    const findActiveBatches = () =>
      db.inventoryBatch.findMany({
        where: {
          itemId,
          archivedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

    let item: any;
    let activeBatches: any[];
    if (tx) {
      // Keep interactive-transaction queries sequential on the tx connection
      item = await findItem();
      if (!item) return;
      activeBatches = await findActiveBatches();
    } else {
      [item, activeBatches] = await Promise.all([findItem(), findActiveBatches()]);
      if (!item) return;
    }

    let totalStock = 0;
    let totalValue = new Decimal(0);

    for (const b of activeBatches) {
      totalStock += b.currentStock;
      const batchPrice = b.unitPriceAfterVat ?? b.unitPrice;
      totalValue = totalValue.add(new Decimal(b.currentStock).mul(batchPrice));
    }

    const avgUnitPrice =
      totalStock > 0
        ? totalValue.div(new Decimal(totalStock))
        : (activeBatches.length > 0
            ? (activeBatches[0].unitPriceAfterVat ?? activeBatches[0].unitPrice)
            : new Decimal(0));

    let status = 'out';
    if (totalStock > 0) {
      if (
        item.minThreshold !== null &&
        item.minThreshold !== undefined &&
        totalStock <= item.minThreshold
      ) {
        status = 'low';
      } else {
        status = 'instock';
      }
    }

    await db.inventoryItem.update({
      where: { id: itemId },
      data: {
        totalStock,
        avgUnitPrice,
        status,
      },
    });
  }

  // 1. GET /v1/inventory/overview
  async getOverview() {
    const [activeBatches, lowStockCount] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where: { archivedAt: null },
        // Only the fields aggregated below are needed
        select: {
          status: true,
          currentStock: true,
          quantityIn: true,
          unitPrice: true,
          unitPriceAfterVat: true,
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          archivedAt: null,
          status: 'low',
        },
      }),
    ]);

    let totalValue = new Decimal(0);
    let totalImportValue = new Decimal(0);
    let totalStock = 0;
    let activeBatchCount = 0;

    for (const b of activeBatches) {
      if (b.status === 'active' && b.currentStock > 0) {
        activeBatchCount++;
      }
      const price = b.unitPriceAfterVat ?? b.unitPrice;
      totalValue = totalValue.add(new Decimal(b.currentStock).mul(price));
      // 9.1: same batch filter / price convention as totalValue, but on the imported quantity
      totalImportValue = totalImportValue.add(new Decimal(b.quantityIn ?? 0).mul(price ?? 0));
      totalStock += b.currentStock ?? 0;
    }

    return {
      totalValue: Number(totalValue),
      totalValueTrend: 0,
      lowStockCount,
      incomingCount: 0,
      incomingNote: 'tuần này',
      activeBatches: activeBatchCount,
      totalImportValue: Number(totalImportValue),
      totalStock,
    };
  }

  formatBatch(batch: any, parentItem?: any) {
    if (!batch) return batch;
    const unitPrice =
      batch.unitPrice !== null && batch.unitPrice !== undefined
        ? Number(batch.unitPrice)
        : 0;
    const vatRate =
      batch.vatRate !== null && batch.vatRate !== undefined
        ? Number(batch.vatRate)
        : 0;
    const unitPriceBeforeVat =
      batch.unitPriceBeforeVat !== null && batch.unitPriceBeforeVat !== undefined
        ? Number(batch.unitPriceBeforeVat)
        : (batch.unitPriceAfterVat !== null && batch.unitPriceAfterVat !== undefined
            ? (vatRate > 0
                ? Math.round(Number(batch.unitPriceAfterVat) / (1 + vatRate / 100))
                : Number(batch.unitPriceAfterVat))
            : unitPrice);
    const unitPriceAfterVat =
      batch.unitPriceAfterVat !== null && batch.unitPriceAfterVat !== undefined
        ? Number(batch.unitPriceAfterVat)
        : (batch.unitPriceBeforeVat !== null && batch.unitPriceBeforeVat !== undefined
            ? Math.round(Number(batch.unitPriceBeforeVat) * (1 + vatRate / 100))
            : unitPrice);

    const itemSource = parentItem || batch.item || batch.inventoryItem || null;

    return {
      ...batch,
      unitPrice: unitPriceAfterVat,
      unitPriceBeforeVat,
      vatRate,
      unitPriceAfterVat,
      quantityIn: Number(batch.quantityIn ?? 0),
      currentStock: Number(batch.currentStock ?? 0),
      note: batch.note ?? null,
      expenseCategoryId: batch.expenseCategoryId ?? null,
      expenseCategoryName: batch.expenseCategoryName ?? null,
      ...(itemSource?.category !== undefined
        ? {
            itemCategory: itemSource.category ?? null,
            inventoryItem: {
              id: itemSource.id,
              code: itemSource.code,
              name: itemSource.name,
              unit: itemSource.unit,
              category: itemSource.category ?? null,
            },
          }
        : {}),
    };
  }

  formatItem(item: any) {
    if (!item) return item;
    const currentStock = item.totalStock ?? 0;
    const avgUnitPrice =
      item.avgUnitPrice !== null && item.avgUnitPrice !== undefined
        ? Number(item.avgUnitPrice)
        : 0;

    const batches = Array.isArray(item.batches)
      ? item.batches.map((b: any) => this.formatBatch(b, item))
      : undefined;
    const latestBatch = batches && batches.length > 0 ? batches[0] : null;

    const vatRate =
      item.vatRate !== null && item.vatRate !== undefined
        ? Number(item.vatRate)
        : (latestBatch ? latestBatch.vatRate : 0);

    const unitPriceBeforeVat =
      item.unitPriceBeforeVat !== null && item.unitPriceBeforeVat !== undefined
        ? Number(item.unitPriceBeforeVat)
        : (latestBatch
            ? latestBatch.unitPriceBeforeVat
            : (vatRate > 0
                ? Math.round(avgUnitPrice / (1 + vatRate / 100))
                : avgUnitPrice));

    const unitPriceAfterVat =
      item.unitPriceAfterVat !== null && item.unitPriceAfterVat !== undefined
        ? Number(item.unitPriceAfterVat)
        : (latestBatch
            ? latestBatch.unitPriceAfterVat
            : avgUnitPrice);

    const result: any = {
      ...item,
      currentStock,
      quantity: currentStock,
      totalStock: currentStock,
      avgUnitPrice,
      unitPriceBeforeVat,
      unitPriceAfterVat,
      vatRate,
    };

    if (batches !== undefined) {
      result.batches = batches;
    }

    return result;
  }

  // 2. GET /v1/inventory/items
  async getItems(query: GetInventoryItemsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    // Cap page size: each item loads all of its batches, so unbounded limits (e.g. limit=100000) risk OOM
    const limit = Math.min(
      query.limit && query.limit > 0 ? query.limit : 10,
      InventoryService.MAX_ITEMS_LIMIT,
    );
    const skip = (page - 1) * limit;

    const where: any = { archivedAt: null };

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
      const searchedBatchCode = query.search.trim();
      if (searchedBatchCode) {
        // 9.2: search also matches the codes of the item's non-archived batches
        where.OR.push({
          batches: {
            some: {
              archivedAt: null,
              batchCode: { contains: searchedBatchCode, mode: 'insensitive' },
            },
          },
        });
      }
    }

    // 9.2 batch-level filters: the item needs one non-archived batch matching all of them
    const batchWhere: any = {};
    const receivedDate: any = {};
    const receivedFrom = parseSafeDate(query.receivedFrom);
    if (receivedFrom) {
      receivedDate.gte = receivedFrom;
    }
    const receivedTo = parseSafeDate(query.receivedTo);
    if (receivedTo) {
      // Inclusive end date: anything strictly before the following day
      receivedDate.lt = new Date(receivedTo.getTime() + 24 * 60 * 60 * 1000);
    }
    if (Object.keys(receivedDate).length > 0) {
      batchWhere.receivedDate = receivedDate;
    }
    const batchCodeFilter = query.batchCode?.trim();
    if (batchCodeFilter) {
      batchWhere.batchCode = { contains: batchCodeFilter, mode: 'insensitive' };
    }
    if (Object.keys(batchWhere).length > 0) {
      where.batches = { some: { archivedAt: null, ...batchWhere } };
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: {
          batches: {
            where: { archivedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    const formatted = items.map((item) => this.formatItem(item));
    return {
      items: formatted,
      data: formatted,
      total,
      page,
      limit,
    };
  }

  // 3. GET /v1/inventory/items/{id}
  async getItem(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
      include: {
        batches: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy vật phẩm.');
    }

    return this.formatItem(item);
  }

  // 4. POST /v1/inventory/items
  async createItem(dto: CreateInventoryItemDto, userId: string) {
    // Only non-deleted items block a code (a deleted item's code can be reused)
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { code: dto.code?.trim(), archivedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Mã vật phẩm đã tồn tại.');
    }

    const batchData =
      dto.initialBatch ||
      (dto.batchCode && dto.quantityIn && dto.quantityIn > 0
        ? {
            batchCode: dto.batchCode,
            receivedDate: dto.receivedDate || new Date().toISOString().slice(0, 10),
            quantityIn: dto.quantityIn,
            unitPriceBeforeVat: dto.unitPriceBeforeVat,
            vatRate: dto.vatRate,
            unitPriceAfterVat: dto.unitPriceAfterVat,
            unitPrice: dto.unitPrice,
            supplier: dto.supplier,
            contractCode: dto.contractCode,
            note: dto.note,
          }
        : null);

    // Validate the first batch before any write (§4 category link, §6 unique code)
    let firstBatchCode: string | null = null;
    let firstBatchCategory: { expenseCategoryId?: string | null; expenseCategoryName?: string | null } =
      {};
    if (batchData) {
      if (!batchData.quantityIn || batchData.quantityIn <= 0) {
        throw new BadRequestException('Số lượng nhập lô hàng đầu tiên phải lớn hơn 0.');
      }
      firstBatchCode = await this.assertBatchCodeAvailable(batchData.batchCode);
      const initialBatch: any = dto.initialBatch;
      const categorySource =
        initialBatch &&
        (initialBatch.expenseCategoryId !== undefined ||
          initialBatch.expenseCategoryName !== undefined)
          ? initialBatch
          : dto;
      firstBatchCategory = await this.resolveExpenseCategory(categorySource);
    }

    return await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          code: dto.code.trim(),
          name: dto.name?.trim() || dto.code.trim(),
          category: (dto.category || 'posm').toLowerCase().trim(),
          unit: dto.unit?.trim() || 'cái',
          image: dto.image || null,
          minThreshold: dto.minThreshold !== undefined ? dto.minThreshold : null,
          totalStock: 0,
          avgUnitPrice: new Decimal(0),
          status: 'out',
        },
      });

      if (batchData && firstBatchCode) {
        const vatPrices = this.computeVatPrices(batchData);
        const batch = await tx.inventoryBatch.create({
          data: {
            batchCode: firstBatchCode,
            itemId: item.id,
            receivedDate: parseSafeDate(batchData.receivedDate) || new Date(),
            quantityIn: batchData.quantityIn,
            currentStock: batchData.quantityIn,
            unitPrice: vatPrices.unitPrice,
            unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
            vatRate: vatPrices.vatRate,
            unitPriceAfterVat: vatPrices.unitPriceAfterVat,
            supplier: batchData.supplier || null,
            contractCode: batchData.contractCode || null,
            note: batchData.note ? batchData.note.trim() : (dto.note ? dto.note.trim() : null),
            ...firstBatchCategory,
            status: 'active',
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            itemId: item.id,
            batchId: batch.id,
            type: 'in',
            quantity: batchData.quantityIn,
            unitPrice: vatPrices.unitPrice,
            unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
            vatRate: vatPrices.vatRate,
            unitPriceAfterVat: vatPrices.unitPriceAfterVat,
            note: 'Tạo lô hàng ban đầu khi tạo vật phẩm',
          },
        });

        await this.recalculateItemStats(item.id, tx);
      }

      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'InventoryItem',
        entityId: item.id,
        newValue: item,
      });

      const finalItem = await tx.inventoryItem.findUnique({
        where: { id: item.id },
        include: {
          batches: {
            where: { archivedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return this.formatItem(finalItem || item);
    });
  }

  // 5. PATCH /v1/inventory/items/{id}
  async updateItem(id: string, dto: UpdateInventoryItemDto, userId: string) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy vật phẩm.');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.inventoryItem.findFirst({
        where: { code: dto.code, id: { not: id }, archivedAt: null },
      });
      if (duplicate) {
        throw new BadRequestException('Mã vật phẩm đã tồn tại.');
      }
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        code: dto.code !== undefined ? dto.code : existing.code,
        name: dto.name !== undefined ? dto.name : existing.name,
        category: dto.category !== undefined ? dto.category : existing.category,
        unit: dto.unit !== undefined ? dto.unit : existing.unit,
        image: dto.image !== undefined ? dto.image : existing.image,
        minThreshold:
          dto.minThreshold !== undefined
            ? dto.minThreshold
            : existing.minThreshold,
      },
    });

    await this.recalculateItemStats(id);

    const finalItem = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        batches: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'update',
      entityType: 'InventoryItem',
      entityId: id,
      oldValue: existing,
      newValue: finalItem,
    });

    return this.formatItem(finalItem);
  }

  // 6. DELETE /v1/inventory/items/{id}
  async deleteItem(id: string, userId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy vật phẩm.');
    }

    const now = new Date();
    await this.prisma.inventoryItem.update({
      where: { id },
      data: { archivedAt: now },
    });

    await this.prisma.inventoryBatch.updateMany({
      where: { itemId: id, archivedAt: null },
      data: { archivedAt: now },
    });

    await this.auditService.log({
      userId,
      action: 'delete',
      entityType: 'InventoryItem',
      entityId: id,
      oldValue: item,
    });

    return { success: true };
  }

  // 7. GET /v1/inventory/items/{id}/batches
  async getItemBatches(itemId: string) {
    const [item, batches] = await Promise.all([
      this.getItem(itemId), // ensures item exists (throws NotFound otherwise)
      this.prisma.inventoryBatch.findMany({
        where: { itemId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return batches.map((b) => this.formatBatch(b, item));
  }

  // 8. POST /v1/inventory/items/{id}/batches
  async createBatch(itemId: string, dto: CreateBatchDto, userId: string) {
    if (!dto.quantityIn || dto.quantityIn <= 0) {
      throw new BadRequestException('Số lượng nhập phải lớn hơn 0.');
    }

    try {
      const vatPrices = this.computeVatPrices(dto);

      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, archivedAt: null },
        });
        if (!item) {
          throw new NotFoundException('Không tìm thấy vật phẩm.');
        }

        const batchCode = await this.assertBatchCodeAvailable(dto.batchCode, undefined, tx);
        const expenseCategory = await this.resolveExpenseCategory(dto, tx);

        const batch = await tx.inventoryBatch.create({
          data: {
            batchCode,
            itemId,
            receivedDate: parseSafeDate(dto.receivedDate) || new Date(),
            quantityIn: dto.quantityIn,
            currentStock: dto.quantityIn,
            unitPrice: vatPrices.unitPrice,
            unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
            vatRate: vatPrices.vatRate,
            unitPriceAfterVat: vatPrices.unitPriceAfterVat,
            supplier: dto.supplier || null,
            contractCode: dto.contractCode || null,
            note: dto.note ? dto.note.trim() : null,
            ...expenseCategory,
            status: 'active',
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            itemId,
            batchId: batch.id,
            type: 'in',
            quantity: dto.quantityIn,
            unitPrice: vatPrices.unitPrice,
            unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
            vatRate: vatPrices.vatRate,
            unitPriceAfterVat: vatPrices.unitPriceAfterVat,
            note: 'Tạo lô hàng mới',
          },
        });

        await this.recalculateItemStats(itemId, tx);

        await this.auditService.log({
          userId,
          action: 'create',
          entityType: 'InventoryBatch',
          entityId: batch.id,
          newValue: batch,
        });

        return this.formatBatch(batch, item);
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('Mã batch đã tồn tại.');
      }
      throw error;
    }
  }

  // 9. PATCH /v1/inventory/batches/{id}
  async updateBatch(id: string, dto: UpdateBatchDto, userId: string) {
    const existing = await this.prisma.inventoryBatch.findFirst({
      where: { id, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy batch.');
    }

    let batchCode = existing.batchCode;
    if (dto.batchCode !== undefined && dto.batchCode !== null) {
      const requestedCode = this.normalizeBatchCode(dto.batchCode);
      if (!requestedCode) {
        throw new BadRequestException('Mã batch không được để trống.');
      }
      // Unchanged code (after trim) needs no lookup; otherwise compare against every other batch
      if (requestedCode !== this.normalizeBatchCode(existing.batchCode)) {
        batchCode = await this.assertBatchCodeAvailable(requestedCode, id);
      } else if (requestedCode !== existing.batchCode) {
        batchCode = requestedCode;
      }
    }

    const expenseCategory = await this.resolveExpenseCategory(dto);

    const txs = await this.prisma.inventoryTransaction.findMany({
      where: { batchId: id },
    });
    const totalOut = txs
      .filter((tx) => tx.type === 'out')
      .reduce((sum, tx) => sum + tx.quantity, 0);
    const totalReturned = txs
      .filter((tx) => tx.type === 'in' && tx.note && tx.note.toLowerCase().includes('hoàn kho'))
      .reduce((sum, tx) => sum + tx.quantity, 0);
    const totalExported = Math.max(0, totalOut - totalReturned);

    let quantityIn = existing.quantityIn;
    if (dto.quantityIn !== undefined) {
      if (dto.quantityIn < 0) {
        throw new BadRequestException('Số lượng nhập không hợp lệ.');
      }
      if (dto.quantityIn < totalExported) {
        throw new BadRequestException(
          `Không thể đặt số lượng nhập là ${dto.quantityIn}: batch này đã xuất ${totalExported}. Số lượng nhập phải >= ${totalExported}. Số lượng nhập không được nhỏ hơn số lượng đã xuất.`,
        );
      }
      quantityIn = dto.quantityIn;
    }

    let currentStock: number;
    if (dto.quantityIn !== undefined) {
      currentStock = Math.max(0, quantityIn - totalExported);
    } else {
      currentStock = existing.currentStock;
    }

    const status = currentStock > 0 ? 'active' : 'depleted';

    let vatPrices: any = undefined;
    if (
      dto.unitPriceBeforeVat !== undefined ||
      dto.vatRate !== undefined ||
      dto.unitPriceAfterVat !== undefined ||
      dto.unitPrice !== undefined
    ) {
      vatPrices = this.computeVatPrices({
        unitPriceBeforeVat:
          dto.unitPriceBeforeVat !== undefined
            ? dto.unitPriceBeforeVat
            : Number(existing.unitPriceBeforeVat ?? existing.unitPrice),
        vatRate:
          dto.vatRate !== undefined
            ? dto.vatRate
            : Number(existing.vatRate ?? 0),
        unitPriceAfterVat: dto.unitPriceAfterVat,
        unitPrice: dto.unitPrice,
      });
    }

    try {
      const updated = await this.prisma.inventoryBatch.update({
        where: { id },
        data: {
          batchCode,
          receivedDate: dto.receivedDate
            ? (parseSafeDate(dto.receivedDate) || existing.receivedDate)
            : existing.receivedDate,
          quantityIn,
          currentStock,
          unitPrice: vatPrices ? vatPrices.unitPrice : existing.unitPrice,
          unitPriceBeforeVat: vatPrices
            ? vatPrices.unitPriceBeforeVat
            : existing.unitPriceBeforeVat,
          vatRate: vatPrices ? vatPrices.vatRate : existing.vatRate,
          unitPriceAfterVat: vatPrices
            ? vatPrices.unitPriceAfterVat
            : existing.unitPriceAfterVat,
          supplier:
            dto.supplier !== undefined ? dto.supplier : existing.supplier,
          contractCode:
            dto.contractCode !== undefined
              ? dto.contractCode
              : existing.contractCode,
          note:
            dto.note !== undefined
              ? (dto.note ? dto.note.trim() : null)
              : existing.note,
          ...expenseCategory,
          status,
        },
      });

      await this.recalculateItemStats(existing.itemId);

      await this.auditService.log({
        userId,
        action: 'update',
        entityType: 'InventoryBatch',
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });

      return this.formatBatch(updated);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('Mã batch đã tồn tại.');
      }
      throw error;
    }
  }

  // 10. DELETE /v1/inventory/batches/{id}
  async deleteBatch(id: string, userId: string) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { id, archivedAt: null },
    });

    if (!batch) {
      throw new NotFoundException('Không tìm thấy batch.');
    }

    await this.prisma.inventoryBatch.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.recalculateItemStats(batch.itemId);

    await this.auditService.log({
      userId,
      action: 'delete',
      entityType: 'InventoryBatch',
      entityId: id,
      oldValue: batch,
    });

    return { success: true };
  }

  // 11. POST /v1/inventory/entries (Phiếu nhập kho)
  async createEntry(dto: CreateInventoryEntryDto, userId: string) {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Số lượng nhập phải lớn hơn 0.');
    }

    try {
      const vatPrices = this.computeVatPrices(dto);

      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findFirst({
          where: { id: dto.itemId, archivedAt: null },
        });

        if (!item) {
          throw new NotFoundException('Không tìm thấy vật phẩm.');
        }

        const batchCode = this.normalizeBatchCode(dto.batchCode);
        if (!batchCode) {
          throw new BadRequestException('Mã batch không được để trống.');
        }

        // An entry with the exact code of an existing batch of the SAME item tops that batch up
        // (existing behaviour); any other collision (other item, case/space variant) is a 409.
        const conflict = await this.findBatchCodeConflict(batchCode, undefined, tx);
        const topUpExisting =
          !!conflict &&
          !conflict.archived &&
          conflict.itemId === dto.itemId &&
          this.normalizeBatchCode(conflict.batchCode) === batchCode;
        if (conflict && !topUpExisting) {
          throw new ConflictException(this.buildBatchCodeConflictMessage(batchCode, conflict));
        }

        const expenseCategory = await this.resolveExpenseCategory(dto, tx);

        let batch = topUpExisting
          ? await tx.inventoryBatch.findFirst({
              where: { id: conflict!.id, archivedAt: null },
            })
          : null;

        if (batch) {
          const newQtyIn = batch.quantityIn + dto.quantity;
          const newStock = batch.currentStock + dto.quantity;
          batch = await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              quantityIn: newQtyIn,
              currentStock: newStock,
              unitPrice: vatPrices.unitPrice,
              unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
              vatRate: vatPrices.vatRate,
              unitPriceAfterVat: vatPrices.unitPriceAfterVat,
              receivedDate: parseSafeDate(dto.receivedDate) || batch.receivedDate,
              supplier: dto.supplier !== undefined ? dto.supplier : batch.supplier,
              contractCode:
                dto.contractCode !== undefined
                  ? dto.contractCode
                  : batch.contractCode,
              ...expenseCategory,
              status: 'active',
            },
          });
        } else {
          batch = await tx.inventoryBatch.create({
            data: {
              batchCode,
              itemId: dto.itemId,
              receivedDate: parseSafeDate(dto.receivedDate) || new Date(),
              quantityIn: dto.quantity,
              currentStock: dto.quantity,
              unitPrice: vatPrices.unitPrice,
              unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
              vatRate: vatPrices.vatRate,
              unitPriceAfterVat: vatPrices.unitPriceAfterVat,
              supplier: dto.supplier || null,
              contractCode: dto.contractCode || null,
              ...expenseCategory,
              status: 'active',
            },
          });
        }

        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: dto.itemId,
            batchId: batch.id,
            type: 'in',
            quantity: dto.quantity,
            unitPrice: vatPrices.unitPrice,
            unitPriceBeforeVat: vatPrices.unitPriceBeforeVat,
            vatRate: vatPrices.vatRate,
            unitPriceAfterVat: vatPrices.unitPriceAfterVat,
            note: dto.note || 'Phiếu nhập kho',
          },
        });

        await this.recalculateItemStats(dto.itemId, tx);

        await this.auditService.log({
          userId,
          action: 'create',
          entityType: 'InventoryEntry',
          entityId: transaction.id,
          newValue: { batch, transaction },
        });

        const updatedItem = await tx.inventoryItem.findUnique({
          where: { id: dto.itemId },
          include: {
            batches: {
              where: { archivedAt: null },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        return {
          batch: this.formatBatch(batch, item),
          transaction,
          item: this.formatItem(updatedItem),
        };
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('Mã batch đã tồn tại.');
      }
      throw error;
    }
  }

  // POST /v1/inventory/transactions
  async createTransaction(dto: CreateInventoryTransactionDto, userId: string) {
    const itemId = dto.itemId || (dto as any).inventoryItemId;
    const rawDate = dto.date || (dto as any).expenseDate;

    // Both existence checks are independent reads; errors are still raised item-first
    const [item, project] = await Promise.all([
      this.prisma.inventoryItem.findFirst({
        where: { id: itemId, archivedAt: null },
      }),
      dto.projectId
        ? this.prisma.project.findFirst({
            where: { id: dto.projectId, archivedAt: null },
          })
        : Promise.resolve(null),
    ]);
    if (!item) {
      throw new NotFoundException('Vật phẩm không tồn tại.');
    }

    if (dto.projectId) {
      if (!project) {
        throw new NotFoundException('Dự án không tồn tại.');
      }
    }

    const txDate = rawDate ? new Date(rawDate) : new Date();

    if (dto.type === 'out') {
      const resolvedCat = await resolveInventoryBudgetCategory(this.prisma, {
        inventoryCategory: item.category,
        year: !isNaN(txDate.getTime()) ? txDate.getFullYear() : new Date().getFullYear(),
        clientCategoryId: (dto as any).categoryId ?? null,
        explicitExpenseCategoryId: (dto as any).expenseCategoryId ?? null,
      });

      // FIFO across active batches with currentStock > 0
      const activeBatches = await this.prisma.inventoryBatch.findMany({
        where: {
          itemId,
          archivedAt: null,
          currentStock: { gt: 0 },
        },
        orderBy: [{ receivedDate: 'asc' }, { createdAt: 'asc' }],
      });

      const totalAvailable = activeBatches.reduce(
        (sum, b) => sum + b.currentStock,
        0,
      );
      if (totalAvailable < dto.quantity) {
        throw new BadRequestException(
          'Số lượng xuất vượt quá tồn kho khả dụng.',
        );
      }

      let remainingToDeduct = dto.quantity;
      const createdTxs: any[] = [];

      for (const b of activeBatches) {
        if (remainingToDeduct <= 0) break;

        const deduct = Math.min(b.currentStock, remainingToDeduct);
        const newStock = b.currentStock - deduct;
        const status = newStock > 0 ? 'active' : 'depleted';
        await this.prisma.inventoryBatch.update({
          where: { id: b.id },
          data: {
            currentStock: newStock,
            status,
          },
        });

        const txRecord = await this.prisma.inventoryTransaction.create({
          data: {
            itemId,
            projectId: dto.projectId || null,
            batchId: b.id,
            type: 'out',
            quantity: deduct,
            note: dto.note || null,
            createdAt: txDate,
          },
        });
        createdTxs.push(txRecord);

        remainingToDeduct -= deduct;
      }

      await this.recalculateItemStats(itemId);

      const transaction = createdTxs[0] || {
        id: 'no-tx',
        itemId,
        projectId: dto.projectId,
        type: 'out',
        quantity: dto.quantity,
        note: dto.note,
        createdAt: txDate,
      };

      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        newValue: createdTxs.length === 1 ? transaction : createdTxs,
      });

      return {
        id: transaction.id,
        itemId: transaction.itemId,
        inventoryItemId: transaction.itemId,
        inventoryItem: {
          id: item.id,
          code: item.code,
          name: item.name,
          unit: item.unit,
          category: item.category ?? null,
        },
        projectId: transaction.projectId,
        type: transaction.type,
        quantity: transaction.quantity,
        date: transaction.createdAt.toISOString().slice(0, 10),
        note: transaction.note,
        categoryId: resolvedCat.categoryId,
        expenseCategoryId: resolvedCat.categoryId,
        hangMucLon: resolvedCat.hangMucLon,
        expenseCategoryName: resolvedCat.hangMucLon,
        ...(resolvedCat.warning ? { categoryWarning: resolvedCat.warning } : {}),
        createdAt: transaction.createdAt,
      };
    } else {
      // Type 'in' (hoàn kho / nhập kho)
      let targetBatch: any;

      if (dto.batchId) {
        targetBatch = await this.prisma.inventoryBatch.findFirst({
          where: {
            id: dto.batchId,
            itemId,
            archivedAt: null,
          },
        });

        if (!targetBatch) {
          throw new NotFoundException('Batch không tồn tại.');
        }

        const newStock = targetBatch.currentStock + dto.quantity;
        targetBatch = await this.prisma.inventoryBatch.update({
          where: { id: targetBatch.id },
          data: {
            currentStock: newStock,
            status: 'active',
          },
        });
      } else {
        // Tìm batch status = 'active' có currentStock > 0 của item đó (FIFO) hoặc tạo batch mới
        targetBatch = await this.prisma.inventoryBatch.findFirst({
          where: {
            itemId,
            archivedAt: null,
            status: 'active',
            currentStock: { gt: 0 },
          },
          orderBy: [{ receivedDate: 'asc' }, { createdAt: 'asc' }],
        });

        if (targetBatch) {
          const newStock = targetBatch.currentStock + dto.quantity;
          targetBatch = await this.prisma.inventoryBatch.update({
            where: { id: targetBatch.id },
            data: {
              currentStock: newStock,
              status: 'active',
            },
          });
        } else {
          const batchCode = `AUTO-${Date.now()}`;
          targetBatch = await this.prisma.inventoryBatch.create({
            data: {
              batchCode,
              itemId,
              receivedDate: txDate,
              quantityIn: dto.quantity,
              currentStock: dto.quantity,
              unitPrice: new Decimal(0),
              unitPriceBeforeVat: new Decimal(0),
              vatRate: new Decimal(0),
              unitPriceAfterVat: new Decimal(0),
              status: 'active',
            },
          });
        }
      }

      const transaction = await this.prisma.inventoryTransaction.create({
        data: {
          itemId,
          projectId: dto.projectId || null,
          batchId: targetBatch.id,
          type: 'in',
          quantity: dto.quantity,
          unitPrice: targetBatch.unitPrice,
          unitPriceBeforeVat: targetBatch.unitPriceBeforeVat,
          vatRate: targetBatch.vatRate,
          unitPriceAfterVat: targetBatch.unitPriceAfterVat,
          note: dto.note || null,
          createdAt: txDate,
        },
      });

      await this.recalculateItemStats(itemId);

      await this.auditService.log({
        userId,
        action: 'create',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        newValue: transaction,
      });

      return {
        id: transaction.id,
        itemId: transaction.itemId,
        projectId: transaction.projectId,
        type: transaction.type,
        quantity: transaction.quantity,
        date: transaction.createdAt.toISOString().slice(0, 10),
        note: transaction.note,
        createdAt: transaction.createdAt,
      };
    }
  }

  // 12. GET /v1/inventory/transactions
  async getTransactions(query: GetTransactionsQueryDto) {
    const where: any = {};

    if (query.itemId) {
      where.itemId = query.itemId;
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.batchId) {
      where.batchId = query.batchId;
    }

    if (query.type) {
      where.type = query.type;
    }

    return this.prisma.inventoryTransaction.findMany({
      where,
      include: {
        item: {
          select: { id: true, code: true, name: true, unit: true, category: true },
        },
        batch: {
          select: { id: true, batchCode: true, supplier: true, contractCode: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 14. DELETE /v1/inventory/transactions/{id}
  async deleteTransaction(id: string, userId: string) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction không tồn tại.');
    }

    if (transaction.batchId) {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: { id: transaction.batchId, archivedAt: null },
      });

      if (!batch) {
        throw new BadRequestException('Batch liên kết đã bị xóa.');
      }

      let newStock = batch.currentStock;
      if (transaction.type === 'out') {
        newStock += transaction.quantity;
      } else if (transaction.type === 'in') {
        newStock = Math.max(0, newStock - transaction.quantity);
      }

      const status = newStock > 0 ? 'active' : 'depleted';

      await this.prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          currentStock: newStock,
          status,
        },
      });
    }

    await this.prisma.inventoryTransaction.delete({
      where: { id },
    });

    await this.recalculateItemStats(transaction.itemId);

    await this.auditService.log({
      userId,
      action: 'delete',
      entityType: 'InventoryTransaction',
      entityId: id,
      oldValue: transaction,
    });

    return {
      id: transaction.id,
      itemId: transaction.itemId,
      type: transaction.type,
      quantity: transaction.quantity,
      deleted: true,
    };
  }

  // 12. POST /v1/inventory/recalculate
  async recalculateAllBatches(
    userId?: string,
    filter?: { itemId?: string; batchId?: string },
  ) {
    const where: any = { archivedAt: null };
    if (filter?.batchId) where.id = filter.batchId;
    if (filter?.itemId) where.itemId = filter.itemId;

    const batches = await this.prisma.inventoryBatch.findMany({
      where,
      include: {
        transactions: true,
      },
    });

    const updatedBatches: any[] = [];
    const affectedItemIds = new Set<string>();

    for (const b of batches) {
      const txs = b.transactions || [];
      const totalOut = txs
        .filter((tx: any) => tx.type === 'out')
        .reduce((sum: number, tx: any) => sum + tx.quantity, 0);
      const totalReturned = txs
        .filter((tx: any) => tx.type === 'in' && tx.note && tx.note.toLowerCase().includes('hoàn kho'))
        .reduce((sum: number, tx: any) => sum + tx.quantity, 0);
      const totalExported = Math.max(0, totalOut - totalReturned);

      const correctCurrentStock = Math.max(0, b.quantityIn - totalExported);
      const correctStatus = correctCurrentStock > 0 ? 'active' : 'depleted';

      if (b.currentStock !== correctCurrentStock || b.status !== correctStatus) {
        await this.prisma.inventoryBatch.update({
          where: { id: b.id },
          data: {
            currentStock: correctCurrentStock,
            status: correctStatus,
          },
        });
        updatedBatches.push({
          id: b.id,
          batchCode: b.batchCode,
          oldStock: b.currentStock,
          newStock: correctCurrentStock,
          totalExported,
          status: correctStatus,
        });
        affectedItemIds.add(b.itemId);
      }
    }

    for (const itemId of affectedItemIds) {
      await this.recalculateItemStats(itemId);
    }

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'recalculate',
        entityType: 'InventoryBatch',
        entityId: filter?.batchId || filter?.itemId || 'all',
        newValue: {
          updatedCount: updatedBatches.length,
          updatedBatches,
        },
      });
    }

    return {
      message: `Đã tính lại tồn kho cho ${updatedBatches.length} lô hàng.`,
      updatedCount: updatedBatches.length,
      updatedBatches,
    };
  }
}
