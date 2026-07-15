# Data Specification — Module 3: Leads & KPIs

## Entity và grain

| Entity | Grain/unique key | Nội dung |
|---|---|---|
| kpi_plans | year + metric | annual plan |
| kpi_actuals | ISO year + week + metric | weekly actual |
| opportunities | một OPP | company, segment, project, value, status |
| closed_deals | một Won deal | fees, company, project, closed date |
| kpi_rollovers | metric + period | base, shortfall, adjusted target |

## Rules

- Count/value không âm; tuần 1–53.
- Funnel conversion theo BR-003; mẫu số 0 trả null.
- Plan được phân bổ theo kỳ và rollover theo BR-005.
- OPP → Won liên kết record nguồn, giảm pipeline và tăng won atomically (BR-006).
- Tổng count/value phải reconcile với detail records.
- Dùng `dim_period` cho week/month/quarter/year, nhất là tuần giao năm.

## DQ tests

- Unique actual per year/week/metric.
- Không tạo hai Closed Deal từ cùng một OPP.
- Closed Deal có company, closed date và fields giá trị bắt buộc.
- Funnel bất thường được cảnh báo nhưng không ép giảm dần nếu khác cohort.

## BA cần chốt

- Chia phần dư annual plan; rollover qua quý/năm.
- Actual vượt plan có bù sang kỳ sau không.
- Won bị cancel/reopen và cohort dùng tính conversion.
