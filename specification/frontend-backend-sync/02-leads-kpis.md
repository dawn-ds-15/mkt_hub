# Module: Leads & KPIs

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/leads` |
| Page chính | `FE/pages/LeadsKPIs.jsx` |
| Components | `LeadsKPIs/ViewAnalytics`, `PlanKPIsForm`, `ActualsForm`, `ComparePeriods`, `LeadsKPIsFooter` |
| Context | `DashboardContext` (cung cấp `year`, `periodType`, `periodValue`) |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Trạng thái | **ĐÃ XOÁ localStorage fallback** — gọi BE trực tiếp 100% |
| Soft-delete | ✅ Backend `archivedAt` trên Opportunity, ClosedDeal — FE không dùng localStorage filter |
| i18n | ✅ EN/VI — context `DashboardContext.locale` |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Xem & Phân tích | `view` | ViewAnalytics.jsx | KPI cards, funnel chart, segment analysis |
| Nhập số liệu | `input` | PlanKPIsForm + ActualsForm + LeadsKPIsFooter | Nhập KPI targets + weekly actuals + opportunities/deals |
| So sánh kỳ | `compare` | ComparePeriods.jsx | So sánh multi-year/quarter, AI report |

---

## 3. API Endpoints — Frontend gọi

### 3.1 Dashboard (shared)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/dashboard/overview` | `getDashboardData(periodType, periodValue, year)` | Params: `period_type`, `period_value`, `year` |
| GET | `/v1/dashboard/kpi-cards` | `getKpiCardsData(periodType, periodValue, year)` | |
| GET | `/v1/dashboard/funnel` | `getFunnelData(periodType, periodValue, year)` | |

### 3.2 Leads KPIs

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/leads-kpis/plan/:year` | `getPlanKPIs(year)` | Lấy KPI plan theo năm |
| POST | `/v1/leads-kpis/plan` | `savePlanKPIs(data)` | Lưu KPI plan |
| GET | `/v1/leads-kpis/weekly?year=&week=` | `getActuals(week)` | FE parse week string YYYY-Www → year+week |
| POST | `/v1/leads-kpis/weekly` | `saveActuals(data)` | Gửi `rawLeads, mql, sql, oppCount, closedCount` |
| GET | `/v1/leads-kpis/weekly` | `getKPIRollover(year, week)` | Lấy rollover data từ weekly response |
| GET | `/v1/leads-kpis/weekly?year=&week=` | `getOpportunities(year)` | Lấy opportunities từ weekly response |
| POST | `/v1/leads-kpis/opportunities` | `addOpportunity(data)` | Thêm opportunity (try/catch) |
| PATCH | `/v1/leads-kpis/opportunities/:id` | `updateOpportunity(id, data)` | Cập nhật opportunity (try/catch) |
| POST | `/v1/leads-kpis/opportunities/:id/won` | `convertOpportunityToWon(id, signedDate)` | Chốt opportunity thành won |
| GET | `/v1/leads-kpis/closed-deals` | `getClosedDeals()` | Danh sách closed deals |
| PUT | `/v1/leads-kpis/closed-deals/:id` | `updateClosedDeal(id, data)` | Cập nhật closed deal |
| DELETE | `/v1/leads-kpis/closed-deals/:id/delete` | `deleteClosedDeal(id)` | Xoá closed deal |
| GET | `/v1/leads-kpis/comparison` | `getCompareData(years, periodType, periodValue)` | So sánh YoY |

### 3.3 Import / Export (LeadsKPIsFooter)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| POST | `/v1/export/dashboard-excel` | `exportDashboardExcel(params)` | Export dashboard ra Excel (giữ nguyên) |
| POST | `/v1/import/kpi-history` | `importKPIHistory(formData)` | Import KPI history (đã sửa path) |
| POST | `/v1/import/closed-deals` | `importClosedDeals(formData)` | Import closed deals (đã sửa path) |

### 3.4 AI Report

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| POST | `/v1/ai/report` | `generateAIReport(params)` | Endpoint tồn tại trên Render, có thể trả 400 nếu payload sai format |

---

## 4. Backend endpoints thực tế

| Method | Backend Endpoint | FE gọi | Trạng thái |
|--------|-----------------|--------|------------|
| POST | `/api/v1/leads-kpis/plan` | ✅ | Đồng bộ |
| GET | `/api/v1/leads-kpis/plan/:year` | ✅ | Đồng bộ |
| GET | `/api/v1/leads-kpis/weekly` | ✅ | Đồng bộ |
| POST | `/api/v1/leads-kpis/weekly` | ✅ | Đồng bộ (thêm `oppCount`, `closedCount`) |
| POST | `/api/v1/leads-kpis/opportunities/:id/won` | ✅ | Đồng bộ |
| POST | `/api/v1/leads-kpis/prior-year-deals` | ❌ | FE chưa gọi |
| GET | `/api/v1/leads-kpis/analysis` | ❌ | FE chưa gọi |
| GET | `/api/v1/leads-kpis/comparison` | ✅ | Đồng bộ |
| GET | `/api/v1/leads-kpis/closed-deals` | ✅ | Đồng bộ |
| PUT | `/api/v1/leads-kpis/closed-deals/:id` | ✅ | **ĐÃ THÊM** function `updateClosedDeal` |

---

## 5. Các fix đã thực hiện

| # | Vấn đề | File:Function | Mô tả |
|---|--------|---------------|-------|
| 1 | **Rollover endpoint không tồn tại** | `getKPIRollover` | Đổi từ gọi `/v1/leads-kpis/rollover` → extract từ `GET /v1/leads-kpis/weekly` response (trả về `planGoc`, `rollover`, `effectivePlan`) |
| 2 | **Opportunities CRUD không có BE endpoint** | `getOpportunities`, `addOpportunity`, `updateOpportunity` | `getOpportunities` đổi sang lấy từ `GET /v1/leads-kpis/weekly`. `addOpportunity`/`updateOpportunity` thêm try/catch fallback. |
| 3 | **saveActuals thiếu oppCount/closedCount** | `saveActuals` | Thêm `oppCount` và `closedCount` vào payload gửi lên BE. |
| 4 | **Thiếu `updateClosedDeal`** | `updateClosedDeal` | Thêm function mới gọi `PUT /v1/leads-kpis/closed-deals/:id`. |
| 5 | **Thiếu `deleteClosedDeal`** | `deleteClosedDeal` | Thêm function mới gọi `DELETE /v1/leads-kpis/closed-deals/:id/delete` (sau revert thành no-op — chỉ ẩn UI). |
| 6 | **Import path sai** | `importKPIHistory`, `importClosedDeals` | Đã sửa path theo Data Management module (xem doc 04-data-management.md). |
| 7 | **addOpportunity gửi empty row** | `OpportunitiesTable.jsx` | Không gọi API với empty row — tạo local temp row, gọi `addOpportunity` khi có companyName. |
| 8 | **Convert to Won với temp ID** | `OpportunitiesTable.jsx` | Nếu row còn temp ID (chưa save), gọi `addOpportunity` trước → lấy real ID → `convertOpportunityToWon`. |
| 9 | **ViewAnalytics silent error** | `ViewAnalytics.jsx` | Thêm error state + banner lỗi + nút Thử lại. |
| 10 | **ClosedDealsTable rút gọn** | `ClosedDealsTable.jsx` | Chỉ hiện 5 dòng + popup "Xem tất cả". |
| 11 | **getKPIRollover silent catch** | `api.js:getKPIRollover` | Bỏ silent catch, lỗi propagate lên component. |

---

## 6. Còn tồn tại

| # | Vấn đề | Mức độ | Mô tả |
|---|--------|--------|-------|
| 1 | **`POST /v1/ai/report`** | THẤP | Endpoint tồn tại trên Render nhưng có thể payload format chưa khớp. FE gửi cả camelCase + snake_case. |
| 2 | **`POST /v1/leads-kpis/prior-year-deals` FE chưa gọi** | THẤP | Import dữ liệu năm cũ. |
| 3 | **`GET /v1/leads-kpis/analysis` FE chưa gọi** | THẤP | Analysis dashboard. |

---

## 7. Kết luận

**Module Leads & KPIs đã xử lý hết các issues CAO và TRUNG BÌNH.** Còn 3 issues THẤP chưa ảnh hưởng tới chức năng chính.

### Ghi chú
- `deleteOpportunity` gọi `DELETE /v1/leads-kpis/opportunities/:id` — backend soft-delete via `archivedAt`.
- `deleteClosedDeal` gọi `DELETE /v1/leads-kpis/closed-deals/:id` — backend soft-delete via `archivedAt`.
- `deleteCompareData` là no-op — chỉ `markDeleted('compare', years)` trong localStorage (không có BE endpoint).
- Đã align với backend `archivedAt` pattern — không còn localStorage soft-delete riêng lẻ.
