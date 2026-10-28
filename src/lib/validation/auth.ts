import { z } from "zod"

const email = z.email({ error: "Enter a valid email address." }).trim().toLowerCase()

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
})

export const magicLinkSchema = z.object({ email })

export const signUpSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name.").max(120),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(72),
})

export const resetRequestSchema = z.object({ email })

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords don't match." })

/** Only allow redirects back into this app (never to another site). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  return next
}
