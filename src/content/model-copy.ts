import { isOpen, isPrelaunch, peInResponsibleCharge, sealingIsAvailable } from "@/lib/launch";

/**
 * Every sentence on this site that describes a licensed engineer doing
 * something, in both of its forms.
 *
 * WHY THESE ARE COLLECTED IN ONE FILE
 * -----------------------------------
 * They were spread across the homepage, the about page, the services hub, the
 * capability statement, and both llms files, and every one of them was written
 * in the present tense: work "is reviewed and sealed by a licensed Texas
 * Professional Engineer in responsible charge". No such engineer has been hired.
 * Nine service pages additionally promised that sealing "within a few business
 * days".
 *
 * Those are claims about a person who does not yet exist in this firm, which is
 * the exact failure Part 1 item 2 of the playbook names. They were not caught by
 * the existing gate because the gate only knew about firm registration, and they
 * were not caught by the regulatory phrase check because it looked for "our
 * engineers" and these sentences never say "our".
 *
 * Collecting them here does two things. It makes the set countable, so an audit
 * can assert that the prelaunch form is what renders. And it makes the flip a
 * single reviewable file when the engineer of record is real, rather than a
 * search across the repo for sentences somebody has to recognize as regulated.
 *
 * THE PRELAUNCH FORM IS NOT A HEDGE
 * ---------------------------------
 * It is the future tense plus the reason. A reader is told what the model is and
 * told plainly that it is not running yet, which is more useful to a procurement
 * officer than a vague present tense that leaves them to find out later.
 */

/** How the firm's model is described in one sentence. */
export function modelSentence(): string {
  return peInResponsibleCharge()
    ? "Field work to a written protocol, reviewed and sealed by a licensed Texas Professional Engineer in responsible charge."
    : "The model pairs field work to a written protocol with engineering review by a licensed Texas Professional Engineer in responsible charge.";
}

/** The responsible charge paragraph, used on the homepage and the about page. */
export function responsibleChargeCopy(): string {
  return sealingIsAvailable()
    ? "Every opinion, letter, certification, and drawing is reviewed and sealed by a Texas licensed Professional Engineer who takes responsible charge of it. That is a legal obligation attached to a person, and it is not delegable to a process or to a company."
    : "Every opinion, letter, certification, and drawing will be reviewed and sealed by a Texas licensed Professional Engineer who takes responsible charge of it. That is a legal obligation attached to a person, and it is not delegable to a process or to a company. The engineer of record is in place. Each service line opens when he has approved its written protocol, and none is sealing work yet.";
}

/** The central review paragraph, which used to imply engineers already on staff. */
export function centralReviewCopy(): string {
  /*
   * ONE ENGINEER, SO THE PRESENT TENSE IS SINGULAR. Found 2026-09-17 by
   * enumerating this function's dependants before the circularity in
   * `peInResponsibleCharge()` was removed, which is what the operator required.
   *
   * The old present branch said "the same engineers see the same protocols".
   * It had never once rendered, because the function it reads always answered
   * false while the gate was shut. The moment the fact answered honestly it
   * would have claimed a review bench the firm does not have.
   */
  return peInResponsibleCharge()
    ? "Reviewing centrally rather than regionally keeps the standard identical in Dalhart and in Harlingen. One review desk sees the same protocols applied across the whole state, which means a drift in one region is visible rather than invisible."
    : "Reviewing centrally rather than regionally is what will keep the standard identical in Dalhart and in Harlingen. One review desk seeing the same protocols applied across the whole state is what makes a drift in one region visible rather than invisible.";
}

/** The specialists paragraph. Used on the homepage and the about page. */
export function specialistsCopy(): string {
  /*
   * THE PRESENT BRANCH WOULD HAVE CLAIMED A CREDENTIAL THE REGISTER SAYS THE
   * FIRM DOES NOT HOLD. Found 2026-09-17, the same night the SAM claim came off
   * for being exactly that, by enumerating the dependants of
   * `peInResponsibleCharge()` before its circularity was removed.
   *
   * It said the firm "holds specialists ... including engineers appointed by
   * the Texas Department of Insurance for windstorm inspections". No engineer
   * here holds a TDI appointment; `verifiedCredentials` records it as not held
   * and the windstorm pages disclose the absence. The new credential check
   * would not have caught this one, because it does not name TDI in these
   * words, which is worth knowing about that check.
   *
   * BOTH BRANCHES NOW DESCRIBE THE MODEL RATHER THAN THE ROSTER. The point of
   * the sentence was that central review makes specialist cover possible at
   * all, which is true today and does not require naming a credential nobody
   * has.
   */
  return peInResponsibleCharge()
    ? "It also lets the firm hold specialist cover that no single metro could support on its own, including the coastal windstorm work where a Texas Department of Insurance appointment is what decides who may inspect."
    : "It is also what will let the firm hold specialist cover that no single metro could support on its own, including the coastal windstorm work where a Texas Department of Insurance appointment is what decides who may inspect.";
}

/** How a deliverable is described as reaching its sealed state. */
export function sealedDeliverableSentence(): string {
  return sealingIsAvailable()
    ? "Every deliverable is reviewed and sealed by a Texas licensed Professional Engineer in responsible charge."
    : "Every deliverable is intended to be reviewed and sealed by a Texas licensed Professional Engineer in responsible charge. The engineer of record is in place, and a line opens once he has approved its written protocol.";
}

/** The engineering review step in the four step process description. */
export function reviewStepCopy(): string {
  return sealingIsAvailable()
    ? "A licensed Texas Professional Engineer reviews the record, forms the opinion, and takes responsible charge of it. Field work gathers evidence. It does not reach conclusions."
    : "A licensed Texas Professional Engineer will review the record, form the opinion, and take responsible charge of it. Field work gathers evidence. It does not reach conclusions.";
}

/**
 * Turnaround.
 *
 * The nine per-service turnaround statements all promised sealing inside a few
 * business days. A schedule for sealed work is a promise about an engineer's
 * capacity, and there is no engineer, so under the gate the promise is replaced
 * by one sentence saying exactly that. The per-service copy is untouched in the
 * data file and returns the moment the gate lifts.
 */
export function turnaroundCopy(serviceTurnaround: string): string | null {
  /*
   * THE SHARPEST OF THE THREE, AND THE REASON THE OPERATOR MADE ME ENUMERATE
   * THE DEPENDANTS BEFORE TOUCHING THE FACT THEY READ.
   *
   * Until 2026-09-17 this returned a refusal to quote any turnaround, because
   * `peInResponsibleCharge()` always answered false while the gate was shut.
   * The RIGHT OUTCOME was being reached for the WRONG REASON. Remove the
   * circularity and this function starts publishing a turnaround figure for
   * every service line, from strings that predate any ruling about them.
   *
   * The operator owes the turnaround per line and has said so. Until he gives
   * it, this renders NOTHING rather than a guess, and null is deliberate rather
   * than an empty string: a caller has to decide what to do with an absent
   * turnaround, and an empty string would let one render a heading over nothing.
   *
   * `serviceTurnaround` is still taken rather than dropped, so the day the
   * figures are ruled this becomes one line instead of a signature change
   * across four callers.
   */
  /*
   * RULED 2026-09-19, AND STILL RENDERING NOTHING UNTIL THE GATE OPENS.
   *
   * The operator gave the figure and then held it himself: "The gate is
   * registered and trading today, not open, and a published turnaround is a
   * promise about fulfilment the firm cannot yet make with no technician.
   * Render it when the gate opens." The figures live in
   * src/config/turnaround.ts from today; this is the one place they reach a
   * page, and it is shut until `isOpen()`.
   *
   * `isOpen()` rather than `!isPrelaunch()`, deliberately. Trading is the
   * middle state: the firm may take money before it can promise delivery, and
   * a delivery promise is exactly the claim that needs the third gate rather
   * than the second.
   */
  if (!isOpen()) {
    void serviceTurnaround;
    return null;
  }

  /*
   * THE PER SERVICE STRING IS STILL NOT USED, and that is not an oversight
   * either. Those strings predate any ruling about turnaround and each one
   * promises sealing "within a few business days", which is the shape of
   * promise the operator replaced with a measured figure. Returning them the
   * moment the gate lifted would publish nine unruled promises in one deploy.
   *
   * Only the roof certification has a ruled figure. Every other line renders
   * nothing until it has one, which is the same refusal this function has been
   * making all along, now narrowed to the lines that still lack a ruling rather
   * than applied to all of them.
   */
  void serviceTurnaround;
  return null;
}

/**
 * The published end to end figure for a service line, or null.
 *
 * NULL FOR EIGHT OF THE NINE LINES, AND THAT IS THE HONEST ANSWER. One line has
 * been ruled. A caller getting null must render nothing rather than a heading
 * over an empty space, which is why this returns null rather than a hopeful
 * empty string.
 */
export function publishedTurnaround(serviceSlug: string): string | null {
  if (!isOpen()) return null;
  if (serviceSlug !== "roof-inspections") return null;
  return `Ten business days from order to sealed letter in your hands.`;
}

/** True when any gate is still down, for copy that needs to say so once. */
export function anyGateDown(): boolean {
  return isPrelaunch() || !peInResponsibleCharge();
}
