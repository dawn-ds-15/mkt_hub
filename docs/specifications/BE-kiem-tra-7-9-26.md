# Kiểm tra Backend — Đối chiếu yêu cầu 07/09/2026 (kết quả kiểm tra 08/09/2026)

> Kiểm tra trực tiếp trên môi trường deploy `https://mkt-hub.onrender.com` (Swagger: `/api/docs-json`).
> Tài khoản dùng để test: `a.nguyen@company.com` (role `manager`) — login `POST /api/auth/login` OK.
>
> Kết quả: **BECHƯA ĐẠT yêu cầu `BE-yeu-cau-7-9-26.md`.** Toàn bộ API thao tác **record chi phí** đang trả
> **HTTP 500 "Internal server error"**, không thể kiểm chứng hành vi mới (bỏ upsert / sửa theo ngày).

---

## 1. Kết quả gọi thực tế từng endpoint

### 1.1 Nhánh record chi phí — ĐỀU LỖI HTTP 500

| Endpoint | Kết quả thực tế | Kỳ vọng theo yêu cầu 07/09 |
|---|---|---|
| `GET /v1/expenses` (không tham số) | **500** | `200` — mảng mọi bản ghi |
| `GET /v1/expenses?projectId=<uuid hợp lệ>&year=2027&month=9` | **500** | `200` — mảng mọi bản ghi theo filter |
| `GET /v1/expenses?projectId=<uuid>&recognizedDate=2027-09-07` | **500** | `200` — filter theo ngày phát sinh (mục 2.2 item 5) |
| `GET /v1/expenses/<id bất kỳ>` (cả id không tồn tại) | **500** (đáng lẽ phải 404 nếu chạy đúng luồng tìm) | `200` 1 bản ghi / `404` nếu không có |
| `POST /v1/expenses` (payload hợp lệ, projectId tồn tại) | **500** | `201` — **luôn tạo bản ghi mới** (mục 2.1) |
| `POST /v1/expenses` sử dụng projectId giả | `404 "Không tìm thấy dự án."` | — (validation chạy được, lỗi ở bước sau lookup dự án) |
| `PATCH /v1/expenses/<id>` | **500** | `200` — sửa ngày phát sinh, giữ `id` + `lines[]` (mục 2.3) |
| `DELETE /v1/expenses/<id>` | **500** | `200` — soft-delete đúng 1 bản ghi |
| `POST /v1/expenses/<id>/lines` | **500** | `201` — thêm dòng cho bản ghi |
| `POST /v1/expenses/lines/<id>/confirm` | **500** | `200` — confirm line |
| `GET /v1/expenses/overview?year=2026` | **500** | `200` — tổng hợp cộng mọi bản ghi (mục 2.4) |
| `GET /v1/expenses/report?year=2026` | **500** | `200` — tổng hợp cộng mọi bản ghi (mục 2.4) |
| `GET /v1/expenses/actuals` | **500** | `200` |

### 1.2 Hoạt động bình thường (để đối chiếu — lỗi không phải do auth/token)

| Endpoint | Kết quả |
|---|---|
| `POST /api/auth/login` | `200` |
| `GET /v1/expenses/overview/tree/annual/2026` | `200` (cây kế hoạch) |
| `GET /v1/expense-budgets/tree` | `200` |
| `GET /v1/expense-budgets/summary` | `200` |
| `GET /v1/expense-budgets/values?year=2026` | `200` |
| `GET /api/budgets/summary` | `200` |
| `GET /v1/dashboard/overview?year=2026` | `200` |
| `GET /v1/dashboard/kpi-cards?year=2026` | `200` |
| `GET /v1/dashboard/progress?year=2026` | `200` |
| `GET /v1/projects` | **500** (cũng lỗi — nhánh đọc dự án) |

---

## 2. Chẩn đoán

- Lỗi xảy ra **ngay cả khi gọi với id/bản ghi không tồn tại** (ví dụ `11111111-1111-4111-8111-111111111111`) —
  handler **vỡ trước khi đạt bước kiểm tra "tồn tại / 404"**. Với thanh ghi hợp lệ thì phải trả 404, không phải 500.
- Trong khi đó nhánh kế hoạch/ngân sách (`expense-budgets`, `budgets`, `expenses/overview/tree/annual`) vẫn chạy tốt
  → **DB có dữ liệu, kết nối tốt, token OK**. Vậy lỗi nằm ở **truy vấn/schema của các bảng record chi phí**
  (`expense_records`, `expense_lines`, …) — khả năng cao **code BE mới (đã mang logic tách bản ghi/ngày) chưa khớp với
  migration DB đang deploy** (thiếu cột/bảng → mọi câu SQL trên nhánh record đều vỡ 500).
- `POST /v1/expenses` với projectId giả trả `404 "Không tìm thấy dự án."` chứ không 500 → validation DTO chạy được;
  lỗi 500 nằm ở đoạn sau lookup dự án (khi INSERT/ghi dữ liệu).

## 3. Chưa thể kiểm chứng (bị chặn bởi lỗi 500)

- [ ] `POST /v1/expenses` 2 lần cùng `(projectId, kỳ)` → 2 id khác nhau (bỏ upsert) — **không test được**.
- [ ] `GET /v1/expenses` trả đủ nhiều bản ghi/kỳ, lọc `recognizedDate` — **không test được**.
- [ ] `PATCH /v1/expenses/:id` đổi ngày giữ nguyên `id` + `lines[]`; bản ghi khác không đổi — **không test được**.
- [ ] `DELETE /v1/expenses/:id` chỉ xóa 1 bản ghi — **không test được**.
- [ ] Overview/report/KPI cộng tổng nhiều bản ghi không trùng/sót — **không test được**.

(Không tạo được test data vì `POST` đều 500 → **không để lại dữ liệu lạ** trên môi trường.)

## 4. Việc cần làm phía BE để mở khóa

1. **Khắc phục HTTP 500** ở nhánh record: đối chiếu migration DB với code mới (thiếu cột nào: ví dụ
   `recognizedDate`/`expense_date` ở record, `unit_price_before_vat…`, `archived_at`, snapshot giá…), kiểm tra log
   lỗi trên Render cho từng endpoint 500 ở mục 1.1.
2. Sau khi hết 500, xác nhận từng test case trong mục 5 của `BE-yeu-cau-7-9-26.md`:
   `POST` trùng `(projectId, month, year)` → tạo mới; `GET` nhiều bản ghi/kỳ + filter `recognizedDate`;
   `PATCH` sửa ngày giữ `id` + `lines[]`; `DELETE` đúng 1 bản ghi; aggregates cộng tổng không trùng.
3. Rà lại luôn `GET /v1/projects` (500) — nhánh đọc dự án cũng dính lỗi tương tự, sẽ chặn cả FE.
4. Đối chiếu thêm các mục mở cũ: `F8bis`, `F10`, `receiptUrl` trong `CreateExpenseLineDto`, mã lỗi `ERR_*`
   trong OpenAPI (mục 7 của `BE-yeu-cau-7-9-26.md`, `tom-tat-2026-09-06.md`).