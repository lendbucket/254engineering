import { RC001, RC001_VERSIONS, RC001_SIGNATURE_EVIDENCE, RC001_ENFORCED, RC001_AMBIGUITIES } from "./rc-001";
import { RC001_COUNTS, RC001_NOTE_BLOCKS } from "./rc-001-checklist";
import type { ChecklistItem } from "./rc-001-checklist";
import type { IntakeQuestion, IntakeUpload } from "./rc-001-intake";
import type { DeterminationRule } from "./rc-001-decisions";
import type { LineProtocol } from "@/lib/protocol-gate";

/*
 * The determination vocabulary is the database's (0051's check constraint), not
 * one protocol's, so consumers import it from here. It is still DEFINED beside
 * RC-001's decisions because moving it would edit a transcription file for a
 * reason that has nothing to do with the document.
 */
export type { Determination, DeterminationRule } from "./rc-001-decisions";

/**
 * EVERY PROTOCOL THIS FIRM HAS, DECLARED IN ONE PLACE.
 *
 * The gate asks this rather than importing each protocol by name, so adding the
 * foundation protocol is one entry here and no change to any rule. It is the
 * declared inventory idiom: a list nothing reads stops being true without
 * telling anybody, and this one is read by the discipline gate and by
 * protocol-registry-audit.
 *
 * ===========================================================================
 * ONE PROTOCOL TO MANY. Operator ruling, 2026-10-06.
 * ===========================================================================
 *
 * Until this ruling the registry above was the only place that knew a second
 * protocol could exist. The run logic, the review screen, the intake bridge,
 * the portal page, the seed script and three audits each imported 254-RC-001
 * by name, so loading the engineer's seven new protocols would have meant
 * editing every one of them seven times.
 *
 * So each protocol is now an ENTRY, and every consumer asks this file for the
 * entry by service line or by document number. RC-001's own files are not
 * touched: its declaration, its checklist, its decisions and its intake are
 * exactly the transcription `protocol-registry-audit` proves against the signed
 * document, and an entry only points at them.
 *
 * WHAT AN ENTRY CARRIES BEYOND THE DECLARATION is code, never protocol text:
 * the prefix its intake fields are named with, which uploads become required by
 * a yes to which question, and the route its portal page lives at. Each is a
 * fact the platform needs that the signed document does not state.
 */

/** A checklist item of any protocol. RC-001's section keys are its own; another's are strings. */
export type ProtocolChecklistItem = Omit<ChecklistItem, "section"> & { section: string };

/** The shape every transcribed protocol declaration satisfies. RC-001's `as const` object does. */
export type ProtocolDeclaration = {
  readonly documentNumber: string;
  readonly title: string;
  readonly version: string;
  readonly issueDate: string;
  readonly approvedBy: string;
  readonly serviceSlug: string;
  readonly requiresDiscipline: string | null;
  readonly sourceFile: string;
  readonly sections: readonly { readonly key: string; readonly heading: string; readonly at: string }[];
  readonly photoProcedure: readonly { readonly step: number; readonly text: string; readonly at: string }[];
  readonly intakeQuestions: readonly IntakeQuestion[];
  readonly intakeUploads: readonly IntakeUpload[];
  readonly checklist: readonly ProtocolChecklistItem[];
  readonly determinations: readonly DeterminationRule[];
  readonly thresholds: readonly {
    readonly key: string;
    readonly states: string;
    readonly value: number;
    readonly settled: boolean;
    readonly question: string | null;
    readonly at: string;
  }[];
};

export type ProtocolEntry = {
  declaration: ProtocolDeclaration;
  versions: readonly {
    version: string;
    issueDate: string;
    inForceFrom: string;
    supersededOn: string | null;
    file: string;
    sha256: string;
  }[];
  signatureEvidence: typeof RC001_SIGNATURE_EVIDENCE | null;
  enforced: readonly { key: string; rule: string; at: string }[];
  ambiguities: readonly { at: string; question: string; resolvedByV11?: string | null }[];
  counts: readonly { key: string; prompt: string; at: string }[];
  noteBlocks: readonly string[];
  /**
   * The prefix every intake field this protocol derives is named with, so the
   * field ids of one protocol can never collide with another's. RC-001's is
   * `rc001`, which is what its fields have always been called.
   */
  fieldPrefix: string;
  /**
   * An upload the document makes required only when a flag question is
   * answered yes, keyed by upload and naming the question number. RC-001's
   * adverse report is required by a yes to its question 11; that rule was
   * written inline in the intake bridge until this file existed.
   */
  uploadRequiredWhenYes: Readonly<Record<string, number>>;
  /** The portal route that renders this protocol through the one shared page. */
  portalPath: string;
};

export const PROTOCOL_ENTRIES: readonly ProtocolEntry[] = [
  {
    declaration: RC001,
    versions: RC001_VERSIONS,
    signatureEvidence: RC001_SIGNATURE_EVIDENCE,
    enforced: RC001_ENFORCED,
    ambiguities: RC001_AMBIGUITIES,
    counts: RC001_COUNTS,
    noteBlocks: RC001_NOTE_BLOCKS,
    fieldPrefix: "rc001",
    uploadRequiredWhenYes: { "adverse-report": 11 },
    portalPath: "/portal/protocols/rc-001",
  },
];

/** The entry for a service line, or null when that line has no protocol. */
export function protocolForLine(serviceSlug: string | null | undefined): ProtocolEntry | null {
  if (!serviceSlug) return null;
  return PROTOCOL_ENTRIES.find((p) => p.declaration.serviceSlug === serviceSlug) ?? null;
}

/** The entry for a document number, or null when no protocol carries it. */
export function protocolByDocument(documentNumber: string | null | undefined): ProtocolEntry | null {
  if (!documentNumber) return null;
  return PROTOCOL_ENTRIES.find((p) => p.declaration.documentNumber === documentNumber) ?? null;
}

/** The entry whose portal page lives at this path, or null. */
export function protocolByPortalPath(path: string): ProtocolEntry | null {
  return PROTOCOL_ENTRIES.find((p) => p.portalPath === path) ?? null;
}

export const PROTOCOLS: LineProtocol[] = PROTOCOL_ENTRIES.map((p) => ({
  serviceSlug: p.declaration.serviceSlug,
  documentNumber: p.declaration.documentNumber,
  requiresDiscipline: p.declaration.requiresDiscipline,
}));
