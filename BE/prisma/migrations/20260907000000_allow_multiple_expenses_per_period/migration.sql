-- AlterTable ExpenseRecord: Add recognizedDate and status
ALTER TABLE "ExpenseRecord" ADD COLUMN IF NOT EXISTS "recognizedDate" DATE;
ALTER TABLE "ExpenseRecord" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';

-- Backfill recognizedDate from first non-null line recognizedDate, or fallback to year-month-01
UPDATE "ExpenseRecord"
SET "recognizedDate" = (
    SELECT MIN("recognizedDate")
    FROM "ExpenseLine"
    WHERE "ExpenseLine"."expenseId" = "ExpenseRecord"."id"
      AND "ExpenseLine"."recognizedDate" IS NOT NULL
)
WHERE "recognizedDate" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ExpenseLine"
    WHERE "ExpenseLine"."expenseId" = "ExpenseRecord"."id"
      AND "ExpenseLine"."recognizedDate" IS NOT NULL
  );

UPDATE "ExpenseRecord"
SET "recognizedDate" = make_date("year", "month", 1)
WHERE "recognizedDate" IS NULL;

-- Backfill status: confirmed if any line is confirmed, otherwise draft
UPDATE "ExpenseRecord"
SET "status" = CASE
    WHEN EXISTS (
        SELECT 1
        FROM "ExpenseLine"
        WHERE "ExpenseLine"."expenseId" = "ExpenseRecord"."id"
          AND "ExpenseLine"."status" = 'confirmed'
    ) THEN 'confirmed'
    ELSE 'draft'
END;

-- Drop unique constraint on (projectId, month, year) to allow multiple records per period
DROP INDEX IF EXISTS "ExpenseRecord_projectId_month_year_key";

-- Create indexes for performance on recognizedDate
CREATE INDEX IF NOT EXISTS "ExpenseRecord_projectId_recognizedDate_archivedAt_idx" ON "ExpenseRecord"("projectId", "recognizedDate", "archivedAt");
CREATE INDEX IF NOT EXISTS "ExpenseRecord_recognizedDate_idx" ON "ExpenseRecord"("recognizedDate");
