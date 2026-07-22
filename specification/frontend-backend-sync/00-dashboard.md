# Module: Dashboard

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/` (trang chủ) |
| Page chính | `FE/pages/Dashboard/index.jsx` |
| Components | `Dashboard/KpiCards`, `Dashboard/FunnelChart`, `Dashboard/ActivitiesChart`, `Dashboard/ProjectProgress`, `Dashboard/TaskStatus`, `Dashboard/AlertsWidget` |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Auth | JWT Bearer token |
| Soft-delete | ✅ Frontend `filterDeleted('tasks', ...)` và `filterDeleted('projects', ...)` trên dashboard data |
| i18n | ✅ EN/VI — context `DashboardContext.locale` |

---

## 2. Các section trong Dashboard

| Section | Component | Data source | Mô tả |
|---------|-----------|-------------|-------|
| KPI Cards | KpiCards | `getDashboardData().kpiCards` | Thẻ chỉ số KPI chính |
| Funnel | FunnelChart | `getDashboardData().funnel` | Phễu chuyển đổi |
| Activities | ActivitiesChart | `getDashboardData().activities` | Phân bổ hoạt động |
| Project Progress | ProjectProgress | `getDashboardData().progress` | Tiến độ dự án |
| Task Status | TaskStatus | `getDashboardData().taskStatus` | Trạng thái công việc |
| Alerts | AlertsWidget | `getDashboardData().alerts` | Cảnh báo quá hạn/sắp hạn |

---

## 3. API Endpoints — Frontend gọi

### 3.1 Dashboard Overview (1 request duy nhất)

| Method | Endpoint FE gọi | Function | Query Params |
|--------|-----------------|----------|-------------|
| GET | `/v1/dashboard/overview` | `getDashboardData(periodType, periodValue, year)` | `period_type`, `period_value`, `year` |

FE chủ động transform response:
- `transformKpiCards(d.kpiCards)` — đổi field `actual`/`plan`, map label màu sắc
- `transformFunnel(d.funnel)` — tính `widthPct` ratio, map step names
- `transformActivities(d.activities)` — format label
- `transformProjectProgress(d.progress)` — tính `totalPct`
- `transformTaskStatus(d.taskStatus)` — map status keys
- `transformAlerts(d.alerts)` — format ngày overdue/upcoming

### 3.2 Standalone endpoints (FE dùng, BE có)

| Method | Endpoint FE gọi | Function | Query Params |
|--------|-----------------|----------|-------------|
| GET | `/v1/dashboard/kpi-cards` | `getKpiCardsData(periodType, periodValue, year)` | `period_type`, `period_value`, `year` |
| GET | `/v1/dashboard/funnel` | `getFunnelData(periodType, periodValue, year)` | `period_type`, `period_value`, `year` |

Các endpoint này có thể dùng để refresh riêng từng phần.

---

## 4. Backend endpoints thực tế (BE module1.md)

| Method | Backend Endpoint | Controller | Notes |
|--------|-----------------|------------|-------|
| GET | `/api/v1/dashboard/overview` | dashboard.controller | ✅ FE gọi, dùng là chính |
| GET | `/api/v1/dashboard/kpi-cards` | dashboard.controller | ✅ FE gọi, refresh riêng |
| GET | `/api/v1/dashboard/funnel` | dashboard.controller | ✅ FE gọi, refresh riêng |
| GET | `/api/v1/dashboard/activities` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/progress` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/task-status` | dashboard.controller | FE không gọi riêng |
| GET | `/api/v1/dashboard/alerts` | dashboard.controller | FE không gọi riêng |

---

## 5. Data shape mapping

### 5.1 Overview Response → FE state

| BE path | FE field | Transform | Ghi chú |
|---------|----------|-----------|---------|
| `data.topbar.periodLabel` | — | Không dùng | FE lấy từ Layout context |
| `data.topbar.overdueCount` | — | Không dùng | FE lấy từ alerts |
| `data.topbar.upcomingCount` | — | Không dùng | FE lấy từ alerts |
| `data.kpiCards[].label` | `card.label` | ✅ | BE trả về: Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline Value, Won Value, CAC/LTV |
| `data.kpiCards[].color` | `card.color` | ✅ | blue, green, yellow, red, gray |
| `data.kpiCards[].actual` | `card.actual` | ✅ | |
| `data.kpiCards[].plan` | `card.plan` | ✅ | |
| `data.kpiCards[].percentVsPlan` | `card.pct` | ✅ | |
| `data.kpiCards[].convPct` | `card.convPct` | ✅ | |
| `data.funnel[].step` | `funnel.step` | ✅ | Raw Leads → SQL |
| `data.funnel[].actual` | `funnel.actual` | ✅ | |
| `data.funnel[].plan` | `funnel.plan` | ✅ | |
| `data.funnel[].convPct` | `funnel.convPct` | ✅ | |
| `data.funnel[].widthPct` | `funnel.widthPct` | ✅ | |
| `data.activities[].type` | `act.label` | ✅ | |
| `data.activities[].actual` | `act.actual` | ✅ | |
| `data.activities[].plan` | `act.plan` | ✅ | |
| `data.progress.totalPct` | `progress.totalPct` | ✅ | |
| `data.progress.projects[].name` | `p.name` | ✅ | |
| `data.taskStatus.total` | `status.total` | ✅ | |
| `data.taskStatus.byStatus` | `status.byStatus` | ✅ | |
| `data.alerts.overdue` | `alerts.overdue` | ✅ | |
| `data.alerts.upcoming` | `alerts.upcoming` | ✅ | |
| `data.syncStatus` | — | Không dùng | |

### 5.2 Funnel BE → FE mapping chi tiết

| BE step | FE label |
|---------|----------|
| Raw Leads | Raw Leads |
| MQL | MQL |
| SQL | SQL |

### 5.3 Activities BE → FE mapping

| BE field | FE field |
|----------|----------|
| `type` | `label` |
| `plan` | `plan` |
| `actual` | `actual` |

---

## 6. Soft-delete trong Dashboard

Dashboard áp dụng frontend soft-delete (`filterDeleted`) cho:
- **Tasks** trong alerts (overdue/upcoming)
- **Projects** trong project progress list

Khi user xoá task/project, backend set `archivedAt`. Dashboard overview gọi `filterDeleted('tasks')` và `filterDeleted('projects')` dựa trên localStorage IDs.

**Lưu ý:** Dashboard dùng localStorage soft-delete (client-side) còn backend xoá là soft-delete DB (`archivedAt`). Cần đảm bảo đồng bộ giữa 2 layer.

---

## 7. Các vấn đề / lưu ý

| # | Vấn đề | Mô tả |
|---|--------|-------|
| 1 | **CamelCase vs snake_case params** | FE gửi `period_type`, `period_value`, `year`. BE doc ghi nhận cả 2 format. |
| 2 | **Field naming** | BE có thể trả về cả camelCase lẫn snake_case: FE dùng `d.kpiCards ?? d.kpi_cards`. |
| 3 | **SyncStatus không dùng** | BE trả về `syncStatus` nhưng FE không hiển thị. |
| 4 | **Alerts lồng trong overview** | Alerts là part của overview response, FE extract từ đó. |
| 5 | **transformKpiCards chỉ gọi trong getDashboardData** | `getKpiCardsData` standalone trả về raw BE data, không transform. |
| 6 | **Soft-delete dual layer** | Backend `archivedAt` + Frontend localStorage `filterDeleted`. Cần đồng bộ. |

---

## 8. Kết luận

**Module Dashboard đồng bộ hoàn toàn.** FE dùng chính endpoint `GET /v1/dashboard/overview` để lấy toàn bộ dữ liệu. Các transform function mapping field names BE ↔ FE nằm trong `api.js`. Dashboard áp dụng localStorage soft-delete filter cho tasks/projects alerts và progress.
