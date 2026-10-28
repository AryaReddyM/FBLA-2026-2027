import { BarChart3, ClipboardCheck, ScanLine, Search } from "lucide-react"
import Link from "next/link"

import { Logo } from "@/components/layout/logo"

const HIGHLIGHTS = [
  {
    icon: Search,
    title: "Find anything in seconds",
    text: "Search every Chromebook, textbook and license by tag, serial or name.",
  },
  {
    icon: ScanLine,
    title: "Scan to check out",
    text: "Point a tablet camera at a QR label to lend or return an item.",
  },
  {
    icon: ClipboardCheck,
    title: "Register items fast",
    text: "Batch entry and duplicate detection keep records clean.",
  },
  {
    icon: BarChart3,
    title: "Annual reports in one click",
    text: "PDF, Excel and CSV reports by location, ready for audits.",
  },
]

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        data-band
        className="relative hidden overflow-hidden bg-brand text-brand-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-lime/10 blur-3xl"
        />
        <Link href="/about" className="relative w-fit rounded-lg" data-nav>
          <Logo onDark />
        </Link>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-bold tracking-[0.18em] text-lime uppercase">
              One catalog. Every learning resource.
            </p>
            <p className="text-4xl leading-[1.08] font-semibold tracking-tight xl:text-5xl">
              Find what your institution already has.
            </p>
            <p className="text-lg text-brand-muted">
              One shared, searchable system for the physical and digital resources your school depends on.
            </p>
          </div>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lime">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm text-brand-muted">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-muted">
          Built for K-12 schools ·{" "}
          <Link href="/about" className="text-white underline underline-offset-4">
            About this project
          </Link>
        </p>
      </aside>
      <main id="main-content" className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/8 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
