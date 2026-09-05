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
  /**
   * The role KEY. A row in eng_roles since Phase 10 Section 2, not a member of
   * a union, so the owner can create roles this code has never heard of.
   *
   * It is still read directly for one thing and one thing only: holdsLicence
   * compares it against LICENSED_ROLE. Everything else asks the grants.
   */
  role: Role;
  status: "invited" | "active" | "suspended";
  /**
   * What this actor may do, loaded with the profile.
   *
   * WHY IT IS CARRIED RATHER THAN LOOKED UP
   * ---------------------------------------
   * can() is called 116 times, in server components, in route handlers, and in
   * pure audits. Making it async to read a table would have turned every one of
   * those into an await, and a permission check that can be forgotten to await
   * returns a Promise, which is truthy.
   *
   * So currentActor loads the grants once per request alongside the profile it
   * was already loading, and can() stays synchronous and total.
   */
  grants: ReadonlySet<Action>;
};

/**
 * Everything the platform can be asked to do.
 *
 * Named as resource.verb so the matrix in roles-audit reads as a table. Adding
 * an action here without adding it to MATRIX is a type error, which is the
 * point: a new capability cannot ship without somebody deciding who has it.
 */
/**
 * THE CAPABILITIES A LICENCE CARRIES, NOT A JOB TITLE.
 *
 * Sealing, the four review decisions, and authoring or publishing a protocol.
 * A Texas Professional Engineer holds the licence the seal represents, and the
 * firm's registration rests on that. The firm can hire a dispatcher tomorrow;
 * it cannot grant one the ability to seal.
 *
 * WHY THESE ARE A SEPARATE TYPE AND NOT AN EXCLUDED SUBSET
 * -------------------------------------------------------
 * Operator ruling, 2026-09-04, and it is stronger than the design that preceded
 * it. Grantable-but-excluded means the exclusion is a check somebody can
 * delete: a future session tidying the permission screen removes the filter and
 * the checkbox appears.
 *
 * Unrepresentable means there is nothing to delete. A role row cannot hold one,
 * because Role.grants is Action[] and these are not Actions. There is no
 * checkbox to hide and no runtime test to remember.
 *
 * scripts/proofs/licensed-actions-are-unrepresentable.ts compiles that claim,
 * and it fails to compile the day somebody makes one of these grantable, so the
 * guarantee cannot rot quietly.
 *
 * They are checked by holdsLicence, which asks whether the actor holds the
 * engineer role, full stop. No grant is consulted because none exists.
 */
export type LicensedAction =
  | "protocols.author"
  | "protocols.publish"
  | "review.queue"
  | "review.decide"
  | "documents.seal";

export const LICENSED_ACTIONS: LicensedAction[] = [
  "protocols.author",
  "protocols.publish",
  "review.queue",
  "review.decide",
  "documents.seal",
];

/**
 * The role key that carries the licence.
 *
 * A literal in code rather than a column on eng_roles, deliberately. A column
 * would make the licence grantable by editing a row, which is the thing the
 * separation above exists to prevent. eng_roles marks this key as a system role
 * so it cannot be renamed or deleted out from under this comparison.
 */
export const LICENSED_ROLE = "engineer";

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
  | "documents.deliver"
  | "documents.read"
  // money
  | "pricing.read"
  | "billing.read"
  | "ledger.read_own"
  | "ledger.read_all"
  | "ledger.approve"
  // Reconciliation against the payment provider. Admin only, because applying
  // it records that money moved and releases work off the back of it.
  | "payments.reconcile"
  // Cancelling a paid order and refunding it in full. Admin only, and it is
  // deliberately NOT a review outcome: see refundForFirmCancellation.
  | "payments.refund"
  /*
   * Raising money against a job the customer did not place themselves: a
   * payment link, or an invoice to an account with terms.
   *
   * In this family rather than beside files.create, and admin only for the same
   * reason the two above are. Writing a job down and asking somebody to pay for
   * it are different acts. Phase 10 Section 2 introduces a coordinator who
   * should be able to do the first without the second, and putting this here
   * now means that role arrives without needing this decision revisited.
   */
  | "payments.charge"
  // Customer ordering accounts: terms, credit, statements. Admin only, because
  // it is the firm deciding who may owe it money.
  | "accounts.manage"
  /*
   * Creating roles, editing what they grant, and moving somebody between them.
   *
   * Its own action rather than folding into profiles.update, because changing
   * what a role MAY DO is a different act from changing who somebody is, and a
   * firm may well want a coordinator who can invite people without being able
   * to widen their own access.
   *
   * It is also the permission the lockout guard protects: an edit that would
   * leave nobody active holding this is refused, because the firm would have no
   * way back.
   */
  | "roles.manage"
  // The job queue: depth, failures, dead letters, and retrying one by hand. A
  // retry re-runs a side effect, so this is the operator alone.
  | "jobs.manage"
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
    /*
     * AN ADMINISTRATOR CANNOT SEAL, REVIEW, OR AUTHOR A PROTOCOL.
     *
     * This role held all five until Phase 10 Section 2, and losing them is the
     * point rather than a side effect. A seal represents a Texas PE licence,
     * and the operator holding administrator does not hold one. The four review
     * decisions and the protocols rest on the same judgment.
     *
     * The consequence is real and worth knowing: until a PE is on staff, nobody
     * can author a protocol, and eight of the nine service lines do not have
     * one. Section A of docs/intake-completeness.md reached the same place from
     * the other direction and marked those protocols as the engineer's to
     * write. This makes the platform agree with that.
     *
     * documents.deliver stays. Handing a finished document to the customer is
     * administration, not engineering, and the gate already stops anything
     * reaching delivered while registration is pending.
     */
    "documents.deliver", "documents.read",
    "pricing.read", "billing.read", "ledger.read_own", "ledger.read_all", "ledger.approve",
    "payments.reconcile", "payments.charge", "payments.refund", "accounts.manage", "jobs.manage",
    "roles.manage",
    "tasks.use", "messages.use",
    "audit.read", "time.log_own",
    "responsible_charge.read_own", "responsible_charge.read_all",
  ],
  engineer: [
    "profiles.read_self", "profiles.update_self",
    "clients.list",
    "files.list", "files.update", "files.transition",
    "evidence.review", "evidence.start", "evidence.submit",
    /*
     * The engineer's five are NOT listed here, and their absence is the
     * mechanism rather than an omission. They are not Actions, so this array
     * cannot hold them; holdsLicence answers them from the role itself.
     *
     * An engineer loses nothing. What changes is where the answer comes from:
     * a licence rather than a grant somebody could edit.
     */
    "documents.deliver", "documents.read",
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

/**
 * THE SEVEN ROLES THE PLATFORM SHIPS WITH.
 *
 * Phase 10 Section 2. Roles are ROWS now: the owner can create more, rename the
 * ones that are not system roles, and change what any of them grants. This is
 * the seed, and the only thing in code that decides a role's grants.
 *
 * The three that already existed take their grants FROM the matrix above rather
 * than restating them, because the migration must not change what anybody can
 * do on the day it runs. A retyped list would be a second chance to get it
 * wrong, and the mistake would look like a decision.
 *
 * WHAT IS A SYSTEM ROLE
 * ---------------------
 * admin, engineer and field_tech cannot be deleted or rekeyed. The engineer key
 * especially: holdsLicence compares against it, so renaming it would quietly
 * detach the licence from the people holding it. The owner can still change
 * what they GRANT, because that is a decision about the firm rather than about
 * the platform.
 */
export type DefaultRole = {
  key: string;
  name: string;
  /** Where somebody holding this role lands after signing in. NOT NULL on the row. */
  landingPath: string;
  /** Cannot be deleted or rekeyed. Grants are still editable. */
  isSystem: boolean;
  grants: Action[];
};

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: "admin",
    name: "Administrator",
    landingPath: "/portal",
    isSystem: true,
    grants: [...MATRIX.admin, "roles.manage"],
  },
  {
    key: "engineer",
    name: "Professional Engineer",
    landingPath: "/portal/review",
    isSystem: true,
    grants: [...MATRIX.engineer],
  },
  {
    key: "field_tech",
    name: "Field Technician",
    landingPath: "/portal/jobs",
    isSystem: true,
    grants: [...MATRIX.field_tech],
  },
  {
    /*
     * Moves work to people. No money at all: a dispatcher deciding who goes to
     * a job has no reason to know what the job is worth, and knowing would make
     * the assignment a commercial decision instead of a scheduling one.
     */
    key: "dispatcher",
    name: "Dispatcher",
    landingPath: "/portal/files",
    isSystem: false,
    grants: [
      "profiles.read_self", "profiles.update_self", "profiles.list",
      "clients.list",
      "files.list", "files.update", "files.assign", "files.transition",
      "offers.dispatch", "offers.list_own",
      "tasks.use", "messages.use",
      "time.log_own",
    ],
  },
  {
    /*
     * Brings work in and can open a job. Cannot see a cost or a margin, which
     * is the load bearing exclusion: a salesperson who can see the spread
     * between what the client pays and what the technician is paid is
     * negotiating against the firm's own costs.
     *
     * No payments.charge either. Writing a job down and asking somebody to pay
     * for it are different acts, decided in Section 1.
     */
    key: "sales",
    name: "Sales",
    landingPath: "/portal/clients",
    isSystem: false,
    grants: [
      "profiles.read_self", "profiles.update_self",
      "clients.list", "clients.create", "clients.update",
      "files.list", "files.create",
      "tasks.use", "messages.use",
      "time.log_own",
    ],
  },
  {
    /*
     * Answers the telephone about work that already exists. Can chase a
     * customer for what a job is missing, which is the point of the role and is
     * why messages.use is here: routing a chase for a gate code through an
     * administrator defeats having somebody answer the telephone.
     */
    key: "customer_service",
    name: "Customer Service",
    landingPath: "/portal/files",
    isSystem: false,
    grants: [
      "profiles.read_self", "profiles.update_self",
      "clients.list",
      "files.list",
      "tasks.use", "messages.use",
      "time.log_own",
    ],
  },
  {
    /*
     * A buyer's accountant, an auditor, an operations manager in their first
     * week. Reads, and nothing else. Deliberately includes billing.read and
     * pricing.read: somebody evaluating the business has to see the money, and
     * that is exactly the person this role is for.
     */
    key: "read_only",
    name: "Read Only",
    landingPath: "/portal",
    isSystem: false,
    grants: [
      "profiles.read_self", "profiles.update_self", "profiles.list",
      "clients.list",
      "files.list",
      "documents.read",
      "pricing.read", "billing.read", "ledger.read_all",
      "audit.read",
      "responsible_charge.read_all",
    ],
  },
];

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
/**
 * What can() actually needs to answer the question.
 *
 * Widened from Actor when the order engine arrived. Intake acts on a customer's
 * behalf and no person did it, so it has no profile id, and inventing one meant
 * either a sentinel uuid that violates the created_by foreign key or a phantom
 * admin profile that every fan-out over active admins would then include: it
 * would join every file thread and receive every notification addressed to
 * administrators.
 *
 * can() reads role and status and never touched the id, so this costs nothing
 * and every existing Actor still satisfies it.
 */
/**
 * What can() actually needs: the grants and whether the account is live.
 *
 * Not the role. A check that read the role would be comparing against a row
 * somebody can rename, and would start disagreeing with the grants the moment
 * an owner edited one.
 */
export type AuthzSubject = Pick<Actor, "grants" | "status">;

/**
 * May this actor do something only a licensed engineer may do?
 *
 * Not can(). can() takes an Action and these are not Actions, so a caller
 * cannot reach this by accident and cannot reach can() with one of these
 * either. The two questions are asked with two functions because they are
 * answered by two different things: a grant, and a licence.
 *
 * No permission is consulted. There is none to consult.
 */
export function holdsLicence(
  actor: (Pick<Actor, "status"> & { role: string }) | null,
  action: LicensedAction,
): boolean {
  void action;
  if (!actor) return false;
  if (actor.status !== "active") return false;
  return actor.role === LICENSED_ROLE;
}

/** Is this one of the capabilities a licence carries? */
export function isLicensed(action: Action | LicensedAction): action is LicensedAction {
  return (LICENSED_ACTIONS as string[]).includes(action);
}

/**
 * Ask the right question for whichever kind of capability this is.
 *
 * Some tables legitimately map to both kinds. A file moving to "sealed" needs a
 * licence; the same table's move to "delivered" needs a grant. Making those
 * tables choose between two functions at every entry would put the routing in
 * the caller, and a caller that got it wrong would check the wrong thing.
 *
 * THIS IS NOT A HOLE IN THE SEPARATION. It dispatches a CHECK; it grants
 * nothing. Role.grants is still Action[], a role still cannot hold a licensed
 * action, and the proof in scripts/proofs asserts exactly that. What may() adds
 * is one place that knows which question to ask, rather than every table
 * knowing.
 */
export function may(
  actor: (AuthzSubject & { role: string }) | null,
  action: Action | LicensedAction,
): boolean {
  return isLicensed(action) ? holdsLicence(actor, action) : can(actor, action);
}

export function can(actor: AuthzSubject | null, action: Action): boolean {
  if (!actor) return false;
  if (actor.status !== "active") return false;
  return actor.grants.has(action);
}

/** Every action a role holds. Used by roles-audit and by the profile screen. */
/**
 * What a DEFAULT role grants, for describing one before anybody holds it.
 *
 * Not what a role grants TODAY: an owner may have edited it, and the answer to
 * that question lives in eng_role_grants. This is the shipped default, which is
 * what a seed and a "reset to default" need.
 */
export function actionsFor(role: string): Action[] {
  return [...(DEFAULT_ROLES.find((r) => r.key === role)?.grants ?? [])];
}

/** Every grantable action, for enumerating a matrix. */
export const ALL_ACTIONS: Action[] = [
  ...new Set(DEFAULT_ROLES.flatMap((r) => r.grants)),
].sort() as Action[];

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
/**
 * EVERY MONEY COLUMN ON eng_files, REDACTED FROM ANYBODY WITHOUT pricing.read.
 *
 * The rule this list implements: a field technician is an independent
 * contractor paid a flat rate, and a contractor who can see the spread between
 * what the client pays and what they are paid is a negotiation the firm did not
 * intend to have.
 *
 * WHY IT IS ASSERTED AGAINST THE SCHEMA RATHER THAN MAINTAINED BY HAND
 * -------------------------------------------------------------------
 * Phase 10 Section 1 added catalog_price_cents and coastal_surcharge_cents to
 * eng_files and this list did not grow with them. Nothing leaked, because
 * FILE_COLUMNS did not select them, but that is an accident of what is READ
 * rather than a protection: the same commit added deliverable to
 * FILE_COLUMNS, which is exactly how a column starts being selected.
 *
 * files-audit now derives the expected set from the migrations and fails if any
 * column on eng_files mentioning price, cost or surcharge is missing here. The
 * next money column is caught rather than remembered.
 *
 * THE OVERRIDE METADATA IS IN THE LIST TOO, AND THAT IS DELIBERATE
 * ---------------------------------------------------------------
 * price_override_reason is free text a person wrote, and what they write is
 * "agreed on the call against a volume commitment". That is client pricing
 * reaching a technician by a different route, and the two timestamps and the
 * actor id are only meaningful alongside it.
 */
export const PRICING_FIELDS = [
  "client_price_cents",
  "engineer_cost_cents",
  "tech_cost_cents",
  "catalog_price_cents",
  "coastal_surcharge_cents",
  "price_override_reason",
  "price_overridden_by",
  "price_overridden_at",
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
