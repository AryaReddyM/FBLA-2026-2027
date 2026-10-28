# EduTrack

A web-based inventory platform for K-12 schools and districts. It tracks **physical assets** (Chromebooks, textbooks, desks, projectors) and **digital assets** (software licenses, e-books, subscriptions) in one shared, searchable system that works on any device.

Built for the FBLA Website Coding & Development event (2026–2027). The design follows Ramos-Miller & Pacheco (2023), *Towards inventory control excellence: An innovative approach based on a web-based platform*, F1000Research 12:1471 ([doi](https://doi.org/10.12688/f1000research.140745.2)). See `/about` in the app.

## Features

- **Dashboard**: KPI cards, four charts (each with a table view), renewal alerts, recent activity, and an admin-only Impact card that measures search, registration and report times.
- **Catalog**: server-side search (full-text + fuzzy), filters stored in the URL, sorting, bulk move/status/QR labels/CSV export, phone-friendly cards.
- **Register items**: physical or digital, auto-generated asset tags, barcode/QR scanning, duplicate detection, category custom fields, "Save and add another" for batches, photo upload.
- **Item detail**: full history timeline, QR code + printable labels (Avery 5160), straight-line depreciation, seat management for licenses.
- **Circulation desk**: check out / check in by typing, USB scanner or tablet camera. Overdue items flagged with icon + text. Concurrency-safe in the database.
- **Digital licenses**: seat usage, cost per used seat, 12-month renewal calendar.
- **Reports**: Annual Inventory, Checkout Activity, Valuation & Depreciation, License Summary, Audit Trail. Preview on screen, export **PDF / Excel / CSV**, every export saved to history.
- **Settings**: institution, categories (custom field builder), locations, users & roles, CSV import with validation preview, demo data reset.
- **Accessibility**: WCAG 2.2 AA target, text size 100–150%, high-contrast theme, dark mode, skip link, full keyboard support, axe checks in E2E tests.
- **Security**: Supabase Auth, Row Level Security on every table, append-only audit log written by database triggers.

## Tech stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui (Radix) · Supabase (Postgres, Auth, Storage) · Zod · React Hook Form · TanStack Table · Recharts · @react-pdf/renderer · ExcelJS · qrcode · @zxing/browser · Vitest · Playwright + axe.

## Setup (cloud, works on every device)

You need Node.js 22+ and a free [Supabase](https://supabase.com) account.

1. **Install**: `npm install`
2. **Create a Supabase project** at supabase.com (pick a strong database password and save it).
3. **Fill in `.env.local`** (copy `.env.example` if it doesn't exist):
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`): the **Connect** button, or Project Settings → API Keys. (Older projects can use the `anon` key under `NEXT_PUBLIC_SUPABASE_ANON_KEY`.)
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API Keys → **Secret keys** (`sb_secret_…`), or the legacy `service_role` key. **Server only.**
   - `SUPABASE_DB_URL`: **Connect** → *Session pooler* connection string, with your database password filled in.
   - `DEMO_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`: passwords for the demo accounts (8+ characters).
4. **Create the database and demo data**: `npm run setup`
   (runs `db:push`, which applies `supabase/migrations`, then `db:seed`, which creates the demo accounts and ~300 fictional items).
5. **Auth URLs** (Supabase → Authentication → URL Configuration): set *Site URL* to your deployed URL (or `http://localhost:3000`) and add `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**` to *Redirect URLs*. This makes email links (magic link, password reset) come back to the app.
6. **Run it**: `npm run dev` and open http://localhost:3000.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.edutrack.test` | `DEMO_ADMIN_PASSWORD` |
| Manager | `manager@demo.edutrack.test` | `DEMO_USER_PASSWORD` |
| Staff (teacher) | `teacher@demo.edutrack.test` | `DEMO_USER_PASSWORD` |
| Viewer | `viewer@demo.edutrack.test` | `DEMO_USER_PASSWORD` |

### Adding real people

- **Recommended:** an admin adds them in **Settings → Users & roles** with a starting password. They can sign in immediately on any device.
- **Self sign-up** (`/signup`) also works and starts people as Staff. Supabase's built-in email service only delivers to your project's team members and is rate-limited, so either set up custom SMTP (Authentication → Emails) or turn off *Confirm email* (Authentication → Sign In / Providers → Email) for the demo.
- The first account ever created in a fresh project automatically becomes the admin.

## Two projects: FBLA demo and your real school

EduTrack runs against two separate Supabase projects, so the fictional demo
data and a real school's inventory never mix:

| | Demo (FBLA judging) | Real school |
|---|---|---|
| Settings file | `.env.local` | `.env.school.local` |
| Run it | `npm run dev` → http://localhost:3000 | `npm run dev:school` → http://localhost:3001 |
| Set up the database | `npm run setup` (schema + fictional data) | `npm run school:setup` (schema + your admin account + starter categories, **no items**) |
| Demo features | On (`DEMO_MODE=true`): "Reset demo data", demo logins on the sign-in page, `npm run db:seed` | Off: those features are hidden and the seed script refuses to run |

The demo shows a **Demo data** label in the top bar so it's always clear which one you're in.

To set up the real school project:

1. Create a **second** Supabase project (a free account allows two).
2. Fill in `.env.school.local` the same way as `.env.local` (URL, publishable key, secret key, session pooler string), plus `SCHOOL_ADMIN_PASSWORD` and `SCHOOL_NAME`.
3. `npm run school:setup`
4. In that project's Authentication → URL Configuration, add `http://localhost:3001/**` to Redirect URLs.
5. `npm run dev:school` and sign in with `SCHOOL_ADMIN_EMAIL`.

For production builds of the school version: `npm run build:school && npm run start:school` (built into `.next-school`).

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` for QR labels). Add `DEMO_MODE=true` **only** on the demo deployment.
   To host both, create two Vercel projects from the same repo, one with the demo project's keys and one with the school's.
3. Add the Vercel URL to Supabase's Auth redirect URLs (step 5 above).

Camera scanning needs HTTPS, so phones and tablets should use the deployed site (on a laptop, `localhost` and USB barcode scanners work too).

## Offline demo (local Supabase)

For a venue with bad Wi-Fi, run everything locally. This needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL 2 on Windows):

```bash
npx supabase start          # prints a local URL, anon key and service_role key
# put those into .env.local (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, ...)
npx supabase db reset       # applies migrations
npm run db:seed             # demo accounts + data
npm run build && npm start
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test` | Unit tests + live Row Level Security tests (Vitest; the RLS tests skip if `.env.local` is empty) |
| `npm run test:e2e` | End-to-end + accessibility tests (Playwright + axe). Needs a seeded database; first run `npx playwright install chromium`. It creates test records, so run `npm run db:seed` afterwards to restore the demo |
| `npm run setup` | `db:push` + `db:seed` |
| `npm run db:push` | Apply migrations to the cloud database |
| `npm run db:seed` | Create demo accounts and reload demo data |
| `npm run db:types:remote` | Regenerate `src/types/database.ts` from the cloud database |
| `npm run db:types` | Same, from the local Docker stack |

## Project structure

```
src/app/(auth)/        sign in, sign up, password reset
src/app/(app)/         the signed-in app (dashboard, inventory, circulation, licenses, reports, settings, help…)
src/app/about/         public project page (research citation, credits, libraries)
src/app/api/           report and CSV export route handlers
src/components/        feature components; ui/ holds the customized shadcn components
src/lib/actions/       Server Actions (every one re-checks the session and validates with Zod)
src/lib/queries/       read helpers for Server Components
src/lib/validation/    Zod schemas shared by forms and the server
src/lib/reports/       report builder + PDF / Excel / CSV renderers
supabase/migrations/   tables, RLS policies, triggers, RPC functions, storage
scripts/               setup and seed scripts
tests/                 unit/ (Vitest), integration/ (live RLS), e2e/ (Playwright + axe)
```
