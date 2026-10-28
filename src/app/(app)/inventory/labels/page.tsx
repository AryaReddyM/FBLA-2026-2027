import { Tags } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { LabelSheetControls } from "@/components/inventory/label-sheet-controls"
import { QrCode } from "@/components/inventory/qr-code"
import { EmptyState } from "@/components/layout/empty-state"
import { PageContainer, PageHeader } from "@/components/layout/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { getOrigin } from "@/lib/origin"
import { getAssetsByIds } from "@/lib/queries/assets"
import { getInstitution } from "@/lib/queries/settings"
import { labelUrl } from "@/lib/scan"

export const metadata: Metadata = { title: "Print labels" }

// Sized for standard 1" × 2⅝" address labels (Avery 5160 / 8160 and
// compatibles): 3 columns × 10 rows = 30 labels per US Letter sheet.
const LABELS_PER_SHEET = 30

export default function LabelsPage(props: PageProps<"/inventory/labels">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LabelSheet searchParams={props.searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function LabelSheet({ searchParams }: { searchParams: PageProps<"/inventory/labels">["searchParams"] }) {
  await getCurrentUser()
  const params = await searchParams
  const ids = (typeof params.ids === "string" ? params.ids : "").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  const skip = Math.min(Math.max(Number(params.skip) || 0, 0), LABELS_PER_SHEET - 1)
  const [assets, origin, institution] = await Promise.all([getAssetsByIds(ids), getOrigin(), getInstitution()])

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="No items selected"
        description="Select items in the catalog, then choose “Print QR labels”."
      >
        <Link href="/inventory" className="text-primary underline underline-offset-4">
          Go to the catalog
        </Link>
      </EmptyState>
    )
  }

  const cells: ((typeof assets)[number] | null)[] = [...Array<null>(skip).fill(null), ...assets]

  return (
    <>
      <div data-print-hide className="space-y-4">
        <PageHeader
          eyebrow="Catalog"
          title="Print QR labels"
          description={`${assets.length} label${assets.length === 1 ? "" : "s"} on 1" × 2⅝" address labels (Avery 5160 or compatible). In the print dialog, set margins to “None” and scale to 100%.`}
        />
        <LabelSheetControls skip={skip} />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white p-4 print:overflow-visible print:border-0 print:p-0">
        <div
          className="grid text-black"
          style={{
            gridTemplateColumns: "repeat(3, 2.625in)",
            gridAutoRows: "1in",
            columnGap: "0.125in",
            width: "8.125in",
          }}
        >
          {cells.map((asset, index) =>
            asset ? (
              <div
                key={asset.id}
                className="flex items-center gap-[0.08in] overflow-hidden px-[0.1in] outline outline-1 outline-gray-300 outline-dashed print:outline-none"
                style={{ breakInside: "avoid" }}
              >
                <QrCode
                  value={labelUrl(origin, asset.asset_tag)}
                  label={`QR code for ${asset.asset_tag}`}
                  className="w-[0.8in] shrink-0"
                />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[7pt] text-gray-600">{institution.name}</p>
                  <p className="font-mono text-[10pt] font-bold tracking-tight">{asset.asset_tag}</p>
                  <p className="line-clamp-2 text-[7.5pt]">{asset.name}</p>
                </div>
              </div>
            ) : (
              <div
                key={`skip-${index}`}
                aria-hidden="true"
                className="outline outline-1 outline-gray-200 outline-dashed print:outline-none"
              />
            ),
          )}
        </div>
      </div>
    </>
  )
}
