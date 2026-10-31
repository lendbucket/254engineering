import "server-only";
import { SCOPE_PENDING } from "@data/catalog";
import { SIGNABLE_PROTOCOLS } from "@/content/protocols/signable";
import { signatureStatus } from "./protocol-sign";
import { protocolQuotedBy } from "./scope-quote";

/**
 * A SERVICE PAGE'S DELIVERABLE, AS THE SIGNED RECORD STANDS WHEN THE PAGE IS
 * RENDERED. Robert, 17:31 Central 2026-10-31 (queue item 15).
 *
 * /services/[slug] is prerendered, so this runs at build and again whenever the
 * page is revalidated, never on a public view. A deliverable that quotes a
 * protocol keeps the quote only while a signature on one of that protocol's
 * offered versions reads as live, by signatureStatus, the same read the portal
 * shows him. Anything else renders SCOPE_PENDING:
 *
 *   - a voided signature, or a transcription changed since he signed it;
 *   - no signature at all;
 *   - a read that failed, or no database. That is ruling 11's closing
 *     direction: an unknown is not a signature.
 *
 * WHAT IT DOES NOT DO. It decides nothing about whether the line can be
 * ordered; the order flow and the money door read that themselves
 * (line-gate.ts). And a placed order keeps the scope it was bought under: the
 * order page and its emails read the catalogue, not this.
 *
 * A deliverable that quotes no protocol is returned as it is.
 */
export async function deliverableAsSigned(deliverable: readonly string[]): Promise<string[]> {
  const documentNumber = protocolQuotedBy(deliverable);
  if (!documentNumber) return [...deliverable];
  const versions = SIGNABLE_PROTOCOLS.filter((p) => p.documentNumber === documentNumber);
  /*
   * A throw is an unknown too. supabaseAdmin() throws rather than returning
   * null when a preview points at production (db-guard.ts), and a build that
   * dies on a service page is a worse answer than the pending sentence.
   */
  let statuses: Awaited<ReturnType<typeof signatureStatus>>[];
  try {
    statuses = await Promise.all(versions.map((p) => signatureStatus(documentNumber, p.version)));
  } catch {
    return [SCOPE_PENDING];
  }
  return statuses.some((s) => s.state === "signed") ? [...deliverable] : [SCOPE_PENDING];
}
