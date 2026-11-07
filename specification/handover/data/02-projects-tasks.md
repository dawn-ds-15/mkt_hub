# Data Specification — Module 2: Projects & Tasks

## Entity

| Entity | Field/khóa chính | Quan hệ |
|---|---|---|
| projects | name, type, status, owner, dates, budget | owner → members |
| project_custom_fields | project, definition, value | project/config |
| tasks | project, name, assignee, status, priority, dates | project/member |
| task_status_history | task, from/to, reason, actor, time | task/member |
| weekly_logs | year, week, project/member, content | report context |

## Constraints

- Task luôn thuộc project tồn tại; assignee inactive được giữ lịch sử nhưng không gán mới.
- Backlog bắt buộc `backlog_reason` (BR-001).
- BOD Support được lưu bằng cờ/nội dung có thể truy vấn (BR-002).
- Status/type/priority tham chiếu dropdown config, không hardcode.
- Status change ghi history; mọi write ghi audit.

## Weekly Report lineage

- Done: task hoàn thành trong tuần.
- Plan: task có execution week/kế hoạch trong tuần.
- Backlog/Blocked: task Backlog kèm reason.
- BOD Support: task có yêu cầu BOD.

## DQ/Index

- Validate `start_date <= due_date`.
- Không orphan task/history/custom value.
- Index project, status, assignee, due_date, execution week.
- Progress luôn 0–100%.

## BA cần chốt

- Soft-delete/cascade khi xóa project.
- Weekly Report live hay snapshot và cách xử lý sửa task ở tuần đã khóa.
