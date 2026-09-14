# BE cần sửa (09/09/2026) — 1. Nhập chi phí tổng hạng mục (cộng dồn/xóa không được) · 2. Loại dự án (enum cứng chặn type mới)

> Nguồn: FE tab "Nhập chi phí tổng hạng mục" (`CategoryBudgetEntry`) + màn hình Tạo / Sửa dự án (`CreateProjectForm`).
> Môi trường verify: `https://mkt-hub.onrender.com/api` (login `a.nguyen@company.com` / `demo123`, role `manager`).

---

# PHẦN A — BUG "Nhập chi phí tổng hạng mục": LƯU BỊ CỘNG DỒN / KHÔNG XÓA ĐƯỢC

## A.1. Hiện tượng người dùng báo

Trên bảng "Nhập chi phí tổng hạng mục":

1. Ô tháng ban đầu có giá trị `200.000`.
2. User **xóa số 2** (ô còn trống / 0), **nhập lại số 2** (ô về `200.000` đúng như ban đầu), rồi **Lưu thay đổi**.
3. Sau khi lưu, ô đó **nhảy lên `300.000`** (tăng thêm 100.000) thay vì giữ nguyên `200.000`.
4. Xóa hẳn ô (nhập 0) rồi lưu → giá trị **không bị xóa**, vẫn còn.

→ **GT riêng:** mỗi lần lưu, giá trị tháng bị **cộng dồn** thay vì **ghi đè**; và `amount: 0` không xóa được giá trị cũ.

## A.2. Kết quả verify trên production (09/09/2026)

Đã gọi trực tiếp qua API bằng token của `a.nguyen@company.com`. Project dùng để test: `4800d733-174d-4a65-aa82-aba10820c02d`.

### A.2.1 Test 1 — PUT ghi giá trị, không gửi `projectId`

`PUT /v1/expense-budgets/values` body:
```json
{
  "year": 2026,
  "values": [
    { "categoryId": "e728a31e-f41e-43ed-9917-02dfb5375e99", "month": 1, "amount": 200000 },
    ... (12 tháng)
  ]
}
```

→ PUT trả `200`, `count: 12, created: 0, updated: 12, projectId: null`.

`GET /v1/expense-budgets/tree?year=2026` trả về `months[1]` **không phải** 200000 mà là **300000** (có 100.000 "ẩn" cộng thêm).

### A.2.2 Test 2 — lặp lại cùng giá trị (test idempotency)

Tiếp tục PUT `amount: 10000` → GET `months[1] = 110000`. (Mỗi lần lượng đã ghi trước đó vẫn tồn tại.)

### A.2.3 Test 3 — gửi `amount: 0`

PUT 12 tháng đều `amount: 0` → GET `months[1]` vẫn còn `100000` — **không xóa được**.

### A.2.4 Test 4 — có gửi `projectId` — KHÁC BIỆT QUYẾT ĐỊNH

`PUT /v1/expense-budgets/values` body:
```json
{ "year": 2026, "projectId": "4800d733-174d-4a65-aa82-aba10820c02d",
  "values": [{ "categoryId": "...", "month": 1, "amount": 99999 }, ...] }
```

- `GET tree?year=2026&projectId=4800d733-...` → `months[1] = 99999` ✅ **đúng**.
- `GET tree?year=2026` (KHÔNG `projectId`) → `months[1] = 199999` ❌ **= 99999 (project) + 99999 (?)** → bị **cộng dồn 2 bucket**.

## A.3. Nguyên nhân gốc (Root cause)

Bảng dữ liệu `budget_values` lưu **nhiều bucket theo `project_id`**:

| `project_id` | Ý nghĩa |
|---|---|
| `NULL` | Cấp toàn hệ thống (global) — user lưu khi không chọn dự án |
| `<uuid>` | Cấp riêng cho từng dự án |

**BUG DIỄN RA Ở `GET /tree`:**

Khi gọi `GET /v1/expense-budgets/tree?year=2026` (không `projectId`), BE đang **SUM cộng tất cả các bucket** lại (`project_id IS NULL` + mọi dự án) cho cùng `(categoryId, year, month)`.

→ Vì FE tab này lưu **không gửi `projectId`** (ghi vào bucket global `project_id = NULL`), nhưng khi **đọc** lại thì BE gộp cả global + tất cả dự án → con số hiển thị bị **tăng dần mỗi lần lưu** và **không thể về 0** được vì bucket dự án còn giá trị cũ đè lên.

Cụ thể với case báo lỗi `200.000 → 300.000`:
- Bucket toàn cục (`project_id IS NULL`) có `100.000` cũ còn sót.
- User sửa còn `200.000` → ghi vào bucket toàn cục.
- `GET /tree` không `projectId` → cộng `100.000` (global cũ) + `200.000` (global mới? hoặc project) = `300.000`.

## A.4. Yêu cầu cố định (bắt buộc)

### A.4.1 — `GET /v1/expense-budgets/tree` phải đọc ĐÚNG bucket

Thống nhất quy tắc:

| `projectId` param | `GET /tree` trả về |
|---|---|
| thiếu / `null` | **CHỈ** các record có `project_id IS NULL` (cấp toàn hệ thống) — **KHÔNG cộng** các dòng của dự án khác |
| `all` | Gộp toàn hệ thống: cộng `project_id IS NULL` + tất cả dự án (chỉ khi thật sự cần view tổng) |
| `<uuid>` | CHỈ record của dự án đó |

> Kỳ vọng: FE tab "Nhập chi phí tổng hạng mục" gọi KHÔNG kèm `projectId` → phải thấy đúng số mình vừa lưu (bucket global), không bị cộng dồn.

**Quan trọng — không được cộng nhầm:** Khi query thiếu `projectId`, filter phải là `WHERE project_id IS NULL`, **không phải** `WHERE project_id IS NOT DISTINCT FROM NULL` gom thêm `all`, và tuyệt đối không `SUM` nhiều bucket.

### A.4.2 — `PUT /v1/expense-budgets/values` phải GHI ĐÈ theo đúng khóa

Upsert đúng khóa **`(categoryId, projectId, year, month)`**:
- `projectId` thiếu `NULL` → upsert vào `project_id IS NULL`.
- Có `projectId` UUID → upsert vào đúng dự án đó.
- **Không** tạo nhiều record trùng khóa (tránh duplicate dẫn tới cộng dồn khi đo sau).
- `amount: 0` → **phải xoá** giá trị tháng đó (set 0 hoặc xoá record đồng thời), không giữ số cũ.

### A.4.3 — Rà soát & dọn dữ liệu duplicate tồn đọng

Do bug trước đây, DB có thể còn **nhiều record trùng** `(categoryId, projectId, year, month)` và các record "ghost" ở bucket khác. Yêu cầu:
- Với mỗi khóa `(categoryId, projectId, year, month)` chỉ giữ **1 record** (record mới nhất theo `updatedAt`), xóa các record trùng/dư.
- Làm sạch cả bucket dự án (`4800d733-...`) và bucket global liên quan tới các category test để sau fix dữ liệu thật không còn "ghost".

---

# PHẦN B — BUG "Loại dự án": `type must be one of the following values` chặn type MỚI thêm vào dropdown

## B.1. Hiện tượng người dùng báo

Khi user **thêm 1 loại dự án MỚI** vào cấu hình dropdown `project_type` (Data Management), sau đó **tạo dự án** với loại mới đó, hệ thống báo lỗi:

```
type must be one of the following values: [workshop, event, exhibition, webinar, Online Campaign, Lead Generation, Awards, Production]
```

→ Loại mới (vd `Email Marketing`) không được chấp nhận dù đã có trong dropdown.

## B.2. Kết quả điều tra / verify trên production (09/09/2026)

Đã test trực tiếp qua API (token `a.nguyen@company.com`):

| Endpoint | Gửi `type`/`label` | Kết quả |
|---|---|---|
| `POST /v1/projects` | `type: "Email Marketing"` / `"Foo Bar"` / `"Branding"` | ✅ **chấp nhận** (201) |
| `PATCH /v1/projects/:id` | `type: "Email Marketing"` | ✅ **chấp nhận** (200) |
| `POST /v1/data-management/dropdowns/project_type/options` | `label: "Email Marketing Test"` | ✅ chấp nhận (201) |
| `PUT /v1/data-management/dropdowns/project_type` | `values: [... "Email Marketing" ...]` | ✅ chấp nhận (200) |

→ **Tại thời điểm kiểm tra, các endpoint hiện tại ĐÃ chấp nhận type động** và không còn tái hiện lỗi `type must be one of the following values`. Danh sách enum trong thông báo lỗi (`workshop, event, exhibition, webinar, Online Campaign, Lead Generation, Awards, Production`) khớp **chính xác** với các giá trị seed ban đầu của dropdown `project_type` **trừ đi các type động mới thêm** (như `Email Marketing`).

## B.3. Nguyên nhân gốc (Root cause)

Trên các build BE cũ hơn, field `type` của dự án được validate bằng **enum CỨNG**:
```ts
@IsIn(['workshop','event','exhibition','webinar','Online Campaign','Lead Generation','Awards','Production'])
type: string
```
trong khi dropdown `project_type` (Data Management) lại cho phép user thêm type mới tùy ý. Khi type mới nằm **ngoài** enum cứng → BE từ chối mặc dù nó đã có trong dropdown config.

Đây là **xung đột "enum cứng ↔ dropdown động"**: dropdown gợi ý người dùng lựa chọn type mới, nhưng BE lại chặn bằng danh sách cố định.

## B.4. Yêu cầu cố định (bắt buộc — phòng ngừa tái phát)

> Mục tiêu: **Không dùng enum cứng** cho `type` dự án. `type` phải được coi là chuỗi động, lấy nguồn hợp lệ từ dropdown `project_type`.

1. **Bỏ hoàn toàn `@IsIn([...])`/enum cứng** ở mọi DTO nhận field `type` của dự án (tạo mới `POST /v1/projects`, cập nhật `PATCH /v1/projects/:id`, và bất kỳ DTO nào khác có `type` dự án).
2. Thay bằng **validation nhẹ**: `type` là chuỗi không rỗng, độ dài hợp lý (vd ≤ 100 ký tự). **Không** ràng buộc danh sách giá trị cố định.
3. Nếu cần kiểm tra nguồn hợp lệ, hãy đối chiếu với **giá trị `project_type` trong dropdown config lưu động** (không phải một mảng seed cứng trong code). Nếu buộc phải check, check theo **option `isActive === true`** của dropdown `project_type`.
4. Đảm bảo mọi **template/checklist** (`appliesToTypes`) không gây chặn khi `type` không khớp template — khi không có template khớp, việc tạo dự án vẫn **thành công** (không cần `applyTemplate`).

> Ghi chú tương thích ngược: không cần di trú dữ liệu. Dự án đã lưu type cũ (`workshop`, `event`, ...) vẫn giữ nguyên; chỉ cần bỏ ràng buộc enum khi tạo/sửa.

## B.5. Test chấp nhận (acceptance)

- [ ] `POST /v1/projects` với type mới bất kỳ (vd `Email Marketing`, `Branding`, `Foo Bar`) → **201**, không còn lỗi enum.
- [ ] `PATCH /v1/projects/:id` đổi type sang type mới → **200**.
- [ ] Thêm 1 option mới vào dropdown `project_type` rồi tạo dự án với type đó → thành công.
- [ ] Khi type không khớp bất kỳ checklist template nào → tạo dự án vẫn thành công (không lỗi).
- [ ] Không còn lỗi `type must be one of the following values` trong bất kỳ luồng tạo/sửa dự án nào.

# PHẦN D — YÊU CẦU BỔ SUNG (09/09/2026, SAU KHI VERIFY PHẦN A): DỌN SẠCH DATA GHOST KHIẾN TAB NGÂN SÁCH LỆCH SỐ

> Bổ sung sau khi chạy acceptance Phần A/B. Logic đọc/ghi đã đúng, nhưng còn **data ghost tồn đọng** trong
> `budget_values` làm `dashboard`/`tree?projectId=all` hiển thị sai so với bảng "Nhập chi phí tổng hạng mục".

## D.1. Hiện tượng (báo cáo từ verify 09/09/2026)

Bảng **"Nhập chi phí tổng hạng mục"** (`CategoryBudgetEntry`, gọi `GET /tree` KHÔNG `projectId`) hiển thị:
- Category `test`: **tháng 2 = 150.000**, các tháng khác 0 → tổng **150.000**. ✅ đúng dữ liệu thật.

Tab **"Ngân sách Chi phí"** (`ExpenseBudget`, gọi `GET /dashboard` mặc định `projectId=all`) hiển thị:
- `totalBudget = 251.000`
- Category `test` = **250.000**, Category `backup` = **1.000**
- Trước khi FE sửa lỗi tính %, UI còn hiện `test = 249.996` / `backup = 1.004` (do `ExpenseBudget.jsx` tính lại từ `totalBudget × percentage` — lỗi FE đã fix; không thuộc phạm vi BE).

→ **Lệch `101.000`** giữa tab nhập chi phí (150.000) và tab ngân sách (251.000).

## D.2. Truy vết — bằng chứng API (production, `a.nguyen@company.com`)

| Endpoint | Kết quả quan sát |
|---|---|
| `GET /tree?year=2026` (KHÔNG `projectId`) | `test.months = {2:150000}`, `backup.months = {}` → tổng **150.000** |
| `GET /tree?year=2026&projectId=all` | `test.months = {1:100000, 2:150000}` → 250.000; `backup.months = {1:1000}` |
| `GET /dashboard?year=2026` | `totalBudget=251000`, `test.budget=250000`, `backup.budget=1000` |
| `GET /by-project?year=2026` | `totalBudget=150000`; mọi `projects[]` = 0; chỉ bucket global (`projectId: null`) có `months[2]=150000` |
| `GET /tree?year=2026&projectId=4800d733-...` (INNOEX) | tất cả category `months = {}` |
| `GET /tree?year=2026&projectId=e9972fd9-...` ([Email MKT]) | tất cả category `months = {}` |
| 2 dự án active hiện tại | đều **không** có budget value nào |

→ Kết luận: tồn tại **≥ 2 record ghost** không thuộc bucket global, không thuộc project active hiển thị trong `GET /projects`:
1. `test` tháng 1 = **100.000**
2. `backup` tháng 1 = **1.000**

## D.3. Nghi vấn vị trí record ghost (cần BE xác nhận bằng query trực tiếp)

Dựa vào cấu trúc lịch sử, record ghost khả năng nằm ở **một trong các nhóm sau**:

| Nhóm | Điều kiện | Giải thích |
|---|---|---|
| **(a) Project đã archive/xóa** | `budget_values.project_id` trỏ tới project có `archived_at IS NOT NULL` (project đã xóa mềm qua `DELETE /v1/projects/:id`, hoặc dự án test cũ) | `GET /projects` không còn trả project này nên ta không thấy được, nhưng `getTree(projectId=all)` vẫn `SUM` vào |
| **(b) Record mang `item_id`/`subcategory_id`** | `budget_values.item_id IS NOT NULL` HOẶC có `budget_values.subcategory_id` (schema cũ 3 tầng Category→Subcategory→Item) | FE hiện chỉ đọc cấp category, các record này "mồ côi" không thuộc cây `GET /tree?projectId=<>` |
| **(c) Record category thuộc category đã archived** | `category_id` trỏ tới `budget_categories` có `archived_at IS NOT NULL` (vd category test/backup bị soft-delete ở lần dọn trước) | `GET /tree` lọc theo category active → không hiển thị |
| **(d) Duplicate trùng khóa** | nhiều record cùng `(categoryId, projectId, year, month)` còn sót | Phần A đã fix upsert nhưng chưa dọn record dup tạo từ trước |

## D.4. Yêu cầu BE thực hiện

### D.4.1 — Truy vết chính xác từng record ghost
Viết query rà soát toàn bộ `budget_values` năm 2026 (và mọi năm còn record), **JOIN đầy đủ** để gán record vào đúng nhóm ở D.3:
- `budget_values.project_id` → `projects` (lấy `archived_at`, `name`), dùng `LEFT JOIN` để bắt cả record có `project_id` trỏ tới project đã xóa hẳn hoặc `project_id` không tồn tại.
- `budget_values.category_id` → `budget_categories` (lấy `archived_at`, `name`).
- Kiểm tra sự tồn tại của cột `item_id`/`subcategory_id` trong `budget_values`; trong BE hiện hành liệt kê record nào có `item_id`/`subcategory_id` không rỗng.

Trả kết quả dạng bảng:
```
category_id | category_name | project_id | project_name | archived | month | amount | item_id | subcategory_id | createdAt | updatedAt
```

### D.4.2 — Dọn hay gán lại đúng chủ
Với MỖI record tìm được:
- Nếu thuộc **project đã archive/xóa HẲN** (nhóm a) → **XÓA record** (không giữ → không còn bị cộng vào `all`).
- Nếu thuộc **project active** nhưng có giá trị test không liên quan → xóa hoặc chuyển về đúng project theo xác nhận của người dùng (mặc định: xóa nếu không xác định được chủ).
- Nếu mang `item_id`/`subcategory_id` (nhóm b) → **XÓA record** (schema cũ không còn được FE đọc; nếu vẫn cần lưu dữ liệu này, pass qua project manager).
- Nếu thuộc **category đã archived** (nhóm c) → **XÓA record**.
- Nếu là **duplicate trùng khóa**(nhóm d) → giữ 1 record mới nhất theo `updatedAt`, xóa record trùng cũ (đã yêu cầu từ A.4.3, cần kiểm tra đã làm hết chưa).

> Nguyên tắc chung: sau khi dọn, **tổng `GET /tree` không `projectId` + tổng các dự án active phải = tổng `GET /tree?projectId=all`** bất kể có gọi thêm bất cứ bucket nào. Không còn record lạ nằm ngoài cây `GET /projects`.

### D.4.3 — Phòng ngừa tái phát (khuyến nghị)
1. **`DELETE /v1/projects/:id`** (soft-delete): cascade **archive** toàn bộ `budget_values.project_id` của project đó (set `archived_at` hoặc xóa), để không còn "đầu mồ côi".
2. `GET /tree?projectId=all` (và `/dashboard`, `/summary`, `/by-project`): query **chỉ JOIN các project `archived_at IS NULL`** (bỏ project đã xóa và cascade) — nếu muốn giữ hiển thị budget project đã xóa thì đổi sang hiển thị riêng, không cộng vào tổng.
3. **Unique constraint** DB: đảm bảo `UNIQUE (category_id, project_id, year, month)` (với `project_id NULL` thành 1 bucket riêng) để chặn duplicate về sau.

## D.5. Test chấp nhận (sau khi BE dọn)

### ✅ KẾT QUẢ VERIFY LẦN 2 (09/09/2026 — sau khi BE dọn data ghost) — ĐẠT TOÀN BỘ

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | `GET /dashboard?year=2026` | ✅ `totalBudget = 150.000`; `test.budget=150.000`, `backup.budget=0` | Khớp bảng nhập chi phí (150.000) |
| 2 | `GET /tree?year=2026&projectId=all` | ✅ tổng = 150.000, **không còn ghost** (`test` chỉ `{2:150000}`, `backup` rỗng) | m1 load trước đây (100000) đã hết |
| 3 | `GET /by-project?year=2026` | ✅ `totalBudget = 150.000`; mọi project = 0, chỉ global `m2=150000` | Không còn record lạ |
| 4 | Record ghost (100000/1000 / item/subcategory) | ✅ đã dọn | `tree all` = `tree global` = 150.000 |
| 5 | Cascade khi soft-delete project | ✅ **ĐẠT** | Test: tạo project, PUT budget m3=77777 → `tree?projectId=<uuid>`=77777, `tree all` m3=77777 → `DELETE /projects/:id` → `tree all` m3=0, dashboard vẫn 150000 |

**Lưu ý về hành vi dashboard (đã xác nhận):** `dashboard` chỉ tổng hợp budget **cấp toàn hệ thống (global)** — khi PUT 77777 cho một project, `dashboard.totalBudget` vẫn là 150.000 (không đổi), trong khi `tree?projectId=all` có cộng 77777. Đây là hành vi đúng theo Phần A (mỗi bucket đọc độc lập) — không phải bug. Tab ngân sách và tab nhập chi phí giờ **khớp nhau = 150.000**.

**Kết luận Phần D: ĐẠT toàn bộ.** Data ghost đã được dọn; cascade soft-delete đã hoạt động; unique/upsert không tạo thêm ghost.

---

# PHẦN C — KẾT QUẢ VERIFY SAU KHI BE CẬP NHẬT (09/09/2026)

> BE deploy mới trên `https://mkt-hub.onrender.com/api`. Đã chạy lại acceptance test toàn bộ.

## C.1. Phần A — Expense budget

| Test | Kết quả | Ghi chú |
|---|---|---|
| PUT `/values` (không `projectId`) tạo record global | ✅ `created:2` | Ghi vào bucket `project_id IS NULL` |
| PUT lại cùng giá trị (idempotency) | ✅ `created:0, updated:2`, GET không tăng | Không còn cộng dồn |
| PUT `amount:0` | ✅ xóa được (month biến mất khỏi GET), các tháng giữa vẫn giữ nguyên | `months[1]` reset về 0/empty |
| PUT có `projectId=4800d733...` → GET `?projectId=` | ✅ `months[1] = 99999` đúng | Đọc đúng bucket dự án |
| GET **KHÔNG** `projectId` sau khi có project bucket | ✅ `months[1] = 0` (KHÔNG cộng 99999 của project) | **Bug cộng dồn bucket đã fix** |
| GET `projectId=all` | ⚠️ vẫn còn `100000` ẩn ở category test (`e728a31e`) | Là record ghost tồn đọng chưa dọn hết (xem C.3) |

### Nhận xét Phần A

**4 acceptance test chính của logic đọc/ghi đã ĐẠT:**
- ✅ Đọc đúng bucket (global / theo dự án), không cộng dồn.
- ✅ Ghi đè đúng khóa `(categoryId, projectId, year, month)` — idempotent.
- ✅ `amount: 0` xóa được.
- ✅ Không tạo record trùng khi lặp PUT.

**CHƯA đạt:** Mục **A.4.3 (dọn data duplicate/ghost)** — `GET tree?projectId=all` (và dashboard) vẫn còn cộng thêm `100000` ở category test. Đã dọn sạch 31 project test và zero hết mọi bucket testable; `all` vẫn ra `{1:100000, 2:150000}` trong khi `no-projectId` ra `{1:0, 2:150000}` → tồn tại ≥ 1 record ghost (khả năng thuộc project đã archived, hoặc có `itemId`/`subcategoryId` không null, hoặc SaaS bucket `project_id <> null` chưa bị xóa). Cần BE rà soát bảng `budget_values` và dọn theo đúng khóa (như yêu cầu A.4.3).

## C.2. Phần B — Project type (loại dự án)

| Test | Kết quả |
|---|---|
| POST `/v1/projects` type `Email Marketing` / `Branding` / `Foo Bar` | ✅ 201, không còn lỗi enum |
| PATCH `/v1/projects/:id` đổi type → type mới tùy ý | ✅ 200 |
| Thêm option mới dropdown `project_type` → tạo project bằng type mới đó | ✅ thành công |
| Tạo project type không khớp checklist template (nếu FE gửi `applyTemplate` tay) | ⚠️ 400 template-specific "chỉ áp dụng cho Workshop/Event/Exhibition/Webinar" — nhưng FE KHÔNG gửi `applyTemplate` khi không khớp template, nên không phải luồng thật |
| Lỗi `type must be one of the following values` | ✅ **KHÔNG còn xuất hiện** trong mọi luồng tạo/sửa |

### Nhận xét Phần B

**ĐẠT toàn bộ** acceptance test B.5. BE đã bỏ/không còn enum cứng chặn type mới. Lưu ý nhỏ: giá trị `type` không khớp template vẫn bị BE từ chối **khi client gửi `applyTemplate` cho type không có template** — đây là hành vi hợp lý (FE không gửi trong trường hợp đó), không cần sửa.

## C.3. Việc còn lại cần BE làm

1. **Dọn data ghost (A.4.3):** `budget_values` còn record `100000` ẩn ở category `e728a31e...` (không xóa được qua API value PUT; cần query tay theo `project_id`/`item_id`/`subcategory_id` để tìm và xóa record ghost/duplicate).
2. Xóa sạch các project test đã tạo trong quá trình verify (đã dọn 31 project qua API DELETE; các project test dùng `applyTemplate` có thể còn kéo theo task nếu cần).

---

# PHẦN E — YÊU CẦU BỔ SUNG (09/09/2026): KHI XÓA DỰ ÁN PHẢI XÓA/DỌN SẠCH DATA LEADS&KPI LIÊN QUAN

> Bổ sung sau khi user báo: "Xóa dự án nhưng tab Xem & Phân tích / Leads&KPI vẫn còn data của dự án đã xóa khi chọn Toàn hệ thống — không khớp dự án".

## E.1. Hiện tượng (báo cáo + verify 09/09/2026)

Trong tab Leads&KPI → **Xem & Phân tích** (`ViewAnalytics`), khi chọn bộ lọc **"Toàn hệ thống"** (không chọn dự án cụ thể), KPI vẫn hiển thị số liệu của các dự án **đã bị xóa**:

| Nguồn query | Kết quả |
|---|---|
| `GET /v1/dashboard/kpi-cards?period_type=year&year=2026` (Toàn hệ thống) | `Raw Leads actual = 1769`, `MQL = 608`, `SQL = 239` |
| `GET /v1/dashboard/kpi-cards?...&projectId=<3 project active>` (từng dự án active) | **tất cả = 0** ✅ |
| `GET /v1/leads-kpis/weekly?year=2026` (Toàn hệ thống) | trả `opportunities[]` có `projectId` trỏ tới **project đã xóa**: HaiDang (`a7c3efe0...`, 2 opp), FE Test Project 2508 (`586b8651...`), BA last test (`e9b3cd4b...`), VILOG 2026 (`bad6cd9f...`) |
| `GET /v1/leads-kpis/closed-deals` | `[]` (hết, đã dọn) |
| `GET /v1/projects` | chỉ còn 3 project active — các project trên **không tồn tại trong danh sách** |

→ Kết luận: **data Leads&KPI (opportunities, weekly actuals, plan theo project, kpi_distributions...) thuộc project đã xóa vẫn được BE tính vào aggregate "toàn hệ thống"**; các query theo từng project active đều = 0 nên user thấy số "không khớp dự án". FE đúng (không truyền `projectId` = Toàn hệ thống); **bug nằm ở BE**.

## E.2. Nguyên nhân gốc (Root cause)

`DELETE /v1/projects/:id` hiện tại chỉ **soft-delete project** (set `archived_at`), **KHÔNG cascade** lên các bảng con của Leads&KPI:
- `weekly_actuals` / `leads_kpi_actuals`
- `opportunities`
- `kpi_distributions` (theo project)
- plan theo project (nếu có) — plan cấp hệ thống (`/v1/leads-kpis/plan/:year`) là mục tiêu, không xóa

Khi aggregate "toàn hệ thống" (không truyền `projectId`), query **SUM toàn bộ record** kể cả record thuộc project đã `archived_at IS NOT NULL` → số dư thừa. Khác với bucket budget đã fix ở Phần D (join project + lọc active), các endpoint Leads&KPI **chưa lọc project đã xóa**.

## E.3. Yêu cầu BE thực hiện

### E.3.1 — Cascade khi xóa dự án (bắt buộc)
`DELETE /v1/projects/:id` ngoài việc soft-delete project, phải **xóa hoặc archive toàn bộ dữ liệu Leads&KPI thuộc project đó**:
- `weekly_actuals` / `leads_kpi_actuals` có `project_id = <id>`
- `opportunities` có `project_id = <id>`
- `kpi_distributions` có `project_id = <id>`
- các bảng con khác liên quan KPI theo project

> Chọn **hard-delete** hết các bản ghi con (vì project đã không còn dùng) hoặc **archive đồng bộ** (`archived_at`) theo đúng cơ chế soft-delete của project — miễn là aggregate "toàn hệ thống" không còn thấy chúng. KHÔNG được giữ record mồ côi trỏ tới project đã xóa.

### E.3.2 — Aggregate "Toàn hệ thống" phải lọc project active (bắt buộc)
Với MỌI endpoint Không-có-`projectId` (tức Toàn hệ thống) tính tổng theo project:
- `GET /v1/dashboard/kpi-cards`
- `GET /v1/dashboard/funnel`
- `GET /v1/dashboard/pipeline-by-segment`
- `GET /v1/leads-kpis/weekly` (opportunities)
- `GET /v1/leads-kpis/closed-deals`

khi `projectId` không được truyền, chỉ tính:
1. record cấp **global** (`project_id IS NULL`), **+**
2. record thuộc project có **`archived_at IS NULL`** (active).

→ Bỏ qua record của project đã soft-delete (nguyên tắc giống Phần D: `JOIN projects ... WHERE p.archived_at IS NULL`).

### E.3.3 — Dọn data orphan tồn đọng (bắt buộc)
Query rà toàn bộ DB theo `project_id`:
- List `opportunities` / `weekly_actuals` / `kpi_distributions` gắn project **không nằm trong `GET /v1/projects`** (đã xóa) hoặc `archived_at IS NOT NULL` → **xóa**(hoặc gán lại theo xác nhận project manager, mặc định: xóa).
- Sau khi dọn, **"Toàn hệ thống" phải = tổng các project active + global**, không còn record lạ.

> Danh sách mồ côi quan sát được (09/09): opportunities của `a7c3efe0` (HaiDang ×2), `586b8651` (FE Test Project 2508), `e9b3cd4b` (BA last test), `bad6cd9f` (VILOG 2026); là nguồn chính của `Raw Leads 1769 / MQL 608 / SQL 239`.

## E.5. Test chấp nhận (acceptance)

### ✅ KẾT QUẢ VERIFY (09/09/2026 — sau khi BE cập nhật) — ĐẠT TOÀN BỘ

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | `GET /dashboard/kpi-cards` (không `projectId`) không còn data project đã xóa | ✅ **Raw Leads 1769 → 0**; MQL 608→0; SQL 239→0 | `Toàn hệ thống` chỉ còn từ project active (=0) + global |
| 2 | Dọn data orphan tồn đọng (opportunities của HaiDang/FE Test/BA/VILOG...) | ✅ **weekly opportunities count = 0** | `GET /leads-kpis/weekly?year=2026` không còn mồ côi |
| 3 | Cascade khi xóa dự án | ✅ **ĐẠT** | Tạo project test + weekly actual (rawLeads=25,mql=10,sql=4) + opportunity (555.000) → KPI cards Toàn hệ thống = 25/10/4/OPP 1/Pipeline 555.000 → `DELETE /projects/:id` → về **0**; opportunities count về **0** |
| 4 | `GET /dashboard/funnel` (không `projectId`) | ✅ ra 0 | không nhồi số project đã xóa |
| 5 | `GET /dashboard/pipeline-by-segment` (không `projectId`) | ✅ mọi segment openDeals/value = 0 | không nhồi số project đã xóa |
| 6 | `GET /leads-kpis/closed-deals` | ✅ `[]` | đã dọn sạch |
| 7 | `GET /v1/projects` | ✅ chỉ còn 3 project active | Lead Generation, INNOEX 2026, [Email MKT] Lead |

**Kết luận Phần E: ĐẠT toàn bộ.** Cascade khi xóa dự án đã hoạt động (weekly actual + opportunity bị xóa theo project); aggregate "Toàn hệ thống" không còn cộng data của project đã soft-delete; data orphan đã dọn sạch.

---

# PHẦN F — YÊU CẦU BỔ SUNG (09/09/2026): ĐỒNG BỘ 2 NGUỒN LEADS&KPI — DAILY `/actual` vs WEEKLY/MONTHLY `/weekly`

## F.1. Hiện tượng (verify production 09/09/2026)

Form "Nhập Thực Tế" (ActualsForm) ghi daily actual thành công nhưng **tab "Xem & Phân tích" (kpi-cards/funnel) và tab "Chi tiết dự án" (projects.kpis[]) không cập nhật**.

Repro bằng API thật (project `ActualFlowTest` `8660cd38-883d-48ea-9b65-79e2c79b727a`):

| Bước | Thao tác | Kết quả |
|---|---|---|
| 1 | `POST /v1/leads-kpis/projects/:id/actual` (daily, rawLeads=77/mql=33/sql=12/opp=5/closedDeal=2) | Lưu OK (`exists:true`) |
| 2 | `GET /dashboard/kpi-cards?projectId=...` | ❌ vẫn = 0 |
| 3 | `GET /leads-kpis/weekly?year=2026&month=9&projectId=...` | ❌ actual = 0 |
| 4 | `GET /projects/:id` → `kpis[].actual` | ❌ vẫn = 0 |
| 5 | `POST /v1/leads-kpis/weekly` {year,month,projectId,77,33,12} | |
| 6 | Lặp lại bước 2 và 4 | ✅ kpi-cards = 77/33/12; `projects.kpis[].actual` = 77/33/12 |

## F.2. Nguyên nhân gốc (Root cause)

Tồn tại **2 bảng song song**, không sync:

- **Daily**: `POST/PATCH /v1/leads-kpis/projects/:id/actual` → chỉ nuôi `GET /v1/leads-kpis/projects/:id/progress` (cumulative của PerformanceDashboard). **Không** được `kpi-cards`/`funnel`/`projects.kpis[]` đọc.
- **Weekly/monthly**: `GET/POST /v1/leads-kpis/weekly?...&month=` → là nguồn duy nhất cho `kpi-cards`, `funnel`, `projects.kpis[]`.

Trước ngày 09/09/2026, ActualsForm chỉ gọi daily (`saveActuals`), nên số liệu thực tế lưu thành công nhưng không bao giờ hiện ra ở "Xem & Phân tích" hay "Chi tiết dự án".

## F.3. Biện pháp FE (đã thực hiện cùng ngày)

`ActualsForm.jsx` — khi lưu **ghi đồng thời cả 2 nguồn**: `saveActuals` (daily, giữ `/progress` + fallback localStorage) **và** `saveMonthlyActuals` (`POST /weekly` với `period` = tháng của ngày phát sinh). Do đó sau khi sửa, cả 3 đầu đọc đều thấy số liệu mới. (Đã build thành công.)

## F.4. Yêu cầu BE — đồng bộ daily → weekly/monthly (bắt buộc)

Mục tiêu: **không còn 2 nguồn lệch nhau**. Dù user/third-party nhập qua đường daily hay weekly, kết quả đọc ra phải giống nhau, và **không bị double-count**.

1. **Rollup khi ghi daily**: `POST/PATCH /v1/leads-kpis/projects/:projectId/actual` phải **upsert lại tổng tháng** vào weekly/monthly (giá trị monthly = tổng các row daily của `(year, month, projectId)` trong tháng đó). Ghi đè (upsert), **không cộng dồn** vào value monthly hiện có → tránh double-count khi FE gọi cả daily + weekly.
2. **Rollup khi đọc**: mọi endpoint đọc dùng weekly/monthly (`GET /v1/leads-kpis/weekly`, `GET /dashboard/kpi-cards`, `GET /dashboard/funnel`, `GET /projects/:id` → `kpis[]`) phải thỏa: nếu month đó tồn tại row daily mà chưa có row weekly (hoặc weekly = 0 trong khi daily > 0) thì phải tính lại từ daily (fallback aggregate), hoặc BE dọn 1 lần cho toàn bộ DB hiện tại.
3. **Backfill dữ liệu cũ**: rà toàn bộ `daily actual` hiện có, upsert tổng theo `(year, month, projectId)` vào weekly — để các số đã nhập trước 09/09 được hiện lên sau khi deploy.
4. **Không double-count**: kiểm tra kỹ khi **cả daily và weekly** đều có dữ liệu cho cùng month — kết quả chỉ lấy tổng daily (nếu cả 2 đều là nguồn daily) hoặc ưu tiên weekly khi nó là manual override, tuyệt đối không cộng 2 lần.

## F.5. Test chấp nhận (acceptance)

| # | Kịch bản | Kỳ vọng | Kết quả verify (09/09/2026 — sau khi BE cập nhật) |
|---|---|---|---|
| 1 | Project test chỉ `POST` daily (rawLeads=55/mql=22/sql=9) — `DailyOnlyProbe` | ✅ `kpi-cards` = 55/22/9 | ✅ **ĐẠT** — daily-only giờ hiện đủ trên `kpi-cards` |
| 2 | `GET /projects/:id` → `kpis[].actual` | ✅ = 55/22/9 | ✅ **ĐẠT** — kpis rawLeads=55/mql=22/sql=9 (opp=1, closed=1 đọc từ daily) |
| 3 | POST daily đủ 3 ngày trong 1 tháng (10/5/2) + (7/3/1) + (5/2/0) | monthly = **22/10/3**, không phải 2× | ✅ **ĐẠT** — kpi-cards = 22/10/3 |
| 4 | POST daily rồi POST weekly cùng value → `kpi-cards` = value (không double) | ✅ | ✅ **ĐẠT** — `ProbePureBoth`: weekly 24 trước + daily 24 sau → vẫn = 24, per-week về 0/24/0/0 |
| 5 | Xóa 1 row daily → weekly/monthly giảm tương ứng (rollup lại) | ✅ | ✅ **ĐẠT** — xóa row (10/5/2) → 22/10/3 thành 12/5/1 |

### ✅ KẾT QUẢ VERIFY LẦN 1 (09/09/2026 — sau khi BE cập nhật)

**ĐẠT toàn bộ test chấp nhận** ở cả 5 kịch bản:

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Daily-only → `kpi-cards` | ✅ 55/22/9 hiện đúng |
| 2 | Daily-only → `projects.kpis[].actual` | ✅ 55/22/9 (kèm opp/closed) |
| 3 | 3 dòng daily 1 tháng | ✅ tổng 22/10/3, không double |
| 4 | Cả daily + weekly cùng tháng | ✅ = value (24), không 48 |
| 5 | Xóa daily | ✅ giảm đúng (22→12/10→5/3→1) |

**Ghi chú quan trọng — data cũ tạo TRƯỚC update vẫn còn over-count:**

- Project test `ActualFlowTest` (tạo trước update: daily 77 + weekly 77 cùng tháng 9) hiện bị **135/58/21** thay vì 77 — do rolling mới cộng đồng thời weekly row cũ trải 4 tuần + daily row 77.
- Với data **nhập MỚI sau update**, không bị lỗi này (kịch bản #4 ĐẠT).
- → Vẫn còn **phần F.4.3 (backfill/migration dữ liệu cũ)** — BE cần dọn/làm khớp các row weekly cũ đã ghi trước khi có cơ chế rollup mới (hoặc hủy các row weekly trùng khi đã có daily).
- Dữ liệu thật còn lại sau dọn probe: project `test` (10/6) + `INNOEX 2026` (4/4) → Toàn hệ thống = 14/10/6 (hợp lệ, không phải ghost).

## Ghi chú nguồn dữ liệu hiện tại (để BE đối chiếu)

- Daily: `POST /v1/leads-kpis/projects/:id/actual` — body `{projectId, actualDate, rawLeads, mql, sql, opp, closedDeal}`. **Đã VERIFY**: POST daily-only → được rollup vào `kpi-cards`/`projects.kpis` (ĐẠT); DELETE daily → rollup giảm theo (ĐẠT).
- Monthly: `POST /v1/leads-kpis/weekly` — body `{year, month, projectId, rawLeads, mql, sql}` (upsert, đã verify ghi đè không double với data mới).
- Đọc cumulative: `GET /v1/leads-kpis/projects/:id/progress` (nhìn daily).
- **Đã dọn sạch toàn bộ project test** sau khi verify: `ActualFlowTest`, `DailyOnlyProbe`, `ProbeWeekly`, `ProbeDaily2`, `ProbeBoth2`, `ProbePureBoth`, `ProbeThreeDaily` (7 project, `DELETE /projects/:id` đều 200). Dữ liệu thật còn lại: `test` (10/6) + `INNOEX 2026` (4/4) → Toàn hệ thống = 14/10/6 hợp lệ.

---

## Kết luận chung & thời lượng

- **Phần A** (expense): logic đọc/ghi **ĐÃ FIX ĐẠT**; còn **data ghost tồn đọng chưa dọn** (A.4.3 + Phần D mới bổ sung) — cần BE dọn DB.
- **Phần B** (project type): **ĐÃ FIX ĐẠT** toàn bộ, không còn enum cứng chặn type mới, không cần sửa thêm.
- **Phần D** (rút gọn khoảng cách tab nhập chi phí 150.000 vs tab ngân sách 251.000): ✅ **ĐẠT toàn bộ** — BE đã dọn record ghost `test m1 = 100.000` và `backup m1 = 1.000`; `dashboard totalBudget = 150.000` khớp bảng nhập liệu; cascade soft-delete budget đã hoạt động.
- **Phần E** (mới — data Leads&KPI còn sót khi xóa dự án): ✅ **ĐẠT toàn bộ** — BE đã cascade-dọn `weekly_actuals`/`opportunities` khi `DELETE /v1/projects/:id`, aggregate "Toàn hệ thống" lọc project active, data orphan (nguồn 1769/608/239) đã dọn sạch.
- **Phần F** (mới — 2 nguồn daily `/actual` vs weekly `/weekly` lệch nhau khiến form nhập actual không hiện ở "Xem & Phân tích"/"Chi tiết dự án"): **FE đã sửa** (ActualsForm ghi song song cả daily + monthly, build OK, đã deploy). **BE đã cập nhật — ĐẠT 5/5 test chấp nhận**: daily-only rollup, projects.kpis, 3 dòng daily cộng đúng, daily+weekly không double (data mới), xóa daily → giảm theo. **Còn lại:** F.4.3 backfill data cũ (row weekly ghi trước update bị over-count, vd ActualFlowTest 135≠77) — cần BE migration/dọn 1 lần.

Ước tính việc còn lại: **> hằng số ≈ 0** — Phần A/B/D/E đều ĐẠT; Phần F: FE ✅ (deploy xong), BE ✅ (rollup mới chuẩn), chỉ còn **backfill data cũ** (mức nhỏ, 1 lần). Còn lại tùy chọn: kiểm tra anti-ghost cho các bảng KPI khác (kpi_distributions/comparative) nếu cần, nối các API chưa dùng vào FE. Toàn bộ project test đã dọn sạch.
