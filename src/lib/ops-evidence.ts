/**
 * Protocol driven evidence: what a technician must capture, and when the
 * checklist may be submitted.
 *
 * PURE, AND THE SUBMISSION GATE IS THE POINT
 * ------------------------------------------
 * An engineer authors a protocol. A technician works it. The file cannot leave
 * the technician's hands until every required item is captured, because the
 * alternative is an engineer opening an evidence package at review and finding
 * the one photograph that mattered is missing, by which time the roof is closed
 * up and somebody is driving back.
 *
 * That rule lives here, pure, so it can be asserted exhaustively rather than
 * trusted to a disabled button. The button is disabled too, and the button is
 * not what enforces it.
 *
 * WHAT COUNTS AS CAPTURED DEPENDS ON THE KIND
 * -------------------------------------------
 * A photo item needs at least one uploaded photo, and may need several: a roof
 * with four elevations wants four. A measurement needs a number, and zero is a
 * number, so it is checked for presence rather than truthiness. That distinction
 * has bitten every form anybody has ever written.
 *
 * A note needs text. A document needs a file. None of them is satisfied by an
 * empty string, and whitespace is an empty string.
 */

export type EvidenceKind = "photo" | "measurement" | "reading" | "document" | "note";

export type ProtocolItem = {
  id: string;
  itemKey: string;
  kind: EvidenceKind;
  label: string;
  instructions?: string | null;
  required: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  /** For photo items that need more than one frame. */
  minCount?: number | null;
};

export type CapturedItem = {
  itemKey: string;
  kind: EvidenceKind;
  valueText?: string | null;
  valueNumber?: number | null;
  storageKey?: string | null;
};

export type ItemStatus = {
  item: ProtocolItem;
  captured: number;
  satisfied: boolean;
  problem: string | null;
};

/** Is one protocol item satisfied by what has been captured against it? */
export function itemStatus(item: ProtocolItem, captures: CapturedItem[]): ItemStatus {
  const mine = captures.filter((c) => c.itemKey === item.itemKey);
  const needed = item.kind === "photo" ? Math.max(1, item.minCount ?? 1) : 1;

  let usable = 0;
  let problem: string | null = null;

  for (const capture of mine) {
    switch (item.kind) {
      case "photo":
      case "document":
        if (capture.storageKey) usable++;
        break;
      case "measurement":
      case "reading": {
        // Presence, not truthiness. A reading of zero is a reading.
        if (capture.valueNumber === null || capture.valueNumber === undefined) break;
        const v = capture.valueNumber;
        if (item.minValue != null && v < item.minValue) {
          problem = `${v}${item.unit ? ` ${item.unit}` : ""} is below the expected minimum of ${item.minValue}.`;
          break;
        }
        if (item.maxValue != null && v > item.maxValue) {
          problem = `${v}${item.unit ? ` ${item.unit}` : ""} is above the expected maximum of ${item.maxValue}.`;
          break;
        }
        usable++;
        break;
      }
      case "note":
        if ((capture.valueText ?? "").trim().length > 0) usable++;
        break;
    }
  }

  const satisfied = usable >= needed && problem === null;
  if (!satisfied && !problem) {
    if (usable === 0) {
      problem =
        item.kind === "photo"
          ? needed > 1
            ? `Needs ${needed} photographs.`
            : "Needs a photograph."
          : item.kind === "document"
            ? "Needs a document."
            : item.kind === "note"
              ? "Needs a note."
              : "Needs a value.";
    } else {
      problem = `${usable} of ${needed} captured.`;
    }
  }

  return { item, captured: usable, satisfied, problem: satisfied ? null : problem };
}

export type ChecklistState = {
  items: ItemStatus[];
  requiredTotal: number;
  requiredDone: number;
  optionalDone: number;
  canSubmit: boolean;
  blockers: string[];
};

/**
 * The whole checklist, and whether it may be submitted.
 *
 * Optional items never block. They are optional because the engineer who wrote
 * the protocol decided they were, and a platform that quietly required them
 * would be overruling the person in responsible charge.
 */
export function checklistState(items: ProtocolItem[], captures: CapturedItem[]): ChecklistState {
  const statuses = items.map((item) => itemStatus(item, captures));
  const required = statuses.filter((s) => s.item.required);
  const blockers = required
    .filter((s) => !s.satisfied)
    .map((s) => `${s.item.label}: ${s.problem}`);

  return {
    items: statuses,
    requiredTotal: required.length,
    requiredDone: required.filter((s) => s.satisfied).length,
    optionalDone: statuses.filter((s) => !s.item.required && s.satisfied).length,
    canSubmit: blockers.length === 0 && required.length > 0,
    blockers,
  };
}

/**
 * A capture id generated on the phone, before anything is uploaded.
 *
 * THE OFFLINE QUEUE DEPENDS ON THIS
 * ---------------------------------
 * A technician in a rural county captures with no signal. The photo is queued
 * locally and uploaded when connectivity returns, and a retry that arrives twice
 * must not produce the same photograph twice. The id is minted at capture time,
 * travels with the upload, and the unique index on (file_id, client_capture_id)
 * makes the second arrival a no-op rather than a duplicate.
 *
 * Generated on the device rather than requested from the server, because
 * requesting one requires the network the technician does not have.
 */
export function newCaptureId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cap_${random}`;
}

/** A human summary for the file list and the tech's job card. */
export function progressLabel(state: ChecklistState): string {
  if (state.requiredTotal === 0) return "No protocol attached";
  if (state.canSubmit) return `Ready to submit, ${state.requiredDone} of ${state.requiredTotal}`;
  return `${state.requiredDone} of ${state.requiredTotal} required captured`;
}
