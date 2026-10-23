# Yêu cầu BE — 29/09/2026 (Feedback MKT Hub 25/09 lần 2 + 26/09)

**Người gửi:** FE Team
**Nguồn:** "Feedback MKT Hub - Feedback 25_9_2026.pdf" (cột *MKT Feedback lần 2*) và "Feedback MKT Hub - Feedback 26_9_2026.pdf" (T01–T08)

FE đã làm xong giao diện. Tài liệu này chỉ liệt kê phần **BE cần làm thêm**. Chỗ nào BE chưa có, FE đang chạy tạm (mục "FE đang làm tạm") và sẽ bỏ khi BE xong.

Dữ liệu kiểm tra trên production `https://mkt-hub.onrender.com`, tài khoản `a.nguyen@company.com` / `demo123`, ngày 29/09/2026.

| Mức | Mục | Task |
|-----|-----|------|
| **Cao** | §1 Nhiều hồ sơ cho 1 dòng chi phí | 25/09 T02 |
| **Cao** | §2 Ma trận quyền theo tài khoản | 26/09 T06 |
| Trung bình | §3 Tổng thực tế: Ngân sách ≠ Tổng quan | 26/09 T05 |
| Trung bình | §4 CAC / ROAS theo dự án và theo quý | 26/09 T02, T03 |

---

## 1. Nhiều hồ sơ cho 1 dòng chi phí (25/09 T02 lần 2)

Feedback: *"Nhập hồ sơ phần chi phí có thể kéo thả và có thể nhập được nhiều file trong 1 hạng mục."*

**Hiện trạng.** `POST/GET /v1/expenses/lines/{id}/attachment` chỉ giữ **1 file / dòng** (field `file`).

**Yêu cầu.** Làm giống hồ sơ batch kho (`/v1/inventory/batches/{id}/attachments`):

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/expenses/lines/{lineId}/attachments` | → `{ data: Attachment[] }` |
| POST | `/v1/expenses/lines/{lineId}/attachments` | multipart, field **`files`** (nhiều file) → `{ data: Attachment[] }` |
| DELETE | `/v1/expenses/attachments/{id}` | gỡ file khỏi dòng |
| GET | `/v1/expenses/attachments/{id}/file` | stream file, cần Bearer token |

```ts
Attachment = { id, lineId, name, size, mimeType, uploadedBy, uploadedAt }
```

- Mỗi lần "Lưu chi phí" FE tạo **snapshot mới** (bản ghi expense + dòng mới). `POST /v1/expenses/{id}/lines` cần nhận thêm `attachmentIds: string[]` để **gắn lại** các file của dòng cũ vào dòng mới (không copy file).
- Nhận PDF, ảnh, Excel, Word; tối đa 10MB / file; không giới hạn số file / dòng (hoặc ≥ 20).
- File cũ 1-file-một-dòng: trả luôn trong danh sách `attachments` để FE hiển thị chung.

**FE đang làm tạm.**
- File mới được upload vào **hồ sơ dự án** (`POST /v1/projects/{id}/documents`, `category=hoso`).
- Dòng chi phí lưu danh sách id tài liệu trong `attachmentName` dạng `docs:<id>,<id>` và FE chép sang snapshot mới mỗi lần lưu.
- Vì chưa rõ độ dài tối đa của `attachmentName`, FE giới hạn **6 file / dòng** (6 × uuid ≈ 227 ký tự). Nhờ BE cho biết giới hạn cột; nếu là `text` thì FE nâng giới hạn.
- Khi BE xong §1, FE sẽ chuyển các `docs:` hiện có sang endpoint mới (hoặc BE migrate giúp: tách `attachmentName` bắt đầu bằng `docs:`).

---

## 2. Ma trận quyền theo tài khoản (26/09 T06)

Feedback: *"Thêm 1 module cho quyền cao nhất có thể quản lý ma trận quyền của các tài khoản."*

FE đã có tab **Quản lý dữ liệu → Phân quyền** (chỉ quản lý). Hàng = tài khoản, cột = module, mỗi ô chọn 1 mức:

| Mức | Ý nghĩa |
|---|---|
| `edit` | Toàn quyền (mặc định) |
| `view` | Chỉ xem: xem được, **không được** tạo / sửa / xoá |
| `none` | Không truy cập: ẩn khỏi menu, không mở được trang |

Module: `dashboard, projects, tasks, leads, expense, inventory`. *Quản lý dữ liệu* vẫn theo vai trò (chỉ `manager`).

**Yêu cầu.**

| Method | Path | Body / Response |
|---|---|---|
| GET | `/v1/permissions/matrix` | → `{ data: { matrix, updatedAt } }` — mọi user đã đăng nhập đọc được (FE cần để ẩn menu) |
| PUT | `/v1/permissions/matrix` | `{ matrix }` → `{ data: { matrix, updatedAt } }` — **chỉ manager**, khác → 403 |

```ts
matrix = { [userId: string]: { [module: string]: 'none' | 'view' | 'edit' } }
// chỉ lưu ô đặt riêng; ô không có = mặc định của vai trò (hiện tại: edit cho mọi module)
```

- **Áp quyền ở BE:** với module `view`, các request ghi (POST/PUT/PATCH/DELETE) của module đó trả **403**; với `none`, cả GET riêng của module cũng 403, **trừ danh sách đọc dùng chung** bên dưới.

**Map endpoint → module** (theo loại dữ liệu, không chỉ theo prefix URL):

| Module | Endpoint |
|---|---|
| projects | `/v1/projects*` (trừ 2 dòng expense ở hàng dưới) |
| expense | `/v1/expenses*`, `/v1/expense-budgets*`, **`/v1/projects/:id/expense-plan`**, **`/v1/projects/:id/expense-summary`** (dữ liệu chi phí dù nằm dưới `/projects`) |
| tasks | `/v1/tasks*`, `/v1/weekly-reports*` |
| leads | `/v1/leads-kpis*`, `/v1/dashboard/kpi-cards`, `/funnel`, `/pipeline-by-segment` |
| inventory | `/v1/inventory*` |
| dashboard | `/v1/dashboard/overview` |

**Danh sách đọc dùng chung — luôn cho mọi user đã đăng nhập, kể cả `none`** (chỉ GET).

Nhiều màn hình lấy dữ liệu của module khác làm dropdown hoặc để tính số liệu. Nếu chặn các GET này thì các màn hình đó lỗi 403 với tài khoản bị `none`:

| GET | Màn hình khác đang dùng |
|---|---|
| `/v1/projects` (danh sách) | dropdown dự án ở Task, Kanban, Timeline, Báo cáo tuần, Leads & KPIs, Chi phí, Xuất kho |
| `/v1/tasks` | badge Quá hạn / Sắp hạn trên Topbar (poll ở **mọi trang**), Tổng quan |
| `/v1/data-management/members` | dropdown người phụ trách (Task, Kanban, Timeline, Báo cáo tuần, Tạo dự án) |
| `/v1/inventory/items`, `/v1/inventory/items/:id` | chọn vật phẩm ở Nhập chi phí dự án; Tổng quan chi phí |
| `/v1/expenses`, `/v1/expenses/overview` | CAC / ROAS ở Leads & KPIs, Tổng quan; lịch sử xuất kho |
| `/v1/expense-budgets/tree` | Nhập chi phí dự án, form nhập kho (chọn hạng mục) |
| `/v1/leads-kpis/closed-deals`, `/daily-actuals`, `/opportunities` | ROAS / CAC / CPMQL / CPSQL ở Tổng quan chi phí |
| `/v1/data-management/dropdowns*`, `/v1/projects/checklist-templates*`, `/v1/permissions/matrix` | cấu hình dùng chung (dropdown trạng thái, loại dự án, mẫu checklist) |

- Có thể trả bản rút gọn cho user `none` (vd. `/v1/projects` chỉ `id, name, type, isLeadSource`), miễn giữ nguyên tên trường.
- Nghĩa là `none` chặn **màn hình và thao tác** của module, không che hoàn toàn dữ liệu đó ở màn khác. Nếu PO cần che hẳn (vd. user không được thấy bất kỳ con số chi phí nào), cần chốt riêng: FE phải ẩn các ô CAC / ROAS / chi phí ở màn khác và BE trả 403 cho các GET tương ứng.

**Ngoại lệ ghi chéo module (tạm, đến khi xong §1):** file hồ sơ dòng chi phí đang upload qua `POST /v1/projects/:id/documents`. Endpoint này phải cho phép khi user có `edit` ở **projects hoặc expense**, nếu không user chỉ có quyền chi phí sẽ không đính kèm được hồ sơ. Khi xong §1, file chuyển sang `/v1/expenses/...` và bỏ ngoại lệ này.
- Nên trả luôn quyền của user hiện tại trong `GET /auth/me` / response login (`permissions: { [module]: level }`) để FE khỏi gọi riêng.

**FE đang làm tạm.**
- `GET /v1/permissions/matrix` trả 404 → FE lưu ma trận ở `localStorage` (`mkt_permission_matrix`), nên **chỉ áp dụng trên trình duyệt của người cấu hình**. Màn Phân quyền hiện cảnh báo này.
- FE đang chặn `none` (ẩn menu và chặn trang). Với `view`, FE chỉ hiện banner "chế độ chỉ xem"; việc chặn ghi dữ liệu cần BE trả 403 như trên.

---

## 3. Tổng thực tế: tab Ngân sách ≠ tab Tổng quan (26/09 T05)

Feedback: *"Thực tế đã chi và tổng chi phí đang không bằng nhau."*

**Nguyên nhân** (năm 2026):

| | Giá trị |
|---|---|
| Tổng quan — chi phí mọi dòng dự án (snapshot mới nhất, trước VAT) | 726.349.940 |
| Ngân sách — `expense-budgets/tree` cộng `actuals` | 647.030.940 |
| Chênh: dòng dự án **không có `categoryId`** (hạng mục "Vật phẩm" xuất kho cho dự án) | 79.579.000 |
| Batch kho ghi thẳng vào nhóm (QUÀ TẶNG/ IN ẤN): có ở Ngân sách, không có ở Tổng quan | 260.000 |
| `expense-budgets/dashboard.actualSpent` | **726.609.940** (đúng) |

**Quy ước đã chốt:** *Tổng chi phí thực tế = mọi dòng chi phí dự án + batch kho ghi thẳng vào hạng mục* = **726.609.940**.

**Yêu cầu.**
- `expense-budgets/tree`: trả thêm 1 nhóm ảo (hoặc trường `unassigned`) cho dòng dự án không có `categoryId`, gom theo `hangMucLon`, có `actuals` theo tháng: `{ id: null, name: "Vật phẩm", unassigned: true, actuals, actualTotal }`.
- `expenses/overview` / `report`: `actualTotalBeforeVat` theo đúng quy ước trên (xem thêm §1 của BE_requirement_26_09_26 về cộng trùng snapshot).

**FE đang làm tạm.**
- Tab Ngân sách tự thêm dòng "VẬT PHẨM — chi phí dự án chưa gắn nhóm hạng mục" (tính từ `GET /v1/expenses`).
- Tab Tổng quan cộng thêm batch kho ghi vào hạng mục. Hai tab hiện cùng ra 726.609.940.

---

## 4. CAC / ROAS theo dự án và theo quý (26/09 T02, T03)

Feedback: *"CAC nếu lọc theo dự án thì CAC sẽ hiển thị theo CAC của dự án"*, *"Bổ sung trường lọc theo Quý"*.

**Hiện trạng.**
- `kpi-cards` có thẻ `ROAS` nhưng lọc quý trả `0` (vd. `period_type=quarter&period_value=3&year=2026`), và không theo quy tắc chốt ở BE_requirement_26_09_26 §2–3 (chi phí dự án lead, won deal theo `initiationDate`).
- `expenses/overview` chỉ nhận `period=YYYY-MM`, không có `projectId`, không có quý.

**Yêu cầu.** `GET /v1/dashboard/kpi-cards` trả thêm thẻ `CAC` và sửa thẻ `ROAS`, theo `period_type` (week / month / quarter / year) và `projectId`:
- Không lọc dự án: chi phí = dự án `isLeadSource` (hoặc bộ mặc định), won deal toàn hệ thống.
- Lọc 1 dự án: chi phí = chi phí thực tế của dự án đó, won deal của dự án đó.
- Won deal xếp kỳ theo `initiationDate` của opportunity (thiếu thì theo `closedDate`).
- Chi phí xếp kỳ theo `expenseDate` của dòng, snapshot mới nhất, trước VAT.

**FE đang làm tạm.** Leads & KPIs → Xem & phân tích tự tính CAC / ROAS bằng `FE/utils/marketingCostMetrics.js` (cùng code với tab Tổng quan chi phí), nên hai màn hình khớp nhau. Kiểm tra năm 2026: toàn hệ thống CAC = 138.199.215; riêng LEAD GENERATION 2026 CAC = 149.437.000 / 3 = 49.812.333.
