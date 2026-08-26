# Yêu cầu BE — `DELETE /v1/inventory/transactions/{id}`

> Ngày: 26/08/2026
> Nguồn: FE thêm nút "Hoàn tác" trong popup lịch sử xuất nhập kho → cần endpoint xóa transaction + tự reverse stock

---

## 1. Hiện trạng

| Endpoint | Trạng thái |
|----------|-----------|
| `GET /v1/inventory/transactions` | ✅ Hoạt động |
| `POST /v1/inventory/transactions` (`type: 'in'`) | ✅ Đã fix 26/08 |
| `DELETE /v1/inventory/transactions/{id}` | ❌ **Chưa có** — FE cần endpoint này |

---

## 2. Yêu cầu

### 2.1 Endpoint

```
DELETE /api/v1/inventory/transactions/{id}
```

### 2.2 Hành vi bắt buộc

1. **Xóa transaction** theo `id` (hard delete hoặc soft delete tùy BE design).
2. **Reverse stock tự động**:
   - Nếu transaction `type: 'out'` → **cộng lại** `quantity` vào `currentStock` của batch, tăng `totalStock` của item.
   - Nếu transaction `type: 'in'` → **trừ lại** `quantity` khỏi `currentStock` của batch, giảm `totalStock` của item.
3. **Re-tính** `totalStock`, `avgUnitPrice`, `status` của `InventoryItem` sau khi reverse.
4. **Re-tính** `currentStock`, `status` của `InventoryBatch` sau khi reverse.
5. **Ghi audit log** (nếu BE có module audit).

### 2.3 Validate

| Điều kiện | Response |
|-----------|----------|
| `id` không tồn tại hoặc đã xóa | 404 `"Transaction không tồn tại"` |
| Transaction thuộc batch đã bị xóa (soft-delete) | 400 `"Batch liên kết đã bị xóa"` |
| Server error | 500 `{statusCode, message}` |

### 2.4 Response

```
200 → {
  "data": {
    "id": "uuid",
    "itemId": "uuid",
    "type": "out",
    "quantity": 5,
    "deleted": true
  }
}
```

Hoặc:

```
200 → { "message": "Transaction deleted and stock restored" }
```

---

## 3. Ví dụ

### Kịch bản 1: Xóa transaction `type: 'out'`

```
Trước: item.totalStock = 3, batch.currentStock = 3
Transaction cần xóa: type='out', quantity=5, batchId='xxx'

DELETE /v1/inventory/transactions/{txId}

Sau: item.totalStock = 8, batch.currentStock = 8
```

### Kịch bản 2: Xóa transaction `type: 'in'`

```
Trước: item.totalStock = 10, batch.currentStock = 10
Transaction cần xóa: type='in', quantity=3, batchId='xxx'

DELETE /v1/inventory/transactions/{txId}

Sau: item.totalStock = 7, batch.currentStock = 7
```

### Kịch bản 3: Xóa transaction của batch đã xóa

```
DELETE /v1/inventory/transactions/{txId}

→ 400 "Batch liên kết đã bị xóa, không thể hoàn tác"
```

---

## 4. Test case chấp nhận

- [ ] `DELETE` transaction `type: 'out'` → `totalStock` tăng đúng, `currentStock` batch tăng đúng
- [ ] `DELETE` transaction `type: 'in'` → `totalStock` giảm đúng, `currentStock` batch giảm đúng
- [ ] `DELETE` transaction không tồn tại → 404
- [ ] `DELETE` transaction của batch đã bị xóa → 400 (hoặc xử lý theo design BE)
- [ ] `GET /v1/inventory/items/{id}` → `totalStock`, `avgUnitPrice`, `status` đúng sau DELETE
- [ ] `GET /v1/inventory/transactions` → transaction đã xóa không còn trong danh sách
- [ ] Audit log ghi nhận lệnh xóa

---

## 5. Checklist cho backend

- [ ] Tạo `DELETE /v1/inventory/transactions/{id}` endpoint
- [ ] Implement logic reverse stock (in→subtract, out→add)
- [ ] Re-tính item (`totalStock`, `avgUnitPrice`, `status`) và batch (`currentStock`, `status`)
- [ ] Validate transaction tồn tại + batch liên kết còn hoạt động
- [ ] Ghi audit log
- [ ] Deploy + verify Swagger `/api/docs-json`
