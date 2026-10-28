import { describe, expect, it } from "vitest"

import { can, canEditAsset, type Permission, type Role } from "@/lib/permissions"

// The role permissions table, written out independently so a change to
// permissions.ts that doesn't match the intended rules fails this test.
const EXPECTED: Record<Permission, Role[]> = {
  "catalog.view": ["admin", "manager", "staff", "viewer"],
  "circulation.use": ["admin", "manager", "staff"],
  "assets.create": ["admin", "manager", "staff"],
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
const ROLES: Role[] = ["admin", "manager", "staff", "viewer"]

describe("permission map", () => {
  for (const [permission, allowed] of Object.entries(EXPECTED) as [Permission, Role[]][]) {
    for (const role of ROLES) {
      const expected = allowed.includes(role)
      it(`${role} ${expected ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(expected)
      })
    }
  }

  it("staff can edit only the items they added; admins and managers can edit any", () => {
    expect(canEditAsset("staff", "u1", "u1")).toBe(true)
    expect(canEditAsset("staff", "u1", "u2")).toBe(false)
    expect(canEditAsset("staff", "u1", null)).toBe(false)
    expect(canEditAsset("manager", "u1", "u2")).toBe(true)
    expect(canEditAsset("viewer", "u1", "u1")).toBe(false)
  })

  it("denies everything when there is no role (signed out or deactivated)", () => {
    expect(can(null, "catalog.view")).toBe(false)
    expect(can(undefined, "circulation.use")).toBe(false)
  })
})
