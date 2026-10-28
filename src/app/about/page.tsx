import { ArrowLeft, ExternalLink } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Logo } from "@/components/layout/logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { APP_NAME } from "@/lib/config"

export const metadata: Metadata = {
  title: "About",
  description: `${APP_NAME}: a web-based inventory platform for K-12 schools, built for FBLA Website Coding & Development.`,
}

const RESULTS = [
  ["Goods search efficiency", "85.51%"],
  ["Goods registration", "90.31%"],
  ["Annual goods report generation", "83.11%"],
  ["Overall inventory process", "86.31%"],
]

const MAPPING = [
  ["Laravel 9 / PHP backend", "Next.js App Router: Server Components, Server Actions, Route Handlers"],
  ["Vue 3 frontend", "React 19 + TypeScript (strict)"],
  ["Self-hosted relational database", "Supabase (managed cloud Postgres)"],
  ["Sanctum API authentication", "Supabase Auth + Postgres Row Level Security"],
  ["PDF reports (dompdf)", "@react-pdf/renderer"],
  ["Excel export", "ExcelJS (XLSX) plus CSV"],
  ["Search by name, category, location, status", "Postgres full-text + trigram fuzzy search with filters"],
  ["Dashboard: goods by acquisition date", "Dashboard charts with table views"],
  ["Reports per inventory area", "Annual Inventory Report by location or all locations"],
  ["Admin and manager roles", "Admin, Manager, Staff and Viewer roles enforced in the database"],
  ["Future work: QR / barcode", "QR labels and camera scanning, built in from the start"],
  ["Physical goods only", "Physical and digital assets (licenses, seats, renewals)"],
]

const LIBRARIES: { name: string; url: string; use: string }[] = [
  { name: "Next.js", url: "https://nextjs.org", use: "Web framework (pages, server code, routing)" },
  { name: "React", url: "https://react.dev", use: "User interface components" },
  { name: "TypeScript", url: "https://www.typescriptlang.org", use: "Typed JavaScript" },
  { name: "Supabase", url: "https://supabase.com", use: "Postgres database, authentication, file storage" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", use: "Styling" },
  { name: "shadcn/ui", url: "https://ui.shadcn.com", use: "Accessible component starting points (customized)" },
  { name: "Radix UI", url: "https://www.radix-ui.com", use: "Accessible primitives behind dialogs, menus, selects" },
  { name: "Lucide", url: "https://lucide.dev", use: "Icons" },
  { name: "Zod", url: "https://zod.dev", use: "Form and server input validation" },
  { name: "React Hook Form", url: "https://react-hook-form.com", use: "Form state" },
  { name: "TanStack Table", url: "https://tanstack.com/table", use: "Catalog table selection" },
  { name: "Recharts", url: "https://recharts.org", use: "Dashboard charts" },
  { name: "React-pdf", url: "https://react-pdf.org", use: "PDF reports" },
  { name: "ExcelJS", url: "https://github.com/exceljs/exceljs", use: "Excel reports" },
  { name: "node-qrcode", url: "https://github.com/soldair/node-qrcode", use: "QR code labels" },
  { name: "ZXing (browser)", url: "https://github.com/zxing-js/browser", use: "Camera QR / barcode scanning" },
  { name: "date-fns", url: "https://date-fns.org", use: "Date formatting" },
  { name: "Sonner", url: "https://sonner.emilkowal.ski", use: "Notifications" },
  { name: "cmdk", url: "https://cmdk.paco.me", use: "Ctrl+K command palette" },
  { name: "Vitest, Playwright, axe-core", url: "https://playwright.dev", use: "Automated and accessibility testing" },
]

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header data-band className="border-b border-white/10 bg-brand text-brand-foreground">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <Logo onDark />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to the app
          </Link>
        </div>
      </header>
      <main id="main-content">
        <section data-band className="bg-brand text-brand-foreground">
          <div className="mx-auto max-w-5xl space-y-4 px-4 pt-10 pb-14 sm:px-6 sm:pt-14">
            <p className="text-xs font-bold tracking-[0.18em] text-lime uppercase">
              FBLA Website Coding &amp; Development · 2026–2027
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">About {APP_NAME}</h1>
            <p className="max-w-3xl text-lg text-brand-muted">
              Many schools still track Chromebooks, textbooks and software on paper, then retype it into spreadsheets.
              That means duplicate records, out-of-date information, slow searches and painful annual reports.{" "}
              {APP_NAME} replaces that with one central, searchable system that every staff member can use together,
              from any device.
            </p>
            <p className="max-w-3xl text-brand-muted">
              This year&apos;s connection is <strong className="text-white">digital resource management</strong>:
              managing large amounts of data about both physical and digital resources in education, where collaboration
              between staff matters.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Research basis</CardTitle>
              <CardDescription>
                The design follows a peer-reviewed study of a web-based inventory platform deployed in a public school
                in Peru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <blockquote className="border-l-4 border-primary pl-4 text-sm leading-relaxed">
                Ramos-Miller, M., &amp; Pacheco, A. (2023). Towards inventory control excellence: An innovative approach
                based on a web-based platform. <em>F1000Research, 12</em>, 1471.{" "}
                <a
                  href="https://doi.org/10.12688/f1000research.140745.2"
                  className="break-all text-primary underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  https://doi.org/10.12688/f1000research.140745.2
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </blockquote>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h2 className="mb-2 font-medium">Improvements the study reported</h2>
                  <Table>
                    <caption className="sr-only">Improvements reported in the study</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dimension</TableHead>
                        <TableHead className="text-right">Improvement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {RESULTS.map(([dim, value]) => (
                        <TableRow key={dim}>
                          <TableCell>{dim}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {APP_NAME} records the same three timings (search, registration, report generation) on an admin-only
                    Impact card, so our own results can be measured the same way.
                  </p>
                </div>
                <div>
                  <h2 className="mb-2 font-medium">How we rebuilt and extended it</h2>
                  <Table>
                    <caption className="sr-only">Original study features and their implementation here</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Study (2023)</TableHead>
                        <TableHead>{APP_NAME}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MAPPING.map(([paper, ours]) => (
                        <TableRow key={paper}>
                          <TableCell className="align-top text-sm whitespace-normal">{paper}</TableCell>
                          <TableCell className="align-top text-sm whitespace-normal">{ours}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Student privacy (FERPA-minded design)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  We store only what&apos;s needed to get an item back: a student&apos;s name and school ID number. No
                  birthdates, addresses, grades or photos of students.
                </p>
                <p>Activity feeds show &ldquo;Student #10234&rdquo; rather than a name.</p>
                <p>
                  Every table is protected by database-level security rules, so people only see and change what their
                  role allows, even if they bypass the website.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Accessibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Built to WCAG 2.2 AA: high-contrast colors, text size control up to 150%, a high-contrast theme, dark
                  mode, full keyboard use, and screen reader support.
                </p>
                <p>
                  Status is never shown by color alone. Every chart has a table view. Automated accessibility checks
                  (axe) run on every main page.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>Designed and built by a team of three FBLA members.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-3">
                {[
                  "Team member 1 · Lead developer",
                  "Team member 2 · Design & accessibility",
                  "Team member 3 · Research & testing",
                ].map((m) => (
                  <li key={m} className="rounded-lg border p-3 text-sm">
                    {m}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Original work and third-party code</CardTitle>
              <CardDescription>
                The data model, security rules, database functions, search ranking, reports, circulation workflow,
                accessibility features and every page in this app are our own work. We build on these open-source
                projects:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {LIBRARIES.map((lib) => (
                  <li key={lib.name} className="text-sm">
                    <a
                      href={lib.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {lib.name}
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>{" "}
                    <span className="text-muted-foreground">: {lib.use}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
