/**
 * THE CAPTURE DOOR, AS RULES. Robert's ruling Q2 of 2026-11-02, from audit
 * field F2 and F4: "sign_upload loads the file through jobView, requires the
 * assigned technician and an open status, uploads with upsert false;
 * record_capture refuses a storage key that is not exactly
 * fileId/captureId.ext and confirms the object exists."
 *
 * Pure, so the upload route, recordCapture and the proof read one answer. The
 * check that the object exists needs storage and lives in ops-field.ts beside
 * the write it guards.
 *
 * F2 was the bytes: sign_upload read no file, no status and no assignment and
 * issued an upsert URL, so any technician who knew a file id and a capture id
 * could replace a photograph after the engineer had reviewed and sealed on it.
 * F4 was the row: record_capture wrote whatever storage key the body carried,
 * so a capture on file B could point at a photograph taken for file A, or at
 * nothing, and the checklist read complete either way.
 */

/** The content types a capture may be, each with the extension sign_upload names it by. */
export const CAPTURE_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** A capture id is minted on the device by newCaptureId: cap_ and a uuid, or cap_ and a timestamp fallback. */
export const CAPTURE_ID = /^cap_[A-Za-z0-9-]{8,60}$/;

/**
 * Statuses in which capture is closed. A file that has left the field takes no
 * new bytes and no new rows.
 *
 * refused and repairs_required joined by Robert's ruling Q3 of 2026-11-02
 * (audit field F16): the engineer's decision rests on the record he read, and
 * the assigned technician could go on adding to it after he declined. A
 * revisit for repairs goes back through needs_dispatch first, so closing
 * repairs_required closes nothing the revisit needs.
 */
export const CAPTURE_CLOSED_STATUSES: readonly string[] = [
  "evidence_submitted",
  "under_review",
  "sealed",
  "delivered",
  "closed",
  "cancelled",
  "refused",
  "repairs_required",
];

/**
 * WHO MAY WRITE EVIDENCE: the evidence.capture grant AND the file's assigned
 * technician, whatever the role. Robert's ruling Q3 of 2026-11-02 (audit field
 * F3 and F15). submitEvidence had no assignment check at all, so a technician
 * whose offer was withdrawn could submit the assigned technician's package;
 * and evidence.review let the reviewing engineer and the administrator author
 * captures, exceptions and repair closures on the files they review. Null
 * when the write may proceed, otherwise the sentence.
 */
export function evidenceWriteRefusal(
  actor: { id: string; mayCapture: boolean },
  assignedTechId: string | null,
): string | null {
  if (!actor.mayCapture) return "Evidence is recorded by the technician on the job. Your role reviews it and does not write it.";
  if (assignedTechId !== actor.id) {
    return assignedTechId ? "Another technician accepted this job first." : "Accept this job before recording against it.";
  }
  return null;
}

/**
 * Whether a move takes a file out of waiting for dispatch while offers may
 * still be open, so the open offers are withdrawn with it. Robert's ruling Q3
 * of 2026-11-02 (audit field F7): a cancelled file left its offers live, and a
 * technician accepting one the next morning was told the job was his.
 */
export function leavesDispatchWithOffers(from: string, to: string): boolean {
  return from === "needs_dispatch" && to !== "dispatched";
}

/** The one storage key a capture may carry: its own file's folder, its own capture id, an allowed extension. */
export function captureStorageKey(fileId: string, captureId: string, contentType: string): string | null {
  const ext = CAPTURE_TYPE_EXTENSIONS[contentType];
  return ext ? `${fileId}/${captureId}.${ext}` : null;
}

/**
 * Null when the key is exactly fileId/captureId.ext for an allowed extension,
 * otherwise the sentence the technician reads. A capture with no key (a
 * measurement or a written answer) is not asked.
 */
export function captureKeyProblem(fileId: string, captureId: string, storageKey: string | null | undefined): string | null {
  if (storageKey === null || storageKey === undefined || storageKey === "") return null;
  const allowed = Object.values(CAPTURE_TYPE_EXTENSIONS).map((ext) => `${fileId}/${captureId}.${ext}`);
  return allowed.includes(storageKey)
    ? null
    : "That upload is not this capture's own file on this job, so it was not recorded.";
}

/**
 * Who may upload against a file, and when: only the technician assigned to it,
 * while capture is open. Null when the door is open, otherwise the sentence.
 */
export function captureDoorRefusal(
  actorId: string,
  file: { assigned_tech_id: string | null; status: string },
): string | null {
  if (file.assigned_tech_id !== actorId) {
    return file.assigned_tech_id
      ? "This job is assigned to another technician, so nothing can be uploaded to it from this account."
      : "Accept this job before uploading to it.";
  }
  if (CAPTURE_CLOSED_STATUSES.includes(file.status)) {
    return "This file has left the field. Capture is closed on it.";
  }
  return null;
}
