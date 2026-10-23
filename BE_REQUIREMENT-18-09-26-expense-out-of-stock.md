# Yêu cầu BE — 18/09/2026 (Expense: dòng Vật phẩm vượt tồn kho trong tab nhập chi phí dự án)

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Mục tiêu:** Cho phép **lưu được bản ghi chi phí chứa dòng "Vật phẩm" có số lượng thực tế vượt tồn kho hiện tại**, thay vì bị backend từ chối (HTTP 409). FE sẽ **cảnh báo trước khi lưu** nhưng vẫn cho phép lưu — bản ghi chi phí phải được giữ lại (kho có thể trừ âm hoặc không trừ, tùy cờ).

---

## 1. Bối cảnh

- Ở tab **Nhập chi phí dự án** (`FE/components/ExpenseManagement/ExpenseEntryForm.jsx`), một dòng "Vật phẩm" được liên kết tới `inventoryItemId`.
- Khi lưu, FE gọi `POST /v1/expenses/{expenseId}/lines` với `actualQuantity`. Backend tạo đồng thời **transaction xuất kho** (`type=out`) và trừ `currentStock`.
- Nếu `actualQuantity > currentStock`, backend trả lỗi:
  ```
  409 {"message":"Số lượng thực tế (250) vượt tồn kho hiện tại (0)","error":"Conflict","statusCode":409}
  ```
- Tình huống gặp phải: bản ghi `e801a21b` (dự án "YEAR END PARTY 2025", ngày 18/09/2026) có dòng **"SỔ LÒ XO 10 NĂM - BÌA CỨNG + TÚI GIẤY"** (SL thực 250) — chính dòng này trước đó đã xuất hết lô (`SOTAY-0126-002`, `currentStock=0`). Khi người dùng sửa/lưu lại bản ghi, dòng này bị 409 → dòng bị **bỏ lặng lẽ**, người dùng tưởng "không lưu được", và không xóa được dòng đó.

## 2. Thay đổi backend yêu cầu

### 2.1. Cho phép cờ `skipStockCheck` (hoặc `allowOverStock`) trên dòng chi phí

Các endpoint:
- `POST /v1/expenses/{expenseId}/lines`
- `PATCH /v1/expenses/lines/{lineId}` (nếu có)

Thêm field optional (boolean, mặc định `false` để không phá client cũ):
| Field | Kiểu | Mặc định | Ý nghĩa |
|-------|------|----------|---------|
| `skipStockCheck` | boolean (optional) | `false` | `true` → bỏ kiểm tra tồn kho khi trừ kho cho dòng này |

Khi `skipStockCheck = true`:
- Cho phép tạo dòng chi phí kèm `inventoryItemId` dù `actualQuantity > currentStock`.
- Transaction xuất kho (`type=out`) **được tạo**, và `currentStock` bị trừ xuống **âm** (nếu backend hỗ trợ số âm) — **hoặc** nếu backend không cho phép âm → **bỏ qua transaction xuất kho** nhưng vẫn giữ `inventoryItemId` ở dòng chi phí (không xóa link).
- **Quan trọng:** dòng chi phí vẫn giữ `inventoryItemId` để FE hiển thị đúng tên item và link tới kho.

> Lý do cần 2 phương án trừ âm / bỏ qua: tùy nghiệp vụ kho của từng client. BE chọn 1 trong 2 nhưng **phải giữ `inventoryItemId` trên line** khi `skipStockCheck=true`.

### 2.2. Response lỗi gồm context dòng để FE báo rõ

Khi vẫn phải trả 4xx do thiếu `skipStockCheck`, kèm thêm `lineName`/`lineIndex` vào body lỗi để FE hiển thị chính xác dòng nào bị chặn.

## 3. Những gì FE đã làm (đã deploy cần build lại)

| # | Nội dung | File |
|---|----------|------|
| 1 | Thêm helper `isOverStockRow(r)` — đúng với logic "Vượt tồn kho!" rồi: `Vật phẩm && actualQty > currentStock` | `FE/components/ExpenseManagement/ExpenseEntryForm.jsx` |
| 2 | **Chặn lưu nếu vượt kho**: nếu có dòng Vật phẩm với `actualQty > currentStock` → toast lỗi liệt kê tên các dòng, **không tạo bản ghi**. Người dùng phải giảm số lượng < tồn kho trước khi lưu. (Theo yêu cầu mới nhất của nghiệp vụ) | `FE/components/ExpenseManagement/ExpenseEntryForm.jsx` |
| 3 | **Fix trùng lặp dòng khi lưu**: `loadProjectLines` trước đây gộp dòng từ **TẤT CẢ** bản ghi chi phí cũ của dự án (mỗi lần lưu là một snapshot mới) → dòng bị lặp theo từng snapshot. Nay **chỉ nạp dòng từ bản ghi mới nhất** (`createdAt` mới nhất, có dòng) để grid không tăng dần. | `FE/components/ExpenseManagement/ExpenseEntryForm.jsx` |

## 4. Kiểm tra chấp nhận (checklist cho BE)

- [ ] `POST /v1/expenses/{id}/lines` với `actualQuantity > currentStock` và **không** có `skipStockCheck` → vẫn 409 (giữ hành vi cũ, không phá client/import).
- [ ] Với `skipStockCheck: true` → HTTP 201; response line có `inventoryItemId` và `actualQuantity` như gửi.
- [ ] `currentStock` sau đó: trừ âm **hoặc** giữ nguyên (theo phương án BE chọn) — bất kể trường hợp nào thì line chi phí vẫn tồn tại và có `inventoryItemId`.
- [ ] `GET /v1/expenses/{id}` vẫn trả về line đó đầy đủ; `GET /v1/inventory/items` không lỗi.
- [ ] Không gửi `skipStockCheck` (khách cũ) → không đổi hành vi.

## 5. Kết quả verify FE (trạng thái hiện tại)

Test thực tế trên `https://mkt-hub.onrender.com` (login manager `a.nguyen@company.com`):

| # | Test | Kết quả |
|---|------|---------|
| 1 | `POST /v1/expenses/{id}/lines` item `b091cf81…` qty 250 (stock hiện tại 0) | ❌ HTTP **409** `{"message":"Số lượng thực tế (250) vượt tồn kho hiện tại (0)"}` |
| 2 | `POST /v1/expenses/{id}/lines` cùng dòng nhưng `inventoryItemId: null, isCustom: true` | ✅ HTTP **201** — không trừ kho, không 409 |
| 3 | Tạo line item còn hàng (qty 5, stock 106 → 101) rồi `DELETE /v1/expenses/{id}` | ✅ HTTP 200, stock hoàn về 106 — xác nhận mỗi line Vật phẩm tạo transaction xuất kho |

**Kết luận:** FE hiện **chặn lưu** khi có dòng vượt tồn kho (toast lỗi + không tạo bản ghi), và đã fix trùng lặp dòng khi lưu. `skipStockCheck` của BE (mục 2) vẫn nên triển khai nếu nghiệp vụ muốn **cho phép** lưu dòng vượt kho (kho trừ âm hoặc không trừ) thay vì chặn cứng.