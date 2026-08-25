\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS marketing.kpi_definitions (
    kpi_key character varying(100) PRIMARY KEY,
    label character varying(255) NOT NULL,
    value_type character varying(20) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kpi_definitions_key_format_check
        CHECK (kpi_key ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT kpi_definitions_value_type_check
        CHECK (value_type IN ('COUNT', 'MONEY', 'PERCENT', 'NUMBER'))
);

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_active_order
    ON marketing.kpi_definitions (is_active, sort_order);

INSERT INTO marketing.kpi_definitions
    (kpi_key, label, value_type, sort_order)
VALUES
    ('raw_leads', 'Raw Leads', 'COUNT', 1),
    ('mql', 'MQL', 'COUNT', 2),
    ('sql', 'SQL', 'COUNT', 3),
    ('opportunity', 'Opportunity', 'COUNT', 4),
    ('closed_deal', 'Closed Deal', 'COUNT', 5),
    ('pipeline_value', 'Pipeline Value', 'MONEY', 6),
    ('won_value', 'Won Value', 'MONEY', 7)
ON CONFLICT (kpi_key) DO UPDATE
SET label = EXCLUDED.label,
    value_type = EXCLUDED.value_type,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

CREATE SEQUENCE IF NOT EXISTS marketing.kpi_monthly_plan_values_id_seq
    INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

CREATE TABLE IF NOT EXISTS marketing.kpi_monthly_plan_values (
    id bigint DEFAULT nextval('marketing.kpi_monthly_plan_values_id_seq') PRIMARY KEY,
    plan_id bigint NOT NULL,
    month smallint NOT NULL,
    kpi_key character varying(100) NOT NULL,
    target_value numeric(18,2) NOT NULL DEFAULT 0,
    created_by bigint,
    updated_by bigint,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kpi_monthly_plan_values_month_check
        CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT kpi_monthly_plan_values_target_check
        CHECK (target_value >= 0),
    CONSTRAINT kpi_monthly_plan_values_unique
        UNIQUE (plan_id, month, kpi_key),
    CONSTRAINT kpi_monthly_plan_values_plan_id_fkey
        FOREIGN KEY (plan_id) REFERENCES marketing.kpi_plans(id) ON DELETE CASCADE,
    CONSTRAINT kpi_monthly_plan_values_kpi_key_fkey
        FOREIGN KEY (kpi_key) REFERENCES marketing.kpi_definitions(kpi_key),
    CONSTRAINT kpi_monthly_plan_values_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES core.members(id),
    CONSTRAINT kpi_monthly_plan_values_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES core.members(id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_monthly_values_plan
    ON marketing.kpi_monthly_plan_values (plan_id);

DROP INDEX IF EXISTS marketing.idx_kpi_monthly_values_year_month;

CREATE INDEX IF NOT EXISTS idx_kpi_monthly_values_plan_month
    ON marketing.kpi_monthly_plan_values (plan_id, month);

CREATE INDEX IF NOT EXISTS idx_kpi_monthly_values_key
    ON marketing.kpi_monthly_plan_values (kpi_key);

INSERT INTO marketing.kpi_monthly_plan_values
    (plan_id, month, kpi_key, target_value)
SELECT
    plan.id,
    month_number,
    definition.kpi_key,
    0
FROM marketing.kpi_plans AS plan
CROSS JOIN generate_series(1, 12) AS month_number
CROSS JOIN marketing.kpi_definitions AS definition
WHERE definition.is_active
ON CONFLICT (plan_id, month, kpi_key) DO NOTHING;

CREATE OR REPLACE FUNCTION marketing.validate_kpi_monthly_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    definition_value_type character varying(20);
BEGIN
    SELECT value_type
    INTO definition_value_type
    FROM marketing.kpi_definitions
    WHERE kpi_key = NEW.kpi_key;

    IF definition_value_type = 'COUNT' AND NEW.target_value <> trunc(NEW.target_value) THEN
        RAISE EXCEPTION 'COUNT KPI % requires a whole-number target, received %',
            NEW.kpi_key, NEW.target_value;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_kpi_monthly_target
    ON marketing.kpi_monthly_plan_values;

CREATE TRIGGER trg_validate_kpi_monthly_target
BEFORE INSERT OR UPDATE OF kpi_key, target_value
ON marketing.kpi_monthly_plan_values
FOR EACH ROW
EXECUTE FUNCTION marketing.validate_kpi_monthly_target();

CREATE OR REPLACE FUNCTION marketing.seed_months_for_kpi_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_active THEN
        INSERT INTO marketing.kpi_monthly_plan_values
            (plan_id, month, kpi_key, target_value)
        SELECT plan.id, month_number, NEW.kpi_key, 0
        FROM marketing.kpi_plans AS plan
        CROSS JOIN generate_series(1, 12) AS month_number
        ON CONFLICT (plan_id, month, kpi_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_months_for_kpi_definition
    ON marketing.kpi_definitions;

CREATE TRIGGER trg_seed_months_for_kpi_definition
AFTER INSERT OR UPDATE OF is_active
ON marketing.kpi_definitions
FOR EACH ROW
EXECUTE FUNCTION marketing.seed_months_for_kpi_definition();

CREATE OR REPLACE FUNCTION marketing.seed_months_for_kpi_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO marketing.kpi_monthly_plan_values
        (plan_id, month, kpi_key, target_value)
    SELECT NEW.id, month_number, definition.kpi_key, 0
    FROM generate_series(1, 12) AS month_number
    CROSS JOIN marketing.kpi_definitions AS definition
    WHERE definition.is_active
    ON CONFLICT (plan_id, month, kpi_key) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_months_for_kpi_plan
    ON marketing.kpi_plans;

CREATE TRIGGER trg_seed_months_for_kpi_plan
AFTER INSERT
ON marketing.kpi_plans
FOR EACH ROW
EXECUTE FUNCTION marketing.seed_months_for_kpi_plan();

CREATE OR REPLACE FUNCTION marketing.apply_kpi_monthly_plan(
    p_plan_id bigint,
    p_user_id bigint
)
RETURNS marketing.kpi_plans
LANGUAGE plpgsql
AS $$
DECLARE
    old_plan jsonb;
    new_plan marketing.kpi_plans%ROWTYPE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM core.members
        WHERE id = p_user_id AND is_active
    ) THEN
        RAISE EXCEPTION 'Active member % does not exist', p_user_id;
    END IF;

    SELECT to_jsonb(plan)
    INTO old_plan
    FROM marketing.kpi_plans AS plan
    WHERE plan.id = p_plan_id
    FOR UPDATE;

    IF old_plan IS NULL THEN
        RAISE EXCEPTION 'KPI plan % does not exist', p_plan_id;
    END IF;

    IF EXISTS (
        SELECT definition.kpi_key
        FROM marketing.kpi_definitions AS definition
        LEFT JOIN marketing.kpi_monthly_plan_values AS monthly
          ON monthly.plan_id = p_plan_id
         AND monthly.kpi_key = definition.kpi_key
        WHERE definition.is_active
        GROUP BY definition.kpi_key
        HAVING count(monthly.id) <> 12
            OR count(DISTINCT monthly.month) <> 12
    ) THEN
        RAISE EXCEPTION 'KPI plan % must contain all 12 months for every active KPI', p_plan_id;
    END IF;

    UPDATE marketing.kpi_plans AS plan
    SET raw_leads_plan = totals.raw_leads,
        mql_plan = totals.mql,
        sql_plan = totals.sql,
        opp_plan = totals.opportunity,
        closed_deal_plan = totals.closed_deal,
        pipeline_value_plan = totals.pipeline_value,
        won_value_plan = totals.won_value,
        updated_at = CURRENT_TIMESTAMP
    FROM (
        SELECT
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'raw_leads'), 0)::integer AS raw_leads,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'mql'), 0)::integer AS mql,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'sql'), 0)::integer AS sql,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'opportunity'), 0)::integer AS opportunity,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'closed_deal'), 0)::integer AS closed_deal,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'pipeline_value'), 0)::numeric(15,2) AS pipeline_value,
            COALESCE(sum(target_value) FILTER (WHERE kpi_key = 'won_value'), 0)::numeric(15,2) AS won_value
        FROM marketing.kpi_monthly_plan_values
        WHERE plan_id = p_plan_id
    ) AS totals
    WHERE plan.id = p_plan_id
    RETURNING plan.* INTO new_plan;

    INSERT INTO sys_admin.audit_logs
        (user_id, action, entity_type, entity_id, field_changed, old_value, new_value)
    VALUES
        (p_user_id, 'UPDATE', 'kpi_plans', p_plan_id, 'annual_targets',
         old_plan, to_jsonb(new_plan));

    RETURN new_plan;
END;
$$;

SELECT setval(
    'marketing.kpi_monthly_plan_values_id_seq',
    COALESCE((SELECT max(id) FROM marketing.kpi_monthly_plan_values), 1),
    EXISTS (SELECT 1 FROM marketing.kpi_monthly_plan_values)
);

COMMIT;
