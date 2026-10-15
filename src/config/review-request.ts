/**
 * THE GOOGLE REVIEW REQUEST. Operator ruling, 2026-10-10 (run item 25).
 *
 * One email per delivered order, sent by the job queue a set number of days
 * after delivery, to every customer alike: no asking first whether they were
 * happy, no incentive, never sent twice. It is marketing shaped rather than
 * order correspondence, so it carries an unsubscribe and nothing is sent to an
 * address on the suppression list.
 *
 * EMPTY UNTIL ROBERT GIVES THE BUSINESS PROFILE URL, AND NOTHING SENDS WHILE IT
 * IS. A delivered order still queues its request; when the job runs with no
 * link it records on the order that nothing was sent and why, and stops.
 */
export const REVIEW_LINK = "";

/*
 * Days after delivery. A default chosen in the run of 2026-10-10 and put to the
 * operator in the run report; the ruling, when given, is written here and
 * pinned in scripts/proofs/a-review-request-goes-once-or-not-at-all.mjs.
 */
export const REVIEW_REQUEST_DELAY_DAYS = 7;
