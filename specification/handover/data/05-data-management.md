# Data Specification — Module 5: Data Management

## Import staging

Luồng bắt buộc: upload → staging → validate → preview → commit valid rows.

- `import_jobs`: type, file, status, counts, actor, timestamps.
- `import_rows`: job, row number, raw payload, normalized payload, errors, commit status.
- Task import đích `tasks`; KPI History đích `kpi_actuals`; Closed Deal đích `closed_deals`.
- Có batch ID/idempotency để tránh import trùng ngoài ý muốn.

## Master/config data

- `members.email` unique; deactivate giữ toàn bộ quan hệ lịch sử.
- `dropdown_definitions` và `dropdown_values`: key, label, order, active.
- Value đang dùng ưu tiên deactivate, không hard-delete.
- Webhook Slack được mã hóa/che; notification log giữ tối thiểu 30 lần gửi.

## Export/backup

- Dashboard Excel: Summary, Task List, Leads Detail.
- Full data: Projects, Tasks, KPI_Weekly, Closed_Deals, Expenses, Members, Audit_Log.
- Backup ZIP JSON + Excel, có schema version/checksum; giữ 10 bản gần nhất.
- Restore preview count và chạy transaction; reset giữ members/dropdowns.

## BA cần chốt

- Duplicate import là reject/update/skip.
- Có rollback cả batch hay không.
- Cách nhận biết demo/test data khi reset.
