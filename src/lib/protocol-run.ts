import { protocolByDocument, type ProtocolEntry, type ProtocolChecklistItem, type DeterminationRule } from "@/content/protocols";
import { STRUCTURED_DECLARATIONS, structuredDeclaration } from "@/content/protocols/structured";

/*
 * ONE PROTOCOL TO MANY, 2026-10-06. Every function here takes the protocol it
 * is about, as an entry from src/content/protocols/index.ts, rather than
 * importing 254-RC-001 by name. Nothing about what the functions compute
 * changed: they read the same fields of whichever protocol they are handed.
 */
type ChecklistItem = ProtocolChecklistItem;

/**
 * ===========================================================================
 * WORKING A PROTOCOL ON A JOB: WHICH ITEMS APPLY, AND IS IT COMPLETE.
 * ===========================================================================
 *
 * Migration 0051 records what a technician captured and what could not be
 * observed, and deliberately does not judge completeness. This is where that
 * judgement lives, and the reason it lives here rather than in a constraint is
 * written in the migration: "complete or properly excepted" is a rule about the
 * PROTOCOL's item list, which is in the signed document and its transcription.
 * Postgres cannot know 254-RC-001 has 51 items, nor which of them apply to a
 * metal roof.
 *
 * THE RULE, FROM SECTION 7 OF THE SIGNED PROTOCOL: "the technician records each
 * item that could not be observed and the reason. No item is estimated,
 * assumed, or left blank." And from section 8: "An item that does not apply to
 * the property is marked with the reason it does not apply."
 *
 * So an item is SATISFIED when it has evidence, or EXCEPTED when it has a
 * recorded reason. Anything else is outstanding, and a package with anything
 * outstanding cannot be submitted. That is the sentence the process page makes
 * to customers, and this is the code that makes it true.
 *
 * ABSENT IS NOT ZERO HERE EITHER. An item with no evidence and no exception is
 * not "fine by default" and not "failed": it is NOT DONE, which is a third
 * state, and the technician's screen shows it as outstanding rather than
 * silently passing over it.
 */

export type ItemState =
  | { state: "captured"; evidenceIds: string[] }
  | { state: "excepted"; reason: string; kind: "not_observed" | "not_applicable" }
  | { state: "outstanding" };

export type RunItem = {
  item: ChecklistItem;
  status: ItemState;
};

export type RunView = {
  protocolDocument: string;
  /** Only the items that apply to this job, in document order. */
  items: RunItem[];
  sections: { key: string; heading: string; items: RunItem[] }[];
  applicable: number;
  captured: number;
  excepted: number;
  outstanding: number;
};

/**
 * WHICH ITEMS APPLY TO THIS JOB.
 *
 * `coveringOnly` is the document's own qualifier: some items are printed for a
 * shingle roof and are meaningless on a metal one. An item that does not apply
 * is NOT outstanding and does not need an exception, because the document
 * already says it does not apply.
 *
 * THE COVERING IS REQUIRED RATHER THAN DEFAULTED, and that is deliberate. A
 * default of "shingle" would silently drop every metal-only item from a metal
 * job's list and the package would read complete. Where the covering is not
 * known, every conditional item applies, because the conservative direction on
 * an evidence package is to ask for more rather than less.
 */
export function itemsFor(protocol: ProtocolEntry, covering: string | null): ChecklistItem[] {
  return protocol.declaration.checklist.filter(
    (i) => i.coveringOnly === null || covering === null || i.coveringOnly === covering,
  );
}

/**
 * The state of every applicable item, from what the job actually holds.
 *
 * `evidenceByItem` and `exceptionsByItem` are passed in rather than read here,
 * so this function is pure and the read that feeds it is exercised where it
 * lives. The comms-audit incident is the reason that distinction is worth the
 * extra argument: a rule proven with hand built inputs says nothing about
 * whether production can construct them.
 */
export function runView(
  protocol: ProtocolEntry,
  input: {
    covering: string | null;
    evidenceByItem: Record<string, string[]>;
    exceptionsByItem: Record<string, { reason: string; kind: "not_observed" | "not_applicable" }>;
  },
): RunView {
  const items = itemsFor(protocol, input.covering).map((item): RunItem => {
    const evidence = input.evidenceByItem[item.key] ?? [];
    if (evidence.length > 0) return { item, status: { state: "captured", evidenceIds: evidence } };
    const exception = input.exceptionsByItem[item.key];
    if (exception) {
      return { item, status: { state: "excepted", reason: exception.reason, kind: exception.kind } };
    }
    return { item, status: { state: "outstanding" } };
  });

  const sections = protocol.declaration.sections.map((s) => ({
    key: s.key,
    heading: s.heading,
    items: items.filter((r) => r.item.section === s.key),
  })).filter((s) => s.items.length > 0);

  return {
    protocolDocument: protocol.declaration.documentNumber,
    items,
    sections,
    applicable: items.length,
    captured: items.filter((r) => r.status.state === "captured").length,
    excepted: items.filter((r) => r.status.state === "excepted").length,
    outstanding: items.filter((r) => r.status.state === "outstanding").length,
  };
}

/**
 * ===========================================================================
 * THE BRIDGE: THE SIGNED PROTOCOL'S ITEMS AS eng_protocol_items ROWS.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-19, on seeding the 51 items when the engineer
 * approves the protocol: "That is not approving on his behalf; it is his
 * approval taking effect. A protocol that is approved and whose items do not
 * exist is approved in name only, and the rows are created by his act rather
 * than before it."
 *
 * HIS SECOND CONDITION IS WHY THIS FUNCTION EXISTS RATHER THAN A HAND WRITTEN
 * SEED: the rows derive from the registry, which is verified verbatim against
 * the signed PDF, so what a technician is dispatched against is what the
 * engineer signed rather than a re-typing of it.
 *
 * WHERE DRIFT COULD STILL ENTER, STATED PLAINLY. The registry and
 * eng_protocol_items have different shapes, so this is a MAPPING, and a mapping
 * is a place a transcription can go wrong even when both ends are correct.
 * `protocol-run-audit` asserts the round trip: every registry item appears
 * exactly once, every key survives, and the count matches. That check is the
 * point of separating this function out rather than inlining it in the seeder.
 *
 * THE KIND IS DERIVED FROM WHAT THE DOCUMENT ASKS FOR, not chosen. An item the
 * document marks [PHOTO] is a photo item; one carrying a capture prompt is the
 * kind that prompt implies; the rest are notes. Nothing here invents a
 * requirement the document does not state.
 */
export type ProtocolItemRow = {
  sort_order: number;
  item_key: string;
  kind: "photo" | "measurement" | "reading" | "document" | "note";
  label: string;
  instructions: string | null;
  required: boolean;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  min_count: number | null;
};

function kindFor(item: ChecklistItem): ProtocolItemRow["kind"] {
  if (item.photo) return "photo";
  if (item.capture?.kind === "count") return "measurement";
  if (item.capture?.kind === "temperature") return "reading";
  return "note";
}

/**
 * Every item of the signed protocol, as rows, in document order.
 *
 * EVERY ITEM IS REQUIRED, AND THAT IS THE DOCUMENT'S POSITION RATHER THAN A
 * CONVENIENCE. Section 7: "No item is estimated, assumed, or left blank." An
 * item a technician may silently skip is exactly the blank the protocol
 * forbids. What the document allows instead is an EXCEPTION with a reason,
 * which `ops-evidence` treats as satisfying the item, so nothing here needs an
 * optional tier to let a job finish honestly.
 */
export function protocolItemRows(protocol: ProtocolEntry): ProtocolItemRow[] {
  return checklistItemRows(protocol.declaration.checklist);
}

/**
 * THE ITEMS A PORTAL SIGNATURE PUTS IN FORCE, from the structured declaration
 * he signed rather than from the registry (src/content/protocols/structured.ts
 * says why). Operator rulings of 2026-10-22, migration 0081. Null when no
 * structured declaration carries that document at that version, which refuses
 * putting it in force rather than seeding anything plausible.
 */
export function signedProtocolItemRows(documentNumber: string, version: string): ProtocolItemRow[] | null {
  const declaration = structuredDeclaration(documentNumber, version);
  return declaration ? checklistItemRows(declaration.checklist as readonly ChecklistItem[]) : null;
}

function checklistItemRows(checklist: readonly ChecklistItem[]): ProtocolItemRow[] {
  return checklist.map((item, index) => ({
    sort_order: index,
    item_key: item.key,
    kind: kindFor(item),
    label: item.label,
    /*
     * The instruction carries what the document asks for beyond the label: a
     * ruler in frame, one capture per occurrence, and the capture prompt. It is
     * assembled from the item's own flags rather than written out, so a flag
     * that changes in the registry changes what the technician is told.
     */
    instructions:
      [
        item.ruler ? "Ruler in frame." : null,
        item.perOccurrence ? "One capture per occurrence." : null,
        item.capture ? `Record: ${item.capture.prompt}` : null,
        item.coveringOnly ? `Applies to ${item.coveringOnly} coverings only.` : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
    required: true,
    unit: item.capture?.kind === "temperature" ? "F" : null,
    min_value: null,
    max_value: null,
    min_count: null,
  }));
}

/**
 * The registry's items for a protocol named by its DOCUMENT NUMBER, or null.
 *
 * NULL IS THE IMPORTANT ANSWER HERE. A protocol row in the database whose
 * document number this repository has never heard of is not a protocol whose
 * items can be derived from a signed document, and the approval refuses it
 * rather than seeding something plausible. That is the operator's second
 * condition read strictly: the rows derive from the registry, so a protocol
 * outside the registry has no rows to derive.
 *
 * It asks the declared inventory in src/content/protocols/index.ts rather than
 * carrying a second list. Until 2026-10-06 it compared against 254-RC-001's
 * number directly, because that was the only entry; the answer for RC-001 is
 * the same rows either way.
 */
export function protocolItemRowsFor(documentNumber: string | null): ProtocolItemRow[] | null {
  const protocol = protocolByDocument(documentNumber);
  return protocol ? protocolItemRows(protocol) : null;
}

/**
 * THE PROTOCOLS REVIEWED UNDER THEIR PORTAL SIGNATURE, NOT THE REGISTRY.
 * Operator ruling of 2026-10-23: determination recording for 254-FC-001 and
 * 254-PL-001, so a review of a file worked to either records one of the five
 * Appendix C determinations with what it rested on, exactly as 254-RC-001 does.
 * Named here rather than derived from STRUCTURED_DECLARATIONS, because each
 * line enters review by a ruling: the other five signed protocols stay out
 * until somebody rules them in.
 *
 * 254-MH-001 and 254-SL-001 entered by Robert's ruling of 2026-10-25, 23:51
 * Central, item B: their letters are built and sealed, and a letter seals only
 * against the determination its engineer recorded (0062's check).
 *
 * 254-RS-001 entered by the same ruling, item C: the engineer seals his own
 * repair specification and the seal act records it as a letter's does, which
 * binds it to his determination on the file (0062's check). Section 11 issues
 * the specification on a pass.
 */
export const REVIEWED_UNDER_SIGNATURE = ["254-FC-001", "254-PL-001", "254-MH-001", "254-SL-001", "254-RS-001"] as const;

/** Appendix C as a review reads it: the five determinations, verbatim from the declaration. */
export type GoverningDeclaration = {
  documentNumber: string;
  determinations: readonly DeterminationRule[];
};

/**
 * WHICH SIGNED PROTOCOL GOVERNS A REVIEW, AND ITS APPENDIX C, or null.
 *
 * 254-RC-001 governs from the registry, as it always has. A protocol in
 * REVIEWED_UNDER_SIGNATURE governs only while the file's protocol row is
 * PUBLISHED, which since 0081 means a live signature put it in force: a draft
 * or voided row has no Appendix C anybody signed, and a review of it is not
 * forced through one. The structured declaration must be the only one carrying
 * that document, so a second version arriving cannot silently pick the wrong
 * text; until one is ruled on, the answer is null.
 */
export function governingDeclaration(documentNumber: string | null, protocolStatus: string | null): GoverningDeclaration | null {
  if (!documentNumber) return null;
  const registered = protocolByDocument(documentNumber);
  if (registered) return { documentNumber, determinations: registered.declaration.determinations };
  if (!(REVIEWED_UNDER_SIGNATURE as readonly string[]).includes(documentNumber)) return null;
  if (protocolStatus !== "published") return null;
  const carrying = STRUCTURED_DECLARATIONS.filter((d) => d.documentNumber === documentNumber);
  if (carrying.length !== 1) return null;
  /*
   * The same five keys and the same shape as RC-001's: the transcription
   * keeps Appendix C's words exactly, and protocol-registry-audit proves them.
   */
  return { documentNumber, determinations: carrying[0].determinations as unknown as readonly DeterminationRule[] };
}

/**
 * THE PHOTOGRAPH ITEMS THAT ALSO ASK FOR A WRITTEN ANSWER. Operator ruling,
 * 2026-10-15.
 *
 * kindFor makes an item with [PHOTO] a photo item even when the document also
 * prints a value to record beside it, so the capture prompt reached the
 * technician only as the words "Record: ..." under a camera button, with
 * nowhere to type the answer. On 254-RC-001 that is four items: the seal-bond
 * ambient temperature (section 8: the result "is not meaningful without it"),
 * the tile count per plane, the deck material and thickness, and the
 * owner-reported roof age. The ruling named three; the fourth is the same
 * defect and was found by the proof's pinned list.
 *
 * Derived from the registry rather than listed, so the set is whatever the
 * signed document prints, and the document's text is not touched: the prompt is
 * the document's own words. A count is a whole number of zero or more, a
 * temperature is any number, and anything else is text.
 */
export type PhotoAnswer = { prompt: string; numeric: boolean; wholeNonNegative: boolean };

export function photoAnswersFor(documentNumber: string | null): Record<string, PhotoAnswer> {
  const protocol = protocolByDocument(documentNumber);
  const out: Record<string, PhotoAnswer> = {};
  if (!protocol) return out;
  for (const item of protocol.declaration.checklist) {
    if (item.photo && item.capture) {
      out[item.key] = {
        prompt: item.capture.prompt,
        numeric: item.capture.kind === "count" || item.capture.kind === "temperature",
        wholeNonNegative: item.capture.kind === "count",
      };
    }
  }
  return out;
}

/**
 * The refusal for a photograph sent without the answer its item asks for, or
 * null when it may be recorded. One home, called by recordCapture.
 */
export function photoAnswerRefusal(
  asks: PhotoAnswer | undefined,
  input: { valueText?: string | null; valueNumber?: number | null },
): string | null {
  if (!asks) return null;
  const n = input.valueNumber;
  const answered = asks.numeric
    ? typeof n === "number" &&
      Number.isFinite(n) &&
      (!asks.wholeNonNegative || (Number.isInteger(n) && n >= 0))
    : Boolean(input.valueText?.trim());
  return answered ? null : `Record ${asks.prompt.toLowerCase()} with this photograph.`;
}

/*
 * ===========================================================================
 * THE SUBMIT GATE IS NOT HERE, AND IT WAS, FOR TWO COMMITS.
 * ===========================================================================
 *
 * This file shipped a submitVerdict that refused a package with anything
 * outstanding. checklistState in src/lib/ops-evidence.ts has computed exactly
 * that since Phase 2, with named blockers, and it is what the technician's
 * screen at /portal/jobs/[id] already calls.
 *
 * So for two commits this repository carried TWO implementations of "may this
 * package be submitted", written by the session that had recorded
 * one-fact-two-homes five times that week and had just added a hook to stop a
 * different instance of the same class.
 *
 * IT WAS FOUND BY READING THE EXISTING SURFACE BEFORE BUILDING A SECOND ONE,
 * which is the only reason it was found at all. Nothing on the board would have
 * caught it: both implementations were correct, both were tested, and they
 * agreed. Two right answers to one question is not a contradiction anything can
 * detect, right up until somebody changes one of them.
 *
 * The gate stays in ops-evidence, where the caller already is. What was
 * genuinely missing was the EXCEPTION, and that went into ops-evidence too
 * rather than being kept here as a parallel notion of satisfied.
 *
 * WHAT REMAINS IN THIS FILE IS THE ONE THING ops-evidence CANNOT DO: decide
 * which of the SIGNED protocol's items apply to a job. That is a question about
 * the document rather than about the rows a job was dispatched against.
 * ops-evidence takes its item list as given, and something has to produce that
 * list from the protocol, with the covering qualifier applied.
 */
