# Yêu cầu Backend — Khai báo Response DTO / OpenAPI cho module Inventory

> ✅ **ĐÃ HOÀN THÀNH (verify 21/08/2026):** cả 12 endpoint inventory + `PATCH /v1/expenses/{id}`
> đều đã khai báo `$ref` response schema trong `https://mkt-hub.onrender.com/api/docs-json`
> (vd: `InventoryItemListResponseDto`, `ExpenseRecordDto`). Tài liệu này giữ lại làm tham khảo.

> Công việc còn lại duy nhất trong `specification/backend-required-fixes.md` (Phần 6, 2 mục chưa check).
> Backend: NestJS (Swagger via `@nestjs/swagger`). Verify tại `https://mkt-hub.onrender.com/api/docs-json`.

---

## 1. Vấn đề hiện tại

- Mọi endpoint `/api/v1/inventory/**` trả `responses: { "200"/"201": { "description": "" } }` — **không có `schema`**.
- Hệ quả:
  - Trang FE `ApiDocs` (route `/api-docs`, dùng `swagger-ui-react` đọc `swagger-ui-init.js`) không hiển thị response shape cho inventory.
  - Không thể verify shape từ OpenAPI — FE phải hard-code field mapping trong `FE/services/api.js`.
- Mục tiêu: **toàn bộ endpoint inventory phải khai báo đầy đủ response DTO + schema trong OpenAPI**, đúng tên field camelCase + enum value mà FE đang mong đợi (liệt kê ở Phần 3).

---

## 2. Cách fix (NestJS)

1. **Tạo response DTO** cho các entity: `InventoryItemResponseDto`, `InventoryBatchResponseDto`, `InventoryTransactionResponseDto`, `InventoryOverviewResponseDto`, `InventoryItemListResponseDto`, `InventoryBatchListResponseDto`, `InventoryTransactionListResponseDto`.
   - Dùng `@nestjs/swagger`: `@ApiProperty()`, `@ApiPropertyOptional()`, enum `@ApiProperty({ enum: [...] })`.
2. **Gắn DTO vào controller** với decorator:
   - `@ApiOkResponse({ type: XxxResponseDto })` cho GET trả 200.
   - `@ApiCreatedResponse({ type: XxxResponseDto })` cho POST trả 201.
   - Nếu response bọc trong `{ data: ... }`, đặt `type` là DTO wrapper có field `data` đúng kiểu.
3. Khai báo **query params** cho các GET (dùng `@ApiQuery` hoặc `@ApiOperation` mô tả) — nhất là `GET /items` (`search`, `category`, `status`, `page`, `limit`) và `GET /transactions` (`itemId`, `batchId`, `type`).
4. Ensure `SwaggerModule.setup` đã bật (`swagger-ui-init.js` hiện có chạy — chỉ cần thêm DTO).
5. **Deploy lên Render** rồi verify (Phần 5).

---

## 3. Data shape CHÍNH XÁC FE đang mong đợi (bắt buộc trả đúng tên + enum)

> Nếu lệch tên field hoặc enum value, UI `FE/pages/InventoryManagement` và `FE/services/api.js` sẽ lỗi.

### 3.1 `InventoryItem`

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `id` | string (UUID) | ✅ | |
| `code` | string | ✅ | Mã vật phẩm, unique |
| `name` | string | ✅ | Tên vật phẩm |
| `category` | string | ✅ | Enum: `posm` \| `gift` \| `print` |
| `unit` | string | ✅ | `con`, `bộ`, `tờ`, `hộp`… |
| `image` | string? | ❌ | nullable |
| `minThreshold` | number? | ❌ | Ngưỡng sắp hết hàng |
| `totalStock` | number | ✅ | **BE tính** từ các batch active |
| `avgUnitPrice` | number/string | ✅ | **BE tính** (weighted). Lưu ý: BE có thể trả string — FE đã `Number()` nên ổn |
| `status` | string | ✅ | Enum: `instock` \| `low` \| `out` — **BE tính** |
| `createdAt` | string (ISO date-time) | — | |
| `archivedAt` | string? (ISO) | — | Soft-delete |

### 3.2 `InventoryBatch`

| Field | Kiểu | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `id` | string (UUID) | ✅ | |
| `batchCode` | string | ✅ | Mã batch, unique |
| `itemId` | string (UUID) | ✅ | |
| `receivedDate` | string (date `YYYY-MM-DD`) | ✅ | |
| `quantityIn` | number | ✅ | |
| `unitPrice` | number/string | ✅ | |
| `supplier` | string? | ❌ | |
| `contractCode` | string? | ❌ | |
| `currentStock` | number | ✅ | **BE tính** (giảm khi xuất kho) |
| `status` | string | ✅ | Enum: `active` \| `depleted` — **BE tính** |
| `createdAt` | string (ISO date-time) | — | |
| `archivedAt` | string? (ISO) | — | Soft-delete |

### 3.3 `InventoryTransaction` (lịch sử xuất/nhập)

| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `id` | string (UUID) | |
| `itemId` | string (UUID) | Nên có để FE lọc |
| `batchId` | string (UUID) | Nên có để FE lọc |
| `type` | string | Enum: `in` \| `out` |
| `quantity` | number | |
| `date` hoặc `createdAt` | string (ISO) | FE chấp nhận cả 2 |
| `note` | string? | |

### 3.4 `InventoryOverviewResponse`

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
| `totalValue` | number | Σ(currentStock × unitPrice) batch active |
| `totalValueTrend` | number | % thay đổi so tháng trước |
| `lowStockCount` | number | Số item status `low` |
| `incomingCount` | number | Phiếu nhập đang về |
| `incomingNote` | string | |
| `activeBatches` | number | |

### 3.5 Response wrapper + list pagination

- FE chấp nhận cả `res.data.data` lẫn `res.data` — **khuyến nghị trả `{ data: ... }`**.
- `GET /items` phải trả đúng một trong 2 dạng:

```json
// Dạng 1 (khuyến nghị) — object paginated
{ "data": { "items": [...], "total": 124, "page": 1, "limit": 10 } }

// Dạng 2 — array trực tiếp
[ ... ]
```

---

## 4. Danh sách endpoint cần khai báo response DTO

| # | Method | Endpoint | Response code | DTO cần khai báo |
|---|--------|----------|---------------|-------------------|
| 1 | GET | `/v1/inventory/overview` | 200 | `InventoryOverviewResponseDto` |
| 2 | GET | `/v1/inventory/items` | 200 | `InventoryItemListResponseDto` (`{ data: { items, total, page, limit } }`) + `@ApiQuery` cho `search/category/status/page/limit` |
| 3 | GET | `/v1/inventory/items/{id}` | 200 / 404 | `InventoryItemResponseDto` (kèm `batches`) |
| 4 | POST | `/v1/inventory/items` | 201 | `InventoryItemResponseDto` — **phải trả item kèm `id`** (FE đọc `res.data.id` để gọi tiếp `createInventoryEntry`) |
| 5 | PATCH | `/v1/inventory/items/{id}` | 200 | `InventoryItemResponseDto` |
| 6 | DELETE | `/v1/inventory/items/{id}` | 200 | xoá mềm — trả 200 + message hoặc DTO đơn giản |
| 7 | GET | `/v1/inventory/items/{id}/batches` | 200 | `InventoryBatchListResponseDto` — **luôn trả array** (đã fix BUG 1, giữ nguyên) |
| 8 | POST | `/v1/inventory/items/{id}/batches` | 201 / 409 | `InventoryBatchResponseDto` |
| 9 | PATCH | `/v1/inventory/batches/{id}` | 200 | `InventoryBatchResponseDto` |
| 10 | DELETE | `/v1/inventory/batches/{id}` | 200 | xoá mềm |
| 11 | POST | `/v1/inventory/entries` | 201 | `InventoryBatchResponseDto` hoặc `{ data: { batch, transaction, item } }` |
| 12 | GET | `/v1/inventory/transactions` | 200 | `InventoryTransactionListResponseDto` + `@ApiQuery` cho `itemId/batchId/type` |

**Kèm theo:** `PATCH /v1/expenses/{id}` (đã có từ lần trước) — nếu chưa khai báo response DTO thì bổ sung luôn để trang ApiDocs hiển thị nhất quán.

---

## 5. Verification (sau khi deploy)

1. `GET https://mkt-hub.onrender.com/api/docs-json` → tìm path `/inventory` → kiểm tra mọi response đã có `content.schema` + `$ref` trỏ tới DTO.
2. Mở FE `/api-docs` → nhóm tag Inventory → mở từng operation → kiểm tra "Responses" hiển thị schema, không còn "No content".
3. Kiểm tra field names trong schema khớp đúng bảng Phần 3 (camelCase, không snake_case).
4. Kiểm tra enum: `category` = `posm|gift|print`, item `status` = `instock|low|out`, batch `status` = `active|depleted`, transaction `type` = `in|out`.
5. Chạy lại smoke test CRUD inventory (đã pass ở `backend-required-fixes.md` Phần 5) để chắc chắn không regression.

---

## 6. Checklist

- [ ] Tạo response DTO: `InventoryItemResponseDto`, `InventoryBatchResponseDto`, `InventoryTransactionResponseDto`, `InventoryOverviewResponseDto`, các List/wrapper DTO
- [ ] Gắn `@ApiOkResponse`/`@ApiCreatedResponse` cho 12 endpoint inventory
- [ ] Khai báo `@ApiQuery` cho `GET /items` và `GET /transactions`
- [ ] Khai báo response DTO cho `PATCH /v1/expenses/{id}` (nếu thiếu)
- [ ] Deploy + verify tại `/api/docs-json` và FE `/api-docs`
