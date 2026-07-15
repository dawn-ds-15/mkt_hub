# Front-end Specification — Module 4: Expense Management

## Role behavior

- Manager được nhập/sửa/xóa expense và assumptions.
- Specialist chỉ xem; không thấy Save/Edit/Delete và xử lý 403 nếu truy cập trực tiếp.

## Screens/forms

- Tabs: Nhập Chi Phí, Tổng Quan, Báo Cáo.
- Project selector loại Cancelled project.
- Form gồm month/year, Direct, Direct note, Overhead, Overhead note; Total tự tính.
- Assumption form bắt buộc effective period.
- Currency input giữ raw numeric value, format khi blur.

## Overview/report

- Cards: total cost, CAC, LTV, ratio, new customers.
- Project table: budget, actual, variance, customers, CAC.
- Charts: cost share, cost/CAC trend, Budget vs Actual; detail table.
- Chart và table dùng chung month/quarter/year filter.

## Edge states/AC

- Customers = 0 hiển thị “N/A — Chưa có khách hàng mới”.
- Thiếu assumption/deal data hiển thị N/A kèm lý do.
- Không tự đặt nhãn ratio >4 trước khi BA chốt.
- Đổi assumption tháng 7 không làm UI báo cáo tháng 6 thay đổi.
