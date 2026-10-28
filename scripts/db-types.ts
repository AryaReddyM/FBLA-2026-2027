// Regenerates src/types/database.ts from the cloud database in SUPABASE_DB_URL.
//
//   npm run db:types:remote
//
// (With the local Docker stack running, `npm run db:types` does the same.)

import { spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error("\n✖ Set SUPABASE_DB_URL in .env.local first.\n")
  process.exit(1)
}

const result = spawnSync("npx", ["supabase", "gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 20 * 1024 * 1024,
})
if (result.status !== 0 || !result.stdout.includes("export type Database")) {
  console.error(result.stderr || "Type generation failed.")
  process.exit(result.status || 1)
}
writeFileSync("src/types/database.ts", result.stdout)
console.log("✔ Wrote src/types/database.ts")
