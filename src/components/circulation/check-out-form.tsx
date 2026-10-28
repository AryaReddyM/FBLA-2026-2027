"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { addDays, endOfDay, format } from "date-fns"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { applyFieldErrors, FormAlert, SelectField, TextareaField, TextField } from "@/components/forms/fields"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Spinner } from "@/components/ui/spinner"
import { checkOut } from "@/lib/actions/circulation"
import { BORROWER_TYPE_LABELS, CONDITION_LABELS } from "@/lib/labels"
import { checkOutSchema, type CheckOutInput, type CheckOutValues } from "@/lib/validation/circulation"
import type { Enums } from "@/types/database"

type Props = {
  assetId: string
  assetName: string
  kind: Enums<"asset_kind">
  condition: Enums<"asset_condition"> | null
  defaultLoanDays: number
  onDone?: () => void
  submitLabel?: string
}

const REF_LABEL: Record<Enums<"borrower_type">, { label: string; hint: string; placeholder: string }> = {
  student: { label: "Student ID number", hint: "We store only the name and school ID, nothing else about students.", placeholder: "10234" },
  staff: { label: "Staff email", hint: "Optional.", placeholder: "name@school.org" },
  classroom: { label: "Teacher or reference", hint: "Optional, e.g. the teacher responsible.", placeholder: "Ms. Lee" },
}

export function CheckOutForm({ assetId, assetName, kind, condition, defaultLoanDays, onDone, submitLabel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // The <input type="date"> holds a plain date; we turn it into "end of that day, local time".
  const [dueDate, setDueDate] = useState(kind === "physical" ? format(addDays(new Date(), defaultLoanDays), "yyyy-MM-dd") : "")

  const form = useForm<CheckOutInput, unknown, CheckOutValues>({
    resolver: zodResolver(checkOutSchema),
    defaultValues: {
      asset_id: assetId,
      borrower_type: kind === "digital" ? "staff" : "student",
      borrower_name: "",
      borrower_ref: "",
      due_at: "",
      condition_out: condition ?? "",
      notes: "",
    },
  })
  const borrowerType = useWatch({ control: form.control, name: "borrower_type" })
  const ref = REF_LABEL[borrowerType]

  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await checkOut({ ...form.getValues(), due_at: dueDate ? endOfDay(new Date(`${dueDate}T00:00`)).toISOString() : "" })
      if (!result.ok) {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
        return
      }
      toast.success(kind === "digital" ? `Seat of ${assetName} assigned.` : `${assetName} checked out.`)
      onDone?.()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={error} />
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="borrower_type"
          render={({ field }) => (
            <Field>
              <FieldLabel id="borrower-type-label">Borrower</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                aria-labelledby="borrower-type-label"
                className="w-full"
              >
                {(Object.keys(BORROWER_TYPE_LABELS) as Enums<"borrower_type">[]).map((type) => (
                  <ToggleGroupItem key={type} value={type} className="flex-1">
                    {BORROWER_TYPE_LABELS[type]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="borrower_name"
            label={borrowerType === "classroom" ? "Classroom" : "Name"}
            placeholder={borrowerType === "classroom" ? "Room 204 cart" : "Full name"}
            autoComplete="off"
            required
          />
          <TextField
            control={form.control}
            name="borrower_ref"
            label={ref.label}
            placeholder={ref.placeholder}
            description={ref.hint}
            autoComplete="off"
            inputMode={borrowerType === "student" ? "numeric" : undefined}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={form.formState.errors.due_at ? true : undefined}>
            <FieldLabel htmlFor="due-date">Due date</FieldLabel>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <FieldDescription>
              {kind === "digital" ? "Optional. Leave blank to keep the seat assigned until released." : `Default loan: ${defaultLoanDays} days.`}
            </FieldDescription>
            <FieldError errors={[form.formState.errors.due_at]} />
          </Field>
          {kind === "physical" ? (
            <SelectField
              control={form.control}
              name="condition_out"
              label="Condition now"
              options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))}
              allowNone
              noneLabel="Not recorded"
            />
          ) : null}
        </div>
        <TextareaField control={form.control} name="notes" label="Notes" rows={2} placeholder="Charger included, etc." />
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? <Spinner /> : null}
          {submitLabel ?? (kind === "digital" ? "Assign seat" : "Check out")}
        </Button>
      </FieldGroup>
    </form>
  )
}
