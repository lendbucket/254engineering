/*
 * THE FILE STATUS LABELS, KEPT FREE OF SERVER IMPORTS SO A CLIENT SCREEN CAN READ THEM.
 *
 * Robert's answer 2 of 2026-11-22 (issue #1, 7080044238), from the byte report
 * 7074090867: a client component importing these labels from their old module
 * also pulled that module's `isOpen` import, and through it launch.ts, the
 * protocol registry and the catalogue, into the browser, about 100 KB on the
 * files, review and messages screens. Moved here whole, comments included, and
 * re-exported from the old module so no server caller changes.
 * `a-client-screen-carries-no-server-registry` keeps it that way.
 */
import type { FileStatus } from "./ops-files";

export const STATUS_LABEL: Record<FileStatus, string> = {
  intake: "Intake",
  needs_dispatch: "Needs dispatch",
  dispatched: "Dispatched",
  evidence_in_progress: "Evidence in progress",
  evidence_submitted: "Evidence submitted",
  under_review: "Under review",
  revisions_requested: "Revisions requested",
  repairs_required: "Repairs required",
  refused: "Declined to seal",
  sealed: "Sealed",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};
