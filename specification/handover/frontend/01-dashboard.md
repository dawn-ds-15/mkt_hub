# Front-end Specification — Module 1: Dashboard

## Screen/components

- `DashboardPage`, period tabs Tuần/Tháng/Quý/Năm và period selector.
- Topbar: current cycle, overdue/due-soon badges, avatar.
- 7 KPI cards; Funnel; MKT Activities; Project Progress; Task Donut; Alerts.
- Toàn bộ module read-only.

## Display behavior

- `% vs Plan`: xanh ≥100%, vàng 80–99%, đỏ <80%; progress cap 100%.
- Funnel dùng Raw Leads làm 100%, conversion so với bước liền trước.
- Project progress: xanh ≥70%, vàng 40–69%, đỏ <40%; tối đa 5 project.
- Alert chia Overdue/Due Soon; click mở đúng Task modal ở Module 2.
- Link điều hướng giữ period context nếu màn đích hỗ trợ.

## States/validation

- Mỗi widget có loading, empty, error/retry độc lập.
- Null metric hiển thị N/A, tuyệt đối không render NaN/Infinity.
- Hiển thị last updated/sync status.
- Dashboard cần load <2 giây theo PRD.

## Acceptance checks

- Đổi period cập nhật đồng thời tất cả widget.
- Task Done/Cancel không xuất hiện trong alerts.
- Manager và Specialist nhìn cùng số liệu với cùng filter.
