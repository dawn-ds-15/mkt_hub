# Bộ UML — MKT Hub

Bộ sơ đồ được tổng hợp từ các tài liệu `PRD-00` đến `PRD-05` của hệ thống **MKT Hub — Marketing Operations Platform**.

## Danh sách sơ đồ

| STT | File                     | Nội dung                                       |
|-------------:|--------------------|---------------------------------------|
|   1 | `system-context`         | Bối cảnh hệ thống và các tác nhân bên ngoài    |
|   2 | `use-case`               | Chức năng theo vai trò Manager và Specialist   |
|   3 | `component`              | Kiến trúc logical và phụ thuộc giữa các module |
|   4 | `domain-class`           | Domain/Class Model cốt lõi                     |
|   5 | `task-state`             | Vòng đời Task và các business rule liên quan   |
|   6 | `sequence-weekly-report` | Luồng sinh Weekly Report                       |
|   7 | `sequence-opp-to-won`    | Luồng chuyển Opportunity thành Closed Deal     |
|   8 | `sequence-import`        | Luồng import CSV/Excel bất đồng bộ             |
|   9 | `deployment`             | Kiến trúc triển khai MVP và hướng mở rộng      |
|  10 | `data_flow`              | Tài liệu luồng dữ liệu chi tiết                |

## Phạm vi hệ thống

MKT Hub gồm năm module chính:

1.  **Dashboard** — KPI tổng quan, funnel, tiến độ project và cảnh báo deadline.
2.  **Projects & Tasks** — quản lý project, task, Kanban và Weekly Report.
3.  **Leads & KPIs** — quản lý KPI plan/actual, Opportunity và Closed Deal.
4.  **Expense Management** — quản lý chi phí, CAC, LTV và LTV:CAC.
5.  **Data Management** — import/export, thành viên, dropdown, Slack, backup và audit log.

## Quy ước thiết kế

-   Các trường có hậu tố `PK` và `FK` lần lượt là khóa chính và khóa ngoại.
-   `Overdue` là trạng thái dẫn xuất từ `dueDate` và trạng thái Task, không phải trạng thái nghiệp vụ được lưu độc lập.
-   Các giá trị như Project Progress, CAC và LTV nên được tính từ dữ liệu nguồn để hạn chế sai lệch.
-   `AuditLog` tham chiếu thực thể thông qua cặp `entityType` và `entityId`.
-   Chuyển `Opportunity` thành `ClosedDeal` phải được thực hiện trong một database transaction.
-   Mọi API ghi dữ liệu phải xác thực JWT, kiểm tra RBAC và tạo audit log.

## Cách xem và chỉnh sửa

-   Mở file `.mmd` bằng [Mermaid Live Editor](https://mermaid.live/), Mermaid CLI hoặc extension Mermaid trong IDE.
-   GitHub có thể hiển thị Mermaid khi nội dung sơ đồ được đặt trong code block `mermaid` của file Markdown.
-   Hai file PNG có thể được xem trực tiếp trên GitHub và dùng trong tài liệu hoặc thuyết trình.

## Nguồn yêu cầu

-   `PRD-00-Overview (1).md`
-   `PRD-01-Dashboard.md`
-   `PRD-02-Projects-Tasks.md`
-   `PRD-03-Leads-KPIs.md`
-   `PRD-04-Expense.md`
-   `PRD-05-Data-Management.md`
