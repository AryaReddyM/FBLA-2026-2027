import { describe, expect, it } from "vitest"

import { can, type Permission, type Role } from "@/lib/permissions"

// The table from CLAUDE.md §7, written out independently so a change to
// permissions.ts that doesn't match the spec fails this test.
const EXPECTED: Record<Permission, Role[]> = {
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

  it("denies everything when there is no role (signed out or deactivated)", () => {
    expect(can(null, "catalog.view")).toBe(false)
    expect(can(undefined, "circulation.use")).toBe(false)
  })
})
