/**
 * EVERY SUPABASE PROJECT THIS FIRM OWNS, AND THE DOCUMENT THAT ACCOUNTS FOR IT.
 *
 * The same declared inventory idiom as `supabase/applied.mjs` and
 * `scripts/lib/surfaces.mjs`, and it exists for the same reason those do: a list
 * nothing reads is a list that stops being true without telling anybody.
 *
 * WHY IT EXISTS, WHICH IS A SPECIFIC FAILURE RATHER THAN A PRINCIPLE
 * ------------------------------------------------------------------
 * `docs/production-cutover-plan.md` said of the rehearsal project, in writing,
 * "since deleted". On 2026-09-14, eleven days later, that project was alive,
 * billable, and holding 239 audit events, 2 order payments, 1 profile and 1
 * service order.
 *
 * Nobody deleted it and nobody checked. The sentence was written in the same
 * pass as the deletion was intended, which is the mechanism worth naming: a
 * document records what somebody MEANT to do, and then reads forever as a
 * record of what happened.
 *
 * **A DOCUMENT THAT RECORDS A DESTRUCTIVE ACTION AS DONE IS A CLAIM NOTHING
 * SUPPORTS UNLESS SOMETHING CHECKED.** Deleting, revoking, rotating and
 * decommissioning are the four that matter, because each leaves something live
 * and costing money when it silently does not happen, and each reads identically
 * on the page whether it happened or not.
 *
 * WHAT THE CHECK OVER THIS FILE CAN AND CANNOT DO, SAID PLAINLY
 * -------------------------------------------------------------
 * It CANNOT list the organisation's real projects. That needs a Supabase
 * management credential, and standing law keeps production credentials out of
 * the working tree. It is the same split `schema-ledger-audit` has lived with
 * since it was written:
 *
 *   project-accountability-audit  Is every project this REPOSITORY knows about
 *                                 declared, and does its document exist and
 *                                 actually mention it? Needs nothing. Runs on
 *                                 the board.
 *   The MCP, by hand              Does the ORGANISATION hold a project this file
 *                                 does not? `list_projects`, compared against
 *                                 REFS below. Run when a project is created or
 *                                 destroyed.
 *
 * The first is the one that catches what actually happened, because the failure
 * was not a wrong answer. It was a question nobody was made to answer.
 *
 * WHEN A PROJECT IS ACTUALLY DELETED
 * -----------------------------------
 * Move it to `RETIRED` with the date it was confirmed gone AND how that was
 * confirmed. "Confirmed" means somebody read it back from the provider and it
 * was not there. Intending to delete it is not confirming it, and that
 * distinction is the entire content of this file.
 */

/**
 * @typedef {object} ProjectRecord
 * @property {string} ref        The project ref, which is what every URL carries.
 * @property {string} name       The name shown in the Supabase dashboard.
 * @property {string} accountedFor  A path under the repository that explains it.
 * @property {string} because    Why this project exists, in one sentence.
 * @property {"in_use" | "held" | "retired"} status
 */

/** @type {ProjectRecord[]} */
export const PROJECTS = [
  {
    ref: "fsaryeciduszuahgjbly",
    name: "wattsmith",
    status: "in_use",
    accountedFor: "CLAUDE.md",
    because:
      "Production. Real leads, applications, onboarding records and portal accounts. Shared with " +
      "four unrelated applications, which is why every table this firm owns is eng_ prefixed.",
  },
  {
    ref: "ythzaiqeoijlrdibnieo",
    name: "254engineering-dev",
    status: "in_use",
    accountedFor: "CLAUDE.md",
    because:
      "Development. The same schema and nothing else, created 2026-09-02. Every audit points here, " +
      "and roles-audit and seed-field-demo may point nowhere else.",
  },
  {
    ref: "qmvcqvkywmkogxbyzsaz",
    name: "254engineering-prod",
    status: "held",
    accountedFor: "docs/production-cutover-plan.md",
    because:
      "The cutover target, replayed and verified 2026-09-07 and then DEFERRED by operator decision. " +
      "Nothing points here and nothing should. It is a project waiting, not a target.",
  },
  {
    ref: "kmiwxtbtqrlorxfogtht",
    name: "254engineering-rehearsal",
    status: "held",
    accountedFor: "docs/production-cutover-plan.md",
    because:
      "The cutover rehearsal of 2026-09-03, which the plan recorded as deleted and which was not. " +
      "Re-used 2026-09-14 for Phase 14 rank 1: the whole migration chain replayed from nothing " +
      "against a real PostgreSQL 17.6 engine. It is deleted when rank 1 AND rank 2 are both " +
      "finished, by operator ruling, and rank 2 is blocked.",
  },
];

/** Projects confirmed gone, with how that was confirmed. Empty is honest. */
/** @type {Array<ProjectRecord & { confirmedGoneAt: string, confirmedHow: string }>} */
export const RETIRED = [];

/**
 * PROJECTS IN THE ORGANISATION THAT ARE NOT THIS FIRM'S.
 *
 * Operator ruling, 2026-09-14. The organisation holds EIGHT projects and this
 * firm owns four. The other four belong to Reyna Holdings and are outside this
 * platform entirely. They are DECLARED rather than ignored, because the ruling
 * is that a project no document accounts for is named, and the way to stop
 * naming one is to account for it.
 *
 * **"EXTERNAL" IS A DECLARATION, NOT A DISMISSAL, AND THE CHECK ENFORCES THAT.**
 * The obvious abuse of this list is somebody silencing a real finding by moving
 * a project into it, so the audit refuses an external entry that does not carry
 * `engTables: 0` and the date somebody actually looked. **An external project
 * holding a single `eng_` table is a FAIL**, loudly, because a project with this
 * firm's data in it is this firm's problem whoever owns the account.
 *
 * All four were read on 2026-09-14 through `information_schema` and every one
 * returned zero `eng_` tables. That is the question that mattered, and it has a
 * dated answer rather than an inference from the project names.
 *
 * **WHAT THIS FILE PREVIOUSLY INFERRED ABOUT `wattsmith-dedicated` WAS WRONG.**
 * It read as wattsmith being moved off the shared project this firm calls
 * production, and the operator has said plainly that wattsmith has NOT moved.
 * **Nothing about the cutover's tenancy argument changed.** The inference is
 * removed rather than softened, because a wrong sentence left in a declaration
 * is exactly what section 2c of CLAUDE.md is about, and this one would have
 * shaped how somebody read the cutover plan.
 */
export const EXTERNAL = [
  {
    ref: "coihtvhveabnqedrgpqe",
    name: "wattsmith-dedicated",
    owner: "Reyna Holdings",
    createdAt: "2026-09-04",
    publicTables: 18,
    engTables: 0,
    checkedAt: "2026-09-14",
    because:
      "Holds the wattsmith application's own schema: pricebook, estimates, job completions, " +
      "franchise inquiries. Outside this firm. Wattsmith has NOT moved off the shared project, " +
      "so the cutover's tenancy argument is unchanged.",
  },
  {
    ref: "difmjcvfihsbtxpiddos",
    name: "salontransact",
    owner: "Reyna Holdings",
    createdAt: "2026-04-11",
    publicTables: 39,
    engTables: 0,
    checkedAt: "2026-09-14",
    because: "A different business, predating this work.",
  },
  {
    ref: "bmxxzwhzuqjxkxwxslvh",
    name: "Salon Envy Website",
    owner: "Reyna Holdings",
    createdAt: "2026-04-20",
    publicTables: 17,
    engTables: 0,
    checkedAt: "2026-09-14",
    because: "A different business, predating this work.",
  },
  {
    ref: "mllfwrdpxjnnzztuccrt",
    name: "Lone Star Portal",
    owner: "Reyna Holdings",
    createdAt: "2026-07-03",
    publicTables: 30,
    engTables: 0,
    checkedAt: "2026-09-14",
    because: "A different business, predating this work.",
  },
];

/** What the organisation held when somebody last looked, and how. */
export const ORGANISATION_READING = {
  readAt: "2026-09-14",
  readBy: "Supabase MCP list_projects, then information_schema per project",
  organisation: "oowwzggwwukizaomdmui",
  totalProjects: 8,
};

/** Every ref this firm is accountable for, retired included. */
export const REFS = [...PROJECTS, ...RETIRED].map((p) => p.ref);

/**
 * Every ref DECLARED anywhere here, this firm's and not.
 *
 * This is what the reverse scan compares against, and the distinction from
 * `REFS` is the point: a ref appearing in the source is fine if SOMETHING here
 * accounts for it, and whether that account says "ours" or "Reyna Holdings,
 * checked, no eng_ tables" is a different question from whether it exists.
 */
export const DECLARED_REFS = [...REFS, ...EXTERNAL.map((p) => p.ref)];

/**
 * The refs that appear in code as constants, and what each is FOR.
 *
 * Deliberately separate from PROJECTS. This is the answer to "which project does
 * the code point at", which is a different question from "which projects exist",
 * and conflating them is how `PRODUCTION_REF` ends up naming a project nobody
 * has an account of.
 */
export const CODE_REFS = [
  { where: "src/lib/db-guard.ts", constant: "PRODUCTION_REF" },
  { where: "scripts/lib/db-target.mjs", constant: "PRODUCTION_REF" },
];
