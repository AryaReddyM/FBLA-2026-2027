"use client"

import { UserMinus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { checkIn } from "@/lib/actions/circulation"
import { formatDate } from "@/lib/format"

/** Who currently holds a seat of a digital license, with a one-click release. */
export function SeatList({
  seats,
  canRelease,
}: {
  seats: { id: string; borrower: string; since: string }[]
  canRelease: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (seats.length === 0) return <p className="text-sm text-muted-foreground">No seats assigned.</p>

  return (
    <ul className="divide-y rounded-lg border">
      {seats.map((seat) => (
        <li key={seat.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{seat.borrower}</span>
            <span className="block text-xs text-muted-foreground">since {formatDate(seat.since)}</span>
          </span>
          {canRelease ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-label={`Release seat from ${seat.borrower}`}
              onClick={() =>
                startTransition(async () => {
                  const result = await checkIn({ checkout_id: seat.id, condition_in: "good", notes: "" })
                  if (result.ok) {
                    toast.success(`Seat released from ${seat.borrower}.`)
                    router.refresh()
                  } else toast.error(result.error)
                })
              }
            >
              <UserMinus aria-hidden="true" /> Release
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
