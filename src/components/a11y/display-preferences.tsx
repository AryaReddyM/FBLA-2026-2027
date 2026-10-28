"use client"

import { Monitor, Moon, Sun, X } from "lucide-react"
import { useState, type ReactNode } from "react"

import { usePreferences, type ContrastPref, type TextSizePref, type ThemePref } from "@/components/a11y/preferences"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const TEXT_SIZES: { value: TextSizePref; glyph: string; label: string }[] = [
  { value: "100", glyph: "A", label: "Standard" },
  { value: "115", glyph: "A+", label: "Large" },
  { value: "130", glyph: "A++", label: "Larger" },
  { value: "150", glyph: "A+++", label: "Largest" },
]

const CONTRASTS: { value: ContrastPref; label: string; hint: string }[] = [
  { value: "normal", label: "Standard colors", hint: "Original green palette" },
  { value: "high", label: "High contrast", hint: "Stronger separation between colors" },
  { value: "colorsafe", label: "Color-safe contrast", hint: "Does not rely on differences in hue" },
]

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Device", icon: Monitor },
]

/** A visually hidden radio input, with the whole tile acting as its label. */
function Choice({
  name,
  value,
  checked,
  onChange,
  className,
  children,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer rounded-xl border bg-card transition-colors hover:bg-muted/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        checked && "border-primary bg-accent ring-1 ring-primary hover:bg-accent",
        className,
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      {children}
    </label>
  )
}

/**
 * The floating "Aa Accessibility" button and its Display preferences panel
 * (CLAUDE.md §9): text size, color and contrast, theme, and reduced motion.
 * Shown on every page, including sign-in.
 */
export function DisplayPreferences() {
  const { prefs, update, reset } = usePreferences()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="fixed right-4 bottom-4 z-40 h-11 gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-lg shadow-black/20 hover:bg-brand/90 sm:right-6 sm:bottom-6"
          data-print-hide
        >
          <span aria-hidden="true" className="font-bold">
            Aa
          </span>
          Accessibility
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        aria-label="Display preferences"
        className="max-h-[min(40rem,calc(100dvh-6rem))] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-primary/40 p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Display preferences</h2>
            <p className="text-sm text-muted-foreground">Choose the combination that is easiest for you to read.</p>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className="shrink-0 rounded-full"
            onClick={() => setOpen(false)}
            aria-label="Close display preferences"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold">Text size</legend>
          <div className="grid grid-cols-4 gap-2">
            {TEXT_SIZES.map((size) => (
              <Choice
                key={size.value}
                name="pref-text-size"
                value={size.value}
                checked={prefs.textSize === size.value}
                onChange={() => update({ textSize: size.value })}
              >
                <span className="flex w-full flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-center">
                  <span aria-hidden="true" className="text-base leading-none font-bold">
                    {size.glyph}
                  </span>
                  <span className="text-xs font-semibold">{size.label}</span>
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold">Color and contrast</legend>
          <div className="grid gap-2">
            {CONTRASTS.map((c) => (
              <Choice
                key={c.value}
                name="pref-contrast"
                value={c.value}
                checked={prefs.contrast === c.value}
                onChange={() => update({ contrast: c.value })}
              >
                <span className="flex w-full items-center gap-3 px-3.5 py-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-input",
                      prefs.contrast === c.value && "border-primary",
                    )}
                  >
                    {prefs.contrast === c.value ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">{c.hint}</span>
                  </span>
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <Choice
                key={t.value}
                name="pref-theme"
                value={t.value}
                checked={prefs.theme === t.value}
                onChange={() => update({ theme: t.value })}
              >
                <span className="flex w-full items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold">
                  <t.icon className="size-4" aria-hidden="true" />
                  {t.label}
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
          <span>
            <span className="block text-sm font-semibold">Reduce motion</span>
            <span className="block text-xs text-muted-foreground">Stops decorative movement</span>
          </span>
          <input
            type="checkbox"
            checked={prefs.motion === "reduce"}
            onChange={(e) => update({ motion: e.target.checked ? "reduce" : "auto" })}
            className="size-5 shrink-0 cursor-pointer accent-primary"
          />
        </label>

        <Button variant="outline" className="w-full" onClick={reset}>
          Reset preferences
        </Button>
      </PopoverContent>
    </Popover>
  )
}
