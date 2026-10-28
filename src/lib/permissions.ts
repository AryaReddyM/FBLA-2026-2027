// Mirrors the permissions table in CLAUDE.md §7 so the UI can hide buttons a
// user can't use. This is convenience only: RLS policies in the database are
// what actually enforce it.

import type { Enums } from "@/types/database"

export type Role = Enums<"user_role">

export type Permission =
  | "catalog.view"
  | "circulation.use"
  | "assets.write"
  | "assets.retire"
  | "reports.all"
  | "reports.own"
  | "import.run"
  | "settings.catalog"
  | "settings.users"
  | "settings.institution"
  | "audit.view"
  | "impact.view"

const MATRIX: Record<Permission, readonly Role[]> = {
  "catalog.view": ["admin", "manager", "staff", "viewer"],
  "circulation.use": ["admin", "manager", "staff"],
  "assets.write": ["admin", "manager"],
  "assets.retire": ["admin", "manager"],
  "reports.all": ["admin", "manager"],
  "reports.own": ["admin", "manager", "staff"],
  "import.run": ["admin", "manager"],
  "settings.catalog": ["admin"],
  "settings.users": ["admin"],
  "settings.institution": ["admin"],
  "audit.view": ["admin", "manager"],
  "impact.view": ["admin"],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role != null && MATRIX[permission].includes(role)
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff (teacher)",
  viewer: "Viewer",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything, including users, roles, categories, locations and settings.",
  manager: "Register, edit and retire items, run all reports, import, view the audit log.",
  staff: "Check items in and out, and report on their own checkouts.",
  viewer: "Read-only access to the catalog and dashboard.",
}
