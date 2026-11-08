# Bàn giao dự án — MKT Hub Frontend

Tài liệu này dành cho người tiếp quản dự án FE `mkt_hub` (Marketing Operations SPA). Cập nhật: 2026-11-08.

## 1. Tổng quan

- **Repo:** https://github.com/dawn-ds-15/mkt_hub.git
- **Branch làm việc hiện tại:** `frontend` (đã đồng bộ `origin/frontend`)
- **Production (Vercel):** https://mkthub-pied.vercel.app/
- **Project Vercel (CLI):** `mkt_hub` (`prj_fKygKvGtNQs3YQ68IcfBtGs2iWe3`, team `team_5hmgF9TpsFRas96F5X0VUDZB`) — cấu hình local trong `.vercel/project.json` (gitignored)
- **Backend API mặc định (code/deploy):** `VITE_API_URL` (Vite). Dockerfile mặc định build với `https://mkt-hub.onrender.com/api`; Vercel rewrite/CSP trong `vercel.json` cho phép connect tới `https://mkt-hub.onrender.com`.

## 2. Tech stack

- React 18, Vite 4, React Router 6
- Tailwind CSS 3, PostCSS
- Axios (`src/shared/api/httpClient.js`) — base URL từ `import.meta.env.VITE_API_URL` hoặc fallback `http://localhost:3000/api`
- State/data libs có sẵn: `@tanstack/react-query`, `zustand`, `react-hook-form`
- Tiện ích: `date-fns`, `xlsx`, `swagger-ui-react`, `lucide-react`

## 3. Yêu cầu & chạy local

```sh
npm ci
npm run dev
```

Tạo `.env.local` (hoặc `.env`) ở **root project** (Vite đọc env từ root; không đặt env app trong `src/`):

```dotenv
VITE_API_URL=http://localhost:3000/api
```

> `.env*` đã được gitignore. **Không commit secret/credential.** Mọi biến `VITE_` đều lộ trong bundle trình duyệt.

Build/preview:

```sh
npm run build   # output: dist/
npm run preview
```

Hiện **chưa có** script lint/typecheck/test trong `package.json`. Nếu bổ sung, nên cập nhật README và quy trình CI/CD.

## 4. Cấu trúc mã nguồn

```text
src/
  app/        # App shell, providers, routes
  features/   # Feature modules: api-docs, auth, dashboard, data-management,
              # expense, inventory, leads-kpis, profiles, projects, tasks
  shared/     # API client, stores, utils dùng chung
  styles/     # Global/Tailwind styles
public/
  templates/  # File tĩnh tải xuống (không bundle)
docs/
  qa/         # BUG_REPORT.md
  specifications/  # Spec/yêu cầu BE, ghi chú tích hợp
```

Quy ước (theo README hiện tại):
- Route-level screens đặt theo module feature; UI nhỏ trong components của module.
- Backend access qua `src/shared/api/httpClient.js`; logic dùng chung trong `src/shared/*` và utils của feature.
- Giữ UTF-8 khi chỉnh text tiếng Việt.
- Sau thay đổi nên chạy `npm run build`.

## 5. Deploy

### Vercel (production)
- Config: `vercel.json` — build `npm run build`, output `dist`, framework Vite, SPA rewrite `/(.*) -> /index.html`, security headers, CSP cho phép API `mkt-hub.onrender.com`.
- Deploy CLI (đã đăng nhập `vercel`/Node môi trường máy hiện tại):

```sh
vercel --prod --yes
```

### Docker / Nginx
- `Dockerfile` build Vite rồi serve bằng Nginx.
- `nginx.conf` làm SPA fallback và proxy `/api/` tới backend (`BE_UPSTREAM`, mặc định `https://mkt-hub.onrender.com`).
- `docker-compose.yml` có sẵn ở root.

## 6. Trạng thái gần nhất (commit mới)

`42d7f76` — `feat(expense/inventory): map inventory to budget categories and update analytics/forms` (pushed `origin/frontend`, deployed production 2026-11-08)

Nội dung chính:
- Map danh mục vật phẩm kho → nhóm ngân sách (Quà tặng/In ấn: `gift/print`; Vật phẩm: `posm/uniform/...`) trong luồng nhập chi phí/cảnh báo nhập batch và analytics.
- File liên quan: `src/features/inventory/utils/inventoryBudgetCategory.js`, `ExpenseEntryForm.jsx`, `InventoryFormModal.jsx`, `useInventoryCategories.js`, `ViewAnalytics.jsx` (leads-kpis), test `tests/expense-inventory/inventory-budget-category.test.mjs`, report test expense-inventory.

## 7. Phụ thuộc BE / việc cần theo dõi

- **Chi phí sinh từ xuất kho (stock-out)** hiện có thể phát sinh với `categoryId = null` do BE tạo dòng chi phí; FE đã xử lý mapping ở luồng nhập, nhưng cần BE đồng bộ quy tắc phân loại để báo cáo ngân sách nhất quán.
- Xem tài liệu yêu cầu BE trong lịch sử commit: `BE_requirement_07_11_26_budget_category.md` (commit `42d7f76`) và các spec trong `docs/specifications/`/commit trước. Khi bàn giao, nên đối chiếu với trạng thái API thực tế trên `https://mkt-hub.onrender.com/api`.
- `httpClient.js` có xử lý 401 (clear token, redirect `/login`) và thông điệp 403 theo permission module.

## 8. Tài liệu tham khảo trong repo

- `README.md` — hướng dẫn chạy/build và cấu trúc.
- `docs/qa/BUG_REPORT.md` — findings/verification QA.
- `docs/specifications/` — spec API/BE requirements và ghi chú tích hợp.
- `vercel.json`, `Dockerfile`, `nginx.conf`, `docker-compose.yml` — deploy.

## 9. Checklist bàn giao nhanh

- [ ] Nhận quyền truy cập repo GitHub (`dawn-ds-15/mkt_hub`) và quyền team/project Vercel.
- [ ] Tạo `.env.local` với `VITE_API_URL` phù hợp môi trường.
- [ ] `npm ci && npm run build` pass.
- [ ] Kiểm tra đăng nhập/permission (401/403) và các luồng Expense, Inventory, Leads-KPIs, Tasks, Projects trên môi trường đích.
- [ ] Rà các yêu cầu BE đang mở trong `docs/specifications/`/lịch sử commit và xác nhận API contract.

## 10. Liên hệ/ngữ cảnh kỹ thuật

- Không có thông tin liên hệ cá nhân trong repo; dùng kênh dự án/team để nhận credential, quyền Vercel/GitHub, và thông tin môi trường backend.
- Khi commit: giữ thay đổi đúng scope, không commit `.env*`, `node_modules/`, `dist/`, `.vercel`.
