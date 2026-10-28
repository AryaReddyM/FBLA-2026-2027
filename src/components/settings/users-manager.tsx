"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { applyFieldErrors, FormAlert, SelectField, TextField } from "@/components/forms/fields"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createUser, setUserPassword, updateUser } from "@/lib/actions/settings"
import { formatDate, initials } from "@/lib/format"
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions"
import { createUserSchema, type CreateUserInput } from "@/lib/validation/settings"

export type UserRow = {
  id: string
  full_name: string
  email: string
  role: Role
  department: string | null
  is_active: boolean
  created_at: string
}

const ROLES = Object.keys(ROLE_LABELS) as Role[]

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null)
  const [pending, startTransition] = useTransition()

  function update(user: UserRow, patch: Partial<Pick<UserRow, "role" | "is_active">>) {
    startTransition(async () => {
      const result = await updateUser({ id: user.id, role: patch.role ?? user.role, is_active: patch.is_active ?? user.is_active })
      if (result.ok) {
        toast.success(`Updated ${user.full_name}.`)
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="flex gap-1.5">
              <dt className="font-medium">{ROLE_LABELS[r]}:</dt>
              <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label="Users">
        <Table>
          <caption className="sr-only">User accounts and roles</caption>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="w-52">Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const self = u.id === currentUserId
              return (
                <TableRow key={u.id} className={u.is_active ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(u.full_name || u.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {u.full_name || "—"} {self ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.department ? ` · ${u.department}` : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => update(u, { role: v as Role })} disabled={pending}>
                      <SelectTrigger className="w-44" size="sm" aria-label={`Role for ${u.full_name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active}
                        disabled={pending || self}
                        onCheckedChange={(checked) => update(u, { is_active: checked })}
                        aria-label={`${u.full_name} can sign in`}
                      />
                      <span className="text-sm">{u.is_active ? "Active" : "Deactivated"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setPasswordFor(u)}>
                      <KeyRound aria-hidden="true" /> Set password
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              They can sign in right away on any device with this email and starting password. Ask them to change it from My profile.
            </DialogDescription>
          </DialogHeader>
          {adding ? (
            <CreateUserForm
              onDone={() => {
                setAdding(false)
                router.refresh()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordFor !== null} onOpenChange={(open) => !open && setPasswordFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>For {passwordFor?.full_name}. Share it with them privately.</DialogDescription>
          </DialogHeader>
          {passwordFor ? <SetPasswordForm user={passwordFor} onDone={() => setPasswordFor(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<CreateUserInput, unknown, z.output<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { full_name: "", email: "", role: "staff", department: "", password: "" },
  })
  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await createUser(form.getValues())
      if (result.ok) {
        toast.success("Account created.")
        onDone()
      } else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="full_name" label="Full name" required autoComplete="off" />
        <TextField control={form.control} name="email" label="Email" type="email" required autoComplete="off" />
        <SelectField control={form.control} name="role" label="Role" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        <TextField control={form.control} name="department" label="Department" placeholder="Math" />
        <TextField
          control={form.control}
          name="password"
          label="Starting password"
          type="text"
          autoComplete="new-password"
          required
          description="At least 8 characters."
          className="sm:col-span-2"
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Create account
        </Button>
      </DialogFooter>
    </form>
  )
}

function SetPasswordForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [password, setPassword] = useState("")
  const [pending, startTransition] = useTransition()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await setUserPassword(user.id, password)
          if (result.ok) {
            toast.success("Password updated.")
            onDone()
          } else toast.error(result.error)
        })
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending || password.length < 8}>
          {pending ? <Spinner /> : null} Update password
        </Button>
      </DialogFooter>
    </form>
  )
}
