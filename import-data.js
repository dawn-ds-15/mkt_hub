const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) {}
if (process.loadEnvFile && fs.existsSync(path.join(__dirname, '.env'))) {
  try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (_) {}
}

// Local URL - dùng để import trực tiếp tại local
const DB_URL = process.env.DATABASE_URL || "postgresql://mkthub:mkthub123@localhost:5433/mkthub";

const SQL_FILES = [
  { file: path.join(__dirname, 'BE/database/core.sql'),      schema: 'core' },
  { file: path.join(__dirname, 'BE/database/sys.sql'),       schema: 'sys_admin' },
  { file: path.join(__dirname, 'BE/database/marketing.sql'), schema: 'marketing' },
  { file: path.join(__dirname, 'BE/database/finance.sql'),   schema: 'finance' },
];

async function runFile(client, filePath) {
  console.log(`\nRunning: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf-8');
  try {
    await client.query(sql);
    console.log(`✅ OK: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`❌ ERROR in ${path.basename(filePath)}: ${err.message}`);
  }
}

async function checkCounts(client) {
  console.log('\n📊 RECORD COUNTS:');
  const checks = [
    { label: 'Members      ', query: 'SELECT COUNT(*) FROM core.members' },
    { label: 'Projects     ', query: 'SELECT COUNT(*) FROM core.projects' },
    { label: 'KpiActual    ', query: 'SELECT COUNT(*) FROM marketing.kpi_actuals' },
    { label: 'KpiPlan      ', query: 'SELECT COUNT(*) FROM marketing.kpi_plans' },
    { label: 'Opportunity  ', query: 'SELECT COUNT(*) FROM marketing.opportunities' },
    { label: 'ClosedDeal   ', query: 'SELECT COUNT(*) FROM marketing.closed_deals' },
  ];
  for (const c of checks) {
    try {
      const res = await client.query(c.query);
      console.log(`  ${c.label}: ${res.rows[0].count}`);
    } catch (err) {
      console.log(`  ${c.label}: NOT FOUND`);
    }
  }
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Render DB...');
    await client.connect();
    console.log('✅ Connected!\n');

    const args = process.argv.slice(2);

    if (args[0] === '--import') {
      console.log('🗑️  Resetting all schemas...');
      await client.query(`
        DROP SCHEMA IF EXISTS core CASCADE;
        DROP SCHEMA IF EXISTS sys_admin CASCADE;
        DROP SCHEMA IF EXISTS marketing CASCADE;
        DROP SCHEMA IF EXISTS finance CASCADE;
        CREATE SCHEMA core;
        CREATE SCHEMA sys_admin;
        CREATE SCHEMA marketing;
        CREATE SCHEMA finance;
        DROP TYPE IF EXISTS public.member_role CASCADE;
        CREATE TYPE public.member_role AS ENUM ('admin', 'manager', 'specialist');
      `);
      console.log('✅ Schemas reset\n');

      for (const { file } of SQL_FILES) {
        await runFile(client, file);
      }

      await checkCounts(client);
    } else {
      await checkCounts(client);
      console.log('\n💡 Run with --import to reimport all data');
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  } finally {
    try { await client.end(); } catch (_) {}
    console.log('\nDone.');
  }
}

main();
