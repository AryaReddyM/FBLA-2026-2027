"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { applyFieldErrors, FormAlert, TextField } from "@/components/forms/fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { signUp } from "@/lib/actions/auth"
import { signUpSchema } from "@/lib/validation/auth"

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: "", email: "", password: "" },
  })

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await signUp(values)
      if (!result) return
      if (result.ok) setConfirmEmail(values.email)
      else {
        setError(result.error)
        applyFieldErrors(form.setError, result.fieldErrors)
      }
    })
  })

  if (confirmEmail) {
    return (
      <Alert>
        <MailCheck aria-hidden="true" />
        <AlertTitle>Confirm your email</AlertTitle>
        <AlertDescription>
          We sent a confirmation link to {confirmEmail}. Open it on this device to finish signing up.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={error} />
      <FieldGroup className="gap-4">
        <TextField control={form.control} name="full_name" label="Full name" autoComplete="name" placeholder="Morgan Lee" required />
        <TextField
          control={form.control}
          name="email"
          label="School email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@school.org"
          required
        />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters."
          required
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          Create account
        </Button>
      </FieldGroup>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  )
}
