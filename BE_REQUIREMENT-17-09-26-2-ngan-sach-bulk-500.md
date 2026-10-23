# BE Requirement — Lỗi 500 khi bulk save ngân sách lớn (17/09/2026)

> Môi trường verify: `https://mkt-hub.onrender.com/api` (login `a.nguyen@company.com` / `demo123`, role manager).
> Người gửi: FE team. Độ ưu tiên: **Cao** — chặn trắng tab "Nhập chi phí tổng hạng mục".

## 1. Hiện tượng

`PUT /v1/expense-budgets/values` trả về `500 {"statusCode":500,"message":"Internal server error"}`
khi mảng `values[]` vượt ngưỡng ~120 dòng.

Verify trực tiếp 17/09/2026 (nén cùng 1 request, `baseUpdatedAt` hợp lệ):

| Số dòng values[] | Kết quả |
|---|---|
| 7 | 200 |
| 24 | 200 |
| 84 | 200 |
| **132** | **500** |
| 372 | 500 |
| 792 | 500 |

Giao dịch bị **rollback nguyên phần** khi 500 (GET /tree sau đó trả lại `updatedAt` cũ, không có dòng nào được ghi).

## 2. Tác động

- Tab "Nhập chi phí tổng hạng mục" (`CategoryBudgetEntry`) gửi toàn bộ cây ngân sách 2026
  (648 dòng item + 108 dòng nhóm lớn + ~36 dòng backup ≈ **792 dòng**) trong 1 request → **luôn 500**.
- điều này làm cho người dùng không lưu được ngân sách loại hạng mục.

## 3. Nghi vấn gốc rễ

Triệu chứng khớp với giới hạn ~999 tham số trong 1 câu lệnh SQL (SQLite/transaction engine):
mỗi dòng ~8 tham số → ~124 dòng tối đa/lệnh. Khả năng cao code đang chạy **bulk insert/upsert 1 câu
lệnh duy nhất** chứa toàn bộ `values[]`.

## 4. Yêu cầu BE

1. **Xử lý được request chứa ~800-1.000+ dòng `values[]` trong 1 lần PUT** và trả 200.
   Gợi ý: chia nhỏ nội bộ thành nhiều batch/upsert từng dòng, hoặc insert multi-row không
   vượt giới hạn tham số của cơ sở dữ liệu.
2. Không trả 500 mù mịt: với lỗi dữ liệu vẫn trả `400` kèm `errors[]` chi tiết từng dòng
   (đã đúng hiện tại với request nhỏ — giữ hành vi này ở kích thước lớn).
3. Giữ nguyên `baseUpdatedAt` (optimistic lock) và trả `412 { message, currentUpdatedAt }` khi
   xung đột phiên bản — không được biến thành 500.
4. Bổ sung test: PUT 800 dòng hợp lệ (trộn categoryId + itemId + subcategoryId isBackup)
   → expect `200`; đọc lại GET /tree thấy giá trị vừa ghi.

## 5. Workaround phía FE (đã áp dụng 17/09)

- Chỉ gửi các dòng **bị sửa** (theo `dirtyKeys`: `${itemId}:plan:${month}` /
  `${subId}:backup:${month}`) + 12 dòng rollup của nhóm cha → payload nhỏ trong thường hợp thường.
- Chia lô **≤ 80 dòng/request**; mỗi lô **lấy `baseUpdatedAt` mới từ GET /tree trước khi gửi**
  (lô trước đã làm đổi `updatedAt`), tránh 412.
- Đã verify: 80 dòng/lô → 200; lô trước ghi cuối cùng đọc lại đúng giá trị.
- Chờ BE sửa gốc rễ (mục 4) thì FE có thể quay lại 1 request.