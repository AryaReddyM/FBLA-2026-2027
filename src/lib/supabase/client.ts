import { createBrowserClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "@/lib/env"
import type { Database } from "@/types/database"

/** Supabase client for Client Components (browser). Uses the same session cookies as the server. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
