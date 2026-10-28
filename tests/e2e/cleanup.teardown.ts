import { test as teardown } from "@playwright/test"

import { deleteTestAccounts, testEnv } from "../support/test-accounts"

teardown("delete test accounts and everything they created", async () => {
  teardown.skip(!testEnv().configured, "Supabase keys aren't set in .env.local")
  teardown.setTimeout(120_000)
  await deleteTestAccounts()
})
