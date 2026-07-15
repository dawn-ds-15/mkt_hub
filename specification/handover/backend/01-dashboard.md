# Back-end Specification — Module 1: Dashboard

## Endpoints

| Method | Endpoint | Output |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | KPI cards |
| GET | `/api/v1/dashboard/funnel` | stages/conversions |
| GET | `/api/v1/dashboard/activities` | plan/actual by type |
| GET | `/api/v1/dashboard/projects` | project progress |
| GET | `/api/v1/dashboard/tasks/status` | status counts |
| GET | `/api/v1/dashboard/alerts` | deadline alerts |
| GET | `/api/v1/dashboard/sync-status` | as-of/source status |

Query chung: `period_type`, `year`, `period`; invalid combination trả 400 `INVALID_PERIOD_FILTER`.

## Service rules

- Read-only; cả Manager và Specialist được truy cập.
- Tính BR-003, BR-004, BR-010 server-side.
- Mẫu số 0 trả `value:null` và reason, không lỗi 500.
- Có `as_of`; cache phải invalidate khi dữ liệu nguồn thay đổi.
- Alert response chứa task/project identifiers cho deep link.

## Tests

- Aggregate khớp module nguồn với cùng filter.
- Không có write endpoint Dashboard.
- P95 <300ms; full page target <2 giây.
