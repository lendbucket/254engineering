/*
 * THE REVIEW ACTIONS AND THEIR LABELS, KEPT FREE OF SERVER IMPORTS SO A CLIENT SCREEN CAN READ THEM.
 *
 * Robert's answer 2 of 2026-11-22 (issue #1, 7080044238), from the byte report
 * 7074090867: a client component importing these labels from their old module
 * also pulled that module's `isOpen` import, and through it launch.ts, the
 * protocol registry and the catalogue, into the browser, about 100 KB on the
 * files, review and messages screens. Moved here whole, comments included, and
 * re-exported from the old module so no server caller changes.
 * `a-client-screen-carries-no-server-registry` keeps it that way.
 */
import type { Determination } from "@/content/protocols";

/**
 * `repairs` joined the four on 2026-09-19, and it is the one the platform could
 * not say before.
 *
 * Appendix C has five determinations and this module had four actions, so
 * REPAIRS REQUIRED mapped to nothing and the write path refused rather than
 * picking the nearest lie. 0053 gives the file a status for it, and this gives
 * the engineer a way to reach it.
 */
export type ReviewAction = "seal" | "revisions" | "site_visit" | "repairs" | "refuse";

export const REVIEW_ACTIONS: ReviewAction[] = ["seal", "revisions", "site_visit", "repairs", "refuse"];

export const ACTION_LABEL: Record<ReviewAction, string> = {
  seal: "Seal and deliver",
  revisions: "Send back for revisions",
  site_visit: "Send back for a site visit",
  repairs: "Withhold certification, issue a repair list",
  refuse: "Decline to seal",
};

/** The shortest reason that is actually a reason. */
export const MIN_REASON_LENGTH = 15;

/**
 * ===========================================================================
 * APPENDIX C: THE ENGINEER'S DETERMINATION, WHICH IS NOT THE PLATFORM'S ACTION.
 * ===========================================================================
 *
 * 254-RC-001 Appendix C: "Applied by the engineer to each evidence package. One
 * determination is recorded per review." It names five. This platform has four
 * review ACTIONS, and they are a different thing, so both exist rather than one
 * being folded into the other.
 *
 * WHY THEY ARE TWO FACTS. A determination is the professional judgement made
 * under a signed protocol, and it is what a board would ask about years later:
 * what did the engineer conclude, and on what. An action is what the software
 * then does to the file. Collapsing them would mean the regulatory record was a
 * workflow state, which is the same mistake as reading a queue status as an
 * opinion.
 *
 * THE MAP IS DECLARED, NEVER INFERRED, and one entry is deliberately null.
 */
export const DETERMINATION_ACTION: Record<Determination, ReviewAction | null> = {
  pass: "seal",
  revise: "revisions",
  /*
   * THIS WAS NULL FOR ONE DAY, AND THE NULL IS WHAT PRODUCED THE STATUS.
   *
   * The document: "Certification withheld and a repair list issued.
   * Certification proceeds only after repairs are verified on revisit." The
   * file is not going back to the technician, because nothing is wrong with the
   * evidence. It is not going back through dispatch yet, because the revisit
   * happens after the OWNER has had work done, which may be months. It is not
   * refused, because certification is withheld rather than declined.
   *
   * So for a day this mapped to nothing, the write path refused with the reason
   * written out, and the gap was a ruling the firm owed rather than a hole
   * somebody forgot to fill. The operator ruled it on 2026-09-19 and named it
   * the third instance of one lesson: a status vocabulary that lacks a word for
   * the situation makes somebody choose the nearest lie. 0053 adds the word.
   *
   * KEPT AS A COMMENT RATHER THAN DELETED, because the reasoning is what stops
   * somebody collapsing this back onto revisions the next time the five and the
   * five look like four and a spare.
   */
  "repairs-required": "repairs",
  "site-revisit": "site_visit",
  decline: "refuse",
};
