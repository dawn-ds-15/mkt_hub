# Yêu cầu cho Backend — Ngày 09/09/2026

> File tổng hợp các yêu cầu dành cho backend phát sinh ngày 09/09/2026.
> Mọi yêu cầu BE viết sau ngày này cũng được thêm vào file này (có ngày kèm theo).
>
> Ngày tạo: 09/09/2026
> Nguồn: FE module **Lịch sử Chi Phí** (`ExpenseHistory`) — lỗi QA phát hiện khi sửa chi phí:
> **ngày phát sinh của các dòng bị trùng nhau dù từng dòng có ngày phát sinh độc lập.**
> Môi trường verify: `https://mkt-hub.onrender.com` (OpenAPI `/api/docs-json`, 09/09).
> Liên quan: `BE-can-sua-8-9-26.md` (mục 3 — BE đã fix lưu `expenseDate`/`recognizedDate` trên line),
> `BE-yeu-cau-expense-audit-9-9-26.md` (audit snapshot history).

---

## Mục lục

- [1. Vấn đề đang chặn — ngày phát sinh từng dòng bị trùng sau khi lưu](#1-vấn-đề-đang-chặn--ngày-phát-sinh-từng-dòng-bị-trùng-sau-khi-lưu)
- [2. Yêu cầu 9.1 — `GET /v1/expenses` trả đủ ngày trên từng `lines[]`](#2-yêu-cầu-91--get-v1expenses-trả-đủ-ngày-trên-từng-lines)
- [3. Yêu cầu 9.2 — `POST/PATCH lines` bắt buộc lưu `expenseDate`/`recognizedDate` từng dòng](#3-yêu-cầu-92--postpatch-lines-bắt-buộc-lưu-expensedate--recognizeddate-từng-dòng)
- [4. Yêu cầu 9.3 — `PATCH /v1/expenses/:id` không ghi đè ngày theo line](#4-yêu-cầu-93--patch-v1expensesid-không-ghi-đè-ngày-theo-line)
- [5. Yêu cầu 9.4 — snapshot audit phải chứa ngày từng line](#5-yêu-cầu-94--snapshot-audit-phải-chứa-ngày-từng-line)
- [6. Test chấp nhận](#6-test-chấp-nhận)

---

## Trạng thái triển khai — verify thực tế `mkt-hub.onrender.com/api` ngày 09/09/2026 (2 đợt)

> **Đợt 1** (trước khi BE cập nhật): tạo record `8cf2c71c-…` + 2 line ngày khác nhau (09-15, 09-20),
> PATCH record lên 09-25, PATCH 1 line, rồi xóa record test.
> **Đợt 2** (sau khi BE cập nhật lần sau): tạo record `970d89c8-…` + line A ngày 09-12, PATCH line A → 09-14,
> xóa record test. Kết quả chung:

| # | Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `GET /v1/expenses` trả `lines[].expenseDate`/`recognizedDate` | ✅ **ĐẠT** | Mọi line trong list/`GET :id` đều trả đủ 2 trường. |
| 2 | `POST/PATCH lines` lưu ngày chính xác từng dòng | ✅ **ĐẠT** | Line A lưu 09-15, Line B lưu 09-20; PATCH line A → 09-18 **không** đổi line B (09-20). |
| 3 | `PATCH /v1/expenses/:id` không ghi đè ngày line | ✅ **ĐẠT** | PATCH record → 09-25; 2 line vẫn giữ ngày riêng (09-18, 09-20). |
| 4 | `GET /v1/expenses/:id/history` (audit snapshot) | ✅ **ĐẠT** | Route có trong OpenAPI; trả 3 snapshot: `created` → `updated` (add line) → `updated` (PATCH line). Snapshot đủ `lines[].expenseDate`/`recognizedDate` từng dòng. |

**Kết luận cuối:** Toàn bộ 4 yêu cầu 9-9-26 **đã đạt**. Bug ngày các dòng bị ghi đè trùng **hết**;
ngày từng dòng độc lập, record không ghi đè line; **audit history đã triển khai** và snapshot chứa đúng
ngày từng dòng → popup "So với lần nhập gần nhất" của FE có thể diff đúng theo dòng.

---

## 1. Vấn đề đang chặn — ngày phát sinh từng dòng bị trùng sau khi lưu

**Hiện tượng QA (FE 09/09):**
- Form "Nhập chi phí dự án" (`ExpenseEntryForm`) đã cho phép **mỗi dòng một ngày phát sinh riêng**
  (DB nhập 5 dòng, mỗi dòng ngày khác nhau), cột đầu bảng là input `date`.
- Sau khi bấm **Lưu chi phí**, mở lại **Lịch sử Chi Phí** / **popup chi tiết** → **cột "Ngày phát sinh"
  của cả 5 dòng hiển thị y hệt nhau** (bằng ngày hôm đó), mặc dù lúc nhập có ngày khác nhau.
- Ngay trong popup chi tiết (bảng "Các dòng chi phí"), cột "Ngày phát sinh" cũng trùng.

**Nghi vấn gốc rễ (cần BE xác nhận):**
1. `POST /v1/expenses/:id/lines` lưu `expenseDate`/`recognizedDate` có đúng **giá trị của từng dòng**
   mà FE gửi không, hay bị thay bằng ngày của record?
2. Khi FE sửa nhiều dòng (`PATCH /v1/expenses/lines/:id`), BE có lưu đúng ngày mới từng dòng không?
3. Thuộc tính ngày của record (`PATCH /v1/expenses/:id` với `expenseDate`) có bị dùng để **đồng loạt
   ghi đè** ngày của các line không?

**Kỳ vọng cuối:** mỗi line giữ nguyên ngày phát sinh độc lập của nó ở tất cả nơi hiển thị
(form khi sửa lại, bảng lịch sử, popup chi tiết) ngay cả khi các line cùng record khác ngày nhau.
Cột "Ngày phát sinh" của bản ghi = **ngày lớn nhất (mới nhất)** trong các line của bản ghi đó.

---

## 2. Yêu cầu 9.1 — `GET /v1/expenses` trả đủ ngày trên từng `lines[]`

- `GET /v1/expenses` (kể cả khi truyền `projectId`) trả mỗi element có `lines[]`;
  mỗi line (`GET /v1/expenses/:id` tương tự) **phải có đủ**:

```json
{
  "id": "line_01",
  "name": "test",
  "hangMucLon": "Chào hàng",
  "categoryId": "cat_01",
  "plannedQuantity": 1,
  "actualQuantity": 1,
  "vatRate": 5,
  "unitPriceBeforeVat": 100000,
  "unitPriceAfterVat": 105000,
  "expenseDate": "2026-09-17",
  "recognizedDate": "2026-09-17",
  "note": ""
}
```

- `expenseDate`/`recognizedDate` của line là **input date thuần (YYYY-MM-DD)**, không giờ; lấy nguyên
  giá trị FE gửi, **không** fallback/thay bằng `recognizedDate`/`expenseDate` của record.

---

## 3. Yêu cầu 9.2 — `POST/PATCH lines` bắt buộc lưu `expenseDate`/`recognizedDate` từng dòng

- Với **`POST /v1/expenses/:id/lines`**: body gửi kèm `expenseDate`; record line lưu đúng giá trị đó.
  Nếu body thiếu `expenseDate` → **mặc định ngày của record** (giữ hành vi cũ), không dừng request.
- Với **`PATCH /v1/expenses/lines/:id`**: cập nhật ngày mới nếu body gửi; lưu đúng từng line.
- **KHÔNG** được ghi lại ngày từ record struct sang từng line tại bất kỳ mutation nào
  (trừ khi line của chính nó thiếu ngày).
- Xác nhận: `PATCH lines` sửa ngày dòng A **không ảnh hưởng** ngày dòng B cùng record.

---

## 4. Yêu cầu 9.3 — `PATCH /v1/expenses/:id` không ghi đè ngày theo line

- Khi FE sửa ngày các dòng rồi cập nhật record theo **ngày mới nhất** (hành vi hiển thị), BE
  **chỉ** cập nhật `expenseDate`/`recognizedDate` ở cấp record; **không lan sang** ngày các line.
- Tránh tình huống: record ngày mới nhất → BE "đồng bộ xuống" toàn bộ line → mất ngày riêng từng dòng.

---

## 5. Yêu cầu 9.4 — Snapshot audit phải chứa ngày từng line

- Tuân theo `BE-yeu-cau-expense-audit-9-9-26.md`: snapshot trong `expense_audit_logs` phải chứa
  đủ `lines[]` với `expenseDate`/`recognizedDate` **của chính từng line**.
- Hệ quả bắt buộc: để phần **"So với lần nhập gần nhất"** trong popup chi tiết compare đúng theo
  **từng dòng** (gồm cả ngày), line là nguồn duy nhất cho ngày phát sinh — không dùng ngày record.

---

## 6. Test chấp nhận

- [x] `POST lines` 2 dòng ngày khác nhau → `GET /v1/expenses/:id` trả từng line đúng ngày riêng. *(verify: 09-15 & 09-20)*
- [x] `PATCH lines` đổi ngày dòng A → `GET` vẫn giữ ngày dòng B cũ; record không đổi trừ khi FE cập nhật. *(verify: A→09-18, B giữ 09-20)*
- [x] Record ngày mới nhất → ngày từng line **không bị** đè về ngày record. *(verify: record→09-25, lines giữ 09-18/09-20)*
- [x] `GET /v1/expenses` (có `projectId`) vẫn trả `lines[]` đủ ngày.
- [ ] Cột "Ngày phát sinh" bản ghi (FE) = ngày **lớn nhất** trong các line. *(FE tự tính; cần xác nhận hiển thị trên UI)*
- [x] Audit history: snapshot so với bản trước đúng `expenseDate` từng dòng. *(verify: add line→09-12, PATCH→09-14)*