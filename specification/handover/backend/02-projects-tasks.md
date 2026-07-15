# Back-end Specification — Module 2: Projects & Tasks

## Endpoints

- `GET/POST /api/v1/projects`; `GET/PATCH/DELETE /projects/{id}`.
- `POST /projects/{id}/custom-fields` — Manager only.
- `GET/POST /tasks`; `GET/PATCH /tasks/{id}`; `DELETE /tasks/{id}` — Manager only.
- `POST /tasks/{id}/transition`.
- `GET /weekly-reports`; `PUT /weekly-logs/{year}/{week}`; export TXT.

## Rules/transactions

- Backlog thiếu reason trả 422 `TASK_BACKLOG_REASON_REQUIRED` (BR-001).
- BOD support được query vào Weekly Report (BR-002).
- Progress được tính server-side; không nhận từ client.
- Không gán member inactive; enum phải tham chiếu config hợp lệ.
- Transition ghi status history, audit và `completed_at` khi Done.
- Mutation invalidate progress, task counts, alerts và report liên quan.
- Kanban và form dùng cùng transition service.

## Authorization/tests

- Hai role CRUD project và create/update task; chỉ Manager delete task/custom field.
- Xóa có dependency impact và policy soft-delete/409.
- Test concurrent update trả 409 `CONCURRENT_UPDATE`.
