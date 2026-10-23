# Yêu cầu BE — 21/09/2026 (Kho: sửa số lượng nhập làm mất tồn kho đã xuất)

**Người gửi:** FE Team
**Ưu tiên:** **Cao — đang gây sai số liệu tồn kho trên production**

> **Mục tiêu:** `PATCH /v1/inventory/batches/{id}` khi sửa `quantityIn` phải **tính lại** tồn kho theo lịch sử xuất, thay vì gán `currentStock = quantityIn`. Hiện tại mỗi lần sửa số lượng của một batch **đã từng xuất kho**, toàn bộ lượng đã xuất bị xoá sạch khỏi số tồn — không cảnh báo, không log, HTTP 200 bình thường.

---

## 1. Tóm tắt 2 lỗi

| # | Lỗi | Mức độ |
|---|-----|--------|
| **A** | Sửa `quantityIn` → BE gán `currentStock = quantityIn`, **bỏ qua lượng đã xuất** | Nghiêm trọng — sai số liệu tồn kho |
| **B** | Hạ `quantityIn` xuống **thấp hơn** lượng đã xuất → BE vẫn chấp nhận (HTTP 200) | Nghiêm trọng — tạo trạng thái dữ liệu bất khả thi |

Cả hai đều đã được **kiểm chứng trực tiếp trên `https://mkt-hub.onrender.com`** (xem mục 4).

> ⚠️ **Đã kiểm thử lại sau bản cập nhật BE ngày 21/09 — vẫn chưa đạt.** Xem phần *CẬP NHẬT LẦN 2* ngay bên dưới, trong đó có **nguyên nhân gốc mới tìm ra** (mục 3.5) và **yêu cầu khôi phục 3 batch đang sai tồn** (mục 8).

---

## ⚠️ CẬP NHẬT LẦN 2 (21/09/2026) — kết quả kiểm thử lại sau bản BE mới

FE đã chạy lại **toàn bộ checklist mục 6** trên `https://mkt-hub.onrender.com`. Kết quả: **6/11 PASS**.

### Đã đạt ✅

| Nội dung | Kết quả |
|---|---|
| Batch **chưa xuất** lần nào: `quantityIn` 500 → 550 ⇒ tồn 550 | ✅ |
| `quantityIn = -5` ⇒ `400` | ✅ |
| `totalStock` / `status` cấp vật phẩm nhất quán với tổng batch | ✅ |
| `PATCH` không gửi `quantityIn` ⇒ tồn không đổi | ✅ |
| Sửa `note` / `supplier` / `contractCode` vẫn lưu bình thường | ✅ |
| **Mục 3.3** — khoá ghi trực tiếp `currentStock` | ✅ **đã làm** (PATCH trả `200` nhưng bỏ qua giá trị) |

### Chưa đạt ❌ — cả 3 yêu cầu chính vẫn còn nguyên

Batch test: `LY-0126-001` (`3f046530-e429-45a9-b93f-bde712c7e384`), nhập 250 / đã xuất 182 / tồn đúng 68.

| Mục | Request | Mong đợi | Thực tế |
|---|---|---|---|
| **3.1** | `PATCH {"quantityIn": 260}` | `200`, tồn = **78** | ❌ `200`, tồn = **260** |
| **3.1** | `PATCH {"quantityIn": 250}` | `200`, tồn = **68** | ❌ `200`, tồn = **250** |
| **3.2** | `PATCH {"quantityIn": 100}` (< 182 đã xuất) | `400`, không lưu | ❌ `200`, lưu luôn, tồn = **100** |
| **3.2** | `PATCH {"quantityIn": 182}` (= đã xuất) | `200`, tồn = **0** | ❌ `200`, tồn = **182** |
| **3.4** | `PATCH {"quantity": 800}` (sai tên field) | `400` nêu tên field | ❌ `200`, nuốt lặng |

> Lưu ý về mục 3.3: khoá `currentStock` là **đúng hướng**, nhưng vì 3.1 chưa làm nên hiện tại **không còn đường nào khôi phục tồn kho khi bị sai** — cả qua giao diện lẫn qua API. Đề nghị làm 3.1 **cùng lúc** với 3.3, đừng tách.

---

## 2. Tái hiện lỗi

**Vật phẩm:** `LY SỨ 10 NĂM - BỘ 5 LY`
- `itemId`: `b9a75282-9d3b-4c42-a34e-25912dd284a6`
- `batchId`: `3f046530-e429-45a9-b93f-bde712c7e384` (batch `LY-0126-001`)

**Trạng thái ban đầu** — khớp với lịch sử giao dịch `GET /v1/inventory/transactions?itemId=...` (tổng `in` = 250, tổng `out` = 182):

```
quantityIn = 250      currentStock = 68      (= 250 - 182)
```

### Lỗi A — tồn kho bị ghi đè

```http
PATCH /v1/inventory/batches/3f046530-e429-45a9-b93f-bde712c7e384
{ "quantityIn": 260 }
```

| | Giá trị |
|---|---|
| HTTP | `200` |
| `currentStock` **mong đợi** | `78` (= 260 − 182 đã xuất) |
| `currentStock` **thực tế** | ❌ `260` — 182 đơn vị đã xuất biến mất khỏi số tồn |

### Lỗi B — không chặn số lượng nhỏ hơn lượng đã xuất

```http
PATCH /v1/inventory/batches/3f046530-e429-45a9-b93f-bde712c7e384
{ "quantityIn": 100 }
```

| | Giá trị |
|---|---|
| HTTP **mong đợi** | `400` — vì đã xuất 182, không thể nhập chỉ 100 |
| HTTP **thực tế** | ❌ `200`, lưu thành công, `currentStock = 100` |

### Ghi chú thêm

- ~~`currentStock` hiện **ghi trực tiếp được** qua `PATCH`~~ → **BE đã khoá ở bản 21/09.** Xem cảnh báo ở mục 3.3 và mục 8.
- Lịch sử giao dịch **không bị ảnh hưởng** — sau khi lỗi xảy ra, `GET /v1/inventory/transactions` vẫn trả đủ `in 250 / out 182`. Tức là **BE có đủ dữ liệu để tính lại đúng**, chỉ là không tính.

---

## 3. Thay đổi backend yêu cầu

### 3.1. Tính lại `currentStock` thay vì gán (bắt buộc)

Trong `PATCH /v1/inventory/batches/{id}`, khi `quantityIn` thay đổi:

```
issued        = tổng quantity của các transaction type='out' thuộc batch này
                (không tính transaction đã huỷ / đã đảo)
returned      = tổng quantity của các transaction type='in' hoàn kho thuộc batch này
currentStock  = quantityIn - issued + returned
```

**Không** được gán `currentStock = quantityIn`. Nếu batch chưa xuất lần nào thì công thức trên tự nhiên ra `currentStock = quantityIn` — hành vi hiện tại vẫn đúng cho trường hợp đó, nên không sợ vỡ case cũ.

Sau khi cập nhật batch, **cập nhật lại luôn** tổng tồn ở cấp vật phẩm (`Item.totalStock` / `currentStock`) và `status` (`instock` / `outofstock`).

### 3.2. Chặn hạ `quantityIn` xuống dưới lượng đã xuất (bắt buộc)

```
Nếu quantityIn (mới) < issued  ->  HTTP 400
```

Thông báo lỗi đề xuất (FE sẽ hiển thị nguyên văn `message` cho người dùng):

> `Không thể đặt số lượng nhập là {new}: batch này đã xuất {issued}. Số lượng nhập phải >= {issued}.`

### 3.3. Khoá ghi trực tiếp `currentStock` (✅ **BE đã làm ở bản 21/09**)

`currentStock` là giá trị **dẫn xuất** từ `quantityIn` và lịch sử giao dịch. Cho ghi trực tiếp nghĩa là tồn kho có thể bị đặt tuỳ ý mà không có giao dịch tương ứng, phá vỡ đối soát.

Đề xuất: bỏ `currentStock` khỏi `UpdateBatchDto`. Nếu cần điều chỉnh tồn kho thủ công thì đi qua một giao dịch kiểm kê (`type='adjust'`) để còn vết.

> ✅ **Đã làm.** `PATCH { "currentStock": ... }` nay trả `200` nhưng bỏ qua giá trị — đúng như đề xuất.
>
> ⚠️ **Nhưng làm một mình mục này lại thành có hại:** vì 3.1 chưa làm, tồn kho vẫn bị ghi sai mỗi lần sửa `quantityIn`, mà giờ **không còn đường nào sửa lại** — cả giao diện lẫn API. Đây chính là lý do 3 batch ở mục 8 đang kẹt. Đề nghị làm 3.1 và 3.5 **ngay**, đừng để 3.3 đứng một mình.

### 3.4. Không im lặng bỏ qua field lạ (đề xuất — lỗi lặp lại lần 3)

Trước khi FE sửa, FE gửi `{ "quantity": 800 }` (sai tên field, đúng phải là `quantityIn`). BE trả **`200` và bỏ qua im lặng** → người dùng thấy "Đã cập nhật" nhưng số không đổi, mất rất nhiều thời gian tìm nguyên nhân.

Đây là **lần thứ 3** cùng một kiểu lỗi (xem `BE_REQUIREMENT-18-09-26-inventory-batch-note.md` — field `note` cũng bị drop im lặng).

Đề xuất bật `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` cho các endpoint kho, để field sai tên trả `400` kèm tên field thay vì nuốt lặng.

### 3.5. Gắn `batchId` cho giao dịch xuất kho (bắt buộc — **nguyên nhân gốc**)

Đây là phát hiện mới ở lần kiểm thử thứ hai, và là lý do vì sao **chỉ sửa công thức ở 3.1 sẽ không chạy được**.

`GET /v1/inventory/transactions?itemId=b9a75282-...` trả về:

```json
{ "type": "out", "quantity": 182, "batchId": null,          "note": "Xuất kho cho dòng chi phí" }
{ "type": "in",  "quantity": 250, "batchId": "3f046530-...", "note": "Tạo lô hàng ban đầu khi tạo vật phẩm" }
```

**Giao dịch xuất kho không gắn với lô nào (`batchId = null`).** Chỉ giao dịch nhập mới có `batchId`.

Hệ quả: công thức `issued = tổng out của batch này` ở mục 3.1 sẽ luôn ra **0**, nên dù có sửa công thức thì `currentStock` vẫn bằng `quantityIn`. Đây chính xác là những gì đang xảy ra với endpoint `POST /v1/inventory/recalculate` (xem mục 8).

**Yêu cầu:**

1. `POST /v1/inventory/transactions` với `type='out'` phải **ghi `batchId`** theo lô thực tế bị trừ (FIFO theo `receivedDate`, hoặc theo lô người dùng chọn).
2. Nếu một lần xuất trừ trên **nhiều lô**, tách thành nhiều bản ghi giao dịch, mỗi bản ghi một `batchId` và số lượng tương ứng.
3. **Migration dữ liệu cũ:** với các giao dịch `out` đang có `batchId = null`, gán lại theo FIFO trong phạm vi vật phẩm đó. Trường hợp vật phẩm chỉ có **1 lô** (đúng với cả 3 vật phẩm ở mục 8) thì gán thẳng, không cần đoán.

> Nếu chưa kịp làm 3.5, **tạm thời đừng bật lại `POST /v1/inventory/recalculate`** — chạy nó lúc này sẽ xoá tồn kho của mọi batch đã xuất (xem mục 8).

---

## 4. Bằng chứng test (FE đã chạy thật)

Môi trường `https://mkt-hub.onrender.com`, tài khoản manager `a.nguyen@company.com`, ngày 21/09/2026.

| # | Request | HTTP | `quantityIn` | `currentStock` | Đánh giá |
|---|---------|------|--------------|----------------|----------|
| 0 | `GET /v1/inventory/items/{item}/batches` | 200 | 250 | 68 | Trạng thái gốc (in 250 − out 182) |
| 1 | `PATCH batches/{id}` `{"quantityIn":260}` | 200 | 260 | **260** | ❌ Phải là 78 |
| 2 | `PATCH batches/{id}` `{"quantityIn":100}` | 200 | 100 | **100** | ❌ Phải là 400 (đã xuất 182) |
| 3 | `PATCH batches/{id}` `{"quantityIn":250}` | 200 | 250 | **250** | ❌ Khôi phục số nhập nhưng tồn **không** về 68 |
| 4 | `PATCH batches/{id}` `{"currentStock":68}` | 200 | 250 | 68 | ⚠️ Ghi trực tiếp được — FE dùng để khôi phục |
| 5 | `GET /v1/inventory/transactions?itemId=...` | 200 | — | — | ✅ Lịch sử còn nguyên: `in 250`, `out 182` |

**Dòng 3 là điểm đáng lo nhất:** sửa nhầm rồi sửa lại đúng số cũ thì tồn kho **vẫn sai vĩnh viễn**, người dùng không có cách nào tự khôi phục qua giao diện.

> ⚠️ Ở lần test **thứ nhất**, FE khôi phục được toàn bộ 16/16 batch nhờ ghi trực tiếp `currentStock`. Ở lần test **thứ hai** (sau bản BE mới) đường này đã bị khoá, nên **3 batch hiện đang sai tồn** — xem mục 8.

---

## 5. Những gì FE đã làm

| # | Nội dung | Trạng thái |
|---|----------|-----------|
| 1 | Sửa payload `PATCH batch` gửi đúng `quantityIn` thay vì `quantity` — đây là lỗi *"sửa 800 không lưu"* người dùng báo | ✅ Đã sửa, đã verify chạy đúng trên production API |
| 2 | Hiển thị `message` lỗi từ BE lên popup "Sửa vật phẩm" | ✅ Đã có sẵn |
| 3 | Chặn hạ số lượng dưới lượng đã xuất ở phía FE | ⏳ Chờ BE chốt công thức ở 3.1 rồi FE chặn sớm cho người dùng |

File liên quan: `FE/components/InventoryManagement/InventoryFormModal.jsx`

---

## 6. Kiểm tra chấp nhận (checklist cho BE)

**Tính lại tồn kho**

- [ ] Batch chưa xuất lần nào (`issued = 0`), sửa `quantityIn` 100 → 150 ⇒ `currentStock = 150`.
- [ ] Batch đã xuất 182, `quantityIn` 250 → 260 ⇒ `currentStock = 78` (**không** phải 260).
- [ ] Batch đã xuất 182, `quantityIn` 260 → 250 ⇒ `currentStock = 68`.
- [ ] Sau mỗi lần sửa, `GET /v1/inventory/items/{id}` trả `totalStock` = tổng `currentStock` các batch, `status` đúng (`instock`/`outofstock`).
- [ ] `PATCH` **không** gửi `quantityIn` (chỉ sửa `supplier`, `note`…) ⇒ `currentStock` **không đổi**.

**Chặn giá trị không hợp lệ**

- [ ] Batch đã xuất 182, `PATCH {"quantityIn": 100}` ⇒ `400`, message nêu rõ số đã xuất, **không lưu gì**.
- [ ] Batch đã xuất 182, `PATCH {"quantityIn": 182}` ⇒ `200`, `currentStock = 0`.
- [ ] `PATCH {"quantityIn": -5}` ⇒ `400`.

**Gắn `batchId` cho giao dịch xuất (mục 3.5)**

- [ ] Xuất kho mới ⇒ transaction `type='out'` có `batchId` trỏ đúng lô bị trừ (không còn `null`).
- [ ] Sau migration, `GET /v1/inventory/transactions` không còn giao dịch `out` nào có `batchId = null`.
- [ ] Chạy `POST /v1/inventory/recalculate` ⇒ 3 batch ở mục 8 về đúng `68` / `0` / `106`.
- [ ] Chạy `recalculate` lần 2 liên tiếp ⇒ kết quả **không đổi** (idempotent).

**Không nuốt field lạ**

- [ ] `PATCH {"quantity": 800}` (tên field sai) ⇒ `400` nêu tên field không hợp lệ — **không** trả `200` rồi bỏ qua.

**Không hồi quy**

- [ ] Tạo vật phẩm mới kèm nhập kho ⇒ `currentStock = quantityIn` như cũ.
- [ ] Xuất kho (`POST /v1/inventory/transactions` type `out`) ⇒ `currentStock` giảm đúng.
- [ ] Sửa `note` / `supplier` / `contractCode` của batch ⇒ vẫn lưu bình thường (đã hoạt động từ bản 18/09).

---

## 7. Cần BE chốt lại

1. **Batch có transaction hoàn kho (`in` bổ sung) không?** Nếu có, xác nhận công thức ở 3.1 đã tính đủ; nếu không, bỏ vế `returned` cho gọn.
2. **Transaction đã huỷ / đã đảo** hiện đánh dấu bằng field nào (`cancelledAt`, `archivedAt`, hay transaction đối ứng)? FE cần biết để hiển thị nhất quán.
3. ~~**Có khoá `currentStock`** khỏi `UpdateBatchDto` theo mục 3.3 không?~~ → ✅ BE đã khoá ở bản 21/09. FE xác nhận **không dùng** field này.
4. ~~**Có cần một API tính lại tồn kho hàng loạt**~~ → ✅ endpoint `POST /v1/inventory/recalculate` **đã tồn tại**, nhưng hiện đang tính sai (xem mục 9). BE xác nhận giúp: endpoint này có trong bản 21/09 hay đã có từ trước?
5. **Trên production hiện có bao nhiêu batch đang sai tồn** ngoài 3 batch ở mục 8? FE chỉ kiểm được 16 batch của môi trường demo.

---

## 8. ⚠️ Yêu cầu khôi phục dữ liệu (gấp)

Trong lúc kiểm thử lần 2, FE có gọi thử `POST /v1/inventory/recalculate` (endpoint mới, FE không biết trước là có). Endpoint này trả `201` và **chạy trên toàn bộ vật phẩm**, đặt `currentStock = quantityIn` cho mọi batch đã xuất kho — đúng như dự đoán ở mục 3.5, vì giao dịch `out` không có `batchId` nên hàm tính lại không trừ được gì.

**Hiện có 3 batch đang sai tồn trên production:**

| Vật phẩm | Batch | `batchId` | Tồn **đúng** | Tồn **hiện tại** |
|---|---|---|---|---|
| LY SỨ 10 NĂM - BỘ 5 LY | `LY-0126-001` | `3f046530-e429-45a9-b93f-bde712c7e384` | **68** | ❌ 250 |
| SỔ LÒ XO 10 NĂM - BÌA CỨNG + TÚI GIẤY | `SOTAY-0126-002` | `8e1f6850-7f63-48c6-a95a-a36802ffd6e6` | **0** | ❌ 250 |
| SỔ LÒ XO 10 NĂM - BÌA THƯỜNG + TÚI GIẤY | `SOTAY-0126-001` | `026dd3c3-04df-4865-8509-144fb9658c82` | **106** | ❌ 250 |

13 batch còn lại (chưa từng xuất kho) **không bị ảnh hưởng**.

**Tin tốt:** lịch sử giao dịch **còn nguyên vẹn**, nên số đúng tính lại được:

| Vật phẩm | `in` | `out` | Tồn đúng |
|---|---|---|---|
| LY SỨ | 250 | 182 | 68 |
| SỔ LÒ XO - BÌA CỨNG | 250 | 250 | 0 |
| SỔ LÒ XO - BÌA THƯỜNG | 250 | 144 | 106 |

**FE không tự khôi phục được** vì `currentStock` đã bị khoá ghi ở bản 21/09 (mục 3.3), và `PATCH quantityIn` thì lại gán đè tồn (mục 3.1 chưa làm).

**Đề nghị BE xử lý theo thứ tự:**

1. Làm **mục 3.5** (gắn `batchId` cho giao dịch `out`, kể cả migration dữ liệu cũ).
2. Làm **mục 3.1** (công thức tính lại đúng).
3. Chạy lại `POST /v1/inventory/recalculate` → 3 batch trên sẽ tự về đúng 68 / 0 / 106.
4. Xác nhận lại với FE để FE kiểm thử lần 3.

> Nếu BE muốn sửa tay 3 dòng này trước cho nhanh thì cũng được, nhưng **vẫn phải làm 3.5 + 3.1**, nếu không lần sau người dùng sửa số lượng là hỏng lại.

---

## 9. Bổ sung cho `POST /v1/inventory/recalculate`

Endpoint này chưa có trong tài liệu, FE phát hiện tình cờ. Đề nghị BE:

- [ ] **Không cho chạy toàn hệ thống khi chưa làm mục 3.5** — hiện tại nó phá dữ liệu thay vì sửa.
- [ ] Nhận tham số phạm vi (`itemId` hoặc `batchId`) thay vì luôn chạy tất cả.
- [ ] Trả về **danh sách batch bị thay đổi** kèm giá trị trước/sau, để người chạy còn đối chiếu.
- [ ] Giới hạn quyền ở mức admin, và ghi log ai chạy lúc nào.
- [ ] Bổ sung vào tài liệu API cho FE biết đường dùng.

---

**Tóm tắt (cập nhật sau kiểm thử lần 2 — 21/09/2026):**

- Lỗi người dùng báo (*"sửa 800 mà số 500 không đổi"*) đã được **FE sửa xong và verify chạy đúng**, không cần BE.
- Bản BE cập nhật ngày 21/09 đạt **6/11** mục checklist. **Mục 3.3 đã làm**, nhưng **3.1, 3.2, 3.4 chưa** — tức 2 lỗi chính ở mục 1 vẫn còn nguyên.
- FE tìm ra **nguyên nhân gốc mới**: giao dịch xuất kho có `batchId = null` (**mục 3.5**), nên chỉ sửa công thức ở 3.1 sẽ không chạy.
- **Cần xử lý gấp:** 3 batch đang sai tồn kho trên production (**mục 8**), FE không tự khôi phục được.

**Thứ tự đề nghị: 3.5 → 3.1 → 3.2 → chạy lại recalculate (mục 8) → 3.4.**
