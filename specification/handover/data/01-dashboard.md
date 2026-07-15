# Data Specification — Module 1: Dashboard

## Mục tiêu

Cung cấp data mart read-only, đồng nhất với dữ liệu nguồn từ Projects, Tasks, Leads, KPI và Expense cho mọi bộ lọc tuần/tháng/quý/năm.

## Dataset và lineage

| Dataset | Nguồn | Grain | Output chính |
|---|---|---|---|
| KPI Cards/Funnel | kpi_plans, kpi_actuals | period + metric | plan, actual, % plan, conversion |
| Pipeline/Won | opportunities, closed_deals | period | count, total value |
| Project Progress | projects, tasks | project | done, total, progress % |
| Task Status | tasks thuộc project Active | status | task count |
| Alerts | tasks, members, projects | task | alert type, số ngày |
| CAC/LTV | expenses, deals, assumptions | period | CAC, LTV, ratio, health |

## View/output contract

- `vw_dashboard_kpi_period(period_type, period_key, metric, plan, actual, pct_plan, conversion)`.
- `vw_project_progress(project_id, done_tasks, total_tasks, progress_pct)`.
- `vw_task_alerts(task_id, project_id, assignee_id, alert_type, day_delta)`.
- `vw_financial_health_period(total_cost, new_customers, cac, ltv, ratio, health)`.
- Mọi output có `source_updated_at`.

## Công thức và DQ

- Conversion chỉ giữa hai bước kề nhau theo BR-003.
- Project progress = Done / tổng task; tổng Dashboard là trung bình project Active (BR-004).
- Overdue và due-soon theo BR-010; loại Done/Cancel.
- Plan hoặc mẫu số bằng 0 trả null.
- Reconcile tổng tháng/quý/năm với dữ liệu tuần và `dim_period`.

## BA cần chốt

- Task Cancel có nằm trong mẫu số progress không.
- Project không task trả 0 hay N/A.
- Tuần cắt ngang tháng được phân bổ theo ngày hay ISO week owner.
