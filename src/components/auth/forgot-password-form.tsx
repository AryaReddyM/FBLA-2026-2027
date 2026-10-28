"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { FormAlert, TextField } from "@/components/forms/fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { requestPasswordReset } from "@/lib/actions/auth"
import { resetRequestSchema } from "@/lib/validation/auth"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "" } })

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if (result.ok) setSent(true)
      else setError(result.error)
    })
  })

  if (sent) {
    return (
      <Alert>
        <MailCheck aria-hidden="true" />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          If an account exists for that address, a reset link is on its way. You can also ask an admin to set a new password for you.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={error} />
      <FieldGroup className="gap-4">
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          Send reset link
        </Button>
      </FieldGroup>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
