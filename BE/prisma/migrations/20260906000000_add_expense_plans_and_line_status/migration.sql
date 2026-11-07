-- AlterTable ExpenseLine
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "recognizedDate" DATE;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "isUnplanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "unplannedItemName" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "projectExpenseItemId" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "annualExpenseItemId" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT;

-- CreateTable AnnualExpensePlan
CREATE TABLE IF NOT EXISTS "AnnualExpensePlan" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "activatedAt" TIMESTAMP(3),
    "replacedByVersion" INTEGER,
    "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnualExpensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable AnnualExpensePlanItem
CREATE TABLE IF NOT EXISTS "AnnualExpensePlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnualExpensePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectExpensePlan
CREATE TABLE IF NOT EXISTS "ProjectExpensePlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalPlan" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExpensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectExpensePlanItem
CREATE TABLE IF NOT EXISTS "ProjectExpensePlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "planAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExpensePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnnualExpensePlan_year_version_key" ON "AnnualExpensePlan"("year", "version");
CREATE INDEX IF NOT EXISTS "AnnualExpensePlan_year_status_idx" ON "AnnualExpensePlan"("year", "status");

CREATE INDEX IF NOT EXISTS "AnnualExpensePlanItem_planId_level_idx" ON "AnnualExpensePlanItem"("planId", "level");
CREATE INDEX IF NOT EXISTS "AnnualExpensePlanItem_parentId_idx" ON "AnnualExpensePlanItem"("parentId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectExpensePlan_projectId_key" ON "ProjectExpensePlan"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectExpensePlan_projectId_year_idx" ON "ProjectExpensePlan"("projectId", "year");

CREATE INDEX IF NOT EXISTS "ProjectExpensePlanItem_planId_sortOrder_idx" ON "ProjectExpensePlanItem"("planId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ExpenseLine_status_idx" ON "ExpenseLine"("status");
CREATE INDEX IF NOT EXISTS "ExpenseLine_recognizedDate_idx" ON "ExpenseLine"("recognizedDate");
CREATE INDEX IF NOT EXISTS "ExpenseLine_projectExpenseItemId_idx" ON "ExpenseLine"("projectExpenseItemId");
CREATE INDEX IF NOT EXISTS "ExpenseLine_annualExpenseItemId_idx" ON "ExpenseLine"("annualExpenseItemId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnualExpensePlan_createdById_fkey') THEN
        ALTER TABLE "AnnualExpensePlan" ADD CONSTRAINT "AnnualExpensePlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnualExpensePlanItem_planId_fkey') THEN
        ALTER TABLE "AnnualExpensePlanItem" ADD CONSTRAINT "AnnualExpensePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AnnualExpensePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnualExpensePlanItem_parentId_fkey') THEN
        ALTER TABLE "AnnualExpensePlanItem" ADD CONSTRAINT "AnnualExpensePlanItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AnnualExpensePlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectExpensePlan_projectId_fkey') THEN
        ALTER TABLE "ProjectExpensePlan" ADD CONSTRAINT "ProjectExpensePlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectExpensePlanItem_planId_fkey') THEN
        ALTER TABLE "ProjectExpensePlanItem" ADD CONSTRAINT "ProjectExpensePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectExpensePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLine_projectExpenseItemId_fkey') THEN
        ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_projectExpenseItemId_fkey" FOREIGN KEY ("projectExpenseItemId") REFERENCES "ProjectExpensePlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseLine_annualExpenseItemId_fkey') THEN
        ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_annualExpenseItemId_fkey" FOREIGN KEY ("annualExpenseItemId") REFERENCES "AnnualExpensePlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
