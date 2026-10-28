"use client"

import { ImageOff, ImagePlus, Trash2 } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { removeAssetPhoto, uploadAssetPhoto } from "@/lib/actions/assets"
import { compressImage } from "@/lib/image"

export function PhotoCard({
  assetId,
  name,
  url,
  canEdit,
}: {
  assetId: string
  name: string
  url: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function upload(file: File | undefined) {
    if (!file) return
    startTransition(async () => {
      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.set("photo", compressed)
        const result = await uploadAssetPhoto(assetId, fd)
        if (result.ok) {
          toast.success("Photo updated.")
          router.refresh()
        } else toast.error(result.error)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That photo couldn't be used.")
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
        {url ? (
          <Image
            src={url}
            alt={`Photo of ${name}`}
            fill
            sizes="(min-width: 1024px) 320px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
            No photo
          </div>
        )}
        {pending ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Spinner className="size-6" />
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => input.current?.click()}
            disabled={pending}
          >
            <ImagePlus aria-hidden="true" /> {url ? "Replace photo" : "Add photo"}
          </Button>
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-label="Remove photo"
              onClick={() =>
                startTransition(async () => {
                  const result = await removeAssetPhoto(assetId)
                  if (result.ok) router.refresh()
                  else toast.error(result.error)
                })
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
      ) : null}
    </div>
  )
}
