import { isOwnerAdmin, isOwnerFieldTech, type SignInOverrideKey } from "./owner-override";

/**
 * ===========================================================================
 * WHAT A SIGN IN ASKS FOR, AFTER THE PASSWORD. One decision, pure, so a proof
 * can ask it every question the session route does.
 * ===========================================================================
 *
 * Moved out of src/app/api/portal/session/route.ts unchanged except for the
 * owner overrides, Robert's answer 3 of 2026-10-26, 09:49 Central (0093), and
 * his ruling of 2026-10-28, 08:54 Central (0103):
 *
 *   - Somebody ENROLLED is challenged for the factor whatever their role says,
 *     the owner included. The order is the route's own, and load bearing: a
 *     requirement consulted first would let editing a role switch off somebody
 *     else's factor.
 *   - A role that REQUIRES the factor sends anybody not enrolled to enrolment,
 *     with TWO exceptions, each one id under one role: the owner's
 *     administrator account under the admin role, and the owner's field
 *     technician profile under the field_tech role. Either gets a full
 *     session, and the caller must write an audit row naming the override
 *     BEFORE issuing it.
 *   - OPTIONAL issues a full session and offers enrolment. OFF issues a full
 *     session.
 *
 * WHY AN ID AND NOT A ROLE is in owner-override.ts. The role check is a second
 * lock, not the first: the id is the owner, and requiring the role as well
 * means a row whose role was changed is not exempt under its new one.
 */
export type SignInFactor = {
  factor: "pending" | "full";
  /** Where a pending session must go, and nowhere else. */
  next: string | null;
  /** An optional offer, which never overrides a destination somebody asked for. */
  offer: string | null;
  /** The owner override that let a required factor be skipped, by name, or null. */
  ownerOverride: SignInOverrideKey | null;
};

export function signInFactor(input: {
  profileId: string;
  role: string;
  enrolled: boolean;
  requirement: "required" | "optional" | "off";
}): SignInFactor {
  if (input.enrolled) return { factor: "pending", next: "/portal/mfa", offer: null, ownerOverride: null };
  if (input.requirement === "required") {
    if (input.role === "admin" && isOwnerAdmin(input.profileId)) {
      return { factor: "full", next: null, offer: null, ownerOverride: "sign_in_second_factor" };
    }
    if (input.role === "field_tech" && isOwnerFieldTech(input.profileId)) {
      return { factor: "full", next: null, offer: null, ownerOverride: "sign_in_second_factor_tech" };
    }
    return { factor: "pending", next: "/portal/mfa/enrol", offer: null, ownerOverride: null };
  }
  if (input.requirement === "optional") return { factor: "full", next: null, offer: "/portal/mfa/enrol", ownerOverride: null };
  return { factor: "full", next: null, offer: null, ownerOverride: null };
}
