// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees, so this line and the
// invocation cannot drift apart.
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
import { readSource } from "./lib/read-source.mjs";
import { auditClient, describeTarget } from "./lib/db-target.mjs";
import {
  canSetGrants,
  canSetUserRole,
  canDeleteRole,
  keyProblem,
} from "../src/lib/role-rules.ts";
import { can, actionsFor, visibleFiles, canSeeFile, redactFile, ROLES, DEFAULT_ROLES, ALL_ACTIONS, LICENSED_ACTIONS, LICENSED_ROLE, holdsLicence, roleLabel, inviteFieldsFor } from "../src/lib/ops-authz.ts";
import { canReview } from "../src/lib/ops-review.ts";
import { signInFully } from "./lib/probe-mfa.mjs";

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
   * Who may use the firm name to win work, what the firm owes somebody outside
   * it, and the record that money left. Admin alone, and an engineer holding a
   * licence is not an administrator.
   */
  "partners.manage":              { admin: true,  engineer: false, field_tech: false },

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

  /* Reports. The engineer reads the one about their own work and nothing else:
   * a licence is not a reason to see what the firm earns. */
  "reports.revenue":              { admin: true,  engineer: false, field_tech: false },
  "reports.production":           { admin: true,  engineer: true,  field_tech: false },
  "reports.pipeline":             { admin: true,  engineer: false, field_tech: false },
  "reports.partner":              { admin: true,  engineer: false, field_tech: false },

  /* The do not contact list. Deciding whether the firm may write to a person is
   * a customer relationship decision rather than an engineering or a field one,
   * and it is held by customer service, which is the role the request actually
   * arrives at. None of the three roles this table covers holds it: an engineer
   * has a licence, not a say in the firm's marketing. */
  "suppressions.manage":          { admin: true,  engineer: false, field_tech: false },

  /* The one permission in this platform that destroys a record. Admin alone,
   * and the two falses matter more here than anywhere else in this table: a
   * licence is not a reason to be able to delete, and neither is being the
   * person whose work the rows describe. */
  "retention.execute":            { admin: true,  engineer: false, field_tech: false },
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
      why: "only an administrator may run the referral programme",
      check: (role, action) =>
        action === "partners.manage" && role !== "admin"
          ? "a role other than the administrator manages partners"
          : null,
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
  /*
   * EVERY MIGRATION IN THE CHAIN, NOT 0018 ALONE.
   *
   * 0018 was the only file that seeded a role for one phase, so reading it
   * directly was correct and stopped being correct the moment 0021 added
   * partners.manage. Editing 0018 was never an option: it has run against
   * production, and a migration that changes after it has run is a migration
   * nobody can reason about.
   *
   * What the check is actually about is whether the DECLARATION is seeded
   * somewhere in the chain, which is what this now reads. A grant added in a
   * later migration is the ordinary way this schema grows.
   */
  const migrationFiles = fs
    .readdirSync("supabase/migrations")
    .filter((f) => /\.sql$/.test(f))
    .sort();

  const sql = migrationFiles
    .map((f) => readSource(`supabase/migrations/${f}`))
    .join("\n");

  /*
   * All of them, because a chain can seed in more than one place. The first
   * version took the FIRST block and would have read 0018 and stopped, which
   * is the same defect one level up.
   */
  const blocks = (start, end) => {
    const out = [];
    let from = 0;
    for (;;) {
      const a = sql.indexOf(start, from);
      if (a < 0) break;
      const b = sql.indexOf(end, a);
      if (b < 0) break;
      out.push(sql.slice(a + start.length, b));
      from = b + end.length;
    }
    return out.join("\n");
  };

  const rolesBlock = blocks("insert into eng_roles (key, name, landing_path, is_system) values", "on conflict (key) do nothing;");
  const grantsBlock = blocks("insert into eng_role_grants (role_key, action) values", "on conflict (role_key, action) do nothing;");

  rec("the migration chain's seed blocks were found", rolesBlock.length > 0 && grantsBlock.length > 0);
  rec(
    "and more than one migration seeds grants, which is why the chain is read",
    (sql.match(/insert into eng_role_grants/g) ?? []).length >= 2,
    "if this ever drops back to one, reading a single file would be correct again and this comment is why it is not",
  );

  const seededRoles = [...rolesBlock.matchAll(/\('([a-z_]+)',\s*'([^']+)',\s*'([^']+)',\s*(true|false)\)/g)].map(
    (m) => ({ key: m[1], name: m[2], landingPath: m[3], isSystem: m[4] === "true" }),
  );
  const inserted = [...grantsBlock.matchAll(/\('([a-z_]+)',\s*'([^']+)'\)/g)].map((m) => m[1] + ":" + m[2]);

  /*
   * A GRANT CAN BE REMOVED, AND THE CHAIN'S NET EFFECT IS WHAT A DATABASE HOLDS.
   *
   * This read only INSERTS, so when 0040 deleted files.assign it reported the
   * grant as existing "in the migration only". That was true of one statement
   * and false of the chain: 0018 seeds it, 0040 removes it, and what a fresh
   * database ends up holding is nothing.
   *
   * It is the same lesson 0021 taught this file, one operation further along.
   * It used to read 0018 alone and had to learn that a LATER migration can add
   * a grant; now it has to know that a later one can take one away.
   *
   * A migration is never edited to make this pass. 0018 stays exactly as it
   * ran, because a migration that changes after it has run is one nobody can
   * reason about. The removal is a new statement and this reads both.
   */
  const removed = [
    ...sql.matchAll(/delete\s+from\s+eng_role_grants\s+where\s+action\s*=\s*'([^']+)'/gi),
  ].map((m) => m[1]);

  rec(
    `the chain's grant removals are read as well as its inserts (${removed.length})`,
    true,
    removed.length
      ? removed.join(", ")
      : "none yet; when one arrives this is the check that notices it",
  );

  const seededGrants = inserted.filter((g) => !removed.includes(g.split(":")[1]));

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

  /*
   * COUNTED BEFORE THEY ARE SET, because a set cannot see a repeat.
   *
   * DEFAULT_ROLES.admin was [...MATRIX.admin, "roles.manage"] while
   * MATRIX.admin already held roles.manage, so the generator emitted the row
   * twice and the migration carried it twice. Every check here passed, because
   * every check here compared sets, and a set of one is a set of two. Only the
   * ON CONFLICT clause stopped it being an error.
   *
   * So duplicates are asserted on both sides: in the declaration, and in the
   * file the declaration generates.
   */
  const declared = DEFAULT_ROLES.flatMap((r) => r.grants.map((a) => r.key + ":" + a));
  const declaredTwice = declared.filter((g, i) => declared.indexOf(g) !== i);
  rec(
    "no role declares the same grant twice",
    declaredTwice.length === 0,
    [...new Set(declaredTwice)].join(", ") || declared.length + " grants declared",
  );

  const seededTwice = seededGrants.filter((g, i) => seededGrants.indexOf(g) !== i);
  rec(
    "and the migration inserts no row twice",
    seededTwice.length === 0,
    [...new Set(seededTwice)].join(", ") || seededGrants.length + " rows",
  );

  const want = new Set(declared);
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
  const opsRoles = readSource("src/lib/ops-roles.ts");
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

/* ---- EVERY SHIPPED ROLE GETS A REAL ANSWER FROM EVERY FUNCTION ----
 *
 * One assertion over a property, rather than six assertions about six
 * functions. On 2026-09-07 a sweep found six live instances of a single defect,
 * each a total function over the Phase 0 union that stopped being total when
 * 0018 made roles rows: the label, the session reader, the account creation
 * route, the landing path, the invitation email and the dashboard.
 *
 * They were found separately and fixed separately. This is the check that would
 * have caught all six at once. The registry is scripts/lib/role-total-functions
 * and adding a function that takes a role means adding it there, for the same
 * reason the surface inventory exists: the denominator cannot be a memory.
 */
{
  const { ROLE_TOTAL_FUNCTIONS } = await import("./lib/role-total-functions.mjs");

  rec(
    `there are role taking functions to check (${ROLE_TOTAL_FUNCTIONS.length})`,
    ROLE_TOTAL_FUNCTIONS.length > 0,
    "a check over an empty registry passes forever",
  );

  let pairs = 0;
  const broken = [];

  for (const fn of ROLE_TOTAL_FUNCTIONS) {
    for (const role of DEFAULT_ROLES) {
      pairs += 1;
      let problem;
      try {
        problem = fn.real(await fn.call(role), role);
      } catch (err) {
        problem = `it threw: ${err instanceof Error ? err.message : String(err)}`;
      }
      if (problem) broken.push(`${fn.name}(${role.key}): ${problem}`);
    }
  }

  rec(
    `every shipped role gets a real answer from every function that takes one (${pairs} pairs)`,
    broken.length === 0,
    broken.length ? broken.join(" | ") : `${ROLE_TOTAL_FUNCTIONS.length} functions x ${DEFAULT_ROLES.length} roles`,
  );

  rec(
    "and the check covered every role and every function",
    pairs === ROLE_TOTAL_FUNCTIONS.length * DEFAULT_ROLES.length,
    `${pairs} of ${ROLE_TOTAL_FUNCTIONS.length * DEFAULT_ROLES.length}`,
  );
}

/* ---- the session survives every role, and still refuses a forgery ----
 *
 * PURE, so it fails without a server. The live half below proves the same thing
 * end to end and only when one is running, and on 2026-09-07 there was a whole
 * class of role for which neither half was looking.
 *
 * The claim is a round trip: what issueOpsSession mints, readOpsSession reads.
 * Those are the two ends of the sign in, and they disagreed for four of the
 * seven roles the platform ships, which is not a thing a matrix of permissions
 * can see. Somebody who cannot hold a session has no permissions to check.
 */
{
  const HAD_SECRET = process.env.OPS_SESSION_SECRET;
  process.env.OPS_SESSION_SECRET = "roles-audit-fixture-secret-long-enough-to-pass";

  const { issueOpsSession, readOpsSession, readPendingSession } = await import("../src/lib/ops-session.ts");
  const SUB = "00000000-0000-0000-0000-000000000001";

  let survived = 0;
  for (const role of DEFAULT_ROLES) {
    const minted = issueOpsSession(SUB, role.key);
    const read = minted ? readOpsSession(minted.value) : null;
    if (read && read.role === role.key) survived += 1;
    rec(
      `a ${role.key} session survives its own round trip`,
      Boolean(read) && read?.role === role.key,
      minted ? "" : "it could not even be minted",
    );
  }
  rec(
    `every shipped role can hold a session (${survived} of ${DEFAULT_ROLES.length})`,
    survived === DEFAULT_ROLES.length,
    "a role that cannot hold a session signs in successfully and is signed out by the next request",
  );

  /*
   * And the other direction, because a check that only ever says yes is not
   * measuring anything. The cookie is sub.role.exp.signature split on the dot,
   * so a role segment carrying one would produce a cookie nobody can parse:
   * minting refuses it rather than issuing something the reader will reject.
   */
  rec("a role key with a dot is never minted", issueOpsSession(SUB, "ad.min") === null);
  rec("nor is one with a capital", issueOpsSession(SUB, "Admin") === null);
  rec("nor one that is too short", issueOpsSession(SUB, "aa") === null);
  rec("but an owner created key still works", issueOpsSession(SUB, "field_auditor") !== null);

  /*
   * The cookie is sub.role.factor.exp.signature since Phase 12 Section 1, five
   * segments rather than four. These forgeries are rebuilt around the new shape
   * rather than deleted, because what they prove has not changed: editing any
   * claim invalidates the signature.
   */
  const fixture = issueOpsSession(SUB, "dispatcher");
  const parts = (fixture?.value ?? "").split(".");
  rec("a minted cookie carries five segments", parts.length === 5, `${parts.length}`);

  const forge = (role) => `${parts[0]}.${role}.${parts[2]}.${parts[3]}.${parts[4]}`;
  rec(
    "a role edited in the cookie is refused, signature and all",
    readOpsSession(forge("admin")) === null,
    "widening the role check must not widen the door",
  );
  rec(
    "and so is a well formed role nobody signed",
    readOpsSession(forge("field_auditor")) === null,
  );

  /*
   * THE DOWNGRADE, WHICH IS THE NEW ONE WORTH HAVING.
   *
   * A four segment cookie is the pre MFA shape. Reading it as a session would
   * mean an attacker could strip the factor field and be treated as fully
   * authenticated, so it is refused outright rather than assumed to be legacy.
   */
  rec(
    "a pre MFA four segment cookie is refused rather than trusted",
    readOpsSession(`${parts[0]}.${parts[1]}.${parts[3]}.${parts[4]}`) === null,
    "stripping the factor must not be a way past it",
  );

  /*
   * AND A PENDING SESSION IS NOT A SESSION, which is the whole boundary.
   */
  const pending = issueOpsSession(SUB, "admin", "pending");
  rec("a pending session can be minted", pending !== null);
  rec(
    "but readOpsSession refuses it, exactly like a forgery",
    pending ? readOpsSession(pending.value) === null : false,
    "every existing caller inherits the enforcement without knowing about it",
  );
  rec(
    "and readPendingSession is the only thing that sees it",
    pending ? readPendingSession(pending.value)?.factor === "pending" : false,
  );
  const full = issueOpsSession(SUB, "admin", "full");
  rec(
    "while readPendingSession refuses a full one",
    full ? readPendingSession(full.value) === null : false,
    "the two readers do not overlap",
  );
  rec(
    "a factor nobody signed is refused",
    readOpsSession(`${parts[0]}.${parts[1]}.elevated.${parts[3]}.${parts[4]}`) === null,
  );

  if (HAD_SECRET === undefined) delete process.env.OPS_SESSION_SECRET;
  else process.env.OPS_SESSION_SECRET = HAD_SECRET;
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

/*
 * SIGN IN, AND COMPLETE A SECOND FACTOR IF THE ROLE DEMANDS ONE.
 *
 * This was a bare POST to the session endpoint, which was enough until 0024
 * seeded admin and engineer as requiring a factor. From that point those two
 * probes received a PENDING session and every later check in this file failed
 * with "the cookie was minted and then refused", which is precisely what the
 * boundary is supposed to do and precisely what this helper has to get past
 * the way a person does.
 *
 * signInFully is shared with the browser probes so the two sign in paths in
 * this repository cannot disagree about what a session is.
 */
async function signIn(email, password) {
  const result = await signInFully(BASE, email, password);
  return {
    ok: result.ok,
    cookie: result.cookie ? `eng_ops=${result.cookie}` : null,
    enrolled: result.enrolled,
    error: result.error,
  };
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
    /*
     * EVERY ROLE THE PLATFORM SHIPS, NOT THE THREE IT SHIPPED IN PHASE 0.
     *
     * This loop read ROLES until 2026-09-07, while the pure half of this same
     * file read DEFAULT_ROLES. Seven roles were being reasoned about and three
     * were being signed in, and the four in the gap were exactly the four that
     * could not hold a session: ops-session.ts validated the cookie's role
     * against the same stale union, so a dispatcher, a salesperson, a customer
     * service account and a read only account signed in successfully and were
     * signed out by their own next request.
     *
     * The audit was looking at the right thing in the wrong list, which is the
     * defect this repository keeps finding one level up from wherever it looks.
     */
    const LIVE_ROLES = DEFAULT_ROLES.map((r) => r.key);
    rec(
      `the live probes cover every role the platform ships (${LIVE_ROLES.length})`,
      LIVE_ROLES.length === DEFAULT_ROLES.length && LIVE_ROLES.length > ROLES.length,
      "a live half narrower than the pure half is how four roles went unmeasured",
    );

    for (const role of LIVE_ROLES) {
      const probe = await makeProbe(db, role);
      const signedIn = await signIn(probe.email, probe.password);
      rec(
        `probe ${role} can sign in through the real endpoint`,
        signedIn.ok && Boolean(signedIn.cookie),
        signedIn.error ?? "",
      );
      sessions[role] = signedIn.cookie;

      /*
       * The two roles 0024 seeds as requiring a factor must have gone through a
       * REAL enrolment to be here. If either arrived without enrolling, the
       * requirement is not in force and this file would be reporting on a
       * portal that no longer matches the migration.
       */
      const mustEnrol = role === "admin" || role === "engineer";
      rec(
        `and ${role} ${mustEnrol ? "completed a real second factor enrolment" : "needed no second factor"}`,
        mustEnrol ? signedIn.enrolled === true : true,
        mustEnrol && !signedIn.enrolled
          ? "0024 requires one for this role, so arriving without enrolling means the requirement is not in force"
          : "",
      );

      /*
       * AND THE SESSION SURVIVES THE NEXT REQUEST, WHICH IS A SEPARATE CLAIM.
       *
       * Signing in mints and sets a cookie. Whether anything later ACCEPTS that
       * cookie is a different question, and it is the one that was false: the
       * sign in above answered 200 with a Set-Cookie for all seven roles even
       * while four of them were already dead.
       *
       * A 401 from the proxy means the session was not read. Anything else,
       * including a 403 for a role that legitimately may not do this, means it
       * was, which is the whole claim being made here.
       */
      const next = await fetch(`${BASE}/api/portal/people`, {
        headers: { cookie: signedIn.cookie ?? "" },
        redirect: "manual",
      });
      rec(
        `and ${role} is still signed in on the very next request`,
        next.status !== 401,
        next.status === 401 ? "401 from the proxy: the cookie was minted and then refused" : `status ${next.status}`,
      );
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

    /*
     * AND A ROLE THAT IS NOT ONE OF THE THREE CAN ACTUALLY BE HANDED OUT.
     *
     * Over HTTP, through the endpoint the form posts to, because the pure
     * checks above prove a declaration and prove nothing about the path. This
     * refused every role but three until the closeout: four of the firm's own
     * roles existed, appeared on the roles screen, held grants, and could not be
     * given to a person by any means the platform offered.
     *
     * The account it creates is added to the same teardown as the probes, which
     * is verified rather than assumed.
     */
    {
      const email = `dispatcher-${STAMP}@${PROBE_DOMAIN}`;
      const res = await fetch(`${BASE}/api/portal/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: sessions.admin },
        body: JSON.stringify({
          action: "create",
          role: "dispatcher",
          displayName: "Probe Dispatcher",
          email,
          deliverBy: "hand",
        }),
      });
      const body = await res.json().catch(() => null);
      rec(
        "an administrator can create an account with a role that is not one of the original three",
        res.status === 200 && body?.ok === true,
        `HTTP ${res.status}${body?.error ? `: ${body.error}` : ""}`,
      );

      /* Oldest first, and the error read. eng_profiles has no unique index on
       * email, so a leftover probe sharing an address would answer PGRST116
       * and this check would fail claiming the row carries no role. */
      const { data: rows, error: rowErr } = await db
        .from("eng_profiles")
        .select("id, role")
        .eq("email", email)
        .order("created_at", { ascending: true })
        .limit(1);
      if (rowErr) console.error(`  (could not read the profile just written: ${rowErr.message})`);
      const row = (rows ?? [])[0] ?? null;
      rec(
        "and the row it wrote carries that role",
        row?.role === "dispatcher",
        String(row?.role ?? "no row"),
      );
      if (row?.id) created.push({ id: row.id, email, role: "dispatcher" });

      const invented = await fetch(`${BASE}/api/portal/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: sessions.admin },
        body: JSON.stringify({
          action: "create",
          role: "not_a_role_anybody_made",
          displayName: "Probe Nobody",
          email: `nobody-${STAMP}@${PROBE_DOMAIN}`,
          deliverBy: "hand",
        }),
      });
      rec(
        "and a role nobody created is still refused",
        invented.status === 400,
        `HTTP ${invented.status}; asking the table is not the same as accepting anything`,
      );
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

    /*
     * WHAT AN ENGINEER ACCOUNT CAN ACTUALLY REACH.
     *
     * Asked because a Professional Engineer is about to be given an account on
     * production, and "the matrix says so" is not the same claim as "we signed
     * in as one and looked". The matrix is what this file already checks
     * elsewhere; this is the other question.
     *
     * EVERY PAGE ON DISK IS PROBED, and the expectation lists below must
     * account for all of them. That is the property that makes this survive the
     * next screen somebody adds: a new portal page with no ruling about whether
     * an engineer sees it fails the coverage check rather than defaulting to
     * whatever the page happens to do. It is the same shape as the perimeter
     * coverage check in security-audit, which is what caught /api/portal/roles.
     */
    {
      const dir = "src/app/portal/(app)";
      const onDisk = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("("))
        .map((e) => "/portal/" + e.name)
        .sort();

      /*
       * The two the licence is FOR. Both are licensed capabilities rather than
       * grants, so an engineer reaches them and nobody else does.
       */
      const ENGINEER_REACHES = [
        /* The production report describes their own reviews and their own pay.
         * The screen shows only the reports their grants name, so an engineer
         * opening it sees production and not revenue. */
        "/portal/reports",
        "/portal/protocols",
        "/portal/review",
        // Ordinary working surfaces an engineer holds by grant, not by licence.
        "/portal/files",
        "/portal/clients",
        "/portal/documents",
        "/portal/messages",
        "/portal/tasks",
        "/portal/profile",
        "/portal/charge-log",
        /*
         * HIS OWN pay ledger, and the distinction is the whole point. The page
         * is gated on ledger.read_own OR ledger.read_all, and payLedger scopes
         * the query to tech_id = actor.id unless the caller holds read_all.
         * An engineer holds only read_own, so this renders his own rows, which
         * for a PE is an empty ledger. It is not a window onto what technicians
         * are paid; that is read_all, and he does not have it.
         *
         * This was in the refused list on the first run of this check and the
         * check was wrong, not the code.
         */
        "/portal/pay",
      ];

      /*
       * And what a licence must NOT open. Money, people, the audit trail, the
       * permission screen and the machine's own dials. An engineer is a
       * licensed professional, not an administrator, and the licence is not a
       * seniority ranking.
       */
      const ENGINEER_REFUSED = [
        "/portal/people",
        /*
         * Applications carry a candidate's resume and licence behind signed
         * links. An engineer holds a licence, not a hiring role, and the screen
         * gates on profiles.create for exactly that reason.
         */
        "/portal/applications",
        "/portal/roles",
        "/portal/audit",
        "/portal/billing",
        "/portal/orders",
        "/portal/accounts",
        "/portal/partners",
        "/portal/queue",
        "/portal/status",
        "/portal/techs",
        "/portal/intake",
        "/portal/jobs",
        "/portal/onboarding",
        "/portal/certification",
        /*
         * The do not contact list. An engineer does not hold
         * suppressions.manage and should not: deciding whether the firm may
         * write to a person is a customer relationship decision, not an
         * engineering one, and the request arrives at the people who answer
         * the telephone. Nothing about a licence bears on it.
         */
        "/portal/suppressions",
        /*
         * And the requests to be forgotten, behind the same grant and refused
         * for the same reason plus a sharper one.
         *
         * An engineer holds a licence, and what a licence bears on here is the
         * opposite of what somebody asking might hope: the responsible charge
         * log and the sealed work are the records the firm is LEAST able to
         * remove. Putting this screen in front of the person whose regulatory
         * record is the reason the answer is usually no would be putting them
         * in a conversation they cannot help with.
         *
         * It reaches nothing anyway: the screen deletes nothing, and the only
         * permission that removes a row is retention.execute, which the
         * administrator holds alone.
         */
        "/portal/deletion-requests",
      ];

      const claimed = [...ENGINEER_REACHES, ...ENGINEER_REFUSED].sort();
      const unaccounted = onDisk.filter((p) => !claimed.includes(p));
      rec(
        "every portal page on disk has a ruling about the engineer role",
        unaccounted.length === 0,
        unaccounted.length ? "no ruling for: " + unaccounted.join(", ") : onDisk.length + " pages",
      );

      const missingPages = claimed.filter((p) => !onDisk.includes(p));
      rec(
        "and every page named in those lists still exists",
        missingPages.length === 0,
        missingPages.join(", ") || "a list naming a deleted page passes by asserting nothing",
      );

      let reachedCount = 0;
      for (const path of ENGINEER_REACHES) {
        const res = await fetch(BASE + path, {
          headers: { cookie: sessions.engineer },
          redirect: "manual",
        });
        rec("an engineer can open " + path, res.status === 200, "HTTP " + res.status);
        if (res.status === 200) reachedCount += 1;
      }

      /*
       * HOW A REFUSAL LOOKS, AND WHY THIS ACCEPTS TWO SHAPES.
       *
       * Twenty pages call notFound(). Three call redirect("/portal"):
       * billing, orders and accounts. Both refuse; they refuse differently.
       *
       * The first draft of this check demanded 404 everywhere and failed those
       * three, which would have been an audit asserting a rule nobody had made
       * rather than the one the platform follows. The rule it actually follows
       * is "a role that cannot open a page does not get that page", and both
       * shapes satisfy it.
       *
       * It is not a leak, for the reason already recorded in BACKLOG.md against
       * the sibling inconsistency: both are reachable only by a signed in user,
       * the proxy sends a signed out client to the login screen before either
       * renders, and the navigation is built from the same permission list so
       * it never draws an item the role cannot open. security-audit's rule is
       * about a signed out client and is unaffected.
       *
       * So the shape is PINNED rather than demanded. The count below is exact,
       * and the three are named, which means a fourth page drifting to a
       * redirect fails here and has to be a decision somebody made.
       */
      const redirectors = [];
      for (const path of ENGINEER_REFUSED) {
        const res = await fetch(BASE + path, {
          headers: { cookie: sessions.engineer },
          redirect: "manual",
        });
        const location = res.headers.get("location") ?? "";
        const sentAway = res.status === 307 && /\/portal$/.test(location);
        rec(
          "an engineer does not get " + path,
          res.status === 404 || sentAway,
          "HTTP " + res.status + (location ? " to " + location : ""),
        );
        if (sentAway) redirectors.push(path);
      }

      const REDIRECTING = ["/portal/accounts", "/portal/billing", "/portal/orders"];
      rec(
        "the pages that send a refused role away rather than 404ing are the three known ones",
        redirectors.sort().join(",") === REDIRECTING.join(","),
        redirectors.length ? redirectors.join(", ") : "none, which means the inconsistency was fixed and this check should go",
      );

      console.log("");
      console.log(
        "  an engineer account reached " +
          reachedCount +
          " of " +
          ENGINEER_REACHES.length +
          " pages and was refused all " +
          ENGINEER_REFUSED.length +
          " others",
      );
      console.log("");


      /*
       * THE COMPLIANCE GATE STILL BLOCKS SEALING FOR HIM, and an engineer with
       * an account is not a firm with a registration. Asserted with an ACTIVE
       * ENGINEER as the actor, because the interesting case is not "an
       * administrator cannot seal", it is "the one person who otherwise could
       * still cannot, because the firm is not registered".
       */
      const engineerActor = {
        id: "probe",
        role: "engineer",
        status: "active",
        grants: new Set(actionsFor("engineer")),
      };
      const adminActor = {
        id: "a",
        role: "admin",
        status: "active",
        grants: new Set(actionsFor("admin")),
      };
      const underReview = {
        status: "under_review",
        packageComplete: true,
        assignedEngineerId: "probe",
      };
      const REASON = "The framing is not adequate for the load path shown.";

      const sealed = canReview(engineerActor, underReview, "seal", null, { prelaunch: true });
      rec(
        "an active engineer still cannot seal while the firm is prelaunch",
        sealed.ok === false,
        "an engineer with an account is not a firm with a registration",
      );
      rec(
        "and the refusal names the registration rather than his role",
        sealed.ok === false && /Texas Board of Professional Engineers/.test(sealed.reason ?? ""),
      );
      rec(
        "but he can take a complete package and decline it",
        canReview(engineerActor, underReview, "refuse", REASON, { prelaunch: true }).ok === true,
        "refusing to certify is the one decision a pending registration must never block",
      );

      const adminRefused = canReview(adminActor, underReview, "refuse", REASON, { prelaunch: true });
      rec(
        "and nobody without the licence decides anything, even declining",
        adminRefused.ok === false,
      );
      rec(
        "and that refusal sends them to a Professional Engineer, not to the roles screen",
        /Professional Engineer in responsible charge/.test(adminRefused.reason ?? "") &&
          /no checkbox/.test(adminRefused.reason ?? ""),
        "telling somebody their ROLE cannot do it sends them hunting for a setting that cannot exist",
      );
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

    /*
     * =====================================================================
     * A GRANT DECIDES A DOOR. A ROLE NAME DOES NOT.
     * Operator ruling, 2026-09-10, and this is the injection it asked for.
     * =====================================================================
     *
     * /portal/certification used to read
     *
     *   if (!can(actor, "evidence.capture") && actor?.role !== "admin") notFound();
     *
     * so "admin" was a capability the permission screen could neither see nor
     * withdraw. Roles have been data since 0018; a string comparison in a page
     * is a grant nobody can revoke.
     *
     * The two halves below are the whole ruling, and each is useless without
     * the other:
     *
     *   a role holding the grant UNDER A DIFFERENT NAME must pass. This is the
     *   half that proves the gate reads the grant rather than a list of names
     *   somebody remembered. The role key here has never existed before and no
     *   line of this platform mentions it.
     *
     *   a role carrying the NAME and not the grant must be refused. This is the
     *   half that proves the escape hatch is gone. It uses "admin" itself,
     *   which is the exact name that used to open the door.
     *
     * Both roles are created here, used, and removed in the teardown below.
     */
    {
      /*
       * SHORT KEYS, AND THE REASON IS A REAL DEFECT SOMEWHERE ELSE.
       *
       * makeProbe builds probe-<role>-<STAMP>@roles-audit.invalid, so a long
       * role key makes a long email, and the email goes into the otpauth URI
       * that src/lib/qr.ts encodes at enrolment. That encoder refuses anything
       * over version 10, and the first version of this block used
       * overnight_capturer_<13 digit stamp>, which produced a 226 byte URI and
       * a 500 from /api/portal/mfa. Both checks then reported HTTP 0 and read
       * as "the gate is reading something other than the grant", which was a
       * statement about this fixture rather than about the page.
       *
       * The keys are short so this block measures the certification gate. The
       * encoder limit it uncovered is a separate finding and is recorded in
       * BACKLOG.md rather than worked around silently here.
       */
      const SHORT = String(STAMP).slice(-6);
      const INVENTED = `cap_${SHORT}`;
      const NAMED = `nog_${SHORT}`;
      const madeRoles = [];

      try {
        /* A role nobody has ever heard of, holding the one grant that matters. */
        /*
         * mfa_requirement IS SET EXPLICITLY, and leaving it out cost a run.
         *
         * The column is nullable, so the insert succeeded, and the sign in path
         * then answered 500 at begin. Both checks reported HTTP 0 and read as
         * "the gate is reading something other than the grant", which was a
         * statement about this fixture rather than about the page. A role row a
         * person creates on the permission screen gets a requirement; one
         * created here has to as well, or it is not the same subject.
         */
        await db.from("eng_roles").insert({
          key: INVENTED,
          name: "Invented Capturer",
          landing_path: "/portal",
          is_system: false,
          mfa_requirement: "optional",
        });
        madeRoles.push(INVENTED);
        await db.from("eng_role_grants").insert({ role_key: INVENTED, action: "evidence.capture" });

        /*
         * And a role that LOOKS like the old escape hatch. The profile's role
         * column carries a key, so this one is named to sit as close to "admin"
         * as a distinct row can, and holds no grants at all.
         */
        await db.from("eng_roles").insert({
          key: NAMED,
          name: "Administrator Without The Grant",
          landing_path: "/portal",
          is_system: false,
          mfa_requirement: "optional",
        });
        madeRoles.push(NAMED);

        const openedBy = async (roleKey) => {
          const probe = await makeProbe(db, roleKey);
          const session = await signIn(probe.email, probe.password);
          /* A sign in that failed is not a verdict about the gate, and saying
           * so is the difference between a finding and a wild goose chase. */
          if (!session.ok || !session.cookie) {
            return { status: -1, why: `the probe could not sign in: ${session.error ?? "no cookie"}` };
          }
          const res = await fetch(`${BASE}/portal/certification`, {
            headers: { cookie: session.cookie },
            redirect: "manual",
          });
          return { status: res.status, why: "" };
        };

        const invented = await openedBy(INVENTED);
        rec(
          "a role holding evidence.capture under a name nothing has heard of opens Certification",
          invented.status === 200,
          invented.status === 200
            ? `${INVENTED} got HTTP 200, so the gate read the GRANT`
            : invented.status === -1
              ? `NOT MEASURED, ${invented.why}`
              : `HTTP ${invented.status}: the gate is reading something other than the grant`,
        );

        const named = await openedBy(NAMED);
        rec(
          "and a role holding no grant is refused, however it is named",
          named.status === 404,
          named.status === 404
            ? `${NAMED} got HTTP 404`
            : named.status === -1
              ? `NOT MEASURED, ${named.why}`
              : `HTTP ${named.status}: a role with no evidence.capture opened it anyway`,
        );

        /*
         * THE REAL administrator, which is the row the escape hatch was written
         * for. It holds no evidence.capture, so it must now be refused too, and
         * the shell already never offered it the link.
         */
        /* sessions[role] is the cookie STRING, the shape every other fetch in
         * this file uses. Reading .cookie off it would be undefined and the
         * check would silently not run. */
        const adminCookie = sessions.admin;
        if (adminCookie) {
          const res = await fetch(`${BASE}/portal/certification`, {
            headers: { cookie: adminCookie },
            redirect: "manual",
          });
          rec(
            "and the administrator, who the escape hatch was written for, is refused with it gone",
            res.status === 404,
            res.status === 404
              ? "HTTP 404, and nav.ts never offered the link either, so the shell and the page now agree"
              : `HTTP ${res.status}: the escape hatch is still open somewhere`,
          );
        }
      } catch (err) {
        rec("the role name injection ran", false, String(err.message).slice(0, 160));
      } finally {
        /*
         * THE PROBES GO FIRST, AND THE DATABASE INSISTS.
         *
         * 0018 line 231: eng_profiles.role references eng_roles (key) on update
         * cascade, and NOT on delete cascade. Deleting a role while a profile
         * still carries its key is refused, which is correct: a profile whose
         * role does not exist is an account with undefined permissions.
         *
         * So the two probes made against these invented roles are removed here,
         * before the roles are, and taken out of `created` so the outer
         * teardown is not left deleting rows that have gone.
         */
        for (const key of madeRoles) {
          for (const c of created.filter((x) => x.role === key)) {
            await db.from("eng_profiles").delete().eq("id", c.id);
            await db.auth.admin.deleteUser(c.id).catch(() => {});
            created.splice(created.indexOf(c), 1);
          }
          await db.from("eng_role_grants").delete().eq("role_key", key);
          await db.from("eng_roles").delete().eq("key", key);
        }
        const { data: leftRoles } = await db.from("eng_roles").select("key").in("key", madeRoles);
        rec(
          "the invented roles were removed",
          (leftRoles?.length ?? 0) === 0,
          leftRoles?.length ? `left behind: ${leftRoles.map((r) => r.key).join(", ")}` : `${madeRoles.length} removed`,
        );
      }
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

/*
 * =====================================================================
 * SEVEN ROLES EXIST. DOES THE PLATFORM ACT LIKE IT.
 *
 * Phase 10 Section 2 made roles rows and shipped seven of them. The screens
 * were written when there were three, and four of the seven were second class
 * everywhere it mattered without a single check going red:
 *
 *   the invite form offered three, so four roles could not be given to anybody
 *   the API behind it refused any other key, so posting by hand failed too
 *   ROLE_LABEL was a three key map, so a dispatcher's role rendered as nothing
 *     in the profile menu, on their dashboard, in the roster and on the page
 *     where they set their password
 *   visibleFiles switched on three role names with no default, and TypeScript
 *     accepted it as exhaustive because the actor's role was typed as the union
 *     of the three roles that used to exist
 *
 * Every one of those is the same defect: a type or a list asserting something
 * that stopped being true, in a place where nothing looks again.
 * =====================================================================
 */
{
  /*
   * SOURCE WITH THE PROSE TAKEN OUT, and the first run of this section needed
   * it. Two checks below failed against the comments that explain the very
   * defect they look for: this file's own history paragraph says
   * `role === "engineer"`, and ops-authz explains at length what a three key
   * label map used to do. A check that reads prose is a check looking at the
   * wrong thing, which is the failure this whole audit exists to catch, one
   * level up.
   */
  const codeOnly = (path) =>
    readSource(path)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

  const KNOWN_FIELDS = ["licence", "coverage"];

  for (const role of DEFAULT_ROLES) {
    rec(
      `${role.key} declares what creating one has to ask for`,
      Array.isArray(role.inviteFields) &&
        role.inviteFields.every((f) => KNOWN_FIELDS.includes(f)),
      JSON.stringify(role.inviteFields),
    );
    rec(`${role.key} has a name to show a person`, roleLabel(role.key) === role.name, roleLabel(role.key));
  }

  rec(
    "the two roles that need more than a name and an email are the ones that ask",
    inviteFieldsFor("engineer").includes("licence") &&
      inviteFieldsFor("field_tech").includes("coverage") &&
      inviteFieldsFor("dispatcher").length === 0,
    "a dispatcher asked for a licence number would be a form nobody trusts",
  );

  rec(
    "a role invented on the roles screen asks for nothing extra",
    inviteFieldsFor("something_the_owner_made_up").length === 0,
    "the platform cannot know what a role it has never heard of needs",
  );

  rec(
    "and it is still named rather than left blank",
    roleLabel("something_the_owner_made_up") === "Something The Owner Made Up",
    roleLabel("something_the_owner_made_up"),
  );

  rec(
    "a name from the database wins over the seed",
    roleLabel("dispatcher", "Scheduling") === "Scheduling",
    "a role renamed on the roles screen is named that everywhere",
  );

  /*
   * THE SCREENS, BY INSPECTION. The declarations being right is worth nothing
   * if the form still writes the list out.
   */
  const form = codeOnly("src/app/portal/(app)/people/PeopleClient.tsx");
  /*
   * THE PROPERTY IS THAT THE FORM NAMES NO ROLE AT ALL, rather than that one
   * particular literal is absent.
   *
   * The first version of this check looked for ["admin", "engineer",
   * "field_tech"] exactly. Injecting a hardcoded list of role OBJECTS walked
   * straight past it: a check that catches the defect that already happened and
   * not the one somebody would write next.
   */
  rec(
    "the invite form names no role and offers the ones it is handed",
    /roles\.map\(/.test(form) && !/"admin"|"engineer"|"field_tech"/.test(form),
    "it offered three of seven and would never have offered an eighth",
  );
  rec(
    "and it decides its extra fields from the declaration rather than by naming a role",
    /inviteFieldsFor\(/.test(form) && !/role === "engineer"|role === "field_tech"/.test(form),
    "src/app/portal/(app)/people/PeopleClient.tsx",
  );

  const api = codeOnly("src/app/api/portal/people/route.ts");
  rec(
    "the endpoint behind it asks the roles table rather than a list in the file",
    /from\("eng_roles"\)/.test(api) &&
      !/const ROLES: Role\[\] = \["admin", "engineer", "field_tech"\]/.test(api),
    "src/app/api/portal/people/route.ts",
  );

  /*
   * AND NOTHING INDEXES A THREE KEY LABEL MAP ANY MORE. This is the regression
   * guard: the map is gone, and a screen that reintroduced one would render a
   * blank for the same four roles all over again.
   */
  const screens = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) screens.push(full);
    }
  };
  walk("src/app");
  walk("src/lib");
  walk("src/components");
  const indexers = screens.filter((f) => /ROLE_LABEL\[/.test(codeOnly(f)));
  rec(
    "no surface reads a role's name out of a fixed map",
    /*
     * The applications screen has one of its own for the two POSITIONS somebody
     * applies for, which are not portal roles and are not rows anywhere. It is
     * allowed by name rather than by pattern, so a second one has to be argued
     * for here.
     */
    indexers.every((f) => f.endsWith("src/app/portal/(app)/applications/page.tsx")),
    indexers.join(", ") || "every screen asks roleLabel",
  );

  /*
   * VISIBLE FILES, FOR THE ROLES THAT USED TO FALL OFF THE END.
   */
  const actorWith = (role, grants) => ({
    id: "00000000-0000-0000-0000-000000000001",
    role,
    status: "active",
    grants: new Set(grants),
  });

  const dispatcher = visibleFiles(actorWith("dispatcher", ["files.list"]));
  rec(
    "a dispatcher can see the files they are asked to dispatch",
    dispatcher?.kind === "all",
    String(dispatcher?.kind),
  );

  const stranger = visibleFiles(actorWith("something_new", []));
  rec(
    "and a role with no files grant sees none, rather than undefined",
    stranger?.kind === "none",
    String(stranger?.kind),
  );

  rec(
    "the three scopes that are about identity are unchanged",
    visibleFiles(actorWith("admin", ["files.list"])).kind === "all" &&
      visibleFiles(actorWith(LICENSED_ROLE, ["files.list"])).kind === "engineer" &&
      visibleFiles(actorWith("field_tech", ["files.list"])).kind === "tech",
    "an engineer sees the queue and a technician sees their own work, whatever their grants say",
  );
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
