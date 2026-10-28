"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { applyFieldErrors, FormAlert, SelectField, TextField } from "@/components/forms/fields"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { updateInstitution } from "@/lib/actions/settings"
import { MONTH_NAMES } from "@/lib/labels"
import { institutionSchema, type InstitutionInput } from "@/lib/validation/settings"
import type { z } from "zod"

export function InstitutionForm({ defaults }: { defaults: InstitutionInput }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<InstitutionInput, unknown, z.output<typeof institutionSchema>>({
    resolver: zodResolver(institutionSchema),
    defaultValues: defaults,
  })

  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await updateInstitution(form.getValues())
      if (result.ok) toast.success("Settings saved.")
      else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="School or district name" required className="sm:col-span-2" />
        <TextField
          control={form.control}
          name="asset_tag_prefix"
          label="Asset tag prefix"
          className="font-mono"
          maxLength={8}
          description="New tags look like PREFIX-2026-000123. Existing tags don't change."
          required
        />
        <TextField
          control={form.control}
          name="default_loan_days"
          label="Default loan length (days)"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          required
        />
        <SelectField
          control={form.control}
          name="fiscal_year_start_month"
          label="Fiscal / school year starts in"
          options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
          description="Used for the annual report and the dashboard's school-year chart."
        />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null} Save settings
      </Button>
    </form>
  )
}
