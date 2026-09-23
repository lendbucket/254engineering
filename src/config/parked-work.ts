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
import { stripeAccount } from "@/config/launch-readiness";

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
  /**
   * RETIRED BY AN EVENT, WITH THE DATE AS A BACKSTOP. Operator ruling,
   * 2026-09-22: "an event that never happens must not make an exemption".
   *
   * Some parks end when something HAPPENS rather than when a date arrives. The
   * date alone would be wrong for those: it would go red on a day when nothing
   * is owed, or worse, stay green because somebody pushed the date out while
   * the event never came. The event alone would be worse still, because an
   * event that never occurs is an exemption with no expiry, which is the exact
   * shape the acknowledgement rule exists to refuse.
   *
   * So it is both, and whichever comes first wins. `retiredWhen` says in words
   * what would end it; `isRetired` is the predicate a check can actually call,
   * reading the same repository fact a person would look at.
   *
   * A FUNCTION RATHER THAN A FLAG, for the reason `expiredParks` is one: a flag
   * has to be set by somebody noticing, and the whole point is that nobody has
   * to notice.
   */
  retiredWhen?: string;
  isRetired?: () => boolean;
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
  {
    id: "stripe-account-status-attested",
    what:
      "The Stripe Account status and Verified tabs have never been captured. Their state rests on " +
      "the operator's attestation rather than on evidence.",
    reasoningIn: "src/config/stripe-console.ts",
    ruledBy: "Robert Reyna, operator",
    ruledOn: "2026-09-22",
    acknowledgedThrough: "2026-10-31",
    because:
      "He read the Account status tab and reports it good, and ruled that no screenshot of it goes " +
      "into this repository. An attestation is weaker than a capture and is recorded as one rather " +
      "than dressed up as a read: the two cropped captures on file show the business name and the " +
      "account id, and neither shows account status.",
    costsWhileParked:
      "A verification requirement or a restriction on that account would appear nowhere in this " +
      "repository, so the firm would learn of it from a failed payout rather than from a file. The " +
      "absence of a notice on the Business details page is not the absence of a requirement on the " +
      "account, and only those two tabs answer the second question.",
    /*
     * THE EVENT IS THE ONE THAT WOULD ACTUALLY PROVE IT. A charge that settles
     * and a refund that completes exercise the account's real standing, which
     * is the thing a status tab only describes. If both succeed, the
     * attestation has been overtaken by evidence and the park has ended.
     *
     * It reads `stripeAccount.proof`, which is where the gate already requires
     * that charge and refund to be recorded, so this cannot drift from the
     * launch condition: there is one place, and both read it.
     */
    retiredWhen:
      "The first live charge on this firm's account and its full refund are recorded in " +
      "stripeAccount.proof in src/config/launch-readiness.ts.",
    isRetired: () => stripeAccount.proof !== null,
  },
  {
    id: "protocol-retired-insert-requires-items",
    what:
      "A retired protocol with no items cannot be inserted. eng_protocol_in_force_holds_items, the " +
      "deferred constraint trigger added by 0052, treats 'retired' as in force and demands items on " +
      "INSERT as well as UPDATE.",
    reasoningIn: "scripts/proofs/a-signed-protocol-is-not-a-draft.mjs",
    ruledBy: "Robert Reyna, operator",
    ruledOn: "2026-09-23",
    acknowledgedThrough: "2026-09-30",
    because:
      "It is a defect in the schema rather than in the proof, and the fix is a migration. A migration " +
      "is applied in a sitting with the operator, together with the register entry, because both touch " +
      "production. Leaving the check red would hold a merge on work nobody can do unattended; deleting " +
      "it would lose the finding. The guard's own exception says the row 'is in force' about a status " +
      "that means the opposite of in force.",
    costsWhileParked:
      "Nothing reachable today. Nothing in the product inserts or moves a protocol to retired, and the " +
      "lifecycle reaches it by UPDATE from published, which already holds items. It would bite on " +
      "recording a historical protocol retired before this platform existed. The real cost is that a " +
      "guarantee about what may be recorded is wrong in the direction of refusing something valid, and " +
      "it went unnoticed for six migrations because the proof that asserts it was never run.",
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
  return parkedWork.filter((p) => !isParkRetired(p) && p.acknowledgedThrough < today);
}

/**
 * Has this park been ended by the thing it was waiting for?
 *
 * A park with no `isRetired` can only end by its date, which is the ordinary
 * case. Where a predicate exists it is asked FIRST, so an event that has
 * happened retires the park whatever the calendar says.
 */
export function isParkRetired(p: ParkedWork): boolean {
  return p.isRetired ? p.isRetired() : false;
}

/** The parks still live: not retired by their event and not past their date. */
export function livingParks(today: string = todayInFirmCalendar()): ParkedWork[] {
  return parkedWork.filter((p) => !isParkRetired(p) && p.acknowledgedThrough >= today);
}

/** The parks their event has ended, whatever the date says. */
export function retiredParks(): ParkedWork[] {
  return parkedWork.filter((p) => isParkRetired(p));
}
