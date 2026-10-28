// Admin-defined extra fields per category ("ISBN" for textbooks, "MAC address"
// for Chromebooks). The definitions live in categories.custom_field_schema and
// the values in assets.custom_fields.

import { z } from "zod"

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "select"] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export const customFieldDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "Keys use lowercase letters, numbers and underscores."),
  label: z.string().trim().min(1, "Give the field a label.").max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(60)).max(50),
})

export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>

export const customFieldSchemaList = z
  .array(customFieldDefinitionSchema)
  .max(20, "Use at most 20 custom fields per category.")
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
    error: "Each field needs a different name.",
  })
  .refine((fields) => fields.every((f) => f.type !== "select" || f.options.length > 0), {
    error: "Dropdown fields need at least one option.",
  })

/** Reads the jsonb column defensively: bad entries are dropped, not crashed on. */
export function parseCustomFieldSchema(value: unknown): CustomFieldDefinition[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = customFieldDefinitionSchema.safeParse({ options: [], required: false, ...item })
    return parsed.success ? [parsed.data] : []
  })
}

/** Turns a label like "MAC address" into a key like "mac_address". */
export function toFieldKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  return /^[a-z]/.test(key) ? key : `field_${key}`.slice(0, 40)
}

export type CustomFieldValues = Record<string, string | number | null>

/**
 * Checks submitted values against a category's field definitions. Returns the
 * cleaned values (only known keys, numbers as numbers) or per-field errors.
 */
export function validateCustomFields(
  definitions: CustomFieldDefinition[],
  raw: Record<string, unknown>
): { ok: true; values: CustomFieldValues } | { ok: false; errors: Record<string, string> } {
  const values: CustomFieldValues = {}
  const errors: Record<string, string> = {}

  for (const def of definitions) {
    const input = raw[def.key]
    const str = input === null || input === undefined ? "" : String(input).trim()

    if (str === "") {
      if (def.required) errors[def.key] = `${def.label} is required.`
      else values[def.key] = null
      continue
    }

    switch (def.type) {
      case "number": {
        const n = Number(str)
        if (!Number.isFinite(n)) errors[def.key] = `${def.label} must be a number.`
        else values[def.key] = n
        break
      }
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || Number.isNaN(Date.parse(str))) {
          errors[def.key] = `${def.label} must be a valid date.`
        } else values[def.key] = str
        break
      case "select":
        if (!def.options.includes(str)) errors[def.key] = `Pick a value for ${def.label} from the list.`
        else values[def.key] = str
        break
      default:
        if (str.length > 500) errors[def.key] = `${def.label} is too long.`
        else values[def.key] = str
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values }
}
