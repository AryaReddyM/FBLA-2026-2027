"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, ImagePlus, KeyRound, Laptop, ScanLine, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { applyFieldErrors, FormAlert, SelectField, TextareaField, TextField } from "@/components/forms/fields"
import { ScannerDialog } from "@/components/scanner/scanner-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { findDuplicates, saveAsset, uploadAssetPhoto, type DuplicateMatch } from "@/lib/actions/assets"
import { compressImage } from "@/lib/image"
import {
  BILLING_CYCLE_LABELS,
  CONDITION_LABELS,
  FUNDING_SOURCES,
  LICENSE_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/labels"
import { parseScannedCode } from "@/lib/scan"
import { cn } from "@/lib/utils"
import { assetFormSchema, EDITABLE_STATUSES, type AssetFormInput, type AssetFormValues } from "@/lib/validation/asset"
import type { CustomFieldDefinition } from "@/lib/validation/custom-fields"
import type { Enums } from "@/types/database"

export type CategoryChoice = {
  id: string
  label: string
  kind: Enums<"asset_kind">
  custom_fields: CustomFieldDefinition[]
}

type Props = {
  mode: "create" | "edit"
  assetId?: string
  defaultValues: AssetFormInput
  categories: CategoryChoice[]
  locations: { value: string; label: string }[]
  nextTag: string | null
  canEditTag: boolean
  /** Admins/managers can set Retired or Lost; staff can't. */
  canRetire: boolean
  /** Edit mode: an item out on loan keeps its status until checked in. */
  lockedStatus?: Enums<"asset_status"> | null
}

const options = (labels: Record<string, string>, keys?: readonly string[]) =>
  (keys ?? Object.keys(labels)).map((value) => ({ value, label: labels[value] }))

/** Fields kept for "Save and add another", e.g. 30 Chromebooks from one order. */
const BATCH_KEEP: (keyof AssetFormInput)[] = [
  "kind",
  "name",
  "category_id",
  "location_id",
  "status",
  "condition",
  "manufacturer",
  "model",
  "acquisition_date",
  "acquisition_cost",
  "funding_source",
  "vendor",
]

export function AssetForm({
  mode,
  assetId,
  defaultValues,
  categories,
  locations,
  nextTag,
  canEditTag,
  canRetire,
  lockedStatus,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [scanTarget, setScanTarget] = useState<"asset_tag" | "serial_number" | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [batchCount, setBatchCount] = useState(0)
  const [upcomingTag, setUpcomingTag] = useState(nextTag)
  // Name+model combos the user already confirmed as "not a duplicate" in this batch.
  const acknowledged = useRef(new Set<string>())
  const openedAt = useRef(0)
  const submitIntent = useRef<"view" | "another">("view")

  useEffect(() => {
    openedAt.current = performance.now()
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const form = useForm<AssetFormInput, unknown, AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues,
    mode: "onTouched",
  })
  const { control, handleSubmit, setValue, setError, reset, getValues, setFocus } = form

  const kind = useWatch({ control, name: "kind" })
  const categoryId = useWatch({ control, name: "category_id" })
  const licenseType = useWatch({ control, name: "license_type" })
  const category = categories.find((c) => c.id === categoryId)
  const categoryOptions = categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.label }))

  const dupKey = (v: Pick<AssetFormInput, "name" | "model">) =>
    `${v.name.trim().toLowerCase()}|${v.model.trim().toLowerCase()}`

  async function onPhotoChosen(file: File | undefined) {
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
      setPhotoPreview(URL.createObjectURL(compressed))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That photo couldn't be used.")
    }
  }

  // Defined as a plain function (not handleSubmit(...) at render time) so the
  // refs it reads are only touched when the form is actually submitted.
  const onValid = (values: AssetFormValues) => {
    setFormError(null)
    startTransition(async () => {
      const raw = getValues()

      // Duplicate check before creating: warn instead of silently saving.
      if (mode === "create" && !acknowledged.current.has(dupKey(raw))) {
        const check = await findDuplicates({
          serial_number: raw.serial_number,
          name: raw.name,
          model: raw.model,
          exclude_id: "",
        })
        if (check.ok && check.data.length > 0) {
          setDuplicates(check.data)
          return
        }
      }
      setDuplicates([])

      const result = await saveAsset(mode === "create" ? null : (assetId ?? null), raw, {
        formDurationMs: mode === "create" ? performance.now() - openedAt.current : undefined,
      })
      if (!result.ok) {
        setFormError(result.error)
        applyFieldErrors(setError, result.fieldErrors)
        return
      }

      if (photo) {
        const fd = new FormData()
        fd.set("photo", photo)
        const uploaded = await uploadAssetPhoto(result.data.id, fd)
        if (!uploaded.ok) toast.error(`Saved, but the photo failed: ${uploaded.error}`)
      }

      if (mode === "create" && submitIntent.current === "another") {
        toast.success(`Registered ${values.name} as ${result.data.asset_tag}.`, {
          action: { label: "View", onClick: () => router.push(`/inventory/${result.data.id}`) },
        })
        const kept = Object.fromEntries(BATCH_KEEP.map((k) => [k, raw[k]])) as Partial<AssetFormInput>
        reset({ ...defaultValues, ...kept, custom_fields: {} })
        setPhoto(null)
        setPhotoPreview(null)
        setBatchCount((n) => n + 1)
        openedAt.current = performance.now()
        setUpcomingTag(bumpTag(result.data.asset_tag))
        // The next thing to type for an identical item is usually its serial number.
        setTimeout(() => setFocus("serial_number"), 50)
        return
      }

      toast.success(mode === "create" ? `Registered as ${result.data.asset_tag}.` : "Changes saved.")
      router.push(`/inventory/${result.data.id}`)
    })
  }
  const submit = (event?: React.BaseSyntheticEvent) => handleSubmit(onValid)(event)

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FormAlert message={formError} />

      {batchCount > 0 ? (
        <p role="status" className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          {batchCount} item{batchCount === 1 ? "" : "s"} added in this batch. Category, location and purchase details
          were kept.
        </p>
      ) : null}

      {duplicates.length > 0 ? (
        <Alert className="border-warning/40 bg-warning-soft">
          <AlertTriangle aria-hidden="true" className="text-warning" />
          <AlertTitle>Possible duplicate</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>This looks like something already in the catalog:</p>
            <ul className="space-y-1">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/inventory/${d.id}`}
                    target="_blank"
                    className="font-medium underline underline-offset-4"
                  >
                    {d.name} ({d.asset_tag})
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    {d.reason === "serial"
                      ? `· same serial number ${d.serial_number}`
                      : "· very similar name and model"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {duplicates.some((d) => d.reason === "serial") ? (
                <p className="text-sm">Serial numbers must be unique, so change the serial number to continue.</p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    acknowledged.current.add(dupKey(getValues()))
                    setDuplicates([])
                    submit()
                  }}
                >
                  It&apos;s a different item, save anyway
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setDuplicates([])}>
                Go back and edit
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {mode === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>What are you registering?</CardTitle>
            <CardDescription>
              The form adapts: digital items get seats and renewal dates instead of a room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    setValue("category_id", "")
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                  aria-label="Item kind"
                >
                  {[
                    {
                      value: "physical",
                      title: "Physical item",
                      text: "Chromebooks, textbooks, desks, projectors…",
                      icon: Laptop,
                    },
                    {
                      value: "digital",
                      title: "Digital resource",
                      text: "Software licenses, e-books, subscriptions…",
                      icon: KeyRound,
                    },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={`kind-${opt.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50",
                        field.value === opt.value && "border-primary bg-accent ring-1 ring-primary",
                      )}
                    >
                      <RadioGroupItem id={`kind-${opt.value}`} value={opt.value} className="mt-1" />
                      <opt.icon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                      <span>
                        <span className="block font-medium">{opt.title}</span>
                        <span className="block text-sm text-muted-foreground">{opt.text}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <TextField
              control={control}
              name="name"
              label="Name"
              required
              placeholder={kind === "digital" ? "Canva for Education" : "Chromebook 314"}
              className="sm:col-span-2"
            />

            <Controller
              control={control}
              name="asset_tag"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="field-asset_tag">Asset tag</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      {...field}
                      id="field-asset_tag"
                      className="font-mono uppercase"
                      placeholder={upcomingTag ? `Auto: ${upcomingTag}` : "Assigned automatically"}
                      readOnly={mode === "edit" && !canEditTag}
                      aria-invalid={fieldState.invalid || undefined}
                      aria-describedby="field-asset_tag-desc"
                    />
                    {mode === "create" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScanTarget("asset_tag")}
                        aria-label="Scan an existing label for the asset tag"
                      >
                        <ScanLine aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                  <FieldDescription id="field-asset_tag-desc">
                    {mode === "create"
                      ? "Leave blank to get the next tag automatically, or scan the item's existing label."
                      : canEditTag
                        ? "Changing a tag means reprinting its label."
                        : "Only admins can change a tag."}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <SelectField
              control={control}
              name="category_id"
              label="Category"
              options={categoryOptions}
              allowNone
              noneLabel="No category"
              placeholder="Choose a category"
            />

            {kind === "physical" ? (
              <SelectField
                control={control}
                name="location_id"
                label="Location"
                options={locations}
                allowNone
                noneLabel="No location yet"
                placeholder="Choose a room"
              />
            ) : null}

            {lockedStatus === "checked_out" ? (
              <Field>
                <FieldLabel>Status</FieldLabel>
                <p className="text-sm">Checked out. Check it in at the circulation desk to change its status.</p>
              </Field>
            ) : (
              <SelectField
                control={control}
                name="status"
                label="Status"
                options={options(STATUS_LABELS, canRetire ? EDITABLE_STATUSES : ["available", "in_repair"])}
              />
            )}

            {kind === "physical" ? (
              <SelectField
                control={control}
                name="condition"
                label="Condition"
                options={options(CONDITION_LABELS)}
                allowNone
                noneLabel="Not recorded"
              />
            ) : null}

            <TextareaField
              control={control}
              name="description"
              label="Description"
              rows={2}
              className="sm:col-span-2"
              placeholder="Anything that helps someone recognize it"
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {category && category.custom_fields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{category.label} details</CardTitle>
            <CardDescription>Extra fields your admin set up for this category.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              {category.custom_fields.map((def) =>
                def.type === "select" ? (
                  <SelectField
                    key={def.key}
                    control={control}
                    name={`custom_fields.${def.key}`}
                    label={def.label}
                    required={def.required}
                    options={def.options.map((o) => ({ value: o, label: o }))}
                    allowNone={!def.required}
                  />
                ) : (
                  <TextField
                    key={def.key}
                    control={control}
                    name={`custom_fields.${def.key}`}
                    label={def.label}
                    required={def.required}
                    type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                    inputMode={def.type === "number" ? "decimal" : undefined}
                  />
                ),
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {kind === "physical" ? (
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-3">
              <Controller
                control={control}
                name="serial_number"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="field-serial_number">Serial number</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        id="field-serial_number"
                        className="font-mono"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid || undefined}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScanTarget("serial_number")}
                        aria-label="Scan the serial number barcode"
                      >
                        <ScanLine aria-hidden="true" />
                      </Button>
                    </div>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <TextField control={control} name="manufacturer" label="Manufacturer" placeholder="Acer" />
              <TextField control={control} name="model" label="Model" placeholder="C934-C8R0" />
            </FieldGroup>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>License</CardTitle>
            <CardDescription>
              Seats are assigned and released at the circulation desk or on the Licenses page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-3">
              <SelectField
                control={control}
                name="license_type"
                label="License type"
                options={options(LICENSE_TYPE_LABELS)}
              />
              <TextField
                control={control}
                name="seats_total"
                label="Seats purchased"
                type="number"
                inputMode="numeric"
                min={1}
                disabled={licenseType === "site"}
                description={licenseType === "site" ? "Site licenses are unlimited." : "Leave blank for unlimited."}
              />
              <SelectField
                control={control}
                name="billing_cycle"
                label="Billing cycle"
                options={options(BILLING_CYCLE_LABELS)}
              />
              <TextField
                control={control}
                name="cost_per_period"
                label="Cost per billing period"
                inputMode="decimal"
                placeholder="1,250.00"
              />
              <TextField control={control} name="renewal_date" label="Renewal date" type="date" />
              <TextField control={control} name="expires_at" label="Expires" type="date" />
              <TextField
                control={control}
                name="platform_url"
                label="Admin console URL"
                type="url"
                placeholder="https://"
                className="sm:col-span-2"
              />
              <TextField control={control} name="admin_contact" label="Vendor contact" placeholder="Name or email" />
              <TextField control={control} name="contract_number" label="Contract number" />
              <TextField
                control={control}
                name="license_key_hint"
                label="License key (last 4 only)"
                maxLength={4}
                description="Never store full keys or passwords here."
              />
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Purchase</CardTitle>
          <CardDescription>Used for valuation, depreciation and the annual report.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField control={control} name="acquisition_date" label="Acquired on" type="date" />
            <TextField
              control={control}
              name="acquisition_cost"
              label={kind === "digital" ? "Initial cost" : "Cost"}
              inputMode="decimal"
              placeholder="289.00"
            />
            <Controller
              control={control}
              name="funding_source"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="field-funding_source">Funding source</FieldLabel>
                  <Input {...field} id="field-funding_source" list="funding-sources" placeholder="Title I, PTA…" />
                  <datalist id="funding-sources">
                    {FUNDING_SOURCES.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </Field>
              )}
            />
            <TextField control={control} name="vendor" label="Vendor" placeholder="CDW-G" />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photo and notes</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <FieldSet>
              <FieldLegend variant="label">Photo (optional)</FieldLegend>
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimizable */}
                  <img
                    src={photoPreview}
                    alt="Preview of the selected photo"
                    className="aspect-square w-full rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setPhoto(null)
                      setPhotoPreview(null)
                    }}
                    aria-label="Remove selected photo"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="asset-photo"
                  className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring hover:bg-muted/50"
                >
                  <ImagePlus className="size-6" aria-hidden="true" />
                  <span>Add a photo</span>
                  <input
                    id="asset-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => onPhotoChosen(e.target.files?.[0])}
                  />
                </label>
              )}
              <FieldDescription>Compressed automatically. Max 2 MB.</FieldDescription>
            </FieldSet>
            <TextareaField
              control={control}
              name="notes"
              label="Notes"
              rows={6}
              placeholder="Repairs, accessories, where the charger is…"
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        {mode === "create" ? (
          <Button type="submit" variant="outline" disabled={pending} onClick={() => (submitIntent.current = "another")}>
            Save and add another
          </Button>
        ) : null}
        <Button type="submit" disabled={pending} onClick={() => (submitIntent.current = "view")}>
          {pending ? <Spinner /> : null}
          {mode === "create" ? "Register item" : "Save changes"}
        </Button>
      </div>

      <ScannerDialog
        open={scanTarget !== null}
        onOpenChange={(open) => !open && setScanTarget(null)}
        title={scanTarget === "serial_number" ? "Scan the serial number" : "Scan the existing label"}
        onScan={(text) => {
          if (scanTarget === "asset_tag") {
            const code = parseScannedCode(text)
            setValue("asset_tag", code?.type === "tag" ? code.value : text.trim().toUpperCase(), {
              shouldValidate: true,
            })
          } else if (scanTarget === "serial_number") {
            setValue("serial_number", text.trim(), { shouldValidate: true })
          }
          setScanTarget(null)
        }}
      />
    </form>
  )
}

/** EDU-2026-000123 → EDU-2026-000124, for the "Auto:" hint during batch entry. */
function bumpTag(tag: string): string | null {
  const match = /^(.*-)(\d+)$/.exec(tag)
  if (!match) return null
  return match[1] + String(Number(match[2]) + 1).padStart(match[2].length, "0")
}
