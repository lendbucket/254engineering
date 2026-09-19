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

export type SubmitVerdict =
  | { ok: true; applicable: number; captured: number; excepted: number }
  | { ok: false; because: string; outstanding: string[] };

/**
 * MAY THIS PACKAGE BE SUBMITTED?
 *
 * The one question the technician's screen asks, and the platform's answer to
 * the sentence the process page makes to customers: "Our technician cannot
 * submit the job incomplete. The app will not let him."
 *
 * IT NAMES THE OUTSTANDING ITEMS RATHER THAN COUNTING THEM. A refusal that says
 * "3 items outstanding" sends somebody scrolling; one that names them is a
 * refusal they can act on, which is the difference between a guard and an
 * obstacle.
 */
export function submitVerdict(view: RunView): SubmitVerdict {
  const outstanding = view.items
    .filter((r) => r.status.state === "outstanding")
    .map((r) => r.item.label);

  if (outstanding.length > 0) {
    return {
      ok: false,
      outstanding,
      because:
        `${outstanding.length} of ${view.applicable} items on ${view.protocolDocument} are neither captured nor excepted. ` +
        "Every item is photographed, measured, or recorded as not observed with the reason. " +
        "No item is estimated, assumed, or left blank, which is section 7 of the protocol the engineer signed.",
    };
  }

  return {
    ok: true,
    applicable: view.applicable,
    captured: view.captured,
    excepted: view.excepted,
  };
}
