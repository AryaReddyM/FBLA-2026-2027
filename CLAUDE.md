# CLAUDE.md

This file is the source of truth for building this project. Read it fully at the start of every session. If something here conflicts with a request in chat, ask before deviating.

## 1. Project Summary

**What:** A web-based inventory management platform for K-12 schools and districts. It tracks physical assets (Chromebooks, textbooks, desks, projectors) and digital assets (e-books, software licenses, online subscriptions).

**Who it's for:**
- School administrators and IT coordinators who manage Chromebooks, licenses, and subscriptions
- Teachers who track classroom assets like desks and textbooks

**Why:** Schools often track inventory on paper and then retype it into spreadsheets. That causes duplicated records, outdated data, slow searches, and painful annual reports. This platform replaces that with one central, searchable, collaborative system.

**Context:** This is an FBLA Website Coding & Development entry (team of 3). The annual-topic connection is *digital resource management*: managing large amounts of data about physical and digital resources in education, where collaboration between staff matters.

**Working name:** `EduTrack` (placeholder). Keep the name in one constant (`src/lib/config.ts`) so the team can rename it in one place.

## 2. Research Basis

The design is based on this paper. Cite it on the `/about` page in APA format:

> Ramos-Miller, M., & Pacheco, A. (2023). Towards inventory control excellence: An innovative approach based on a web-based platform. *F1000Research, 12*, 1471. https://doi.org/10.12688/f1000research.140745.2

The paper built a Laravel 9 + Vue 3 system for a public school in Peru and reported these improvements after deployment:

| Dimension | Improvement reported |
|---|---|
| Goods search efficiency | 85.51% |
| Goods registration | 90.31% |
| Annual goods report generation | 83.11% |
| Overall inventory process | 86.31% |

Our job is to rebuild the same core system with a modern stack, adapted to US schools, and to go further where the paper's own conclusions point (QR/barcode scanning, digital assets).

### Paper feature → our implementation

| Paper (2023) | This project |
|---|---|
| Laravel 9 / PHP 8.1 backend | Next.js App Router: Server Components, Server Actions, Route Handlers |
| Vue 3 frontend | React 19 + TypeScript (strict) |
| MySQL-style relational DB on a self-hosted server | Supabase (managed cloud Postgres) |
| `laravel/sanctum` API auth | Supabase Auth + Postgres Row Level Security (RLS) |
| `laravel-dompdf` PDF reports | `@react-pdf/renderer` in a Node route handler |
| `maatwebsite/excel` Excel export | `exceljs` (XLSX) plus plain CSV |
| Search by name, category, location, status | Postgres full-text + `pg_trgm` fuzzy search with filters |
| Dashboard stats ("goods by acquisition date") | Dashboard charts (Recharts via shadcn/ui charts) |
| Reports per inventory area or all areas | Annual Inventory Report by location or all locations |
| Admin and manager roles | Admin, Manager, Staff, Viewer roles enforced by RLS |
| Customizable categories and workflows | Admin-editable categories, locations, custom fields, tag format |
| Future work: QR/barcode | QR labels + camera scanning, built in from the start |
| Physical goods only | Physical **and** digital assets (licenses, seats, renewals) |

## 3. Tech Stack

Use the latest stable versions at setup time. Verify with the package docs before assuming APIs; do not rely on memory for version-specific behavior.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable, App Router) | Follow current conventions (for example, Next 16 renamed `middleware.ts` to `proxy.ts`) |
| Language | TypeScript, `strict: true` | No `any`. No `@ts-ignore` without a comment explaining why |
| Styling | Tailwind CSS (v4) + shadcn/ui | Radix primitives give accessible components out of the box |
| Database | Supabase Postgres | Cloud hosted; local stack via Supabase CLI + Docker |
| Auth | Supabase Auth via `@supabase/ssr` | Email/password + magic link. Google OAuth is a stretch goal |
| Authorization | Postgres RLS on every table | The UI hides actions too, but RLS is the real enforcement |
| File storage | Supabase Storage | Asset photos, generated report files |
| Validation | Zod | One schema per form, shared by client and server |
| Forms | react-hook-form + `@hookform/resolvers/zod` | |
| Tables | TanStack Table | Server-side pagination, sort, filter |
| Charts | Recharts (shadcn/ui chart wrappers) | |
| PDF | `@react-pdf/renderer` | Runs in a Node-runtime route handler |
| Excel | `exceljs` | |
| QR codes | `qrcode` (generate), `@zxing/browser` (scan with camera) | |
| Dates | `date-fns` | |
| Icons | `lucide-react` | |
| Unit tests | Vitest + React Testing Library | |
| E2E tests | Playwright + `@axe-core/playwright` | Accessibility checks run in E2E |
| Lint/format | ESLint (Next config) + Prettier | |
| Hosting | Vercel | Supabase cloud project for production |

Do not add other dependencies without asking first. Prefer the platform (Postgres functions, Server Actions) over new libraries.

## 4. Commands

```bash
npm run dev            # start Next.js dev server
npm run build          # production build (must pass before any milestone is "done")
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest
npm run test:e2e       # Playwright (includes axe accessibility scans)

npx supabase start     # local Supabase stack (Docker)
npx supabase db reset  # re-run migrations + seed locally
npx supabase migration new <name>
npx supabase gen types typescript --local > src/types/database.ts
```

Add `typecheck`, `test`, `test:e2e`, and `db:types` scripts to `package.json` during setup.

## 5. Folder Structure

```
src/
  app/
    (auth)/login/page.tsx
    (app)/layout.tsx              # sidebar + top bar + search, requires auth
    (app)/page.tsx                # Dashboard
    (app)/inventory/page.tsx      # Catalog
    (app)/inventory/new/page.tsx  # Register item
    (app)/inventory/[id]/page.tsx # Item detail + history
    (app)/circulation/page.tsx    # Check-in / check-out desk
    (app)/licenses/page.tsx       # Digital assets, seats, renewals
    (app)/reports/page.tsx        # Report builder + history
    (app)/settings/...            # categories, locations, users, custom fields, import
    (app)/help/page.tsx
    about/page.tsx                # public: project info, research citation, credits
    api/reports/[type]/route.ts   # PDF/XLSX/CSV generation (runtime = "nodejs")
  components/
    ui/                           # shadcn/ui generated components
    inventory/ dashboard/ circulation/ reports/ layout/ a11y/
  lib/
    supabase/server.ts client.ts  # @supabase/ssr helpers
    actions/                      # Server Actions, one file per domain
    validation/                   # Zod schemas
    queries/                      # read helpers used by Server Components
    config.ts                     # app name, tag prefix defaults, constants
    permissions.ts                # role → allowed actions map (UI only)
  types/database.ts               # generated Supabase types, never hand-edit
supabase/
  migrations/                     # SQL migrations, one concern per file
  seed.sql                        # or seed script, see section 11
tests/
  unit/ e2e/
```

## 6. Data Model

All tables live in `public`, have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger-maintained), and **RLS enabled**.

### Enums
- `user_role`: `admin`, `manager`, `staff`, `viewer`
- `asset_kind`: `physical`, `digital`
- `asset_status`: `available`, `checked_out`, `in_repair`, `retired`, `lost`
- `asset_condition`: `new`, `good`, `fair`, `poor`, `broken`
- `borrower_type`: `student`, `staff`, `classroom`

### Tables

**profiles** (1:1 with `auth.users`)
- `id` (FK to `auth.users.id`), `full_name`, `email`, `role user_role default 'staff'`, `department`, `is_active`

**institution_settings** (single row)
- `name`, `logo_path`, `fiscal_year_start_month` (default 7 for July), `asset_tag_prefix` (default `EDU`), `default_loan_days`, `depreciation_method` (`straight_line`)

**categories**
- `name`, `kind asset_kind`, `parent_id` (nullable, for subcategories), `useful_life_years` (default for depreciation), `custom_field_schema jsonb` (admin-defined extra fields, e.g. "ISBN" for textbooks, "MAC address" for Chromebooks)

**locations** ("inventory areas" in the paper)
- `name`, `building`, `room`, `type` (classroom, library, office, storage, lab), `manager_id` (FK profiles, nullable)

**assets**
- `asset_tag` text **unique not null** (auto-generated `PREFIX-YYYY-000123`, editable by admins)
- `name`, `description`, `kind asset_kind`, `category_id`, `location_id` (nullable for digital)
- `status asset_status default 'available'`, `condition asset_condition`
- `serial_number` (unique when not null), `manufacturer`, `model`
- `acquisition_date`, `acquisition_cost numeric(12,2)`, `funding_source` (e.g. Title I, ESSER, PTA, general fund), `vendor`
- `custom_fields jsonb`, `image_path`, `notes`
- `search_vector tsvector` (generated from tag, name, description, serial, model)
- `created_by`, `retired_at`, `deleted_at` (soft delete only)

**digital_licenses** (extends a digital asset, 1:1)
- `asset_id` PK/FK, `seats_total int` (null = unlimited/site license), `license_type` (per-seat, site, subscription), `billing_cycle`, `cost_per_period`, `renewal_date`, `expires_at`, `platform_url`, `admin_contact`
- Never store license keys or passwords in plain text. Store only a masked hint (last 4 characters) if anything.

**checkouts** (physical loans and digital seat assignments)
- `asset_id`, `borrower_type`, `borrower_name`, `borrower_ref` (student ID number or staff email; see privacy rules)
- `checked_out_by` (FK profiles), `checked_out_at`, `due_at`, `returned_at`, `returned_to`, `condition_out`, `condition_in`, `notes`
- Partial unique index: one open checkout per **physical** asset (`where returned_at is null`)
- Digital: count of open checkouts must not exceed `seats_total` (enforced in the RPC below)

**audit_log** (append-only)
- `actor_id`, `action` (create, update, retire, delete, check_out, check_in, import, report_generated), `entity`, `entity_id`, `changes jsonb` (before/after), `created_at`
- Written by Postgres triggers, not app code, so nothing can skip it. No update/delete policies.

**report_runs**
- `report_type`, `params jsonb`, `format` (pdf, xlsx, csv), `file_path` (Storage), `generated_by`, `row_count`, `duration_ms`

### Postgres functions (call via `supabase.rpc`)
- `check_out_asset(asset_id, borrower_type, borrower_name, borrower_ref, due_at)`: runs in one transaction, locks the asset row, validates status/seat count, inserts checkout, updates status.
- `check_in_asset(checkout_id, condition_in, notes)`: closes the checkout, sets status back to `available` (or `in_repair` if condition is `broken`).
- `next_asset_tag()`: returns the next tag using the settings prefix and current year.
- `search_assets(q, filters jsonb, page, page_size)`: full-text + trigram search, returns rows + total count.
- `current_user_role()`: `security definer` helper used inside RLS policies.

Enable extensions: `pg_trgm`, `unaccent`.

## 7. Roles and Permissions

| Action | Admin | Manager | Staff (teacher) | Viewer |
|---|:-:|:-:|:-:|:-:|
| View catalog, dashboard, item details | ✓ | ✓ | ✓ | ✓ |
| Check out / check in | ✓ | ✓ | ✓ | |
| Register, edit assets | ✓ | ✓ | | |
| Retire / mark lost | ✓ | ✓ | | |
| Generate and export reports | ✓ | ✓ | own checkouts only | |
| Import CSV | ✓ | ✓ | | |
| Manage categories, locations, custom fields | ✓ | | | |
| Manage users and roles, institution settings | ✓ | | | |
| View audit log | ✓ | ✓ | | |

Rules:
- RLS policies implement this table. `src/lib/permissions.ts` mirrors it only to hide buttons in the UI.
- Every Server Action re-checks the session and validates input with Zod before touching the DB.
- New sign-ups default to `staff`. Only admins change roles. The first user created by the seed script is the admin.

## 8. Features and Pages

Build in the order of section 10. Each feature lists what "done" means.

### 8.1 Dashboard (`/`)
The landing page after login. It is the "central base" described in the project scope.
- **Global search bar** at the top (also opens with `Ctrl/Cmd + K`). Debounced (250 ms), searches tag, name, serial, model, description. Results show tag, name, status badge, location. Enter goes to the catalog with the query applied.
- **KPI cards:** total assets, checked out now, overdue, licenses expiring in the next 30 days, total asset value.
- **Charts:** assets by category, assets by acquisition year (the paper's "goods by acquisition date" report), status breakdown, checkouts per month this school year.
- **Recent activity:** last 10 audit log entries in plain language ("Ms. Lee checked out Chromebook EDU-2026-000412 to Student #10234").
- **Quick actions:** Register item, Check out, Scan QR, Generate annual report.

### 8.2 Catalog (`/inventory`)
- Server-paginated table: tag, name, kind, category, location, status, condition, assigned to.
- Filters: kind, category, location, status, condition, acquisition year, funding source. Filters live in URL search params so views are shareable and bookmarkable.
- Sort by any column. Bulk select for: move location, change status, print QR labels, export selection.
- Empty, loading (skeleton), and error states for every view.

### 8.3 Register item (`/inventory/new`)
Registration speed and accuracy was the paper's biggest win (90.31%), so make this fast and hard to get wrong.
- Choose physical or digital first; the form adapts (digital shows seats, renewal date, billing cycle).
- Asset tag pre-filled from `next_asset_tag()`. Option to scan an existing barcode/QR instead.
- **Duplicate detection:** before saving, check exact serial match and fuzzy name+model match (`pg_trgm` similarity > 0.6). Show "Possible duplicate" with a link instead of silently saving.
- Category custom fields render dynamically from `custom_field_schema`.
- "Save and add another" keeps category/location/vendor for batch entry (e.g. 30 Chromebooks from one order).
- Optional photo upload to Supabase Storage (compress client-side, max 2 MB).

### 8.4 Item detail (`/inventory/[id]`)
- All fields, current status and holder, QR code, "Print label" (printable sheet sized for standard address labels).
- Timeline of every checkout and change from `audit_log`.
- Actions by role: edit, check out/in, move, retire, mark lost.
- Depreciation panel for physical assets: straight-line current book value from cost, acquisition date, and category useful life.

### 8.5 Circulation desk (`/circulation`)
The check-in/check-out catalog from the slides.
- Two big modes: **Check out** and **Check in**. Input accepts typed tag, search, or camera QR scan.
- Check out: pick borrower type, enter borrower, due date defaults from settings. Calls `check_out_asset` RPC.
- Check in: condition dropdown, notes. Calls `check_in_asset` RPC.
- Lists: currently checked out, overdue (highlighted with icon + text, not color only), due this week.

### 8.6 Digital assets (`/licenses`)
- Table of licenses and subscriptions with seat usage bar ("142 / 200 seats"), renewal date, annual cost.
- Renewal calendar view for the next 12 months.
- Assign/unassign seats (uses the same checkout RPCs).
- Alerts on the dashboard at 60 and 30 days before renewal.

### 8.7 Reports (`/reports`)
Report generation was the paper's third headline result (83.11%). The paper's version followed Peruvian SBN government rules; ours is a US-style annual inventory and audit report.

Report types:
1. **Annual Inventory Report**: by one location or all locations, grouped by location then category, with counts, condition, and value totals. Header with institution name, fiscal year, generated date, generated by.
2. **Checkout Activity**: loans in a date range, overdue items, lost items.
3. **Asset Valuation & Depreciation**: cost, accumulated depreciation, book value by category.
4. **Digital License Summary**: seats used vs. purchased, cost per used seat, upcoming renewals.
5. **Audit Trail Export**: filtered audit log (admin/manager only).

Each report: preview in-page as a table, then export to **PDF**, **XLSX**, or **CSV**. Store every run in `report_runs` + Storage so past reports can be re-downloaded. Show generation time on screen (useful for the presentation, see 8.10).

### 8.8 Settings (`/settings/*`, admin)
- Categories (with custom field builder: text, number, date, select), locations, users and roles, institution profile, asset tag prefix, default loan length, fiscal year start.
- **CSV import:** upload, map columns, preview with row-level validation errors and duplicate flags, then confirm. Never partially import silently; show a summary of created/skipped rows.

### 8.9 Help and About
- `/help`: short task-based guides (register an item, check out, run the annual report) with screenshots added later by the team.
- `/about` (public): project purpose, research citation from section 2, team credits, list of libraries/frameworks used with links (FBLA judges may ask what is original vs. third-party).

### 8.10 Efficiency metrics (stretch, but valuable for judging)
The paper measured time to search, register, and report. Log `duration_ms` for searches, registrations (form open to save), and report generation, and show averages on an admin-only "Impact" card. This lets the team demonstrate measurable efficiency the same way the paper did.

## 9. Accessibility and Responsiveness (required, from the project slides)

Target **WCAG 2.2 AA**. This is a judged part of the project, not polish.
- **Color:** high-contrast palette that also works for colorblind users. Status is never shown by color alone; every status badge has an icon and text. Check contrast ratios (4.5:1 text, 3:1 UI).
- **Text size control:** an accessibility menu in the top bar with text size (100%, 115%, 130%, 150%) and a high-contrast theme toggle, plus light/dark mode. Persist the choice in `localStorage` and a cookie (to avoid flashing on load). Implement by scaling the root font size; all sizing uses `rem`.
- **Fluid layout:** works from 320 px phones to large monitors. Sidebar collapses to a drawer on small screens. Tables become stacked cards below `md`. No horizontal page scroll; wide tables scroll inside their own container.
- **Keyboard:** everything reachable and operable by keyboard, visible focus rings, "Skip to content" link, logical tab order, `Esc` closes dialogs.
- **Screen readers:** semantic landmarks, labeled form fields, `aria-live` region for toasts and search result counts, alt text on images, charts have a "View as table" toggle.
- **Motion:** respect `prefers-reduced-motion`.
- Playwright + axe runs on every main page and must report zero serious/critical violations.

## 10. Build Plan (milestones)

Mirror the paper's five phases (analysis, planning, implementation, review, deployment). Analysis and planning are this file. Implementation follows these milestones. Finish each one completely (build, lint, typecheck, tests pass) before starting the next, and summarize what changed at the end of each.

| # | Milestone | Done when |
|---|---|---|
| M0 | Project setup | Next.js + TS + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright installed; local Supabase runs; CI-style `npm run build && npm run lint && npm run typecheck` passes |
| M1 | Schema, RLS, auth | All migrations from section 6; RLS policies for section 7; login/logout; profile auto-created on sign-up; generated types; RLS tests prove a `staff` user cannot insert assets |
| M2 | Layout + accessibility shell | App shell (sidebar, top bar, search slot, a11y menu, theme), responsive drawer, skip link; axe passes on empty shell |
| M3 | Catalog + register + detail | 8.2, 8.3, 8.4 working with seed data, duplicate detection, QR display/print |
| M4 | Search + dashboard | `search_assets` RPC, command palette, KPI cards, charts with table fallback |
| M5 | Circulation + licenses | 8.5, 8.6 with RPCs; concurrency safe (two users can't check out the same item) |
| M6 | Reports + exports | All 5 reports in PDF/XLSX/CSV, report history |
| M7 | Settings + CSV import | 8.8 complete |
| M8 | Review | Full E2E suite, axe on all pages, Lighthouse ≥ 90 on Performance/Accessibility/Best Practices, fix all findings (this is the paper's "review" phase: check functionality, security, reporting) |
| M9 | Deploy | Vercel + Supabase cloud project, env vars set, production seed with demo data, README with setup steps |

Stretch (only after M9): efficiency metrics card (8.10), email reminders for overdue items and renewals (Vercel Cron + Resend), Google sign-in, PWA install for the circulation desk on tablets.

## 11. Seed and Demo Data

- Generate realistic **fictional** data for a US high school: ~300 assets.
  - Physical: Chromebooks (several models, carts by room), textbooks (multiple copies per title with ISBN custom field), desks/chairs, projectors, document cameras, calculators, lab equipment, robotics kits.
  - Digital: Google Workspace for Education, Canva for Education, Adobe Express, an e-book collection, a typing program, a math practice subscription, etc. Use made-up vendor contract numbers and costs.
  - 10 to 15 locations (rooms, library, media center, storage, IT office).
  - ~150 checkouts across the school year, some overdue, some returned damaged.
- Demo accounts, one per role, with passwords set from env vars (never commit real passwords): `admin@demo.edutrack.test`, `manager@...`, `teacher@...`, `viewer@...`.
- A `Reset demo data` button for admins in non-production environments, and `npx supabase db reset` locally.
- The FBLA presentation venue may have bad Wi-Fi. The full app must run on the local Supabase stack with no internet so the team can demo offline.

## 12. Privacy and Security Rules

- Student data: store the minimum needed to return an item (name and/or school ID number). No birthdates, addresses, grades, or photos of students. Mention FERPA-minded design on the `/about` page.
- Seed data must be fictional. Never use real student or staff names.
- The Supabase service role / secret key is used **only** in server code (seed scripts, admin-only route handlers). Never import it in a client component; never prefix it with `NEXT_PUBLIC_`.
- Every table has RLS enabled. A migration that adds a table without policies is a bug.
- Validate and sanitize all input with Zod on the server. Use parameterized queries only (supabase-js / RPC); no string-built SQL.
- Uploads: check MIME type and size server-side; images only for asset photos.
- Soft-delete assets (`deleted_at`) so history and reports stay accurate.

## 13. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # or publishable key, per current Supabase docs
SUPABASE_SERVICE_ROLE_KEY=            # server only
DEMO_ADMIN_PASSWORD=
DEMO_USER_PASSWORD=
```

Keep `.env.example` up to date. Never commit `.env.local`.

## 14. Code Conventions

- Server Components by default. Add `"use client"` only for interactivity (forms, charts, scanner, command palette).
- Mutations go through Server Actions in `src/lib/actions/`, return a typed `{ ok: true, data } | { ok: false, error }` result, and call `revalidatePath` for affected pages.
- Multi-step DB changes (checkout, check-in, import) happen inside Postgres functions so they are atomic.
- Use generated `Database` types for every Supabase call. Regenerate after every migration.
- Components: small, named exports, colocated with their feature folder. shadcn/ui components stay in `components/ui` and are customized there.
- Naming: `kebab-case` files, `PascalCase` components, `camelCase` functions, `snake_case` DB columns.
- User-facing copy: plain, friendly, school-appropriate. Dates as `Oct 25, 2026`. Money as USD.
- Write tests alongside features: unit tests for validation, depreciation math, tag generation, permission map; E2E tests for login, register item, check out/in, generate report.
- Do not leave TODOs without a matching item in `PROGRESS.md`.

## 15. Working Agreement for Claude Code

- Keep a `PROGRESS.md` at the repo root: current milestone, what's done, what's next, known issues. Update it at the end of every session.
- Before a large change (new table, new dependency, changing auth), state the plan in 3 to 5 bullets and wait for approval.
- After each milestone, run `npm run build && npm run lint && npm run typecheck && npm run test` and report results honestly, including failures.
- One student on the team writes most of the code and will be asked by judges how it works. Add short comments explaining *why* (not *what*) in non-obvious places: RLS policies, RPC functions, search ranking, depreciation math. Prefer clear code over clever code.
- If anything in this file seems wrong or outdated (for example, a library API changed), say so and propose a fix instead of working around it silently.