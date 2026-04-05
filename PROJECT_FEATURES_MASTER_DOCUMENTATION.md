# WAQT Attendance — Complete Project Feature Documentation (Functional + Non-Functional + Historical)

_Last generated from repository state on 2026-04-05 (workspace snapshot)._

---

## 1) Project Identity

- **Project name**: `restaurant-attendance`
- **Product identity in UI**: **WAQT Attendance**
- **Repository type**: Next.js full-stack web app (App Router) with server-side API routes + client-side dashboard/kiosk flows.
- **Core purpose**: Restaurant workforce attendance via QR-powered kiosk (check-in / check-out), with role-based administration, reports, exports, and brandable public QR pages.

Primary evidence:
- `/workspace/package.json`
- `/workspace/src/app/page.tsx`
- `/workspace/README.md`

---

## 2) Tech Stack and Runtime Foundations

## Frontend + framework
- Next.js `16.2.1` (App Router)
- React `19.2.4`
- Tailwind CSS v4
- shadcn/radix-style UI components

## Backend + data
- Next.js route handlers (`src/app/api/**/route.ts`)
- Prisma ORM (`@prisma/client` + Prisma CLI)
- PostgreSQL datasource

## Auth
- Auth.js / NextAuth v5 Credentials provider
- JWT session strategy (7-day max age)

## Integrations/libraries
- QR rendering: `qrcode`
- File storage option: `@vercel/blob` (fallbacks available)
- Google Sheets API: `googleapis`
- Geolocation/map UI: `leaflet`, `react-leaflet`
- Exports: `xlsx` (Excel), custom CSV generation

Primary evidence:
- `/workspace/package.json`
- `/workspace/prisma/schema.prisma`
- `/workspace/src/lib/auth.ts`

---

## 3) Application Architecture (High-Level)

## Runtime surface
- **Public pages**:
  - `/` marketing/landing
  - `/employee` staff QR scan/manual entry page
  - `/kiosk` attendance flow page (token or branchId bootstrap)
  - `/qr` public branch QR display page
- **Authenticated pages**:
  - `/login` credentials sign-in
  - `/dashboard` role-aware admin dashboard
  - `/admin` redirect entry to dashboard

## API surface
- Namespaced route handlers:
  - `/api/auth/*`
  - `/api/admin/*`
  - `/api/kiosk/*`
  - `/api/employee/*`

## Data model core entities
- `GlobalSettings`, `Company`, `Branch`, `BranchShift`, `User`, `Employee`, `KioskSession`, `Attendance`

## Authz model
- Roles: `MASTER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`
- Route-level authorization via helper functions (not middleware enforcement)

Primary evidence:
- `/workspace/src/app/**/page.tsx`
- `/workspace/src/app/api/**/route.ts`
- `/workspace/prisma/schema.prisma`
- `/workspace/src/lib/authz.ts`
- `/workspace/src/middleware.ts`

---

## 4) Roles, Access Control, and Identity Model

## Roles
- `MASTER_ADMIN`:
  - Full platform-level admin
  - Manage companies, branches, global QR branding
- `COMPANY_ADMIN`:
  - Company-scoped management
  - Manage employees, branch shifts, logs/hours, company QR logo, company sheet settings
- `EMPLOYEE`:
  - Employee account exists and can authenticate
  - Redirected to `/employee` flow from dashboard entry
  - Dedicated API endpoint to fetch own profile

## Authentication details
- Credentials login with email/password
- Two admin pathways:
  1. **Env-defined master admin** via `ADMIN_EMAIL` + (`ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD`)
  2. **Database users** via `User` table with bcrypt password hash
- JWT token/session includes:
  - `role`, `companyId`, `branchId`, `employeeId`, `id`, `email`, `name`

## Authorization behavior
- API helpers:
  - `requireUser()` → 401 if unauthenticated
  - `requireRoles([...])` → 403 if role mismatch
- Branch/shift scoped checks for company admins:
  - `assertBranchManage`
  - `assertShiftManage`

## Middleware
- Middleware currently pass-through (`NextResponse.next()`), no global route guard logic.
- Access protection implemented in route handlers and page redirects.

Primary evidence:
- `/workspace/src/lib/auth.ts`
- `/workspace/src/lib/authz.ts`
- `/workspace/src/lib/branch-access.ts`
- `/workspace/src/types/next-auth.d.ts`
- `/workspace/src/middleware.ts`

---

## 5) Data Model Documentation (Database-Level)

Source of truth: `/workspace/prisma/schema.prisma`

## Enums
- `UserRole`: `MASTER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`
- `EmployeeRole`: `DRIVER`, `DELIVERY_DRIVER`, `COFFEE_MAKER`, `CASHIER`, `WAITER`, `CHEF`, `CLEANER`, `OTHER`

## Models

### GlobalSettings
- Singleton row (`id = "singleton"`)
- Fields:
  - `qrLogoLeftUrl`
  - `qrLogoRightUrl`
  - `updatedAt`
- Purpose: global branding values for public QR page.

### Company
- Unique `name`
- Optional:
  - `qrCompanyLogoUrl`
  - `attendanceGoogleSpreadsheetId`
  - `attendanceGoogleSheetTabName`
- Relations: branches, users, employees, attendances.

### Branch
- Belongs to a company
- Geofence fields:
  - `latitude`, `longitude`, `radiusMeters` (default 100)
- Public kiosk session mirror:
  - `publicKioskToken`
  - `publicKioskExpiresAt`
- Unique `(companyId, name)`

### BranchShift
- Branch-local shift templates
- Fields:
  - `name`, `startTime`, `endTime`, `sortOrder`
- Time convention documented as local HH:MM.

### User
- Unique `email`
- `passwordHash`, `role`, `isActive`
- Optional `companyId`
- Optional one-to-one `employee`

### Employee
- One-to-one with `User` through `userId`
- Belongs to company and branch
- Attributes:
  - `employeeCode`, `name`, `nameNormalized`, `notes`, `role`, `isActive`
  - `shiftStartTime`, `shiftEndTime` (documented UTC clock HH:MM)
- Unique constraints:
  - `(companyId, nameNormalized)`
  - `(companyId, employeeCode)`

### KioskSession
- `tokenHash` unique (never storing hash and plaintext in same place)
- `expiresAt`, `revokedAt`
- Linked to branch and attendances

### Attendance
- Company, branch, employee, kiosk session linkage
- Punch times:
  - `checkInAt`
  - `checkOutAt` (nullable open shift)
- Selfies:
  - `checkInSelfieUrl`
  - `checkOutSelfieUrl`
- Coordinates:
  - `checkInLatitude`, `checkInLongitude`, `checkOutLatitude`, `checkOutLongitude`
- Shift-based computed fields:
  - `deductionHours` (default 0)
  - `overtimeHours` (default 0)

---

## 6) Functional Features (Exhaustive)

## 6.1 Public Landing and Entry

### Home page (`/`)
- Marketing-style intro for WAQT Attendance
- Describes key value points:
  - scan check-in
  - location-aware attendance
  - dashboards + exports
  - role-based access
- CTA links:
  - Staff → `/employee`
  - Admin sign-in → `/login`

Evidence:
- `/workspace/src/app/page.tsx`

---

## 6.2 Authentication and Session Lifecycle

### Login page (`/login`)
- Credential form (email/password)
- Uses `signIn("credentials")`
- Supports callback redirection
- Handles loading and error states

### Session behavior
- JWT strategy
- 7-day max age
- Custom role/company/branch/employee fields mapped onto token and session user

### Sign-out
- Dashboard header sign-out button calls NextAuth `signOut`

Evidence:
- `/workspace/src/app/login/page.tsx`
- `/workspace/src/lib/auth.ts`
- `/workspace/src/app/dashboard/dashboard-shell.tsx`

---

## 6.3 Role-Aware Dashboard Experience

### Dashboard route (`/dashboard`)
- If unauthenticated: redirect to login
- If role is employee: redirect to `/employee`
- Otherwise render `DashboardClient`

### Master admin tabs
- `Companies`
- `Branches`
- `QR page` (global WAQT logo)

### Company admin tabs
- `Workspace`
- `Shifts`
- `Hours`
- `Logs`

### Header
- Displays role/company context
- Company admin label dynamically fetched from company API

Evidence:
- `/workspace/src/app/dashboard/page.tsx`
- `/workspace/src/app/dashboard/dashboard-shell.tsx`
- `/workspace/src/app/dashboard/sections/master-admin-screen.tsx`
- `/workspace/src/app/dashboard/sections/company-admin-screen.tsx`

---

## 6.4 Company Management (Master Admin + Limited Company Admin)

### Capabilities
- List companies with branch/employee counts
- Create company (master only)
- Optional create initial company admin credential on company creation
- Update company fields
- Delete company (master only)

### Updatable fields (master admin)
- `name`
- company admin email/password
- `qrCompanyLogoUrl`
- `attendanceGoogleSpreadsheetId`
- `attendanceGoogleSheetTabName`

### Updatable fields (company admin)
- Restricted to:
  - `qrCompanyLogoUrl`
  - Google Sheets fields

### Company QR logo
- Upload endpoint for per-company QR page logo
- Also supports setting by direct URL

Evidence:
- `/workspace/src/app/api/admin/companies/route.ts`
- `/workspace/src/app/api/admin/companies/[id]/route.ts`
- `/workspace/src/app/api/admin/companies/[id]/qr-logo/upload/route.ts`
- `/workspace/src/app/dashboard/sections/companies-section.tsx`
- `/workspace/src/app/dashboard/sections/company-workspace-section.tsx`

---

## 6.5 Branch Management + Geofence

### Capabilities
- List branches
- Create branch (master only) with:
  - company assignment
  - geofence center (lat/lng)
  - radius meters
- Update branch (master only): name, geofence center/radius
- Delete branch (master only)

### UI geofence picker
- Interactive leaflet map
- Click/tap to set location
- Circle preview with radius

Evidence:
- `/workspace/src/app/api/admin/branches/route.ts`
- `/workspace/src/app/api/admin/branches/[id]/route.ts`
- `/workspace/src/app/dashboard/sections/branches-section.tsx`
- `/workspace/src/app/dashboard/branch-location-picker.tsx`

---

## 6.6 Employee Management

### Create employee
- Requires name, email, password (>=6), branch
- Optional:
  - employee code
  - notes
  - employee role enum
  - shift start/end (must both be set or both empty)
- Creation flow:
  1. create `User` with role EMPLOYEE + bcrypt hash
  2. create linked `Employee`

### List employee
- Includes branch info and user active status

### Update employee
- Supports name/email/password/branch/status/role/notes/employeeCode/shift times
- Company admin restricted to own company scope

### Delete employee
- Master admin only
- Deletes linked user record

### Name normalization
- Lowercase + trimmed + collapsed spaces used for uniqueness logic

Evidence:
- `/workspace/src/app/api/admin/employees/route.ts`
- `/workspace/src/app/api/admin/employees/[id]/route.ts`
- `/workspace/src/lib/employee-shift-input.ts`
- `/workspace/src/lib/normalize-name.ts`
- `/workspace/src/app/dashboard/sections/company-workspace-section.tsx`

---

## 6.7 Branch Shift Templates (Reference Schedule)

### Capabilities
- Create/list/update/delete `BranchShift` rows per branch
- Validates 24h HH:MM format
- Supports overnight shifts (`start > end`)
- Returns `crossesMidnight` derived flag

### UX note in product
- Explicitly described as planning/reference
- Does not block check-in when outside shift times

Evidence:
- `/workspace/src/app/api/admin/shifts/route.ts`
- `/workspace/src/app/api/admin/shifts/[id]/route.ts`
- `/workspace/src/lib/shift-time.ts`
- `/workspace/src/app/dashboard/sections/shifts-section.tsx`

---

## 6.8 Kiosk Session and QR Session Rotation

### Session generation
- Admin requests new kiosk session per branch
- Generates random 32-byte base64url token
- Stores SHA-256 hash in `KioskSession.tokenHash`
- Stores plaintext token + expiry on `Branch` for public QR page resolution

### TTL behavior
- Config: `KIOSK_SESSION_HOURS`
- Clamped to 1..2 hours

### Public branch QR model
- Stable public URL: `/qr?branchId={branchId}`
- Page resolves current active token for branch and renders QR for kiosk URL
- Auto-refreshes page every 45 seconds to reflect latest token

Evidence:
- `/workspace/src/app/api/admin/kiosk-session/route.ts`
- `/workspace/src/lib/kiosk-token.ts`
- `/workspace/src/lib/kiosk-session.ts`
- `/workspace/src/app/qr/page.tsx`
- `/workspace/src/app/qr/qr-auto-refresh.tsx`

---

## 6.9 Public QR Page and Branding

### Behavior
- Displays:
  - global WAQT logo (left tile)
  - per-company logo (right tile)
  - branch name
  - QR code for kiosk access
  - expiration timestamp (when token active)
- If no active kiosk token:
  - shows “No active kiosk session” instruction card
- Handles branch-not-found state
- Supports legacy token query mode for fallback compatibility

### Branding sources
- Global WAQT logo from `GlobalSettings`
- Company logo from `Company.qrCompanyLogoUrl`

### Global QR branding management
- Master admin can upload or set URL for WAQT logo (left slot)

Evidence:
- `/workspace/src/app/qr/page.tsx`
- `/workspace/src/lib/global-settings.ts`
- `/workspace/src/app/api/admin/qr-branding/route.ts`
- `/workspace/src/app/api/admin/qr-branding/upload/route.ts`
- `/workspace/src/app/dashboard/sections/qr-branding-section.tsx`

---

## 6.10 Employee Entry Flow (`/employee`)

### Capabilities
- QR scanner via `BarcodeDetector` + camera if supported
- Manual input fallback: accepts kiosk URL or raw token
- Extracts `token` from pasted URL and forwards to `/kiosk?token=...`

### Error handling
- Browser camera unsupported
- Barcode detector unsupported
- Permission failure
- Invalid manual input

Evidence:
- `/workspace/src/app/employee/page.tsx`

---

## 6.11 Kiosk Attendance Flow (`/kiosk`)

### Entry modes
1. `branchId` mode:
   - `KioskBootstrap` calls `/api/kiosk/resolve-token`
   - Polls every 45s for refreshed token
2. `token` mode:
   - Direct `KioskClient` flow

### Interactive flow steps
- loading
- employee/branch select
- camera selfie capture
- confirm
- success reset

### Decision logic
- User enters passcode
- `/api/kiosk/status` checks if employee has open shift in selected branch
- Determines next action:
  - open shift => check-out
  - no open shift => check-in

### Check-in behavior
- Requires selfie
- Stores check-in geolocation if available
- Rejects duplicate open shift

### Check-out behavior
- Requires selfie
- Updates latest open attendance
- Computes and stores:
  - `deductionHours` (early before scheduled shift start)
  - `overtimeHours` (late after scheduled shift end)

### Shared kiosk safety behavior
- After successful submit:
  - identity selection and passcode are cleared
  - flow resets for next employee
- Success now routes to `/kiosk/thank-you` with mode query (`checkin`/`checkout`) and uses history replacement to prevent normal browser-back return to scan/confirm steps.
- The thank-you route is implemented with a Suspense-wrapped client content block for `useSearchParams`, ensuring Next.js production builds do not fail on static prerender checks.

Evidence:
- `/workspace/src/app/kiosk/page.tsx`
- `/workspace/src/app/kiosk/kiosk-bootstrap.tsx`
- `/workspace/src/app/kiosk/kiosk-client.tsx`
- `/workspace/src/app/api/kiosk/status/route.ts`
- `/workspace/src/app/api/kiosk/check-in/route.ts`
- `/workspace/src/app/api/kiosk/check-out/route.ts`

---

## 6.12 Attendance Logs, Filters, Exports, and Google Sheets Sync

### Logs API and UI
- Filter dimensions:
  - from date
  - to date
  - branch
  - employee
- Returns normalized rows including:
  - gross hours
  - deduction
  - net
  - overtime
  - total
  - selfie URLs
  - location status and distance vs branch radius

### Location status calculation
- Branch has no geofence => “No branch geofence”
- No employee location => “No employee location”
- Haversine distance <= radius => “Matched”
- Else => “Outside branch radius”

### Export
- CSV and XLSX for logs
- Export excludes selfie URLs (`toAttendanceExportRow`)

### Google Sheets push
- Uses configured company spreadsheet ID + tab name
- Accepts raw spreadsheet ID or full spreadsheet URL
- Creates tab if missing
- Clears and fully replaces tab contents on each push
- Requires service account JSON env and spreadsheet sharing

Evidence:
- `/workspace/src/app/api/admin/attendance-logs/route.ts`
- `/workspace/src/app/api/admin/attendance-logs/google-sheets/route.ts`
- `/workspace/src/lib/attendance-logs-data.ts`
- `/workspace/src/lib/google-sheets.ts`
- `/workspace/src/app/dashboard/sections/logs-section.tsx`

---

## 6.13 Work Hours Reporting

### Modes
- Week mode (UTC Monday-start week)
- Month mode (UTC calendar month)

### Scope
- All branches in company
- Single branch

### Calculation model
- SQL computes only overlap of each attendance interval with selected period `[start, end)`
- Supports cross-boundary sessions (e.g., late-night shifts spanning periods)
- Applies prorated deduction/overtime when attendance partially overlaps report window
- Only closed shifts (`checkOutAt` set)

### Output
- JSON rows for UI
- CSV / XLSX export options

Evidence:
- `/workspace/src/app/api/admin/hours/route.ts`
- `/workspace/src/lib/time-ranges.ts`
- `/workspace/src/app/dashboard/sections/hours-section.tsx`

---

## 6.14 Employee-Specific API

### Endpoint
- `GET /api/employee/me`
- Role requirement: `EMPLOYEE`
- Returns basic employee profile + branch/company

Evidence:
- `/workspace/src/app/api/employee/me/route.ts`

---

## 7) API Endpoint Inventory (Complete)

## Authentication
- `GET/POST /api/auth/[...nextauth]`

## Employee
- `GET /api/employee/me`

## Kiosk
- `GET /api/kiosk/employees`
- `POST /api/kiosk/status`
- `POST /api/kiosk/check-in`
- `POST /api/kiosk/check-out`
- `GET /api/kiosk/resolve-token`

## Admin - core entities
- `GET/POST /api/admin/companies`
- `PATCH/DELETE /api/admin/companies/[id]`
- `POST /api/admin/companies/[id]/qr-logo/upload`
- `GET/POST /api/admin/branches`
- `PATCH/DELETE /api/admin/branches/[id]`
- `GET/POST /api/admin/employees`
- `PATCH/DELETE /api/admin/employees/[id]`
- `GET/POST /api/admin/shifts`
- `PATCH/DELETE /api/admin/shifts/[id]`

## Admin - operations and reporting
- `POST /api/admin/kiosk-session`
- `GET /api/admin/hours`
- `GET /api/admin/attendance-logs`
- `POST /api/admin/attendance-logs/google-sheets`

## Admin - branding
- `GET/PATCH /api/admin/qr-branding`
- `POST /api/admin/qr-branding/upload`

Evidence:
- `/workspace/src/app/api/**/route.ts`

---

## 8) Environment Variables and Configuration

Detected env usage in application code:

- `DATABASE_URL` (Prisma datasource)
- `AUTH_SECRET` (documented in README for auth setup)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_HASH`
- `KIOSK_SESSION_HOURS` (effective clamp 1..2)
- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `NEXT_PUBLIC_APP_URL`
- `NODE_ENV`
- `NEON_KEY` / `NEON_API_KEY` / `NEON_ORG_ID` (provision script)

Important operational observations:
- `README.md` references `.env.example`, but `.env.example` file is not present in this repository snapshot.
- Local docker compose supplies Postgres defaults (`app/app`, db `attendance`, host port `5433`).

Evidence:
- `/workspace/src/lib/*.ts`
- `/workspace/src/app/qr/page.tsx`
- `/workspace/src/app/dashboard/sections/company-workspace-section.tsx`
- `/workspace/scripts/provision-neon.mjs`
- `/workspace/README.md`
- `/workspace/docker-compose.yml`

---

## 9) Non-Functional Features and Engineering Characteristics

## 9.1 Security
- Credential auth with bcrypt password verification
- Route-level role and scope authorization patterns
- Kiosk token hashing with SHA-256 in session table
- Public token exposure acknowledged by design in `resolve-token` route comment
- `.env*` ignored by git policy (except template convention)
- No centralized middleware gate; security depends on per-route checks

Evidence:
- `/workspace/src/lib/auth.ts`
- `/workspace/src/lib/authz.ts`
- `/workspace/src/lib/kiosk-token.ts`
- `/workspace/src/app/api/kiosk/resolve-token/route.ts`
- `/workspace/.gitignore`

## 9.2 Reliability
- Transactional writes for critical paired updates (e.g., kiosk session + branch token)
- Consistent API error responses with status codes
- Defensive checks for invalid/missing payloads
- Cascade behaviors and constraints in Prisma schema

Evidence:
- `/workspace/src/app/api/admin/kiosk-session/route.ts`
- `/workspace/src/app/api/**/route.ts`
- `/workspace/prisma/schema.prisma`

## 9.3 Performance
- Prisma logging reduced in production
- QR page forced dynamic render (fresh token state)
- SQL-level aggregate logic for report computations (avoids heavy JS post-processing for totals)

Evidence:
- `/workspace/src/lib/prisma.ts`
- `/workspace/src/app/qr/page.tsx`
- `/workspace/src/app/api/admin/hours/route.ts`

## 9.4 Observability
- No structured logging/tracing/metrics framework detected
- Predominantly `console.error` based error output in API handlers

Evidence:
- `/workspace/src/app/api/**/route.ts`
- `/workspace/package.json`

## 9.5 Testing and QA posture
- No automated test scripts/configs found (`test` script absent)
- Lint configured with Next.js core-web-vitals + TypeScript rules
- TypeScript strict mode enabled

Evidence:
- `/workspace/package.json`
- `/workspace/eslint.config.mjs`
- `/workspace/tsconfig.json`

## 9.6 Accessibility
- Dashboard tablist semantics with ARIA states
- Inputs/labels and focus styles in UI components
- `lang="en"` and responsive viewport metadata in root layout

Evidence:
- `/workspace/src/app/dashboard/dashboard-shell.tsx`
- `/workspace/src/components/ui/*`
- `/workspace/src/app/layout.tsx`

## 9.7 Localization
- English-first implementation (no i18n framework)
- `lang="en"` fixed
- `rtl: false` in UI component config

Evidence:
- `/workspace/src/app/layout.tsx`
- `/workspace/components.json`

## 9.8 Deployment and operations
- README documents Vercel + Neon deployment flow
- Prisma migrations expected in deployment pipeline/manual run
- Local DB via docker compose
- No in-repo CI workflow files found

Evidence:
- `/workspace/README.md`
- `/workspace/docker-compose.yml`
- `/workspace/prisma/migrations/*`

---

## 10) File Storage Behavior (Selfies and Logos)

## Storage decision path
1. If `BLOB_READ_WRITE_TOKEN` exists:
   - Upload to Vercel Blob public URL
2. Else if production:
   - Store as data URL in DB (with size cap 2MB)
3. Else local dev:
   - Write files under `public/uploads/...`

Used for:
- Check-in selfies
- Check-out selfies
- QR branding images
- Company QR logos

Evidence:
- `/workspace/src/lib/upload-selfie.ts`
- `/workspace/src/lib/upload-qr-logo.ts`

---

## 11) Time and Attendance Computation Rules

## 11.1 Shift time normalization and validation
- Input format: 24h HH:MM
- Start and end cannot be identical
- Overnight supported (`start > end`)

Evidence:
- `/workspace/src/lib/shift-time.ts`

## 11.2 Employee shift-based deduction/OT at checkout
- Only computed when both employee shift times are present and valid
- Checkout computes:
  - deduction = punched time before scheduled shift start
  - overtime = punched time after scheduled shift end
- Uses UTC calendar basis

Evidence:
- `/workspace/src/lib/employee-shift-attendance.ts`
- `/workspace/src/app/api/kiosk/check-out/route.ts`

## 11.3 Logs and hours presentation
- Gross hours from check-in to check-out
- Net = gross - capped deduction
- Total = net + overtime
- Open shifts show null net/total until checkout

Evidence:
- `/workspace/src/lib/attendance-logs-data.ts`
- `/workspace/src/app/dashboard/sections/logs-section.tsx`

---

## 12) Historical Evolution — “Past to Now”

This section is derived from:
- Prisma migration chronology (`prisma/migrations`)
- Git commit history (`git log`) available in this repository snapshot

## 12.1 Schema/Migration timeline (ordered by migration directory timestamp)

1. `20260330120000_init`
   - Initial attendance entities: Employee, KioskSession, Attendance
2. `20260331070000_multi_tenant_employee_auth`
   - Multi-tenant model + auth users/roles, geo fields, employee auth links
3. `20260402012000_branch_public_kiosk_token`
   - Branch public kiosk token and expiry fields
4. `20260402120000_global_qr_logos`
   - Global QR branding settings
5. `20260402140000_company_qr_logo`
   - Per-company QR logo
6. `20260402160000_branch_shifts`
   - Branch shift templates
7. `20260403120000_attendance_deduction`
   - Attendance deduction hours field
8. `20260403140000_attendance_overtime`
   - Attendance overtime hours field
9. `20260403150000_company_google_sheet`
   - Company-level Google Sheet integration fields
10. `20260403160000_employee_shift_times`
   - Employee scheduled shift fields

Evidence:
- `/workspace/prisma/migrations/*/migration.sql`

## 12.2 Commit narrative timeline (newest first sample from current repository)

Notable observed commits include:
- QR page branding refinements and logo tile adjustments
- Major WAQT branding + landing + shifts/hours/logs/Sheets + shift OT/deduction implementation
- Migration from MUI to Tailwind/shadcn and responsive rework
- Stable branch public QR URL model with live token updates
- Kiosk branchId flow and checkout selfie support
- Multi-tenant attendance v2 and role-specific dashboard enhancements
- Initial Create Next App bootstrap

Sample references (commit hash | date | subject):
- `5ab513b | 2026-04-04 | QR page: drop inner squircle bg-white for transparent logos`
- `2918907 | 2026-04-03 | WAQT: branding, landing, QR logos, shifts, hours, logs, Sheets, shift-based OT/deduction, kiosk reset`
- `0c83fd5 | 2026-04-02 | Replace MUI with Tailwind and shadcn; split dashboard; responsive kiosk and auth`
- `f31d8ec | 2026-04-02 | Stable public QR URL per branch with live token updates.`
- `9a3119c | 2026-03-31 | Build WAQT multi-tenant attendance v2 with employee app flow.`
- `1bcb400 | 2026-03-30 | Initial commit from Create Next App`

---

## 13) Current Gaps / Ambiguities / Design Notes

1. **BranchShift vs employee shift operational link**
   - Branch shift templates are CRUD-managed and shown in UI.
   - Attendance deduction/OT currently uses employee shift fields, not branch shift records directly.

2. **Geofence enforcement model**
   - Geofence is captured and compared for reporting.
   - Check-in route does not block attendance outside radius (observability/reporting, not hard enforcement).

3. **No automated test suite in repo**
   - Increases regression risk despite strict TS and linting.

4. **No in-repo CI workflows detected**
   - Build/lint/migrations deployment guardrails may be external/manual.

5. **Missing `.env.example` file in current snapshot**
   - README references it, but file not present.

---

## 14) Directory and Responsibility Map

- `src/app/`
  - pages and route handlers
- `src/app/dashboard/`
  - role-specific admin interface sections
- `src/lib/`
  - business logic, auth, calculations, integrations
- `src/components/ui/`
  - reusable UI components
- `prisma/`
  - schema + migrations
- `scripts/`
  - operational/provisioning helper (Neon)
- `public/`
  - static assets + local upload targets in dev

---

## 15) Functional Checklist (Current State Snapshot)

- [x] Master admin login via env credentials
- [x] DB-backed company admin and employee login
- [x] Role-based dashboard tabs
- [x] Company CRUD (master scope)
- [x] Company admin credential management
- [x] Company QR logo management
- [x] Branch CRUD + geofence config (master scope)
- [x] Employee CRUD + role + scheduled shift fields
- [x] Branch shift template CRUD
- [x] Kiosk session generation and token hashing
- [x] Public branch QR page (stable URL)
- [x] Employee QR scanner/manual token entry
- [x] Kiosk check-in with selfie + geolocation
- [x] Kiosk check-out with selfie + deduction/overtime computation
- [x] Attendance logs with filters and location status
- [x] CSV/XLSX export for logs
- [x] CSV/XLSX export for hours
- [x] Google Sheets sync for logs
- [x] Global WAQT QR branding

---

## 16) Primary Source File Index

Core docs and config:
- `/workspace/README.md`
- `/workspace/package.json`
- `/workspace/tsconfig.json`
- `/workspace/eslint.config.mjs`
- `/workspace/next.config.ts`
- `/workspace/docker-compose.yml`

Data and auth:
- `/workspace/prisma/schema.prisma`
- `/workspace/src/lib/auth.ts`
- `/workspace/src/lib/authz.ts`
- `/workspace/src/types/next-auth.d.ts`

Domain logic:
- `/workspace/src/lib/kiosk-session.ts`
- `/workspace/src/lib/kiosk-token.ts`
- `/workspace/src/lib/attendance-logs-data.ts`
- `/workspace/src/lib/employee-shift-attendance.ts`
- `/workspace/src/lib/shift-time.ts`
- `/workspace/src/lib/google-sheets.ts`
- `/workspace/src/lib/upload-selfie.ts`
- `/workspace/src/lib/upload-qr-logo.ts`

UI + APIs:
- `/workspace/src/app/page.tsx`
- `/workspace/src/app/login/page.tsx`
- `/workspace/src/app/employee/page.tsx`
- `/workspace/src/app/kiosk/*`
- `/workspace/src/app/qr/*`
- `/workspace/src/app/dashboard/*`
- `/workspace/src/app/api/**/route.ts`

History:
- `/workspace/prisma/migrations/*/migration.sql`
- Git commit history (`git log`) from current repository state

---

## 17) Scope and Accuracy Note

This document is a repository-derived, evidence-backed snapshot of current behavior and historical artifacts available in this codebase.  
If external systems or undocumented operational practices exist outside this repository, they are not represented here unless referenced by in-repo files.

