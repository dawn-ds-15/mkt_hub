# BE cần sửa — Chi phí (Expense) ngày 08/09/2026

Kiểm chứng trực tiếp trên production `https://mkt-hub.onrender.com/api` (login `a.nguyen@company.com` / demo123,
project HaiDang `a7c3efe0-a415-41d8-bfad-53e004e0ad7a`). Mọi bản ghi test đã xóa sau khi kiểm tra; không ảnh hưởng dữ liệu thật.

## Kết quả re-check (đợt 3 — sau khi BE cập nhật lần 2, cùng ngày)

| # | Vấn đề | Trạng thái |
|---|---|---|
| 1 | `POST /v1/expenses/:id/lines` không gửi `status` → mặc định `confirmed` | ✅ **ĐÃ FIX** |
| 2 | Line không lưu `hangMucLon` / `categoryName` | ✅ **ĐÃ FIX** |
| 3 | Line không lưu `expenseDate`/`recognizedDate` | ✅ **ĐÃ FIX** |
| 4 | Record tự tạo line "phantom" từ `directNotes` | ✅ **HẾT** (không còn sinh line phantom) |
| 5 | Status record vs line lệch nhau | 📌 Ghi chú theo dõi |

**Kết luận: ✅ ĐÃ ĐẠT YÊU CẦU.** Toàn bộ 4 vấn đề đã hết bản cập nhật lần 2.

---

## Vấn đề 1 — default `confirmed` ✅ ĐÃ FIX

Kiểm chứng (đợt 3):
- `POST lines` body KHÔNG có `status` → line trả về `status: "draft"`.
- `PATCH /v1/expenses/lines/:id` trên chính line đó → **200 OK** (sửa được).

→ FE tạo line rồi sửa lại sau đó bình thường, hết 409 `ERR_LINE_ALREADY_CONFIRMED`.

---

## Vấn đề 2 — không lưu `hangMucLon` / `categoryName` ✅ ĐÃ FIX

Kiểm chứng (đợt 3): POST line kèm `hangMucLon: "Hạng mục khác"` → GET trả về đúng `hangMucLon` + `categoryId`. (Đã fix từ đợt 2, xác nhận lại vẫn đúng.)

---

## Vấn đề 3 — không lưu `expenseDate` / `recognizedDate` trên line ✅ ĐÃ FIX

Kiểm chứng (đợt 3): POST line kèm `recognizedDate` + `expenseDate` cùng ngày → GET trả về **cả 2 trường đều lưu đúng**. (Đã fix từ đợt 2, xác nhận lại vẫn đúng.)

---

## Vấn đề 4 — line phantom từ `directNotes` ✅ ĐÃ HẾT

Kiểm chứng (đợt 3): tạo record test → record chỉ có **đúng 1 line** do FE POST; không còn line phantom tự sinh (đợt 2 thấy có, đợt này không còn).

---

## Vấn đề 5 (ghi chú theo dõi)

- Trạng thái record (`draft`/`confirmed`) với line có thể lệch nhau — ghi nhận là hành vi thiết kế, không phải bug.
- Đề nghị ghi rõ trong OpenAPI: line mặc định `draft`, chỉ chuyển `confirmed` khi có tác vụ confirm tường minh.

---

## Phụ lục — test đã chạy (đợt 3)

| Test | Kết quả |
|---|---|
| `POST /v1/expenses` có `recognizedDate` → record lưu đúng ngày | OK |
| `POST lines` không gửi `status` → line | ✅ `draft` |
| `POST lines` kèm `hangMucLon` + `categoryId` → GET trả về | ✅ lưu đầy đủ |
| `POST lines` kèm `recognizedDate` + `expenseDate` → GET trả về | ✅ lưu đầy đủ |
| `PATCH /v1/expenses/lines/:id` (line vừa tạo, không status) | ✅ **200** |
| Line phantom tự sinh khi tạo record | ⚠️ còn ở đợt 2 → ✅ hết đợt 3 |
| Bản ghi test | `255a49ca-…` — đã DELETE thành công (200) |

> Ghi chú: giá trị `H?ng m?c kh?c` trong output console là do PowerShell thiếu font tiếng Việt; dữ liệu thật trên API là `Hạng Mục Khác` đúng chuẩn.