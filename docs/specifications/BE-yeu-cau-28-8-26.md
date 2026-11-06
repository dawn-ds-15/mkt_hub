# Yêu cầu cho Backend — Ngày 28/08/2026

> File tổng hợp **toàn bộ yêu cầu dành cho backend** phát sinh từ ngày 28/08/2026.
> Mọi yêu cầu BE viết sau ngày này cũng được thêm vào file này (có ngày kèm theo).
>
> Ngày tạo: 28/08/2026

---

## Mục lục

- [1. Sửa `PATCH /v1/inventory/batches/{id}` — không re-tính tồn kho khi sửa số lượng](#1-sửa-patch-v1inventorybatchesid--không-re-tính-tồn-kho-khi-sửa-số-lượng)
- [2. Mở rộng Ngân sách Chi phí Hạng mục theo Dự án + Kỳ (Năm)](#2-mở-rộng-ngân-sách-chi-phí-hạng-mục-theo-dự-án--kỳ-năm)
- [3. Hỗ trợ lọc theo Dự án cho các API Phân tích (tab Xem & phân tích)](#3-hỗ-trợ-lọc-theo-dự-án-cho-các-api-phân-tích-tab-xem--phân-tích)
- [4. Không nhất quán: "Toàn hệ thống" ≠ tổng các Dự án (Raw Leads & KPI)](#4-không-nhất-quán-toàn-hệ-thống--tổng-các-dự-án-raw-leads--kpi)
- [5. Trả flag ẩn metric trên `kpi-cards` / `funnel` (ẩn Raw Leads)](#5-trả-flag-ẩn-metric-trên-kpi-cards--funnel-ẩn-raw-leads)
- [6. Nhập kho: luồng tạo item + batch nguyên tử & lưu đủ `vatRate`](#6-nhập-kho-luồng-tạo-item--batch-nguyên-tử--lưu-đủ-vatrate)
- [7. Ngày khởi tạo OPP (trường chọn trên form Chi tiết OPP)](#7-ngày-khởi-tạo-opp-trường-chọn-trên-form-chi-tiết-opp)
- [8. Trả `ROA` trong `GET /v1/expenses/overview` (thay LTV tại Tổng quan)](#8-trả-roa-trong-get-v1expensesoverview-thay-ltv-tại-tổng-quan)

---

# 1. Sửa `PATCH /v1/inventory/batches/{id}` — không re-tính tồn kho khi sửa số lượng

> Ngày: 28/08/2026
> Nguồn: FE tab "Sửa vật phẩm" trong module Kho vật phẩm — khi sửa batch và thay đổi **số lượng/tồn** thì dữ liệu lưu được trong batch NHƯNG **danh sách tồn kho không cập nhật** (item `totalStock`, `currentStock`, `status` không đổi).

## 1.1 Hiện trạng (đã verify trực tiếp backend 28/08)

| # | Endpoint | Trạng thái |
|---|----------|-----------|
| 1 | `POST /v1/inventory/items` | ✅ Tạo item |
| 2 | `POST /v1/inventory/items/{id}/batches` (createBatch) | ⚠️ Lưu được nhưng **vatRate không được lưu** (trả `vatRate: 0`) |
| 3 | `PATCH /v1/inventory/batches/{id}` (updateBatch) | ❌ **Lưu được field nhưng KHÔNG re-tính** `totalStock`/`currentStock`/`status` |
| 4 | `POST /v1/inventory/entries` (createInventoryEntry) | ✅ Tạo batch + transaction + re-tính đúng (đây là endpoint chuẩn) |

### Kịch bản lỗi (repro bằng API thật)

```
1. POST /inventory/items → item id = X, totalStock = 0
2. POST /inventory/items/X/batches { quantityIn: 10 }
   → batch.currentStock = 10, item.totalStock = 10   ✅
3. PATCH /inventory/batches/{batchId} { quantityIn: 15 }
   → response batch.quantityIn = 15, NHƯNG
     batch.currentStock   = 10  (❌ không đổi)
     item.totalStock      = 10  (❌ không đổi)
     item.status          = "instock"  (không re-tính)
```

→ FE reload danh sách nhưng backend trả `totalStock` cũ → **danh sách kho không cập nhật** dù đã "Lưu" thành công.

### Vấn đề phụ (cùng cơ chế)

- `POST /inventory/items/{id}/batches` gửi `vatRate: 10` nhưng response trả `vatRate: 0` → VAT không được persist khi tạo batch bằng endpoint này (chỉ `POST /inventory/entries` persist đúng VAT). FE vẫn gửi `vatRate` nên cần BE thống nhất hành vi.

## 1.2 Yêu cầu

### `PATCH /v1/inventory/batches/{id}` — re-tính toàn bộ tồn kho

Sau khi cập nhật batch, BE phải:

1. Lưu các field: `batchCode`, `receivedDate`, `quantityIn`, `unitPrice`, `vatRate`, `supplier`, `contractCode`.
2. **Re-tính tổng tồn kho của item**:
   - `totalStock` = Σ `currentStock` của các batch `archivedAt IS NULL` (hoặc `status = 'active'`) của item.
   - `currentStock` của batch = `quantityIn` trừ đi tổng số lượng đã xuất (`type: 'out'`) của batch **sau khi cập nhật `quantityIn` mới**.
3. **Re-tính** `avgUnitPrice` (weighted theo batch active, dùng `unitPriceAfterVat`) và `status` (`instock`/`low`/`out`) của item.
4. Re-tính `status` của batch (`active`/`depleted`) dựa trên `currentStock` mới.

> Lưu ý ngữ nghĩa `currentStock` khi đổi `quantityIn`:
> - `quantityIn` là số lượng gốc nhập vào batch.
> - `currentStock` = `quantityIn` − tổng `type:'out'` của batch (nếu sửa `quantityIn` xuống thấp hơn tổng đã xuất → clamp `currentStock = 0`).
> - Nên thêm transaction ghi nhận sự thay đổi (nếu phù hợp design), để lịch sử xuất/nhập nhất quán.

### `POST /v1/inventory/items/{id}/batches` — persist VAT đúng

- Lưu `vatRate` nhận được (hiện bị ghi 0), tính `unitPriceBeforeVat` / `unitPriceAfterVat` đúng như `POST /v1/inventory/entries`.

## 1.3 Validate

| Điều kiện | Response |
|-----------|----------|
| `id` batch không tồn tại hoặc đã archive | 404 `"Batch không tồn tại"` |
| `quantityIn` mới < tổng số đã xuất của batch | 400 `"Số lượng nhập không được nhỏ hơn số lượng đã xuất"` |
| `quantityIn < 0` | 400 |

## 1.4 Ví dụ

### Kịch bản 1: Sửa tăng số lượng batch

```
Trước: batch.quantityIn = 10, batch.currentStock = 10, item.totalStock = 10
PATCH /inventory/batches/{id} { quantityIn: 15 }

Sau: batch.quantityIn = 15, batch.currentStock = 15, item.totalStock = 15
```

### Kịch bản 2: Batch đã xuất 4, sửa giảm quantityIn còn 5

```
Trước: batch.quantityIn = 10, đã xuất 4 → currentStock = 6, item.totalStock = 6
PATCH { quantityIn: 5 }

Sau: batch.quantityIn = 5, currentStock = 5 - 4 = 1, item.totalStock = 1
```

### Kịch bản 3: Sửa quantityIn thấp hơn tổng đã xuất

```
Trước: batch.quantityIn = 10, đã xuất 8 → currentStock = 2
PATCH { quantityIn: 5 }   // 5 < 8 đã xuất

→ 400 "Số lượng nhập không được nhỏ hơn số lượng đã xuất" (hoặc clamp currentStock = 0)
```

## 1.5 Test case chấp nhận

- [ ] `PATCH batch` đổi `quantityIn` → `item.totalStock` và `batch.currentStock` re-tính đúng
- [ ] `PATCH batch` đổi `unitPrice`/`vatRate` → `avgUnitPrice` item cập nhật
- [ ] `PATCH batch` sau khi xuất một phần → `currentStock = quantityIn − đã xuất`
- [ ] `PATCH batch` `quantityIn` < tổng đã xuất → 400 (hoặc clamp)
- [ ] `GET /v1/inventory/items/{id}` → `totalStock`, `avgUnitPrice`, `status` đúng sau mọi PATCH
- [ ] `POST /items/{id}/batches` gửi `vatRate` → response ghi đúng `vatRate`, `unitPriceBeforeVat`, `unitPriceAfterVat`
- [ ] Không regression: `POST /v1/inventory/entries` giữ nguyên hành vi hiện tại

## 1.6 Checklist cho backend

- [ ] Sửa `PATCH /v1/inventory/batches/{id}` — thêm logic re-tính item + batch
- [ ] Clamp `currentStock ≥ 0` / validate `quantityIn` sau khi trừ phần đã xuất
- [ ] Sửa `POST /items/{id}/batches` — persist `vatRate` đúng
- [ ] Thống nhất `unitPrice`/`unitPriceBeforeVat`/`unitPriceAfterVat` giữa 2 endpoint batch và entry
- [ ] Deploy + verify Swagger `/api/docs-json` và FE Kho vật phẩm (sửa vật phẩm → danh sách cập nhật)

---

# 2. Mở rộng Ngân sách Chi phí Hạng mục theo Dự án + Kỳ (Năm)

> Ngày: 28/08/2026
> Nguồn: FE tab "Nhập chi phí tổng hạng mục" cần **chọn dự án** + **chọn kỳ (năm)** để quản lý ngân sách hạng mục riêng cho từng dự án.
>
> **Hiện trạng:** `GET /v1/expense-budgets/tree` chỉ nhận `year`, toàn bộ dữ liệu budget (`budget_values`) không có khái niệm dự án → FE chỉ xem/sửa được 1 bảng toàn cục theo năm.

## 2.1 Mục tiêu

Cho phép người dùng chọn **Dự án** + **Năm (kỳ)** trên tab nhập chi phí tổng hạng mục, và mỗi hạng mục/dòng trong bảng có bộ số liệu 12 tháng **riêng theo từng dự án**.

```
Ví dụ:
- Chọn Project = "Dự án A", Năm = 2026 → bảng ngân sách hạng mục cho riêng Dự án A / 2026
- Chọn Project = "Dự án B", Năm = 2026 → bảng riêng cho Dự án B / 2026
```

## 2.2 Thay đổi Database

### `budget_values` — thêm cột `project_id`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID / SERIAL | PK |
| item_id | UUID / INT NULL | FK → budget_items.id (**NULL nếu là BACK UP**) |
| **project_id** | UUID NULL | 🆕 FK → projects.id. **NULL = giá trị toàn cục/mặc định (không thuộc dự án nào)** |
| is_backup | BOOLEAN | true = BACK UP, false = item thường |
| year | INT | |
| month | INT | 1–12 |
| amount | DECIMAL(15,2) | |

**Unique constraint (mới):** `(item_id, is_backup, project_id, year, month)` — thêm `project_id` vào unique key hiện có.

> **Lưu ý tương thích ngược:** với `project_id IS NULL`, dữ liệu hành vi giữ nguyên như trước (bảng toàn cục), để không phá dữ liệu cũ.

### (Không cần thay đổi) `budget_categories` / `budget_subcategories` / `budget_items`

Cấu trúc hạng mục (category → subcategory → item) giữ nguyên và **dùng chung** cho mọi dự án (là "template" hạng mục). Chỉ phần **giá trị theo tháng** được phân theo project.

## 2.3 Thay đổi API

### `GET /v1/expense-budgets/tree` — thêm query `projectId`

```
GET /v1/expense-budgets/tree?year=2026&projectId=<uuid>
```

- `projectId` **optional**. Nếu thiếu → trả tree của `project_id IS NULL` (toàn cục, tương thích cũ).
- Response: giữ nguyên shape hiện tại (`categories[].subcategories[].items[].months` + `subcategories[].backup.months`), chỉ lọc dữ liệu months theo `project_id` tương ứng.

Response (không đổi shape):
```json
{
  "data": {
    "categories": [
      {
        "id": "cat_01",
        "name": "Budget Brand Marketing",
        "percent": 11,
        "subcategories": [
          {
            "id": "sub_01",
            "name": "I. BRAND MARKETING",
            "totalName": "TOTAL BRAND MKT",
            "backup": { "percent": 10, "months": { "1": 5000000 } },
            "items": [ { "id": "item_01", "name": "Campaign", "months": { "1": 10000000 } } ]
          }
        ]
      }
    ]
  }
}
```

### `PUT /v1/expense-budgets/values` — thêm `projectId`

Body:
```json
{
  "year": 2026,
  "projectId": "<uuid>",            // 🆕 optional
  "values": [
    { "itemId": "item_01", "isBackup": false, "month": 1, "amount": 10000000 },
    { "itemId": null, "subcategoryId": "sub_01", "isBackup": true, "month": 1, "amount": 5000000 }
  ]
}
```

- `projectId` optional; khi thiếu xử lý như `project_id IS NULL`.
- Upsert key: `(itemId, isBackup, projectId, year, month)`.

### (Giữ nguyên) CRUD categories / subcategories / items

Không đổi. Đây là template hạng mục dùng chung cho mọi dự án.

## 2.4 Validate

| Điều kiện | Response |
|-----------|----------|
| `projectId` không tồn tại hoặc đã archived | 404 `"Dự án không tồn tại"` |
| `year` thiếu → mặc định năm hiện tại | — |
| `amount < 0` | 400 |

## 2.5 Example flow

```
1. GET /expense-budgets/tree?year=2026&projectId=projA
   → bảng hạng mục với months = dữ liệu project projA / 2026

2. Người dùng nhập 12 tháng, bấm Lưu
   → PUT /expense-budgets/values { year: 2026, projectId: projA, values: [...] }
   → upsert từng (item, isBackup, projectId=projA, year, month)

3. GET /expense-budgets/tree?year=2026            → dữ liệu toàn cục (project_id NULL) — không đổi
   GET /expense-budgets/tree?year=2026&projectId=projB → dữ liệu riêng projB — độc lập với projA
```

## 2.6 Test case chấp nhận

- [ ] `GET tree?year&projectId` trả đúng months của project đó
- [ ] `GET tree?year` (không projectId) vẫn trả dữ liệu toàn cục cũ (không regression)
- [ ] `PUT values` với `projectId` → chỉ ghi/upsert cho project đó, không đụng project khác
- [ ] `PUT values` không `projectId` → ghi toàn cục như trước (không regression)
- [ ] Hai project khác nhau lưu cùng năm/tháng → dữ liệu độc lập
- [ ] `projectId` không tồn tại → 404
- [ ] Swagger `/api/docs-json` hiển thị `projectId` trong query `tree` và body `PUT values`

## 2.7 Checklist cho backend

- [ ] Migration: thêm cột `project_id` vào `budget_values` + unique `(item_id, is_backup, project_id, year, month)`
- [ ] `GET /expense-budgets/tree` thêm query `projectId` (optional), lọc months theo project
- [ ] `PUT /expense-budgets/values` thêm field `projectId` (optional), upsert kèm project
- [ ] Giữ tương thích ngược khi `projectId` vắng mặt
- [ ] Validate `projectId` tồn tại
- [ ] Deploy + verify Swagger và FE tab "Nhập chi phí tổng hạng mục"

---

# 3. Hỗ trợ lọc theo Dự án cho các API Phân tích (tab Xem & phân tích)

> Ngày: 28/08/2026
> Nguồn: FE tab "Xem & phân tích" (ViewAnalytics) cần **lọc theo dự án** — hiện chỉ lọc được theo **tuần/tháng/quý/năm** (qua `DashboardContext`), thiếu chiều dự án.
> FE **chưa code** lọc dự án; trước tiên cần backend hỗ trợ `projectId` để FE có thể gửi lên sau đó.

## 3.1 Hiện trạng

| Endpoint | Param hiện có | Có `projectId`? |
|---|---|---|
| `GET /v1/dashboard/kpi-cards` | `period_type`, `period_value`, `year` | ❌ Không |
| `GET /v1/dashboard/funnel` | `period_type`, `period_value`, `year` | ❌ Không |
| `GET /v1/dashboard/pipeline-by-segment` | `period_type`, `period_value`, `year` | ❌ Không |
| `GET /v1/leads-kpis/closed-deals` | (không param — trả toàn bộ) | ❌ Không |
| `GET /v1/leads-kpis/plan/:year` | `year` (plan năm toàn hệ thống) | ❌ Không |
| `GET /v1/leads-kpis/weekly` | `year`, `week`, `month` | ✅ Đã có |

→ Các API gom số theo kỳ (KPI cards, funnel, pipeline-by-segment) và closed-deals / plan đều **không tách theo dự án** nên FE không thể lọc được dự án cho tab phân tích.

## 3.2 Yêu cầu — thêm query `projectId` (optional) vào các endpoint

Nguyên tắc chung:
- `projectId` **optional**. Nếu thiếu → giữ hành vi hiện tại (toàn hệ thống, không regression).
- Nếu có → kết quả chỉ tính cho **dự án đó** (filter bản ghi thuộc `projectId`).
- `projectId` không tồn tại hoặc đã archive → `404 "Dự án không tồn tại"`.

### 3.2.1 `GET /v1/dashboard/kpi-cards?period_type=&period_value=&year=&projectId=`

- Thêm `projectId` (optional). Khi có, các KPI card (Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline Value, Won Value...) chỉ tính từ dữ liệu của dự án đó trong kỳ.

### 3.2.2 `GET /v1/dashboard/funnel?period_type=&period_value=&year=&projectId=`

- Thêm `projectId` (optional). Funnel các bước chỉ tính từ dữ liệu dự án đó trong kỳ.

### 3.2.3 `GET /v1/dashboard/pipeline-by-segment?period_type=&period_value=&year=&projectId=`

- Thêm `projectId` (optional). Phân khúc (`segment`, `openDeals`, `value`, `growthPct`) chỉ tính theo dự án đó.

### 3.2.4 `GET /v1/leads-kpis/closed-deals?projectId=`

- Thêm `projectId` (optional) lọc danh sách closed deals theo dự án (đồng thời vẫn giữ filter `archivedAt IS NULL` như đã yêu cầu trước).

### 3.2.5 `GET /v1/leads-kpis/plan/:year?projectId=`

- (Tuỳ chọn, nếu plan KPI thiết kế theo dự án) cho phép lấy plan riêng theo dự án. Nếu plan vẫn là toàn hệ thống, ghi rõ để FE biết để không gửi `projectId` cho endpoint này.

> **Khoá liên kết bản ghi ↔ dự án:** BE xác định dự án của lead/opportunity/closed-deal qua field đã có (vd `projectId`/`project_id` trên bản ghi). Nếu bản ghi hiện chưa có cột `project_id` → cần migration bổ sung và backfill trước khi lọc.

## 3.3 Validate

| Điều kiện | Response |
|-----------|----------|
| `projectId` không tồn tại / đã archive | 404 `"Dự án không tồn tại"` |
| `projectId` thiếu | hành vi hiện tại (toàn hệ thống) |

## 3.4 Test case chấp nhận

- [ ] `GET kpi-cards?projectId` trả số liệu chỉ của dự án đó (khác với không có `projectId`)
- [ ] `GET funnel?projectId`, `GET pipeline-by-segment?projectId` trả đúng theo dự án
- [ ] `GET closed-deals?projectId` lọc đúng dự án + vẫn ẩn bản ghi archived
- [ ] Không gửi `projectId` → kết quả giữ nguyên như trước (không regression)
- [ ] `projectId` không tồn tại → 404
- [ ] Swagger `/api/docs-json` hiển thị `projectId` trên các endpoint trên

## 3.5 Checklist cho backend

- [ ] Thêm query `projectId` (optional) vào `kpi-cards`, `funnel`, `pipeline-by-segment`, `closed-deals`
- [ ] Đảm bảo bản ghi có cột `project_id` (migration/backfill nếu thiếu)
- [ ] Giữ tương thích ngược khi `projectId` vắng mặt
- [ ] Validate `projectId` tồn tại → 404
- [ ] Xác nhận plan KPI (`/plan/:year`) có theo dự án hay toàn hệ thống

---

# 4. Không nhất quán: "Toàn hệ thống" ≠ tổng các Dự án (Raw Leads & KPI)

> Ngày: 29/08/2026
> Nguồn: FE tab "Xem & phân tích" (ViewAnalytics) — khi chọn **"Toàn hệ thống"** (không chọn dự án), các chỉ số (Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline Value, Won Value) **lệch** so với **tổng các chỉ số của từng dự án** được cộng lại.
> Dữ liệu hiển thị đúng khi chọn từng dự án cụ thể; chỉ sai ở chế độ tổng hợp.

## 4.1 Yêu cầu

Khi gọi các API gom số **không kèm `projectId`** (tức chế độ "toàn hệ thống"), kết quả trả về phải **bằng đúng tổng** của các bản ghi hợp lệ thuộc mọi dự án, **đồng nhất với** tổng khi cộng từng `projectId` lại với nhau.

Hai giá trị sau bắt buộc phải khớp tại cùng một kỳ (`period_type` + `period_value` + `year`):

1. `GET .../kpi-cards` (hoặc `funnel`) **không** `projectId`
2. `Σ` của `GET .../kpi-cards?projectId=P` với mọi dự án P **đang hoạt động** (chưa archive)

## 4.2 Nguyên nhân điển hình cần rà soát trong code backend

- **Bản ghi chưa gán dự án** (`project_id IS NULL`): lead/opportunity/closed-deal không thuộc dự án nào — vẫn bị đếm vào "toàn hệ thống" nhưng bị loại khi lọc theo từng dự án → tổng toàn hệ thống **lớn hơn** tổng các dự án. Cần quyết định: bản ghi `project_id IS NULL` có được tính vào "toàn hệ thống" hay không; nếu tính thì phải tách thành một "nhóm chưa gán" để FE đối chiếu.
- **Project đã archive / soft-delete**: bản ghi thuộc dự án bị archive vẫn bị đếm trong "toàn hệ thống" nhưng không xuất hiện trong danh sách dự án để chọn → lệch. Aggregate phải loại bản ghi của dự án đã archive ở **cả** hai chế độ.
- **Filter `archivedAt` không nhất quán**: query "toàn hệ thống" và query "theo dự án" phải dùng **cùng một** điều kiện lọc soft-delete (`archivedAt IS NULL` / `deletedAt IS NULL`) trên cùng các bảng.
- **Plan theo kỳ khác nhau**: `kpi-cards` gom số theo dự án trong khi plan (`/plan/:year` hoàn toàn toàn hệ thống) không tách dự án — không được trộn plan toàn hệ thống vào giá trị "toàn hệ thống" của một kỳ con nếu muốn khớp tổng.

## 4.3 Tiêu chí chấp nhận

- [ ] Trong cùng một kỳ: `kpi-cards` (không `projectId`) của Raw Leads == Σ `kpi-cards?projectId=P` của tất cả dự án hoạt động.
- [ ] Rule áp dụng đồng nhất cho MQL, SQL, OPP, Closed Deal, Pipeline Value, Won Value và các bước funnel.
- [ ] Bản ghi `project_id IS NULL` được xử lý rõ ràng (có hoặc không tính — phải được document và nhất quán giữa các endpoint).
- [ ] Bản ghi thuộc project đã archive/soft-delete không được tính ở bất kỳ chế độ nào.
- [ ] Không regression: dữ liệu khi chọn từng dự án cụ thể vẫn giữ nguyên như hiện tại.

- [ ] Deploy + verify Swagger; thông báo FE để hiện thực selector Dự án trong tab "Xem & phân tích"

---

# 5. Trả flag ẩn metric trên `kpi-cards` / `funnel` (ẩn Raw Leads)

> Ngày: 29/08/2026
> Nguồn: Bug FE-LKPI-003 — QA xác nhận chỉ số **Raw Leads** đã **cấu hình ẩn** nhưng vẫn xuất hiện trong khu vực thống kê "toàn hệ thống".
> FE đã làm xong phần hiển thị (tôn trọng flag ẩn); phần còn thiếu là **backend hiện chưa trả flag ẩn** nên FE không biết metric nào để ẩn.

## 5.1 Yêu cầu

Các endpoint tổng hợp metric ở tab "Xem & phân tích" (`GET /v1/dashboard/kpi-cards` và `GET /v1/dashboard/funnel`) phải trả thêm một **flag ẩn** trên **từng metric/bước**, cho phép FE ẩn chỉ số khỏi toàn bộ giao diện (card, bảng, biểu đồ, tooltip, tổng số) mà không cần sửa code FE.

Ví dụ shape cho `kpi-cards`:

```json
{
  "data": [
    { "label": "Raw Leads", "actual": 4250, "plan": 4500, "percentVsPlan": 94, "convPct": 35, "hidden": true },
    { "label": "MQL",        "actual": 1487, "plan": 1350, "percentVsPlan": 110, "convPct": 42, "hidden": false }
  ]
}
```

Tương tự `funnel` — mỗi bước trả kèm flag:

```json
{
  "data": [
    { "step": "Raw Leads", "actual": 4250, "plan": 4500, "convPct": 100, "hidden": true },
    { "step": "MQL",        "actual": 1487, "plan": 1350, "convPct": 35,  "hidden": false }
  ]
}
```

## 5.2 Quy ước field

- FE hiện đọc các tên flag sau (**đã hỗ trợ sẵn**, backend chỉ cần trả 1 trong các field này):
  - `hidden === true` hoặc `isHidden === true`
  - `isActive === false` hoặc `visible === false` hoặc `isVisible === false`
  - `show === false` hoặc `display === false` hoặc `enabled === false`
- Khuyến nghị thống nhất dùng field **`hidden`** (boolean) cho nhất quán giữa `kpi-cards` và `funnel`.
- `hidden` mặc định `false` nếu không cấu hình — **không regression** với các metric hiện tại.

## 5.3 Quy tắc nghiệp vụ cần BE xác nhận

- Nguồn cấu hình "ẩn Raw Leads" nằm ở đâu (config DB, role, mặc định hệ thống)? BE cần document để FE hiểu khi nào set `hidden=true`.
- Nếu Raw Leads bị ẩn, `convPct` của bước kế tiếp phải tính lại dựa trên bước hiển thị trước đó (hoặc giữ nguyên — cần chốt).

## 5.4 Tiêu chí chấp nhận

- [ ] `kpi-cards` trả `hidden` trên từng card; `funnel` trả `hidden` trên từng bước.
- [ ] Khi `hidden=true` cho Raw Leads → FE không render card Raw Leads và bỏ bước Raw Leads khỏi funnel.
- [ ] Khi không cấu hình → `hidden=false` cho mọi metric (không regression).
- [ ] Swagger `/api/docs-json` hiển thị field `hidden` trên cả 2 endpoint.

---

# 6. Nhập kho: luồng tạo item + batch nguyên tử & lưu đủ `vatRate`

> Ngày: 29/08/2026
> Nguồn: Bug FE-INV-001 (P0) — "Không nhập được hàng + bấm Lưu nhiều lần tạo nhiều lô rỗng".
> FE đã khóa nút Lưu (chống submit lặp) + rollback item khi tạo batch thất bại. Phần còn lại phụ thuộc backend.

## 6.1 Hiện trạng FE

- Màn "Nhập kho" (InventoryFormModal) tạo mới bằng **2 request tuần tự, không nguyên tử**:
  1. `POST /v1/inventory/items` → lấy `itemId`
  2. `POST /v1/inventory/items/:id/batches` → lấy `batchId`
- Nếu bước 2 thất bại (sau khi bước 1 thành công) → để lại **item mồ côi không có batch** ("lô rỗng"). FE đã thêm rollback tạm thời nhưng chỉ là giải pháp phụ.

## 6.2 Vấn đề ghi nhận trên backend

- **`vatRate` không được lưu** khi tạo batch: `POST /v1/inventory/items/:id/batches` gửi `vatRate` nhưng kết quả trả về `vatRate: 0` → dữ liệu giá sau VAT sai/chênh lệch nghiệp vụ.

## 6.3 Yêu cầu

Lựa chọn một trong hai:

**Phương án A (khuyến nghị) — tạo item + batch trong 1 endpoint nguyên tử:**
Cho phép `POST /v1/inventory/entries` nhận đầy đủ thông tin vật phẩm + lô + giao dịch, và tạo toàn bộ trong **một transaction**: nếu bất kỳ bước nào lỗi thì rollback toàn bộ (không để lại item/batch rỗng). FE sẽ chuyển sang dùng endpoint này.

**Phương án B — duy trì 2 endpoint nhưng sửa backend:**
- `POST /v1/inventory/items/:id/batches` phải **lưu đúng** `vatRate` (không mặc định 0) và trả về giá trị thật.
- Không có cách nào để "tạo item thành công nhưng batch không tồn tại" trong cùng 1 lần nhấn Lưu — tức nếu batch lỗi thì item vừa tạo cũng phải được xoá/rollback phía backend (hoặc dùng transaction).

## 6.4 Yêu cầu tối thiểu (áp dụng cho cả 2 phương án)

- Lưu đủ và trả đúng `vatRate` của batch.
- Không tạo bản ghi rỗng (item không có batch / batch có `quantityIn = 0`) khi payload không hợp lệ.
- Server trả lỗi rõ ràng (400 thiếu field, 500) để FE phân biệt trạng thái.

## 6.5 Tiêu chí chấp nhận

- [ ] Tạo nhập kho (item + batch) hoàn tất trong một lần gọi (hoặc atomic) — không để lại item/batch mồ côi dù mạng chậm, retry hay lỗi giữa chừng.
- [ ] `vatRate` lưu và trả đúng giá trị người dùng nhập (khác 0 nếu người dùng nhập khác 0).
- [ ] Payload thiếu trường bắt buộc hoặc `quantityIn <= 0` → 400, không tạo bất kỳ bản ghi nào.
- [ ] Swagger `/api/docs-json` cập nhật nếu có thay đổi DTO/endpoint.

---

# 7. Ngày khởi tạo OPP (trường chọn trên form Chi tiết OPP)

> Ngày: 29/08/2026
> Nguồn: FE-LKPI-007 (CR, P2) — Thêm trường chọn **Ngày khởi tạo OPP** trong form Chi tiết OPP
> (Lead KPI → Nhập số liệu → Chi tiết OPP).

## 7.1 Hiện trạng FE

- Bảng Chi tiết OPP (`OpportunitiesTable.jsx`) hiện chỉ có cột: Tên DN, Size, Project, Hợp đồng, Fees, Dự kiến đóng (`expectedCloseDate`).
- `addOpportunity` / `updateOpportunity` gửi payload gồm: `companyName`, `size`, `projectId`, `contractName`, `setupFee`, `expectedCloseDate`.
- **Chưa có** trường ngày khởi tạo OPP; nếu OPP có `createdAt` do backend tự sinh thì FE hiện không sửa/không gửi được.

## 7.2 Yêu cầu BE

Backend thêm hỗ trợ trường **ngày khởi tạo OPP** (giá trị `yyyy-mm-dd`) trên DTO của các endpoint Opportunity, để FE có thể hiển thị và chỉnh sửa:

- `POST /v1/leads-kpis/opportunities`
- `PATCH /v1/leads-kpis/opportunities/{id}`
- `GET /v1/leads-kpis/opportunities` (trả về field để FE display/map)

Cần BE **chốt tên field** và trả về trong payload. FE sẽ dùng đúng tên field BE cung cấp. Gợi ý đặt tên nhất quán với `expectedCloseDate`: **`createdDate`**.

Cụ thể:
- DTO nhận field mới (optional, kiểu `date`/`string ISO`). Với `PATCH`, chỉ cập nhật khi có giá trị.
- `GET ...` trả về field ngày khởi tạo (kể cả khi để trống, trả `null`/`''`, không tự gán 0/ngày giả).
- Quy tắc xác nhận khi từng bước này được thống nhất:
  - Bắt buộc hay không bắt buộc?
  - Ngày mặc định khi để trống (ví dụ ngày tạo record)?
  - Có giới hạn tối thiểu/tối đa (`<= now`) không?
  - Timezone lưu trữ (UTC) và cách FE hiển thị theo timezone hệ thống.

## 7.3 Đối chiếu yêu cầu FE-LKPI-007 (tiêu chí nghiệm thu FE sau khi BE hỗ trợ)

1. Trường dùng date picker theo design system hiện tại (giống `expectedCloseDate`).
2. Định dạng hiển thị thống nhất toàn hệ thống; payload gửi đúng field + định dạng API.
3. Tree về quy tắc bắt buộc/mặc định/timezone/giới hạn theo xác nhận ở trên.
4. Có validation và thông báo lỗi rõ ràng.
5. Ngày đã chọn hiển thị đúng sau khi tạo, tải lại và mở chỉnh sửa OPP.

## 7.4 Tiêu chí chấp nhận (BE)

- [ ] Field ngày khởi tạo OPP có trong DTO `POST`/`PATCH`/`GET` của `/v1/leads-kpis/opportunities`.
- [ ] Lưu và trả đúng giá trị `yyyy-mm-dd` (hoặc ISO) do người dùng nhập; không mặc định sai ngày.
- [ ] Khi để trống, trả `null`/`''` (không tự gán ngày giả), trừ khi nghiệp vụ quy định mặc định.
- [ ] `PATCH` chỉ cập nhật field khi payload có giá trị (không ghi đè bằng ngày khác/khi không gửi).
- [ ] Swagger `/api/docs-json` cập nhật DTO + nêu tên field chính thức để FE nối.

---

# 8. Trả `ROA` trong `GET /v1/expenses/overview` (thay LTV tại Tổng quan)

> Ngày: 29/08/2026
> Nguồn: FE-COST-001 (CR, P2) — Quản lý chi phí → Tổng quan: **xóa chỉ số LTV, thay bằng ROA**. Card LTV đã được bỏ; FE cần dữ liệu ROA từ backend để hiển thị card mới.

## 8.1 Hiện trạng FE

- FE `ExpenseOverview.jsx` hiển thị card **ROA** đọc từ `data.metrics.roa` trong response của `GET /v1/expenses/overview`.
- FE đã xử lý phòng thủ: nếu `metrics.roa` là object → lấy `.ratio`; nếu là số → dùng trực tiếp; nếu `null`/không hợp lệ → hiển thị `—` (không `Infinity`/`NaN`).
- **Backend cần đảm bảo trả `metrics.roa`** để card hiển thị giá trị thực.

## 8.2 Yêu cầu BE

`GET /v1/expenses/overview?period=` trả thêm field **`roa`** trong `metrics`, theo một trong hai shape (FE hỗ trợ cả hai):

```json
// Shape A — object (khuyến nghị, nhất quán với /v1/dashboard/roas)
{ "metrics": { "totalExpense": 1000, "newCustomers": 50, "cac": 20, "roa": { "ratio": 3.5, "totalExpense": 1000 } } }

// Shape B — số
{ "metrics": { "totalExpense": 1000, "newCustomers": 50, "cac": 20, "roa": 3.5 } }
```

Quy ước:
- `roa` **optional**; nếu chưa tính được (vd mẫu số = 0) → trả `null` (FE hiển thị `—`).
- **Không** trả `Infinity`/`NaN` khi mẫu số = 0.
- `roa.ratio` là số, không phải chuỗi.
- Quy tắc làm tròn: FE hiển thị 2 chữ số thập phân + `x` (vd `3.50x`); nếu backend cần làm tròn khác, nêu rõ.

## 8.3 Cần Product/BE xác nhận

- Công thức ROA chính thức (ROA = Won Value / Tổng chi phí? hay Return on Ad Spend theo chuẩn nào?) và nguồn tử số/mẫu số.
- `roa.ratio` tính theo kỳ báo cáo (`period`) hay theo năm? (Khuyến nghị: theo `period` giống các metrics khác trong overview.)

## 8.4 Tiêu chí chấp nhận

- [ ] `GET /v1/expenses/overview` trả `metrics.roa` (theo kỳ).
- [ ] Khi mẫu số = 0 → trả `null`, không `Infinity`/`NaN`.
- [ ] `roa.ratio` là số, làm tròn/hiển thị nhất quán với card FE.
- [ ] Card ROA hoạt động đúng với bộ lọc dự án và thời gian (cùng metric `totalExpense`/`newCustomers`).
- [ ] Không regression các metrics cũ (`totalExpense`, `newCustomers`, `cac`).
- [ ] Swagger `/api/docs-json` hiển thị field `roa`.



