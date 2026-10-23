# Yêu cầu BE — 21/09/2026 (Task: thông báo cho Người liên quan)

**Người gửi:** FE Team
**Ưu tiên:** Trung bình – Cao (yêu cầu trực tiếp từ người dùng)

> **Mục tiêu:** Khi một thành viên được thêm vào **Người liên quan (stakeholders)** của task, người đó phải **nhận được thông báo** về task đó — giống như người được giao task (assignee).
>
> Hiện tại **không có thông báo nào được gửi**, và quan trọng hơn: **backend đang lưu stakeholder dưới dạng chuỗi tên**, nên hệ thống không xác định được stakeholder tương ứng với tài khoản nào để mà gửi.

---

## 1. Bối cảnh & hiện trạng

Người dùng hỏi: *"người liên quan mà là người dùng trên hệ thống á, khi chị add vào cái task đó ở phần người liên quan thì bạn đó có nhận được thông báo task đó không em?"*

FE đã rà soát toàn bộ luồng, câu trả lời là **không**, vì 3 lý do độc lập:

| # | Hiện trạng | Vị trí |
|---|-----------|--------|
| 1 | **Stakeholder lưu bằng tên, không phải `userId`.** FE gửi lên `stakeholders: string[]` (mảng tên hiển thị), BE trả về cũng là `string[]`. Không có liên kết tới bảng user. | `POST/PATCH /v1/tasks` — FE: `FE/components/Projects/TaskEditDrawer.jsx` |
| 2 | **Chuông thông báo chỉ xét assignee.** FE poll `GET /v1/tasks` mỗi 30s rồi tự lọc `assigneeId === user.id`. Không có API thông báo thật, và stakeholder không được xét. | `FE/components/Layout/NotificationBell.jsx` |
| 3 | **Slack chỉ cảnh báo theo deadline.** Cấu hình Slack hiện có chỉ bắn task sắp/quá hạn theo lịch mỗi sáng, không bắn theo sự kiện gán người. | `/v1/data-management/slack/*` |

**Hệ quả nghiệp vụ:** hai thành viên trùng tên là không phân biệt được; đổi tên hiển thị trong Quản lý dữ liệu sẽ làm stakeholder cũ trở thành chuỗi "mồ côi" (FE đang phải gắn nhãn `(cũ)` cho các tên không khớp thành viên nào).

---

## 2. Thay đổi backend yêu cầu

### 2.1. Lưu stakeholder theo `userId` (bắt buộc — nền tảng cho mọi phần sau)

Giữ nguyên field `stakeholders` cũ để **không phá vỡ dữ liệu và client hiện tại**, bổ sung song song:

| Đối tượng | Field | Kiểu | Ghi chú |
|-----------|-------|------|---------|
| `Task` (entity + DB) | `stakeholderUserIds` | `string[]`, mặc định `[]` | Bảng nối `task_stakeholders (taskId, userId)` |
| `TaskDto` (response `GET /v1/tasks`, `GET /v1/tasks/{id}`, `GET /v1/tasks/kanban/board`) | `stakeholderUsers` | `{ id, name, email }[]` | FE hiển thị chip + biết ai là user thật |
| `TaskDto` | `stakeholders` | `string[]` | **Giữ nguyên**. Trả về danh sách tên, ghép từ `stakeholderUsers` + các tên tự do cũ |
| `CreateTaskDto` (`POST /v1/tasks`) | `stakeholderUserIds` | `string[]`, optional | |
| `UpdateTaskDto` (`PATCH /v1/tasks/{id}`) | `stakeholderUserIds` | `string[]`, optional | Gửi lên là **thay thế toàn bộ** danh sách |

**Migration dữ liệu cũ:** với mỗi task, map từng chuỗi trong `stakeholders` sang user có `name` khớp (không phân biệt hoa thường, trim khoảng trắng). Khớp được thì đưa vào `stakeholderUserIds`; không khớp hoặc khớp nhiều hơn 1 user thì **giữ nguyên ở `stakeholders` dạng chuỗi**, không tự đoán.

**Quy tắc tương thích:** nếu client chỉ gửi `stakeholders` (chuỗi) như hiện nay, BE giữ hành vi cũ — không được vỡ.

### 2.2. API thông báo trong ứng dụng (bắt buộc)

Hiện chưa có bảng/endpoint thông báo nào. Cần bổ sung:

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/v1/notifications` | Thông báo của **người đang đăng nhập**. Query: `unreadOnly` (bool), `limit` (mặc định 50). Sắp xếp mới nhất trước |
| `PATCH` | `/v1/notifications/{id}/read` | Đánh dấu 1 thông báo đã đọc |
| `POST` | `/v1/notifications/read-all` | Đánh dấu tất cả đã đọc |

Cấu trúc một thông báo:

```json
{
  "id": "ntf_...",
  "type": "task_stakeholder_added",
  "isRead": false,
  "createdAt": "2026-09-21T03:12:00.000Z",
  "actor":  { "id": "usr_1", "name": "Nguyễn Thị A" },
  "task":   { "id": "tsk_1", "name": "Thiết kế backdrop", "dueDate": "2026-09-30" },
  "project":{ "id": "prj_1", "name": "Hội thảo Logistics Q4" }
}
```

**Phân quyền:** chỉ trả về thông báo của chính user trong token. Không cho đọc thông báo của người khác.

### 2.3. Sự kiện sinh thông báo

| `type` | Khi nào bắn | Gửi cho ai |
|--------|-------------|-----------|
| `task_stakeholder_added` | `stakeholderUserIds` được **thêm** user mới (qua `POST` hoặc `PATCH` task) | Các user **vừa được thêm** |
| `task_assigned` | `assigneeId` thay đổi | Người được giao mới |

Ràng buộc:

- Chỉ bắn cho **phần chênh lệch** (user mới được thêm), không bắn lại cho người đã có sẵn trong danh sách.
- **Không tự gửi cho chính mình:** người thao tác (`actor`) tự thêm mình vào thì bỏ qua.
- Bị **gỡ khỏi** stakeholder thì **không** sinh thông báo.
- Task bị xoá thì xoá/ẩn các thông báo liên quan.
- Cùng một user + cùng task + cùng type trong vòng 1 phút thì gộp thành 1 (chống spam khi sửa liên tục).

### 2.4. Gửi Slack (tuỳ chọn — làm sau nếu kịp)

Nếu bật Slack trong Cấu hình, sự kiện ở 2.3 gửi kèm 1 message tới kênh đã cấu hình, nội dung gợi ý:

> `@{tên} vừa được thêm vào task *{tên task}* ({dự án}) — hạn {dd/mm/yyyy}`

Dùng lại cấu hình sẵn có `/v1/data-management/slack/config`, và ghi log vào `/v1/data-management/slack/logs` như các thông báo hiện tại. **Không chặn** việc tạo/sửa task nếu gửi Slack lỗi.

---

## 3. FE sẽ làm gì sau khi BE xong

| # | Nội dung | File |
|---|----------|------|
| 1 | Dropdown "Người liên quan" gửi `stakeholderUserIds` thay vì mảng tên | `FE/components/Projects/TaskEditDrawer.jsx` |
| 2 | Ô thêm nhanh stakeholder ở màn Danh sách Task gửi theo `userId` | `FE/components/Projects/TaskList.jsx` |
| 3 | Hiển thị chip stakeholder từ `stakeholderUsers`, bỏ cơ chế đoán tên và nhãn `(cũ)` | `TaskEditDrawer.jsx`, `TaskViewModal.jsx` |
| 4 | Chuông thông báo đọc `GET /v1/notifications` thay vì tự poll và lọc danh sách task | `FE/components/Layout/NotificationBell.jsx` |
| 5 | Đánh dấu đã đọc qua API thay vì lưu `localStorage` | `FE/components/Layout/NotificationBell.jsx` |

---

## 4. Kiểm tra chấp nhận (checklist cho BE)

**Stakeholder theo userId**

- [ ] `PATCH /v1/tasks/{id}` với `{ "stakeholderUserIds": ["usr_1","usr_2"] }` → `200`, `GET` lại trả đúng 2 user trong `stakeholderUsers`.
- [ ] `GET /v1/tasks` vẫn trả `stakeholders` dạng `string[]` như cũ (client cũ không vỡ).
- [ ] `PATCH` chỉ gửi `stakeholders` (chuỗi), không gửi `stakeholderUserIds` → hành vi giữ nguyên như hiện tại.
- [ ] Gửi `stakeholderUserIds` chứa id không tồn tại → `400`, không lưu một phần.
- [ ] Sau migration: task cũ có stakeholder trùng tên thành viên → đã map sang `stakeholderUsers`; tên không khớp ai → vẫn còn trong `stakeholders`, không mất dữ liệu.

**Thông báo**

- [ ] Thêm user B vào stakeholder của task → B gọi `GET /v1/notifications` thấy 1 bản ghi `task_stakeholder_added` với đúng `task`, `project`, `actor`.
- [ ] User A (người thao tác) tự thêm mình → **không** có thông báo cho A.
- [ ] Sửa task lần 2 mà không đổi danh sách stakeholder → **không** phát sinh thông báo mới.
- [ ] Gỡ B khỏi stakeholder → **không** phát sinh thông báo.
- [ ] User C gọi `GET /v1/notifications` → **không** thấy thông báo của B.
- [ ] `PATCH /v1/notifications/{id}/read` → `isRead = true`; `GET ?unreadOnly=true` không còn bản ghi đó.
- [ ] Xoá task → thông báo liên quan không còn xuất hiện (hoặc trả về kèm cờ task đã xoá, thống nhất trước với FE).

---

## 5. Cần BE chốt lại

1. **Có làm bảng thông báo riêng không**, hay dùng lại hạ tầng Slack log? FE cần thông báo **theo từng user** nên nghiêng về bảng riêng.
2. **Thứ tự triển khai:** FE đề xuất làm **mục 2.1 trước** (stakeholder theo `userId`) vì đây là nền tảng, và bản thân nó đã sửa được lỗi trùng tên / đổi tên hiện tại. Mục 2.2–2.3 làm sau.
3. **Có cần gửi email không**, hay chỉ thông báo trong ứng dụng + Slack là đủ cho giai đoạn này?

---

**Tóm tắt:** yêu cầu của người dùng ("người liên quan có nhận được thông báo không") hiện **chưa đáp ứng được** và **không thể xử lý ở phía FE**, vì dữ liệu stakeholder không gắn với tài khoản người dùng và hệ thống chưa có kênh thông báo theo từng người. Cần BE làm mục 2.1 → 2.3.
