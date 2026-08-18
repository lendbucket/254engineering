import { isPrelaunch, peInResponsibleCharge } from "@/lib/launch";

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
  return peInResponsibleCharge()
    ? "Every opinion, letter, certification, and drawing is reviewed and sealed by a Texas licensed Professional Engineer who takes responsible charge of it. That is a legal obligation attached to a person, and it is not delegable to a process or to a company."
    : "Every opinion, letter, certification, and drawing will be reviewed and sealed by a Texas licensed Professional Engineer who takes responsible charge of it. That is a legal obligation attached to a person, and it is not delegable to a process or to a company. No engineer of record is in place yet, so nothing is being sealed today.";
}

/** The central review paragraph, which used to imply engineers already on staff. */
export function centralReviewCopy(): string {
  return peInResponsibleCharge()
    ? "Reviewing centrally rather than regionally keeps the standard identical in Dalhart and in Harlingen. The same engineers see the same protocols applied across the whole state, which means a drift in one region is visible rather than invisible."
    : "Reviewing centrally rather than regionally is what will keep the standard identical in Dalhart and in Harlingen. One review desk seeing the same protocols applied across the whole state is what makes a drift in one region visible rather than invisible.";
}

/** The specialists paragraph. Used on the homepage and the about page. */
export function specialistsCopy(): string {
  return peInResponsibleCharge()
    ? "It also lets the firm hold specialists that no single metro could support on its own, including engineers appointed by the Texas Department of Insurance for windstorm inspections, whose appointment matters on the coast and nowhere else."
    : "It is also what will let the firm hold specialists that no single metro could support on its own, including engineers appointed by the Texas Department of Insurance for windstorm inspections, whose appointment matters on the coast and nowhere else.";
}

/** How a deliverable is described as reaching its sealed state. */
export function sealedDeliverableSentence(): string {
  return peInResponsibleCharge()
    ? "Every deliverable is reviewed and sealed by a Texas licensed Professional Engineer in responsible charge."
    : "Every deliverable is intended to be reviewed and sealed by a Texas licensed Professional Engineer in responsible charge. No engineer of record is in place yet, and no work is being sealed.";
}

/** The engineering review step in the four step process description. */
export function reviewStepCopy(): string {
  return peInResponsibleCharge()
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
export function turnaroundCopy(serviceTurnaround: string): string {
  return peInResponsibleCharge()
    ? serviceTurnaround
    : "No turnaround is being quoted. Turnaround for sealed work depends on the engineer of record who signs it, and this firm does not yet have one. A schedule stated before that would be a promise nobody is in a position to keep.";
}

/** True when any gate is still down, for copy that needs to say so once. */
export function anyGateDown(): boolean {
  return isPrelaunch() || !peInResponsibleCharge();
}
