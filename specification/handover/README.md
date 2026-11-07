# MKT Hub — Specification Handover Index

Mỗi tài liệu dưới đây là một specification độc lập theo **Role × Module**. PRD-00 vẫn là nguồn cho authentication, RBAC, audit, NFR và business rules dùng chung.

| Module             | Data                               | Front-end                                   | Back-end                                  |
|--------------------|------------------------------------|---------------------------------------------|-------------------------------------------|
| Dashboard          | [Data](data/01-dashboard.md)       | [Front-end](frontend/01-dashboard.md)       | [Back-end](backend/01-dashboard.md)       |
| Projects & Tasks   | [Data](data/02-projects-tasks.md)  | [Front-end](frontend/02-projects-tasks.md)  | [Back-end](backend/02-projects-tasks.md)  |
| Leads & KPIs       | [Data](data/03-leads-kpis.md)      | [Front-end](frontend/03-leads-kpis.md)      | [Back-end](backend/03-leads-kpis.md)      |
| Expense Management | [Data](data/04-expense.md)         | [Front-end](frontend/04-expense.md)         | [Back-end](backend/04-expense.md)         |
| Data Management    | [Data](data/05-data-management.md) | [Front-end](frontend/05-data-management.md) | [Back-end](backend/05-data-management.md) |

## Quy ước chung

-   Múi giờ nghiệp vụ: Asia/Bangkok; timestamp lưu UTC.
-   Tuần theo ISO, luôn truyền/lưu cả year và week.
-   Manager và Specialist theo ma trận quyền trong PRD-00.
-   Mọi write phải validate ở Back-end và ghi audit log.
-   Giá trị không tính được do mẫu số 0 trả `null/N/A`, không trả Infinity/NaN.
-   Các mục ghi **BA cần chốt** chưa được coder tự hardcode giả định.
