import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { DisplayPreferences } from "@/components/a11y/display-preferences"
import { PREFERENCES_SCRIPT } from "@/components/a11y/preferences-script"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config"

import "./globals.css"

// next/font downloads the fonts at build time and serves them from our own
// domain, so the app still looks right with no internet at the venue.
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#032b17" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2a1b" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the preferences script changes <html>'s class
    // and attributes before React loads, which is intentional.
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <TooltipProvider delayDuration={300}>
          {children}
          <DisplayPreferences />
        </TooltipProvider>
        <Toaster closeButton position="top-right" />
      </body>
    </html>
  )
}
