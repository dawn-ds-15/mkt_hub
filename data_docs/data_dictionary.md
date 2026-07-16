# Data Dictionary

Tài liệu này mô tả cấu trúc dữ liệu từ `database/core.sql`, `database/finance.sql`, `database/marketing.sql` và `database/sys.sql` trên nhánh `data`

## Quy ước

- **Bắt buộc** = cột có ràng buộc `NOT NULL`.
- **Mặc định** lấy trực tiếp từ DDL PostgreSQL; `—` nghĩa là không khai báo mặc định.
- Các trường kết thúc bằng `_id` thường là khóa ngoại; quan hệ chính được giải thích trong mô tả.
- Thời gian dùng kiểu `timestamp` trong dump; ứng dụng cần thống nhất múi giờ khi đọc/ghi.

## Tổng quan

| Schema | Số bảng | Mục đích |
|---|---:|---|
| `core` | 5 | Thành viên, dự án, công việc và danh mục dùng chung |
| `finance` | 2 | Cấu hình và chi phí dự án |
| `marketing` | 4 | Pipeline bán hàng và KPI marketing |
| `sys_admin` | 6 | Audit, import/export, backup và thông báo Slack |

## `core.dropdowns`

Danh mục dùng chung cho trạng thái, loại, mức ưu tiên, quy mô và các lựa chọn cấu hình.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `integer` | Có | `nextval('dropdowns_id_seq')` | Khóa chính định danh bản ghi. |
| `category` | `character varying(50)` | Có | `—` | Nhóm danh mục mà giá trị thuộc về. |
| `value` | `character varying(100)` | Có | `—` | Giá trị hiển thị/lưu của mục danh mục. |
| `sort_order` | `integer` | Không | `'0'` | Thứ tự sắp xếp khi hiển thị. |
| `is_active` | `boolean` | Không | `true` | Cho biết bản ghi còn được phép sử dụng. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |

## `core.members`

Tài khoản và hồ sơ thành viên nội bộ.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('members_id_seq')` | Khóa chính định danh bản ghi. |
| `name` | `character varying(100)` | Có | `—` | Tên đầy đủ của thành viên. |
| `email` | `character varying(255)` | Có | `—` | Địa chỉ email đăng nhập/liên hệ; phải duy nhất. |
| `role` | `public.member_role` | Có | `—` | Vai trò phân quyền của thành viên. |
| `avatar_url` | `text` | Không | `—` | Đường dẫn ảnh đại diện. |
| `is_active` | `boolean` | Không | `true` | Cho biết bản ghi còn được phép sử dụng. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `password_hash` | `text` | Không | `—` | Mật khẩu đã băm; không lưu mật khẩu thuần. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `core.projects`

Thông tin tổng quan, tiến độ và ngân sách dự án.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('projects_id_seq')` | Khóa chính định danh bản ghi. |
| `project_name` | `character varying(255)` | Có | `—` | Tên dự án. |
| `project_type_id` | `bigint` | Có | `—` | Loại dự án, tham chiếu danh mục project_type. |
| `status_id` | `bigint` | Có | `—` | Trạng thái nghiệp vụ, tham chiếu bảng danh mục. |
| `owner_id` | `bigint` | Có | `—` | Thành viên chịu trách nhiệm chính. |
| `description` | `text` | Không | `—` | Mô tả chi tiết. |
| `planned_start_date` | `date` | Không | `—` | Ngày bắt đầu theo kế hoạch. |
| `planned_end_date` | `date` | Không | `—` | Ngày kết thúc theo kế hoạch. |
| `actual_start_date` | `date` | Không | `—` | Ngày bắt đầu thực tế. |
| `actual_end_date` | `date` | Không | `—` | Ngày kết thúc thực tế. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |
| `budget_plan` | `numeric(15,2)` | Không | `'0'` | Ngân sách dự kiến của dự án. |
| `actual_cost` | `numeric(15,2)` | Không | `'0'` | Chi phí thực tế đã ghi nhận. |

## `core.task_stakeholders`

Bảng liên kết nhiều-nhiều giữa công việc và nhóm bên liên quan.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `task_id` | `bigint` | Có | `—` | Công việc được liên kết. |
| `stakeholder_id` | `bigint` | Có | `—` | Nhóm bên liên quan, tham chiếu danh mục stakeholder. |

## `core.tasks`

Công việc thuộc dự án, người phụ trách, tiến độ và thông tin hỗ trợ.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('tasks_id_seq')` | Khóa chính định danh bản ghi. |
| `task_name` | `character varying(255)` | Có | `—` | Tên công việc. |
| `description` | `text` | Không | `—` | Mô tả chi tiết. |
| `project_id` | `bigint` | Có | `—` | Dự án liên quan. |
| `assignee_id` | `bigint` | Có | `—` | Thành viên được giao thực hiện. |
| `status_id` | `bigint` | Có | `—` | Trạng thái nghiệp vụ, tham chiếu bảng danh mục. |
| `priority_id` | `bigint` | Có | `—` | Mức ưu tiên, tham chiếu danh mục task_priority. |
| `start_date` | `date` | Không | `—` | Ngày bắt đầu công việc. |
| `due_date` | `date` | Có | `—` | Hạn hoàn thành. |
| `completed_date` | `date` | Không | `—` | Ngày hoàn thành thực tế. |
| `exec_week` | `smallint` | Có | `—` | Tuần dự kiến/thực tế thực hiện. |
| `reason` | `text` | Không | `—` | Lý do hoặc giải trình cho trạng thái/kết quả. |
| `needed_support_bod` | `text` | Không | `—` | Nội dung cần Ban lãnh đạo hỗ trợ. |
| `link` | `text` | Không | `—` | Liên kết đến tài liệu hoặc tài nguyên liên quan. |
| `remark` | `text` | Không | `—` | Ghi chú bổ sung. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `finance.expense_settings`

Các giả định tài chính theo kỳ dùng cho tính toán và dự báo.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('expense_settings_id_seq')` | Khóa chính định danh bản ghi. |
| `period_type` | `character varying(20)` | Có | `—` | Loại kỳ áp dụng, ví dụ tháng/quý/năm. |
| `period_value` | `character varying(20)` | Có | `—` | Giá trị nhận diện kỳ áp dụng. |
| `churn_rate` | `numeric(5,2)` | Có | `—` | Tỷ lệ khách hàng rời bỏ dùng trong giả định tài chính. |
| `gross_margin` | `numeric(5,2)` | Có | `—` | Tỷ suất lợi nhuận gộp dùng trong giả định tài chính. |
| `note` | `text` | Không | `—` | Ghi chú cho thiết lập hoặc bản ghi. |
| `created_by` | `bigint` | Không | `—` | Thành viên tạo bản ghi. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |

## `finance.project_expenses`

Chi phí trực tiếp, chi phí chung và tổng chi phí theo dự án/tháng.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('project_expenses_id_seq')` | Khóa chính định danh bản ghi. |
| `project_id` | `bigint` | Có | `—` | Dự án liên quan. |
| `expense_month` | `smallint` | Có | `—` | Tháng phát sinh chi phí. |
| `expense_year` | `smallint` | Có | `—` | Năm phát sinh chi phí. |
| `direct_cost` | `numeric(15,2)` | Không | `'0'` | Chi phí trực tiếp của dự án. |
| `direct_note` | `text` | Không | `—` | Diễn giải chi phí trực tiếp. |
| `overhead_cost` | `numeric(15,2)` | Không | `'0'` | Chi phí chung/phân bổ. |
| `overhead_note` | `text` | Không | `—` | Diễn giải chi phí chung. |
| `total_cost` | `numeric(15,2) GENERATED ALWAYS AS ((direct_cost + overhead_cost)) STORED` | Không | `—` | Tổng chi phí; thường bằng direct_cost cộng overhead_cost. |
| `created_by` | `bigint` | Không | `—` | Thành viên tạo bản ghi. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `marketing.closed_deals`

Các thương vụ đã chốt và giá trị hợp đồng tương ứng.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('closed_deals_id_seq')` | Khóa chính định danh bản ghi. |
| `opportunity_id` | `bigint` | Không | `—` | Cơ hội bán hàng nguồn tạo ra thương vụ. |
| `project_id` | `bigint` | Không | `—` | Dự án liên quan. |
| `company_name` | `character varying(255)` | Có | `—` | Tên doanh nghiệp/khách hàng. |
| `company_size_id` | `bigint` | Không | `—` | Quy mô doanh nghiệp, tham chiếu danh mục company_size. |
| `setup_fee` | `numeric(15,2)` | Không | `'0'` | Phí triển khai ban đầu. |
| `monthly_fee` | `numeric(15,2)` | Không | `'0'` | Phí định kỳ hàng tháng. |
| `contract_value` | `numeric(15,2) GENERATED ALWAYS AS ((setup_fee + monthly_fee)) STORED` | Không | `—` | Tổng giá trị hợp đồng. |
| `closed_date` | `date` | Có | `—` | Ngày thương vụ được chốt. |
| `remark` | `text` | Không | `—` | Ghi chú bổ sung. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `marketing.kpi_actuals`

Kết quả KPI marketing thực tế theo tuần.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('kpi_actuals_id_seq')` | Khóa chính định danh bản ghi. |
| `plan_id` | `bigint` | Có | `—` | Kế hoạch KPI mà số liệu thực tế thuộc về. |
| `week` | `smallint` | Có | `—` | Tuần ghi nhận KPI. |
| `raw_leads` | `integer` | Không | `'0'` | Số lead thô nhận được. |
| `mql` | `integer` | Không | `'0'` | Số Marketing Qualified Lead. |
| `sql` | `integer` | Không | `'0'` | Số Sales Qualified Lead. |
| `opp` | `integer` | Không | `'0'` | Số cơ hội bán hàng tạo ra. |
| `closed_deal` | `integer` | Không | `'0'` | Số thương vụ đã chốt. |
| `pipeline_value` | `numeric(15,2)` | Không | `'0'` | Tổng giá trị cơ hội trong pipeline. |
| `won_value` | `numeric(15,2)` | Không | `'0'` | Tổng giá trị đã thắng/chốt. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `marketing.kpi_plans`

Kế hoạch KPI marketing theo năm.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('kpi_plans_id_seq')` | Khóa chính định danh bản ghi. |
| `year` | `smallint` | Có | `—` | Năm của kế hoạch KPI. |
| `raw_leads_plan` | `integer` | Không | `'0'` | Mục tiêu số lead thô. |
| `mql_plan` | `integer` | Không | `'0'` | Mục tiêu MQL. |
| `sql_plan` | `integer` | Không | `'0'` | Mục tiêu SQL. |
| `opp_plan` | `integer` | Không | `'0'` | Mục tiêu số cơ hội. |
| `closed_deal_plan` | `integer` | Không | `'0'` | Mục tiêu số thương vụ chốt. |
| `pipeline_value_plan` | `numeric(15,2)` | Không | `'0'` | Mục tiêu giá trị pipeline. |
| `won_value_plan` | `numeric(15,2)` | Không | `'0'` | Mục tiêu giá trị thắng/chốt. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `marketing.opportunities`

Cơ hội bán hàng đang theo dõi trong pipeline.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('opportunities_id_seq')` | Khóa chính định danh bản ghi. |
| `project_id` | `bigint` | Không | `—` | Dự án liên quan. |
| `owner_id` | `bigint` | Không | `—` | Thành viên chịu trách nhiệm chính. |
| `company_name` | `character varying(255)` | Có | `—` | Tên doanh nghiệp/khách hàng. |
| `company_size_id` | `bigint` | Không | `—` | Quy mô doanh nghiệp, tham chiếu danh mục company_size. |
| `pipeline_value` | `numeric(15,2)` | Có | `—` | Tổng giá trị cơ hội trong pipeline. |
| `expected_close_date` | `date` | Không | `—` | Ngày dự kiến chốt cơ hội. |
| `status_id` | `bigint` | Không | `—` | Trạng thái nghiệp vụ, tham chiếu bảng danh mục. |
| `remark` | `text` | Không | `—` | Ghi chú bổ sung. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## `sys_admin.audit_logs`

Nhật ký thay đổi dữ liệu phục vụ kiểm toán.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('audit_logs_id_seq')` | Khóa chính định danh bản ghi. |
| `user_id` | `bigint` | Có | `—` | Người dùng thực hiện hành động. |
| `action` | `character varying(20)` | Có | `—` | Tên hành động được ghi log. |
| `entity_type` | `character varying(50)` | Có | `—` | Loại đối tượng bị tác động. |
| `entity_id` | `bigint` | Có | `—` | Định danh đối tượng bị tác động. |
| `field_changed` | `character varying(100)` | Không | `—` | Tên trường đã thay đổi. |
| `old_value` | `jsonb` | Không | `—` | Giá trị trước thay đổi. |
| `new_value` | `jsonb` | Không | `—` | Giá trị sau thay đổi. |
| `created_at` | `timestamp` | Có | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |

## `sys_admin.backups`

Thông tin các bản sao lưu dữ liệu.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('backups_id_seq')` | Khóa chính định danh bản ghi. |
| `file_name` | `character varying(255)` | Có | `—` | Tên file được tạo, nhập, xuất hoặc sao lưu. |
| `backup_type` | `character varying(30)` | Không | `—` | Loại bản sao lưu. |
| `file_size` | `bigint` | Không | `—` | Kích thước file sao lưu. |
| `created_by` | `bigint` | Không | `—` | Thành viên tạo bản ghi. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |

## `sys_admin.export_logs`

Lịch sử xuất dữ liệu.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('export_logs_id_seq')` | Khóa chính định danh bản ghi. |
| `export_type` | `character varying(50)` | Không | `—` | Loại dữ liệu được xuất. |
| `period` | `character varying(50)` | Không | `—` | Kỳ dữ liệu được xuất. |
| `file_name` | `character varying(255)` | Không | `—` | Tên file được tạo, nhập, xuất hoặc sao lưu. |
| `exported_by` | `bigint` | Không | `—` | Thành viên thực hiện xuất. |
| `exported_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm xuất dữ liệu. |

## `sys_admin.import_logs`

Lịch sử nhập dữ liệu và kết quả xử lý từng đợt.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('import_logs_id_seq')` | Khóa chính định danh bản ghi. |
| `import_type` | `character varying(50)` | Không | `—` | Loại dữ liệu được nhập. |
| `file_name` | `character varying(255)` | Không | `—` | Tên file được tạo, nhập, xuất hoặc sao lưu. |
| `total_rows` | `integer` | Không | `—` | Tổng số dòng trong file nhập. |
| `success_rows` | `integer` | Không | `—` | Số dòng nhập thành công. |
| `failed_rows` | `integer` | Không | `—` | Số dòng nhập thất bại. |
| `imported_by` | `bigint` | Không | `—` | Thành viên thực hiện nhập. |
| `imported_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm nhập dữ liệu. |

## `sys_admin.slack_notification_logs`

Lịch sử gửi thông báo công việc qua Slack.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('slack_notification_logs_id_seq')` | Khóa chính định danh bản ghi. |
| `sent_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm gửi thông báo Slack. |
| `overdue_tasks` | `integer` | Không | `'0'` | Số công việc quá hạn trong thông báo. |
| `upcoming_tasks` | `integer` | Không | `'0'` | Số công việc sắp đến hạn trong thông báo. |
| `status` | `character varying(30)` | Không | `—` | Dữ liệu cho trường status. |
| `message` | `text` | Không | `—` | Nội dung hoặc kết quả gửi thông báo. |

## `sys_admin.slack_settings`

Cấu hình kênh, lịch và điều kiện gửi thông báo Slack.

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Giải thích |
|---|---|:---:|---|---|
| `id` | `bigint` | Có | `nextval('slack_settings_id_seq')` | Khóa chính định danh bản ghi. |
| `webhook_url` | `text` | Có | `—` | Webhook Slack nhận thông báo; cần bảo vệ như thông tin bí mật. |
| `channel` | `character varying(100)` | Không | `—` | Kênh Slack nhận thông báo. |
| `enable_notification` | `boolean` | Không | `true` | Bật/tắt chức năng gửi thông báo. |
| `notify_time` | `time without time zone` | Không | `'08:00:00'` | Giờ gửi thông báo định kỳ. |
| `notify_mon` | `boolean` | Không | `true` | Có gửi vào thứ Hai hay không. |
| `notify_tue` | `boolean` | Không | `true` | Có gửi vào thứ Ba hay không. |
| `notify_wed` | `boolean` | Không | `true` | Có gửi vào thứ Tư hay không. |
| `notify_thu` | `boolean` | Không | `true` | Có gửi vào thứ Năm hay không. |
| `notify_fri` | `boolean` | Không | `true` | Có gửi vào thứ Sáu hay không. |
| `notify_sat` | `boolean` | Không | `false` | Có gửi vào thứ Bảy hay không. |
| `notify_sun` | `boolean` | Không | `false` | Có gửi vào Chủ nhật hay không. |
| `warning_days` | `integer` | Không | `'5'` | Số ngày báo trước cho công việc sắp đến hạn. |
| `created_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamp` | Không | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất. |

## Lưu ý bảo mật và chất lượng dữ liệu

- Không ghi log hoặc xuất trực tiếp `password_hash` và `webhook_url`.
- Nên kiểm tra khóa ngoại và giá trị danh mục trước khi ghi các trường `_id`.
- Các trường tiền tệ dùng `numeric`; không dùng số thực dấu phẩy động trong ứng dụng.
- `created_at` và `updated_at` cần được cập nhật nhất quán; cân nhắc trigger cho `updated_at`.
- Với import, luôn đối soát `total_rows = success_rows + failed_rows`.
