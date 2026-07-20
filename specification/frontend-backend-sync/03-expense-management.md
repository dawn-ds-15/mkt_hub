# Module: Expense Management

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/expense` |
| Page chính | `FE/pages/ExpenseManagement.jsx` |
| Components | `ExpenseManagement/ExpenseOverview`, `ExpenseEntryForm`, `ExpenseHistory`, `ExpenseReports`, `SystemParameters` |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Trạng thái | **ĐÃ XOÁ localStorage fallback** — gọi BE trực tiếp 100% |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Tổng quan | `overview` | ExpenseOverview.jsx | KPI overview, budget allocation, project expenses table |
| Nhập chi phí | `input` | SystemParameters + ExpenseEntryForm + ExpenseHistory | System params, nhập expense, lịch sử |
| Báo cáo | `reports` | ExpenseReports.jsx | Cost charts, trends, budget vs actual |

---

## 3. API Endpoints — Frontend gọi

| Function | Endpoint FE gọi | Method | Ghi chú |
|----------|-----------------|--------|---------|
| `getExpenses(filters)` | `/v1/expenses` | GET | Query: `projectId`, `month`, `year` |
| `saveExpense(data)` | `/v1/expenses` | POST | Body: `projectId`, `month`, `year`, `directCost`, `directNotes`, `overheadCost`, `overheadNotes` |
| `deleteExpense(id)` | `/v1/expenses/:id` | DELETE | |
| `getSystemConfigs(key?)` | `/v1/expenses/system-configs` | GET | Query: `key` (churn_rate, gross_margin) |
| `saveSystemConfig(data)` | `/v1/expenses/system-configs` | POST | Body: `key`, `periodType`, `year`, `periodValue`, `value`, `effectiveFrom`, `notes` |
| `getExpenseOverview(period)` | `/v1/expenses/overview` | GET | Query: `period` (YYYY, YYYY-MM, YYYY-QX) |
| `getExpenseReport(period)` | `/v1/expenses/report` | GET | Query: `period` |

---

## 4. Backend endpoints thực tế (BE module4.md)

| Method | Backend Endpoint | Controller | Notes |
|--------|-----------------|------------|-------|
| POST | `/api/v1/expenses` | expense.controller | ✅ FE gọi |
| GET | `/api/v1/expenses` | expense.controller | ✅ FE gọi |
| DELETE | `/api/v1/expenses/:id` | expense.controller | ✅ FE gọi |
| POST | `/api/v1/expenses/system-configs` | expense.controller | ✅ FE gọi |
| GET | `/api/v1/expenses/system-configs` | expense.controller | ✅ FE gọi |
| GET | `/api/v1/expenses/overview` | expense.controller | ✅ FE gọi |
| GET | `/api/v1/expenses/report` | expense.controller | ✅ FE gọi |

---

## 5. Data shape mapping

### 5.1 Expense Entry

| FE field | BE field | Ghi chú |
|----------|----------|---------|
| `projectId` | `projectId` | ✅ |
| `month` | `month` | ✅ |
| `year` | `year` | ✅ |
| `directCost` | `directCost` (Decimal) | ✅ |
| `directNotes` | `directNotes` (String?) | ✅ |
| `overheadCost` | `overheadCost` (Decimal) | ✅ FE gửi `overhead` → BE `overheadCost` |
| `overheadNotes` | `overheadNotes` (String?) | ✅ |

### 5.2 System Config (churn_rate / gross_margin)

| FE field | BE field | Ghi chú |
|----------|----------|---------|
| `key` | `key` (String) | ✅ `churn_rate` hoặc `gross_margin` |
| `periodType` | `periodType` (String) | ✅ `month`, `quarter`, `year` |
| `year` | `year` (Int) | ✅ |
| `periodValue` | `periodValue` (Int?) | ✅ |
| `value` | `value` (Decimal) | ✅ |
| `effectiveFrom` | `effectiveFrom` (DateTime) | ✅ |
| `notes` | `notes` (String?) | ✅ |

### 5.3 Expense Overview Response

| BE field | FE uses | Ghi chú |
|----------|---------|---------|
| `metrics.totalExpense` | ✅ | Tổng chi phí |
| `metrics.newCustomersCount` | ✅ | Số khách hàng mới |
| `metrics.cac` | ✅ | Chi phí sở hữu khách hàng |
| `metrics.ltv` | ✅ | Giá trị trọn đời |
| `metrics.ratio` | ✅ | Tỉ số LTV/CAC |
| `metrics.health` | ✅ | Trạng thái sức khoẻ (blue/green/yellow/red) |
| `projects[].projectId` | ✅ | |
| `projects[].projectName` | ✅ | |
| `projects[].projectType` | ✅ | |
| `projects[].budgetTotal` | ✅ | |
| `projects[].actualTotal` | ✅ | |
| `projects[].variance` | ✅ | |
| `projects[].newCustomers` | ✅ | |
| `projects[].projectCac` | ✅ | |

### 5.4 Expense Report Response

| BE field | FE uses | Ghi chú |
|----------|---------|---------|
| `costByType` | ✅ | Donut chart data |
| `monthlyTrend` | ✅ | Line chart: chi phí và CAC qua tháng |
| `projectComparison` | ✅ | Bar chart: budget vs actual |
| `detailedTable` | ✅ | Bảng chi tiết |

---

## 6. Các vấn đề / lưu ý

| # | Vấn đề | Mức độ | Mô tả |
|---|--------|--------|-------|
| 1 | **Endpoint paths khớp hoàn toàn với BE module4.md** | ✅ | FE và BE đồng bộ. |
| 2 | **Không có localStorage fallback** | ✅ | Tất cả gọi BE trực tiếp. |

---

## 7. Kết luận

**Module Expense Management đồng bộ hoàn toàn.** FE không dùng localStorage, tất cả 7 endpoints đều gọi BE trực tiếp và khớp với BE module4.md.
