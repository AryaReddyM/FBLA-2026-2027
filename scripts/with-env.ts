// Runs Next.js with a specific env file, e.g. the real school project:
//
//   node scripts/with-env.ts .env.school.local dev -p 3001
//
// (Node's --env-file flag can't be used here: Next starts child processes
// and Node refuses to pass --env-file along to them.)

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

const [envFile, ...nextArgs] = process.argv.slice(2)
if (!envFile || !existsSync(envFile)) {
  console.error(`\n✖ Env file "${envFile ?? ""}" not found.\n`)
  process.exit(1)
}

// Variables from this file win over .env.local, because Next.js never
// overrides variables that are already set in the environment.
process.loadEnvFile(envFile)

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...nextArgs], { stdio: "inherit", env: process.env })
child.on("exit", (code) => process.exit(code ?? 0))
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal))
