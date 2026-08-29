\set ON_ERROR_STOP on

BEGIN;

-- Raw Leads is retained for historical reporting, but is no longer an active KPI.
UPDATE marketing.kpi_definitions
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE kpi_key = 'raw_leads'
  AND is_active;

-- OPP business date is deliberately nullable. Existing rows must not be backfilled
-- with an invented date until the data owner approves a rule.
ALTER TABLE marketing.opportunities
    ADD COLUMN IF NOT EXISTS opportunity_date date,
    ADD COLUMN IF NOT EXISTS idempotency_key character varying(100),
    ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM marketing.opportunities
        WHERE project_id IS NULL
           OR owner_id IS NULL
           OR status_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot harden opportunities: project_id, owner_id, or status_id contains NULL';
    END IF;
END;
$$;

ALTER TABLE marketing.opportunities
    ALTER COLUMN project_id SET NOT NULL,
    ALTER COLUMN owner_id SET NOT NULL,
    ALTER COLUMN status_id SET NOT NULL;

ALTER TABLE marketing.opportunities
    DROP CONSTRAINT IF EXISTS opportunities_idempotency_key_not_blank;

ALTER TABLE marketing.opportunities
    ADD CONSTRAINT opportunities_idempotency_key_not_blank
    CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_project_idempotency_unique
    ON marketing.opportunities (project_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_opportunity_date
    ON marketing.opportunities (opportunity_date);

CREATE OR REPLACE FUNCTION marketing.bump_opportunity_row_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.row_version <> OLD.row_version THEN
        RAISE EXCEPTION 'row_version is managed by the database';
    END IF;

    NEW.row_version := OLD.row_version + 1;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_opportunity_row_version
    ON marketing.opportunities;

CREATE TRIGGER trg_bump_opportunity_row_version
BEFORE UPDATE
ON marketing.opportunities
FOR EACH ROW
EXECUTE FUNCTION marketing.bump_opportunity_row_version();

-- Read-only audit helper. Similar records are candidates for review, not deletion.
CREATE OR REPLACE VIEW marketing.opportunity_duplicate_candidates AS
SELECT
    project_id,
    owner_id,
    lower(btrim(company_name)) AS normalized_company_name,
    pipeline_value,
    opportunity_date,
    count(*) AS candidate_count,
    array_agg(id ORDER BY created_at, id) AS opportunity_ids,
    min(created_at) AS first_created_at,
    max(created_at) AS last_created_at
FROM marketing.opportunities
GROUP BY
    project_id,
    owner_id,
    lower(btrim(company_name)),
    pipeline_value,
    opportunity_date
HAVING count(*) > 1;

COMMIT;
