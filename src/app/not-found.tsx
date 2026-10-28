import { SearchX } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/layout/empty-state"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-xl items-center p-6">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="That page or item doesn't exist, or it was deleted."
        className="w-full"
      >
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/">Go to the dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/inventory">Search the catalog</Link>
          </Button>
        </div>
      </EmptyState>
    </main>
  )
}
