-- CreateTable
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
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDailyActual_projectId_actualDate_key" ON "ProjectDailyActual"("projectId", "actualDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectDailyActual_projectId_actualDate_archivedAt_idx" ON "ProjectDailyActual"("projectId", "actualDate", "archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectDailyActual_actualDate_idx" ON "ProjectDailyActual"("actualDate");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDailyActual_projectId_fkey'
    ) THEN
        ALTER TABLE "ProjectDailyActual" ADD CONSTRAINT "ProjectDailyActual_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDailyActual_createdById_fkey'
    ) THEN
        ALTER TABLE "ProjectDailyActual" ADD CONSTRAINT "ProjectDailyActual_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
