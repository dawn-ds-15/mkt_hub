# Module: Expense Management

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/expense` |
| Page chính | `FE/pages/ExpenseManagement.jsx` |
| Components | `ExpenseManagement/ExpenseOverview`, `ExpenseEntryForm`, `ExpenseHistory`, `ExpenseReports`, `SystemParameters` |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Trạng thái | **ĐÃ FIX**: Các hàm đã thử gọi BE trước, fallback localStorage. BE chưa có controller cho Expense |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Tổng quan | `overview` | ExpenseOverview.jsx | KPI overview, budget allocation, project expenses table |
| Nhập chi phí | `input` | SystemParameters + ExpenseEntryForm + ExpenseHistory | System params, nhập expense, lịch sử |
| Báo cáo | `reports` | ExpenseReports.jsx | Cost charts, trends, budget vs actual |

---

## 3. API Endpoints — Frontend gọi

| Function | Endpoint FE gọi (đã fix) | Fallback |
|----------|--------------------------|----------|
| `getExpenseSystemParams()` | `GET /v1/system-configs?key=expense_params` | localStorage `mkt_hub_expense_params` |
| `saveExpenseSystemParam(data)` | `POST /v1/system-configs` | localStorage `mkt_hub_expense_params` |
| `getExpenseList(project?)` | `GET /v1/expense-records?projectId=` | localStorage `mkt_hub_expense_list` |
| `saveExpense(data)` | `POST /v1/expense-records` | localStorage `mkt_hub_expense_list` |
| `getExpenseReports()` | `GET /v1/expense-reports` | hardcoded empty data |
| `getExpenseOverview()` | `GET /v1/expense-overview` | localStorage `mkt_hub_expense_overview` |
| `getProjectsDropdown()` | **ĐÃ FIX**: dùng `getProjects()` thay vì localStorage riêng | localStorage `mkt_hub_projects_dropdown` |

---

## 4. Backend endpoints thực tế

### ❌ Chưa có controller/endpoint nào cho Expense

Prisma model `ExpenseRecord` và `SystemConfig` có tồn tại, nhưng **chưa có NestJS controller/service implement**. FE đã chuẩn bị sẵn các endpoint pattern để kết nối khi BE được implement.

### Database models available

**Prisma: ExpenseRecord**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | UUID | PK |
| `projectId` | String | FK → Project |
| `month` | Int | combo unique với year |
| `year` | Int | combo unique với month |
| `directCost` | Decimal | |
| `directNotes` | String? | |
| `overheadCost` | Decimal | |
| `overheadNotes` | String? | |
| `createdById` | String | FK → Member |

**Prisma: SystemConfig**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | UUID | PK |
| `key` | String | |
| `periodType` | String | |
| `year` | Int | |
| `periodValue` | Int? | |
| `value` | Decimal | |
| `effectiveFrom` | DateTime | |
| `notes` | String? | |

---

## 5. Data shape mapping

### 5.1 Expense System Param

| FE field | BE field (payload) | Ghi chú |
|----------|-------------------|---------|
| `period` (YYYY-MM) | `periodType`='month', `year`, `periodValue` | **ĐÃ FIX**: FE parse period → year+month |
| `churnRate` | `value` (khi `key='expense_params'`) | ✅ |
| `note` | `notes` | ✅ |

### 5.2 Expense Entry

| FE field | BE field (payload) | Ghi chú |
|----------|-------------------|---------|
| `projectId` | `projectId` | **ĐÃ FIX**: FE dùng ID thay vì name string |
| `period` (YYYY-MM) | `month` + `year` | **ĐÃ FIX**: FE parse period |
| `directCost` | `directCost` | ✅ |
| `overhead` | `overheadCost` | ⚠️ FE: `overhead`, BE: `overheadCost` |
| `directNote` | `directNotes` | ✅ |
| `overheadNote` | `overheadNotes` | ✅ |

### 5.3 Projects Dropdown (đã fix)

| Trước (localStorage riêng) | Sau (dùng getProjects) |
|---------------------------|----------------------|
| `mkt_hub_projects_dropdown` key riêng | `getProjects()` → map thành `{ id, name }` |

---

## 6. Các lỗi đã fix

| # | Lỗi | File | Mô tả |
|---|------|------|-------|
| 1 | **Tất cả expense functions dùng localStorage, không gọi BE** | `api.js` | Đã thêm try/catch gọi BE trước cho tất cả functions |
| 2 | **Hardcoded project name trong ExpenseHistory** | `ExpenseHistory.jsx` | Đã bỏ `'Project Alpha - SEO'`, gọi `getExpenseList()` không filter |
| 3 | **Hardcoded tiêu đề "Project Alpha"** | `ExpenseHistory.jsx` | Đã đổi thành "Lịch sử Chi Phí" |
| 4 | **`getProjectsDropdown()` dùng localStorage riêng** | `api.js:getProjectsDropdown` | Đã đổi thành gọi `getProjects()` → map `{ id, name }` |
| 5 | **ExpenseEntryForm dùng project name thay vì ID** | `ExpenseEntryForm.jsx` | Đã đổi select dùng `projectId`, gửi `projectId` lên BE |
| 6 | **ExpenseEntryForm default period cứng `2023-11`** | `ExpenseEntryForm.jsx` | Đã đổi dynamic: `new Date()` → `YYYY-MM` |
| 7 | **SystemParameters default period cứng `2023-11`** | `SystemParameters.jsx` | Đã đổi dynamic: `new Date()` → `YYYY-MM` |

### 6.1 Cần BE implement

| Endpoint cần implement | Model |
|------------------------|-------|
| `GET /api/v1/system-configs` | SystemConfig |
| `POST /api/v1/system-configs` | SystemConfig |
| `GET /api/v1/expense-records` | ExpenseRecord |
| `POST /api/v1/expense-records` | ExpenseRecord |
| `GET /api/v1/expense-reports` | Aggregate |
| `GET /api/v1/expense-overview` | Aggregate |

### 6.2 Kết luận

**Module Expense Management: FE đã sẵn sàng kết nối BE.** Các function đã được cập nhật để gọi BE first + localStorage fallback. Cần implement NestJS controller/service cho ExpenseRecord và SystemConfig.
