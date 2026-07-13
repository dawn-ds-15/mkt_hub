# PRD-03 — Leads & KPIs
**MKT Hub — Module 3**
Version 1.0 | Cập nhật: 2026-06-20

> Đọc PRD-00-Overview.md trước để nắm Business Rules và phân quyền chung.

---

## 1. Mục Đích

Module trung tâm để quản lý toàn bộ phễu chuyển đổi Marketing: từ Raw Lead → MQL → SQL → OPP → Closed Deal. Cho phép nhập kế hoạch năm, cập nhật số liệu thực tế hàng tuần, xem báo cáo tổng hợp, và so sánh cùng kỳ nhiều năm.

Dữ liệu module này là nguồn cho:
- Dashboard KPI Cards
- Dashboard Funnel Chart
- Expense Management (số lượng khách hàng mới để tính CAC)

---

## 2. Cấu Trúc Điều Hướng (Tabs)

```
Leads & KPIs
├── Tab: Xem & Phân tích  — báo cáo tổng hợp, funnel, pipeline
├── Tab: Nhập số liệu      — plan KPIs + actual hàng tuần
└── Tab: So sánh kỳ        — so sánh 3 năm, YoY growth
```

---

## 3. Tab: Nhập Số Liệu

### 3.1 Form Plan KPIs (Năm)

**Vị trí**: Panel bên trái trong tab Nhập số liệu

**Mục đích**: Đặt tổng KPI cho cả năm. Hệ thống tự chia đều xuống quý/tháng/tuần.

**Fields**:
| Field | Type | Ghi chú |
|---|---|---|
| Năm | Dropdown | Năm đang nhập plan |
| Total Raw Leads | Number | |
| Target MQL | Number | |
| Target SQL | Number | |
| Target OPP | Number | |
| Target Closed Deal | Number | |
| Target Pipeline Value | Number (VNĐ) | |
| Target Won Value | Number (VNĐ) | |

**Logic chia kế hoạch**:
- Năm → chia đều cho 4 quý → chia đều cho 3 tháng → chia đều cho ~4.33 tuần
- Ví dụ: Target Leads năm = 12,000 → mỗi quý = 3,000 → mỗi tháng = 1,000 → mỗi tuần ≈ 231

**Cơ chế Rollover (BR-005)**:
- Nếu cuối kỳ (tuần/tháng/quý) actual < plan → phần thiếu cộng dồn vào kỳ tiếp theo
- Ví dụ: Plan tuần 23 = 300 leads, Actual = 250 → Plan tuần 24 = 231 (plan gốc) + 50 (rollover) = 281
- Hệ thống hiển thị rõ: "Plan gốc: 231 + Rollover từ tuần 23: 50 = Plan hiệu lực: 281"
- Manager có thể điều chỉnh plan kỳ cụ thể thay vì dùng rollover tự động

**Nút**: [💾 Lưu Plan KPIs]

---

### 3.2 Form Nhập Actual — Tuần

**Vị trí**: Panel bên phải trong tab Nhập số liệu

**Mục đích**: Cập nhật số liệu thực tế từng tuần.

**Fields header**:
| Field | Type | Ghi chú |
|---|---|---|
| Tuần | Input week (ISO) | VD: W23 (02/06–08/06/2026) |
| Năm | Dropdown | |

**Fields KPI số lượng**:
| Field | Type | Ghi chú |
|---|---|---|
| Raw Leads | Number | |
| MQL | Number | |
| SQL | Number | |
| OPP Count | Number | Số cơ hội chưa ký mới trong tuần |
| Closed Deal Count | Number | Số deal đã chốt trong tuần |

**Ghi chú**: Một OPP có thể chuyển thành Closed Deal trong cùng tuần (BR-006). Khi đó:
- OPP Count nhập: 0 (nếu không phát sinh OPP mới ngoài deal đã chốt)
- Closed Deal Count nhập: số deal chốt (kể cả OPP chuyển thành Won cùng tuần)

---

### 3.3 Chi Tiết OPP (Pipeline — Chưa Ký)

**Vị trí**: Phần mở rộng bên dưới form Actual, section "Chi tiết Opportunities"

**Mục đích**: Ghi nhận từng cơ hội kinh doanh cụ thể đang trong pipeline.

**Fields mỗi OPP**:
| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| Tên doanh nghiệp | Text | ✅ | |
| Size | Dropdown | ✅ | Enterprise / Medium |
| Project (nguồn) | Dropdown → Projects | ❌ | Project nào generate ra OPP này |
| Setup Fee | Number (VNĐ) | ✅ | Thu 1 lần khi ký |
| Monthly Fee | Number (VNĐ) | ✅ | Phí duy trì hàng tháng |
| Deal Value | Auto-calc | — | Setup Fee + Monthly Fee (hiển thị cho tham khảo, không phải giá trị thực tế dài hạn) |
| Ngày dự kiến đóng | Date picker | ❌ | Closed Date dự kiến |
| Nút [Chuyển → Won] | Button | — | Chuyển OPP thành Closed Deal (BR-006) |

**OPP Value tổng**: Auto-tính = Σ Deal Value của tất cả OPP chưa chuyển Won

---

### 3.4 Chi Tiết Closed Deal / Won Value (Đã Ký)

**Vị trí**: Section "Chi tiết Closed Deal" trong form Actual

**Fields mỗi Closed Deal**:
| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| Tên doanh nghiệp | Text | ✅ | |
| Size | Dropdown | ✅ | Enterprise / Medium |
| Project (nguồn) | Dropdown → Projects | ❌ | |
| Setup Fee | Number (VNĐ) | ✅ | |
| Monthly Fee | Number (VNĐ) | ✅ | |
| Deal Value | Auto-calc | — | Setup Fee + Monthly Fee × 12 (hiển thị ARR ước tính) |
| Ngày ký | Date picker | ✅ | Closed Date thực tế |

**Won Value tổng**: Auto-tính = Σ Deal Value của tất cả Closed Deal đã ký

---

### 3.5 Nhập Closed Deal Năm Trước

**Mục đích**: Nhập dữ liệu lịch sử để phục vụ So sánh cùng kỳ.

**Fields**:
- Năm: Dropdown (2025, 2024, 2023)
- Danh sách deal theo định dạng giống 3.4
- Tổng Won Value năm đó: auto-calc

---

### 3.6 Nút Lưu & Xác nhận

- **[💾 Lưu Actual Data]**: Lưu toàn bộ số liệu tuần (KPI counts + danh sách OPP + Closed Deal)
- Sau khi lưu: dữ liệu hiển thị trong Tab "Xem & Phân tích" và cập nhật Dashboard

**Lịch sử tuần**: Dữ liệu mỗi tuần lưu riêng theo key `(year, week)`. Có thể quay lại chỉnh sửa tuần đã lưu (Chọn tuần → load dữ liệu cũ → Edit → Lưu lại).

---

## 4. Tab: Xem & Phân Tích

### 4.1 Bộ Lọc Thời Gian

Chọn kỳ xem: Tuần / Tháng / Quý / Năm (kết hợp với Global Filter trên sidebar).

### 4.2 KPI Cards Row

7 card tương tự Dashboard, chi tiết hơn:
- Raw Leads: Actual | Plan | % vs Plan | Conv% →
- MQL: Actual | Plan | % vs Plan | Conv%
- SQL: Actual | Plan | % vs Plan | Conv%
- OPP: Actual | Plan | % vs Plan | Conv%
- Closed Deal: Actual | Plan | % vs Plan | Conv%
- Pipeline Value (OPP tổng): Actual | Plan | % vs Plan
- Won Value (Closed Deal tổng): Actual | Plan | % vs Plan

Thêm row riêng bên dưới:
- **CAC** (link từ module Expense): hiển thị giá trị, đơn vị VNĐ/khách
- **LTV** (link từ module Expense): hiển thị giá trị, đơn vị VNĐ/khách
- **LTV:CAC ratio**: số + health indicator (🔴/🟡/🟢)

### 4.3 Funnel Chart

Horizontal funnel chart với đầy đủ thông tin:
- 5 bước: Raw Leads → MQL → SQL → OPP → Closed Deal
- Mỗi bước: thanh bar (tỉ lệ vs bước đầu) + số actual + số plan (gạch đứng) + Conv% + % vs Plan

### 4.4 Bảng Pipeline Value by Segment (OPP)

| Segment | Số lượng OPP | OPP Value (VNĐ) |
|---|---|---|
| Enterprise | X | X,XXX,XXX,XXX |
| Medium | X | X,XXX,XXX,XXX |
| **Total** | **X** | **X,XXX,XXX,XXX** |

Có thể expand để xem danh sách chi tiết từng doanh nghiệp.

### 4.5 Bảng Closed Deal Value by Segment

| Segment | Số lượng Deal | Won Value (VNĐ) |
|---|---|---|
| Enterprise | X | X,XXX,XXX,XXX |
| Medium | X | X,XXX,XXX,XXX |
| **Total** | **X** | **X,XXX,XXX,XXX** |

Có thể expand để xem danh sách chi tiết.

### 4.6 Bảng Closed Deal Năm Trước

- Chọn năm (2025 / 2024 / 2023)
- Hiển thị bảng: Tháng | Tên DN | Size | Won Value | Count

---

## 5. Tab: So Sánh Kỳ

### 5.1 Mục Đích

So sánh hiệu suất MKT theo thời gian để nhận ra xu hướng tăng trưởng và mức độ đạt KPI.

### 5.2 Bộ Lọc

| Control | Giá trị |
|---|---|
| Kỳ so sánh | Radio: Tuần / Tháng / Quý / Năm |
| Kỳ hiện tại | Chọn kỳ cụ thể (VD: Q2/2026) |
| Năm so sánh 1 | Dropdown (default: năm hiện tại) |
| Năm so sánh 2 | Dropdown (default: năm hiện tại - 1) |
| Năm so sánh 3 | Dropdown (default: năm hiện tại - 2) |

### 5.3 Bảng So Sánh

| Chỉ số | Actual 2026 | Plan 2026 | % Plan 2026 | Actual 2025 | YoY Growth 26vs25 | Actual 2024 | YoY Growth 25vs24 |
|---|---|---|---|---|---|---|---|
| Raw Leads | | | | | | | |
| MQL | | | | | | | |
| SQL | | | | | | | |
| OPP Count | | | | | | | |
| Closed Deal | | | | | | | |
| Pipeline Value | | | | | | | |
| Won Value | | | | | | | |
| CAC | | | | | | | |
| LTV | | | | | | | |

**YoY Growth** = (Actual năm N - Actual năm N-1) / Actual năm N-1 × 100
- Màu xanh nếu tăng, màu đỏ nếu giảm

**% Plan** = Actual / Plan × 100
- Màu theo mức: ≥100% xanh, 80–99% vàng, <80% đỏ

### 5.4 Biểu Đồ So Sánh

Grouped bar chart hoặc line chart:
- Trục X: các kỳ (VD: Q1, Q2, Q3, Q4)
- Mỗi năm là 1 màu đường/cột
- Dropdown chọn chỉ số muốn xem (Raw Leads / MQL / SQL / Closed Deal / Won Value / CAC)

---

## 6. Quản Lý Khách Hàng

### 6.1 Mục Đích

Lưu toàn bộ lịch sử Closed Deal theo tuần. Phục vụ tra cứu và tính CAC trong module Expense.

### 6.2 Danh Sách Closed Deals (Toàn bộ)

Bảng tổng hợp:
| Tuần | Tên DN | Size | Project | Setup Fee | Monthly Fee | Ngày ký | Được ghi bởi |
|---|---|---|---|---|---|---|---|

**Filter**: Năm / Quý / Tháng / Project / Size

**Edit**: Click vào row → mở form edit inline

---

## 7. Acceptance Criteria

| # | Scenario | Kết quả mong đợi |
|---|---|---|
| AC-L01 | Nhập Plan Leads = 12,000/năm | Hệ thống hiển thị Plan tuần = 231, Plan tháng = 1,000, Plan quý = 3,000 |
| AC-L02 | Tuần 22: Actual = 180, Plan = 231 | Tuần 23 Plan = 231 + 51 (rollover) = 282 |
| AC-L03 | Bấm [Chuyển → Won] trên 1 OPP | OPP đó biến khỏi bảng Pipeline, xuất hiện trong Closed Deal cùng tuần |
| AC-L04 | Xem Dashboard sau khi lưu Actual tuần | KPI Cards cập nhật trong < 500ms |
| AC-L05 | Tab So sánh: chọn Quý, Q2/2026 | Bảng hiện Actual Q2/2026 vs Q2/2025 vs Q2/2024, tính YoY growth |
| AC-L06 | Leads Actual 0, MQL = 10 | Conv% MQL/Leads hiển thị "—" hoặc "N/A" thay vì lỗi chia cho 0 |
| AC-L07 | Chỉnh sửa dữ liệu tuần đã lưu | Chọn tuần cũ → load form → edit → lưu → cập nhật toàn bộ báo cáo liên quan |
