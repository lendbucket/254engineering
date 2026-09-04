import type { ReactNode } from "react";
import { isPrelaunch } from "@/lib/launch";
import { SystemAlert } from "./Primitives";

/**
 * The restricted mode banner.
 *
 * WHY IT READS THE GATE ITSELF RATHER THAN TAKING A PROP
 * -------------------------------------------------------
 * Because a prop can be forgotten, and the screen that forgets it is a screen
 * telling somebody they may seal a document when they may not. Reading
 * isPrelaunch() here means every surface that renders this component is correct
 * by construction, and a surface that does not render it is visibly missing a
 * component rather than silently passing the wrong boolean.
 *
 * It returns null when the gate has lifted, so a caller renders it
 * unconditionally and there is nothing to remember to remove on launch day.
 *
 * WHY IT IS A STATE AND NOT AN ERROR
 * ----------------------------------
 * This is the operator's own platform in the condition the operator knows it is
 * in. It is not a fault, nothing has gone wrong, and styling it as a failure
 * would teach everybody to ignore the one colour this system reserves for
 * things that need attention. It is the gold pending treatment, which is
 * exactly what gold is for.
 *
 * THE COPY IS THE DESIGN'S, BECAUSE THE DESIGN'S IS CORRECT
 * ---------------------------------------------------------
 * Condition first, consequence second, and both are true: the registration IS
 * pending, and sealing and order intake ARE disabled by isPrelaunch. This is
 * the one product claim in the prototype that needed no correction.
 */
/**
 * THE SHARED SENTENCE IS FIXED. A SCREEN MAY ADD, NEVER RESTATE.
 *
 * Three screens carried three different wordings of this one fact before the
 * operator ruled on 2026-09-04: the dashboard, the files list and the review
 * queue each described the gate in its own words, and one statement of the same
 * fact in three forms is how three forms drift.
 *
 * The review queue's version carried something the others did not, and it is
 * worth keeping: declining to seal stays available while sealing is blocked,
 * deliberately, because a gate that stopped an engineer saying no while leaving
 * yes open would be the wrong way round. So a screen with something ADDITIONAL
 * and specific passes it as `also`, and the shared sentence above it is
 * identical everywhere.
 */
export function RestrictedMode({ also }: { also?: ReactNode } = {}) {
  if (!isPrelaunch()) return null;

  return (
    <SystemAlert condition="Restricted mode.">
      Firm registration is pending with TBPELS. Sealing and order intake are disabled until an
      engineer of record is in responsible charge.
      {also ? <span className="mt-1.5 block">{also}</span> : null}
    </SystemAlert>
  );
}
