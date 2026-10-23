# Yêu cầu BE — 16/09/2026

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Mục tiêu:** Cho phép admin **xem / sửa / xoá / thêm mới** các mẫu checklist (workshop, triển lãm, webinar...) trực tiếp trên hệ thống. Bản mẫu sau khi cập nhật được áp cho **dự án tạo mới** (khi tạo dự án chọn mẫu checklist). Hiện BE chỉ có **đọc** (`GET`), chưa có endpoint **ghi** → cần bổ sung.

---

## 1. Hiện trạng & ràng buộc giữ nguyên

### 1.1. `GET /v1/projects/checklist-templates` (đã có — KHÔNG đổi shape)

Trả về:

```jsonc
{
  "templates": [
    {
      "key": "exhibition",               // chuỗi duy nhất, dùng làm templateType khi tạo dự án
      "name": "Checklist Triển lãm",
      "appliesToTypes": ["Exhibition", "EXHIBITION", "Fair"],  // khớp KHÔNG phân biệt hoa/thường
      "leadTimeDays": 75,                // số nguyên >= 0
      "totalTasks": 59,                  // KHÔNG lưu – BE tính = tasks.length khi trả về
      "tasks": [
        {
          "group": "ĐĂNG KÝ & HỢP ĐỒNG",
          "name": "Ký hợp đồng thuê gian hàng",
          "description": "",                                     // chuỗi rỗng nếu không có
          "priority": "High",                                    // "High" | "Medium" | "Low"
          "stakeholders": "",                                    // chuỗi các code, phân cách bởi , ; |
          "daysBeforeDeadline": 60,                              // số nguyên >= 0
          "startOffset": "T-75 ngày",                            // chuỗi hiển thị, có thể có cả 2
          "endOffset": "T-60 ngày"
        }
      ]
    }
  ],
  "stakeholderOptions": [ { "code": "PM", "label": "Project Manager" } ]
}
```

### 1.2. `POST /v1/projects` với `applyTemplate` (đã có — KHÔNG đổi hành vi)

- `type` khớp template + `applyTemplate:true` + `templateType:key` → sinh đúng `N` task từ template trong 1 transaction.
- `type` khớp + `applyTemplate:true` **không gửi** `templateType` → fallback tự chọn template theo `type`.
- `type` KHÔNG khớp template + gửi `applyTemplate` → 400 (giữ nguyên).
- **Quan trọng:** đảm bảo sau khi template bị **sửa/xoá** qua các endpoint mới ở mục 2, luồng tạo dự án vẫn hoạt động như trên (task đã sinh cho dự án cũ là **snapshot**, không bị ảnh hưởng; `appliesToTypes` vẫn không phải enum cứng — không chặn loại dự án mới).

---

## 2. Endpoint mới cần bổ sung (CRUD mẫu checklist)

Tất cả đều cần phân quyền **manager/admin** (cùng nhóm quyền quản lý cấu hình Data Management), trả 200/201 cùng object template vừa ghi, trả 404 khi key không tồn tại, trả 400 kèm message tiếng Việt khi validate lỗi.

### 2.1. `POST /v1/projects/checklist-templates` — tạo mẫu mới

**Body:**

```jsonc
{
  "key": "workshop_quang_ba",          // bắt buộc, chuỗi a-z0-9_-, duy nhất (case-insensitive)
  "name": "Checklist Workshop Quảng bá", // bắt buộc
  "appliesToTypes": ["Workshop"],        // mảng string, có thể rỗng
  "leadTimeDays": 45,                    // số nguyên >= 0, mặc định 30
  "tasks": [/* như mục 1.1 */]           // mảng, có thể rỗng
}
```

**Validate:**
- `key` thiếu/trùng (đã tồn tại) → 400.
- `tasks[]`: `name` bắt buộc; `priority` phải thuộc `{High, Medium, Low}` (thiếu → mặc định `Medium`); `group` thiếu → `"Khác"`; `daysBeforeDeadline` thiếu → 0.
- `leadTimeDays` < 0 → 400.

### 2.2. `PUT /v1/projects/checklist-templates/:key` — cập nhật/ghi đè toàn bộ mẫu

**Body:** giống `POST` (không cần `key` trong body — lấy từ path; nếu có gửi `key` khác path → 400).

- Thay **toàn bộ** `name / appliesToTypes / leadTimeDays / tasks` bằng payload (thay cả set tasks, đơn giản và tránh upsert lem nhem).
- `:key` không tồn tại → 404.
- Validate như mục 2.1.

### 2.3. `DELETE /v1/projects/checklist-templates/:key` — xoá mẫu

- `:key` không tồn tại → 404.
- Chỉ xoá template; **không** xoá/sửa bất kỳ task nào đã sinh cho dự án hiện hữu.
- Trả 200 + `{ success: true }` (hoặc 204).

### 2.4. `PUT /v1/projects/checklist-templates/stakeholder-options` — cập nhật danh sách stakeholder

**Body:**

```jsonc
{ "stakeholderOptions": [ { "code": "PM", "label": "Project Manager" } ] }
```

- Thay **toàn bộ** danh sách (mảng có thể rỗng). `code` + `label` bắt buộc, `code` duy nhất.
- Ghi chú: các task trong template tham chiếu stakeholder bằng `code` trong trường `stakeholders` — FE đảm nhận map/validate; BE chỉ cần lưu list này như hiện trạng của `GET`.

### 2.5. Lưu ý chung

- `totalTasks` KHÔNG phải field lưu trữ — luôn tính lại khi trả về (`tasks.length`), để không lệch dữ liệu.
- `stakeholderOptions` trả về ở **root** (không nằm trong từng template) — giữ như hiện tại.
- Không giới hạn số lượng template; không hardcode danh sách template ở BE.

---

## 3. Kiểm tra chấp nhận (checklist cho BE)

- [ ] `POST` tạo template mới → `GET` thấy mẫu mới, `totalTasks` = số task gửi lên.
- [ ] `POST` với `key` trùng → 400.
- [ ] `PUT` sửa tên/nhóm/task của mẫu có sẵn → `GET` trả bản mới, dự án tạo sau với `applyTemplate` sinh đúng bản đã sửa.
- [ ] `PUT` với key không tồn tại → 404; `DELETE` với key không tồn tại → 404.
- [ ] `DELETE` mẫu → `GET` không còn mẫu; task của dự án đã tạo trước đó vẫn còn nguyên.
- [ ] `PUT stakeholder-options` → `GET` trả list mới; gửi `code` trùng → 400.
- [ ] Tạo dự án `type` khớp template sau khi sửa: luồng cũ vẫn chạy (fallback theo type hoạt động bình thường).

---

## 4. Ghi chú cho FE (đã làm theo hướng này, BE chỉ cần khớp endpoint)

- FE gửi `tasks` là mảng **đầy đủ** (thay cả set) trong `POST`/`PUT` — không có cơ chế diff.
- FE dùng `key` làm `templateType` gửi lên `POST /v1/projects`; khi tạo mẫu mới FE không tự gán `totalTasks` trong payload.
- FE khi endpoint ghi chưa tồn tại sẽ hiển thị lỗi thân thiện, không crash.