import type { JobView } from "./ops-field";
import type { PhotoAnswer } from "./protocol-run";
import type { EvidenceKind } from "./ops-evidence";

/**
 * WHAT THE CHECKLIST IS GIVEN, BUILT IN ONE PLACE. Robert's T2, 2026-11-07.
 *
 * The job page renders the checklist from these props on the server, and the
 * offline day pack carries the same props to the phone so the offline screen can
 * render the same checklist with no signal. Two copies of this mapping would be
 * two accounts of what a technician is asked to capture, and the copy on the
 * phone is the one nobody would notice drifting. So both call this.
 *
 * It carries the protocol's items, what is already captured and the recorded
 * absences, and nothing else: no offer, no fee, no price, nothing about any
 * other technician. Plain data, so it survives being written into IndexedDB.
 */
export type ChecklistProps = {
  protocolName: string;
  items: {
    id: string;
    itemKey: string;
    kind: EvidenceKind;
    label: string;
    instructions: string | null;
    required: boolean;
    unit: string | null;
    minValue: number | null;
    maxValue: number | null;
    minCount: number | null;
    answer: PhotoAnswer | null;
  }[];
  captures: {
    id: string;
    itemKey: string;
    kind: EvidenceKind;
    valueText: string | null;
    valueNumber: number | null;
    storageKey: string | null;
    capturedAt: string | null;
  }[];
  exceptions: { itemKey: string; kind: "not_observed" | "not_applicable"; reason: string }[];
};

/** The checklist's props for a job with a protocol, or null when none is attached. */
export function checklistPropsFrom(view: JobView, photoAnswers: Record<string, PhotoAnswer>): ChecklistProps | null {
  if (!view.protocol) return null;
  return {
    protocolName: `${view.protocol.name} v${view.protocol.version}`,
    items: view.protocol.items.map((i) => ({
      id: i.id,
      itemKey: i.itemKey,
      kind: i.kind,
      label: i.label,
      instructions: i.instructions ?? null,
      required: i.required,
      unit: i.unit ?? null,
      minValue: i.minValue ?? null,
      maxValue: i.maxValue ?? null,
      minCount: i.minCount ?? null,
      answer: photoAnswers[i.itemKey] ?? null,
    })),
    captures: view.captures.map((c) => ({
      id: c.id,
      itemKey: c.item_key,
      kind: c.kind,
      valueText: c.value_text,
      valueNumber: c.value_number === null ? null : Number(c.value_number),
      storageKey: c.storage_key,
      capturedAt: c.captured_at ?? null,
    })),
    exceptions: view.exceptions.map((e) => ({
      itemKey: e.item_key,
      kind: e.kind,
      reason: e.reason,
    })),
  };
}
