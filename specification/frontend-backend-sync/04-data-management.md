# Module: Data Management

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/data` |
| Page chính | `FE/pages/DataManagement.jsx` |
| Components | `DataManagement/ImportTab`, `ExportTab`, `BackupRestore`, `SystemConfig`, `MemberManagement` |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Auth | JWT Bearer token + Roles guard |
| Soft-delete | ✅ Một số entity dùng backend `archivedAt`, số còn lại dùng localStorage `filterDeleted` |
| i18n | ✅ EN/VI — context `DashboardContext.locale` |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Import | `import` | ImportTab | Import tasks, KPI history, closed deals từ file |
| Export | `export` | ExportTab | Export weekly report PDF |
| Backup & Restore | `backup` | BackupRestore | Backup database, reset sandbox |
| Cấu hình | `config` | SystemConfig | Dropdown config, Slack settings |
| Thành viên | `members` | MemberManagement | CRUD members |

---

## 3. API Endpoints — Frontend gọi

### 3.1 Members

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/data-management/members` | `getMembers()` | Danh sách thành viên |
| POST | `/v1/data-management/members` | `createMember(data)` | Tạo member mới |
| PUT | `/v1/data-management/members/:id` | `updateMember(id, data)` | Cập nhật member |
| DELETE | `/v1/data-management/members/:id` | `deleteMember(id)` | Xoá member |

### 3.2 Dropdown Config

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/data-management/dropdowns` | `getDropdownKeys()` | Danh sách dropdown configs |
| PUT | `/v1/data-management/dropdowns/:key` | `addDropdownValue(keyId, label)` | Thêm value vào dropdown |
| PUT | `/v1/data-management/dropdowns/:key` | `deleteDropdownValue(keyId, valueId)` | Xoá value khỏi dropdown |

### 3.3 Slack Settings

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/data-management/slack/config` | `getSlackSettings()` | Lấy cấu hình Slack |
| POST | `/v1/data-management/slack/config` | `saveSlackSettings(data)` | Lưu cấu hình Slack |
| POST | `/v1/data-management/slack/test` | `testSlackWebhook(url)` | Test kết nối Slack |
| GET | `/v1/data-management/slack/logs` | `getSlackNotificationHistory()` | Lịch sử thông báo Slack |

### 3.4 Import (2-step: preview + confirm)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| POST | `/v1/tasks/import` | `importTasks(formData)` | Import tasks (trực tiếp, không preview) |
| POST | `/v1/data-management/import/preview?type=kpi` | `importKPIHistory(formData)` | Import KPI history |
| POST | `/v1/data-management/import/preview?type=deal` | `importClosedDeals(formData)` | Import closed deals |
| GET | `/v1/tasks/import/template` | `downloadTemplate('tasks')` | Download template từ BE |
| GET | `/v1/data-management/import/template` | `downloadTemplate('kpi'|'deals')` | Download template từ BE |

### 3.5 Export

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/data-management/export/pdf` | `exportWeeklyReportPDF(params)` | Export weekly report PDF |
| GET | `/v1/data-management/export/excel` | `exportDashboardExcel(params)` | Export dashboard Excel |
| GET | `/v1/data-management/export/full` | `exportFullData()` | Export toàn bộ dữ liệu |

### 3.6 Backup & Sandbox

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/data-management/backups` | `getBackupData()` | Danh sách backups |
| POST | `/v1/data-management/backups/create` | `createBackup()` | Tạo backup |
| DELETE | `/v1/data-management/backups/:id` | `deleteBackup(id)` | Xoá backup |
| POST | `/v1/data-management/backups/restore` | `restoreBackup(formData)` | Restore backup |
| POST | `/v1/data-management/reset` | `resetSandbox()` | Reset sandbox |

---

## 4. Backend endpoints (BE module5.md)

| Method | Backend Endpoint | FE gọi | Trạng thái |
|--------|-----------------|--------|------------|
| GET | `/api/v1/data-management/members` | ✅ `GET /v1/data-management/members` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/members` | ✅ `POST /v1/data-management/members` | **ĐÃ FIX** |
| PUT | `/api/v1/data-management/members/:id` | ✅ `PUT /v1/data-management/members/:id` | **ĐÃ FIX** |
| DELETE | `/api/v1/data-management/members/:id` | ✅ `DELETE /v1/data-management/members/:id` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/dropdowns` | ✅ `GET /v1/data-management/dropdowns` | **ĐÃ FIX** |
| PUT | `/api/v1/data-management/dropdowns/:key` | ✅ `PUT /v1/data-management/dropdowns/:key` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/slack/config` | ✅ `GET /v1/data-management/slack/config` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/slack/config` | ✅ `POST /v1/data-management/slack/config` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/slack/test` | ✅ `POST /v1/data-management/slack/test` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/slack/logs` | ✅ `GET /v1/data-management/slack/logs` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/import/preview` | ✅ `POST /v1/data-management/import/preview` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/import/confirm` | ✅ `POST /v1/data-management/import/confirm` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/import/template` | ✅ `GET /v1/data-management/import/template` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/export/pdf` | ✅ `GET /v1/data-management/export/pdf` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/export/excel` | ✅ `GET /v1/data-management/export/excel` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/export/full` | ✅ `GET /v1/data-management/export/full` | **ĐÃ FIX** |
| GET | `/api/v1/data-management/backups` | ✅ `GET /v1/data-management/backups` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/backups/create` | ✅ `POST /v1/data-management/backups/create` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/backups/restore` | ✅ `POST /v1/data-management/backups/restore` | **ĐÃ FIX** |
| POST | `/api/v1/data-management/reset` | ✅ `POST /v1/data-management/reset` | **ĐÃ FIX** |

---

## 5. Các fix đã thực hiện

| # | Vấn đề | File | Mô tả |
|---|--------|------|-------|
| 1 | **Members path sai** | `api.js` | `POST /auth/members` → `POST /v1/data-management/members`, `PATCH → PUT`, field `active` → `isActive` |
| 2 | **Dropdown path sai** | `api.js` | `GET /v1/dropdowns` → `GET /v1/data-management/dropdowns`, `POST/DELETE /v1/dropdowns/values` → `PUT /v1/data-management/dropdowns/:key` với full values array |
| 3 | **Slack path sai** | `api.js` | `/v1/slack/settings` → `/v1/data-management/slack/config`, `/v1/slack/test` → `/v1/data-management/slack/test`, `/v1/slack/history` → `/v1/data-management/slack/logs` |
| 4 | **Import path sai** | `api.js` | Tasks: `/v1/import/tasks` → `/v1/tasks/import`. KPI/Deals: `/v1/import/*` → `/v1/data-management/import/preview?type=kpi\|deal`. Thêm functions `importPreview()` + `importConfirm()` cho 2-step flow. |
| 5 | **Template download** | `api.js` | Thêm BE download (`/v1/tasks/import/template`, `/v1/data-management/import/template`) fallback client-side. |
| 6 | **Export path sai** | `api.js` | `/v1/export/*` → `/v1/data-management/export/*` (pdf, excel, full) |
| 7 | **Backup path sai** | `api.js` | `/v1/backup` → `/v1/data-management/backups`, `/v1/backup/restore` → `/v1/data-management/backups/restore` |
| 8 | **Sandbox path sai** | `api.js` | `/v1/sandbox/reset` → `/v1/data-management/reset` |
| 9 | **getMembers endpoint sai** | `api.js` | `GET /auth/members` → `GET /v1/data-management/members` |
| 10 | **deleteMember là no-op (chỉ UI)** | `api.js` | `deleteMember` không gọi API — `markDeleted('members', id)` + optimistic remove UI. |
| 11 | **Edit member dùng name để tìm** | `TeamMembers.jsx` | Sửa thành dùng `email` để tránh bug trùng tên |
| 12 | **toggleActive gửi toàn bộ object** | `TeamMembers.jsx` | Chỉ gửi `{name, email, role, active}` |
| 13 | **createMember thiếu active field** | `api.js` | Thêm `isActive` trong payload |
| 14 | **Role mapping case-sensitive** | `api.js` | `role.toLowerCase()` khi gửi, capitalize khi nhận |
| 15 | **Backup delete UI không ẩn** | `BackupReset.jsx` | Optimistic update + localStorage deletedIds lọc khi re-fetch |

---

## 6. Soft-delete trong Data Management

Data Management dùng **2 cơ chế soft-delete**:

### 6.1 localStorage soft-delete (cho entity không có BE delete endpoint)
- `members` — `deleteMember()` chỉ `markDeleted('members', id)`
- `backups` — `deleteBackup()` chỉ `markDeleted('backups', id)`
- Các entity này không gọi API xoá, chỉ ẩn UI qua `filterDeleted()`

### 6.2 Backend soft-delete (cho entity có BE delete endpoint)
- Các entity khác (tasks, projects, expenses, etc.) gọi API `DELETE` → backend set `archivedAt`
- FE vẫn giữ `filterDeleted()` trong 1 số trường hợp như safety net

### 6.3 Centralized utility
- File: `FE/utils/softDelete.js`
- API: `markDeleted(type, id)`, `filterDeleted(type, items)`, `getDeletedIds(type)`, `restoreDeleted(type, id)`
- Key localStorage: `mkt_hub_deleted`

---

## 7. Thống kê endpoints đồng bộ

**Tổng số endpoints BE Data Management: 21**
**Tổng số FE đã kết nối: 21 (100%) — ĐÃ ĐỒNG BỘ HOÀN TOÀN**

### Ghi chú quan trọng
- **delete functions gọi BE API (soft-delete `archivedAt`):**
  - `deleteTask` → `DELETE /v1/tasks/:id`
  - `deleteProject` → `DELETE /v1/projects/:id`
  - `deleteOpportunity` → `DELETE /v1/leads-kpis/opportunities/:id`
  - `deleteClosedDeal` → `DELETE /v1/leads-kpis/closed-deals/:id`
  - `deleteExpense` → `DELETE /v1/expenses/:id`
- **delete functions no-op (chỉ UI + localStorage):**
  - `deleteMember` → `markDeleted('members', id)` — không có BE endpoint
  - `deleteBackup` → `markDeleted('backups', id)` — không có BE endpoint
  - `deleteCompareData` → `markDeleted('compare', years)` — không có BE endpoint
- `generateAIReport` — gọi `POST /v1/ai/report` (có BE endpoint).
