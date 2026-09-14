# Yêu cầu BE — Tổng hợp (11/09/2026)

**Ngày:** 11/09/2026
**Người gửi:** FE Team
**Ưu tiên:** Cao

> File tổng hợp các yêu cầu BE do FE Team gửi. Các yêu cầu phát sinh sau sẽ được bổ sung tiếp
> vào file này (mỗi yêu cầu một Mục), không tách file riêng.

---

## Mục 1 — OPP/Pipeline phải gán theo Ngày bắt đầu (initiationDate)

## Vấn đề

BE đã lưu/trả về đúng `contractName` và `initiationDate` (yêu cầu trước đã đạt),
**nhưng logic gán Opportunity vào kỳ (period attribution) KHÔNG dùng `initiationDate`**.
Kết quả: tạo opportunity đặt `initiationDate` tháng 7, mở tab **Xem & Phân tích** tháng 7
của project vẫn hiển thị OPP = 0 — bản ghi bị dồn vào kỳ khác (tháng 9 / Q3).

### Dữ liệu thực tế (kiểm chứng 11/09/2026, project "test")

Opportunity được tạo với ngày bắt đầu tháng 7:

```json
{
  "id": "e9f0d84d-e8e3-4ccb-86a4-59b7f650cd20",
  "companyName": "tesst",
  "projectId": "ceb6dd18-3601-4464-9990-8e02721735bc",
  "projectName": "test",
  "contractName": "b",
  "setupFee": 1000000,
  "expectedCloseDate": "2026-09-11",
  "initiationDate": "2026-07-11",   // người dùng đặt ngày bắt đầu = THÁNG 7
  "status": "active",
  "createdAt": "2026-09-11T08:56:55.875Z"
}
```

### Kết quả các API period-based (project "test")

| API | Tháng 7 (kỳ vọng = 1) | Tháng 9 / Q3 (BE đang gán vào) |
|-----|:---:|:---:|
| `GET /v1/dashboard/kpi-cards` → `OPP.actual` | **0** | **2** |
| `GET /v1/dashboard/pipeline-by-segment` → `openDeals` | **0** | 1 (enterprise) |
| `GET /v1/dashboard/funnel` → `OPP.actual` | **0** | — |
| `GET /v1/leads-kpis/weekly?month=7` → `actual.oppCount` | **0** | — |

→ OPP được gán theo `expectedCloseDate`/`createdAt` (tháng 9 — Q3), **không theo `initiationDate`**.
Người dùng mong đợi bản ghi được thể hiện ở tháng chứa **ngày bắt đầu**.

---

## Yêu cầu

### 1. Period attribution theo `initiationDate`

Tất cả API period-based phải gán Opportunity vào kỳ dựa trên **`initiationDate`**:

- month: `initiationDate` thuộc tháng được chọn
- quarter: `initiationDate` thuộc quý được chọn
- week: `initiationDate` thuộc tuần được chọn
- year: `initiationDate` thuộc năm được chọn

Áp dụng cho các API sau:

| API | Endpoint | Chỉ tiêu bị ảnh hưởng |
|-----|----------|------------------------|
| KPI Cards | `GET /v1/dashboard/kpi-cards` | `OPP.actual`, `Pipeline Value.actual` |
| Funnel | `GET /v1/dashboard/funnel` | `OPP.actual` |
| Pipeline by Segment | `GET /v1/dashboard/pipeline-by-segment` | `openDeals`, `value` |
| Weekly/Monthly KPI | `GET /v1/leads-kpis/weekly` | `actual.oppCount` |
| Comparison | `GET /v1/leads-kpis/comparison` | `oppCount`, `pipelineValue` |

### 2. Pipeline Value phải lọc theo kỳ

`Pipeline Value.actual` hiện trả **tổng active pipeline của project** ở **mọi kỳ**
(tháng 7 / 8 / 9 đều = 1,000,000) — không lock theo kỳ được chọn.
Cần tính `Pipeline Value` của các opportunity có `initiationDate` trong kỳ (cùng quy tắc mục 1).

### 3. Closed Deal / Won Value giữ nguyên

Giữ nguyên attribution của Closed Deal theo `closedDate`/`signedDate` như hiện tại.

---

## Ảnh hưởng FE

- Tab **Xem & Phân tích** (`ViewAnalytics.jsx`) dùng `kpi-cards`, `funnel`, `pipeline-by-segment`
  → các con số OPP/Pipeline sẽ sai cho tới khi BE fix.
- Danh sách "Cơ hội (theo Ngày bắt đầu)" FE lấy toàn năm và sort theo `initiationDate`
  nên hiển thị đúng, nhưng các con số KPI dựa trên BE period-based API vẫn sai.
- Tab **So sánh kỳ** (`ComparePeriods.jsx`) dùng `comparison` → `oppCount`/`pipelineValue` cũng sai.

---

## Mục 2 — Báo cáo Chi phí: rollup actual từ lines + budget theo kỳ

### Vấn đề

`GET /v1/expenses/report` trả về **actual = 0** ở mọi cấp độ, dù system có expense lines
(dữ liệu thực tế 3 project: test=128,854, INNOEX=1,663,200, LEAD GENERATION=16,632,000).
Trong khi đó `GET /v1/expenses` (sau yêu cầu rollup 11/09) đã trả `directCost` đúng,
**endpoint report này chưa được rollup**.

#### Dữ liệu thực tế (kiểm chứng 11/09/2026)

Response `GET /v1/expenses/report?period=2026` và `?period=2026-09` giống nhau về actual:

```json
{
  "overview": {
    "period": "2026-09",
    "metrics": {
      "totalExpense": 0,
      "actualTotalBeforeVat": 0,
      "actualTotalAfterVat": 0,
      "plannedTotalAfterVat": 19255654
    },
    "projects": [
      { "projectId": "82ddad9c-...", "projectName": "INNOEX 2026",   "budgetTotal": 2494800,  "actualTotal": 0 },
      { "projectId": "ceb6dd18-...", "projectName": "test",         "budgetTotal": 128854,   "actualTotal": 0 },
      { "projectId": "e73d7aee-...", "projectName": "LEAD GENERATION 2026", "budgetTotal": 16632000, "actualTotal": 0 }
    ]
  },
  "trend": [ { "period": "2026-01", "totalExpense": 0 }, ... toàn 0 ... ],
  "distribution": [ { "projectType": "exhibition", "cost": 0 } ]
}
```

Trong khi dữ liệu lines thực tế năm 2026:

| Project | Line | `expenseDate` (ngày phát sinh) | Amount |
|---------|------|-------------------------------|-------:|
| test | Smartlog leaflet | 2026-09 | 8,316 |
| test | Smartlog leaflet | 2026-09 | 8,316 |
| test | haidang | 2026-06 | 112,222 |
| INNOEX 2026 | Smartlog leaflet | 2026-08-17 | 1,663,200 |
| LEAD GENERATION 2026 | Quảng cáo tháng 5 | 2026-04-29 | 16,632,000 |

`GET /v1/expenses` đã trả `directCost` đúng cho từng expense, nhưng report không dùng.

#### Vấn đề thứ 2: budget không theo kỳ

`budgetTotal` (và `plannedTotalAfterVat`=19,255,654 ≈ 19M) là **toàn năm** bất kể `period`
(tháng 9 cũng trả 19M). FE hiển thị báo cáo tháng **2026-09**: ngân sách 19M (năm)
so với actual 16,632 (chỉ line tháng 9) → chênh lệch **-99.9%**, vô nghĩa cho người dùng.

### Yêu cầu

#### 1. Report rollup actual từ expense lines

`GET /v1/expenses/report?period=` (month `YYYY-MM` / quarter `YYYY-Qn` / year `YYYY`)
phải tự tính actual từ lines, **không trả 0**:

- Quy tắc attribution: mỗi line thuộc kỳ theo **`lines[].expenseDate`** (ngày phát sinh,
  quy ước chung với phần nhập chi phí); nếu không có `expenseDate` thì dùng
  `expense.month`/`expense.year` của header.
- Bỏ qua line có `cancelledAt` / `archivedAt`.
- Amount dùng `actualAmount` nếu > 0, ngược lại `totalAmount` (giống rollup `GET /v1/expenses`).

Các field phải điền đúng:

| Field | Nguồn |
|-------|-------|
| `overview.metrics.totalExpense` | Tổng lines trong kỳ selected |
| `overview.metrics.actualTotalBeforeVat` / `actualTotalAfterVat` | Tương ứng (sau VAT theo line) |
| `overview.projects[].actualTotal` / `actualDirect` / `actualOverhead` | Rollup theo project trong kỳ |
| `overview.projects[].variance` | `budgetTotal - actualTotal` trong kỳ |
| `trend[].totalExpense` | Tổng lines theo từng tháng (12 tháng, kể cả khi period=month) |
| `distribution[].cost` / `percentage` | Tổng theo `projectType` trong kỳ |

#### 2. Budget scoped theo kỳ

`overview.projects[].budgetTotal` và `metrics.plannedTotalBeforeVat` / `plannedTotalAfterVat`
phải tính **trong kỳ được chọn** (nguồn: plan theo tháng của expense-budget
— `categories[].months` / `subcategories[].backup.months` / `items[].months`):

- period = month: budget của tháng đó
- period = quarter: tổng 3 tháng
- period = year: tổng cả năm (= giá trị hiện tại, giữ nguyên hành vi cũ)

→ Tránh hiển thị "ngân sách cả năm vs chi phí 1 tháng" gây chênh lệch -99.9%.

#### 3. Khi BE fix xong, FE sẽ bỏ fallback

FE hiện có fallback `getExpenseReportActuals` (api.js:1574) tự rollup từ lines khi
`metrics.totalExpense = 0`. Sau khi BE trả đúng, FE xoá fallback này.

### Ảnh hưởng FE

- Tab **Báo cáo Chi phí** (`ExpenseReports.jsx`) hiện số sai: "Thực tế 16,632 / Ngân sách 19M / Chênh lệch -99.9%",
  trend tháng 4=17M, tháng 6=112,222, tháng 8=2M, tháng 9=16,632 (từ fallback dùng line date, đúng hướng
  nhưng BE gốc toàn 0).
- Sau fix: report trả actual đúng (năm 2026 ≈ 18,424,054), budget scoped theo kỳ → chênh lệch hợp lý.

---

## Mục 3 — Ghost data khi xóa dự án: cleanup BE cascade + FE localStorage

### Vấn đề

Khi xóa dự án (`DELETE /v1/projects/:id`), các bản ghi con (events, actuals, opportunities, expenses)
**có thể không bị xóa trên BE**, và FE **không dọn dẹp localStorage** →
dữ liệu cũ vẫn hiển thị trong các tab dùng aggregation (đặc biệt tab **So sánh kỳ**).

### Dữ liệu kiểm chứng (11/09/2026)

#### FE — `deleteProject` không dọn localStorage

```
// api.js:472
export const deleteProject = async (id) => {
  await api.delete(`/v1/projects/${id}`);
  markDeleted('projects', id);        // ← chỉ ẩn khỏi dropdown
  // THIẾU: clearEvents(id)           // ← eventsStore.js Map vẫn giữ data
  // THIẾU: localStorage.removeItem(`mkt_hub_daily_actuals_${id}`)
};
```

Các key bị tồn đọng sau khi xóa:

| Nguồn | Key | Dữ liệu |
|-------|-----|----------|
| `eventsStore.js` (in-memory Map) | `${projectId}\|${week}` | Events rawLeads/mql/sql |
| `api.js` localStorage | `mkt_hub_daily_actuals_${projectId}` | Daily actuals per project |

#### BE — So sánh tổng vs theo dự án

Hiện tại tổng all-projects **khớp** với tổng từng dự án (1272 = 1000+0+0+0+263+9),
nhưng nếu `DELETE /v1/projects/:id` **không cascade** xóa records con
(events, actuals, opportunities, expenses), thì sau khi xóa dự án:
- Tổng all-projects vẫn chứa data cũ → ghost numbers
- Dropdown dự án ẩn dự án đã xóa → người dùng không biết số nào là ghost

Kiểm tra API BE cho project giả (không tồn tại):

```
GET /v1/leads-kpis/events?projectId=0000...  → []        (OK)
GET /v1/leads-kpis/projects/0000.../actual   → 404       (OK)
GET /v1/leads-kpis/projects/0000.../kpi      → 404       (OK)
GET /v1/leads-kpis/comparison?projectId=0000... → 0/0/0   (OK)
```

BE hiện trả 0 cho project giả → tốt, nhưng **không đảm bảo cascade khi xóa project thật**.
Cần xác nhận BE thực sự xóa records con khi xóa project, hoặc aggregation API tự lọc project tồn tại.

---

### Yêu cầu

#### 1. BE cascade xóa records con khi xóa dự án (hoặc aggregation tự lọc)

`DELETE /v1/projects/:id` cần xóa hoặc vô hiệu hóa **tất cả records liên quan**:

| Table | Xử lý |
|-------|-------|
| Events (rawLeads/mql/sql) | CASCADE delete hoặc SET project_id = NULL + aggregation lọc NULL |
| Actuals (daily actuals) | CASCADE delete |
| Opportunities | CASCADE delete hoặc chuyển về "unassigned" |
| Expenses + Lines | CASCADE delete hoặc chuyển về company-level |

**Tùy chọn BE** (chọn 1 trong 2):
- **A. CASCADE delete**: `ON DELETE CASCADE` trên FK → records con tự xóa. Aggregation không còn ghost.
- **B. Aggregation tự lọc**: Các API aggregate (`comparison`, `kpi-cards`, `funnel`, `pipeline-by-segment`) phải `JOIN` với projects table và **loại bỏ records có projectId không tồn tại** trong projects.

#### 2. FE dọn localStorage khi xóa dự án

`deleteProject` trong `api.js` phải gọi cleanup:

```js
export const deleteProject = async (id) => {
  await api.delete(`/v1/projects/${id}`);
  markDeleted('projects', id);
  // Thêm cleanup:
  clearEvents(id);                                    // xóa eventsStore Map
  localStorage.removeItem(`mkt_hub_daily_actuals_${id}`); // xóa daily actuals
};
```

#### 3. Xác nhận: tab So sánh kỳ không còn ghost data sau xóa

Khi xóa dự án:
- Tổng all-projects trong `comparison` phải **giảm đúng bằng** data của dự án đó
- Dropdown dự án không còn hiện dự án đã xóa
- Tab So sánh kỳ không hiển thị số nào của dự án đã xóa

---

### Ảnh hưởng FE

- Tab **So sánh kỳ** (`ComparePeriods.jsx`): dùng `comparison` + `kpi-cards` aggregate → ghost data nếu BE không cascade.
- Tab **Xem & Phân tích** (`ViewAnalytics.jsx`): dùng `kpi-cards`, `funnel`, `pipeline-by-segment` → cùng vấn đề.
- FE cần fix `deleteProject` trong `api.js:472` để gọi `clearEvents(id)` và xóa localStorage key.