import type { EvidenceKind } from "./ops-evidence";

/**
 * The evidence binder: what a file's record looks like when it leaves the
 * platform.
 *
 * WHY A BINDER EXISTS AT ALL
 * --------------------------
 * A sealed deliverable is one document. The binder is everything the engineer
 * relied on to seal it: the protocol they reviewed against, every captured item
 * with when and where it was taken, the review decision and its reasoning, and
 * the chain of revisions if the file went back.
 *
 * It is produced for three readers and the same file serves all of them: a
 * client who wants the supporting evidence, an insurer or lender asking what a
 * conclusion rests on, and a board or a court years later asking what was in
 * front of the engineer at the moment they sealed.
 *
 * WHY THE MANIFEST IS BUILT PURELY
 * --------------------------------
 * The binder's value is that it is complete and honest about what it does not
 * contain. Composing it here means the audit can assert both: that every
 * captured item appears, and that an item the protocol required and nobody
 * captured appears too, marked as missing rather than quietly omitted.
 *
 * A binder that silently drops what is absent is a document that makes an
 * incomplete package look complete, which is the opposite of its purpose.
 */

export type BinderItem = {
  itemKey: string;
  label: string;
  kind: EvidenceKind;
  required: boolean;
  captures: {
    id: string;
    valueText: string | null;
    valueNumber: number | null;
    unit: string | null;
    storageKey: string | null;
    capturedAt: string | null;
    lat: number | null;
    lng: number | null;
  }[];
  /** Present and sufficient for what the protocol asked. */
  satisfied: boolean;
  /** Stated on the binder when not satisfied. Never omitted. */
  shortfall: string | null;
};

export type BinderDecision = {
  decision: "seal" | "revisions" | "site_visit" | "refuse";
  at: string;
  engineerName: string;
  licenseNumber: string | null;
  minutes: number | null;
  reason: string | null;
};

export type Binder = {
  fileNumber: string;
  propertyAddress: string;
  city: string | null;
  county: string;
  serviceName: string;
  twiaCounty: boolean;
  protocolName: string | null;
  protocolVersion: number | null;
  technicianName: string | null;
  items: BinderItem[];
  decisions: BinderDecision[];
  /** Every required item captured. */
  complete: boolean;
  missingCount: number;
  generatedAt: string;
  /** What this document does not contain, printed on it. */
  limitations: string[];
};

const DECISION_LABEL: Record<BinderDecision["decision"], string> = {
  seal: "Sealed",
  revisions: "Sent back for revisions",
  site_visit: "Sent back for a site visit",
  refuse: "Declined to seal",
};

export function decisionLabel(decision: BinderDecision["decision"]): string {
  return DECISION_LABEL[decision];
}

/**
 * What the binder says about itself.
 *
 * Every document that leaves this firm carries its own limits, for the same
 * reason the public site does: a reader who has to infer what a document covers
 * will infer generously.
 */
export function limitationsFor(input: {
  complete: boolean;
  missingCount: number;
  sealed: boolean;
  photographCount: number;
}): string[] {
  const limits: string[] = [];

  limits.push(
    "This binder is the evidence record held by the platform. It is not an engineering opinion and it is not sealed.",
  );

  if (!input.complete) {
    limits.push(
      `${input.missingCount} item${input.missingCount === 1 ? "" : "s"} the protocol required ${
        input.missingCount === 1 ? "is" : "are"
      } not present. They are listed with the rest rather than left out, so this document cannot be read as a complete package.`,
    );
  }

  if (!input.sealed) {
    limits.push(
      "No sealed deliverable exists for this file. The evidence here has not been certified by a licensed engineer.",
    );
  }

  limits.push(
    `Photographs are referenced by their storage identifier and are not embedded. ${input.photographCount} ${
      input.photographCount === 1 ? "image is" : "images are"
    } held in the private evidence store and are released by the firm on request.`,
  );

  limits.push(
    "Locations recorded against a capture are from the device that took it, to the accuracy that device reported, and are not a survey.",
  );

  return limits;
}

/**
 * The binder as a CSV, which is the format a client, an insurer and a court can
 * all open without being told how.
 *
 * A PDF would look better and would need a rendering dependency, a font
 * decision, and a page layout that nobody can diff. This is the record, and the
 * record's job is to be readable in ten years by software nobody has chosen yet.
 */
export function binderRows(binder: Binder): unknown[][] {
  const rows: unknown[][] = [];

  for (const item of binder.items) {
    if (item.captures.length === 0) {
      rows.push([
        item.itemKey,
        item.label,
        item.kind,
        item.required ? "required" : "optional",
        "MISSING",
        item.shortfall ?? "Not captured.",
        "",
        "",
        "",
      ]);
      continue;
    }
    for (const capture of item.captures) {
      rows.push([
        item.itemKey,
        item.label,
        item.kind,
        item.required ? "required" : "optional",
        item.satisfied ? "present" : "insufficient",
        capture.valueText ??
          (capture.valueNumber === null
            ? ""
            : `${capture.valueNumber}${capture.unit ? ` ${capture.unit}` : ""}`),
        capture.storageKey ?? "",
        capture.capturedAt ?? "",
        capture.lat !== null && capture.lng !== null ? `${capture.lat}, ${capture.lng}` : "",
      ]);
    }
  }

  return rows;
}

export const BINDER_HEADERS = [
  "Item key",
  "What the protocol asked for",
  "Kind",
  "Required",
  "Status",
  "Value",
  "Stored file",
  "Captured at",
  "Location",
];
