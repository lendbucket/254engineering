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
 * THE REST OF THE ORGANISATION, AS READ ON 2026-09-14.
 *
 * The organisation holds EIGHT projects and this firm accounts for four. The
 * other four are recorded here rather than ignored, because the operator's
 * ruling is that a project no document accounts for is NAMED, and the way to
 * stop naming one is to account for it.
 *
 * **NONE OF THEM HOLDS ANY 254 DATA.** Checked rather than assumed: every one
 * was read for `eng_` tables in `information_schema` and every one returned
 * zero. That is the question that actually mattered, and it now has a dated
 * answer instead of an inference from the project names.
 *
 * `wattsmith-dedicated` is the one worth the operator's attention. It was
 * created 2026-09-04, five hours after the cutover project and in the same
 * region, and it holds the wattsmith application's own tables: pricebook,
 * estimates, job completions, franchise inquiries. It reads as somebody moving
 * wattsmith OFF the shared project that 254 calls production, which is the
 * shared tenancy this repository has always flagged, happening from the other
 * side and unrecorded here.
 *
 * These are NOT declared as this firm's, because whether they are is the
 * operator's to say. What is recorded is what was read and when.
 */
export const ORGANISATION_READING = {
  readAt: "2026-09-14",
  readBy: "Supabase MCP list_projects, then information_schema per project",
  organisation: "oowwzggwwukizaomdmui",
  totalProjects: 8,
  notAccountedForByThisFirm: [
    {
      ref: "coihtvhveabnqedrgpqe",
      name: "wattsmith-dedicated",
      createdAt: "2026-09-04",
      publicTables: 18,
      engTables: 0,
      note:
        "Holds the wattsmith application's own schema. Created the day after the cutover project. " +
        "Reads as wattsmith being moved off the shared project 254 calls production. Needs an operator ruling.",
    },
    { ref: "difmjcvfihsbtxpiddos", name: "salontransact", createdAt: "2026-04-11", publicTables: 39, engTables: 0, note: "Predates this work. A different business." },
    { ref: "bmxxzwhzuqjxkxwxslvh", name: "Salon Envy Website", createdAt: "2026-04-20", publicTables: 17, engTables: 0, note: "Predates this work. A different business." },
    { ref: "mllfwrdpxjnnzztuccrt", name: "Lone Star Portal", createdAt: "2026-07-03", publicTables: 30, engTables: 0, note: "Predates this work. Unrelated to 254 as far as its schema shows." },
  ],
};

/** Every ref this firm is accountable for, retired included. */
export const REFS = [...PROJECTS, ...RETIRED].map((p) => p.ref);

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
