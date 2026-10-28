"use client"

import {
  Archive,
  ArrowLeftRight,
  CircleCheck,
  CircleHelp,
  MapPin,
  MoreHorizontal,
  Pencil,
  Printer,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CheckInForm } from "@/components/circulation/check-in-form"
import { CheckOutForm } from "@/components/circulation/check-out-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { changeAssetStatus, deleteAsset, moveAsset } from "@/lib/actions/assets"
import type { Enums } from "@/types/database"

type OpenLoan = { id: string; borrower: string }

type Props = {
  asset: {
    id: string
    name: string
    asset_tag: string
    kind: Enums<"asset_kind">
    status: Enums<"asset_status">
    condition: Enums<"asset_condition"> | null
    location_id: string | null
  }
  openLoans: OpenLoan[]
  seatsFull: boolean
  canCirculate: boolean
  canEdit: boolean
  isAdmin: boolean
  locations: { value: string; label: string }[]
  defaultLoanDays: number
}

type StatusTarget = {
  status: "retired" | "lost" | "in_repair" | "available"
  title: string
  description: string
  confirm: string
}

const STATUS_TARGETS: Record<StatusTarget["status"], StatusTarget> = {
  retired: {
    status: "retired",
    title: "Retire this item?",
    description: "Retired items stay in history and past reports but no longer count toward active inventory or value.",
    confirm: "Retire item",
  },
  lost: {
    status: "lost",
    title: "Mark this item as lost?",
    description: "It will show as lost in reports. If it turns up later, mark it available again.",
    confirm: "Mark as lost",
  },
  in_repair: {
    status: "in_repair",
    title: "Send to repair?",
    description: "The item can't be checked out until it is marked available again.",
    confirm: "Mark in repair",
  },
  available: {
    status: "available",
    title: "Mark as available?",
    description: "The item can be checked out again.",
    confirm: "Mark available",
  },
}

export function AssetActions({
  asset,
  openLoans,
  seatsFull,
  canCirculate,
  canEdit,
  isAdmin,
  locations,
  defaultLoanDays,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<"checkout" | "checkin" | "move" | "delete" | null>(null)
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null)
  const [note, setNote] = useState("")
  const [moveTo, setMoveTo] = useState(asset.location_id ?? "")
  const [checkinLoan, setCheckinLoan] = useState<OpenLoan | null>(openLoans[0] ?? null)

  const physical = asset.kind === "physical"
  const canCheckOut =
    canCirculate &&
    (physical ? asset.status === "available" : !seatsFull && asset.status !== "retired" && asset.status !== "lost")
  const canCheckIn = canCirculate && openLoans.length > 0

  const done = () => {
    setDialog(null)
    router.refresh()
  }

  function applyStatus() {
    if (!statusTarget) return
    startTransition(async () => {
      const result = await changeAssetStatus({ id: asset.id, status: statusTarget.status, note })
      if (result.ok) {
        toast.success(`${asset.name} is now ${statusTarget.status.replace("_", " ")}.`)
        setStatusTarget(null)
        setNote("")
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCheckOut ? (
        <Button onClick={() => setDialog("checkout")}>
          <ArrowLeftRight aria-hidden="true" /> {physical ? "Check out" : "Assign seat"}
        </Button>
      ) : null}
      {canCheckIn && physical ? (
        <Button
          variant={canCheckOut ? "outline" : "default"}
          onClick={() => {
            setCheckinLoan(openLoans[0])
            setDialog("checkin")
          }}
        >
          <Undo2 aria-hidden="true" /> Check in
        </Button>
      ) : null}
      {canEdit ? (
        <Button variant="outline" asChild>
          <Link href={`/inventory/${asset.id}/edit`}>
            <Pencil aria-hidden="true" /> Edit
          </Link>
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link href={`/inventory/labels?ids=${asset.id}`}>
          <Printer aria-hidden="true" /> Print label
        </Link>
      </Button>

      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {physical ? (
              <DropdownMenuItem onSelect={() => setDialog("move")}>
                <MapPin aria-hidden="true" /> Move to another room
              </DropdownMenuItem>
            ) : null}
            {asset.status !== "available" && asset.status !== "checked_out" ? (
              <DropdownMenuItem onSelect={() => setStatusTarget(STATUS_TARGETS.available)}>
                <CircleCheck aria-hidden="true" /> Mark available
              </DropdownMenuItem>
            ) : null}
            {physical && asset.status !== "in_repair" && asset.status !== "checked_out" ? (
              <DropdownMenuItem onSelect={() => setStatusTarget(STATUS_TARGETS.in_repair)}>
                <Wrench aria-hidden="true" /> Send to repair
              </DropdownMenuItem>
            ) : null}
            {asset.status !== "lost" ? (
              <DropdownMenuItem onSelect={() => setStatusTarget(STATUS_TARGETS.lost)}>
                <CircleHelp aria-hidden="true" /> Mark as lost
              </DropdownMenuItem>
            ) : null}
            {asset.status !== "retired" ? (
              <DropdownMenuItem onSelect={() => setStatusTarget(STATUS_TARGETS.retired)}>
                <Archive aria-hidden="true" /> Retire
              </DropdownMenuItem>
            ) : null}
            {isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                  <Trash2 aria-hidden="true" /> Delete record
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Dialog open={dialog === "checkout"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{physical ? "Check out" : "Assign a seat"}</DialogTitle>
            <DialogDescription>
              {asset.name} · <span className="font-mono">{asset.asset_tag}</span>
            </DialogDescription>
          </DialogHeader>
          <CheckOutForm
            assetId={asset.id}
            assetName={asset.name}
            kind={asset.kind}
            condition={asset.condition}
            defaultLoanDays={defaultLoanDays}
            onDone={done}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "checkin" && !!checkinLoan} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check in</DialogTitle>
            <DialogDescription>
              {asset.name} from {checkinLoan?.borrower}
            </DialogDescription>
          </DialogHeader>
          {checkinLoan ? (
            <CheckInForm
              checkoutId={checkinLoan.id}
              assetName={asset.name}
              kind={asset.kind}
              borrower={checkinLoan.borrower}
              defaultCondition={asset.condition}
              onDone={done}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "move"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {asset.name}</DialogTitle>
            <DialogDescription>Choose the room or area it now lives in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="move-location">New location</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-location" className="w-full">
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!moveTo || moveTo === asset.location_id || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await moveAsset(asset.id, moveTo)
                  if (result.ok) {
                    toast.success("Location updated.")
                    done()
                  } else toast.error(result.error)
                })
              }
            >
              Move item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.title}</AlertDialogTitle>
            <AlertDialogDescription>{statusTarget?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="status-note">Note (optional)</Label>
            <Textarea
              id="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Why? This is added to the item's notes."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                applyStatus()
              }}
              disabled={pending}
            >
              {statusTarget?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {asset.name} ({asset.asset_tag}) will disappear from the catalog. Its history is kept in the audit log.
              Use Retire instead if the item still exists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                startTransition(async () => {
                  const result = await deleteAsset(asset.id)
                  if (result.ok) {
                    toast.success("Record deleted.")
                    router.push("/inventory")
                  } else toast.error(result.error)
                })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
