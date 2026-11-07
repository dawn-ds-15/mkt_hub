# Front-end Specification — Module 2: Projects & Tasks

## Navigation/screens

- Tabs: Projects, Task List, Kanban, Weekly Report.
- Project accordion + create/edit form.
- Task slide-in modal dùng chung cho list, Kanban và deep-link từ Dashboard.

## Project behavior

- Type/status lấy động từ Dropdown Config.
- Manager và Specialist CRUD project; chỉ Manager thêm custom field.
- Xóa hiển thị impact trước confirm.
- Validation required/type/date map với field errors của API.

## Task behavior

- Task List có filters, stats, quick add, sort và table.
- Kanban drag/drop dùng transition API; optimistic update phải rollback khi lỗi.
- Chuyển Backlog làm hiện reason bắt buộc (BR-001).
- BOD Support điều khiển section report (BR-002).
- Specialist không có Delete; assignee mới chỉ chọn member Active.

## Weekly Report

- Filter tuần/năm/project/member.
- Sections Done, Plan, Backlog/Blocked, BOD Support và Weekly Log.
- Empty section vẫn hiển thị cấu trúc; export TXT dùng đúng filter.

## Acceptance checks

- Không lưu được Backlog thiếu reason.
- Drag/drop lỗi không để card ở sai cột.
- Click alert Dashboard mở đúng task và quay lại giữ context.
