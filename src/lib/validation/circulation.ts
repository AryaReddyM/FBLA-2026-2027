import { z } from "zod"

import { Constants } from "@/types/database"

import { id, optionalEnum, optionalText, requiredText } from "./common"

const E = Constants.public.Enums

export const checkOutSchema = z
  .object({
    asset_id: id,
    borrower_type: z.enum(E.borrower_type),
    borrower_name: requiredText(120, "Enter who is borrowing it."),
    // Student ID number or staff email. Nothing else about students is collected.
    borrower_ref: optionalText(120),
    // Full ISO timestamp computed in the browser (end of the chosen day, local time).
    due_at: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.iso.datetime({ offset: true, error: "Pick a valid due date." }).nullable()),
    condition_out: optionalEnum(E.asset_condition),
    notes: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.due_at && new Date(value.due_at).getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: "custom", path: ["due_at"], message: "The due date must be in the future." })
    }
  })

export type CheckOutInput = z.input<typeof checkOutSchema>
export type CheckOutValues = z.output<typeof checkOutSchema>

export const checkInSchema = z.object({
  checkout_id: id,
  condition_in: z.enum(E.asset_condition, { error: "Choose the item's condition." }),
  notes: optionalText(500),
})

export type CheckInInput = z.input<typeof checkInSchema>
export type CheckInValues = z.output<typeof checkInSchema>

export const lookupSchema = z.object({
  query: z.string().trim().min(1, "Type or scan an asset tag.").max(200),
})
