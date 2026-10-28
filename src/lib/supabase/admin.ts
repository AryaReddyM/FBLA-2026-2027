import "server-only"

import { createClient } from "@supabase/supabase-js"

import { supabaseUrl } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Service-role client. It BYPASSES Row Level Security, so it is only used
 * server-side for admin tasks (creating user accounts, resetting demo data),
 * always after the caller's own role has been checked.
 * The "server-only" import makes the build fail if a client component imports this.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.")
  }
  return createClient<Database>(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
