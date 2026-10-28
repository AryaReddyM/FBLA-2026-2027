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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sendMagicLink, signInWithPassword } from "@/lib/actions/auth"
import { magicLinkSchema, passwordLoginSchema } from "@/lib/validation/auth"

type Props = {
  next?: string
  initialError: string | null
}

export function LoginForm({ next, initialError }: Props) {
  const [error, setError] = useState<string | null>(initialError)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const passwordForm = useForm({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
  })
  const linkForm = useForm({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  })

  const onPassword = passwordForm.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      // On success the action redirects, so we only get here on failure.
      const result = await signInWithPassword(values, next)
      if (result && !result.ok) {
        setError(result.error)
        applyFieldErrors(passwordForm.setError, result.fieldErrors)
      }
    })
  })

  const onMagicLink = linkForm.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await sendMagicLink(values, next)
      if (result.ok) setLinkSentTo(values.email)
      else setError(result.error)
    })
  })

  return (
    <div className="space-y-5">
      <FormAlert message={error} />

      <Tabs defaultValue="password" onValueChange={() => setError(null)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="link">Email me a link</TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="pt-3">
          <form onSubmit={onPassword} noValidate>
            <FieldGroup className="gap-4">
              <TextField
                control={passwordForm.control}
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@school.org"
                required
              />
              <TextField
                control={passwordForm.control}
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
              />
              <div className="-mt-1 text-right text-sm">
                <Link href="/forgot-password" className="text-primary underline underline-offset-4">
                  Forgot your password?
                </Link>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </TabsContent>

        <TabsContent value="link" className="pt-3">
          {linkSentTo ? (
            <Alert>
              <MailCheck aria-hidden="true" />
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>
                If an account exists for {linkSentTo}, a sign-in link is on its way. It works once and expires in an hour.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={onMagicLink} noValidate>
              <FieldGroup className="gap-4">
                <TextField
                  control={linkForm.control}
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@school.org"
                  description="We'll email you a one-time link. No password needed."
                  required
                />
                <Button type="submit" size="lg" className="w-full" disabled={pending}>
                  {pending ? <Spinner /> : null}
                  Send sign-in link
                </Button>
              </FieldGroup>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-center text-sm text-muted-foreground">
        New to EduTrack?{" "}
        <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  )
}
