// @runtime react-server
//
// Declared because this audit reaches modules carrying `server-only`.

/**
 * NOTHING IS DELETED THAT THE DECLARATION DID NOT SAY COULD BE.
 *
 *   npm run retention-audit
 *
 * Phase 12 Section 3.
 *
 * WHY THIS AUDIT IS DIFFERENT FROM EVERY OTHER ONE IN THIS SUITE
 * --------------------------------------------------------------
 * Every other check here asks whether a figure is right, a screen is reachable,
 * or a permission holds. If one of those is wrong the record is still there and
 * the answer can be recomputed tomorrow.
 *
 * Retention is the only thing in this platform that makes a wrong answer
 * permanent. A deletion leaves the absence of evidence, which reads exactly
 * like the thing never having happened, and no later audit can tell the two
 * apart. So this one is written to fail closed: it derives what may be deleted
 * from the DECLARATION, it proves the refusals rather than reading them, and
 * the checks that matter most are the ones asserting that nothing happened.
 *
 * IT DERIVES FROM THE DECLARATION AND PINS THE RULINGS AS LITERALS
 * ----------------------------------------------------------------
 * retention-policy.ts is a declaration of intent, which is the idiom
 * surfaces.mjs and applied.mjs already use, so deriving the table list and the
 * rules from it is right. What is NOT derived is the operator's rulings: the
 * tables that are kept forever whatever anybody configures are written out here
 * as literals, because an audit that read that list from the file under test
 * would agree with the file after somebody edited it. That is CLAUDE.md's
 * standing rule and this is the place it matters most.
 *
 * THE LIVE HALF, AND WHAT IT IS ALLOWED TO TOUCH
 * -----------------------------------------------
 * It constructs cron runs on DEVELOPMENT, in 2019, and deletes them again.
 * eng_cron_runs is machine telemetry, it is one of exactly two tables the
 * declaration allows retention to delete from, and 2019 is far enough from any
 * real day that nothing this writes can be confused for something the platform
 * produced.
 *
 * NO REGULATORY OR FINANCIAL RECORD IS SYNTHESISED HERE. Operator ruling. The
 * ledgers, the responsible charge log, the payments and the audit trail are all
 * declared kept forever, so there is no loop to exercise against them, and the
 * refusals that protect them are proved by ASKING for a plan and reading the
 * sentence back rather than by writing a row first.
 */

process.loadEnvFile?.(".env.local");

import { readFileSync, readdirSync } from "node:fs";
import { auditClient } from "./lib/db-target.mjs";
import { RETENTION_POLICY, DECLARED_TABLES, deletableEntries, mayDelete, ruleFor } from "../src/lib/retention-policy.ts";
import { planRetention, runRetention, executeAuthority, hashIds, cutoffFor, sweepable, BATCH } from "../src/lib/ops-retention.ts";
import { METRICS } from "../src/lib/ops-metrics.ts";
import { DEFAULT_ROLES } from "../src/lib/ops-authz.ts";
import { registeredKinds, handlerFor, loadHandlers } from "../src/lib/ops-jobs.ts";

/*
 * WHAT WROTE THE MANIFEST, ON THE MANIFEST.
 *
 * Every plan below leaves a row in eng_retention_runs that CANNOT BE DELETED,
 * because that table refuses DELETE by design. Development already holds 128 of
 * them. They were anonymous at first, and reading the table afterwards is what
 * showed it: a person opening eng_retention_runs could not tell a run somebody
 * asked for from one a board produced.
 *
 * An audit has no actor and must not borrow one, so it names itself. The row it
 * leaves is then permanent AND identifiable, which is the best of the two
 * available outcomes. BACKLOG.md carries the open question of whether these
 * should be written against a replayed database instead.
 */
const AUDIT_ASKED = { id: null, email: null, role: "audit:retention-audit" };

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========= NOTHING GOES THAT THE DECLARATION DID NOT ALLOW =========");
console.log("");

// =====================================================================
// 1. THE DECLARATION AGAINST THE SCHEMA
// =====================================================================

/*
 * The schema's own list, read from the MIGRATIONS rather than from the
 * declaration or from a live database.
 *
 * Migrations are the only source that is independent of both: the declaration
 * is the thing under test, and a live database can be ahead of or behind the
 * files. roles-audit reads the whole chain for the same reason.
 */
const declaredInSchema = (() => {
  const found = new Set();
  for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(eng_[a-z0-9_]+)/gi)) {
      found.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(eng_[a-z0-9_]+)/gi)) {
      found.delete(m[1].toLowerCase());
    }
  }
  return [...found].sort();
})();

rec(
  "the migrations name tables at all",
  declaredInSchema.length > 50,
  `${declaredInSchema.length} found; if this said zero every check below it would pass over nothing`,
);

{
  const missing = declaredInSchema.filter((t) => !DECLARED_TABLES.includes(t));
  rec(
    "every table in the schema is declared in retention-policy.ts",
    missing.length === 0,
    missing.length ? `UNDECLARED: ${missing.join(", ")}` : `${declaredInSchema.length} tables, all declared`,
  );
}

{
  const phantom = DECLARED_TABLES.filter((t) => !declaredInSchema.includes(t));
  rec(
    "and the declaration names no table the schema does not have",
    phantom.length === 0,
    phantom.length
      ? `DECLARED BUT ABSENT: ${phantom.join(", ")}`
      : "a rule for a table nobody created is a rule nothing enforces",
  );
}

{
  const sorted = [...DECLARED_TABLES].sort();
  rec(
    "the declaration is in alphabetical order",
    DECLARED_TABLES.every((t, i) => t === sorted[i]),
    "so it can be diffed against the schema without anybody deciding where a new table belongs",
  );
  rec(
    "and lists nothing twice",
    new Set(DECLARED_TABLES).size === DECLARED_TABLES.length,
    "two rules for one table are two rules that will disagree",
  );
}

// =====================================================================
// 2. THE RULINGS, PINNED AS LITERALS
// =====================================================================

/*
 * THE OPERATOR'S KEPT-FOREVER LIST, WRITTEN OUT HERE ON PURPOSE.
 *
 * Not imported, not filtered out of the declaration, not derived. These are the
 * tables the operator ruled no configuration may shorten, and the whole value
 * of the check is that this array and retention-policy.ts are two places
 * somebody has to edit deliberately. An audit that read the list from the file
 * it audits would report agreement with whatever that file said this morning.
 */
const KEPT_FOREVER_BY_RULING = [
  // The firm's regulatory record of who took responsible charge of what.
  "eng_responsible_charge_log",
  // Sealed deliverables, and the evidence binders of sealed files.
  "eng_documents",
  "eng_evidence_items",
  // The suppression list. Deleting it re-subscribes somebody who asked to stop.
  "eng_marketing_suppressions",
  // Money that moved.
  "eng_order_payments",
  // The audit trail. Explicitly not bounded by retention, and it says so.
  "eng_audit_events",
];

for (const table of KEPT_FOREVER_BY_RULING) {
  const rule = ruleFor(table);
  rec(
    `${table} is kept forever and no rule can shorten it`,
    rule !== null && rule.kind === "kept_forever" && !mayDelete(table),
    rule ? `declared ${rule.kind}` : "NOT DECLARED AT ALL",
  );
}

/*
 * eng_evidence_items is in the ruling list above as the evidence binder of a
 * sealed file. The declaration currently reaches the same place by a different
 * road for the unsealed ones, so the check above is the one that must hold and
 * this note is why the two might read differently to somebody comparing them.
 */

rec(
  "the manifest table is itself kept forever",
  ruleFor("eng_retention_runs")?.kind === "kept_forever" && !mayDelete("eng_retention_runs"),
  "a retention run that can age out its own manifests has a floor on its own history",
);

{
  /*
   * The set that may be deleted, pinned. Two tables today, both machine
   * telemetry, and a third appearing here without the operator ruling on it is
   * the failure this line exists to catch.
   */
  const ALLOWED_TO_DELETE = ["eng_cron_runs", "eng_jobs"];
  const actual = sweepable().sort();
  rec(
    "exactly two tables may be deleted from, and they are the two that were ruled",
    actual.length === ALLOWED_TO_DELETE.length && actual.every((t, i) => t === ALLOWED_TO_DELETE[i]),
    `deletable: ${actual.join(", ") || "none"}`,
  );
}

{
  const bad = [];
  for (const { table, rule } of RETENTION_POLICY) {
    if (rule.kind === "kept_forever" && (!rule.because?.trim() || !rule.ruledBy?.trim())) bad.push(`${table} (no reason or no ruling)`);
    if (rule.kind === "kept_pending_counsel" && !rule.because?.trim()) bad.push(`${table} (no reason)`);
    if (rule.kind === "not_a_record" && !rule.because?.trim()) bad.push(`${table} (no reason)`);
  }
  rec("every kept rule says why and who ruled it", bad.length === 0, bad.length ? bad.join("; ") : `${RETENTION_POLICY.length} rules`);
}

{
  /*
   * THE FLOORS THEMSELVES, PINNED. CLAUDE.md section 6c is the mechanism and
   * this is the sharpest instance of it.
   *
   * The check below asserts every deletable table has a POSITIVE floor, which
   * would have stayed green with the floor moved from thirty days to one. Every
   * other ruling in that table costs money or locks somebody out and is
   * recoverable by reading a record. A floor moved down destroys the record, and
   * no later audit can tell a deleted row from a row that never existed.
   */
  const RULED_FLOORS = { eng_cron_runs: 30, eng_jobs: 30 };
  const wrong = deletableEntries()
    .filter((e) => e.rule.floorDays !== RULED_FLOORS[e.table])
    .map((e) => `${e.table} is ${e.rule.floorDays}d and the ruling is ${RULED_FLOORS[e.table] ?? "no floor at all"}`);
  rec(
    "the floors are the ones the operator ruled, to the day",
    wrong.length === 0 && deletableEntries().length === Object.keys(RULED_FLOORS).length,
    wrong.length ? wrong.join("; ") : "30 days on eng_cron_runs and on eng_jobs, ruled 2026-09-09",
  );
}

{
  const bad = [];
  const metricNames = new Set(Object.values(METRICS));
  for (const { table, rule } of deletableEntries()) {
    if (!(rule.floorDays > 0)) bad.push(`${table} has no positive floor`);
    if (!rule.ageColumn?.trim()) bad.push(`${table} names no age column`);
    if (!rule.ruledBy?.trim()) bad.push(`${table} names nobody who ruled it`);
    if (!rule.rollupRequired) bad.push(`${table} requires no rollup before its source goes`);
    else if (!metricNames.has(rule.rollupRequired)) bad.push(`${table} requires ${rule.rollupRequired}, which is not a metric this platform computes`);
  }
  rec(
    "every deletable table names a floor, an age column, a ruling and a rollup that exists",
    bad.length === 0,
    bad.length ? bad.join("; ") : "the operator's rule: a source is never deleted before the thing that replaces it",
  );
}

rec(
  "mayDelete answers false for a table nobody declared",
  mayDelete("eng_not_a_real_table") === false && ruleFor("eng_not_a_real_table") === null,
  "a new table is refused by default rather than swept because nobody said not to",
);

// =====================================================================
// 3. THE PERMISSION
// =====================================================================

{
  /*
   * Pinned as a literal for the reason above, and compared against what
   * DEFAULT_ROLES ships. roles-audit compares DEFAULT_ROLES to the migration
   * chain, so between the two the code, the seed and the ruling all have to
   * agree.
   */
  const ROLES_THAT_MAY_DELETE = ["admin"];
  const holders = DEFAULT_ROLES.filter((r) => r.grants.includes("retention.execute")).map((r) => r.key).sort();
  rec(
    "retention.execute is held by the administrator and by nobody else",
    holders.length === ROLES_THAT_MAY_DELETE.length && holders.every((k, i) => k === ROLES_THAT_MAY_DELETE[i]),
    `held by: ${holders.join(", ") || "nobody"}`,
  );

  const cs = DEFAULT_ROLES.find((r) => r.key === "customer_service");
  rec(
    "customer service takes deletion requests and cannot perform one",
    Boolean(cs) && cs.grants.includes("suppressions.manage") && !cs.grants.includes("retention.execute"),
    "a request produces a task; the deletion is a run an administrator authorises",
  );
}

{
  const actorWith = (role, grants) => ({ id: `${role}-1`, role, status: "active", grants: new Set(grants) });

  const wasLaunch = process.env.LAUNCH_MODE;

  process.env.LAUNCH_MODE = "live";
  const denied = executeAuthority(actorWith("dispatcher", ["files.list"]));
  rec(
    "an actor without retention.execute cannot mint the authority to delete",
    denied.ok === false && /retention\.execute/.test(denied.because),
    denied.ok ? "IT MINTED ONE" : "and it says which permission is missing",
  );

  const allowed = executeAuthority(actorWith("admin", ["retention.execute"]), "owner@example.com");
  rec(
    "and an administrator can, when the gate is open",
    allowed.ok === true && allowed.authority.actorRole === "admin" && allowed.authority.actorEmail === "owner@example.com",
    "the control: a refusal that refuses everybody proves nothing",
  );

  process.env.LAUNCH_MODE = "prelaunch";
  const prelaunch = executeAuthority(actorWith("admin", ["retention.execute"]));
  rec(
    "under the prelaunch gate even an administrator gets a dry run",
    prelaunch.ok === false && /prelaunch/i.test(prelaunch.because),
    prelaunch.ok ? "IT MINTED ONE UNDER THE GATE" : "operator ruling: prelaunch is dry run only",
  );

  if (wasLaunch === undefined) delete process.env.LAUNCH_MODE;
  else process.env.LAUNCH_MODE = wasLaunch;
}

// =====================================================================
// 4. THE CODE ITSELF
// =====================================================================

{
  const src = readFileSync("src/lib/ops-retention.ts", "utf8");

  rec(
    "retention never reads is_demo",
    !/is_demo/.test(src.replace(/IS_DEMO IS NOT A RETENTION RULE[\s\S]*?\*\//, "")),
    "operator ruling: how long a row is kept is a question about what the row is, not about who caused it",
  );

  /*
   * CALLS, NOT WORDS. The first version of this check tested for the absence of
   * the string readAll anywhere in the file, and failed on the header comment
   * explaining WHY readEvery is used, which is the wording defect this
   * repository keeps finding: a check that matches text is a check on prose. It
   * asks about call sites now, so the comment can say anything it likes.
   */
  rec(
    "the planned set is read with readEvery rather than one page",
    (src.match(/readEvery</g) ?? []).length === 2 && !/readAll[<(]/.test(src),
    "a plan built from the first thousand rows would delete a thousand and report a complete pass",
  );

  rec(
    "there is no boolean that turns a dry run into a deletion",
    !/dryRun\s*[:=]\s*(true|false)/.test(src) && !/execute\s*[:=]\s*false/.test(src),
    "the mode is a discriminated union carrying an authority, so there is no argument to forget",
  );

  rec(
    "the delete is guarded by the mode and appears exactly once",
    (src.match(/\.delete\(\)/g) ?? []).length === 1 && /if \(manifest\.mode === "execute"\) \{\n\s*const \{ error \} = await client\.from\(manifest\.table\)\.delete\(\)/.test(src),
    "one line in the whole file removes a row, and it is inside the mode check",
  );

  rec(
    "progress is written after every batch, not at the end",
    /\.update\(\{ affected_count: affected, last_id: lastId \}\)/.test(src),
    "a killed run has to be resumable, and a run whose work is invisible is not",
  );
}

// =====================================================================
// 5. THE JOB
// =====================================================================

await loadHandlers();

rec(
  "retention.sweep is a registered job kind",
  registeredKinds().includes("retention.sweep"),
  "an unregistered kind is refused at the enqueue, which would make the whole thing unreachable",
);

{
  const handler = handlerFor("retention.sweep");
  rec(
    "and it declares how it survives running twice",
    Boolean(handler) && typeof handler.idempotency === "function" && typeof handler.idempotency({ manifestId: "abc" }) === "string",
    "keyed on the manifest, so a second enqueue finds the live job rather than sweeping the same rows twice in parallel",
  );
}

{
  const handlers = readFileSync("src/lib/job-handlers.ts", "utf8");
  const block = handlers.slice(handlers.indexOf('registerJob("retention.sweep"'));
  rec(
    "the handler decides nothing: it passes a manifest id and reads the plan back",
    /runRetention\(manifestId\)/.test(block) && !/planRetention/.test(block),
    "a payload carrying the plan would be a plan that survives in the queue and nowhere else",
  );
}

// =====================================================================
// 6. THE LIVE HALF
// =====================================================================

const db = auditClient("retention-audit", { neverProduction: true });

const DAY = "2019-03-0";
const madeCron = [];
const madeMetrics = [];

const cleanup = async () => {
  if (madeCron.length) await db.from("eng_cron_runs").delete().in("id", madeCron);
  for (const day of madeMetrics) await db.from("eng_metrics_daily").delete().eq("day", day).eq("metric", METRICS.CRON_RUNS);
};

try {
  // ------------------------------------------------ a plan refuses what it must

  const forever = await planRetention("eng_audit_events", { kind: "dry_run", askedBy: AUDIT_ASKED });
  rec(
    "planning against a kept-forever table is refused and says so",
    forever.ok === false && /kept_forever/.test(forever.because),
    forever.ok ? "IT PLANNED ONE" : forever.because.slice(0, 90),
  );

  const unknown = await planRetention("eng_not_a_real_table", { kind: "dry_run", askedBy: AUDIT_ASKED });
  rec(
    "planning against a table the declaration does not name is refused",
    unknown.ok === false && /not named in retention-policy/.test(unknown.because),
    unknown.ok ? "IT PLANNED ONE" : "refused before it reads a row",
  );

  const counsel = await planRetention("eng_files", { kind: "dry_run", askedBy: AUDIT_ASKED });
  rec(
    "and so is a table waiting on counsel",
    counsel.ok === false && /kept_pending_counsel/.test(counsel.because),
    counsel.ok ? "IT PLANNED ONE" : "treated exactly as kept forever until somebody answers",
  );

  // ------------------------------------------------------ the rollup guard

  /*
   * Six cron runs across three days in 2019, well past any floor. The rollup for
   * those days does not exist, which is the first thing a plan must refuse.
   */
  const rows = [];
  for (let d = 1; d <= 3; d += 1) {
    for (let n = 0; n < 2; n += 1) {
      rows.push({
        name: "retention-audit-probe",
        started_at: `${DAY}${d}T0${n}:00:00Z`,
        finished_at: `${DAY}${d}T0${n}:00:05Z`,
        ok: true,
        detail: "Written by retention-audit, deleted by it.",
      });
    }
  }
  const { data: inserted, error: insErr } = await db.from("eng_cron_runs").insert(rows).select("id, started_at");
  if (insErr) throw new Error(`could not construct the fixture: ${insErr.message}`);
  madeCron.push(...inserted.map((r) => r.id));

  const noRollup = await planRetention("eng_cron_runs", { kind: "dry_run", askedBy: AUDIT_ASKED });
  rec(
    "a day with no rollup is refused, and the day is named",
    noRollup.ok === false && new RegExp(`${DAY}[123]`).test(noRollup.because) && /does not exist yet/.test(noRollup.because),
    noRollup.ok ? "IT PLANNED THE DELETION OF AN UNROLLED DAY" : noRollup.because.slice(0, 80),
  );

  // A rollup that exists and disagrees is refused too, and that is the sharper half.
  await db.from("eng_metrics_daily").upsert(
    [{ day: `${DAY}1`, metric: METRICS.CRON_RUNS, value: 99, computed_at: new Date().toISOString() }],
    { onConflict: "day,metric" },
  );
  madeMetrics.push(`${DAY}1`);

  const wrongRollup = await planRetention("eng_cron_runs", { kind: "dry_run", askedBy: AUDIT_ASKED });
  rec(
    "a rollup that disagrees with its source is refused, with both numbers",
    wrongRollup.ok === false && /does not reconcile/.test(wrongRollup.because) && /99/.test(wrongRollup.because),
    wrongRollup.ok ? "IT PLANNED ONE ANYWAY" : wrongRollup.because.slice(0, 90),
  );

  // Now make all three days reconcile, which is what lets a plan through.
  for (let d = 1; d <= 3; d += 1) {
    const day = `${DAY}${d}`;
    await db.from("eng_metrics_daily").upsert(
      [{ day, metric: METRICS.CRON_RUNS, value: 2, computed_at: new Date().toISOString() }],
      { onConflict: "day,metric" },
    );
    if (!madeMetrics.includes(day)) madeMetrics.push(day);
  }

  // ------------------------------------------------------- a dry run deletes nothing

  const plan = await planRetention("eng_cron_runs", { kind: "dry_run", askedBy: { id: null, email: "retention-audit", role: "audit" } });
  rec(
    "with the rollups reconciling, a plan is written",
    plan.ok === true,
    plan.ok ? `manifest ${plan.manifest.id}, ${plan.manifest.intendedCount} row(s)` : plan.because.slice(0, 110),
  );

  if (plan.ok) {
    const m = plan.manifest;

    rec(
      "the manifest names the policy, the set and the time in Central",
      m.rule === "delete_after" && m.floorDays === 30 && m.ageColumn === "started_at" &&
        m.idHash.length === 64 && m.idLow !== null && m.idHigh !== null && / CT$/.test(m.plannedAtCt),
      `${m.floorDays}d on ${m.ageColumn}, hash ${m.idHash.slice(0, 12)}..., ${m.plannedAtCt}`,
    );

    rec(
      "and it names the rollup it proved, day by day",
      m.rollupMetric === METRICS.CRON_RUNS && m.rollupDays.length >= 3 &&
        m.rollupDays.every((d) => d.planned === d.rollup),
      `${m.rollupDays.length} day(s), each planned count equal to its rollup`,
    );

    rec(
      "the manifest exists before anything is touched",
      m.status === "planned" && m.affectedCount === 0,
      "written first, so a run that dies leaves a record of what it was about to take",
    );

    const before = await db.from("eng_cron_runs").select("id", { count: "exact", head: true }).in("id", madeCron);
    const dry = await runRetention(m.id);
    const after = await db.from("eng_cron_runs").select("id", { count: "exact", head: true }).in("id", madeCron);

    rec(
      "a DRY RUN counts the rows and deletes none of them",
      dry.ok === true && dry.report.affected >= 6 && dry.report.reconciled === true &&
        after.count === before.count && before.count === madeCron.length,
      dry.ok
        ? `would have deleted ${dry.report.affected}; ${after.count} of ${before.count} fixture rows still present`
        : dry.because?.slice(0, 90),
    );

    rec(
      "and it records what it would have done, so the rehearsal proves something",
      dry.ok === true && /[Ww]ould have deleted/.test(dry.report.note),
      "a dry run that recorded nothing proves nothing about the run it rehearses",
    );

    // ------------------------------- the handler, and the trail row it writes

    /*
     * THE ONLY CHECK HERE THAT GOES THROUGH THE REGISTERED HANDLER.
     *
     * Everything above calls runRetention directly, which is right for testing
     * the sweep and leaves one thing unexercised: the handler is what writes the
     * regulatory trail row, so nothing on the board was reading it. That gap had
     * already cost something. The trail row was written with actor_id null while
     * the manifest beside it named somebody, and it was found by reading
     * eng_audit_events next to eng_retention_runs rather than by any check.
     *
     * For the one action in this platform that destroys a record, "who authorised
     * it" belongs in the regulatory memory first and the working record second.
     */
    {
      const handler = handlerFor("retention.sweep");
      const trailPlan = await planRetention("eng_cron_runs", { kind: "dry_run", askedBy: AUDIT_ASKED });

      if (!handler || !trailPlan.ok) {
        rec("the sweep handler writes a trail row naming who authorised it", false, "could not plan the fixture for it");
      } else {
        const outcome = await handler.run({ manifestId: trailPlan.manifest.id }, {
          id: 0, kind: "retention.sweep", payload: {}, attempts: 1, maxAttempts: 5,
        });

        const { data: trail } = await db
          .from("eng_audit_events")
          .select("action, actor_role, summary, entity_id")
          .eq("entity_id", trailPlan.manifest.id)
          .maybeSingle();

        rec(
          "the sweep handler writes a trail row naming who authorised it",
          outcome.kind === "done" &&
            trail?.action === "retention.dry_run" &&
            trail?.actor_role === AUDIT_ASKED.role &&
            /Authorised by/.test(trail?.summary ?? ""),
          trail ? `${trail.action} authorised by ${trail.actor_role ?? "NOBODY"}` : "no trail row was written",
        );

        rec(
          "and it says execute or dry run in the action itself",
          trail?.action === "retention.dry_run",
          "a reader scanning the trail for deletions must not have to open the diff to find one",
        );
      }
    }

    // ------------------------------------------ the hash catches a set that moved

    /*
     * THE FIRST VERSION OF THIS INJECTION PROVED NOTHING AND IS RECORDED RATHER
     * THAN QUIETLY REPLACED.
     *
     * It moved the set by INSERTING a row, and the check failed: the run went
     * ahead. That was the fixture being wrong rather than the code, because a
     * newly inserted row gets a higher id than the manifest's id_high and is
     * outside the range the run replays, by design. Nothing could have moved.
     *
     * The way a planned set actually moves is a row inside the range going
     * away between the plan and the run, which is what this does now. It is
     * the same lesson as the paging check at gate 1: an injection that cannot
     * produce the failure is a green mark for a guard nobody tested.
     */
    const moved = await planRetention("eng_cron_runs", { kind: "dry_run", askedBy: AUDIT_ASKED });
    if (moved.ok && moved.manifest.idLow !== null) {
      const removed = await db.from("eng_cron_runs").delete().eq("id", moved.manifest.idLow);
      const refused = await runRetention(moved.manifest.id);
      rec(
        "a set that changed between the plan and the run is refused by its hash",
        !removed.error && refused.ok === false && /hash/i.test(refused.because) && refused.retryable === false,
        refused.ok ? "IT RAN AGAINST A CHANGED SET" : refused.because?.slice(0, 90),
      );

      const failedRun = await db.from("eng_retention_runs").select("status, note").eq("id", moved.manifest.id).maybeSingle();
      rec(
        "and the manifest records that it refused, rather than staying planned forever",
        failedRun.data?.status === "failed" && /moved between planning and running/.test(failedRun.data?.note ?? ""),
        failedRun.data ? `${failedRun.data.status}: ${(failedRun.data.note ?? "").slice(0, 70)}` : "no manifest read back",
      );
    } else {
      rec("a set that changed between the plan and the run is refused by its hash", false, "could not plan the fixture for it");
      rec("and the manifest records that it refused, rather than staying planned forever", false, "no fixture");
    }
  }

  // ---------------------------------------- what a run refuses to be handed

  const nowhere = await runRetention("00000000-0000-0000-0000-000000000000");
  rec(
    "a run with no manifest is fatal rather than retried forever",
    nowhere.ok === false && nowhere.retryable === false,
    "there is nothing to resume from and no amount of retrying will produce one",
  );

  // ---------------------------------------- the never-delete rule, on the plan

  {
    const jobs = ruleFor("eng_jobs");
    const protectedStatuses = ["pending", "running", "dead"];
    rec(
      "failed and pending queue rows are protected by the rule and not by a filter afterwards",
      jobs?.kind === "delete_after" &&
        protectedStatuses.every((s) => jobs.neverDelete?.values.includes(s)) &&
        /\.not\(rule\.neverDelete\.column, "in"/.test(readFileSync("src/lib/ops-retention.ts", "utf8")),
      "applied in the query, so a protected row is never in the set, never in the hash and never in the count",
    );
  }

  // -------------------------------------------------- the manifest cannot go

  {
    const { data: any } = await db.from("eng_retention_runs").select("id").limit(1).maybeSingle();
    if (any) {
      const { error } = await db.from("eng_retention_runs").delete().eq("id", any.id);
      const { count } = await db.from("eng_retention_runs").select("id", { count: "exact", head: true }).eq("id", any.id);
      rec(
        "a manifest cannot be deleted, with the most privileged credential this platform has",
        Boolean(error) && count === 1,
        error ? error.message.slice(0, 80) : "IT WAS DELETED",
      );
    } else {
      rec("a manifest cannot be deleted, with the most privileged credential this platform has", false, "no manifest to try it on");
    }
  }

  // -------------------------------------------------- hashing is about the set

  rec(
    "the hash tells two different sets of the same size apart",
    hashIds(["1", "2", "3"]) !== hashIds(["1", "2", "4"]) && hashIds(["3", "1", "2"]) === hashIds(["1", "2", "3"]),
    "order does not change it and membership does, which is what a set hash has to do",
  );

  rec(
    "the cutoff is the floor behind now, not ahead of it",
    Date.parse(cutoffFor(30, new Date("2026-09-09T00:00:00Z"))) === Date.parse("2026-08-10T00:00:00Z"),
    "30 days before 2026-09-09 is 2026-08-10",
  );

  rec(
    "batches are bounded",
    BATCH > 0 && BATCH <= 1000,
    `${BATCH} rows a batch, under PostgREST's own cap`,
  );
} finally {
  await cleanup();
  const { count: left } = await db
    .from("eng_cron_runs")
    .select("id", { count: "exact", head: true })
    .eq("name", "retention-audit-probe");
  rec(
    "the audit leaves nothing behind in the table it swept",
    left === 0,
    `${left} probe run(s) remaining`,
  );
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A deletion leaves the absence of evidence, which reads exactly like");
  console.log("the thing never having happened. No later audit can tell them apart.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Nothing goes that the declaration did not allow.`);
console.log("");
console.log(`Declared: ${DECLARED_TABLES.length} tables. Deletable: ${sweepable().join(", ")}.`);
