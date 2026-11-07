# Back-end Specification — Module 5: Data Management

## Import/export jobs

- `GET /api/v1/data-management/import/template?type={type}` (trả về file binary Excel `.xlsx`).
- `POST /api/v1/data-management/import/preview?type={type}&confirm={boolean}` (nhận `multipart/form-data` với field `file`). Hỗ trợ param `confirm=true` cho 1-step import trực tiếp không qua preview.
- `POST /api/v1/data-management/import/confirm` (nhận `BulkImportConfirmDto` cho flow 2-step).
- Validate MIME/extension/10MB; parse background/sync; errors theo row/field.
- Mỗi row commit atomic; batch có idempotency; invalidate module đích.
- Export endpoints trả về binary schema (`application/pdf` cho Weekly PDF, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` cho Dashboard Excel & Full Data).

## Admin APIs

- Members CRUD: email unique; không tự xóa/hạ role; deactivate chặn login.
- Dropdown add/reorder/deactivate; value đang dùng trả usage impact/409.
- Slack secret encrypt at rest/mask on read; test không log webhook.
- Backup create/list/download/restore; validate checksum/schema và pre-restore backup.
- Reset Manager-only, yêu cầu `RESET`, chỉ xóa demo/test.
- Audit Log GET có filter/pagination, Manager-only.

## Scheduler/Slack

- Default 08:00 T2–T6, timezone cấu hình, due-soon 5 ngày.
- Không có alert thì không gửi; retry/backoff có giới hạn.
- Idempotency theo schedule/date; log counts/status/sanitized error.

## Security/tests

- Upload chống file/path injection; download authorization.
- Restore transaction test; import 47/50 scenario; duplicate job test.
- **BA cần chốt:** duplicate strategy, batch rollback và demo-data marker.
