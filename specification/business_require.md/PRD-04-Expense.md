# PRD-04 — Expense Management
**MKT Hub — Module 4**
Version 1.0 | Cập nhật: 2026-06-20

> Đọc PRD-00-Overview.md trước để nắm Business Rules và phân quyền chung.
> **Phân quyền đặc biệt**: Chỉ Manager được tạo/sửa/xoá dữ liệu trong module này. Specialist chỉ xem.

---

## 1. Mục Đích

Module theo dõi chi phí Marketing, tính toán CAC và LTV, đánh giá sức khoẻ tài chính MKT theo chỉ số LTV:CAC. Dữ liệu chi phí lấy từ từng project, tổng hợp lên tháng/quý/năm.

---

## 2. Khái Niệm & Công Thức

### 2.1 Phân Loại Chi Phí

| Loại | Định nghĩa | Ví dụ |
|---|---|---|
| **Direct Cost** | Chi phí gắn trực tiếp với từng project/chiến dịch cụ thể | Ads budget (Facebook/Google), agency fee, in ấn material, thuê thiết bị sự kiện |
| **Overhead Cost** | Chi phí cố định phân bổ cho project | Nhân sự (manday), tools chung, chi phí văn phòng phân bổ |

**Cách nhập**: Mỗi project nhập 1 con số tổng cho Direct + 1 con số tổng cho Overhead, kèm textarea ghi chú chi tiết từng khoản.

### 2.2 Công Thức CAC

```
CAC = (Direct Cost + Overhead Cost) / Số khách hàng Closed Deal mới trong kỳ
```

**Phạm vi tính**:
- **Per project**: CAC = (Direct + Overhead của project đó) / Closed Deal count từ project đó
- **Tổng kỳ (tháng/quý/năm)**: CAC = Tổng (Direct + Overhead) / Tổng Closed Deal count

**Nguồn Closed Deal count**: lấy từ module Leads & KPIs, khớp theo kỳ thời gian.

### 2.3 Công Thức LTV

```
LTV = (Setup Fee + Monthly Fee × (1 / Churn Rate)) × Gross Margin %
```

Trong đó:
- **Setup Fee**: Trung bình Setup Fee của tất cả Closed Deal trong kỳ
- **Monthly Fee**: Trung bình Monthly Fee của tất cả Closed Deal trong kỳ
- **Churn Rate**: % khách hàng rời đi mỗi tháng — nhập thủ công, có thể thay đổi theo kỳ
- **1/Churn Rate**: Thời gian gắn bó trung bình (tháng)
- **Gross Margin %**: Biên lợi nhuận gộp — nhập thủ công, có thể thay đổi theo kỳ

**Ví dụ**:
- Setup Fee trung bình = 50,000,000 VNĐ
- Monthly Fee trung bình = 5,000,000 VNĐ
- Churn Rate = 2%/tháng → Thời gian gắn bó = 1/0.02 = 50 tháng
- Gross Margin = 60%
- LTV = (50,000,000 + 5,000,000 × 50) × 60% = (50M + 250M) × 60% = 300M × 60% = **180,000,000 VNĐ**

### 2.4 LTV:CAC Health Indicator (BR-009)

| Tỉ lệ | Trạng thái | Visual |
|---|---|---|
| < 1.5 | Nguy hiểm — chi quá nhiều để có 1 khách | 🔴 Đỏ |
| 1.5 – 2.5 | Cần tối ưu — biên mỏng | 🟡 Vàng |
| 2.5 – 4.0 | Tỷ lệ vàng — hiệu quả tốt | 🟢 Xanh lá |
| > 4.0 | Đang under-invest — có thể tăng ngân sách | 🔵 Xanh dương (gợi ý scale) |

---

## 3. Cấu Trúc Điều Hướng (Tabs)

```
Expense Management
├── Tab: Tổng quan     — Dashboard chi phí, CAC, LTV tổng hợp
├── Tab: Nhập chi phí  — Nhập chi tiết từng project + cập nhật Churn Rate / Gross Margin
└── Tab: Báo cáo       — Phân tích sâu theo kỳ, % chi phí theo loại
```

---

## 4. Thông Số Hệ Thống (Churn Rate & Gross Margin)

### 4.1 Vị Trí Nhập

Nằm trong Tab "Nhập chi phí", section riêng phía trên cùng.

### 4.2 Fields

| Field | Type | Ghi chú |
|---|---|---|
| Kỳ áp dụng | Dropdown (Tháng/Quý/Năm) + chọn kỳ cụ thể | VD: Tháng 6/2026 |
| Churn Rate | Number % | VD: 2.5 (nghĩa là 2.5%) |
| Gross Margin % | Number % | VD: 60 (nghĩa là 60%) |
| Ghi chú thay đổi | Textarea | Lý do điều chỉnh so với kỳ trước |

### 4.3 Business Rule Quan Trọng (BR-008)

- Mỗi lần thay đổi tạo 1 bản ghi mới với timestamp
- Giá trị mới áp dụng từ kỳ được chỉ định, **không** áp dụng ngược cho kỳ đã qua
- Khi tính LTV cho kỳ nào: dùng Churn Rate + Gross Margin % đang có hiệu lực trong kỳ đó

**Lịch sử thay đổi**: hiển thị bảng lịch sử ngay bên dưới form, gồm: Kỳ áp dụng | Churn Rate | Gross Margin | Ngày cập nhật | Người cập nhật

---

## 5. Tab: Nhập Chi Phí (Theo Project)

### 5.1 Chọn Project

Dropdown chọn project muốn nhập/cập nhật chi phí.

Chỉ hiển thị project có status ≠ Cancelled.

### 5.2 Form Chi Phí Project

| Field | Type | Bắt buộc | Ghi chú |
|---|---|---|---|
| Kỳ phát sinh | Tháng + Năm | ✅ | Tháng chi phí phát sinh |
| Direct Cost (VNĐ) | Number | ❌ | Tổng chi phí trực tiếp |
| Ghi chú Direct | Textarea | ❌ | VD: "Facebook Ads: 30M, In brochure: 5M, Agency fee: 15M" |
| Overhead (VNĐ) | Number | ❌ | Tổng chi phí phân bổ |
| Ghi chú Overhead | Textarea | ❌ | VD: "Nhân sự 2 người × 10 ngày: 20M, Tool Canva: 1M" |
| Total | Auto-calc | — | Direct + Overhead |

**Nút**: [💾 Lưu Chi Phí Project]

### 5.3 Lịch Sử Chi Phí Project

Bảng phía dưới form, hiển thị tất cả kỳ đã nhập cho project đang chọn:

| Kỳ | Direct | Overhead | Total | Ghi chú | Cập nhật lúc | Thao tác |
|---|---|---|---|---|---|---|
| 06/2026 | 50M | 20M | 70M | ... | 15/06 · Manager | [✏️] [🗑️] |

---

## 6. Tab: Tổng Quan

### 6.1 KPI Cards Chi Phí

| Card | Nội dung |
|---|---|
| Tổng Chi Phí Kỳ | Direct + Overhead tất cả project trong kỳ |
| CAC | Theo công thức BR-007 |
| LTV | Theo công thức BR-008 |
| LTV:CAC | Tỉ lệ + health indicator (BR-009) |
| Số Khách Hàng Mới | Tổng Closed Deal count từ module Leads & KPIs |

### 6.2 Bảng Chi Phí Theo Project

Bảng tổng hợp tất cả project trong kỳ đang lọc:

| Project | Type | Budget Plan | Actual Cost | Variance (B-A) | New Customers | CAC Project |
|---|---|---|---|---|---|---|
| Campaign Q2 | Online Campaign | 100M | 87M | +13M | 12 | 7.25M/KH |
| Workshop May | Workshop | 50M | 55M | -5M | 3 | 18.3M/KH |
| ... | | | | | | |
| **Tổng** | | **150M** | **142M** | **+8M** | **15** | **9.47M/KH** |

**Màu Variance**: xanh nếu dưới budget (B > A), đỏ nếu vượt budget (B < A)

### 6.3 CAC & LTV Summary

```
┌─────────────────────────────────────────┐
│  Tháng 6/2026                           │
│  Tổng chi phí: 142,000,000 VNĐ         │
│  Khách hàng mới: 15                     │
│  CAC = 142M / 15 = 9,467,000 VNĐ/KH   │
│                                          │
│  Setup Fee TB: 48,000,000 VNĐ          │
│  Monthly Fee TB: 4,500,000 VNĐ         │
│  Churn Rate: 2% → Retention: 50 tháng  │
│  Gross Margin: 60%                      │
│  LTV = (48M + 4.5M × 50) × 60%        │
│       = 273M × 60% = 163,800,000 VNĐ  │
│                                          │
│  LTV:CAC = 163.8M / 9.47M = 17.3      │
│  ✅ 🟢 Tỷ lệ vàng                      │
└─────────────────────────────────────────┘
```

---

## 7. Tab: Báo Cáo

### 7.1 Bộ Lọc

Chọn kỳ: Tháng / Quý / Năm

### 7.2 Phân Tích % Chi Phí Theo Loại Project

**Donut chart** thể hiện tỉ trọng chi phí theo Project Type:

| Project Type | Chi phí | % Tổng |
|---|---|---|
| Online Campaign | 80M | 56% |
| Workshop | 55M | 39% |
| Production | 7M | 5% |
| **Total** | **142M** | **100%** |

### 7.3 Trend Chi Phí & CAC Theo Thời Gian

**Line chart** với 2 trục Y:
- Trục trái: Tổng chi phí (VNĐ) — cột bar
- Trục phải: CAC (VNĐ/KH) — đường line

Cho phép chọn: theo tháng trong năm, hoặc theo quý nhiều năm.

### 7.4 So Sánh Budget vs Actual

**Grouped bar chart** theo project:
- Bar xanh nhạt: Budget Plan
- Bar xanh đậm: Actual Cost

### 7.5 Bảng Chi Tiết Theo Kỳ

Bảng đầy đủ với filter và sort:

| Kỳ | Project | Type | Direct | Overhead | Total | New Customers | CAC | LTV | LTV:CAC | Health |
|---|---|---|---|---|---|---|---|---|---|---|

---

## 8. Tích Hợp Với Các Module Khác

| Nguồn dữ liệu | Dữ liệu lấy | Dùng để |
|---|---|---|
| Projects & Tasks | Budget Plan / Actual Cost từ project | So sánh kế hoạch vs thực tế chi phí |
| Leads & KPIs | Closed Deal count theo kỳ | Mẫu số của CAC |
| Leads & KPIs | Setup Fee, Monthly Fee của Closed Deals | Tính LTV |

**Luồng dữ liệu**:
1. Manager nhập chi phí (Direct + Overhead) cho từng project
2. Hệ thống tổng hợp theo tháng/quý/năm
3. Lấy Closed Deal count từ module Leads & KPIs
4. Tính CAC = Tổng chi phí / Closed Deal count
5. Lấy Setup Fee + Monthly Fee trung bình từ danh sách Closed Deals
6. Dùng Churn Rate + Gross Margin % đang hiệu lực
7. Tính LTV và LTV:CAC
8. Đẩy kết quả lên Dashboard và Tab Xem & Phân tích của Leads & KPIs

---

## 9. Acceptance Criteria

| # | Scenario | Kết quả mong đợi |
|---|---|---|
| AC-E01 | Specialist truy cập Tab Nhập chi phí | Chỉ thấy dữ liệu, không có nút Edit/Delete/Save |
| AC-E02 | Nhập Direct = 50M, Overhead = 20M, Closed = 10 | CAC = 7,000,000 VNĐ/KH |
| AC-E03 | Churn Rate tháng 6 = 2%, Gross Margin = 60%; tháng 7 đổi Gross Margin = 55% | Báo cáo tháng 6 vẫn dùng 60%, tháng 7 dùng 55% |
| AC-E04 | LTV:CAC = 1.3 | Health indicator 🔴 Nguy hiểm, màu đỏ |
| AC-E05 | LTV:CAC = 3.2 | Health indicator 🟢 Tỷ lệ vàng |
| AC-E06 | Xem báo cáo Quý | Tổng hợp chi phí 3 tháng, CAC tổng quý |
| AC-E07 | Nhập chi phí project có Closed = 0 | CAC = "N/A — Chưa có khách hàng mới" thay vì lỗi chia 0 |
| AC-E08 | Xem Tab Tổng quan tháng 6 | Bảng hiển thị đúng project có chi phí trong tháng 6, Variance màu đúng |
