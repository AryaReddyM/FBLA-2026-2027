import {
  Accessibility,
  ArrowLeftRight,
  FileBarChart,
  KeyRound,
  type LucideIcon,
  PlusSquare,
  Printer,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Help" }

type Guide = { id: string; icon: LucideIcon; title: string; who: string; steps: React.ReactNode[]; tip?: string }

const GUIDES: Guide[] = [
  {
    id: "register",
    icon: PlusSquare,
    title: "Register a new item",
    who: "Admins and managers",
    steps: [
      <>
        Open{" "}
        <Link href="/inventory/new" className="text-primary underline">
          Register item
        </Link>{" "}
        from the sidebar.
      </>,
      "Choose Physical item or Digital resource. The form changes to match.",
      "Type a name and pick a category and location. Leave Asset tag blank to get the next tag automatically, or scan the item's existing barcode.",
      "Add the serial number (tap the scan button to read its barcode), purchase date and cost.",
      "Press Register item. If EduTrack thinks it's a duplicate, it shows you the match first.",
    ],
    tip: "Registering a whole cart of identical Chromebooks? Use “Save and add another”: the category, location and purchase details stay filled in, and the cursor jumps to Serial number.",
  },
  {
    id: "checkout",
    icon: ArrowLeftRight,
    title: "Check an item out or in",
    who: "Admins, managers and staff",
    steps: [
      <>
        Open the{" "}
        <Link href="/circulation" className="text-primary underline">
          Circulation desk
        </Link>
        .
      </>,
      "Scan the QR label with the camera button, use a USB barcode scanner, or type the tag and press Enter.",
      "To check out: choose Student, Staff member or Classroom, enter the name and ID, check the due date, and press Check out.",
      "To check in: switch to Check in, pick the condition it came back in, and press Check in. “Broken” sends it to repair automatically.",
    ],
    tip: "Two people can't check out the same item at once: the database locks the item while a loan is being created.",
  },
  {
    id: "seats",
    icon: KeyRound,
    title: "Assign or release a license seat",
    who: "Admins, managers and staff",
    steps: [
      <>
        Open{" "}
        <Link href="/licenses" className="text-primary underline">
          Digital licenses
        </Link>{" "}
        and press Assign seat next to the license.
      </>,
      "Enter who gets the seat. EduTrack stops you when every purchased seat is in use.",
      "To free a seat, open the license and press Release next to the person's name.",
    ],
  },
  {
    id: "report",
    icon: FileBarChart,
    title: "Run the annual inventory report",
    who: "Admins and managers",
    steps: [
      <>
        Open{" "}
        <Link href="/reports?type=annual_inventory" className="text-primary underline">
          Reports
        </Link>{" "}
        and choose Annual Inventory Report.
      </>,
      "Pick one location, or keep All locations.",
      "Check the on-screen preview, then press PDF, Excel or CSV.",
      "Every export is saved in Report history so you can download it again later.",
    ],
  },
  {
    id: "labels",
    icon: Printer,
    title: "Print QR labels",
    who: "Everyone",
    steps: [
      "In the Catalog, tick the items you want labels for, then press Print QR labels. (Or press Print label on a single item.)",
      'Load a sheet of 1" × 2⅝" address labels (Avery 5160 or compatible). If part of the sheet is used, choose which label to start at.',
      "Print with margins set to None and scale at 100%.",
    ],
  },
  {
    id: "scan",
    icon: ScanLine,
    title: "Use a phone or tablet to scan",
    who: "Everyone",
    steps: [
      "Point any phone camera at an EduTrack label to open that item's page.",
      "On the Circulation desk, the Scan button uses the tablet's back camera.",
      "The camera only works on the secure (https) site. On a laptop, a USB barcode scanner works anywhere you can type.",
    ],
  },
  {
    id: "import",
    icon: Upload,
    title: "Import an existing spreadsheet",
    who: "Admins and managers",
    steps: [
      "Create the categories and locations your spreadsheet uses (Settings → Categories, Locations).",
      "Save your spreadsheet as CSV and open Import CSV.",
      "Match your columns, review the rows (problems and duplicates are flagged), then import. Nothing is ever half-imported.",
    ],
  },
  {
    id: "accessibility",
    icon: Accessibility,
    title: "Make EduTrack easier to see, read and use",
    who: "Everyone",
    steps: [
      "Press the “Aa Accessibility” button in the bottom-right corner of any page (or press Alt + A).",
      "Text: choose a size from Standard to Largest, a reading font (Hyperlegible for low vision, Easy reading to reduce eye strain), or wider spacing between lines and letters.",
      "Color: Standard, High contrast, or Color-safe contrast (for color blindness), in Light, Dark or your device's theme.",
      "Reading aids: underline every link, a thicker keyboard focus outline, a reading guide that follows your pointer, and Reduce motion.",
      "Read aloud: select some text (or nothing, for the whole page) and press Read aloud. A Stop reading button stays on screen.",
      "Your choices are remembered on this device. Reset preferences puts everything back.",
    ],
    tip: "Everything works with a keyboard: Tab moves between controls, Esc closes dialogs, Ctrl + K opens search, and ? lists every shortcut.",
  },
  {
    id: "roles",
    icon: ShieldCheck,
    title: "Who can do what",
    who: "Everyone",
    steps: [
      "Admin: everything, including users, roles, categories, locations and settings.",
      "Manager: register, edit and retire items; run every report; import; view the activity log.",
      "Staff (teachers): add items and edit the ones they added, check items in and out, and run a report of their own checkouts.",
      "Viewer: read-only access to the catalog and dashboard.",
    ],
  },
]

export default function HelpPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Support"
        title="Help"
        description="Short, task-based guides for the things people do most."
      />
      <nav aria-label="Guides" className="flex flex-wrap gap-2">
        {GUIDES.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted">
            {g.title}
          </a>
        ))}
      </nav>
      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.id} id={g.id} className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <g.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-normal text-muted-foreground">{g.who}</span>
                  {g.title}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {g.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {g.tip ? <p className="rounded-lg bg-muted/60 p-3 text-sm">💡 {g.tip}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}
