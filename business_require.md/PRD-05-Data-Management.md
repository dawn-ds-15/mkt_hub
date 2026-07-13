# PRD-05 — Data Management
**MKT Hub — Module 5**
Version 1.0 | Cập nhật: 2026-06-20

> Đọc PRD-00-Overview.md trước để nắm Business Rules và phân quyền chung.
> **Phân quyền**: Import/Export — Manager + Specialist. Team Members / Dropdown / Backup / Slack config — chỉ Manager.

---

## 1. Mục Đích

Khu vực quản trị nền tảng hệ thống: nhập/xuất dữ liệu hàng loạt, quản lý thành viên team, cấu hình các giá trị dropdown, tích hợp Slack notification, và sao lưu dữ liệu.

---

## 2. Cấu Trúc Điều Hướng (Tabs)

```
Data Management
├── Tab: Import Data      — Upload CSV/Excel để nhập hàng loạt
├── Tab: Export Data      — Xuất báo cáo PDF / Excel
├── Tab: Team Members     — Quản lý 4 thành viên, gán role
├── Tab: Dropdown Config  — Cấu hình giá trị dropdown toàn hệ thống
├── Tab: Slack Settings   — Cấu hình Webhook + thông báo deadline
└── Tab: Backup & Reset   — Xuất toàn bộ data, reset sandbox
```

---

## 3. Tab: Import Data

### 3.1 Loại Dữ Liệu Có Thể Import

| Loại | Dùng để | Module đích |
|---|---|---|
| Task Bulk Import | Thêm nhiều task vào 1 project | Projects & Tasks |
| KPI History Import | Nhập dữ liệu actual nhiều tuần/tháng đã qua | Leads & KPIs |
| Closed Deal History | Nhập danh sách khách hàng cũ (năm trước) | Leads & KPIs → Expense |

### 3.2 Giao Diện Import

**Bước 1 — Chọn loại dữ liệu**

Dropdown "Loại dữ liệu": Task / KPI History / Closed Deal History

**Bước 2 — Chọn đích (nếu cần)**

- Với Task: chọn Project đích (hoặc dùng cột `project_id` trong file)
- Với KPI History / Closed Deal: chọn Năm

**Bước 3 — Upload file**

Drag & Drop zone:
- Định dạng hỗ trợ: `.csv`, `.xlsx`, `.xls`
- Kích thước tối đa: 10MB
- Text hướng dẫn: "Kéo thả file CSV/Excel vào đây hoặc click để chọn"
- Hiển thị tên file sau khi chọn

**Bước 4 — Preview**

Sau khi chọn file, hiển thị:
- Tên file + số dòng phát hiện
- Bảng preview 5 dòng đầu với đúng cột đã mapping
- Thống kê: X dòng hợp lệ / Y dòng lỗi (thiếu trường bắt buộc)
- Danh sách lỗi cụ thể (nếu có): "Dòng 3: thiếu task_name", "Dòng 7: due_date sai định dạng"

**Bước 5 — Xác nhận**

- Nút [✅ Xác nhận Import]: chỉ import dòng hợp lệ, bỏ qua dòng lỗi
- Nút [✕ Hủy]: huỷ toàn bộ
- Nút [📥 Download Template]: tải file mẫu đúng format cho loại đang chọn

**Kết quả**:
- Toast: "✅ Import thành công X dòng. Bỏ qua Y dòng lỗi."
- Dữ liệu xuất hiện ngay trong module tương ứng

### 3.3 Template Files

#### Template Task Import (task_template.xlsx)

| task_name | project_id | assignee | status | priority | start_date | due_date | exec_week | remark |
|---|---|---|---|---|---|---|---|---|
| Ví dụ task | 1 | Nguyen Van A | Planning | High | 2026-06-15 | 2026-06-30 | 26 | |

#### Template KPI History Import (kpi_template.xlsx)

| year | week | raw_leads | mql | sql | opp_count | closed_deal_count |
|---|---|---|---|---|---|---|
| 2026 | 20 | 280 | 112 | 49 | 10 | 4 |

#### Template Closed Deal History Import (deals_template.xlsx)

| year | week | company_name | size | project | setup_fee | monthly_fee | closed_date |
|---|---|---|---|---|---|---|---|
| 2025 | 10 | Công ty ABC | Enterprise | Lead Generation | 50000000 | 5000000 | 2025-03-10 |

---

## 4. Tab: Export Data

### 4.1 Export PDF — Weekly Report

**Cấu hình**:
- Chọn tuần + năm
- Chọn project (tất cả hoặc 1 project)
- Chọn thành viên (tất cả hoặc 1 người)

**Format PDF**:
- Trang 1: Tiêu đề + thông tin kỳ + KPI summary (nếu chọn tất cả)
- Trang 2: Section Done + Section Plan
- Trang 3: Section Backlog + Section BOD Support
- Font đọc được khi in, không cắt ngang nội dung

**Nút**: [📄 Xuất PDF]

### 4.2 Export Excel — Dashboard Report

**Cấu hình**:
- Chọn kỳ: Tuần / Tháng / Quý / Năm
- Chọn năm

**Cấu trúc file Excel (đa sheet)**:
- **Sheet 1 — Summary**: KPI plan vs actual, % vs plan, CAC, LTV, LTV:CAC
- **Sheet 2 — Task List**: Toàn bộ task trong kỳ với tất cả fields
- **Sheet 3 — Leads Detail**: Danh sách Closed Deal, Pipeline detail theo tuần

**Nút**: [📊 Xuất Excel]

### 4.3 Export Full Data (Backup)

Xuất toàn bộ dữ liệu hệ thống ra file Excel đa sheet (dùng cho backup và audit):
- Sheet: Projects, Tasks, KPI_Weekly, Closed_Deals, Expenses, Members, Audit_Log

**Nút**: [📦 Export Full Data] — chỉ Manager

---

## 5. Tab: Team Members

### 5.1 Danh Sách Members Hiện Tại

Bảng hiển thị:
| Avatar | Tên | Email | Role | Trạng thái | Thao tác |
|---|---|---|---|---|---|
| TN | Truc Nguyen | ... | Manager | ✅ Active | [✏️] |
| ... | | | Specialist | ✅ Active | [✏️] [🗑️] |

### 5.2 Form Thêm/Sửa Member

| Field | Type | Bắt buộc |
|---|---|---|
| Họ và tên | Text | ✅ |
| Email | Email | ✅ |
| Role | Dropdown: Manager / Specialist | ✅ |
| Avatar (chữ viết tắt) | Auto-gen từ tên | — |
| Trạng thái | Toggle: Active / Inactive | ✅ |
| Password mới | Password | Chỉ khi tạo mới |

**Lưu ý**:
- Không thể tự xoá hoặc hạ role của chính mình
- Deactivate member → member không đăng nhập được, nhưng dữ liệu (task assignee, audit log) vẫn giữ nguyên

---

## 6. Tab: Dropdown Config

### 6.1 Mục Đích

Manager cấu hình các giá trị dropdown toàn hệ thống. Thay đổi ở đây phản chiếu ngay vào tất cả form trong hệ thống.

### 6.2 Danh Sách Dropdown Có Thể Cấu Hình

| Dropdown Key | Tên hiển thị | Giá trị mặc định |
|---|---|---|
| `project_type` | Loại Project | workshop, event, exhibition, webinar, Online Campaign, Lead Generation, Awards, Production |
| `project_status` | Trạng thái Project | Planning, Active, On Hold, Completed, Cancelled |
| `task_status` | Trạng thái Task | Planning, Processing, Done, Pending, Backlog, Cancel |
| `task_priority` | Độ ưu tiên Task | High, Medium, Low |
| `company_size` | Phân khúc Khách hàng | Enterprise, Medium |
| `stakeholder` | Stakeholders | BOD, Sales Team, Dev Team, CS Team |

### 6.3 Giao Diện Cấu Hình

Chọn dropdown key → hiện danh sách các giá trị hiện tại dạng tag:

```
[Planning ×] [Active ×] [On Hold ×] [Completed ×] [Cancelled ×]  [+ Thêm giá trị]
```

- Kéo thả để sắp xếp thứ tự hiển thị
- Click [×] để xoá (có warning nếu giá trị đang được dùng)
- [+ Thêm giá trị]: input text → Enter để thêm

**Lưu ý**: Xoá giá trị đang được dùng bởi record hiện có → hệ thống cảnh báo số lượng record bị ảnh hưởng và yêu cầu confirm.

---

## 7. Tab: Slack Settings

### 7.1 Tổng Quan

Tích hợp Slack Webhook để tự động thông báo task deadline vào group Slack của MKT Team.

### 7.2 Cấu Hình Webhook

| Field | Type | Ghi chú |
|---|---|---|
| Slack Webhook URL | URL | Lấy từ Slack App settings |
| Channel | Text | VD: #mkt-alerts |
| Nút [Test Webhook] | Button | Gửi message test: "✅ MKT Hub kết nối thành công!" |
| Nút [💾 Lưu] | Button | |

### 7.3 Cấu Hình Thông Báo Deadline

| Setting | Giá trị | Ghi chú |
|---|---|---|
| Bật/Tắt thông báo | Toggle On/Off | |
| Gửi thông báo lúc | Time picker | Mặc định: 08:00 sáng |
| Ngày gửi | Checkbox: T2–T6 / T7 / CN | Mặc định: T2–T6 |
| Cảnh báo sắp hạn | Số ngày trước deadline | Mặc định: 5 ngày |

### 7.4 Format Thông Báo Slack

**Gửi hàng ngày vào giờ đã cài** (nếu có task cần cảnh báo):

```
🔔 MKT Hub — Cập nhật Task [Thứ Hai 02/06/2026]

🔴 QUÁ HẠN (2 task)
• Thiết kế banner Q3 — Chi Pham (Campaign Q2) — Quá hạn 2 ngày
• Review content tháng 6 — An Tran (SEO Revamp) — Quá hạn 1 ngày

🟡 SẮP ĐẾN HẠN (3 task)
• Content Blog T6 — An Tran — Còn 2 ngày (08/06)
• Review Q2 Report — Truc Nguyen — Còn 3 ngày (09/06)
• Chuẩn bị tư liệu event — Chi Pham — Còn 5 ngày (11/06)

👉 Xem chi tiết: [Link MKT Hub]
```

**Không gửi** nếu không có task nào cần cảnh báo trong ngày đó.

### 7.5 Lịch Sử Thông Báo Đã Gửi

Bảng hiển thị 30 lần gửi gần nhất:
| Thời gian | Số task overdue | Số task sắp hạn | Trạng thái |
|---|---|---|---|
| 02/06 08:00 | 2 | 3 | ✅ Gửi thành công |
| 01/06 08:00 | 0 | 1 | ✅ Gửi thành công |
| 31/05 08:00 | 1 | 4 | ❌ Lỗi — Webhook timeout |

---

## 8. Tab: Backup & Reset

### 8.1 Backup Thủ Công

- Nút [📦 Tạo Backup ngay]: xuất file JSON + Excel đầy đủ toàn bộ DB
- Tên file: `mkthub_backup_YYYYMMDD_HHMMSS.zip`
- Danh sách 10 backup gần nhất với nút Download

### 8.2 Reset Sandbox (Xoá Demo Data)

- Nút [🗑️ Reset về ban đầu]
- Confirm dialog 2 bước: gõ "RESET" để xác nhận
- **Chỉ xoá data demo/test**, không xoá cấu hình members và dropdown
- Không thể hoàn tác

### 8.3 Restore từ Backup

- Upload file backup `.zip` trước đó
- Preview nội dung backup (số records mỗi bảng)
- Confirm: "Dữ liệu hiện tại sẽ bị thay thế bởi backup này"
- Chỉ Manager thực hiện được

---

## 9. Audit Log UI

Mặc dù Audit Log ghi tự động (định nghĩa ở PRD-00), Manager có thể xem tại đây:

**Filter**:
- User: chọn member
- Loại action: Create / Update / Delete
- Entity type: Project / Task / KPI / Expense / Member
- Khoảng thời gian

**Bảng**:
| Thời gian | User | Action | Entity | Field | Giá trị cũ | Giá trị mới |
|---|---|---|---|---|---|---|
| 15/06 09:32 | Truc Nguyen | Update | Task #42 | Status | Processing | Done |

---

## 10. Acceptance Criteria

| # | Scenario | Kết quả mong đợi |
|---|---|---|
| AC-DM01 | Upload task CSV 50 dòng, 3 dòng thiếu task_name | Preview hiện "47 hợp lệ / 3 lỗi", import 47 dòng, toast thông báo |
| AC-DM02 | Specialist vào Tab Team Members | Không thấy nút Thêm/Sửa/Xoá member |
| AC-DM03 | Manager thêm giá trị "Sponsorship" vào dropdown project_type | Dropdown Project Type trong module Projects hiện thêm "Sponsorship" ngay lập tức |
| AC-DM04 | Xoá giá trị dropdown "Active" đang được 5 project dùng | Cảnh báo "5 project đang dùng giá trị này. Bạn có chắc chắn?" |
| AC-DM05 | Cấu hình Slack Webhook → bấm Test | Slack nhận được message "✅ MKT Hub kết nối thành công!" |
| AC-DM06 | 08:00 sáng, có 2 task overdue + 1 sắp hạn | Slack nhận message đúng format, đủ thông tin 3 task |
| AC-DM07 | Không có task cần cảnh báo | Slack không nhận message nào |
| AC-DM08 | Export Excel kỳ Quý 2/2026 | File có 3 sheet, Sheet 1 tổng hợp KPI Q2, Sheet 2 task list, Sheet 3 deal list |
| AC-DM09 | Bấm [Reset về ban đầu] không gõ "RESET" | Nút confirm bị disable |
| AC-DM10 | Xem Audit Log sau khi Specialist sửa task | Log hiện "Specialist Name — Update — Task #X — Status: Planning → Processing" |
