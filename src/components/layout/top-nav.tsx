"use client"

import { BookOpen, ChevronDown, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { GlobalSearch } from "@/components/layout/global-search"
import { Logo } from "@/components/layout/logo"
import { ADMIN_NAV, isActivePath, NAV_GROUPS, PRIMARY_NAV } from "@/components/layout/nav-items"
import { UserMenu } from "@/components/layout/user-menu"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { can, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"

type Props = {
  user: { name: string; email: string; role: Role }
  institutionName: string
}

const linkClass = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
    active ? "bg-white/15 text-white" : "text-brand-muted hover:bg-white/10 hover:text-white",
  )

/**
 * The dark green bar at the top of every signed-in page. It shares its color
 * with each page's hero band below it, so the two read as one header. Links a
 * role can't use are hidden (RLS still enforces the rules on the server).
 */
export function TopNav({ user, institutionName }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const primary = PRIMARY_NAV.filter((i) => !i.permission || can(user.role, i.permission))
  const admin = ADMIN_NAV.filter((i) => !i.permission || can(user.role, i.permission))
  const adminActive = admin.some((i) => isActivePath(pathname, i))

  return (
    <header
      data-band
      data-print-hide
      className="sticky top-0 z-30 border-b border-white/10 bg-brand text-brand-foreground"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* Phones and tablets: everything lives in a slide-out menu. */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 text-white hover:bg-white/10 hover:text-white xl:hidden"
              aria-label="Open menu"
            >
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[18rem] border-white/10 bg-brand p-0 text-brand-foreground" data-band>
            <SheetHeader className="border-b border-white/10 p-4">
              <SheetTitle className="text-white">
                <Logo onDark subtitle={institutionName} />
              </SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
            </SheetHeader>
            <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
              {NAV_GROUPS.map((group) => {
                const items = group.items.filter((i) => !i.permission || can(user.role, i.permission))
                if (items.length === 0) return null
                return (
                  <div key={group.label} className="mb-4">
                    <p className="mb-1 px-3 text-xs font-bold tracking-[0.16em] text-lime uppercase">{group.label}</p>
                    <ul>
                      {items.map((item) => {
                        const active = isActivePath(pathname, item)
                        return (
                          <li key={item.href + item.title}>
                            <Link
                              href={item.href}
                              data-nav
                              aria-current={active ? "page" : undefined}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                                active
                                  ? "bg-white/15 text-white"
                                  : "text-brand-muted hover:bg-white/10 hover:text-white",
                              )}
                            >
                              <item.icon className="size-4" aria-hidden="true" />
                              {item.title}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" data-nav className="mr-2 rounded-lg">
          <Logo onDark subtitle={institutionName} className="[&>span:last-child]:hidden sm:[&>span:last-child]:flex" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 xl:flex">
          {primary.map((item) => {
            const active = isActivePath(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                data-nav
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                {item.title}
              </Link>
            )
          })}
          {admin.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={linkClass(adminActive)} aria-current={adminActive ? "page" : undefined}>
                Admin <ChevronDown className="size-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {admin.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>
                      <item.icon aria-hidden="true" /> {item.title}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Link
            href="/help"
            data-nav
            aria-current={pathname === "/help" ? "page" : undefined}
            className={linkClass(pathname === "/help")}
          >
            <BookOpen className="size-3.5" aria-hidden="true" /> Help
          </Link>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <GlobalSearch onDark />
          <UserMenu name={user.name} email={user.email} role={user.role} onDark />
        </div>
      </div>
    </header>
  )
}

/**
 * Shown while the signed-in user loads. Static (no URL reads), so it can be
 * part of the instantly-served page shell.
 */
export function TopNavFallback() {
  return (
    <header
      data-band
      data-print-hide
      className="sticky top-0 z-30 border-b border-white/10 bg-brand text-brand-foreground"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo onDark />
        <div className="ml-6 hidden gap-2 xl:flex" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="h-4 w-20 animate-pulse rounded-full bg-white/15" />
          ))}
        </div>
        <span className="ml-auto size-9 animate-pulse rounded-full bg-white/15" aria-hidden="true" />
      </div>
    </header>
  )
}
