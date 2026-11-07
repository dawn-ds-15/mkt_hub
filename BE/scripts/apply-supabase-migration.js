const { Client } = require('pg');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL;

async function main() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase successfully!');

    const statements = [
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'confirmed';`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "recognizedDate" DATE;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "isUnplanned" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "unplannedItemName" TEXT;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "supplier" TEXT;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "projectExpenseItemId" TEXT;`
    ];

    for (const sql of statements) {
      console.log('Executing:', sql);
      await client.query(sql);
    }
    console.log('All migrations applied successfully!');

    // Verify columns in Project
    const projectCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Project' AND column_name = 'cancelledAt';
    `);
    console.log('Verified Project.cancelledAt:', projectCols.rows);

    // Verify columns in ExpenseLine
    const expenseCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ExpenseLine' 
      AND column_name IN ('status', 'recognizedDate', 'isUnplanned', 'unplannedItemName', 'supplier', 'projectExpenseItemId');
    `);
    console.log('Verified ExpenseLine columns:', expenseCols.rows);

  } catch (err) {
    console.error('Error applying migration to Supabase:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
