import { Search } from "lucide-react"
import Form from "next/form"

import { Button } from "@/components/ui/button"

/**
 * The big catalog search bar from the mockup: keyword box, "All formats"
 * picker and a lime "Search catalog" button. It's a plain form that submits
 * to /inventory?q=…&kind=…, so it works even before JavaScript loads.
 */
export function HeroSearch({ defaultQuery = "", defaultKind = "" }: { defaultQuery?: string; defaultKind?: string }) {
  return (
    <Form
      action="/inventory"
      role="search"
      aria-label="Search the catalog"
      data-surface
      className="flex max-w-4xl flex-col gap-1 rounded-2xl bg-card p-2 text-card-foreground shadow-xl shadow-black/20 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="hero-search" className="sr-only">
          Search by name, asset tag, serial number, model or keyword
        </label>
        <input
          id="hero-search"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          placeholder="Name, asset tag, serial number, or keyword"
          autoComplete="off"
          className="h-12 w-full rounded-xl bg-transparent pr-3 pl-12 text-base placeholder:text-muted-foreground"
        />
      </div>
      <label htmlFor="hero-kind" className="sr-only">
        Format
      </label>
      <select
        id="hero-kind"
        name="kind"
        defaultValue={defaultKind}
        className="h-12 cursor-pointer rounded-xl bg-transparent px-3 text-sm font-semibold sm:w-44 sm:border-l sm:border-border"
      >
        <option value="">All formats</option>
        <option value="physical">Physical items</option>
        <option value="digital">Digital resources</option>
      </select>
      <Button type="submit" className="h-12 rounded-xl px-6 text-sm">
        Search catalog
      </Button>
    </Form>
  )
}
