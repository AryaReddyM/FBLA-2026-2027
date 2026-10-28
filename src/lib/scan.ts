// QR labels encode a link like https://school.example/t/EDU-2026-000412, so a
// phone camera opens the item page, and our own scanner can pull the tag out.
// Plain barcodes (an existing district label) are just the tag itself.

export type ScannedCode = { type: "tag"; value: string } | { type: "id"; value: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseScannedCode(raw: string): ScannedCode | null {
  const text = raw.trim()
  if (!text) return null

  try {
    const url = new URL(text)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts[0] === "t" && parts[1]) return { type: "tag", value: decodeURIComponent(parts[1]).toUpperCase() }
    if (parts[0] === "inventory" && parts[1] && UUID.test(parts[1])) return { type: "id", value: parts[1] }
  } catch {
    // Not a URL: treat it as a tag.
  }

  if (UUID.test(text)) return { type: "id", value: text.toLowerCase() }
  if (text.length > 64) return null
  return { type: "tag", value: text.toUpperCase() }
}

export function labelUrl(origin: string, tag: string): string {
  return `${origin.replace(/\/$/, "")}/t/${encodeURIComponent(tag)}`
}
