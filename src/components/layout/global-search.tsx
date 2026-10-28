"use client"

import { ArrowLeftRight, FileBarChart, PlusSquare, ScanLine, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { StatusBadge } from "@/components/inventory/status-badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { quickSearch, type QuickSearchResult } from "@/lib/actions/search"
import { SEARCH_DEBOUNCE_MS } from "@/lib/config"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const QUICK_LINKS = [
  { label: "Register an item", href: "/inventory/new", icon: PlusSquare },
  { label: "Open the circulation desk", href: "/circulation", icon: ArrowLeftRight },
  { label: "Scan a QR code", href: "/circulation?scan=1", icon: ScanLine },
  { label: "Generate the annual report", href: "/reports?type=annual_inventory", icon: FileBarChart },
]

/** The search bar in the top bar, which opens a command palette (also Ctrl/Cmd + K). */
export function GlobalSearch({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<QuickSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef("")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function onQueryChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    latest.current = q
    if (!q) {
      setResults([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLoading(true)
    // Debounce: wait until typing pauses for 250 ms before asking the server.
    timer.current = setTimeout(async () => {
      const res = await quickSearch(q)
      if (latest.current !== q) return // a newer search has started
      setLoading(false)
      if (res.ok) {
        setResults(res.data.results)
        setTotal(res.data.total)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const q = query.trim()

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "h-9 justify-start gap-2 px-3 font-normal shadow-none",
          onDark
            ? "border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white md:w-48 2xl:w-64"
            : "w-full max-w-md bg-background text-muted-foreground sm:w-72 lg:w-96",
        )}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search aria-hidden="true" />
        {/* On small screens only the icon shows; the text stays for screen readers. */}
        <span className={cn("truncate", onDark && "sr-only md:not-sr-only")}>Search inventory…</span>
        <span
          className={cn(
            "ml-auto hidden items-center gap-0.5",
            onDark ? "2xl:flex [&>kbd]:bg-white/15 [&>kbd]:text-white" : "sm:flex",
          )}
          aria-hidden="true"
        >
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search inventory"
        description="Search by asset tag, name, serial number, model or description."
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false} label="Search inventory">
          <CommandInput
            value={query}
            onValueChange={onQueryChange}
            placeholder="Search by tag, name, serial, model…"
            aria-label="Search inventory"
          />
          {/* Announces result counts to screen readers as they arrive. */}
          <div role="status" aria-live="polite" className="sr-only">
            {q && !loading ? `${pluralize(total, "result")} for ${q}` : ""}
          </div>
          <CommandList className="max-h-[min(28rem,60vh)]">
            {!q ? (
              <CommandGroup heading="Quick actions">
                {QUICK_LINKS.map((link) => (
                  <CommandItem key={link.href} value={link.href} onSelect={() => go(link.href)}>
                    <link.icon aria-hidden="true" />
                    {link.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <>
                <CommandGroup heading="Catalog">
                  <CommandItem value="__all" onSelect={() => go(`/inventory?q=${encodeURIComponent(q)}`)}>
                    <Search aria-hidden="true" />
                    <span className="truncate">
                      Show all results for <strong>“{q}”</strong>
                    </span>
                    {loading ? (
                      <Spinner className="ml-auto" />
                    ) : (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {pluralize(total, "match", "matches")}
                      </span>
                    )}
                  </CommandItem>
                </CommandGroup>
                {results.length > 0 ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Items">
                      {results.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => go(`/inventory/${item.id}`)}
                          className="gap-3"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{item.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              <span className="font-mono">{item.asset_tag}</span>
                              {item.location_name
                                ? ` · ${item.location_name}`
                                : item.kind === "digital"
                                  ? " · Digital"
                                  : ""}
                            </span>
                          </span>
                          <StatusBadge status={item.status} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                ) : !loading ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No items match “{q}”.</p>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
