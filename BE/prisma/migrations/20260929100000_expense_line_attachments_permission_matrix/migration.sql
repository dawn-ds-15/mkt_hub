-- §1: several files per expense line
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
CREATE INDEX IF NOT EXISTS "ExpenseLineAttachment_lineId_archivedAt_idx" ON "ExpenseLineAttachment"("lineId", "archivedAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLineAttachment_lineId_fkey') THEN
        ALTER TABLE "ExpenseLineAttachment" ADD CONSTRAINT "ExpenseLineAttachment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- §2: per-account module permission matrix (single row "default")
CREATE TABLE IF NOT EXISTS "PermissionMatrix" (
    "id" TEXT NOT NULL,
    "matrix" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "PermissionMatrix_pkey" PRIMARY KEY ("id")
);
