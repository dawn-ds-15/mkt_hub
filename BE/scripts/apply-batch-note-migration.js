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

    const sql = `ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "note" TEXT;`;
    console.log('Executing:', sql);
    await client.query(sql);
    console.log('Column note added successfully to InventoryBatch!');

    // Verify
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'InventoryBatch' AND column_name = 'note';
    `);
    console.log('Verified column:', res.rows);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
