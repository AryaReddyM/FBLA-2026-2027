# PROGRESS

_Last updated: Oct 25, 2026_

## Current status

All features in CLAUDE.md §8 are implemented (M0–M7, plus the §8.10 Impact card) and running against the cloud Supabase project (migrations pushed, demo data seeded, types generated from the live database). Build, lint, typecheck, unit, live-RLS and end-to-end/accessibility tests all pass. **Next: deploy to Vercel (M9).**

| # | Milestone | Status |
|---|---|---|
| M0 | Project setup | ✅ Next 16.4, TS strict, Tailwind 4, shadcn/ui, ESLint, Prettier, Vitest, Playwright. Local Supabase **not** runnable on this PC (no Docker/WSL); using a cloud project instead |
| M1 | Schema, RLS, auth | ✅ 8 migrations pushed to the cloud project. 13 live RLS tests (`tests/integration/rls.test.ts`) pass, including "staff cannot insert assets" |
| M2 | Layout + accessibility shell | ✅ Sidebar/drawer, top bar, Ctrl+K search, accessibility menu (text size, high contrast, theme), skip link |
| M3 | Catalog, register, detail | ✅ Incl. duplicate detection, QR labels, batch entry, photos |
| M4 | Search + dashboard | ✅ `search_assets` RPC, command palette, KPI cards, charts with table views |
| M5 | Circulation + licenses | ✅ Row-locking RPCs + unique index (two users can't check out the same item) |
| M6 | Reports + exports | ✅ 5 reports × PDF/XLSX/CSV, history in Storage + `report_runs` |
| M7 | Settings + CSV import | ✅ Institution, categories + custom field builder, locations, users, import wizard, demo reset |
| M8 | Review | 🟡 E2E + axe suite: 36/36 pass (0 serious/critical violations on every page, incl. high contrast + dark + 150% text; phone layout). Lighthouse not run yet |
| M9 | Deploy | ⏳ Vercel + Supabase cloud (README has the steps) |

## Redesign to match the Figma mockup (Oct 28, 2026)

- New visual language from the team's mockup (`Screenshot 2026-10-28 100755.png`): deep forest-green bands, lime eyebrow lines and primary actions, white cards on a mint-grey page, pill buttons, Inter font.
- Sidebar replaced by a dark green top navigation that flows into each page's hero band (`PageHeader`). Phones/tablets (< 1280px) get a slide-out menu.
- Catalog and dashboard: large hero with the "Search catalog" bar (keyword + "All formats") and an overlapping stats card (`StatStrip`); catalog empty state "Your catalog is ready for its first asset."
- Accessibility menu replaced by the mockup's floating "Aa Accessibility" button and Display preferences panel: text size (4 steps, CLAUDE.md requires 100/115/130/150 where the mockup showed 3), Standard / High contrast / Color-safe contrast, theme (light/dark/device, required by §9), Reduce motion, Reset.
- New "color-safe" theme (blue/orange statuses and charts, underlined links) and a reduce-motion setting, both saved like the other preferences.
- Chart palette re-validated with forest green first (CVD and normal-vision checks pass in light and dark).
- Verification: build, lint, typecheck, 107 unit/RLS tests, 42 E2E tests (axe on every page incl. high contrast/dark/150% and color-safe/reduced motion; no sideways scroll at 1024/1280/1440/1920px and on phones; hero search).

## Two Supabase projects (Oct 26, 2026)

- **Demo** (`.env.local`, `DEMO_MODE=true`): fictional Lincoln High School for FBLA. The owner's school account was promoted to admin here.
- **Real school** (`.env.school.local`): separate, empty project. ⏳ Waiting for the owner to create it and fill in the file, then `npm run school:setup`.
- Demo-only features (Reset demo data, demo logins on the sign-in page, `db:seed`) now require `DEMO_MODE=true`. Previously they were on in every non-production run, which could have wiped a real school's data.
- Each project gets its own build folder (`NEXT_DIST_DIR`), because public keys are baked into the build. `scripts/with-env.ts` launches Next with the school env file (Node's `--env-file` can't be forwarded to Next's child processes).

## Verification log

- `npm run build`: passes (27 routes; signed-in pages are partial prerenders that stream user data)
- `npm run lint`, `npm run typecheck`: pass, 0 problems
- `npm run test`: 107/107 passing: 94 unit (validation, depreciation, permission map, CSV safety/import rules, scan parsing, demo-data invariants) + 13 live RLS tests against Supabase
- SQL migrations: also checked with 55 behavioural tests in an in-memory Postgres before pushing (seat limits, double checkout blocked, all-or-nothing import, audit triggers, storage policies, `save_asset` rollback)
- `npm run test:e2e`: 36/36 passing (sign-in per role, permissions in the UI, register → duplicate detection → search → check out → check in, report export, viewer read-only, axe on 19 pages, no horizontal scroll on phones)
- Fixed during review: 7 kinds of axe findings (label-in-name, link underlines, tab contrast, scroll-region focus, a tabs widget without panels, skeleton roles, checkbox target size), a Cache Components prerender error (`connection()` in the Supabase server client), and a phone overflow in the catalog

## Next steps

1. Deploy to Vercel (M9): see README → Deploy, then add the Vercel URL to Supabase Auth redirect URLs.
2. Lighthouse on the deployed site (target ≥ 90 Performance/Accessibility/Best Practices).
3. Team: add real names to the `/about` Team card, and screenshots to `/help` (see Known issues).
4. After running `npm run test:e2e`, run `npm run db:seed` to wipe the test items it creates.

## Known issues / to-dos

- `/help` guides have no screenshots yet (CLAUDE.md §8.9 says the team adds them later).
- `/about` Team card has placeholder names ("Team member 1…").
- E2E tests create real records (test projectors, report runs). Re-run `npm run db:seed` (or Settings → Reset demo data) before a demo.
- `save_asset`'s `p_id` argument is nullable in SQL, but generated types can't express that, so one call site casts it (commented in `lib/actions/assets.ts`).
- Supabase's built-in email only delivers to project team members, so magic links and sign-up confirmations need custom SMTP (or turn off "Confirm email"). Admin-created accounts work without email.
- Camera scanning requires HTTPS (works on Vercel and on `localhost`, not on a LAN IP over http).

## Deviations from CLAUDE.md (flagged per §15)

- **`export const runtime = "nodejs"` in report route handlers**: Next 16 with Cache Components (on by default in `create-next-app`) rejects any `runtime` export. Route handlers run on Node.js by default, so the behaviour is the same. Suggest updating §5 to drop that note.
- **Local Supabase + Docker**: not installed on the dev PC. Development uses the cloud project; README documents the Docker path for the offline demo (§11).
- **`@hookform/resolvers` v5** instead of v6: v6 has a peer-dependency conflict (optional `effect@4` peer). v5 fully supports Zod 4.
- **TanStack Table v9** (latest) has a new API: `useTable` + `tableFeatures`, and row selection maps only hold `true`.
- **shadcn/ui** now imports `cn` from the small `cn` package (added by the shadcn CLI). `next-themes` was removed; the theme is handled by our own preferences store (`components/a11y/preferences.tsx`), which also does text size and high contrast without a flash on load.
- **Schema additions** (beyond §6, all with RLS): `metric_events` table (Impact card, §8.10); `audit_log.asset_id` and `audit_log.summary` (plain-language timeline); `checkouts.asset_kind` (needed by the "one open checkout per physical asset" partial index); `digital_licenses.contract_number`; `location_type`, `license_type`, `billing_cycle` and `report_format` enums.
- **Extra RPCs**: `save_asset` (asset + license in one transaction, per §14), `find_possible_duplicates`, `dashboard_stats`, `import_assets` (all-or-nothing CSV import), `admin_load_demo_data` (service role only).
- **Asset tags on registration**: admins *and* managers may enter or scan an existing tag when registering (needed for existing district barcodes); only admins can change a tag afterwards.
- **Staff reporting**: staff can run Checkout Activity, automatically limited to loans they made (§7 "own checkouts only").
- **Dashboard "Recent activity"**: admins/managers see the audit log; staff/viewers see their own recent loans instead, because §7 limits the audit log to admins and managers.
