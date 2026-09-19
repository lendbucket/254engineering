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

/**
 * AN ITEM THE TECHNICIAN COULD NOT OBSERVE, WITH THE REASON.
 * Added 2026-09-19, from section 7 of 254-RC-001.
 *
 * "The technician records each item that could not be observed and the reason.
 * No item is estimated, assumed, or left blank." Section 8 adds the second
 * kind: "An item that does not apply to the property is marked with the reason
 * it does not apply."
 *
 * Until this existed, an item was satisfied or it was not, and a roof that
 * genuinely could not be walked left the technician with nothing to record
 * except a blank. A blank is the thing the protocol forbids, so the platform
 * was quietly asking for the one outcome the document rules out.
 *
 * Stored in eng_checklist_exceptions by 0051, which constrains the reason to
 * survive trimming so it cannot be satisfied with a space bar.
 */
export type ItemException = {
  itemKey: string;
  reason: string;
  kind: "not_observed" | "not_applicable";
};

export type ItemStatus = {
  item: ProtocolItem;
  captured: number;
  satisfied: boolean;
  problem: string | null;
  /**
   * Set when the item is satisfied by a recorded exception rather than by
   * evidence. Named rather than folded into `satisfied`, because "we
   * photographed it" and "we recorded why we could not" are different facts and
   * the engineer reviewing the package needs to tell them apart.
   */
  exception?: ItemException;
};

/** Is one protocol item satisfied by what has been captured against it? */
export function itemStatus(item: ProtocolItem, captures: CapturedItem[]): ItemStatus {
  const mine = captures.filter((c) => c.itemKey === item.itemKey);
  const needed = item.kind === "photo" ? Math.max(1, item.minCount ?? 1) : 1;

  let usable = 0;
  /*
   * A value that was recorded and fell outside the expected range.
   *
   * Kept apart from the general problem because of what happens next: a
   * technician records a pitch of 40, sees the item is still blocked, and
   * records 6. If the out of range reading kept blocking, that item would be
   * unsatisfiable for the rest of the visit and the only way out would be
   * deleting a capture, which nobody would think to do while standing on a
   * roof. The correction counts, and the bad reading is still in the record for
   * the engineer to see.
   *
   * Found by walking the flow: the package would not submit and the blocker
   * named a measurement that had already been corrected.
   */
  let rangeProblem: string | null = null;

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
          rangeProblem = `${v}${item.unit ? ` ${item.unit}` : ""} is below the expected minimum of ${item.minValue}.`;
          break;
        }
        if (item.maxValue != null && v > item.maxValue) {
          rangeProblem = `${v}${item.unit ? ` ${item.unit}` : ""} is above the expected maximum of ${item.maxValue}.`;
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

  const satisfied = usable >= needed;
  let problem: string | null = satisfied ? null : rangeProblem;
  if (!satisfied && !problem) {
    if (usable === 0) {
      /*
       * An optional item that has not been captured is not a shortfall, and
       * telling a technician an optional item "needs a photograph" is telling
       * them something that is not true. It reads as a requirement, and a
       * checklist that cries wolf on the optional items is one where the
       * required ones stop standing out.
       */
      const noun =
        item.kind === "photo"
          ? needed > 1
            ? `${needed} photographs`
            : "a photograph"
          : item.kind === "document"
            ? "a document"
            : item.kind === "note"
              ? "a note"
              : "a value";
      problem = item.required ? `Needs ${noun}.` : `Optional. Add ${noun} if it applies.`;
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
export function checklistState(
  items: ProtocolItem[],
  captures: CapturedItem[],
  /*
   * EXCEPTIONS ARE OPTIONAL SO EVERY EXISTING CALLER IS UNCHANGED, and the
   * default is an empty list rather than undefined-means-ignore: a job with no
   * exceptions recorded has none, which is a real answer.
   */
  exceptions: ItemException[] = [],
): ChecklistState {
  const byKey = new Map(exceptions.map((e) => [e.itemKey, e]));
  const statuses = items.map((item) => {
    const status = itemStatus(item, captures);
    if (status.satisfied) return status;
    const exception = byKey.get(item.itemKey);
    /*
     * AN EXCEPTION SATISFIES THE ITEM AND SAYS SO, rather than being a second
     * kind of pass nobody can see. The engineer's review reads `exception` to
     * know that this item is a recorded absence rather than a photograph, which
     * is exactly the distinction Appendix C asks him to weigh.
     */
    if (exception) {
      return { ...status, satisfied: true, problem: null, exception };
    }
    return status;
  });
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
