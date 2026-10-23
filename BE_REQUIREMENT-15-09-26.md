# Yêu cầu BE — 15/09/2026

**Người gửi:** FE Team
**Ưu tiên:** Cao

> **Trạng thái (15/09/2026): toàn bộ đã được BE fix và FE xác minh trên prod.**
> - Mục 1 (SME): ✅ đã fix — `SME=7, Enterprise=17, Medium=9`; `smb` pipeline `openDeals=7`.
> - Mục 2 (`subtasks` + `doneDate`): ✅ đã fix — round-trip PATCH → GET giữ nguyên `doneDate` (gồm cả `null`).
> - Mục 3 (`stakeholders`): ✅ đã fix — lưu/trả nguyên vẹn mảng tên.
> - Mục 4 (báo cáo tuần theo `completedDate`): ✅ đã fix — tuần 37=3, tuần 38=6 (gồm 5 task `completedDate=09-15`).

---

## 1. Opportunity `size=SME` bị ép thành `Enterprise`

### Vấn đề

Khi tạo/sửa Opportunity với `size = "SME"` (giá trị **hợp lệ** từ dropdown `company_size`, đang `isActive = true`), BE vẫn trả 200 nhưng **lưu vào DB giá trị `"Enterprise"`**. Sau khi refresh bảng Chi tiết Opportunity, dòng quay về `Enterprise`.

### Bằng chứng

- Dropdown `company_size` do BE trả về: options active gồm `SME`, `Enterprise`, `Medium`.
- FE gửi nguyên vẹn: `addOpportunity`/`updateOpportunity` gửi `size: data.size || 'Enterprise'` → vẫn là `"SME"` khi user chọn SME (đã kiểm tra cả bundle đang chạy ở `mkthub-pied.vercel.app` — build cũ — vẫn pass-through `t.size || "Enterprise"`).
- Kiểm tra trực tiếp trên API prod (dùng account tạo tạm, quyền `specialist`, chỉ đọc): `GET /api/v1/leads-kpis/opportunities` trả **34 dòng**, phân bổ `Enterprise = 25`, `Medium = 9`, **`SME = 0`** — dù user đã test đổi SME nhiều lần.
- Dòng test user thao tác lúc ~05:22 UTC: `id=95771a4b-12ba-43ca-a2c6-1c9e709e5ace`, `companyName="test"`, sau khi đổi SME có `updatedAt=2026-09-15T05:24:23.887Z` và `size="Enterprise"` → BE đã lưu Enterprise.
- `GET /api/v1/leads-kpis/pipeline-by-segment` → `smb: { openDeals: 0, value: 0, growthPct: 0 }` vì trong DB không có bất kỳ Opportunity nào mang size `SME/SMB`.
- Schema DTO (`CreateOpportunityDto`/`UpdateOpportunityDto`/`OpportunityDto.size`) là `string` **không enum** → FE gửi `"SME"` không bị validate chặn, nhưng được lưu thành `"Enterprise"`.

### Kết luận

BE **ép (normalize)** `size` về `Enterprise`/`Medium` khi ghi — không nằm trong FE.

### Yêu cầu BE

1. Khi `POST`/`PATCH /api/v1/leads-kpis/opportunities`, **lưu `size` nguyên vẹn** như FE gửi (đặc biệt là `SME` đang là option active của dropdown `company_size`). Bỏ bất kỳ whitelist/fallback nào đang ép về `Enterprise`.
2. Nếu BE giữ nguyên normalize, hãy **không nhận im lặng 200**: trả lỗi validate rõ ràng để FE hiển thị, thay vì lưu sai dữ liệu.
3. `GET /opportunities` phải trả đúng `size` đã lưu.
4. `GET /pipeline-by-segment` map `SME` → segment `smb` (đang 0) giống các giá trị khác.

### Ghi chú cho FE

- FE đã pass-through `size` từ bản local mới nhất (chưa deploy theo yêu cầu).
- Sửa tạm ở FE chỉ giữ `SME` trên giao diện trong phiên; sau **reload vẫn về Enterprise** vì BE không lưu `SME`. Fix triệt để nằm ở BE.

---

## 4. Báo cáo tuần: "Công việc đã hoàn thành" đang nhóm theo `execWeek` (tuần kế hoạch) thay vì `completedDate`

### Vấn đề

Khi user **chỉnh lại thời gian hoàn thành** của task cũ (đổi `completedDate` sang tuần hiện tại), báo cáo tuần **tuần cũ vẫn tính task đó là "đã hoàn thành"**, còn tuần mới không thấy — vì BE build danh sách done dựa trên `execWeek` (tuần kế hoạch), không dựa trên ngày hoàn thành thực tế.

### Bằng chứng (ngày 15/09/2026)

- 5 task `[ĐĂNG KÝ & HỢP ĐỒNG TRIỂN LÃM]` có `completedDate = 2026-09-15` (thuộc **tuần 38**: 14–20/09) nhưng vẫn nằm trong danh sách done của **tuần 37** (07–13/09) vì chúng có `execWeek = 37`; `updatedAt` mới nhất là hôm nay nhưng không chuyển tuần.
- `GET /v1/tasks` trả đủ `completedDate` chính xác; lỗi nằm ở logic tạo section `done` của `/v1/weekly-reports`.

### Yêu cầu BE

1. `GET /v1/weekly-reports` (theo `week`/`year`): danh sách `sections.done` phải là các task có **`completedDate` rơi vào khoảng tuần được chọn** (ISO week, Mon–Sun hoặc theo quy ước tuần hiện tại của dự án), **không** dựa trên `execWeek`.
2. Payload của từng task done phải kèm `completedDate` (để FE/export xác minh).
3. Nếu một task **chưa có `completedDate`** hãy mặc định xếp vào tuần kế hoạch (`execWeek`) như hiện tại — chỉ ưu tiên `completedDate` khi đã có.

### Ghi chú cho FE

- FE đã có workaround tạm (`getWeeklyDoneByCompletedDate` trong `services/api.js`): tự lọc lại task done theo `completedDate` ở client và chỉ giữ dữ liệu BE cho task thiếu `completedDate`. Fix triệt để nằm ở BE.
- Liên quan: bug phân bổ phạm vi ngày của Opportunity (`initiationDate`/`createdAt` bị gán sai field) đã được ghi riêng ở `BE_REQUIREMENT_11-09-26-OPP-period.md` — cùng họ "BE gán thời gian sai trường", nên xử lý chung trong đợt này.

---

## 2. Task: `subtasks` — bổ sung `doneDate` (ngày cần hoàn thành)

> **Cập nhật lần 2 (15/09/2026):** BE đã thêm field `subtasks` và lưu/trả được mảng, **nhưng đang BỎ MẤT `doneDate`**. Yêu cầu dưới đây là bản chi tiết để BE sửa nốt điểm này.

### Hiện trạng (kiểm tra trên prod 15/09/2026)

- `GET /v1/tasks` đã trả field `subtasks`; BE lưu được mảng (task "test" có 3 subtasks).
- Nhưng mỗi phần tử **thiếu `doneDate`** — sample thực tế BE trả:
  ```json
  "subtasks": [
    { "id": "5b80221c-2e82-4e66-b621-3f32221cca0b", "text": "test 1", "done": true },
    { "id": "b673514a-a382-4fda-8471-429aea462432", "text": "test 2", "done": false },
    { "id": "3bcaa142-18f9-4827-8bef-279745517999", "text": "test 3", "done": false }
  ]
  ```
  → `doneDate` bị **drop khi ghi và/hoặc khi đọc** (không có trong `UpdateTaskDto`/`TaskDto` hoặc bị whitelist filter).

### Mục đích business của `doneDate`

- `doneDate` = **ngày cần hoàn thành của task nhỏ**, do người dùng **nhập/chọn** trong popup tạo & sửa Task (ô `<input type="date">`, không tự sinh khi tick checkbox).
- FE dùng `doneDate` để hiển thị cột **"Ngày cần hoàn thành"** ở bảng **"Task nhỏ cần làm trong tuần"** (tab Báo cáo tuần).
- Nếu `doneDate` bị bỏ, cột này luôn hiển thị "—" (mapping không ra).

### Yêu cầu chi tiết

#### 1. DTO — thêm `doneDate`

- Bổ sung `doneDate` vào **`CreateTaskDto`**, **`UpdateTaskDto`**, **`TaskDto`** (để `POST`, `PATCH`, `GET /v1/tasks`, `GET /v1/tasks/:id` đều có field).
- Kiểu: `string | null` — định dạng chuẩn **`YYYY-MM-DD`** (không kèm giờ, không kèm timezone).
- Tùy chọn: thiếu hoặc `null` → mặc định `null`.
- **Không normalize/convert**: lưu và trả về **nguyên vẹn chuỗi FE gửi** (không đổi múi giờ, không ép thành `Date` rồi serialize lệch ngày — giống cách `text`/`done` đang hoạt động).

#### 2. Định dạng chuẩn mảng `subtasks` (áp dụng chung cho tạo/đọc/cập nhật)

```json
[
  {
    "id": "uuid_hoặc_tự_sinh",
    "text": "Nội dung task nhỏ",
    "done": false,
    "doneDate": "2026-09-15"
  }
]
```

| Field | Bắt buộc | Kiểu | Giải thích |
|---|---|---|---|
| `id` | Không | string | FE gửi `null` cho mục mới, BE tự sinh nếu thiếu; cần ổn định trong phiên để FE dùng làm React `key`. |
| `text` | Có | string | Nội dung task nhỏ, đã trim, không rỗng. |
| `done` | Không | boolean | Mặc định `false` (đã hoàn thành hay chưa). |
| `doneDate` | Không | `string (YYYY-MM-DD)` hoặc `null` | **Ngày cần hoàn thành**. Mặc định `null`. Độc lập với `done`: có thể có `doneDate` khi chưa `done` (đặt deadline trước), hoặc `done` mà chưa nhập ngày. |

#### 3. Hành vi ghi (POST / PATCH)

- `POST /v1/tasks`: lưu **toàn bộ mảng** `subtasks` kèm `doneDate` từng phần tử ngay khi tạo.
- `PATCH /v1/tasks/:id`: **thay thế toàn bộ mảng** `subtasks` (không merge theo `id`, không "giữ lại" field cũ của phần tử bị thiếu `doneDate`).
- **Không được im lặng drop** `doneDate` (hoặc bất kỳ field nào trong phần tử subtask).

#### 4. Hành vi đọc

- `GET /v1/tasks`, `GET /v1/tasks/:id`: mỗi phần tử `subtasks` phải trả **đủ 4 field** `id`, `text`, `done`, `doneDate` (kể cả `doneDate: null`, không được lược bớt field).

### Tiêu chí chấp nhận (AC) — dùng để test

1. `PATCH /v1/tasks/:id` với body:
   ```json
   { "subtasks": [ { "text": "Kiểm tra A", "done": true, "doneDate": "2026-09-18" } ] }
   ```
   → `GET /v1/tasks/:id` phải trả `doneDate: "2026-09-18"` (không thiếu, không `null`, không đổi sang ngày khác).
2. Gửi `doneDate: null` → GET trả về `null`.
3. PATCH đổi `doneDate` của 1 mục đã tồn tại → ngày mới **đè** ngày cũ; các mục khác trong mảng **giữ nguyên** giá trị của chúng.
4. `POST /v1/tasks` tạo mới kèm `subtasks` có `doneDate` → GET lại trả đúng.
5. Validate format: `doneDate` sai định dạng (vd `2026/09/18`, `18-09-2026`) → trả **lỗi 4xx rõ ràng**, **không im lặng bỏ qua** (đúng tinh thần mục 1: không nhận rồi ghi sai).

### Ghi chú cho FE

- FE gửi đúng format `YYYY-MM-DD` từ ô ngày trong popup edit task; payload `subtasks: [{ id, text, done, doneDate }]`.
- FE vẫn giữ fallback localStorage (`mkt_hub_subtasks:<taskId>`) nên dữ liệu hiện có không mất — nhưng sau khi BE fix, nguồn chính thức là `task.subtasks` từ GET.

---

## 3. Task: "Người liên quan" giờ là danh sách thành viên thật

- Popup tạo & sửa Task chuyển mục "Người liên quan" từ dropdown nhóm (BOD, Sales Team...) sang **chọn nhiều thành viên thật** (tên từ `GET /members`), lưu vào field `stakeholders` (mảng string tên).
- **Không cần thay đổi BE** — `stakeholders` đã nằm trong `CreateTaskDto`/`UpdateTaskDto` và lưu nguyên vẹn.
- Yêu cầu nhỏ: đảm bảo `stakeholders` **lưu và trả về nguyên vẹn mảng tên** (không gộp chuỗi, không dedupe, không convert).
- FE vẫn đọc tương thích giá trị cũ (nhóm như `BOD`): task cũ dùng `BOD` vẫn hiện đúng + checkbox "Cần BOD hỗ trợ" hoạt động.