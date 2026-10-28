import { z } from "zod"

import { Constants } from "@/types/database"

import { id, optionalId, optionalInt, optionalText, requiredInt, requiredText } from "./common"
import { customFieldSchemaList } from "./custom-fields"

const E = Constants.public.Enums

export const institutionSchema = z.object({
  name: requiredText(120, "Enter the school or district name."),
  asset_tag_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Use 2 to 8 capital letters or numbers, like EDU or LHS."),
  default_loan_days: requiredInt(1, 365, "a number of days"),
  fiscal_year_start_month: requiredInt(1, 12, "a month"),
})

export type InstitutionInput = z.input<typeof institutionSchema>

export const categorySchema = z.object({
  id: z.union([id, z.literal("")]),
  name: requiredText(80, "Give the category a name."),
  kind: z.enum(E.asset_kind),
  parent_id: optionalId,
  useful_life_years: optionalInt(1, 50, "a number of years"),
  custom_field_schema: customFieldSchemaList,
})

export type CategoryInput = z.input<typeof categorySchema>

export const locationSchema = z.object({
  id: z.union([id, z.literal("")]),
  name: requiredText(80, "Give the location a name."),
  building: optionalText(80),
  room: optionalText(40),
  type: z.enum(E.location_type),
  manager_id: optionalId,
})

export type LocationInput = z.input<typeof locationSchema>

export const createUserSchema = z.object({
  full_name: requiredText(120, "Enter the person's name."),
  email: z.email({ error: "Enter a valid email address." }).trim().toLowerCase(),
  role: z.enum(E.user_role),
  department: optionalText(80),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use at most 72 characters."),
})

export type CreateUserInput = z.input<typeof createUserSchema>

export const updateUserSchema = z.object({
  id,
  role: z.enum(E.user_role),
  is_active: z.boolean(),
})

export const profileSchema = z.object({
  full_name: requiredText(120, "Enter your name."),
  department: optionalText(80),
})

export type ProfileInput = z.input<typeof profileSchema>
