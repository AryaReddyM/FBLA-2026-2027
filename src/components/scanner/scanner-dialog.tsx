"use client"

import type { IScannerControls } from "@zxing/browser"
import { CameraOff, ScanLine } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once with the raw text of the first code the camera reads. */
  onScan: (text: string) => void
  title?: string
  description?: string
}

/**
 * Camera scanner for QR labels and ordinary barcodes, using the device's
 * back camera. The zxing library is loaded only when the dialog opens, so it
 * doesn't slow down every page.
 */
export function ScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan a label",
  description = "Point the camera at an EduTrack QR label or a barcode.",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open ? (
          <CameraView
            onScan={(text) => {
              onScan(text)
              onOpenChange(false)
            }}
          />
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Type it instead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CameraView({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting")
  const [error, setError] = useState<string | null>(null)
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let controls: IScannerControls | null = null
    let stopped = false

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error")
        setError("The camera only works over a secure (https) connection. Type the tag instead.")
        return
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current ?? undefined,
          (result, _err, ctrl) => {
            if (result && !stopped) {
              stopped = true
              ctrl.stop()
              onScanRef.current(result.getText())
            }
          }
        )
        if (stopped) controls.stop()
        else setStatus("scanning")
      } catch (e) {
        setStatus("error")
        const name = e instanceof Error ? e.name : ""
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser settings, or type the tag instead."
            : name === "NotFoundError"
              ? "No camera was found on this device. Type the tag instead."
              : "The camera couldn't start. Type the tag instead."
        )
      }
    }

    start()
    return () => {
      stopped = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-black sm:aspect-[4/3]">
        {/* The video is decorative for screen readers; the status text below says what's happening. */}
        <video ref={videoRef} className="size-full object-cover" muted playsInline aria-hidden="true" />
        {status === "scanning" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        ) : null}
        {status !== "scanning" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
            {status === "starting" ? <Spinner className="size-6" /> : <CameraOff className="size-8" aria-hidden="true" />}
            {status === "starting" ? "Starting the camera…" : null}
          </div>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
        {status === "scanning" ? (
          <>
            <ScanLine className="size-4" aria-hidden="true" /> Looking for a code… hold steady.
          </>
        ) : status === "error" ? (
          <span className="text-destructive">{error}</span>
        ) : null}
      </p>
    </div>
  )
}
