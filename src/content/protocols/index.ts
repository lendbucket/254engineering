import { RC001 } from "./rc-001";
import type { LineProtocol } from "@/lib/protocol-gate";

/**
 * EVERY PROTOCOL THIS FIRM HAS, DECLARED IN ONE PLACE.
 *
 * The gate asks this rather than importing each protocol by name, so adding the
 * foundation protocol is one entry here and no change to any rule. It is the
 * declared inventory idiom: a list nothing reads stops being true without
 * telling anybody, and this one is read by the discipline gate and by
 * protocol-registry-audit.
 */
export const PROTOCOLS: LineProtocol[] = [
  {
    serviceSlug: RC001.serviceSlug,
    documentNumber: RC001.documentNumber,
    requiresDiscipline: RC001.requiresDiscipline,
  },
];
