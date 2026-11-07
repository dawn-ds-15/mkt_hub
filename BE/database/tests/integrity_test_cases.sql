-- DA-RISK-005 database integrity checks
-- Run only on an isolated test database.
-- Every successful run ends with ROLLBACK and leaves no persistent rows.

BEGIN;

DO $test$
DECLARE
    v_member_id bigint;
    v_project_id bigint;
    v_task_id bigint;
    v_project_type_id bigint;
    v_project_status_id bigint;
    v_task_status_id bigint;
    v_task_priority_id bigint;
    v_rounded numeric(15,2);
    v_orphan_count bigint;
BEGIN
    SELECT id INTO STRICT v_project_type_id
    FROM core.dropdowns
    WHERE category = 'project_type' AND value = 'Internal' AND is_active = true;

    SELECT id INTO STRICT v_project_status_id
    FROM core.dropdowns
    WHERE category = 'project_status' AND value = 'Planning' AND is_active = true;

    SELECT id INTO STRICT v_task_status_id
    FROM core.dropdowns
    WHERE category = 'task_status' AND value = 'To Do' AND is_active = true;

    SELECT id INTO STRICT v_task_priority_id
    FROM core.dropdowns
    WHERE category = 'task_priority' AND value = 'Medium' AND is_active = true;

    -- Valid create
    INSERT INTO core.members (name, email, role, is_active)
    VALUES ('DA Integrity Test', 'da-integrity-test@example.invalid', 'specialist', true)
    RETURNING id INTO v_member_id;

    INSERT INTO core.projects (
        project_name, project_type_id, status_id, owner_id,
        budget_plan, actual_cost, planned_start_date, planned_end_date
    )
    VALUES (
        'DA Integrity Test Project', v_project_type_id, v_project_status_id,
        v_member_id, 1000.00, 123.456, DATE '2026-01-01', DATE '2026-01-31'
    )
    RETURNING id, actual_cost INTO v_project_id, v_rounded;

    IF v_rounded <> 123.46 THEN
        RAISE EXCEPTION 'Rounding failed: expected 123.46, got %', v_rounded;
    END IF;

    INSERT INTO core.tasks (
        task_name, project_id, assignee_id, status_id, priority_id,
        start_date, due_date, exec_week
    )
    VALUES (
        'DA Integrity Test Task', v_project_id, v_member_id,
        v_task_status_id, v_task_priority_id,
        DATE '2026-01-01', DATE '2026-01-05', 1
    )
    RETURNING id INTO v_task_id;

    -- Valid update and soft-delete/archive
    UPDATE core.projects
    SET project_name = 'DA Integrity Test Project Updated',
        archived_at = CURRENT_TIMESTAMP,
        archived_by = v_member_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_project_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CRUD update failed for project %', v_project_id;
    END IF;

    -- Duplicate must be rejected by the unique email index.
    BEGIN
        INSERT INTO core.members (name, email, role)
        VALUES ('Duplicate Test', 'da-integrity-test@example.invalid', 'specialist');
        RAISE EXCEPTION 'Duplicate email was accepted';
    EXCEPTION
        WHEN unique_violation THEN NULL;
    END;

    -- Invalid FK must be rejected.
    BEGIN
        INSERT INTO core.projects (
            project_name, project_type_id, status_id, owner_id
        )
        VALUES (
            'Invalid FK Project', v_project_type_id, v_project_status_id, -9223372036854775807
        );
        RAISE EXCEPTION 'Invalid owner FK was accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN NULL;
    END;

    -- No existing task may point to a missing project.
    SELECT COUNT(*) INTO v_orphan_count
    FROM core.tasks t
    LEFT JOIN core.projects p ON p.id = t.project_id
    WHERE p.id IS NULL;

    IF v_orphan_count <> 0 THEN
        RAISE EXCEPTION 'Found % orphan task records', v_orphan_count;
    END IF;

    -- Equivalent instants must compare equally across time zones.
    IF TIMESTAMPTZ '2026-01-01 00:00:00+07'
       <> TIMESTAMPTZ '2025-12-31 17:00:00+00' THEN
        RAISE EXCEPTION 'Timezone conversion check failed';
    END IF;

    RAISE NOTICE 'DA-RISK-005 core integrity checks passed';
END
$test$ LANGUAGE plpgsql;

ROLLBACK;
