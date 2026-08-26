# Yêu cầu BE sửa — `POST /v1/inventory/transactions` hỗ trợ `type: 'in'`

> Ngày: 26/08/2026
> Nguồn: FE xóa bản ghi chi phí có vật phẩm kho → cần hoàn lại tồn kho nhưng BE không xử lý `type: 'in'`
> Verify: FE gửi `POST /v1/inventory/transactions` với `type: 'in'` → 201 nhưng `totalStock` **không tăng** (BE chỉ xử lý logic `type: 'out'`)

---

## 1. Hiện trạng

### 1.1 DTO hiện tại (verified qua `/api/docs-json`)

```
POST /api/v1/inventory/transactions
{
  "itemId":    "uuid",
  "projectId": "uuid",
  "type":      "in",       // enum: in | out — DTO nhận cả hai
  "quantity":  5,
  "date":      "2026-08-26",
  "note":      "Hoàn kho từ xóa chi phí"
}
```

| Phản hồi | Kết quả |
|----------|---------|
| `type: 'out'` | ✅ 201 — trừ `totalStock` FIFO theo batch, tạo transaction, re-tính item |
| `type: 'in'` | ❌ 201 — tạo transaction record nhưng **KHÔNG cộng `totalStock`**, KHÔNG tạo/cập nhật batch |

### 1.2 Vấn đề

`type: 'in'` nằm trong enum `CreateInventoryTransactionDto` nhưng BE **chưa implement logic nhập kho** cho endpoint này. FE tin tưởng DTO contract nên gửi `type: 'in'` → BE im lặng nhận mà không xử lý → dữ liệu tồn kho lệch.

### 1.3 workaround tạm thời FE đang dùng

FE dùng `POST /v1/inventory/entries` (endpoint nhập kho chính) để hoàn stock:

```
POST /v1/inventory/entries
{
  "itemId": "uuid",
  "receivedDate": "2026-08-26",
  "batchCode": "REV-xxx",
  "quantity": 5,
  "unitPrice": 10000,
  "note": "Hoàn kho từ xóa chi phí"
}
```

→ Tạo batch mới + transaction `type: 'in'` + re-tính item — **hoạt động đúng** nhưng là workaround vì tạo thêm batch rác không cần thiết.

---

## 2. Yêu cầu

### 2.1 Sửa `POST /v1/inventory/transactions` — xử lý `type: 'in'`

Khi `type: 'in'`, BE thực hiện:

1. **Cộng `totalStock`** của `InventoryItem` (tăng `quantity`).
2. **Tăng `currentStock`** của batch liên quan:
   - Nếu request có `batchId` → tăng `currentStock` batch đó.
   - Nếu **không có** `batchId` → tìm batch `status = 'active'` có `currentStock > 0` của item đó (FIFO) hoặc tạo batch mới với `batchCode = 'AUTO-{timestamp}'`, `unitPrice = 0`.
3. **Tạo `InventoryTransaction`** record với `type: 'in'`, `itemId`, `quantity`, `date`, `note`.
4. **Re-tính** `totalStock`, `avgUnitPrice`, `status` của item.

### 2.2 Field mới (optional) trong `CreateInventoryTransactionDto`

| Field | Kiểu | Required | Mô tả |
|-------|------|----------|-------|
| `batchId` | UUID | ❌ | Batch cụ thể cần hoàn stock. Nếu thiếu → auto tìm/tạo |

### 2.3 Validate

| Điều kiện | Response |
|-----------|----------|
| `quantity ≤ 0` | 400 `"Số lượng phải lớn hơn 0"` |
| `itemId` không tồn tại hoặc đã archived | 404 |
| `type = 'in'` + `batchId` không tồn tại | 404 `"Batch không tồn tại"` |

### 2.4 Response

```
201 → {
  "data": {
    "id": "uuid",
    "itemId": "uuid",
    "projectId": "uuid",
    "type": "in",
    "quantity": 5,
    "date": "2026-08-26",
    "note": "Hoàn kho từ xóa chi phí",
    "createdAt": "2026-08-26T..."
  }
}
```

---

## 3.Impact khi BE fix

### 3.1 FE thay đổi

| Trước | Sau khi BE fix |
|-------|---------------|
| FE gọi `POST /v1/inventory/entries` (workaround tạo batch rác) | FE gọi `POST /v1/inventory/transactions` với `type: 'in'` — endpoint duy nhất cho cả xuất lẫn nhập |
| FE cần tạo `batchCode`, `unitPrice` giả cho mỗi lần hoàn | FE chỉ cần gửi `itemId`, `quantity`, `type: 'in'` |

### 3.2 Code FE thay đổi (sau khi BE fix)

```js
// ExpenseHistory.jsx & ExpenseBudget.jsx — handleDelete
await createInventoryTransaction({
  itemId: ln.inventoryItemId,
  projectId: target.projectId,
  type: 'in',
  quantity: Number(ln.actualQty),
  date: new Date().toISOString().slice(0, 10),
  note: `Hoàn kho từ xóa chi phí (${target.period || ''})`,
});
```

→ **Đơn giản hóa**: bỏ `createInventoryEntry` workaround, dùng đúng 1 endpoint cho cả 2 chiều.

---

## 4. Test case chấp nhận

- [ ] `POST /v1/inventory/transactions` `type: 'in'` với `itemId` có sẵn → `totalStock` tăng đúng `quantity`
- [ ] `POST /v1/inventory/transactions` `type: 'in'` có `batchId` → `currentStock` batch đó tăng đúng
- [ ] `POST /v1/inventory/transactions` `type: 'in'` không có `batchId` → batch active hoặc batch mới được tạo, `currentStock` tăng
- [ ] `POST /v1/inventory/transactions` `type: 'out'` → giữ nguyên hành vi hiện tại (không regression)
- [ ] `GET /v1/inventory/transactions` trả transaction `type: 'in'` vừa tạo
- [ ] `GET /v1/inventory/items/{id}` → `totalStock`, `avgUnitPrice`, `status` đúng sau cả `in` lẫn `out`
- [ ] `POST` với `quantity ≤ 0` → 400
- [ ] `POST` với `itemId` không tồn tại → 404
- [ ] `POST` `type: 'in'` với `batchId` không tồn tại → 404
- [ ] Swagger `/api/docs-json` hiển thị đầy đủ `type` enum `in|out` + field `batchId` mới

---

## 5. Checklist cho backend

- [ ] Implement logic `type: 'in'` trong `InventoryTransactionsService.create()` — cộng stock, tạo transaction, re-tính item
- [ ] Thêm field optional `batchId` vào `CreateInventoryTransactionDto`
- [ ] Validate `quantity > 0`, `itemId` tồn tại, `batchId` tồn tại (nếu truyền)
- [ ] Test E2E: tạo item → xuất 5 (`type: 'out'`) → còn 0 → nhập 3 (`type: 'in'`) → `totalStock = 3`
- [ ] Không regression: `type: 'out'` giữ nguyên hành vi FIFO hiện tại
- [ ] Deploy + verify `/api/docs-json`
