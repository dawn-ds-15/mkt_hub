# Back-end Specification — Module 3: Leads & KPIs

## Endpoints

- `GET/PUT /api/v1/kpi-plans/{year}`.
- `GET/PUT /kpi-actuals/{year}/{week}`.
- `GET /kpis/analytics`; `GET /kpis/compare`.
- CRUD `/opportunities` và `/closed-deals`.
- `POST /opportunities/{id}/convert-to-won`.

## Rules/transactions

- Server tính conversion, `% plan`, allocation và rollover (BR-003/BR-005).
- Update actual tuần là upsert có unique key và audit.
- Convert OPP → Won atomic: validate, create/link deal, close OPP, update aggregates, audit (BR-006).
- Convert request lặp lại không tạo Won thứ hai.
- Mẫu số 0 trả null; count/value âm trả 422.

## Error/test cases

- `KPI_INVALID_WEEK`, `KPI_NEGATIVE_VALUE`.
- `OPPORTUNITY_ALREADY_WON`, `OPPORTUNITY_REQUIRED_DEAL_FIELDS`.
- Transaction rollback hoàn toàn nếu convert thất bại.
- **BA cần chốt:** rollover qua năm, reopen/cancel Won và cohort conversion.
