# Yêu cầu BE — Rollup chi phí từ Expense Lines lên Header

**Ngày:** 11/09/2026
**Người gửi:** FE Team
**Ưu tiên:** Cao

---

## Vấn đề

Khi tạo Expense có lines (chi tiết), BE trả về `directCost` và `overheadCost` tại expense header bằng **0**, thay vì tổng hợp từ các line con.

### Dữ liệu thực tế (Project "test")

```json
// Expense header
{
  "directCost": 0,
  "overheadCost": 0
}

// Expense lines
{
  "lines": [{
    "name": "Smartlog leaflet",
    "categoryId": "51e82427-...",
    "hangMucLon": "backup",
    "totalAmount": 8316,
    "actualAmount": 8316,
    "unitPriceAfterVat": 8316,
    "quantity": 1
  }]
}
```

→ `directCost = 0` trong khi line có `totalAmount = 8316`. FE hiển thị sai "Đã tiêu: 0 đ".

---

## Yêu cầu

### 1. Rollup khi tạo/sửa Expense có lines

Khi Expense có `lines[]`, BE cần tự động tính:

```
directCost = SUM(lines[].totalAmount)  // hoặc actualAmount nếu đã xác nhận
overheadCost = 0  // (nếu không phân loại overhead ở line level)
```

Và set vào expense header trước khi lưu / trả về response.

### 2. Rollup khi GET Expense / Expense List

API `GET /v1/expenses` và `GET /v1/expenses/:id` cần trả về `directCost` và `overheadCost` đã được rollup từ lines.

### 3.backward compatibility

- Expense cũ (không có lines): giữ nguyên giá trị `directCost` / `overheadCost` hiện tại
- Expense mới (có lines): rollup từ lines

---

## Ảnh hưởng

| API | Endpoint | Thay đổi |
|-----|----------|----------|
| Create Expense | `POST /v1/expenses` | Rollup `directCost` từ `lines[].totalAmount` |
| Update Expense | `PUT /v1/expenses/:id` | Rollup lại khi lines thay đổi |
| Get Expense List | `GET /v1/expenses` | Trả về `directCost` đã rollup |
| Get Expense Detail | `GET /v1/expenses/:id` | Trả về `directCost` đã rollup |

---

## FE Workaround (tạm thời)

FE đang fallback đọc `lines[].actualAmount` khi `directCost = 0`. Sau khi BE fix, FE sẽ bỏ workaround này.

---

# Yêu cầu BE — Opportunities missing fields

**Ngày:** 11/09/2026
**Người gửi:** FE Team
**Ưu tiên:** Cao

## Vấn đề

API `GET /v1/leads-kpis/weekly?year=2026` trả về opportunities nhưng **thiếu 2 field**:

### Dữ liệu thực tế từ BE

```json
{
  "opportunities": [{
    "id": "f62cfc80-...",
    "companyName": "CONG TY CP DAT MOI VIET NHAT",
    "size": "Enterprise",
    "projectId": "e73d7aee-...",
    "projectName": "LEAD GENERATION 2026",
    "setupFee": 868000000,
    "expectedCloseDate": "2026-08-09",
    "status": "active"
  }]
}
```

**Thiếu:**
- `contractName` — FE gửi khi tạo/sửa nhưng BE không lưu/return
- `initiationDate` — FE gửi khi tạo/sửa nhưng BE không lưu/return

### Ảnh hưởng FE

- Cột **Hợp đồng** luôn hiển thị rỗng (sau khi reload)
- Cột **Ngày bắt đầu** luôn hiển thị rỗng (sau khi reload)
- FE đã gửi đúng khi save (`contractName`, `initiationDate` trong body POST/PATCH)

## Yêu cầu

### 1. Lưu `contractName` và `initiationDate` khi tạo/sửa

```
POST /v1/leads-kpis/opportunities
PATCH /v1/leads-kpis/opportunities/:id
```

Nhận `contractName` và `initiationDate` từ body và lưu vào DB.

### 2. Trả về `contractName` và `initiationDate` khi GET

```
GET /v1/leads-kpis/weekly?year=
```

Opportunities object cần include `contractName` và `initiationDate` trong response.

---

# Yêu cầu BE — Comparison API actuals không khớp với Dashboard API

**Ngày:** 11/09/2026
**Người gửi:** FE Team
**Ưu tiên:** Cao

## Vấn đề

Tab **So sánh kỳ** (dùng `GET /v1/leads-kpis/comparison`) hiển thị số liệu **actual** khác hoàn toàn so với tab **Xem & Phân tích** (dùng `GET /v1/dashboard/kpi-cards`) cho cùng kỳ/period.

### Dữ liệu thực tế: Q1 2026

| Chỉ tiêu | `comparison.actual` | `kpi-cards.actual` | Plan (khớp) |
|----------|--------------------:|-------------------:|------------:|
| rawLeads | 7 | 84 | 112 |
| mql | 7 | 65 | 70 |
| sql | 3 | 27 | 28 |

Plan giống nhau nhưng actual lệch nhau **~12x**. Hai endpoint calculation logic khác nhau.

## Yêu cầu

- `GET /v1/leads-kpis/comparison` phải dùng **cùng nguồn dữ liệu actual** với `GET /v1/dashboard/kpi-cards`
- Xác nhận 1 định nghĩa duy nhất cho: Raw Leads, MQL, SQL, OPP, Closed Deal, Pipeline Value, Won Value

---

# Yêu cầu BE — Khôi phục persist giá trị nhóm con / hạng mục con / BACK UP

**Ngày:** 11/09/2026
**Người gửi:** FE Team
**Ưu tiên:** Cao

## Vấn đề

Theo thay đổi 08/09/2026 (`specification/category-budget-api.md` mục 8), BE `PUT /v1/expense-budgets/values` chỉ persist giá trị **cấp category** (upsert theo `categoryId`). Nhóm con (`subcategory`) / hạng mục nhỏ (`item`) / BACK UP **không còn được lưu** — dù FE gửi đúng contract cũ (spec mục 3.4), PUT báo thành công nhưng `GET /v1/expense-budgets/tree` vẫn trả `backup.months = 0` và `items[].months = 0`.

### Test thực tế (11/09/2026)

Gửi `PUT /v1/expense-budgets/values` (year 2026):
```json
{
  "year": 2026,
  "values": [
    { "categoryId": "51e82427-...",           "month": 3, "amount": 100 },
    { "subcategoryId": "b66b6f5d-...", "isBackup": true,  "month": 3, "amount": 200 },
    { "itemId": "4a99125b-...",       "isBackup": false, "month": 3, "amount": 300 }
  ]
}
```
→ Response: `{ created: 3, updated: 0 }` nhưng `GET tree?year=2026` trả: category `months.3=100`, subcategory `backup.months.3=0`, item `months.3=0`.

Ngoài ra: dòng `{ subcategoryId, month, amount }` (không kèm `itemId`/`categoryId`) bị 400 — *"itemId hoặc categoryId là bắt buộc đối với dòng dữ liệu kế hoạch"*.

## Yêu cầu

### 1. `PUT /v1/expense-budgets/values` persist giá trị cấp con

- Dòng `{ itemId, isBackup: false, month, amount }` → upsert giá trị **item** (Kế hoạch hạng mục nhỏ).
- Dòng `{ itemId: null, subcategoryId, isBackup: true, month, amount }` → upsert giá trị **BACK UP** của nhóm con.
- Dòng chuẩn target (cấp nhóm lớn): `{ categoryId, month, amount }` — giữ nguyên.
- Upsert key: `(itemId, projectId, year, month)` cho item; `(subcategoryId, projectId, year, month, isBackup=true)` cho BACK UP (theo spec mục 3.4 / `BE-yeu-cau-28-8-26.md`).
- KHÔNG bỏ qua lặng lẽ dòng cấp con (không trả `created` khi thực chất không lưu). Hoặc xử lý đúng hoặc trả 400 rõ ràng.

### 2. `GET /v1/expense-budgets/tree` trả đúng giá trị đã lưu

- `subcategories[].backup.months` = tổng BACK UP theo tháng (lưu từ yêu cầu 1).
- `subcategories[].items[].months` = Kế hoạch hạng mục nhỏ theo tháng.
- `subcategories[].planTotal` / `items[].planTotal` phải cộng đúng từ `months`.
- Giữ nguyên `categories[].months` (cấp nhóm lớn) như hiện tại.

### 3. Validation per-cell

- `CellValidationErrorDto` cần đính kèm `subcategoryId` / `itemId` + `month` để FE gắn đúng ô nhóm con khi 400 (hiện FE chỉ map được `categoryId`).

## Ảnh hưởng FE

- `CategoryBudgetEntry.jsx` (subtab "Nhập chi phí tổng hạng mục") đã khôi phục UI 3 tầng (category → nhóm con → hạng mục nhỏ + hàng BACK UP) và gửi `values[]` gồm cả `categoryId` + `subcategoryId isBackup` + `itemId` trong 1 lần PUT.
- Cho tới khi BE fix, giá trị ô nhóm con / BACK UP sau khi lưu sẽ trở về 0 sau khi reload tree — FE đã ghi nhận là hạn chế tạm thời.
