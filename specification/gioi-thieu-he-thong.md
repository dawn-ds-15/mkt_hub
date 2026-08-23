# BÁO CÁO THỰC TẬP — NHÓM PHÁT TRIỂN HỆ THỐNG WEBSITE MKT HUB

> Báo cáo mô tả toàn bộ quy trình xây dựng hệ thống quản lý chiến dịch Marketing **MKT Hub**
> của cả nhóm, gồm 4 vai trò chính: **BA** (Phân tích nghiệp vụ), **Frontend**, **Backend** và **Database**.
>
> Thông tin được kiểm chứng trực tiếp trên môi trường production `https://mkt-hub.onrender.com`
> với tài khoản demo `test@secret.dev` (vai trò: Manager), ngày 12/08/2026.

---

# LỜI MỞ ĐẦU

Trong bối cảnh Marketing hiện đại, việc quản lý chiến dịch, theo dõi hiệu quả và kiểm soát chi phí
trên nhiều kênh là bài toán nan giải nếu thực hiện thủ công trên bảng tính. **MKT Hub** ra đời nhằm
giải quyết vấn đề đó bằng một nền tảng quản lý Marketing tích hợp, giúp đội Marketing **lên kế hoạch
→ theo dõi thực thi → đánh giá hiệu quả** trên một hệ thống duy nhất.

Báo cáo trình bày toàn bộ quy trình xây dựng hệ thống theo mô hình nhóm 4 vai trò:
- **BA (Business Analyst):** khảo sát, phân tích và đặc tả yêu cầu nghiệp vụ; xây dựng tài liệu đặc tả API.
- **Database:** thiết kế cơ sở dữ liệu, mô hình quan hệ, các cơ chế toàn vẹn dữ liệu (soft-delete, tính toán tồn kho...).
- **Backend:** xây dựng API theo kiến trúc NestJS, xác thực/phân quyền, tích hợp Swagger.
- **Frontend:** xây dựng giao diện React, kết nối và đồng bộ dữ liệu với backend.

---

# CHƯƠNG 1. GIỚI THIỆU CƠ QUAN THỰC TẬP VÀ TỔNG QUAN ĐỀ TÀI

## 1.1 Giới thiệu về cơ quan thực tập

> *(Bạn bổ sung thông tin: tên công ty/dự án nơi nhóm thực tập, lĩnh vực hoạt động, quy mô, vị trí của các thành viên nhóm...)*

## 1.2 Đề tài thực tập

- **Tên đề tài:** Xây dựng hệ thống website quản lý chiến dịch Marketing **MKT Hub**.
- **Đội ngũ thực hiện:** Nhóm gồm các vai trò BA, Frontend, Backend, Database.
- **Mục tiêu:** Xây dựng hoàn chỉnh hệ thống từ khâu phân tích yêu cầu, thiết kế dữ liệu, phát triển API, phát triển giao diện đến triển khai và kiểm thử trên môi trường production.
- **Phạm vi:** 7 module nghiệp vụ (Dashboard, Dự án & Công việc, Leads & KPIs, Chi phí, Quản lý dữ liệu, Kho vật phẩm, Tài liệu API).
- **Công cụ kiểm chứng:** tài khoản demo `test@secret.dev`, production `https://mkt-hub.onrender.com`, tài liệu OpenAPI (`/api/docs-json`).

## 1.3 Tổng quan kiến trúc hệ thống

| Thành phần | Công nghệ | Vai trò | Thuộc nhóm |
|-----------|-----------|---------|-----------|
| **Frontend (SPA)** | React 18, Vite, Tailwind CSS, React Router, Zustand, Axios | Giao diện người dùng | FE |
| **Backend (API)** | NestJS (Node.js), JWT, Swagger OpenAPI | Xử lý nghiệp vụ, xác thực | BE |
| **Database** | PostgreSQL | Lưu trữ, quan hệ dữ liệu, tính toán | DB |
| **Đặc tả & tài liệu** | Tài liệu đặc tả nghiệp vụ, đối chiếu API FE–BE | Yêu cầu, contract | BA |

**Mô hình kết nối:** Frontend (SPA) gọi API REST qua Axios với JWT Bearer Token. Backend trả JSON bọc trong `{ data: ... }`. Mọi request chưa đăng nhập đều bị chuyển về trang `/login`.

---

# CHƯƠNG 2. CƠ SỞ LÝ THUYẾT — CÔNG NGHỆ / CÔNG CỤ SỬ DỤNG

> Giới thiệu sơ bộ các công nghệ/công cụ đang được dùng để giải quyết bài toán, kèm ưu/nhược điểm
> và lý do lựa chọn từng công nghệ.

## 2.1 React — Thư viện xây dựng giao diện (Frontend)

- **Vai trò:** Thư viện chính xây dựng giao diện người dùng (UI) theo kiến trúc **Component + State**.
- **Ưu điểm:** Cộng đồng lớn nhất frontend; JSX + component tái sử dụng cao, dễ bảo trì; `Virtual DOM` cập nhật UI nhanh, mượt với dữ liệu biến động liên tục (dashboard, kanban, biểu đồ).
- **Nhược điểm:** Cần kết hợp thêm thư viện khác (routing, state, HTTP client); cần chú ý re-render trên component lớn.
- **Lý do lựa chọn:** Virtual DOM cập nhật UI mượt với dữ liệu biến động như KPI, Kanban, biểu đồ — đúng đặc thù của hệ thống; hệ sinh thái phong phú giúp nhóm làm việc nhanh, dễ bảo trì.

## 2.2 Vite — Build tool / Dev server

- **Vai trò:** Công cụ đóng gói và chạy dev server nhanh cho dự án React.
- **Ưu điểm:** Khởi động gần như tức thời, **Hot Module Replacement (HMR)** tốc độ cao, cấu hình tối giản, build nhanh nhờ Rollup/esbuild.
- **Nhược điểm:** Tuổi đời ngắn hơn Webpack, một số plugin cũ chưa tương thích ngay.
- **Lý do lựa chọn:** HMR gần như tức thời giúp vòng lặp phát triển nhanh; cấu hình tối giản, build nhanh phù hợp quy mô dự án.

## 2.3 Tailwind CSS — Styling

- **Vai trò:** Framework CSS theo cú pháp **utility-first** — style trực tiếp qua class trên markup.
- **Ưu điểm:** Phát triển giao diện nhanh, nhất quán; tự động loại bỏ CSS không dùng khi build → bundle nhẹ; dễ tuỳ biến theme qua `tailwind.config.js`.
- **Nhược điểm:** Class dài, dễ "loãng" markup; hơi khó đọc với người quen viết CSS truyền thống.
- **Lý do lựa chọn:** Hệ thống có nhiều bảng, badge, modal, biểu đồ cần style nhanh + nhất quán → Tailwind giúp đạt cả tốc độ lẫn tính đồng bộ, bundle gọn hơn.

## 2.4 React Router — Điều hướng SPA

- **Vai trò:** Quản lý routing cho SPA (chuyển trang không tải lại trình duyệt).
- **Ưu điểm:** Cú pháp khai báo đơn giản, hỗ trợ lazy-loading (`React.lazy`), bảo vệ route (`ProtectedRoute`).
- **Nhược điểm:** Chỉ phù hợp ứng dụng web; cần cấu hình thêm cho server-side rendering.
- **Lý do lựa chọn:** Là thư viện routing chuẩn của React; **lazy-loading** tải từng trang theo nhu cầu giảm bundle ban đầu; **ProtectedRoute** chặn truy cập khi chưa đăng nhập — trùng khớp yêu cầu bảo mật (JWT).

## 2.5 Zustand — Quản lý state toàn cục

- **Vai trò:** Quản lý trạng thái dùng chung giữa các component (locale, kỳ báo cáo, bộ lọc...).
- **Ưu điểm:** API nhỏ gọn, ít boilerplate; hiệu năng tốt, không cần Provider bao bọc.
- **Nhược điểm:** Cộng đồng nhỏ hơn Redux; cần tổ chức store cẩn thận với app rất lớn.
- **Lý do lựa chọn:** Hệ thống chỉ cần vài state toàn cục nhẹ (ngôn ngữ, kỳ báo cáo) → Zustand giải quyết gọn, ít code, dễ bảo trì.

## 2.6 Axios + React Query — Gọi API & Quản lý dữ liệu server

- **Vai trò:** Axios là HTTP client; React Query quản lý state dữ liệu lấy từ server (cache, refetch, loading).
- **Ưu điểm (Axios):** Hỗ trợ **interceptor** (tự gắn JWT token, chặn 401 tự đăng nhập lại, chống cache bằng `_t`), trả lỗi rõ ràng, hoạt động cả browser + Node.
- **Ưu điểm (React Query):** Tự cache, tự refetch, xử lý loading/error tập trung, giảm code lặp lại.
- **Nhược điểm:** Phải nắm rõ luồng interceptor; React Query cần hiểu stale/refetch để tránh gọi thừa.
- **Lý do lựa chọn:** Interceptor của Axios là điểm mấu chốt — tự động gắn `Authorization: Bearer`, bắt 401 để đăng nhập lại, thêm `_t` chống cache 304; React Query giảm đáng kể code lặp lại cho loading/cache.

## 2.7 NestJS — Framework Backend

- **Vai trò:** Framework backend (Node.js) theo kiến trúc **module / controller / service**.
- **Ưu điểm:** Cấu trúc có tổ chức, dễ mở rộng; hỗ trợ **Swagger/OpenAPI tự sinh**; bảo mật JWT + Roles guard sẵn.
- **Nhược điểm:** Đường cong học hơi cao.
- **Lý do lựa chọn:** Hệ thống có nhiều module nghiệp vụ (dashboard, tasks, expenses, inventory...) — NestJS module hóa giúp tách biệt rõ ràng, tự sinh Swagger để FE kiểm thử trực tiếp.

## 2.8 PostgreSQL — Hệ quản trị cơ sở dữ liệu

- **Vai trò:** Lưu trữ dữ liệu quan hệ, thực hiện các tính toán nghiệp vụ (KPI, CAC/LTV, tồn kho).
- **Ưu điểm:** Quan hệ dữ liệu chặt chẽ (project → task, item → batch); hỗ trợ **UUID**, **Decimal** chính xác, hàm tính toán phức tạp.
- **Nhược điểm:** Cần tối ưu query khi dữ liệu lớn.
- **Lý do lựa chọn:** Nghiệp vụ đòi hỏi tính toán backend (KPI, chi phí, tồn kho) và quan hệ dữ liệu → PostgreSQL đáp ứng đúng, hỗ trợ kiểu Decimal cho tài chính (CAC/LTV, đơn giá).

## 2.9 JWT — Xác thực

- **Vai trò:** Token xác thực phiên đăng nhập, gắn vào mỗi request (`Authorization: Bearer <token>`).
- **Ưu điểm:** Không cần lưu session server, phù hợp API stateless; token chứa `role` để phân quyền.
- **Nhược điểm:** Khó "thu hồi" token trước khi hết hạn; cần giữ bí mật khóa ký.
- **Lý do lựa chọn:** Kiến trúc SPA gọi API **tách miền** — JWT Bearer truyền qua header không gặp vấn đề CORS cookie; payload chứa `role` giúp phân quyền Manager/Specialist.

## 2.10 Swagger / OpenAPI — Tài liệu API

- **Vai trò:** Tự sinh và hiển thị tài liệu API (route `/api-docs`, dữ liệu tại `/api/docs-json`).
- **Ưu điểm:** Xem thử request/response ngay trên trình duyệt; giúp FE–BE phối hợp không bị lệch contract.
- **Nhược điểm:** Cần backend khai báo DTO đầy đủ, nếu không schema sẽ trống.
- **Lý do lựa chọn:** Nhóm phát triển song song BA/BE/FE — OpenAPI là "hợp đồng" chuẩn hoá giúp rà soát thiếu endpoint, tránh tích hợp sai contract; tài liệu tự sinh từ code, luôn cập nhật.

## 2.11 Vercel & Render — Triển khai / DevOps

- **Vai trò:** Vercel deploy Frontend (static), Render deploy Backend (Node.js + PostgreSQL).
- **Ưu điểm:** Deploy tự động từ Git, HTTPS sẵn, có môi trường production miễn phí cho demo.
- **Nhược điểm:** Giới hạn tài nguyên free tier; khi server backend "ngủ" (sleep) lần request đầu bị chậm.
- **Lý do lựa chọn:** Có public URL production để demo & kiểm thử thực tế ngay, chỉ cần push code là lên môi trường.

## 2.12 Git & GitHub — Quản lý phiên bản & phối hợp nhóm

- **Vai trò:** Quản lý phiên bản mã nguồn, phối hợp nhóm 4 vai trò.
- **Ưu điểm:** Theo dõi lịch sử thay đổi, rollback dễ, làm việc song song qua nhánh (branch).
- **Nhược điểm:** Cần kỷ luật commit rõ ràng; xung đột merge khi làm cùng file.
- **Lý do lựa chọn:** Chuẩn ngành; tích hợp sẵn với Vercel/Render để **tự động deploy khi push**; nhóm nhiều người làm song song an toàn.

---

# CHƯƠNG 3. KHẢO SÁT VÀ PHÂN TÍCH YÊU CẦU (VAI TRÒ BA)

## 3.1 Khảo sát nghiệp vụ

Hệ thống phục vụ đội Marketing với nhu cầu quản lý **vòng đời chiến dịch**:

| Giai đoạn | Nghiệp vụ | Module tương ứng |
|-----------|-----------|------------------|
| Lên kế hoạch | Đặt mục tiêu KPI năm, phân bổ ngân sách chi phí, lập danh sách dự án & công việc | Leads & KPIs, Chi phí, Dự án & Công việc |
| Theo dõi thực thi | Nhập số liệu thực tế theo tuần, theo dõi tiến độ dự án, quản lý công việc, quản lý vật phẩm kho | Kanban, Actuals, Kho vật phẩm |
| Đánh giá hiệu quả | Tổng hợp dashboard, so sánh thực tế vs kế hoạch, phân tích CAC/LTV | Dashboard, So sánh kỳ |

## 3.2 Đặc tả yêu cầu chức năng (SRS tóm tắt)

| ID | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-01 | Hiển thị tổng quan hoạt động theo tháng/quý/năm (KPI, funnel, tiến độ, cảnh báo) | Cao |
| FR-02 | Quản lý dự án: CRUD, theo dõi tiến độ, ngân sách, KPI plan | Cao |
| FR-03 | Quản lý công việc: CRUD, Kanban kéo-thả, import CSV/XLSX, báo cáo tuần | Cao |
| FR-04 | Quản lý KPI plan năm + nhập actual theo tuần theo dự án, quản lý sự kiện/opportunity/deal | Cao |
| FR-05 | Quản lý chi phí theo kỳ, tính CAC/LTV, báo cáo biểu đồ | Cao |
| FR-06 | Quản lý dữ liệu: import/export, backup/restore, cấu hình, thành viên | Trung bình |
| FR-07 | Quản lý kho vật phẩm: vật phẩm, lô (batch), nhập kho, lịch sử xuất/nhập | Trung bình |
| FR-08 | Phân quyền Manager / Specialist; tài liệu API | Trung bình |

## 3.3 Vai trò của BA trong quá trình phát triển

- Xây dựng tài liệu đặc tả module và **đối chiếu API Frontend gọi ↔ Backend cung cấp** theo từng module
  (Dashboard, Projects & Tasks, Leads & KPIs, Chi phí, Data Management, Kho vật phẩm).
- Phát hiện các **endpoint thiếu** trên backend khi FE gọi ra 404, ví dụ:
  - `PATCH /api/v1/expenses/{id}` — backend thiếu method cập nhật chi phí.
  - Module Kho vật phẩm — yêu cầu backend bổ sung **12 endpoints** mới.
- Xác định **data shape + enum** mà FE mong đợi (camelCase: `totalStock`, `avgUnitPrice`, `currentStock`; enum: `instock/low/out`, `active/depleted`, `in/out`).
- Lập **checklist yêu cầu backend** và theo dõi đến khi backend fix xong (kiểm chứng lại bằng OpenAPI + test thực tế).

---

# CHƯƠNG 4. THIẾT KẾ CƠ SỞ DỮ LIỆU (VAI TRÒ DATABASE)

## 4.1 Các thực thể chính

| Entity | Mô tả | Quan hệ |
|--------|-------|---------|
| `Member` | Thành viên (nhân sự Marketing), có `role` (manager/specialist) | 1–n với Task (assignee), Project (owner) |
| `Project` | Dự án: loại, trạng thái, deadline, ngân sách, KPI plan | 1–n với Task, ExpenseRecord, KpiWeekly |
| `Task` | Công việc: mô tả, assignee, độ ưu tiên, start/due/completed date, status | n–1 Project, n–1 Member |
| `WeeklyReport` / `WeeklyLog` | Báo cáo tuần + log (done/plan/backlog/bod) | n–1 Project |
| `KpiPlan` | Mục tiêu KPI theo năm | — |
| `KpiWeekly` | Số liệu actual theo tuần theo dự án (rawLeads, mql, sql, opp, closed) | n–1 Project |
| `Event` | Sự kiện marketing (tên, ngày, số leads) | n–1 Project |
| `Opportunity` / `ClosedDeal` | Cơ hội bán hàng / hợp đồng đã chốt | n–1 Project |
| `ExpenseRecord` | Chi phí (direct/overhead) theo tháng/năm | n–1 Project |
| `SystemConfig` | Tham số hệ thống (churn_rate, gross_margin) theo kỳ | — |
| `InventoryItem` | Vật phẩm kho (code, category, unit, minThreshold) | 1–n với Batch |
| `InventoryBatch` | Lô hàng (batchCode, quantityIn, unitPrice, supplier, currentStock) | n–1 Item |
| `InventoryTransaction` | Giao dịch xuất/nhập (type in/out, quantity, note) | n–1 Item/Batch |

## 4.2 Nguyên tắc thiết kế

- **Khóa chính UUID** cho các entity (tránh đoán ID, hợp phân tán).
- **Decimal** cho các trường tiền/đơn giá (`budgetPlanDirect`, `unitPrice`, `totalValue`) để tính toán tài chính chính xác.
- **Soft-delete bằng cột `archivedAt`** (kèm `archivedBy`) thay vì xoá vật lý — bảo toàn lịch sử báo cáo; mọi query mặc định filter `archivedAt IS NULL`.
- **Backend tính toán, không lưu dư thừa:**
  - `Project.progress`, `tasksCompleted/total` — tính từ bảng Task.
  - `InventoryItem.totalStock`, `avgUnitPrice`, `status` — tính từ các Batch active (weighted average).
  - `InventoryBatch.currentStock`, `status` — giảm dần khi xuất kho.
- **Transaction DB** cho luồng nhập kho (tạo batch + ghi transaction + re-tính item) để đảm bảo toàn vẹn dữ liệu.

## 4.3 Một số ràng buộc đã xử lý

- `InventoryItem.code` và `InventoryBatch.batchCode` **unique** → trùng mã trả `400/409` kèm message tiếng Việt rõ ràng (`"Mã vật phẩm đã tồn tại."`, `"Mã batch đã tồn tại."`).
- `month` (1–12), `week` (1–53), `status` enum hợp lệ — validate ở tầng DTO.
- Khi xoá mềm batch → item được **re-tính lại** tồn kho/giá/trạng thái.

---

# CHƯƠNG 5. PHÁT TRIỂN BACKEND (VAI TRÒ BACKEND)

## 5.1 Kiến trúc

Backend dùng NestJS với mô hình **Module → Controller → Service**:

- Mỗi nghiệp vụ là 1 module riêng: `Dashboard`, `Projects`, `Tasks`, `WeeklyReports`, `LeadsKpis`, `Expenses`, `DataManagement`, `Inventory`, `Auth`.
- **Auth guard** JWT toàn cục + **Roles guard** cho phân quyền (Manager/Specialist).
- **Swagger** được bật để tự sinh tài liệu tại `/api/docs-json`.

## 5.2 Các nhóm API chính

| Nhóm | Số endpoint tiêu biểu | Chức năng |
|------|----------------------|-----------|
| Auth & Dashboard | login; `overview`, `kpi-cards`, `funnel` | Đăng nhập, tổng quan KPI |
| Projects & Tasks | CRUD project/task, `kanban/board`, `import`, `import/template`, weekly-reports | Quản lý dự án & công việc |
| Leads & KPIs | `plan/:year`, `weekly`, `opportunities/:id/won`, `closed-deals`, `events`, `comparison`, `ai/report` | KPI, actual, sự kiện, so sánh |
| Expenses | CRUD expense, `overview`, `report`, `system-configs` | Chi phí, CAC/LTV |
| Data Management | members, dropdowns, slack, import/export, backups/reset | Vận hành hệ thống |
| Inventory | 12 endpoints (overview, items, batches, entries, transactions) | Kho vật phẩm |

## 5.3 Điểm nổi bật về xử lý nghiệp vụ

- **Tính toán server-side:** KPI plan/actual, rollover tuần (`planGoc + rollover = effectivePlan`), CAC/LTV, tồn kho & đơn giá trung bình.
- **Soft-delete nhất quán:** `DELETE` chỉ set `archivedAt`; query mặc định lọc bỏ.
- **Phân trang + lọc:** `GET /v1/inventory/items` trả `{ data: { items, total, page, limit } }` với các tham số `search/category/status/page/limit`.
- **Xử lý lỗi rõ ràng:** trả `400/404/409` kèm message nghiệp vụ, giúp Frontend hiển thị đúng thông báo.

---

# CHƯƠNG 6. PHÁT TRIỂN FRONTEND (VAI TRÒ FRONTEND)

## 6.1 Kiến trúc Frontend

- **Routing & bảo mật:** `App.jsx` khai báo 7 route chính; `ProtectedRoute` kiểm tra token trước khi vào trang, nếu chưa đăng nhập chuyển về `/login`; mỗi trang được **lazy-load** để giảm bundle ban đầu.
- **Tầng service tập trung:** mọi hàm gọi API nằm trong `FE/services/api.js`:
  - Axios instance với **interceptor** tự gắn `Authorization: Bearer`, bắt lỗi 401 → tự đăng nhập lại, thêm `_t=Date.now()` chống cache 304.
  - Các hàm theo từng module: `getDashboardData`, `getProjects`, `getTaskList`, `getPlanKPIs`, `saveExpense`, `getInventoryItems`...
  - Hàm **transform** map field backend ↔ field hiển thị (ví dụ `transformKpiCards`, `transformFunnel`, `taskStatusToMock`, `projectStatusToMock`).
- **Quản lý state:** `DashboardContext` cung cấp `locale` (EN/VI) và kỳ báo cáo; Zustand cho state toàn cục nhẹ; React Query cho cache/loading dữ liệu server.
- **Soft-delete FE:** `utils/softDelete.js` (key `mkt_hub_deleted`) lọc các bản ghi đã xoá khỏi UI sau khi nhận từ backend.

## 6.2 Giao diện tổng thể

- **Sidebar** liệt kê 7 module chính; **Topbar** gồm tên trang, chuông thông báo, bộ lọc kỳ báo cáo, menu người dùng.
- **Đa ngôn ngữ** EN/VI qua context `locale`; **toast** phản hồi kết quả thao tác.

**Các route chính:**

| Route | Module |
|-------|--------|
| `/` | Dashboard (Tổng quan) |
| `/projects`, `/tasks` | Dự án & Công việc |
| `/leads` | Leads & KPIs |
| `/expense` | Quản lý chi phí |
| `/data` | Quản lý dữ liệu |
| `/inventory` | Kho vật phẩm |
| `/api-docs` | Tài liệu API (Swagger) |

## 6.3 Đăng nhập & Phân quyền

- Trang đăng nhập yêu cầu Email + Mật khẩu; backend trả `access_token` (JWT) + thông tin user, lưu vào `localStorage`.
- Phân quyền: **Manager** (toàn quyền) / **Specialist** (thao tác dữ liệu được phân quyền).
- Token hết hạn → tự chuyển về `/login`.

## 6.4 Chức năng chính từng module

### 6.4.1 Dashboard — Tổng quan (route `/`)

Tổng hợp tình hình hoạt động theo tháng/quý/năm từ 1 request `GET /v1/dashboard/overview`.

| Khu vực | Nội dung |
|---------|----------|
| **KPI Cards** | 7 chỉ số: Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline Value, CAC/LTV — so sánh Actual vs Plan kèm % hoàn thành |
| **Funnel Chart** | Phễu chuyển đổi 5 tầng kèm tỉ lệ chuyển đổi |
| **Activities Chart** | Phân bổ hoạt động Marketing |
| **Project Progress** | Danh sách dự án kèm % tiến độ |
| **Task Status** | Thống kê trạng thái công việc |
| **Alerts Widget** | Cảnh báo công việc quá hạn / sắp hạn |

> Số liệu thực tế khi test: 7 KPI cards, funnel 5 tầng hoạt động đúng.

### 6.4.2 Dự án & Công việc (route `/projects`, `/tasks`)

| Tab | Chức năng |
|-----|-----------|
| **Danh sách Task** | Bảng task: thêm nhanh, lọc, sort, phân trang |
| **Kanban** | Board kéo-thả 6 cột — kéo card đổi trạng thái |
| **Báo cáo Tuần** | Báo cáo công việc tuần (4 mục) + export `.txt` |
| **Dự án** | Danh sách dự án dạng bảng; tạo/sửa/xoá với KPI plan, ngân sách, deadline |

**Tính năng nổi bật:** xem chi tiết task qua modal; import task từ CSV/XLSX + tải template; xoá mềm giữ lịch sử; tự gắn nhãn *Overdue*.

> Test thực tế: API trả dữ liệu real (project "VILOG 2026", task "Update Smartlog Profile"...).

### 6.4.3 Leads & KPIs (route `/leads`)

| Tab | Chức năng |
|-----|-----------|
| **Xem & Phân tích** | KPI cards, phễu chuyển đổi, phân tích phân khúc |
| **Nhập số liệu** | KPI Plan năm + Actuals tuần theo dự án + tạo Sự kiện marketing |
| **So sánh kỳ** | So sánh nhiều năm/quý/tháng + báo cáo AI |

**Tính năng nổi bật:** quản lý Opportunities & Closed Deals, chuyển opportunity thành Won; **Rollover** tự cộng số dư từ tuần trước; Events đồng bộ backend không mất khi reload.

> Test thực tế: Plan 2026 `totalRawLeads=446, targetSql=112, targetClosedDeal=16`; weekly trả `planGoc/rollover/effectivePlan/actual`.

### 6.4.4 Quản lý chi phí (route `/expense`)

| Tab | Chức năng |
|-----|-----------|
| **Tổng quan** | Tổng chi phí, CAC, LTV, tỉ số LTV/CAC, sức khoẻ; bảng chi phí theo dự án |
| **Nhập chi phí** | Tham số hệ thống (gross margin, churn rate) + nhập chi phí + lịch sử |
| **Báo cáo** | Biểu đồ tròn/đường/cột ngân sách vs thực tế, bảng chi tiết |

> Test thực tế: overview 2026 `totalExpense≈155,2M`, `cac≈2,35M`, `ltvCacRatio≈246` — tính toán đúng.

### 6.4.5 Quản lý dữ liệu (route `/data`)

5 tab: **Import** (tasks, KPI history, closed deals + template), **Export** (PDF/Excel/full), **Backup & Restore**, **Cấu hình** (dropdown, Slack), **Thành viên** (CRUD + phân quyền).

### 6.4.6 Kho vật phẩm (route `/inventory`)

- **Tổng quan kho:** tổng giá trị, xu hướng, vật phẩm sắp hết, lô hàng đang về.
- **Danh sách vật phẩm:** tìm kiếm, lọc theo category/status, phân trang; thêm/sửa/xoá.
- **Chi tiết vật phẩm:** tồn kho, đơn giá TB (backend tính), danh sách lô (batch).
- **Nhập kho:** tạo phiếu nhập → hệ thống tự tạo batch + ghi giao dịch `in` + cập nhật tồn kho.
- **Lịch sử xuất/nhập:** danh sách giao dịch, lọc theo vật phẩm/lô.

**Tính năng nổi bật:** backend tự tính `totalStock`, `avgUnitPrice`, `status`, `currentStock`; quản lý theo lô; soft-delete vật phẩm/lô.

### 6.4.7 Tài liệu API (route `/api-docs`)

Trang hiển thị Swagger/OpenAPI toàn bộ API backend — xem endpoint, method, params, payload, mã lỗi phục vụ tích hợp & kiểm thử.

---

# CHƯƠNG 7. ĐỒNG BỘ VÀ KIỂM THỬ HỆ THỐNG

## 7.1 Quy trình đồng bộ FE–BE (BA + FE + BE)

1. BA đối chiếu từng module: hàm FE gọi ↔ endpoint BE cung cấp, lập bảng trạng thái (đồng bộ / thiếu / sai path).
2. Phát hiện & ghi nhận yêu cầu backend fix (ví dụ thiếu `PATCH /expenses/:id`, thiếu 12 endpoint inventory).
3. Backend bổ sung API → kiểm chứng lại qua OpenAPI (`/api/docs-json`) và test thực tế.
4. FE cập nhật path/field mapping cho khớp contract.

## 7.2 Kết quả kiểm thử thực tế (production, account `test@secret.dev`)

| Hạng mục | Kết quả |
|----------|---------|
| Dashboard overview (month/quý/năm) | ✅ 7 KPI cards, funnel 5 tầng |
| Projects & Tasks CRUD + Kanban | ✅ dữ liệu real |
| Leads & KPIs plan/weekly/closed-deals | ✅ đủ `planGoc/rollover/effectivePlan/actual` |
| Expenses overview/report | ✅ CAC/LTV tính đúng |
| Inventory 12 endpoints (overview, items, batches, entries, transactions) | ✅ full CRUD + nhập kho pass |
| Trùng `code`/`batchCode` | ✅ trả `400/409` kèm message rõ ràng |
| Soft-delete batch → item re-tính | ✅ `130 → 100` đúng |
| 401 token hết hạn | ✅ FE tự chuyển về `/login` |

## 7.3 Các điểm còn tồn đọng

> ✅ **Cập nhật 21/08/2026: cả 2 mục dưới đây backend đã hoàn thành và đã kiểm thử trên production**
> (chi tiết: `backend-missing-apis.md`):
>
> - Response DTO/OpenAPI cho 12 endpoint inventory + `PATCH /v1/expenses/{id}` — đã có đầy đủ `$ref` schema.
> - `WeeklyReportsService.scope()` đã thêm filter `archivedAt: null` — task xóa mềm không còn lọt báo cáo tuần.
>
> Ngoài ra module **Hồ sơ & Hợp đồng** (4 endpoint `/projects/{id}/documents`) đã đi vào hoạt động,
> FE đã tích hợp API thật thay localStorage.

- ~~Khai báo **response DTO/OpenAPI** đầy đủ cho 12 endpoint inventory~~ ✅ Đã xong.
- ~~`WeeklyReportsService.scope()` cần bổ sung filter `archivedAt: null`~~ ✅ Đã fix.

---

# CHƯƠNG 8. TRIỂN KHAI

## 8.1 Hạ tầng

| Hạng mục | Chi tiết |
|----------|----------|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Zustand, React Query, Axios — deploy trên **Vercel** |
| **Backend** | NestJS, PostgreSQL, JWT, Swagger — deploy trên **Render** |
| **API chính** | `https://mkt-hub.onrender.com/api` |
| **Xác thực** | JWT Bearer token (localStorage) |
| **Soft-delete** | Backend cột `archivedAt`; Frontend lớp filter `mkt_hub_deleted` |

## 8.2 Quy trình deploy

1. Quản lý mã nguồn trên **Git/GitHub** (mỗi vai trò làm việc trên nhánh riêng, merge sau khi review).
2. Push code → **Vercel** tự build & deploy Frontend; **Render** tự build & deploy Backend.
3. Kiểm thử production bằng tài khoản demo + đối chiếu OpenAPI.

---

# KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## Kết luận

- Nhóm đã xây dựng thành công hệ thống **MKT Hub** đầy đủ 7 module nghiệp vụ hoạt động end-to-end trên production, trải đều 4 vai trò: **BA** (đặc tả & đối chiếu yêu cầu), **Database** (thiết kế dữ liệu, soft-delete, tính toán), **Backend** (NestJS + Swagger + JWT), **Frontend** (React SPA + đồng bộ API).
- Kiến trúc **SPA + REST API + JWT + PostgreSQL** rõ ràng, dễ mở rộng; tài liệu OpenAPI là hợp đồng chuẩn hoá FE–BE.
- Qua quá trình thực tập, các thành viên nắm được quy trình làm việc nhóm theo vai trò, kỹ năng phân tích yêu cầu, thiết kế dữ liệu, phát triển API và giao diện, cũng như quy trình đồng bộ & kiểm thử trên production.

## Hướng phát triển

- Hoàn thiện khai báo response DTO/OpenAPI cho toàn bộ endpoint Inventory để `/api-docs` hiển thị đầy đủ schema.
- Bổ sung báo cáo AI, thông báo tự động qua Slack cho các sự kiện quan trọng.
- Xây dựng module kiểm thử tự động (unit test + e2e) cho backend và frontend.
- Mở rộng phân quyền chi tiết hơn và audit log cho các thao tác quan trọng.
