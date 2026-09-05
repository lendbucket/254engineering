/**
 * THE LICENCE BOUND CAPABILITIES ARE UNREPRESENTABLE, PROVED BY THE COMPILER.
 *
 * Phase 10 Section 2. This file asserts nothing at runtime and is never
 * imported. Its whole job is to fail to compile.
 *
 * Every @ts-expect-error below is an assertion: if the line it guards ever
 * starts compiling, TypeScript reports TS2578 for the unused directive and the
 * typecheck fails. So the guarantee cannot rot quietly. The day somebody makes
 * a licensed action grantable, the build breaks and names the line.
 *
 * It imports the REAL types. An earlier draft copied a sketch of them, which
 * would have kept passing while the actual module drifted.
 */
import type { Action, LicensedAction } from "../../src/lib/ops-authz";

/** What a role row holds. Grants are Action[] and nothing widens that. */
type RoleGrants = { key: string; grants: Action[] };

/** An ordinary role. Compiles, or the checks below would prove nothing. */
export const sales: RoleGrants = {
  key: "sales",
  grants: ["clients.list", "clients.create", "files.list", "files.create"],
};

export const sealer: RoleGrants = {
  key: "tries to seal",
  // @ts-expect-error sealing is not grantable, by construction
  grants: ["files.list", "documents.seal"],
};

export const reviewer: RoleGrants = {
  key: "tries to review",
  // @ts-expect-error the review decisions are not grantable, by construction
  grants: ["review.decide"],
};

export const author: RoleGrants = {
  key: "tries to author protocols",
  // @ts-expect-error authoring a protocol is not grantable, by construction
  grants: ["protocols.author"],
};

export const publisher: RoleGrants = {
  key: "tries to publish protocols",
  // @ts-expect-error publishing a protocol is not grantable, by construction
  grants: ["protocols.publish"],
};

export const queuer: RoleGrants = {
  key: "tries to reach the review queue",
  // @ts-expect-error the review queue is not grantable, by construction
  grants: ["review.queue"],
};

/** A typo is caught too, rather than silently granting nothing. */
export const typo: RoleGrants = {
  key: "typo",
  // @ts-expect-error a misspelled action is not a silent empty grant
  grants: ["files.lst"],
};

/*
 * And the reverse direction: a licensed action cannot masquerade as an Action
 * in a variable somebody passes to a grant.
 */
// @ts-expect-error documents.seal is not an Action
export const smuggled: Action = "documents.seal";

/*
 * The nav widening does not widen the grant. NavItem takes either kind so a
 * menu can point at the engineer's screens, and this is the case that proves
 * doing so did not make them grantable.
 */
type NavLike = { href: string; action: Action | LicensedAction };
export const nav: NavLike[] = [
  { href: "/portal/files", action: "files.list" },
  { href: "/portal/review", action: "review.queue" },
];

export const stillNotGrantable: RoleGrants = {
  key: "tries again through the nav type",
  // @ts-expect-error still not grantable
  grants: ["review.queue"],
};
