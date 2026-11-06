# Yêu cầu cho Backend — Lịch sử sửa đổi chi phí dự án (Audit snapshot)

> File tổng hợp yêu cầu backend phát sinh từ FE tab "Nhập chi phí" — module Lịch sử Chi Phí.
>
> Nguồn: FE cần hiển thị **từng lần sửa đổi** của một bản ghi chi phí (kể cả khi dự án chỉ có 1 bản ghi),
> mỗi lần sửa là 1 phiên bản, và so phiên bản này với phiên bản liền trước của **chính bản ghi đó**
> để biết "đợt sửa này đã thay đổi những gì".
>
> Liên quan: `BE-yeu-cau-7-9-26.md` (tách bản ghi theo lần nhập, mỗi cùng kỳ nhiều bản ghi),
> `BE-yeu-cau-6-9-26.md` (§ audit trail `expense_audit_logs`), `frontend-backend-sync/03-expense-management.md`.

---

# 1. Bối cảnh & vấn đề

- Hiện tại mỗi lần **nhập mới** (`POST /v1/expenses`) tạo 1 bản ghi riêng → FE so diff giữa các bản ghi duy nhất.
- Nhưng khi **sửa** một bản ghi (`PATCH /v1/expenses/:id`, `PATCH/DELETE /v1/expenses/lines/:id`),
  backend **ghi đè** lên chính bản ghi đó → bản cũ biến mất, không có nguồn để so "đã thay đổi gì so với lần trước".
- Kết quả: dự án chỉ có 1 bản ghi (vd đã sửa nhiều lần) → popup **không hiển thị** được phần "thay đổi những gì".

# 2. Yêu cầu thay đổi

## 2.1 Bảng `expense_audit_logs`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID PK | |
| `expense_id` | UUID FK → expense_records | Bản ghi chi phí |
| `action` | ENUM `created` / `updated` | Loại phiên bản |
| `changed_by` | UUID NULL | Người thao tác |
| `at` | TIMESTAMP | Thời điểm snapshot (đồng nghĩa `created_at`) |
| `expense_date` | DATE NULL | Ngày phát sinh của bản ghi tại thời điểm snapshot |
| `snapshot` | JSONB | Toàn bộ record + `lines[]` **sau** thay đổi |

## 2.2 Ghi snapshot tại các mutation

| Mutation | Ghi log |
|---|---|
| `POST /v1/expenses` | 1 log `created` (snapshot khởi tạo, kèm lines[] nếu có) |
| `PATCH /v1/expenses/:id` | 1 log `updated` (snapshot sau khi sửa record) |
| `POST /v1/expenses/:id/lines` | 1 log `updated` ở cấp record |
| `PATCH /v1/expenses/lines/:id` | 1 log `updated` ở cấp record |
| `DELETE /v1/expenses/lines/:id` | 1 log `updated` ở cấp record |

- Snapshot phải chứa **đủ thông tin như `GET /v1/expenses/:id`**: `id`, `projectId`, `month`, `year`,
  `recognizedDate`/`expenseDate`, `directCost`, `directNotes`, `overheadCost`, `overheadNotes`, `status`, `lines[]`
  (mỗi line đủ `id`, `name`, `hangMucLon`, `categoryId`, `plannedQuantity`, `actualQuantity`, `vatRate`,
  `unitPriceBeforeVat`, `unitPriceAfterVat`, `actualUnitPrice`, `note`...).
- Snapshot được lưu **sau** khi thao tác thành công (post-commit) trong cùng transaction.

## 2.3 API mới

### `GET /v1/expenses/:id/history`

Trả lịch sử các phiên bản của bản ghi, **sắp xếp `at ASC`** (cũ → mới), dòng đầu là `created`.

```json
{
  "data": [
    {
      "id": "log_01",
      "action": "created",
      "at": "2026-09-13T09:00:00.000Z",
      "changedBy": "user_01",
      "expenseDate": "2026-09-13",
      "snapshot": { "...full record + lines[]..." }
    },
    {
      "id": "log_02",
      "action": "updated",
      "at": "2026-09-13T10:30:00.000Z",
      "changedBy": "user_02",
      "expenseDate": "2026-09-13",
      "snapshot": { "...full record + lines[]..." }
    }
  ]
}
```

- Nếu bản ghi không tồn tại → `404`.
- Bản ghi đã soft-delete → `404`.
- Không có log nào → trả `{ data: [] }`.

## 2.4 Tương thích dữ liệu cũ

- Không tạo log cho các bản ghi/log có trước khi tính năng ra mắt.
- Không đụng dữ liệu hiện có; các yêu cầu FE–BE khác giữ nguyên.

---

# 3. Quy tắc nghiệp vụ / validation

| # | Quy tắc | Mã trả về |
|---|---|---|
| 1 | Mỗi mutation thành công ghi đúng 1 snapshot `created`/`updated` | — |
| 2 | Snapshot lưu trong cùng transaction với mutation (rollback thì không ghi) | — |
| 3 | `GET /v1/expenses/:id/history` không cần phân quyền đặc biệt (guard JWT chung) | 401/403 chung |
| 4 | Bản ghi/line bị chặn sửa (vd confirmed/cancelled) thì **không** ghi log | 400/403 như hiện tại |

---

# 4. Checklist cho backend

- [x] Tạo bảng/migration `expense_audit_logs` (cột theo §2.1).
- [x] Ghi snapshot `created` khi `POST /v1/expenses`.
- [x] Ghi snapshot `updated` khi `PATCH /v1/expenses/:id`.
- [x] Ghi snapshot `updated` khi thêm/sửa/xóa line (`POST/PATCH/DELETE` lines).
- [x] `GET /v1/expenses/:id/history` trả `{ data: [...] }` sắp theo `at ASC`, snapshot đủ `lines[]`.
- [x] Snapshot + mutation nằm trong cùng transaction.
- [x] Swagger `/api/docs-json` cập nhật DTO + mã lỗi.
- [x] Deploy + verify bằng test thực tế (tạo → sửa 2 lần → `GET history` trả 3 phiên bản).

> **Trạng thái 09/09/2026:** ✅ **ĐÃ TRIỂN KHAI.** Verify thực tế trên production:
> tạo record → `history` trả `created` (0 lines) → thêm line → `updated` (1 line, 09-12) →
> PATCH line → `updated` (1 line, 09-14). Snapshot đủ `lines[].expenseDate`/`recognizedDate` từng dòng.

---

# 5. Đối chiếu FE ↔ BE

| FE (services/api.js) | Endpoint | Kỳ vọng |
|---|---|---|
| `getExpenseHistory(id)` | `GET /v1/expenses/:id/history` | Mảng phiên bản sắp `at ASC`, mỗi phần tử có `action/at/changedBy/expenseDate/snapshot` |

> Nếu backend chưa triển khai → `GET history` lỗi/404 → FE tự động rơi vào **fallback**:
> so diff giữa các bản ghi phát sinh riêng biệt (hành vi trước đây), không vỡ UI.
