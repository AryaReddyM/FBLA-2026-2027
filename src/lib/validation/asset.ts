import { z } from "zod"

import { Constants } from "@/types/database"

import {
  id,
  optionalDate,
  optionalEnum,
  optionalId,
  optionalInt,
  optionalMoney,
  optionalText,
  optionalUrl,
  requiredText,
  text,
} from "./common"

const E = Constants.public.Enums

/** Statuses a person can pick directly. "Checked out" only comes from the circulation desk. */
export const EDITABLE_STATUSES = ["available", "in_repair", "retired", "lost"] as const

export const assetFormSchema = z
  .object({
    kind: z.enum(E.asset_kind),
    // Empty = let the database assign the next tag (PREFIX-YYYY-000123).
    asset_tag: text(64)
      .toUpperCase()
      .regex(/^[A-Z0-9-]*$/, "Use letters, numbers and dashes only."),
    name: requiredText(200, "Give the item a name."),
    description: optionalText(2000),
    category_id: optionalId,
    location_id: optionalId,
    status: z.enum(EDITABLE_STATUSES),
    condition: optionalEnum(E.asset_condition),
    serial_number: optionalText(120),
    manufacturer: optionalText(120),
    model: optionalText(120),
    acquisition_date: optionalDate,
    acquisition_cost: optionalMoney,
    funding_source: optionalText(80),
    vendor: optionalText(120),
    notes: optionalText(2000),
    custom_fields: z.record(z.string(), z.string()),
    // Digital-only fields (ignored for physical items)
    seats_total: optionalInt(1, 1_000_000, "a number of seats"),
    license_type: z.enum(E.license_type),
    billing_cycle: z.enum(E.billing_cycle),
    cost_per_period: optionalMoney,
    renewal_date: optionalDate,
    expires_at: optionalDate,
    platform_url: optionalUrl,
    admin_contact: optionalText(200),
    contract_number: optionalText(80),
    license_key_hint: optionalText(4),
  })
  .superRefine((value, ctx) => {
    if (value.acquisition_date && value.acquisition_date > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["acquisition_date"],
        message: "The acquisition date can't be in the future.",
      })
    }
    if (value.kind === "digital" && value.license_type === "site" && value.seats_total !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["seats_total"],
        message: "Site licenses are unlimited. Leave seats blank.",
      })
    }
  })

export type AssetFormInput = z.input<typeof assetFormSchema>
export type AssetFormValues = z.output<typeof assetFormSchema>

export const emptyAssetForm = (overrides: Partial<AssetFormInput> = {}): AssetFormInput => ({
  kind: "physical",
  asset_tag: "",
  name: "",
  description: "",
  category_id: "",
  location_id: "",
  status: "available",
  condition: "new",
  serial_number: "",
  manufacturer: "",
  model: "",
  acquisition_date: "",
  acquisition_cost: "",
  funding_source: "",
  vendor: "",
  notes: "",
  custom_fields: {},
  seats_total: "",
  license_type: "per_seat",
  billing_cycle: "annual",
  cost_per_period: "",
  renewal_date: "",
  expires_at: "",
  platform_url: "",
  admin_contact: "",
  contract_number: "",
  license_key_hint: "",
  ...overrides,
})

export const duplicateCheckSchema = z.object({
  serial_number: z.string().trim().max(120),
  name: z.string().trim().max(200),
  model: z.string().trim().max(120),
  exclude_id: z.union([id, z.literal("")]),
})

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    ids: z.array(id).min(1, "Select at least one item.").max(500),
    location_id: id,
  }),
  z.object({
    action: z.literal("status"),
    ids: z.array(id).min(1, "Select at least one item.").max(500),
    status: z.enum(EDITABLE_STATUSES),
  }),
])

export type BulkAction = z.input<typeof bulkActionSchema>

export const assetStatusChangeSchema = z.object({
  id,
  status: z.enum(EDITABLE_STATUSES),
  note: optionalText(500),
})
