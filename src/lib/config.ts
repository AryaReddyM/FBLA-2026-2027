// App-wide constants. Rename the app or change defaults here, in one place.

export const APP_NAME = "EduTrack"
export const APP_TAGLINE = "School inventory, all in one place"
export const APP_DESCRIPTION =
  "Track Chromebooks, textbooks, equipment, and digital licenses across your school or district."

/** Fallback when institution settings haven't loaded. Admins change the real one in Settings. */
export const DEFAULT_TAG_PREFIX = "EDU"
export const DEFAULT_LOAN_DAYS = 14

export const CATALOG_PAGE_SIZE = 25
export const SEARCH_DEBOUNCE_MS = 250
export const QUICK_SEARCH_LIMIT = 8

/** Asset photos are compressed in the browser, then checked again on the server. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

/** Days before a license renewal when the dashboard starts warning. */
export const RENEWAL_ALERT_DAYS = [60, 30] as const

export const MAX_IMPORT_ROWS = 2000
