-- §2: projects that bring leads (used for lead cost / ROAS / CAC)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isLeadSource" BOOLEAN NOT NULL DEFAULT false;

-- §3: start date of the source opportunity on won deals
ALTER TABLE "ClosedDeal" ADD COLUMN IF NOT EXISTS "initiationDate" DATE;

-- §4: inventory batch booked directly to a budget category
ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "expenseCategoryId" TEXT;
ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "expenseCategoryName" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryBatch_expenseCategoryId_idx" ON "InventoryBatch"("expenseCategoryId");

-- §5: attachments of inventory batches
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
CREATE INDEX IF NOT EXISTS "InventoryBatchAttachment_batchId_archivedAt_idx" ON "InventoryBatchAttachment"("batchId", "archivedAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryBatchAttachment_batchId_fkey') THEN
        ALTER TABLE "InventoryBatchAttachment" ADD CONSTRAINT "InventoryBatchAttachment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- §6: codes of deleted batches can be reused -> unique only among non-deleted batches
DROP INDEX IF EXISTS "InventoryBatch_batchCode_key";
CREATE INDEX IF NOT EXISTS "InventoryBatch_batchCode_idx" ON "InventoryBatch"("batchCode");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatch_active_batchCode_key"
    ON "InventoryBatch" (lower(btrim("batchCode"))) WHERE "archivedAt" IS NULL;

-- codes of deleted items can be reused -> unique only among non-deleted items
CREATE INDEX IF NOT EXISTS "InventoryItem_code_idx" ON "InventoryItem"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_active_code_key"
    ON "InventoryItem" ("code") WHERE "archivedAt" IS NULL;
DROP INDEX IF EXISTS "InventoryItem_code_key";

-- One-time data fixes log (PrismaService.applyOneTimeDataFixes)
CREATE TABLE IF NOT EXISTS "DataFixLog" (
    "id" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "affectedRows" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    CONSTRAINT "DataFixLog_pkey" PRIMARY KEY ("id")
);
