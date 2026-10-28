// Shrinks a phone photo in the browser before upload: classroom Wi-Fi is slow
// and a 12-megapixel photo of a projector doesn't need to be 6 MB.

import { MAX_PHOTO_BYTES } from "@/lib/config"

const MAX_DIMENSION = 1600

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPEG, PNG or WebP).")

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't process images.")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Step the JPEG quality down until it fits under the limit.
  for (const quality of [0.85, 0.75, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (blob && blob.size <= MAX_PHOTO_BYTES) {
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
    }
  }
  throw new Error("That photo is too large even after compressing. Try a smaller one.")
}
