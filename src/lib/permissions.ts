// Mirrors the role permissions table so the UI can hide buttons a
// user can't use. This is convenience only: RLS policies in the database are
// what actually enforce it.

import type { Enums } from "@/types/database"

export type Role = Enums<"user_role">

export type Permission =
  | "catalog.view"
  | "circulation.use"
  | "assets.create"
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
  // Anyone who works with inventory can add items (owner request, Oct 2026).
  "assets.create": ["admin", "manager", "staff"],
  // Editing ANY item, bulk changes. Staff can still edit items they added (see canEditAsset).
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

/**
 * Can this person edit this particular item? Admins and managers can edit any
 * item; staff can edit the ones they added. Mirrors the RLS update policy.
 */
export function canEditAsset(
  role: Role | null | undefined,
  userId: string,
  createdBy: string | null | undefined,
): boolean {
  return can(role, "assets.write") || (role === "staff" && !!createdBy && createdBy === userId)
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
  staff: "Add items and edit the ones they added, check items in and out, and report on their own checkouts.",
  viewer: "Read-only access to the catalog and dashboard.",
}
