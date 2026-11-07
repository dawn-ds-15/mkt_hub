import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function recalculateItemStats(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
  });
  if (!item) return;

  const activeBatches = await prisma.inventoryBatch.findMany({
    where: {
      itemId,
      archivedAt: null,
    },
  });

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
      : new Decimal(0);

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

  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      totalStock,
      avgUnitPrice,
      status,
    },
  });
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== DB-001: Rà soát và xử lý lô hàng rỗng === [Chế độ: ${isApply ? 'APPLY (THỰC THI)' : 'DRY-RUN (CHỈ KIỂM TRA)'}]`);

  // Tìm tất cả batch active nhưng quantityIn <= 0 hoặc currentStock <= 0 và không có transaction hợp lệ
  const allBatches = await prisma.inventoryBatch.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      item: {
        select: { id: true, code: true, name: true },
      },
      transactions: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const emptyBatches: typeof allBatches = [];

  for (const batch of allBatches) {
    const isZeroQuantity = batch.quantityIn <= 0 && batch.currentStock <= 0;
    const hasNoTransactions = batch.transactions.length === 0 && batch.currentStock <= 0;
    
    if (isZeroQuantity || hasNoTransactions) {
      emptyBatches.push(batch);
    }
  }

  console.log(`\nTổng số lô hàng đang active: ${allBatches.length}`);
  console.log(`Số lô hàng rỗng/bất thường phát hiện: ${emptyBatches.length}`);

  if (emptyBatches.length === 0) {
    console.log('✓ Không phát hiện lô hàng rỗng nào trong hệ thống.');
    return;
  }

  console.log('\nDanh sách lô hàng rỗng cần xử lý:');
  console.table(
    emptyBatches.map((b) => ({
      ID: b.id,
      'Batch Code': b.batchCode,
      'Item Code': b.item?.code || 'N/A',
      'Item Name': b.item?.name || 'N/A',
      QuantityIn: b.quantityIn,
      CurrentStock: b.currentStock,
      Transactions: b.transactions.length,
      CreatedAt: b.createdAt.toISOString(),
    })),
  );

  if (!isApply) {
    console.log('\nℹ️ Để thực hiện soft-delete và recalculate tồn kho, chạy lệnh:');
    console.log('npx ts-node scripts/cleanup-empty-batches.ts --apply');
    return;
  }

  console.log('\n--- Đang tiến hành xử lý dọn dẹp lô hàng rỗng ---');
  const affectedItemIds = new Set<string>();

  for (const batch of emptyBatches) {
    await prisma.inventoryBatch.update({
      where: { id: batch.id },
      data: {
        archivedAt: new Date(),
      },
    });
    affectedItemIds.add(batch.itemId);
    console.log(`✓ Đã archive batch: ${batch.batchCode} (${batch.id})`);
  }

  console.log('\n--- Đang đồng bộ và tính lại tồn kho cho các vật phẩm bị ảnh hưởng ---');
  for (const itemId of affectedItemIds) {
    await recalculateItemStats(itemId);
    console.log(`✓ Đã recalculate stats cho Item ID: ${itemId}`);
  }

  console.log(`\n=== Hoàn tất dọn dẹp ${emptyBatches.length} lô hàng rỗng thành công! ===`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi thực hiện dọn dẹp:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
