"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { createClient } from "@/lib/supabase/client"

const WATCHED_TABLES = ["assets", "checkouts", "digital_licenses", "categories", "locations", "institution_settings"] as const

/**
 * Keeps every open screen in sync across devices. When anyone changes the
 * inventory, Supabase Realtime tells this browser and the page re-fetches its
 * server data, so counts like "Catalog units" never go stale.
 */
export function LiveRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    // Debounced: a bulk change or an import fires many events at once, but one refresh is enough.
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }

    const channel = supabase.channel("inventory-changes")
    for (const table of WATCHED_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh)
    }
    channel.subscribe()

    // Realtime can disconnect while a tab sleeps in the background, and Back/Forward
    // shows a cached copy of the page, so both also trigger a refresh.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("popstate", refresh)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("popstate", refresh)
      void supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
