\set ON_ERROR_STOP on

-- Every anomaly SELECT must return zero rows.

SELECT id FROM finance.expense_categories
WHERE parent_id = id OR btrim(code) = '' OR btrim(name) = '';

SELECT id FROM finance.project_expense_entries
WHERE planned_amount IS NULL AND actual_amount IS NULL;

SELECT project_id, idempotency_key, count(*)
FROM finance.project_expense_entries
WHERE idempotency_key IS NOT NULL
GROUP BY project_id, idempotency_key
HAVING count(*) > 1;

SELECT year, count(*)
FROM marketing.annual_kpi_plans
GROUP BY year
HAVING count(*) > 1;

SELECT project_id, year, count(*)
FROM marketing.project_kpi_plans
GROUP BY project_id, year
HAVING count(*) > 1;

SELECT project_plan_id, kpi_key, count(*)
FROM marketing.project_kpi_plan_items
GROUP BY project_plan_id, kpi_key
HAVING count(*) > 1;

SELECT project_id, reporting_date, kpi_key, count(*)
FROM marketing.project_kpi_actuals
GROUP BY project_id, reporting_date, kpi_key
HAVING count(*) > 1;

SELECT annual.year, item.kpi_key
FROM marketing.annual_kpi_plans AS annual
JOIN marketing.annual_kpi_plan_items AS item ON item.annual_plan_id = annual.id
LEFT JOIN marketing.kpi_definitions AS definition ON definition.kpi_key = item.kpi_key
WHERE definition.kpi_key IS NULL;

-- Informational reconciliation reports.
SELECT * FROM marketing.project_kpi_allocation_status ORDER BY year, kpi_key;
SELECT * FROM finance.expense_category_yearly_summary
ORDER BY expense_year, project_id, category_id, currency_id;
