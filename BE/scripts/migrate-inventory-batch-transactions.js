const { Client } = require('pg');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL;

async function main() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully to database!');

    // 1. Find all 'out' transactions without batchId
    const unlinkedOutQuery = `
      SELECT t.id, t."itemId", t.type, t.quantity, t.note, t."createdAt", i.name as item_name
      FROM "InventoryTransaction" t
      LEFT JOIN "InventoryItem" i ON i.id = t."itemId"
      WHERE t."batchId" IS NULL AND t.type = 'out'
      ORDER BY t."createdAt" ASC;
    `;
    const unlinkedOut = await client.query(unlinkedOutQuery);
    console.log(`Found ${unlinkedOut.rows.length} 'out' transactions with null batchId.`);

    // Group by itemId
    const itemsMap = new Map();
    for (const tx of unlinkedOut.rows) {
      if (!itemsMap.has(tx.itemId)) {
        itemsMap.set(tx.itemId, []);
      }
      itemsMap.get(tx.itemId).push(tx);
    }

    let linkedCount = 0;

    for (const [itemId, txs] of itemsMap.entries()) {
      // Find batches for this item
      const batchesRes = await client.query(
        `SELECT id, "batchCode", "quantityIn", "currentStock", "receivedDate", "createdAt"
         FROM "InventoryBatch"
         WHERE "itemId" = $1 AND "archivedAt" IS NULL
         ORDER BY "receivedDate" ASC, "createdAt" ASC`,
        [itemId]
      );
      const batches = batchesRes.rows;

      if (batches.length === 0) {
        console.warn(`Item ${itemId} has no batches! Skipping transactions.`);
        continue;
      }

      if (batches.length === 1) {
        const batch = batches[0];
        console.log(`Item "${txs[0].item_name || itemId}" has 1 batch (${batch.batchCode}). Assigning all ${txs.length} transactions to this batch.`);
        for (const tx of txs) {
          await client.query(
            `UPDATE "InventoryTransaction" SET "batchId" = $1 WHERE id = $2`,
            [batch.id, tx.id]
          );
          linkedCount++;
        }
      } else {
        // Multiple batches: allocate FIFO
        console.log(`Item "${txs[0].item_name || itemId}" has ${batches.length} batches. Allocating FIFO.`);
        let batchIdx = 0;
        let batchRemaining = batches[0].quantityIn;

        for (const tx of txs) {
          const batch = batches[batchIdx];
          await client.query(
            `UPDATE "InventoryTransaction" SET "batchId" = $1 WHERE id = $2`,
            [batch.id, tx.id]
          );
          linkedCount++;
          batchRemaining -= tx.quantity;
          if (batchRemaining <= 0 && batchIdx < batches.length - 1) {
            batchIdx++;
            batchRemaining = batches[batchIdx].quantityIn;
          }
        }
      }
    }

    // 2. Also check return transactions 'in' with note 'Hoàn kho' and null batchId
    const unlinkedReturn = await client.query(`
      SELECT t.id, t."itemId"
      FROM "InventoryTransaction" t
      WHERE t."batchId" IS NULL AND t.type = 'in' AND (t.note ILIKE '%hoàn kho%' OR t.note ILIKE '%return%');
    `);
    console.log(`Found ${unlinkedReturn.rows.length} return transactions with null batchId.`);
    for (const tx of unlinkedReturn.rows) {
      const latestBatch = await client.query(
        `SELECT id FROM "InventoryBatch" WHERE "itemId" = $1 AND "archivedAt" IS NULL ORDER BY "receivedDate" DESC, "createdAt" DESC LIMIT 1`,
        [tx.itemId]
      );
      if (latestBatch.rows.length > 0) {
        await client.query(
          `UPDATE "InventoryTransaction" SET "batchId" = $1 WHERE id = $2`,
          [latestBatch.rows[0].id, tx.id]
        );
        linkedCount++;
      }
    }

    console.log(`Successfully linked ${linkedCount} transactions to batches!`);

    // 3. Recalculate currentStock for ALL active batches
    console.log('Recalculating currentStock for all batches...');
    const recalcQuery = `
      WITH stats AS (
        SELECT
          b.id AS batch_id,
          b."quantityIn" AS quantity_in,
          COALESCE(SUM(CASE WHEN t.type = 'out' THEN t.quantity ELSE 0 END), 0) AS total_out,
          COALESCE(SUM(CASE WHEN t.type = 'in' AND t.note ILIKE '%hoàn kho%' THEN t.quantity ELSE 0 END), 0) AS total_returned
        FROM "InventoryBatch" b
        LEFT JOIN "InventoryTransaction" t ON t."batchId" = b.id
        WHERE b."archivedAt" IS NULL
        GROUP BY b.id, b."quantityIn"
      )
      UPDATE "InventoryBatch" b
      SET
        "currentStock" = GREATEST(0, s.quantity_in - GREATEST(0, s.total_out - s.total_returned)),
        "status" = CASE WHEN GREATEST(0, s.quantity_in - GREATEST(0, s.total_out - s.total_returned)) > 0 THEN 'active' ELSE 'depleted' END,
        "updatedAt" = NOW()
      FROM stats s
      WHERE b.id = s.batch_id;
    `;
    await client.query(recalcQuery);
    console.log('Batch stock recalculation complete!');

    // 4. Recalculate InventoryItem totalStock and status
    console.log('Recalculating InventoryItem totals...');
    const itemRecalcQuery = `
      WITH item_stats AS (
        SELECT
          "itemId" AS item_id,
          COALESCE(SUM("currentStock"), 0) AS total_stock
        FROM "InventoryBatch"
        WHERE "archivedAt" IS NULL
        GROUP BY "itemId"
      )
      UPDATE "InventoryItem" i
      SET
        "totalStock" = s.total_stock,
        "status" = CASE WHEN s.total_stock > 0 THEN 'instock' ELSE 'out' END,
        "updatedAt" = NOW()
      FROM item_stats s
      WHERE i.id = s.item_id;
    `;
    await client.query(itemRecalcQuery);
    console.log('InventoryItem stats recalculation complete!');

    // 5. Verify the 3 batches in Section 8
    console.log('\n--- VERIFYING TARGET BATCHES (Section 8) ---');
    const targetBatchIds = [
      '3f046530-e429-45a9-b93f-bde712c7e384', // LY-0126-001 (Expected: 68)
      '8e1f6850-7f63-48c6-a95a-a36802ffd6e6', // SOTAY-0126-002 (Expected: 0)
      '026dd3c3-04df-4865-8509-144fb9658c82', // SOTAY-0126-001 (Expected: 106)
    ];

    const targetBatches = await client.query(`
      SELECT b.id, b."batchCode", b."quantityIn", b."currentStock", b.status, i.name as item_name
      FROM "InventoryBatch" b
      JOIN "InventoryItem" i ON i.id = b."itemId"
      WHERE b.id = ANY($1)
    `, [targetBatchIds]);

    // Clean up duplicate out transaction 16525e00-55e5-42be-9b51-3acf21367996 if exists
    const delRes = await client.query(`
      DELETE FROM "InventoryTransaction"
      WHERE id = '16525e00-55e5-42be-9b51-3acf21367996';
    `);
    if (delRes.rowCount > 0) {
      console.log('Deleted duplicate out transaction 16525e00-55e5-42be-9b51-3acf21367996.');
      await client.query(recalcQuery);
      await client.query(itemRecalcQuery);
    }

    const reTargetBatches = await client.query(`
      SELECT b.id, b."batchCode", b."quantityIn", b."currentStock", b.status, i.name as item_name
      FROM "InventoryBatch" b
      JOIN "InventoryItem" i ON i.id = b."itemId"
      WHERE b.id = ANY($1)
    `, [targetBatchIds]);

    for (const row of reTargetBatches.rows) {
      console.log(`Batch [${row.batchCode}] (${row.item_name}): quantityIn=${row.quantityIn}, currentStock=${row.currentStock}, status=${row.status}`);
      const txs = await client.query(
        `SELECT id, type, quantity, note, "projectId", "createdAt" FROM "InventoryTransaction" WHERE "batchId" = $1 ORDER BY "createdAt" ASC`,
        [row.id]
      );
      console.log(`  Transactions (${txs.rows.length}):`);
      for (const t of txs.rows) {
        console.log(`    - id=${t.id}, type=${t.type}, qty=${t.quantity}, date=${t.createdAt.toISOString()}, proj=${t.projectId}`);
      }
    }

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
