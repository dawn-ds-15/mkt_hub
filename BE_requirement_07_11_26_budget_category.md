# Yêu cầu BE — 07/11/2026 (Inventory category → Budget category)

**Người gửi:** FE Team  
**Môi trường kiểm tra:** `https://mkt-hub.onrender.com/api`, ngày 07/11/2026  
**Tài khoản:** manager `a.nguyen@company.com` / `demo123`; specialist `test@company.com` / `demo123`  
**Dữ liệu test:** chỉ tạo/xoá bản ghi có tiền tố `TEST_QA_`; cleanup sau khi kiểm tra.

> **Bối cảnh:** FE đã áp quy tắc nhóm ngân sách theo danh mục vật phẩm kho ở luồng nhập chi phí và cảnh báo ở luồng nhập batch. Tuy nhiên, chi phí sinh ra từ **xuất kho** (stock-out) vẫn do BE tạo với `categoryId = null`, nên không thể phân loại đúng ở FE. Tài liệu này liệt kê phần BE cần xử lý để dữ liệu ngân sách nhất quán.

## 1. Quy tắc thống nhất

| Danh mục vật phẩm kho | Nhóm ngân sách đích |
|---|---|
| `gift` (Quà tặng) | `QUÀ TẶNG/ IN ẤN` |
| `print` (Ấn phẩm in) | `QUÀ TẶNG/ IN ẤN` |
| `posm` (POSM) | `Vật phẩm` |
| `uniform` (Đồng phục) | `Vật phẩm` |
| `null` / không xác định | `Vật phẩm` (unassigned, `categoryId = null` nếu chưa có nhóm thật) |

- Không tự tạo nhóm ngân sách mới.
- Không thay đổi tổng ngân sách / tổng thực tế; chỉ đổi nhóm mà dòng chi phí được cộng vào.
- `plannedAmount` / `plannedQuantity` không bị ảnh hưởng.

## 2. Hiện trạng

### 2.1. Xuất kho tạo dòng chi phí không có nhóm

FE gọi `POST /v1/inventory/transactions` (hoặc endpoint stock-out tương ứng) với:

```json
{
  "inventoryItemId": "<item-id>",
  "projectId": "<project-id>",
  "type": "out",
  "quantity": 10,
  "expenseDate": "2026-11-07",
  "note": "..."
}
```

BE tạo expense line với `categoryId = null` và `hangMucLon = "Vật phẩm"`, dù item có `category = gift/print/posm/uniform`. Hệ quả: dòng quà tặng / in ấn bị cộng vào nhóm “Vật phẩm” (unassigned) thay vì “QUÀ TẶNG/ IN ẤN”.

### 2.2. Nhập chi phí có thể gửi sai nhóm

`POST /v1/expenses` (và API thêm dòng) hiện nhận `categoryId`/`hangMucLon` từ client mà không đối chiếu với `inventoryItemId`. FE đã ép đúng ở form, nhưng vẫn có thể sai từ client khác / dữ liệu cũ.

### 2.3. Batch

Batch có `expenseCategoryId` do người dùng chọn (chi phí chung). FE đã thêm cảnh báo khi chọn sai nhóm theo danh mục vật phẩm, nhưng **không tự đổi** để tránh thay đổi số liệu. Đề nghị giữ nguyên hành vi này.

### 2.4. Bằng chứng số liệu (year 2026, all projects)

- Tổng ngân sách `3,432,961,025`; tổng thực tế `815,831,515`; unassigned `79,768,000`.
- `Vật phẩm` (unassigned): plan `0`, actual `79,768,000`, gồm 100% dòng quà tặng:
  - `LY SỨ 10 NĂM - BỘ 5 LY` — 182 × 237,000 = `43,134,000`
  - `SỔ LÒ XO BÌA CỨNG` — 250 × 93,000 = `23,250,000`
  - `SỔ LÒ XO BÌA THƯỜNG` — 145 × 91,000 = `13,195,000`
  - `TÚI TOTE` — 9 × 21,000 = `189,000`
- `QUÀ TẶNG/ IN ẤN`: plan `642,333,334`, actual `10,448,538` = `4,788,538` dòng chi phí + `5,660,000` chi phí batch.
- Batch `CHÂN STANDEE CHỮ X` (POSM) `260,000` đang nằm trong `QUÀ TẶNG/ IN ẤN` do người dùng chọn — không sửa tự động.
- Các batch chưa gán nhóm (không nằm trong actual): POSM `321,000`; uniform `32,000,000`; print `4,681,400`; gift `122,416,010`.

## 3. Đề xuất BE

### 3.1. Ưu tiên 1 — Stock-out tự gán nhóm theo danh mục vật phẩm

Khi tạo expense line từ stock-out:

1. Nếu request có `expenseCategoryId` (mở rộng API, optional) → dùng giá trị đó sau khi validate thuộc cây ngân sách năm.
2. Nếu không có → tra `inventoryItem.category` và gán:
   - `gift` / `print` → category `QUÀ TẶNG/ IN ẤN`;
   - `posm` / `uniform` / null / unknown → category `Vật phẩm` nếu cây có nhóm thật; nếu không, để `categoryId = null` (unassigned).
3. Trả `inventoryItem.category` trong response của expense line (tối thiểu trong `GET /v1/expenses/{id}` và danh sách dòng) để FE hiển thị/đối soát.

**Acceptance:**
- [ ] Stock-out item `gift` → dòng chi phí có `categoryId` = id `QUÀ TẶNG/ IN ẤN`; tab Ngân sách cộng đúng nhóm.
- [ ] Stock-out item `print` → `QUÀ TẶNG/ IN ẤN`.
- [ ] Stock-out item `posm` / `uniform` → `Vật phẩm` (hoặc null nếu chưa có nhóm).
- [ ] Không tạo nhóm mới; tổng actual/tổng budget không đổi.
- [ ] Không tạo thêm transaction `out` hoặc thay đổi tồn kho ngoài luồng hiện tại.

### 3.2. Ưu tiên 2 — Server-side guard khi lưu expense line

Với line có `inventoryItemId`:

- Bỏ qua `categoryId` / `hangMucLon` do client gửi nếu không khớp danh mục item; tự suy ra theo bảng mục 1.
- Nếu client gửi `categoryId` hợp lệ nhưng item không có category → giữ nguyên (tránh phá dữ liệu cũ).
- Log/response cảnh báo (không chặn) khi client gửi nhóm khác nhóm suy ra, để FE/BE đối soát.

**Acceptance:**
- [ ] Gửi expense line `inventoryItemId` của gift nhưng `categoryId` của POSM → BE lưu vào `QUÀ TẶNG/ IN ẤN` (hoặc trả 4xx nếu business chọn chặn).
- [ ] Line không có `inventoryItemId` giữ nguyên `categoryId` do client chọn (kể cả amount-only).
- [ ] Không ảnh hưởng `plannedAmount` / `actualAmount` / VAT.

### 3.3. Ưu tiên 3 — Batch (không bắt buộc)

- Giữ `expenseCategoryId` là lựa chọn của người dùng.
- Đảm bảo `GET` batch trả `expenseCategoryId` + `expenseCategoryName` (FE đang dùng để hiển thị).
- (Optional) Trả thêm `inventoryItem.category` trong batch để FE hiển thị gợi ý; FE đã có cảnh báo mismatch.

### 3.4. Dữ liệu lịch sử (không thực hiện trong đợt này)

- FE chọn hướng **chỉ sửa từ lần lưu sau**, không rewrite snapshot cũ.
- Nếu BE có nhu cầu chuẩn hoá lịch sử, đề xuất endpoint/job riêng, chạy có kiểm soát và đối soát trước/sau; không tự động chạy trong release này.

## 4. Phạm vi FE đã làm (tham khảo)

- `src/features/inventory/utils/inventoryBudgetCategory.js`: thêm `getInventoryBudgetGroup`, `resolveInventoryBudgetCategory`.
- `src/features/expense/components/ExpenseEntryForm.jsx`: ép nhóm cho dòng đã liên kết kho khi chọn item, relink và trước khi lưu; map trước khi gộp dòng trùng.
- `src/features/inventory/components/InventoryFormModal.jsx`: cảnh báo khi `expenseCategoryId` của batch khác nhóm gợi ý; không tự đổi.
- `src/features/inventory/hooks/useInventoryCategories.js`: bổ sung nhãn `uniform`.
- Test: `tests/expense-inventory/inventory-budget-category.test.mjs`.
