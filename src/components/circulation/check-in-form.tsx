"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { applyFieldErrors, FormAlert, TextareaField } from "@/components/forms/fields"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Spinner } from "@/components/ui/spinner"
import { checkIn } from "@/lib/actions/circulation"
import { CONDITION_LABELS } from "@/lib/labels"
import { checkInSchema, type CheckInInput, type CheckInValues } from "@/lib/validation/circulation"
import type { Enums } from "@/types/database"

type Props = {
  checkoutId: string
  assetName: string
  kind: Enums<"asset_kind">
  borrower: string
  defaultCondition: Enums<"asset_condition"> | null
  onDone?: () => void
}

export function CheckInForm({ checkoutId, assetName, kind, borrower, defaultCondition, onDone }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<CheckInInput, unknown, CheckInValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      checkout_id: checkoutId,
      condition_in: defaultCondition && defaultCondition !== "broken" ? defaultCondition : "good",
      notes: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await checkIn(form.getValues())
      if (!result.ok) {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
        return
      }
      toast.success(
        kind === "digital"
          ? `Seat released from ${borrower}.`
          : values.condition_in === "broken"
            ? `${assetName} checked in and sent to repair.`
            : `${assetName} checked in.`
      )
      onDone?.()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={error} />
      {kind === "physical" ? (
        <Controller
          control={form.control}
          name="condition_in"
          render={({ field }) => (
            <Field>
              <FieldLabel id={`condition-${checkoutId}`}>Condition on return</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                aria-labelledby={`condition-${checkoutId}`}
                className="flex w-full flex-wrap"
              >
                {(Object.keys(CONDITION_LABELS) as Enums<"asset_condition">[]).map((c) => (
                  <ToggleGroupItem key={c} value={c} className="flex-1">
                    {CONDITION_LABELS[c]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>Choosing “Broken” moves the item to In repair.</FieldDescription>
            </Field>
          )}
        />
      ) : null}
      <TextareaField control={form.control} name="notes" label="Notes" rows={2} placeholder="Missing charger, sticker on lid…" />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Spinner /> : null}
        {kind === "digital" ? "Release seat" : "Check in"}
      </Button>
    </form>
  )
}
