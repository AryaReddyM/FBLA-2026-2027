// Every Server Action returns this shape, so forms can show either the data or
// a friendly error without try/catch everywhere.

export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
export type ActionResult<T = undefined> = { ok: true; data: T } | ActionFailure

export function ok(): { ok: true; data: undefined }
export function ok<T>(data: T): { ok: true; data: T }
export function ok<T>(data?: T) {
  return { ok: true as const, data }
}

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionFailure {
  return { ok: false, error, fieldErrors }
}

type PostgrestLikeError = { message: string; code?: string; details?: string | null }

/** Turns database errors into messages a teacher can act on. */
export function friendlyDbError(error: PostgrestLikeError): string {
  if (error.code === "23505") {
    if (error.message.includes("serial")) return "Another item already has that serial number."
    if (error.message.includes("asset_tag")) return "That asset tag is already in use."
    if (error.message.includes("checkouts_one_open")) return "That item is already checked out."
    if (error.message.includes("categories")) return "A category with that name already exists."
    if (error.message.includes("locations")) return "A location with that name already exists."
    return "That would create a duplicate record."
  }
  if (error.code === "42501") {
    return error.message.includes("row-level security")
      ? "You don't have permission to do that."
      : error.message
  }
  if (error.code === "23503") return "That record is still in use elsewhere, so it can't be removed."
  if (error.code === "23514") return "One of the values isn't allowed. Please check the form."
  if (error.code === "P0001" || error.code === "P0002" || error.code === "22023") return error.message
  return "Something went wrong saving that. Please try again."
}
