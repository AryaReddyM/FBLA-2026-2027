// Applies supabase/migrations to the cloud database in SUPABASE_DB_URL.
//
//   npm run db:push
//
// A thin wrapper so the connection string comes from .env.local instead of
// being typed (and saved in shell history) by hand. Works on Windows too.

import { spawnSync } from "node:child_process"

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error("\n✖ Set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler).\n")
  process.exit(1)
}

const result = spawnSync("npx", ["supabase", "db", "push", "--db-url", dbUrl, "--include-all", "--yes"], {
  stdio: "inherit",
  shell: process.platform === "win32",
})
process.exit(result.status ?? 1)
