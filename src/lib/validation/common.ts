// Small building blocks shared by the form schemas.
//
// Form inputs always hand us strings, so these helpers accept a string and turn
// it into the type the database wants: "" becomes null, "289.99" becomes a
// number, and so on. The same schema runs in the browser (instant feedback)
// and again in the Server Action (the check that actually counts).

import { z } from "zod"

export const text = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`)

export const requiredText = (max: number, message = "This field is required.") =>
  z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`)

export const optionalText = (max: number) => text(max).transform((v) => (v === "" ? null : v))

/** "" or "none" → null; anything else must be a UUID. */
export const optionalId = z
  .string()
  .transform((v) => (v === "" || v === "none" ? null : v))
  .pipe(z.guid({ error: "Pick an option from the list." }).nullable())

export const id = z.guid({ error: "Invalid id." })

export const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date({ error: "Enter a valid date." }).nullable())

/** Accepts "$1,299.00", "1299" or "" (→ null). */
export const optionalMoney = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/[$,\s]/g, ""))))
  .pipe(
    z
      .number({ error: "Enter an amount like 289.99." })
      .min(0, "Amount can't be negative.")
      .max(10_000_000, "That amount looks too large.")
      .nullable()
  )

export const optionalInt = (min: number, max: number, label = "a whole number") =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number({ error: `Enter ${label}.` })
        .int(`Enter ${label}.`)
        .min(min, `Must be at least ${min}.`)
        .max(max, `Must be at most ${max}.`)
        .nullable()
    )

export const requiredInt = (min: number, max: number, label = "a whole number") =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .transform((v) => Number(v))
    .pipe(
      z
        .number({ error: `Enter ${label}.` })
        .int(`Enter ${label}.`)
        .min(min, `Must be at least ${min}.`)
        .max(max, `Must be at most ${max}.`)
    )

/** Optional enum: "" → null. */
export function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((v) => (v === "" || v === "none" ? null : v))
    .pipe(z.enum(values).nullable())
}

export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.url({ error: "Enter a full web address starting with https://", protocol: /^https?$/ }).nullable())

/** Flattens Zod issues into { field: [messages] } for the forms. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}
