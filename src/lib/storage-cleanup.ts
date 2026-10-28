import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Deletes every uploaded photo and saved report file. Used when the inventory
 * is wiped (Start fresh), since those files belonged to items and
 * reports that no longer exist. Files live in <folder>/<file>, one level deep.
 */
export async function removeAllStoredFiles() {
  const admin = createAdminClient()
  for (const bucket of ["asset-photos", "reports"] as const) {
    const { data: folders } = await admin.storage.from(bucket).list("", { limit: 1000 })
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from(bucket).list(folder.name, { limit: 1000 })
      const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`)
      if (paths.length) await admin.storage.from(bucket).remove(paths)
    }
  }
}
