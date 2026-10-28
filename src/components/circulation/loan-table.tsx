import { ArrowDownLeft } from "lucide-react"
import Link from "next/link"

import { DueSoonBadge, OverdueBadge } from "@/components/inventory/status-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { daysUntil, formatDate } from "@/lib/format"
import type { LoanRow } from "@/lib/queries/circulation"

function DueCell({ due }: { due: string | null }) {
  if (!due) return <span className="text-muted-foreground">No due date</span>
  const days = daysUntil(due) ?? 0
  if (days < 0) return <OverdueBadge label={`Overdue ${Math.abs(days)} day${days === -1 ? "" : "s"}`} />
  if (days <= 7) return <DueSoonBadge label={days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`} />
  return <span className="text-sm">{formatDate(due)}</span>
}

/** Loans list. Overdue status uses an icon and words, not just red. */
export function LoanTable({ rows, caption, canCheckIn }: { rows: LoanRow[]; caption: string; canCheckIn: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border md:block" tabIndex={0} role="region" aria-label={caption}>
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Checked out</TableHead>
              <TableHead>Due</TableHead>
              {canCheckIn ? <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>
                  <Link href={`/inventory/${loan.asset_id}`} className="font-medium hover:underline">
                    {loan.asset_name}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{loan.asset_tag}</span>
                </TableCell>
                <TableCell className="text-sm">{loan.borrower}</TableCell>
                <TableCell className="text-sm">
                  {formatDate(loan.checked_out_at)}
                  {loan.checked_out_by ? <span className="block text-xs text-muted-foreground">by {loan.checked_out_by}</span> : null}
                </TableCell>
                <TableCell>
                  <DueCell due={loan.due_at} />
                </TableCell>
                {canCheckIn ? (
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/circulation?asset=${loan.asset_id}&mode=in`} scroll={true}>
                        <ArrowDownLeft aria-hidden="true" /> Check in
                      </Link>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-2 md:hidden" aria-label={caption}>
        {rows.map((loan) => (
          <li key={loan.id} className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/inventory/${loan.asset_id}`} className="font-medium hover:underline">
                {loan.asset_name}
              </Link>
              <DueCell due={loan.due_at} />
            </div>
            <p className="font-mono text-xs text-muted-foreground">{loan.asset_tag}</p>
            <p className="text-sm">
              {loan.borrower} · since {formatDate(loan.checked_out_at)}
            </p>
            {canCheckIn ? (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/circulation?asset=${loan.asset_id}&mode=in`}>Check in</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
