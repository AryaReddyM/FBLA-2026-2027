import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Skip static files and images; everything else goes through the session check.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
