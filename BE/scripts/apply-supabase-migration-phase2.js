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
      `CREATE TABLE IF NOT EXISTS "AnnualExpensePlan" (
        "id" TEXT PRIMARY KEY,
        "year" INTEGER NOT NULL,
        "version" INTEGER NOT NULL,
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "activatedAt" TIMESTAMP(3),
        "replacedByVersion" INTEGER,
        "createdById" TEXT NOT NULL REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("year", "version")
      );`,
      `CREATE INDEX IF NOT EXISTS "AnnualExpensePlan_year_status_idx" ON "AnnualExpensePlan"("year", "status");`,

      `CREATE TABLE IF NOT EXISTS "AnnualExpensePlanItem" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "AnnualExpensePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "level" INTEGER NOT NULL,
        "parentId" TEXT REFERENCES "AnnualExpensePlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "name" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "amount" DECIMAL(15,2) DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "AnnualExpensePlanItem_planId_level_idx" ON "AnnualExpensePlanItem"("planId", "level");`,
      `CREATE INDEX IF NOT EXISTS "AnnualExpensePlanItem_parentId_idx" ON "AnnualExpensePlanItem"("parentId");`,

      `CREATE TABLE IF NOT EXISTS "ProjectExpensePlan" (
        "id" TEXT PRIMARY KEY,
        "projectId" TEXT NOT NULL UNIQUE REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "year" INTEGER NOT NULL,
        "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "ProjectExpensePlan_projectId_year_idx" ON "ProjectExpensePlan"("projectId", "year");`,

      `CREATE TABLE IF NOT EXISTS "ProjectExpensePlanItem" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "ProjectExpensePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "source" TEXT NOT NULL DEFAULT 'custom',
        "templateId" TEXT,
        "name" TEXT NOT NULL,
        "planAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "note" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "ProjectExpensePlanItem_planId_idx" ON "ProjectExpensePlanItem"("planId");`,

      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "annualExpenseItemId" TEXT;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);`,
      `ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT;`
    ];

    for (const sql of statements) {
      console.log('Executing DDL statement...');
      await client.query(sql);
    }
    console.log('All Phase 2 DDL migrations applied successfully to Supabase!');

    // Verify
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('AnnualExpensePlan', 'AnnualExpensePlanItem', 'ProjectExpensePlan', 'ProjectExpensePlanItem');
    `);
    console.log('Verified created tables:', tablesRes.rows);

    const expenseLineCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ExpenseLine' 
      AND column_name IN ('annualExpenseItemId', 'cancelledAt', 'cancelledBy', 'cancelledReason', 'confirmedAt', 'confirmedBy');
    `);
    console.log('Verified ExpenseLine new columns:', expenseLineCols.rows);

  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
