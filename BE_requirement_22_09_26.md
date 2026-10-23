# Yêu cầu BE — 22/09/2026 (Task: Raw Leads tuần 39 bị tính sai — dashboard/`weekly` đọc nhầm nguồn actual)

**Người gửi:** FE Team
**Ưu tiên:** Cao (user đang theo dõi số liệu Leads & KPIs theo tuần và nhìn thấy sai ngay)

> **Mục tiêu:** `GET /v1/dashboard/kpi-cards` và `GET /v1/leads-kpis/weekly` khi truy vấn theo `week` phải trả về đúng số actual dựa trên **các bản ghi daily-actuals của các ngày thuộc tuần đó** — cùng kết quả với `GET /v1/leads-kpis/reports/weekly`. Hiện tại hai endpoint này đang trả **3** lead cho tuần 39 trong khi tuần 39 thực tế chỉ có **1** lead.

---

## 1. Bối cảnh & hiện trạng

User nhập dữ liệu Thực tế (Actuals) theo ngày ở tab **Nhập Số Liệu**, sau đó mở tab **Xem & Phân tích** chọn *Tuần 39* và thấy **RAW LEADS = 3**, dù tuần 39 mới chỉ nhập **1** lead.

FE nhận định *"tuần 39 đang count số của tuần 38"*, nhưng khi rà soát kỹ dữ liệu production thì **hai con số 3 này là khác nhau về bản chất**:

| Tuần | KPI/WEEKLY trả về | Thành phần thật trong daily-actuals |
|------|------------------|-------------------------------------|
| W38 | 3 | LEAD GENERATION 2026: 14/09=1 + 16/09=2 (**3 đúng**) |
| W39 | 3 | LEAD GENERATION 2026: 22/09=1 (`reports/weekly` trả **1**) — **thừa 2 lead không có bản ghi daily nào** |

Nguồn dữ liệu đã truy vấn trên production (`https://mkt-hub.onrender.com`, token quyền manager `a.nguyen@company.com` / `demo123`):

| Endpoint | W39 kết quả `rawLeads` | Ghi chú |
|----------|------------------------|---------|
| `GET /v1/leads-kpis/reports/weekly?year=2026&week=39` | **1** | Đúng — chỉ có daily record 22/09 của LEAD GENERATION 2026 |
| `GET /v1/leads-kpis/weekly?year=2026&week=39` | **3** | Sai — đếm thêm ACCOUNT CENTRIC (1) + INNOEX (1) |
| `GET /v1/dashboard/kpi-cards?period_type=week&period_value=39&year=2026` | **3** | Sai — cùng nguồn với `weekly` |

**Bằng chứng "2 lead ma":** hai dự án ACCOUNT CENTRIC và INNOEX **không có bất kỳ daily-actuals record nào** trong W38–W39 (năm 2026), chỉ có record ở W36/W37:

| Project (id) | daily W36 | daily W37 | daily W38 | daily W39 | weekly/kpi W39 |
|--------------|-----------|-----------|-----------|-----------|----------------|
| ACCOUNT CENTRIC `a61144fd-…` | 0 | 1 (09/09) | 0 | 0 | **1** ❌ |
| INNOEX `82ddad9c-…` | 2 (04/09, 31/08) | 1 (07/09) | 0 | 0 | **1** ❌ |
| LEAD GENERATION `e73d7aee-…` | — | — | 3 | 1 (22/09) | 1 ✅ |

`GET /v1/leads-kpis/projects/{id}/kpi-actuals?from=2026-09-21&to=2026-09-27` trả `totalCount: 0` cho ACC và INNOEX, `totalCount: 1` cho LEAD GENERATION.

**Nghi vấn chính:** `weekly`/`kpi-cards` đang tổng hợp từ **một nguồn actual cấp tuần khác** (bảng week-level lưu qua `POST /v1/leads-kpis/weekly`, hoặc rollover, hoặc monthly allocation) chứ **không phải** daily-actuals — dẫn đến trùng/gán nhầm lead cho nhiều dự án trong cùng tuần.

---

## 2. Thay đổi backend yêu cầu

### 2.1. `kpi-cards` & `weekly` phải dùng đúng nguồn actual (bắt buộc)

- Khi `period_type=week` (và `period_value` là số tuần ISO), `GET /v1/dashboard/kpi-cards` và `GET /v1/leads-kpis/weekly` phải tính `actual.rawLeads / mql / sql` bằng cách **gộp các daily-actuals có `actualDate` thuộc đúng tuần ISO đó** của các dự án trong phạm vi lọc (`projectId` nếu có, ngược lại **toàn bộ dự án**).
- Kết quả phải **khớp tuyệt đối** với `GET /v1/leads-kpis/reports/weekly` (`total.rawLeads`) cho cùng `year + week`.
- **Không** cộng dồn thêm từ bảng week-level / monthly / rollover khi đang truy vấn theo `week` (rollover phải giữ nguyên vai trò chỉ nằm trong field `rollover`, **không** nhập vào `actual`).

### 2.2. Xác định & dọn nguồn dữ liệu week-level đang tồn đọng

- Rà soát dữ liệu hiện có: tìm các bản ghi actual cấp tuần của **ACCOUNT CENTRIC (`a61144fd-d88e-424b-ad17-ebf3ea073c87`)** và **INNOEX (`82ddad9c-b39c-48e4-8795-bf8e37abe82a`)** ứng với W39/2026 (1 lead mỗi cái) mà không có daily-actuals tương ứng.
- Nếu là dữ liệu thật do user nhập (monthly/week-level) thì **không xoá**, chỉ chuyển sang cách tính đúng nguồn (trả về có thể khác số cũ). Nếu là dữ liệu test/tạm thì **xoá hoặc vô hiệu hoá**.
- Sau khi dọn: W39/2026 của 3 dự án này như sau:

| Project | W38 | W39 (kỳ vọng) |
|---------|-----|---------------|
| LEAD GENERATION 2026 | 3 | 1 |
| ACCOUNT CENTRIC | 0 | 0 |
| INNOEX | 0 | 0 |

### 2.3. (Gợi ý) Bổ sung trường chứa dữ liệu week-level để khỏi nhầm lẫn logic

Nếu hệ thống **vẫn cần** lưu actual theo tuần (không theo ngày), tách bạch 2 model:

| Model | Vai trò | Được đọc bởi |
|-------|---------|--------------|
| Daily-actuals (hiện có) | Số liệu thực tế theo ngày — nguồn chính cho `week` / `month` | `weekly`, `kpi-cards`, `reports/weekly`, `monthly` |
| Week-level actual (nếu có) | Chỉ dành cho màn hình nhập "tổng tuần" riêng | chỉ nơi FE tường minh gọi |

Tránh thiết kế 2 nguồn cùng ghi vào một field `actual` gây double-count như hiện tại.

---

## 3. FE sẽ làm gì sau khi BE xong

| # | Nội dung | File |
|---|----------|------|
| 1 | Không thay đổi gì ở màn Xem & Phân tích — FE hiển thị đúng số BE trả về | `FE/components/LeadsKPIs/ViewAnalytics.jsx` |
| 2 | (Đối chiếu trong lúc chờ BE) Nếu cần, FE có thể hiển thị thêm dòng nguồn dữ liệu `weekly` (daily vs week-level) để debug | `ViewAnalytics.jsx` (tạm thời) |

> Lưu ý: FE không thể tự sửa ở lớp hiển thị vì số 3 là do BE tính sai. Mọi fix nằm ở backend.

---

## 4. Kiểm tra chấp nhận (checklist cho BE)

- [ ] `GET /v1/leads-kpis/weekly?year=2026&week=39` → `actual.rawLeads = 1` (khớp `reports/weekly`).
- [ ] `GET /v1/dashboard/kpi-cards?period_type=week&period_value=39&year=2026` → Raw Leads `actual = 1`.
- [ ] `GET /v1/leads-kpis/weekly?year=2026&week=39&projectId={ACC}` → `actual.rawLeads = 0`; `projectId={INNOEX}` → `0`.
- [ ] `GET /v1/leads-kpis/weekly?year=2026&week=38` → vẫn `actual.rawLeads = 3` (không đổi hành vi đúng hiện tại).
- [ ] Với 1 tuần bất kỳ, `actual` của `weekly` / `kpi-cards` **luôn bằng** `total` của `reports/weekly` cùng `year + week` (không phân biệt có hay không có `projectId`).
- [ ] Field `rollover` vẫn chứa giá trị rollover riêng, không bị nhập vào `actual`.
- [ ] Tổng hợp `kpi-cards` theo `month` không bị đổi (chỉ ảnh hưởng tới `week`).

---

## 5. Cần BE chốt lại

1. **Nguồn `actual` khi query theo `week` hiện đang đọc từ model nào?** FE cần BE xác nhận lý do ACC/INNOEX ra 1 lead W39 dù không có daily-actuals.
2. **Có tồn tại dữ liệu week-level độc lập cần giữ không**, hay tất cả actual phải quy về daily? Nếu có, xác nhận thứ tự ưu tiên nguồn.
3. Dữ liệu week-level của ACC/INNOEX W39 là dữ liệu thật hay test — **xoá hay giữ**?

---

**Tóm tắt:** tab Xem & Phân tích tuần 39 hiện báo 3 lead là **sai liên quan tới backend** — `weekly`/`kpi-cards` đang gộp nhầm actual week-level (không tồn tại bản ghi daily) cho ACCOUNT CENTRIC và INNOEX. Chuẩn daily `reports/weekly` trả đúng **1**. Cần BE chuyển `weekly`/`kpi-cards` sang đọc từ daily-actuals và dọn dữ liệu tồn đọng (mục 2.1 → 2.2).