# Yêu cầu BE — 02/11/2026 (Expense ↔ Inventory: trừ tồn kho, snapshot dòng, quyền)

**Người gửi:** FE Team
**Nguồn:** `tests/expense-inventory/report.md` + `report.json` (run `MVZ2BSDU`) và `tests/expense-inventory/probe-verify.json` (run `MVZ2PROE`)
**Môi trường kiểm tra:** `https://mkt-hub.onrender.com/api`, ngày 02/11/2026
**Tài khoản:** manager `a.nguyen@company.com` / `demo123`; specialist `test@company.com` / `demo123`
**Dữ liệu test:** chỉ tạo/xoá bản ghi có tiền tố `TEST_QA_`; đã cleanup và khôi phục permission matrix `{}`.

> **Phạm vi:** tài liệu này chỉ liệt kê phần **BE cần sửa/quyết định**. FE đã sửa double-return khi xoá chi phí và thêm workaround tạm cho BUG-1 (xem §4); workaround này không thay thế fix BE. Các case còn FAIL trong report là do BE, được đánh dấu `awaiting BE`.

| Mức | Mục | Case | Owner |
|-----|-----|------|-------|
| **Critical** | §1 `actualQuantity = 0` bị fallback sang `plannedQuantity` khi trừ kho | T2, T9b | BE — BUG-1 |
| **Critical** | §2 Nhiều dòng cùng vật phẩm bị snapshot/recompute; thiếu idempotency + atomic update | T3, T10 | BE — BUG-2 |
| **High / cần quyết định** | §3 Ma trận quyền chưa áp cho expense endpoints | R5 | BE decision — BUG-3 |
| — | §5 T11 không phải bug (giữ làm regression guard) | T11 | — |

---

## 1. BUG-1 — `actualQuantity = 0` vẫn trừ tồn kho theo `plannedQuantity` (T2, T9b)

### 1.1. Hiện trạng

FE gửi `actualQuantity: 0` **tường minh** (không phải `null`, không bỏ trường). Khi dòng có `plannedQuantity > 0`, BE trả `201` và tạo transaction `out` với số lượng bằng **planned**, trừ tồn kho.

| Case | Request gửi lên | Response | Tồn kho | Transaction |
|---|---|---|---|---|
| T2 | `plannedQuantity: 25`, `actualQuantity: 0` | `201`, line có `plannedQuantity: 25`, `actualQuantity: 0`, `quantity: 0` | `100 → 75` | `out` qty **25** — “Xuất kho cho dòng chi phí” |
| T9b | `plannedQuantity: 10`, `actualQuantity: 0` | `201`, line có `plannedQuantity: 10`, `actualQuantity: 0`, `quantity: 0` | `100 → 90` | `out` qty **10** |

Request thực tế (rút gọn từ `report.json`):

```json
{
  "name": "TEST_QA_T2_manager_MVZ2BSDU",
  "hangMucLon": "Vật phẩm",
  "inventoryItemId": "c822c130-26f5-4fd6-b438-145ca6cc67fe",
  "isCustom": false,
  "plannedQuantity": 25,
  "actualQuantity": 0,
  "vatRate": 8,
  "unitPriceBeforeVat": 10000,
  "unitPriceAfterVat": 10800,
  "actualUnitPrice": 10000
}
```

Response: `HTTP 201`; `GET /v1/inventory/items/{id}` cho tồn `75`; transaction list có `{ "type": "out", "quantity": 25, "note": "Xuất kho cho dòng chi phí" }`.

**Nguyên nhân nghi ngờ:** BE dùng falsy check kiểu `actualQuantity || plannedQuantity` (hoặc `if (!actualQuantity) qty = plannedQuantity`) nên `0` bị coi như “chưa nhập” và rơi về planned.

### 1.2. Hành vi mong đợi

- **Tồn kho chỉ được trừ theo `actualQuantity`** (số lượng thực tế đã dùng).
- `plannedQuantity` **không bao giờ** được dùng để trừ tồn kho; planned chỉ dùng cho ngân sách/kế hoạch.
- `actualQuantity = 0` phải được hiểu là **0** (không trừ kho), không phải “thiếu dữ liệu”.
- **PENDING business decision:** nếu nghiệp vụ muốn `actualQuantity = 0` nghĩa là “dùng planned cho phần tiền” thì chỉ áp dụng cho **amount/budget**, tuyệt đối không áp dụng cho stock. Cần PO/BE chốt trước khi implement nhánh này.

### 1.3. Đề xuất sửa

```ts
// ❌ hiện tại (falsy fallback)
const stockQty = Number(line.actualQuantity || line.plannedQuantity);

// ✅ đề xuất: chỉ fallback khi null/undefined, không fallback khi 0
const stockQty = line.actualQuantity == null ? 0 : Number(line.actualQuantity);
```

- Validate `actualQuantity` là số hữu hạn `>= 0` (đã có ở T9a: âm → 400).
- Nếu `stockQty === 0`: **không tạo transaction `out`**, không đổi `currentStock`.
- Nếu `stockQty > currentStock` và không có `skipStockCheck`: giữ `409` như T8/T11.
- Không thay đổi `plannedQuantity`/`plannedAmount` trên line.

### 1.4. Acceptance criteria

- [ ] **T2**: `plannedQuantity=25, actualQuantity=0` → `201` (hoặc 4xx nếu business chốt khác), tồn **không đổi** `100 → 100`, **không có** transaction `out` 25.
- [ ] **T9b**: `plannedQuantity=10, actualQuantity=0` → `201`, tồn **không đổi** `100 → 100`; line vẫn giữ `actualQuantity: 0`.
- [ ] **T5**: tạo line `actual=10` (tồn `100 → 90`), `PATCH actualQuantity=0` → tồn hoàn `90 → 100`, không tạo transaction `out` mới.
- [ ] **T1, T14** không đổi: actual 10 trừ 10; hai bản ghi actual 10 + 20 trừ cộng dồn 30.
- [ ] **T9a** giữ nguyên: actual âm → `400`, tồn không đổi, không tạo line.

---

## 2. BUG-2 — Nhiều dòng cùng vật phẩm bị snapshot/recompute; thiếu idempotency & atomic update (T3, T10)

### 2.1. Hiện trạng T3 — hai dòng cùng item

Request: cùng `expenseId`, cùng `inventoryItemId`, hai dòng `actualQuantity` lần lượt **10** rồi **5**.

| Bước | Response | Tồn kho | Ghi nhận |
|---|---|---|---|
| Tạo line 1 (actual 10) | `201` | `100 → 90` | transaction `out` 10 |
| Tạo line 2 (actual 5) | `201` | `90 → 95` | transaction `in` 5 — “Hoàn kho từ dòng chi phí” |
| Kỳ vọng | — | **85** | `out` 10 + `out` 5 |
| Thực tế | — | **95** | line 2 **không** trừ tiếp; BE hoàn 5 rồi tính lại từ snapshot |

Đáng chú ý: response line 2 và line 1 trả **cùng `id`** (`f150dac6-fb25-496b-8b72-196150b47b52` ở manager; `90bdb1ff-...` ở specialist). `GET /v1/expenses/{id}` chỉ còn **1 line** với `actualQuantity: 5`. Nghĩa là BE đang coi lần POST thứ hai là **cập nhật/recompute** cho item đó, không phải một dòng độc lập.

Request (rút gọn):

```json
[
  { "inventoryItemId": "c47b65f2-90e0-445a-912f-579a3f699c14", "plannedQuantity": 0, "actualQuantity": 10 },
  { "inventoryItemId": "c47b65f2-90e0-445a-912f-579a3f699c14", "plannedQuantity": 0, "actualQuantity": 5 }
]
```

Response line 2 (rút gọn): `HTTP 201`, `{ "id": "f150dac6-fb25-496b-8b72-196150b47b52", "actualQuantity": 5, "quantity": 5, "totalAmount": 50000 }`.

Transaction list: `in 5` (“Hoàn kho từ dòng chi phí”), `out 10` (“Xuất kho cho dòng chi phí”), `in 100` (lô ban đầu).

### 2.2. Hiện trạng T10 — hai POST trùng

Hai `POST /v1/expenses/{id}/lines` **giống hệt** gửi song song (`Promise.all`), cùng `actualQuantity: 10`.

- Kết quả 5 lần/role (probe `MVZ2PROE`): cả 10/10 lần đều `201/201`, tạo **2 line**, tồn `100 → 90` (chỉ trừ **1 lần**).
- Lần chạy full-suite trước đó (`MVZ2BSDU`) ghi nhận manager `100 → 80` (trừ **2 lần**).
- Kết luận: **không đảm bảo deterministic**; cùng input có thể ra 90 hoặc 80 → có race condition giữa tạo line và cập nhật tồn kho. Idempotency hiện **không có**.

### 2.3. Hành vi mong đợi

- Mỗi dòng chi phí là một **thực thể độc lập**, lưu **số lượng đã trừ kho của chính nó** (`deductedQuantity` / transaction id).
- Thêm/sửa/xoá một dòng chỉ áp dụng **delta của dòng đó**:
  - thêm line actual 10 → `-10`;
  - thêm line actual 5 → `-5` nữa (tổng `-15`);
  - sửa line 10 → 4 → hoàn `+6` (không tính lại toàn bộ item);
  - xoá line → hoàn đúng phần line đó đã trừ.
- **Không** recompute từ tổng item/snapshot; không hoàn kho bằng transaction `in` khi thêm dòng mới.
- Không dùng chung `id` cho hai dòng khác nhau (trừ khi request thực sự là update cùng line id).
- Tham chiếu `BE_requirement_26_09_26.md` §1: lỗi cộng trùng snapshot khi tính tổng; cùng nguyên tắc “chỉ trạng thái mới nhất/dòng riêng” phải áp cho stock.
- **Idempotency:** nhận key do client gửi (đề xuất header `Idempotency-Key`, hoặc field `clientRequestId` trong body). Cùng key + cùng expense → chỉ xử lý một lần; request lặp trả lại kết quả cũ (200/201) hoặc `409` theo contract, **không tạo line thứ hai**.
- **Concurrency:** dùng row-level lock (`SELECT ... FOR UPDATE`) hoặc một câu `UPDATE ... SET currentStock = currentStock - :qty WHERE currentStock >= :qty` atomic; ghi transaction trong cùng transaction DB. Nếu không đủ tồn → rollback + `409`.

> Lưu ý: không dùng unique constraint `(expenseId, inventoryItemId)` đơn thuần vì T3 hợp lệ có **hai dòng cùng item** với số lượng khác nhau. Idempotency phải dựa trên **key của request**, không dựa trên nội dung dòng.

### 2.4. Đề xuất sửa

1. Bảng `expense_lines` thêm `deductedQuantity` (số lượng đã trừ kho) và `stockTransactionId` (hoặc quan hệ 1-1 với inventory transaction).
2. Khi tạo line:
   - `qty = actualQuantity == null ? 0 : Number(actualQuantity)`;
   - lock item/batch; kiểm tra tồn; `currentStock -= qty`;
   - tạo transaction `out` gắn `lineId`;
   - lưu `deductedQuantity = qty`.
3. Khi `PATCH /v1/expenses/lines/{lineId}`:
   - `delta = newActual - oldDeductedQuantity`;
   - `delta > 0` → trừ thêm; `delta < 0` → hoàn đúng `-delta`;
   - cập nhật `deductedQuantity = newActual`; không đụng các line khác.
4. Khi `DELETE /v1/expenses/lines/{lineId}`: hoàn đúng `deductedQuantity` của line đó, xoá/đánh dấu transaction liên quan.
5. Khi `DELETE /v1/expenses/{id}`: hoàn lần lượt `deductedQuantity` của **tất cả line**, mỗi line đúng một lần.
6. Idempotency:
   - lưu `(userId, idempotencyKey)` unique; request lặp trả response cũ;
   - nếu không có key, vẫn phải atomic và không tạo transaction trùng.
7. Trả `id` line ổn định; không trả cùng `id` cho hai line khác nhau.

### 2.5. Acceptance criteria

- [ ] **T3**: hai dòng cùng item actual 10 + 5 → tồn `100 → 85`; `GET /v1/expenses/{id}` trả **2 line** với `actualQuantity` 10 và 5, `id` khác nhau; transaction có `out 10` + `out 5`, **không có** `in 5`.
- [ ] **T4**: tạo actual 10 (tồn 90), `PATCH actualQuantity=4` → tồn `96` (hoàn 6), không tạo transaction `in` toàn bộ.
- [ ] **T5**: `PATCH actualQuantity=0` → tồn hoàn đúng phần đã trừ, line giữ `actualQuantity: 0`.
- [ ] **T6**: xoá line actual 10 → tồn hoàn 10, các line khác không đổi.
- [ ] **T7**: xoá expense có nhiều line → hoàn đúng tổng `deductedQuantity`, mỗi line một lần.
- [ ] **T10**: hai request trùng cùng `Idempotency-Key` → chỉ **1 line**, tồn chỉ trừ **1 lần** (90), request thứ hai trả response cũ hoặc `409` theo contract; hai request khác key (dù body giống) vẫn tạo 2 line và trừ đủ 20 (không phá T3).
- [ ] **T14**: hai expense khác nhau, actual 10 + 20 → tồn `100 → 70`.
- [ ] Không còn transaction “Hoàn kho từ dòng chi phí” khi **thêm** line mới.

---

## 3. BUG-3 — Ma trận quyền chưa áp cho expense endpoints (R5) — **Decision needed**

### 3.1. Hiện trạng

Với matrix `{ [userId]: { expense: "none", inventory: "none" } }`, re-login rồi gọi:

| Role | PUT matrix | Re-login `expense/inventory` | `GET /v1/expenses` | `GET /v1/inventory/overview` |
|---|---|---|---|---|
| manager | `200` | `none / none` | **200** | **403** |
| specialist | `200` | `none / none` | **200** | **403** |

- `inventory` tuân thủ matrix (403 khi `none`).
- `expense` **không** bị chặn (vẫn 200) ở **cả hai role**.
- Manager **không bypass**: inventory vẫn 403. Trước đây tưởng “chỉ specialist fail” là do R5 chưa chạy cho manager.
- Đây là lỗ hổng **module-level**, không phải role-level.

### 3.2. Quyết định cần chốt (không tự chọn)

**Option A — Enforce matrix ở BE cho toàn bộ expense endpoints** (giống inventory):
- `none` → `403` cho `GET/POST/PUT/PATCH/DELETE` thuộc expense.
- `view` → chỉ cho GET, chặn ghi bằng `403`.
- Phạm vi tối thiểu: `/v1/expenses*`, `/v1/expense-budgets*`, `/v1/projects/:id/expense-plan`, `/v1/projects/:id/expense-summary`.
- Cần xử lý ngoại lệ “danh sách đọc dùng chung” đã nêu ở `BE_requirement_29_09_26.md` §2: `/v1/expenses` đang được Leads & KPIs (CAC/ROAS), Tổng quan, lịch sử xuất kho dùng. Nếu chặn `none` hoàn toàn, các màn đó phải có bản rút gọn hoặc endpoint riêng; nếu không, user `none` sẽ thấy lỗi 403 ở màn khác.

**Option B — Giữ gate ở FE, tài liệu hoá là chủ đích:**
- BE không chặn expense; FE ẩn menu/trang theo matrix.
- Ghi rõ trong tài liệu: dữ liệu expense vẫn đọc được qua API nếu user biết endpoint; R5 được coi là **accepted by design**, không phải bug BE.
- Khi đó test R5 phải đổi kỳ vọng theo quyết định (hiện đang FAIL).

### 3.3. Acceptance criteria

- [ ] **Option A:** R5 → `GET /v1/expenses = 403`, `GET /v1/inventory/overview = 403` cho **cả manager và specialist**; `view` chỉ chặn ghi; các màn dùng chung vẫn hoạt động theo ngoại lệ đã chốt.
- [ ] **Option B:** tài liệu ghi rõ FE-only; R5 được review lại và đánh dấu “accepted by design” (không tính là FAIL BE), có ghi chú bảo mật dữ liệu expense.
- [ ] Không thay đổi matrix mặc định `{}` và role defaults hiện tại khi chưa có quyết định.

---

## 4. FE đã sửa (02/11/2026)

| # | Nội dung | File |
|---|---|---|
| 1 | `handleDelete`: chỉ hoàn kho thủ công từ **legacy note** khi expense **không có BE lines**; nếu có lines thì để BE hoàn khi `DELETE /v1/expenses/{id}`. Có `getExpenseById` để xác nhận lines trước khi reverse. Hết double-return `110`. | `src/components/ExpenseManagement/ExpenseHistory.jsx` |
| 2 | Chặn submit trùng: thêm `savingRef` (ngoài `disabled={saving}`) để hai click trong cùng tick không tạo 2 request. | `src/components/ExpenseManagement/ExpenseEntryForm.jsx` |
| 3 | Refetch inventory sau save/delete: `ExpenseEntryForm` nhận `refreshKey` và gọi `refreshInventory()` khi key đổi; `ExpenseManagement` truyền `refreshKey` xuống form. | `src/components/ExpenseManagement/ExpenseEntryForm.jsx`, `src/pages/ExpenseManagement.jsx` |
| 4 | Gộp dòng trùng vật phẩm trước khi lưu (`mergeDuplicateRows`) để tránh BE cộng dồn/ghi đè tồn kho sai (BUG-2 phía FE). Có toast thông báo số dòng đã gộp. | `src/components/ExpenseManagement/ExpenseEntryForm.jsx` |
| 5 | **Workaround BUG-1:** với dòng có `inventoryItemId`, `actualQuantity = 0`, `plannedQuantity > 0`, FE gửi `plannedQuantity: 0` kèm `plannedAmount` (tính theo đơn giá sau VAT) để BE không trừ tồn theo planned mà vẫn giữ giá trị kế hoạch. `derivedPlannedQty()` khôi phục số lượng kế hoạch từ `plannedAmount` khi nạp lại form/lịch sử. Khi BE sửa BUG-1, có thể bỏ workaround này. | `src/components/ExpenseManagement/ExpenseEntryForm.jsx`, `src/components/ExpenseManagement/ExpenseHistory.jsx` |

**Bằng chứng double-return (probe `MVZ2PROE`):**

| Mode | Tồn trước | Sau tạo line | FE reverse | Sau `DELETE` | Kết luận |
|---|---:|---:|---:|---:|---|
| `old` (code cũ) | 100 | 90 | 100 | **110** | double-return |
| `new` (code mới) | 100 | 90 | 90 (bỏ qua vì có BE line) | **100** | đúng |

> FE **chưa gửi idempotency key** vì BE chưa chốt tên header/field. Sau khi BE chốt, FE sẽ gửi key cho T10.

---

## 5. T11 — không phải bug (giữ regression guard)

- Request `actualQuantity=10` khi tồn 5, không gửi `skipStockCheck`.
- Response `HTTP 409` + `"Số lượng thực tế (10) vượt tồn kho hiện tại (5)"`; tồn `5 → 5`; không tạo line.
- Đúng contract `BE_REQUIREMENT-18-09-26-expense-out-of-stock.md`. Lần FAIL trước là lỗi encoding của test, đã sửa.
- **Acceptance:** T11 tiếp tục `409` + message rõ + tồn không đổi + `lineCount = 0`.

---

## 6. Câu hỏi mở / cần chốt

1. **`actualQuantity = 0`:** là “không tiêu thụ” (không trừ kho, amount = 0) hay “dùng planned cho amount” (chỉ ảnh hưởng budget)? Đề xuất: **không trừ kho**, amount = 0; nếu cần planned cho budget thì tách cờ riêng. **PENDING business decision.**
2. **Idempotency contract:** dùng header `Idempotency-Key` hay field `clientRequestId`? TTL bao lâu? Request lặp trả `200` (response cũ) hay `409`? Scope theo `(userId, key)` hay `(expenseId, key)`?
3. **BUG-3:** chọn Option A (enforce BE) hay Option B (FE-only, tài liệu hoá)? Nếu A, có giữ ngoại lệ “danh sách đọc dùng chung” cho `/v1/expenses` không?
4. **Legacy-only expense:** FE vẫn hoàn kho từ legacy note khi expense **không có BE lines**. Xác nhận BE không có stock movement nào cho trường hợp này (để không double-return lần nữa).
5. **T10 vs T3:** cần idempotency **theo key**, không dùng unique `(expenseId, inventoryItemId)`, để vẫn cho phép 2 dòng hợp lệ cùng item.
6. **Planned quantity:** xác nhận planned chỉ dùng cho budget/amount, không bao giờ dùng cho stock ở mọi endpoint (create, patch, delete, import).

---

## 7. Case IDs & trạng thái retest

| Case | Kỳ vọng sau khi BE sửa | Trạng thái hiện tại |
|---|---|---|
| T1 | actual 10 → tồn -10 | PASS |
| T2 | planned 25 / actual 0 → tồn không đổi | **FAIL — awaiting BE §1** |
| T3 | 2 dòng cùng item 10 + 5 → tồn -15 | **FAIL — awaiting BE §2** |
| T4 | patch 10 → 4 → tồn -4 | PASS |
| T5 | patch về 0 → hoàn đủ | PASS |
| T6 | xoá line → hoàn đúng line | PASS |
| T7 | xoá expense → hoàn đúng tất cả line một lần | PASS |
| T8 | vượt tồn → 409, tồn không đổi | PASS |
| T9a | actual âm → 400/422, tồn không đổi, 0 line | PASS |
| T9b | planned 10 / actual 0 → tồn không đổi | **FAIL — awaiting BE §1** |
| T10 | 2 request trùng key → 1 line, tồn -10; khác key → 2 line, tồn -20 | PASS theo assertion hiện tại (chỉ check 2 line); **BE §2** |
| T11 | vượt tồn → 409 + message + tồn không đổi | PASS |
| T14 | 2 expense 10 + 20 → tồn -30 | PASS |
| T15 | xuất kho thủ công → tồn -5 | PASS |
| R5 | theo quyết định Option A/B | **FAIL — awaiting BE decision §3** |

Chạy lại:

```powershell
$env:ALLOW_ONRENDER='1'; node tests/expense-inventory/run-tests.mjs
```
