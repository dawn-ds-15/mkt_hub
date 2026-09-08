# Yêu cầu fix Backend — Bản v2 — Ngày 06/09/2026

> Phiên bản 2 (bản fix). Bổ sung/chỉnh sửa trên `BE-yeu-cau-6-9-26.md` sau khi BE đã triển khai
> các endpoint Expense mới (`annual-plans`, `expense-plan`, `actuals`, `overview/tree/*`) vào ngày 06/09/2026.
>
> Nguồn: audit OpenAPI `/api/docs-json` + đối chiếu yêu cầu v1. **Ưu tiên các mục F1 → F9**; các mục khác
> đã đúng theo v1 thì giữ nguyên.
>
> Trạng thái: FE đã tích hợp (wrapper `api.js` + component Annual Plan). Một số mục dưới đây BLOCK FE hoàn thiện
> các flow 3/4/5/6.

---

## Mục lục

- [F1. Route trùng (duplicate/alias)](#f1-route-trùng)
- [F2. Thống nhất HTTP verb cho confirm/cancel](#f2-thống-nhất-http-verb)
- [F3. Khai báo response schema cho toàn bộ endpoint mới](#f3-response-schema)
- [F4. Bổ sung error codes (`ERR_*`)](#f4-error-codes)
- [F5. Bổ sung block `permissions`](#f5-permissions)
- [F6. Fix kiểu `recognizedDate` trong OpenAPI](#f6-recognizeddate-type)
- [F7. Làm rõ update record vs update line](#f7-update-record-vs-line)
- [F8. Cam kết ngữ nghĩa "chi phí thực tế" (chỉ đếm CONFIRMED)](#f8-ngữ-nghĩa-actual)
- [F9. Thống nhất wrapper phân trang `actuals`](#f9-pagination)
- [Sơ đồ route canonical đề xuất](#sơ-đồ-route-canonical-sau-fix)
- [Test case bổ sung](#test-case-bổ-sung)
- [Cam kết phía FE](#cam-kết-phía-fe)

---

# F1. Route trùng ✅ Đã fix

## Cập nhật trạng thái kiểm tra 06/09/2026 (tối)

- ✅ **F1** — Route trùng đã gỡ: chỉ còn canonical `/v1/expenses/lines/{id}/confirm|cancel` và `/v1/annual-plans*`; không còn `opId[0]/[1]`.
- ✅ **F2** — confirm đã đổi sang **POST** (cùng cancel). FE đã cập nhật lại wrapper (POST).
- ✅ **F3** — Đã khai báo response DTO cho gần hết endpoints (`AnnualPlanList/Single/TreeResponseDto`, `ExpenseActualsPaginationResponseDto`, `ExpenseLineActionResponseDto`, `AnnualOverviewTreeResponseDto`, `ProjectOverviewTreeResponseDto`, `ProjectExpensePlanResponseDto`). Còn lẻ: `PATCH /expenses/lines/{id}` response 200 chưa có schema ref.
- ⚠️ **F4** — Error codes `ERR_*` **chưa** xuất hiện trong OpenAPI (chưa làm).
- ✅ **F5** — Trả `ExpensePermissionsDto {view, createDraft, confirm, cancel, managePlans}` ở các wrapper.
- ✅ **F6** — `recognizedDate` = `string(date)` trong `ExpenseLineDto`/`ExpenseActualDto`.
- ✅ **F7** — Có `PATCH /v1/expenses/lines/{id}` với `UpdateExpenseLineDto` đầy đủ.
- ⚠️ **F8** — Chưa xác nhận được ngữ nghĩa đếm CONFIRMED (cần live probe).
- ✅ **F9** — `ExpenseActualsPaginationResponseDto {items, data, total, page, perPage, totalPages, hasMore}`.
- Thêm: `ActivateAnnualPlanDto {confirmReplace}` — FE wrapper `activateAnnualPlan` đã gửi `{confirmReplace:true}`.
- Ghi chú: `AnnualOverviewTreeResponseDto.data` và cây annual vẫn khai báo `type: object` (không `$ref`) — cần BE ref DTO chi tiết hơn nếu muốn docs đầy đủ.

**Hiện trạng (thấy trong `/api/docs-json`):**

| Route | Ghi chú |
|---|---|
| `/api/v1/expenses/{id}/confirm` (PATCH) | `opId=ExpenseController_confirmExpenseLine[0]` — trùng với dưới |
| `/api/v1/expenses/lines/{id}/confirm` (PATCH) | `opId=ExpenseController_confirmExpenseLine[1]` |
| `/api/v1/expenses/{id}/cancel` (POST) | `opId=ExpenseController_cancelExpenseLine[0]` — trùng với dưới |
| `/api/v1/expenses/lines/{id}/cancel` (POST) | `opId=ExpenseController_cancelExpenseLine[1]` |
| `/api/annual-plans` (GET/POST) | `opId=AnnualPlansController_getAnnualPlans[0]` — trùng với dưới |
| `/api/v1/annual-plans` (GET/POST) | `opId=AnnualPlansController_getAnnualPlans[1]` |

Ở cả 2 cặp confirm/cancel, `{id}` đều là **line id** (cùng logic controller). Tên `expenses/{id}/...` gây hiểu
nhầm là record id.

**Yêu cầu:**
1. Giữ **một route canonical duy nhất**:
   - `POST /v1/expenses/lines/{id}/confirm`
   - `POST /v1/expenses/lines/{id}/cancel`
   - `GET/POST /v1/annual-plans` (+ các route con)
2. Vô hiệu / xóa các route alias còn lại (`/expenses/{id}/confirm|cancel`, `/api/annual-plans` không `v1`).
3. Nếu ý định của `expenses/{id}/confirm` là **"xác nhận toàn bộ record"** (tất cả line draft của record đó),
   thì triển khai đúng record-level riêng, kèm response `{ confirmedCount, expenseId }` — và báo lại để FE map.
4. Kiểm tra không còn `opId[0]`/`opId[1]` (suffix trùng) trong `/api/docs-json`.

---

# F2. Thống nhất HTTP verb ✅ Đã fix

**Hiện trạng:** confirm = **PATCH**, cancel = **POST**.

**Yêu cầu:** cả confirm và cancel thống nhất dùng **POST** (endpoints mang ý nghĩa hành động/transition,
giống `activate`). FE sẽ cập nhật wrapper tương ứng sau khi BE deploy.

---

# F3. Response schema ✅ Đã fix (còn lẻ nhỏ nhặt)

**Hiện trạng:** các endpoint mới trong OpenAPI không khai báo `response` schema (200/201 description rỗng,
không `$ref`) → FE/documents/client-generated không biết shape trả về.

**Yêu cầu:** khai báo `@ApiOkResponse(...)`/`@ApiCreatedResponse(...)` với DTO rõ ràng cho:

| Endpoint | DTO response đề xuất |
|---|---|
| `GET /v1/annual-plans?year` | `{ data: AnnualPlanDto[] }` |
| `POST /v1/annual-plans` | `{ data: AnnualPlanDto }` |
| `GET /v1/annual-plans/active?year` | `{ data: AnnualPlanDto }` (404 nếu chưa có) |
| `POST /v1/annual-plans/{id}/activate` | `{ data: AnnualPlanDto }` (kèm `archivedPlanId`/`replacedByVersion` nếu có bản thay thế) |
| `GET /v1/annual-plans/{id}/tree` | `{ data: AnnualPlanTreeDto }` (node có `totalAmount`, `children`) |
| `PUT /v1/annual-plans/{id}/items` | `{ data: AnnualPlanTreeDto }` (cây mới sau khi tái tổng hợp) |
| `POST /v1/annual-plans/{id}/nodes` | `{ data: AnnualPlanItemNodeDto }` (node vừa tạo) |
| `GET /v1/projects/{projectId}/expense-plan` | `{ data: ProjectExpensePlanDto }` |
| `PUT /v1/projects/{projectId}/expense-plan` | `{ data: ProjectExpensePlanDto }` |
| `GET /v1/expenses/actuals` | `{ data: ExpenseActualDto[], total, page, perPage }` (xem F9) |
| `GET /v1/expenses/actuals/{id}` | `{ data: ExpenseActualDetailDto }` |
| `POST /v1/expenses/lines/{id}/confirm` | `{ data: ExpenseLineDto }` (line mới `status: confirmed`) |
| `POST /v1/expenses/lines/{id}/cancel` | `{ data: ExpenseLineDto }` (line mới `status: cancelled`) |
| `GET /v1/expenses/overview/tree/annual?year` | `{ data: AnnualOverviewTreeDto }` |
| `GET /v1/expenses/overview/tree/project?projectId&year` | `{ data: ProjectOverviewTreeDto }` |

`ExpenseActualDto` tối thiểu: `id, projectId, projectName, status, recognizedDate, isUnplanned,
projectExpenseItemId, projectExpenseItemName, annualExpenseItemId, annualPath (mức L1/L2/L3), directCost,
overhead, supplierName, receiptUrl, createdAt, lines: ExpenseLineDto[]`.

---

# F4. Error codes ⚠️ Chưa làm

**Hiện trạng:** không có mã `ERR_*` nào được ghi trong OpenAPI; FE phải đoán lỗi.

**Yêu cầu:** thống nhất primary format `{ code, message, params?, errors? }` (như budget `BE-yeu-cau-1-9-26.md` mục 7)
và **document tại mỗi endpoint**:

| Mã | Điều kiện | HTTP |
|---|---|---|
| `ERR_ANNUAL_PLAN_NOT_ACTIVE` | Confirm actual khi năm chưa có Annual Plan active | 422 |
| `ERR_ANNUAL_PLAN_ALREADY_ACTIVE` | Activate 1 bản khi đã có bản active cùng năm mà không xác nhận thay thế | 409 |
| `ERR_NOT_DRAFT` | Sửa items / nodes của bản active hoặc archived | 403 |
| `ERR_NODE_LEVEL_INVALID` | `POST /nodes` level không phải 1..3 hoặc amount nhập ở L1/L2 | 422 |
| `ERR_ITEM_NOT_FOUND` | `itemId` không thuộc plan (bản `/{id}/items`, `/{id}/nodes`) | 404 |
| `ERR_LINE_ALREADY_CONFIRMED` | Confirm line đã confirmed | 409 |
| `ERR_LINE_ALREADY_CANCELLED` | Confirm hoặc cancel line đã cancelled | 409 |
| `ERR_LINE_NOT_CONFIRMED` | Cancel line chưa confirmed (chỉ được cancel confirmed) | 422 |
| `ERR_UNPLANNED_REQUIRES_NAME` | `isUnplanned=true` mà thiếu `unplannedItemName` | 422 |
| `ERR_PROJECT_EXPENSE_ITEM_NOT_FOUND` | `projectExpenseItemId` không tồn tại / thuộc dự án khác | 422 |
| `ERR_ANNUAL_EXPENSE_ITEM_NOT_FOUND` | `annualExpenseItemId` không tồn tại (không phải level 3 / khác plan) | 422 |
| `ERR_RECOGNIZED_AFTER_CANCELLED` | Ghi actual cho dự án `cancelled` với `recognizedDate > cancelledAt` | 422 |
| `ERR_BUDGET_AMOUNT_NEGATIVE` | Nhập amount < 0 | 422 |
| `ERR_PLAN_STATUS_CHANGE_DENIED` | Header `If-Match` (version) của plan không khớp khi activate | 409 |

Kèm `errors[]` per-field khi có thể (như v1 yêu cầu).

---

# F5. Permissions ✅ Đã fix

**Hiện trạng:** block `permissions` chỉ có trên các endpoint **budget cũ** (`BudgetPermissionsDto`); các endpoint
Expense mới không trả.

**Yêu cầu:** trả block `permissions` `{ view, createDraft, confirm, cancel, managePlans }` (theo matrix v1 mục 7)
tối thiểu trên:
- `GET/POST /v1/annual-plans`, `POST /v1/annual-plans/{id}/activate`
- `GET /v1/expenses/actuals`, `POST /v1/expenses`
- `POST /v1/expenses/lines/{id}/confirm`, `POST /v1/expenses/lines/{id}/cancel`

Không cấu hình → mặc định `true` (không regression).

---

# F6. recognizedDate type ✅ Đã fix

**Hiện trạng:** `recognizedDate` trong `ExpenseLineDto` / `ExpenseRecordDto` khai báo `type: object`
(OpenAPI hiển thị dạng object thay vì string).

**Yêu cầu:** đổi thành `type: string` (`format: date`, ví dụ `"2026-09-06"`).

---

# F7. Update record vs update line ✅ Đã fix (có PATCH /lines/{id})

**Hiện trạng:** `PATCH /v1/expenses/{id}` chỉ nhận `UpdateExpenseDto` (không có `recognizedDate`,
`isUnplanned`, `annualExpenseItemId`, `projectExpenseItemId`, `supplierName`, `receiptUrl`) — không sửa được
các field mới của draft.

**Yêu cầu:**
1. Xác nhận `UpdateExpenseLineDto` đủ các field để FE sửa draft (bảng):
   `amount`, `description` / `name`, `realQty`, `unitPrice`, `inventoryItemId`, `expenseCategory`,
   `recognizedDate`, `isUnplanned`, `unplannedItemName`, `projectExpenseItemId`, `annualExpenseItemId`,
   `supplierName`, `receiptUrl`.
2. Document rõ: **sửa field của draft qua từng line** (`PATCH /v1/expenses/lines/{id}`, hoặc endpoint tương đương)
   — `PATCH /expenses/{id}` chỉ dùng cho thay đổi cấp record (vd. `supplierName`, `receiptUrl` cấp record nếu có).
3. Nếu chưa có `PATCH /v1/expenses/lines/{id}` thì bổ sung; mọi thay đổi khi `status=confirmed` phải bị chặn,
   trừ đi qua luồng confirm/cancel.

---

# F8. Ngữ nghĩa actual ⚠️ Chưa xác nhận (cần live probe)

**Hiện trạng / mơ hồ:** status nằm ở từng **line**; bản ghi (project+month) không có status. Chưa rõ phía
tổng hợp (`overview/tree/annual`, `overview/tree/project`, `GET /actuals` với filter `status`) đếm theo dòng
nào.

**Yêu cầu cam kết (BE chốt + ghi vào docs):**
- `annual.actual` và `project.actual` trong `overview/tree/*` = Σ line **`confirmed`** (bỏ draft, bỏ cancelled).
- `GET /expenses/actuals` filter `status` áp dụng lên **line**; nếu trả theo record thì document rõ cách gộp
  (vd. record có ≥1 confirmed line thì tính, có line cancelled thì hiển thị cả).
- DRAFT hiển thị tách riêng nhãn "dự kiến", không cộng vào chi phí thực tế.
- `variance` giữ nguyên công thức plan − actual (không clamp âm).

---

# F8bis. Attribution trong cây overview vs expense-plan ⚠️ Vấn đề mở (BA/BE chốt — không chặn FE)

**Hiện trạng (đo ngày 06-09-2026, env Render, dự án HaiDang `a7c3efe0-a415-41d8-bfad-53e004e0ad7a`):**
- `GET /projects/{id}/expense-plan` → `totalActual=5.555.550` = Σ **mọi line `confirmed`** của project (kể cả line
  không map `annualExpenseItemId`/`projectExpenseItemId` — line cũ "ba test" có annual=null, project item=null).
- `GET /expenses/overview/tree/annual?year=2026` → mọi node `actual=0`: line confirmed không map
  `annualExpenseItemId` **không được tính vào cây**, ngay cả khi thuộc project có confirmed.
- `GET /expenses/overview/tree/project?year=2026` → **HTTP 500** (dữ liệu HaiDang có line confirmed
  `projectExpenseItemId=null` → group key null → BE crash cả endpoint).

**Gốc rễ:** `expense-plan.totalActual` đếm theo project (không cần mapping), cây overview chỉ đếm line đã gắn mục
→ khác nguồn actual cho cùng dữ liệu; line legacy/unplanned chưa gán mục bị rơi khỏi cây.

**Hướng chốt (chưa chọn):**
- **A.** Cây đếm Σ line `confirmed` của project, trái ra mục "Chưa phân bổ" khi null mapping → tổng cây = `expense-plan.totalActual`.
- **B.** Chặn confirm/create/patch khi thiếu mapping + backfill dữ liệu cũ ("ba test", …) → dữ liệu sạch.
- **C.** Giữ nguyên; cây chỉ hiện phần đã phân bổ, thêm dòng "Chênh lệch (chưa phân bổ)" để khớp tổng.

**Bắt buộc dù chọn hướng nào:** sửa crash HTTP 500 của `overview/tree/project` khi group key `projectExpenseItemId`/`annualExpenseItemId` là null.

---

# F9. Pagination ✅ Đã fix

**Hiện trạng:** `GET /v1/expenses/actuals` có `page`/`perPage` nhưng wrapper response không document.

**Yêu cầu:** thống nhất wrapper:
```json
{ "data": [...], "total": 123, "page": 1, "perPage": 20, "hasMore": true }
```
(dùng chung contract với các list khác của hệ thống; `hasMore` có thể suy từ `total` nếu BE không muốn thêm).

---

# F10. Kích hoạt lại bản `archived` ⚠️ Yêu cầu thay đổi (đang chờ BE deploy)

**Hiện trạng (đo 06-09-2026):** `POST /annual-plans/{id}/activate` với plan `status=archived` → **409
`ERR_PLAN_NOT_DRAFT`** ("Chỉ kế hoạch ở trạng thái Draft mới có thể kích hoạt."). Nghiệp vụ muốn được **chuyển
bản "Đã thay thế" quay lại làm bản Active** của năm (ví dụ: kích hoạt nhầm bản thử nghiệm, cần quay về bản chính thức).

**Yêu cầu BE:**
- Cho phép `activate` khi `status ∈ {draft, archived}` (vẫn chặn `active`→`active` no-op hoặc batch lạ).
- Hành vi khi activate bản `archived` (kèm `confirmReplace:true` như FE hiện tại gửi):
  - Bản này → `active`, cập nhật `activatedAt` (hoặc giữ lần activate gần nhất — BE chốt, FE không phụ thuộc).
  - Bản `active` hiện tại của cùng năm → `archived`, `replacedByVersion = version bản vừa active`.
  - Giữ nguyên danh tính bản (id, version, tree, items) — KHÔNG tạo version mới; không cần nhân bản.
- Quy tắc cũ "chỉnh sửa items/nodes của bản active/archived bị chặn (ERR_NOT_DRAFT, 403)" **giữ nguyên** — chỉ mở rộng riêng hành động `activate`.
- Cập nhật docs: error table bỏ điều kiện "archived" khỏi `ERR_PLAN_NOT_DRAFT` hoặc thêm mô tả "trừ khi `confirmReplace` + status archived" (BE tự chọn cách diễn đạt cho khớp code).

**FE đã sẵn sàng:** tab "Kế hoạch chi phí năm" đã hiển thị nút **"Kích hoạt lại"** cho hàng `archived`
(`AnnualPlanManagement.jsx`, gọi đúng `activateAnnualPlan(id, {confirmReplace:true})`); toast sẽ hiện message
của BE khi chưa deploy. Không cần thay đổi wrapper.

---

# Sơ đồ route canonical (sau fix)

**Annual plan**
- `GET /v1/annual-plans?year=`
- `POST /v1/annual-plans` body `{year, name, template?{fromPlanId, cloneTree}}`
- `GET /v1/annual-plans/active?year=`
- `POST /v1/annual-plans/{id}/activate`
- `GET /v1/annual-plans/{id}/tree`
- `PUT /v1/annual-plans/{id}/items` body `{year?, items[{itemId, amount}]}`
- `POST /v1/annual-plans/{id}/nodes` body `{level, parentId?, name, amount?, sortOrder?}`

**Project plan**
- `GET /v1/projects/{projectId}/expense-plan`
- `PUT /v1/projects/{projectId}/expense-plan` body `SaveProjectExpensePlanDto`

**Actuals**
- `GET /v1/expenses/actuals` (filters: `status, projectId, year, month, recognizedDateFrom, recognizedDateTo,
  isUnplanned, projectExpenseItemId, annualExpenseItemId, page, perPage`)
- `GET /v1/expenses/actuals/{id}`

**Lines (workflow)**
- `POST /v1/expenses/lines/{id}/confirm`
- `POST /v1/expenses/lines/{id}/cancel` body `{ reason }` (bắt buộc)
- `PATCH /v1/expenses/lines/{id}` (sửa draft — bổ sung nếu chưa có)

**Drill-down**
- `GET /v1/expenses/overview/tree/annual?year=`
- `GET /v1/expenses/overview/tree/project?projectId=&year=`

---

# Test case bổ sung

- [ ] Swagger `/api/docs-json`: không còn `opId[0]/[1]`, không còn route alias (F1); response schema đầy đủ (F3);
      `recognizedDate` là `string` (F6).
- [ ] `confirm` line draft → 200 + line `status=confirmed`; confirm lại → `ERR_LINE_ALREADY_CONFIRMED` (409).
- [ ] `cancel` line confirmed (có reason) → 201 + line `status=cancelled`; cancel không reason → 400;
      cancel line draft → `ERR_LINE_NOT_CONFIRMED`; cancel line đã cancelled → `ERR_LINE_ALREADY_CANCELLED`.
- [ ] `POST /expenses` `action=confirm` khi chưa có Annual Plan active → `ERR_ANNUAL_PLAN_NOT_ACTIVE`;
      thiếu `annualExpenseItemId`/`recognizedDate` → 422 per-field.
- [ ] `POST /expenses` `isUnplanned=true` kèm `projectExpenseItemId` → `ERR_UNPLANNED_REQUIRES_NAME` / 422.
- [ ] Ghi actual cho dự án cancelled, `recognizedDate > cancelledAt` → `ERR_RECOGNIZED_AFTER_CANCELLED`.
- [ ] Activate bản thứ 2 cùng năm (bản 1 đang active) → 409 trừ khi body xác nhận thay thế; sau khi thay thế
      bản 1 thành `archived` + `replacedByVersion` đúng; `GET active` trả 1 bản.
- [ ] Nhập `amount` cho node level 1/2 qua `POST /nodes` → `ERR_NODE_LEVEL_INVALID` (422).
- [ ] Sửa `PUT /items` hoặc `POST /nodes` trên bản `active` → `ERR_NOT_DRAFT` (403).
- [ ] `overview/tree/annual` & `/project`: `actual` chỉ đếm line `confirmed`; sau khi confirm 2 line 10tr + huỷ
      1 line 3tr thì `actual` = 20tr (không phải 17tr).
- [ ] `GET /expenses/actuals?status=draft` trả đúng set; `total/page/perPage/hasMore` khớp.
- [ ] `PATCH /v1/expenses/lines/{id}` sửa được `recognizedDate` của draft; chặn khi line `confirmed`.

---

# Cam kết phía FE

- Wrapper `confirmExpenseLine` FE đang dùng **POST** (khớp fix F2 đã deploy). Flow 6 chạy được ngay.
- FE parse phòng thủ theo shape đã xác nhận ở phần "Kết quả probe thật" bên dưới.

---

# Kết quả probe thật 06/09/2026 (test account `a.nguyen@company.com`)

## F4 — Error codes: KHÔNG phải bug runtime ✅ (chỉ thiếu docs)

- `PUT /annual-plans/{id}/items` và `POST /annual-plans/{id}/nodes` trên bản `active` →
  `403 {"code":"ERR_NOT_DRAFT","message":"Chỉ được chỉnh sửa khi kế hoạch ở trạng thái Draft."}`.
- `POST /expenses/lines/{id}/confirm` line đã confirmed → `409 {"code":"ERR_LINE_ALREADY_CONFIRMED",...}`.
- `POST /expenses/lines/{id}/cancel` thiếu `reason` → `400 {"message":["reason should not be empty",...],
  "error":"Bad Request","statusCode":400}` (NestJS ValidationPipe — khác format BusinessException).
- KL: pool `{code,message}` hoạt động. **Chỉ chưa được annotate vào OpenAPI** — BE tự quyết có cần thêm docs hay không; không cần đổi code. Lưu ý với FE: error validation (400) có shape NestJS `{message[], error, statusCode}`, error nghiệp vụ có shape `{code, message}`.

## F8 — Chỉ đếm CONFIRMED: KHÔNG phải bug ✅ (đã kiểm chứng end-to-end)

Chuỗi test trên project "HaiDang" 9/2026, line map vào annual L3 "Facebook Ads":
1. Tạo `POST /expenses` `action=draft`, line `totalAmount=12.345` → `GET overview/tree/annual`: FB Ads `actual=0` (draft loại).
2. `PATCH /expenses/lines/{id}` `{actualUnitPrice:12345, quantity:1}` → line recompute `totalAmount=12345` (F7 OK).
3. `POST /expenses/lines/{id}/confirm` → `status=confirmed`, `confirmedAt` set.
4. `POST /expenses/lines/{id}/cancel` `{reason}` → `status=cancelled`, `cancelledAt` set.
5. `GET /projects/{id}/expense-plan` → `totalActual=5.555.550` = Σ confirmed (đã loại line cancelled 12.345). ✅

## ⚠️ Phát hiện mới cần BE quyết (nghi ngờ bug số liệu drill-down)

- `GET /expenses/overview/tree/project?projectId=HaiDang` trả `totalActual=0`, `nodes=[]` trong khi
  `GET /projects/{id}/expense-plan` trả `totalActual=5.555.550` (project có line confirmed nhưng
  `projectExpenseItemId=null` — không map item). ⇒ **Project tree chỉ tổng hợp line có `projectExpenseItemId`**,
  tổng top-level `totalActual` lệch với thực tế chi khi có line không map.
  Cần BE chốt 1 trong 2: (a) `totalActual` top-level = Σ confirmed toàn project (khớp expense-plan),
  hoặc (b) chỉ tính line map item — và ghi rõ để FE hiển thị đúng.
- `view/tree/annual` tương tự: chỉ đếm line có `annualExpenseItemId`; line confirmed legacy (map null)
  không xuất hiện (actual=0 tại các node) dù system có chi. Đúng theo thiết kế map nhưng nên note trên UI
  ("số liệu chưa gồm chi chưa map ngân sách năm").

## 📌 Shape thật (FE đã căn chỉnh)

- `GET /expenses/actuals` → `{items: ExpenseActualDto[], total, page, perPage, totalPages, hasMore, permissions}` — **key `items`** (không phải `data`). FE wrapper đã đổi đọc `items`.
- `GET /expenses/actuals/{id}` → `{data: ExpenseActualDto}` (line + projectInfo).
- `POST /expenses` → trả record `ExpenseRecordDto` + biến `data`, `permissions`; line mới trong `lines[]` mang `status`.
- `POST /expenses/lines/{id}/confirm|cancel` và `PATCH /expenses/lines/{id}` → trả **bare `ExpenseLineDto`** (không bọc `{data}`) — wrapper FE dùng fallback `res.data?.data ?? res.data`.
- Filters `GET /expenses/actuals?projectId=` hoạt động.
- ⚠️ `POST /expenses` là **upsert theo (projectId, month, year)**: gửi thêm line cho record cùng tháng-dự án sẽ append vào bản ghi cũ (đã kiểm chứng — line probe gắn vào record 9/2026 HaiDang). FE cần cẩn thận khi "tạo mới" trùng tháng/dự án.
- Dữ liệu legacy: line `status=confirmed` nhưng `confirmedAt/confirmedBy=null` (tạo trước khi có field) — không phải bug code mới.