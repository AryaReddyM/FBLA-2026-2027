"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FolderTree, Pencil, Plus, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { applyFieldErrors, FormAlert, SelectField, TextField } from "@/components/forms/fields"
import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldError, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteCategory, saveCategory } from "@/lib/actions/settings"
import { KIND_LABELS } from "@/lib/labels"
import { CUSTOM_FIELD_TYPES, toFieldKey, type CustomFieldDefinition } from "@/lib/validation/custom-fields"
import { categorySchema, type CategoryInput } from "@/lib/validation/settings"
import type { Enums } from "@/types/database"

export type CategoryRow = {
  id: string
  name: string
  label: string
  kind: Enums<"asset_kind">
  parent_id: string | null
  useful_life_years: number | null
  custom_fields: CustomFieldDefinition[]
  item_count: number
}

const TYPE_LABELS: Record<(typeof CUSTOM_FIELD_TYPES)[number], string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
}

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(category: CategoryRow) {
    if (!window.confirm(`Delete the category “${category.name}”?`)) return
    startTransition(async () => {
      const result = await deleteCategory(category.id)
      if (result.ok) {
        toast.success("Category deleted.")
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" /> Add category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Categories group similar items and set their useful life for depreciation." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label="Categories">
          <Table>
            <caption className="sr-only">Categories</caption>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Useful life</TableHead>
                <TableHead>Custom fields</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell>{KIND_LABELS[c.kind]}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.useful_life_years ? `${c.useful_life_years} yrs` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.custom_fields.length ? c.custom_fields.map((f) => <Badge key={f.key} variant="secondary">{f.label}</Badge>) : <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.item_count}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(c)} disabled={pending} aria-label={`Delete ${c.name}`}>
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add a category" : "Edit category"}</DialogTitle>
            <DialogDescription>Custom fields appear on the register form for items in this category.</DialogDescription>
          </DialogHeader>
          {editing !== null ? (
            <CategoryForm
              key={editing === "new" ? "new" : editing.id}
              category={editing === "new" ? null : editing}
              parents={categories.filter((c) => !c.parent_id && (editing === "new" || c.id !== editing.id))}
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

function CategoryForm({ category, parents, onDone }: { category: CategoryRow | null; parents: CategoryRow[]; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<CategoryInput, unknown, z.output<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      id: category?.id ?? "",
      name: category?.name ?? "",
      kind: category?.kind ?? "physical",
      parent_id: category?.parent_id ?? "",
      useful_life_years: category?.useful_life_years ? String(category.useful_life_years) : "",
      custom_field_schema: category?.custom_fields ?? [],
    },
  })
  const fields = useFieldArray({ control: form.control, name: "custom_field_schema" })
  const kind = useWatch({ control: form.control, name: "kind" })
  const schemaErrors = form.formState.errors.custom_field_schema

  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await saveCategory(form.getValues())
      if (result.ok) {
        toast.success("Category saved.")
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
        <TextField control={form.control} name="name" label="Name" required className="sm:col-span-2" />
        <SelectField control={form.control} name="kind" label="Kind" options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField
          control={form.control}
          name="parent_id"
          label="Inside (optional)"
          allowNone
          noneLabel="Top level"
          options={parents.filter((p) => p.kind === kind).map((p) => ({ value: p.id, label: p.name }))}
        />
        {kind === "physical" ? (
          <TextField
            control={form.control}
            name="useful_life_years"
            label="Useful life (years)"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            description="Used for straight-line depreciation. Leave blank to inherit from the parent."
          />
        ) : null}
      </FieldGroup>

      <FieldSet className="space-y-3">
        <FieldLegend>Custom fields</FieldLegend>
        {fields.fields.length === 0 ? <p className="text-sm text-muted-foreground">No custom fields. Add one for details like ISBN or MAC address.</p> : null}
        <ul className="space-y-3">
          {fields.fields.map((f, index) => (
            <li key={f.id} className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
                <Controller
                  control={form.control}
                  name={`custom_field_schema.${index}.label`}
                  render={({ field, fieldState }) => (
                    <div className="space-y-1">
                      <Label htmlFor={`cf-label-${index}`}>Field label</Label>
                      <Input
                        {...field}
                        id={`cf-label-${index}`}
                        placeholder="ISBN"
                        aria-invalid={fieldState.invalid || undefined}
                        onChange={(e) => {
                          field.onChange(e)
                          // Keys are generated from the label for new fields so admins never see them.
                          if (!category?.custom_fields.some((c) => c.key === form.getValues(`custom_field_schema.${index}.key`))) {
                            form.setValue(`custom_field_schema.${index}.key`, toFieldKey(e.target.value))
                          }
                        }}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </div>
                  )}
                />
                <Controller
                  control={form.control}
                  name={`custom_field_schema.${index}.type`}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label htmlFor={`cf-type-${index}`}>Type</Label>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={`cf-type-${index}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTOM_FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => fields.remove(index)} aria-label={`Remove field ${index + 1}`}>
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Controller
                  control={form.control}
                  name={`custom_field_schema.${index}.required`}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                      Required
                    </label>
                  )}
                />
                <OptionsEditor index={index} form={form} />
              </div>
            </li>
          ))}
        </ul>
        {schemaErrors?.message || schemaErrors?.root?.message ? (
          <p role="alert" className="text-sm text-destructive">
            {schemaErrors.message ?? schemaErrors.root?.message}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fields.append({ key: "", label: "", type: "text", required: false, options: [] })}
          disabled={fields.fields.length >= 20}
        >
          <Plus aria-hidden="true" /> Add field
        </Button>
      </FieldSet>

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Save category
        </Button>
      </DialogFooter>
    </form>
  )
}

type CategoryFormApi = ReturnType<typeof useForm<CategoryInput, unknown, z.output<typeof categorySchema>>>

/** Dropdown options, edited as a comma-separated list. Only shown for "Dropdown" fields. */
function OptionsEditor({ index, form }: { index: number; form: CategoryFormApi }) {
  const type = useWatch({ control: form.control, name: `custom_field_schema.${index}.type` })
  const options = useWatch({ control: form.control, name: `custom_field_schema.${index}.options` })
  const [text, setText] = useState((options ?? []).join(", "))
  if (type !== "select") return null
  return (
    <div className="min-w-60 flex-1 space-y-1">
      <Label htmlFor={`cf-options-${index}`}>Options (comma-separated)</Label>
      <Input
        id={`cf-options-${index}`}
        value={text}
        placeholder="Math, Science, English"
        onChange={(e) => {
          setText(e.target.value)
          form.setValue(
            `custom_field_schema.${index}.options`,
            e.target.value.split(",").map((o) => o.trim()).filter(Boolean)
          )
        }}
      />
    </div>
  )
}
