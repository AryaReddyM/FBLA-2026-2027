"use client"

import { useCallback, useSyncExternalStore } from "react"

import { HTML_ATTRIBUTE_PREFS, PREF_KEYS as KEYS } from "./preferences-script"

// Display preferences from the accessibility panel. They're saved in
// localStorage AND a cookie; the inline script in preferences-script.ts reads
// them before the first paint so the page never flashes the wrong look.

type AttrPrefs = typeof HTML_ATTRIBUTE_PREFS

export type ThemePref = "light" | "dark" | "system"
export type ContrastPref = AttrPrefs["contrast"]["values"][number]
export type TextSizePref = AttrPrefs["textSize"]["values"][number]
export type MotionPref = AttrPrefs["motion"]["values"][number]
export type FontPref = AttrPrefs["font"]["values"][number]
export type SpacingPref = AttrPrefs["spacing"]["values"][number]
export type LinksPref = AttrPrefs["links"]["values"][number]
export type FocusPref = AttrPrefs["focus"]["values"][number]
export type GuidePref = "off" | "on"

export type Preferences = {
  theme: ThemePref
  contrast: ContrastPref
  textSize: TextSizePref
  motion: MotionPref
  font: FontPref
  spacing: SpacingPref
  links: LinksPref
  focus: FocusPref
  guide: GuidePref
}

export const TEXT_SIZES = HTML_ATTRIBUTE_PREFS.textSize.values

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  contrast: "normal",
  textSize: "100",
  motion: "auto",
  font: "default",
  spacing: "normal",
  links: "default",
  focus: "default",
  guide: "off",
}

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

function pick<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = readStored(key)
  return allowed.includes(value as T) ? (value as T) : fallback
}

function readAll(): Preferences {
  const attr = <K extends keyof AttrPrefs>(k: K) =>
    pick(KEYS[k], HTML_ATTRIBUTE_PREFS[k].values, HTML_ATTRIBUTE_PREFS[k].values[0]) as Preferences[K]
  return {
    theme: pick(KEYS.theme, ["light", "dark", "system"] as const, "system"),
    contrast: attr("contrast"),
    textSize: attr("textSize"),
    motion: attr("motion"),
    font: attr("font"),
    spacing: attr("spacing"),
    links: attr("links"),
    focus: attr("focus"),
    guide: pick(KEYS.guide, ["off", "on"] as const, "off"),
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
  for (const [key, { attr, values }] of Object.entries(HTML_ATTRIBUTE_PREFS)) {
    const value = prefs[key as keyof AttrPrefs]
    if (value === values[0]) root.removeAttribute(attr)
    else root.setAttribute(attr, value)
  }
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
