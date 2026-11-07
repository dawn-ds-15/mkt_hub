---
editor_options: 
  markdown: 
    wrap: 72
---

# PRD-01 — Dashboard & Báo Cáo Tổng Quan

**MKT Hub — Module 1** Version 1.0 \| Cập nhật: 2026-06-20

> Đọc PRD-00-Overview.md trước để nắm Business Rules và phân quyền
> chung.

------------------------------------------------------------------------

## 1. Mục Đích

Dashboard là màn hình mặc định khi đăng nhập. Cung cấp cái nhìn tổng
quan toàn bộ hoạt động MKT trong kỳ đang chọn: KPIs thực tế so với kế
hoạch, tiến độ project, trạng thái task, và cảnh báo deadline.

**Mọi widget trên Dashboard là read-only** — không nhập liệu tại đây. Dữ
liệu tự động cập nhật từ module Leads & KPIs, Projects & Tasks, và
Expense Management.

------------------------------------------------------------------------

## 2. Bộ Lọc Thời Gian (Period Filter)

Bộ lọc áp dụng đồng thời cho toàn bộ Dashboard.

| Control   | Giá trị           | Ghi chú                               |
|-----------|-------------------|---------------------------------------|
| Tab Tuần  | Tuần ISO (1–53)   | Hiển thị dữ liệu tuần đang chọn       |
| Tab Tháng | Tháng 1–12        | Cộng dồn dữ liệu các tuần trong tháng |
| Tab Quý   | Q1 / Q2 / Q3 / Q4 | Cộng dồn dữ liệu các tháng trong quý  |
| Tab Năm   | 4 chữ số          | Cộng dồn dữ liệu cả năm               |

Selector năm nằm ở sidebar (Global Filter), selector kỳ nằm ở đầu trang
Dashboard.

------------------------------------------------------------------------

## 3. Topbar

Hiển thị thường trực phía trên, không cuộn theo trang.

| Thành phần      | Mô tả                                                 |
|-----------------|-------------------------------------------------------|
| Tiêu đề trang   | "Dashboard Overview"                                  |
| Chu kỳ hiện tại | VD: "Tuần 23 · Tháng 6/2026 · Q2/2026"                |
| Badge đỏ        | "🔴 X Quá hạn" — số task đang overdue (BR-010)        |
| Badge vàng      | "🟡 X Sắp hạn" — số task sẽ due trong 5 ngày (BR-010) |
| Badge xanh      | Chu kỳ hiện tại: "Tuần 23/2026"                       |
| Avatar          | Chữ viết tắt tên người dùng đang đăng nhập            |

------------------------------------------------------------------------

## 4. Khu Vực KPI Cards

Hiển thị 7 card theo hàng ngang, mỗi card là một chỉ số trong phễu MKT.

### 4.1 Danh sách card và dữ liệu hiển thị

| Card           | Màu        | Giá trị chính          | Giá trị phụ                            |
|------------------|------------------|------------------|------------------|
| Raw Leads      | Xanh dương | Actual số lượng        | Plan · % vs Plan · Progress bar        |
| MQL            | Vàng       | Actual số lượng        | Plan · % vs Plan · Conv% (MQL/Leads)   |
| SQL            | Cam        | Actual số lượng        | Plan · % vs Plan · Conv% (SQL/MQL)     |
| OPP            | Tím nhạt   | Actual số lượng        | Plan · % vs Plan · Conv% (OPP/SQL)     |
| Closed Deal    | Xanh lá    | Actual số lượng        | Plan · % vs Plan · Conv% (Closed/OPP)  |
| Pipeline Value | Tím        | Tổng giá trị OPP (VNĐ) | Plan · % vs Plan                       |
| CAC / LTV      | Xám        | CAC kỳ hiện tại        | LTV · LTV:CAC ratio + health indicator |

### 4.2 Logic tính toán

**% vs Plan**: `(Actual / Plan) × 100` - Màu xanh lá nếu ≥ 100% - Màu đỏ
nếu \< 80% - Màu vàng nếu 80–99%

**Conv%** (BR-003): tính tuần tự giữa 2 bước kề nhau - MQL Conv% = MQL /
Raw Leads × 100 - SQL Conv% = SQL / MQL × 100 - OPP Conv% = OPP / SQL ×
100 - Closed Conv% = Closed Deal / OPP × 100

**Progress bar**: chiều dài = min(% vs Plan, 100%) để không tràn card

------------------------------------------------------------------------

## 5. Widget: Funnel Chuyển Đổi

**Loại chart**: Horizontal bar chart dạng phễu (bars thu hẹp dần)

**Dữ liệu mỗi hàng**: - Tên bước (Raw Leads / MQL / SQL / OPP / Closed
Deal) - Thanh bar: độ rộng tỉ lệ với actual so với Raw Leads (bước đầu =
100%) - Số actual - Conv% so với bước trước (hiển thị bên phải) - % vs
Plan (hiển thị nhỏ bên dưới số actual)

**Màu bars**: Blue → Light Blue → Orange → Amber → Green (giảm dần)

**Click "Chi tiết →"**: điều hướng sang tab Overview của module Leads &
KPIs.

------------------------------------------------------------------------

## 6. Widget: Hiệu Suất MKT Activities

**Mục đích**: So sánh Plan vs Actual của các loại project đang chạy
trong kỳ.

**Loại chart**: Horizontal grouped bar chart — mỗi project type là 1
nhóm 2 thanh (Plan màu xanh nhạt, Actual màu xanh đậm)

**Trục Y**: Tên project type (chỉ hiện các type có ít nhất 1 project
active trong kỳ)

**Metric so sánh**: Số lượng lead/KPI target của project type đó vs
actual

**Ghi chú**: Nếu không có project nào trong kỳ → widget hiển thị "Chưa
có dữ liệu kỳ này"

------------------------------------------------------------------------

## 7. Widget: Project Progress

**Hiển thị**: - Dòng tổng: "Tổng tiến độ: X%" (trung bình cộng tất cả
project Active — BR-004) - Danh sách từng project Active trong kỳ, mỗi
project 1 hàng: - Tên project - Progress bar (màu thay đổi theo %: xanh
≥70%, vàng 40–69%, đỏ \<40%) - % số

**Giới hạn hiển thị**: tối đa 5 project, có link "Xem tất cả →" dẫn sang
module Projects.

**Click "Quản lý →"**: điều hướng sang tab Projects trong module
Projects & Tasks.

------------------------------------------------------------------------

## 8. Widget: Task Status (Donut Chart)

**Loại chart**: Donut chart SVG

**Phân khúc**: \| Status \| Màu \| \|---\|---\| \| Done \| Xanh lá
#10B981 \| \| Processing \| Xanh dương #3B82F6 \| \| Planning \| Xám
#94A3B8 \| \| Pending \| Vàng #F59E0B \| \| Backlog \| Cam #F97316 \| \|
Cancel \| Đỏ nhạt #EF4444 \|

**Tâm donut**: hiển thị tổng số task

**Legend**: hiển thị bên phải, format "Status: X task"

**Phạm vi dữ liệu**: tất cả task thuộc project Active trong kỳ đang lọc.

------------------------------------------------------------------------

## 9. Widget: Alert (Cảnh Báo Deadline)

Hiển thị danh sách task cần chú ý, sắp xếp theo mức độ ưu tiên.

### 9.1 Nhóm Quá hạn 🔴

Điều kiện: `due_date < today` AND `status NOT IN (Done, Cancel)`

Hiển thị mỗi item: - Màu nền đỏ nhạt, border-left đỏ - Tên task (bold) -
Tên assignee - Số ngày quá hạn: "Quá hạn X ngày" - Due date gốc

### 9.2 Nhóm Sắp Hạn 🟡

Điều kiện: `due_date` trong vòng 5 ngày tới AND
`status NOT IN (Done, Cancel)`

Hiển thị mỗi item: - Màu nền vàng nhạt, border-left vàng - Tên task
(bold) - Tên assignee - Số ngày còn lại: "Còn X ngày" - Due date

### 9.3 Hành động

-   Click vào item alert → mở task modal (edit) tại module Projects &
    Tasks
-   Nếu không có alert nào → hiển thị "✅ Không có task nào cần chú ý"

------------------------------------------------------------------------

## 10. Luồng Dữ Liệu Dashboard

```         
Leads & KPIs (nhập actual)
    └─→ KPI Cards (Raw Leads, MQL, SQL, OPP, Closed, Pipeline)
    └─→ Funnel Chart

Projects (CRUD project)
    └─→ Project Progress Widget
    └─→ MKT Activities Chart

Tasks (CRUD task)
    └─→ Task Status Donut
    └─→ Alert Widget
    └─→ Topbar badges

Expense (nhập chi phí, Churn Rate, Gross Margin)
    └─→ CAC / LTV Card
```

Mọi thay đổi dữ liệu tại module nguồn cập nhật Dashboard trong \< 500ms
(BR từ PRD-00).

------------------------------------------------------------------------

## 11. Trạng Thái Đồng Bộ (Sync Status)

Hiển thị ở góc trên phải nội dung Dashboard:

| Trạng thái   | Visual                             |
|--------------|------------------------------------|
| Đang đồng bộ | Spinner xanh + "Đang cập nhật..."  |
| Đã đồng bộ   | ✓ + timestamp "Cập nhật lúc HH:MM" |
| Lỗi          | ⚠️ đỏ + nút "Thử lại"              |

------------------------------------------------------------------------

## 12. Acceptance Criteria

| \#     | Scenario                           | Kết quả mong đợi                                               |
|------------------------|------------------------|------------------------|
| AC-D01 | Chọn "Tháng 6" → các widget        | Tất cả số liệu cộng dồn từ Tuần 22–26 (các tuần thuộc tháng 6) |
| AC-D02 | Có 1 task quá hạn                  | Topbar badge "🔴 1 Quá hạn", Alert widget hiện item đó         |
| AC-D03 | Specialist nhập KPI tuần → bấm lưu | Dashboard tự cập nhật KPI Cards trong \< 500ms                 |
| AC-D04 | Không có project Active            | Project Progress hiện "Chưa có project đang chạy"              |
| AC-D05 | LTV:CAC = 1.2                      | CAC/LTV card hiển thị 🔴 Nguy hiểm                             |
| AC-D06 | LTV:CAC = 3.0                      | CAC/LTV card hiển thị 🟢 Tỷ lệ vàng                            |
