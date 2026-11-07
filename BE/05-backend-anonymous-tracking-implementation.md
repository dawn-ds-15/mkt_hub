# BE Implementation Spec — Kết nối website với module Hồ sơ ẩn danh

- **Ngày:** 26/10/2026
- **Phiên bản:** 1.0
- **Trạng thái:** Sẵn sàng bàn giao BE
- **Phạm vi chính:** P0 + P1 (tracking website → Anonymous Profile → module hiển thị dữ liệu thật)
- **Tài liệu tham chiếu:** `bdd_02_anonymous_profile.md`
- **FE tham chiếu:** `src/pages/AnonymousProfiles.jsx`, `src/services/api.js`, `src/utils/normalizeProfiles.js`

> Ghi chú: repo BE không nằm trong workspace hiện tại. Tài liệu này là spec triển khai chi tiết để BE thực thi, gồm migration, API contract, thuật toán xử lý và checklist task.

---

## 1. Tóm tắt điều hành

### 1.1 Hiện trạng

BE đã có các API quản trị/đọc cho module:

- `GET/POST /api/v1/anonymous-profiles...`
- `GET /api/v1/anonymous-profiles/conflicts`
- `GET /api/v1/anonymous-profiles/ip-clusters`
- `GET /api/v1/anonymous-profiles/audit`
- `GET/POST/PATCH /api/v1/tracking/sites...`

Tuy nhiên **chưa có pipeline đưa dữ liệu từ website vào BE**:

| Hạng mục | Hiện trạng | Cần bổ sung |
|---|---|---|
| Tracking script | FE chỉ hardcode `https://cdn.mkthub.vn/t.js`, repo không có script thật | Script `t.js` + URL cấu hình được |
| Event Collector | Không có endpoint nhận event public | `POST /api/v1/tracking/collect` |
| Định danh từ form | Chỉ có API admin convert profile | `POST /api/v1/tracking/identify` |
| Session/event storage | API trả `events`, `sessions` dạng seed/JSON | Bảng event + session chuẩn hoá |
| KPI đầu trang | FE tự tính từ toàn bộ profile tải về | `GET /api/v1/anonymous-profiles/stats` |
| Conflict resolve | Chỉ nhận `action`, `note` | Bổ sung `primaryProfileId`, `moveKey`, undo |
| Cảnh báo / landing page / export | Chưa có API | P2/P3 |

### 1.2 Mục tiêu P0

Website gắn MKT Hub Tracking Script → event vào BE → tạo/cập nhật Anonymous Profile → module Hồ sơ ẩn danh hiển thị dữ liệu mới **trong tối đa 60 giây**, không dùng GA4/GTM.

### 1.3 Definition of Done P0

- [ ] Tạo site trả về `siteId`, `trackingKey`, `serverKey`, `scriptUrl`.
- [ ] Gắn script lên trang test, `page_view` tạo profile mới.
- [ ] Cùng cookie/device không tạo profile trùng.
- [ ] Session mới sau 30 phút không hoạt động.
- [ ] Event trùng `eventId` không ghi timeline/score lần 2.
- [ ] Sai key/site inactive/bot/IP nội bộ không tạo profile.
- [ ] Form submit phone hợp lệ tạo/cập nhật Lead và chuyển lịch sử từ profile.
- [ ] Key gắn 2 phone tạo Identity Conflict, không auto-merge.
- [ ] Event mới hiển thị trong module ≤60 giây.
- [ ] Swagger có DTO/response example cho toàn bộ endpoint mới.

---

## 2. Phạm vi

### 2.1 P0 — Bắt buộc

- Site config mở rộng: `allowedOrigins`, `serverKey`, `retentionDays`, `internalCidrs`.
- Tracker script và endpoint `collect`.
- Chuẩn hoá event, chống trùng, lọc bot/internal, xử lý event muộn.
- Tạo/cập nhật Anonymous Profile, session, timeline, first/last touch.
- Ghi nhận event không có key vào aggregate/IP session.
- `identify` từ form/landing page, convert sang Lead.
- Phát hiện Identity Conflict.
- Stats API và timeline API.
- Audit cho thao tác thủ công.
- Security: CORS, rate limit, masking IP, idempotency.
- Test + Swagger + observability.

### 2.2 P1 — Nên có ngay sau P0

- Scoring tạm tính ≤5 phút.
- Cảnh báo user quay lại, phân công/trạng thái cảnh báo.
- IP cluster + company prediction.
- Landing page mapping Project/Event.
- Export danh sách đã che + export IP đầy đủ có audit.
- Retention 12 tháng.

### 2.3 Ngoài phạm vi

- Omnichannel Inbox UI/connector chat đầy đủ.
- Công thức Lead Scoring cuối cùng.
- Vòng đời Lead/MQL/SQL/OPP/Handover.
- Consent/CMP platform.
- Reverse-IP/company enrichment trả phí.

---

## 3. Kiến trúc đề xuất

```text
Website
  └─ MKT Hub Tracking Script (t.js)
        │ POST /api/v1/tracking/collect
        │ siteId + trackingKey + Origin
        ▼
NestJS Tracking Collector (public)
  ├─ SiteAuthService: validate site/key/origin/status
  ├─ PayloadValidator: schema, size, batch size, timestamp
  ├─ Bot/InternalFilter: UA, CIDR, test site
  ├─ Idempotency: unique event_id
  └─ EventNormalizer
        │
        ▼
Queue/Worker (khuyến nghị BullMQ + Redis; MVP có thể xử lý đồng bộ)
  ├─ ProfileIngestionService
  │    ├─ resolve key → profile
  │    ├─ resolve session (30 phút)
  │    ├─ insert event + touchpoint
  │    ├─ update counters/first-last touch/status
  │    └─ detect conflict
  ├─ ScoringService (≤5 phút)
  ├─ AlertService (≤5 phút)
  └─ RetentionService (daily)
        │
        ▼
PostgreSQL
        │
        ▼
Admin API (JWT + RBAC)
  ├─ /anonymous-profiles, /conflicts, /ip-clusters, /audit
  ├─ /anonymous-profiles/stats
  ├─ /anonymous-profiles/{id}/timeline
  └─ /tracking/sites, /tracking/sites/{id}/script
```

Khuyến nghị giữ Collector trong NestJS ở giai đoạn đầu. Tách service riêng chỉ khi traffic tăng hoặc cần scale độc lập.

---

## 4. Data model và migration

### 4.1 Nguyên tắc

- Tận dụng bảng hiện có: `tracking_sites`, `anonymous_profiles`, `identity_conflicts`, `ip_clusters`, `anonymous_audit`, `leads`.
- Tên cột/bảng dưới đây là đề xuất; BE điều chỉnh theo schema thực tế.
- Không phá vỡ response hiện tại của module. API cũ vẫn trả field tương thích.
- Timestamp lưu UTC, API trả ISO 8601.
- IP đầy đủ lưu lớp bảo mật; API mặc định trả masked.

### 4.2 Mở rộng `tracking_sites`

```sql
ALTER TABLE tracking_sites
  ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS server_key_hash text,
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS internal_cidrs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS events_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tracking_sites_site_id
  ON tracking_sites (site_id);
```

Nếu `site_id` chưa unique, bổ sung:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_sites_site_id
  ON tracking_sites (site_id);
```

### 4.3 Bảng `profile_identifiers`

Lưu liên kết Cookie / Device / External User ID / Phone với profile.

```sql
CREATE TABLE IF NOT EXISTS profile_identifiers (
  id bigserial PRIMARY KEY,
  site_id text NOT NULL,
  profile_id text NOT NULL,
  key_type varchar(20) NOT NULL
    CHECK (key_type IN ('cookie', 'device', 'external_user', 'phone')),
  key_value text NOT NULL,
  masked_value text,
  phone text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  conflict_locked boolean NOT NULL DEFAULT false,
  UNIQUE (site_id, key_type, key_value)
);

CREATE INDEX IF NOT EXISTS idx_profile_identifiers_profile
  ON profile_identifiers (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_identifiers_phone
  ON profile_identifiers (site_id, phone);
```

### 4.4 Bảng `tracking_sessions`

```sql
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  profile_id text,
  client_session_id text NOT NULL,
  started_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL,
  ended_at timestamptz,
  page_views integer NOT NULL DEFAULT 0,
  duration_sec integer NOT NULL DEFAULT 0,
  engaged boolean NOT NULL DEFAULT false,
  converted boolean NOT NULL DEFAULT false,
  source varchar(50),
  medium varchar(50),
  campaign varchar(120),
  referrer text,
  landing_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, client_session_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_profile
  ON tracking_sessions (profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_activity
  ON tracking_sessions (site_id, last_activity_at DESC);
```

### 4.5 Bảng `tracking_events`

```sql
CREATE TABLE IF NOT EXISTS tracking_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL,
  site_id text NOT NULL,
  profile_id text,
  session_id uuid,
  event_type varchar(50) NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  url text,
  referrer text,
  title text,
  utm jsonb,
  metadata jsonb,
  consent jsonb,
  project_code text,
  status varchar(20) NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'dropped', 'aggregate_only', 'error')),
  drop_reason varchar(50),
  score_delta integer NOT NULL DEFAULT 0,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_site_time
  ON tracking_events (site_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_profile_time
  ON tracking_events (profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_status_time
  ON tracking_events (status, occurred_at DESC);
```

### 4.6 Bảng `profile_touchpoints`

```sql
CREATE TABLE IF NOT EXISTS profile_touchpoints (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL,
  session_id uuid,
  occurred_at timestamptz NOT NULL,
  source varchar(50),
  medium varchar(50),
  campaign varchar(120),
  referrer text,
  url text,
  is_first boolean NOT NULL DEFAULT false,
  is_last boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_profile_touchpoints_profile
  ON profile_touchpoints (profile_id, occurred_at DESC);
```

### 4.7 Bảng `ip_sessions`

Dùng cho ANON-013: lượt truy cập không có Cookie/Device, chỉ có IP + session.

```sql
CREATE TABLE IF NOT EXISTS ip_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  ip_hash text NOT NULL,
  client_session_id text NOT NULL,
  started_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL,
  page_views integer NOT NULL DEFAULT 0,
  engaged boolean NOT NULL DEFAULT false,
  UNIQUE (site_id, ip_hash, client_session_id)
);

CREATE INDEX IF NOT EXISTS idx_ip_sessions_site_time
  ON ip_sessions (site_id, last_activity_at DESC);
```

### 4.8 Bảng `anonymous_alerts`

```sql
CREATE TABLE IF NOT EXISTS anonymous_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL,
  type varchar(40) NOT NULL DEFAULT 'website_return',
  status varchar(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'processing', 'resolved', 'skipped')),
  severity varchar(20) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high')),
  assignee_id text,
  score_at_creation integer,
  message text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_anonymous_alerts_status
  ON anonymous_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anonymous_alerts_profile
  ON anonymous_alerts (profile_id, created_at DESC);
```

### 4.9 Bảng `landing_page_mappings`

```sql
CREATE TABLE IF NOT EXISTS landing_page_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL,
  landing_page_id text NOT NULL,
  project_id text NOT NULL,
  event_project_id text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_mappings_lookup
  ON landing_page_mappings (site_id, landing_page_id, start_at, end_at);
```

### 4.10 Mở rộng `identity_conflicts` (nếu chưa có)

```sql
ALTER TABLE identity_conflicts
  ADD COLUMN IF NOT EXISTS primary_profile_id text,
  ADD COLUMN IF NOT EXISTS move_key text,
  ADD COLUMN IF NOT EXISTS resolution_action text,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS undo_payload jsonb;
```

### 4.11 Backfill

- Với profile seed hiện có: tạo `profile_identifiers` từ `cookie_id`, `device_id`, `phone` nếu có.
- Với event JSON seed: có thể giữ nguyên để đọc; bảng `tracking_events` là nguồn chuẩn cho event mới.
- Không xoá dữ liệu seed trước khi FE/BE chuyển sang đọc bảng mới.

---

## 5. API contract

### 5.1 Quy ước chung

- Base path: `/api/v1`
- Admin API: `Authorization: Bearer <JWT>`
- Public tracking API: không dùng JWT, xác thực bằng site key.
- Response thành công: `{ "data": ... }`
- Response lỗi:

```json
{
  "statusCode": 400,
  "errorCode": "ERR_TRACKING_INVALID_PAYLOAD",
  "message": "Invalid event payload"
}
```

- Mã lỗi đề xuất:

| errorCode | HTTP | Ý nghĩa |
|---|---|---|
| `ERR_TRACKING_INVALID_PAYLOAD` | 400 | Thiếu/sai trường bắt buộc |
| `ERR_TRACKING_INVALID_KEY` | 401 | Sai siteId/trackingKey/serverKey |
| `ERR_TRACKING_ORIGIN_NOT_ALLOWED` | 403 | Origin không thuộc allowedOrigins |
| `ERR_TRACKING_RATE_LIMITED` | 429 | Vượt rate limit |
| `ERR_ANON_PHONE_INVALID` | 422 | Phone sai định dạng |
| `ERR_ANON_PROFILE_NOT_FOUND` | 404 | Không tìm thấy profile |
| `ERR_ANON_IDENTITY_CONFLICT` | 409 | Key đã gắn phone khác |
| `ERR_ANON_CONFLICT_RESOLVED` | 409 | Conflict đã xử lý |

### 5.2 `POST /api/v1/tracking/collect`

**Mục đích:** nhận event từ MKT Hub Tracking Script.

**Auth:** public; `siteId` + `trackingKey`; kiểm tra `Origin`.

**Body:**

```json
{
  "siteId": "SITE-001",
  "trackingKey": "tk_live_...",
  "events": [
    {
      "eventId": "b0d1c2f4-6f1a-4b1e-9f5d-1f2a3b4c5d6e",
      "eventType": "page_view",
      "occurredAt": "2026-10-26T08:15:00.000Z",
      "url": "https://mkthub.vn/bang-gia",
      "referrer": "https://www.google.com/",
      "title": "Bảng giá Enterprise",
      "sessionId": "s_01J...",
      "cookieId": "ck_01J...",
      "deviceId": "fp_01J...",
      "externalUserId": null,
      "projectCode": null,
      "utm": {
        "source": "google",
        "medium": "cpc",
        "campaign": "b2b_enterprise_q4_2026"
      },
      "metadata": {
        "path": "/bang-gia",
        "durationSec": 18
      },
      "consent": {
        "analytics": true
      }
    }
  ]
}
```

**Giới hạn:**

- Tối đa 50 event/request.
- Body tối đa 32KB.
- `occurredAt` không được lệch quá 7 ngày so với `receivedAt`; event tương lai >5 phút bị đánh dấu lỗi.

**Response 200/202:**

```json
{
  "data": {
    "accepted": 1,
    "duplicates": 0,
    "dropped": 0,
    "rejected": 0,
    "results": [
      {
        "eventId": "b0d1c2f4-6f1a-4b1e-9f5d-1f2a3b4c5d6e",
        "status": "accepted",
        "profileId": "anon-1"
      }
    ]
  }
}
```

**Quy tắc:**

- Event trùng `eventId`: trả `status: "duplicate"`, không ghi timeline/score lần 2.
- Site inactive: trả `status: "dropped"`, `dropReason: "site_inactive"`, không tạo profile. Không trả 5xx để tracker không retry vô hạn.
- Bot/crawler: `dropped`, `dropReason: "bot"`.
- IP nội bộ/test: `dropped`, `dropReason: "internal"`.
- Không có key cá nhân nhưng có IP: tạo/ cập nhật `ip_sessions`, event `aggregate_only`.
- Không có key và không đủ IP session: event `aggregate_only`.
- Payload sai: `rejected`, log lỗi; không tạo/cập nhật profile.

### 5.3 `POST /api/v1/tracking/identify`

**Mục đích:** website backend gửi form submit / landing page / chat có phone.

**Auth:** `X-MKT-Site-Id` + `X-MKT-Server-Key` (secret, không dùng trackingKey public).

**Body:**

```json
{
  "eventId": "form-01J...",
  "occurredAt": "2026-10-26T08:20:00.000Z",
  "phone": "0901234567",
  "name": "Nguyễn Văn A",
  "email": "a@company.vn",
  "company": "Công ty A",
  "cookieId": "ck_01J...",
  "deviceId": "fp_01J...",
  "sessionId": "s_01J...",
  "landingPageId": "lp_enterprise_q4",
  "projectCode": "PRJ-2026-001",
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "b2b_enterprise_q4_2026"
  },
  "metadata": {
    "formId": "contact-enterprise"
  }
}
```

**Response:**

```json
{
  "data": {
    "leadId": "LEAD-2026-0123",
    "leadCode": "LEAD-2026-0123",
    "created": true,
    "anonymousProfileId": "anon-1",
    "converted": true,
    "projectCounted": true,
    "registrationId": null,
    "duplicate": false
  }
}
```

**Quy tắc:**

- Chuẩn hoá phone Việt Nam: bỏ khoảng trắng/gạch nối, `+84`/`84` → `0`, đúng 10 số, loại số giả theo cấu hình. Khuyến nghị dùng `libphonenumber-js`.
- Phone sai định dạng: `422 ERR_ANON_PHONE_INVALID`, không tạo Lead.
- Phone mới: tạo Lead, tăng Lead mới của dự án đúng một lần.
- Phone đã tồn tại: cập nhật Lead, không tạo trùng; vẫn ghi nhận đăng ký sự kiện nếu là landing page.
- Chuyển session/event/touchpoint/identifier từ Anonymous Profile sang Lead; giữ `anonymous_id` để audit.
- Key đã gắn phone khác: tạo Identity Conflict, không auto-merge.
- `eventId` idempotent; cùng phone + cùng Project/Event chỉ tính đăng ký một lần.
- Landing page không có mapping hoặc ngoài thời gian hiệu lực: vẫn xử lý Lead nhưng `projectCounted=false`, tạo cảnh báo cấu hình.
- Ưu tiên `projectCode` trên link hơn mapping theo thời gian.

### 5.4 `GET /api/v1/tracking/sites/{id}/script`

**Auth:** admin.

**Response:**

```json
{
  "data": {
    "siteId": "SITE-001",
    "scriptUrl": "https://cdn.mkthub.vn/t.js?site=SITE-001&key=tk_live_...",
    "snippet": "<script async src=\"https://cdn.mkthub.vn/t.js?site=SITE-001&key=tk_live_...\"></script>"
  }
}
```

- FE dùng `scriptUrl`/`snippet` từ API, không hardcode CDN.
- Có thể trả thêm `serverKey` một lần duy nhất khi tạo site hoặc rotate; không trả lại trong list.

### 5.5 `GET /api/v1/anonymous-profiles/stats`

**Auth:** admin.

**Query:** `siteId`, `from`, `to`.

**Response:**

```json
{
  "data": {
    "active": 1240,
    "new30d": 320,
    "returning": 180,
    "identitySignals": 46,
    "pendingAlerts": 12,
    "conflicts": 3,
    "engagedRate": 41.2,
    "total": 1480,
    "identified": 96
  }
}
```

**Lý do:** FE hiện tải toàn bộ profile rồi tự tính KPI. Khi có phân trang/dữ liệu lớn, số liệu sẽ sai và chậm. BE phải là nguồn tính KPI.

### 5.6 `GET /api/v1/anonymous-profiles/{id}/timeline`

**Auth:** admin.

**Query:** `page=1`, `limit=50`, `type=page_view`.

**Response:**

```json
{
  "data": {
    "items": [
      {
        "id": "evt_...",
        "eventId": "b0d1...",
        "eventType": "page_view",
        "occurredAt": "2026-10-26T08:15:00.000Z",
        "receivedAt": "2026-10-26T08:15:02.000Z",
        "url": "https://mkthub.vn/bang-gia",
        "title": "Bảng giá Enterprise",
        "scoreDelta": 5,
        "metadata": { "durationSec": 18 }
      }
    ],
    "total": 24,
    "page": 1,
    "limit": 50
  }
}
```

### 5.7 `PATCH /api/v1/tracking/sites/{id}`

**Auth:** admin (Manager/Head).

**Body:**

```json
{
  "name": "MKT Hub Corporate Website",
  "domain": "mkthub.vn",
  "allowedOrigins": ["https://mkthub.vn", "https://www.mkthub.vn"],
  "retentionDays": 365,
  "internalCidrs": ["10.0.0.0/8", "192.168.0.0/16"],
  "timezone": "Asia/Ho_Chi_Minh",
  "enabled": true
}
```

### 5.8 `POST /api/v1/tracking/sites/{id}/rotate-keys`

**Auth:** admin (Manager/Head).

**Response:**

```json
{
  "data": {
    "siteId": "SITE-001",
    "trackingKey": "tk_live_new...",
    "serverKey": "sk_live_new...",
    "scriptUrl": "https://cdn.mkthub.vn/t.js?site=SITE-001&key=tk_live_new..."
  }
}
```

Chỉ hiển thị `serverKey` một lần; BE lưu hash.

### 5.9 Conflict resolve và undo

**Resolve:** `POST /api/v1/anonymous-profiles/conflicts/{id}/resolve`

```json
{
  "action": "merge",
  "primaryProfileId": "anon-1",
  "moveKey": null,
  "note": "Xác nhận cùng một khách hàng"
}
```

Hỗ trợ:

- `merge`: cần `primaryProfileId`.
- `keep`: giữ độc lập.
- `move`: cần `moveKey`.
- `insufficient`: giữ trạng thái pending, lưu note + `lastReviewedAt`.

**Undo:** `POST /api/v1/anonymous-profiles/conflicts/{id}/undo`

```json
{
  "reason": "Hợp nhất nhầm"
}
```

Undo dùng `undo_payload` đã lưu trước khi merge, khôi phục identifier/event và tính lại score; ghi audit.

### 5.10 API P1/P2

| API | Mục đích |
|---|---|
| `GET /api/v1/anonymous-profiles/alerts` | Danh sách cảnh báo quay lại |
| `PATCH /api/v1/anonymous-profiles/alerts/{id}` | Đổi trạng thái/phân công/ghi chú |
| `POST /api/v1/anonymous-profiles/alerts/{id}/claim` | Nhận xử lý |
| `GET/POST/PATCH/DELETE /api/v1/tracking/landing-pages` | Mapping landing page ↔ project/event |
| `GET /api/v1/anonymous-profiles/export` | Export CSV đã che dữ liệu |
| `POST /api/v1/anonymous-profiles/export/full-ip` | Export IP đầy đủ + lý do + audit |

---

## 6. Thuật toán xử lý event

### 6.1 Luồng `collect`

```text
handleCollect(site, events, requestContext):
  site = findSite(siteId)
  if !site or !site.enabled: return dropped for all
  if !verifyTrackingKey(site, key): return 401
  if !isAllowedOrigin(site, origin): return 403
  if rateLimited(site, clientIp): return 429

  for raw in events:
    if !validateSchema(raw): log error; results.push(rejected); continue
    if eventIdExists(raw.eventId): results.push(duplicate); continue
    if isBot(raw): saveEvent(status=dropped, reason=bot); continue
    if isInternalIp(clientIp, site): saveEvent(status=dropped, reason=internal); continue
    if !hasPersonalKey(raw):
      if hasIp(clientIp): upsertIpSession(...)
      saveEvent(status=aggregate_only)
      continue

    with transaction:
      lockKeys(site.siteId, raw.cookieId, raw.deviceId, raw.externalUserId)
      profile = resolveProfile(site, raw)
      session = resolveSession(profile, raw)
      insertEvent(status=accepted, profile, session)
      updateSession(session, raw)
      updateProfile(profile, raw, session)
      updateTouchpoint(profile, session, raw)
      if detectConflict(profile, raw): createConflict(...)
    enqueueScore(profile.id)
    enqueueAlertCheck(profile.id)
    results.push(accepted)
```

### 6.2 Resolve profile

Thứ tự key:

1. `externalUserId`
2. `cookieId`
3. `deviceId`
4. `sessionId`

Quy tắc:

- Tìm `profile_identifiers` theo `site_id + key_type + key_value`.
- Không tìm thấy key nào và có cookie/device → tạo Anonymous Profile mới, gắn identifier.
- Tìm thấy một profile → dùng profile đó, gắn thêm key chưa tồn tại.
- Nhiều key trỏ về nhiều profile khác nhau:
  - Không tự động merge.
  - Chọn profile của key ưu tiên cao nhất làm primary.
  - Gắn key chưa thuộc profile nào.
  - Key đã thuộc profile khác → tạo conflict `identifier_mismatch`, `canAutoMerge=false`.
- Chỉ có `sessionId`/IP → không tạo profile cá nhân; dùng `ip_sessions`.
- Không auto-link giữa hai `site_id`/domain khác nhau.

### 6.3 Session

- Session hết hạn sau **30 phút** không hoạt động.
- Nếu client gửi `sessionId` và session gần nhất cùng profile còn hạn → cập nhật.
- Nếu hết hạn hoặc không có → tạo session mới.
- `visitCount` của profile tăng **một lần** khi tạo session mới.
- `userType`:
  - `new` nếu đây là session đầu tiên.
  - `returning` nếu đã có session trước đó.
- `pageViews` tăng khi `eventType=page_view`.
- `durationSec` cập nhật từ `time_on_page`.
- `engaged = durationSec > 10 OR pageViews >= 2 OR converted = true`.
- `ended_at` cập nhật khi có `time_on_page`/session end hoặc job đóng session cũ.

### 6.4 Profile counters và trạng thái

- `first_seen_at`: giữ nguyên.
- `last_seen_at = greatest(last_seen_at, occurred_at)`.
- `status`:
  - `active` nếu `last_seen_at` trong 30 ngày.
  - `inactive` nếu quá 30 ngày và chưa hết retention.
  - `identified` sau khi convert.
  - `expired` sau retention.
- `has_conflict` nếu có conflict pending.
- `suspectedCompany`, `companyConfidence` cập nhật từ IP cluster/company service.
- `score`, `tier` cập nhật bởi scoring service.

### 6.5 First touch / Last touch

- First touch: session đầu tiên có source/referrer/UTM; **không ghi đè**.
- Last touch: touchpoint hợp lệ mới nhất.
- Direct traffic không xoá first touch.
- Ghi mỗi touchpoint vào `profile_touchpoints`; đánh dấu `is_first`, `is_last`.
- Cross-domain không tự merge.

### 6.6 Event muộn và thứ tự

- Timeline sắp xếp theo `occurred_at`, không theo `received_at`.
- Event muộn vẫn chèn đúng vị trí.
- Nếu event còn hiệu lực theo scoring rule, tính lại score.
- `last_seen_at` chỉ tăng, không giảm vì event muộn.

### 6.7 Chống trùng

- `tracking_events.event_id` unique.
- Insert dùng `ON CONFLICT (event_id) DO NOTHING`; nếu rowCount=0 → duplicate.
- Không cộng score/KPI/visitCount khi duplicate.
- Với `identify`, dùng `eventId` và unique `(phone, project_event_id)` cho đăng ký sự kiện.

### 6.8 Bot / internal / test

- Bot: User-Agent list + known crawler IP ranges.
- Internal: CIDR cấu hình theo site + IP test/staging.
- Không tạo profile, không cộng KPI; lưu event `dropped` để điều tra.
- Không tin cờ `internal=true` do client gửi.

### 6.9 Conflict

Tạo conflict khi:

- Một Cookie/Device/External User ID đã gắn phone A, này xuất hiện với phone B.
- Hai identifier của cùng event trỏ về hai profile đã định danh khác nhau.
- Key đã được resolve trước đó nhưng profile đích không duy nhất.

Conflict cần lưu:

- `keyType`, `keyValue`, `maskedKey`
- `phones[]`
- `profiles[]` (id, anonymousId, name, phone, tier, score, company)
- `reason`, `severity`
- `status = pending`, `canAutoMerge = false`
- `slaDueAt = detectedAt + 24h`
- Audit.

Không merge tự động. Chỉ resolve qua API admin.

### 6.10 Convert sang Lead

Trong transaction:

1. Chuẩn hoá và validate phone.
2. Tìm Lead theo phone.
3. Nếu chưa có → tạo Lead.
4. Chuyển `profile_identifiers` sang Lead.
5. Chuyển `tracking_sessions`, `tracking_events`, `profile_touchpoints` sang Lead (hoặc giữ `anonymous_profile_id` tham chiếu).
6. Cập nhật profile `status=identified`, `converted_lead_id`, `converted_at`.
7. Ghi audit.
8. Trigger tính lại score và cập nhật Lead.
9. Nếu có landing page → xử lý đăng ký sự kiện, chống trùng.

### 6.11 Scoring và alert

- Sau event/session, enqueue job `recompute-score(profileId)`.
- SLA: score cập nhật ≤5 phút.
- Nếu có Lead Scoring module → gọi service/rule engine hiện có.
- Nếu chưa có → dùng bảng rule tạm thời, cấu hình được; không hardcode trong controller.
- Alert user quay lại:
  - Khoảng trống `last_seen_at` trước session mới ≥7 ngày.
  - Tạo/ cập nhật alert `website_return`.
  - Nếu score đạt Warm/Hot → severity cao hơn.
  - Dedupe 24 giờ: chỉ cập nhật alert hiện hữu, không tạo mới.

### 6.12 Retention

- Chạy daily (ví dụ 02:00 server time).
- Profile chưa identified, `last_seen_at < now - retention_days` → `expired`.
- Xoá/biến đổi không thể truy ngược: `cookie_id`, `device_id`, `external_user_id`, IP.
- Giữ aggregate counters (site, ngày, source, campaign).
- Profile identified dùng retention của Lead/Contact.
- Audit system action.

---

## 7. Triển khai NestJS

### 7.1 Cấu trúc module đề xuất

```text
src/tracking/
  tracking.module.ts
  controllers/
    tracking-collect.controller.ts   # public
    tracking-identify.controller.ts  # public, server key
    tracking-sites.controller.ts     # admin
    tracking-script.controller.ts    # serve t.js hoặc trả snippet
  dto/
    collect-events.dto.ts
    identify.dto.ts
    update-site.dto.ts
    stats-query.dto.ts
    timeline-query.dto.ts
  guards/
    tracking-site.guard.ts
    server-key.guard.ts
  services/
    site-auth.service.ts
    event-normalizer.service.ts
    bot-filter.service.ts
    profile-resolver.service.ts
    session.service.ts
    event-store.service.ts
    identify.service.ts
    conflict.service.ts
    stats.service.ts
    retention.service.ts
  processors/
    event-ingest.processor.ts
    score.processor.ts
    alert.processor.ts
```

### 7.2 Trách nhiệm service

| Service | Trách nhiệm |
|---|---|
| `SiteAuthService` | Tìm site, verify trackingKey/serverKey, origin, enabled |
| `EventNormalizer` | Map payload → DTO chuẩn, validate timestamp, event type |
| `BotFilterService` | UA, IP CIDR, internal/test |
| `ProfileResolverService` | Resolve/tạo profile, gắn identifier, phát hiện mismatch |
| `SessionService` | Tạo/cập nhật session 30 phút, engaged, visitCount |
| `EventStoreService` | Insert event idempotent, timeline, counters |
| `IdentifyService` | Phone → Lead, convert, registration, audit |
| `ConflictService` | Tạo/resolve/undo conflict |
| `StatsService` | KPI overview |
| `RetentionService` | Job retention |

### 7.3 Biến môi trường

```env
TRACKING_SCRIPT_URL=https://cdn.mkthub.vn/t.js
TRACKING_BATCH_MAX=50
TRACKING_BODY_MAX_BYTES=32768
TRACKING_RATE_LIMIT_PER_MIN=120
TRACKING_LATE_EVENT_DAYS=7
TRACKING_SESSION_IDLE_MINUTES=30
TRACKING_DEFAULT_RETENTION_DAYS=365
IP_HASH_PEPPER=__secret__
REDIS_URL=redis://...
TRACKING_INGEST_ENABLED=true
```

### 7.4 Pseudo-code controller

```ts
@Post('collect')
@HttpCode(202)
async collect(@Body() dto: CollectEventsDto, @Req() req: Request) {
  const site = await this.siteAuth.verifyTracking(dto.siteId, dto.trackingKey, req);
  const result = await this.ingest.ingestBatch(site, dto.events, req);
  return { data: result };
}
```

### 7.5 Transaction boundary

- Mỗi event: một transaction riêng để lỗi một event không rollback cả batch.
- Batch: validate toàn bộ trước, sau đó xử lý từng event.
- Khóa theo key chính để tránh tạo profile trùng khi request đồng thời:

```sql
SELECT pg_advisory_xact_lock(hashtext(:siteId || ':' || :primaryKey));
```

- Với queue: worker xử lý idempotent; nếu retry, `event_id` unique bảo vệ.

### 7.6 Swagger

- Mỗi endpoint mới phải có `@ApiOperation`, `@ApiBody`, `@ApiOkResponse` với DTO response.
- Không để response schema rỗng.
- Thêm tag `Tracking Collector`, `Tracking Sites`, `Anonymous Profiles`.
- Ví dụ request/response trong Swagger dùng dữ liệu không nhạy cảm.

---

## 8. Tracker script `t.js`

### 8.1 Yêu cầu

- Tải bất đồng bộ, không chặn website.
- Kích thước mục tiêu ≤10KB gzip, không dependency.
- Không throw lỗi ra global; mọi thứ bọc `try/catch`.
- Không gửi nội dung form; chỉ metadata.
- Tôn trọng consent nếu website cung cấp.

### 8.2 Cookie/localStorage

| Tên | Nơi lưu | Thời hạn | Mục đích |
|---|---|---|---|
| `_mkt_cid` | Cookie first-party | 365 ngày | Cookie ID |
| `_mkt_sid` | Cookie/sessionStorage | 30 phút | Session ID |
| `_mkt_did` | localStorage | 365 ngày | Device ID (hash) |

- `SameSite=Lax`, `Secure` trên HTTPS.
- Nếu cookie bị chặn, dùng device ID/localStorage; nếu không có, BE xử lý IP session.

### 8.3 Event tự động

| Event | Cách bắt |
|---|---|
| `page_view` | Load trang, SPA route change |
| `time_on_page` | `visibilitychange` + `beforeunload` |
| `cta_click` | Element có `data-mkt-event` |
| `document_download` | Link đuôi pdf/doc/xls/zip |
| `form_submit` | Listener form, chỉ metadata; identify qua website backend |
| `chat_interaction` | Website chat gọi `collect` hoặc `identify` |
| `website_return` | BE tính từ session, không cần client |

### 8.4 Gửi event

- Ưu tiên `navigator.sendBeacon` với `Blob` JSON.
- Fallback `fetch(..., { keepalive: true })`.
- Nếu lỗi mạng: lưu tối đa 20 event vào localStorage, retry lần sau; không lưu vô hạn.
- Mỗi event có `eventId` UUID; retry giữ nguyên ID.

### 8.5 Script skeleton

```js
(function () {
  try {
    var script = document.currentScript;
    var params = new URL(script.src).searchParams;
    var siteId = params.get('site');
    var trackingKey = params.get('key');
    if (!siteId || !trackingKey) return;

    var endpoint = script.src.replace(/\/t\.js.*$/, '/api/v1/tracking/collect');
    var cid = getCookie('_mkt_cid') || uuid();
    setCookie('_mkt_cid', cid, 365);
    var did = localStorage.getItem('_mkt_did') || uuid();
    localStorage.setItem('_mkt_did', did);
    var sid = getCookie('_mkt_sid') || uuid();
    setCookie('_mkt_sid', sid, 1 / 48); // 30 phút

    function send(eventType, metadata) {
      var payload = {
        siteId: siteId,
        trackingKey: trackingKey,
        events: [{
          eventId: uuid(),
          eventType: eventType,
          occurredAt: new Date().toISOString(),
          url: location.href,
          referrer: document.referrer || null,
          title: document.title,
          sessionId: sid,
          cookieId: cid,
          deviceId: did,
          utm: getUtm(),
          metadata: metadata || {}
        }]
      };
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
      }
    }

    send('page_view', { path: location.pathname });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') send('time_on_page', { path: location.pathname });
    });
  } catch (e) {
    // không làm gián đoạn website
  }
})();
```

> Đây là skeleton. BE/Website team cần bổ sung helper `getCookie`, `setCookie`, `uuid`, `getUtm`, SPA route tracking, retry queue và consent trước khi production.

---

## 9. Bảo mật và phi chức năng

### 9.1 CORS

- Đọc `allowed_origins` theo site.
- Chỉ cho phép `POST`, `OPTIONS`, header `Content-Type`.
- Không dùng `*` cho endpoint identify.
- Trả `204` cho preflight hợp lệ.

### 9.2 Rate limit

- Theo site + IP: 120 request/phút (cấu hình).
- Batch tối đa 50 event.
- Body tối đa 32KB.
- Trả `429 ERR_TRACKING_RATE_LIMITED`, có `Retry-After`.

### 9.3 PII / IP

- Không nhận toàn bộ nội dung form.
- Phone/email chỉ nhận qua identify; mã hoá/che theo chính sách.
- IP đầy đủ mã hoá hoặc lưu bảng riêng; API trả masked.
- `IP_HASH_PEPPER` dùng hash IP cho thống kê.
- Log không chứa phone/cookie/IP thô.
- Truy cập full IP phải có lý do + audit.

### 9.4 Idempotency và concurrency

- Unique `event_id`.
- Transaction + advisory lock theo key.
- Retry an toàn.
- Worker xử lý lặp không nhân đôi.

### 9.5 SLA

| Chỉ số | Mục tiêu |
|---|---|
| Event → profile/timeline | ≤60 giây |
| Event → score | ≤5 phút |
| Event → alert | ≤5 phút |
| Site stats | cập nhật ≤60 giây |
| Conflict SLA | 24 giờ, cảnh báo overdue mỗi 4 giờ |

### 9.6 Observability

Metrics:

- `tracking_events_total{status,reason}`
- `tracking_ingest_duration_ms`
- `tracking_queue_lag_seconds`
- `tracking_profiles_created_total`
- `tracking_conflicts_created_total`
- `tracking_identify_total{result}`
- `tracking_dropped_total{reason}`

Alert:

- 5xx > 1% trong 5 phút.
- Queue lag > 60 giây.
- Tỷ lệ dropped bất thường.
- Không có event mới > 30 phút trong giờ làm việc (nếu site active).

---

## 10. Test plan

### 10.1 Unit test

- Chuẩn hoá phone VN.
- Resolve key ưu tiên external > cookie > device.
- Session 30 phút.
- First touch không ghi đè.
- Idempotency eventId.
- Bot/internal filter.
- Conflict detection.
- Retention xoá identifier.

### 10.2 Integration test

| ID | Case | Kỳ vọng |
|---|---|---|
| ANON-003 | Sai tracking key | 401, không tạo profile |
| ANON-004 | Site inactive | event dropped, không tạo profile |
| ANON-006 | Event hợp lệ | 202, tạo event + profile |
| ANON-007 | Trùng eventId | duplicate, không nhân đôi timeline |
| ANON-008 | Event muộn | chèn đúng timeline |
| ANON-009 | Payload sai | 400, log lỗi |
| ANON-010 | Bot | dropped, không tạo profile |
| ANON-011 | IP nội bộ | dropped, không tính KPI |
| ANON-012 | Không key | aggregate_only |
| ANON-013 | Chỉ IP | tạo ip_session |
| ANON-014 | Retry | chỉ xử lý một lần |
| ANON-015 | Page view đầu | tạo profile |
| ANON-016 | Cùng cookie | không tạo profile trùng |
| ANON-017 | Sau 30 phút | session mới |
| ANON-019 | Quay lại | userType=returning |
| ANON-026 | 8 event types | timeline đủ |
| ANON-027 | First touch | không bị ghi đè |
| ANON-028 | Last touch | cập nhật |
| ANON-031 | UTM/referrer | lưu touchpoint |
| ANON-047 | Phone hợp lệ | tạo/cập nhật Lead |
| ANON-048 | Phone sai | 422, không tạo Lead |
| ANON-052 | Key 2 phone | conflict, không auto-merge |
| ANON-055 | Convert | tính lại score |
| ANON-095 | SLA hiển thị | ≤60 giây |
| ANON-099 | Retry/submit lặp | không count trùng |

### 10.3 E2E

1. Tạo site trên admin.
2. Lấy snippet, gắn vào trang test.
3. Mở trang → kiểm tra profile mới trong module ≤60 giây.
4. Refresh cùng cookie → không tạo profile mới, session tăng đúng.
5. Chờ 30 phút hoặc giả lập event mới → session mới.
6. Submit form phone → Lead mới, profile biến mất khỏi danh sách active.
7. Dùng cùng cookie submit phone khác → conflict xuất hiện.
8. Kiểm tra audit.

### 10.4 Curl mẫu

```bash
curl -X POST "https://mkt-hub.onrender.com/api/v1/tracking/collect" \
  -H "Content-Type: application/json" \
  -H "Origin: https://mkthub.vn" \
  -d '{
    "siteId": "SITE-001",
    "trackingKey": "tk_live_...",
    "events": [{
      "eventId": "test-evt-001",
      "eventType": "page_view",
      "occurredAt": "2026-10-26T08:15:00.000Z",
      "url": "https://mkthub.vn/bang-gia",
      "sessionId": "test-session-001",
      "cookieId": "test-cookie-001",
      "deviceId": "test-device-001"
    }]
  }'
```

```bash
curl -X POST "https://mkt-hub.onrender.com/api/v1/tracking/identify" \
  -H "Content-Type: application/json" \
  -H "X-MKT-Site-Id: SITE-001" \
  -H "X-MKT-Server-Key: sk_live_..." \
  -d '{
    "eventId": "test-form-001",
    "occurredAt": "2026-10-26T08:20:00.000Z",
    "phone": "0901234567",
    "cookieId": "test-cookie-001",
    "sessionId": "test-session-001",
    "projectCode": "PRJ-2026-001"
  }'
```

---

## 11. Checklist task cho BE

| ID | Task | Ước lượng | Phụ thuộc | DoD |
|---|---|---|---|---|
| BE-01 | Xác nhận schema/ORM hiện tại, mapping bảng thật | 0.5d | — | Có danh sách bảng/cột thực tế |
| BE-02 | Migration bảng mới + mở rộng site | 1d | BE-01 | Chạy được trên staging, rollback được |
| BE-03 | Mở rộng CRUD site: allowedOrigins, retention, internalCidrs, rotate key | 1d | BE-02 | API + Swagger + test |
| BE-04 | Tracker script `t.js` + trang demo | 2d | BE-03 | Gửi page_view/time_on_page thành công |
| BE-05 | `POST /tracking/collect` + validation + CORS + rate limit | 2d | BE-02 | Nhận batch, trả kết quả từng event |
| BE-06 | Normalizer + idempotency | 1.5d | BE-05 | Trùng eventId không ghi lần 2 |
| BE-07 | Profile/session/event ingestion | 3d | BE-06 | Tạo profile, session, timeline đúng |
| BE-08 | First/last touch + userType + engaged | 1d | BE-07 | Đúng ANON-018/019/022-025/027-029 |
| BE-09 | Bot/internal/IP session/aggregate | 1d | BE-05 | Đúng ANON-010/011/012/013 |
| BE-10 | Conflict detection + resolve payload mở rộng | 2d | BE-07 | Conflict tạo đúng, không auto-merge |
| BE-11 | `POST /tracking/identify` + convert Lead | 3d | BE-07 | Form → Lead, chuyển lịch sử |
| BE-12 | Stats API + timeline API | 2d | BE-07 | FE dùng được, số liệu khớp |
| BE-13 | Scoring + alert | 2d | BE-11 | ≤5 phút, dedupe 24h |
| BE-14 | Retention job | 1d | BE-07 | Xoá identifier/IP đúng hạn |
| BE-15 | Swagger DTO + response example | 1d | BE-05..13 | Không còn schema rỗng |
| BE-16 | Test unit/integration/E2E | 3d | BE-05..14 | Pass bộ case mục 10 |
| BE-17 | Observability + alert vận hành | 1d | BE-05 | Có metric/log/alert |
| BE-18 | Tài liệu bàn giao + hướng dẫn gắn script | 0.5d | BE-16 | Website team tự gắn được |

Tổng ước lượng: **~28–30 dev days** (1 BE + 1 QA, chưa gồm FE). Có thể song song BE-04 với BE-05..07.

---

## 12. Việc FE cần làm sau khi BE xong

1. Dùng `scriptUrl` từ API thay vì hardcode `cdn.mkthub.vn` (`src/pages/AnonymousProfiles.jsx:755,770`).
2. Gọi `GET /anonymous-profiles/stats` thay vì tự tính KPI từ toàn bộ danh sách.
3. Thêm polling 30–60 giây hoặc SSE để profile mới tự xuất hiện.
4. Conflict modal gửi thêm `primaryProfileId`/`moveKey`.
5. Nút Confirm/Reject IP–Company ở panel chi tiết phải gọi API (QA đã ghi nhận).
6. Hiển thị `allowedOrigins`, `retentionDays`, `lastEventAt` trong tab Site.
7. Bổ sung filter server-side nếu danh sách lớn.

---

## 13. Rollout

1. Chạy migration trên staging.
2. Deploy BE với `TRACKING_INGEST_ENABLED=false`.
3. Tạo site test, gắn script lên trang staging.
4. Bật flag cho site test, kiểm tra E2E.
5. Kiểm tra Swagger, log, metrics.
6. Tạo site production, gắn script.
7. Bật flag toàn bộ.
8. Theo dõi 48 giờ: event, profile, conflict, 5xx, queue lag.
9. Backfill identifier cho dữ liệu seed nếu cần.

Rollback:

- Tắt `TRACKING_INGEST_ENABLED` → collector trả dropped, không ghi mới.
- Không cần rollback migration ngay; giữ bảng mới.
- Script có thể gỡ khỏi website.

---

## 14. Câu hỏi cần chốt

1. Repo/ORM BE đang dùng gì (Prisma/TypeORM) để chốt migration?
2. Render có Redis/BullMQ chưa? Nếu chưa, P0 xử lý đồng bộ, bổ sung queue ở P1.
3. `cdn.mkthub.vn` do ai quản lý? BE serve `t.js` hay CI deploy lên CDN?
4. Scope triển khai ngay: P0/P1 hay bao gồm P2 (scoring/alert/landing page)?
5. Consent/CMP: có cần chặn tracking khi chưa consent không?
6. Traffic dự kiến (event/giây) để chọn rate limit, queue và cache stats.
7. Tên bảng/cột thật của `anonymous_profiles`, `identity_conflicts`, `anonymous_audit` để map chính xác.

---

## 15. Phụ lục — Mapping response profile hiện tại

FE hiện đọc các field sau (đã chuẩn hoá ở `src/utils/normalizeProfiles.js`):

- Profile: `id`, `anonymousId`, `status`, `tier`, `score`, `visitCount`, `pageViews`, `totalDurationSec`, `device`, `os`, `browser`, `city`, `isp`, `utmSource`, `utmMedium`, `utmCampaign`, `topPages`, `events`, `suspectedCompany`, `ipClusterId`, `hasConflict`, `conflictId`, `convertedLeadId`, `firstSeenAt`, `lastSeenAt`.
- Conflict: `id`, `code`, `keyType`, `keyValue`, `maskedKey`, `phones`, `profiles`, `reason`, `severity`, `status`, `sla`.
- Cluster: `id`, `code`, `ipRange`, `isp`, `orgName`, `suspectedCompany`, `profileCount`, `totalVisits`, `confidence`, `status`.
- Site: `id`, `siteId`, `name`, `domain`, `trackingKey`, `eventsCount`, `lastEventAt`, `enabled`.
- Audit: `id`, `actorName`, `action`, `entityType`, `entityId`, `beforeData`, `afterData`, `createdAt`.

BE giữ tương thích các field này để không phải sửa FE ngay; các field mới bổ sung thêm.
