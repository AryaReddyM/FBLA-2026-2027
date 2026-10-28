// Reads the public Supabase settings. Referenced as literal process.env.NEXT_PUBLIC_*
// so Next.js can inline them into the browser bundle.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

// Supabase now calls this the "publishable" key (sb_publishable_…); older
// projects call it the "anon" key. Either works.
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

/** False until .env.local is filled in; the app then shows a setup page instead of crashing. */
export const isSupabaseConfigured = supabaseUrl.startsWith("http") && supabaseAnonKey.length > 20
