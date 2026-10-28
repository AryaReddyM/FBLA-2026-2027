import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { supabaseAnonKey, supabaseUrl } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts as the signed-in user, so every query is filtered by RLS.
 */
export async function createClient() {
  // Inventory data is per-user and changes constantly, so it is always read at
  // request time. Without this, Next.js would try to include it in the
  // prefetched per-session shell, where Supabase's token-expiry check (which
  // reads the clock) isn't allowed.
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't set cookies. That's fine: proxy.ts
          // refreshes the session on every request before rendering.
        }
      },
    },
  })
}
