/**
 * Does the operator's design actually give a COMPILE TIME guarantee?
 *
 * The claim to test: if the licence bound five are not in the grantable Action
 * union at all, then a role row cannot be constructed holding one, and the
 * failure is at compile time rather than at runtime.
 *
 * Proved rather than asserted, because the whole design rests on it.
 */

// The grantable set. What a permission screen may offer.
type Action =
  | "files.list"
  | "files.create"
  | "clients.list"
  | "payments.charge";

/*
 * The licence bound set. A SEPARATE type, not a subset of Action, so nothing
 * that takes an Action can ever be handed one of these.
 */
type LicensedAction =
  | "protocols.author"
  | "protocols.publish"
  | "review.queue"
  | "review.decide"
  | "documents.seal";

type Role = { name: string; grants: Action[] };

// ---------------------------------------------------------------- the proof

/** An ordinary role. Compiles. */
export const sales: Role = {
  name: "Sales",
  grants: ["files.list", "clients.list"],
};

/**
 * A role granting a licensed action. MUST NOT COMPILE.
 *
 * ts-expect-error is itself the assertion: if this line ever starts compiling,
 * TypeScript reports the unused directive as an error, so the guarantee cannot
 * rot silently. The audit does not have to run anything.
 */
export const forged: Role = {
  name: "Forged",
  // @ts-expect-error the licence bound actions are not grantable, by construction
  grants: ["files.list", "documents.seal"],
};

/** A typo in a grant is caught too, which is the other half of the ask. */
export const typo: Role = {
  name: "Typo",
  // @ts-expect-error a misspelled action is not silently an empty grant
  grants: ["files.lst"],
};

// ------------------------------------------------- the two checking functions

declare function can(actor: unknown, action: Action): boolean;
declare function holdsLicence(actor: unknown, action: LicensedAction): boolean;

export function ordinary(actor: unknown) {
  return can(actor, "files.create");
}

export function licensed(actor: unknown) {
  return holdsLicence(actor, "documents.seal");
}

/** can() cannot be handed a licensed action even by a caller who wants to. */
export function mistake(actor: unknown) {
  // @ts-expect-error sealing is not something can() decides
  return can(actor, "documents.seal");
}

/*
 * And the nav wrinkle: NavItem.action is typed Action today, and two nav
 * entries point at licensed screens. A union at the call site is what lets one
 * list carry both without widening what a GRANT may hold.
 */
type NavItem = { href: string; action: Action | LicensedAction };

export const nav: NavItem[] = [
  { href: "/portal/files", action: "files.list" },
  { href: "/portal/review", action: "review.queue" },
];

/*
 * The important half: widening the NAV does not widen the GRANT. A role still
 * cannot hold review.queue, because Role.grants is Action[] and nothing about
 * NavItem changed that.
 */
export const stillImpossible: Role = {
  name: "Tries again via nav",
  // @ts-expect-error still not grantable
  grants: ["review.queue"],
};
