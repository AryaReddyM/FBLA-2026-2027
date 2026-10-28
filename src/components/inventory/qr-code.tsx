import QRCode from "qrcode"

import { cn } from "@/lib/utils"

/** Server-rendered QR code as inline SVG (crisp at any print size, no image request). */
export async function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("aspect-square [&>svg]:size-full", className)}
      // The SVG comes from the qrcode library, built only from our own URL, not user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
