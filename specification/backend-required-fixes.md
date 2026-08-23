# Yêu cầu Backend — Fix API & Module Kho vật phẩm

> Tổng hợp các việc cần làm phía backend, dựa trên audit toàn bộ API Frontend gọi
> (đối chiếu với OpenAPI thực tế tại `https://mkt-hub.onrender.com/api/docs-json`, ngày 11/08/2026).

## Phần 1 — Fix API đang thiếu (FE gọi → hiện 404)

### 1.1 `PATCH /api/v1/expenses/{id}` — CẬP NHẬT chi phí

Frontend `updateExpense()` gọi `PATCH /v1/expenses/:id` (nút **Sửa** ở "Lịch sử Chi Phí").
Backend hiện chỉ có `DELETE /api/v1/expenses/{id}` → **thiếu method cập nhật**.

**Body (DTO `UpdateExpenseDto`):**

| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `projectId` | UUID | ✅ |
| `month` | Int (1-12) | ✅ |
| `year` | Int | ✅ |
| `directCost` | Decimal | ✅ |
| `directNotes` | String? | ✅ |
| `overheadCost` | Decimal | ✅ |
| `overheadNotes` | String? | ✅ |

> Lưu ý: FE chỉ gửi đúng các field trên (không phải toàn bộ object).

---

## Phần 2 — Module Kho vật phẩm (12 endpoints mới)

### 2.1 Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/inventory` |
| Service file | `FE/services/api.js` — prefix `INVENTORY` |
| Backend prefix | `/api` (NestJS) |
| Auth | JWT Bearer token |
| Soft-delete | ✅ Backend `archivedAt` trên Item và Batch (giống pattern tasks/projects hiện tại) |

### 2.2 Danh sách endpoints

| # | Method | Endpoint | Function FE | Mô tả |
|---|--------|----------|-------------|-------|
| 1 | GET | `/api/v1/inventory/overview` | `getInventoryOverview` | Số liệu tổng quan kho |
| 2 | GET | `/api/v1/inventory/items` | `getInventoryItems` | List vật phẩm + phân trang |
| 3 | GET | `/api/v1/inventory/items/{id}` | `getInventoryItem` | Chi tiết vật phẩm |
| 4 | POST | `/api/v1/inventory/items` | `createInventoryItem` | Tạo vật phẩm mới |
| 5 | PATCH | `/api/v1/inventory/items/{id}` | `updateInventoryItem` | Cập nhật vật phẩm |
| 6 | DELETE | `/api/v1/inventory/items/{id}` | `deleteInventoryItem` | Xoá mềm (`archivedAt`) |
| 7 | GET | `/api/v1/inventory/items/{id}/batches` | `getItemBatches` | List batch của vật phẩm |
| 8 | POST | `/api/v1/inventory/items/{id}/batches` | `createBatch` | Tạo batch cho vật phẩm |
| 9 | PATCH | `/api/v1/inventory/batches/{id}` | `updateBatch` | Cập nhật batch |
| 10 | DELETE | `/api/v1/inventory/batches/{id}` | `deleteBatch` | Xoá mềm batch |
| 11 | POST | `/api/v1/inventory/entries` | `createInventoryEntry` | Phiếu nhập kho (tạo batch + ghi transaction + re-tính item) |
| 12 | GET | `/api/v1/inventory/transactions` | `getInventoryTransactions` | Lịch sử xuất/nhập |

### 2.3 Query params

**GET `/v1/inventory/items`**

| Param | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `search` | String | ❌ | Tìm theo tên hoặc mã vật phẩm (ILIKE) |
| `category` | String | ❌ | `posm`, `gift`, `print` |
| `status` | String | ❌ | `instock`, `low`, `out` |
| `page` | Int | ❌ | Default 1 |
| `limit` | Int | ❌ | Default 10 |

Response:
```json
{
  "data": {
    "items": [...],
    "total": 124,
    "page": 1,
    "limit": 10
  }
}
```

**GET `/v1/inventory/transactions`**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `itemId` | UUID | Lọc theo vật phẩm |
| `batchId` | UUID | Lọc theo batch |
| `type` | String | `in` \| `out` |

### 2.4 Data shape (DTO)

**InventoryItem**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `id` | UUID | — | |
| `code` | String | ✅ | Mã vật phẩm, unique |
| `name` | String | ✅ | Tên vật phẩm |
| `category` | String | ✅ | `posm`, `gift`, `print` |
| `unit` | String | ✅ | Đơn vị tính: `con`, `bộ`, `tờ`, `hộp`… |
| `image` | String? | ❌ | URL ảnh (nullable) |
| `totalStock` | Int | ✅ | Tổng tồn kho — **BE tính từ các batch active** |
| `avgUnitPrice` | Decimal | ✅ | Đơn giá TB — **BE tính** (weighted từ batch) |
| `status` | String | ✅ | `instock` (>0 và > minThreshold), `low` (≤ minThreshold), `out` (0) — **BE tính** |
| `minThreshold` | Int? | ❌ | Ngưỡng "sắp hết hàng" |
| `createdAt` | DateTime | — | |
| `archivedAt` | DateTime? | — | Soft-delete |

**InventoryBatch**

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `id` | UUID | — | |
| `batchCode` | String | ✅ | Mã batch, unique |
| `itemId` | UUID | ✅ | Thuộc vật phẩm nào |
| `receivedDate` | Date | ✅ | Ngày nhập kho |
| `quantityIn` | Int | ✅ | Số lượng nhập |
| `unitPrice` | Decimal | ✅ | Đơn giá lô |
| `supplier` | String? | ❌ | Nhà cung cấp |
| `contractCode` | String? | ❌ | Mã hợp đồng liên quan |
| `currentStock` | Int | ✅ | Tồn hiện tại — **BE giảm khi xuất kho** |
| `status` | String | ✅ | `active` (currentStock > 0), `depleted` (0) — **BE tính** |
| `createdAt` | DateTime | — | |
| `archivedAt` | DateTime? | — | Soft-delete |

**Overview response**
```json
{
  "data": {
    "totalValue": 1250000000,
    "totalValueTrend": 5.2,
    "lowStockCount": 12,
    "incomingCount": 5,
    "incomingNote": "tuần này",
    "activeBatches": 48
  }
}
```

| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `totalValue` | Decimal | Σ(currentStock × unitPrice) các batch active |
| `totalValueTrend` | Decimal | % thay đổi so với tháng trước (dương = tăng) |
| `lowStockCount` | Int | Số vật phẩm status `low` |
| `incomingCount` | Int | Số phiếu nhập đang về |
| `incomingNote` | String | Mô tả thời gian dự kiến |
| `activeBatches` | Int | Số batch đang `active` |

**Entry POST `/v1/inventory/entries`**
```json
{
  "itemId": "uuid",
  "receivedDate": "2026-08-11",
  "batchCode": "BATCH-2026-001",
  "quantity": 1000,
  "unitPrice": 2500,
  "supplier": "In ấn Hoa Mai",
  "contractCode": "HD-012/26",
  "note": ""
}
```

BE xử lý:
1. Tạo/ghi nhận phiếu nhập.
2. Tạo hoặc cập nhật `InventoryBatch` của item (tăng `currentStock`, `quantityIn`).
3. Tạo transaction `type = 'in'`.
4. Re-tính `totalStock`, `avgUnitPrice`, `status` của item.

### 2.5 Nguyên tắc chung

- **Cách tính do backend đảm nhiệm** (FE không gửi): `totalStock`, `avgUnitPrice`, `status` của item; `currentStock`, `status` của batch.
- **Soft-delete:** DELETE item/batch chỉ set `archivedAt`, query mặc định filter `archivedAt: null`.
- **Field naming:** camelCase (thống nhất với module expense: `directCost`, `projectId`...).
- **Response wrapper:** khuyến nghị trả `{ data: ... }` (FE chấp nhận cả `res.data.data` lẫn `res.data`).
- **Date:** `receivedDate` gửi dạng `YYYY-MM-DD`.

---

## Phần 3 — Thông tin thêm (backend CÓ nhưng FE chưa dùng — không bắt buộc)

| Endpoint | Ghi chú |
|----------|---------|
| `GET /api/v1/leads-kpis/analysis` | FE chưa gọi |
| `POST /api/v1/leads-kpis/prior-year-deals` | FE chưa gọi |
| `GET /api/v1/data-management/audit-logs` | FE chưa gọi |
| `GET /api/v1/notifications` | FE hiện poll qua `GET /v1/tasks` — chưa dùng endpoint này |
| `DELETE /api/v1/compare/data` | FE `deleteCompareData` là no-op localStorage |
| `GET /api/auth/members` + `PATCH /api/auth/members/{id}/role` | FE đã chuyển sang `/v1/data-management/members` — **có thể ngừng duy trì** |
| `POST /api/auth/logout` | FE `logout` chỉ clear localStorage, chưa gọi API — backend giữ để sau này revoke token |

---

## Phần 4 — Kiểm tra lại ngày 12/08/2026 (backend đã cập nhật)

Đã verify OpenAPI tại `https://mkt-hub.onrender.com/api/docs-json`:

**✅ Đã đủ:**
- `PATCH /api/v1/expenses/{id}` — có, body `UpdateExpenseDto` khớp FE gửi.
- 12 endpoint inventory — có đủ; query params của `GET /items` (`search`, `category`, `status`, `page`, `limit`) và `GET /transactions` (`itemId`, `batchId`, `type`) khớp FE.
- `CreateInventoryItemDto`/`UpdateInventoryItemDto` (code, name, category, unit, image, minThreshold) và `CreateInventoryEntryDto` (itemId, receivedDate, batchCode, quantity, unitPrice, supplier, contractCode, note) — khớp payload FE gửi.

**⚠️ Còn thiếu / cần bổ sung (để FE hoạt động chắc chắn):**

1. **Khai báo response schema trong OpenAPI** — hiện mọi GET/POST/PATCH inventory trả `responses: { "200"/"201": { "description": "" } }` không có schema → không thể verify shape, FE `ApiDocs` không hiển thị được. Cần khai báo DTO response.

2. **Field names FE mong đợi** (phải trả đúng tên camelCase như sau, nếu lệch tên thì UI lỗi):
   - `InventoryItem`: `id`, `code`, `name`, `category`, `unit`, `image`, `minThreshold`, `totalStock`, `avgUnitPrice`, `status`
   - `InventoryBatch`: `id`, `batchCode`, `itemId`, `receivedDate`, `quantityIn`, `unitPrice`, `supplier`, `contractCode`, `currentStock`, `status`
   - `Transaction` (lịch sử): `id`, `type`, `quantity`, `date` hoặc `createdAt`, `note`
   - `Overview`: `totalValue`, `totalValueTrend`, `lowStockCount`, `incomingCount`, `incomingNote`, `activeBatches`

3. **POST `/v1/inventory/items` phải trả về item kèm `id`** — FE tạo item xong đọc `res.data.id` để gọi tiếp `createInventoryEntry` (tạo item + batch trong 1 lần nhập). Nếu không trả `id`, luồng "Nhập kho mới có số lượng > 0" sẽ fail.

4. **Enum values phải trả đúng ký tự** (FE map sang hiển thị/badge theo đúng key):
   - Item `status`: `instock` | `low` | `out`
   - Batch `status`: `active` | `depleted`
   - Transaction `type`: `in` | `out`

5. **GET `/v1/inventory/items` response shape** — FE đọc `{ data: { items: [...], total, page, limit } }` (hoặc array trực tiếp). Trả đúng một trong 2 dạng.

---

## Phần 5 — Kết quả test thực tế ngày 12/08/2026 (account `test@secret.dev`)

Đã chạy full CRUD + luồng nhập kho trên môi trường production:

### ✅ Đã hoạt động đúng

| Test | Kết quả |
|------|---------|
| `GET /v1/inventory/overview` | 200, đủ field `totalValue/totalValueTrend/lowStockCount/incomingCount/incomingNote/activeBatches` |
| `GET /v1/inventory/items` (+search/category/status/page/limit) | 200, `{data:{items,total,page,limit}}` đúng |
| `POST /v1/inventory/items` | 201, trả item kèm `id`, `totalStock=0`, `status='out'`, `avgUnitPrice='0'` |
| `GET /v1/inventory/items/{id}` | 200, trả kèm `batches` |
| `POST /v1/inventory/entries` | 201, tự tạo batch + transaction `type='in'`, re-tính item `totalStock/status` |
| `POST /v1/inventory/items/{id}/batches` | 201, tạo batch |
| `PATCH /v1/inventory/items/{id}` | 200, cập nhật + re-tính item |
| `PATCH /v1/inventory/batches/{id}` | 200, cập nhật batch + re-tính item |
| `DELETE /v1/inventory/batches/{id}` | 200, soft-delete; item re-tính đúng (`130 → 100`) |
| `DELETE /v1/inventory/items/{id}` | 200, soft-delete; `GET items` filter ra |
| `GET /v1/inventory/transactions` (+itemId/batchId/type) | 200, trả array, filter đúng |
| Trùng `code` item | 400 `"Mã vật phẩm đã tồn tại."` (OK) |
| GET item không tồn tại | 404 `"Không tìm thấy vật phẩm."` (OK) |
| `PATCH /v1/expenses/{id}` | 200, cập nhật đúng (test trên record mới + khôi phục dữ liệu gốc) |

### ❌ Lỗi cần backend sửa — CẢ HAI ĐÃ FIX (verify ngày 12/08/2026, vòng 2)

**BUG 1 — `GET /v1/inventory/items/{id}/batches` trả response shape KHÔNG nhất quán:**
- Trước: item có 1 batch → trả object đơn; ≥2 batch → array.
- **Sau: luôn trả array** ✅ — test item 1 batch → `data.GetType()=Object[]`, count=1.

**BUG 2 — Trùng `batchCode` khi `POST /v1/inventory/items/{id}/batches` → HTTP 500:**
- Trước: `500 Internal server error`.
- **Sau: `409 Conflict` kèm message `"Mã batch đã tồn tại."`** ✅ — test duplicate batchCode → 409.

> Lưu ý: giữa lúc verify vòng 2 có 1 lần trả `404 Không tìm thấy vật phẩm` dù item tồn tại — do backend đang redeploy, hết sau vài giây.

### 🔎 Ghi chú thêm cho FE (không phải lỗi BE)

- `avgUnitPrice` / `unitPrice` trả về **string** (`"5000"`, `"5230.7692307692307692"`) — FE đã `Number()` khi hiển thị nên ổn.
- Test data đã được dọn: xoá hết item/batch test, hoàn trả expense `13b3c640...` về giá trị gốc.

## Phần 6 — Checklist cho backend

- [x] Thêm `PATCH /api/v1/expenses/{id}` (UpdateExpenseDto)
- [x] Tạo controller + service `inventory` với 12 endpoints ở Phần 2
- [x] Bật soft-delete `archivedAt` cho `InventoryItem`, `InventoryBatch`
- [x] Thêm entity `InventoryTransaction` ghi nhận mọi nhập/xuất
- [x] Field names + enum values khớp FE (tested)
- [x] **Fix BUG 1**: `GET /items/{id}/batches` luôn trả array
- [x] **Fix BUG 2**: trùng `batchCode` trả 409 thay vì 500
- [x] Khai báo response DTO cho toàn bộ endpoint inventory trong OpenAPI ✅ *verify 21/08/2026 — cả 12 endpoint + `PATCH /expenses/{id}` đều đã có `$ref` schema*
- [x] Cập nhật OpenAPI (`/api/docs-json`) để FE `ApiDocs` hiển thị ✅ *verify 21/08/2026*

---

# Phần 7 — Yêu cầu mới (21/08/2026): Xuất kho theo dự án & KPI theo tháng

## 7.1 API xuất vật phẩm cho dự án (tự trừ tồn kho) — CHƯA CÓ

Hiện trạng đã verify qua `/api/docs-json` (21/08/2026): inventory chỉ có
`POST /v1/inventory/entries` (**nhập vào**, bắt buộc `receivedDate`, `batchCode`, `unitPrice`)
và `GET /v1/inventory/transactions`. **Không có endpoint tạo giao dịch OUT.**

Yêu cầu BE bổ sung:

```
POST /api/v1/inventory/transactions
Authorization: Bearer JWT

{
  "itemId":    "uuid",     // required
  "projectId": "uuid",     // required — dự án sử dụng
  "type":      "out",      // required, enum: in | out
  "quantity":  10,         // required, > 0
  "date":      "2026-08-21", // optional, default hôm nay
  "note":      "Dùng cho sự kiện X" // optional
}

201 → { data: { id, itemId, projectId, type: "out", quantity, date, note, createdAt } }
400 → số lượng vượt tồn khả dụng / thiếu field
404 → item hoặc project không tồn tại
```

Hành vi bắt buộc:
- Trừ trực tiếp `totalStock` của item (FIFO theo batch nếu có thể), ghi nhận bản ghi `InventoryTransaction`
- `GET /v1/inventory/transactions` đã có sẵn — cần filter theo `itemId` và/hoặc `projectId`

FE sẽ dùng endpoint này cho nút "Xuất cho dự án" trong module Kho vật phẩm.

## 7.2 Nhập KPI thực tế theo THÁNG cho dự án Lead Generation — CHƯA CÓ

Theo yêu cầu nghiệp vụ: project `type = "Lead Generation"` nhập số liệu Raw/MQL/SQL
**theo tháng**; các dự án khác giữ nhập theo tuần.

Hiện tại `POST /v1/leads-kpis/weekly` chỉ nhận `{year, week}`. Yêu cầu một trong hai:

- **Phương án A (khuyến nghị):** cho phép `POST /v1/leads-kpis/weekly` nhận
  `{year, month, projectId, rawLeads, mql, sql}` (khi có `month` thì bỏ qua `week`),
  và `GET /v1/leads-kpis/weekly?year=&month=&projectId=` trả dữ liệu tương ứng.
- **Phương án B:** thêm endpoint riêng `POST|GET /v1/leads-kpis/monthly`.

FE đã gửi sẵn payload `{year, month, ...}` lên `/weekly` (sẽ lỗi 400 cho tới khi BE hỗ trợ).

## 7.3 Báo cáo đếm OPP / Closed Deal tự động từ bảng chi tiết

Thay vì lấy `oppCount`/`closedCount` từ nhập tay weekly, các endpoint báo cáo
(`GET /v1/leads-kpis/analysis`, `/comparison`, **`/v1/dashboard/kpi-cards`,
`/v1/dashboard/funnel`**) cần:

- **OPP** = count bảng `opportunities` theo `createdAt` nằm trong kỳ (week/month/quarter/year)
- **Closed Deal** = count bảng `closed-deals` theo `closedDate` nằm trong kỳ (+ tổng `setupFee` làm doanh thu)

FE đã bỏ 2 ô nhập tay OPP/Closed Deal khỏi Form Thực tế.

## 7.4 Phân khúc khách hàng cho báo cáo Pipeline by Segment — CHƯA CÓ

View "Xem phân tích" có bảng *Giá trị Pipeline theo Phân khúc* (Enterprise /
Mid-Market / SMB) nhưng BE chưa có nguồn dữ liệu. Yêu cầu:

- Thêm trường `segment` (enum: `enterprise` | `mid_market` | `smb`) cho
  Opportunity/ClosedDeal, hoặc endpoint tổng hợp
  `GET /v1/dashboard/pipeline-by-segment?period_type=&period_value=&year=`
  trả `{ segment, openDeals, value, growthPct }[]`.
- FE hiện đang hiển thị empty-state cho tới khi có API.

## Phần 7 — Checklist cho backend

- [ ] Thêm `POST /api/v1/inventory/transactions` (type=out, trừ tồn kho, validate available)
- [ ] Filter `itemId`/`projectId` cho `GET /api/v1/inventory/transactions`
- [ ] Hỗ trợ nhập KPI theo tháng (Phương án A hoặc B ở mục 7.2)
- [ ] `analysis`/`comparison`/`kpi-cards`/`funnel` tự đếm OPP (theo `createdAt`) và Closed Deal (theo `closedDate`) từ bảng chi tiết
- [ ] Trường `segment` cho Deal hoặc endpoint `/dashboard/pipeline-by-segment` (mục 7.4)
