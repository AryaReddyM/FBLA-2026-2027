import { FileBarChart } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { can, type Role } from "@/lib/permissions"

/**
 * "View annual summary": the school year at a glance. Admins and managers get
 * the Annual Inventory Report (every item, plus what was checked out and in
 * this school year); staff get the year's checkout activity for items they
 * lent. Viewers have no reports, so the button is hidden for them.
 */
export function AnnualSummaryButton({ role }: { role: Role }) {
  if (!can(role, "reports.own")) return null
  const href = can(role, "reports.all") ? "/reports?type=annual_inventory" : "/reports?type=checkout_activity"
  return (
    <Button variant="outline" asChild>
      <Link href={href}>
        <FileBarChart aria-hidden="true" /> View annual summary
      </Link>
    </Button>
  )
}
