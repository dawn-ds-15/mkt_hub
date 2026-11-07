import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu chuyển đổi directCost sang ExpenseLine ---');

  const records = await prisma.expenseRecord.findMany({
    where: {
      archivedAt: null,
      directCost: { gt: 0 },
    },
    include: {
      lines: {
        where: { archivedAt: null },
      },
    },
  });

  let migratedCount = 0;

  for (const record of records) {
    if (record.lines.length === 0) {
      await prisma.expenseLine.create({
        data: {
          expenseId: record.id,
          name: record.directNotes || 'Chi phí trực tiếp',
          isCustom: true,
          plannedQuantity: 1,
          actualQuantity: 1,
          unitPriceBeforeVatSnapshot: record.directCost,
          vatRateSnapshot: new Decimal(0),
          unitPriceAfterVatSnapshot: record.directCost,
          plannedAmount: record.directCost,
          actualUnitPrice: record.directCost,
          quantity: 1,
          note: record.directNotes || 'Tự động tạo từ directCost cũ',
          sortOrder: 0,
        },
      });
      migratedCount++;
      console.log(
        `✓ Đã tạo line cho ExpenseRecord ID: ${record.id} (Dự án: ${record.projectId}, Tháng ${record.month}/${record.year}, Số tiền: ${record.directCost})`,
      );
    }
  }

  console.log(`--- Hoàn tất! Đã chuyển đổi ${migratedCount}/${records.length} bản ghi ---`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi chạy migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
