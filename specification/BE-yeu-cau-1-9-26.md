# Yêu cầu cho Backend — Ngày 01/09/2026

> File tổng hợp các yêu cầu dành cho backend phát sinh ngày 01/09/2026.
> Mọi yêu cầu BE viết sau ngày này cũng được thêm vào file này (có ngày kèm theo).
>
> Ngày tạo: 01/09/2026
> Nguồn: audit toàn bộ màn "Chi tiết Dự án" (`/projects/:id`) đối chiếu dữ liệu thực tế
> trên backend `mkt-hub.onrender.com` (login test `a.nguyen@company.com`).
> Link với các yêu cầu trước: `BE-yeu-cau-31-8-26.md` (mục 2 — budget), `BE-yeu-cau-28-8-26.md`.

---

## Mục lục

- [3. Đồng bộ KPI kế hoạch & thực tế vào `projects.kpis`](#3-đồng-bộ-kpi-kế-hoạch--thực-tế-vào-projectskpis)
- [4. `budgetPlanTotal` — bổ sung fallback từ bảng `BudgetValue`](#4-budgetplantotal--bổ-sung-fallback-từ-bảng-budgetvalue)
- [5. Dashboard ngân sách — endpoint `GET /v1/expense-budgets/dashboard`](#5-dashboard-ngân-sách--endpoint-get-v1expense-budgetsdashboard)
- [6. Phân quyền ngân sách — trả `permissions`](#6-phân-quyền-ngân-sách--trả-permissions)
- [7. Lỗi per-cell + xung đột phiên bản khi lưu ngân sách](#7-lỗi-per-cell--xung-đột-phiên-bản-khi-lưu-ngân-sách)

---

## Trạng thái triển khai — verify OpenAPI `mkt-hub.onrender.com/api/docs-json` ngày 02/09/2026

> ⚠️ **Đã cập nhật (02/09, lần 2):** BE đã triển khai bổ sung và **đạt** các yêu cầu mục #5, #6, #7.
> Kết quả verify lại với OpenAPI **mới nhất** trên production.

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| #5 | `GET /expense-budgets/dashboard` trả `totalBudget`/`actualSpent`/`remainingBudget`/`usedPercentage` + `categories[]` | ✅ **Đạt** | Path + query `year`/`projectId`; response `BudgetDashboardDataDto` đủ `totalBudget`, `actualSpent`, `remainingBudget`, `usedPercentage` (nullable), `categories[{categoryName, budget, percentage}]`. |
| #6 | `permissions {view, edit, manageCategories, export}` trên tree/dashboard/categories | ✅ **Đạt** | `BudgetPermissionsDto {view, edit, manageCategories, export}`; được tham chiếu trên tree, dashboard và categories. |
| #7a | `PUT /values` trả lỗi per-cell `errors[]` | ✅ **Đạt** | 400 → `BudgetCellValidationFailedResponseDto {message, errors[]}`; `errors` item = `CellValidationErrorDto {itemId, subcategoryId, isBackup, month, message}`. |
| #7b | `PUT /values` nhận `baseUpdatedAt` | ✅ **Đạt** | `BulkSaveBudgetValuesDto.baseUpdatedAt` (string, optional). |
| #7b | `GET /tree` trả `updatedAt` | ✅ **Đạt** | `BudgetTreeDataDto.data.updatedAt` (string, nullable). |
| #7b | `PUT /values` trả `412` khi conflict | ✅ **Đạt** | 412 → `BudgetVersionConflictResponseDto {message, currentUpdatedAt}`. |

**Ghi chú còn tồn đọng (không chặn FE nối các mục trên):** các endpoint CRUD cấp thấp (`POST/PATCH/DELETE /categories`, `GET/POST/PATCH/DELETE /subcategories`) vẫn chưa khai báo response schema (200/201 rỗng) trong OpenAPI. FE nối theo các endpoint chính (#5/#6/#7) là đủ.

---

# 3. Đồng bộ KPI kế hoạch & thực tế vào `projects.kpis`

> Ngày: 01/09/2026
> Nguồn: Fe audit màn Chi tiết Dự án — Card KPI (`KpiMiniCard`).
> Hiện tượng QA: nhập Kế hoạch/Thực tế ở tab "Nhập Dữ Liệu" (`ActualsForm`) thành công,
> nhưng Card KPI ở tab Chi tiết Dự án vẫn hiển thị **plan = 0** và **actual = 0**.

## 3.1 Hiện trạng (đã verify bằng API thật ngày 01/09)

**A. Nhập dữ liệu xong (tab "Nhập Dữ Liệu") — dữ liệu được lưu THÀNH CÔNG ở lớp theo kỳ:**

`POST /v1/leads-kpis/weekly` với `{ year: 2026, month: 9, projectId, rawLeads: 777, mql: 77, sql: 7 }` → `201`.
Đọc lại qua `GET /v1/leads-kpis/weekly?year=2026&month=9&projectId=...`:
```json
{
  "year": 2026, "month": 9,
  "effectivePlan": { "rawLeads": 58, "mql": 50, "sql": 28, "oppCount": 8, "closedCount": 27 },
  "actual": { "rawLeads": 777, "mql": 77, "sql": 7, "oppCount": 0, "closedCount": 0 }
}
```

**B. Đọc lại (tab "Chi tiết Dự án") — `projects.kpis` KHÔNG phản ánh:**
`GET /projects/:id` (cùng project, cùng năm):
```json
"kpis": [
  { "key": "rawLeads",   "plan": 0, "actual": 0 },
  { "key": "mql",        "plan": 0, "actual": 0 },
  { "key": "sql",        "plan": 0, "actual": 0 },
  { "key": "opp",        "plan": 0, "actual": 0 },
  { "key": "closedDeal", "plan": 0, "actual": 0 },
  { "key": "pipelineValue", "plan": 0, "actual": 0 }
]
```
> Ghi nhận: với toàn bộ 4 project đang có, `kpis[].plan` hầu hết = 0 (trừ VILOG có plan,
> nhưng đều là 0 actual) — dữ liệu kế hoạch/thực tế nhập ở màn nhập số liệu không được nối lên.

## 3.2 Vấn đề

- Kế hoạch dự kiến (plan) và thực tế (actual) nhập ở tab "Nhập Dữ Liệu" được lưu vào
  bảng **leads-kpis theo kỳ** (week/month, theo `projectId`) — endpoint `GET/POST/PUT /v1/leads-kpis/weekly`.
- Card KPI ở tab "Chi tiết Dự án" đọc từ **`projects.kpis[]`** (`GET /projects/:id`) — nguồn này
  **độc lập, không được tính/tổng hợp từ bảng leads-kpis**.
- Hệ quả: dù nhập plan/actual thành công, Card KPI vẫn hiển thị 0 → FE báo "metric kế hoạch = 0".

## 3.3 Yêu cầu

Trong `GET /projects/:id` (và schema response project), `projects.kpis[]` phải được **tính/tổng hợp
theo năm của dự án** từ dữ liệu leads-kpis theo kỳ của chính project đó:

| key | Nguồn plan | Nguồn actual |
|---|---|---|
| `rawLeads` | tổng plan rawLeads năm | tổng actual rawLeads năm |
| `mql` | tổng plan mql | tổng actual mql |
| `sql` | tổng plan sql | tổng actual sql |
| `opp` | tổng plan oppCount | tổng actual oppCount |
| `closedDeal` | tổng plan closedCount | tổng actual closedCount |
| `pipelineValue` | plan pipelineValue (nếu có) | actual pipelineValue (nếu có) |

Quy tắc:
1. `kpis[].plan` / `kpis[].actual` trả **số `>= 0`** (không `null`).
2. Nếu project chưa có dữ liệu kỳ nào → trả `0` (giữ hành vi hiện tại, FE không nhầm lỗi).
3. Năm xác định: từ `deadline`/năm hiện hành của project (cùng logic hiện BE đang dùng cho plan năm).
4. Khai báo đầy đủ trong response DTO / OpenAPI (đã có `ProjectKpiSummaryDto {key, plan, actual, percent}` — bổ sung phần tính nếu cần).
5. **Không regression**: dữ liệu nhập/truy vấn theo kỳ (`/v1/leads-kpis/weekly?month=...`) giữ nguyên.

## 3.4 Validate / Test case chấp nhận

- [ ] Nhập actual (vd. rawLeads=777) theo tháng cho project ở tab Nhập Dữ Liệu → `GET /projects/:id` trả `kpis[rawLeads].actual = 777`.
- [ ] Nhập kế hoạch dự kiến cho project → `GET /projects/:id` trả `kpis[].plan` = tổng plan năm.
- [ ] Project không có dữ liệu → `kpis[].plan/actual = 0` (không `null`).
- [ ] `docs-json` schema project có đầy đủ `kpis` với plan/actual tính đúng.

## 3.5 Checklist cho backend

- [ ] `projects.service.ts` — khi trả `GET /projects/:id`, tổng hợp `kpis[].plan`/`actual` từ bảng leads-kpis theo năm/project.
- [ ] Khai báo logic trong DTO + OpenAPI.
- [ ] Deploy + verify `docs-json` và Card KPI tab Chi tiết Dự án.

---

# 4. `budgetPlanTotal` — bổ sung fallback từ bảng `BudgetValue`

> Ngày: 01/09/2026
> Nguồn: tiếp nối `BE-yeu-cau-31-8-26.md` mục 2 (Card "Ngân sách dự án").
> Audit thực tế: `budgetPlanTotal` đang trả `0` cho **toàn bộ** 4 project dù project có ngân sách nhập tay.

## 4.1 Hiện trạng (đã verify bằng API thật ngày 01/09)

`GET /projects/:id` cho cả 4 project: `budgetPlanTotal = 0`.
- `InnoEx 2026` & `VILOG 2026`: `budgetPlanDirect = 0`, `budgetPlanOverhead = 0` → `budgetPlanTotal = 0`.
- `BA last test` & `Lead Generation`: `budgetPlanDirect = null` → `budgetPlanTotal = 0`.

Đồng thời xác nhận `actualCostTotal` **đã đồng bộ đúng** (vd. `3103600`, `110263960`, `101224247` — tổng từ `ExpenseLine`) ✅.

## 4.2 Vấn đề

Theo spec `BE-yeu-cau-31-8-26.md` mục 2.2, `budgetPlanTotal` ưu tiên:
- `budgetPlanDirect` nếu nhập thủ công → **đã có** cho InnoEx/VILOG nhưng đang là `0` → trả `0` ✅ đúng,
  nhưng chưa kiểm tra các project nhập tay có giá trị **khác 0**.
- Nếu không nhập tay → **tổng hợp từ bảng `BudgetValue` theo năm/project** → **chưa thấy được thực hiện**.
- Nếu không có dữ liệu → trả `0` (không `null`).

Chưa xác minh được có `BudgetValue` theo năm cho project nào (số liệu hiện là 0), nhưng cần BE
khẳng định nhánh "tổng hợp từ `BudgetValue`" đã chạy đúng chưa.

## 4.3 Yêu cầu

1. `GET /projects/:id` trả `budgetPlanTotal` theo thứ tự ưu tiên:
   - Nếu `budgetPlanDirect > 0` (hoặc nhập tay) → dùng `budgetPlanDirect + budgetPlanOverhead`.
   - Ngược lại, nếu có `BudgetValue` theo `year`/project của dự án → `budgetPlanTotal = tổng BudgetValue (kế hoạch năm)`.
   - Không có dữ liệu → `0` (không `null`).
2. Giữ nguyên `budgetPlanDirect`, `budgetPlanOverhead`, `actualCostDirect`, `actualCostOverhead` (không regression).

## 4.4 Validate / Test case chấp nhận

- [ ] Project nhập tay `budgetPlanDirect` → `budgetPlanTotal` khớp giá trị nhập.
- [ ] Project không nhập tay nhưng có `BudgetValue` theo năm → `budgetPlanTotal` = tổng `BudgetValue`.
- [ ] Project không có dữ liệu → `budgetPlanTotal = 0` (không `null`).
- [ ] `actualCostTotal` không regression.

## 4.5 Checklist cho backend

- [ ] `projects.service.ts` — bổ sung nhánh fallback tổng `BudgetValue` theo year/project trong tính `budgetPlanTotal`.
- [ ] Deploy + verify `docs-json` và Card "Ngân sách dự án" (số kế hoạch hiển thị `> 0` khi có dữ liệu).

---

# 5. Dashboard ngân sách — endpoint `GET /v1/expense-budgets/dashboard`

> Ngày: 02/09/2026
> Nguồn: `03-budget-frontend-spec.md` §5 — Dashboard ngân sách (tab "Ngân sách").
> Hiện trạng FE: tab Ngân sách (Dashboard) đang **tính cục bộ** số `Thực tế đã chi`/`Ngân sách còn lại`/`% đã sử dụng` từ dữ liệu `expense-list` + `expense-budgets/tree`, **không theo dữ liệu backend** → sai khi đối chiếu, vì spec FE §1 yêu cầu "chỉ hiển thị số tổng/phần trăm backend trả về, không tự tổng hợp".

## 5.1 Vấn đề

- FE Dashboard ngân sách vẽ 4 thẻ: Tổng ngân sách, Thực tế đã chi, Ngân sách còn lại, % đã sử dụng.
- Hiện không có endpoint backend nào trả các số này; FE lấy riêng `GET /v1/expense-budgets/tree` (budget) và `GET /v1/expenses` (actual) rồi **tự cộng**.
- Tình huống lệch: `expense-list` có thể bao gồm chi phí ngoài ngân sách / khác năm / khác phạm vi → tổng actual trên Dashboard ≠ ngân sách theo hạng mục.
- Danh sách tỷ trọng (§5.3 spec) cần `categoryName + budget + percentage` theo từng hạng mục — FE hiện gộp theo tên chi phí tự do, không khớp hạng mục ngân sách.

## 5.2 Yêu cầu — thêm endpoint

```
GET /v1/expense-budgets/dashboard?projectId={id|all}&year={year}
```

Tham số:
- `projectId`: optional. `all` hoặc thiếu → toàn hệ thống; UUID → một dự án. (Đồng nhất ngữ nghĩa với `GET /v1/expense-budgets/tree`.)
- `year`: optional, mặc định năm hiện tại.

Response:
```json
{
  "data": {
    "totalBudget": 114529560,
    "actualSpent": 88000000,
    "remainingBudget": 26529560,
    "usedPercentage": 76.84,
    "categories": [
      { "categoryName": "Budget Brand Marketing", "budget": 40000000, "percentage": 34.93 }
    ]
  }
}
```

Quy tắc nghiệp vụ:
1. `totalBudget` = tổng ngân sách năm theo hạng mục (giá trị `BudgetValue` 12 tháng của các item/backup thuộc project+year).
2. `actualSpent` = tổng chi thực tế **trong phạm vi ngân sách hạng mục** (cùng project+year), nguồn bàn bạc: tổng `ExpenseLine`/`Expense` của project trong năm. **Quan trọng:** phạm vi actual phải khớp thống nhất với dashboard, tránh lệch với màn hình nhập.
3. `remainingBudget = totalBudget - actualSpent` (có thể âm).
4. `usedPercentage = totalBudget > 0 ? (actualSpent / totalBudget) * 100 : null` — **`null` khi totalBudget = 0** (FE hiển thị `---`, không phải `0`).
5. `categories[]`: mỗi hạng mục cấp cao gồm `categoryName`, `budget` (tổng year của hạng mục), `percentage` (part của `totalBudget`; `null` nếu totalBudget = 0). Thứ tự theo cấu hình hạng mục/sortOrder.
6. Số còn lại của project chi tiêu ngoài hạng mục không nằm trong `actualSpent` — cần BE chốt nguồn actual (xem nhận định mục 5.4).

## 5.3 Validate / Test case chấp nhận

- [ ] `GET dashboard` trả đủ 4 thẻ + `categories[]` khớp tổng từ `tree` của cùng project/year.
- [ ] `usedPercentage = null` khi `totalBudget = 0` (không trả `0`).
- [ ] `remainingBudget` âm hiển thị đúng dấu (BE trả số âm thật, không clamp 0).
- [ ] Lọc theo `projectId` trả số liệu riêng của project; `all`/thiếu → toàn hệ thống.
- [ ] Đồng nhất: `Σ categories[].percentage` = 100 (hoặc gần đúng) khi totalBudget > 0.
- [ ] Swagger `/api/docs-json` hiển thị endpoint + schema `data`.

## 5.4 Checklist cho backend

- [ ] Tạo service/aggregation `expense-budgets/dashboard`.
- [ ] Xác định & chốt nguồn `actualSpent` đúng phạm vi (tránh lệch số giữa các màn hình).
- [ ] Trả `categories[]` theo sortOrder.
- [ ] Deploy + verify với FE tab Ngân sách.

---

# 6. Phân quyền ngân sách — trả `permissions`

> Ngày: 02/09/2026
> Nguồn: `03-budget-frontend-spec.md` §7 + tiêu chí nghiệm thu #9.
> Hiện trạng FE: chưa có flag quyền từ backend nên CRUD + nút Xuất Excel + nút "Chỉnh sửa ngân sách" đang **mở cho mọi role** — không đúng yêu cầu "ẩn nút khi không đủ quyền".

## 6.1 Vấn đề

- Spec yêu cầu FE bật/tắt theo quyền backend: Xem, Sửa, Quản lý hạng mục, Xuất Excel.
- BE chưa trả quyền nào; FE không có căn cứ để ẩn.

## 6.2 Yêu cầu

Trả thêm `permissions` trên các endpoint ngân sách (tối thiểu là trên `GET /v1/expense-budgets/tree` và `GET /v1/expense-budgets/dashboard`; đề xuất thêm cho `GET /v1/expense-budgets/categories`):

```json
{
  "data": { ... },
  "permissions": {
    "view": true,
    "edit": false,
    "manageCategories": false,
    "export": false
  }
}
```

Quy ước:
1. `view` — xem được ngân sách (dashboard + bảng nhập ở chế độ VIEW).
2. `edit` — sửa được giá trị 12 tháng (nút "Chỉnh sửa ngân sách" + PUT values).
3. `manageCategories` — thêm/sửa/xóa hạng mục (category/subcategory/item).
4. `export` — xuất Excel.
5. Các flag mặc định `true` nếu backend chưa cấu hình role (không regression), trừ khi chính sách quy định khác.
6. Bổ sung vào OpenAPI schema response cho các endpoint liên quan.

## 6.3 Validate / Test case chấp nhận

- [ ] User không có quyền `edit` → `permissions.edit = false`, FE ẩn nút chỉnh sửa.
- [ ] User không có quyền `manageCategories` → `permissions.manageCategories = false`, FE ẩn thao tác thêm/sửa/xóa.
- [ ] User không có quyền `export` → `permissions.export = false`, FE vô hiệu nút Xuất Excel.
- [ ] Không cấu hình quyền → mặc định `true` (không regression).
- [ ] Swagger `/api/docs-json` hiển thị block `permissions`.

## 6.4 Checklist cho backend

- [ ] Xác định nguồn quyền (role/cấu hình) và map sang 4 cờ trên.
- [ ] Trả `permissions` trên tree/dashboard (+ categories nếu cần).
- [ ] Deploy + verify FE tab Ngân sách.

---

# 7. Lỗi per-cell + xung đột phiên bản khi lưu ngân sách

> Ngày: 02/09/2026
> Nguồn: `03-budget-frontend-spec.md` §4.5 (lỗi validation per-cell, lỗi conflict), tiêu chí nghiệm thu #8.
> Hiện trạng FE: khi `PUT /v1/expense-budgets/values` lỗi validation, FE chỉ hiện toast chung, **không gắn lỗi vào đúng ô**; không phát hiện được xung đột phiên bản.

## 7.1 Hiện trạng

- `PUT /v1/expense-budgets/values` body: `{ year, projectId?, values: [{ itemId, subcategoryId?, isBackup, month, amount }] }`.
- Lỗi hiện tại là message chung; FE không biết lỗi thuộc ô (hạng mục/tháng) nào.

## 7.2 Yêu cầu 1 — lỗi validation per-cell

Khi một (vài) ô không hợp lệ, backend trả `400` với cấu trúc phân tách từng ô:

```json
{
  "message": "Có ô không hợp lệ",
  "errors": [
    { "itemId": "item_01", "subcategoryId": null, "isBackup": false, "month": 3, "message": "amount không được âm" }
  ]
}
```

Quy ước:
1. Mỗi lỗi phải định danh được ô: `itemId` (NULL nếu backup) + `subcategoryId` + `isBackup` + `month`.
2. FE map `errors[]` vào ô tương ứng theo `(itemId, isBackup, month)` (hoặc `(subcategoryId, isBackup, month)`).
3. Lỗi chung (không thuộc ô nào) vẫn là `message`.

## 7.3 Yêu cầu 2 — xung đột phiên bản

- Spec §4.5: khi dữ liệu đã bị người khác cập nhật → thông báo và yêu cầu tải lại.
- Giải pháp tối giản, thống nhất với FE hiện tại:
  - `GET /v1/expense-budgets/tree` trả thêm `updatedAt` (timestamp cập nhật cuối của project+year).
  - `PUT /v1/expense-budgets/values` nhận `baseUpdatedAt` (không bắt buộc). Nếu có và khác `updatedAt` hiện tại → `412 Precondition Failed` với `{ message: "Dữ liệu đã được cập nhật bởi người khác. Vui lòng tải lại.", currentUpdatedAt }`.
  - FE sẽ gửi `baseUpdatedAt` khi lưu; nếu nhận 412 → cảnh báo và tải lại tree.

## 7.4 Validate / Test case chấp nhận

- [ ] Save gửi `amount < 0` → 400 với `errors[]` chỉ định đúng `itemId/backup + month`.
- [ ] Hai user cùng sửa: user B gửi `baseUpdatedAt` cũ sau khi user A đã lưu → 412 + `currentUpdatedAt` mới.
- [ ] Không gửi `baseUpdatedAt` → hành vi hiện tại (không chặn, không regression).
- [ ] Swagger `/api/docs-json` hiển thị `errors[]`, `updatedAt`, `baseUpdatedAt`, mã 412.

## 7.5 Checklist cho backend

- [ ] `DO` `PUT values` — trả lỗi theo ô trong `errors[]`.
- [ ] Trả `updatedAt` trong `tree`; nhận + so sánh `baseUpdatedAt` ở `PUT values`.
- [ ] Deploy + verify FE tab Nhập ngân sách (lỗi gắn ô, cảnh báo conflict).
