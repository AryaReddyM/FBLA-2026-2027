"use client"

import { LogOut, UserRound } from "lucide-react"
import Link from "next/link"
import { useTransition } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/actions/auth"
import { initials } from "@/lib/format"
import { ROLE_LABELS, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export function UserMenu({
  name,
  email,
  role,
  onDark = false,
}: {
  name: string
  email: string
  role: Role
  onDark?: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 gap-2 px-1.5",
            onDark ? "2xl:pr-3" : "sm:pr-3",
            onDark &&
              "text-white hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white",
          )}
        >
          <span className="sr-only">Account menu: </span>
          <Avatar className="size-8">
            <AvatarFallback
              className={cn(
                "text-xs font-bold",
                onDark ? "bg-lime text-lime-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {/* Visually hidden on phones, but still part of the button's accessible name. */}
          <span
            className={cn(
              "sr-only flex-col items-start leading-tight",
              onDark ? "2xl:not-sr-only 2xl:flex" : "sm:not-sr-only sm:flex",
            )}
          >
            <span className="max-w-36 truncate text-sm font-medium">{name}</span>
            <span className={cn("text-xs", onDark ? "text-brand-muted" : "text-muted-foreground")}>
              {ROLE_LABELS[role]}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden="true" /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => startTransition(() => signOut())}>
          <LogOut aria-hidden="true" /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
