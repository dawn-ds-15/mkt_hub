# Yêu cầu cho Backend — Ngày 06/09/2026

> File tổng hợp các yêu cầu dành cho backend phát sinh ngày 06/09/2026.
>
> Ngày tạo: 06/09/2026
> Nguồn: đối chiếu `USER-FLOW-04-Expense-Management.md` (v1.3, ngày 05/09/2026) với module
> Chi phí (`/expense`) hiện tại. File mô tả **mô hình mới 2 tầng kế hoạch (Annual Plan + Project Plan)
> + bản ghi Actual có trạng thái Draft/Confirmed/Cancelled**.
> Link: `03-expense-management.md`, `category-budget-api.md`, `BE-yeu-cau-1-9-26.md` (đã có ngân sách hạng mục).
>
> Hiện trạng BE: chưa có Annual Plan versioning, chưa có Project Expense Plan baseline, chưa có
> `status`/`recognized_date`/`is_unplanned`/`cancelled_at` cho bản ghi chi phí.

---

## Mục lục

- [1. Schema dữ liệu mới](#1-schema-dữ-liệu-mới)
- [2. API Annual Expense Plan](#2-api-annual-expense-plan)
- [3. API Project Expense Plan](#3-api-project-expense-plan)
- [4. API Actual Expense (Draft/Confirmed/Cancelled)](#4-api-actual-expense)
- [5. API Tổng quan & drill-down](#5-api-tổng-quan--drill-down)
- [6. Quy tắc nghiệp vụ / validation](#6-quy-tắc-nghiệp-vụ--validation)
- [7. Phân quyền](#7-phân-quyền)
- [8. Test case chấp nhận](#8-test-case-chấp-nhận)

---

# 1. Schema dữ liệu mới

## 1.1 `annual_expense_plans` — Kế hoạch chi phí năm (versioned)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID | PK |
| year | INT | Năm tài chính (2026) |
| version | INT | Số bản; tăng dần trong cùng năm |
| name | VARCHAR(255) | Tên bản kế hoạch (tự nhập) |
| status | ENUM('draft','active','archived') | 1 năm chỉ có **tối đa 1 bản `active`** |
| activated_at | TIMESTAMP NULL | Lúc kích hoạt |
| replaced_by_version | INT NULL | Bản thay thế (sau khi activate bản mới) |
| created_by | UUID | FK → users |
| created_at / updated_at | TIMESTAMP | |

**Ràng buộc:** `UNIQUE(year, version)`; partial unique `UNIQUE(year) WHERE status = 'active'`.

## 1.2 `annual_expense_plan_items` — Items trong bản kế hoạch năm

Kế thừa cấu trúc cây 3 tầng hiện có (`budget_categories` → `budget_subcategories` → `budget_items`) nhưng **gắn vào một bản plan cụ thể**:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID | PK |
| plan_id | UUID | FK → annual_expense_plans.id |
| level | INT | 1 = L1, 2 = L2, 3 = hạng mục chi tiết (detail) |
| parent_id | UUID NULL | FK → annual_expense_plan_items.id (cấp mẹ) |
| name | VARCHAR(255) | Tên hạng mục |
| sort_order | INT | Thứ tự trong cùng parent |
| amount | DECIMAL(15,2) NULL | **Chỉ nhập ở level 3 (detail)**; L1/L2 tự tổng hợp từ con |
| is_active | BOOLEAN | |

**Quy tắc:** `amount` chỉ cho phép nhập ở khóa chi tiết (level 3). Tổng L2 = Σ chi tiết con; tổng L1 = Σ L2 con.

> ⚠️ Chờ BA quyết định: vai trò hàng **BACK UP** (percent riêng, `budget_values.is_backup`) và cơ chế phân bổ **%** của ngân sách hiện tại trong model versioned này. Mục 2.2/5 có tham chiếu để BE định hình cấu trúc.

## 1.3 `project_expense_plans` + `project_expense_plan_items` — Kế hoạch chi phí dự án

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id (plan) | UUID | PK |
| project_id | UUID | FK → projects, UNIQUE |
| year | INT | Năm của kế hoạch |
| total_plan | DECIMAL(15,2) | Tổng kế hoạch (tính từ items) |
| note | TEXT NULL | |
| created_at / updated_at | TIMESTAMP | |

| Cột (item) | Kiểu | Ghi chú |
|---|---|---|
| id | UUID | PK |
| plan_id | UUID | FK → project_expense_plans.id |
| source | ENUM('template','custom') | Nhập từ template hoặc hạng mục tùy chỉnh |
| template_id | UUID NULL | Nếu từ template |
| name | VARCHAR(255) | Tên hạng mục / item tùy chỉnh |
| plan_amount | DECIMAL(15,2) | Tiền dự kiến |
| note | TEXT NULL | |
| sort_order | INT | |

**Độc lập:** Project Plan **không** map vào Annual Plan; giữ nguyên kể cả khi dự án bị huỷ.

## 1.4 Mở rộng `expenses` — bản ghi chi phí thực tế

| Cột | Kiểu | Ghi chú |
|---|---|---|
| status | ENUM('draft','confirmed','cancelled') | Mặc định gì tùy luồng; **có** trường này |
| recognized_date | DATE | Ngày phát sinh/ghi nhận |
| is_unplanned | BOOLEAN | false = trong kế hoạch dự án; true = phát sinh ngoài |
| project_expense_item_id | UUID NULL | FK → project_expense_plan_items.id; **NULL khi is_unplanned** |
| unplanned_item_name | VARCHAR(255) NULL | Tên hạng mục tự nhập khi is_unplanned |
| annual_expense_item_id | UUID NULL | FK → annual_expense_plan_items.id (level 3) — map khi Confirm |
| supplier_id | UUID NULL | FK → suppliers (nếu có) |
| supplier_name | VARCHAR(255) NULL | Tên nhà cung cấp (free-text nếu chưa có master data) |
| receipt_url | TEXT NULL | Chứng từ/hợp đồng |
| cancelled_at | TIMESTAMP NULL | Khi cancel bản ghi |
| cancelled_by | UUID NULL | |
| cancelled_reason | TEXT NULL | |
| confirmed_at | TIMESTAMP NULL | |
| confirmed_by | UUID NULL | |

**Audit trail:** bảng `expense_audit_logs` lưu lịch sử đổi trạng thái / thay đổi bản ghi actual (action, expense_id, from_status, to_status, changed_by, at, snapshot).

**Lưu ý chuyển đổi:** hiện planned/contract vẫn được FE giữ trong localStorage (`utils/expenseMeta.js`). Khi BE có các cột trên, FE sẽ bỏ localStorage và lưu hết vào đây — cần BE khai báo đủ cột `plannedAmount`/`contractFile`...(hoặc tương đương) nếu chưa có.

---

# 2. API Annual Expense Plan

## 2.1 `GET /v1/annual-plans?year=2026`

Danh sách bản kế hoạch của năm.

```json
{
  "data": [
    {
      "id": "plan_01",
      "year": 2026,
      "version": 3,
      "name": "Bản 2026 v3",
      "status": "active",
      "activatedAt": "2026-09-05T10:00:00Z",
      "replacedByVersion": null,
      "totalPlan": 114529560
    }
  ]
}
```

## 2.2 `POST /v1/annual-plans`

Body: `{ "year": 2026, "name": "Bản 2026 v3", "template": { "fromPlanId"?: "plan_01", "cloneTree": true } }`.

- Tạo bản `status = draft`, `version = max(version) + 1` của năm.
- Không tạo mới nếu năm đã có bản `draft` chưa đóng? → **quyết định đơn giản hóa**: cho phép nhiều `draft`, chỉ giới hạn `active` = 1 (bàn lại với BA nếu cần).
- Optional `cloneTree` sao chép toàn bộ cây nguồn sang bản mới.

## 2.3 `GET /v1/annual-plans/:id/tree`

Toàn bộ cây: L1 → L2 → detail của bản plan; trả `totalPlan` mỗi cấp.

```json
{
  "data": {
    "id": "plan_01",
    "year": 2026,
    "version": 3,
    "status": "active",
    "tree": [
      {
        "id": "l1_01", "name": "Budget Brand Marketing", "level": 1, "totalAmount": 40000000,
        "children": [
          {
            "id": "l2_01", "name": "I. BRAND MARKETING", "level": 2, "totalAmount": 40000000,
            "children": [
              { "id": "detail_01", "name": "Campaign", "level": 3, "amount": 10000000 },
              { "id": "detail_02", "name": "Ra mắt sản phẩm mới nhỏ", "level": 3, "amount": 30000000 }
            ]
          }
        ]
      }
    ]
  }
}
```

## 2.4 `PUT /v1/annual-plans/:id/items` — nhập ngân sách (chỉ level 3)

Body:
```json
{
  "year": 2026,
  "items": [
    { "itemId": "detail_01", "amount": 10000000 }
  ]
}
```

- **Chặn nếu `status != draft`** (bản đã active chỉ đọc).
- Chặn nếu `item.level != 3` (không nhập budếct ở L1/L2).
- BE tự tổng hợp lại L1/L2 và `totalPlan`.

## 2.5 `POST /v1/annual-plans/:id/activate`

- Chuyển bản này → `active`, set `activated_at`.
- Bản `active` cũ của cùng năm → `archived`, `replaced_by_version = version mới`.
- Nếu chưa có bản `active` nào cho năm → kích hoạt bình thường.
- Chặn nếu params thiếu (vd. không có hạng mục chi tiết nào được nhập amount).

## 2.6 `GET /v1/annual-plans/active?year=2026`

Bản `active` của năm (dùng khi nhập actual để map Annual). Trả `404` nếu chưa có bản active.

---

# 3. API Project Expense Plan

## 3.1 `GET /v1/projects/:projectId/expense-plan`

```json
{
  "data": {
    "projectId": "prj_01",
    "year": 2026,
    "totalPlan": 50000000,
    "totalActual": 12000000,
    "variance": 38000000,
    "items": [
      { "id": "item_01", "source": "template", "templateId": "tpl_1", "name": "Tổ chức sự kiện", "planAmount": 30000000, "note": null, "sortOrder": 1 },
      { "id": "item_02", "source": "custom", "templateId": null, "name": "Quà tặng khách hàng", "planAmount": 20000000, "note": "Nhập tay", "sortOrder": 2 }
    ]
  }
}
```

## 3.2 `PUT /v1/projects/:projectId/expense-plan`

Body: items đầy đủ (`year`, `items[{source, templateId?, name, planAmount, note}]`). BE upsert theo item id / thay cả set.

## 3.3 Lưu ý

- Project Plan độc lập, **không** bắt buộc Annual Plan.
- Không chọn nhóm chi phí năm ở mức này (khác với form hiện tại chỉ có `hangMucLon` cấp 1).

---

# 4. API Actual Expense

## 4.1 `GET /v1/expenses/actuals`

Query: `status`, `projectId`, `year`, `month`, `recognizedDateFrom`, `recognizedDateTo`, `isUnplanned`, `page`, `perPage`.

```json
{
  "data": [
    {
      "id": "exp_01",
      "projectId": "prj_01",
      "status": "draft",
      "recognizedDate": "2026-09-06",
      "isUnplanned": false,
      "projectExpenseItemId": "item_01",
      "projectExpenseItemName": "Tổ chức sự kiện",
      "annualExpenseItemId": "detail_01",
      "annualPath": "Budget Brand Marketing / I. BRAND MARKETING / Campaign",
      "directCost": 10000000,
      "overhead": 0,
      "supplierName": "Công ty X",
      "receiptUrl": null,
      "lines": [...]
    }
  ]
}
```

## 4.2 `POST /v1/expenses` — tạo bản ghi actual

Body (mở rộng từ form hiện tại):
```json
{
  "projectId": "prj_01",
  "recognizedDate": "2026-09-06",
  "isUnplanned": false,
  "projectExpenseItemId": "item_01",
  "annualExpenseItemId": "detail_01",
  "action": "draft" | "confirm",
  "lines": [
    {
      "name": "In ấn POSM", "actualQty": 100, "actualUnitPrice": 50000,
      "inventoryItemId": "...", "expenseCategory": "..."
    }
  ],
  "directCost": 5000000,
  "overhead": 0,
  "supplierName": "...",
  "receiptUrl": "..."
}
```

Quy tắc:
- `isUnplanned = true` → `projectExpenseItemId = null`, bắt buộc `unplannedItemName`.
- `action = confirm` → phải có **Annual Plan active** của năm `recognizedDate` (`annualExpenseItemId` bắt buộc).
- `action = draft` → lưu mặc định `status = draft`, không cần annual item.

## 4.3 `PATCH /v1/expenses/:id/confirm`

Chuyển `draft → confirmed`. Re-validate như chặn ở 4.2. Set `confirmed_at/confirmed_by`.

## 4.4 `POST /v1/expenses/:id/cancel`

Chỉ `confirmed → cancelled`. Giữ lại bản ghi (không xóa), set `cancelled_at`, `cancelled_by`, `cancelled_reason`; ghi audit log. Draft bị xóa thì dùng `DELETE` như hiện tại.

## 4.5 `DELETE /v1/expenses/:id`

Giữ nguyên hành vi (xóa draft / bản ghi), `cancelled` không xóa được.

---

# 5. API Tổng quan & drill-down

## 5.1 `GET /v1/expenses/overview/tree/annual?year=2026`

Cây **Annual** với số đo 4 cột cho mỗi hạng mục: `plan`, `actual`, `remaining`, `spendPct`.

```json
{
  "data": {
    "period": "2026",
    "nodes": [
      {
        "id": "l1_01", "name": "Budget Brand Marketing", "level": 1,
        "plan": 40000000, "actual": 8800000, "remaining": 31200000, "spendPct": 22,
        "children": [ { "...": "..." } ]
      }
    ]
  }
}
```

## 5.2 `GET /v1/expenses/overview/tree/project?projectId=&year=`

Cây **Project**: project → project item, số `plan/actual/variance`.

## 5.3 `GET /v1/expenses/actuals/:id`

**Click vào số tiền → danh sách bản ghi cấu thành.** Chi tiết 1 bản ghi actual: ngày, dự án, hạng mục (annual path + project item), nhóm chi phí, chứng từ, trạng thái, lịch sử (audit).

`GET /v1/expenses?month=&year=&annualExpenseItemId=` (hoặc `projectExpenseItemId=`) trả các bản ghi đã `confirmed` cấu thành con số đó.

## 5.4 Lưu ý nguồn số liệu

- `annual.actual` = Σ actual **confirmed** của năm map vào annual item (không gồm draft/cancelled).
- `project.actual` = Σ actual **confirmed** của project.
- `variance` = plan − actual (có thể âm, không clamp).

---

# 6. Quy tắc nghiệp vụ / validation

| # | Quy tắc | Mã trả về |
|---|---|---|
| 1 | 1 năm chỉ 1 Annual Plan `active` | 409 khi activate trùng |
| 2 | Nhập budget chỉ ở hạng mục chi tiết (level 3) | 422 |
| 3 | Chỉnh sửa bản `active`/`archived` bị chặn (dùng bản mới clone) | 403 |
| 4 | Confirm actual khi chưa có Annual Plan active cho năm → báo rõ | 422 (`ERR_ANNUAL_PLAN_NOT_ACTIVE`) |
| 5 | Confirm actual cần `annualExpenseItemId` + `recognizedDate` | 422 |
| 6 | `is_unplanned=true` thì `projectExpenseItemId=null` + có `unplannedItemName` | 422 |
| 7 | Dự án đã `cancelled`: chỉ cho nhập actual với `recognizedDate ≤ cancelledAt` | 422 (`ERR_RECOGNIZED_AFTER_CANCELLED`) |
| 8 | `confirmed` → edit hoặc cancel phải có lý do + audit log | 400 nếu thiếu reason |
| 9 | Draft không được tính vào `actual` (overview/khác) | — |

Trả lỗi per field khi có thể (thống nhất kiểu `{ message, errors[] }` như budget ở `BE-yeu-cau-1-9-26.md` mục 7).

---

# 7. Phân quyền

Trả block `permissions` trên các endpoint liên quan (tối thiểu `GET /v1/expenses/actuals`, `POST /v1/expenses`, `POST /v1/annual-plans/:id/activate`):

```json
"permissions": {
  "view": true,
  "createDraft": true,
  "confirm": false,
  "cancel": false,
  "managePlans": false
}
```

- `createDraft` — Specialist được cấp quyền nhập (tạo Draft).
- `confirm` / `cancel` — theo cấu hình (mặc định chỉ Manager).
- `managePlans` — tạo/kích hoạt bản kế hoạch năm.
- Không cấu hình → mặc định `true` (không regression, trừ khi chính sách khác).

---

# 8. Test case chấp nhận

- [ ] Tạo 2 bản draft → activate 1 → bản kia vẫn draft; `GET active` trả đúng 1 bản; activate bản khác → bản cũ `archived` + `replacedByVersion` đúng.
- [ ] Tree plan: nhập amount ở detail → L1/L2/totalPlan tự tổng; từ chối nhập amount ở L1/L2.
- [ ] Project plan CRUD không bắt buộc Annual; project cancelled vẫn đọc được plan/actual/variance.
- [ ] Confirm actual không có Annual active → `ERR_ANNUAL_PLAN_NOT_ACTIVE`.
- [ ] Create drag với `is_unplanned=true` và `projectExpenseItemId` → 422.
- [ ] Dự án cancelled, `recognizedDate > cancelledAt` → `ERR_RECOGNIZED_AFTER_CANCELLED`.
- [ ] Draft → confirm → cancel: total actual chỉ đếm `confirmed`; audit log ghi đủ 3 bước.
- [ ] `overview/tree/annual` & `.../project`: số `actual` khớp Σ confirmed; variance âm hiển thị đúng.
- [ ] Swagger `/api/docs-json` khai báo đầy đủ: annual-plans, project expense-plan, actuals (status/recognizedDate/isUnplanned), permissions.