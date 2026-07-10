# PRD-02 — Projects & Tasks
**MKT Hub — Module 2**
Version 1.0 | Cập nhật: 2026-06-20

> Đọc PRD-00-Overview.md trước để nắm Business Rules và phân quyền chung.

---

## 1. Mục Đích

Module quản lý toàn bộ công việc của MKT Team: từ cấp dự án (Project) đến cấp nhiệm vụ (Task). Tích hợp tự động với Weekly Report — mọi task đã tạo tự động đổ vào báo cáo tuần đúng section mà không cần nhập lại.

---

## 2. Cấu Trúc Điều Hướng (Tabs)

```
Projects & Tasks
├── Tab: Danh sách Tasks   — bảng tổng hợp tất cả task, filter đa chiều
├── Tab: Kanban            — view theo status, kéo thả
├── Tab: Weekly Report     — báo cáo tuần tự động từ task data
└── Tab: Projects          — quản lý project, accordion, form tạo nhanh
```

---

## 3. Project — Quản Lý Dự Án

### 3.1 Phân loại Project Type

| Type | Đặc điểm | Task Template |
|---|---|---|
| **Lead Generation** | Dài hạn, chạy liên tục (SEO, kênh online). Không có deadline cứng. KPIs cập nhật thủ công hàng tuần | Không có template cố định |
| **Online Campaign** | Ngắn hạn, có thời điểm bắt đầu/kết thúc rõ ràng | Không có template cố định |
| **Workshop** | Sự kiện offline, có checklist chuẩn | Dùng Event Checklist Template |
| **Event** | Sự kiện offline, có checklist chuẩn | Dùng Event Checklist Template |
| **Exhibition** | Triển lãm, có checklist chuẩn | Dùng Event Checklist Template |
| **Webinar** | Sự kiện online, có checklist chuẩn | Dùng Event Checklist Template |
| **Awards** | Hồ sơ giải thưởng ngành | Không có template cố định |
| **Production** | Sản xuất tư liệu (sales kit, video, ấn phẩm...) | Không có template cố định |

**Event Checklist Template**: khi tạo project thuộc type Workshop/Event/Exhibition/Webinar, hệ thống hỏi "Áp dụng checklist template?" → nếu đồng ý, tự động tạo danh sách task từ template chuẩn.

### 3.2 Fields của Project

| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| Project Name | Text | ✅ | |
| Type | Dropdown | ✅ | 8 giá trị — xem mục 3.1 |
| Status | Dropdown | ✅ | Planning / Active / On Hold / Completed / Cancelled |
| Owner | Dropdown → Members | ✅ | |
| Deadline | Date picker | ❌ | Không bắt buộc với Lead Generation |
| Budget Plan — Direct (VNĐ) | Number | ❌ | Chi phí campaign trực tiếp kế hoạch |
| Budget Plan — Direct Notes | Textarea | ❌ | Ghi chú chi tiết các khoản |
| Budget Plan — Overhead (VNĐ) | Number | ❌ | Chi phí cố định/nhân sự phân bổ kế hoạch |
| Budget Plan — Overhead Notes | Textarea | ❌ | Ghi chú chi tiết |
| Budget Plan Total | Auto-calc | — | Direct + Overhead |
| Actual Cost — Direct (VNĐ) | Number | ❌ | Thực tế phát sinh |
| Actual Cost — Direct Notes | Textarea | ❌ | |
| Actual Cost — Overhead (VNĐ) | Number | ❌ | |
| Actual Cost — Overhead Notes | Textarea | ❌ | |
| Actual Cost Total | Auto-calc | — | Direct + Overhead |
| KPI — Raw Leads Plan | Number | ❌ | |
| KPI — Raw Leads Actual | Number | ❌ | Nhập thủ công |
| KPI — MQL Plan | Number | ❌ | |
| KPI — MQL Actual | Number | ❌ | |
| KPI — SQL Plan | Number | ❌ | |
| KPI — SQL Actual | Number | ❌ | |
| KPI — OPP Plan | Number | ❌ | |
| KPI — OPP Actual | Number | ❌ | |
| KPI — Closed Deal Plan | Number | ❌ | |
| KPI — Closed Deal Actual | Number | ❌ | |
| KPI — Pipeline Value Plan | Number | ❌ | VNĐ |
| KPI — Pipeline Value Actual | Number | ❌ | VNĐ |
| % KPIs đạt | Auto-calc | — | Actual / Plan × 100 cho từng chỉ số |
| % Hoàn thành | Auto-calc | — | BR-004: Done tasks / Total tasks |

### 3.3 View Tổng — Project Accordion

Mỗi project hiển thị thành 1 card có thể expand/collapse:

**Header card (collapsed)**:
- Tên project + Project Type badge
- Owner avatar + tên
- Deadline (màu đỏ nếu quá hạn)
- Status pill
- Progress bar + % hoàn thành
- Số task: tổng / done / in-progress / overdue
- Nút: [+ Add Task] [✏️ Edit] [🗑️ Xoá]

**Body (expanded)**:
- Bảng task của project đó (rút gọn: Task Name / Assignee / Status / Due Date / Priority)
- Nút "Xem chi tiết đầy đủ →"

### 3.4 Form Tạo/Edit Project

Hiển thị dạng panel cố định bên phải (sticky sidebar trong tab Projects).

Khi edit: panel điền sẵn dữ liệu, nút "Hủy" xuất hiện.

---

## 4. Task — Quản Lý Công Việc

### 4.1 Fields của Task

| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| Task Name | Text | ✅ | |
| Description | Textarea | ❌ | |
| Project | Dropdown → Projects | ✅ | Tìm kiếm gợi ý khi gõ |
| Assignee | Dropdown → Members | ✅ | |
| Stakeholders | Multi-select → Dropdown | ❌ | BOD / Sales Team / Dev Team / CS Team |
| Status | Dropdown | ✅ | Xem mục 4.2 |
| Priority | Dropdown | ✅ | High / Medium / Low |
| Start Date | Date picker | ❌ | |
| Due Date | Date picker | ✅ | |
| Completed Date | Date picker | ❌ | Tự động điền khi Status = Done |
| Tuần thực hiện | Number (1–53) | ✅ | Xác định task thuộc Weekly Report tuần nào |
| Reason (Backlog/Pending/Cancel) | Textarea | Tuỳ điều kiện | **BR-001**: Bắt buộc khi Status = Backlog |
| Needed Support BOD | Textarea | ❌ | **BR-002**: Nếu điền → đẩy vào Weekly Report mục "Cần BOD hỗ trợ" |
| Link (Drive / Tool) | URL | ❌ | |
| Remark | Textarea | ❌ | |

### 4.2 Task Status & Transition Rules

| Status | Mô tả | Điều kiện chuyển |
|---|---|---|
| Planning | Chưa bắt đầu | Mặc định khi tạo |
| Processing | Đang thực hiện | Thủ công |
| Done | Hoàn thành | Thủ công → auto điền Completed Date |
| Pending | Tạm ngưng chờ | Thủ công, ghi chú reason |
| Backlog | Bị chặn/blocked | **Bắt buộc có reason** (BR-001) |
| Cancel | Huỷ bỏ | Thủ công, ghi chú reason |
| Overdue | Quá hạn | **Tự động**: khi due_date < today AND status ≠ Done/Cancel |

**Lưu ý**: Overdue không phải status người dùng chọn — hệ thống tự gán màu cảnh báo trong UI nhưng không thay đổi status thực tế trong DB.

### 4.3 Form Tạo/Edit Task (Modal Slide-in)

- Hiển thị dạng panel trượt từ phải vào, phủ overlay mờ phía sau
- Kích thước: width 540px, full height, cuộn nội bộ
- Header sticky: Tiêu đề + nút [💾 Lưu] + nút [×]
- Layout 2 cột bên trong, các field textarea full-width

**Logic đặc biệt**:
- Khi chọn Status = Backlog → field "Reason" xuất hiện và bắt buộc nhập
- Khi chọn Status = Done → tự động điền Completed Date = today
- Khi điền Stakeholders chọn "BOD" → gợi ý điền "Needed Support BOD"

---

## 5. Tab: Danh Sách Tasks

### 5.1 Filter Bar

| Filter | Control |
|---|---|
| Project | Dropdown (tất cả projects) |
| Status | Dropdown (Planning / Processing / Done / Pending / Backlog / Cancel) |
| Priority | Dropdown (High / Medium / Low) |
| Assignee | Dropdown (tất cả members) |
| Due Date From | Date picker |
| Due Date To | Date picker |
| [Xóa lọc] | Button reset tất cả filter |

### 5.2 Stats Bar

Hiển thị dưới filter bar, dạng 6 chip mini:
- Tổng: X task
- Planning: X
- Processing: X
- Done: X
- Overdue: X (đỏ)
- Sắp hạn: X (vàng)

### 5.3 Quick Add Task

Form nhanh 1 hàng ngang:
- Input: Tên task (Enter → mở full modal)
- Dropdown: Project
- Dropdown: Assignee
- Dropdown: Priority
- Date: Due Date
- Nút [+ Thêm] và [📝 Form đầy đủ]

### 5.4 Bảng Task

Cột: ⚠️ (icon alert) | Dự án | Task Name | Assignee | Stakeholders | Status | Priority | Start | Due Date | Done Date | Link | Remark | Thao tác

**Thao tác**: [✏️] mở modal edit, [🗑️] xoá (confirm dialog)

**Màu row**:
- Đỏ nhạt + border-left đỏ: task overdue
- Vàng nhạt + border-left vàng: task sắp hạn (<5 ngày)

**Sort mặc định**: Overdue trước → Sắp hạn → Processing → Planning → Done/Cancel

### 5.5 Import CSV/Excel

Upload file để thêm task hàng loạt:
- Chọn Project đích (hoặc dùng cột `project_id` trong file)
- Kéo thả / browse file `.csv` hoặc `.xlsx`
- Preview 5 dòng đầu trước khi confirm
- Mapping cột tự động theo tên cột chuẩn:

| Tên cột trong file | Field hệ thống |
|---|---|
| `task_name` | Task Name |
| `assignee` | Assignee (match by name) |
| `status` | Status |
| `priority` | Priority |
| `start_date` | Start Date |
| `due_date` | Due Date |
| `exec_week` | Tuần thực hiện |
| `remark` | Remark |

- Nút [📥 Download Template]: tải file mẫu với đúng các cột trên

---

## 6. Tab: Kanban

### 6.1 Cấu trúc Board

6 cột theo status: Planning | Processing | Done | Pending | Backlog | Cancel

Mỗi cột:
- Header: tên status + số lượng task (badge)
- Body: danh sách task card, cuộn nội bộ

### 6.2 Task Card trong Kanban

```
┌─────────────────────────────┐
│ Tên task (bold)             │
│ 📁 Tên project              │
│ 👤 Assignee   ⚡ Priority   │
│ 📅 Due: 15/06/2026          │
└─────────────────────────────┘
```

Border-left màu: đỏ nếu overdue, vàng nếu sắp hạn.

### 6.3 Filter Kanban

- Dropdown Project
- Dropdown Assignee
- Date range (Due date)

---

## 7. Tab: Weekly Report

### 7.1 Mục Đích

Tự động tổng hợp công việc của team theo tuần từ task data. Không cần nhập lại — chỉ cần chọn tuần, hệ thống tự render 4 sections.

### 7.2 Filter Bar

| Control | Mô tả |
|---|---|
| Tuần thực hiện | Input số (1–53) |
| Năm | Dropdown |
| Dự án | Dropdown (tất cả / chọn 1 project) |
| Thành viên | Dropdown (tất cả / chọn 1 người) |
| [Auto-fill] | Render lại 4 sections từ task data |
| [Export TXT] | Xuất văn bản thuần để gửi Slack/email |

### 7.3 Tiêu Đề Báo Cáo

```
📊 Weekly Report — Tuần 23/2026
Toàn team · Tất cả projects · 02/06 – 08/06/2026
```

### 7.4 Bốn Sections Báo Cáo

**Section 1 — ✅ Công việc đã hoàn thành**

Điều kiện lọc task: `tuần thực hiện = W` AND `status = Done`

Mỗi item hiển thị:
- ✅ [Tên task] — [Assignee] — [Project]

---

**Section 2 — 📌 Kế hoạch tuần X+1**

Điều kiện lọc task: `tuần thực hiện = W+1` AND `status IN (Planning, Processing)`

Mỗi item hiển thị:
- 📌 [Tên task] — [Assignee] — Due: [due_date]

---

**Section 3 — 🚧 Backlog / Vấn đề**

Điều kiện lọc task: `status = Backlog`

Mỗi item hiển thị (màu đỏ):
- 🔴 [Tên task] — [Assignee] — Lý do: [reason] (BR-001)

---

**Section 4 — 🤝 Cần BOD hỗ trợ**

Điều kiện lọc task: `needed_support_bod IS NOT NULL AND needed_support_bod ≠ ''`

Mỗi item hiển thị:
- 🤝 [Tên task] — [Assignee] — Nội dung: [needed_support_bod] (BR-002)

### 7.5 Weekly Log (Ghi Chú Thêm)

4 textarea dưới 4 sections (2×2 layout), cho phép ghi chú bổ sung thủ công bên cạnh dữ liệu auto-fill:
- Done (auto + có thể thêm tay)
- Kế hoạch tuần sau (auto + có thể thêm tay)
- Backlog / Vấn đề
- Cần BOD hỗ trợ

Nút [💾 Lưu Log]: lưu nội dung textarea vào DB theo tuần (có thể edit lại).

### 7.6 Export TXT

Format xuất để paste vào Slack/email:

```
📊 WEEKLY REPORT — TUẦN 23/2026 (02/06–08/06/2026)
═══════════════════════════════════

✅ CÔNG VIỆC ĐÃ HOÀN THÀNH
• [Task name] — Nguyen Van A (Campaign Q2)
• ...

📌 KẾ HOẠCH TUẦN 24
• [Task name] — Tran Thi B — Due: 15/06
• ...

🚧 BACKLOG / VẤN ĐỀ
• [Task name] — Nguyen Van A — Lý do: Chờ vendor confirm

🤝 CẦN BOD HỖ TRỢ
• [Task name] — Tran Thi B — Nội dung: Cần duyệt ngân sách Q3
```

---

## 8. Acceptance Criteria

| # | Scenario | Kết quả mong đợi |
|---|---|---|
| AC-P01 | Tạo project type "Workshop" | Hệ thống hỏi áp dụng Event Checklist Template |
| AC-P02 | Tạo project type "Lead Generation" | Field Deadline không bắt buộc, không có gợi ý template |
| AC-P03 | Chuyển task sang Backlog mà không điền Reason | Hệ thống báo lỗi, không cho lưu (BR-001) |
| AC-P04 | Điền Needed Support BOD → mở Weekly Report tuần đó | Task xuất hiện trong Section 4 |
| AC-P05 | Task có due date hôm qua, status = Processing | Row màu đỏ, badge overdue +1, hiện trong Alert Dashboard |
| AC-P06 | Auto-fill Weekly Report tuần 23 | Section 1 lấy task Done tuần 23, Section 2 lấy task Planning tuần 24 |
| AC-P07 | Import 10 task từ CSV | 10 task thêm vào đúng project, preview hiện trước khi confirm |
| AC-P08 | Lead Generation project — xem % hoàn thành | Tính từ task Done/Tổng task, không cần deadline |
