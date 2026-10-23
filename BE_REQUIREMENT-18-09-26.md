# Yêu cầu BE — 18/09/2026

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Mục tiêu:** Hỗ trợ **import hàng loạt task từ file Excel "MẪU BẢNG KẾ HOẠCH TASK CHIẾN DỊCH"**. FE đã thêm tính năng upload Excel trong popup "Thêm task mới" và gửi thẳng file tới `POST /v1/tasks/import`. Hiện tại BE chỉ nhận header chuẩn cũ (`task_name, project_id, assignee, ...`), **không khớp header của file kế hoạch chiến dịch** → cần BE mở rộng parsing cho cấu trúc header mới.

---

## 1. Bối cảnh

- FE thêm chế độ **Import Excel từ file kế hoạch task chiến dịch** trong popup "Thêm task mới" (`TaskList.jsx`).
- File mẫu: `MẪU BẢNG KẾ HOẠCH TASK CHIẾN DỊCH.xlsx`, sheet 1, **dòng 1 là header**, dữ liệu bắt đầu dòng 2.
- FE gửi upload bằng đúng cơ chế hiện tại: `POST /v1/tasks/import` với `FormData { file, projectId, year, confirm=true }`. File kế hoạch chiến dịch **không có cột dự án** nên FE chọn dự án trong popup và gửi kèm `projectId` (form field) — BE dùng `projectId` này cho toàn bộ dòng import.
- BE **không cần sửa endpoint/contract** — chỉ cần mở rộng bước **đọc header + map cột** cho khớp file mới, đồng thời giữ tương thích header cũ.

## 2. Cấu trúc file Excel cần hỗ trợ

### 2.1. File kế hoạch task chiến dịch (mới — bắt buộc)

10 cột theo đúng thứ tự:

| Cột | Header (exact) | Bắt buộc | Map sang field task |
|-----|----------------|----------|---------------------|
| A | `NUMBER` | Không | Số thứ tự, bỏ qua khi tạo task |
| B | `TASK` | **Có** | `name` (tên task) |
| C | `START-DAY` | Không | `startDate` (ngày bắt đầu) |
| D | `END-DAY` | Không | `dueDate` (hạn chót) |
| E | `PIC` | Không | `assigneeId` — map theo **tên thành viên** (xem mục 3) |
| F | `STAKEHOLDER` | Không | `stakeholders[]` (mảng string, có thể phân tách bằng `,` / `;` / dòng mới) |
| G | `STATUS` | Không | `status` — map nhãn (xem mục 3) |
| H | `OUTPUT REQUIRE` | Không | `description` (mô tả/đầu ra yêu cầu) |
| I | `FILE` | Không | `link` (đường dẫn Drive / công cụ, dạng string url) |
| J | `NOTE` | Không | `remark` (ghi chú) |

Yêu cầu mapping header: **không phân biệt hoa/thường**, cắt khoảng trắng thừa 2 đầu (trim), bỏ qua thứ tự cột (map theo tên header, không theo vị trí cố định). Giá trị Excel có thể là số (vd `NUMBER` = 1) → chuyển thành string, không được văng lỗi.

### 2.2. Header cũ (giữ nguyên tương thích)

`task_name, project_id, assignee, status, priority, start_date, due_date, exec_week, remark, reason` — không regression.

## 3. Quy tắc map giá trị

- **`PIC` → `assignee`:** khớp không thật sự chính xác (insensitive) theo tên/thư điện tử của thành viên trong hệ thống. Nếu không tìm thấy → **dòng đó lỗi** và ghi `errorList` với tên PIC, không tự ý gán người khác.
- **`STATUS` → `status` BE:** hỗ trợ cả tiếng Việt lẫn tiếng Anh (không phân biệt hoa/thường):
  - `Chưa làm / To Do / Planning` → `To Do`
  - `Đang làm / In Progress / Processing` → `In Progress`
  - `Đang chờ / Review / Pending` → `Review`
  - `Tồn đọng / Backlog` → `Backlog`
  - `Hoàn thành / Done` → `Done`
  - `Đã huỷ / Huỷ / Cancel / Cancelled` → `Cancel`
  - Trống → mặc định `To Do`. Không nhận diện được → dòng lỗi `errorList`.
- **Ngày (`START-DAY`/`END-DAY`):** hỗ trợ định dạng `dd/mm/yyyy`, `yyyy-mm-dd`, và **serial number Excel** (đã kèm sẵn trong file xlsx). Chuyển đúng sang `startDate`/`dueDate`.
- **`STAKEHOLDER`:** nếu chứa ký tự phân tách (`,`, `;`, `\n` hoặc `+`) → tách thành nhiều phần tử. Trống → `[]`.
- **`FILE`:** chỉ dùng khi giá trị là link (`http/https` hoặc dạng `drive.google.com/...`); không phải link → vẫn cho qua như giá trị string đơn thuần (hoặc bỏ qua nếu rõ ràng là đường dẫn file cục bộ `C:\...`, FE không cần hiểu).

## 4. Hành vi response (giữ nguyên, không đổi contract)

- Mantained: trả về đúng shape hiện tại để FE `mapImportResult` dùng được:
  - `{ imported, errors, errorList[] }` (mỗi phần tử `errorList` là chuỗi mô tả lỗi, nên kèm số dòng).
- `confirm` gửi dạng form field (FE đã gửi `confirm=true`) — giữ nguyên.
- `projectId` gửi dạng form field (FE gửi kèm để gán dự án cho tất cả dòng). Thiếu `projectId` → mỗi dòng báo lỗi `"project_id không hợp lệ hoặc chưa chọn dự án"` (đã test, đúng hành vi) — giữ nguyên.
- Nếu **toàn bộ header không khớp** cả chuẩn cũ lẫn chuẩn mới → trả `400` kèm message tiếng Việt rõ ràng (vd: *"File không đúng định dạng template task. Vui lòng tải template mới."*).

## 5. Những gì FE đã làm (không cần BE đụng tới)

| # | Nội dung | File |
|---|----------|------|
| 1 | Chế độ "Import Excel" trong popup Thêm task mới: chọn file + chọn dự án, đọc preview client-side bằng `xlsx` | `FE/components/Projects/TaskList.jsx` |
| 2 | Gửi `POST /v1/tasks/import` với `FormData { file, projectId, year, confirm=true }` (tái dùng `importTasks`) | `FE/components/Projects/TaskList.jsx` + `FE/services/api.js:importTasks` |
| 3 | Nút "Tải template" dùng `GET /v1/tasks/import/template` → file mới **phải là file kế hoạch chiến dịch** (10 cột ở mục 2.1) để người dùng điền đúng chuẩn | `FE/services/api.js:downloadTemplate` |
| 4 | Hiển thị kết quả import (số dòng thành công/lỗi + errorList) ngay trong popup | `FE/components/Projects/TaskList.jsx` |

> **Lưu ý #3 quan trọng:** `GET /v1/tasks/import/template` hiện trả về CSV header cũ. Nếu BE giữ endpoint này làm nguồn template chính thức, hãy đổi template về **file kế hoạch chiến dịch (10 cột) HOẶC** giữ nguyên CSV cũ — FE chấp nhận cả hai vì tính năng đọc file theo header. Để UX thống nhất với luồng mới, **khuyến nghị** `GET /v1/tasks/import/template` trả file kế hoạch chiến dịch.

## 6. Kiểm tra chấp nhận (checklist cho BE)

- [ ] Upload file kế hoạch chiến dịch đúng 10 cột, 5+ dòng dữ liệu hợp lệ → `200`, `imported` = 5, `errors` = 0.
- [ ] Header viết thường / lệch thứ tự cột / có khoảng trắng thừa → vẫn map đúng và tạo task chính xác.
- [ ] `PIC` không tồn tại trong hệ thống → dòng đó vào `errorList`, các dòng khác vẫn import được.
- [ ] `STATUS` nhận diện được cả tiếng Việt lẫn tiếng Anh; `START-DAY`/`END-DAY` nhận cả chuỗi `dd/mm/yyyy` lẫn serial số Excel.
- [ ] Task sau import có đủ `name`, `startDate`/`dueDate`, `assignee`, `stakeholders[]`, `description` (từ OUTPUT REQUIRE), `link` (từ FILE), `remark` (từ NOTE) — check bằng `GET /v1/tasks` hoặc `GET /v1/tasks/:id`.
- [ ] Header cũ `task_name, project_id, assignee, ...` vẫn import được (no regression).
- [ ] File sai hoàn toàn header → `400` kèm message tiếng Việt.

---

## 7. Kết quả verify BE (18/09/2026)

Test thực tế trên `https://mkt-hub.onrender.com` (login manager `a.nguyen@company.com`):

| # | Checklist item | Kết quả |
|---|----------------|---------|
| 1 | `GET /v1/tasks/import/template` | ✅ Trả **xlsx** (trước là CSV) — sheet `KẾ HOẠCH TASK CHIẾN DỊCH`, header chuẩn 10 cột + 1 dòng mẫu |
| 2 | Upload đúng template có `projectId` | ✅ `HTTP 201`, `imported=3`, `errors=2` (4 dòng hợp lệ + 1 dòng PIC sai + 1 dòng status sai) |
| 3 | `PIC` không tồn tại | ✅ Dòng 4 vào `errorList`: `Không tìm thấy PIC "KHONG TON TAI" trong hệ thống`, các dòng khác vẫn import |
| 4 | `STATUS` VN + EN | ✅ `Hoàn thành → Done`, `In Progress → In Progress`, `Planning → To Do` |
| 5 | Ngày `dd/mm/yyyy` + serial Excel | ✅ `18/09/2026 → 2026-09-18`; serial `45000 → 2023-03-15` |
| 6 | Map field đầy đủ | ✅ `description` (OUTPUT REQUIRE), `link` (FILE), `remark` (NOTE), `stakeholders:[BOD, Sales Team]` (STAKEHOLDER), `assignee` (PIC theo tên) |
| 7 | Header cũ (no regression) | ✅ `task_name, project_id, assignee,...` CSV vẫn import, `imported=1` |
| 8 | File sai header hoàn toàn | ✅ `HTTP 400`: `File không đúng định dạng template task. Vui lòng tải template mới.` |
| 9 | Thiếu `projectId` form field | ✅ Mỗi dòng báo lỗi `project_id không hợp lệ hoặc chưa chọn dự án` — FE đã khắc phục bằng cách gửi `projectId` từ popup |

**Kết luận: BE đạt toàn bộ yêu cầu; FE đã bổ sung gửi `projectId` cho khớp contract thực tế.**