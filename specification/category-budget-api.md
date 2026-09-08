# Yêu cầu API: Ngân sách Chi phí theo Hạng mục (Category Budget)

## 1. Tổng quan

Chức năng "Nhập chi phí tổng hạng mục" cho phép quản lý ngân sách marketing theo cấu trúc phân cấp 3 tầng:

```
Category ( Budget Brand Marketing — 11% )
 └─ Subcategory ( I. BRAND MARKETING )
      ├─ Item ( Campaign — nhập 12 tháng )
      ├─ Item ( Ra mắt sản phẩm mới nhỏ — nhập 12 tháng )
      ├─ Item ( New Website — nhập 12 tháng )
      ├─ Item ( Branding online — nhập 12 tháng )
      ├─ BACK UP ( nhập 12 tháng, % riêng )
      └─ TOTAL BRAND MKT (tự tính)
```

Hiện tại dữ liệu chỉ lưu **localStorage** trên trình duyệt — cần BE lưu trữ để share giữa các user và không mất khi clear browser.

---

## 2. Database Schema

### 2.1 `budget_categories` — Hạng mục cấp cao nhất

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID / SERIAL | PK |
| name | VARCHAR(255) | "Budget Brand Marketing" |
| percent | DECIMAL(5,2) | Tỉ lệ % trên tổng budget marketing |
| sort_order | INT | Thứ tự hiển thị |
| year | INT | Năm tài chính (2026) |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| archived_at | TIMESTAMP NULL | Soft-delete |

### 2.2 `budget_subcategories` — Hạng mục con

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID / SERIAL | PK |
| category_id | UUID / INT | FK → budget_categories.id |
| name | VARCHAR(255) | "I. BRAND MARKETING" |
| total_name | VARCHAR(255) | "TOTAL BRAND MKT" — dòng tổng |
| backup_percent | DECIMAL(5,2) | Tỉ lệ % dòng BACK UP |
| sort_order | INT | |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| archived_at | TIMESTAMP NULL | |

### 2.3 `budget_items` — Dòng chi tiết nhập liệu

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID / SERIAL | PK |
| subcategory_id | UUID / INT | FK → budget_subcategories.id |
| name | VARCHAR(255) | "Campaign", "Google Ads" |
| sub_count | INT NULL | Số dòng con (ví dụ "Ra mắt sản phẩm mới nhỏ" có sub_count = 2) |
| sort_order | INT | |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| archived_at | TIMESTAMP NULL | |

### 2.4 `budget_values` — Giá trị ngân sách theo tháng

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID / SERIAL | PK |
| item_id | UUID / INT NULL | FK → budget_items.id. **NULL nếu là dòng BACK UP** |
| is_backup | BOOLEAN | true = dòng BACK UP, false = dòng item thường |
| year | INT | |
| month | INT | 1–12 |
| amount | DECIMAL(15,2) | Số tiền nhập |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Unique constraint:** `(item_id, is_backup, year, month)` hoặc `(item_id, year, month)` nếu tách backup thành bảng riêng.

---

## 3. API Endpoints

### 3.1 Budget Categories

#### `GET /v1/expense-budgets/categories`

Query: `?year=2026`

Response:
```json
{
  "data": [
    {
      "id": "cat_01",
      "name": "Budget Brand Marketing",
      "percent": 11,
      "sortOrder": 1,
      "year": 2026,
      "isActive": true
    }
  ]
}
```

#### `POST /v1/expense-budgets/categories`

Body:
```json
{
  "name": "Budget Brand Marketing",
  "percent": 11,
  "sortOrder": 1,
  "year": 2026
}
```

Response: `{ "data": { "id": "cat_01", ... } }`

#### `PATCH /v1/expense-budgets/categories/:id`

Body: `{ "name": "...", "percent": 15, "sortOrder": 2 }`

#### `DELETE /v1/expense-budgets/categories/:id`

Soft-delete: set `archived_at = now()`.

---

### 3.2 Budget Subcategories

#### `GET /v1/expense-budgets/subcategories`

Query: `?categoryId=cat_01`

Response:
```json
{
  "data": [
    {
      "id": "sub_01",
      "categoryId": "cat_01",
      "name": "I. BRAND MARKETING",
      "totalName": "TOTAL BRAND MKT",
      "backupPercent": 10,
      "sortOrder": 1
    }
  ]
}
```

#### `POST /v1/expense-budgets/subcategories`

Body:
```json
{
  "categoryId": "cat_01",
  "name": "I. BRAND MARKETING",
  "totalName": "TOTAL BRAND MKT",
  "backupPercent": 10,
  "sortOrder": 1
}
```

#### `PATCH /v1/expense-budgets/subcategories/:id`

#### `DELETE /v1/expense-budgets/subcategories/:id`

---

### 3.3 Budget Items

#### `GET /v1/expense-budget-items`

Query: `?subcategoryId=sub_01`

Response:
```json
{
  "data": [
    {
      "id": "item_01",
      "subcategoryId": "sub_01",
      "name": "Campaign",
      "subCount": null,
      "sortOrder": 1
    },
    {
      "id": "item_02",
      "subcategoryId": "sub_01",
      "name": "Ra mắt sản phẩm mới nhỏ (online)",
      "subCount": 2,
      "sortOrder": 2
    }
  ]
}
```

#### `POST /v1/expense-budget-items`

Body:
```json
{
  "subcategoryId": "sub_01",
  "name": "Campaign",
  "subCount": null,
  "sortOrder": 1
}
```

#### `PATCH /v1/expense-budget-items/:id`

#### `DELETE /v1/expense-budget-items/:id`

---

### 3.4 Budget Values (dữ liệu 12 tháng)

#### `GET /v1/expense-budgets/values`

Query: `?year=2026`

Trả về **toàn bộ tree** để FE render bảng:
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
            "backup": {
              "percent": 10,
              "months": { "1": 5000000, "2": 3000000, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 }
            },
            "items": [
              {
                "id": "item_01",
                "name": "Campaign",
                "subCount": null,
                "months": { "1": 10000000, "2": 8000000, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### `PUT /v1/expense-budgets/values`

Bulk save toàn bộ giá trị cho 1 năm. Gửi khi bấm **"Lưu thay đổi"**.

Body:
```json
{
  "year": 2026,
  "values": [
    {
      "itemId": "item_01",
      "isBackup": false,
      "month": 1,
      "amount": 10000000
    },
    {
      "itemId": null,
      "subcategoryId": "sub_01",
      "isBackup": true,
      "month": 1,
      "amount": 5000000
    }
  ]
}
```

BE thực hiện **upsert**: nếu đã có record `(itemId, year, month)` thì update amount, nếu chưa thì insert mới.

---

### 3.5 Bulk Load (tùy chọn, tối ưu)

#### `GET /v1/expense-budgets/tree`

Query: `?year=2026`

Trả về **full tree** tất cả categories + subcategories + items + values trong 1 lần gọi. Endpoint này aggregate từ 4 query trên để FE chỉ cần gọi 1 lần khi mount component.

---

## 4. Dropdown "Hạng mục" trong form nhập chi phí

Hiện tại danh mục chi phí ở `ExpenseEntryForm.jsx` bị hardcode:
- POSM, Quà tặng, Ấn phẩm in, Khác

### Yêu cầu: Thêm dropdown key mới

Sử dụng hệ thống dropdown hiện có (`/v1/data-management/dropdowns`) — thêm key mới:

```
Key: budget_category
Label: "Danh mục chi phí"
Values: ["POSM", "Quà tặng", "Ấn phẩm in", "Khác"]
```

**Không cần viết API mới** — chỉ cần seed data dropdown key mới vào DB. FE sẽ dùng lại API `getDropdownKeys()` hiện có.

---

## 5. Validation Rules

| Field | Rule |
|---|---|
| Category name | Required, max 255 chars, unique trong cùng year |
| Category percent | 0–100, tổng = 100% (optional validate, warning nếu > 100%) |
| Subcategory name | Required, max 255 chars |
| Item name | Required, max 255 chars |
| Backup percent | 0–100 |
| Month value (amount) | ≥ 0, DECIMAL(15,2) |
| sort_order | ≥ 0, unique trong cùng parent |

---

## 6. Seed Data (Data mẫu ban đầu)

```json
{
  "year": 2026,
  "categories": [
    {
      "name": "Budget Brand Marketing", "percent": 11, "sortOrder": 1,
      "subcategories": [
        {
          "name": "I. BRAND MARKETING", "totalName": "TOTAL BRAND MKT", "backupPercent": 10,
          "items": [
            { "name": "Campaign", "sortOrder": 1 },
            { "name": "Ra mắt sản phẩm mới nhỏ (online)", "subCount": 2, "sortOrder": 2 },
            { "name": "New Website", "sortOrder": 3 },
            { "name": "Branding online", "sortOrder": 4 }
          ]
        }
      ]
    },
    {
      "name": "Budget Digital MKT", "percent": 11, "sortOrder": 2,
      "subcategories": [
        {
          "name": "II. DIGITAL MARKETING", "totalName": "TOTAL DIGITAL MKT", "backupPercent": 10,
          "items": [
            { "name": "Google Ads", "sortOrder": 1 },
            { "name": "Facebook Ads", "sortOrder": 2 },
            { "name": "SEO & Content", "sortOrder": 3 }
          ]
        }
      ]
    },
    {
      "name": "Budget Event", "percent": 24, "sortOrder": 3,
      "subcategories": [
        {
          "name": "III. EVENT", "totalName": "TOTAL EVENT", "backupPercent": 10,
          "items": [
            { "name": "Hội nghị khách hàng", "sortOrder": 1 },
            { "name": "Workshop", "sortOrder": 2 },
            { "name": "Triển lãm", "sortOrder": 3 }
          ]
        }
      ]
    }
  ]
}
```

---

## 7. timeline Ước tính

| Phase | Nội dung | Ước tính |
|---|---|---|
| 1 | Tạo 4 bảng migration + seed data | 0.5 ngày |
| 2 | CRUD APIs categories/subcategories/items | 1 ngày |
| 3 | Bulk values GET/PUT | 1 ngày |
| 4 | Dropdown key `budget_category` | 0.5 ngày |
| **Tổng** | | **3 ngày** |

---

## 8. 🔶 Thay đổi 08/09/2026 — Bảng CHỈ còn cấp Category (bỏ subcategory/item trong UI)

> FE tab "Nhập chi phí tổng hạng mục" **không còn** dòng nhóm con (`subcategory`) và hạng mục nhỏ (`item`), không còn hàng BACK UP, không còn nút thêm nhóm con/hạng mục nhỏ. Bảng chỉ còn **nhóm lớn (category)** với 12 tháng Kế hoạch + Tổng KH.

### 8.1 Đọc — `GET /v1/expense-budgets/tree`

- FE chỉ dùng `categories[]`; trả thêm **`months` ở cấp category**:

```json
{
  "data": {
    "categories": [
      {
        "id": "cat_01",
        "name": "Budget Brand Marketing",
        "percent": 11,
        "months": { "1": 10000000, "2": 20000000 }
      }
    ]
  }
}
```

- `categories[].subcategories`/`items` có thể giữ trong response (FE bỏ qua) — không bắt buộc xóa.

### 8.2 Lưu — `PUT /v1/expense-budgets/values`

- Body tối thiểu: `{ year, projectId?, baseUpdatedAt?, values: [{ categoryId, month, amount }] }`.
- `categoryId` trỏ tới `budget_categories.id`; upsert theo `(categoryId, projectId, year, month)`.
- ⚠️ `projectId` chỉ nhận **UUID** (hoặc thiếu → `project_id IS NULL`). **Không gửi** giá trị `"all"` (BE hiện 400 "projectId must be a UUID"). FE tự chọn 1 dự án cụ thể (dự án đầu tiên) để ghi khi lưu; đọc vẫn dùng `projectId=all` để gộp toàn hệ thống.
- Ví dụ:

```json
{
  "year": 2026,
  "projectId": "<uuid-dự-án>",
  "values": [
    { "categoryId": "cat_01", "month": 1, "amount": 10000000 },
    { "categoryId": "cat_01", "month": 2, "amount": 20000000 }
  ]
}
```

### 8.3 Lỗi per-cell (`400`) — `CellValidationErrorDto` thêm `categoryId`

```json
{ "categoryId": "cat_01", "month": 3, "message": "amount không được âm" }
```

### 8.4 Test chấp nhận

- [ ] `GET tree?year` trả `months` cấp category (≥ 1 năm).
- [ ] `PUT values` với `categoryId` upsert đúng cấp category; không đụng item/subcategory cũ.
- [ ] `PUT values` với `projectId` UUID hoặc thiếu → hợp lệ; với `projectId=all` → **400** "projectId must be a UUID" (FE không gửi `all`).
- [ ] Lỗi validation trả `categoryId` + `month` để FE gắn đúng ô.
