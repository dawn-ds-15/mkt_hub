# Yêu cầu cho Backend — Ngày 08/09/2026

> File tổng hợp các yêu cầu dành cho backend phát sinh ngày 08/09/2026.
> Mọi yêu cầu BE viết sau ngày này cũng được thêm vào file này (có ngày kèm theo).
>
> Ngày tạo: 08/09/2026
> Nguồn: FE tab "Nhập chi phí tổng hạng mục" (`CategoryBudgetEntry`) — bảng đã bỏ cấp
> subcategory/item/BACK UP, giờ CHỈ còn cấp **category**. Gửi dữ liệu theo body mới nhưng
> BE deploy vẫn validate theo DTO cũ → 400 "Có ô không hợp lệ" → **chưa lưu được**.
> Môi trường verify: `https://mkt-hub.onrender.com` (OpenAPI `/api/docs-json`, 08/09).
> Liên kết: `category-budget-api.md` (mục 8 — bảng chỉ còn cấp Category).

---

## Mục lục

- [1. Vấn đề đang chặn — lưu theo `categoryId` bị 400](#1-vấn-đề-đang-chặn--lưu-theo-categoryid-bị-400)
- [2. Yêu cầu 8.1 — `GET /tree` trả `months` cấp category](#2-yêu-cầu-81--get-tree-trả-months-cấp-category)
- [3. Yêu cầu 8.2 — `PUT /values` nhận value cấp `categoryId`](#3-yêu-cầu-82--put-values-nhận-value-cấp-categoryid)
- [4. Yêu cầu 8.3 — `CellValidationErrorDto` thêm `categoryId`](#4-yêu-cầu-83--cellvalidationerrordto-thêm-categoryid)
- [5. Yêu cầu 8.4 — sửa luôn `GET /v1/projects` (đang 500)](#5-yêu-cầu-84--sửa-luôn-get-v1projects-đang-500)
- [6. Test chấp nhận](#6-test-chấp-nhận)

---

## Trạng thái triển khai — verify OpenAPI `mkt-hub.onrender.com/api/docs-json` ngày 08/09/2026

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | `GET /tree` trả `categories[].months` (12 tháng) | ❌ Chưa có | `BudgetCategoryTreeDto` hiện chỉ có `planTotal`, `actuals`, `subcategories[]` — không `months`. |
| 2 | `PUT /values` nhận `{ categoryId, month, amount }` | ❌ Chưa có | `BudgetValueItemDto` vẫn là contract cũ: `{ itemId, subcategoryId, isBackup, field, month, amount }`. |
| 3 | Lỗi per-cell trả `categoryId` | ❌ Chưa có | `CellValidationErrorDto { itemId, subcategoryId, isBackup, month, message }` — không `categoryId`. |
| 4 | `GET /v1/projects` | ❌ **500** | Xem `BE-kiem-tra-7-9-26.md` mục 1.2. FE cần UUID để ghi `projectId`. |

---

## 1. Vấn đề đang chặn — lưu theo `categoryId` bị 400

**Hiện tượng QA (FE 08/09):**
- FE tab "Nhập chi phí tổng hạng mục" đã bỏ hoàn toàn dòng subcategory/item/BACK UP; bảng chỉ còn
  **nhóm lớn (category)** + 12 tháng Kế hoạch + Tổng KH.
- FE gửi `PUT /v1/expense-budgets/values` với body mới:

```json
{
  "year": 2026,
  "projectId": "<uuid-dự-án hoặc thiếu>",
  "baseUpdatedAt": "2026-09-08T10:00:00.000Z",
  "values": [
    { "categoryId": "cat_01", "month": 1, "amount": 10000000 }
  ]
}
```

→ BE deploy trả **400** `BudgetCellValidationFailedResponseDto` ("Có ô không hợp lệ") vì DTO vẫn là
cấu trúc cũ (không nhận `categoryId`). Các lỗi per-cell trả về không có `categoryId` nên FE
**không gắn được lỗi vào đúng ô** và người dùng chỉ thấy toast chung.

**Kỳ vọng cuối:** đầu vào/đầu ra đúng theo mục 2, 3, 4 bên dưới → FE lưu được và hiển thị được
đúng số của từng category (đọc từ category, không phải gom từ subcategory/item).

---

## 2. Yêu cầu 8.1 — `GET /tree` trả `months` cấp category

- `GET /v1/expense-budgets/tree?year=<năm>&projectId=<uuid|all|thiếu>` — **giữ nguyên** các field
  hiện có (`id, name, percent, sortOrder, year, planTotal, actualTotal, remaining, usagePercent,
  subcategories`).
- **Bổ sung** `categories[].months`: map **12 tháng → số tiền** (đơn vị đồng, số nguyên ≥ 0).

```json
{
  "data": {
    "categories": [
      {
        "id": "cat_01",
        "name": "Budget Brand Marketing",
        "percent": 11,
        "months": { "1": 10000000, "2": 20000000, "3": 0 },
        "subcategories": []
      }
    ]
  },
  "updatedAt": "2026-09-08T10:00:00.000Z",
  "permissions": { "view": true, "edit": true, "manageCategories": true, "export": true }
}
```

- Quy tắc ngữ nghĩa `months`:
  - **Nguồn số liệu:** là giá trị đã upsert theo `(categoryId, projectId, year, month)` ở mục 3.
  - Nếu chưa có dòng nào cho `(categoryId, projectId, year)` → `months` = `{}` (FE hiểu là 0).
  - Không tự cộng dồn từ `subcategories[]`/`items[]` trong response này (để FE hiển thị đúng
    đúng con số user nhập ở dòng category). Dữ liệu item/subcategory cũ giữ nguyên trong DB,
    chỉ không được làm nhiễu `months`.
  - `projectId=all` hoặc thiếu → gộp toàn hệ thống: với mỗi category tháng, cộng các dòng
    `(categoryId, year, month)` của **tất cả dự án + cấp toàn cục**.

---

## 3. Yêu cầu 8.2 — `PUT /values` nhận value cấp `categoryId`

- Body (thay cho contract cũ):

```json
{
  "year": 2026,
  "projectId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "baseUpdatedAt": "2026-09-08T10:00:00.000Z",
  "values": [
    { "categoryId": "cat_01", "month": 1, "amount": 10000000 },
    { "categoryId": "cat_01", "month": 12, "amount": 0 }
  ]
}
```

- Quy ước:
  - `values[].categoryId` → `budget_categories.id` (bắt buộc).
  - `month` ∈ 1..12 (bắt buộc). `amount` số nguyên ≥ 0 (bắt buộc; `0` = xóa/xoá giá trị tháng đó).
  - `projectId`: **chỉ UUID** hoặc **thiếu** (thiếu → ghi `project_id IS NULL` — cấp toàn cục).
    **KHÔNG chấp nhận** `"all"` (giữ nguyên 400 `projectId must be a UUID` — FE không gửi `all`).
  - `baseUpdatedAt` (optional): nếu có và khác `updatedAt` hiện tại của `(projectId, year)` →
    **412** `BudgetVersionConflictResponseDto { message, currentUpdatedAt }`.
  - Upsert theo khóa **`(categoryId, projectId, year, month)`**: có → ghi đè; chưa có → INSERT.
  - **Không đụng** các dòng `budget_values` của item/subcategory cũ (không xóa, không cộng dồn).
  - Trả `200 BudgetBulkSaveResponseDto` như cũ.
  - Tương thích ngược: **giữ nguyên** khả năng nhận contract cũ (`itemId`/`subcategoryId`/`isBackup`
    /`field`) để màn hình cũ (nếu còn) không vỡ; ưu tiên xử lý theo `categoryId` khi có mặt
    trong value.

---

## 4. Yêu cầu 8.3 — `CellValidationErrorDto` thêm `categoryId`

```json
{
  "message": "Có ô không hợp lệ",
  "errors": [
    { "categoryId": "cat_01", "month": 3, "message": "amount không được âm" },
    { "categoryId": "cat_02", "month": 13, "message": "month phải từ 1 đến 12" }
  ]
}
```

- Giữ nguyên các field cũ (`itemId`, `subcategoryId`, `isBackup`) và `month`, `message`.
- **Thêm** `categoryId` (optional) — khi value bị lỗi có `categoryId` thì phải trả kèm, để FE
  gắn lỗi vào đúng ô màu đỏ.

---

## 5. Yêu cầu 8.4 — sửa luôn `GET /v1/projects` (đang 500)

- `GET /v1/projects` hiện trả **HTTP 500** trên deploy (xem `BE-kiem-tra-7-9-26.md` mục 1.2).
- FE cần gọi danh sách dự án để lấy **một UUID hợp lệ** làm `projectId` khi ghi `PUT /values`
  (vì BE chỉ nhận UUID; `all` bị từ chối). Khi `/v1/projects` 500 → FE không lấy được UUID →
  buộc ghi cấp toàn cục (project NULL), dễ gây nhầm dữ liệu.
- Yêu cầu: `GET /v1/projects` trả `200` đúng schema trước đó.

---

## 6. Test chấp nhận

- [ ] `GET tree?year` trả `categories[].months` đủ 12 tháng (≥ 1 năm); category chưa có dữ liệu → `{}`.
- [ ] `PUT values` với `categoryId` upsert đúng cấp category; đọc lại `tree` thấy đúng số; **không
      đụng** item/subcategory cũ.
- [ ] `PUT values` với `amount: 0` → xóa giá trị tháng đó (đọc lại = không có / 0).
- [ ] `PUT values` với `projectId` UUID → lưu đúng dự án; thiếu `projectId` → lưu toàn cục.
- [ ] `PUT values` với `projectId=all` → **400** `projectId must be a UUID` (không lọt vào upsert).
- [ ] `PUT values` `baseUpdatedAt` sai/chệch → **412** `{ message, currentUpdatedAt }`.
- [ ] `PUT values` với giá trị không hợp lệ (amount âm, month 0/13, categoryId không tồn tại) →
      **400** kèm `errors[].categoryId` + `month` để FE bôi đỏ đúng ô.
- [ ] `GET /v1/projects` → **200**.