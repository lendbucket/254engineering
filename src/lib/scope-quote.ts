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
