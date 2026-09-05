import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import {
  ALL_ACTIONS,
  LICENSED_ACTIONS,
  LICENSED_ROLE,
  type Action,
  type Actor,
} from "./ops-authz";
import {
  canDeleteRole,
  canSetGrants,
  canSetUserRole,
  keyProblem,
  type Holder,
  type RoleShape,
} from "./role-rules";

/**
 * Roles, grants, and who holds them.
 *
 * The RULES are in role-rules.ts and are pure. This reads rows, calls them, and
 * writes the answer down.
 *
 * EVERY CHANGE HERE IS AN ACCESS CHANGE
 * -------------------------------------
 * So every one writes an audit row naming the actor, the role, and what moved.
 * A buyer asking "who could see what, and when did that change" is answered by
 * replaying those rows, which is the property recorded in the design document.
 */

export type RoleRow = {
  key: string;
  name: string;
  landing_path: string;
  is_system: boolean;
  description: string | null;
};

export type RoleView = RoleRow & {
  grants: Action[];
  holders: { id: string; display_name: string; email: string; status: string }[];
};

/** Every role, what it grants, and who holds it. */
export async function rolesView(): Promise<RoleView[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const [{ data: roles }, { data: grants }, { data: people }] = await Promise.all([
    db.from("eng_roles").select("key, name, landing_path, is_system, description").order("is_system", { ascending: false }).order("key"),
    db.from("eng_role_grants").select("role_key, action"),
    db.from("eng_profiles").select("id, display_name, email, role, status").order("display_name"),
  ]);

  return (roles ?? []).map((r) => ({
    ...(r as RoleRow),
    grants: (grants ?? [])
      .filter((g) => g.role_key === r.key)
      .map((g) => g.action as Action)
      .sort(),
    holders: (people ?? [])
      .filter((p) => p.role === r.key)
      .map((p) => ({
        id: p.id as string,
        display_name: p.display_name as string,
        email: p.email as string,
        status: p.status as string,
      })),
  }));
}

/** The shapes the pure rules need, from the same read. */
function shapesFrom(view: RoleView[]): { roles: RoleShape[]; holders: Holder[] } {
  return {
    roles: view.map((r) => ({ key: r.key, isSystem: r.is_system, grants: r.grants })),
    holders: view.flatMap((r) =>
      r.holders.map((h) => ({
        id: h.id,
        roleKey: r.key,
        status: h.status as Holder["status"],
      })),
    ),
  };
}

type Result = { ok: true } | { ok: false; error: string };

/**
 * Change what a role grants.
 *
 * Takes the WHOLE set rather than a diff, because a screen with forty
 * checkboxes submits a state, and reconstructing a diff from it only to apply
 * it as a state again is a place for the two to disagree.
 */
export async function setGrants(
  actor: Actor & { email: string },
  roleKey: string,
  next: Action[],
): Promise<Result> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  /*
   * Anything not in ALL_ACTIONS is dropped rather than refused. The licensed
   * five cannot appear here because they are not Actions, so this filter is
   * about a stale or hand crafted request naming something that no longer
   * exists, which is a request to grant nothing rather than an attack.
   */
  const clean = [...new Set(next.filter((a) => (ALL_ACTIONS as string[]).includes(a)))].sort();

  const view = await rolesView();
  const { roles, holders } = shapesFrom(view);

  const verdict = canSetGrants(roles, holders, roleKey, clean);
  if (!verdict.ok) return { ok: false, error: verdict.because };

  const before = view.find((r) => r.key === roleKey)?.grants ?? [];

  await db.from("eng_role_grants").delete().eq("role_key", roleKey);
  if (clean.length) {
    const { error } = await db
      .from("eng_role_grants")
      .insert(clean.map((action) => ({ role_key: roleKey, action })));
    if (error) return { ok: false, error: error.message };
  }

  const added = clean.filter((a) => !before.includes(a));
  const removed = before.filter((a) => !clean.includes(a));

  await writeAudit({
    actor,
    action: "role.grants_changed",
    entityType: "role",
    entityId: roleKey,
    summary:
      `${roleKey}: ` +
      [
        added.length ? `granted ${added.join(", ")}` : null,
        removed.length ? `removed ${removed.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ") || `${roleKey}: no change`,
    diff: { added, removed, now: clean },
  });

  return { ok: true };
}

/** Move somebody between roles. Immediate: currentActor reads it next request. */
export async function setUserRole(
  actor: Actor & { email: string },
  userId: string,
  nextRoleKey: string,
): Promise<Result> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const view = await rolesView();
  const { roles, holders } = shapesFrom(view);

  const verdict = canSetUserRole(roles, holders, userId, nextRoleKey);
  if (!verdict.ok) return { ok: false, error: verdict.because };

  const wasRole = holders.find((h) => h.id === userId)?.roleKey ?? null;
  const person = view.flatMap((r) => r.holders).find((h) => h.id === userId);

  const { error } = await db.from("eng_profiles").update({ role: nextRoleKey }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "role.assigned",
    entityType: "profile",
    entityId: userId,
    summary: `${person?.display_name ?? userId} moved from ${wasRole ?? "no role"} to ${nextRoleKey}.`,
    diff: { from: wasRole, to: nextRoleKey },
  });

  return { ok: true };
}

/** Create a role. It starts with no grants, which is the safe direction. */
export async function createRole(
  actor: Actor & { email: string },
  input: { key: string; name: string; landingPath: string; description?: string | null },
): Promise<Result> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const view = await rolesView();
  const problem = keyProblem(input.key, view.map((r) => r.key));
  if (problem) return { ok: false, error: problem };

  if (!input.name.trim()) return { ok: false, error: "A role needs a name." };

  /*
   * The landing path is NOT NULL in the schema and checked here too, because
   * the schema can only say "something" and this can say "somewhere real". A
   * role landing outside the portal would send somebody to the public site
   * after signing in.
   */
  const landing = input.landingPath.trim();
  if (!landing.startsWith("/portal")) {
    return { ok: false, error: "A landing page has to be a portal route, starting with /portal." };
  }

  const { error } = await db.from("eng_roles").insert({
    key: input.key.trim(),
    name: input.name.trim(),
    landing_path: landing,
    is_system: false,
    description: input.description?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "role.created",
    entityType: "role",
    entityId: input.key.trim(),
    summary: `Role ${input.name.trim()} created, landing on ${landing}, with no grants.`,
    diff: { key: input.key.trim(), landing_path: landing },
  });

  return { ok: true };
}

export async function deleteRole(actor: Actor & { email: string }, roleKey: string): Promise<Result> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const view = await rolesView();
  const { roles, holders } = shapesFrom(view);

  const verdict = canDeleteRole(roles, holders, roleKey);
  if (!verdict.ok) return { ok: false, error: verdict.because };

  const { error } = await db.from("eng_roles").delete().eq("key", roleKey);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "role.deleted",
    entityType: "role",
    entityId: roleKey,
    summary: `Role ${roleKey} deleted. Nobody held it.`,
  });

  return { ok: true };
}

/**
 * WHAT THE SCREEN SHOWS ABOUT THE CAPABILITIES IT CANNOT GRANT.
 *
 * Operator ruling: the licensed capabilities must be VISIBLE and explained
 * rather than absent, so somebody looking for sealing finds a reason instead of
 * a gap. An absence looks like an oversight, and the next person to notice it
 * would try to add a checkbox.
 *
 * They are returned as data with no toggle, which is the honest shape: they
 * exist, they are real capabilities, and there is nothing here to switch.
 */
export function licensedCapabilities() {
  return {
    role: LICENSED_ROLE,
    actions: LICENSED_ACTIONS,
    why:
      "These come from holding the Professional Engineer role, because a seal represents a " +
      "Texas PE licence rather than a job title. They are not permissions and there is no " +
      "checkbox for them anywhere: the platform cannot represent granting one, so nobody can " +
      "grant one by mistake.",
  };
}
