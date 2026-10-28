import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env"
import type { Database } from "@/types/database"

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/about", "/setup"]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Runs before every page request. It refreshes the Supabase session cookie
 * (access tokens expire hourly) and sends signed-out visitors to /login.
 * This is only an optimistic check for a fast redirect; the real protection
 * is RLS in the database plus getCurrentUser() on the server.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (!isSupabaseConfigured) {
    if (pathname === "/setup" || pathname === "/about") return NextResponse.next()
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value)
        }
      },
    },
  })

  // Don't put code between createServerClient and getClaims(): getClaims()
  // is what triggers the token refresh that keeps people signed in.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const redirectWithCookies = (to: URL) => {
    const redirect = NextResponse.redirect(to)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = new URL("/login", request.url)
    if (pathname !== "/") url.searchParams.set("next", pathname + search)
    return redirectWithCookies(url)
  }

  if (signedIn && (pathname === "/login" || pathname === "/signup")) {
    return redirectWithCookies(new URL("/", request.url))
  }

  return response
}
