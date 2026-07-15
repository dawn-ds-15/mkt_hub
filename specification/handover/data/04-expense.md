# Data Specification — Module 4: Expense Management

## Entity

| Entity | Grain | Field chính |
|---|---|---|
| project_expenses | project + month | direct, overhead, notes |
| financial_assumptions | effective period | churn, gross margin |
| expense_allocations | expense + project | amount, allocation method |

## Rules/công thức

- Total Cost = Direct + Overhead.
- CAC = Total Cost / số khách mới Closed (BR-007); khách = 0 trả null/N/A.
- LTV = (Avg Setup Fee + Avg Monthly Fee × 1/Churn) × Gross Margin (BR-008).
- Assumption có effective dating, không áp dụng ngược lịch sử.
- Ratio health theo BR-009; variance = Budget - Actual.

## Constraints và reconciliation

- Cost/fee không âm; churn và margin trong 0–1.
- Không có hai assumption cùng hiệu lực cho một kỳ.
- Tổng project cost bằng tổng module cùng kỳ.
- Customer count và fee reconcile với Closed Deals theo project/kỳ.

## BA cần chốt

- Một expense tổng/tháng hay nhiều line item.
- Churn = 0; health >4; biên tại 2.5 và 4.0.
- Average fee có trọng số hay số học; phương pháp phân bổ overhead.
