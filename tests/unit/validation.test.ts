import { describe, expect, it } from "vitest"

import { assetFormSchema, bulkActionSchema, emptyAssetForm } from "@/lib/validation/asset"
import { safeNextPath, signUpSchema } from "@/lib/validation/auth"
import { checkInSchema, checkOutSchema } from "@/lib/validation/circulation"
import { customFieldSchemaList, toFieldKey, validateCustomFields } from "@/lib/validation/custom-fields"
import { institutionSchema } from "@/lib/validation/settings"

const UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e"

describe("asset form", () => {
  it("accepts a minimal physical item and converts blanks to null", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "Chromebook 314" }))
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.category_id).toBeNull()
    expect(r.data.acquisition_cost).toBeNull()
    expect(r.data.asset_tag).toBe("")
  })

  it("requires a name", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "   " }))
    expect(r.success).toBe(false)
  })

  it("parses money with $ and commas", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "Display", acquisition_cost: "$3,895.00" }))
    expect(r.success && r.data.acquisition_cost).toBe(3895)
  })

  it("rejects negative or non-numeric costs", () => {
    expect(assetFormSchema.safeParse(emptyAssetForm({ name: "X", acquisition_cost: "-5" })).success).toBe(false)
    expect(assetFormSchema.safeParse(emptyAssetForm({ name: "X", acquisition_cost: "lots" })).success).toBe(false)
  })

  it("rejects acquisition dates in the future", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "X", acquisition_date: "2999-01-01" }))
    expect(r.success).toBe(false)
  })

  it("uppercases tags and only allows letters, numbers and dashes", () => {
    const ok = assetFormSchema.safeParse(emptyAssetForm({ name: "X", asset_tag: "lhs-0042" }))
    expect(ok.success && ok.data.asset_tag).toBe("LHS-0042")
    expect(assetFormSchema.safeParse(emptyAssetForm({ name: "X", asset_tag: "BAD TAG!" })).success).toBe(false)
  })

  it("never allows 'checked out' to be set by hand", () => {
    const r = assetFormSchema.safeParse({ ...emptyAssetForm({ name: "X" }), status: "checked_out" })
    expect(r.success).toBe(false)
  })

  it("only stores the last 4 characters of a license key", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "Kami", kind: "digital", license_key_hint: "ABCDE-12345" }))
    expect(r.success).toBe(false)
  })

  it("treats site licenses as unlimited", () => {
    const r = assetFormSchema.safeParse(emptyAssetForm({ name: "Canva", kind: "digital", license_type: "site", seats_total: "50" }))
    expect(r.success).toBe(false)
  })

  it("bulk actions can't target checked-out status and cap at 500 items", () => {
    expect(bulkActionSchema.safeParse({ action: "status", ids: [UUID], status: "checked_out" }).success).toBe(false)
    expect(bulkActionSchema.safeParse({ action: "move", ids: Array(501).fill(UUID), location_id: UUID }).success).toBe(false)
    expect(bulkActionSchema.safeParse({ action: "move", ids: [UUID], location_id: UUID }).success).toBe(true)
  })
})

describe("circulation", () => {
  it("requires a borrower name", () => {
    const r = checkOutSchema.safeParse({ asset_id: UUID, borrower_type: "student", borrower_name: "", borrower_ref: "10234", due_at: "", condition_out: "", notes: "" })
    expect(r.success).toBe(false)
  })

  it("rejects due dates in the past", () => {
    const r = checkOutSchema.safeParse({
      asset_id: UUID,
      borrower_type: "student",
      borrower_name: "Sam",
      borrower_ref: "10234",
      due_at: "2020-01-01T23:59:00.000Z",
      condition_out: "",
      notes: "",
    })
    expect(r.success).toBe(false)
  })

  it("requires a condition on check-in", () => {
    expect(checkInSchema.safeParse({ checkout_id: UUID, condition_in: "", notes: "" }).success).toBe(false)
    expect(checkInSchema.safeParse({ checkout_id: UUID, condition_in: "broken", notes: "" }).success).toBe(true)
  })
})

describe("settings", () => {
  it("asset tag prefix is 2–8 capitals or digits", () => {
    const base = { name: "Central High School", default_loan_days: "14", fiscal_year_start_month: "7" }
    expect(institutionSchema.safeParse({ ...base, asset_tag_prefix: "lhs" }).success).toBe(true)
    expect(institutionSchema.safeParse({ ...base, asset_tag_prefix: "L" }).success).toBe(false)
    expect(institutionSchema.safeParse({ ...base, asset_tag_prefix: "TOO-LONG-1" }).success).toBe(false)
  })
})

describe("custom fields", () => {
  const defs = [
    { key: "isbn", label: "ISBN", type: "text" as const, required: true, options: [] },
    { key: "pages", label: "Pages", type: "number" as const, required: false, options: [] },
    { key: "subject", label: "Subject", type: "select" as const, required: false, options: ["Math", "Science"] },
  ]

  it("validates required, number and select fields", () => {
    expect(validateCustomFields(defs, { isbn: "", pages: "x", subject: "Art" })).toEqual({
      ok: false,
      errors: { isbn: "ISBN is required.", pages: "Pages must be a number.", subject: "Pick a value for Subject from the list." },
    })
    expect(validateCustomFields(defs, { isbn: "978", pages: "320", subject: "Math", junk: "ignored" })).toEqual({
      ok: true,
      values: { isbn: "978", pages: 320, subject: "Math" },
    })
  })

  it("builder rejects duplicate keys and empty dropdowns", () => {
    expect(customFieldSchemaList.safeParse([defs[0], defs[0]]).success).toBe(false)
    expect(customFieldSchemaList.safeParse([{ ...defs[2], options: [] }]).success).toBe(false)
  })

  it("turns labels into keys", () => {
    expect(toFieldKey("MAC address")).toBe("mac_address")
    expect(toFieldKey("2nd edition")).toBe("field_2nd_edition")
  })
})

describe("auth", () => {
  it("never redirects to another site after sign-in", () => {
    expect(safeNextPath("/inventory?q=1")).toBe("/inventory?q=1")
    expect(safeNextPath("https://evil.example")).toBe("/")
    expect(safeNextPath("//evil.example")).toBe("/")
    expect(safeNextPath(null)).toBe("/")
  })

  it("requires 8+ character passwords on sign-up", () => {
    expect(signUpSchema.safeParse({ full_name: "A", email: "a@b.org", password: "short" }).success).toBe(false)
  })
})
