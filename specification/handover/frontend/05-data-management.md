# Front-end Specification — Module 5: Data Management

## Navigation/quyền

- Tabs: Import, Export, Team, Dropdown, Slack, Backup & Reset, Audit Log.
- Import/Export: cả hai role; admin actions chỉ Manager.

## Import wizard

1. Chọn loại dữ liệu và project/năm nếu cần.
2. Upload CSV/XLS/XLSX ≤10MB.
3. Preview 5 dòng, valid/error counts và lỗi từng row.
4. Commit valid rows hoặc Cancel; có Download Template.

- Job chạy nền; UI có progress/poll/retry.
- Confirm disable nếu không có dòng hợp lệ.
- Kết quả hiện X thành công/Y bị bỏ qua.

## Admin screens

- Team: name, email, role, active, password khi tạo; không tự xóa/hạ role.
- Dropdown: tag list, add, reorder, remove; remove phải hiện usage count.
- Slack: masked webhook, channel, test, schedule/weekdays/alert days và 30 logs.
- Backup: create/download 10 bản; restore preview counts; reset yêu cầu gõ `RESET`.
- Audit: filters + paginated table; JSON expand/collapse, không hiện secrets.

## Acceptance checks

- File 50 dòng/3 lỗi preview và commit đúng 47.
- Specialist không thấy Team mutation controls.
- Export/backup có generating/error/download states.
