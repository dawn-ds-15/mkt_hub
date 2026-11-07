# Back-end Specification — Module 4: Expense Management

## Endpoints/quyền

- `GET /api/v1/expenses` — cả hai role.
- `POST/PATCH/DELETE /expenses...` — Manager.
- `GET /financial-assumptions` — cả hai; write — Manager.
- `GET /expenses/summary`; `GET /expenses/report` — cả hai.

## Service rules

- Không tạo expense cho Cancelled project.
- Server tính total, variance, CAC, LTV, ratio, health (BR-007–009).
- Customer = 0 trả HTTP 200, CAC null và `NO_NEW_CUSTOMERS`.
- Assumption effective-dated; không overwrite lịch sử, không overlap period.
- Specialist write trả 403 `EXPENSE_WRITE_FORBIDDEN`.
- Mutation invalidate Dashboard/Expense aggregates.

## Audit/tests

- Expense/assumption mutation và audit cùng transaction.
- Summary trả cả input công thức để đối chiếu.
- Test tháng 6 giữ assumption cũ sau khi tạo assumption tháng 7.
- **BA cần chốt:** churn 0, ratio >4 và overhead allocation.
