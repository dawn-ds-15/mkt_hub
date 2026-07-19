# Module: Projects & Tasks

## 1. Tổng quan

| Mục | Giá trị |
|-----|---------|
| Route FE | `/projects` |
| Page chính | `FE/pages/ProjectsTasks.jsx` |
| Components | `Projects/`, `TaskList`, `KanbanBoard`, `WeeklyReport` |
| Service file | `FE/services/api.js` |
| Backend prefix | `/api` (NestJS) |
| Auth | JWT Bearer token + Roles guard |

---

## 2. Các tab & components

| Tab | Key | Component | Mô tả |
|-----|-----|-----------|-------|
| Danh sách Task | `tasks` | TaskList.jsx | Bảng task có filter, sort, phân trang, quick-add |
| Kanban | `kanban` | KanbanBoard.jsx | Board kéo-thả, 6 cột: Planning, Processing, Done, Pending, Backlog, Cancel |
| Báo cáo Tuần | `weekly` | WeeklyReport.jsx | Báo cáo tuần với log notes, export TXT |
| Dự án | `projects` | Projects/index.jsx | Danh sách project dạng card + summary sidebar |

---

## 3. API Endpoints — Frontend gọi

### 3.1 Projects

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/projects` | `getProjects()` | Trả về danh sách projects |
| POST | `/v1/projects` | `createProject(data)` | Tạo project mới |
| PATCH | `/v1/projects/:id` | `updateProject(id, data)` | Cập nhật project |
| DELETE | `/v1/projects/:id` | `deleteProject(id)` | Xoá project |

### 3.2 Tasks

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/tasks` | `getTaskList(filters)` | Query params: `projectId`, `status`, `priority`, `assigneeId`, `dueDateFrom`, `dueDateTo` |
| GET | `/v1/tasks` | `getTasks(filters)` | Variant khác, params: `projectId`, `status` |
| POST | `/v1/tasks` | `createTask(data)` | Tạo task mới |
| PATCH | `/v1/tasks/:id` | `updateTask(id, data)` | Cập nhật task (dùng cho drag-drop Kanban) |
| DELETE | `/v1/tasks/:id` | `deleteTask(id)` | Xoá task |
| GET | `/v1/tasks/kanban/board` | `getKanbanData()` | Dữ liệu Kanban board (grouped by status) |

### 3.3 Weekly Reports

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/v1/weekly-reports` | `getWeeklyReport(filters)` | Query params: `week`, `year`, `projectId` |
| POST | `/v1/weekly-reports/logs` | `saveWeeklyLog(data)` | Lưu log tuần |
| GET | `/v1/weekly-reports/export.txt` | `exportWeeklyReport(week, year, projectId)` | Export file .txt, response blob |

### 3.4 Members (Auth)

| Method | Endpoint FE gọi | Function | Ghi chú |
|--------|-----------------|----------|---------|
| GET | `/auth/members` | `getMembers()` | Danh sách thành viên |

---

## 4. Backend endpoints thực tế

| Method | Backend Endpoint | Controller | Ghi chú |
|--------|-----------------|------------|---------|
| GET | `/api/v1/projects` | projects.controller | List + nested relations |
| GET | `/api/v1/projects/:id` | projects.controller | Get by ID |
| POST | `/api/v1/projects` | projects.controller | Create |
| PATCH | `/api/v1/projects/:id` | projects.controller | Update |
| DELETE | `/api/v1/projects/:id` | projects.controller | Delete |
| GET | `/api/v1/tasks` | tasks.controller | List, filters: `projectId`, `status`, `priority`, `assigneeId`, `dueDateFrom`, `dueDateTo` |
| GET | `/api/v1/tasks/:id` | tasks.controller | Get by ID |
| POST | `/api/v1/tasks` | tasks.controller | Create |
| PATCH | `/api/v1/tasks/:id` | tasks.controller | Update |
| DELETE | `/api/v1/tasks/:id` | tasks.controller | Delete |
| GET | `/api/v1/tasks/kanban/board` | tasks.controller | Kanban grouped |
| GET | `/api/v1/tasks/import/template` | tasks.controller | Template download — FE **không gọi** |
| POST | `/api/v1/tasks/import` | tasks.controller | Import CSV/XLSX — FE **không gọi** |
| GET | `/api/v1/weekly-reports` | weekly-reports.controller | Get report |
| POST | `/api/v1/weekly-reports/logs` | weekly-reports.controller | Save log |
| GET | `/api/v1/weekly-reports/export.txt` | weekly-reports.controller | Export |
| GET | `/api/auth/members` | members.controller | List members |
| PATCH | `/api/auth/members/:id/role` | members.controller | Update role — FE **không gọi** |

---

## 5. Data shape mapping

### 5.1 Project

| Frontend field | Backend field | Kiểu | Ghi chú |
|---------------|--------------|------|---------|
| `id` | `id` | UUID | ✅ match |
| `name` | `name` | String | ✅ |
| `type` | `type` | String | ✅ |
| `owner` | `owner.name` | String (computed) | ✅ FE lấy từ relation |
| `ownerId` | `ownerId` | String | ✅ |
| `deadline` | `deadline` | DateTime → formatted | ✅ FE format en-GB |
| `deadlineRaw` | `deadline` | ISO string | ✅ |
| `status` | `status` | String (mapped) | ⚠️ FE transform: `Active` → `active/near_deadline`, `Completed` → `completed`, v.v. |
| `statusLabel` | `status` | String | ✅ raw status from BE |
| `tasksCompleted` | `progress.done` | Number | ✅ |
| `tasksTotal` | `progress.total` | Number | ✅ |
| `progress` | `progress.percentage` | Number | ✅ |
| `budgetPlanDirect` | `budgetPlanDirect` | Decimal | ✅ |
| `budgetPlanOverhead` | `budgetPlanOverhead` | Decimal | ✅ |
| `actualCostDirect` | `actualCostDirect` | Decimal | ✅ |
| `actualCostOverhead` | `actualCostOverhead` | Decimal | ✅ |
| `kpiRawLeadsPlan` | `kpiRawLeadsPlan` | Int | ✅ |
| `kpiRawLeadsActual` | `kpiRawLeadsActual` | Int | ✅ |
| `tasks[].name` | `tasks[].name` | String | ✅ nested |
| `tasks[].assignee` | `tasks[].assignee.name` | String | ✅ |
| `tasks[].due` | `tasks[].dueDate` | formatted | ✅ |
| `tasks[].status` | `tasks[].status` | mapped | ⚠️ FE transform status |

### 5.2 Task

| Frontend field | Backend field | Kiểu | Ghi chú |
|---------------|--------------|------|---------|
| `id` | `id` | UUID | ✅ |
| `project` | `project.name` | String | ✅ |
| `taskName` | `name` | String | ⚠️ FE gọi là `taskName`, BE là `name` |
| `description` | `description` | String | ✅ |
| `assignee.initials` | computed | String | ✅ FE tự tính |
| `assignee.name` | `assignee.name` | String | ✅ |
| `stakeholders` | `stakeholders` | String | ✅ |
| `status` | `status` | mapped | ✅ FE map: `todo`→Planning, `in_progress`→Processing, `waiting`→Pending, `canceled`→Cancel |
| `priority` | `priority` | String (lowercased) | ✅ FE gửi `High/Medium/Low`, FE render `high/medium/low` |
| `start` / `startDate` | `startDate` | DateTime | ✅ |
| `due` / `dueDate` | `dueDate` | DateTime | ✅ |
| `done` / `completedDate` | `completedDate` | DateTime | ✅ |
| `link` / `linkUrl` | `link` | String? | ✅ **ĐÃ FIX**: FE giữ nguyên String, không wrap object |
| `remark` | `remark` | String | ✅ |

### 5.3 Kanban Column

| Frontend field | Backend field | Ghi chú |
|---------------|--------------|---------|
| `id` | `status.toLowerCase()` | ✅ |
| `title` | mapped via `columnMeta` | ✅ |
| `badgeCount` | `count` | ✅ |
| `tasks[].title` | `tasks[].name` | ✅ |
| `tasks[].project` | `tasks[].project.name` | ✅ |
| `tasks[].assignee` | `tasks[].assignee.name` | ✅ |
| `tasks[].priority` | `tasks[].priority` | ✅ |
| `tasks[].due` | `tasks[].dueDate` | formatted ✅ |
| `tasks[].dueDate` | `tasks[].dueDate` | String ✅ **ĐÃ FIX**: thêm raw field để date filter hoạt động |
| `tasks[].overdue` | `tasks[].isOverdue` | ✅ |
| `tasks[].done` | `tasks[].status === 'Done'` | ✅ |

### 5.4 Weekly Report

| Frontend field | Backend field | Ghi chú |
|---------------|--------------|---------|
| `week` | `period.week` | ✅ |
| `year` | `period.year` | ✅ |
| `status` | computed (`log ? 'Đã lưu' : 'Nháp'`) | ✅ |
| `logNotes.doneNotes` | `log.doneNotes` | ✅ |
| `logNotes.planNotes` | `log.planNotes` | ✅ |
| `logNotes.backlogNotes` | `log.backlogNotes` | ✅ |
| `logNotes.bodNotes` | `log.bodNotes` | ✅ |
| `completed` | `sections.done` | ✅ with mapping |
| `nextWeek` | `sections.nextWeekPlan` | ✅ with mapping |
| `backlog` | `sections.backlog` | ✅ with mapping |
| `bod` | `sections.bodSupport` | ✅ with mapping |

---

## 6. Các lỗi đã fix

| # | Lỗi | File | Mô tả |
|---|------|------|-------|
| 1 | **Thiếu `dueDateFrom`/`dueDateTo` trong API call** | `api.js:getTaskList` | Đã thêm mapping `dateFrom`→`dueDateFrom`, `dateTo`→`dueDateTo` vào query params |
| 2 | **Status `overdue` gửi lên BE** | `api.js:getTaskList` | Đã thêm check `filters.status !== 'overdue'` để skip gửi status này lên BE (overdue là FE concept) |
| 3 | **Link field wrap object sai format** | `api.js:getTaskList` | Đã đổi `{ type: 'link', url: t.link }` → `link: t.link` (string), thêm `linkUrl` để dùng cho `<a>` |
| 4 | **Link display dùng sai field** | `TaskList.jsx` | Đã sửa `task.link.type` → `task.linkUrl` + render `<a href>` thay vì icon |
| 5 | **Thiếu `dueDate` trong Kanban task** | `api.js:getKanbanData` | Đã thêm field `dueDate: t.dueDate || ''` để KanbanBoard date filter hoạt động |

### 6.1 Frontend ✅ / Backend ✅

| Endpoint FE gọi | Status |
|-----------------|--------|
| `GET /v1/projects` | ✅ |
| `POST /v1/projects` | ✅ |
| `PATCH /v1/projects/:id` | ✅ |
| `DELETE /v1/projects/:id` | ✅ |
| `GET /v1/tasks` | ✅ |
| `POST /v1/tasks` | ✅ |
| `PATCH /v1/tasks/:id` | ✅ |
| `DELETE /v1/tasks/:id` | ✅ |
| `GET /v1/tasks/kanban/board` | ✅ |
| `GET /v1/weekly-reports` | ✅ |
| `POST /v1/weekly-reports/logs` | ✅ |
| `GET /v1/weekly-reports/export.txt` | ✅ |
| `GET /auth/members` | ✅ |

### 6.2 Kết luận

**Module Projects & Tasks đồng bộ hoàn toàn.** Tất cả endpoints FE gọi đều có BE tương ứng. Các lỗi về link field, date filter params, kanban dueDate đã được fix.
