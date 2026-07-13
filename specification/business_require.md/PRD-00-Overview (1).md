# PRD-00 — Tổng Quan Hệ Thống

**MKT Hub — Marketing Operations Platform** Version 1.0 \| Cập nhật: 2026-06-20

------------------------------------------------------------------------

## 1. Bài Toán & Mục Tiêu

### 1.1 Bài toán hiện tại

| \#  | Vấn đề                                                              | Hậu quả                                               |
|------------------------|------------------------|------------------------|
| 1   | Báo cáo và vận hành rời rạc trên nhiều file Google Sheets           | Sai lệch số liệu giữa các báo cáo                     |
| 2   | Khi số liệu thành phần thay đổi, báo cáo tổng hợp không tự cập nhật | Độ trễ thông tin, quyết định dựa trên dữ liệu cũ      |
| 3   | Lập báo cáo tuần tốn nhiều giờ làm việc thủ công                    | Nhân sự mất thời gian vận hành thay vì làm chiến lược |

### 1.2 Mục tiêu hệ thống

-   **Single Source of Truth**: Tất cả dữ liệu MKT tập trung tại một nơi
-   **Automation**: Tự động phát sinh báo cáo tuần/tháng/quý/năm từ dữ liệu thực tế
-   **Tracking & Analytics**: Trực quan hoá phễu 5 bước, CAC, LTV, hiệu suất theo project
-   **Alerting**: Cảnh báo deadline task, thông báo Slack tự động

### 1.3 Phạm vi hệ thống

-   Giao diện web đơn trang (SPA) với 5 module điều hướng qua sidebar
-   Cơ sở dữ liệu tập trung (SQLite cho MVP, nâng lên PostgreSQL khi scale)
-   Real-time sync giữa các module thông qua dependency graph
-   Slack Webhook integration cho thông báo deadline
-   Xuất báo cáo PDF, Excel

------------------------------------------------------------------------

## 2. Cấu Trúc 5 Module

```         
MKT Hub
├── 📊 Dashboard          — Tổng quan & cảnh báo toàn hệ thống
├── 📋 Projects & Tasks   — Quản lý dự án, công việc, báo cáo tuần
├── 📈 Leads & KPIs       — Phễu chuyển đổi, Pipeline, So sánh cùng kỳ
├── 💰 Expense Management — Chi phí, CAC, LTV, sức khoẻ tài chính MKT
└── 🗄️ Data Management    — Import/Export, Team, Cài đặt, Slack, Backup
```

### Bộ lọc toàn cục (Global Filter)

Hiển thị thường trực trên sidebar: -

Tất cả dữ liệu hiển thị trên Dashboard và các report phản chiếu theo bộ lọc toàn cục.

------------------------------------------------------------------------

## 3. Người Dùng & Phân Quyền

### 3.1 Danh sách vai trò

| Vai trò    | Số lượng | Mô tả                                                       |
|------------------------|------------------------|------------------------|
| Manager    | 1        | Toàn quyền hệ thống                                         |
| Specialist | 3        | Nhập liệu, edit project/task/KPIs — không được edit Expense |

### 3.2 Ma trận quyền hạn chi tiết

| Module          | Tính năng                           | Manager | Specialist   |
|-----------------|-------------------------------------|---------|--------------|
| Dashboard       | Xem                                 | ✅      | ✅           |
| Projects        | Tạo / Edit / Xoá project            | ✅      | ✅           |
| Projects        | Thêm trường tuỳ chỉnh               | ✅      | ❌           |
| Tasks           | Tạo / Edit task                     | ✅      | ✅           |
| Tasks           | Xoá task                            | ✅      | ❌           |
| Leads & KPIs    | Nhập Plan KPIs                      | ✅      | ✅           |
| Leads & KPIs    | Nhập Actual hàng tuần               | ✅      | ✅           |
| Leads & KPIs    | Chỉnh sửa dữ liệu tuần đã lưu       | ✅      | ✅           |
| Expense         | Xem chi phí                         | ✅      | ✅ (chỉ xem) |
| Expense         | Nhập / Edit / Xoá chi phí           | ✅      | ❌           |
| Expense         | Cập nhật Gross Margin %, Churn Rate | ✅      | ❌           |
| Data Management | Import / Export                     | ✅      | ✅           |
| Data Management | Quản lý Team Members                | ✅      | ❌           |
| Data Management | Cấu hình Dropdown                   | ✅      | ❌           |
| Data Management | Backup & Reset                      | ✅      | ❌           |

### 3.3 Xác thực

-   Đăng nhập bằng email + password
-   JWT token, expire sau 8 giờ (1 ngày làm việc)
-   Session tự đăng xuất khi hết hạn

------------------------------------------------------------------------

## 4. Data Model Dùng Chung

### 4.1 Members

```         
members
├── id (PK)
├── name
├── email
├── role: ENUM(manager, specialist)
├── avatar_url
├── is_active: boolean
└── created_at
```

### 4.2 Dropdown Config

Hệ thống cho phép Manager cấu hình các giá trị dropdown thay vì hardcode:

| Dropdown Key     | Giá trị mặc định                                                                           |
|------------------------------------|------------------------------------|
| `project_type`   | workshop, event, exhibition, webinar, Online Campaign, Lead Generation, Awards, Production |
| `project_status` | Planning, Active, On Hold, Completed, Cancelled                                            |
| `task_status`    | Planning, Processing, Done, Pending, Backlog, Cancel                                       |
| `task_priority`  | High, Medium, Low                                                                          |
| `company_size`   | Enterprise, Medium                                                                         |
| `stakeholder`    | BOD, Sales Team, Dev Team, CS Team                                                         |

### 4.3 Audit Log

Mọi thao tác ghi (create, update, delete) đều được ghi log:

```         
audit_logs
├── id (PK)
├── user_id (FK → members)
├── action: ENUM(create, update, delete)
├── entity_type: (project, task, kpi_entry, expense, ...)
├── entity_id
├── field_changed
├── old_value (JSON)
├── new_value (JSON)
└── created_at
```

------------------------------------------------------------------------

## 5. Business Rules Tổng Hợp

| Mã     | Quy tắc                                                                                                                                                                                | Module            |
|------------------------|------------------------|------------------------|
| BR-001 | Khi task chuyển sang status **Backlog**: bắt buộc điền lý do (reason). Lý do này hiển thị trong Weekly Report mục "Backlog / Blocked"                                                  | Tasks             |
| BR-002 | Nếu task có điền trường "Yêu cầu hỗ trợ BOD": tự động đẩy vào mục "Cần BOD hỗ trợ" của Weekly Report                                                                                   | Tasks             |
| BR-003 | Conv % tính tuần tự: MQL/Leads → SQL/MQL → OPP/SQL → Closed/OPP. Không tính cross-step                                                                                                 | Leads & KPIs      |
| BR-004 | Project Progress % = (Số task Done / Tổng task) × 100. Tổng tiến độ Dashboard = trung bình cộng các project đang Active                                                                | Projects          |
| BR-005 | Kế hoạch KPI năm chia đều theo tuần/tháng/quý. Nếu kỳ trước chưa đạt, phần thiếu **cộng dồn (rollover)** vào kỳ tiếp theo                                                              | Leads & KPIs      |
| BR-006 | OPP có thể chuyển thành Won trong cùng tuần. Khi chuyển: OPP count giảm 1, Won count tăng 1, giá trị từ Pipeline Value chuyển sang Won Value                                           | Leads & KPIs      |
| BR-007 | CAC = (Direct Cost + Overhead) / Số khách hàng mới Closed trong kỳ. Tính cho từng project VÀ cho tổng tháng/quý/năm                                                                    | Expense           |
| BR-008 | LTV = (Setup Fee + Monthly Fee × (1 / Churn Rate)) × Gross Margin %. Gross Margin % và Churn Rate có thể thay đổi theo kỳ — khi thay đổi phải ghi vào kỳ thay đổi, không áp dụng ngược | Expense           |
| BR-009 | LTV:CAC health indicator: \<1.5 → 🔴 Nguy hiểm; 1.5–2.5 → 🟡 Cần tối ưu; 2.5–4.0 → 🟢 Tỷ lệ vàng                                                                                       | Expense           |
| BR-010 | Task alert: Quá hạn = due date \< hôm nay + status ≠ Done/Cancel. Sắp hạn = due date trong vòng 5 ngày tới + status ≠ Done/Cancel                                                      | Dashboard / Slack |

------------------------------------------------------------------------

## 6. Yêu Cầu Phi Chức Năng

### 6.1 Hiệu năng

| Chỉ số                | Mục tiêu                               |
|-----------------------|----------------------------------------|
| Load trang Dashboard  | \< 2 giây                              |
| Lưu & đồng bộ dữ liệu | \< 500ms                               |
| API response time     | \< 300ms (P95)                         |
| Import file CSV       | Không block UI (background processing) |
| Concurrent users      | 10 người (nội bộ)                      |

### 6.2 Bảo mật

-   HTTPS bắt buộc
-   JWT authentication
-   RBAC kiểm tra mọi API endpoint
-   Input sanitization: ngăn XSS, SQL injection
-   Audit log toàn bộ thao tác write

### 6.3 Export Format

-   **PDF**: giữ nguyên layout, ngắt trang hợp lý
-   **Excel**: đa sheet — Sheet 1: Summary, Sheet 2: Task List, Sheet 3: Leads Detail

------------------------------------------------------------------------

## 7. Roadmap Phát Triển

| Phase                         | Thời gian | Nội dung                                                                    | Ưu tiên  |
|------------------|------------------|------------------|------------------|
| Phase 1 — MVP                 | Tháng 1   | UI Layout 5 module, CRUD Project/Task, nhập KPI thủ công, Database schema   | Critical |
| Phase 2 — Sync Engine         | Tháng 2   | Auto-sync dữ liệu → Dashboard, Weekly Report tự động từ tasks, rollover KPI | High     |
| Phase 3 — Expense & Analytics | Tháng 3   | Module Expense, CAC/LTV, So sánh cùng kỳ, Slack Webhook                     | High     |
| Phase 4 — Polish & Scale      | Tháng 4   | Export PDF/Excel, Audit log UI, Backup, tối ưu hiệu năng                    | Medium   |

------------------------------------------------------------------------

*File này là tài liệu nền — đọc trước khi đọc bất kỳ PRD module nào khác.*
