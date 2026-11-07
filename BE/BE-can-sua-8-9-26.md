# BE cần sửa — Chi phí (Expense) ngày 08/09/2026

Kiểm chứng trực tiếp trên production `https://mkt-hub.onrender.com/api` (login `a.nguyen@company.com` / demo123,
project HaiDang `a7c3efe0-a415-41d8-bfad-53e004e0ad7a`). Mọi bản ghi test đã xóa sau khi kiểm tra; không ảnh hưởng dữ liệu thật.

---

## Vấn đề 1 — `POST /v1/expenses/:id/lines` mặc định tạo line `confirmed`

**Hiện trạng:** Khi tạo line KHÔNG gửi trường `status`, BE tự gán `status = confirmed`.

Kiểm chứng:
- `POST /v1/expenses/:id/lines` body `{ name, categoryId, isCustom, plannedQuantity, actualQuantity, unitPriceBeforeVat, expenseDate }` (đúng như payload FE `buildLinePayload`) → response line `status: "confirmed"`, `confirmedAt` có giá trị.
- Dòng FE tự tạo qua form chi phí đều không gửi `status` → **mọi line mới đều confirmed ngay khi lưu**.
- Hệ quả: `PATCH /v1/expenses/lines/:id` trên line này trả **409** (xác nhận: bản test status=confirmed → 409; bản test gửi `status:"draft"` → 200 OK, sửa được).

Tác động:
- FE thiết kế theo flow "tạo rồi sửa"/"sửa ngay sau khi lưu" (dirty tracking, nút Cập nhật chi phí): toàn bộ update line sau lưu đều bị 409 `ERR_LINE_ALREADY_CONFIRMED`, không sửa được số lượng/đơn giá/ghi chú/hạng mục.
- Trước đây để sửa phải xóa cả bản ghi cost + tạo bản ghi mới.

**Đề xuất:** Mặc định line sinh ra ở trạng thái **`draft`**, chỉ chuyển `confirmed` khi có tác vụ confirm tường minh (ví dụ action `confirm` / xác nhận thực tế). Nếu cần giữ hành vi auto-confirm, hãy thêm vào payload một cờ rõ ràng thay vì mặc định ngầm.

---

## Vấn đề 2 — Line KHÔNG lưu `hangMucLon` (tên hạng mục lớn)

**Hiện trạng:** Khi tạo/sửa line gửi kèm `hangMucLon: "Hạng mục khác"` (hoặc tên nhóm khác), BE chỉ lưu `categoryId`; không bao giờ trả lại `hangMucLon` (luôn `''`/thiếu field).

Kiểm chứng (các line thật & test):
- Line `test` — `categoryId = e728a31e-…`, `hangMucLon` = **''**.
- Line `leaflet` (Vật phẩm) — `categoryId = b2ce14b7-…`, `hangMucLon` = **''**.
- Test tạo line có `hangMucLon` trong body → GET không thấy field này.

Tác động:
- FE phải tự "map ngược" `categoryId → tên hạng mục` mỗi khi load bản ghi để điền dropdown; nếu category bị xóa/mất đối chiếu thì dropdown rỗng.
- Mọi report/tổng hợp theo tên hạng mục phía BE (nếu dùng `hangMucLon`) đều trống.

**Đề xuất:** Persist `hangMucLon` (hoặc ít nhất `categoryName`/snapshot tên) vào line và trả về trong response; giữ đồng bộ khi nhóm ngân sách đổi tên.

---

## Vấn đề 3 — Line KHÔNG lưu `expenseDate`; trường BE dùng là `recognizedDate`

**Hiện trạng:** FE gửi `expenseDate` trong payload line, BE bỏ qua trường này; trường ngày duy nhất tồn tại ở line là `recognizedDate`.

Kiểm chứng:
- `POST lines` gửi `{ ..., "expenseDate":"2026-09-04" }` → response line `expenseDate` = (không có), `recognizedDate` = `null`.
- `POST lines` gửi `{ ..., "recognizedDate":"2026-09-04" }` → response `recognizedDate = 2026-09-04` (có lưu).
- Line thật luôn `recognizedDate: null`.

Tác động:
- Ngày của dòng không lưu được → FE phải đổi ngày ở mức bản ghi bằng `PATCH /v1/expenses/:id` (chỉ sửa được khi record `draft`).
- Lọc/sắp xếp/báo cáo theo ngày từng dòng không chính xác.

**Đề xuất:**
- Nhận thêm field `expenseDate` ở line làm alias cho `recognizedDate`, HOẶC
- FE chuyển sang gửi `recognizedDate` ở line và BE persist nó (đã chứng minh BE lưu được khi gửi đúng tên trường).
- Ghi rõ trong OpenAPI: line chỉ có `recognizedDate`, không có `expenseDate`.

---

## Vấn đề 4 (ghi chú, chưa khẳng định là bug) — Status record vs line lệch nhau

- Record `draft` vẫn có thể chứa line `confirmed` (vd record `402c29e4-…` status=draft, lines `draft,confirmed,confirmed,confirmed`).
- Nếu giữ cơ chế "record confirm = tổng hợp của line confirm" hãy tài liệu hóa rõ; FE hiện lấy theo line để tính actual.

---

## Phụ lục — các test đã chạy (tóm tắt)

| Test | Kết quả |
|---|---|
| `POST /v1/expenses` không có ngày → sinh `recognizedDate` mặc định | OK (tạo được, ngày mặc định tháng đầu kỳ) |
| `POST /v1/expenses` có `recognizedDate` → record lưu đúng ngày | OK |
| `PATCH /v1/expenses/:id` đổi `recognizedDate` (record draft) | **OK** — 05/09 → 12/09, id/lines giữ nguyên |
| `PATCH /v1/expenses/:id` đổi ngày khi record có line confirmed | **OK** — 03/09 → 15/09 (không bị chặn, record vẫn draft) |
| `POST /v1/expenses/:id/lines` không `status` | Line `confirmed` ngay (VẤN ĐỀ 1) |
| `POST /v1/expenses/:id/lines` với `status:"draft"` | Line `draft` |
| `PATCH /v1/expenses/lines/:id` line confirmed | **409** |
| `PATCH /v1/expenses/lines/:id` line draft | **200** |
| Line gửi `expenseDate` | Không lưu (VẤN ĐỀ 3) |
| Line gửi `recognizedDate` | Lưu được |
| Bản ghi test | `86b3395d…` / `bb91b8d7…` / `559fe3e9…` — đều đã DELETE thành công (200) |