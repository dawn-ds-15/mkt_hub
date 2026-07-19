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
| Trạng thái | **ĐÃ FIX**: Các hàm đã chuyển sang gọi BE trước, fallback localStorage |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Xem & Phân tích | `view` | ViewAnalytics.jsx | KPI cards, funnel chart, segment analysis |
| Nhập số liệu | `input` | PlanKPIsForm + ActualsForm + LeadsKPIsFooter | Nhập KPI targets + weekly actuals + opportunities/deals |
| So sánh kỳ | `compare` | ComparePeriods.jsx | So sánh multi-year/quarter, AI report |

---

## 3. API Endpoints — Frontend gọi

### 3.1 Dashboard

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/dashboard/overview` | `getDashboardData(periodType, periodValue, year)` | Params: `period_type`, `period_value`, `year` |
| GET | `/v1/dashboard/kpi-cards` | `getKpiCardsData(periodType, periodValue, year)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| GET | `/v1/dashboard/funnel` | `getFunnelData(periodType, periodValue, year)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |

### 3.2 Leads KPIs (đã migrate từ localStorage → BE)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/leads-kpis/plan/:year` | `getPlanKPIs(year)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| POST | `/v1/leads-kpis/plan` | `savePlanKPIs(data)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| GET | `/v1/leads-kpis/weekly` | `getActuals(week)` | **ĐÃ FIX**: Gọi BE với params `year`+`week`, fallback localStorage |
| POST | `/v1/leads-kpis/weekly` | `saveActuals(data)` | **ĐÃ FIX**: Gọi BE với mapping field names, fallback localStorage |
| GET | `/v1/leads-kpis/opportunities` | `getOpportunities()` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| POST | `/v1/leads-kpis/opportunities` | `addOpportunity(data)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| PATCH | `/v1/leads-kpis/opportunities/:id` | `updateOpportunity(id, data)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| POST | `/v1/leads-kpis/opportunities/:id/won` | `convertOpportunityToWon(id, signedDate)` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| GET | `/v1/leads-kpis/closed-deals` | `getClosedDeals()` | **ĐÃ FIX**: Gọi BE trước, fallback localStorage |
| GET | `/v1/leads-kpis/comparison` | `getCompareData(years, periodType, periodValue)` | **ĐÃ FIX**: Gọi BE trước, fallback wrapper |

### 3.3 So sánh & AI (giữ nguyên)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| POST | `/v1/ai/report` | `generateAIReport(params)` | BE không có → FE fallback local |
| DELETE | `/v1/compare/data` | `deleteCompareData(years)` | BE không có → FE silent fail |

---

## 4. Backend endpoints thực tế

### 4.1 Dashboard

| Method | Backend Endpoint | Controller | Notes |
|--------|-----------------|------------|-------|
| GET | `/api/v1/dashboard/overview` | dashboard.controller | ✅ FE gọi |
| GET | `/api/v1/dashboard/kpi-cards` | dashboard.controller | ✅ FE gọi |
| GET | `/api/v1/dashboard/funnel` | dashboard.controller | ✅ FE gọi |
| GET | `/api/v1/dashboard/activities` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/progress` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/task-status` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/alerts` | dashboard.controller | FE không gọi riêng |

### 4.2 Leads KPIs

| Method | Backend Endpoint | Controller | Notes |
|--------|-----------------|------------|-------|
| POST | `/api/v1/leads-kpis/plan` | leads-kpis.controller | ✅ FE đã kết nối |
| GET | `/api/v1/leads-kpis/plan/:year` | leads-kpis.controller | ✅ FE đã kết nối |
| GET | `/api/v1/leads-kpis/weekly` | leads-kpis.controller | ✅ FE đã kết nối |
| POST | `/api/v1/leads-kpis/weekly` | leads-kpis.controller | ✅ FE đã kết nối |
| POST | `/api/v1/leads-kpis/opportunities/:id/won` | leads-kpis.controller | ✅ FE đã kết nối |
| POST | `/api/v1/leads-kpis/prior-year-deals` | leads-kpis.controller | FE chưa gọi |
| GET | `/api/v1/leads-kpis/analysis` | leads-kpis.controller | FE chưa gọi |
| GET | `/api/v1/leads-kpis/comparison` | leads-kpis.controller | ✅ FE đã kết nối |
| GET | `/api/v1/leads-kpis/closed-deals` | leads-kpis.controller | ✅ FE đã kết nối |
| PUT | `/api/v1/leads-kpis/closed-deals/:id` | leads-kpis.controller | FE chưa gọi |

---

## 5. Data shape mapping

### 5.1 Plan KPIs — Field mapping (FE ↔ BE)

| Frontend | BE (Prisma: KpiPlan) | Ghi chú |
|----------|----------------------|---------|
| `year` | `year` (Int) | ✅ |
| `targetLeads` | `totalRawLeads` (Int) | ⚠️ FE map: BE field → FE field |
| `mqlTarget` | `targetMql` (Int) | ⚠️ FE map |
| `sqlTarget` | `targetSql` (Int) | ⚠️ FE map |
| `opportunityCount` | `targetOpp` (Int) | ⚠️ FE map |
| `closedDealCount` | `targetClosedDeal` (Int) | ⚠️ FE map |
| `pipelineValue` | `targetPipelineVal` (Decimal) | ⚠️ FE map |
| `wonValue` | `targetWonVal` (Decimal) | ⚠️ FE map |

### 5.2 Weekly Actuals — Field mapping

| Frontend | BE (Prisma: KpiActual) | Ghi chú |
|----------|------------------------|---------|
| `week` (YYYY-Www) | `year` + `week` (Ints) | **ĐÃ FIX**: FE dùng `parseWeekString()` để tách |
| `rawLeads` | `rawLeads` (Int) | ✅ |
| `mqlActual` | `mql` (Int) | **ĐÃ FIX**: FE gửi `mql` đến BE, nhận về map thành `mqlActual` |
| `sqlActual` | `sql` (Int) | **ĐÃ FIX**: FE gửi `sql` đến BE, nhận về map thành `sqlActual` |

### 5.3 Opportunity — Field mapping

| Frontend | BE (Prisma: Opportunity) | Ghi chú |
|----------|--------------------------|---------|
| `companyName` | `companyName` | ✅ |
| `size` | `size` | ✅ |
| `project` | `project.name` (relation) | ⚠️ FE map |
| `fees` | `setupFee` (Decimal) | ⚠️ FE đổi tên |
| `expectedCloseDate` | `expectedCloseDate` | ✅ |

### 5.4 Closed Deal — Field mapping

| Frontend | BE (Prisma: ClosedDeal) | Ghi chú |
|----------|-------------------------|---------|
| `customer` | `companyName` | ⚠️ FE map |
| `contract` | `project.name` | ⚠️ FE map |
| `finalFees` | `setupFee` (Decimal) | ⚠️ FE map |
| `signedDate` | `closedDate` | ⚠️ FE map |

---

## 6. Các lỗi đã fix

| # | Lỗi | File | Mô tả |
|---|------|------|-------|
| 1 | **localStorage priority trong KPI cards/funnel** | `api.js:getKpiCardsData/getFunnelData` | Đã đổi thứ tự: gọi BE trước, fallback localStorage |
| 2 | **Plan KPIs không gọi BE** | `api.js:getPlanKPIs/savePlanKPIs` | Đã thêm gọi `GET /v1/leads-kpis/plan/:year` + `POST /v1/leads-kpis/plan`, fallback localStorage |
| 3 | **Actuals không gọi BE** | `api.js:getActuals/saveActuals` | Đã thêm gọi `GET/POST /v1/leads-kpis/weekly`, fallback localStorage |
| 4 | **Week format không tương thích** | `api.js:parseWeekString` | Đã thêm hàm parse `YYYY-Www` → `{ year, week }` |
| 5 | **Field name mismatch: `mqlActual` vs `mql`** | `api.js:getActuals/saveActuals` | Đã map 2 chiều: FE `mqlActual` ↔ BE `mql` |
| 6 | **Opportunities không gọi BE** | `api.js:get/add/updateOpportunity` | Đã thêm gọi BE CRUD, fallback localStorage |
| 7 | **Closed Deals không gọi BE** | `api.js:getClosedDeals` | Đã thêm gọi `GET /v1/leads-kpis/closed-deals`, fallback localStorage |
| 8 | **Convert opp→won không gọi BE** | `api.js:convertOpportunityToWon` | Đã thêm gọi `POST /v1/leads-kpis/opportunities/:id/won`, fallback localStorage |
| 9 | **Comparison không gọi BE** | `api.js:getCompareData` | Đã thêm gọi `GET /v1/leads-kpis/comparison`, fallback wrapper |

### 6.1 Còn tồn tại

| Endpoint FE gọi | Status | Mức độ |
|-----------------|--------|--------|
| `POST /v1/ai/report` | ❌ BE không có, FE fallback local | LOW |
| `DELETE /v1/compare/data` | ❌ BE không có, FE silent fail | LOW |

### 6.2 Kết luận

**Module Leads & KPIs đã được đồng bộ.** Các chức năng chính (Plan KPIs, Actuals, Opportunities, Closed Deals, Comparison) đã chuyển sang gọi BE trước, giữ localStorage làm fallback. BE Endpoint `/v1/leads-kpis/opportunities` (GET all, POST, PATCH) cần được implement nếu chưa có.
