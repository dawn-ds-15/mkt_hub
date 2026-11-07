const { Client } = require('pg');
const { randomUUID } = require('crypto');
require('dotenv').config();

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL...');

  const countRes = await client.query('SELECT COUNT(*) FROM "AnnualExpensePlan" WHERE year = 2026');
  if (parseInt(countRes.rows[0].count, 10) > 0) {
    console.log('AnnualExpensePlan for 2026 already exists. Skipping seed.');
    await client.end();
    return;
  }

  const memberRes = await client.query('SELECT id FROM "Member" LIMIT 1');
  const creatorId = memberRes.rows[0]?.id || '00000000-0000-4000-8000-000000000001';

  const planId = randomUUID();
  const year = 2026;
  const version = 1;
  const name = 'Kế hoạch Ngân sách Năm 2026 (Chính thức)';
  const totalPlan = 700000000;

  await client.query(`
    INSERT INTO "AnnualExpensePlan" (id, year, version, name, status, "totalPlan", "activatedAt", "createdById", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, 'active', $5, NOW(), $6, NOW(), NOW())
  `, [planId, year, version, name, totalPlan, creatorId]);

  console.log(`Created Active AnnualExpensePlan ${planId} for year 2026.`);

  // Level 1: Chi phí Marketing & Truyền thông
  const l1_marketing = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 1, 'Chi phí Marketing & Truyền thông', 1, 650000000, true)
  `, [l1_marketing, planId]);

  // Level 2: Digital Ads
  const l2_digital = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 2, $3, 'Quảng cáo trực tuyến (Digital Ads)', 1, 450000000, true)
  `, [l2_digital, planId, l1_marketing]);

  // Level 3 items under Digital Ads
  const l3_fb = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Facebook Ads', 1, 200000000, true)
  `, [l3_fb, planId, l2_digital]);

  const l3_gg = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Google Ads', 2, 150000000, true)
  `, [l3_gg, planId, l2_digital]);

  const l3_tt = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'TikTok Ads', 3, 100000000, true)
  `, [l3_tt, planId, l2_digital]);

  // Level 2: Events
  const l2_events = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 2, $3, 'Sự kiện & Hội thảo (Events)', 2, 200000000, true)
  `, [l2_events, planId, l1_marketing]);

  // Level 3 items under Events
  const l3_event1 = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Hội thảo khách hàng Q1', 1, 80000000, true)
  `, [l3_event1, planId, l2_events]);

  const l3_event2 = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Triển lãm chuyên ngành', 2, 120000000, true)
  `, [l3_event2, planId, l2_events]);

  // Level 1: Chi phí Vận hành & Quản trị
  const l1_ops = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 1, 'Chi phí Vận hành & Quản trị', 2, 50000000, true)
  `, [l1_ops, planId]);

  // Level 2: Văn phòng phẩm & Thiết bị
  const l2_supplies = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 2, $3, 'Văn phòng phẩm & Thiết bị', 1, 50000000, true)
  `, [l2_supplies, planId, l1_ops]);

  // Level 3 items
  const l3_supplies1 = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Văn phòng phẩm quý', 1, 30000000, true)
  `, [l3_supplies1, planId, l2_supplies]);

  const l3_supplies2 = randomUUID();
  await client.query(`
    INSERT INTO "AnnualExpensePlanItem" (id, "planId", level, "parentId", name, "sortOrder", amount, "isActive")
    VALUES ($1, $2, 3, $3, 'Bảo trì thiết bị văn phòng', 2, 20000000, true)
  `, [l3_supplies2, planId, l2_supplies]);

  console.log('Seeded complete 3-level active AnnualExpensePlan for 2026 in Supabase successfully!');
  await client.end();
}

seed().catch(console.error);
