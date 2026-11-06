import "server-only";
import { createHash } from "node:crypto";
import { clientKey, takeCountedAttempt } from "./ops-rate-limit";
import { todayInFirmCalendar } from "./firm-calendar";

/**
 * THE PUBLIC FORMS ARE LIMITED. Robert's Q11 of 2026-11-02 (office audit F2):
 * "rate limit lead, design inquiry, windstorm inquiry and apply per address and
 * IP, one acknowledgement per address per kind per day."
 *
 * Each of the four routes queued an operator notification and an
 * acknowledgement to an address the caller typed, with no limit at all, so a
 * script could send a stream of branded email to anybody and grow the leads
 * table without bound.
 *
 * THE NUMBERS ARE MY CHOICE, not a ruling: his words give none. They are
 * pinned in scripts/proofs/the-public-forms-are-limited-and-acknowledge-once.mjs,
 * so moving one costs two edits made on purpose.
 *
 *   Per connection, per form, an hour: 10. A person sends a form once; a team
 *   behind one office address might send a few.
 *   Per typed address, per form, an hour: 5. The address is the thing being
 *   protected from a stream of email.
 *   Acknowledgements: 1 per typed address, per form, per firm calendar day. The
 *   operator notification still goes for every accepted post.
 *
 * NO TYPED ADDRESS IS STORED. The address is counted under a SHA-256 of its
 * trimmed, lowercased form, so the count table holds nothing a deletion request
 * would have to find.
 *
 * A BOARD RUN COUNTS IN ITS OWN BUCKETS. clientKey already prefixes the
 * connection with the run on development (Robert's ruling 5 of 2026-10-24);
 * the address key takes the same prefix, so the audits' one probe address is
 * not shared across concurrent boards. On production the keys are exactly the
 * connection and the hashed address.
 */

/* "roofer" joined on 2026-11-05 with the roofer partner application, under the same limits. */
export type PublicFormKind = "contact" | "waitlist" | "design" | "windstorm" | "apply" | "roofer";

export const PUBLIC_FORM_LIMITS = {
  windowSeconds: 60 * 60,
  perConnection: 10,
  perAddress: 5,
  acknowledgementsPerDay: 1,
} as const;

/** The sentence a refused post answers with. It says nothing about any address. */
export const PUBLIC_FORM_REFUSAL =
  "Too many forms were sent from here in the last hour, so this one was not saved. Please try again later, or call or email the firm directly.";

function addressDigest(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function runPrefix(connection: string): string {
  return /^board:\d{6,20}:/.exec(connection)?.[0] ?? "";
}

/** The keys one post is counted under. Exported for the proof. */
export function publicFormKeys(kind: PublicFormKind, headers: Headers, email: string, today: string = todayInFirmCalendar()) {
  const connection = clientKey(headers);
  const prefix = runPrefix(connection);
  const digest = addressDigest(email);
  return {
    connection: `form:${kind}:ip:${connection}`,
    address: `form:${kind}:to:${prefix}${digest}`,
    acknowledgement: `ack:${kind}:${prefix}${digest}:${today}`,
  };
}

/**
 * Count one post. Refused when this connection or this typed address has sent
 * this form too often in the hour. The caller answers PUBLIC_FORM_REFUSAL with
 * a 429 and saves nothing.
 */
export async function takePublicFormAttempt(kind: PublicFormKind, headers: Headers, email: string): Promise<{ allowed: boolean }> {
  const keys = publicFormKeys(kind, headers, email);
  const byConnection = await takeCountedAttempt(keys.connection, PUBLIC_FORM_LIMITS.perConnection, PUBLIC_FORM_LIMITS.windowSeconds);
  if (!byConnection.allowed) return { allowed: false };
  const byAddress = await takeCountedAttempt(keys.address, PUBLIC_FORM_LIMITS.perAddress, PUBLIC_FORM_LIMITS.windowSeconds);
  return { allowed: byAddress.allowed };
}

/**
 * Whether this post may send the acknowledgement: the first of the firm
 * calendar day for this address and form. A day key with a one day window
 * counts only that day's acknowledgements, because tomorrow's key is another.
 */
export async function takeAcknowledgement(kind: PublicFormKind, headers: Headers, email: string): Promise<boolean> {
  const keys = publicFormKeys(kind, headers, email);
  const taken = await takeCountedAttempt(keys.acknowledgement, PUBLIC_FORM_LIMITS.acknowledgementsPerDay, 24 * 60 * 60);
  return taken.allowed;
}

/*
 * THE APPLICANT'S UPLOAD IS LIMITED THE SAME WAY. Robert's answer L3 of
 * 2026-11-05 (auth low findings, 6594441148): "its own small branch on Q11's
 * counted limiter."
 *
 * /api/upload hands a signed upload URL to anybody with no session, because an
 * applicant has none, so a script could mint them without end and fill the
 * private bucket. It is counted on the same counted limiter as the four forms,
 * before any URL is signed.
 *
 * THE NUMBERS ARE MY CHOICE, not a ruling. An application carries at most three
 * documents (resume, certifications, license) and a phone on poor signal may
 * retry each a few times:
 *
 *   Per connection, an hour: 30 signed URLs.
 *   Per application id, an hour: 12. The id is the caller's own, so this bounds
 *   one application; the connection count is what bounds a script that invents
 *   ids.
 *
 * Pinned in scripts/proofs/the-applicant-upload-is-limited.mjs. A board run
 * counts the application key in its own bucket, as the address key above does.
 */
export const UPLOAD_LIMITS = {
  windowSeconds: 60 * 60,
  perConnection: 30,
  perApplication: 12,
} as const;

/** The sentence a refused upload answers with. */
export const UPLOAD_REFUSAL =
  "Too many uploads were started from here in the last hour, so this one was not. Please try again later, or email the document to the firm.";

/** The keys one upload is counted under. Exported for the proof. */
export function uploadKeys(headers: Headers, applicationId: string) {
  const connection = clientKey(headers);
  return {
    connection: `upload:ip:${connection}`,
    application: `upload:app:${runPrefix(connection)}${applicationId}`,
  };
}

/** Count one signed upload URL. Refused when this connection or this application has asked too often in the hour. */
export async function takeUploadAttempt(headers: Headers, applicationId: string): Promise<{ allowed: boolean }> {
  const keys = uploadKeys(headers, applicationId);
  const byConnection = await takeCountedAttempt(keys.connection, UPLOAD_LIMITS.perConnection, UPLOAD_LIMITS.windowSeconds);
  if (!byConnection.allowed) return { allowed: false };
  const byApplication = await takeCountedAttempt(keys.application, UPLOAD_LIMITS.perApplication, UPLOAD_LIMITS.windowSeconds);
  return { allowed: byApplication.allowed };
}
