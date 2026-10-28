"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { fail, ok, type ActionResult } from "@/lib/action-result"
import { createClient } from "@/lib/supabase/server"
import { fieldErrorsOf } from "@/lib/validation/common"
import {
  magicLinkSchema,
  newPasswordSchema,
  passwordLoginSchema,
  resetRequestSchema,
  safeNextPath,
  signUpSchema,
} from "@/lib/validation/auth"

async function siteOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto}://${host}`
}

export async function signInWithPassword(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = passwordLoginSchema.safeParse(input)
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Please confirm your email first. Check your inbox for the link.")
    }
    return fail("That email and password don't match an account.")
  }
  redirect(safeNextPath(next))
}

export async function sendMagicLink(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Only existing accounts get a link; new people sign up or are added by an admin.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
    },
  })
  // Same message whether or not the account exists, so the form can't be used
  // to find out who has an account.
  if (error && error.status !== 400 && error.code !== "otp_disabled") {
    return fail("We couldn't send the email right now. Try again in a minute.")
  }
  return ok()
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) {
    if (error.code === "user_already_exists") return fail("An account with that email already exists. Try signing in.")
    if (error.code === "weak_password") return fail("Choose a stronger password.")
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return fail(
        "Too many sign-up emails were sent in the last hour, so we couldn't send your confirmation email. Try again later, or ask an admin to add your account in Admin → Users & roles.",
      )
    }
    return fail(error.message)
  }
  // With email confirmation turned off in Supabase, the user is signed in immediately.
  if (data.session) redirect("/")
  return ok({ needsConfirmation: true })
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const origin = await siteOrigin()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/profile?reset=1")}`,
  })
  return ok()
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input)
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrorsOf(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === "same_password") return fail("That's your current password. Choose a new one.")
    return fail(error.message)
  }
  return ok()
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
