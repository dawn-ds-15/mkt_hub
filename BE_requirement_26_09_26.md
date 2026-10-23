# Yêu cầu BE — 26/09/2026 (Feedback MKT Hub 25/09/2026, T01–T15)

**Người gửi:** FE Team
**Nguồn:** file "Feedback MKT Hub - 25_9_2026.pdf" (15 task, deadline 26/09 – 28/09)

FE đã làm xong phần giao diện của cả 15 task. Tài liệu này chỉ liệt kê phần **BE cần làm thêm**. Ở những chỗ BE chưa có, FE đang chạy tạm bằng cách tự tính hoặc lưu `localStorage` (mục "FE đang làm tạm"). Khi BE xong, FE sẽ bỏ phần tạm đó.

Dữ liệu kiểm tra trên production `https://mkt-hub.onrender.com`, tài khoản `a.nguyen@company.com` / `demo123`, ngày 26/09/2026.

| Mức | Mục | Task |
|-----|-----|------|
| **Cao** | §1 Số liệu tổng quan chi phí bị cộng trùng snapshot | T05, T06 |
| **Cao** | §2 Cấu hình "dự án mang lại lead" dùng chung | T06 |
| **Cao** | §3 Won deal trả về `initiationDate` của opportunity | T06 |
| **Cao** | §4 Batch kho ghi thẳng vào hạng mục ngân sách | T03 |
| **Cao** | §5 Hồ sơ đính kèm cho batch kho | T07 |
| **Cao** | §6 Mã batch không được trùng | T07 |
| Trung bình | §7 Hồ sơ dòng chi phí khi chép sang snapshot mới | T02 |
| Trung bình | §8 Dọn nhóm hạng mục "Ăn uống", "Vận chuyển" | T01, T03 |
| Thấp | §9 Các mục tuỳ chọn (lọc kho, ROAS card, timezone, tổng hợp theo dự án) | T09–T12, T15 |

---

## 1. `/v1/expenses/overview` và `/v1/expenses/report` cộng trùng các snapshot (T05, T06)

**Hiện trạng.** Mỗi lần bấm "Lưu chi phí" ở *Nhập chi phí dự án*, FE tạo một bản ghi `expense` mới. Bản ghi này là **snapshot chứa toàn bộ dòng** của dự án (bản ghi cũ giữ nguyên để xem lịch sử). Vì vậy tổng thực tế đúng chỉ tính trên **snapshot mới nhất (có dòng) của mỗi dự án**, lọc theo `expenseDate` của từng dòng.

BE đang cộng dòng của mọi snapshot:

| Năm 2026 | BE `overview.metrics` | Đúng (snapshot mới nhất, trước VAT) |
|---|---|---|
| Tổng chi phí thực tế (trước VAT) | `actualTotalBeforeVat` = **947.797.199** | **726.349.940** |
| Ví dụ YEAR END PARTY 2025 | 9 snapshot | chỉ snapshot mới nhất: 80.688.000 |

Ngoài ra `projects[].actualTotal` / `budgetTotal` đang trả **0** cho mọi dự án, còn `metrics.roas` / `metrics.cac` tính trên tổng bị trùng.

**Yêu cầu.**
- Tính mọi tổng chi phí thực tế và kế hoạch theo quy tắc snapshot mới nhất. Áp dụng cho `overview`, `report` và `expense-budgets/tree`: `actuals` của tree hiện toàn 0 dù có dòng gắn `categoryId`.
- Quy ước tiền **trước VAT**, khớp cột "Thành tiền KH/TT" ở màn nhập:
  - dòng thường = `unitPriceBeforeVat × quantity`;
  - dòng nhập thẳng thành tiền = `plannedAmount` / `actualAmount`.
- Tính ROAS / CAC theo §2, §3.

**FE đang làm tạm.** `FE/utils/marketingCostMetrics.js` tự tính từ `GET /v1/expenses` (tab Tổng quan). Tab Ngân sách cũng đã đổi sang chỉ lấy snapshot mới nhất.

---

## 2. Cấu hình dùng chung: dự án tính chỉ số lead (T06)

Feedback: *"Tổng chi phí dùng để tính sẽ được chọn từ các dự án trực tiếp mang lại lead (cần được tùy chọn)"*.

**Công thức đã chốt:**

| Chỉ số | Công thức |
|---|---|
| CPMQL | Chi phí lead / số MQL trong kỳ |
| CPSQL | Chi phí lead / số SQL trong kỳ |
| ROAS | Tổng giá trị won deal / Chi phí lead |
| CAC | Chi phí lead / số won deal |

- **Chi phí lead** = tổng chi phí thực tế (trước VAT, §1) của các dự án được đánh dấu "mang lại lead".
- **Won deal thuộc kỳ** theo `initiationDate` của opportunity nguồn (§3), không theo ngày ký.
- MQL / SQL lấy từ daily-actuals của toàn hệ thống trong kỳ.

**Yêu cầu.** Thêm trường `isLeadSource: boolean` (mặc định `false`) vào project:
- `CreateProjectDto`, `UpdateProjectDto`, và `GET /v1/projects`, `GET /v1/projects/{id}` trả về trường này;
- chỉ manager được sửa.

*(Phương án khác nếu không muốn sửa bảng project: thêm key mới cho `/v1/expenses/system-configs`. Hiện `SaveSystemConfigDto.key` là enum chỉ có `churn_rate | gross_margin`, và `value` chỉ nhận số, nên không lưu được danh sách id.)*

**Tuỳ chọn.** `GET /v1/expenses/overview?period=` trả thêm `leadCost, mql, sql, wonCount, wonValue, roas, cac, cpmql, cpsql` tính theo đúng các quy tắc trên.

**FE đang làm tạm.**
- Lựa chọn lưu ở `localStorage` (`mkt_lead_cost_projects`), nên **mỗi trình duyệt một cấu hình**.
- Mặc định chọn các dự án có Raw Leads, opportunity hoặc won deal. Hiện có 6 dự án: LEAD GENERATION 2026, VWAS 2026 - BÌNH DƯƠNG, VILOG 2026, INNOEX 2026, ACCOUNT CENTRIC - LEAD 2022-2025, SMARTLOG X FCI.

---

## 3. Won deal phải có ngày bắt đầu opportunity (T06)

`GET /v1/leads-kpis/closed-deals` hiện trả `closedDate, year, week, dealValue…` nhưng **không có `initiationDate`**. Cả 7 deal năm 2026 đều thiếu. Các deal này được import trực tiếp nên cũng không khớp được với opportunity nào: `/opportunities` có 38 bản ghi, tất cả `active`.

**Yêu cầu.**
- Closed deal trả thêm `initiationDate` (YYYY-MM-DD) và `opportunityId` (nếu có).
  - `POST /opportunities/{id}/won`: chép `initiationDate` từ opportunity sang deal.
  - Import won deal (`/data-management/import`, `prior-year-deals`): nhận thêm cột "Ngày bắt đầu".
  - `PUT /closed-deals/{id}`: cho sửa `initiationDate`.
- Nếu có thể, bổ sung `initiationDate` cho 7 deal 2026 hiện có.

**FE đang làm tạm.** Deal thiếu `initiationDate` được xếp kỳ theo `closedDate`. Tab Tổng quan hiện cảnh báo "7 won deal chưa có ngày bắt đầu opportunity".

---

## 4. Batch kho ghi thẳng vào hạng mục ngân sách (T03)

Feedback: *"Chi phí kho vật phẩm: thêm một hạng mục chọn ghi vào hạng mục chi phí. Vì có một số chi phí chung không thể chia ra cho dự án nên sẽ cần ghi nhận trực tiếp vào hạng mục ngân sách."*

Form nhập kho đã có ô chọn tuỳ chọn "Ghi vào hạng mục chi phí", lấy danh sách nhóm cấp 1 từ `expense-budgets/tree` của năm nhập. FE gửi 2 trường (chỉ khi người dùng có chọn, hoặc `null` khi bỏ chọn lúc sửa):

```json
{ "expenseCategoryId": "<uuid nhóm hạng mục>", "expenseCategoryName": "EVENT" }
```

**Yêu cầu.**
- Nhận 2 trường trên ở:
  - `POST /v1/inventory/items` (batch đầu tiên);
  - `POST /v1/inventory/items/{id}/batches`;
  - `POST /v1/inventory/entries`;
  - `PATCH /v1/inventory/batches/{id}` (`null` = xoá liên kết).
- Trả về 2 trường này trong `InventoryBatchDto`, gồm cả batch lồng trong `GET /v1/inventory/items`.
- Cộng giá trị nhập của batch vào **thực tế** của nhóm hạng mục đó trong `expense-budgets/tree`, `dashboard`, `summary`:
  - giá trị = `quantityIn × unitPriceBeforeVat` (trước VAT);
  - tháng = tháng của `receivedDate`.
- Không cộng batch này vào chi phí dự án. Dòng "Vật phẩm" của dự án không có `categoryId` nên không bị tính trùng.

**FE đang làm tạm.**
- Nếu BE trả 400 báo "property expenseCategoryId should not exist", FE gửi lại request **không kèm** 2 trường và lưu liên kết batch → nhóm vào `localStorage` (`mkt_batch_expense_category`).
- Tab Ngân sách tự cộng giá trị các batch này (`FE/utils/inventoryBudgetCategory.js`).

---

## 5. Hồ sơ liên quan cho batch kho (T07)

Hiện chưa có endpoint: `GET /v1/inventory/batches/{id}/attachments` trả **404**. FE đã làm sẵn theo contract dưới đây (giống project documents). Khi gặp 404/405/501, FE báo "BE chưa hỗ trợ" và khoá nút upload.

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/inventory/batches/{batchId}/attachments` | → `{ data: Attachment[] }` |
| POST | `/v1/inventory/batches/{batchId}/attachments` | multipart, field **`files`** (nhiều file) → `{ data: Attachment[] }` (các file vừa thêm) |
| DELETE | `/v1/inventory/attachments/{id}` | → `{ data: { success: true } }` |
| GET | `/v1/inventory/attachments/{id}/file` | stream file, cần Bearer token |

```ts
Attachment = { id, batchId, name, size, mimeType, url, uploadedBy, uploadedAt }
```

- FE tải file theo đường dẫn `/attachments/{id}/file`, không dùng `url`, vì `url` của project documents đang trỏ về `localhost`.
- Nên nhận PDF, ảnh, Excel, Word; tối đa khoảng 10MB mỗi file.

---

## 6. Mã batch không được trùng (T07)

FE đã cảnh báo và chặn lưu khi mã batch trùng với batch khác trong toàn kho (bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường, bỏ qua batch đang sửa). Hiện dữ liệu chưa có mã trùng.

**Yêu cầu.**
- Ràng buộc unique `batchCode` trên các batch chưa archive (sau trim, không phân biệt hoa thường) ở:
  - `POST /items` (batch đầu);
  - `POST /items/{id}/batches`;
  - `POST /entries`;
  - `PATCH /batches/{id}`.
- Khi trùng, trả **409** kèm message tiếng Việt, ví dụ `Mã batch "VOUCHER-072026-004" đã tồn tại (VOUCHER GIẤY 100.000)`.
- Tuỳ chọn: `GET /v1/inventory/batches/check-code?code=` → `{ exists, itemName }`, để FE không phải tải toàn bộ kho.

---

## 7. Hồ sơ đính kèm của dòng chi phí khi lưu snapshot mới (T02)

Màn *Nhập chi phí dự án* có thêm cột **"Hồ sơ liên quan"**:
- mỗi dòng đính kèm 1 file PDF/PNG/JPG;
- FE upload bằng `POST /v1/expenses/lines/{id}/attachment` (field `file`) ngay sau khi tạo dòng.

Vì mỗi lần lưu tạo snapshot mới, FE **chép** hồ sơ cũ sang dòng mới bằng cách gửi `attachmentUrl` (lấy từ dòng cũ) trong `POST /v1/expenses/{id}/lines`.

**Yêu cầu.**
1. Khi tạo dòng có `attachmentUrl` trỏ tới file của dòng khác, `GET /v1/expenses/lines/{dòng mới}/attachment` phải trả đúng file đó (dùng chung file, không cần copy).
2. `CreateExpenseLineDto` nhận thêm `attachmentName`. Hiện DTO có `attachmentUrl` nhưng chưa có `attachmentName`, nên tên file bị mất khi chép.
3. Sau khi upload, response và `GET /v1/expenses` trả `attachmentUrl` + `attachmentName` của dòng. Hiện chưa có dòng nào có file để FE kiểm tra định dạng `attachmentUrl`.
4. Trường `note` giữ nguyên ký tự xuống dòng `\n`: ghi chú giờ nhập nhiều dòng, mỗi mã hoá đơn một dòng.

**FE đang làm tạm.** Nếu không mở được file qua dòng mới, FE mở qua dòng gốc đang giữ file. Liên kết này lưu trong `localStorage` (`mkt_expense_meta.lineAttachments`), nên chỉ đúng trên trình duyệt đã lưu.

---

## 8. Dọn nhóm hạng mục "Ăn uống", "Vận chuyển" (T01, T03)

Trước đây FE **tự tạo lại** 2 nhóm này mỗi lần mở tab *Nhập chi phí tổng hạng mục*, nên xoá rồi vẫn hiện lại. FE đã bỏ logic này và bỏ 2 hạng mục khỏi dropdown của *Nhập chi phí dự án*. Tuy nhiên dữ liệu đã tạo vẫn còn trên BE:

| Năm | Nhóm | id | Kế hoạch | Dòng chi phí tham chiếu |
|---|---|---|---|---|
| 2026 | Ăn uống | `bb5caa34-755f-42bb-aa60-c507ea7c03bf` | 0 | 0 |
| 2026 | Vận chuyển | `0c2b50bb-31db-42a5-ad74-6ec9b495ea6e` | 0 | 0 |
| 2025 | Ăn uống, Vận chuyển | (xem `GET /v1/expense-budgets/tree?year=2025`) | 0 | 0 |

**Yêu cầu.** Xoá 4 nhóm trên (hoặc để user tự xoá bằng nút xoá trên UI). Đây chỉ là dọn dữ liệu, không cần sửa code.

---

## 9. Các mục tuỳ chọn

| # | Task | Nội dung |
|---|---|---|
| 9.1 | T09 | `GET /v1/inventory/overview` trả thêm `totalImportValue` (Σ `quantityIn × unitPriceAfterVat`, sau VAT, cùng quy ước với `totalValue`) và `totalStock`. FE đang tự tính: 172.152.870 VND. |
| 9.2 | T10 | `GET /v1/inventory/items` nhận thêm query `receivedFrom`, `receivedTo`, `batchCode`, và `search` tìm cả theo mã batch. Hiện `search=VOUCHER-072026` trả 0 kết quả. FE đang tải toàn bộ rồi lọc ở trình duyệt. |
| 9.3 | T11 | `GET /v1/dashboard/kpi-cards`: card nhãn `"ROA"` trả `plan: 0`, `percentVsPlan: 2.05` (đang lặp lại chính giá trị ROAS, nên "% vs plan" không có ý nghĩa). Đề nghị đổi nhãn thành **"ROAS"**, trả `percentVsPlan: null` khi không có kế hoạch, và tính theo công thức §2. |
| 9.4 | T12 | Xác nhận `isOverdue` / `overdueDays` của `GET /v1/tasks` tính theo **ngày lịch Asia/Ho_Chi_Minh**: chỉ quá hạn từ ngày sau hạn chót. Hiện BE đúng: task hạn 26/09 trả `isOverdue:false` lúc 10:14 ngày 26/09. FE đã tự tính theo ngày nên không còn phụ thuộc vào cờ này. |
| 9.5 | T15 | Thêm `GET /v1/projects/{id}/expense-summary` → `{ plannedBeforeVat, actualBeforeVat, actualAfterVat }` tính theo snapshot mới nhất (§1). Hiện FE tự tính trong `FE/utils/projectBudgetSummary.js`. Lưu ý: `plannedAmount` của dòng thường đang là số **sau VAT** (50.000.000 × 1, VAT 8% → `plannedAmount` 54.000.000), và `totalActual` của bản ghi = 0 dù dòng có thực tế. |

Không cần sửa BE cho: T04 (cột chi phí thực tế ở Ngân sách), T08 (cột Số lượng nhập / Mã batch), T13 (lọc người phụ trách Kanban), T14 (lọc người phụ trách Báo cáo tuần — BE đã hỗ trợ `memberId`, lỗi nằm ở FE không gửi lên; click task mở chi tiết).

---

## 10. FE sẽ làm gì sau khi BE xong

| BE xong mục | FE làm |
|---|---|
| §1, §2, §3 | Tab Tổng quan dùng số của BE; bỏ tính tạm trong `marketingCostMetrics.js`; chuyển lựa chọn dự án lead từ `localStorage` sang `isLeadSource`; bỏ cảnh báo thiếu ngày bắt đầu |
| §4 | Bỏ fallback `localStorage` và phần tự cộng batch trong tab Ngân sách (`inventoryBudgetCategory.js`) |
| §5, §6 | Không cần sửa: FE tự bật upload khi endpoint hết 404 và hiển thị message 409 |
| §7 | Bỏ fallback `lineAttachments` trong `expenseMeta`; gửi thêm `attachmentName` |
| 9.1, 9.2, 9.5 | Dùng số hoặc bộ lọc của BE thay cho tính ở trình duyệt |
