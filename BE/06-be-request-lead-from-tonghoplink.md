# BE Request — Nhận Lead từ Website tonghoplink (smartlog-event.github.io)

- **Ngày:** 27/10/2026
- **Người yêu cầu:** Frontend
- **Đối tượng:** Backend (NestJS)
- **Ưu tiên:** P0
- **Phạm vi:** Kết nối form Lead từ website `https://smartlog-event.github.io/tonghoplink/` vào hệ thống Lead của MKT Hub
- **Tài liệu liên quan:** `05-backend-anonymous-tracking-implementation.md`, `bdd_02_anonymous_profile.md`

---

## 1. Mục tiêu

Website `https://smartlog-event.github.io/tonghoplink/index.html` có form nhập thông tin Lead (khách quan tâm sự kiện/dự án). Cần BE bổ sung endpoint để tiếp nhận dữ liệu form này, chuẩn hóa, tạo/cập nhật Lead trong hệ thống, đồng thời liên kết với Anonymous Profile nếu có tracking (cookieId/deviceId/sessionId) từ MKT Hub Tracking Script.

---

## 2. Hiện trạng

- Hệ thống đã có `POST /api/v1/tracking/identify` theo spec `05-backend-anonymous-tracking-implementation.md` (mục 5.3) dùng cho website có tracking script.
- Website `tonghoplink` có thể:
  1. **Chưa gắn** MKT Hub Tracking Script → không có `cookieId`/`deviceId`/`sessionId`
  2. **Đã gắn** Tracking Script → có thể có các identifier trên

Cần đảm bảo BE xử lý được cả 2 trường hợp.

---

## 3. Yêu cầu API

### 3.1 Endpoint mới (đề xuất)

**`POST /api/v1/leads/from-event-site`**

- **Auth:** Public (không dùng JWT). Xác thực bằng `X-MKT-Site-Id` + `X-MKT-Server-Key` (giống `identify`)
- **Content-Type:** `application/json`
- **CORS:** Chỉ cho phép origin `https://smartlog-event.github.io` (hoặc thêm vào whitelist cấu hình)
- **Rate limit:** Theo site + IP (vd 60 request/phút)

### 3.2 Request Body

```json
{
  "eventId": "evt_form_9f3a8b2c-...",
  "occurredAt": "2026-10-27T09:15:00.000Z",
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567",
  "email": "a@company.vn",
  "company": "Công ty ABC",
  "title": "Giám đốc",
  "eventCode": "EVENT-TONGHOP-2026-Q4",
  "projectCode": "PRJ-2026-XXX",
  "source": "tonghoplink",
  "medium": "landing_page",
  "campaign": "tonghoplink_event",
  "utm": {
    "source": "facebook",
    "medium": "cpc",
    "campaign": "tonghoplink_q4"
  },
  "cookieId": "ck_01J...",
  "deviceId": "fp_01J...",
  "sessionId": "s_01J...",
  "landingPageUrl": "https://smartlog-event.github.io/tonghoplink/index.html",
  "referrer": "https://www.facebook.com/",
  "metadata": {
    "formId": "tonghoplink-register",
    "note": "Quan tâm tham gia sự kiện"
  }
}
```

**Trường bắt buộc:**
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `eventId` | string (UUID/recommended) | Idempotent key |
| `occurredAt` | ISO8601 UTC | Thời gian submit form |
| `phone` | string | Bắt buộc - dùng để định danh Lead |
| `fullName` hoặc `name` | string | Nên có để tạo Lead |

**Trường tùy chọn:** `email`, `company`, `title`, `eventCode`, `projectCode`, `utm`, `cookieId`, `deviceId`, `sessionId`, `source/medium/campaign`, `referrer`, `landingPageUrl`, `metadata`

### 3.3 Response

**200 OK (thành công):**

```json
{
  "data": {
    "leadId": "LEAD-2026-0456",
    "leadCode": "LEAD-2026-0456",
    "created": true,
    "updated": false,
    "anonymousProfileId": "anon-123",
    "converted": true,
    "projectCounted": true,
    "eventCounted": true,
    "registrationId": "REG-2026-0789",
    "duplicate": false
  }
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "errorCode": "ERR_LEAD_INVALID_PAYLOAD",
  "message": "Missing required field: phone"
}
```

**422 Unprocessable Entity:**
```json
{
  "statusCode": 422,
  "errorCode": "ERR_ANON_PHONE_INVALID",
  "message": "Invalid Vietnamese phone number"
}
```

**409 Conflict:**
```json
{
  "statusCode": 409,
  "errorCode": "ERR_ANON_IDENTITY_CONFLICT",
  "message": "This identifier is linked to a different phone number"
}
```

---

## 4. Logic xử lý

### 4.1 Chuẩn hóa dữ liệu
- **Phone VN:** Chuẩn hóa giống `identify` - bỏ space/dash, chuyển `+84`/`84` → `0`, validate 10 số bắt đầu bằng 03/05/07/08/09. Dùng `libphonenumber-js` nếu có.
- **Email:** Trim lowercase, validate format cơ bản
- **Tên:** Trim, normalize khoảng trắng
- **UTM/Source:** Map từ `source/medium/campaign` hoặc `utm.*`

### 4.2 Tìm/ tạo Lead
1. Tìm Lead theo số điện thoại đã chuẩn hóa
2. Nếu chưa tồn tại → tạo Lead mới với `source = tonghoplink`, `status` mặc định theo rule hiện tại
3. Nếu đã tồn tại → cập nhật thông tin thiếu (name/email/company/title) nếu empty, **không ghi đè** dữ liệu quan trọng đã có
4. Ghi nhận `lastContactAt`, `updatedAt`

### 4.3 Liên kết với Anonymous Profile (nếu có tracking)
Nếu request có `cookieId`/`deviceId`/`sessionId`:
1. Tìm Anonymous Profile qua `profile_identifiers` (siteId tương ứng với website tonghoplink)
2. Nếu tìm thấy profile chưa identified → chuyển toàn bộ:
   - `tracking_sessions` → liên kết với Lead
   - `tracking_events` → gắn `lead_id` hoặc giữ `anonymous_profile_id` để audit
   - `profile_touchpoints` → chuyển sang Lead
   - `profile_identifiers` → liên kết với Lead
3. Cập nhật profile: `status = 'identified'`, `converted_lead_id = leadId`, `converted_at = now()`
4. Trả `anonymousProfileId`, `converted = true`

Nếu **không có identifier** (form submit trực tiếp không qua tracking script) → vẫn tạo Lead bình thường, `anonymousProfileId = null`, `converted = false`.

### 4.4 Xử lý sự kiện/đăng ký
- Nếu có `eventCode` → kiểm tra bảng event/registration hiện tại
- Chống trùng đăng ký: cùng `phone` + `eventCode` chỉ tính 1 lần
- Nếu đăng ký thành công → tạo/cập nhật `registration`, trả `registrationId`, `eventCounted = true`

### 4.5 Phát hiện Identity Conflict
Áp dụng logic giống `identify` (mục 6.9):
- Nếu `cookieId/deviceId` đã từng gắn với số điện thoại **khác** → tạo `identity_conflicts` với `status = pending`, `canAutoMerge = false`
- **KHÔNG auto-merge**. Trả 409 với error code `ERR_ANON_IDENTITY_CONFLICT` và ghi audit

### 4.6 Idempotency
- Dùng `eventId` unique. Nếu đã xử lý → trả kết quả cũ (idempotent response), không tạo Lead/registration trùng
- Có thể lưu bảng `lead_import_events` hoặc dùng `tracking_events` với `eventType = 'form_submit_tonghoplink'`

---

## 5. Cấu hình cần bổ sung

### 5.1 Tracking Site
Tạo/cập nhật site config cho website tonghoplink:

```sql
-- Hoặc qua API admin
INSERT INTO tracking_sites (site_id, name, domain, enabled, allowed_origins, server_key_hash, ...)
VALUES ('SITE-TONGHOP', 'Smartlog Event - Tonghoplink', 'smartlog-event.github.io', true, 
        ARRAY['https://smartlog-event.github.io'], '<hash_server_key>', ...)
ON CONFLICT (site_id) DO UPDATE SET allowed_origins = EXCLUDED.allowed_origins;
```

**Cần có:**
- `siteId`: `SITE-TONGHOP` (hoặc tên khác do BE quy định)
- `serverKey`: Cấp cho website team để gọi endpoint (header `X-MKT-Server-Key`)
- `allowedOrigins`: `["https://smartlog-event.github.io"]`

### 5.2 Biến môi trường
Thêm config nếu cần:
```env
LEAD_FROM_EVENT_SITE_ENABLED=true
LEAD_FROM_EVENT_SITE_RATE_LIMIT=60
```

---

## 6. Validation Rules

| Rule | Hành động |
|---|---|
| Thiếu `phone` | 400 `ERR_LEAD_INVALID_PAYLOAD` |
| Phone không đúng định dạng VN | 422 `ERR_ANON_PHONE_INVALID` |
| Sai `X-MKT-Site-Id` / `X-MKT-Server-Key` | 401 `ERR_TRACKING_INVALID_KEY` |
| Origin không trong `allowedOrigins` | 403 `ERR_TRACKING_ORIGIN_NOT_ALLOWED` |
| Rate limit vượt quá | 429 `ERR_TRACKING_RATE_LIMITED` + `Retry-After` |
| `eventId` trùng đã xử lý thành công | 200 trả kết quả cũ (idempotent) |
| Conflict phát hiện | 409 `ERR_ANON_IDENTITY_CONFLICT` |
| Site disabled/inactive | 403 hoặc 422 với message rõ ràng |

---

## 7. Migration/DB (nếu cần)

Kiểm tra các bảng hiện có:
- `leads` - đảm bảo có các field: `source`, `medium`, `campaign`, `utm_source/medium/campaign`, `converted_at`, `anonymous_profile_id` (hoặc mapping)
- `lead_registrations` / `event_registrations` - nếu có `eventCode` thì cần bảng này
- `identity_conflicts` - đã có theo spec, tận dụng
- `profile_identifiers`, `tracking_events` - tận dụng để liên kết

**Không cần tạo bảng mới lớn** nếu tận dụng các bảng hiện tại. Chỉ cần đảm bảo mapping đúng.

---

## 8. Test Plan

### 8.1 Unit Test
- [ ] Chuẩn hóa phone VN (`+84`, `84`, space, dash)
- [ ] Email normalize
- [ ] Idempotency theo `eventId`
- [ ] Conflict detection logic

### 8.2 Integration Test

| ID | Case | Kỳ vọng |
|---|---|---|
| EVT-001 | Submit form không có tracking (chỉ phone/name) | Tạo Lead mới, `converted=false`, `anonymousProfileId=null` |
| EVT-002 | Submit form có `cookieId` trùng với Anonymous Profile | Chuyển lịch sử sang Lead, `converted=true` |
| EVT-003 | Phone đã tồn tại trong hệ thống | Cập nhật Lead, không tạo trùng, trả `updated=true` |
| EVT-004 | Phone sai định dạng | 422 `ERR_ANON_PHONE_INVALID` |
| EVT-005 | Cùng `eventId` submit 2 lần | Idempotent, không tạo duplicate Lead/registration |
| EVT-006 | `cookieId` đã gắn phone khác | 409 `ERR_ANON_IDENTITY_CONFLICT`, tạo conflict record |
| EVT-007 | Có `eventCode` đăng ký sự kiện | Tạo registration, `eventCounted=true` |
| EVT-008 | Đăng ký sự kiện trùng (cùng phone+eventCode) | Không tạo trùng, trả kết quả cũ hoặc `duplicate=true` |
| EVT-009 | Sai server key | 401 `ERR_TRACKING_INVALID_KEY` |
| EVT-010 | Origin không được phép | 403 `ERR_TRACKING_ORIGIN_NOT_ALLOWED` |

### 8.3 E2E Test
1. Tạo site `SITE-TONGHOP` + cấp `serverKey` trên admin
2. Mở `https://smartlog-event.github.io/tonghoplink/index.html`, điền form hợp lệ
3. Kiểm tra Lead xuất hiện trong module Leads
4. Nếu có tracking script → kiểm tra profile được chuyển sang Lead, xuất hiện trong audit
5. Kiểm tra không tạo duplicate khi submit lại

### 8.4 Curl mẫu

```bash
curl -X POST "https://<BE_DOMAIN>/api/v1/leads/from-event-site" \
  -H "Content-Type: application/json" \
  -H "X-MKT-Site-Id: SITE-TONGHOP" \
  -H "X-MKT-Server-Key: sk_live_..." \
  -H "Origin: https://smartlog-event.github.io" \
  -d '{
    "eventId": "evt_test_001",
    "occurredAt": "2026-10-27T09:15:00.000Z",
    "fullName": "Nguyễn Văn Test",
    "phone": "0901234567",
    "email": "test@example.vn",
    "company": "Công ty Test",
    "eventCode": "EVENT-TONGHOP-2026-Q4",
    "source": "tonghoplink",
    "cookieId": "ck_test_001",
    "sessionId": "s_test_001",
    "landingPageUrl": "https://smartlog-event.github.io/tonghoplink/index.html"
  }'
```

---

## 9. Checklist cho BE

| ID | Task | Ước lượng | Trạng thái | Ghi chú |
|---|---|---|---|---|
| LBE-01 | Thêm route/controller `leads/from-event-site` | 0.5d | Todo | Public endpoint với server-key guard |
| LBE-02 | Tạo `LeadFromEventSiteDto` + validation | 0.5d | Todo | class-validator, transform phone/email |
| LBE-03 | Guard: verify site + serverKey + origin + enabled | 0.5d | Todo | Tận dụng `SiteAuthService` nếu có |
| LBE-04 | Service xử lý: normalize phone, tìm/tạo Lead | 1d | Todo | Tương tự logic `identify` |
| LBE-05 | Liên kết với Anonymous Profile (nếu có identifier) | 1d | Todo | Chuyển session/event/touchpoint/identifier |
| LBE-06 | Xử lý đăng ký event (eventCode) + chống trùng | 0.5d | Todo | Tạo registration nếu cần |
| LBE-07 | Identity conflict detection | 0.5d | Todo | Không auto-merge, trả 409 |
| LBE-08 | Idempotency theo `eventId` | 0.5d | Todo | Tránh duplicate |
| LBE-09 | Cấu hình site `SITE-TONGHOP` + serverKey | 0.25d | Todo | Thêm vào DB/staging |
| LBE-10 | CORS config cho origin tonghoplink | 0.25d | Todo | Thêm vào whitelist |
| LBE-11 | Swagger DTO/response example | 0.25d | Todo | Đầy đủ error codes |
| LBE-12 | Unit + Integration test | 1d | Todo | Theo test plan |
| LBE-13 | Deploy staging + test với curl | 0.5d | Todo | Verify end-to-end |

**Tổng ước lượng:** ~6.5 ngày

---

## 10. Lưu ý quan trọng

- **Tận dụng code hiện có:** Ưu tiên dùng lại logic `identify.service.ts`, `conflict.service.ts`, `site-auth.service.ts` thay vì viết lại từ đầu
- **Backward compatible:** Không ảnh hưởng `POST /api/v1/tracking/identify` hiện tại
- **Audit:** Ghi audit khi tạo Lead, convert profile, tạo conflict
- **Bảo mật:** Không log toàn bộ body có PII (phone/email). Chỉ log `eventId`, `siteId`, `leadId`, result
- **Tương thích FE:** Response format giữ `{ data: {...} }` giống các API khác
- **Không yêu cầu tracking script:** Endpoint phải hoạt động độc lập nếu website không gắn script

---

**Hành động ngay:** BE review, tạo site config, implement endpoint theo spec trên. Sau khi deploy staging, FE sẽ test bằng form trên `tonghoplink` và báo kết quả.