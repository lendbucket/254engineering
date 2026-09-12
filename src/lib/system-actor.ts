import "server-only";
import type { Action, LicensedAction } from "./ops-authz";

/**
 * THE ONE PRINCIPAL THAT IS NOT A PERSON.
 *
 * Operator ruling, 2026-09-12, Phase 12 Section 6. A single system principal
 * that can raise a task and write an audit trail row and nothing else: no
 * grants, no session, no sign-in, and unrepresentable as a human actor in the
 * authorisation types the way a licensed action is unrepresentable in a role.
 *
 * WHY IT EXISTS AT ALL, AND WHY IT IS THE ONLY NEW DOOR IN THIS SECTION
 * ---------------------------------------------------------------------
 * Every write in this platform is attributed to a person. That is the reason
 * the audit trail is worth anything, and it is also why nothing scheduled could
 * ever ask anybody to look at what it produced: `createTask` requires an
 * `Actor`, and a cron job has none.
 *
 * The access review made that concrete. The report generates, states its own
 * findings, and says nobody has attested it, and there was no way for the
 * platform to raise the attestation as work. The choice was an anonymous write
 * or no write, and an anonymous write into an append only trail is the worse
 * one: an auditor reading it could not tell platform-raised work from a
 * person's.
 *
 * So this exists to make scheduled work ATTRIBUTABLE rather than anonymous.
 * That is the whole of its job.
 *
 * WHY IT IS NOT A ROW IN eng_profiles
 * ------------------------------------
 * A profile can be signed in to. It has a status, a role, a password reset
 * path, and a place in every list of people. A system principal with a profile
 * is one password reset away from being a person, and it would appear in the
 * access review as an account somebody has to justify every quarter.
 *
 * It is a CONSTANT instead. There is nothing to sign in to, nothing to reset,
 * and nothing to suspend, because there is no row.
 *
 * WHY THE TYPE IS SEPARATE RATHER THAN A FLAG ON Actor
 * -----------------------------------------------------
 * A boolean on `Actor` would make every `can()` call site responsible for
 * remembering it, which is a runtime test somebody forgets. This follows
 * `LicensedAction`'s construction exactly: the system principal is a DIFFERENT
 * TYPE, so a function that takes an `Actor` cannot be handed it, and the
 * compiler says so rather than a reviewer.
 *
 * `scripts/proofs/the-system-actor-is-not-a-person.ts` asserts that in both
 * directions and fails to COMPILE if it stops being true.
 */

/**
 * The two things it may do. Not an `Action[]`: these are not grants and must
 * never be representable as grants, because a grant can be added to a role on
 * the permission screen and this must never appear there.
 */
export type SystemCapability = "tasks.raise" | "audit.write";

export const SYSTEM_CAPABILITIES: SystemCapability[] = ["tasks.raise", "audit.write"];

/**
 * The system principal.
 *
 * `kind` is the discriminant that makes it unassignable to `Actor`, which has
 * no such field and requires `role`, `status` and `grants` that this
 * deliberately does not have.
 */
export type SystemActor = {
  readonly kind: "system";
  readonly id: string;
  readonly label: string;
  readonly capabilities: readonly SystemCapability[];
};

/**
 * THE ID IS A FIXED UUID AND IT IS NOT IN eng_profiles.
 *
 * `eng_audit_events.actor_id` is a plain uuid column with no foreign key, which
 * is what makes this possible without a profile row. That was not arranged for
 * this: 0002 dropped the actor foreign keys on the append only tables so that
 * history outlives the account of whoever acted.
 *
 * All zeroes with a readable tail, so somebody meeting it in a query sees
 * immediately that it is not a generated identifier.
 */
export const SYSTEM_ACTOR: SystemActor = {
  kind: "system",
  id: "00000000-0000-4000-8000-000000005957",
  label: "The platform",
  capabilities: SYSTEM_CAPABILITIES,
};

/**
 * What an audit row records as the actor when the platform acted.
 *
 * The email is deliberately at an unroutable domain and says what it is. An
 * auditor scanning the trail can separate platform-raised work from a person's
 * by this string alone, without knowing the uuid.
 */
export const SYSTEM_ACTOR_EMAIL = "the-platform@system.invalid";
export const SYSTEM_ACTOR_ROLE = "system";

/**
 * Is this the system principal?
 *
 * A type guard rather than a comparison, so a call site narrows and the
 * compiler carries the answer forward instead of the reader remembering it.
 */
export function isSystemActor(actor: unknown): actor is SystemActor {
  return (
    typeof actor === "object" &&
    actor !== null &&
    (actor as { kind?: unknown }).kind === "system" &&
    (actor as { id?: unknown }).id === SYSTEM_ACTOR.id
  );
}

/**
 * May the system principal do this?
 *
 * Takes a `SystemCapability` and nothing wider. An `Action` cannot be passed
 * here, and that is the point: there is no call shape in which the platform
 * asks whether it may refund a payment, because the question does not typecheck.
 */
export function systemMay(capability: SystemCapability): boolean {
  return SYSTEM_CAPABILITIES.includes(capability);
}

/**
 * THE TWO THINGS IT MUST NEVER DO, WRITTEN DOWN SO THE PROOF CAN ASSERT THEM.
 *
 * Neither is enforced by a runtime check, because neither CAN be expressed:
 * `systemMay` takes a SystemCapability and these are Actions. They are listed
 * so the compile time proof has something to name, and so a reader learns the
 * boundary without reverse engineering it from the type.
 */
export const SYSTEM_ACTOR_MUST_NEVER: {
  licensed: readonly LicensedAction[];
  money: readonly Extract<
    Action,
    "payments.charge" | "payments.refund" | "payments.reconcile" | "ledger.approve" | "billing.read"
  >[];
} = {
  /*
   * Every licensed action. A licence belongs to a named Professional Engineer
   * who is answerable for it, and a platform that could seal a document or
   * decide a review would be a platform where the seal has left the engineer's
   * control. That is the standing ruling in CLAUDE.md section 1, and this is
   * the same argument one layer down.
   */
  licensed: ["protocols.author", "protocols.publish", "review.queue", "review.decide", "documents.seal"],
  /*
   * Every action that moves money or approves it moving. Scheduled work that
   * could charge a card is scheduled work that can charge a card at three in
   * the morning with nobody watching, and the refund grammar this platform
   * spent a section getting right assumes a person decided.
   */
  money: ["payments.charge", "payments.refund", "payments.reconcile", "ledger.approve", "billing.read"],
};
