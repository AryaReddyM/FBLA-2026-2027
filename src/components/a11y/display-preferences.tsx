"use client"

import { Keyboard, Monitor, Moon, Square, Sun, Volume2, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import {
  usePreferences,
  type ContrastPref,
  type FontPref,
  type TextSizePref,
  type ThemePref,
} from "@/components/a11y/preferences"
import { pageText, useReadAloud } from "@/components/a11y/read-aloud"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const TEXT_SIZES: { value: TextSizePref; glyph: string; label: string }[] = [
  { value: "100", glyph: "A", label: "Standard" },
  { value: "115", glyph: "A+", label: "Large" },
  { value: "130", glyph: "A++", label: "Larger" },
  { value: "150", glyph: "A+++", label: "Largest" },
]

const FONTS: { value: FontPref; label: string; family: string }[] = [
  { value: "default", label: "Standard", family: "var(--font-sans)" },
  { value: "hyperlegible", label: "Hyperlegible", family: "var(--font-hyperlegible)" },
  { value: "lexend", label: "Easy reading", family: "var(--font-lexend)" },
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

const SPEEDS = [
  { value: 0.8, label: "Slower" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Faster" },
]

const SHORTCUTS: { keys: string[][]; action: string }[] = [
  {
    keys: [
      ["Ctrl", "K"],
      ["⌘", "K"],
    ],
    action: "Search the inventory from any page",
  },
  { keys: [["Alt", "A"]], action: "Open or close Display preferences" },
  { keys: [["?"]], action: "Show this list of shortcuts" },
  { keys: [["Tab"], ["Shift", "Tab"]], action: "Move to the next / previous control" },
  { keys: [["Enter"]], action: "Look up a tag at the circulation desk (USB scanners press it for you)" },
  { keys: [["Esc"]], action: "Close a dialog, menu or this panel" },
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 cursor-pointer accent-primary"
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * A highlight bar that follows the pointer, to help readers keep their place
 * (useful for dyslexia and attention difficulties). Purely visual.
 */
function ReadingGuide() {
  const [y, setY] = useState<number | null>(null)
  useEffect(() => {
    const onMove = (event: PointerEvent) => setY(event.clientY)
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])
  if (y === null) return null
  return (
    <div
      aria-hidden="true"
      data-print-hide
      className="pointer-events-none fixed inset-x-0 z-[60] h-[2.75em] -translate-y-1/2 border-y-2 border-lime bg-lime/15"
      style={{ top: y }}
    />
  )
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
}

/**
 * The floating "Aa Accessibility" button and its Display preferences panel
 * (WCAG 2.2 AA), plus the reading guide, read-aloud controls and keyboard
 * shortcuts list. Shown on every page, including sign-in.
 */
export function DisplayPreferences() {
  const { prefs, update, reset } = usePreferences()
  const { isSpeaking, supported, speak, stop } = useReadAloud()
  const [open, setOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [rate, setRate] = useState(1)
  // Text the person had selected when they opened the panel (clicking in the
  // panel would otherwise lose it).
  const selection = useRef("")
  const [hasSelection, setHasSelection] = useState(false)

  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  function changeOpen(next: boolean) {
    if (next) {
      selection.current = window.getSelection()?.toString().trim() ?? ""
      setHasSelection(selection.current.length > 0)
    }
    setOpen(next)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Alt+A, matched by physical key so it also works on Mac (where Option+A types "å").
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyA") {
        event.preventDefault()
        const next = !openRef.current
        if (next) {
          selection.current = window.getSelection()?.toString().trim() ?? ""
          setHasSelection(selection.current.length > 0)
        }
        setOpen(next)
      } else if (event.key === "?" && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target)) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {prefs.guide === "on" ? <ReadingGuide /> : null}

      {isSpeaking ? (
        <Button
          onClick={stop}
          variant="outline"
          className="fixed right-4 bottom-[4.25rem] z-40 h-10 gap-2 rounded-full bg-card shadow-lg sm:right-6 sm:bottom-[4.75rem]"
          data-print-hide
        >
          <Square className="size-3.5 fill-current" aria-hidden="true" /> Stop reading
        </Button>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {isSpeaking ? "Reading aloud" : ""}
      </p>

      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            className="fixed right-4 bottom-4 z-40 h-11 gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-lg shadow-black/20 hover:bg-brand/90 sm:right-6 sm:bottom-6"
            aria-keyshortcuts="Alt+A"
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
          className="max-h-[min(44rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-primary/40 p-5 shadow-xl"
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

          <Section title="Text size">
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
          </Section>

          <Section title="Reading font">
            <div className="grid grid-cols-3 gap-2">
              {FONTS.map((font) => (
                <Choice
                  key={font.value}
                  name="pref-font"
                  value={font.value}
                  checked={prefs.font === font.value}
                  onChange={() => update({ font: font.value })}
                >
                  <span
                    className="flex w-full flex-col items-center gap-0.5 px-1 py-2.5 text-center"
                    style={{ fontFamily: font.family }}
                  >
                    <span aria-hidden="true" className="text-lg leading-none font-bold">
                      Aa
                    </span>
                    <span className="text-xs font-semibold">{font.label}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </Section>

          <Section title="Color and contrast">
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
          </Section>

          <Section title="Theme">
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
          </Section>

          <Section title="Reading and navigation">
            <div className="grid gap-2">
              <ToggleRow
                label="Wider text spacing"
                hint="More room between lines, letters and words"
                checked={prefs.spacing === "wide"}
                onChange={(on) => update({ spacing: on ? "wide" : "normal" })}
              />
              <ToggleRow
                label="Underline all links"
                hint="Links never rely on color alone"
                checked={prefs.links === "underline"}
                onChange={(on) => update({ links: on ? "underline" : "default" })}
              />
              <ToggleRow
                label="Stronger focus outline"
                hint="A thick ring shows where the keyboard is"
                checked={prefs.focus === "strong"}
                onChange={(on) => update({ focus: on ? "strong" : "default" })}
              />
              <ToggleRow
                label="Reading guide"
                hint="A highlight bar follows your pointer"
                checked={prefs.guide === "on"}
                onChange={(on) => update({ guide: on ? "on" : "off" })}
              />
              <ToggleRow
                label="Reduce motion"
                hint="Stops decorative movement"
                checked={prefs.motion === "reduce"}
                onChange={(on) => update({ motion: on ? "reduce" : "auto" })}
              />
            </div>
          </Section>

          <Section title="Read aloud">
            {supported ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {SPEEDS.map((s) => (
                    <Choice
                      key={s.value}
                      name="pref-speech-rate"
                      value={String(s.value)}
                      checked={rate === s.value}
                      onChange={() => setRate(s.value)}
                    >
                      <span className="w-full px-2 py-1.5 text-center text-xs font-semibold">{s.label}</span>
                    </Choice>
                  ))}
                </div>
                {isSpeaking ? (
                  <Button variant="outline" className="w-full" onClick={stop}>
                    <Square className="size-3.5 fill-current" aria-hidden="true" /> Stop reading
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => speak(hasSelection ? selection.current : pageText(), rate)}>
                    <Volume2 aria-hidden="true" /> {hasSelection ? "Read selected text" : "Read this page aloud"}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Tip: select some text first to hear just that part.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This browser doesn&apos;t support reading aloud.</p>
            )}
          </Section>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setShortcutsOpen(true)
              }}
            >
              <Keyboard aria-hidden="true" /> Keyboard shortcuts
            </Button>
            <Button variant="outline" onClick={reset}>
              Reset preferences
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Everything in EduTrack works without a mouse. These shortcuts make it faster.
            </DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <caption className="sr-only">Keyboard shortcuts</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Keys</th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SHORTCUTS.map((s) => (
                <tr key={s.action}>
                  <td className="py-2.5 pr-4 align-top whitespace-nowrap">
                    {s.keys.map((combo, i) => (
                      <span key={combo.join("+")}>
                        {i > 0 ? <span className="mx-1 text-muted-foreground">or</span> : null}
                        {combo.map((k, j) => (
                          <span key={k}>
                            {j > 0 ? <span className="mx-0.5 text-muted-foreground">+</span> : null}
                            <Kbd>{k}</Kbd>
                          </span>
                        ))}
                      </span>
                    ))}
                  </td>
                  <td className="py-2.5">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </>
  )
}
