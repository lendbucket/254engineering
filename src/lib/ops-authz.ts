/**
 * The authorization model. One module, no exceptions, and it is pure.
 *
 * WHY EVERY RULE IS IN ONE FILE
 * -----------------------------
 * Authorization scattered across route handlers is authorization nobody can
 * read. The question "can a technician see what a client was charged" should be
 * answerable by opening one file, not by grepping for `role ===` and hoping the
 * list is complete. Every rule the platform has lives below.
 *
 * WHY IT IS PURE, WITH NO DATABASE AND NO REQUEST
 * -----------------------------------------------
 * Nothing here reads a cookie, opens a connection, or awaits anything. It takes
 * an actor and a subject and returns a decision. That is what makes
 * scripts/roles-audit.mjs able to assert the entire matrix, every action against
 * every role, in milliseconds and without seeding a database.
 *
 * A rule that can only be tested by standing up a portal and clicking is a rule
 * that will be tested once.
 *
 * THIS IS NOT THE ONLY LOCK
 * -------------------------
 * The database has RLS on with zero policies, so nothing reaches a table except
 * the service role. src/proxy.ts keeps unauthenticated requests off portal
 * routes entirely. This module is the layer that decides what an AUTHENTICATED
 * person may do, and every server action and route handler calls it before it
 * reads or writes. Three layers, and the other two do not make this one
 * optional.
 *
 * THE SHAPE OF A DENY
 * -------------------
 * `can()` answers a yes or no question about an action. `visibleFiles()` answers
 * a different question, which is what a list query may return, and it returns a
 * filter rather than a boolean because filtering in SQL and filtering in
 * JavaScript after the fact are not the same thing: the second one has already
 * loaded the rows it is about to hide.
 */

export type Role = "admin" | "engineer" | "field_tech";

export const ROLES: Role[] = ["admin", "engineer", "field_tech"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  engineer: "Professional Engineer",
  field_tech: "Field Technician",
};

/** The signed-in person, as every rule below sees them. */
export type Actor = {
  id: string;
  role: Role;
  status: "invited" | "active" | "suspended";
};

/**
 * Everything the platform can be asked to do.
 *
 * Named as resource.verb so the matrix in roles-audit reads as a table. Adding
 * an action here without adding it to MATRIX is a type error, which is the
 * point: a new capability cannot ship without somebody deciding who has it.
 */
export type Action =
  // people
  | "profiles.list"
  | "profiles.create"
  | "profiles.update"
  | "profiles.suspend"
  | "profiles.force_reset"
  | "profiles.read_self"
  | "profiles.update_self"
  // clients and files
  | "clients.list"
  | "clients.create"
  | "clients.update"
  | "files.list"
  | "files.create"
  | "files.update"
  | "files.assign"
  | "files.transition"
  | "files.cancel"
  // dispatch and field
  | "offers.list_own"
  | "offers.respond"
  | "offers.dispatch"
  | "evidence.capture"
  | "evidence.start"
  | "evidence.submit"
  | "evidence.review"
  // engineering
  | "protocols.author"
  | "protocols.publish"
  | "review.queue"
  | "review.decide"
  | "documents.seal"
  | "documents.deliver"
  | "documents.read"
  // money
  | "pricing.read"
  | "billing.read"
  | "ledger.read_own"
  | "ledger.read_all"
  | "ledger.approve"
  // tasks and communication
  | "tasks.use"
  | "messages.use"
  // records
  | "audit.read"
  | "time.log_own"
  | "responsible_charge.read_own"
  | "responsible_charge.read_all";

/**
 * The matrix. Read it as: this role may perform these actions.
 *
 * The three rules the operator set, in this order of precedence:
 *   admins see everything;
 *   engineers see files assigned to them and the review queue;
 *   techs see only jobs offered to or accepted by them, and nothing about other
 *   techs or pricing.
 *
 * "Nothing about pricing" is why `pricing.read` is absent for field_tech and why
 * redactFile below exists. A tech sees the amount THEY were offered, because
 * they agreed to it, and never what the client paid or what the engineer earns.
 */
const MATRIX: Record<Role, Action[]> = {
  admin: [
    "profiles.list", "profiles.create", "profiles.update", "profiles.suspend",
    "profiles.force_reset", "profiles.read_self", "profiles.update_self",
    "clients.list", "clients.create", "clients.update",
    "files.list", "files.create", "files.update", "files.assign", "files.transition", "files.cancel",
    "offers.dispatch", "offers.list_own", "offers.respond",
    "evidence.review", "evidence.start", "evidence.submit",
    "protocols.author", "protocols.publish",
    "review.queue", "review.decide", "documents.seal", "documents.deliver", "documents.read",
    "pricing.read", "billing.read", "ledger.read_own", "ledger.read_all", "ledger.approve",
    "tasks.use", "messages.use",
    "audit.read", "time.log_own",
    "responsible_charge.read_own", "responsible_charge.read_all",
  ],
  engineer: [
    "profiles.read_self", "profiles.update_self",
    "clients.list",
    "files.list", "files.update", "files.transition",
    "evidence.review", "evidence.start", "evidence.submit",
    "protocols.author", "protocols.publish",
    "review.queue", "review.decide", "documents.seal", "documents.deliver", "documents.read",
    "tasks.use", "messages.use",
    "ledger.read_own", "time.log_own",
    "responsible_charge.read_own",
    // An engineer sees what a file is worth, because they are paid production on
    // it and a tier they cannot see is a number they cannot check.
    "pricing.read",
  ],
  field_tech: [
    "profiles.read_self", "profiles.update_self",
    "offers.list_own", "offers.respond",
    "files.list",
    "evidence.capture", "evidence.start", "evidence.submit",
    "tasks.use", "messages.use",
    "ledger.read_own",
  ],
};

const ALLOWED = new Map<Role, Set<Action>>(
  (Object.keys(MATRIX) as Role[]).map((r) => [r, new Set(MATRIX[r])]),
);

/**
 * May this actor perform this action at all?
 *
 * A suspended account is denied everything including reading its own profile.
 * Suspension that still lets somebody look around is not suspension, and the
 * sign in screen is where a suspended person gets an explanation.
 */
export function can(actor: Actor | null, action: Action): boolean {
  if (!actor) return false;
  if (actor.status !== "active") return false;
  return ALLOWED.get(actor.role)?.has(action) ?? false;
}

/** Every action a role holds. Used by roles-audit and by the profile screen. */
export function actionsFor(role: Role): Action[] {
  return [...(ALLOWED.get(role) ?? [])];
}

/** The subset of a file's fields a rule needs. Keeps this module free of the DB type. */
export type FileSubject = {
  id: string;
  status: string;
  assigned_tech_id: string | null;
  assigned_engineer_id: string | null;
  offered_tech_ids?: string[];
};

/**
 * Which files a list query may return, expressed as a filter rather than a
 * predicate applied after loading.
 *
 * `kind: "all"` is the admin. Everyone else gets a constraint that the query
 * layer turns into SQL, so rows a person may not see are never selected, never
 * serialized, and never sit in a response waiting for a rendering bug to reveal
 * them.
 */
export type FileScope =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "engineer"; engineerId: string; queueStatuses: string[] }
  | { kind: "tech"; techId: string };

/** Statuses that make a file part of the shared review queue. */
export const REVIEW_QUEUE_STATUSES = ["evidence_submitted", "under_review", "revisions_requested"];

export function visibleFiles(actor: Actor | null): FileScope {
  if (!actor || actor.status !== "active") return { kind: "none" };
  switch (actor.role) {
    case "admin":
      return { kind: "all" };
    case "engineer":
      return { kind: "engineer", engineerId: actor.id, queueStatuses: REVIEW_QUEUE_STATUSES };
    case "field_tech":
      return { kind: "tech", techId: actor.id };
  }
}

/**
 * Whether a specific file is visible, for the single record case.
 *
 * Kept beside visibleFiles rather than derived from it, because a list filter
 * and a record check that disagree is the classic authorization hole: the list
 * hides it and the direct URL does not.
 */
export function canSeeFile(actor: Actor | null, file: FileSubject): boolean {
  const scope = visibleFiles(actor);
  switch (scope.kind) {
    case "all":
      return true;
    case "none":
      return false;
    case "engineer":
      return (
        file.assigned_engineer_id === scope.engineerId ||
        scope.queueStatuses.includes(file.status)
      );
    case "tech":
      return (
        file.assigned_tech_id === scope.techId ||
        (file.offered_tech_ids ?? []).includes(scope.techId)
      );
  }
}

/**
 * Money fields a technician must never receive.
 *
 * Redaction happens on the way out of the data layer, not in a component. A
 * component that forgets to hide a field ships the number in the HTML whether or
 * not it renders it, and "it is not displayed" is not the same as "it was not
 * sent".
 */
export const PRICING_FIELDS = [
  "client_price_cents",
  "engineer_cost_cents",
  "tech_cost_cents",
] as const;

export function redactFile<T extends Record<string, unknown>>(actor: Actor | null, file: T): T {
  if (can(actor, "pricing.read")) return file;
  const copy = { ...file };
  for (const field of PRICING_FIELDS) delete copy[field];
  return copy;
}

/**
 * Whether one person may see another person's profile record.
 *
 * A technician may see themselves and nobody else. That is stricter than it
 * needs to be for a roster screen and exactly right for the rule the operator
 * set: techs see nothing about other techs.
 */
export function canSeeProfile(actor: Actor | null, targetId: string): boolean {
  if (!actor || actor.status !== "active") return false;
  if (actor.id === targetId) return true;
  return can(actor, "profiles.list");
}

/** The landing route for a role, used after sign in and by the shell. */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/portal";
    case "engineer":
      return "/portal/review";
    case "field_tech":
      return "/portal/jobs";
  }
}
