# Phần 7 — Yêu cầu mới (21/08/2026): Xuất kho theo dự án & KPI theo tháng

> **Verify 22/08/2026** qua `/api/docs-json` + probe không auth (401 = route tồn tại, 404 = chưa có) + test có JWT.
> Kết quả: cả 5 mục checklist **đã hoàn thành phía BE**; FE đã nối 7.1 và 7.4. Chi tiết ở từng mục.

## 7.1 API xuất vật phẩm cho dự án (tự trừ tồn kho) — ĐÃ CÓ ✅

> **Verified:** `POST /api/v1/inventory/transactions` có trong docs-json (401 khi chưa auth).
> DTO `CreateInventoryTransactionDto` khớp spec: required `itemId`, `projectId`, `type` (enum `in|out`), `quantity` (min 1); optional `date`, `note`.
> **Test E2E 22/08:** nhập 5 → xuất 2 cho project → 201, `totalStock` còn 3, tự trừ batch (FIFO), record có `batchId`; xuất vượt tồn → **400** `"Số lượng xuất vượt quá tồn kho khả dụng."`
> **FE đã nối:** nút "Xuất cho dự án" (`StockOutModal.jsx`) trong module Kho vật phẩm.

Hiện trạng đã verify qua `/api/docs-json` (21/08/2026): inventory chỉ có
`POST /v1/inventory/entries` (**nhập vào**, bắt buộc `receivedDate`, `batchCode`, `unitPrice`)
và `GET /v1/inventory/transactions`. **Không có endpoint tạo giao dịch OUT.**

Yêu cầu BE bổ sung:

```
POST /api/v1/inventory/transactions
Authorization: Bearer JWT

{
  "itemId":    "uuid",     // required
  "projectId": "uuid",     // required — dự án sử dụng
  "type":      "out",      // required, enum: in | out
  "quantity":  10,         // required, > 0
  "date":      "2026-08-21", // optional, default hôm nay
  "note":      "Dùng cho sự kiện X" // optional
}

201 → { data: { id, itemId, projectId, type: "out", quantity, date, note, createdAt } }
400 → số lượng vượt tồn khả dụng / thiếu field
404 → item hoặc project không tồn tại
```

Hành vi bắt buộc:
- Trừ trực tiếp `totalStock` của item (FIFO theo batch nếu có thể), ghi nhận bản ghi `InventoryTransaction`
- `GET /v1/inventory/transactions` đã có sẵn — cần filter theo `itemId` và/hoặc `projectId`

FE sẽ dùng endpoint này cho nút "Xuất cho dự án" trong module Kho vật phẩm.

## 7.2 Nhập KPI thực tế theo THÁNG cho dự án Lead Generation — ĐÃ CÓ ✅ (Phương án A)

> **Verified:** `SaveWeeklyKpisDto` có thêm `month` (1-12) + `projectId`;
> `GET /v1/leads-kpis/weekly` nhận `year`, `week`, `month`, `projectId`.
> FE `saveMonthlyActuals` (api.js) đã gửi đúng payload `{year, month, projectId, rawLeads, mql, sql}` → sẵn sàng hoạt động.

Theo yêu cầu nghiệp vụ: project `type = "Lead Generation"` nhập số liệu Raw/MQL/SQL
**theo tháng**; các dự án khác giữ nhập theo tuần.

Hiện tại `POST /v1/leads-kpis/weekly` chỉ nhận `{year, week}`. Yêu cầu một trong hai:

- **Phương án A (khuyến nghị):** cho phép `POST /v1/leads-kpis/weekly` nhận
  `{year, month, projectId, rawLeads, mql, sql}` (khi có `month` thì bỏ qua `week`),
  và `GET /v1/leads-kpis/weekly?year=&month=&projectId=` trả dữ liệu tương ứng.
- **Phương án B:** thêm endpoint riêng `POST|GET /v1/leads-kpis/monthly`.

FE đã gửi sẵn payload `{year, month, ...}` lên `/weekly` (sẽ lỗi 400 cho tới khi BE hỗ trợ).

## 7.3 Báo cáo đếm OPP / Closed Deal tự động từ bảng chi tiết — ĐÃ CÓ ✅

> **Verified có JWT (22/08):** số nhập tay weekly **không còn** được dùng (weekly M8 ghi `oppCount=11` nhưng kpi-cards trả `3`).
> - **Closed Deal** ✅ khớp tuyệt đối bảng `closed-deals` theo `closedDate`: M5/M6/M7 = 1/tháng, M8 = 2 (`Hoa Sen Cloud` 20/08 + `dawn` 21/08); W34 = 2, W33 = 0. Doanh thu M8 `wonValue = 166,123,456` = đúng tổng `setupFee` 2 deal.
> - **OPP** ✅ tính server-side từ bảng chi tiết; số liệu quan sát khớp công thức *opportunity mới trong kỳ + deal won trong kỳ* (M5–M7 = 1, M8 = 3 = 1 opp "hair dd" + 2 deal won; W34 = 2). Lưu ý: khác chặt chẽ với đề nghị gốc "chỉ count opportunities theo createdAt" — cần BE xác nhận chủ ý (có thể đang gộp thêm closed deals hoặc đếm cả row soft-deleted).
> - Bonus: kpi-cards trả thêm card `OPP` và `CAC / LTV` (FE đã filter sẵn label `CAC / LTV`).

Thay vì lấy `oppCount`/`closedCount` từ nhập tay weekly, các endpoint báo cáo
(`GET /v1/leads-kpis/analysis`, `/comparison`, **`/v1/dashboard/kpi-cards`,
`/v1/dashboard/funnel`**) cần:

- **OPP** = count bảng `opportunities` theo `createdAt` nằm trong kỳ (week/month/quarter/year)
- **Closed Deal** = count bảng `closed-deals` theo `closedDate` nằm trong kỳ (+ tổng `setupFee` làm doanh thu)

FE đã bỏ 2 ô nhập tay OPP/Closed Deal khỏi Form Thực tế.

## 7.4 Phân khúc khách hàng cho báo cáo Pipeline by Segment — ĐÃ CÓ ✅

> **Verified có JWT (22/08):** `GET /v1/dashboard/pipeline-by-segment?year=2026&period_type=month&period_value=8` →
> `200 { data: [{ segment: "enterprise", openDeals: 1, value: 123456, growthPct: 100 }, { segment: "mid_market", ... }, { segment: "smb", ... }] }` — đúng shape spec.
> Endpoint `/leads-kpis/analysis` cũng trả kèm `pipelineBySegment` + `closedBySegment`.
> **FE đã nối:** bảng "Giá trị Pipeline theo Phân khúc" trong View Analytics + export CSV (`getPipelineBySegment` trong api.js).

View "Xem phân tích" có bảng *Giá trị Pipeline theo Phân khúc* (Enterprise /
Mid-Market / SMB) nhưng BE chưa có nguồn dữ liệu. Yêu cầu:

- Thêm trường `segment` (enum: `enterprise` | `mid_market` | `smb`) cho
  Opportunity/ClosedDeal, hoặc endpoint tổng hợp
  `GET /v1/dashboard/pipeline-by-segment?period_type=&period_value=&year=`
  trả `{ segment, openDeals, value, growthPct }[]`.
- FE hiện đang hiển thị empty-state cho tới khi có API.

## Phần 7 — Checklist cho backend

- [x] Thêm `POST /api/v1/inventory/transactions` (type=out, trừ tồn kho, validate available) — *test E2E OK 22/08: trừ stock FIFO, 400 khi vượt tồn*
- [x] Filter `itemId`/`projectId` cho `GET /api/v1/inventory/transactions` — *có thêm `batchId`, `type` (verify 22/08)*
- [x] Hỗ trợ nhập KPI theo tháng — *Phương án A: `month`+`projectId` trong `/weekly` GET|POST (verify 22/08)*
- [x] `analysis`/`comparison`/`kpi-cards`/`funnel` tự đếm OPP và Closed Deal từ bảng chi tiết — *Closed Deal khớp tuyệt đối bảng; OPP tính server-side (khớp "opp mới + deal won trong kỳ") — BE xác nhận thêm ý đồ công thức ở mục 7.3*
- [x] Trường `segment` cho Deal hoặc endpoint `/dashboard/pipeline-by-segment` (mục 7.4) — *shape `{ segment, openDeals, value, growthPct }[]` đúng spec*
