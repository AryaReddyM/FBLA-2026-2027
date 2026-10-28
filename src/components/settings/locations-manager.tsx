"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { applyFieldErrors, FormAlert, SelectField, TextField } from "@/components/forms/fields"
import { EmptyState } from "@/components/layout/empty-state"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteLocation, saveLocation } from "@/lib/actions/settings"
import { LOCATION_TYPE_LABELS } from "@/lib/labels"
import { locationSchema, type LocationInput } from "@/lib/validation/settings"
import type { Enums } from "@/types/database"

export type LocationRow = {
  id: string
  name: string
  building: string | null
  room: string | null
  type: Enums<"location_type">
  manager_id: string | null
  manager_name: string | null
  item_count: number
}

export function LocationsManager({ locations, people }: { locations: LocationRow[]; people: { value: string; label: string }[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<LocationRow | "new" | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(location: LocationRow) {
    if (!window.confirm(`Delete the location “${location.name}”?`)) return
    startTransition(async () => {
      const result = await deleteLocation(location.id)
      if (result.ok) {
        toast.success("Location deleted.")
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" /> Add location
        </Button>
      </div>
      {locations.length === 0 ? (
        <EmptyState icon={MapPin} title="No locations yet" description="Add the rooms and areas where items live: classrooms, the library, storage." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label="Locations">
          <Table>
            <caption className="sr-only">Locations</caption>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Building / room</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{LOCATION_TYPE_LABELS[l.type]}</TableCell>
                  <TableCell className="text-sm">{[l.building, l.room].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-sm">{l.manager_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Link href={`/inventory?location=${l.id}`} className="text-primary hover:underline">
                      {l.item_count}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(l)} aria-label={`Edit ${l.name}`}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(l)} disabled={pending} aria-label={`Delete ${l.name}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add a location" : "Edit location"}</DialogTitle>
            <DialogDescription>Locations are the &ldquo;inventory areas&rdquo; used for annual reports.</DialogDescription>
          </DialogHeader>
          {editing !== null ? (
            <LocationForm
              key={editing === "new" ? "new" : editing.id}
              location={editing === "new" ? null : editing}
              people={people}
              onDone={() => {
                setEditing(null)
                router.refresh()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LocationForm({ location, people, onDone }: { location: LocationRow | null; people: { value: string; label: string }[]; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<LocationInput, unknown, z.output<typeof locationSchema>>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      id: location?.id ?? "",
      name: location?.name ?? "",
      building: location?.building ?? "",
      room: location?.room ?? "",
      type: location?.type ?? "classroom",
      manager_id: location?.manager_id ?? "",
    },
  })

  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await saveLocation(form.getValues())
      if (result.ok) {
        toast.success("Location saved.")
        onDone()
      } else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="Name" placeholder="Room 204 · Math" required className="sm:col-span-2" />
        <SelectField control={form.control} name="type" label="Type" options={Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField control={form.control} name="manager_id" label="Responsible person" options={people} allowNone noneLabel="No one assigned" />
        <TextField control={form.control} name="building" label="Building" placeholder="Main building" />
        <TextField control={form.control} name="room" label="Room number" placeholder="204" />
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Save location
        </Button>
      </DialogFooter>
    </form>
  )
}
