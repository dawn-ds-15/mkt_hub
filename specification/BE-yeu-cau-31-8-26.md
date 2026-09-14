opencode# Yêu cầu cho Backend — Ngày 31/08/2026

> File tổng hợp các yêu cầu dành cho backend phát sinh ngày 31/08/2026.
> Mọi yêu cầu BE viết sau ngày này cũng được thêm vào file này (có ngày kèm theo).
>
> Ngày tạo: 31/08/2026

---

## Mục lục

- [1. Nhập kho: lưu đúng `vatRate` & tính đúng `unitPriceAfterVat` cho batch khi tạo item/batch](#1-nhập-kho-lưu-đúng-vatrate--tính-đúng-unitpriceaftervat-cho-batch-khi-tạo-itembatch)
- [2. `GET /api/v1/projects/:id` — trả `budgetPlanTotal` và `actualCostTotal`](#2-get-apiv1projectsid--trả-budgetplantotal-và-actualcosttotal)

---

# 1. Nhập kho: lưu đúng `vatRate` & tính đúng `unitPriceAfterVat` cho batch khi tạo item/batch

> Ngày: 31/08/2026
> Nguồn: FE-P-RV dialog — Modul kho vật phẩm (`/inventory`), màn "Nhập kho mới".
> QA/phản hồi: nhập kho hai lần, mỗi lần cùng **đơn giá trước VAT = 8316** và **VAT = 8%**,
> nhưng **đơn giá sau VAT hiển thị sai** (cả `POST` và khi đọc lại): bảng Batch hiển thị `unitPrice = 8316`
> và cột "Đơn giá TB (sau VAT)" cũng hiển thị `8316` thay vì `8981`.

## 1.1 Hiện trạng (đã verify bằng response API thật ngày 31/08)

**FE gửi `POST /v1/inventory/items` (tạo item kèm batch) với payload đầy đủ:**
```json
{
  "code": "leaflet-4W9Q",
  "name": "leaflet",
  "category": "posm",
  "unit": "cái",
  "batchCode": "SLEAFLET-2026-001",
  "receivedDate": "2026-07-29",
  "quantityIn": 500,
  "unitPriceBeforeVat": 8316,
  "vatRate": 8,
  "unitPriceAfterVat": 8981,
  "supplier": "IN PHÁT",
  "contractCode": "HD 9864"
}
```

**Backend lưu/trả về `GET /v1/inventory/items` (response thực tế):**
```json
{
  "id": "f0b8de4d-...",
  "name": "leaflet",
  "category": "posm",
  "totalStock": 500,
  "avgUnitPrice": 8316,
  "unitPriceBeforeVat": 8316,
  "unitPriceAfterVat": 8316,     // ❌ lẽ ra phải 8981
  "vatRate": 0                    // ❌ lẽ ra phải 8
}
```

> Ghi nhận: cả 2 item "leaflet" (`f0b8de4d...`, `45738a0e...`) đều bị tình trạng này —
> `vatRate = 0` và `unitPriceAfterVat = unitPriceBeforeVat` dù FE gửi `vatRate = 8`.

## 1.2 Vấn đề

- `POST /v1/inventory/items` (và `POST /v1/inventory/items/{id}/batches`) **không persist đúng `vatRate`** —
  ghi `vatRate = 0` mặc dù FE gửi `vatRate = 8`.
- **`unitPriceAfterVat` bị gán bằng `unitPrice` (giá trước VAT)** thay vì tính đúng
  `unitPriceAfterVat = round(unitPriceBeforeVat × (1 + vatRate/100)) = 8981`.
- Hệ quả: `avgUnitPrice` (backend tính weighted theo batch `unitPrice`/giá sau VAT) = `8316`,
  nên toàn bộ giao diện FE (cột "Đơn giá TB (sau VAT)" ở `InventoryTable`, "Đơn giá" ở
  `StockBreakdownModal`, và giá trị hiển thị lại khi sửa batch) đều hiển thị **sai giá sau VAT**.

> Đây là phiên bản lặp lại/lặp lại một phần của `BE-yeu-cau-28-8-26.md` mục 1.2 và 6.2 (Bug FE-INV-001, P0)
> — vẫn chưa được khắc phục triệt để ở endpoint `POST /v1/inventory/items` (không chỉ riêng `/batches`).

## 1.3 Yêu cầu

Quy tắc bắt buộc cho **tất cả** endpoint tạo batch:
- `POST /v1/inventory/items` (tạo item kèm batch ban đầu)
- `POST /v1/inventory/items/{id}/batches`
- `POST /v1/inventory/entries`

1. **Lưu đúng `vatRate`** nhận được từ payload (không mặc định `0`).
2. **Tính và lưu đúng `unitPriceAfterVat`** nếu FE không truyền (hoặc truyền sai):
   - `unitPriceAfterVat = round(unitPriceBeforeVat × (1 + vatRate/100))`.
   - Nếu FE truyền `unitPriceAfterVat`, vẫn kiểm tra tính hợp lệ và ưu tiên giá trị tính toán cho nhất quán.
3. **Lưu `unitPrice` của batch = giá SAU VAT** (`unitPriceAfterVat`) — vì cột "Đơn giá" và "Đơn giá TB (sau VAT)" trên FE đều kỳ vọng giá sau VAT.
4. **Trả về đầy đủ** các field `unitPriceBeforeVat`, `unitPriceAfterVat`, `vatRate`, `unitPrice` đúng giá trị đã lưu.
5. Đơn vị tính thống nhất: `vatRate` là số nguyên % (0–100); `unitPrice` là số nguyên/Decimal tiền VND.

## 1.4 Validate

| Điều kiện | Response |
|-----------|----------|
| `unitPriceBeforeVat < 0` | 400 |
| `vatRate < 0` hoặc `vatRate > 100` | 400 |
| `quantityIn <= 0` | 400 (không tạo bản ghi) |

## 1.5 Test case chấp nhận

- [ ] `POST /inventory/items` với `unitPriceBeforeVat = 8316`, `vatRate = 8`, `unitPriceAfterVat = 8981`
      → response batch trả `vatRate = 8`, `unitPriceAfterVat = 8981`, `unitPrice = 8981`.
- [ ] `GET /v1/inventory/items/{id}` → `avgUnitPrice` = giá sau VAT đúng (8981 khi 1 batch).
- [ ] `POST /inventory/items/{id}/batches` với `vatRate` → persist đúng `vatRate` + tính đúng `unitPriceAfterVat`.
- [ ] `POST /inventory/entries` giữ nguyên hành vi đúng hiện tại (không regression).
- [ ] Sau khi nhập kho 2 lần cùng giá trước VAT + VAT → cột "Đơn giá TB (sau VAT)" hiển thị đúng giá sau VAT của từng batch.
- [ ] Không regression: luồng xuất kho `type:'out'`, soft-delete batch, re-tính `totalStock`/`status`.

## 1.6 Checklist cho backend

- [ ] Sửa `POST /v1/inventory/items` — persist `vatRate`, tính/lưu `unitPriceAfterVat`, `unitPrice` (batch) = giá sau VAT.
- [ ] Sửa `POST /v1/inventory/items/{id}/batches` — persist `vatRate`, tính `unitPriceAfterVat`, `unitPrice`.
- [ ] Đảm bảo response các endpoint trả đủ `unitPriceBeforeVat`, `unitPriceAfterVat`, `vatRate`.
- [ ] Deploy + verify Swagger `/api/docs-json` và FE modul Kho vật phẩm.

---

# 2. `GET /api/v1/projects/:id` — trả `budgetPlanTotal` và `actualCostTotal`

> Ngày: 31/08/2026
> Nguồn: QA/phản hồi FE — màn Chi tiết Dự án (`/projects/:id`), Card "Ngân sách dự án".
> Guideline: "Số kế hoạch & thực tế chưa link lên Chi tiết dự án" (bug 5).

## 2.1 Hiện trạng (đã verify bằng docs-json ngày 31/08)

- Endpoint `GET /api/v1/projects/:id` **tồn tại** (`paths["/api/v1/projects/{id}"].get`).
- Trong OpenAPI `docs-json`, DTO response của project **chỉ khai báo các field cũ**:
  `budgetPlanDirect`, `budgetPlanOverhead`, `actualCostDirect`, `actualCostOverhead`.
- **Không có** `budgetPlanTotal` và `actualCostTotal` trong schema DTO.
- FE hiện phải tự cộng thủ công:
  - `planned = budgetPlanDirect + budgetPlanOverhead`
  - `actual = actualCostDirect + actualCostOverhead`
  → dữ liệu thiếu liên kết với ngân sách tổng hợp từ `BudgetValue` / `ExpenseRecord`+`ExpenseLine` như guideline yêu cầu.

## 2.2 Yêu cầu

Backend bổ sung **2 field phục vụ Card "Ngân sách dự án"** vào response của `GET /api/v1/projects/:id`:

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `budgetPlanTotal` | Decimal | Tổng ngân sách KẾ HOẠCH của dự án. Ưu tiên `budgetPlanDirect` (nếu nhập thủ công), nếu không thì tổng hợp từ bảng `BudgetValue` theo `year`/project của dự án. |
| `actualCostTotal` | Decimal | Tổng THỰC TẾ đã chi, tổng hợp từ `ExpenseRecord`/`ExpenseLine` thuộc dự án đó. |

Quy tắc tính (theo guideline phần "Các cập nhật Backend đã thực hiện"):
1. `budgetPlanTotal`:
   - Nếu `budgetPlanDirect` đã nhập thủ công → dùng `budgetPlanDirect` làm tổng (hoặc `budgetPlanDirect + budgetPlanOverhead` nếu dùng mô hình 2 thành phần).
   - Nếu chưa nhập thủ công → tổng hợp từ bảng `BudgetValue` (category budget) theo `year` tương ứng của dự án.
   - Giá trị hợp lệ: `>= 0`; nếu không có dữ liệu → trả `0` (không trả `null` để FE không nhầm "chưa có" với lỗi).
2. `actualCostTotal`: tổng chi phí thực tế từ `ExpenseLine`/`ExpenseRecord` của dự án.
3. Khai báo 2 field này trong **response DTO / OpenAPI** của `GET /projects/:id` để `docs-json` hiển thị, đồng bộ với spec `frontend-backend-sync/01-projects-tasks.md` mục 5.1.

> FE chỉ hiển thị / tính `% đã tiêu = actualCostTotal / budgetPlanTotal * 100` từ 2 field này (không còn tự cộng thủ công).

## 2.3 Validate / Test case chấp nhận

- [ ] `GET /projects/:id` trả `budgetPlanTotal` và `actualCostTotal` là số `>= 0`.
- [ ] Dự án có ngân sách nhập tay → `budgetPlanTotal` khớp giá trị nhập.
- [ ] Dự án không nhập tay nhưng có `BudgetValue` theo năm → `budgetPlanTotal` = tổng `BudgetValue` (kế hoạch năm).
- [ ] `actualCostTotal` khớp tổng chi phí thực tế của dự án từ `ExpenseLine`.
- [ ] `docs-json` của schema project có khai báo `budgetPlanTotal`, `actualCostTotal`.
- [ ] Không regression: các field cũ `budgetPlanDirect`/`budgetPlanOverhead`/`actualCostDirect`/`actualCostOverhead` vẫn giữ nguyên.

## 2.4 Checklist cho backend

- [ ] Cập nhật `projects.service.ts` – tính `budgetPlanTotal` (ưu tiên nhập tay, fallback `BudgetValue`) và `actualCostTotal` (từ `ExpenseLine`).
- [ ] Khai báo `budgetPlanTotal`, `actualCostTotal` trong response DTO + OpenAPI.
- [ ] Deploy + verify `docs-json` và FE Card "Ngân sách dự án".
