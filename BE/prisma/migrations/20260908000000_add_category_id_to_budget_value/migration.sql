-- AlterTable
ALTER TABLE "BudgetValue" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetValue_categoryId_year_month_idx" ON "BudgetValue"("categoryId", "year", "month");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BudgetValue_categoryId_fkey'
  ) THEN
    ALTER TABLE "BudgetValue" ADD CONSTRAINT "BudgetValue_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
