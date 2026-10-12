/**
 * The sentences a person reads when the database did not answer. Operator
 * ruling, 2026-10-12, and the wording is his. One home, imported by the server
 * code that decides and the screens that say it, including the client error
 * boundary, which is why this file imports nothing.
 */

export const PORTAL_UNREACHABLE =
  "The portal could not reach the database. You are still signed in. Try again in a moment.";

export const MAY_NOT_HAVE_SAVED = "This may not have saved. Check before trying again.";

export const LIST_NOT_LOADED = "This list could not be loaded. Try again.";

/**
 * Carried as the digest of a failed session read. Next keeps a digest an error
 * already has, and a production build hides every other property from an error
 * boundary, so this is how the portal's boundary tells this failure from any
 * other.
 */
export const UNREACHABLE_DIGEST = "DATABASE_UNREACHABLE";
