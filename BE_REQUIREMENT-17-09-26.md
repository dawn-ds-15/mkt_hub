# Yêu cầu BE — 17/09/2026

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Mục tiêu:** Fix hiện tượng **mục "3. Tồn đọng / Vấn đề" (BLOCKER) trong báo cáo tuần không cập nhật** sau khi sửa task ở Edit Task. Nguyên nhân phía FE đã xác định & fix xong (gửi đúng field `name`, map status FE→BE, hiển thị fallback). BE chỉ cần đảm bảo **dữ liệu task là LIVE** và **PATCH ghi đầy đủ các field liên quan**.

---

## 1. Bối cảnh & dữ liệu báo cáo tuần dùng field nào

Mục BLOCKER trong báo cáo tuần (`GET /v1/weekly-reports` → `sections.backlog`) hiển thị:

| Cột báo cáo | Field của task | Ghi chú |
|-------------|----------------|---------|
| **Trình bày với BOD** (tên) | `task.name` | Khi đổi tên task, phải hiện tên mới |
| **Mô tả vấn đề** | `task.reason` (ưu tiên) → fallback `remark` → `description` | FE đã đổi thành chuỗi fallback |

Trước đây FE gửi nhầm `title` thay vì `name` khi PATCH task nên tên không được lưu — **đã fix** (FE gửi cả `name` lẫn `title`, xem mục 3).

---

## 2. Các yêu cầu BE

### 2.1. `PATCH /v1/tasks/:id` — ghi đầy đủ các field cập nhật

Khi PATCH có payload chứa các field sau, BE **bắt buộc ghi nhận** (nếu field hiện đang được nhận diện):
- `name` — tên task (**bắt buộc** phải hỗ trợ; `title` là field fallback FE gửi kèm, BE có thể bỏ qua `title` nếu không dùng).
- `reason` — lý do/chú thích, dùng cho cột "Mô tả vấn đề".
- `remark` — ghi chú.
- `description` — mô tả.
- `status` — trạng thái BE (`To Do`, `In Progress`, `Review`, `Backlog`, `Done`, `Cancel`, `Overdue`).

**Lưu ý:** FE gửi `name` + `title` cùng lúc để tương thích. Nếu BE hiện khoá theo DTO chỉ chấp nhận `title` mà không chấp nhận `name`, **hãy mở rộng DTO nhận cả `name`** — không được trả 400 khi thiếu `title` nếu đã có `name`.

### 2.2. `GET /v1/weekly-reports` — `sections.backlog` phải là dữ liệu LIVE

- `sections.backlog` phải được **tính mới từ bảng `tasks` ở mỗi request** (không lấy từ cache/entity snapshot đã lưu).
- Mỗi item trong `sections.backlog` phải chứa **đủ** `id`, `name`, `reason`, `remark`, `description`, `projectId` (để FE filter + map).
- Giữ nguyên filter `archivedAt: null` (đã fix 21/08/2026 — xác nhận không regression).
- Lưu đồng bộ **thời điểm PATCH task** ↔ **request báo cáo tuần tiếp theo**: nếu cùng tuần/năm, bản sửa gần nhất phải hiện ra ngay.

### 2.3. Ghi `reason` khi đổi trạng thái Backlog/Pending (Kanban/Edit Task)

- Khi PATCH chứa `{ status: 'Backlog', reason: '...' }` (hoặc `Review`/`Cancel` kèm `reason`), BE phải ghi **cả 2 field** trong cùng transaction, không được chỉ ghi `status` và bỏ qua `reason`.
- Trạng thái mới `Backlog`/`Review`/`Cancel` phải khiến task **xuất hiện** trong `sections.backlog` của tuần tương ứng (theo đúng logic scope hiện tại của BE), để edit trên Edit Task phản ánh vào báo cáo tuần.

---

## 3. Những gì FE đã fix (không cần BE đụng tới)

| # | Nội dung | File |
|---|----------|------|
| 1 | `updateTask` chuẩn hoá payload: `title → name`, map status FE label (`Planning/Processing/Pending`) → BE status (`To Do/In Progress/Review`) trước khi PATCH | `FE/services/api.js:updateTask` |
| 2 | Drawer Edit Task gửi `name` + `title` khi lưu | `FE/components/Projects/TaskEditDrawer.jsx` |
| 3 | Cột "Mô tả vấn đề" trong báo cáo tuần: `reason` → fallback `remark` → `description` → `'Không có lý do'` | `FE/services/api.js:getWeeklyReport` |

---

## 4. Kiểm tra chấp nhận (checklist cho BE)

- [ ] `PATCH /v1/tasks/:id` với `{ name }` → `GET /v1/tasks/:id` trả `name` mới; task đó xuất hiện trong `sections.backlog` với tên mới.
- [ ] `PATCH` kèm `reason` trên task Backlog → báo cáo tuần cột "Mô tả vấn đề" hiện nội dung `reason` mới (không phải "Không có lý do").
- [ ] `PATCH` kèm `reason` mà BE trước đây chỉ chấp nhận `title` → giờ `{ name, title }` đều nhận, không 400.
- [ ] PATCH `{ status: 'Backlog', reason }` → GET báo cáo tuần cùng tuần thấy task ngay.
- [ ] Sửa xong task → sang tab báo cáo tuần (reload tuần/năm/dự án khớp) → dữ liệu mới, không cần hard restart hay cache.
- [ ] Task đã xoá mềm (`archivedAt != null`) không xuất hiện trong `sections.backlog`.