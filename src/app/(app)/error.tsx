"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

/** Shown if a page fails to load (for example, the database is unreachable). */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageContainer>
      <EmptyState
        icon={TriangleAlert}
        title="This page didn't load"
        description={
          <>
            Something went wrong while loading this page. Check your internet connection and try again.
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs">Error reference: {error.digest}</span>
            ) : null}
          </>
        }
      >
        <div className="flex gap-2">
          <Button onClick={() => retry()}>
            <RotateCcw aria-hidden="true" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      </EmptyState>
    </PageContainer>
  )
}
