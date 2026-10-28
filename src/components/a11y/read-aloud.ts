"use client"

import { useSyncExternalStore } from "react"

// Read aloud with the browser's built-in text-to-speech (Web Speech API).
// The voices come from the device itself, so it works with no internet.

let speaking = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function setSpeaking(value: boolean) {
  speaking = value
  notify()
}

/**
 * Chrome stops long utterances after about 15 seconds, so text is queued in
 * sentence-sized pieces instead of one big block.
 */
export function splitForSpeech(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*\s*/g) ?? []
  const chunks: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if ((current + sentence).length > max && current) {
      chunks.push(current.trim())
      current = ""
    }
    // A single very long "sentence" (like a table row) is cut at word boundaries.
    if (sentence.length > max) {
      for (const word of sentence.split(" ")) {
        if ((current + " " + word).length > max) {
          chunks.push(current.trim())
          current = ""
        }
        current += ` ${word}`
      }
    } else current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
}

export function speak(text: string, rate = 1) {
  if (!isSpeechSupported()) return
  window.speechSynthesis.cancel()
  const chunks = splitForSpeech(text)
  if (chunks.length === 0) return
  setSpeaking(true)
  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.rate = rate
    utterance.lang = document.documentElement.lang || "en-US"
    if (i === chunks.length - 1) {
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
  setSpeaking(false)
}

/** The page's main content as plain text (skips the navigation and this panel). */
export function pageText(): string {
  const main = document.getElementById("main-content")
  return (main?.innerText ?? document.body.innerText).trim()
}

export function useReadAloud() {
  const isSpeaking = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => speaking,
    () => false,
  )
  const supported = useSyncExternalStore(
    () => () => {},
    isSpeechSupported,
    () => false,
  )
  // speak/stop are module-level functions, so they are already stable.
  return { isSpeaking, supported, speak, stop: stopSpeaking }
}
