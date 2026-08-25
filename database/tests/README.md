# Xác minh database cho DA-RISK-005

Chỉ chạy các bước kiểm tra này trên database test độc lập. Tuyệt đối không chạy các phép thử import, reset hoặc restore có tính phá hủy trên production.

## Kiểm tra tự động tính toàn vẹn dữ liệu lõi

Chạy lệnh:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/integrity_test_cases.sql
```

Kết quả mong đợi:

- PostgreSQL in ra `DA-RISK-005 core integrity checks passed`.
- Script kết thúc bằng `ROLLBACK`.
- Không còn member, project hoặc task test nào trong database.

File SQL kiểm tra các trường hợp: tạo và cập nhật hợp lệ, từ chối dữ liệu trùng, từ chối khóa ngoại không hợp lệ, phát hiện dữ liệu mồ côi, làm tròn số tiền, quy đổi múi giờ và các trường soft-delete của project.

## Các bước phải kiểm tra thủ công trước khi release

### Transaction khi import

1. Sao lưu database test.
2. Import một file gồm một dòng hợp lệ, một dòng bị trùng và một dòng có khóa ngoại sai.
3. Xác minh đúng chính sách đã thống nhất: toàn bộ import phải rollback, hoặc các dòng bị từ chối phải được báo lỗi rõ ràng.
4. Đảm bảo không xảy ra import một phần mà hệ thống không thông báo.

### Restore và reset

1. Ghi lại số lượng record và checksum trước khi backup.
2. Restore sang một database mới và đang rỗng.
3. So sánh số lượng record, kết quả kiểm tra FK/dữ liệu mồ côi và giá trị sequence tiếp theo.
4. Chỉ chạy reset trên database có thể xóa bỏ, đồng thời xác minh audit log.

### Cập nhật đồng thời

1. Mở hai phiên database hoặc API độc lập.
2. Cả hai phiên cùng đọc một record và giá trị `updated_at`.
3. Phiên A cập nhật rồi commit.
4. Phiên B gửi bản cập nhật dựa trên dữ liệu cũ.
5. Phiên B phải nhận lỗi conflict; nếu hệ thống dùng chính sách lần ghi cuối cùng thắng thì chính sách đó phải được ghi rõ.

### Audit và che thông tin bí mật

Xác minh các thao tác create, update, archive, import, restore và reset đều ghi lại người thực hiện, thời gian, hành động và ID đối tượng. Log, file export, backup và API response không được để lộ password hash, JWT, database URL, API key hoặc Slack secret.

### RBAC và IDOR

Dùng ít nhất một tài khoản manager và một tài khoản specialist để test. Với mỗi endpoint đọc/ghi, thay ID đối tượng bằng ID thuộc user khác. Backend phải từ chối mọi thao tác nằm ngoài phạm vi quyền của user đang đăng nhập.

## Điều kiện cho phép release

Giữ DA-RISK-005 ở trạng thái mở cho đến khi có bằng chứng rằng bài kiểm tra SQL tự động và toàn bộ bước thủ công bên trên đã chạy thành công. Không được thêm dữ liệu test vào production chỉ để đóng rủi ro này.

## Kiểm tra KPI tháng — DB-01 phương án B

Sau khi import đủ `core.sql`, `finance.sql`, `marketing.sql` và `sys.sql`,
chạy lại `database/tests/integrity_test_cases.sql`. Các truy vấn bất thường KPI
phải trả về 0 dòng. Báo cáo cuối cùng hiển thị tổng target theo năm và KPI.

Khi đã nhập đủ target tháng, cập nhật tổng năm và audit trong cùng transaction:

```sql
BEGIN;
-- Update marketing.kpi_monthly_plan_values here.
SELECT marketing.apply_kpi_monthly_plan(:plan_id, :user_id);
COMMIT;
```
