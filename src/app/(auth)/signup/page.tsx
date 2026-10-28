import type { Metadata } from "next"

import { SignUpForm } from "@/components/auth/signup-form"

export const metadata: Metadata = { title: "Create an account" }

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          New accounts start with staff access (the first three accounts at a new school are admins). An admin can change your role afterwards.
        </p>
      </div>
      <SignUpForm />
    </div>
  )
}
