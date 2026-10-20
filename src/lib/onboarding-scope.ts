import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";

/**
 * WHO MAY ONBOARD WHOM. Operator ruling, 2026-10-20.
 *
 * The operations manager reviews a technician's credentials and activates
 * them. profiles.create, which the onboarding screens used to ask for, invites
 * a person at ANY role, administrator included, so it is not what that role
 * holds. It holds technicians.onboard, which opens the same steps for a field
 * technician and for nobody else.
 *
 * So every onboarding guard asks two things: the wide grant, which an
 * administrator holds and which reaches any role, or the narrow one together
 * with the role of the person being onboarded being field_tech. A role that
 * cannot be read is not a field technician: the unknown answer is the shut one.
 *
 * Pay is not in any of these screens, and nothing here reads or writes a rate.
 */

export const ONBOARDABLE_BY_NARROW_GRANT = "field_tech";

export function mayOnboardRole(
  actor: Actor | null,
  role: string | null,
  wide: "profiles.create" | "profiles.update",
): boolean {
  if (can(actor, wide)) return true;
  return can(actor, "technicians.onboard") && role === ONBOARDABLE_BY_NARROW_GRANT;
}

/** Whether this actor may open onboarding at all, before knowing whose. */
export function mayOpenOnboarding(actor: Actor | null, wide: "profiles.create" | "profiles.update"): boolean {
  return can(actor, wide) || can(actor, "technicians.onboard");
}

export async function onboardingRole(onboardingId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("eng_onboardings").select("role").eq("id", onboardingId).maybeSingle();
  if (error || !data) return null;
  return (data.role as string | null) ?? null;
}

export async function profileRole(profileId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("eng_profiles").select("role").eq("id", profileId).maybeSingle();
  if (error || !data) return null;
  return (data.role as string | null) ?? null;
}
