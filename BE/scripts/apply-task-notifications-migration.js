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
    console.log('Connected successfully!');

    // 1. Create table task_stakeholders
    console.log('Creating table task_stakeholders...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "task_stakeholders" (
        "id" TEXT PRIMARY KEY,
        "taskId" TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("taskId", "userId")
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "task_stakeholders_taskId_idx" ON "task_stakeholders"("taskId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "task_stakeholders_userId_idx" ON "task_stakeholders"("userId");`);
    console.log('Table task_stakeholders verified/created!');

    // 2. Create table notifications
    console.log('Creating table notifications...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "actorId" TEXT REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "type" TEXT NOT NULL,
        "taskId" TEXT REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "projectId" TEXT REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "notifications_taskId_idx" ON "notifications"("taskId");`);
    console.log('Table notifications verified/created!');

    // 3. Migrate existing task stakeholders
    console.log('Migrating existing task stakeholders from string arrays...');
    const membersRes = await client.query(`SELECT "id", "name" FROM "Member" WHERE "isActive" = true`);
    const members = membersRes.rows;

    const normalize = (str) => (str || '').trim().toLowerCase();

    const tasksRes = await client.query(`SELECT "id", "stakeholders" FROM "Task" WHERE "stakeholders" IS NOT NULL`);
    let linkedCount = 0;

    for (const task of tasksRes.rows) {
      if (!task.stakeholders) continue;
      let names = [];
      try {
        const parsed = JSON.parse(task.stakeholders);
        if (Array.isArray(parsed)) {
          names = parsed.filter(n => typeof n === 'string' && n.trim());
        }
      } catch {
        if (typeof task.stakeholders === 'string' && task.stakeholders.trim()) {
          names = [task.stakeholders.trim()];
        }
      }

      for (const name of names) {
        const normName = normalize(name);
        const matchingMembers = members.filter(m => normalize(m.name) === normName);

        if (matchingMembers.length === 1) {
          const matchedUserId = matchingMembers[0].id;
          const id = `ts_${task.id.slice(0, 8)}_${matchedUserId.slice(0, 8)}`;
          await client.query(`
            INSERT INTO "task_stakeholders" ("id", "taskId", "userId", "createdAt")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT ("taskId", "userId") DO NOTHING;
          `, [id, task.id, matchedUserId]);
          linkedCount++;
        }
      }
    }

    console.log(`Migration complete! Successfully linked ${linkedCount} stakeholder relationships.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
