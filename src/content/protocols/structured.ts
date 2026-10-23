import { DS001 } from "./ds-001";
import { FC001 } from "./fc-001";
import { MH001 } from "./mh-001";
import { PL001 } from "./pl-001";
import { RS001 } from "./rs-001";
import { SL001 } from "./sl-001";
import { WP001 } from "./wp-001";
import { WS001 } from "./ws-001";

/**
 * THE STRUCTURED DECLARATIONS OF THE PROTOCOLS SIGNED IN THE PORTAL, AND NOT
 * REGISTERED. Operator rulings of 2026-10-22, migration 0081: a signature puts
 * its protocol in force, which seeds the checklist items dispatch reads.
 *
 * WHY NOT THE REGISTRY. PROTOCOL_ENTRIES (./index.ts) is what the public
 * service pages, the order forms, the intake bridge and the review screen read,
 * and received.ts, docx-received.ts and signable.ts each say a protocol enters
 * it only in the change that records its signature and decides what those
 * screens show. Putting a protocol in force is narrower: it needs the checklist
 * he signed and nothing else. So the items come from here, and registering a
 * line, with what its pages and forms then say, stays its own change.
 *
 * Each declaration is the transcription protocol-registry-audit proves word for
 * word against its PDF (section 8) or its Word file (section 9).
 */
export const STRUCTURED_DECLARATIONS = [WS001, MH001, SL001, PL001, RS001, DS001, WP001, FC001] as const;

export function structuredDeclaration(documentNumber: string, version: string) {
  return (
    STRUCTURED_DECLARATIONS.find((d) => d.documentNumber === documentNumber && d.version === version) ?? null
  );
}
