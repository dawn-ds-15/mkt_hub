# Yêu cầu cho Backend — Ngày 07/09/2026

> File tổng hợp yêu cầu cho backend phát sinh ngày 07/09/2026.
>
> Nguồn: luồng FE "tách bản ghi chi phí theo từng lần nhập + chỉnh sửa bản ghi theo ngày" — mỗi lần nhập chi phí là
> **1 bản ghi riêng** (kể cả cùng dự án, cùng kỳ) và bản ghi đó **có thể được mở ra để sửa theo ngày phát sinh**.
> Yêu cầu phát sinh từ lỗi thực tế: nhập chi phí ngày khác trong cùng kỳ (tháng) thì bản ghi cũ **bị mất/ghi đè**.
>
> Liên quan: `BE-yeu-cau-6-9-26.md` (mô hình 2 tầng kế hoạch + Actual draft/confirmed/cancelled, `recognized_date`),
> `tom-tat-2026-09-06.md` (thực trạng BE đã deploy — upsert record theo `(projectId, month, year)`),
> `03-expense-management.md` (contract module Expense Management).
>
> **Hiện trạng BE:** `POST /v1/expenses` đang **upsert theo `(projectId, year, month)`** (fix ngày 22/8):
> cùng một dự án + tháng + năm chỉ có duy nhất 1 bản ghi; gửi lại y hệt thì cập nhật bản ghi cũ chứ không tạo mới.
> Điều này khiến việc tách bản ghi theo lần nhập (tính năng FE vừa làm) không thể hoạt động đúng phía BE.

---

## Mục lục

- [1. Bối cảnh & vấn đề](#1-bối-cảnh--vấn-đề)
- [2. Yêu cầu thay đổi](#2-yêu-cầu-thay-đổi)
- [3. Quy tắc nghiệp vụ / validation](#3-quy-tắc-nghiệp-vụ--validation)
- [4. API chi tiết & payload mẫu](#4-api-chi-tiết--payload-mẫu)
- [5. Test case chấp nhận](#5-test-case-chấp-nhận)
- [6. Checklist cho backend](#6-checklist-cho-backend)
- [7. Liên quan / còn mở (tham chiếu, không trùng lặp)](#7-liên-quan--còn-mở-tham-chiếu-không-trùng-lặp)

---

# 1. Bối cảnh & vấn đề

- Trước đây mỗi (dự án, kỳ) chỉ có **1 bản ghi chi phí**, các dòng chi phí nằm trong `lines[]` của bản ghi đó.
- FE (và user) có nhu cầu: **mỗi lần nhập chi phí là một bản ghi riêng** và **mỗi bản ghi sửa được theo ngày**.
  Ví dụ cùng dự án, cùng kỳ 09/2026:
  - Ngày 05/09 nhập đợt 1 (Vật phẩm/leaflet, 5.000.000).
  - Ngày 10/09 nhập đợt 2 (POSM, 2.500.000).
  - → Phải tạo ra **2 bản ghi riêng biệt**, mỗi bản ghi có `lines[]` của riêng nó; bản ghi 05/09 **không bị mất**.
  - Chọn đúng bản ghi ngày 05/09 (theo `recognizedDate`) để **sửa** — chỉ bản ghi đó đổi, bản ghi 10/09 giữ nguyên.
- Hiện BE `POST /v1/expenses` upsert theo `(projectId, year, month)` → lần nhập thứ 2 cùng kỳ ghi đè bản ghi thứ nhất
  (hoặc gộp dòng), dữ liệu cũ biến mất. **Đây là root cause của lỗi "bản ghi cũ mất".**
- FE đã hoàn tất phần UI phía mình:
  - Chế độ nhập mới luôn gọi `POST /v1/expenses` (mỗi lần Lưu = 1 bản ghi mới), sau đó thêm dòng bằng `POST /v1/expenses/:id/lines`.
  - Chế độ sửa chỉ cập nhật đúng 1 bản ghi qua `PATCH /v1/expenses/:id` và các dòng qua `PATCH/DELETE /v1/expenses/lines/:id`.
  - Thêm bảng "Chi phí phát sinh" theo dự án (`GET /v1/expenses?projectId=...`) hiển thị **từng bản ghi** kèm ngày phát sinh.

---

# 2. Yêu cầu thay đổi

## 2.1 `POST /v1/expenses` — bỏ upsert, luôn tạo bản ghi mới

| | Trước | Sau |
|---|---|---|
| Hành vi | Upsert theo `(projectId, year, month)` | **Luôn `INSERT` bản ghi mới** |
| Mã trả về | 201 (cập nhật bản ghi cũ) | 201 + **bản ghi mới** (có `id` riêng) |
| Ràng buộc unique | Có ràng buộc (hoặc logic upsert) 1 bản ghi/kỳ | **Không tồn tại** ràng buộc 1 bản ghi/kỳ |

Chi tiết:

1. `POST /v1/expenses` không tìm theo `(projectId, year, month)` nữa; **luôn INSERT** bản ghi mới và trả `id`.
2. Nếu đã tồn tại bản ghi trùng `(projectId, year, month)`: **không gộp, không cập nhật dòng cũ**, vẫn tạo mới
   (đây chính là "nhập ngày khác cùng kỳ = bản ghi riêng").
3. Giữ nguyên các trường & validation hiện có: `projectId`, `month`, `year`, `directCost`, `overheadCost`,
   `directNotes`, `overheadNotes`, và các trường mới nếu BE đã hỗ trợ (`recognizedDate`, `isUnplanned`,
   `status`, `action`, ...).
4. **Idempotency (tùy chọn, đề xuất sau):** nếu lo ngại FE bấm Lưu 2 lần gửi trùng, thêm `Idempotency-Key`
   hoặc trả về bản ghi mới nhất theo thời gian tạo — **không được dùng unique `(projectId, month, year)` để chặn trùng lặp**.

## 2.2 `GET /v1/expenses` — trả đủ mọi bản ghi

1. Trả **mảng mọi bản ghi** của bộ filter (`projectId`, `month`, `year` — đều tùy chọn), **không gộp** thành 1.
2. Mỗi bản ghi trả đủ: `id`, `projectId`, `month`, `year`, `recognizedDate`/`expenseDate`, `directCost`,
   `directNotes`, `overheadCost`, `overheadNotes`, `status`, `lines[]`.
3. Thứ tự mặc định: `recognizedDate DESC, created_at DESC` (bản ghi mới nhất trước).
4. Luôn lọc bản ghi đã soft-delete: `archivedAt IS NULL`.
5. **(Bổ sung) Filter theo ngày phát sinh:** `GET /v1/expenses?projectId=...&recognizedDate=YYYY-MM-DD` trả đúng
   bản ghi có ngày đó (kèm `lines[]`) — để FE mở đúng bản ghi cần xem/sửa theo ngày.

## 2.3 Cập nhật / xóa theo từng bản ghi — hỗ trợ "sửa bản ghi theo ngày"

1. `PATCH /v1/expenses/:id` — cập nhật **đúng 1 bản ghi** theo `id` (FE đã có `updateExpense`); không ảnh hưởng
   bản ghi khác cùng kỳ.
2. `DELETE /v1/expenses/:id` — soft-delete **đúng 1 bản ghi** (đã có); các bản ghi khác cùng kỳ giữ nguyên.
3. `GET /v1/expenses/:id` — trả 1 bản ghi kèm `lines[]` (đã có).
4. **Sửa bản ghi theo ngày (yêu cầu chính):** `PATCH /v1/expenses/:id` cho phép sửa **ngày phát sinh**
   (`recognizedDate`/`expenseDate`) cùng các trường thông tin của đúng bản ghi đó:
   - Đổi ngày → **giữ nguyên `id` và `lines[]`** (KHÔNG tạo bản ghi mới, KHÔNG xóa dòng cũ).
   - Đổi ngày sang ngày khác (trong cùng kỳ hoặc khác kỳ) đều được.
   - Bản ghi ở trạng thái **draft** sửa tự do; nếu đã **confirmed/cancelled** → giữ nguyên quy tắc chặn hiện hành
     (sửa cần lý do + audit log).
   - Chỉ bản ghi được chọn (theo `recognizedDate`) bị đổi; mọi bản ghi khác cùng kỳ giữ nguyên.

## 2.4 Tổng hợp (overview / report / Dashboard KPI) — cộng nhiều bản ghi/kỳ

1. `GET /v1/expenses/overview`, `GET /v1/expenses/report`, và các metrics `totalExpense`, `cac`, `roas`,
   `totalWonValue` trên Dashboard: **phải cộng tổng của TẤT CẢ bản ghi thuộc kỳ/dự án được filter**
   (đã loại soft-delete), KHÔNG được giả định tối đa 1 bản ghi/kỳ.
2. `total` khối chi phí = Σ `lines[].actualQuantity × lines[].actualUnitPrice` (hoặc tổng lưu sẵn của bản ghi)
   + chi phí khác (overhead/directCost nếu áp dụng); **không cộng trùng** khi 1 bản ghi có nhiều dòng.
3. Bảng `ProjectExpenses` FE hiển thị từng bản ghi: cột **"Kỳ"** = `month/year`, cột **"Ngày phát sinh"** =
   `recognizedDate` (hoặc `expenseDate`) của bản ghi.

## 2.5 Migration & dữ liệu cũ

1. **Không đụng dữ liệu hiện có** — các bản ghi đang tồn tại (kể cả trùng `(projectId, month, year)`) giữ nguyên.
2. Nếu có unique index/logic di chuyển theo `(projectId, month, year)`: **gỡ bỏ** (hoặc chuyển thành index thường)
   để cho phép nhiều bản ghi/kỳ.
3. Dữ liệu test đang có trên môi trường (record `882f59b4-…` với line confirmed "ba test") không bị ảnh hưởng.

---

# 3. Quy tắc nghiệp vụ / validation

| # | Quy tắc | Mã trả về |
|---|---|---|
| 1 | Không còn ràng buộc 1 bản ghi/`(projectId, month, year)`; `POST /v1/expenses` luôn tạo mới | — |
| 2 | Bản ghi không có `recognizedDate` → mặc định = ngày tạo (hoặc lấy từ dòng đầu `lines[0].recognizedDate`) | — |
| 3 | Draft / Cancelled không nằm trong `actual` (giữ nguyên quy tắc 06/09) | — |
| 4 | Mọi query đọc phải lọc `archivedAt IS NULL` VÀ các aggregate loại bản ghi đã xóa mềm | — |
| 5 | `PATCH/DELETE` theo `id` chỉ tác động đúng bản ghi được chọn | — |
| 6 | Xác nhận (confirm) bản ghi/line có liên quan Annual Plan active → giữ nguyên quy tắc & mã lỗi đã có
    (`ERR_ANNUAL_PLAN_NOT_ACTIVE`, v.v.) | 422 |
| 7 | Cho phép **sửa ngày phát sinh** (`recognizedDate`) của bản ghi **draft** — đổi ngày giữ nguyên `id` + `lines[]`,
    không tạo bản ghi mới; bản ghi `confirmed`/`cancelled` chặn như quy tắc cũ | 400/403 |

---

# 4. API chi tiết & payload mẫu

## 4.1 Liên hệ FE ↔ BE (đối chiếu `FE/services/api.js`)

| FE function | Endpoint | Kỳ vọng mới |
|---|---|---|
| `saveExpense` | `POST /v1/expenses` | **Luôn tạo bản ghi mới** (không upsert) |
| `updateExpense` | `PATCH /v1/expenses/:id` | Cập nhật đúng 1 bản ghi |
| `getExpenseList` | `GET /v1/expenses` | Mảng mọi bản ghi theo filter |
| `getExpenseById` | `GET /v1/expenses/:id` | 1 bản ghi + `lines[]` |
| `deleteExpense` | `DELETE /v1/expenses/:id` | Soft-delete 1 bản ghi |
| `addExpenseLine` | `POST /v1/expenses/:id/lines` | Giữ nguyên |
| `updateExpenseLine` | `PATCH /v1/expenses/lines/:id` | Giữ nguyên |
| `deleteExpenseLine` | `DELETE /v1/expenses/lines/:id` | Giữ nguyên |

## 4.2 Payload tạo bản ghi (`POST /v1/expenses`)

```json
{
  "projectId": "prj_01",
  "month": 9,
  "year": 2026,
  "recognizedDate": "2026-09-06",
  "directCost": 0,
  "directNotes": "",
  "overheadCost": 0,
  "overheadNotes": "",
  "lines": [
    {
      "name": "leaflet",
      "hangMucLon": "Vật phẩm",
      "categoryId": null,
      "inventoryItemId": "item_01",
      "isCustom": false,
      "plannedQuantity": 6,
      "actualQuantity": 5,
      "vatRate": 8,
      "unitPriceBeforeVat": 8316,
      "unitPriceAfterVat": 8981,
      "actualUnitPrice": 8981,
      "note": ""
    }
  ]
}
```

## 4.3 Hai lần nhập cùng kỳ → 2 bản ghi riêng

- `POST` lần 1 (recognizedDate 2026-09-06) → `201 { data: { id: "rec_A", recognizedDate: "2026-09-06", ... } }`.
- `POST` lần 2 (recognizedDate 2026-09-20) → `201 { data: { id: "rec_B", recognizedDate: "2026-09-20", ... } }`.
- `GET /v1/expenses?projectId=prj_01&month=9&year=2026` → `200 { data: [ rec_B, rec_A ] }` (both, đủ `lines[]`).
- Tổng `actual` tháng 09/2026 = Σ lines của `rec_A` + `rec_B` (confirm) — **không gộp, không mất**.

## 4.4 Sửa bản ghi theo ngày

- `GET /v1/expenses?projectId=prj_01&recognizedDate=2026-09-06` → `200 { data: [ rec_A ] }` (mở đúng bản ghi của ngày đó).
- `PATCH /v1/expenses/rec_A` body `{ "recognizedDate": "2026-09-06", "directNotes": "Đợt 1 - leaflet" }` →
  `200`; `id = "rec_A"` giữ nguyên, `lines[]` giữ nguyên, chỉ ngày/ghi chú đổi.
- `GET /v1/expenses?projectId=prj_01&month=9&year=2026` → `rec_B` không bị ảnh hưởng.

---

# 5. Test case chấp nhận

- [ ] `POST /v1/expenses` 2 lần cùng `(projectId, 09, 2026)` ngày khác nhau → trả **2 id khác nhau**; 
      `GET` trả đủ 2 bản ghi; bản ghi cũ **không phải upsert**, `lines[]` của bản ghi 1 vẫn còn nguyên.
- [ ] Nhập đợt 2 xong → bản ghi đợt 1 (ngày 05/09) vẫn hiển thị đầy đủ trên bảng "Chi phí phát sinh".
- [ ] `PATCH /v1/expenses/rec_A` sửa **ngày phát sinh** 06/09 → 12/09 → `id` & `lines[]` giữ nguyên (không tạo bản ghi
      mới, không xóa dòng); `GET` theo `recognizedDate=2026-09-12` trả đúng `rec_A`; `rec_B` không đổi.
- [ ] `PATCH /v1/expenses/rec_A` (sửa ghi chú/chi phí) → `rec_B` không thay đổi.
- [ ] `DELETE /v1/expenses/rec_A` → `rec_A` mất khỏi mọi query đọc, `rec_B` còn nguyên, tổng chi phí giảm đúng.
- [ ] Confirm line của `rec_A`, draft của `rec_B` → tổng `actual` chỉ tính `rec_A`, draft không vào.
- [ ] Overview `GET /v1/expenses/overview` + Dashboard metrics cộng tổng nhiều bản ghi cùng kỳ **không trùng, không sót**.
- [ ] Không còn lỗi HTTP 500/dup-key khi tạo bản ghi trùng `(projectId, month, year)`.
- [ ] Verify qua Swagger `/api/docs-json`.

---

# 6. Checklist cho backend

- [ ] `POST /v1/expenses`: bỏ upsert theo `(projectId, year, month)` → luôn INSERT; gỡ/cấu hình lại index
      không còn ràng buộc 1 bản ghi/kỳ.
- [ ] `GET /v1/expenses`: trả mọi bản ghi theo filter, thứ tự mặc định `recognizedDate/created_at DESC`,
      mỗi bản ghi đủ `lines[]`; loại `archivedAt IS NULL`; hỗ trợ filter `recognizedDate`.
- [ ] `PATCH /v1/expenses/:id`: sửa được `recognizedDate` của bản ghi **draft** (đổi ngày giữ nguyên `id` + `lines[]`,
      không tạo/xóa gì khác); chỉ tác động đúng 1 bản ghi.
- [ ] `overview`/`report`/Dashboard KPI (`totalExpense`, `cac`, `roas`, `totalWonValue`): cộng tổng mọi bản ghi
      của kỳ (đã loại soft-delete), không giả định 1 bản ghi/kỳ, không cộng trùng.
- [ ] `PATCH`/`DELETE /v1/expenses/:id` chỉ tác động đúng 1 bản ghi.
- [ ] Migration: giữ nguyên dữ liệu cũ; không tạo lại unique `(projectId, month, year)`.
- [ ] Deploy + verify bằng các test case ở mục 5.

---

# 7. Liên quan / còn mở (tham chiếu, không trùng lặp)

Các yêu cầu BE khác đã ghi nhận trước đó, vẫn đang mở — **giữ nguyên** theo `tom-tat-2026-09-06.md` và
`BE-yeu-cau-be-6-9-26-v2.md` (không tóm tắt lại chi tiết ở đây):

- **F8bis** — `expense-plan.totalActual` (Σ confirmed theo project) ≠ cây overview; `overview/tree/project` còn HTTP 500 khi group key null.
- **F10** — cho phép `activate` bản kế hoạch năm `archived` (kèm `confirmReplace`), FE đã có nút "Kích hoạt lại".
- **Chứng từ** — bổ sung `receiptUrl` vào `CreateExpenseLineDto` (hiện chỉ `UpdateExpenseLineDto` có).
- **OpenAPI** — bổ sung mã lỗi `ERR_*`, schema `PATCH /lines/{id}` 200, `AnnualOverviewTreeResponseDto.data`.