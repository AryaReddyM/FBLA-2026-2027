"use client"

import { useCallback, useSyncExternalStore } from "react"

import { PREF_KEYS as KEYS } from "./preferences-script"

// Display preferences from the accessibility panel: text size, color and
// contrast, light/dark theme, and reduced motion. They're saved in
// localStorage AND a cookie; the inline script in preferences-script.ts reads
// them before the first paint so the page never flashes the wrong look.

export type ThemePref = "light" | "dark" | "system"
export type ContrastPref = "normal" | "high" | "colorsafe"
export type TextSizePref = "100" | "115" | "130" | "150"
export type MotionPref = "auto" | "reduce"

export type Preferences = {
  theme: ThemePref
  contrast: ContrastPref
  textSize: TextSizePref
  motion: MotionPref
}

export const TEXT_SIZES: TextSizePref[] = ["100", "115", "130", "150"]

export const DEFAULT_PREFERENCES: Preferences = { theme: "system", contrast: "normal", textSize: "100", motion: "auto" }

function readStored(key: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${key}=`))
  if (match) return decodeURIComponent(match.slice(key.length + 1))
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string) {
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private browsing can block localStorage; the cookie still works.
  }
}

function readAll(): Preferences {
  const theme = readStored(KEYS.theme)
  const contrast = readStored(KEYS.contrast)
  const textSize = readStored(KEYS.textSize)
  return {
    theme: theme === "light" || theme === "dark" ? theme : "system",
    contrast: contrast === "high" || contrast === "colorsafe" ? contrast : "normal",
    textSize: TEXT_SIZES.includes(textSize as TextSizePref) ? (textSize as TextSizePref) : "100",
    motion: readStored(KEYS.motion) === "reduce" ? "reduce" : "auto",
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function apply(prefs: Preferences) {
  const root = document.documentElement
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemPrefersDark())
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
  if (prefs.contrast === "normal") root.removeAttribute("data-contrast")
  else root.setAttribute("data-contrast", prefs.contrast)
  if (prefs.textSize === "100") root.removeAttribute("data-text-size")
  else root.setAttribute("data-text-size", prefs.textSize)
  if (prefs.motion === "reduce") root.setAttribute("data-motion", "reduce")
  else root.removeAttribute("data-motion")
}

// A tiny external store so every component sees the same preferences and
// re-renders when they change (including from another tab).
let current: Preferences | null = null
const listeners = new Set<() => void>()

function getSnapshot(): Preferences {
  current ??= readAll()
  return current
}

function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystemChange = () => {
    if (getSnapshot().theme === "system") {
      apply(getSnapshot())
      listener()
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key && Object.values(KEYS).includes(event.key as (typeof KEYS)[keyof typeof KEYS])) {
      current = readAll()
      apply(current)
      listener()
    }
  }
  media.addEventListener("change", onSystemChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...getSnapshot(), ...patch }
    current = next
    for (const key of Object.keys(patch) as (keyof Preferences)[]) writeStored(KEYS[key], next[key])
    apply(next)
    for (const listener of listeners) listener()
  }, [])

  const reset = useCallback(() => update(DEFAULT_PREFERENCES), [update])

  return { prefs, update, reset }
}
