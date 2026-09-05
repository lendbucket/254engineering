/**
 * The authorization matrix, asserted twice: once as a table and once over HTTP.
 *
 *   BASE_URL=http://localhost:3225 npx tsx scripts/roles-audit.mjs
 *
 * WHY THE EXPECTATIONS BELOW ARE WRITTEN OUT BY HAND
 * --------------------------------------------------
 * The obvious way to test an authorization module is to loop over its own matrix
 * and assert that can() agrees with it. That passes forever, including on the day
 * somebody adds "ledger.read_all" to field_tech, because the thing being tested
 * and the thing testing it are the same list.
 *
 * So EXPECTED below is a second, independent statement of who may do what,
 * typed out deliberately. When the two disagree, one of them is wrong and a
 * human has to decide which. That friction is the entire value: it is what makes
 * widening a role a decision rather than a diff nobody read.
 *
 * This repo has lost twelve hours to audits that passed while looking at the
 * wrong thing. This one is built so it cannot.
 *
 * PART TWO IS THE PART THAT COULD ACTUALLY BE WRONG
 * -------------------------------------------------
 * A pure matrix proves the policy module is self consistent. It proves nothing
 * about whether the route handlers call it. So part two creates one real account
 * per role, signs each of them in through the real endpoint, and attempts the
 * things they must not be able to do. A technician POSTing to the people
 * endpoint has to come back 403, from the deployed code path, or this fails.
 *
 * The accounts are torn down afterwards and the teardown is VERIFIED, because
 * forms-audit once filled production tables while reporting green and the
 * lesson was that a delete which matched nothing still returned no error.
 *
 * DEVELOPMENT ONLY, WITH NO OVERRIDE
 * ----------------------------------
 * The teardown removes the accounts. It cannot remove the audit trail rows their
 * sign ins produced, because that table refuses deletes by design, so a run
 * against production would permanently seed the firm's regulatory memory with
 * probe events. Ruled development only on 2026-09-02, enforced by
 * neverProduction below rather than by remembering.
 */
import fs from "node:fs";
import { auditClient, describeTarget } from "./lib/db-target.mjs";
import {
  canSetGrants,
  canSetUserRole,
  canDeleteRole,
  keyProblem,
} from "../src/lib/role-rules.ts";
import { can, actionsFor, visibleFiles, canSeeFile, redactFile, ROLES, DEFAULT_ROLES, ALL_ACTIONS, LICENSED_ACTIONS, LICENSED_ROLE, holdsLicence } from "../src/lib/ops-authz.ts";

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// ===========================================================================
// PART 1: the matrix, stated independently.
// ===========================================================================

/**
 * Who may do what, according to this file rather than according to the module.
 *
 * The operator's three rules, written out action by action:
 *   admins see everything;
 *   engineers see files assigned to them and the review queue;
 *   techs see only jobs offered to or accepted by them, and nothing about other
 *   techs or pricing.
 */
/*
 * THE LICENCE BOUND FIVE ARE NOT IN THIS TABLE, AND MUST NOT BE ADDED.
 *
 * protocols.author, protocols.publish, review.queue, review.decide and
 * documents.seal were here until Phase 10 Section 2. They are no longer
 * grantable actions at all: can() cannot be handed one, the type system refuses
 * it, and scripts/proofs asserts that refusal at compile time.
 *
 * They are checked below instead, by asking holdsLicence of every role rather
 * than of the two somebody would guess, and by asserting that no default role
 * grants one. Putting them back here would be asking can() a question it no
 * longer answers, and the answer would be a permanent false.
 */
const EXPECTED = {
  "profiles.list":                { admin: true,  engineer: false, field_tech: false },
  "profiles.create":              { admin: true,  engineer: false, field_tech: false },
  "profiles.update":              { admin: true,  engineer: false, field_tech: false },
  "profiles.suspend":             { admin: true,  engineer: false, field_tech: false },
  "profiles.force_reset":         { admin: true,  engineer: false, field_tech: false },
  "profiles.read_self":           { admin: true,  engineer: true,  field_tech: true },
  "profiles.update_self":         { admin: true,  engineer: true,  field_tech: true },

  "clients.list":                 { admin: true,  engineer: true,  field_tech: false },
  "clients.create":               { admin: true,  engineer: false, field_tech: false },
  "clients.update":               { admin: true,  engineer: false, field_tech: false },

  "files.list":                   { admin: true,  engineer: true,  field_tech: true },
  "files.create":                 { admin: true,  engineer: false, field_tech: false },
  "files.update":                 { admin: true,  engineer: true,  field_tech: false },
  "files.assign":                 { admin: true,  engineer: false, field_tech: false },
  "files.transition":             { admin: true,  engineer: true,  field_tech: false },
  "files.cancel":                 { admin: true,  engineer: false, field_tech: false },

  "offers.list_own":              { admin: true,  engineer: false, field_tech: true },
  "offers.respond":               { admin: true,  engineer: false, field_tech: true },
  "offers.dispatch":              { admin: true,  engineer: false, field_tech: false },
  "evidence.capture":             { admin: false, engineer: false, field_tech: true },
  // Moving a file INTO and OUT OF capture. All three, and for a reason each:
  // a tech starts and finishes their own job, an engineer sends one back for
  // revision, an admin does both on somebody's behalf. What a tech still cannot
  // do is pull a file out of review, because that destination is reached under
  // review.decide rather than evidence.submit. See actionFor in ops-files.ts.
  "evidence.start":               { admin: true,  engineer: true,  field_tech: true },
  "evidence.submit":              { admin: true,  engineer: true,  field_tech: true },
  "evidence.review":              { admin: true,  engineer: true,  field_tech: false },

  "documents.deliver":            { admin: true,  engineer: true,  field_tech: false },

  /*
   * A deliverable and its supporting record. An engineer is handed any file in
   * the queue, so a document they cannot open is one they will be asked about
   * and cannot read. A technician gets neither: their evidence reaches them on
   * the job screen, and the document centre is where sealed work and firm
   * papers live.
   */
  "documents.read":               { admin: true,  engineer: true,  field_tech: false },

  /*
   * pricing.read is what a file is worth. billing.read is what the firm makes,
   * across every file, including what each technician costs.
   *
   * They are deliberately separate. An engineer sees the first because they are
   * paid production against a tier and a number they cannot see is one they
   * cannot check. The second is the firm's own margin and belongs to the
   * operator alone.
   */
  "pricing.read":                 { admin: true,  engineer: true,  field_tech: false },
  "billing.read":                 { admin: true,  engineer: false, field_tech: false },
  "ledger.read_own":              { admin: true,  engineer: true,  field_tech: true },
  "ledger.read_all":              { admin: true,  engineer: false, field_tech: false },
  "ledger.approve":               { admin: true,  engineer: false, field_tech: false },

  /*
   * Reconciliation asks Stripe what really happened and can record a payment
   * the platform missed, which releases the work and issues the customer their
   * link. That is the operator's decision to take, not an engineer's, and a
   * technician has no business knowing an order exists before it is dispatched.
   */
  "payments.reconcile":           { admin: true,  engineer: false, field_tech: false },

  /*
   * Cancelling a paid order and refunding it in full. Admin alone, and an
   * engineer is excluded on purpose rather than by omission: the whole reason
   * this case exists separately from review.decide is that a commercial
   * withdrawal must never be reachable from the screen where somebody is
   * deciding whether to seal a document.
   */
  "payments.refund":              { admin: true,  engineer: false, field_tech: false },

  /*
   * Raising money against a job the customer did not place: a payment link, or
   * an invoice to an account with terms. Admin only, like the two above.
   *
   * An engineer must never hold it. The refund rules exist so that no financial
   * consequence bears on a sealing decision, and an engineer who could charge
   * for the job they are reviewing would be the same conflict from the other
   * side. A technician is an independent contractor and has no business
   * touching what the client pays at all.
   */
  "payments.charge":              { admin: true,  engineer: false, field_tech: false },

  /*
   * Customer ordering accounts: credit terms, closing a period, issuing a
   * statement. The firm deciding who may owe it money, which is the operator
   * alone. An engineer has no more business here than in the ledger.
   */
  /*
   * The permission that governs the permission screen. Administrator only by
   * default, and the lockout guard counts whoever holds it rather than counting
   * administrators, because the owner may create another role that has it.
   */
  "roles.manage":                 { admin: true,  engineer: false, field_tech: false },

  "accounts.manage":              { admin: true,  engineer: false, field_tech: false },

  /*
   * The job queue. Retrying a dead job re-runs a side effect: it can send an
   * email a customer already received, or push money adjacent work forward.
   * That is the operator alone, for the same reason reconciliation is.
   */
  "jobs.manage":                  { admin: true,  engineer: false, field_tech: false },

  /*
   * Everybody. A task list and a conversation are not privileges; a platform
   * where a technician cannot write down their own next action is one where
   * they keep a separate list beside it, and a platform where they cannot ask a
   * question is one where the question goes unasked.
   */
  "tasks.use":                    { admin: true,  engineer: true,  field_tech: true },
  "messages.use":                 { admin: true,  engineer: true,  field_tech: true },

  "audit.read":                   { admin: true,  engineer: false, field_tech: false },
  "time.log_own":                 { admin: true,  engineer: true,  field_tech: false },
  "responsible_charge.read_own":  { admin: true,  engineer: true,  field_tech: false },
  "responsible_charge.read_all":  { admin: true,  engineer: false, field_tech: false },
};

/*
 * An actor carries its GRANTS since Phase 10 Section 2. Built from actionsFor,
 * the shipped default for that role, so this audit tests what the platform
 * seeds rather than a set invented here.
 */
const active = (role) => ({
  id: `${role}-1`,
  role,
  status: "active",
  grants: new Set(actionsFor(role)),
});

let matrixFailures = 0;
for (const [action, expectations] of Object.entries(EXPECTED)) {
  for (const role of ROLES) {
    const expected = expectations[role];
    const actual = can(active(role), action);
    if (expected !== actual) {
      matrixFailures++;
      rec(`${role} may ${action}`, false, `expected ${expected}, module says ${actual}`);
    }
  }
}
rec(
  `authorization matrix agrees with the independent expectation (${Object.keys(EXPECTED).length} actions x ${ROLES.length} roles)`,
  matrixFailures === 0,
  matrixFailures ? `${matrixFailures} disagreements` : "",
);

// Every action the module knows must appear in EXPECTED, or the table is stale
// and a new capability slipped in unreviewed.
const declared = new Set(Object.keys(EXPECTED));
const known = new Set(ROLES.flatMap((r) => actionsFor(r)));
const missing = [...known].filter((a) => !declared.has(a));
rec(
  "every action the module grants is listed in this audit's expectation table",
  missing.length === 0,
  missing.join(", "),
);

// =====================================================================
// EVERY ROLE AGAINST EVERY ACTION, JUDGED BY POLICY RATHER THAN BY A COPY
//
// Phase 10 Section 2. Seven roles and 41 grantable actions is 287 pairs, and
// the obvious audit is a 287 cell table of booleans. That table would be me
// writing the same grants twice: DEFAULT_ROLES says what a role holds, and a
// hand copied expectation of DEFAULT_ROLES agrees with it by construction,
// including when both are wrong.
//
// So every pair is enumerated and each is judged against a RULE the firm
// actually holds. A rule can be violated by a wrong grant, which a copy cannot.
// The three original roles keep their hand written table above, because that
// one was written independently and predates the grants it checks.
// =====================================================================
{
  const ALL_ROLES = DEFAULT_ROLES.map((r) => r.key);
  const grantsOf = (key) => new Set(DEFAULT_ROLES.find((r) => r.key === key)?.grants ?? []);

  let pairs = 0;
  const broken = [];

  /**
   * The rules, each one a sentence the operator would recognise.
   *
   * Returns a reason when the pair is wrong, null when it is fine.
   */
  const RULES = [
    {
      why: "only an administrator may move money",
      check: (role, action) =>
        /^payments\./.test(action) && role !== "admin"
          ? "a role other than the administrator may charge, refund or reconcile"
          : null,
    },
    {
      why: "only an administrator may decide who owes the firm money",
      check: (role, action) =>
        action === "accounts.manage" && role !== "admin" ? "a role other than the administrator manages accounts" : null,
    },
    {
      /*
       * THE MARGIN RULE. A field technician is an independent contractor paid a
       * flat rate, and one who can see the spread is a negotiation the firm did
       * not intend. A salesperson seeing it is negotiating against the firm's
       * own costs.
       */
      why: "costs and margin are for the operator, the engineer, and whoever is evaluating the business",
      check: (role, action) =>
        action === "pricing.read" && !["admin", "engineer", "read_only"].includes(role)
          ? "a role that should not see cost or margin holds pricing.read"
          : null,
    },
    {
      why: "a technician sees their own work and nothing about anybody else's",
      check: (role, action) =>
        role === "field_tech" &&
        /*
         * The profiles alternation is ANCHORED with $. Unanchored, "update"
         * matched "profiles.update_self", and the rule reported a technician
         * updating their own profile as reaching beyond their own work. Caught
         * by the rule firing on a grant that was correct, which is the useful
         * direction for a rule to be wrong in.
         */
        /^(clients\.|accounts\.|audit\.|billing\.|payments\.|pricing\.|responsible_charge\.read_all|ledger\.read_all|profiles\.(list|create|update|suspend|force_reset)$)/.test(action)
          ? "the technician role reaches beyond their own work"
          : null,
    },
    {
      why: "a read only role writes nothing",
      check: (role, action) =>
        role === "read_only" &&
        /\.(create|update|suspend|force_reset|assign|transition|cancel|dispatch|respond|capture|start|submit|review|approve|charge|refund|reconcile|manage|use|deliver|log_own)$/.test(action) &&
        action !== "profiles.update_self"
          ? "the read only role holds something that writes"
          : null,
    },
    {
      why: "everybody can see and update their own profile",
      check: (role, action) =>
        ["profiles.read_self", "profiles.update_self"].includes(action) && !grantsOf(role).has(action)
          ? "a role cannot see or update its own profile"
          : null,
    },
    {
      why: "nobody but the operator reads the whole audit trail, except somebody evaluating the business",
      check: (role, action) =>
        action === "audit.read" && !["admin", "read_only"].includes(role)
          ? "a role other than the administrator or read only holds audit.read"
          : null,
    },
  ];

  for (const role of ALL_ROLES) {
    const held = grantsOf(role);
    for (const action of ALL_ACTIONS) {
      pairs += 1;
      const has = held.has(action);
      for (const rule of RULES) {
        /*
         * A rule about what a role must NOT hold only fires when it holds it. A
         * rule about what it MUST hold is written to fire on absence, and reads
         * the grants itself, which is why both kinds are asked either way.
         */
        const complaint = rule.check(role, action);
        if (!complaint) continue;
        const isMustHave = /cannot see or update/.test(complaint);
        if (isMustHave || has) broken.push(`${role}/${action}: ${complaint}`);
      }
    }
  }

  rec(
    `every role was checked against every action (${ALL_ROLES.length} roles x ${ALL_ACTIONS.length} actions)`,
    pairs === ALL_ROLES.length * ALL_ACTIONS.length,
    `${pairs} pairs`,
  );
  rec(
    "and no grant breaks a rule the firm holds",
    broken.length === 0,
    broken.length ? broken.slice(0, 4).join(" | ") : `${RULES.length} rules`,
  );

  /*
   * THE LICENCE, ASSERTED FROM OUTSIDE THE TYPE SYSTEM.
   *
   * The compiler already makes a licensed action ungrantable, and
   * scripts/proofs asserts that. This asks the same question of the DATA, in
   * case a grant row ever arrives from somewhere the compiler did not see: a
   * migration, a seed, an owner editing a role through the screen.
   */
  const licensedGranted = [];
  for (const role of DEFAULT_ROLES) {
    for (const action of role.grants) {
      if (LICENSED_ACTIONS.includes(action)) licensedGranted.push(`${role.key}/${action}`);
    }
  }
  rec(
    "no default role grants a licence bound capability",
    licensedGranted.length === 0,
    licensedGranted.length ? licensedGranted.join(", ") : `${LICENSED_ACTIONS.length} are ungrantable`,
  );

  /*
   * And holdsLicence answers for the engineer alone, asked of every role rather
   * than of the two that would be guessed.
   */
  const wrongLicence = [];
  for (const role of ALL_ROLES) {
    for (const action of LICENSED_ACTIONS) {
      const held = holdsLicence({ role, status: "active" }, action);
      const shouldHold = role === "engineer";
      if (held !== shouldHold) wrongLicence.push(`${role}/${action} ${held ? "held" : "refused"}`);
    }
  }
  rec(
    `the licence answers for the engineer alone (${ALL_ROLES.length} roles x ${LICENSED_ACTIONS.length})`,
    wrongLicence.length === 0,
    wrongLicence.length ? wrongLicence.join(", ") : "",
  );

  rec(
    "a suspended engineer holds no licence",
    LICENSED_ACTIONS.every((a) => !holdsLicence({ role: "engineer", status: "suspended" }, a)),
    "suspension has to close the licence too, or suspending a PE is cosmetic",
  );

  /*
   * Every role has somewhere to land, and it is a real portal route. NOT NULL
   * in the schema; this is the other half, that the value means something.
   */
  const badLanding = DEFAULT_ROLES.filter((r) => !r.landingPath || !r.landingPath.startsWith("/portal"));
  rec(
    "every role lands somewhere inside the portal",
    badLanding.length === 0,
    badLanding.map((r) => `${r.key}: ${r.landingPath}`).join(", "),
  );

  const systemKeys = DEFAULT_ROLES.filter((r) => r.isSystem).map((r) => r.key).sort();
  rec(
    "the three original roles are system roles and cannot be deleted",
    systemKeys.join(",") === "admin,engineer,field_tech",
    systemKeys.join(", "),
  );
  rec(
    "and the engineer key is one of them, because the licence compares against it",
    DEFAULT_ROLES.find((r) => r.key === LICENSED_ROLE)?.isSystem === true,
    "renaming it would quietly detach the licence from the people holding it",
  );
}

/*
 * THE MIGRATION SEEDS WHAT DEFAULT_ROLES SAYS, AND THAT IS DERIVED.
 *
 * This check exists because its absence cost the firm the permission screen.
 * 0018 seeded the administrator role without roles.manage while DEFAULT_ROLES
 * granted it, and development agreed with the TypeScript only because the row
 * had been inserted there by hand. Applying the migration to production would
 * have produced a firm that could not open the roles screen and could not
 * grant itself the ability to, because granting it is what the screen does.
 *
 * Nothing compared the two, so nothing was red. The expectation below is
 * COMPUTED from DEFAULT_ROLES rather than written out, because a hand copied
 * list of forty grants is a second thing to keep in step and would have been
 * copied from the migration in the first place.
 */
{
  const sql = fs.readFileSync("supabase/migrations/0018_roles_as_data.sql", "utf8");

  const between = (start, end) => {
    const a = sql.indexOf(start);
    const b = sql.indexOf(end, a);
    return a < 0 || b < 0 ? "" : sql.slice(a + start.length, b);
  };

  const rolesBlock = between("insert into eng_roles (key, name, landing_path, is_system) values", "on conflict (key) do nothing;");
  const grantsBlock = between("insert into eng_role_grants (role_key, action) values", "on conflict (role_key, action) do nothing;");

  rec("the migration's seed blocks were found", rolesBlock.length > 0 && grantsBlock.length > 0);

  const seededRoles = [...rolesBlock.matchAll(/\('([a-z_]+)',\s*'([^']+)',\s*'([^']+)',\s*(true|false)\)/g)].map(
    (m) => ({ key: m[1], name: m[2], landingPath: m[3], isSystem: m[4] === "true" }),
  );
  const seededGrants = [...grantsBlock.matchAll(/\('([a-z_]+)',\s*'([^']+)'\)/g)].map((m) => m[1] + ":" + m[2]);

  const wantRoles = DEFAULT_ROLES.map((r) => r.key).sort();
  const gotRoles = seededRoles.map((r) => r.key).sort();
  rec(
    "the migration seeds exactly the roles DEFAULT_ROLES declares",
    wantRoles.join(",") === gotRoles.join(","),
    gotRoles.join(", "),
  );

  const landingDrift = DEFAULT_ROLES.filter(
    (r) => seededRoles.find((s) => s.key === r.key)?.landingPath !== r.landingPath,
  );
  rec(
    "and each lands where DEFAULT_ROLES says it lands",
    landingDrift.length === 0,
    landingDrift.map((r) => r.key).join(", "),
  );

  const systemDrift = DEFAULT_ROLES.filter(
    (r) => seededRoles.find((s) => s.key === r.key)?.isSystem !== r.isSystem,
  );
  rec(
    "and each is a system role exactly where DEFAULT_ROLES says",
    systemDrift.length === 0,
    systemDrift.map((r) => r.key).join(", "),
  );

  const want = new Set(DEFAULT_ROLES.flatMap((r) => r.grants.map((a) => r.key + ":" + a)));
  const got = new Set(seededGrants);

  const missing = [...want].filter((g) => !got.has(g)).sort();
  const extra = [...got].filter((g) => !want.has(g)).sort();

  rec(
    "every grant DEFAULT_ROLES declares is in the migration",
    missing.length === 0,
    missing.length ? "missing from the migration: " + missing.join(", ") : want.size + " grants",
  );
  rec(
    "and the migration grants nothing DEFAULT_ROLES does not",
    extra.length === 0,
    extra.length ? "in the migration only: " + extra.join(", ") : "",
  );

  /*
   * NAMED SEPARATELY, because it is the one whose absence is unrecoverable.
   * Every other missing grant can be added on the roles screen; this one is
   * the roles screen.
   */
  rec(
    "the administrator is seeded able to manage roles",
    got.has("admin:roles.manage"),
    "without it nobody can open the permission screen, and nobody can grant the permission that opens it",
  );

  /*
   * And no seeded grant may be one of the licensed five. They are not Actions,
   * so ops-authz cannot express one, but a migration is plain text and can.
   */
  const licensedInSeed = seededGrants.filter((g) => LICENSED_ACTIONS.includes(g.split(":")[1]));
  rec(
    "and the migration seeds none of the licensed capabilities",
    licensedInSeed.length === 0,
    licensedInSeed.join(", ") || "a seal is not a row",
  );
}

// =====================================================================
// THE FIRM CANNOT LOCK ITSELF OUT
//
// A permission screen is the one screen that can destroy the firm's access to
// its own platform, and it does it by being used correctly: every individual
// edit looks reasonable and the last one strands everybody.
//
// The rules are pure, in src/lib/role-rules.ts, so these exercise the RULE by
// running it rather than checking that the screen looks careful.
// =====================================================================
{
  const R = (key, grants, isSystem = false) => ({ key, isSystem, grants });
  const H = (id, roleKey, status = "active") => ({ id, roleKey, status });

  const managing = [R("admin", ["roles.manage", "files.list"], true), R("sales", ["files.list"])];

  rec(
    "an ordinary grant change is allowed",
    canSetGrants(managing, [H("a", "admin")], "sales", ["files.list", "clients.list"]).ok,
    "a guard that refuses everything is a wall, not a guard",
  );

  rec(
    "removing the last ability to manage roles is refused",
    !canSetGrants(managing, [H("a", "admin")], "admin", ["files.list"]).ok,
  );
  rec(
    "and the refusal explains what would happen",
    /nobody able to change permissions/.test(
      canSetGrants(managing, [H("a", "admin")], "admin", ["files.list"]).because ?? "",
    ),
  );

  rec(
    "moving the last manager into a role that cannot manage is refused",
    !canSetUserRole(managing, [H("a", "admin")], "a", "sales").ok,
  );

  /*
   * INVITED DOES NOT COUNT. Somebody who has never signed in may never sign in,
   * and counting them would let the firm strand itself and be told it had not.
   */
  rec(
    "an invited administrator does not keep the door open",
    !canSetUserRole(
      managing,
      [H("a", "admin"), H("b", "admin", "invited")],
      "a",
      "sales",
    ).ok,
    "somebody who has never signed in may never sign in",
  );
  rec(
    "and neither does a suspended one",
    !canSetUserRole(
      managing,
      [H("a", "admin"), H("b", "admin", "suspended")],
      "a",
      "sales",
    ).ok,
  );

  /*
   * And the guard is not a wall: a SECOND active manager makes the first
   * removable, which is how an owner legitimately hands over.
   */
  rec(
    "a second active manager makes the move allowed",
    canSetUserRole(managing, [H("a", "admin"), H("b", "admin")], "a", "sales").ok,
    "an owner has to be able to hand over, or the guard has replaced one trap with another",
  );

  /*
   * The rule counts the PERMISSION, not the admin role. An owner may create
   * another role that manages roles, and a rule naming admin would refuse a
   * legitimate arrangement while missing the dangerous one.
   */
  /*
   * NOBODY HOLDS ADMIN IN THIS FIXTURE, and that is the point.
   *
   * The first version had an active admin holder, so a rule that hardcoded
   * "admin" as the managing role passed it. Only ops_lead holds anything here,
   * so the check can only pass if the rule is counting the PERMISSION.
   */
  const twoManaging = [
    R("admin", ["files.list"], true),
    R("ops_lead", ["roles.manage"]),
  ];
  rec(
    "a role other than admin can hold the door open",
    canSetGrants(twoManaging, [H("b", "ops_lead")], "admin", []).ok,
    "the rule counts the permission, not the name of a role",
  );

  // ---- deletion
  /*
   * DELETING A SYSTEM ROLE THAT GRANTS NOTHING AND HOLDS NOBODY.
   *
   * The first version deleted "admin", which would also have stranded the firm,
   * so it passed under an injection that removed the isSystem rule entirely:
   * the strand guard refused it for a different reason. This one can only be
   * refused by the rule being tested.
   */
  const withEngineer = [
    R("admin", ["roles.manage"], true),
    R("engineer", ["files.list"], true),
  ];
  rec(
    "a system role cannot be deleted",
    !canDeleteRole(withEngineer, [H("a", "admin")], "engineer").ok,
    "asked of one whose deletion would strand nobody, so only the system rule can refuse it",
  );
  rec(
    "a role somebody holds cannot be deleted",
    !canDeleteRole(managing, [H("a", "admin"), H("b", "sales")], "sales").ok,
  );
  rec(
    "and one nobody holds can be",
    canDeleteRole(managing, [H("a", "admin")], "sales").ok,
  );

  /*
   * AND THE SERVER ACTUALLY ASKS. The rules above are pure and correct, and a
   * write path that never called them would pass every one of them.
   */
  const opsRoles = fs.readFileSync("src/lib/ops-roles.ts", "utf8");
  rec(
    "the server refuses a grant change through the guard",
    /const verdict = canSetGrants\([\s\S]{0,120}if \(!verdict\.ok\) return/.test(opsRoles),
  );
  rec(
    "and a role move through the guard",
    /const verdict = canSetUserRole\([\s\S]{0,120}if \(!verdict\.ok\) return/.test(opsRoles),
  );
  rec(
    "and a deletion through the guard",
    /const verdict = canDeleteRole\([\s\S]{0,120}if \(!verdict\.ok\) return/.test(opsRoles),
  );
  rec(
    "and it asks BEFORE it writes",
    opsRoles.indexOf("canSetGrants(") < opsRoles.indexOf('.from("eng_role_grants").delete()'),
    "a guard applied after the write is a guard that has already lost",
  );

  // ---- keys
  rec("a key with a space is refused", keyProblem("ops lead", []) !== null);
  rec("a key starting with a digit is refused", keyProblem("2nd_line", []) !== null);
  rec("a duplicate key is refused", keyProblem("sales", ["sales"]) !== null);
  rec("a reasonable key is accepted", keyProblem("ops_lead", ["sales"]) === null);
}

// ---- suspended and signed out ----
for (const role of ROLES) {
  const suspended = { id: "x", role, status: "suspended" };
  const anyAllowed = [...known].some((a) => can(suspended, a));
  rec(`a suspended ${role} may do nothing at all`, !anyAllowed);
}
rec("a signed out actor may do nothing at all", ![...known].some((a) => can(null, a)));

// ---- file scoping ----
{
  const engineer = active("engineer");
  const tech = active("field_tech");

  const mine = { id: "f1", status: "intake", assigned_tech_id: null, assigned_engineer_id: "engineer-1" };
  const queue = { id: "f2", status: "evidence_submitted", assigned_tech_id: null, assigned_engineer_id: "someone-else" };
  const other = { id: "f3", status: "intake", assigned_tech_id: null, assigned_engineer_id: "someone-else" };
  const techJob = { id: "f4", status: "dispatched", assigned_tech_id: "field_tech-1", assigned_engineer_id: null };
  const offered = { id: "f5", status: "needs_dispatch", assigned_tech_id: null, assigned_engineer_id: null, offered_tech_ids: ["field_tech-1"] };
  const notMine = { id: "f6", status: "dispatched", assigned_tech_id: "another-tech", assigned_engineer_id: null };

  rec("engineer sees a file assigned to them", canSeeFile(engineer, mine));
  rec("engineer sees the shared review queue", canSeeFile(engineer, queue));
  rec("engineer does NOT see another engineer's file outside the queue", !canSeeFile(engineer, other));
  rec("tech sees a job assigned to them", canSeeFile(tech, techJob));
  rec("tech sees a job offered to them", canSeeFile(tech, offered));
  rec("tech does NOT see another tech's job", !canSeeFile(tech, notMine));
  rec("admin scope is unrestricted", visibleFiles(active("admin")).kind === "all");
  rec("signed out scope is nothing", visibleFiles(null).kind === "none");
}

// ---- pricing redaction ----
{
  const row = {
    id: "f1",
    property_address: "1 Example St",
    client_price_cents: 45000,
    tech_cost_cents: 12000,
    engineer_cost_cents: 15000,
  };
  const forTech = redactFile(active("field_tech"), row);
  const leaked = ["client_price_cents", "tech_cost_cents", "engineer_cost_cents"].filter((k) => k in forTech);
  rec("a technician receives no pricing fields at all", leaked.length === 0, leaked.join(", "));
  rec("a technician still receives the file itself", forTech.property_address === "1 Example St");
  rec("an engineer keeps pricing", "client_price_cents" in redactFile(active("engineer"), row));
  rec("an admin keeps pricing", "client_price_cents" in redactFile(active("admin"), row));
}

// ===========================================================================
// PART 2: the same rules, over HTTP, against the running app.
// ===========================================================================

const STAMP = Date.now();
const PROBE_DOMAIN = "roles-audit.invalid";
const created = [];

async function makeProbe(db, role) {
  const email = `probe-${role}-${STAMP}@${PROBE_DOMAIN}`;
  const password = `probe-${STAMP}-${role}-Aa1!longenough`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`could not create ${role}: ${error?.message}`);
  const isTech = role === "field_tech";
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id,
    email,
    display_name: `Probe ${role}`,
    role,
    status: "active",
    tdi_appointment: role === "engineer" ? "none" : null,
    certification_status: isTech ? "none" : null,
    coverage_counties: isTech ? [] : [],
  });
  if (pErr) throw new Error(`could not profile ${role}: ${pErr.message}`);
  created.push({ id: data.user.id, email, role, password });
  return { id: data.user.id, email, password };
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/eng_ops=([^;]+)/);
  return { ok: res.ok, cookie: match ? `eng_ops=${match[1]}` : null };
}

/*
 * neverProduction, and it is not a precaution: it is the operator's ruling of
 * 2026-09-02. This audit writes, and what it writes into the audit trail cannot
 * be deleted afterwards. Development only, with no override.
 */
const db = auditClient("roles-audit", { neverProduction: true });

if (!db) {
  rec("live cross role probes ran", false, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing, so the HTTP half was SKIPPED");
} else {
  let sessions = {};
  try {
    for (const role of ROLES) {
      const probe = await makeProbe(db, role);
      const signedIn = await signIn(probe.email, probe.password);
      rec(`probe ${role} can sign in through the real endpoint`, signedIn.ok && Boolean(signedIn.cookie));
      sessions[role] = signedIn.cookie;
    }

    // The forbidden matrix, over HTTP. Each of these must be refused.
    const attempts = [
      {
        role: "field_tech",
        label: "a technician cannot create an account",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.field_tech },
            body: JSON.stringify({ action: "create", role: "admin", displayName: "Escalated", email: `esc-${STAMP}@${PROBE_DOMAIN}` }),
          }),
        expect: 403,
      },
      {
        role: "engineer",
        label: "an engineer cannot create an account",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.engineer },
            body: JSON.stringify({ action: "create", role: "admin", displayName: "Escalated", email: `esc2-${STAMP}@${PROBE_DOMAIN}` }),
          }),
        expect: 403,
      },
      {
        role: "field_tech",
        label: "a technician cannot suspend anybody",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.field_tech },
            body: JSON.stringify({ action: "suspend", profileId: created[0]?.id }),
          }),
        expect: 403,
      },
      {
        role: "engineer",
        label: "an engineer cannot force a password reset",
        req: () =>
          fetch(`${BASE}/api/portal/people`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: sessions.engineer },
            body: JSON.stringify({ action: "force_reset", profileId: created[0]?.id }),
          }),
        expect: 403,
      },
    ];

    for (const attempt of attempts) {
      const res = await attempt.req();
      rec(attempt.label, res.status === attempt.expect, `HTTP ${res.status}, expected ${attempt.expect}`);
    }

    // Pages a role must not reach return 404, not a 403 that confirms the route.
    const pageProbes = [
      { role: "field_tech", path: "/portal/people" },
      { role: "field_tech", path: "/portal/audit" },
      { role: "engineer", path: "/portal/people" },
      { role: "engineer", path: "/portal/audit" },
    ];
    for (const probe of pageProbes) {
      const res = await fetch(`${BASE}${probe.path}`, { headers: { cookie: sessions[probe.role] }, redirect: "manual" });
      rec(
        `${probe.role} gets 404 on ${probe.path} rather than a page`,
        res.status === 404,
        `HTTP ${res.status}`,
      );
    }

    // And the pages they SHOULD reach must actually work, or the audit is only
    // proving that everything is broken.
    const allowed = [
      { role: "field_tech", path: "/portal/jobs" },
      { role: "engineer", path: "/portal/review" },
      { role: "admin", path: "/portal/people" },
      { role: "admin", path: "/portal/audit" },
    ];
    for (const probe of allowed) {
      const res = await fetch(`${BASE}${probe.path}`, { headers: { cookie: sessions[probe.role] }, redirect: "manual" });
      rec(`${probe.role} can open ${probe.path}`, res.status === 200, `HTTP ${res.status}`);
    }

    // A suspended account loses access immediately, not when the cookie expires.
    {
      const tech = created.find((c) => c.role === "field_tech");
      await db.from("eng_profiles").update({ status: "suspended" }).eq("id", tech.id);
      const res = await fetch(`${BASE}/portal/jobs`, { headers: { cookie: sessions.field_tech }, redirect: "manual" });
      rec(
        "a suspension takes effect on the next request, with the old cookie still held",
        res.status !== 200,
        `HTTP ${res.status}`,
      );
      await db.from("eng_profiles").update({ status: "active" }).eq("id", tech.id);
    }

    // The trail recorded the sign ins. A writer that has quietly stopped is the
    // failure this check exists to catch.
    {
      const { data: events } = await db
        .from("eng_audit_events")
        .select("id, action, actor_email")
        .eq("action", "auth.sign_in")
        .in("actor_email", created.map((c) => c.email));
      rec(
        "every probe sign in was recorded in the audit trail",
        (events?.length ?? 0) >= ROLES.length,
        `${events?.length ?? 0} of ${ROLES.length}`,
      );
    }
  } catch (err) {
    rec("live cross role probes ran", false, String(err.message).slice(0, 160));
  } finally {
    // ---- teardown, and it is verified ----
    for (const c of created) {
      await db.from("eng_profiles").delete().eq("id", c.id);
      await db.auth.admin.deleteUser(c.id).catch(() => {});
    }
    const { data: survivors } = await db
      .from("eng_profiles")
      .select("id, email")
      .like("email", `%@${PROBE_DOMAIN}`);
    rec(
      "probe accounts were removed",
      (survivors?.length ?? 0) === 0,
      survivors?.length ? `${survivors.length} left behind: ${survivors.map((s) => s.email).join(", ")}` : "",
    );
  }
}

// ===========================================================================

console.log("================ ROLES AUDIT ================");
console.log(`${BASE}, matrix asserted against an independent table, then over HTTP`);
console.log(`database: ${describeTarget(process.env.SUPABASE_URL)}\n`);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Every role can do what it should and nothing it should not.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
