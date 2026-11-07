# Front-end Specification — Module 3: Leads & KPIs

## Navigation/screens

- Tabs: Nhập Số Liệu, Xem & Phân Tích, So Sánh Kỳ.
- Khu vực OPP, Closed Deal và danh sách khách hàng.

## Input behavior

- Plan theo năm; Actual theo ISO week; count/value không âm.
- OPP/Closed Deal detail hỗ trợ add/edit/delete row.
- Manager và Specialist được sửa tuần đã lưu; phải cảnh báo update lịch sử.
- Cảnh báo unsaved changes khi đổi period/tab hoặc rời trang.

## OPP → Won

- Mở form/confirm bổ sung field còn thiếu.
- Thành công cập nhật OPP, Won, count và values cùng lúc.
- Thất bại giữ nguyên UI; không tạo Won tạm không có nguồn.

## Analytics/comparison

- KPI cards, funnel, segment tables và period comparison dùng chung filter state.
- So sánh hiển thị absolute delta và delta %; mẫu số 0 là N/A.
- Tiền format VNĐ; chart có empty/error state.

## Acceptance checks

- Save actual refresh Dashboard liên quan.
- OPP convert không còn xuất hiện như open pipeline.
- Không hiển thị NaN khi stage trước bằng 0.
