import { PROTOCOL_RECEIVES } from "@data/catalog";

/**
 * WHICH SIGNED PROTOCOL A DELIVERABLE QUOTES, if any.
 *
 * Robert, 17:31 Central 2026-10-31 (queue item 15): a service page drops the
 * quoted scope once that protocol's signature is no longer live. The page
 * therefore has to know which protocol its deliverable quotes. That is
 * answered from the quote itself rather than from a second field naming the
 * document, because services.ts already says it once, by calling
 * receivesFrom(documentNumber), and a field beside it would be the same fact
 * with two homes.
 *
 * An exact match, item for item and in order: a deliverable that quotes a
 * protocol carries that protocol's whole list (receivesFrom copies it), and
 * anything else, SCOPE_PENDING included, quotes nothing.
 *
 * Pure, with no database, so a proof can call it.
 */
export type QuotedProtocol = keyof typeof PROTOCOL_RECEIVES;

export function protocolQuotedBy(deliverable: readonly string[]): QuotedProtocol | null {
  for (const [documentNumber, items] of Object.entries(PROTOCOL_RECEIVES) as [QuotedProtocol, readonly string[]][]) {
    if (items.length === deliverable.length && items.every((sentence, i) => sentence === deliverable[i])) {
      return documentNumber;
    }
  }
  return null;
}

/**
 * How far back the jobs cron looks for a voided protocol signature. The cron
 * runs every minute; ten minutes covers a run that was skipped or slow, and a
 * page revalidated twice costs nothing (scope-revalidate.ts).
 */
export const VOID_LOOKBACK_MINUTES = 10;

/**
 * The pages to revalidate when these protocols' signatures are voided: every
 * service page whose deliverable quotes one of them, and /llms-full.txt, which
 * prints every service's deliverable. Nothing when nothing quotes them.
 */
export function pagesQuoting(
  documentNumbers: readonly string[],
  serviceList: readonly { slug: string; deliverable: readonly string[] }[],
): string[] {
  const wanted = new Set(documentNumbers);
  const pages = serviceList
    .filter((s) => {
      const doc = protocolQuotedBy(s.deliverable);
      return doc !== null && wanted.has(doc);
    })
    .map((s) => `/services/${s.slug}`);
  return pages.length > 0 ? [...pages, "/llms-full.txt"] : [];
}

/** One signature read, in the shape signatureStatus answers. */
export type ScopeRead = { state: "signed" | "void" | "unsigned" | "unknown"; why?: string };

export type ScopeOutcome = {
  deliverable: string[];
  /** Set when the read failed, so the caller records it and alerts the office. */
  failed: { documentNumber: QuotedProtocol; why: string } | null;
};

/**
 * WHAT A SERVICE PAGE SHOWS, GIVEN WHAT THE SIGNATURE READ FOUND. Robert,
 * 18:04 Central 2026-10-31, amending his 17:31 ruling before it boarded:
 *
 *   - a successful read that finds a live signature: the quoted scope;
 *   - a successful read that finds it voided or unsigned: the pending
 *     sentence. This is the only way the scope comes off;
 *   - a read that fails, or cannot be made: the code's in-force record, which
 *     is the quote services.ts carries today, and the failure is handed back
 *     so the caller writes an error event and an office alert naming the page.
 *
 * So a failed read does NOT render the pending sentence. That is his ruling for
 * this display and it is deliberately not the money door's rule: ordering still
 * closes on an unknown (ruling 11, line-gate.ts).
 *
 * Pure: the read is passed in, so a proof drives all three cases with no
 * database. src/lib/scope-live.ts passes the real one.
 */
export async function resolveDeliverable(
  deliverable: readonly string[],
  readSignatures: (documentNumber: QuotedProtocol) => Promise<ScopeRead[]>,
  pending: string,
): Promise<ScopeOutcome> {
  const documentNumber = protocolQuotedBy(deliverable);
  if (!documentNumber) return { deliverable: [...deliverable], failed: null };

  let reads: ScopeRead[];
  try {
    reads = await readSignatures(documentNumber);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return { deliverable: [...deliverable], failed: { documentNumber, why: `the signature read threw: ${why}` } };
  }

  if (reads.some((r) => r.state === "signed")) return { deliverable: [...deliverable], failed: null };

  const unknown = reads.find((r) => r.state === "unknown");
  if (unknown) {
    return { deliverable: [...deliverable], failed: { documentNumber, why: unknown.why ?? "the signature record could not be read" } };
  }
  /* No read was made at all, so nothing was found voided or unsigned. */
  if (reads.length === 0) {
    return { deliverable: [...deliverable], failed: { documentNumber, why: "no version of this protocol is offered for signing, so nothing was read" } };
  }
  return { deliverable: [pending], failed: null };
}
