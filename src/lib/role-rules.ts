import type { Action } from "./ops-authz";

/**
 * THE RULES THAT PROTECT THE PERMISSION SCREEN FROM ITSELF.
 *
 * Pure. No database, no environment, so the audit exercises the RULE rather
 * than the implementation, the same reasoning as attribution-rules.ts and
 * job-intake-rules.ts.
 *
 * A permission screen is the one screen that can destroy the firm's access to
 * the platform, and it does it by being used correctly: every individual edit
 * looks reasonable and the last one locks everybody out.
 */

/** The permission that governs the permission screen itself. */
export const MANAGE = "roles.manage" as const;

export type RoleShape = {
  key: string;
  isSystem: boolean;
  grants: Action[];
};

/** Somebody who holds a role. Only active people can act, so only they count. */
export type Holder = {
  id: string;
  roleKey: string;
  status: "invited" | "active" | "suspended";
};

export type Refusal = { ok: false; because: string };
export type Allowed = { ok: true };
export type Verdict = Allowed | Refusal;

const ok: Allowed = { ok: true };

/**
 * WOULD THIS LEAVE THE FIRM UNABLE TO CHANGE ITS OWN PERMISSIONS?
 *
 * The invariant: at least one ACTIVE person must hold a role granting
 * roles.manage. Not "an administrator", because the owner may have created
 * another role that also holds it, and a rule that names the admin role would
 * refuse a legitimate arrangement while missing the dangerous one.
 *
 * Invited does not count. An invited person has never signed in and may never;
 * counting them would let the firm lock itself out and be told it had not.
 * Suspended does not count for the obvious reason.
 *
 * This is checked against the state AFTER the proposed change, which is why it
 * takes the whole picture rather than the edit.
 */
export function wouldStrandTheFirm(roles: RoleShape[], holders: Holder[]): boolean {
  const managing = new Set(roles.filter((r) => r.grants.includes(MANAGE)).map((r) => r.key));
  return !holders.some((h) => h.status === "active" && managing.has(h.roleKey));
}

/**
 * May this change to a role's grants be made?
 *
 * The answer is the same whoever is asking. An owner cannot override it,
 * because the state it protects is the one where nobody can override anything.
 */
export function canSetGrants(
  roles: RoleShape[],
  holders: Holder[],
  roleKey: string,
  next: Action[],
): Verdict {
  const role = roles.find((r) => r.key === roleKey);
  if (!role) return { ok: false, because: "That role does not exist." };

  const after = roles.map((r) => (r.key === roleKey ? { ...r, grants: next } : r));

  if (wouldStrandTheFirm(after, holders)) {
    return {
      ok: false,
      because:
        "That would leave nobody able to change permissions. Somebody active has to keep the " +
        "ability to manage roles, or the firm cannot undo this or anything after it.",
    };
  }

  return ok;
}

/**
 * May this person be moved to this role?
 *
 * The same invariant from the other direction. Moving the last person who can
 * manage roles into a role that cannot is the more likely way to do this by
 * accident, because it does not feel like editing permissions at all.
 */
export function canSetUserRole(
  roles: RoleShape[],
  holders: Holder[],
  userId: string,
  nextRoleKey: string,
): Verdict {
  if (!roles.some((r) => r.key === nextRoleKey)) {
    return { ok: false, because: "That role does not exist." };
  }

  const after = holders.map((h) => (h.id === userId ? { ...h, roleKey: nextRoleKey } : h));

  if (wouldStrandTheFirm(roles, after)) {
    return {
      ok: false,
      because:
        "That would leave nobody able to change permissions. Move somebody else into a role " +
        "that can manage roles first, then come back to this.",
    };
  }

  return ok;
}

/**
 * May this role be deleted?
 *
 * A system role never. Anything somebody holds never, because the alternative
 * is deciding on their behalf where they go.
 */
export function canDeleteRole(roles: RoleShape[], holders: Holder[], roleKey: string): Verdict {
  const role = roles.find((r) => r.key === roleKey);
  if (!role) return { ok: false, because: "That role does not exist." };

  if (role.isSystem) {
    return {
      ok: false,
      because:
        "This role is part of how the platform works and cannot be deleted. Its grants can " +
        "still be changed.",
    };
  }

  const held = holders.filter((h) => h.roleKey === roleKey);
  if (held.length > 0) {
    return {
      ok: false,
      because: `${held.length} ${held.length === 1 ? "person holds" : "people hold"} this role. Move them somewhere else first.`,
    };
  }

  const after = roles.filter((r) => r.key !== roleKey);
  if (wouldStrandTheFirm(after, holders)) {
    return { ok: false, because: "That would leave nobody able to change permissions." };
  }

  return ok;
}

/**
 * A new role's key, checked before it reaches the database.
 *
 * Lower case, letters, digits and underscores. It is compared against in code
 * in exactly one place, LICENSED_ROLE, and appears in URLs and audit rows, so a
 * key with a space or a capital in it would be a small permanent nuisance.
 */
export function keyProblem(key: string, existing: string[]): string | null {
  const k = key.trim();
  if (k.length < 3) return "A key needs at least three characters.";
  if (k.length > 32) return "A key cannot be longer than thirty two characters.";
  if (!/^[a-z][a-z0-9_]*$/.test(k)) {
    return "A key is lower case letters, digits and underscores, starting with a letter.";
  }
  if (existing.includes(k)) return "There is already a role with that key.";
  return null;
}
