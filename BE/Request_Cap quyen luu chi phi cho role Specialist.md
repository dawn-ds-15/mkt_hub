# Request: Cấp quyền lưu chi phí cho role Specialist

## Thông tin Jira
- Tiêu đề: [Smartlog][API][EXPENSE] Cấp quyền lưu chi phí cho role Specialist
- Loại: API tích hợp / Phân quyền RBAC
- Module: Expense Management

## Mô tả yêu cầu

**Là** Người dùng có role Specialist  
**Muốn** Được cấp quyền tạo bản ghi chi phí và thêm dòng chi phí trên module Quản lý Chi phí  
**Để** Có thể tự nhập và lưu chi phí dự án mà không cần nhờ role Manager

## Stakeholders
- Backend
- Frontend
- QA

## Giao diện cần có & Logic hoạt động

### Vấn đề hiện tại
Hiện tại, tài khoản có role specialist khi thực hiện lưu chi phí tại màn hình **Quản lý Chi phí > Nhập chi phí > Nhập chi phí dự án** không thể lưu thành công.

Khi kiểm tra trên Network, request POST /v1/expenses đang trả về **HTTP 403 Forbidden**. Điều này cho thấy đã xác thực thành công (có token hợp lệ) nhưng role specialist chưa được cấp quyền ghi trên module Chi phí.

Trong khi đó, tài khoản role manager vẫn thực hiện lưu chi phí bình thường.

### Yêu cầu xử lý
Cập nhật ma trận phân quyền (RBAC) cho module expenses để cấp quyền ghi cho role specialist trên toàn bộ chuỗi API phục vụ việc nhập chi phí.

### Danh sách endpoint cần mở quyền

| Endpoint | Method | Hành động | Yêu cầu |
|---|---|---|---|
| /api/v1/expenses | POST | Tạo bản ghi chi phí mới | Cho phép role specialist |
| /api/v1/expenses/:expenseId/lines | POST | Thêm dòng chi phí vào bản ghi chi phí | Cho phép role specialist |
| /api/v1/expenses/lines/:lineId/attachments | POST | Upload hồ sơ đính kèm cho dòng chi phí (nếu có file đính kèm) | Cho phép role specialist |

### Lưu ý
- **Chỉ mở quyền ghi:** Chỉ cấp quyền CREATE/WRITE cho role specialist. Không thay đổi quyền READ hiện tại.
- **Không ảnh hưởng các role khác:** Giữ nguyên phân quyền hiện tại của role manager, dmin.
- **Trả đúng mã lỗi:** Trường hợp user đã đăng nhập hợp lệ nhưng không có quyền, API vẫn phải trả về 403 Forbidden. Không trả về 401 Unauthorized để tránh FE hiểu nhầm là phiên đăng nhập hết hạn.
- **Áp dụng cho toàn bộ chuỗi:** Cần đảm bảo tất cả endpoint trên đều được cấp quyền, vì FE thực hiện lưu theo trình tự: tạo bản ghi chi phí -> thêm từng dòng chi phí -> upload file đính kèm (nếu có).

### Cách kiểm tra
1. Đăng nhập bằng tài khoản có role specialist.
2. Vào **Quản lý Chi phí > Nhập chi phí > Nhập chi phí dự án**, chọn dự án và nhập ít nhất 1 dòng chi phí hợp lệ.
3. Bấm **Lưu chi phí**.
4. Kết quả mong đợi: Lưu thành công, không xuất hiện lỗi HTTP 401 hay HTTP 403. Bản ghi chi phí mới xuất hiện tại **Lịch sử chi phí** của dự án tương ứng.
