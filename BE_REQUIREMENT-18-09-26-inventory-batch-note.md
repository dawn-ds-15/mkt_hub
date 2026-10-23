# Yêu cầu BE — 18/09/2026 (Inventory: lưu Ghi chú cho batch)

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Mục tiêu:** Cho phép lưu và đọc lại trường **Ghi chú (`note`)** của **batch vật phẩm kho** ở popup "Sửa vật phẩm". Hiện tại FE có ô "Ghi chú" và gửi `note` trong `PATCH /v1/inventory/batches/{id}`, nhưng backend **không khai báo field `note`** trong `InventoryBatch` / `UpdateBatchDto` / `CreateBatchDto` nên giá trị bị **loại bỏ im lặng** — lưu xong mở lại ô Ghi chú vẫn trống.

---

## 1. Bối cảnh

- Popup "Sửa vật phẩm" (`FE/components/InventoryManagement/InventoryFormModal.jsx`) có ô **Ghi chú** (note) trong mục "Nhập kho".
- FE đã gửi `note` đúng chỗ:
  - Sửa: `PATCH /v1/inventory/batches/{batchId}` payload có `note` (Field bị BE bỏ qua vì `UpdateBatchDto` thiếu `note`).
  - Tạo: FE sẽ bổ sung gửi `note` trong `POST /v1/inventory/items` (payload nhập kho lần đầu).
- Khi mở popup sửa, FE đọc lại ghi chú hiện có từ `GET /v1/inventory/items/{id}/batches` (field `note` của batch) — hiện batch không trả `note` nên ô Ghi chú luôn trống.

## 2. Thay đổi backend yêu cầu

### 2.1. Thêm field `note` vào entity/DTO sau:

| Entity / DTO | Field mới | Ghi chú |
|--------------|-----------|---------|
| `InventoryBatch` (entity + bảng DB) | `note` (string, nullable, mặc định `null`) | Lưu trên bảng batch, **độc lập** với note của transaction |
| `InventoryBatchDto` (response `GET batches`, `PATCH batch`, `POST entries`) | `note` (string, nullable) | FE đọc lại để đổ vào ô Ghi chú khi sửa |
| `CreateBatchDto` (body `POST /v1/inventory/items/{id}/batches`) | `note` (string, optional) | |
| `UpdateBatchDto` (body `PATCH /v1/inventory/batches/{id}`) | `note` (string, optional) | **Quan trọng nhất** — hiện thiếu nên note bị drop |
| `CreateInventoryItemDto` (body `POST /v1/inventory/items`) | `note` (string, optional) | FE tạo vật phẩm mới có nhập kho kèm ghi chú |

### 2.2. Hành vi

- `PATCH /v1/inventory/batches/{id}` nhận `note` → **lưu vào batch** và trả về trong response `data.note`.
- `GET /v1/inventory/items/{id}/batches` trả về `note` của từng batch.
- `note` là optional: không gửi / gửi `null` / gửi chuỗi rỗng đều được, không ảnh hưởng các field khác, không break các client cũ.
- Không đổi contract `POST /v1/inventory/transactions` — note của transaction giữ nguyên (không nhầm lẫn hai trường).

> Note: `CreateInventoryEntryDto` (phiếu nhập `POST /v1/inventory/entries`) **đã có sẵn** `note` — giữ nguyên, không phá vỡ.

## 3. Những gì FE đã làm / sẽ làm

| # | Nội dung | File |
|---|----------|------|
| 1 | Gửi `note` trong `PATCH /v1/inventory/batches/{id}` khi sửa vật phẩm (đã có từ trước) | `FE/components/InventoryManagement/InventoryFormModal.jsx` |
| 2 | Bổ sung `note` trong payload `POST /v1/inventory/items` khi tạo vật phẩm mới kèm nhập kho | `FE/components/InventoryManagement/InventoryFormModal.jsx` |
| 3 | Đọc lại `note` từ batch khi mở popup sửa (FE đọc `latest.note`) | `FE/components/InventoryManagement/InventoryFormModal.jsx` |

## 4. Kiểm tra chấp nhận (checklist cho BE)

- [ ] `POST /v1/inventory/items` có `note` → tạo item + batch, `GET /v1/inventory/items/{id}/batches` trả `note` đúng.
- [ ] `PATCH /v1/inventory/batches/{id}` với `{ note: "..." }` → `200`, response `data.note` = giá trị vừa gửi.
- [ ] Lại `GET /v1/inventory/items/{id}/batches` → batch đó trả `note` đã lưu.
- [ ] `PATCH` không gửi `note` / gửi `null` → vẫn `200`, các field khác không đổi (no regression).
- [ ] `POST /v1/inventory/entries` (phiếu nhập cũ) vẫn hoạt động, `note` transaction giữ nguyên.

## 5. Kết quả verify FE (trạng thái hiện tại)

Test thực tế trên `https://mkt-hub.onrender.com` (login manager `a.nguyen@company.com`):

| # | Test | Kết quả trước khi BE sửa |
|---|------|--------------------------|
| 1 | `PATCH /v1/inventory/batches/{id}` body `{ "note": "..." }` | ❌ HTTP 200 nhưng response `data` **không có** `note`; GET lại → `note` trống |
| 2 | `GET /v1/inventory/items/{id}/batches` | ❌ Batch không có field `note` (fields: batchCode, receivedDate, quantityIn, unitPrice, unitPriceBeforeVat, vatRate, unitPriceAfterVat, supplier, contractCode, currentStock, status, ...) |
| 3 | `POST /v1/inventory/entries` có `note` | ✅ Tạo transaction `type=in` có `note` — xác nhận `note` chỉ tồn tại trên transaction, không phải batch |

**Kết luận: cần BE thêm `note` cho batch theo mục 2 để popup "Sửa vật phẩm" lưu được Ghi chú.**