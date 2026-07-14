# MKT Hub — Data Flow Documentation

> Tài liệu mô tả luồng dữ liệu (data flow) của hệ thống MKT Hub, tổng hợp từ đặc tả kỹ thuật gốc. Dùng làm tài liệu tham chiếu khi triển khai Backend/Frontend.

---

## 1. Kiến trúc tổng thể

```
┌─────────────┐      JWT Bearer      ┌──────────────────┐      SQLAlchemy ORM     ┌─────────────┐
│   Frontend   │ ───────────────────▶ │  API Gateway /    │ ───────────────────────▶ │   SQLite     │
│  (Dashboard, │ ◀─────────────────── │  RBAC Middleware   │ ◀─────────────────────── │ (→ Postgres) │
│  CRUD Forms) │      JSON Response    │  + Audit Interceptor│                         └─────────────┘
└─────────────┘                       └──────────────────┘
```

- **Single Source of Truth**: mọi số liệu hiển thị trên Dashboard đều truy vấn trực tiếp/gián tiếp (qua aggregation) từ các bảng gốc — không có bảng cache riêng ở tầng ứng dụng.
- **Nâng cấp CSDL**: chỉ đổi Connection String (SQLite → PostgreSQL), không có logic đặc thù SQLite trong tầng nghiệp vụ.

---

## 2. Luồng xác thực & phân quyền (Auth Flow)

```
Client → POST /login (email/password)
       → Server xác thực → Sinh JWT { member_id, role, exp = now + 8h }
       → Client lưu token, gắn Header: Authorization: Bearer <JWT>

Mỗi Request tiếp theo:
Client → Request + JWT → Gateway giải mã token
       ├─ Token hết hạn (>8h) → 401 → Client xoá session, ép đăng xuất (KHÔNG refresh tự động)
       └─ Token hợp lệ → đọc "role" → RBAC Middleware kiểm tra quyền theo endpoint
              ├─ role = specialist → chặn (403) nếu là hành động: thêm custom field,
              │      xoá Task, CRUD Expense, sửa Financial Settings, quản lý member, Backup/Reset
              └─ role = manager → cho phép Full CRUD
       → Request đi tiếp vào Controller/Service
```

**Ghi chú Frontend**: các phần tử điều hướng/nút hành động bị RBAC chặn phải được **ẩn** ở UI (không chỉ chặn ở API), dựa vào `role` giải mã từ JWT lưu ở client state.

---

## 3. Luồng ghi Audit Log

```
Request ghi dữ liệu (CREATE / UPDATE / DELETE)
       → Service xử lý nghiệp vụ
       → ORM Interceptor bắt sự kiện trước khi commit
              ├─ Lấy old_value (trạng thái trước, nếu UPDATE/DELETE)
              ├─ Lấy new_value (trạng thái sau, nếu CREATE/UPDATE)
              └─ Ghi 1 dòng vào bảng audit_logs:
                    { user_id, action, entity_type, entity_id, field_changed, old_value, new_value }
       → Commit transaction chính + transaction audit log (đồng bộ)
```

Interceptor này áp dụng cho toàn bộ entity ghi được: `projects`, `tasks`, `kpi_plans`, `weekly_kpi_actuals`, `opportunities`, `closed_deals`, `project_expenses`, `financial_settings`, `members`, `dropdown_config`.

---

## 4. Luồng dữ liệu theo module nghiệp vụ

### 4.1. Project → Task (Vòng đời công việc)

```
members (owner_id) ──1:N──▶ projects ──1:N──▶ tasks ◀──N:1── members (assignee_id)
                                 │
                                 └──1:N──▶ project_expenses
```

- Tạo `project` → chọn `project_type`, `status` từ `dropdown_config` (không hardcode).
- `budget_plan_total` = cột generated (direct + overhead), tự tính, không ghi trực tiếp.
- Tạo `task` gắn `project_id` + `assignee_id`; nếu `status = Backlog` → bắt buộc field `reason`.
- Khi `status` chuyển thành `Done` → hệ thống **tự động gán** `completed_date = CURRENT_DATE` (business rule ở tầng Service, không phải trigger DB thuần).
- Xoá `project` → cascade xoá toàn bộ `tasks` liên quan (`ON DELETE CASCADE`).

### 4.2. KPI Funnel (Kế hoạch vs Thực tế)

```
kpi_plans (year)  ──── so sánh (target) ────┐
                                              ▼
weekly_kpi_actuals (year, week) ──aggregate──▶ Dashboard KPI Funnel
        (raw_leads → mql → sql → opp_count → closed_deal_count)
```

- `kpi_plans`: 1 dòng/năm, chứa chỉ tiêu (target) cho cả phễu (leads → deal) + giá trị pipeline/won.
- `weekly_kpi_actuals`: số liệu thực tế nhập theo từng tuần ISO, unique theo `(year, week)`.
- Dashboard/API tổng hợp (SUM/aggregate) `weekly_kpi_actuals` theo Period Filter (Tuần/Tháng/Quý/Năm) rồi đối chiếu với `kpi_plans` để tính % hoàn thành chỉ tiêu.

### 4.3. Sales Pipeline (Opportunity → Closed Deal)

```
projects (nguồn) ──optional──▶ opportunities (chưa ký) ──[is_won = true]──▶ closed_deals (đã ký)
                                                                                  │
                                                                                  └─ arr_estimated (generated:
                                                                                     setup_fee + monthly_fee × 12)
```

- `opportunities` và `closed_deals` là 2 bảng **độc lập** (không phải 1 bảng chuyển trạng thái) — khi một Opportunity chốt thành công, nghiệp vụ ghi thêm 1 bản ghi mới vào `closed_deals` (do `recorded_by_id` — member thực hiện), đồng thời có thể cập nhật `is_won = true` ở bản ghi Opportunity gốc để tránh đếm trùng ở phễu.
- Cả hai đều liên kết tuỳ chọn (`project_source_id`) về `projects` để biết campaign nào sinh ra deal.

### 4.4. Tài chính (Expense & CAC/LTV)

```
project_expenses (theo project + tháng/năm)
        │
        ├─ total_cost (generated: direct_cost + overhead_cost)
        ▼
   Aggregate theo Period Filter ──┐
                                    ├──▶ So sánh với budget_plan_total (project) ──▶ Dashboard chi phí
financial_settings (theo mốc       │
  tháng/năm: churn_rate,           │
  gross_margin_percent) ───────────┘──▶ Công thức CAC/LTV (kết hợp closed_deals.arr_estimated)
```

- `financial_settings` là **time-series config** (áp dụng theo `apply_month/apply_year`), không phải config tĩnh — khi tính CAC/LTV cho một kỳ, hệ thống phải lấy đúng bản ghi settings có hiệu lực tại thời điểm đó.
- `project_expenses` unique theo `(project_id, expense_month, expense_year)` về mặt nghiệp vụ (nên có ràng buộc unique ở tầng ứng dụng/DB).

### 4.5. Cấu hình động (Dropdown Config)

```
dropdown_config (dropdown_key, dropdown_value, display_order)
        │
        └──▶ Được Frontend fetch để render mọi combobox động
              (project_type, project.status, task.status, task.priority, company_size, ...)
```

- Toàn bộ giá trị enum-like trong hệ thống (trừ role) nên tra từ bảng này để tránh hardcode — Manager có quyền CRUD, Specialist chỉ Read.

### 4.6. Thông báo Slack (Singleton Config)

```
slack_settings (id = 1, CHECK id = 1)  ──▶ Scheduler (cron theo notification_time + days_of_week)
                                              │
                                              └─ Quét tasks có due_date sắp tới trong alert_days_before
                                                     → Gửi cảnh báo qua webhook_url → channel_name
```

- Bảng chỉ có duy nhất 1 dòng (ràng buộc `CHECK (id = 1)`), Manager toàn quyền sửa, Specialist read-only.

---

## 5. Bộ lọc toàn cục & ảnh hưởng đến truy vấn

```
Sidebar: Year (cố định 4 chữ số)
    │
    ▼
Dashboard: Period Filter (Tuần ISO 1-53 | Tháng 1-12 | Quý Q1-Q4 | Năm)
    │
    ▼
Query Layer: WHERE year = :year AND (week/month/quarter tương ứng)
    │
    ▼
Áp dụng lên: weekly_kpi_actuals, opportunities, closed_deals, project_expenses, tasks (theo due_date/exec_week)
```

- Mọi API tổng hợp cho Dashboard cần nhận 2 tham số bắt buộc: `year` + `period_type/period_value`, rồi generate điều kiện `WHERE` tương ứng động (tránh N truy vấn riêng lẻ cho từng loại period).

---

## 6. Tóm tắt quan hệ thực thể (ERD rút gọn)

| Bảng | Khoá ngoại | Quan hệ |
|---|---|---|
| `projects` | `owner_id → members` | N:1 |
| `tasks` | `project_id → projects` (cascade), `assignee_id → members` | N:1, N:1 |
| `opportunities` | `project_source_id → projects` (nullable) | N:1 |
| `closed_deals` | `project_source_id → projects` (nullable), `recorded_by_id → members` | N:1, N:1 |
| `project_expenses` | `project_id → projects` | N:1 |
| `audit_logs` | `user_id → members` | N:1 |
| `weekly_kpi_actuals` | — (độc lập, khoá theo `year, week`) | — |
| `kpi_plans` | — (PK = `year`) | — |
| `financial_settings` | — (time-series, khoá theo `apply_year, apply_month`) | — |
| `dropdown_config` | — (config tĩnh, khoá theo `dropdown_key, dropdown_value`) | — |
| `slack_settings` | — (singleton, luôn `id = 1`) | — |

---

## 7. Ghi chú quan trọng khi triển khai

1. **RBAC phải chặn ở cả 2 tầng**: API middleware (bắt buộc) và UI (ẩn phần tử) — không chỉ dựa vào ẩn UI.
2. **Generated columns** (`budget_plan_total`, `arr_estimated`, `total_cost`) không được ghi trực tiếp từ ứng dụng — để DB tự tính.
3. **Business rule tự động** (`completed_date` khi Done, `reason` bắt buộc khi Backlog) nên đặt ở tầng Service/Pydantic validator, không phụ thuộc DB trigger để giữ khả năng tương thích SQLite → Postgres.
4. **Audit Interceptor** cần chạy trong cùng transaction với thao tác ghi chính để đảm bảo tính nhất quán (rollback cả 2 nếu lỗi).
5. **Financial Settings** cần logic "lấy bản ghi hiệu lực gần nhất ≤ kỳ đang xét" khi tính CAC/LTV, không phải lấy bản ghi mới nhất tuyệt đối.
