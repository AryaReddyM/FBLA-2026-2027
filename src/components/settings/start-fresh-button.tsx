"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { startFresh } from "@/lib/actions/start-fresh"

export function StartFreshButton({ itemCount }: { itemCount: number }) {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState("")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirmed = confirmation.trim().toUpperCase() === "DELETE"

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmation("")
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          {pending ? <Spinner /> : <Trash2 aria-hidden="true" />} Start fresh
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all {itemCount.toLocaleString("en-US")} items and start fresh?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This permanently deletes every item, loan, license record, photo, saved report and activity entry. It
                can&apos;t be undone.
              </p>
              <p>
                <strong>Kept:</strong> user accounts, locations (rooms), categories and institution settings.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="start-fresh-confirm">Type DELETE to confirm</Label>
          <Input
            id="start-fresh-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            className="font-mono uppercase"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || pending}
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const result = await startFresh(confirmation)
                if (result.ok) {
                  toast.success(`Done. ${result.data.removed.toLocaleString("en-US")} items removed; your catalog is empty.`)
                  setOpen(false)
                  setConfirmation("")
                  router.refresh()
                } else toast.error(result.error)
              })
            }}
          >
            Delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
