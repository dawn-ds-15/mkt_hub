# MKT Hub — Đối Soát Toàn Diện 7 Phân Hệ & Hướng Dẫn Tối Ưu UI/UX Chuẩn B2B SaaS (PMS-Inspired)

> **Dành cho:** Đội ngũ Frontend (FE) của MKT Hub 
> **Tài liệu tham chiếu kèm theo:** [mkt-hub-preview.html](file:///d:/mkt-hub-backend/specification/uiux/mkt-hub-preview.html) *(Bản mẫu HTML hoàn chỉnh 100% nghiệp vụ và giao diện chuẩn B2B SaaS)* 
> **Nguồn đối chiếu:**
> - **MKT Hub Hiện tại (Live):** `https://mkthub-pied.vercel.app` (Đã khảo sát đối soát 1:1)
> - **Smartlog PMS Tham khảo:** `https://pms-sid.slg-ai.com/` (Học hỏi tiêu chuẩn thẩm mỹ, mật độ thông tin cao)

---

## 📩 THÔNG ĐIỆP BÀN GIAO GỬI FE TEAM (PING MESSAGE - COPY & PASTE)

> **Dành cho PM / Tech Lead:** Copy toàn bộ đoạn text trong khung dưới đây gửi thẳng vào kênh trao đổi (Slack / Teams / Zalo) với đội ngũ Frontend:

```text
Chào team FE,

Hiện tại hệ thống MKT Hub cần tối ưu lại toàn bộ giao diện theo chuẩn B2B SaaS hiện đại (học hỏi độ sắc nét của Smartlog PMS và Linear), đồng thời đảm bảo GIỮ NGUYÊN 100% logic và số liệu thực tế từ hệ thống hiện tại.

Mình gửi team 2 tài liệu đính kèm làm kim chỉ nam triển khai:
1. File HTML Benchmark: specification/uiux/mkt-hub-preview.html (Mở trực tiếp trên Chrome/Edge để test và lấy class Tailwind)
2. Hướng dẫn kỹ thuật chi tiết: specification/uiux/FE-OPTIMIZATION-GUIDE.md

CÁC YÊU CẦU BẮT BUỘC KHI TRIỂN KHAI:

1. DỮ LIỆU PREVIEW LÀ MOCK — FE VẪN GIỮ NGUYÊN CƠ CHẾ GỌI API HIỆN TẠI NHƯ CŨ:
   - Toàn bộ data trong file `mkt-hub-preview.html` là DỮ LIỆU GIẢ ĐỊNH (MOCK DATA) được gán cứng để minh họa layout, component và tương tác UI/UX.
   - FE TUYỆT ĐỐI KHÔNG gán cứng data, KHÔNG thay đổi Service API hay endpoint backend hiện có.
   - Giữ nguyên 100% cơ chế gọi API hiện tại (React Query / SWR / Axios / Fetch, endpoints, models, DTOs). Chỉ thay đổi tầng giao diện hiển thị (JSX / CSS / Tailwind).

2. TUYỆT ĐỐI KHÔNG ĐỔI LOGIC NGHIỆP VỤ & DATA MODEL:
   - Giữ đủ 100% các phân hệ, sub-tabs, dropdowns, công thức tính (CAC, LTV, Rollover, Funnel drop-off) từ PRD-00 đến PRD-05.
   - Không bỏ sót, không đổi tên bất kỳ trường dữ liệu nào trong các bảng và form.

3. GIAO DIỆN SÁNG MẶC ĐỊNH (FULL LIGHT MODE - SÁNG TOÀN DIỆN):
   - Mặc định mở ứng dụng lên là Light Theme sạch sẽ ("sáng sáng hẳn").
   - Sidebar & Header: Nền trắng (#FFFFFF), viền xám nhạt (border-slate-200), text xám đậm (text-slate-700/900). Phân hệ đang chọn dùng nền xanh nhạt (bg-indigo-50 text-indigo-700 font-semibold).
   - Nền trang dịu mắt #F8FAFC, toàn bộ Cards và Bảng dữ liệu nền trắng tinh.
   - Tuyệt đối KHÔNG để sidebar màu đen/navy trong chế độ sáng (tránh nửa sáng nửa tối).

4. CÓ NÚT CHUYỂN ĐỔI SÁNG / TỐI (THEME SWITCHER ☀️ ⇄ 🌙):
   - Bố trí nút Toggle trên Header (cạnh avatar), bấm 1 click là chuyển đổi mượt mà toàn hệ thống giữa Light Mode và Dark Mode.
   - Lưu trạng thái lựa chọn vào localStorage ('mkt_hub_theme').

5. ĐỒNG BỘ 100% KHI Ở DARK MODE (DEEP SLATE NAVY):
   - Khi ở Dark Mode: Nền tổng thể #080D1A, Thẻ Card #0D1527, viền mờ 1px rgba(255,255,255,0.08).
   - ĐỒNG BỘ TẤT CẢ THANH PHÂN HỆ CON (SUB-NAV): Các thanh điều hướng phụ (như [Danh sách Task | Kanban | Báo cáo Tuần] ở Tasks, hoặc [Xem & Phân tích | Nhập số liệu] ở Leads) PHẢI là nền tối (dark:bg-[#0B1120]), tuyệt đối KHÔNG để sót bất kỳ thanh ngang nào bị trắng bệch.
   - Các badge (Quá hạn, Sắp hạn, Chu kỳ, thẻ đếm Sidebar) ở Dark Mode dùng pill tối bán trong suốt (rgba), không dùng màu pastel sáng chói.

6. TIÊU CHUẨN ZERO EMOJI (100% VECTOR SVG ICONS):
   - Loại bỏ hoàn toàn tất cả emoji trên UI (📊, 📁, 📝, 🎯, 💰, 📦, ⚙️, 📅, 👁, ✏️, 🗑).
   - Thay thế 100% bằng Vector SVG Icons (dùng thư viện Lucide-react hoặc Heroicons) và các chấm màu trạng thái tròn (rounded-full).

7. FONT SỐ THẲNG HÀNG (TABULAR NUMERALS):
   - Khai báo class .num { font-variant-numeric: tabular-nums; } trong CSS toàn cục và gắn vào tất cả các ô số tiền VND, số lượng lead, tỷ lệ % để số thẳng hàng khi cuộn bảng.

Team mở file mkt-hub-preview.html kiểm tra trực quan cả 2 theme và tham chiếu file FE-OPTIMIZATION-GUIDE.md để lấy checklist triển khai nhé!
```

---

## [CHÚ Ý] NGUYÊN TẮC BẤT DI BẤT DỊCH CHO FE TEAM

1. **DỮ LIỆU BẢN MẪU LÀ MOCK DATA — GIỮ NGUYÊN 100% CƠ CHẾ GỌI API HIỆN CÓ:**
   * Toàn bộ dữ liệu hiển thị trong file [mkt-hub-preview.html](file:///d:/mkt-hub-backend/specification/uiux/mkt-hub-preview.html) là **Dữ liệu giả lập (Mock Data)** nhằm mục đích demo giao diện, bố cục và tương tác.
   * **FE vẫn tiếp tục gọi API Backend như hệ thống hiện tại đang làm:** Giữ nguyên các Service API, Axios instance, React Query / SWR hooks, các endpoints URL, và các model/interfaces TypeScript.
   * FE chỉ thay thế tầng hiển thị UI (Presentation Layer / JSX / CSS / Tailwind). Tuyệt đối không thay đổi hay ngắt kết nối API thực tế của Backend.

2. **TUYỆT ĐỐI KHÔNG THAY ĐỔI LOGIC NGHIỆP VỤ & DATA MODEL:**
   * Không bỏ sót, không đổi tên, không gộp bất kỳ trường dữ liệu nào trong các bảng và form.
   * Giữ nguyên 100% các phân hệ, sub-tabs, dropdowns, công thức tính (CAC, LTV, Rollover, Funnel drop-off) từ PRD-00 đến PRD-05.

2. **GIAO DIỆN SÁNG MẶC ĐỊNH — SÁNG SÁNG HẲN (FULL LIGHT THEME):**
   * Mặc định hệ thống áp dụng **Full Light Mode** chuẩn B2B SaaS hiện đại (Linear / Stripe / Notion style).
   * **Sidebar & Header:** Màu trắng tinh khiết (`bg-white` / `#FFFFFF`), đường viền sắc nét 1px (`border-slate-200`).
   * **Nền & Cards:** Nền phông dịu mắt (`bg-[#F8FAFC]`), toàn bộ Cards và Bảng dữ liệu nền trắng (`bg-white`), chữ đậm sắc nét (`text-slate-900`, `text-slate-700`).
   * **Tuyệt đối không làm giao diện "nửa nọ nửa kia"** (ví dụ: nội dung sáng mà sidebar lại màu đen/navy tối thui).

3. **NÚT CHUYỂN ĐỔI CHỦ ĐỀ SÁNG / TỐI (THEME SWITCHER ☀️ ⇄ 🌙):**
   * Bắt buộc có nút toggle trên Topbar để người dùng chủ động chuyển giữa **Giao diện Sáng** và **Giao diện Tối**.
   * Khi chuyển sang Dark Theme: Toàn bộ hệ thống chuyển mượt mà sang tông Deep Slate Navy (`#080D1A`, `#0F172A`, `#1E293B`).
   * Lưu trạng thái theme vào `localStorage ('mkt_hub_theme')`.

4. **TIÊU CHUẨN ZERO EMOJI (100% VECTOR SVG ICONS):**
   * Tuyệt đối không dùng bất kỳ emoji nào trên giao diện (tiêu đề, thẻ KPI, menu sidebar, nút bấm, bảng dữ liệu).
   * 100% icon phải dùng **Vector SVG** chuẩn (Heroicons / Lucide icons) và chấm trạng thái màu tròn (`rounded-full`).

---

## 1. Bảng Đối Soát Tổng Hợp 7 Phân Hệ: MKT Hub Live vs Chuẩn Tối Ưu

| Phân hệ (Route) | Sub-tabs & Tính năng Live (`mkthub-pied.vercel.app`) | Những gì BẮT BUỘC GIỮ NGUYÊN | Chi tiết TỐI ƯU GIAO DIỆN (FE Action Items) |
| :--- | :--- | :--- | :--- |
| **1. Tổng quan (`/`)** | • 4 Bộ lọc chu kỳ: **Tuần**, **Tháng**, **Quý**, **Năm** + Dropdown động.<br>• 3 Badges Header: `[BẮT BUỘC] 3 Quá hạn`, `🟡 4 Sắp hạn`, `🟢 Tuần 38/2026`.<br>• 7 KPI Cards: Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline, LTV:CAC/ROA.<br>• Phễu chuyển đổi 5 bước + Drop-off %.<br>• Biểu đồ MKT Activities (Kế hoạch vs Thực tế).<br>• Tiến độ 12 Dự án (68%).<br>• Biểu đồ trạng thái Task Donut SVG (49 tasks, 6 màu).<br>• Cảnh báo hạn chót (BR-010). | • Giữ đủ 100% 4 bộ lọc thời gian và 7 thẻ KPI.<br>• Giữ nguyên logic phễu 5 bước tuần tự.<br>• Giữ nguyên biểu đồ Kế hoạch vs Thực tế. | • Bảng màu Dark Slate Navy (`#080D1A`).<br>• Font số Tabular Numbers `.num` thẳng hàng cột.<br>• Thẻ KPI có sparkline và badge chênh lệch vs Plan.<br>• Donut SVG có tâm đếm tổng số task sắc nét. |
| **2. Dự án (`/projects`)** | • Tiêu đề & mô tả phân hệ.<br>• 3 Thẻ Metric tổng quan: **Tổng ngân sách năm** (510.000.888 VND, 21.8%), **Dự án đang chạy** (5 chiến dịch), **KPI đạt được** (40%).<br>• Bộ lọc: Tìm kiếm, Bộ lọc nâng cao, Dropdown `Tất cả trạng thái (10)`.<br>• Bảng 10 Dự án: Checkbox, Dự án (Mã PRJ-xxx, Hạn chót), Owner (Avatar + Tên), Tiến độ (Progress bar), KPI (Est/Act), Ngân sách VND (Đã chi %), Hồ sơ.<br>• Phân trang `Hiển thị 1-10 trong 10 dự án`. | • Giữ đủ 10 dự án thực tế và các mã `PRJ-E73D7`, `PRJ-C6A60`, `PRJ-82DDA`...<br>• Giữ 3 thẻ Metric trên đỉnh trang.<br>• Giữ các trường ngân sách và tiến độ % (BR-004). | • Badge mã dự án dạng font mono `PRJ-E73D7`.<br>• Avatar tròn có viền vi mô và 2 chữ cái viết tắt (`TT`, `LT`, `KN`, `CC`).<br>• Progress bar bo góc mềm 1.5px, màu xanh ngọc emerald.<br>• Cột số tiền tệ căn phải với class `.num`. |
| **3. Công việc (`/tasks`)** | • 3 Sub-tabs: **Danh sách Task** \| **Kanban** \| **Báo cáo Tuần**.<br>• Tab Danh sách: **8 Thẻ đếm trạng thái** (Tổng cộng 129, Chưa làm 108, Đang làm 0, Hoàn thành 11, Tồn đọng 0, Đang chờ 0, Đã huỷ 0, Quá hạn 10), Thanh lọc 4 trường, Tìm kiếm + Date range, Bảng 15 cột chi tiết, Phân trang 13 trang.<br>• Tab Kanban: **7 Cột chuẩn** (Quá hạn, Chưa làm, Đang làm, Hoàn thành, Chờ xử lý, Đã huỷ, Tồn đọng).<br>• Tab Báo cáo Tuần: Bộ lọc Tuần/Năm/Dự án/PIC, nút Tự động điền & Xuất TXT, 4 mục PRD-02, Nhật ký tuần (4 textareas) + Lưu nhật ký. | • Giữ nguyên 3 chế độ xem.<br>• Giữ đủ 8 thẻ đếm và 7 cột Kanban theo đúng tên tiếng Việt.<br>• Giữ nguyên quy tắc BR-001 (bắt buộc lý do backlog) và BR-002 (cần BOD hỗ trợ).<br>• Giữ nguyên 4 mục báo cáo tuần và 4 ô nhật ký. | • Chuyển toàn bộ thao tác click xem task sang **Side Drawer trượt từ phải sang (`Sheet side="right"`)** thay vì popup che màn hình.<br>• Thẻ Kanban có mã hash 12 ký tự, ngày hạn chót bôi đỏ nếu trễ.<br>• Weekly report dạng phiếu văn bản thanh lịch, ngắt mục rõ nét. |
| **4. Leads & KPIs (`/leads`)** | • 3 Sub-tabs: **Xem & Phân tích** \| **Nhập số liệu** \| **So sánh kỳ**.<br>• Tab Xem: Dự án toàn hệ thống, 3 nút Tuần/Tháng/Năm, 7 KPI Cards, Thẻ CAC, Phễu chuyển đổi, Bảng Pipeline Value theo 3 segment (Lớn, Trung, SMB), Bảng Won Value theo 4 quý.<br>• Tab Nhập số liệu: Cột trái "Kế hoạch KPIs năm" (7 chỉ tiêu + nút Sửa), Cột phải "Nhập Dữ Liệu" (Dự án, Ngày phát sinh, Kế hoạch kỳ này mini cards + Nhập thực tế), Bảng Opportunities, Bảng Closed Deal (7 deals tỷ đồng), Chân trang Hướng dẫn Import.<br>• Tab So sánh kỳ: So sánh đa chỉ tiêu 6 hàng (YoY), Biểu đồ cột Q1-Q4, Khung Phân tích nhanh + Nút Báo cáo AI. | • Giữ nguyên cấu trúc 3 sub-tabs.<br>• Giữ danh sách 7 Closed Deals thực tế (Nhật Quỳnh 215.5M, Japfa 670M, Miza 600M, Chu Gia 120M, GAET 200M).<br>• Giữ công thức Rollover (BR-005). | • Bố cục 2 cột Trái (Plan Năm) - Phải (Actual Tuần) rõ ràng, không bị xô lệch.<br>• Bảng So sánh kỳ hiển thị delta YoY màu xanh lá `+100%` sắc nét.<br>• Biểu đồ cột mini hiển thị chỉ số rõ ràng trên từng cột. |
| **5. Quản lý Chi phí (`/expense`)** | • 3 Sub-tabs: **Tổng quan** \| **Ngân sách** \| **Nhập chi phí**.<br>• Tab Tổng quan: Lọc Tuần/Tháng/Quý/Năm, 3 Thẻ Metric (Tổng chi phí 123M, KH Mới 7, CAC 17.500.394 đ), Box Logic tính toán, Bảng chi phí theo Project, Khối Báo cáo chi phí (Ngân sách, Thực tế, Chênh lệch 0.0% Tròn, Chi tiết kỳ).<br>• Tab Ngân sách: Thời gian Năm 2026, 4 Cards (510M, 0đ, 510M, 0%), Bảng 6 nhóm hạng mục (Công cụ, Brand, Digital, Event, Hiệp hội, Quà tặng).<br>• Tab Nhập chi phí: 2 sub-nav (Chi phí dự án / Chi phí tổng), Bảng nhập chi tiết (Ngày, Hạng mục, Chi tiết, Đơn giá, VAT, SL, Thành tiền KH, Thành tiền TT, Tổng cộng 111.495.960 đ), Lịch sử chi phí. | • Giữ nguyên 6 nhóm chi phí.<br>• Giữ đúng công thức CAC (BR-007) và LTV (BR-008).<br>• Giữ nguyên phân quyền Specialist chỉ xem (PRD-00). | • Bổ sung badge đánh giá sức khỏe **LTV:CAC 3.4x Tỷ lệ vàng (2.5 - 4.0)**.<br>• Bảng nhập chi phí có tính tổng tự động và định dạng tiền tệ tức thì. |
| **6. Kho vật phẩm (`/inventory`)** | • Tiêu đề & mô tả phân hệ + Nút `+ Nhập kho mới`.<br>• 2 Thẻ Metric: **Tổng kho hàng** (500 đơn vị), **Tổng giá trị tồn kho** (4.158.000 VND).<br>• Thanh tìm kiếm + Dropdown Danh mục.<br>• Bảng vật phẩm: Smartlog leaflet, Áo Polo... (Vật phẩm, Danh mục, Tổng tồn kho, Đơn giá sau VAT, Trạng thái, Thao tác: Chi tiết, Lịch sử, Sửa, Xoá).<br>• Modal / Drawer xem chi tiết Lô hàng (Batch tracking, PO, Đơn giá, Xuất kho). | [CHÚ Ý] **TÍNH NĂNG RIÊNG ĐẶC THÙ CỦA MKT HUB, PMS KHÔNG CÓ**.<br>Tuyệt đối giữ nguyên 100% logic quản lý theo Lô (Batch) và Đơn giá sau VAT. | • Thiết kế thẻ kho sạch sẽ, icon phân loại trực quan ( Ấn phẩm, Quà tặng, Thiết bị).<br>• Drawer chi tiết Lô hàng mở từ bên phải hiển thị từng đợt nhập PO rõ ràng. |
| **7. ️ Quản lý Dữ liệu (`/data`)** | • 6 Sub-tabs: **Import Data**, **Export**, **Team Members**, **Cấu hình Dropdown**, **Slack Settings**, **Backup & Reset**.<br>• Import: Dropzone kéo thả CSV/Excel, file mẫu, preview.<br>• Export: 3 nút xuất nhanh (Tasks, Leads/Deals, Chi phí).<br>• Team: 5 thành viên (A. Nguyen - Manager, LT, TT, KN, CC - Specialist) + Phân quyền.<br>• Dropdown: 8 loại dự án, 6 nhóm chi phí.<br>• Slack: Webhook URL, Channel `#mkt-alerts`, Lịch gửi tự động (09:00 hàng ngày, Thứ 2 hàng tuần).<br>• Backup: Tải JSON, Reset demo. | • Giữ nguyên 6 sub-tabs chức năng.<br>• Giữ nguyên cấu hình Slack webhook và lịch bắn cảnh báo.<br>• Giữ nguyên 5 thành viên marketing và phân quyền Manager vs Specialist. | • Dropzone kéo thả file có animation hover viền sáng mượt mà.<br>• Bảng Team member có avatar và badge vai trò rõ rệt.<br>• Nút "Gửi tin nhắn kiểm tra (Test Webhook)" có phản hồi toast thông báo. |

---

## 2. Hướng Dẫn Kỹ Thuật Chi Tiết Cho Từng Phân Hệ

### 2.1 Chuẩn Hóa Phân Hệ 2: Quản lý Dự án (`/projects`)
* **Vấn đề cũ:** Trước đây hiển thị dạng accordion đơn giản hoặc thiếu số liệu tổng quan.
* **Giao diện chuẩn Live:**
 1. **Top Metric Bar:** 3 thẻ card nền `#0D1527`, viền `border-slate-800`.
 - Card 1: `TỔNG NGÂN SÁCH NĂM`: `510.000.888 VND` · Sub: `↗ Đã phân bổ 21.8%` (Font tabular-nums).
 - Card 2: `DỰ ÁN ĐANG CHẠY`: `5 Chiến dịch` · Sub: `⏱ 0 dự án chậm tiến độ`.
 - Card 3: `KPI ĐẠT ĐƯỢC (TB)`: `40%` với progress bar màu xanh ngọc (`bg-emerald-500`).
 2. **Project Table:** Bảng danh sách chuẩn 10 dự án.
 - Cột DỰ ÁN: Icon loa chiến dịch, Tên dự án font bold `text-slate-100`, bên dưới là Badge Mã dự án font mono `PRJ-E73D7` và ` 31 Dec`.
 - Cột OWNER: Avatar tròn chữ cái (`TT`, `LT`), tên nhân viên font medium.
 - Cột TIẾN ĐỘ: Text % + nhãn `On track` + progress bar vi mô.
 - Cột KPI: `• Leads: 0 / 266` hoặc `• Leads: 20 / 9`.
 - Cột NGÂN SÁCH: Căn phải, số tiền đậm `103.237.000`, subtext `Đã chi: 111.495.960 (108%)`.
 - Cột HỒ SƠ: Icon trạng thái (`` xanh lá hoặc `⊗` xám).

### 2.2 Chuẩn Hóa Phân Hệ 3: Quản lý Công việc (`/tasks`)
* **Vấn đề cũ:** Thiếu 8 thẻ đếm trên đầu trang; Kanban chỉ có 6 cột tiếng Anh; Weekly report không có khung Nhật ký tuần.
* **Giao diện chuẩn Live:**
 1. **Subtab `Danh sách Task` (Table View):**
 - **8 Thẻ đếm:** `TỔNG CỘNG 129` (slate), `CHƯA LÀM 108` (blue), `ĐANG LÀM 0` (amber), `HOÀN THÀNH 11` (emerald), `TỒN ĐỌNG 0` (yellow), `ĐANG CHỜ 0` (purple), `ĐÃ HUỶ 0` (gray), `QUÁ HẠN 10` (rose).
 - **Thanh lọc:** 4 dropdowns lọc (`Dự án`, `Trạng thái`, `Ưu tiên`, `Người phụ trách`) + Ô tìm kiếm ` Tìm tên task...` + Date range + 2 nút `⏚ Lọc`, ` Xóa lọc` + Nút `+ Thêm task`.
 - **Bảng 15 Cột:** Có icon cảnh báo `[CHÚ Ý]` màu đỏ cho task quá hạn; Tên task khi click sẽ mở **Side Drawer** bên phải; Thao tác có 3 nút ` Xem`, ` Sửa`, ` Xoá`.
 2. **Subtab `Kanban Board`:**
 - **7 Cột đúng tên tiếng Việt:** `QUÁ HẠN 10`, `CHƯA LÀM 108`, `ĐANG LÀM 0`, `HOÀN THÀNH 11`, `CHỜ XỬ LÝ 0`, `ĐÃ HUỶ 0`, `TỒN ĐỌNG 0`.
 - Thẻ task hiển thị mã hash 12 ký tự (vd: `3d5da0ed02cd`), tiêu đề task, avatar PIC và ngày hạn chót.
 3. **Subtab `Báo cáo Tuần`:**
 - Filter: `TUẦN: 38`, `NĂM: 2026`, `DỰ ÁN`, `NGƯỜI PHỤ TRÁCH`, nút ` Tự động điền`, ` Xuất TXT`.
 - Lưới 2x2 gồm 4 mục chuẩn PRD-02:
 1. `🟢 1. Công việc đã hoàn thành (1)`: Bảng có Mã, Task, Kết quả, Người làm.
 2. ` 2. Kế hoạch tuần 39 (6)`: Bảng có Lịch, Hạng mục, Hạn chót, Ưu tiên.
 3. `[CHÚ Ý] 3. Tồn đọng / Vấn đề (0)`.
 4. `[QUAN TRỌNG] 4. Cần BOD hỗ trợ (0)`: Quản lý theo BR-002.
 - Khung `Nhật ký tuần` với nút ` Lưu nhật ký` và 4 textareas: *Ghi chú công việc*, *Đề xuất cải tiến*, *Bài học kinh nghiệm*, *Thông báo / Nhắc nhở*.

### 2.3 Chuẩn Hóa Phân Hệ 4: Leads & KPIs (`/leads`)
* **Vấn đề cũ:** Ma trận phễu chưa đủ các bảng phụ trợ (Pipeline theo segment, Won theo quý); form nhập bị đơn điệu.
* **Giao diện chuẩn Live:**
 1. **Subtab `Xem & Phân tích`:**
 - 7 KPI Cards: Raw Leads (0/9), MQL (0/5), SQL (0/2), OPP (0/1), Closed Deal (0/0), Pipeline (0/509.6M), ROA (0/0).
 - Thẻ CAC: `— VNĐ/khách`.
 - Phễu chuyển đổi 5 bước bên trái; 2 bảng bên phải: `PIPELINE VALUE (OPP)` (Doanh nghiệp lớn, Tầm trung, SMB) và `WON VALUE` (Q1: 471M, Q2: 1.4B, Q3: 215.5M, Q4: 0đ).
 2. **Subtab `Nhập số liệu`:**
 - Khối Trái: `Kế hoạch KPIs` Năm 2026 (7 chỉ tiêu) + nút ` Sửa`.
 - Khối Phải: `Nhập Dữ Liệu` với bộ chọn Dự án, Ngày phát sinh (14/09/2026), subtext tuần/tháng báo cáo. Bên dưới chia 2 cột: `Kế Hoạch Kỳ Này` (5 mini metric cards + inputs + nút Lưu) và `Nhập Thực Tế` (inputs + nút Lưu).
 - Bảng `CHI TIẾT CLOSED DEAL (7)`: Danh sách 5 hợp đồng thực tế từ trăm triệu đến tiền tỷ, kèm trạng thái ` Hoàn tất`.
 - Chân trang: Khung Hướng dẫn Import + 2 nút `Xuất Excel`, `Nhập từ CSV`.
 3. **Subtab `So sánh kỳ`:**
 - Bộ lọc: Dự án, Chu kỳ (Tuần/Tháng/Quý/Năm), Chọn Quý 1, Checkboxes chọn năm `[x] 2026`, `[x] 2025`, `[ ] 2024`, nút ` Làm mới`.
 - Bảng `So sánh đa chỉ tiêu`: 7 hàng chỉ số có cột Tăng trưởng YoY (`+100.0%`).
 - Biểu đồ cột so sánh theo 4 Quý bên trái; Khung `Phân tích nhanh` (Cơ hội tăng trưởng, Cảnh báo hiệu suất, Điểm nổi bật tài chính) và nút ` Tạo báo cáo AI` bên phải.

### 2.4 Chuẩn Hóa Phân Hệ 5: Quản lý Chi phí (`/expense`)
* **Giao diện chuẩn Live:**
 1. **Subtab `Tổng quan`:**
 - 3 Top Cards: `TỔNG CHI PHÍ: 123M`, `KHÁCH HÀNG MỚI: 7`, `CAC TRUNG BÌNH: 17.500.394 đ`.
 - Khối Trái `Logic Tính Toán`: Công thức CAC + nút `EXPORT DETAILED REPORT`.
 - Khối Phải `Bảng Chi Phí Theo Project`: VWAS 2026, SMARTLOG X FCI, INNOEX 2026 (11.006.800 đ).
 - Khối `Báo cáo Chi phí`: 3 Cards (Tổng ngân sách 1M, Thực tế 1M, Chênh lệch 0.0% Tròn) + Bảng Chi tiết Kỳ (Tình trạng: `● Tốt`).
 2. **Subtab `Ngân sách`:**
 - 4 Cards: `Tổng ngân sách: 510.000.888 đ`, `Thực tế đã chi: 0 đ`, `Ngân sách còn lại: 510.000.888 đ`, `% Đã sử dụng: 0%`.
 - Bảng `Chi phí theo nhóm hạng mục`: 6 nhóm (CÔNG CỤ, BRAND MARKETING 510M, DIGITAL Marketing, EVENT 888đ, HIỆP HỘI/ GIẢI THƯỞNG, QUÀ TẶNG/ IN ẤN).
 3. **Subtab `Nhập chi phí`:**
 - 2 Lựa chọn: `Nhập chi phí dự án` \| `Nhập chi phí tổng hạng mục`.
 - Bảng nhập liệu chi tiết 11 cột với đơn giá, VAT 8%, thành tiền KH, thành tiền TT, tổng cộng `111.495.960 đ`.
 - Bảng `Lịch sử Chi Phí`: Theo dõi các lần ghi nhận ngân sách trước đó.

### 2.5 Chuẩn Hóa Phân Hệ 6: Kho vật phẩm (`/inventory`)
* **Giao diện chuẩn Live:**
 1. **2 Top Cards:** `TỔNG KHO HÀNG: 500 đơn vị` (Link: `↗ Xem chi tiết`) và `TỔNG GIÁ TRỊ TỒN KHO: 4.158.000 VND` (`↗ +0% so với tháng trước`).
 2. **Thanh tìm kiếm & lọc danh mục:** Tìm kiếm vật phẩm, lọc Ấn phẩm in / Quà tặng / Thiết bị.
 3. **Bảng vật phẩm:** Hiển thị `Smartlog leaflet` (Ấn phẩm A4, 500 cái, 8.316 VND, trạng thái ` Còn hàng`), `Áo Polo Smartlog Tech` (45 cái, 185.000 VND, `● Sắp hết`).
 4. **Thao tác:** Nút `Chi tiết →` mở Side Drawer xem thông tin Lô hàng (Batches), PO number, đơn giá trước/sau VAT và nút Xuất kho.

### 2.6 Chuẩn Hóa Phân Hệ 7: Quản lý Dữ liệu (`/data`)
* **Giao diện chuẩn Live:**
 1. **6 Subtabs:** `Import Data`, `Export`, `Team Members`, `Cấu hình Dropdown`, `Slack Settings`, `Backup & Reset`.
 2. **Team Members:** 5 nhân sự marketing:
 - `A. Nguyen` (`a.nguyen@company.com`) — `Manager (Toàn quyền)`.
 - `Nguyễn Lương Tính` (`tinh.nl@gosmartlog.com`) — `Specialist`.
 - `Nguyễn Thanh Trúc` (`truc.nt@gosmartlog.com`) — `Specialist`.
 - `Tăng Khánh Nguyên` (`nguyen.tk@gosmartlog.com`) — `Specialist`.
 - `Trần Công Chánh` (`chanh.tc@gosmartlog.com`) — `Specialist`.
 3. **Slack Settings:** Webhook URL, Channel `#mkt-alerts`, Lịch gửi tự động:
 - Task Quá hạn: 09:00 hàng ngày.
 - Task Sắp hạn: 09:00 Thứ Hai hàng tuần.
 - Báo cáo tuần: 17:00 Thứ Sáu hàng tuần.
 - Nút `Lưu Cấu Hình Slack` & ` Gửi tin nhắn kiểm tra (Test Webhook)`.
 4. **Backup & Reset:** Khung Tải JSON sao lưu và Khôi phục dữ liệu thử nghiệm.

---

## 3. Quy Chuẩn CSS, Design Tokens & Component Cho Frontend Team

### 3.1 Bảng màu cốt lõi & Design Tokens (Hỗ trợ 2 Theme Sáng / Tối)

FE cấu hình Tailwind CSS với `darkMode: 'class'` và CSS Variables:

```css
/* ==========================================================================
   1. LIGHT THEME TOKENS (MẶC ĐỊNH - SÁNG TOÀN DIỆN, CHUẨN STRIPE / LINEAR)
   ========================================================================== */
:root {
  --bg-app: #F8FAFC;           /* Nền canvas tổng thể */
  --bg-surface: #FFFFFF;       /* Nền thẻ Card, Header, Sidebar, Bảng biểu */
  --bg-subtle: #F1F5F9;        /* Nền ô input, search, container bộ lọc */
  --border-default: #E2E8F0;   /* Viền 1px sắc nét cho cards, tables */
  --border-subtle: #F1F5F9;
  
  --text-primary: #0F172A;     /* Tiêu đề, số liệu KPI quan trọng */
  --text-secondary: #475569;   /* Nhãn dữ liệu, text thông thường */
  --text-muted: #94A3B8;       /* Chú thích, placeholder */
  
  /* Badges & Accents (Tông pastel nhẹ nhàng, chữ đậm) */
  --badge-rose-bg: #FFF1F2;    --badge-rose-text: #BE123C;    --badge-rose-border: #FECDD3;
  --badge-amber-bg: #FFFBEB;   --badge-amber-text: #B45309;   --badge-amber-border: #FDE68A;
  --badge-emerald-bg: #ECFDF5; --badge-emerald-text: #047857; --badge-emerald-border: #A7F3D0;
  --badge-indigo-bg: #EEF2FF;  --badge-indigo-text: #4338CA;  --badge-indigo-border: #C7D2FE;
}

/* ==========================================================================
   2. DARK THEME TOKENS (DEEP SLATE NAVY - CHUẨN SMARTLOG PMS & LINEAR)
   ========================================================================== */
html.dark {
  --bg-app: #080D1A;           /* Tông xanh đen trầm sâu, không dùng xám đục */
  --bg-surface: #0D1527;       /* Thẻ Card, bảng biểu có chiều sâu */
  --bg-subtle: #0B1120;        /* Header, Sidebar, Sub-nav phụ */
  --border-default: rgba(255, 255, 255, 0.08); /* Viền mờ tinh tế 1px */
  --border-subtle: rgba(255, 255, 255, 0.04);
  
  --text-primary: #F8FAFC;     /* Trắng ngọc cho tiêu đề, số liệu */
  --text-secondary: #CBD5E1;   /* Xám bạc cho nội dung */
  --text-muted: #64748B;       /* Xám mờ cho chú thích */

  /* Badges & Accents (Pill tối bán trong suốt - KHÔNG DÙNG NỀN SÁNG TRONG DARK MODE) */
  --badge-rose-bg: rgba(244, 63, 94, 0.12);     --badge-rose-text: #FB7185;    --badge-rose-border: rgba(244, 63, 94, 0.25);
  --badge-amber-bg: rgba(245, 158, 11, 0.12);   --badge-amber-text: #FBBF24;   --badge-amber-border: rgba(245, 158, 11, 0.25);
  --badge-emerald-bg: rgba(16, 185, 129, 0.12); --badge-emerald-text: #34D399; --badge-emerald-border: rgba(16, 185, 129, 0.25);
  --badge-indigo-bg: rgba(99, 102, 241, 0.15);  --badge-indigo-text: #818CF8;  --badge-indigo-border: rgba(99, 102, 241, 0.30);
}
```

### 3.2 Cơ chế Nút chuyển đổi Theme Switcher (Light ⇄ Dark)
FE cần triển khai component Theme Toggle trên Header góc phải:
```tsx
// React / Vue / Next.js Implementation Concept
const [theme, setTheme] = useState<'light' | 'dark'>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('mkt_hub_theme') as 'light' | 'dark') || 'light';
  }
  return 'light';
});

const toggleTheme = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  localStorage.setItem('mkt_hub_theme', newTheme);
  if (newTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
```
* **Lưu ý đồng bộ 100% khi bật Dark Mode:**
  * Toàn bộ thanh Sub-nav phụ (như `[Danh sách Task | Kanban | Báo cáo Tuần]` ở Tasks, hoặc `[Xem & Phân tích | Nhập số liệu]` ở Leads) phải mang class `bg-white dark:bg-[#0B1120]` hoặc `dark:bg-slate-900/90`.
  * Tuyệt đối không để sót class nền trắng tĩnh như `bg-white/90` mà thiếu `dark:bg-[#0B1120]`.

### 3.3 Tiêu chuẩn Zero Emoji & Icon SVG
Loại bỏ 100% các ký tự emoji Unicode trên UI, thay thế bằng thư viện icon **Lucide-react** hoặc **Heroicons**:
* 📊 Dashboard ➔ `<LayoutDashboard className="w-4 h-4" />`
* 📁 Projects ➔ `<FolderKanban className="w-4 h-4" />`
* 📝 Tasks ➔ `<CheckSquare className="w-4 h-4" />`
* 🎯 Leads & KPIs ➔ `<TrendingUp className="w-4 h-4" />`
* 💰 Expense ➔ `<DollarSign className="w-4 h-4" />`
* 📦 Inventory ➔ `<Package className="w-4 h-4" />`
* ⚙️ Data Management ➔ `<Database className="w-4 h-4" />`
* 📅 Hạn chót ➔ `<Calendar className="w-3.5 h-3.5" />`
* 👁 Xem / ✏️ Sửa / 🗑 Xóa ➔ `<Eye />`, `<Pencil />`, `<Trash2 />`
* Chấm trạng thái Quá hạn / Sắp hạn ➔ `<span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>`

### 3.4 Quy chuẩn Font Số Thẳng Hàng (Tabular Numerals)
Bắt buộc thêm vào CSS toàn cục:
```css
.num {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
```
Áp dụng class `.num` cho: Số tiền VND, số lượng lead, tỷ lệ %, ngày tháng để các chữ số có độ rộng bằng nhau, thẳng hàng cột khi cuộn bảng.

### 3.5 Linh Kiện Side Drawer (Sheet Side="Right")
Thay thế toàn bộ `modal popup` căn giữa bằng Side Drawer trượt từ bên phải:
* **Overlay:** `fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50`.
* **Drawer panel:** `fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-[#0D1527] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-6 flex flex-col justify-between`.

---

## 4. Benchmark & File Tham Chiếu Trực Quan Cho FE

Đã cung cấp file prototype hoàn chỉnh 100% cả 7 phân hệ tại:
* **File HTML:** [specification/uiux/mkt-hub-preview.html](file:///d:/mkt-hub-backend/specification/uiux/mkt-hub-preview.html)
* **Cách xem:** FE chỉ cần kéo thả file này vào Chrome / Edge là có thể:
  1. Test nút chuyển đổi Sáng / Tối trực quan trên Header.
  2. Xem giao diện Full Light Mode (trắng sáng, sạch sẽ, không còn vệt tối).
  3. Xem giao diện Dark Slate Navy (êm mắt, có chiều sâu, không còn vệt trắng lệch tông).
  4. Trải nghiệm tương tác 7 phân hệ, 3 chế độ xem Tasks (Table/Kanban/Weekly Report), Drawer trượt, Modal quản lý kho.

---

## 5. Checklist Bàn Giao Cho FE (Copy & Paste Cho Team Dev)

- [ ] **Bước 1:** Bật `darkMode: 'class'` trong `tailwind.config.js`.
- [ ] **Bước 2:** Tạo component Theme Switcher trên Header, lưu trạng thái vào `localStorage ('mkt_hub_theme')`.
- [ ] **Bước 3:** Cập nhật Sidebar: Light mode dùng `bg-white border-r border-slate-200 text-slate-600`, Active dùng `bg-indigo-50 text-indigo-700 font-semibold border-indigo-200`. Dark mode dùng `dark:bg-[#0B1120] dark:border-slate-800`.
- [ ] **Bước 4:** Xóa sạch 100% Emoji, thay bằng Lucide SVG Icons + Chấm màu trạng thái (`rounded-full`).
- [ ] **Bước 5:** Thêm class `.num` cho tất cả các ô số liệu tiền tệ, tỷ lệ %, mã dự án.
- [ ] **Bước 6:** Đảm bảo tất cả các thanh Sub-nav phụ trên 7 phân hệ đều có class dark mode (`dark:bg-[#0B1120]` hoặc `dark:bg-slate-900/90`), không để sót vệt trắng khi ở chế độ tối.
- [ ] **Bước 7:** Giữ nguyên 100% logic dữ liệu, công thức tính và các trường nghiệp vụ từ PRD-00 đến PRD-05.
- [ ] **Bước 8:** Đảm bảo kết nối API Backend hoạt động bình thường như cũ (toàn bộ dữ liệu trong file prototype preview chỉ là mock data để định hình UI/UX).
