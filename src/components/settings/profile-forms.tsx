"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { applyFieldErrors, FormAlert, TextField } from "@/components/forms/fields"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { updatePassword } from "@/lib/actions/auth"
import { updateMyProfile } from "@/lib/actions/settings"
import { newPasswordSchema } from "@/lib/validation/auth"
import { profileSchema, type ProfileInput } from "@/lib/validation/settings"

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<ProfileInput, unknown, z.output<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: defaults })

  const onSubmit = form.handleSubmit(() => {
    setError(null)
    startTransition(async () => {
      const result = await updateMyProfile(form.getValues())
      if (result.ok) {
        toast.success("Profile saved.")
        router.refresh()
      } else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="full_name" label="Full name" autoComplete="name" required />
        <TextField control={form.control} name="department" label="Department" placeholder="Science" />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null} Save
      </Button>
    </form>
  )
}

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } })

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await updatePassword(values)
      if (result.ok) {
        toast.success("Password changed.")
        form.reset()
      } else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="password" label="New password" type="password" autoComplete="new-password" required />
        <TextField control={form.control} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null} Change password
      </Button>
    </form>
  )
}
