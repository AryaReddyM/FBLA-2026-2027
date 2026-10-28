// Helpers for building links that keep the current filters in the URL.

export type QueryValue = string | number | null | undefined

/** Returns `path?a=1&b=2`, dropping empty values. */
export function withQuery(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/asset-photos/${path}` : null
}
