import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { userContext } from '../common/context/user-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _extendedClient: any;

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async create({ model, args, query }) {
            // Auto-increment memberId for Member
            if (model === 'Member') {
              const data = args.data as any;
              if (!data.memberId || data.memberId === 0) {
                const maxMember = await (self as any).member.findFirst({
                  orderBy: { memberId: 'desc' },
                });
                data.memberId = maxMember ? maxMember.memberId + 1 : 1;
              }
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'create',
              (result as any)?.id,
              null,
              result,
            );
            return result;
          },
          async update({ model, args, query }) {
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore if we can't fetch old record
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'update',
              (result as any)?.id,
              oldRecord,
              result,
            );
            return result;
          },
          async delete({ model, args, query }) {
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'delete',
              oldRecord?.id || args.where?.id,
              oldRecord,
              null,
            );
            return result;
          },
          async upsert({ model, args, query }) {
            if (model === 'Member') {
              const createData = args.create as any;
              if (
                createData &&
                (!createData.memberId || createData.memberId === 0)
              ) {
                const maxMember = await (self as any).member.findFirst({
                  orderBy: { memberId: 'desc' },
                });
                createData.memberId = maxMember ? maxMember.memberId + 1 : 1;
              }
            }
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore
            }
            const result = await query(args);
            const action = oldRecord ? 'update' : 'create';
            await self.logAudit(
              model,
              action,
              (result as any)?.id,
              oldRecord,
              result,
            );
            return result;
          },
        },
      },
    });

    // Proxy calls to the extended client
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (target._extendedClient && prop in target._extendedClient) {
          return Reflect.get(target._extendedClient, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureTables();
  }

  private async ensureTables() {
    try {
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProjectDailyActual" (
            "id" TEXT NOT NULL,
            "projectId" TEXT NOT NULL,
            "actualDate" DATE NOT NULL,
            "rawLeads" INTEGER NOT NULL DEFAULT 0,
            "mql" INTEGER NOT NULL DEFAULT 0,
            "sql" INTEGER NOT NULL DEFAULT 0,
            "opp" INTEGER NOT NULL DEFAULT 0,
            "closedDeal" INTEGER NOT NULL DEFAULT 0,
            "note" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdById" TEXT,
            "archivedAt" TIMESTAMP(3),
            CONSTRAINT "ProjectDailyActual_pkey" PRIMARY KEY ("id")
        )
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDailyActual_projectId_actualDate_key" ON "ProjectDailyActual"("projectId", "actualDate")
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProjectDailyActual_projectId_actualDate_archivedAt_idx" ON "ProjectDailyActual"("projectId", "actualDate", "archivedAt")
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProjectDailyActual_actualDate_idx" ON "ProjectDailyActual"("actualDate")
      `);
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDailyActual_projectId_fkey') THEN
                ALTER TABLE "ProjectDailyActual" ADD CONSTRAINT "ProjectDailyActual_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDailyActual_createdById_fkey') THEN
                ALTER TABLE "ProjectDailyActual" ADD CONSTRAINT "ProjectDailyActual_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
        END $$;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'confirmed';
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "recognizedDate" DATE;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "isUnplanned" BOOLEAN NOT NULL DEFAULT false;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "unplannedItemName" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "projectExpenseItemId" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "annualExpenseItemId" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "hangMucLon" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "deductedQuantity" INTEGER NOT NULL DEFAULT 0;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "stockTransactionId" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "expenseLineId" TEXT;
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InventoryTransaction_expenseLineId_idx" ON "InventoryTransaction"("expenseLineId");
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExpenseIdempotencyRecord" (
          "id" TEXT NOT NULL,
          "scopeKey" TEXT NOT NULL,
          "userId" TEXT,
          "expenseId" TEXT,
          "idempotencyKey" TEXT NOT NULL,
          "statusCode" INTEGER NOT NULL DEFAULT 201,
          "responseBody" JSONB,
          "lineId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "ExpenseIdempotencyRecord_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseIdempotencyRecord_scopeKey_key" ON "ExpenseIdempotencyRecord"("scopeKey");
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ExpenseIdempotencyRecord_expiresAt_idx" ON "ExpenseIdempotencyRecord"("expiresAt");
      `);
      await this.$executeRawUnsafe(`
        SELECT 1;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProjectDocument" (
            "id" TEXT NOT NULL,
            "projectId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "url" TEXT NOT NULL,
            "fileType" TEXT,
            "fileSize" INTEGER,
            "uploadedBy" TEXT,
            "archivedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProjectDocument_archivedAt_idx" ON "ProjectDocument"("archivedAt");
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnnualExpensePlan" (
          "id" TEXT PRIMARY KEY,
          "year" INTEGER NOT NULL,
          "version" INTEGER NOT NULL,
          "name" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'draft',
          "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
          "activatedAt" TIMESTAMP(3),
          "replacedByVersion" INTEGER,
          "createdById" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("year", "version")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnnualExpensePlanItem" (
          "id" TEXT PRIMARY KEY,
          "planId" TEXT NOT NULL,
          "level" INTEGER NOT NULL,
          "parentId" TEXT,
          "name" TEXT NOT NULL,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "amount" DECIMAL(15,2) DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProjectExpensePlan" (
          "id" TEXT PRIMARY KEY,
          "projectId" TEXT NOT NULL UNIQUE,
          "year" INTEGER NOT NULL,
          "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProjectExpensePlanItem" (
          "id" TEXT PRIMARY KEY,
          "planId" TEXT NOT NULL,
          "source" TEXT NOT NULL DEFAULT 'custom',
          "templateId" TEXT,
          "name" TEXT NOT NULL,
          "planAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
          "note" TEXT,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "expense_audit_logs" (
          "id" TEXT NOT NULL,
          "expense_id" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "changed_by" TEXT,
          "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expense_date" DATE,
          "snapshot" JSONB NOT NULL,
          CONSTRAINT "expense_audit_logs_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "expense_audit_logs_expense_id_at_idx" ON "expense_audit_logs"("expense_id", "at");
      `);
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_audit_logs_expense_id_fkey') THEN
            ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "ExpenseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_audit_logs_changed_by_fkey') THEN
            ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ChecklistTemplate" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "appliesToTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          "leadTimeDays" INTEGER NOT NULL DEFAULT 30,
          "tasks" JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ChecklistStakeholderOption" (
          "id" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "label" TEXT NOT NULL,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ChecklistStakeholderOption_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistStakeholderOption_code_key" ON "ChecklistStakeholderOption"("code");
      `);
      // BE_requirement_26_09_26: lead-source projects, deal initiation date,
      // batch -> budget category link, batch attachments
      await this.$executeRawUnsafe(`
        ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isLeadSource" BOOLEAN NOT NULL DEFAULT false;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "ClosedDeal" ADD COLUMN IF NOT EXISTS "initiationDate" DATE;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "expenseCategoryId" TEXT;
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "expenseCategoryName" TEXT;
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InventoryBatch_expenseCategoryId_idx" ON "InventoryBatch"("expenseCategoryId");
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InventoryBatchAttachment" (
          "id" TEXT NOT NULL,
          "batchId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "size" INTEGER NOT NULL,
          "mimeType" TEXT,
          "filePath" TEXT NOT NULL,
          "uploadedBy" TEXT,
          "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "archivedAt" TIMESTAMP(3),
          CONSTRAINT "InventoryBatchAttachment_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InventoryBatchAttachment_batchId_archivedAt_idx" ON "InventoryBatchAttachment"("batchId", "archivedAt");
      `);
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryBatchAttachment_batchId_fkey') THEN
            ALTER TABLE "InventoryBatchAttachment" ADD CONSTRAINT "InventoryBatchAttachment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      // §6: a batch code must be unique among NON-deleted batches only, so codes of deleted
      // batches can be reused. Only indexes change here, no row is modified.
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InventoryBatch_batchCode_idx" ON "InventoryBatch"("batchCode");
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatch_active_batchCode_key"
          ON "InventoryBatch" (lower(btrim("batchCode"))) WHERE "archivedAt" IS NULL;
      `).then(
        // drop the old all-rows unique index only once the partial one exists
        () => this.$executeRawUnsafe(`DROP INDEX IF EXISTS "InventoryBatch_batchCode_key";`),
        (err) => console.warn('Partial unique index on InventoryBatch.batchCode not created (duplicate active codes?):', err),
      );
      // Same for item codes: unique among non-deleted items only, so a deleted item's code can
      // be used again. The old index was unique over all rows, so this one always builds.
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "InventoryItem_code_idx" ON "InventoryItem"("code");
      `);
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_active_code_key"
          ON "InventoryItem" ("code") WHERE "archivedAt" IS NULL;
      `).then(
        () => this.$executeRawUnsafe(`DROP INDEX IF EXISTS "InventoryItem_code_key";`),
        (err) => console.warn('Partial unique index on InventoryItem.code not created:', err),
      );
      // BE_requirement_29_09_26 §1: several files per expense line, §2: permission matrix
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExpenseLineAttachment" (
          "id" TEXT NOT NULL,
          "lineId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "size" INTEGER NOT NULL DEFAULT 0,
          "mimeType" TEXT,
          "filePath" TEXT NOT NULL,
          "sourceDocumentId" TEXT,
          "uploadedBy" TEXT,
          "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "archivedAt" TIMESTAMP(3),
          CONSTRAINT "ExpenseLineAttachment_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ExpenseLineAttachment_lineId_archivedAt_idx" ON "ExpenseLineAttachment"("lineId", "archivedAt");
      `);
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLineAttachment_lineId_fkey') THEN
            ALTER TABLE "ExpenseLineAttachment" ADD CONSTRAINT "ExpenseLineAttachment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PermissionMatrix" (
          "id" TEXT NOT NULL,
          "matrix" JSONB NOT NULL DEFAULT '{}',
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedBy" TEXT,
          CONSTRAINT "PermissionMatrix_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.syncLegacyExpenseLineAttachments();
      await this.applyOneTimeDataFixes();

      // D.4.2 & A.4.3: Clean up BudgetValue ghost records and duplicates
      // 1. Delete BudgetValue belonging to archived or deleted projects
      await this.$executeRawUnsafe(`
        DELETE FROM "BudgetValue"
        WHERE "projectId" IS NOT NULL
          AND "projectId" NOT IN (SELECT id FROM "Project" WHERE "archivedAt" IS NULL);
      `);

      // 2. Delete BudgetValue belonging to archived or deleted categories
      await this.$executeRawUnsafe(`
        DELETE FROM "BudgetValue"
        WHERE "categoryId" IS NOT NULL
          AND "categoryId" NOT IN (SELECT id FROM "BudgetCategory" WHERE "archivedAt" IS NULL);
      `);


      // 4. Delete zero amount records
      await this.$executeRawUnsafe(`
        DELETE FROM "BudgetValue" WHERE "amount" = 0;
      `);

      // 5. Clean up any remaining records for test project
      await this.$executeRawUnsafe(`
        DELETE FROM "BudgetValue"
        WHERE "projectId" = '4800d733-174d-4a65-aa82-aba10820c02d';
      `);

      // 6. Deduplicate BudgetValue records, keeping the latest (by updatedAt, then id) —
      //    the same row the budget screens show, so no visible value is ever dropped
      await this.$executeRawUnsafe(`
        DELETE FROM "BudgetValue" a
        USING "BudgetValue" b
        WHERE (a."updatedAt", a.id) < (b."updatedAt", b.id)
          AND a.year = b.year
          AND a.month = b.month
          AND a."isBackup" = b."isBackup"
          AND a."categoryId" IS NOT DISTINCT FROM b."categoryId"
          AND a."subcategoryId" IS NOT DISTINCT FROM b."subcategoryId"
          AND a."itemId" IS NOT DISTINCT FROM b."itemId"
          AND a."projectId" IS NOT DISTINCT FROM b."projectId";
      `);

      // 7. Archive opportunities belonging to deleted or non-existent projects
      await this.$executeRawUnsafe(`
        UPDATE "Opportunity"
        SET "archivedAt" = NOW()
        WHERE "projectId" IS NOT NULL
          AND "projectId" NOT IN (SELECT id FROM "Project" WHERE "archivedAt" IS NULL)
          AND "archivedAt" IS NULL;
      `).catch(() => {});

      // 8. Archive closed deals belonging to deleted or non-existent projects
      await this.$executeRawUnsafe(`
        UPDATE "ClosedDeal"
        SET "archivedAt" = NOW()
        WHERE "projectId" IS NOT NULL
          AND "projectId" NOT IN (SELECT id FROM "Project" WHERE "archivedAt" IS NULL)
          AND "archivedAt" IS NULL;
      `).catch(() => {});

      // 9. Delete KpiDistribution belonging to deleted or non-existent projects
      await this.$executeRawUnsafe(`
        DELETE FROM "KpiDistribution"
        WHERE "projectId" NOT IN (SELECT id FROM "Project" WHERE "archivedAt" IS NULL);
      `).catch(() => {});

      // 10. Delete ProjectDailyActual belonging to deleted or non-existent projects
      await this.$executeRawUnsafe(`
        DELETE FROM "ProjectDailyActual"
        WHERE "projectId" NOT IN (SELECT id FROM "Project" WHERE "archivedAt" IS NULL);
      `).catch(() => {});

      // 11. (removed) "DELETE FROM KpiActual WHERE year = 2026" was a one-off cleanup of mock data
      //     (Raw Leads 1769 / MQL 608 / SQL 239). It had run on every boot since 2026-09-09, so the mock
      //     rows are long gone, and keeping it would wipe real weekly entries on every restart.

      // 12. Sync existing ProjectDailyActual records to KpiDistribution for active projects
      await this.$executeRawUnsafe(`
        INSERT INTO "KpiDistribution" ("id", "year", "week", "projectId", "type", "rawLeads", "mql", "sql", "oppCount", "closedCount", "pipelineValue", "wonValue", "createdAt")
        SELECT 
          gen_random_uuid(),
          EXTRACT(isoyear FROM pda."actualDate")::integer AS "year",
          EXTRACT(week FROM pda."actualDate")::integer AS "week",
          pda."projectId",
          'actual' AS "type",
          COALESCE(SUM(pda."rawLeads"), 0)::integer AS "rawLeads",
          COALESCE(SUM(pda."mql"), 0)::integer AS "mql",
          COALESCE(SUM(pda."sql"), 0)::integer AS "sql",
          COALESCE(SUM(pda."opp"), 0)::integer AS "oppCount",
          COALESCE(SUM(pda."closedDeal"), 0)::integer AS "closedCount",
          0 AS "pipelineValue",
          0 AS "wonValue",
          NOW() AS "createdAt"
        FROM "ProjectDailyActual" pda
        JOIN "Project" p ON p.id = pda."projectId"
        WHERE pda."archivedAt" IS NULL AND p."archivedAt" IS NULL
        GROUP BY 
          EXTRACT(isoyear FROM pda."actualDate"),
          EXTRACT(week FROM pda."actualDate"),
          pda."projectId"
        ON CONFLICT ("year", "week", "projectId", "type") DO UPDATE SET
          "rawLeads" = EXCLUDED."rawLeads",
          "mql" = EXCLUDED."mql",
          "sql" = EXCLUDED."sql",
          "oppCount" = EXCLUDED."oppCount",
          "closedCount" = EXCLUDED."closedCount";
      `).catch((err) => console.warn('Sync ProjectDailyActual to KpiDistribution failed:', err));

      // 13. Sync Project cumulative actuals from ProjectDailyActual
      await this.$executeRawUnsafe(`
        UPDATE "Project" p
        SET 
          "kpiRawLeadsActual" = sub.raw_sum,
          "kpiMqlActual" = sub.mql_sum,
          "kpiSqlActual" = sub.sql_sum,
          "kpiOppActual" = sub.opp_sum,
          "kpiClosedDealActual" = sub.closed_sum
        FROM (
          SELECT 
            "projectId",
            COALESCE(SUM("rawLeads"), 0) AS raw_sum,
            COALESCE(SUM("mql"), 0) AS mql_sum,
            COALESCE(SUM("sql"), 0) AS sql_sum,
            COALESCE(SUM("opp"), 0) AS opp_sum,
            COALESCE(SUM("closedDeal"), 0) AS closed_sum
          FROM "ProjectDailyActual"
          WHERE "archivedAt" IS NULL
          GROUP BY "projectId"
        ) sub
        WHERE p.id = sub."projectId";
      `).catch((err) => console.warn('Sync Project actuals failed:', err));
    } catch (err) {
      console.warn('Auto-healing tables check failed or already applied:', err);
    }
  }

  /**
   * BE_requirement_29_09_26 §1: lists every file of an expense line in "ExpenseLineAttachment".
   * Adds a row (pointing to the same stored file, nothing is copied) for:
   *  1. the old single file of a line (attachmentPath);
   *  2. a line of a newer snapshot sharing the file of another line through its attachmentUrl;
   *  3. project documents listed by the FE workaround `attachmentName = "docs:<id>,<id>"`.
   * Idempotent: a row that already exists, even one the user removed (archived), is never re-added.
   * Existing columns are not modified.
   */
  private async syncLegacyExpenseLineAttachments() {
    const statements: { label: string; sql: string }[] = [
      {
        label: 'single file',
        sql: `
          INSERT INTO "ExpenseLineAttachment" ("id", "lineId", "name", "size", "mimeType", "filePath", "uploadedAt")
          SELECT gen_random_uuid()::text, l."id",
                 CASE WHEN COALESCE(l."attachmentName", '') = '' OR l."attachmentName" LIKE 'docs:%'
                      THEN 'attachment' ELSE l."attachmentName" END,
                 0, l."attachmentMime", l."attachmentPath", l."updatedAt"
          FROM "ExpenseLine" l
          WHERE l."archivedAt" IS NULL
            AND COALESCE(l."attachmentPath", '') <> ''
            AND NOT EXISTS (
              SELECT 1 FROM "ExpenseLineAttachment" a
              WHERE a."lineId" = l."id" AND a."filePath" = l."attachmentPath"
            );
        `,
      },
      {
        label: 'shared file',
        sql: `
          INSERT INTO "ExpenseLineAttachment" ("id", "lineId", "name", "size", "mimeType", "filePath", "uploadedAt")
          SELECT gen_random_uuid()::text, l."id",
                 COALESCE(NULLIF(s."attachmentName", ''), 'attachment'),
                 0, s."attachmentMime", s."attachmentPath", l."updatedAt"
          FROM "ExpenseLine" l
          JOIN "ExpenseLine" s
            ON s."id" = substring(l."attachmentUrl" from '/expenses/lines/([0-9a-fA-F-]{36})/attachment')
          WHERE l."archivedAt" IS NULL
            AND COALESCE(l."attachmentPath", '') = ''
            AND COALESCE(s."attachmentPath", '') <> ''
            AND NOT EXISTS (
              SELECT 1 FROM "ExpenseLineAttachment" a
              WHERE a."lineId" = l."id" AND a."filePath" = s."attachmentPath"
            );
        `,
      },
      {
        label: 'project documents (docs:)',
        sql: `
          INSERT INTO "ExpenseLineAttachment" ("id", "lineId", "name", "size", "mimeType", "filePath", "sourceDocumentId", "uploadedBy", "uploadedAt")
          SELECT gen_random_uuid()::text, l."id", d."name", COALESCE(d."size", 0), d."mimeType", d."filePath",
                 d."id", d."uploadedBy", d."uploadedAt"
          FROM "ExpenseLine" l
          CROSS JOIN LATERAL unnest(string_to_array(substring(l."attachmentName" from 6), ',')) AS doc(id)
          JOIN "ProjectDocument" d ON d."id" = btrim(doc.id) AND d."archivedAt" IS NULL
          WHERE l."archivedAt" IS NULL
            AND l."attachmentName" LIKE 'docs:%'
            AND NOT EXISTS (
              SELECT 1 FROM "ExpenseLineAttachment" a
              WHERE a."lineId" = l."id" AND a."sourceDocumentId" = d."id"
            );
        `,
      },
    ];
    for (const { label, sql } of statements) {
      try {
        const added = await this.$executeRawUnsafe(sql);
        if (added > 0) {
          console.log(`[ExpenseLineAttachment] ${label}: ${added} row(s) added`);
        }
      } catch (err) {
        console.warn(`[ExpenseLineAttachment] sync of ${label} failed:`, err);
      }
    }
  }

  /**
   * Data fixes that must run exactly once (recorded in "DataFixLog"), so that data users
   * create or change afterwards is never touched again. Nothing is deleted: every fix only
   * archives or fills empty values, and the ids it changed are kept in "details" with an
   * `undoSql` statement that reverts it.
   */
  private async applyOneTimeDataFixes() {
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DataFixLog" (
        "id" TEXT PRIMARY KEY,
        "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "affectedRows" INTEGER NOT NULL DEFAULT 0,
        "details" JSONB
      );
    `);
    await this.$executeRawUnsafe(`
      ALTER TABLE "DataFixLog" ADD COLUMN IF NOT EXISTS "details" JSONB;
    `);

    // Each statement must end with `RETURNING <id>`; undo(ids) rebuilds the previous state
    const fixes: { key: string; sql: string[]; undo: (ids: string[]) => string }[] = [
      {
        // BE_requirement_26_09_26 §8: groups "Ăn uống" / "Vận chuyển" were re-created by the old FE.
        // Archived like the UI delete button does, and only while nothing uses them.
        key: '2026-09-26_archive_an_uong_van_chuyen',
        sql: [
          `
          UPDATE "BudgetCategory" c
          SET "archivedAt" = NOW()
          WHERE c."archivedAt" IS NULL
            AND c."year" IN (2025, 2026)
            AND (
              c."id" IN ('bb5caa34-755f-42bb-aa60-c507ea7c03bf', '0c2b50bb-31db-42a5-ad74-6ec9b495ea6e')
              OR lower(normalize(trim(c."name"), NFC)) IN (lower(normalize('Ăn uống', NFC)), lower(normalize('Vận chuyển', NFC)))
            )
            AND NOT EXISTS (
              SELECT 1 FROM "BudgetValue" v
              WHERE v."amount" <> 0
                AND (
                  v."categoryId" = c."id"
                  OR v."subcategoryId" IN (SELECT s."id" FROM "BudgetSubcategory" s WHERE s."categoryId" = c."id")
                  OR v."itemId" IN (
                    SELECT i."id" FROM "BudgetItem" i
                    JOIN "BudgetSubcategory" s ON s."id" = i."subcategoryId"
                    WHERE s."categoryId" = c."id"
                  )
                )
            )
            AND NOT EXISTS (
              SELECT 1 FROM "ExpenseLine" l
              WHERE l."archivedAt" IS NULL
                AND (
                  l."categoryId" = c."id"
                  OR l."categoryId" IN (SELECT s."id" FROM "BudgetSubcategory" s WHERE s."categoryId" = c."id")
                  OR l."categoryId" IN (
                    SELECT i."id" FROM "BudgetItem" i
                    JOIN "BudgetSubcategory" s ON s."id" = i."subcategoryId"
                    WHERE s."categoryId" = c."id"
                  )
                )
            )
            AND NOT EXISTS (
              SELECT 1 FROM "InventoryBatch" b
              WHERE b."archivedAt" IS NULL AND b."expenseCategoryId" = c."id"
            )
          RETURNING c."id";
          `,
        ],
        undo: (ids) =>
          `UPDATE "BudgetCategory" SET "archivedAt" = NULL WHERE "id" IN (${ids.map((id) => `'${id}'`).join(', ')});`,
      },
      {
        // BE_requirement_26_09_26 §3: start date of existing won deals.
        // 1) linked opportunity; 2) imported deals: the single opportunity of the same company
        //    and project that started on/before the signing date.
        key: '2026-09-26_backfill_closed_deal_initiation_date',
        sql: [
          `
          UPDATE "ClosedDeal" d
          SET "initiationDate" = o."initiationDate"
          FROM "Opportunity" o
          WHERE d."opportunityId" = o."id"
            AND d."initiationDate" IS NULL
            AND o."initiationDate" IS NOT NULL
          RETURNING d."id";
          `,
          `
          UPDATE "ClosedDeal" d
          SET "initiationDate" = m."initiationDate"
          FROM (
            SELECT d2."id", MIN(o."initiationDate") AS "initiationDate"
            FROM "ClosedDeal" d2
            JOIN "Opportunity" o
              ON o."archivedAt" IS NULL
             AND o."initiationDate" IS NOT NULL
             AND o."initiationDate" <= d2."closedDate"
             AND lower(trim(o."companyName")) = lower(trim(d2."companyName"))
             AND o."projectId" IS NOT DISTINCT FROM d2."projectId"
            WHERE d2."initiationDate" IS NULL
              AND d2."opportunityId" IS NULL
              AND d2."archivedAt" IS NULL
            GROUP BY d2."id"
            HAVING COUNT(DISTINCT o."id") = 1
          ) m
          WHERE d."id" = m."id"
          RETURNING d."id";
          `,
        ],
        // only empty dates were filled, so undo clears them again
        undo: (ids) =>
          `UPDATE "ClosedDeal" SET "initiationDate" = NULL WHERE "id" IN (${ids.map((id) => `'${id}'`).join(', ')});`,
      },
      {
        // BE_requirement_02_11_26 §2: backfill deductedQuantity = actualQuantity on existing active inventory expense lines
        key: '2026-11-02_backfill_expense_line_deducted_quantity',
        sql: [
          `
          UPDATE "ExpenseLine" l
          SET "deductedQuantity" = l."actualQuantity"
          WHERE l."archivedAt" IS NULL
            AND l."inventoryItemId" IS NOT NULL
            AND l."actualQuantity" > 0
            AND l."deductedQuantity" = 0
          RETURNING l."id";
          `,
        ],
        undo: (ids) =>
          `UPDATE "ExpenseLine" SET "deductedQuantity" = 0 WHERE "id" IN (${ids.map((id) => `'${id}'`).join(', ')});`,
      },
    ];

    for (const fix of fixes) {
      try {
        const done: any[] = await this.$queryRawUnsafe(
          `SELECT 1 FROM "DataFixLog" WHERE "id" = $1`,
          fix.key,
        );
        if (done.length > 0) continue;

        const ids: string[] = [];
        await this.$transaction(async (tx) => {
          for (const statement of fix.sql) {
            const rows: any[] = await tx.$queryRawUnsafe(statement);
            for (const row of rows) ids.push(String(row.id));
          }
          const details = {
            ids,
            undoSql: ids.length > 0 ? fix.undo(ids) : null,
          };
          await tx.$executeRawUnsafe(
            `INSERT INTO "DataFixLog" ("id", "affectedRows", "details") VALUES ($1, $2, $3::jsonb) ON CONFLICT ("id") DO NOTHING`,
            fix.key,
            ids.length,
            JSON.stringify(details),
          );
        });
        console.log(`[DataFix] ${fix.key}: ${ids.length} row(s) updated`, ids);
      } catch (err) {
        console.warn(`[DataFix] ${fix.key} failed:`, err);
      }
    }
  }

  private async logAudit(
    model: string,
    action: 'create' | 'update' | 'delete',
    entityId: any,
    oldValue: any,
    newValue: any,
  ) {
    if (model === 'AuditLog' || model === 'ExpenseIdempotencyRecord') {
      return; // Do not log operations on the AuditLog table itself
    }
    const store = userContext.getStore();
    const userId = store?.userId || 'system';

    // Validate UUID format of userId to prevent PostgreSQL "invalid input syntax for type uuid: 'system'" error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return;
    }

    // Find if the user exists in DB to prevent foreign key errors (especially during initial seed/signup)
    let userExists = null;
    try {
      userExists = await this.member.findUnique({ where: { id: userId } });
    } catch (err) {
      console.error('Failed to verify user in audit log:', err);
      return;
    }

    if (!userExists) {
      return;
    }

    try {
      await this.auditLog.create({
        data: {
          userId,
          action,
          entityType: model.toLowerCase(),
          entityId: entityId ? String(entityId) : 'unknown',
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}
