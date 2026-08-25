# Yêu cầu BE bổ sung (23/08/2026)

> Nguồn: bug phát hiện khi FE hoàn thiện tính năng **xem Hợp đồng & Hồ sơ** trong tab Chi tiết Dự án
> (`FE/pages/ProjectDetail.jsx`). FE đã xong phần UI: click tên hồ sơ/hợp đồng trong danh sách
> → mở file ra xem (tab mới). Nhưng hiện **không thể xem được file** vì thiếu URL từ backend.
>
> *Cập nhật 23/08 (buổi 2):* bổ sung **Mục 4 – 5** từ review module Quản lý Chi phí
> (`FE/components/ExpenseManagement/*`).

---

## 1. Document không có URL xem/tải — click tên file không mở được

### 1.1 Hiện trạng

| Điểm | Trạng thái |
|------|-----------|
| `GET /v1/projects/{id}/documents` | Trả list `ProjectDocumentDto` (id, projectId, name, size, mimeType, category, uploadedAt, archivedAt) nhưng **field `url` = null** (hoặc không có) |
| `POST /v1/projects/{id}/documents` (upload) | File được nhận và lưu metadata OK, nhưng response **cũng không trả `url`** |
| Kết quả FE | Có đủ danh sách file, đổi category OK, xoá mềm OK — nhưng click vào file thì **không có gì để mở** |

Bằng chứng phía FE:

- `FE/services/api.js` → `mapDocument()` đã map sẵn `url: d.url || null` — BE trả gì FE nhận nấy,
  hiện luôn rơi vào nhánh `null`.
- `FE/pages/ProjectDetail.jsx` → mỗi dòng hồ sơ là link `<a href={doc.url} target="_blank">`;
  khi `doc.url` null → toast lỗi *"File này chưa có đường dẫn để xem."*

### 1.2 Yêu cầu

Với **mọi response trả ra `ProjectDocumentDto`** (cả GET list lẫn POST upload), bổ sung field:

```
{
  ...,
  "url": "<đường dẫn tuyệt đối, trình duyệt mở trực tiếp được>",
  ...
}
```

### 1.3 Phương án A (khuyến nghị) — URL tĩnh/signed tuyệt đối

- Lưu file vật lý (disk trên Render volume, S3, Cloudinary… tuỳ BE chọn) và trả **URL tuyệt đối**
  (`https://...`) trỏ thẳng tới file.
- Nếu thư mục chứa file nhạy cảm: trả **signed URL có expiry** thay vì URL công khai.
- Ưu tiên loại này vì FE chỉ cần `<a target="_blank">` là xem được mọi loại file
  (PDF/ảnh mở inline; DOCX/XLSX tự tải về).

### 1.4 Phương án B — endpoint stream riêng (nếu không muốn expose file tĩnh)

Thêm endpoint tải file:

```
GET /api/v1/projects/documents/{id}/file
→ 200, trả binary đúng Content-Type của file gốc, Content-Disposition: inline
```

Lưu ý bắt buộc nếu chọn phương án B: phải hỗ trợ **token qua query param** (`?token=<jwt>`)
vì link `<a target="_blank">` của trình duyệt **không gắn được header Authorization**.
Khi đó FE sẽ tự ghép `${API_BASE}/v1/projects/documents/{id}/file?token=...` làm `url`.

### 1.5 Ràng buộc chung (áp dụng cả 2 phương án)

1. `url` phải **tuyệt đối** (có scheme + host), không trả path tương đối kiểu `/uploads/xxx.pdf`.
2. File xoá mềm (`archivedAt != null`) → URL phải hết hiệu lực (404/403).
3. Khai báo đủ field `url` trong Swagger/docs-json (`ProjectDocumentDto`).
4. Không đổi contract các field hiện có (name, size, mimeType, category…) — chỉ **thêm** `url`.
5. File lớn: giới hạn size hợp lý (vd. ≤ 10 MB/file) và validate MIME ở tầng upload như hiện tại.

### 1.6 Test case chấp nhận

- [ ] Upload 1 PDF + 1 ảnh → GET lại list, cả hai bản ghi có `url` tuyệt đối
- [ ] Mở `url` bằng tab ẩn danh (chưa login) theo đúng phương án đã chọn: xem được file (A) hoặc 401/403 rõ ràng (B)
- [ ] Xoá mềm document → `url` trả 404/403, không còn xem được
- [ ] `/api/docs-json` hiển thị `url` trong schema `ProjectDocumentDto`
- [ ] Response POST upload (ngay lần vừa upload) đã chứa `url`, không cần GET lại

---

## 2. `PATCH /v1/tasks/{id}` — `completedDate` chỉ ghi khi status = Done — ✅ ĐÃ ĐÓNG, KHÔNG YÊU CẦU BE SỬA

> FE đã probe trực tiếp production 23/08 (tài khoản `a.nguyen@company.com`) và xác minh hành vi:
>
> | Request | Kết quả |
> |---|---|
> | `PATCH {completedDate}` một mình (status ≠ Done) | 200, field bị bỏ qua |
> | `PATCH {status:"Done", completedDate}` | ✅ Lưu đúng |
> | Rời Done về Processing | completedDate tự xoá |
> | `{dueDate}` / `{startDate}` đứng một mình | ✅ Bình thường |
>
> → Đây là thiết kế có chủ ý của BE (completedDate là hệ quả của status Done).
> **Xử lý phía FE:** popup Thông tin Task hiển thị dòng cảnh báo dưới ô *Hoàn thành* khi task
> chưa ở trạng thái Done: *"Chuyển trạng thái sang 'Hoàn thành' thì ô này mới có hiệu lực."*
> Không còn yêu cầu nào cho backend ở mục này.

---

## 3. `GET /v1/leads-kpis/closed-deals` — KHÔNG lọc `archivedAt`, bản ghi xoá mềm vẫn hiện (ĐÃ XÁC MINH 23/08)

> FE đã thêm lớp filter client-side (`mkt_hub_deleted`) để UI ẩn ngay, nhưng **phải sửa gốc ở BE**
> vì list này còn là nguồn tính số liệu Closed Deal cho Dashboard KPI và Analytics.

### 3.1 Bằng chứng probe trực tiếp production 23/08 (tài khoản `a.nguyen@company.com`)

| # | Thao tác | Kết quả |
|---|----------|---------|
| 1 | `DELETE /v1/leads-kpis/closed-deals/00000006-…-000000000061/delete` ("Indochina Travel", seed chưa từng xoá) | **200 `{success:true}`** |
| 2 | `GET /v1/leads-kpis/closed-deals` sau khi xoá | **Vẫn trả 67 bản ghi**, "Indochina Travel" vẫn nằm trong list ❌ |
| 3 | `DELETE …/{id}/delete` với "BA test", "BA test 2", "dawn" (đã bị xoá mềm từ trước) | **404** *"Không tìm thấy Closed Deal với ID"* |

Kết luận:

- Endpoint `/delete` hoạt động đúng soft-delete và có lookup `archivedAt IS NULL` (mục 3 → 404).
- Nhưng **endpoint GET list không lọc `archivedAt IS NULL`** → bản ghi đã xoá vẫn hiện vĩnh viễn
  trên UI (bảng Closed Deals, popup Tất cả Closed Deal, biểu đồ Analytics) và **vẫn bị đếm vào
  số liệu** won count/value. Mâu thuẫn với convention chung của dự án
  ("mọi query mặc định filter `archivedAt IS NULL"`).

### 3.2 Yêu cầu BE

1. `GET /v1/leads-kpis/closed-deals` bổ sung điều kiện `archivedAt IS NULL`.
2. Rà soát luôn các endpoint Leads & KPIs khác dùng dữ liệu closed deals cho số liệu
   (`dashboard/overview`, `kpi-cards`, comparison, report…) đảm bảo nhất quán loại bản ghi đã xoá mềm.
3. Trả về kèm field `archivedAt` trong response để FE đối chiếu được khi cần.

### 3.3 Test case chấp nhận

- [ ] DELETE một deal (200) → GET list không còn deal đó, total giảm
- [ ] DELETE lần 2 cùng id → 404 (giữ nguyên hành vi hiện tại)
- [ ] KPI card "Closed Deal" ở Dashboard không còn đếm deal đã xoá

### 3.4 Ghi chú dọn dữ liệu test (23/08)

- Seed **"Indochina Travel"** (`00000006-0000-4000-8000-000000000061`) bị FE team xoá mềm trong quá trình
  probe mục 3.1 — BE/DB khôi phục giúp nếu cần demo đầy đủ bộ seed.
- 3 bản ghi rác đã xoá mềm từ trước nhưng vẫn hiện do lỗi mục 3:
  `"BA test"` (`a2818b3e-…`), `"BA test 2"` (`67ff3bc4-…`), `"dawn"` (`5831c096-…`) — sau khi BE fix
  filter thì chúng sẽ tự biến mất khỏi list.
- FE hiện đang che các bản ghi trên bằng filter client-side, nên trước mắt UI đã đúng.

---

## 4. Chi phí dự án (`/v1/expenses`) — chi tiết từng dòng bị serialize vào `directNotes` dạng text

> Nguồn: review module Quản lý Chi phí 23/08. FE đã vá tạm bằng encode/parse text (xem
> "Ghi chú phía FE" cuối file) nhưng đây là **dữ liệu có cấu trúc đang lưu ở nơi không có
> cấu trúc** → cần sửa gốc ở BE.

### 4.1 Hiện trạng

| Điểm | Trạng thái |
|------|-----------|
| Model | Chỉ có **1 bản ghi chi phí** cho mỗi tổ hợp (projectId + year/month), không có bảng con cho từng dòng chi phí |
| `directNotes` | FE phải nhét toàn bộ chi tiết dòng vào text: `1. Sự kiện: X \| Kế hoạch: Y \| Thực tế: Z \| SL: Q \| ghi chú ; 2. …` rồi tự parse ngược bằng regex để hiển thị tab Ngân sách |
| `POST /v1/expenses` trùng (project, kỳ) | Trước đây 500 — **BE đã fix upsert 22/8/26** (`BE-fix-22-8-26.md` mục 2, PASS); FE vẫn giữ phòng ngừa tra-cứu-then-PATCH |
| Sửa / xóa từng dòng | Không thể — bỏ 1 dòng buộc phải PATCH lại toàn bộ chuỗi `directNotes` |

Hệ quả thực tế:

- User gõ ký tự `|`, `;` hoặc đầu dòng giống `"Kế hoạch: ..."` vào ghi chú → parse hỏng → số liệu tab Ngân sách sai.
- BE không tổng hợp được theo dòng/hạng mục; `overview`/`report` chỉ dựa trên `directCost` tổng.
- Format text do FE tự định nghĩa → client khác (mobile, BI) không đọc được cấu trúc dòng.

### 4.2 Yêu cầu chính (Phương án A — khuyến nghị): bảng con `expense_lines`

Bổ sung bảng con và expose trong DTO:

```
ExpenseLineDto {
  id, expenseId,
  name             // tên sự kiện / hạng mục
  plannedAmount    // chi phí kế hoạch của dòng
  actualUnitPrice  // đơn giá thực tế của dòng
  quantity         // số lượng, mặc định 1
  note, sortOrder, archivedAt
}

GET    /v1/expenses                  → mỗi item trả kèm lines[] (hoặc bổ sung GET /v1/expenses/{id})
POST   /v1/expenses/{id}/lines
PATCH  /v1/expenses/lines/{id}
DELETE /v1/expenses/lines/{id}       // soft-delete; mọi query đọc đều filter archivedAt IS NULL
```

Ràng buộc:

1. `directCost` = Σ(`actualUnitPrice` × `quantity`) — BE là nguồn tính chuẩn (FE vẫn gửi kèm trong giai đoạn chuyển tiếp).
2. Không đổi contract các field hiện có (`month`, `year`, `directCost`, `overheadCost`, `directNotes`…) — chỉ **thêm** `lines`.
3. Khai báo đủ schema trong Swagger/docs-json.

*Phương án B (tối thiểu nếu chưa làm được bảng con):* thêm cột JSON `lines` vào bản ghi expense và trả về nguyên vẹn trong GET — vẫn giải quyết được parse hỏng do text tự do.

### 4.3 Yêu cầu bắt buộc kèm theo (áp dụng cả khi chưa làm bảng con)

1. **Giữ nguyên upsert đã fix** (22/8/26): `POST /v1/expenses` trùng (projectId, year, month) phải tiếp tục trả 201 + cập nhật bản ghi cũ — đưa vào regression test.
2. **Soft-delete nhất quán** (cùng pattern lỗi đã xác minh ở Mục 3 với closed-deals): xác minh `DELETE /v1/expenses/{id}` hoạt động soft-delete, và đảm bảo `GET /v1/expenses`, `/v1/expenses/overview`, `/v1/expenses/report` đều **loại `archivedAt IS NULL`** — nếu không tổng tiền sẽ cộng cả bản ghi đã xóa.

### 4.4 Test case chấp nhận

- [ ] GET list trả `lines[]` đúng `sortOrder`; line đã xóa mềm không xuất hiện
- [ ] POST trùng (project, kỳ) vẫn 201 upsert (regression — đã fix 22/8)
- [ ] Xóa mềm 1 line → `directCost` bản ghi cha giảm đúng Σ(unit × qty)
- [ ] DELETE expense → list + overview + report đều không còn tính bản ghi đó

---

## 5. File hợp đồng của dòng chi phí — hiện chỉ nằm trong localStorage máy người nhập

### 5.1 Hiện trạng

- Form Nhập chi phí cho đính kèm hợp đồng **theo từng dòng**, nhưng BE không có field lưu file → FE phải lưu base64 vào localStorage (~≤ 1,5 MB/file): quá quota thì **mất im lặng**, và máy/browser khác không bao giờ thấy file.
- Đây đúng cơ chế đã yêu cầu BE bổ sung ở **Mục 1** cho Project Document — cần tái sử dụng cho chi phí.

### 5.2 Yêu cầu

Đính kèm file theo dòng chi phí, ưu tiên Phương án A ở Mục 1 (URL tĩnh/signed tuyệt đối):

- Nếu làm bảng con `expense_lines` (Mục 4): thêm `attachmentId` + `url` vào `ExpenseLineDto`, endpoint upload kiểu `POST /v1/expenses/lines/{id}/attachments`.
- Nếu chưa có bảng con: tối thiểu attachment cấp bản ghi expense (`POST /v1/expenses/{id}/attachments`) + GET trả kèm danh sách `{name, url}`.

### 5.3 Test case chấp nhận

- [ ] Upload hợp đồng từ máy A → máy B GET lại expense thấy `url` và mở được file
- [ ] Xóa mềm expense/line → `url` hết hiệu lực (404/403)

---

## Checklist cho backend

- [x] Mục 1 — bổ sung `url` (tuyệt đối/signed) vào `ProjectDocumentDto` cho GET list + POST upload
      *(Đã xong — verify 23/8: `url` là field REQUIRED, live upload trả URL tuyệt đối
      `https://mkt-hub.onrender.com/api/v1/projects/documents/{id}/file`; FE dùng Phương án A)*
- [ ] ~~Xác nhận phương án lựa chọn để FE khoá cách hiển thị~~ (đóng — chọn A)
- [x] Mục 3 — `GET /v1/leads-kpis/closed-deals` filter `archivedAt IS NULL`; rà số liệu KPI/analytics
      không còn đếm deal đã xoá
      *(Đã xong — verify 23/8: deal vừa soft-delete không còn xuất hiện trong list)*
      - [ ] Khôi phục seed "Indochina Travel": record OPP hiện bị hỏng tên
            `"Indochina Travelm/m;?n;"` — cần sửa lại dữ liệu này
- [ ] Mục 4 — bảng con `expense_lines`: schema + CRUD đã có (`POST /expenses/{id}/lines`,
      PATCH/DELETE `/expenses/lines/{id}`, GET list trả `lines[]`) nhưng bản ghi CŨ vẫn
      `lines: []`. Theo spec không cần migrate gấp (FE fallback parse `directNotes`);
      khi nào migrate xong báo FE để FE ưu tiên đọc `e.lines[]`
- [ ] Mục 5 — attachment hợp đồng: endpoint `/expenses/lines/{id}/attachments` đã khai báo trong
      swagger; chưa test live được vì các line hiện rỗng (phụ thuộc populate Mục 4)
- [ ] Regen swagger docs: bundle `swagger-ui-init.js` cũ, chưa phản ánh `metrics.roas/cac`
      của `/v1/expenses/overview`
- [x] Mục 8 — `GET /v1/expenses/overview` trả thêm `metrics.roas / cac / totalWonValue`
      (BE đã làm 23/8; FE đã ưu tiên đọc, fallback giữ nguyên)

> Mục 2, 6, 7 đã đóng — Mục 2 xử lý bằng cảnh báo UI phía FE; Mục 6–7 BE đã làm xong
> (đã verify bằng smoke test 23/8).

---

## Ghi chú phía FE (đã xong, không cần BE động đến)

- Click tên hồ sơ/hợp đồng trong card "Hợp đồng & Hồ sơ" (Chi tiết Dự án) → mở `doc.url` tab mới;
  `url` null → toast báo lỗi thay vì mở trang trắng.
- Đã bỏ nút mũi tên góc phải card "Hợp đồng & Hồ sơ".
- Khi BE trả `url` xong, FE **không cần sửa code thêm** — dữ liệu mới tự hiển thị xem được.
- Chi phí: FE đã tự vá tạm cho đến khi BE làm Mục 4–5:
  - Encode/parse chi tiết dòng trong `directNotes` (kèm "Thực tế:" = đơn giá từng dòng) và
    tra cứu trước khi POST để tránh lỗi 500 trùng kỳ (`ExpenseEntryForm.jsx`, `utils/expenseMeta.js`).
  - Xóa dòng không còn gọi DELETE cả bản ghi — chỉ bỏ local rồi PATCH lại note (tránh mất cả kỳ).
  - Khi BE trả `lines[]` theo Mục 4, FE sẽ chuyển sang đọc ghi theo line API; format text hiện tại
    chỉ là fallback cho bản ghi cũ nên BE không phải migrate dữ liệu gấp.

---

## Mục 6 — Kiểm tra logic đếm OPP (theo thời điểm nhập hay theo kỳ khởi tạo dự án)

Kết quả kiểm tra phía FE (23/8):

- `POST /v1/leads-kpis/opportunities` **không gửi kèm trường kỳ/ngày nhập** — payload chỉ có
  `companyName, size, projectId, setupFee, expectedCloseDate` (`api.js` → `addOpportunity`).
  Nghĩa là BE phải tự gắn `createdAt` khi tạo → OPP được tính theo **thời điểm nhập**, không phụ thuộc
  kỳ khởi tạo dự án.
- Việc gom số theo kỳ nằm hoàn toàn ở BE: `/v1/dashboard/kpi-cards?period_type&period_value&year`
  và `/v1/dashboard/funnel` — FE không tự group OPP ở client.
- Closed Deal thì khác: `POST /v1/leads-kpis/opportunities/{id}/won` gửi kèm `signedDate` do người
  dùng chọn (mặc định hôm nay) → deal được đếm theo **ngày ký** (có thể backdate về kỳ trước).

Cần BE xác nhận (FE không kiểm chứng được vì không có mã BE):

- [x] `/v1/dashboard/kpi-cards` group OPP theo `createdAt` của opportunity (thời điểm nhập), KHÔNG
      theo `createdAt`/kỳ của project.
      *(Xác nhận một phần qua smoke test 23/8: POST tạo OPP được BE tự gắn `year`/`week` theo thời
      điểm tạo (2026-W34) — tức OPP thuộc kỳ NHẬP, không liên quan kỳ khởi tạo project)*
- [x] Khi OPP chuyển Won, nó bị loại khỏi count "OPP" của kỳ nhập (đổi trạng thái) và sang count
      "Closed Deal" của kỳ theo `signedDate`.
      *(Smoke test 23/8: sau Won, OPP rời danh sách active với `status: won`, Closed Deal mới mang
      `closedDate` = `signedDate` gửi lên)*

> Smoke test 23/8 (tài khoản a.nguyen@company.com): GET/POST/PATCH opportunity + POST /won +
> GET closed-deals — `contractName` persist, PATCH cập nhật đúng, Won copy `contractName` sang
> Closed Deal. Dữ liệu test đã xóa mềm.

---

## Mục 7 — Trường `contractName` cho Opportunity / Closed Deal

FE đã thêm cột "Hợp đồng" (tên hợp đồng do người dùng điền) vào bảng Chi tiết Opportunities và
gửi field này trong các payload sau:

- `POST /v1/leads-kpis/opportunities` → `contractName`
- `PATCH /v1/leads-kpis/opportunities/{id}` → `contractName`
- `POST /v1/leads-kpis/opportunities/{id}/won` → `contractName` (kèm `signedDate`)

Cần BE:

- [x] Thêm cột `contract_name` (string, nullable) cho bảng Opportunity; nhận + lưu ở 3 endpoint trên;
      GET list/detail trả lại `contractName`. *(Đã có — xác nhận qua swagger 23/8: `contractName`
      xuất hiện trong `OpportunityDto`, `CreateOpportunityDto`, `UpdateOpportunityDto`,
      `MarkOpportunityWonDto`, `ClosedDealDto`, `UpdateClosedDealDto`)*
- [x] Khi chuyển Won, copy `contractName` sang Closed Deal (trường `contract`/`contract_name`) để
      bảng Chi tiết Closed Deal hiển thị đúng tên hợp đồng thay vì fallback tên dự án.
      *(FE đã gửi `contractName` trong payload Won; cần smoke test trên UI để xác nhận dữ liệu chảy đúng)*

---

## Mục 8 — BE tự tính ROAS / CAC (hiện FE đang tự nhân chia ở client)

### 8.1 Vấn đề hiện tại

- FE tính `ROAS = wonValue / totalExpense` và `CAC = totalExpense / wonCount` ngay trên client
  (`api.js` → transform dashboard):
  - `totalExpense` lấy từ `GET /v1/expenses/overview` → `metrics.totalExpense`;
  - `wonValue`/`wonCount` lấy bằng cách **tải toàn bộ danh sách** `GET /v1/leads-kpis/closed-deals`
    về rồi lọc theo `closedDate` thuộc period ở client, cộng `setupFee`.
- Hệ quả: payload phình theo số deal; quy tắc "giá trị deal = setupFee hay cả monthlyFee" do FE
  tự quyết; nếu sau này có client thứ hai/báo cáo server-side thì số liệu dễ lệch nhau.

### 8.2 Đề xuất cho BE

Mở rộng response của `GET /v1/expenses/overview` (endpoint đã có sẵn `metrics.totalExpense`),
bổ sung vào object `metrics`:

| Field | Kiểu | Định nghĩa |
|---|---|---|
| `wonCount` | number | Số Closed Deal có `closedDate` nằm trong period đang truy vấn |
| `wonValue` | number | Tổng giá trị deal cùng kỳ — **BE chốt công thức** (đề nghị: `setupFee`; nếu dùng `dealValue` = setupFee + monthlyFee thì ghi rõ trong swagger example/description) |
| `roas` | number \| null | `wonValue / totalExpense`; `null` nếu `totalExpense <= 0` hoặc kỳ không có deal |
| `cac` | number \| null | `totalExpense / wonCount`; `null` nếu `wonCount = 0` |

Lưu ý:

- Định nghĩa "period" của expenses overview hiện tại (year/month?) phải áp dụng **cùng một cách**
  cho việc lọc `closedDate` của deal.
- Nếu dashboard kpi-cards có card "Won", `metrics.wonValue` phải khớp với actual của card đó
  (một nguồn sự thật).

Cần BE:

- [x] Bổ sung metrics ROAS/CAC vào `GET /v1/expenses/overview`. *(Đã có 23/8 — live check:
      `metrics` trả `roas`, `cac`, `totalWonValue`, kèm thêm `ltv`, `ltvCacRatio`, `newCustomers`,
      `averageSetupFee/MonthlyFee`, `effectiveChurnRate/GrossMargin`, `health`. Lưu ý khác đề xuất
      gốc: tên field là `totalWonValue` (không phải `wonValue`) và **không có `wonCount`** — FE
      không cần vì đã nhận `cac` tính sẵn)*
- [x] Ghi rõ công thức `wonValue` được chọn (setupFee hay dealValue).
      *(Verify bằng số thật period=2026: roas = 1431.82 = totalWonValue 1.750.000.000 /
      totalExpense 1.222.221; cac = 111111 = totalExpense / 11 — tức wonValue dùng tổng giá trị
      deal, mẫu số CAC là 11 khách hàng. FE đã ưu tiên đọc `metrics.roas/cac`, fallback tự tính
      khi field vắng mặt — build pass)*

### 8.3 Phía FE (đã chuẩn bị sẵn)

- FE sẽ **ưu tiên** `metrics.roas` / `metrics.cac` từ BE; nếu field chưa có thì giữ nguyên fallback
  tự tính như hiện tại → hai bên deploy theo thứ tự nào cũng không vỡ.
- Sau khi BE trả đủ, FE gỡ đoạn tải list closed-deals phục vụ tính ROAS/CAC (giảm 1 request lớn).

### 8.4 Test case chấp nhận

- [ ] Kỳ có chi phí, chưa có deal → `roas = null`, `cac = null`, FE hiển thị "—".
- [ ] Kỳ có 2 deal (setupFee 100 + 200), `totalExpense = 150` → `roas = 2`, `cac = 75`.
- [ ] Deal ký ngày cuối kỳ (backdate qua Won) vẫn đếm vào đúng kỳ theo `closedDate`.
- [ ] `metrics.wonValue` khớp card "Won" của `/v1/dashboard/kpi-cards` (nếu card tồn tại).

---

# VIỆC CẦN BE XỬ LÝ TIẾP — tổng hợp 23/8 (bản gửi BE)

> 3 việc còn lại sau buổi verify toàn bộ API ngày 23/8. Mục 1, 3 (filter), 6, 7, 8 đã xong —
> xem checklist phía trên để biết chi tiết trạng thái.

---

## Việc 1 🔧 — Sửa dữ liệu OPP bị hỏng tên "Indochina Travel"

### Hiện trạng (bằng chứng thật từ GET /v1/leads-kpis/opportunities, 23/8)

```json
{
  "id": "00000005-0000-4000-8000-000000000101",
  "companyName": "Indochina Travelm/m;?n;",
  "projectId": "bad6cd9f-b7b7-4a84-97ad-ab5d542bcc6f",
  "setupFee": 60000000
}
```

Tên seed gốc phải là **"Indochina Travel"**. Đuôi `m/m;?n;` là rác do lỗi encoding khi
seed/restore dữ liệu. Đây chính là seed mà Mục 3 yêu cầu khôi phục.

### Việc cần làm

1. `UPDATE` opportunity id trên về `companyName = 'Indochina Travel'`
   (nếu bản ghi này đã Won thì sửa cả Closed Deal tương ứng qua `opportunityId`).
2. Rà quét toàn bảng `opportunities` + `closed_deals` tìm các record chứa ký tự lạ
   (`;?`, chuỗi mojibake kiểu `m/m;?n;`) và liệt kê để FE xác nhận tên đúng trước khi sửa.
3. Kiểm tra script seed: đảm bảo file seed đọc/ghi chuẩn UTF-8 (đây khả năng cao là nguyên nhân),
   tránh lần seed sau bị lặp lại.

### Tiêu chí chấp nhận

- [ ] GET list hiển thị đúng "Indochina Travel", không còn ký tự rác.
- [ ] Script seed chạy lại không sinh thêm tên hỏng.

---

## Việc 2 📦 — Populate `lines[]` cho các bản ghi expense CŨ

### Hiện trạng

- Schema + CRUD đã sẵn sàng ✅: `POST /v1/expenses/{id}/lines`,
  `PATCH|DELETE /v1/expenses/lines/{id}`, GET list trả kèm `lines[]`.
- Nhưng mọi bản ghi cũ trả `lines: []` trong khi chi tiết nằm trong `directNotes`. Ví dụ thật:

```json
{
  "id": "98be3ee7-db7c-46b6-93c9-ff7059aac803",
  "projectId": "d2e15645-0adb-4986-b6a9-eb02800dade9",
  "month": 8, "year": 2026,
  "directCost": 1222221,
  "directNotes": "1. Sự kiện: giới thiệu | Kế hoạch: 111.111 ; 2. Sự kiện: mua | Kế hoạch: 999.999",
  "lines": []
}
```

### Việc cần làm — script migrate one-off

Parse `directNotes` theo đúng format FE đang ghi, tạo line tương ứng cho từng dòng:

- **Format note**: các dòng cách nhau bởi `" ; "`; mỗi dòng là `"Sự kiện: X | Kế hoạch: Y | Thực tế: Z | SL: Q | ghi chú"`.
  Có thể có prefix số thứ tự `"1. "`; segment `Thực tế:`/`SL:` chỉ có ở bản ghi lưu sau 22/8.
- **Số**: định dạng VN, dấu chấm là phân cách nghìn (`111.111` = một trăm mười một nghìn) → bỏ dấu `.` khi parse.
- **Mapping sang line**:
  - `event` ← Sự kiện
  - `plannedCost` ← Kế hoạch
  - `amount` (thành tiền):
    - note có `SL: Q` → `Thực tế: Z` là ĐƠN GIÁ ⇒ `amount = Z × Q`
    - note KHÔNG có `SL` → `Thực tế: Z` đã là THÀNH TIỀN ⇒ `amount = Z`
    - không có `Thực tế:` → amount = plannedCost hoặc 0 (báo lại danh sách record rơi vào trường hợp này)
  - phần text cuối không có prefix `Xxx:` → `note`

### Ràng buộc & tiêu chí chấp nhận

- [ ] Sau migrate: tổng `Σ lines[].amount = directCost` (không đổi tổng), `directNotes` GIỮ NGUYÊN
      (FE vẫn fallback parse note khi `lines[]` rỗng).
- [ ] GET `/v1/expenses?year=2026` trả `lines[]` khớp nội dung từng dòng của note.
- [ ] Chạy dry-run trước, xuất báo cáo số record sẽ migrate / record parse lỗi để FE review.
- ⚠️ Không gấp — FE hiện chưa vỡ gì. **Khi migrate xong báo FE** để FE chuyển sang ưu tiên đọc
  `e.lines[]` thay vì parse note.

---

## Việc 3 📄 — Regen swagger docs (bundle đang cũ)

### Hiện trạng

- Bundle `GET /api/docs/swagger-ui-init.js` hiện tại đã có `contractName` (Mục 7) nhưng **chưa**
  phản ánh metrics mới của `/v1/expenses/overview`: thiếu `metrics.roas`, `metrics.cac`,
  `metrics.totalWonValue`, `ltv`, `ltvCacRatio`, `health`... (deploy Mục 8 ngày 23/8).

### Việc cần làm

- [ ] Regen/rebuild OpenAPI docs rồi deploy lại cùng service.
- [ ] Bổ sung `description` cho `metrics.roas`/`metrics.cac` ghi rõ công thức đã chốt:
      `roas = totalWonValue / totalExpense`, `cac = totalExpense / số khách hàng mới`
      (verify bằng số thật 23/8: roas 1431.82 = 1.750.000.000 / 1.222.221; cac 111111 = 1222221 / 11).

### Tiêu chí chấp nhận

- [ ] `curl https://mkt-hub.onrender.com/api/docs/swagger-ui-init.js` chứa chuỗi `"roas"` và `"totalWonValue"`.

---

# Mục 9 — Checklist Templates khi tạo dự án (23/08/2026) — ✅ BE ĐÃ XONG, FE ĐÃ TÍCH HỢP

## API BE đã cung cấp

### `GET /v1/projects/checklist-templates`

Trả về `{ templates: [...], stakeholderOptions: [{code, label}] }` (stakeholderOptions nằm ở **root**, không trong từng template).

- 5 mẫu: `exhibition` (59 việc, lead 75 ngày), `workshop_partner` (30/45), `workshop_tai_tro` (30/30),
  `workshop_smartlog` (33/60), `webinar` (36/45). `totalTasks` khớp tuyệt đối `tasks.length`.
- Mỗi template: `key, name, appliesToTypes (có cả variant hoa/thường), leadTimeDays, totalTasks, tasks[]`.
- Mỗi task: `group, name, description (thường rỗng), priority (High/Medium/Low), stakeholders (thường rỗng),
  daysBeforeDeadline, startOffset, endOffset ("T-75 ngày")`.

### `POST /v1/projects` — mở rộng payload

| type gửi lên | applyTemplate | templateType | Hành vi BE | createdTasksCount |
|---|---|---|---|---|
| Bất kỳ | false / không gửi | bất kỳ | Tạo dự án trống, không sinh task | 0 / không có |
| Exhibition/Workshop/Webinar/Event | true | cụ thể | Sinh đúng N task trong 1 transaction | N |
| Workshop... | true | **không gửi** | Fallback tự chọn template theo type | N |
| Internal/Client/Research... | true | bất kỳ | **400 Bad Request** "Checklist template chỉ áp dụng cho Workshop, Event, Exhibition hoặc Webinar" — KHÔNG tạo dự án | — |

## Đã verify live 23/8 (tài khoản a.nguyen@company.com, dữ liệu test đã xóa sạch)

- [x] A: Exhibition + `applyTemplate:true, templateType:"exhibition"` → sinh đúng **59 task**, tất cả có dueDate,
      nằm trong khoảng [hôm nay, hạn chót] (auto-clamp hoạt động).
- [x] B: Internal + applyTemplate → **HTTP 400** kèm thông báo tiếng Việt như bảng trên, không tạo dự án rác.
- [x] C: KHÔNG gửi applyTemplate → **0 task** — fallback KHÔNG tự chạy khi thiếu cờ (đúng cam kết của BE).
- ⚠️ Ghi chú: công thức scale T-minus thực tế của BE cho giá trị lớn hơn công thức đã trao đổi
  (vd task daysBeforeDeadline=60/lead 75 với deadline cách ~130 ngày → thực tế T-110 thay vì T-104).
  Không ảnh hưởng FE (FE không tự tính dueDate nữa, chỉ hiển thị preview offset từ template).
  BE có thể xem lại nếu muốn đúng công thức `round(daysBefore/lead × tổngSốNgàyKhảDụng)`.

## Phía FE (đã làm xong 23/8)

- `api.js`: thêm `getChecklistTemplates()` (chuẩn hóa shape `{templates, stakeholderOptions}`), export vào default object.
- `CreateProjectForm.jsx`:
  - Xóa hẳn `PROJECT_TEMPLATES` hardcode + vòng `Promise.all(createTask...)` phía client (nguồn lỗi mất task khi
    1 request fail, không rollback).
  - Fetch templates 1 lần khi mở form create (cache module-level); lọc dropdown theo `appliesToTypes` khớp loại dự án;
    luôn có option "Không dùng mẫu checklist".
  - Label option: `Tên mẫu — N việc (T-X)`; nút **Xem trước mẫu** mở modal nhóm theo `group`, hiển thị priority chip,
    khoảng `startOffset – endOffset`, stakeholders map qua `stakeholderOptions`.
  - Submit: chọn mẫu → payload thêm `applyTemplate:true, templateType:key`; toast thành công hiển thị số task sinh ra
    (`createdTasksCount`). Lỗi 400 của BE hiển thị nguyên văn cho user.
  - GET templates lỗi → ẩn khu chọn mẫu, vẫn tạo dự án bình thường.
- Build pass.




