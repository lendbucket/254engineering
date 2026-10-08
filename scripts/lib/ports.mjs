/**
 * EVERY PORT THIS PROJECT BINDS, IN ONE PLACE.
 *
 * Operator ruling, 2026-10-02: move this project's build, dev server and audit
 * ports to a range no other project on this machine uses. Check what is in use
 * first and pick a clear range.
 *
 * ==========================================================================
 * WHAT HAPPENED, AND IT IS THE REASON THIS FILE EXISTS RATHER THAN A FIND AND
 * REPLACE.
 * ==========================================================================
 *
 * A build refused because a stale `next start` held a port. The build guard did
 * the right thing and printed `taskkill /PID 30284 /T /F`, and the process was
 * `C:\Users\salon\projects\wattsmith\...\next start -p 3188`. **It was another
 * project's live server.** Following the guard's own suggestion would have
 * destroyed a run of the operator's to unblock one of mine, which CLAUDE.md
 * names as the least defensible trade available and the one that looks most
 * reasonable at the end of a long sitting.
 *
 * THE MACHINE LOCK DID NOT HELP, AND THAT IS THE STRUCTURAL POINT. The lock was
 * FREE. wattsmith was holding a port without holding the lock, so cooperation
 * and detection disagreed: the lock says nobody is running a suite, the guard
 * says somebody is holding a port, and both are correct. A lock is agreement
 * between willing parties and cannot cover a server somebody left up.
 *
 * AND THE COLLISION WAS WIDER THAN THE ONE I HIT. Surveying both projects'
 * declared ports found wattsmith naming 3123 through 3250 heavily, including
 * **3240, which was this project's sweep port**. That one had not fired yet. It
 * would have, on the next sweep run that happened to overlap.
 *
 * ==========================================================================
 * WHY 4300.
 * ==========================================================================
 *
 * Measured rather than guessed, on 2026-10-02:
 *
 *   listening on this machine, 3000-4999:  3100, 3188 and 3189, all wattsmith
 *                                          or unplaced
 *   wattsmith DECLARES:                    most of 3000-3600, 3788-3789, and a
 *                                          scatter through 4000-4999 including
 *                                          4000, 4111, 4200, 4222, 4236,
 *                                          4241-4246, 4299, 4410-4417, 4499
 *   this project used:                     3223-3232 and 3240
 *
 * `4300-4319` appears in none of it: nothing listening, nothing declared by
 * either project, and clear of this project's own old range so a stale server
 * from before this change cannot be mistaken for a current one.
 *
 * ==========================================================================
 * THE RULE THIS FILE CARRIES.
 * ==========================================================================
 *
 * No script writes a port literal. Thirteen of them did, and nineteen more
 * hardcoded `http://localhost:3225` as a BASE_URL default, which is thirty two
 * homes for one fact and is exactly why nobody could answer "which ports does
 * this project use" without grepping. `scripts/proofs/every-port-comes-from-one-declaration.mjs`
 * asserts it, so the next port is added here or the board goes red.
 *
 * MOVING THE WHOLE RANGE IS NOW ONE EDIT, which is the other half of the point.
 * The next time another project spreads into 4300, `PORT_BASE` moves and every
 * script follows. Before this, it was thirty two edits and a near certainty that
 * one would be missed.
 */

/**
 * The bottom of the block. Override with PORT_BASE to move the whole range at
 * once, which is what a future collision needs and what nothing supported
 * before.
 */
export const PORT_BASE = Number(process.env.PORT_BASE ?? 4300);

/**
 * One name per thing that binds, with its offset fixed.
 *
 * OFFSETS RATHER THAN LITERALS so that the block stays contiguous and a reader
 * can see at a glance that nothing overlaps. The names are what the scripts
 * already called them, so a reader moving between the two is not translating.
 */
export const PORTS = {
  /** The shared server phase one of the suite reads. Was 3225. */
  audit: PORT_BASE + 0,
  /** mobile-audit's own server. Was 3223. */
  mobile: PORT_BASE + 1,
  /** contrast-audit's own server. Was 3224. */
  contrast: PORT_BASE + 2,
  /** shots.mjs, the capture runner. Was 3226. */
  shots: PORT_BASE + 3,
  /** launch-audit's prelaunch build. Was 3227. */
  launchPrelaunch: PORT_BASE + 4,
  /** launch-audit's live build. Was 3228. */
  launchLive: PORT_BASE + 5,
  /** break-glass-audit, no token configured. Was 3229. */
  breakGlassUnset: PORT_BASE + 6,
  /** break-glass-audit, malformed token. Was 3230. */
  breakGlassMalformed: PORT_BASE + 7,
  /** break-glass-audit, token set. Was 3231. */
  breakGlassSet: PORT_BASE + 8,
  /** doors-audit. Was 3232. */
  doors: PORT_BASE + 9,
  /** The break it sweep. Was 3240, which wattsmith also declares. */
  sweep: PORT_BASE + 10,
  /** The preview mispointing exercise. Was 3227, colliding with launch-audit. */
  previewMispointing: PORT_BASE + 11,
  /** The stripe refund webhook exercise. Was 3228, colliding with launch-audit. */
  stripeRefundWebhook: PORT_BASE + 12,
  /*
   * ========================================================================
   * AND THE OLD SCHEME COLLIDED WITH ITSELF, which the first pass over this
   * file did not know.
   * ========================================================================
   *
   * The six below were found by a SECOND enumeration. The first one derived its
   * list from a single grep for `process.env.*PORT* || NNNN` and reported
   * thirteen bindings as the extent. These six bind with
   * `startNextServer({ port: NNNN })` or a bare constant and were invisible to
   * that pattern, which is the "a count from one search is a claim, it reads as
   * a survey" rule arriving in the middle of fixing a different instance of it.
   *
   * What the second enumeration showed is worse than a missed file. Four of
   * these reused a port another script in this same project already had:
   *
   *   design-shots       3230  =  break-glass-audit's malformed-token port
   *   probe-capture      3232  =  doors-audit's port
   *   overnight-roles    3228  =  launch-audit's LIVE port
   *   exploratory-portal 3227  =  launch-audit's PRELAUNCH port, and the
   *                               preview-mispointing exercise's port
   *
   * Nothing had broken because no two of those run at once today. The next
   * person to run a capture beside an audit would have met it, and the symptom
   * would have been a server answering on a port the other script believed it
   * owned: not a refusal, a WRONG ANSWER. That is the harder failure to read,
   * and it is the real argument for one declaration over thirty two literals.
   */
  /** design-shots.mjs. Was 3230, which break-glass-audit also used. */
  designShots: PORT_BASE + 13,
  /** order-flow-shots.mjs. Was 3233. */
  orderFlowShots: PORT_BASE + 14,
  /** order-flow-walk-shots.mjs. Was 3234. */
  orderFlowWalkShots: PORT_BASE + 15,
  /** probe-capture.mjs. Was 3232, which doors-audit also used. */
  probeCapture: PORT_BASE + 16,
  /** overnight-roles.mjs. Was 3228, which launch-audit's live build also used. */
  overnightRoles: PORT_BASE + 17,
  /** exploratory-portal-audit.mjs. Was 3227, used by two other scripts. */
  exploratory: PORT_BASE + 18,
  /** wordmark-measure.mjs. Was 3231, which break-glass-audit also used. */
  wordmarkMeasure: PORT_BASE + 19,
  /**
   * compliance-audit's rendered public pages, 2026-10-08. It runs in phase two,
   * where the board passes no BASE_URL, so the check that the engineer's licence
   * number is on no public page starts the production build here itself.
   */
  compliancePublic: PORT_BASE + 20,
};

/**
 * THE ONE PORT package.json HAS TO SPELL OUT, AND WHY THAT IS NOT A SECOND HOME.
 *
 * `npm run dev` and `npm run start` pass `next dev -p N` on a command line. A
 * package.json script cannot import a module, so the number is written there as
 * a literal and nowhere else can be.
 *
 * That makes it the one genuine exception, so it is NAMED rather than left to be
 * discovered: `scripts/proofs/every-port-comes-from-one-declaration.mjs` asserts
 * that package.json's `-p` value equals `PORTS.audit`, which turns the
 * duplication into a comparison. Two places that must agree and a check that
 * they do is a different thing from two places that might not.
 */
export const PACKAGE_JSON_DEV_PORT = PORTS.audit;

/**
 * The default BASE_URL for an audit that expects a server rather than starting
 * one.
 *
 * Nineteen scripts hardcoded this string. Every one of them was correct and
 * every one of them would have had to be edited by hand to move a port, which
 * is the definition of a fact with too many homes.
 */
export const AUDIT_BASE_URL = `http://localhost:${PORTS.audit}`;

/** Every port this project may bind, for a guard that needs the whole set. */
export const ALL_PORTS = Object.values(PORTS);

/**
 * The top of the block, exclusive, for a check that wants to know whether a
 * literal somebody wrote falls inside our range.
 */
export const PORT_RANGE = { from: PORT_BASE, to: PORT_BASE + 21 };
