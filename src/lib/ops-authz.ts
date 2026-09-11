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

/**
 * A role as the database holds it: a key on a row in eng_roles.
 *
 * It is `string` and that is the honest width. Role is the union of the three
 * roles that shipped before Phase 10 Section 2 turned roles into rows, and it
 * is still the right type for the three the code names on purpose, MATRIX and
 * LICENSED_ROLE among them. It is the wrong type for a column, and typing the
 * column with it is how ROLE_LABEL[actor.role] compiled while rendering nothing
 * for four of the seven roles the platform ships.
 *
 * An alias rather than bare string, so a signature says which kind of string it
 * wants.
 */
export type RoleKey = string;

export const ROLES: Role[] = ["admin", "engineer", "field_tech"];

/**
 * What to call a role on a screen.
 *
 * WHY THIS IS A FUNCTION AND NOT THE MAP IT REPLACES
 * ---------------------------------------------------
 * ROLE_LABEL was `Record<Role, string>` with three keys, and Role is the union
 * of the three roles that existed before roles became rows. Seven ship now, so
 * `ROLE_LABEL[actor.role]` rendered NOTHING for a dispatcher, a salesperson,
 * customer service or a read only account: a blank in the profile menu, a blank
 * eyebrow on their dashboard, a blank cell in the roster, and a blank on the
 * page where they set their password and are told what they are.
 *
 * Nothing failed. TypeScript was satisfied because the roster row was typed as
 * Role, which is the type that stopped being true when the column started
 * holding role keys. A type that is asserted rather than checked is a comment.
 *
 * The name comes from the database row when the caller has one, because a role
 * created on the roles screen is named there and that name is the truth. When
 * there is no row to hand, DEFAULT_ROLES answers for the seven the platform
 * ships, and anything else is titled from its key rather than left blank: a
 * reader seeing "Field Auditor" for field_auditor has learned something, and a
 * reader seeing nothing has learned that the screen is broken.
 */
export function roleLabel(key: string, given?: string | null): string {
  if (given && given.trim()) return given.trim();
  const declared = DEFAULT_ROLES.find((r) => r.key === key);
  if (declared) return declared.name;
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** The signed-in person, as every rule below sees them. */
export type Actor = {
  id: string;
  /**
   * The role KEY. A row in eng_roles since Phase 10 Section 2, not a member of
   * a union, so the owner can create roles this code has never heard of.
   *
   * It is still read directly for one thing and one thing only: holdsLicence
   * compares it against LICENSED_ROLE. Everything else asks the grants.
   *
   * TYPED AS THE KEY IT IS, since 2026-09-06. It said Role, the union of the
   * three roles that existed before Phase 10 Section 2, while the comment
   * directly above said it was not one. The type was the one being believed:
   * ROLE_LABEL[actor.role] compiled and rendered nothing for four of the seven
   * roles the platform ships.
   */
  role: RoleKey;
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

/**
 * A FIGURE THAT ONLY SOMEBODY IN RESPONSIBLE CHARGE MAY SEE.
 *
 * Phase 12 Section 2. The same construction as LicensedAction above and for the
 * same reason: not a filter somebody remembers, but a type that cannot be put
 * into a role row. Role.grants is Action[] and these are not Actions, so there
 * is no checkbox to hide on the permission screen and no runtime test to
 * forget. Unrepresentable rather than filtered.
 *
 * WHAT MAKES A FIGURE LICENSED. It is derived from the responsible charge log,
 * which is the firm's regulatory record of who took responsible charge of what
 * and when. A count of sealed documents attributed to a named Professional
 * Engineer is not an operations metric, it is a statement about a licence, and
 * a role that cannot hold responsible charge has no business reading it
 * whatever an owner ticks on the roles screen.
 *
 * The production REPORT is grantable, because a firm has to be able to let an
 * administrator see what it pays. The figures below are the ones inside it that
 * are about the LICENCE rather than about the money, and holdsLicence gates
 * them.
 *
 * scripts/proofs/licensed-actions-are-unrepresentable.ts compiles this claim
 * beside the actions, and fails to compile the day somebody makes one
 * grantable.
 */
export type LicensedFigure =
  | "charge_log.entries"
  | "charge_log.sealed_by_engineer"
  | "charge_log.declined_by_engineer"
  | "charge_log.review_minutes";

export const LICENSED_FIGURES: LicensedFigure[] = [
  "charge_log.entries",
  "charge_log.sealed_by_engineer",
  "charge_log.declined_by_engineer",
  "charge_log.review_minutes",
];


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
  /*
   * files.assign IS GONE, AND THE GAP IS THE RECORD.
   *
   * Operator ruling, 2026-09-09, at gate 1 of Phase 12 Section 4. It was
   * declared here and seeded to admin and dispatcher in 0018, and NOTHING IN
   * THIS PLATFORM EVER READ IT. Removed in 0040.
   *
   * Not tidied away: it is removed because of where it leads. Nothing here
   * assigns a file to an engineer. An engineer ACCEPTS one, and that
   * acceptance is the responsible charge entry. A capability named
   * files.assign is a door somebody would eventually build on, and the room
   * behind it is one where an administrator's click puts a Professional
   * Engineer in responsible charge of work they have not seen.
   *
   * The reasoning in full is docs/bulk-actions-reconciliation.md section 2.
   */
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
  /*
   * The referral programme: the roster, terms, statements, payouts, and
   * deciding a disputed attribution.
   *
   * ADMIN ONLY, and not because it is sensitive in the way pricing is. Three
   * of the things behind it are the firm deciding who may use its name, what
   * the firm owes somebody outside it, and recording that money left. None of
   * those is a job somebody does on the firm's behalf without being the firm.
   *
   * One action rather than four. A coordinator who could approve a partner's
   * marketing but not see what they earn sounds tidy and is not a role this
   * firm has: the person who talks to partners is the person who pays them.
   * Splitting it later is one action and one migration, and splitting it now
   * would be inventing a job to justify a permission.
   */
  | "partners.manage"
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
  | "responsible_charge.read_all"
  // reports. A report is a claim the firm makes about itself, so reading one is
  // a grant like any other. Seeded by 0027 to admin, and reports.production
  // additionally to the engineer, whose own work it describes.
  | "reports.revenue"
  | "reports.production"
  | "reports.pipeline"
  | "reports.partner"
  // The marketing suppression list. Its own grant rather than folded into
  // messages.use, because taking somebody off the firm's marketing is a
  // decision about what the firm may say to a person, and the role that does it
  // on the telephone is not the role that runs a campaign. Seeded by 0029 to
  // admin and to customer service.
  | "suppressions.manage"
  /*
   * Turning a retention run from a dry run into one that removes rows.
   *
   * Phase 12 Section 3. Its own action rather than folded into jobs.manage,
   * and the distance between the two is the reason. jobs.manage retries a job;
   * this one is the only permission in this platform that DESTROYS a record,
   * and nothing else here should imply the right to.
   *
   * Admin only, seeded by 0030. Not customer service, who hold
   * suppressions.manage and take deletion REQUESTS from customers: a request
   * produces a task, and the deletion is a run an administrator authorises.
   * Those are two different acts by two different people on purpose.
   */
  | "retention.execute";

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
    "files.list", "files.create", "files.update", "files.transition", "files.cancel",
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
    "partners.manage",
    "roles.manage",
    "tasks.use", "messages.use",
    "audit.read", "time.log_own",
    "responsible_charge.read_own", "responsible_charge.read_all",
    /* All four reports. Seeded by 0027 and declared here, because roles-audit
     * compares this array to the migration chain and a grant in one and not the
     * other is a permission nobody decided. */
    "reports.revenue", "reports.production", "reports.pipeline", "reports.partner",
    /* And the suppression list, for the same reason an administrator holds
     * every other operational grant: somebody has to be able to do it when the
     * one person who normally does is not working. Seeded by 0029. */
    "suppressions.manage",
    /* And the one permission that deletes. Seeded by 0030, admin alone. */
    "retention.execute",
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
    /* The production report and nothing else: it describes their own work.
     * No revenue, no pipeline, no partner. A licence is not a reason to see
     * what the firm earns. */
    "reports.production",
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
/**
 * The extra questions creating an account has to ask for a particular role.
 *
 * WHY THIS IS A DECLARATION AND NOT AN if IN THE FORM
 * ---------------------------------------------------
 * The invite form asked `role === "engineer"` and `role === "field_tech"` in
 * its markup, and offered exactly three roles, because that is what existed
 * when it was written. Phase 10 Section 2 made roles ROWS and shipped seven,
 * and the form went on offering three: four of the firm's own roles could not
 * be given to anybody through the screen that exists to give them out.
 *
 * Putting the answer beside DEFAULT_ROLES rather than in the form means adding
 * a role is one decision in one place, and the compiler asks the question:
 * `inviteFields` is required, so a new role cannot be declared without saying
 * what creating one has to ask for.
 *
 * A role created at RUNTIME on the roles screen has no entry here and gets no
 * extra fields, which is right. The platform cannot know what a role somebody
 * invented needs, and asking a dispatcher for a licence number would be worse
 * than asking nothing.
 */
export type InviteField =
  /** Texas PE licence number and TDI windstorm appointment. */
  | "licence"
  /** Base city, base county, and the counties dispatch may offer work in. */
  | "coverage";

export type DefaultRole = {
  key: string;
  name: string;
  /** Where somebody holding this role lands after signing in. NOT NULL on the row. */
  landingPath: string;
  /** Cannot be deleted or rekeyed. Grants are still editable. */
  isSystem: boolean;
  /** What creating an account with this role has to ask for beyond name and email. */
  inviteFields: InviteField[];
  grants: Action[];
};

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: "admin",
    name: "Administrator",
    landingPath: "/portal",
    isSystem: true,
    inviteFields: [],
    /*
     * MATRIX.admin already carries roles.manage, so it is NOT re-added here.
     *
     * It was, and the spread produced the action twice. Nothing caught it: the
     * seed check in roles-audit compared SETS, which is the right comparison
     * for "are the same grants present" and blind to how many times each one
     * appears. The generated migration carried the row twice and only survived
     * on the ON CONFLICT clause.
     */
    grants: [...MATRIX.admin],
  },
  {
    key: "engineer",
    name: "Professional Engineer",
    landingPath: "/portal/review",
    isSystem: true,
    inviteFields: ["licence"],
    grants: [...MATRIX.engineer],
  },
  {
    key: "field_tech",
    name: "Field Technician",
    landingPath: "/portal/jobs",
    isSystem: true,
    inviteFields: ["coverage"],
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
    inviteFields: [],
    grants: [
      "profiles.read_self", "profiles.update_self", "profiles.list",
      "clients.list",
      "files.list", "files.update", "files.transition",
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
    inviteFields: [],
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
    inviteFields: [],
    grants: [
      "profiles.read_self", "profiles.update_self",
      "clients.list",
      "files.list",
      "tasks.use", "messages.use",
      "time.log_own",
      /*
       * The one thing this role does that nobody else was able to do. Somebody
       * asks to stop hearing from the firm on the telephone, and before this
       * there was no way to record it that did not involve SQL.
       */
      "suppressions.manage",
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
    inviteFields: [],
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

/** What creating an account with this role has to ask for. Nothing, for a role invented on the roles screen. */
export function inviteFieldsFor(key: string): InviteField[] {
  return [...(DEFAULT_ROLES.find((r) => r.key === key)?.inviteFields ?? [])];
}

/*
 * A `Map<Role, Set<Action>>` built from MATRIX used to sit here, and NOTHING
 * READ IT. Deleted 2026-09-07.
 *
 * It was the permission lookup before Phase 10 Section 2 made grants rows, and
 * `can()` has read `actor.grants` since. It stayed behind looking exactly like
 * the authoritative structure it used to be: three roles, keyed by the Phase 0
 * union, one grep away from anybody asking "where are the permissions".
 *
 * Dead code that looks authoritative is worse than dead code, because the next
 * person to reach for it finds a three role answer and no sign it is inert.
 * MATRIX itself stays: it is still read, to seed the three system roles in
 * DEFAULT_ROLES, and that is a use with a reason.
 */

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

/**
 * WHY A LICENCE REFUSAL DOES NOT SAY "YOUR ROLE CANNOT".
 *
 * Every other refusal in this platform says that, and for a grant it is exactly
 * right: the reader now knows to ask somebody with the roles screen open. For
 * one of the licensed five it is false in a way that sends the reader to a
 * screen where the answer is not, and cannot be, present. They would find no
 * checkbox, conclude something was misconfigured, and ask for it to be added.
 *
 * So the wording lives here, once, beside the rule it explains. It names the
 * requirement rather than the reader's role, and it says the thing that would
 * otherwise be discovered by hunting: there is no checkbox to look for.
 */
export function licenceRefusal(what: string): string {
  return (
    what +
    " needs a Professional Engineer in responsible charge. It is not a permission " +
    "and there is no checkbox for it on the roles screen."
  );
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

/**
 * Which files this actor can see.
 *
 * THE THREE NAMED CASES ARE ABOUT IDENTITY, THE REST IS ABOUT THE GRANT
 * ---------------------------------------------------------------------
 * An engineer sees the shared review queue and their own work, and a technician
 * sees the files they are on. Those two scopes are not "what may this person
 * do", they are "which rows are about this person", so they are keyed on the
 * role and have to be.
 *
 * Everybody else is answered by the grant. A dispatcher assigning work, a
 * salesperson opening a job, customer service answering the telephone about one
 * and a read only account reviewing the business all hold files.list, and all
 * four of them need to see files to do the thing the grant permits.
 *
 * WHAT THIS REPLACES, AND IT WAS NOT A STYLE PROBLEM
 * ---------------------------------------------------
 * This was a switch on three role names with no default. TypeScript accepted it
 * as exhaustive because actor.role was typed as the three role union, which
 * stopped being true when roles became rows. A dispatcher reached the end of
 * the function and got undefined, in a function whose every caller reads .kind.
 *
 * The type said the case could not happen. The database had been able to
 * produce it since Phase 10 Section 2.
 */
export function visibleFiles(actor: Actor | null): FileScope {
  if (!actor || actor.status !== "active") return { kind: "none" };
  if (actor.role === "admin") return { kind: "all" };
  if (actor.role === LICENSED_ROLE) {
    return { kind: "engineer", engineerId: actor.id, queueStatuses: REVIEW_QUEUE_STATUSES };
  }
  if (actor.role === "field_tech") return { kind: "tech", techId: actor.id };
  return can(actor, "files.list") ? { kind: "all" } : { kind: "none" };
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
export function homeFor(role: RoleKey, given?: string | null): string {
  /*
   * WHERE A ROLE LANDS, FOR ALL SEVEN RATHER THAN THE ORIGINAL THREE.
   *
   * This was a switch over `Role`, the Phase 0 union, and it returned undefined
   * for a dispatcher, a salesperson, a customer service account and a read only
   * account. The type said that could not happen; the type was the thing being
   * believed, exactly as it was for ROLE_LABEL and for the session cookie.
   *
   * It was invisible until 2026-09-07 because those four roles could not hold a
   * session at all: readOpsSession refused their cookie on the next request, so
   * nobody ever reached the redirect. FIXING THAT UNMASKED THIS. They signed in
   * successfully and were sent to `undefined`.
   *
   * That is worth keeping written down, because it is the honest shape of the
   * morning's work: one stale list was hiding another, and the second only
   * became reachable when the first was repaired.
   *
   * The landing path is a COLUMN, NOT NULL since 0018, precisely so a role
   * created on the permission screen cannot inherit somebody else's home
   * screen. The row wins when the caller has one, DEFAULT_ROLES answers for the
   * seven that ship, and anything else lands on /portal rather than nowhere.
   * Same shape as roleLabel above, for the same reason.
   */
  if (given && given.startsWith("/portal")) return given;
  const declared = DEFAULT_ROLES.find((r) => r.key === role);
  if (declared) return declared.landingPath;
  return "/portal";
}
