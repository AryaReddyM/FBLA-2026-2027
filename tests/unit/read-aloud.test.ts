import { describe, expect, it } from "vitest"

import { splitForSpeech } from "@/components/a11y/read-aloud"
import { HTML_ATTRIBUTE_PREFS, PREFERENCES_SCRIPT } from "@/components/a11y/preferences-script"

describe("read aloud", () => {
  it("keeps short text in one piece", () => {
    expect(splitForSpeech("Checked out. Due Friday.")).toEqual(["Checked out. Due Friday."])
  })

  it("splits long text at sentence boundaries, each piece short enough for the browser", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Item number ${i} is available in Room 204.`).join(" ")
    const chunks = splitForSpeech(text, 220)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(220)
    // Nothing is lost or reordered.
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text)
  })

  it("cuts a single very long run of words without breaking words", () => {
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ")
    const chunks = splitForSpeech(words, 100)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100)
    expect(chunks.join(" ").split(" ")).toHaveLength(120)
  })
})

describe("display preference script", () => {
  it("knows about every preference that sets an attribute on <html>", () => {
    for (const { attr } of Object.values(HTML_ATTRIBUTE_PREFS)) expect(PREFERENCES_SCRIPT).toContain(attr)
  })

  it("applies saved preferences before the page paints", () => {
    document.cookie = "et-font=lexend; path=/"
    document.cookie = "et-spacing=wide; path=/"
    document.cookie = "et-text=150; path=/"
    document.cookie = "et-focus=bogus; path=/" // invalid values are ignored
    new Function(PREFERENCES_SCRIPT)()
    const html = document.documentElement
    expect(html.getAttribute("data-font")).toBe("lexend")
    expect(html.getAttribute("data-spacing")).toBe("wide")
    expect(html.getAttribute("data-text-size")).toBe("150")
    expect(html.hasAttribute("data-focus")).toBe(false)
  })
})
