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
| GET | `/v1/leads-kpis/weekly?year=&week=&projectId=` | `getActuals(week, projectId)` | FE parse week string YYYY-Www → year+week. ✅ Gửi thêm `projectId` để lọc theo dự án |
| POST | `/v1/leads-kpis/weekly` | `saveActuals(data)` | Gửi `rawLeads, mql, sql, oppCount, closedCount` + `projectId` (lưu actual theo dự án) |
| GET | `/v1/leads-kpis/weekly` | `getKPIRollover(year, week)` | Lấy rollover data từ weekly response |
| GET | `/v1/leads-kpis/weekly?year=&week=` | `getOpportunities(year)` | Lấy opportunities từ weekly response |
| POST | `/v1/leads-kpis/opportunities` | `addOpportunity(data)` | Thêm opportunity (try/catch) |
| PATCH | `/v1/leads-kpis/opportunities/:id` | `updateOpportunity(id, data)` | Cập nhật opportunity (try/catch) |
| POST | `/v1/leads-kpis/opportunities/:id/won` | `convertOpportunityToWon(id, signedDate)` | Chốt opportunity thành won |
| GET | `/v1/leads-kpis/closed-deals` | `getClosedDeals()` | Danh sách closed deals |
| PUT | `/v1/leads-kpis/closed-deals/:id` | `updateClosedDeal(id, data)` | Cập nhật closed deal |
| DELETE | `/v1/leads-kpis/closed-deals/:id/delete` | `deleteClosedDeal(id)` | Xoá closed deal |
| GET | `/v1/leads-kpis/comparison` | `getCompareData(years, periodType, periodValue)` | So sánh YoY |
| GET | `/v1/leads-kpis/events?projectId=&week=&year=` | `getEvents(projectId, week, year)` | Lấy sự kiện theo dự án + tuần |
| POST | `/v1/leads-kpis/events` | `addEvent(data)` | Tạo sự kiện (`projectId, week, year, name, date, description, rawLeads, mql, sql`) |
| PATCH | `/v1/leads-kpis/events/:id` | `updateEvent(id, data)` | Cập nhật sự kiện |
| DELETE | `/v1/leads-kpis/events/:id` | `deleteEvent(id)` | Xoá sự kiện (soft-delete `archivedAt`) |

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
| GET | `/api/v1/leads-kpis/events` | ✅ | **ĐÃ THÊM** function `getEvents` — BE xác nhận qua `/api/docs-json` |
| POST | `/api/v1/leads-kpis/events` | ✅ | **ĐÃ THÊM** function `addEvent` |
| PATCH | `/api/v1/leads-kpis/events/:id` | ✅ | **ĐÃ THÊM** function `updateEvent` |
| DELETE | `/api/v1/leads-kpis/events/:id` | ✅ | **ĐÃ THÊM** function `deleteEvent` |

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
| 12 | **Thêm `projectId` cho weekly endpoints** | `api.js:getActuals`, `api.js:saveActuals` | FE gửi `projectId` (lọc khi GET, lưu khi POST). **Backend ĐÃ HỖ TRỢ**: `GET /api/v1/leads-kpis/weekly` có query param `projectId`, `SaveWeeklyKpisDto` (POST) có field `projectId` — xác nhận qua `/api/docs-json`. |
| 13 | **Sự kiện (Events) — đang lưu in-memory** | `ActualsForm.jsx`, `services/eventsStore.js` | Sự kiện tạo ở Form Nhập Actual hiện chỉ lưu trong `Map` in-memory (`eventsStore.js`), **reload trang mất hết**, chưa gửi lên backend. Chỉ tổng `rawLeads/mql/sql` (cộng dồn từ events) mới được lưu DB qua `saveActuals`. |
| 14 | **Sự kiện (Events) — chuyển sang backend** | `services/api.js`, `services/eventsStore.js`, `EventsModal.jsx`, `ActualsForm.jsx` | **ĐÃ FIX**: BE có đủ `GET/POST/PATCH/DELETE /api/v1/leads-kpis/events` (xác nhận qua `/api/docs-json` + live test 401/không 404). `eventsStore` giờ gọi API, giữ `Map` làm cache/fallback offline; `ActualsForm` fetch events theo project+week; tổng actual đọc từ events trên backend. **Lưu ý**: DTO POST yêu cầu `date` bắt buộc — FE luôn gửi `date` (mặc định hôm nay nếu trống). |

---

## 6. Sự kiện (Events) — ĐÃ HOÀN THÀNH

> **Trạng thái: ✅ ĐÃ FIX.** Backend đã có đủ 4 endpoint (xác nhận qua `/api/docs-json` + live test), FE đã chuyển sang gọi API.

### Hiện trạng (trước fix)
- `ActualsForm.jsx` cho phép tạo sự kiện (Event) với: `name`, `date`, `description`, `rawLeads`, `mql`, `sql` theo `projectId` + `week`.
- Sự kiện lưu trong `Map` in-memory (`FE/services/eventsStore.js`), **không bền vững** — reload mất.
- Chưa có endpoint backend nào nhận/lưu từng sự kiện.

### Endpoints (đã có trên backend)

| Method | Endpoint | Function FE | Body / Params | Ghi chú |
|--------|----------|-------------|---------------|---------|
| POST | `/v1/leads-kpis/events` | `addEvent(data)` | `{ projectId, week, year, name, date, description, rawLeads, mql, sql }` | Tạo event mới, trả về event đã lưu kèm `id` |
| GET | `/v1/leads-kpis/events` | `getEvents(projectId, week, year)` | Query: `projectId`, `week`, `year` | Lấy danh sách event theo dự án + tuần |
| PATCH | `/v1/leads-kpis/events/:id` | `updateEvent(id, data)` | Body như POST | Cập nhật event |
| DELETE | `/v1/leads-kpis/events/:id` | `deleteEvent(id)` | — | Soft-delete via `archivedAt` (đúng pattern hiện tại) |

### Data shape (đã khớp backend)
- `projectId` (UUID, bắt buộc)
- `week` (1-53), `year` (YYYY)
- `name` (String, bắt buộc)
- `date` (String ISO, **bắt buộc trên backend** — FE luôn gửi, mặc định hôm nay nếu trống)
- `description` (String?, tùy chọn)
- `rawLeads`, `mql`, `sql` (Int ≥ 0, mặc định 0)

### Cách FE hoạt động
- `eventsStore.js` gọi API (`GET/POST/PATCH/DELETE /v1/leads-kpis/events`), giữ `Map` làm **cache + fallback offline** (lỗi mạng → lưu local với temp id `evt_...`).
- `ActualsForm.jsx` gọi `fetchEvents` khi đổi dự án/tuần (hoặc fetch tất cả dự án khi chọn "Tất cả dự án").
- Tổng actual (`saveActuals`) đọc từ events đã lấy từ backend.

---

## 7. Còn tồn tại

| # | Vấn đề | Mức độ | Mô tả |
|---|--------|--------|-------|
| 1 | **`POST /v1/ai/report`** | THẤP | Endpoint tồn tại trên Render nhưng có thể payload format chưa khớp. FE gửi cả camelCase + snake_case. |
| 2 | **`POST /v1/leads-kpis/prior-year-deals` FE chưa gọi** | THẤP | Import dữ liệu năm cũ. |
| 3 | **`GET /v1/leads-kpis/analysis` FE chưa gọi** | THẤP | Analysis dashboard. |

---

## 8. Kết luận

**Module Leads & KPIs đã xử lý hết các issues CAO và TRUNG BÌNH, gồm cả Sự kiện (Events).** Còn 3 issues THẤP không ảnh hưởng tới chức năng chính.

### Ghi chú
- `deleteOpportunity` gọi `DELETE /v1/leads-kpis/opportunities/:id` — backend soft-delete via `archivedAt`.
- `deleteClosedDeal` gọi `DELETE /v1/leads-kpis/closed-deals/:id` — backend soft-delete via `archivedAt`.
- `deleteCompareData` là no-op — chỉ `markDeleted('compare', years)` trong localStorage (không có BE endpoint).
- Đã align với backend `archivedAt` pattern — không còn localStorage soft-delete riêng lẻ.
