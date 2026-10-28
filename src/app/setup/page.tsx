import type { Metadata } from "next"

import { Logo } from "@/components/layout/logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Finish setup" }

const STEPS = [
  {
    title: "Create a Supabase project",
    body: "Go to supabase.com, create a free project, and wait for it to finish starting.",
  },
  {
    title: "Fill in .env.local",
    body: "Copy the Project URL, the publishable key, the secret key and the session pooler connection string into .env.local at the project root, plus the email and password for the first admin account.",
  },
  {
    title: "Run the setup script",
    body: "In a terminal: npm run setup. It creates the tables, security rules, the admin account and starter categories.",
  },
  {
    title: "Restart the dev server",
    body: "Stop npm run dev (Ctrl+C) and start it again so it picks up the new settings.",
  },
]

/** Shown instead of the app until Supabase settings are present (see proxy.ts). */
export default function SetupPage() {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 p-6">
      <Logo />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Almost there: connect a database</CardTitle>
          <CardDescription>
            EduTrack stores everything in Supabase so accounts and data work on every device. This page appears because
            the Supabase settings in <code className="font-mono">.env.local</code> are empty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="block text-sm text-muted-foreground">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">Full instructions are in README.md.</p>
    </main>
  )
}
