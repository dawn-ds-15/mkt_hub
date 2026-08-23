# Yêu cầu BE bổ sung (23/08/2026)

> Nguồn: bug phát hiện khi FE hoàn thiện tính năng **xem Hợp đồng & Hồ sơ** trong tab Chi tiết Dự án
> (`FE/pages/ProjectDetail.jsx`). FE đã xong phần UI: click tên hồ sơ/hợp đồng trong danh sách
> → mở file ra xem (tab mới). Nhưng hiện **không thể xem được file** vì thiếu URL từ backend.

---

## 1. Document không có URL xem/tải — click tên file không mở được

### 1.1 Hiện trạng

| Điểm | Trạng thái |
|------|-----------|
| `GET /v1/projects/{id}/documents` | Trả list `ProjectDocumentDto` (id, projectId, name, size, mimeType, category, uploadedAt, archivedAt) nhưng **field `url` = null** (hoặc không có) |
| `POST /v1/projects/{id}/documents` (upload) | File được nhận và lưu metadata OK, nhưng response **cũng không trả `url`** |
| Kết quả FE | Có đủ danh sách file, đổi category OK, xoá mềm OK — nhưng click vào file thì **không có gì để mở** |

Bằng chứng phía FE:

- `FE/services/api.js` → `mapDocument()` đã map sẵn `url: d.url || null` — BE trả gì FE nhận nấy,
  hiện luôn rơi vào nhánh `null`.
- `FE/pages/ProjectDetail.jsx` → mỗi dòng hồ sơ là link `<a href={doc.url} target="_blank">`;
  khi `doc.url` null → toast lỗi *"File này chưa có đường dẫn để xem."*

### 1.2 Yêu cầu

Với **mọi response trả ra `ProjectDocumentDto`** (cả GET list lẫn POST upload), bổ sung field:

```
{
  ...,
  "url": "<đường dẫn tuyệt đối, trình duyệt mở trực tiếp được>",
  ...
}
```

### 1.3 Phương án A (khuyến nghị) — URL tĩnh/signed tuyệt đối

- Lưu file vật lý (disk trên Render volume, S3, Cloudinary… tuỳ BE chọn) và trả **URL tuyệt đối**
  (`https://...`) trỏ thẳng tới file.
- Nếu thư mục chứa file nhạy cảm: trả **signed URL có expiry** thay vì URL công khai.
- Ưu tiên loại này vì FE chỉ cần `<a target="_blank">` là xem được mọi loại file
  (PDF/ảnh mở inline; DOCX/XLSX tự tải về).

### 1.4 Phương án B — endpoint stream riêng (nếu không muốn expose file tĩnh)

Thêm endpoint tải file:

```
GET /api/v1/projects/documents/{id}/file
→ 200, trả binary đúng Content-Type của file gốc, Content-Disposition: inline
```

Lưu ý bắt buộc nếu chọn phương án B: phải hỗ trợ **token qua query param** (`?token=<jwt>`)
vì link `<a target="_blank">` của trình duyệt **không gắn được header Authorization**.
Khi đó FE sẽ tự ghép `${API_BASE}/v1/projects/documents/{id}/file?token=...` làm `url`.

### 1.5 Ràng buộc chung (áp dụng cả 2 phương án)

1. `url` phải **tuyệt đối** (có scheme + host), không trả path tương đối kiểu `/uploads/xxx.pdf`.
2. File xoá mềm (`archivedAt != null`) → URL phải hết hiệu lực (404/403).
3. Khai báo đủ field `url` trong Swagger/docs-json (`ProjectDocumentDto`).
4. Không đổi contract các field hiện có (name, size, mimeType, category…) — chỉ **thêm** `url`.
5. File lớn: giới hạn size hợp lý (vd. ≤ 10 MB/file) và validate MIME ở tầng upload như hiện tại.

### 1.6 Test case chấp nhận

- [ ] Upload 1 PDF + 1 ảnh → GET lại list, cả hai bản ghi có `url` tuyệt đối
- [ ] Mở `url` bằng tab ẩn danh (chưa login) theo đúng phương án đã chọn: xem được file (A) hoặc 401/403 rõ ràng (B)
- [ ] Xoá mềm document → `url` trả 404/403, không còn xem được
- [ ] `/api/docs-json` hiển thị `url` trong schema `ProjectDocumentDto`
- [ ] Response POST upload (ngay lần vừa upload) đã chứa `url`, không cần GET lại

---

## 2. `PATCH /v1/tasks/{id}` — `completedDate` chỉ ghi khi status = Done — ✅ ĐÃ ĐÓNG, KHÔNG YÊU CẦU BE SỬA

> FE đã probe trực tiếp production 23/08 (tài khoản `a.nguyen@company.com`) và xác minh hành vi:
>
> | Request | Kết quả |
> |---|---|
> | `PATCH {completedDate}` một mình (status ≠ Done) | 200, field bị bỏ qua |
> | `PATCH {status:"Done", completedDate}` | ✅ Lưu đúng |
> | Rời Done về Processing | completedDate tự xoá |
> | `{dueDate}` / `{startDate}` đứng một mình | ✅ Bình thường |
>
> → Đây là thiết kế có chủ ý của BE (completedDate là hệ quả của status Done).
> **Xử lý phía FE:** popup Thông tin Task hiển thị dòng cảnh báo dưới ô *Hoàn thành* khi task
> chưa ở trạng thái Done: *"Chuyển trạng thái sang 'Hoàn thành' thì ô này mới có hiệu lực."*
> Không còn yêu cầu nào cho backend ở mục này.

---

## 3. `GET /v1/leads-kpis/closed-deals` — KHÔNG lọc `archivedAt`, bản ghi xoá mềm vẫn hiện (ĐÃ XÁC MINH 23/08)

> FE đã thêm lớp filter client-side (`mkt_hub_deleted`) để UI ẩn ngay, nhưng **phải sửa gốc ở BE**
> vì list này còn là nguồn tính số liệu Closed Deal cho Dashboard KPI và Analytics.

### 3.1 Bằng chứng probe trực tiếp production 23/08 (tài khoản `a.nguyen@company.com`)

| # | Thao tác | Kết quả |
|---|----------|---------|
| 1 | `DELETE /v1/leads-kpis/closed-deals/00000006-…-000000000061/delete` ("Indochina Travel", seed chưa từng xoá) | **200 `{success:true}`** |
| 2 | `GET /v1/leads-kpis/closed-deals` sau khi xoá | **Vẫn trả 67 bản ghi**, "Indochina Travel" vẫn nằm trong list ❌ |
| 3 | `DELETE …/{id}/delete` với "BA test", "BA test 2", "dawn" (đã bị xoá mềm từ trước) | **404** *"Không tìm thấy Closed Deal với ID"* |

Kết luận:

- Endpoint `/delete` hoạt động đúng soft-delete và có lookup `archivedAt IS NULL` (mục 3 → 404).
- Nhưng **endpoint GET list không lọc `archivedAt IS NULL`** → bản ghi đã xoá vẫn hiện vĩnh viễn
  trên UI (bảng Closed Deals, popup Tất cả Closed Deal, biểu đồ Analytics) và **vẫn bị đếm vào
  số liệu** won count/value. Mâu thuẫn với convention chung của dự án
  ("mọi query mặc định filter `archivedAt IS NULL"`).

### 3.2 Yêu cầu BE

1. `GET /v1/leads-kpis/closed-deals` bổ sung điều kiện `archivedAt IS NULL`.
2. Rà soát luôn các endpoint Leads & KPIs khác dùng dữ liệu closed deals cho số liệu
   (`dashboard/overview`, `kpi-cards`, comparison, report…) đảm bảo nhất quán loại bản ghi đã xoá mềm.
3. Trả về kèm field `archivedAt` trong response để FE đối chiếu được khi cần.

### 3.3 Test case chấp nhận

- [ ] DELETE một deal (200) → GET list không còn deal đó, total giảm
- [ ] DELETE lần 2 cùng id → 404 (giữ nguyên hành vi hiện tại)
- [ ] KPI card "Closed Deal" ở Dashboard không còn đếm deal đã xoá

### 3.4 Ghi chú dọn dữ liệu test (23/08)

- Seed **"Indochina Travel"** (`00000006-0000-4000-8000-000000000061`) bị FE team xoá mềm trong quá trình
  probe mục 3.1 — BE/DB khôi phục giúp nếu cần demo đầy đủ bộ seed.
- 3 bản ghi rác đã xoá mềm từ trước nhưng vẫn hiện do lỗi mục 3:
  `"BA test"` (`a2818b3e-…`), `"BA test 2"` (`67ff3bc4-…`), `"dawn"` (`5831c096-…`) — sau khi BE fix
  filter thì chúng sẽ tự biến mất khỏi list.
- FE hiện đang che các bản ghi trên bằng filter client-side, nên trước mắt UI đã đúng.

---

## Checklist cho backend

- [ ] Mục 1 — bổ sung `url` (tuyệt đối/signed) vào `ProjectDocumentDto` cho GET list + POST upload
      (Phương án A khuyến nghị; nếu chọn B thì thêm endpoint `/file` + hỗ trợ `?token=`)
- [ ] Xác nhận phương án lựa chọn để FE khoá cách hiển thị (FE đang sẵn sàng cho cả 2 phương án)
- [ ] Mục 3 — `GET /v1/leads-kpis/closed-deals` filter `archivedAt IS NULL`; rà số liệu KPI/analytics
      không còn đếm deal đã xoá; khôi phục seed "Indochina Travel" nếu cần

> Mục 2 đã đóng — xử lý bằng cảnh báo UI phía FE, BE không phải thay đổi gì.

---

## Ghi chú phía FE (đã xong, không cần BE động đến)

- Click tên hồ sơ/hợp đồng trong card "Hợp đồng & Hồ sơ" (Chi tiết Dự án) → mở `doc.url` tab mới;
  `url` null → toast báo lỗi thay vì mở trang trắng.
- Đã bỏ nút mũi tên góc phải card "Hợp đồng & Hồ sơ".
- Khi BE trả `url` xong, FE **không cần sửa code thêm** — dữ liệu mới tự hiển thị xem được.
