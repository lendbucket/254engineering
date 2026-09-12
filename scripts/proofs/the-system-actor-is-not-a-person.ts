/**
 * THE SYSTEM PRINCIPAL IS NOT A PERSON, AND CANNOT ACT LIKE ONE, PROVED BY THE
 * COMPILER.
 *
 * Phase 12 Section 6, operator ruling 2026-09-12. This file asserts nothing at
 * runtime and is never imported. Its whole job is to fail to compile.
 *
 * Every `@ts-expect-error` below is an assertion: if the line it guards ever
 * starts compiling, TypeScript reports TS2578 for the unused directive and the
 * typecheck fails. So the guarantee cannot rot quietly. The day somebody makes
 * the platform able to seal a document or refund a payment, the build breaks and
 * names the line.
 *
 * It imports the REAL types, for the reason the licensed action proof beside it
 * records: a sketch of them would keep passing while the actual module drifted.
 */
import type { Action, LicensedAction } from "../../src/lib/ops-authz";
import type { SystemActor, SystemCapability } from "../../src/lib/system-actor";
import { SYSTEM_ACTOR, systemMay } from "../../src/lib/system-actor";

/* ------------------------------------------------------------------ the shape */

/** What a human actor is. The real thing, narrowed to what call sites require. */
type HumanActor = { id: string; role: string; status: "invited" | "active" | "suspended"; grants: Action[] };

/** An ordinary person compiles, or nothing below would prove anything. */
export const aPerson: HumanActor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "admin",
  status: "active",
  grants: ["files.list", "tasks.use"],
};

/**
 * THE SYSTEM PRINCIPAL IS NOT ASSIGNABLE TO A HUMAN ACTOR.
 *
 * This is the assertion the whole design rests on. Every function that acts on
 * behalf of a person takes an Actor, so if this compiled, the platform could be
 * handed to any one of them and the ruling would be a comment.
 */
// @ts-expect-error the system principal is not a person and has no role, status or grants
export const systemAsPerson: HumanActor = SYSTEM_ACTOR;

/**
 * AND A PERSON IS NOT THE SYSTEM PRINCIPAL EITHER.
 *
 * The other direction matters just as much: it stops somebody attributing a
 * person's action to the platform, which would hide a real actor behind
 * "The platform" in the audit trail.
 */
// @ts-expect-error a person is not the system principal
export const personAsSystem: SystemActor = aPerson;

/* ----------------------------------------------------- what it may be asked */

/** The two things it may do. These compile. */
export const raising: SystemCapability = "tasks.raise";
export const writing: SystemCapability = "audit.write";

/**
 * IT CANNOT BE ASKED WHETHER IT MAY PERFORM A LICENSED ACTION.
 *
 * Not refused: unaskable. `systemMay` takes a SystemCapability, and a licensed
 * action is not one, so there is no call shape in which the platform enquires
 * about sealing.
 */
// @ts-expect-error sealing is not something the platform may be asked about
systemMay("documents.seal");
// @ts-expect-error nor deciding a review
systemMay("review.decide");
// @ts-expect-error nor authoring a protocol
systemMay("protocols.author");
// @ts-expect-error nor publishing one, which is the act that puts it in front of a technician
systemMay("protocols.publish");
// @ts-expect-error nor reading the review queue, which is a licensed view of pending engineering work
systemMay("review.queue");

/**
 * NOR A MONEY ACTION.
 *
 * Scheduled work that could charge a card is scheduled work that can charge a
 * card at three in the morning with nobody watching.
 */
// @ts-expect-error the platform may not be asked whether it can charge
systemMay("payments.charge");
// @ts-expect-error nor refund
systemMay("payments.refund");
// @ts-expect-error nor approve a ledger entry
systemMay("ledger.approve");
// @ts-expect-error nor reconcile a payment, which decides that money arrived
systemMay("payments.reconcile");
// @ts-expect-error nor read billing, because a principal that cannot be asked about money should not see it either
systemMay("billing.read");

/**
 * NOR ANY ORDINARY ACTION, which is the general form of the two above. The
 * platform's capabilities are a closed set of two and Action is not a subset of
 * it in either direction.
 */
// @ts-expect-error an ordinary grant is not a system capability
systemMay("files.list");
// @ts-expect-error nor is managing roles
systemMay("roles.manage");

/* --------------------------------------------- and its capabilities are not grants */

/**
 * A SYSTEM CAPABILITY CANNOT BE PUT IN A ROLE.
 *
 * The mirror of the licensed action proof. If `tasks.raise` were grantable it
 * would appear as a checkbox on the permission screen, and a person could be
 * given the platform's own capability.
 */
export const roleTryingToRaise: HumanActor = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "admin",
  status: "active",
  // @ts-expect-error tasks.raise is the platform's, not a grant anybody holds
  grants: ["files.list", "tasks.raise"],
};

export const roleTryingToWriteAudit: HumanActor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: "admin",
  status: "active",
  // @ts-expect-error audit.write is the platform's, not a grant anybody holds
  grants: ["audit.write"],
};

/**
 * AND A LICENSED ACTION IS STILL NOT A SYSTEM CAPABILITY, which is the corner
 * where the two constructions meet. Neither set may absorb the other.
 */
// @ts-expect-error a licensed action is not a system capability
export const licensedAsSystem: SystemCapability = "documents.seal" as LicensedAction;
