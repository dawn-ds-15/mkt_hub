# MKT Hub — Bản Dump Database Hoàn Chỉnh (Handover)

Thư mục này chứa bản sao lưu (dump) đầy đủ của cơ sở dữ liệu PostgreSQL hệ thống **MKT Hub** (gồm toàn bộ Schema DDL, Enum, Sequence, dữ liệu 59 bảng, Khoá chính/Khoá ngoại và Indexes).

## 1. Danh sách file trong thư mục

| File | Kích thước | Mô tả |
| :--- | :--- | :--- |
| `mkt_hub_database_dump.sql` | ~36.4 MB | File SQL dump đầy đủ (có thể chạy trực tiếp bằng `psql`). |
| `mkt_hub_database_dump.zip` | ~5.5 MB | Bản nén ZIP của file `mkt_hub_database_dump.sql` (tiện tải về / gửi qua chat hoặc email). |

---

## 2. Thống kê dữ liệu trong bản dump

- **Hệ quản trị CSDL:** PostgreSQL 17 (`UTF8`)
- **Schema:** `public`
- **Tổng số bảng:** 59 bảng
- **Tổng số bản ghi:** 35,432 dòng
  - `Member`: 24 dòng
  - `Project`: 145 dòng
  - `Task`: 1,076 dòng (`task_stakeholders`: 17 dòng)
  - `Opportunity`: 190 dòng (`ClosedDeal`: 90 dòng)
  - `BudgetCategory`: 40 dòng (`BudgetSubcategory`: 49, `BudgetItem`: 109, `BudgetValue`: 201)
  - `AnnualExpensePlan`: 2 dòng (`AnnualExpensePlanItem`: 15 dòng)
  - `ExpenseRecord`: 647 dòng (`ExpenseLine`: 891, `ExpenseLineAttachment`: 36, `expense_audit_logs`: 1,316)
  - `InventoryItem`: 341 dòng (`InventoryBatch`: 332, `InventoryBatchAttachment`: 5, `InventoryTransaction`: 1,030)
  - `KpiPlan`: 3 dòng (`KpiMonthlyPlan`: 12, `KpiDistribution`: 77, `KpiActual`: 104, `ProjectDailyActual`: 193)
  - `DropdownConfig`: 11 dòng (`DropdownOption`: 78, `SystemConfig`: 73, `PermissionMatrix`: 1)
  - `TrackingSite`: 5 dòng (`TrackingEvent`: 15, `AnonymousProfile`: 5, `IdentifiedLead`: 7, `CompanyMaster`: 5, `SlaQueueItem`: 5)
  - `AuditLog`: 28,179 dòng

---

## 3. Hướng dẫn khôi phục (Restore)

File `mkt_hub_database_dump.sql` đã bao gồm lệnh `DROP TABLE IF EXISTS ... CASCADE` và tạo lại đầy đủ `EXTENSION`, `ENUM`, `TABLE`, `INSERT`, `CONSTRAINT`, `INDEX` theo đúng thứ tự phụ thuộc.

### Cách 1: Dùng connection string (`DATABASE_URL`)

```bash
psql "postgresql://<username>:<password>@<host>:<port>/<database_name>" -f database_dump/mkt_hub_database_dump.sql
```

### Cách 2: Dùng tham số `psql`

```bash
psql -U <username> -h <host> -p <port> -d <database_name> -f database_dump/mkt_hub_database_dump.sql
```

---

## 4. Kết nối với Backend (`BE/`)

Sau khi restore xong database:

1. Mở thư mục `BE/` và tạo file `.env` (tham khảo `BE/.env.example`):
   ```env
   DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/<database_name>?schema=public"
   DIRECT_URL="postgresql://<username>:<password>@<host>:<port>/<database_name>?schema=public"
   JWT_SECRET="your-jwt-secret"
   PORT=4000
   ```
2. Cài đặt dependencies & khởi chạy:
   ```bash
   cd BE
   npm install
   npx prisma generate
   npm run start:dev
   ```
