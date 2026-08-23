# Hồ sơ API Backend bổ sung — ✅ HOÀN THÀNH & ĐÃ KIỂM THỬ (21/08/2026)

> Tài liệu gốc: yêu cầu FE gửi backend (ra soát `FE/services/api.js` + tài liệu `specification/`).
> **Cập nhật 21/08/2026:** Backend đã triển khai đủ, FE đã tích hợp xong API thật
> (bỏ localStorage), đã kiểm thử end-to-end trên production `https://mkt-hub.onrender.com/api`
> bằng tài khoản `a.nguyen@company.com`. **Không còn mục nào backend phải sửa.**

---

## Phần 1 — Module Hồ sơ & Hợp đồng theo dự án ✅ ĐÃ XONG

### Endpoint đã có trên BE (đúng spec)

| # | Method | Endpoint | Function FE | Trạng thái |
|---|--------|----------|-------------|------------|
| 1 | GET | `/api/v1/projects/{id}/documents` | `getProjectDocuments(id)` | ✅ Đã test |
| 2 | POST | `/api/v1/projects/{id}/documents` | `uploadProjectDocuments(id, files, category)` | ✅ Đã test |
| 3 | PATCH | `/api/v1/projects/documents/{id}` | `updateProjectDocument(docId, category)` | ✅ Đã test |
| 4 | DELETE | `/api/v1/projects/documents/{id}` | `deleteProjectDocument(docId)` | ✅ Đã test |

### Kết quả kiểm thử thực tế

- Upload **2 file cùng lúc** (`multipart/form-data`, fields `files[]` + `category=hopdong`) → OK,
  trả `{ data: [ProjectDocumentDto...] }` đầy đủ field.
- PATCH đổi category `hopdong` → `hoso` → OK.
- DELETE xóa mềm → OK; list tự loại bản ghi đã xóa (`archivedAt IS NULL`).
- `documentsCount` trong `GET /v1/projects` và `GET /v1/projects/{id}` cập nhật realtime: 0 → 2 → 1.
- Validate đúng: project không tồn tại → 404 `"Không tìm thấy dự án."`; category sai enum → 400;
  upload thiếu file → 400 `"Vui lòng chọn ít nhất một file để tải lên."`.
- Swagger có khai báo DTO ngay từ đầu: `ProjectDocumentDto`, `ProjectDocumentsListResponseDto`,
  `ProjectDocumentSingleResponseDto`, `UpdateProjectDocumentDto`.

### Tích hợp phía FE (đã xong)

- `FE/services/api.js`: thêm `DOC_CATEGORY`, `getProjectDocuments`, `uploadProjectDocuments`,
  `updateProjectDocument`, `deleteProjectDocument`; `mapProject` thêm `documentsCount`
  (fallback `_count.documents`).
- `FE/pages/ProjectDetail.jsx`: upload/list/đổi loại/xóa mềm đều gọi API thật, có trạng thái
  uploading/loading và toast lỗi.
- `FE/components/Projects/ProjectListTable.jsx`: cột **Hồ sơ** đọc `documentsCount` từ response
  danh sách dự án (không gọi N lần).
- Đã xóa `FE/utils/projectDocumentsStore.js` (localStorage) — không còn dùng.

---

## Phần 2 — Dropdown Config ✅ ĐÃ XONG

### 2.1 Label tiếng Việt cho các khóa dropdown ✅

`GET /v1/data-management/dropdowns` đã trả label tiếng Việt cho cả 10 khóa (đã xác minh):

| Key | Label BE trả |
|-----|--------------|
| `company_size` | Phân khúc Khách hàng |
| `contract_status` | Trạng thái Hợp đồng |
| `currency` | Tiền tệ |
| `lead_source` | Nguồn Leads |
| `opportunity_status` | Trạng thái Cơ hội |
| `project_status` | Trạng thái Dự án |
| `project_type` | Loại Dự án |
| `stakeholder` | Bên liên quan |
| `task_priority` | Độ ưu tiên Task |
| `task_status` | Trạng thái Task |

### 2.2 Soft-delete cho dropdown values — giữ nguyên trạng thái TÙY CHỌN (mức THẤP)

- Vẫn đang ẩn phía client (localStorage `mkt_hub_deleted`, composite id `keyId:valueId`).
- Chờ ưu tiên từ BA, chưa yêu cầu backend làm.

### 2.3 Không cần làm ✅

- Reorder values: FE dùng sẵn `PUT /v1/data-management/dropdowns/:key` — hoạt động tốt.

---

## Phần 3 — Tồn đọng cũ ✅ ĐÃ XONG HẾT

| # | Việc | Trạng thái |
|---|------|-----------|
| 1 | Response DTO OpenAPI cho 12 endpoint inventory + `PATCH /v1/expenses/{id}` | ✅ Cả 13 endpoint đều đã có `$ref` schema (đã verify docs-json) |
| 2 | `WeeklyReportsService.scope()` filter `archivedAt: null` | ✅ Đã fix — test thực tế: tạo task Done tuần 34/2026 → hiện trong mục `done` của báo cáo tuần → xóa mềm task → biến mất khỏi báo cáo |

---

## Phần 4 — Checklist backend ✅ 100% HOÀN THÀNH

- [x] Tạo module Project Document: entity + DTO + service (soft-delete `archivedAt`)
- [x] `GET /api/v1/projects/{id}/documents`
- [x] `POST /api/v1/projects/{id}/documents` (multipart, nhiều file + category)
- [x] `PATCH /api/v1/projects/documents/{id}` (category)
- [x] `DELETE /api/v1/projects/documents/{id}` (soft-delete)
- [x] Thêm `documentsCount` vào response `GET /v1/projects`
- [x] Populate `label` tiếng Việt cho mọi khóa dropdown
- [ ] *(Tùy chọn — mức THẤP, chờ BA)* Soft-delete cho dropdown values
- [x] Khai báo response DTO OpenAPI cho 12 endpoint inventory + `PATCH /expenses/{id}`
- [x] Thêm `archivedAt: null` vào `WeeklyReportsService.scope()`

---

## Ghi chú dọn dữ liệu test

Các bản ghi tạo khi kiểm thử đều đã được xóa mềm (không hiển thị trên UI):
- Project "test" (`23f234a1-…`): 2 file `test-doc.txt`, `hop-dong-test.txt` — đã DELETE.
- Task "FE-BE sync test task" tuần 34/2026 — đã DELETE.
- Giá trị rác `"abc"` trong khóa `company_size` là dữ liệu cũ có sẵn (ai đó test trước đó),
  backend có thể tự xóa nếu muốn.
