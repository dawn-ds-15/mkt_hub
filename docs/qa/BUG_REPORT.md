# MKT Hub frontend QA report

## Fix verification

The seven findings below have been addressed. The original reproduction notes are retained as history.

- Removed implicit mock fallbacks; all four pages now show loading/error/retry states and accept empty API results.
- Mutations stop on API failure and show error notifications. Company creation and tracking-site creation no longer fabricate successful records or tracking credentials after failure.
- Added CSV downloads for the three profile/company exports, with UTF-8 BOM, CSV escaping and spreadsheet-formula protection. Anonymous exports contain selected masked fields only. SLA export failures no longer report success.
- Implemented Company Master edit and merge dialogs backed by update/merge endpoints.
- Corrected unresolved filters, skipped labels/actions, and stale SLA stats following mutations. Identified Profiles queue actions now persist through the API too.
- Translated shared filter labels and profile topbar titles for English locale.
- Removed fabricated KPI offsets and unsupported historical period controls; unavailable company metrics display a dash instead of sample numbers.
- Added URL encoding for profile API identifiers, including IP-cluster IDs containing slashes.
- Removed 23 obsolete debug/history/archive files (59,504,266 bytes). Existing requirement-document deletions were left untouched.

Verification: production build passed; 16 browser regression checks passed with controlled API fixtures, including 503/retry on all four pages, failed/successful SLA writes, skipped/unresolved behavior, company dialogs, failed company creation, and three CSV downloads. No uncaught browser errors. UTF-8 replacement-character scan passed. Backend authentication and live CRUD remain unverified; the existing large API Docs bundle warning remains.


## Scope and method

- Production build: `npm run build` passed (Vite warns that the API Docs JS chunk is approximately 1.3 MB minified).
- Headless Chrome against the local production preview.
- Smoke-tested `/`, `/projects`, `/tasks`, `/leads`, `/expense`, `/inventory`, `/data`, the four profile/SLA routes, an unknown project and an unknown route.
- Tested the four profile/SLA pages at 1440px and 390px viewport widths. No uncaught JavaScript errors on the tested routes; no document-level horizontal overflow on the four mobile pages.
- Used an isolated browser context with a placeholder local authentication token. All backend requests were intercepted and returned HTTP 503. No live backend data was changed.
- These are frontend/failure-path tests, not verification of real authentication, backend authorization or successful live CRUD. API Docs and all nested tabs/modal flows were not exhaustively tested.

## Confirmed in browser

### 1. High — Failed SLA writes are presented as successful

**Location:** `src/pages/SLAQueue.jsx:68-87`

**Reproduce:** Return HTTP 503 for backend requests, open `/sla-queue`, click Claim on a new item.

**Actual:** The item changes to Processing, the Claim button disappears, and the toast says "Item claimed and assigned." Claim button count changed from 5 to 4 despite the failed request. Refresh loses the change.

**Expected:** Show an error and preserve the previous state, or roll back an optimistic update.

**Cause:** The catch block ignores the error; state updates and the success toast execute unconditionally. The same handler also handles Resolve and Skip.

### 2. High — API failure silently exposes sample records as operational data

**Locations:** `src/pages/AnonymousProfiles.jsx:82-98`, `src/pages/IdentifiedProfiles.jsx:78-96`, `src/pages/CompanyMaster.jsx:34-48`, `src/pages/SLAQueue.jsx:38-59`

**Reproduce:** Return HTTP 503 for backend requests and load these pages.

**Actual:** Pages show sample profiles, leads, companies, queue entries and metrics without a demo/error indicator. Company Master shows 5 companies and SLA Queue shows 8 items. Actions remain available. Labels such as "Real-time Sync" and "Real-time Ingest" are still displayed.

**Expected:** Explicit loading/error/retry states. Seed data should only appear in an explicitly selected demo environment, not silently after production API failures.

### 3. Medium — Export controls report success without producing a file

**Locations:** `src/pages/CompanyMaster.jsx:169-172`, `src/pages/AnonymousProfiles.jsx:317`, `src/pages/IdentifiedProfiles.jsx:315`, `src/pages/SLAQueue.jsx:145-158`

**Reproduce:** Click Export in Company Master. Separately, fail the SLA export request and click Export in SLA Queue.

**Actual:** Chrome reports no download, but the UI says "Company list exported." / "Queue exported."

**Cause:** Company Master Export only calls the notification function. Anonymous and Identified exports also only notify (confirmed by source inspection). SLA Export suppresses exceptions and always announces success.

**Expected:** Implement the export/download and only announce success after it starts; show an error on failure.

### 4. Medium — Company Edit and Merge controls do not open their workflows

**Location:** `src/pages/CompanyMaster.jsx:348-352`

**Reproduce:** Open Company Master and click Edit or Merge in the selected company panel.

**Actual:** Only a success toast appears: "Opened company edit form." / "Opened merge flow." No editor, merge workflow or navigation opens.

**Cause:** Both onClick handlers only call `notify`.

**Expected:** Open the corresponding form/workflow or clearly disable unimplemented controls.

### 5. Medium — Unresolved filter excludes in-progress unresolved items

**Location:** `src/pages/SLAQueue.jsx:164-166`

**Reproduce:** With the initial eight queue items (five New, three Processing), click "Unresolved (8)".

**Actual:** The table shows only 5 / 8 items. All three Processing items are excluded although they are unresolved and included in the button count.

**Cause:** The button selects `new`, whereas the count uses `status !== 'done'`.

**Expected:** Filter all unresolved states consistently with the count.

### 6. Medium — Skipped queue entries are mislabeled New

**Location:** `src/pages/SLAQueue.jsx:72`, `src/pages/SLAQueue.jsx:210-212`

**Reproduce:** Open All items and click Skip on a new queue item.

**Actual:** The item still displays NEW, but its Claim button disappears. It has no dedicated Skipped tab/status filter and remains counted as unresolved.

**Cause:** The handler writes `status: 'skipped'`, but status rendering only recognizes `done` and `processing`, falling back to New for every other value. The tab/filter definitions omit skipped.

**Expected:** Define skipped semantics and use them consistently in badges, filters, actions and counts. This browser test also exercised the failed-write bug above.

### 7. Low — English locale leaves interface labels untranslated

**Locations:** `src/app/App.jsx:79-95`, `src/pages/SLAQueue.jsx:11-31`, filter option definitions in `src/pages/AnonymousProfiles.jsx`

**Reproduce:** Use English locale and open the profile or SLA pages.

**Actual:** The topbar still says "Hồ sơ ẩn danh", "Hồ sơ định danh" or "Hàng chờ SLA". SLA status/group options and anonymous-profile filters remain Vietnamese.

**Expected:** Translate interface labels using the active locale. User-entered record content need not be translated.

## Additional source-confirmed issues (not separately exercised in browser)

- `src/pages/CompanyMaster.jsx:96-134`: failed Create Company requests are swallowed, a company code is fabricated, the new company is added locally and success is reported. Similar unconditional success patterns appear in Anonymous Profiles conversion/site updates and Identified Profiles handover/save/merge handlers.
- `src/pages/AnonymousProfiles.jsx:533-534`: IP/company Confirm and Reject buttons in the profile detail panel only notify; they do not update state or call the existing API-backed handlers.
- `src/pages/SLAQueue.jsx:172-175`: after initial API stats are loaded, claim/resolve/skip update items but neither update nor refetch stats. KPI cards prefer the stale server stats over the updated local counts.

## Recommended order

1. Remove silent production mock fallbacks and false-success write behavior.
2. Implement export/edit/merge controls and enforce error reporting.
3. Align queue status/filter/count semantics and refresh statistics after mutations.
4. Complete translations and add automated interaction tests for success and failure paths.
