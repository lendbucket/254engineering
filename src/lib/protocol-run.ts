import { RC001 } from "@/content/protocols/rc-001";
import { RC001_CHECKLIST, RC001_SECTIONS } from "@/content/protocols/rc-001-checklist";
import type { ChecklistItem } from "@/content/protocols/rc-001-checklist";

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
export function itemsFor(covering: string | null): ChecklistItem[] {
  return RC001_CHECKLIST.filter(
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
export function runView(input: {
  covering: string | null;
  evidenceByItem: Record<string, string[]>;
  exceptionsByItem: Record<string, { reason: string; kind: "not_observed" | "not_applicable" }>;
}): RunView {
  const items = itemsFor(input.covering).map((item): RunItem => {
    const evidence = input.evidenceByItem[item.key] ?? [];
    if (evidence.length > 0) return { item, status: { state: "captured", evidenceIds: evidence } };
    const exception = input.exceptionsByItem[item.key];
    if (exception) {
      return { item, status: { state: "excepted", reason: exception.reason, kind: exception.kind } };
    }
    return { item, status: { state: "outstanding" } };
  });

  const sections = RC001_SECTIONS.map((s) => ({
    key: s.key,
    heading: s.heading,
    items: items.filter((r) => r.item.section === s.key),
  })).filter((s) => s.items.length > 0);

  return {
    protocolDocument: RC001.documentNumber,
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
export function protocolItemRows(): ProtocolItemRow[] {
  return RC001_CHECKLIST.map((item, index) => ({
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
 * It is a lookup rather than a map because there is one entry today, and a map
 * keyed on a string that only ever holds one key reads as more generality than
 * exists. `PROTOCOLS` in src/content/protocols/index.ts is the declared
 * inventory; this asks it rather than carrying a second list.
 */
export function protocolItemRowsFor(documentNumber: string | null): ProtocolItemRow[] | null {
  if (documentNumber === null) return null;
  return documentNumber === RC001.documentNumber ? protocolItemRows() : null;
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
