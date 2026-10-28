import {
  ArrowLeftRight,
  BookOpen,
  Boxes,
  Building2,
  FileBarChart,
  FolderTree,
  History,
  Info,
  KeyRound,
  LayoutDashboard,
  MapPin,
  PlusSquare,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { Permission } from "@/lib/permissions"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  permission?: Permission
  /** Highlight only on an exact path match (e.g. "/" shouldn't match everything). */
  exact?: boolean
}

/** Links shown directly in the top bar on large screens. */
export const PRIMARY_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { title: "Catalog", href: "/inventory", icon: Boxes },
  { title: "Circulation", href: "/circulation", icon: ArrowLeftRight, permission: "circulation.use" },
  { title: "Licenses", href: "/licenses", icon: KeyRound },
  { title: "Reports", href: "/reports", icon: FileBarChart, permission: "reports.own" },
  { title: "Activity", href: "/audit", icon: History, permission: "audit.view" },
]

/** The "Admin" menu in the top bar. */
export const ADMIN_NAV: NavItem[] = [
  { title: "Institution", href: "/settings", icon: Building2, permission: "settings.institution", exact: true },
  { title: "Categories", href: "/settings/categories", icon: FolderTree, permission: "settings.catalog" },
  { title: "Locations", href: "/settings/locations", icon: MapPin, permission: "settings.catalog" },
  { title: "Users & roles", href: "/settings/users", icon: Users, permission: "settings.users" },
  { title: "Import CSV", href: "/settings/import", icon: Upload, permission: "import.run" },
]

export type NavGroup = { label: string; items: NavItem[] }

/** Everything, grouped, for the phone menu. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Inventory",
    items: [
      PRIMARY_NAV[0],
      PRIMARY_NAV[1],
      { title: "Add inventory", href: "/inventory/new", icon: PlusSquare, permission: "assets.create" },
      { title: "Circulation desk", href: "/circulation", icon: ArrowLeftRight, permission: "circulation.use" },
      { title: "Digital licenses", href: "/licenses", icon: KeyRound },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/reports", icon: FileBarChart, permission: "reports.own" },
      { title: "Activity log", href: "/audit", icon: History, permission: "audit.view" },
    ],
  },
  { label: "Administration", items: ADMIN_NAV },
  {
    label: "Support",
    items: [
      { title: "Help", href: "/help", icon: BookOpen },
      { title: "About", href: "/about", icon: Info },
    ],
  },
]

export function isActivePath(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
