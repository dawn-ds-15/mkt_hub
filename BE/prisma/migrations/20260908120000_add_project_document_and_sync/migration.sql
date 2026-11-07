-- Create ProjectDocument table if it does not exist
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

-- Indexes for ProjectDocument
CREATE INDEX IF NOT EXISTS "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_archivedAt_idx" ON "ProjectDocument"("archivedAt");

-- Foreign key if projects table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDocument_projectId_fkey'
    ) THEN
        ALTER TABLE "ProjectDocument"
        ADD CONSTRAINT "ProjectDocument_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
