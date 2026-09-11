import { can, holdsLicence, isLicensed, type Actor } from "./ops-authz";
import { NAV } from "@/components/portal/nav";

/**
 * Can this actor actually OPEN this portal destination?
 *
 * WHY THIS EXISTS
 * ---------------
 * Found overnight, 2026-09-10, by walking every screen as each of the seven
 * roles and clicking what the screen offered:
 *
 *   admin      /portal/review  HTTP 404  "That page is not here"
 *   read_only  /portal/review  HTTP 404  "That page is not here"
 *   read_only  /portal/tasks   HTTP 404  "That page is not here"
 *
 * Every one of those was reached from a dashboard tile the role was shown. An
 * administrator's dashboard renders "0, Waiting on an engineer" and links it to
 * the review queue, which is gated on holdsLicence and which an administrator
 * therefore cannot open. The count is right and worth showing; the link is a
 * dead end that reads as a broken product rather than as a locked door.
 *
 * src/components/portal/nav.ts already states the rule for the SIDEBAR, in
 * these words: a hand written nav per role is a second authorization model, and
 * the first time the two drift a link appears for somebody who is then denied
 * when they click it. The sidebar obeys it. The dashboard was never brought
 * inside it, and the dashboard is the screen every role lands on.
 *
 * WHY IT DERIVES FROM NAV AND DOES NOT RESTATE THE MATRIX
 * -------------------------------------------------------
 * NAV already declares, for all 28 portal destinations, which action gates it.
 * A second table here would be the third account of one rule, which is the
 * defect this file is fixing wearing different clothes. So the map is derived,
 * and a destination NAV does not name is treated as reachable: this function's
 * job is to catch a link to a gated screen, not to become a new gate of its own.
 *
 * AND IT ASKS THE SAME QUESTION THE SCREEN ASKS, INCLUDING THE LICENSED ONE
 * -------------------------------------------------------------------------
 * `review.queue` is a LICENSED action, and the difference is the whole of the
 * finding. `can()` answers true for an administrator holding the grant, and
 * `/portal/review` calls `holdsLicence`, which does not. Asking `can()` alone
 * here would reproduce the bug in the fix.
 */
const ACTION_FOR_HREF = new Map(NAV.map((item) => [item.href, item.action] as const));

export function canOpen(actor: Actor | null, href: string): boolean {
  /* Query strings and fragments are the same destination. */
  const path = href.split(/[?#]/)[0];
  const action = ACTION_FOR_HREF.get(path);
  /* Not a declared destination, so this function has nothing to say about it. */
  if (!action) return true;
  return isLicensed(action) ? holdsLicence(actor, action) : can(actor, action);
}

/**
 * The href if the actor can open it, and undefined if not.
 *
 * Undefined rather than an empty string, so a caller that forgets to handle it
 * renders a broken link the type checker complains about rather than an anchor
 * pointing at the current page, which is the failure that looks like it works.
 */
export function reachableHref(actor: Actor | null, href: string): string | undefined {
  return canOpen(actor, href) ? href : undefined;
}
