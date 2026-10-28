"use client"

import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { resetDemoData } from "@/lib/actions/demo"

export function ResetDemoButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          {pending ? <Spinner /> : <RotateCcw aria-hidden="true" />} Reset demo data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes every item, loan, report and audit entry, then reloads the fictional Lincoln High School data set.
            User accounts are kept. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await resetDemoData()
                if (result.ok) {
                  toast.success(`Demo data reloaded: ${result.data.assets} items, ${result.data.checkouts} loans.`)
                  router.refresh()
                } else toast.error(result.error)
              })
            }
          >
            Reset everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
