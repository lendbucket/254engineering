/**
 * ===========================================================================
 * WORK THE OPERATOR HAS PARKED, WITH THE DATE IT COMES BACK.
 * Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * WHY THIS IS A CONFIG FILE AND NOT A PARAGRAPH IN A DOCUMENT.
 *
 * The cutover plan was parked on 2026-09-15 and the word "parked" sat at the
 * top of it. It had been deferred at least three times before that, and every
 * deferral reads identically on the page: there is no way to tell one decided
 * last week from one decided last quarter. `docs/production-cutover-plan.md`
 * itself records the cost of exactly that failure, where a project was written
 * down as deleted and was alive, billable and holding rows eleven days later.
 *
 * THE RULE THIS REPOSITORY ALREADY HAD, and which prose could not carry: a
 * third verdict that never expires is an exemption. `compliance-audit` applies
 * it to the engineer's roster lag, which is ACKNOWLEDGED with a date on the
 * line and becomes a FAIL the day after. A park with a date in a markdown file
 * has the date and no mechanism, which is the "a record is not a check"
 * failure this repository has already paid for once with migration 0023.
 *
 * So a park is DATA, an audit reads it, and the day after its date the board
 * goes red naming it. Re-ruling it is an edit somebody makes on purpose, which
 * is the same shape as every other condition the gate reads.
 *
 * WHAT A PARK IS NOT. It is not a backlog item. Everything in BACKLOG.md is
 * undone and most of it has no date and needs none. A park is work with a
 * decided return date, where letting the date slide unnoticed is the risk.
 */

import { todayInFirmCalendar } from "@/lib/firm-calendar";

export type ParkedWork = {
  /** Stable key. compliance-audit pins these, so renaming one is deliberate. */
  id: string;
  /** What is parked, in one line. */
  what: string;
  /** Where the full reasoning lives. A park is never explained twice. */
  reasoningIn: string;
  /** Who parked it. A decision with no author is a drift. */
  ruledBy: string;
  /** ISO date it was ruled, in the firm's calendar. */
  ruledOn: string;
  /**
   * ISO date it is acknowledged through, in the firm's calendar. From the day
   * after this, it is a finding unless somebody re-rules it.
   */
  acknowledgedThrough: string;
  /** Why it was parked, in the operator's own terms. */
  because: string;
  /**
   * What it costs while parked, stated rather than implied. A park with no
   * stated cost reads as free, and the next person to review it has nothing to
   * weigh the delay against.
   */
  costsWhileParked: string;
};

export const parkedWork: ParkedWork[] = [
  {
    id: "production-cutover",
    what: "Moving this firm off the shared production project onto one of its own.",
    reasoningIn: "docs/production-cutover-plan.md",
    ruledBy: "Robert Reyna, operator",
    ruledOn: "2026-09-22",
    acknowledgedThrough: "2026-12-01",
    because:
      "He will not let the cutover delay opening. It happens in the first months of trading. " +
      "It is not a launch blocker and the firm can trade without it.",
    costsWhileParked:
      "Production fsaryeciduszuahgjbly is shared with unrelated applications. Read from outside " +
      "this repository on 2026-09-22: 171 public tables, and another application migrated it that " +
      "day. Five wattsmith audit accounts, sign-in capable and carrying no eng_profiles row, sit " +
      "in the same auth.users this firm's portal authenticates against. The eng_ prefix separates " +
      "TABLES and does not separate the table that decides who can sign in. Nothing in this " +
      "repository can see any of it; three checks that would give some visibility are in " +
      "BACKLOG.md and none is built.",
  },
];

/**
 * The parks that have run out, as of the firm's calendar.
 *
 * A FUNCTION RATHER THAN A CONSTANT, because a constant would be evaluated once
 * at module load and a park expires by the clock moving rather than by anybody
 * editing anything. CLAUDE.md section 6 records what a module level constant
 * costs when the thing it reads has changed underneath it.
 *
 * Takes the day so a check can ask the question of a date rather than of today,
 * which is the only way to exercise the expired branch without waiting for it.
 */
export function expiredParks(today: string = todayInFirmCalendar()): ParkedWork[] {
  return parkedWork.filter((p) => p.acknowledgedThrough < today);
}
