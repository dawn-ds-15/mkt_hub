-- AlterTable
ALTER TABLE "ExpenseLine" ADD COLUMN IF NOT EXISTS "hangMucLon" TEXT;
ALTER TABLE "ExpenseLine" ALTER COLUMN "status" SET DEFAULT 'draft';
