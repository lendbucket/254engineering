import { isOwnerAdmin } from "./owner-override";

/**
 * ===========================================================================
 * WHAT A SIGN IN ASKS FOR, AFTER THE PASSWORD. One decision, pure, so a proof
 * can ask it every question the session route does.
 * ===========================================================================
 *
 * Moved out of src/app/api/portal/session/route.ts unchanged except for the
 * owner override, Robert's answer 3 of 2026-10-26, 09:49 Central (0093):
 *
 *   - Somebody ENROLLED is challenged for the factor whatever their role says,
 *     the owner included. The order is the route's own, and load bearing: a
 *     requirement consulted first would let editing a role switch off somebody
 *     else's factor.
 *   - A role that REQUIRES the factor sends anybody not enrolled to enrolment,
 *     with ONE exception: the owner's administrator account, by the id in
 *     owner-override.ts and under the admin role, gets a full session, and the
 *     caller must write an audit row naming the override BEFORE issuing it.
 *   - OPTIONAL issues a full session and offers enrolment. OFF issues a full
 *     session.
 *
 * WHY AN ID AND NOT A ROLE is in owner-override.ts. The role check is a second
 * lock, not the first: the id is the owner, and requiring admin as well means a
 * row whose role was changed is not exempt under its new one.
 */
export type SignInFactor = {
  factor: "pending" | "full";
  /** Where a pending session must go, and nowhere else. */
  next: string | null;
  /** An optional offer, which never overrides a destination somebody asked for. */
  offer: string | null;
  /** True when the owner override is what let a required factor be skipped. */
  ownerOverride: boolean;
};

export function signInFactor(input: {
  profileId: string;
  role: string;
  enrolled: boolean;
  requirement: "required" | "optional" | "off";
}): SignInFactor {
  if (input.enrolled) return { factor: "pending", next: "/portal/mfa", offer: null, ownerOverride: false };
  if (input.requirement === "required") {
    if (input.role === "admin" && isOwnerAdmin(input.profileId)) {
      return { factor: "full", next: null, offer: null, ownerOverride: true };
    }
    return { factor: "pending", next: "/portal/mfa/enrol", offer: null, ownerOverride: false };
  }
  if (input.requirement === "optional") return { factor: "full", next: null, offer: "/portal/mfa/enrol", ownerOverride: false };
  return { factor: "full", next: null, offer: null, ownerOverride: false };
}
