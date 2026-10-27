import { DOCX_RECEIVED_PROTOCOLS } from "./docx-received";
import { RECEIVED_PROTOCOLS } from "./received";

/**
 * ===========================================================================
 * THE PROTOCOLS THE ENGINEER CAN SIGN IN THE PORTAL. One list, read by the
 * signing step, the protocols screen and the line gate. Operator ruling,
 * 2026-10-14.
 * ===========================================================================
 *
 * Two sources, both transcriptions proved word for word against the engineer's
 * own files by protocol-registry-audit: the seven issued as PDFs at v1.1
 * (received.ts, section 8) and the two issued as Word files (docx-received.ts,
 * section 9). Each is offered here as the text he reads and signs; the
 * signature attaches to the SHA-256 of exactly that text (protocol-sign.ts).
 *
 * A LATER VERSION REPLACES AN EARLIER ONE OF THE SAME DOCUMENT. 254-WP-001
 * v1.2 states "Supersedes: Version 1.1, dated October 6, 2026.", so v1.1 is not
 * offered: signing a superseded text would put his signature on words he has
 * since replaced. The rule is derived, not listed: any received document whose
 * number a Word file carries at a different version is dropped, and
 * protocol-registry-audit asserts which ones that is.
 *
 * ONE VERSION PER DOCUMENT NUMBER. The signing step and the screen identify a
 * protocol by its number, so two live versions of one number would make the
 * signature ambiguous. The audit asserts the numbers are unique.
 *
 * WHAT THIS DOES NOT DO. Being here offers a text for signature and nothing
 * else. A line still opens only when it is offered in configuration AND its
 * protocol is signed with a hash matching this text (line-gate.ts, ruling 11),
 * and nothing here enters PROTOCOL_ENTRIES, so no intake field, checklist or
 * determination reaches a customer or the review screen.
 */

export type SignableProtocol = {
  documentNumber: string;
  version: string;
  title: string;
  serviceSlug: string;
  serviceTier: string | null;
  sourceFile: string;
  text: readonly string[];
};

const fromWord: SignableProtocol[] = DOCX_RECEIVED_PROTOCOLS.map((p) => ({
  documentNumber: p.documentNumber,
  version: p.version,
  title: p.title,
  serviceSlug: p.serviceSlug,
  serviceTier: p.serviceTier,
  sourceFile: p.sourceFile,
  text: p.text,
}));

const fromPdf: SignableProtocol[] = RECEIVED_PROTOCOLS.map((p) => p.declaration)
  .filter((d) => !fromWord.some((w) => w.documentNumber === d.documentNumber && w.version !== d.version))
  .map((d) => ({
    documentNumber: d.documentNumber,
    version: d.version as string,
    title: d.title,
    serviceSlug: d.serviceSlug,
    serviceTier: (d as { serviceTier?: string | null }).serviceTier ?? null,
    sourceFile: d.sourceFile,
    text: d.text as readonly string[],
  }));

export const SIGNABLE_PROTOCOLS: readonly SignableProtocol[] = [...fromPdf, ...fromWord];

/** The received documents a later Word version replaced, so not offered. */
export const SUPERSEDED_RECEIVED: readonly string[] = RECEIVED_PROTOCOLS.map((p) => p.declaration)
  .filter((d) => !fromPdf.some((s) => s.documentNumber === d.documentNumber && s.version === d.version))
  .map((d) => `${d.documentNumber} v${d.version as string}`);

/**
 * SIGNABLE, AND HELD OUT OF FORCE. Operator ruling, 2026-10-22: 254-WP-001 is
 * deferred entirely until a signed scope addendum covers it, and it shares the
 * windstorm-wpi-8 line with 254-WS-001, whose record approving it would retire.
 * His signature on it is recorded and stands; it puts nothing in force. Read by
 * src/lib/protocol-sign.ts and scripts/emit-signed-protocols-backfill.mjs, so
 * the signing door and 0081's backfill hold the same list.
 */
export const HELD_OUT_OF_FORCE: Readonly<Record<string, string>> = {
  "254-WP-001":
    "Deferred by operator ruling of 2026-10-22: it shares the windstorm line with 254-WS-001 and needs a signed scope addendum before any job.",
};

/**
 * THE HOLD LIFTS ON HIS ADDENDUM. Robert's rulings of 2026-10-26, 07:10 and
 * 08:19 Central (0095, 0096): a protocol listed here goes in force for its tier
 * once a live signed per_job scope addendum covers the deliverable named, and
 * not before. 0096's eng_put_signed_protocol_in_force asks the same question
 * of eng_line_pay, so the database and the code hold the same condition.
 * Approving it retires nothing on the other tier, because 0096 retires by line
 * and tier.
 */
export const HELD_UNTIL_ADDENDUM: Readonly<Record<string, string>> = {
  "254-WP-001": "windstorm-wpi-8/ongoing",
};

export function signableProtocol(documentNumber: string): SignableProtocol | undefined {
  return SIGNABLE_PROTOCOLS.find((p) => p.documentNumber === documentNumber);
}
