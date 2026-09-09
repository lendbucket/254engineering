import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { readEvery } from "./bounded-read";
import { isPrelaunch } from "./launch";
import { deletableEntries, ruleFor, type RetentionRule } from "./retention-policy";
import type { Actor } from "./ops-authz";

/**
 * RETENTION: PLANNING WHAT GOES, AND THEN TAKING IT.
 *
 * Phase 12 Section 3. Two functions matter and the split between them is the
 * whole safety property: `plan` writes down exactly what is about to happen and
 * touches nothing, and `run` does only what a manifest already says.
 *
 * WHY DELETION IS THE ONE THING THIS PLATFORM PLANS BEFORE IT DOES
 * ----------------------------------------------------------------
 * Everything else here is recoverable by reading a record. A wrong price is
 * visible in the order, a wrong dispatch is visible in the offer, a wrong
 * figure is recomputed from rows that still exist. A deletion leaves the
 * absence of evidence, which is indistinguishable from the thing never having
 * happened. So the evidence is written first, and it survives the run failing.
 *
 * THE FIVE RULES THIS FILE ENFORCES, EACH BY CONSTRUCTION RATHER THAN BY CARE
 * ---------------------------------------------------------------------------
 *  1. A table not declared `delete_after` is refused. `mayDelete` answers false
 *     for everything the declaration does not explicitly allow, including a
 *     table nobody has declared at all, so a new table is safe by default and
 *     loud on the board.
 *  2. Nothing runs inline. `plan` returns a manifest id and the caller enqueues
 *     `retention.sweep`. A retention pass that ran inside a request would be a
 *     retention pass whose progress dies with the request.
 *  3. Execute is a MODE holding an AUTHORITY that only `executeAuthority` can
 *     mint, and that function answers null unless the actor holds
 *     retention.execute and the gate is open. There is no boolean to forget.
 *  4. A source day is not deleted until its rollup exists AND equals the rows
 *     planned for that day. Proved during planning, recorded in the manifest.
 *  5. The batch loop is bounded and reconciled: the count it removed has to
 *     equal the count it said it would, or the run is failed with the
 *     difference named.
 *
 * IS_DEMO IS NOT A RETENTION RULE, AND THAT IS DELIBERATE
 * -------------------------------------------------------
 * Operator ruling. Demonstration data is scoped out of FIGURES, because a
 * seeded file must not appear in what the firm earned. It is not scoped out of
 * RETENTION, because how long a row is kept is a question about what the row
 * is, and a cron run is a cron run whoever caused it. A retention job that
 * swept demonstration rows early would be a job whose behaviour on real data
 * had never actually been exercised, which is the opposite of what a rehearsal
 * is for. Nothing below reads that column, and retention-audit asserts this
 * file never names it.
 */

/** How many rows one batch takes. Bounded so a run makes progress it can record. */
export const BATCH = 200;

/** How many batches one job attempt will take before yielding to a retry. */
export const MAX_BATCHES_PER_ATTEMPT = 25;

// ------------------------------------------------------------------ authority

declare const AUTHORITY: unique symbol;

/**
 * PROOF THAT SOMEBODY WHO MAY DELETE ASKED FOR THIS.
 *
 * The same construction as LicensedAction in ops-authz: not a check somebody
 * remembers to make, but a value that cannot be produced without making it.
 * `executeAuthority` is the only function in the codebase that returns one, and
 * an execute-mode run cannot be spelled without holding it.
 *
 * A boolean would have been one missing argument from a real deletion. This is
 * a type error instead.
 */
export type RetentionAuthority = {
  readonly [AUTHORITY]: true;
  actorId: string;
  actorEmail: string | null;
  actorRole: string;
};

/**
 * Mint the authority to delete, or answer null and say why.
 *
 * Two gates, and the second is the operator's prelaunch ruling: while the firm
 * is not trading, retention is a dry run and nothing else. The reason is that
 * the first production run of anything is the run nobody has read the output of
 * yet, and the output of this one is rows that are gone.
 */
export function executeAuthority(
  actor: Actor,
  /* The address is not on Actor: currentActor carries id, role, status and
   * grants, and nothing that identifies a person to a reader. The caller has
   * the profile in hand and passes it, so a manifest names somebody rather than
   * a uuid. Null is the honest answer when it does not. */
  actorEmail: string | null = null,
): { ok: true; authority: RetentionAuthority } | { ok: false; because: string } {
  if (isPrelaunch()) {
    return {
      ok: false,
      because:
        "The firm is prelaunch, so retention is dry run only. Operator ruling: the first run in a " +
        "given environment is a rehearsal somebody reads, and there is nothing here yet whose " +
        "deletion is worth the risk of finding out this way.",
    };
  }
  if (!actor.grants.has("retention.execute")) {
    return {
      ok: false,
      because:
        `${actor.role} does not hold retention.execute. It is the only permission in this platform ` +
        "that destroys a record, and it is held by the administrator alone.",
    };
  }
  return {
    ok: true,
    authority: {
      actorId: actor.id,
      actorEmail,
      actorRole: actor.role,
    } as RetentionAuthority,
  };
}

/**
 * The two ways a run can exist. There is no third and no default.
 *
 * A dry run still records who asked for it, because "who ran the rehearsal that
 * said this was safe" is a question somebody will ask after a real run.
 */
export type RetentionMode =
  | { kind: "dry_run"; askedBy: { id: string; email: string | null; role: string } | null }
  | { kind: "execute"; authority: RetentionAuthority };

// ------------------------------------------------------------------- planning

export type RollupDay = { day: string; planned: number; rollup: number | null };

export type Manifest = {
  id: string;
  table: string;
  rule: string;
  floorDays: number;
  ageColumn: string;
  cutoff: string;
  mode: "dry_run" | "execute";
  intendedCount: number;
  idLow: string | null;
  idHigh: string | null;
  idHash: string;
  rollupMetric: string | null;
  rollupDays: RollupDay[];
  status: "planned" | "running" | "complete" | "failed" | "abandoned";
  affectedCount: number;
  lastId: string | null;
  reconciled: boolean | null;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  plannedAtCt: string;
  note: string | null;
  /**
   * WHAT A READER WOULD OTHERWISE GET WRONG ABOUT THIS PARTICULAR MANIFEST.
   *
   * Operator ruling, gate 2. Four things in the first dry run invited a wrong
   * conclusion, every one was answered in a report nobody will open again, and
   * the manifest is the artefact a person actually reads. So the manifest
   * carries the explanation.
   *
   * Written at planning time and never overwritten by the run, because these
   * are statements about the PLAN. `note` is the outcome, written when the run
   * ends.
   */
  planReading: string[];
};

export type PlanResult = { ok: true; manifest: Manifest } | { ok: false; because: string };

const db = () => supabaseAdmin();

/** The id column of every table retention can touch. Named, never guessed. */
const ID_COLUMN = "id";

/** sha256 over the ids in a stable order. Two sets of the same size are not the same set. */
export function hashIds(ids: string[]): string {
  return createHash("sha256").update([...ids].sort().join("\n")).digest("hex");
}

/** The instant a floor of `days` puts the line at, as an ISO string. */
export function cutoffFor(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

type Row = Record<string, unknown>;

/**
 * One cast, in one place, and the reason it is unavoidable.
 *
 * The select list here is built from the DECLARATION, because the age column is
 * whatever retention-policy.ts says it is for that table. PostgREST's client
 * types parse the select string at compile time and can only do that for a
 * literal, so a computed one infers a parse error rather than a row shape.
 *
 * Writing the column as a literal would mean writing it twice, in the
 * declaration and here, and the second copy is the one that goes stale. The
 * cast is to the shape this file already states, and it sits at one boundary
 * rather than at every call site.
 */
const asRows = (q: unknown) =>
  q as PromiseLike<{ data: Row[] | null; count: number | null; error: { message: string } | null }>;

/**
 * Read every row the rule would take, and nothing else.
 *
 * `readEvery` rather than `readAll`, and the comment the ruling requires: this
 * set may never be partial. A retention plan built from the first thousand rows
 * would delete a thousand rows and report a complete pass, which is the exact
 * shape of failure the bounded read helper exists to stop, made permanent by a
 * DELETE at the end of it.
 */
async function planned(
  client: NonNullable<ReturnType<typeof supabaseAdmin>>,
  table: string,
  rule: Extract<RetentionRule, { kind: "delete_after" }>,
  cutoff: string,
) {
  return readEvery<Row>((from, to) => {
    let q = client
      .from(table)
      .select(`${ID_COLUMN}, ${rule.ageColumn}`)
      .lt(rule.ageColumn, cutoff)
      .order(ID_COLUMN, { ascending: true })
      .range(from, to);

    /*
     * The rows a rule protects whatever their age. Applied in the QUERY rather
     * than filtered afterwards, so a protected row is never in the planned set,
     * never in the hash and never in the count. A filter after the read would
     * make the manifest describe a set the delete does not match.
     */
    if (rule.neverDelete) q = q.not(rule.neverDelete.column, "in", `(${rule.neverDelete.values.join(",")})`);

    return asRows(q);
  });
}

const dayOf = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, 10) : "no date recorded";

/**
 * PLAN A RUN. TOUCHES NOTHING.
 *
 * Returns a manifest that has already been written to the database, or a reason
 * it refused. Every refusal below is a sentence somebody can act on rather than
 * a false, because "retention did nothing" with no explanation is how a floor
 * silently stops working.
 */
export async function planRetention(table: string, mode: RetentionMode): Promise<PlanResult> {
  const client = db();
  if (!client) return { ok: false, because: "The database is not configured." };

  const rule = ruleFor(table);
  if (!rule) {
    return {
      ok: false,
      because:
        `${table} is not named in retention-policy.ts. A table the declaration does not know about is ` +
        "refused rather than swept, and the board fails until somebody declares what it is.",
    };
  }
  if (rule.kind !== "delete_after") {
    return {
      ok: false,
      because:
        `${table} is declared ${rule.kind}, so retention never deletes from it. ` +
        (rule.kind === "kept_pending_counsel"
          ? "It is kept until counsel and TBPELS answer, and treated exactly as kept_forever until then."
          : "because" in rule
            ? rule.because
            : ""),
    };
  }

  const cutoff = cutoffFor(rule.floorDays);
  const read = await planned(client, table, rule, cutoff);
  if (!read.ok) return { ok: false, because: `Could not read what ${table} holds: ${read.error}` };

  const ids = read.rows.map((r) => String(r[ID_COLUMN]));
  const days = new Map<string, number>();
  for (const r of read.rows) days.set(dayOf(r[rule.ageColumn]), (days.get(dayOf(r[rule.ageColumn])) ?? 0) + 1);

  /*
   * THE ROLLUP GUARD. A SOURCE IS NEVER DELETED BEFORE THE THING THAT REPLACES
   * IT EXISTS AND AGREES WITH IT.
   *
   * Operator ruling. Per day, not per run: a run covering thirty days where
   * twenty nine rolled up and one did not must not take the twenty nine and
   * quietly lose the one. It refuses the whole plan and NAMES THE DAY, because
   * "the rollup did not reconcile" sends somebody looking through a month.
   */
  const rollupDays: RollupDay[] = [];
  if (rule.rollupRequired) {
    const wanted = [...days.keys()].filter((d) => d !== "no date recorded").sort();
    const held = new Map<string, number>();
    if (wanted.length > 0) {
      const { data, error } = await client
        .from("eng_metrics_daily")
        .select("day, value")
        .eq("metric", rule.rollupRequired)
        .in("day", wanted);
      if (error) return { ok: false, because: `Could not read the ${rule.rollupRequired} rollup: ${error.message}` };
      for (const r of data ?? []) held.set(r.day as string, Number(r.value));
    }

    for (const day of wanted) {
      const planned = days.get(day) ?? 0;
      const rollup = held.has(day) ? (held.get(day) as number) : null;
      rollupDays.push({ day, planned, rollup });

      if (rollup === null) {
        return {
          ok: false,
          because:
            `${day} has ${planned} row(s) in ${table} and no ${rule.rollupRequired} figure in ` +
            "eng_metrics_daily. The rollup that replaces this day does not exist yet, so the day is " +
            "not deleted. Run the metrics rollup for that day first.",
        };
      }
      if (rollup !== planned) {
        return {
          ok: false,
          because:
            `${day} does not reconcile: ${table} holds ${planned} row(s) for it and ` +
            `${rule.rollupRequired} says ${rollup}. The rollup and its source disagree, so nothing is ` +
            "deleted. Whichever is wrong, deleting the source would make the disagreement permanent.",
        };
      }
    }

    if (days.has("no date recorded")) {
      return {
        ok: false,
        because:
          `${days.get("no date recorded")} row(s) in ${table} matched the cutoff with no ` +
          `${rule.ageColumn}, so no day can be reconciled for them. A row with no age is not an old row.`,
      };
    }
  }

  /*
   * THE SENTENCES A READER NEEDS, DECIDED FROM THE PLAN ITSELF.
   *
   * Each one exists because somebody read a real manifest at gate 2 and drew
   * the wrong conclusion from it. They are conditions rather than boilerplate:
   * a manifest that cannot be misread in a given way does not carry the
   * sentence about it.
   */
  const reading: string[] = [];

  if (ids.length === 0) {
    reading.push(
      "EMPTY SET. Nothing is bounded: with no rows there is no id range, so the range on this " +
        "manifest constrains nothing. The hash is the sha256 of the empty string, which EVERY empty " +
        "plan carries, so another manifest with the same hash is not a duplicate of this one.",
    );

    /*
     * And the question anybody actually has about a zero: is the rule broken or
     * is the data young. Asked of the table at planning time, because the
     * answer changes daily and a reader a month from now needs it as it was.
     */
    const { data: oldest } = await client
      .from(table)
      .select(rule.ageColumn)
      .not(rule.ageColumn, "is", null)
      .order(rule.ageColumn, { ascending: true })
      .limit(1)
      .maybeSingle();

    /* Same computed-select cast as `asRows` above, and for the same reason:
     * the column name comes from the declaration, so the client's type parser
     * cannot see it. */
    const at = oldest ? (oldest as unknown as Row)[rule.ageColumn] : null;
    if (typeof at === "string") {
      const ageDays = Math.floor((Date.now() - Date.parse(at)) / 86_400_000);
      reading.push(
        `INTENDED COUNT IS ZERO AND THE RULE IS WORKING. The oldest ${rule.ageColumn} in ${table} is ` +
          `${ageDays} day(s) old and the floor is ${rule.floorDays}, so nothing has aged into the set yet.`,
      );
    } else {
      reading.push(
        `INTENDED COUNT IS ZERO because ${table} holds no row carrying a ${rule.ageColumn} at all, ` +
          "rather than because the rule failed to match.",
      );
    }
  }

  if (rule.rollupRequired && rollupDays.length === 0) {
    reading.push(
      `NO DAYS TO RECONCILE. The ${rule.rollupRequired} rollup guard ran and had nothing to check, ` +
        "because the planned set is empty. An absent list of days is not a guard that was skipped.",
    );
  }

  reading.push(
    `CUTOFF IS THIS PLAN'S OWN CLOCK less ${rule.floorDays} days. Two plans made in one pass carry ` +
      "cutoffs seconds apart, which is not an inconsistency between them.",
  );

  const actor =
    mode.kind === "execute"
      ? { id: mode.authority.actorId, email: mode.authority.actorEmail, role: mode.authority.actorRole }
      : mode.askedBy;

  const { data, error } = await client
    .from("eng_retention_runs")
    .insert({
      table_name: table,
      rule: rule.kind,
      floor_days: rule.floorDays,
      age_column: rule.ageColumn,
      cutoff,
      mode: mode.kind,
      intended_count: ids.length,
      id_low: ids.length > 0 ? ids[0] : null,
      id_high: ids.length > 0 ? ids[ids.length - 1] : null,
      id_hash: hashIds(ids),
      rollup_metric: rule.rollupRequired,
      rollup_days: rollupDays,
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      actor_role: actor?.role ?? null,
      plan_reading: reading.join("\n"),
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, because: `The manifest could not be written, so nothing was planned: ${error?.message ?? "no row returned"}` };
  }

  return { ok: true, manifest: toManifest(data) };
}

function toManifest(r: Row): Manifest {
  return {
    id: String(r.id),
    table: String(r.table_name),
    rule: String(r.rule),
    floorDays: Number(r.floor_days),
    ageColumn: String(r.age_column),
    cutoff: String(r.cutoff),
    mode: r.mode as "dry_run" | "execute",
    intendedCount: Number(r.intended_count),
    idLow: r.id_low === null ? null : String(r.id_low),
    idHigh: r.id_high === null ? null : String(r.id_high),
    idHash: String(r.id_hash),
    rollupMetric: r.rollup_metric === null ? null : String(r.rollup_metric),
    rollupDays: Array.isArray(r.rollup_days) ? (r.rollup_days as RollupDay[]) : [],
    status: r.status as Manifest["status"],
    affectedCount: Number(r.affected_count),
    lastId: r.last_id === null ? null : String(r.last_id),
    reconciled: r.reconciled === null ? null : Boolean(r.reconciled),
    actorId: r.actor_id === null || r.actor_id === undefined ? null : String(r.actor_id),
    actorEmail: r.actor_email === null || r.actor_email === undefined ? null : String(r.actor_email),
    actorRole: r.actor_role === null || r.actor_role === undefined ? null : String(r.actor_role),
    plannedAtCt: String(r.planned_at_ct),
    planReading:
      typeof r.plan_reading === "string" && r.plan_reading.trim() ? r.plan_reading.split("\n") : [],
    note: r.note === null ? null : String(r.note),
  };
}

/** Read one manifest back. The job runs from this and from nothing else. */
export async function manifestById(id: string): Promise<Manifest | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client.from("eng_retention_runs").select("*").eq("id", id).maybeSingle();
  return data ? toManifest(data as Row) : null;
}

/** The runs on a table, newest first, for the operator's screen and for the audit. */
export async function recentRuns(table?: string, limit = 20): Promise<Manifest[]> {
  const client = db();
  if (!client) return [];
  let q = client.from("eng_retention_runs").select("*").order("planned_at", { ascending: false }).limit(limit);
  if (table) q = q.eq("table_name", table);
  const { data } = await q;
  return (data ?? []).map((r) => toManifest(r as Row));
}

// ----------------------------------------------------------------- the run

export type RunReport = {
  manifestId: string;
  table: string;
  mode: "dry_run" | "execute";
  intended: number;
  affected: number;
  reconciled: boolean;
  finished: boolean;
  note: string;
  /*
   * WHO AUTHORISED IT, CARRIED THROUGH TO THE AUDIT TRAIL.
   *
   * The manifest knew this and the trail row did not, which is backwards: for
   * the one action in this platform that destroys a record, the regulatory
   * memory is the place that most needs the name. Found by reading
   * eng_audit_events beside eng_retention_runs and noticing the trail said
   * actor_id null while the manifest beside it named somebody.
   */
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
};

export type RunResult = { ok: true; report: RunReport } | { ok: false; because: string; retryable: boolean };

/**
 * DO WHAT THE MANIFEST SAYS, AND NOTHING THE MANIFEST DOES NOT SAY.
 *
 * Called only by the retention.sweep handler. It reads the plan back rather
 * than being handed one, so the thing that is executed is the thing that was
 * written down and survived a crash, not a value carried through memory.
 *
 * RESUME, AND WHY THE HASH IS CHECKED ONCE
 * -----------------------------------------
 * On a fresh run the ids still matching the plan are hashed and compared to the
 * manifest. A mismatch means the set moved between planning and running, and
 * the run refuses: the manifest would then describe rows other than the ones
 * about to go.
 *
 * On a RESUME the set has legitimately shrunk, by exactly the rows this run
 * already took, so that hash cannot match and checking it would make every
 * resume impossible. What holds instead is narrower and still sufficient: the
 * cutoff, the never-delete rule and the id range are all replayed from the
 * manifest, so the remaining set is a subset of the planned one by
 * construction, and the total is reconciled against intended_count at the end.
 * The manifest says so in its note rather than leaving the next reader to work
 * out why one check runs and the other does not.
 */
export async function runRetention(manifestId: string): Promise<RunResult> {
  const client = db();
  if (!client) return { ok: false, because: "The database is not configured.", retryable: true };

  const manifest = await manifestById(manifestId);
  if (!manifest) return { ok: false, because: `No retention manifest ${manifestId}.`, retryable: false };

  if (manifest.status === "complete") {
    return {
      ok: true,
      report: {
        manifestId, table: manifest.table, mode: manifest.mode,
        intended: manifest.intendedCount, affected: manifest.affectedCount,
        reconciled: manifest.reconciled === true, finished: true,
        actorId: manifest.actorId, actorEmail: manifest.actorEmail, actorRole: manifest.actorRole,
        note: "Already complete. A second attempt at a finished run is a no operation rather than a second sweep.",
      },
    };
  }

  if (manifest.status === "abandoned") {
    return {
      ok: false,
      because:
        `${manifestId} was abandoned without running, and an abandoned plan is not one waiting to be ` +
        `picked up. ${manifest.note ?? ""}`.trim(),
      retryable: false,
    };
  }

  const rule = ruleFor(manifest.table);
  if (!rule || rule.kind !== "delete_after") {
    return {
      ok: false,
      because:
        `${manifest.table} was planned as deletable and the declaration now says ` +
        `${rule?.kind ?? "nothing at all"}. The declaration wins and this run is abandoned.`,
      retryable: false,
    };
  }

  const resuming = manifest.affectedCount > 0;
  await client.from("eng_retention_runs").update({ status: "running" }).eq("id", manifestId);

  // The set as it stands now, replayed from the manifest rather than recomputed.
  const read = await readEvery<Row>((from, to) => {
    let q = client
      .from(manifest.table)
      .select(ID_COLUMN)
      .lt(manifest.ageColumn, manifest.cutoff)
      .order(ID_COLUMN, { ascending: true })
      .range(from, to);
    if (manifest.idLow !== null) q = q.gte(ID_COLUMN, manifest.idLow);
    if (manifest.idHigh !== null) q = q.lte(ID_COLUMN, manifest.idHigh);
    if (rule.neverDelete) q = q.not(rule.neverDelete.column, "in", `(${rule.neverDelete.values.join(",")})`);
    return asRows(q);
  });

  if (!read.ok) return { ok: false, because: `Could not re-read the planned set: ${read.error}`, retryable: true };

  const ids = read.rows.map((r) => String(r[ID_COLUMN]));

  if (!resuming && hashIds(ids) !== manifest.idHash) {
    await fail(
      client,
      manifestId,
      `The set moved between planning and running: the manifest hashes ${manifest.intendedCount} id(s) ` +
        `and the same query now returns ${ids.length}. Nothing was deleted. Plan again.`,
    );
    return {
      ok: false,
      because: `The planned set no longer matches its hash. Nothing was deleted. Plan again.`,
      retryable: false,
    };
  }

  let affected = manifest.affectedCount;
  let lastId = manifest.lastId;
  const remaining = [...ids];

  for (let batch = 0; batch < MAX_BATCHES_PER_ATTEMPT && remaining.length > 0; batch += 1) {
    const slice = remaining.splice(0, BATCH);

    if (manifest.mode === "execute") {
      const { error } = await client.from(manifest.table).delete().in(ID_COLUMN, slice);
      if (error) {
        await fail(client, manifestId, `Batch ${batch + 1} failed after ${affected} row(s): ${error.message}`);
        return { ok: false, because: error.message, retryable: true };
      }
    }
    /*
     * A dry run counts and records the same way, and skips exactly one line. It
     * is not a different code path: a rehearsal that took a different route
     * through this function would prove nothing about the run it rehearses.
     */

    affected += slice.length;
    lastId = slice[slice.length - 1];

    /*
     * Progress written after EVERY batch, not at the end. This is what makes a
     * killed run resumable rather than a run whose work is invisible.
     */
    await client
      .from("eng_retention_runs")
      .update({ affected_count: affected, last_id: lastId })
      .eq("id", manifestId);
  }

  if (remaining.length > 0) {
    return {
      ok: false,
      because:
        `${affected} of ${manifest.intendedCount} done, ${remaining.length} still to go. The attempt ` +
        "yielded rather than running unbounded; the retry resumes from the manifest.",
      retryable: true,
    };
  }

  const reconciled = affected === manifest.intendedCount;
  const note = reconciled
    ? `${manifest.mode === "execute" ? "Deleted" : "Would have deleted"} ${affected} row(s) from ` +
      `${manifest.table} older than ${manifest.cutoff}, which is exactly what the manifest intended.` +
      (resuming ? " Resumed from a previous attempt, so the id hash was not re-checked; the range, the cutoff and the never-delete rule were replayed from the manifest and the total reconciles." : "")
    : `INTENDED ${manifest.intendedCount} AND ${manifest.mode === "execute" ? "DELETED" : "COUNTED"} ${affected}. ` +
      `The difference is ${manifest.intendedCount - affected} row(s), which means something else changed ` +
      `${manifest.table} between the plan and the run. The rows that did go are recorded; the discrepancy is not resolved here.`;

  await client
    .from("eng_retention_runs")
    .update({
      status: reconciled ? "complete" : "failed",
      affected_count: affected,
      last_id: lastId,
      reconciled,
      finished_at: new Date().toISOString(),
      note,
    })
    .eq("id", manifestId);

  return {
    ok: true,
    report: {
      manifestId, table: manifest.table, mode: manifest.mode,
      intended: manifest.intendedCount, affected, reconciled, finished: true, note,
      actorId: manifest.actorId, actorEmail: manifest.actorEmail, actorRole: manifest.actorRole,
    },
  };
}

async function fail(
  client: NonNullable<ReturnType<typeof supabaseAdmin>>,
  id: string,
  note: string,
): Promise<void> {
  await client
    .from("eng_retention_runs")
    .update({ status: "failed", reconciled: false, finished_at: new Date().toISOString(), note })
    .eq("id", id);
}

/**
 * A PLAN NOBODY RAN, CLOSED OUT RATHER THAN LEFT STANDING.
 *
 * Operator ruling, gate 2. A manifest at `planned` is a deletion that is still
 * intended, and anything that plans in order to prove a refusal leaves one
 * behind: retention-audit plans six times a run and a readout script left two
 * more. Development held ten, each reading as a sweep waiting to happen.
 *
 * It is an UPDATE, which this table allows and always has. DELETE is what it
 * refuses, and a manifest nobody will act on is exactly the row that would
 * otherwise tempt somebody into removing one.
 *
 * It refuses to touch a run that actually happened. A complete or failed
 * manifest is the record of something, and abandoning it would overwrite that
 * record with a claim that nothing was attempted.
 */
export async function abandonRun(
  manifestId: string,
  because: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const client = db();
  if (!client) return { ok: false, error: "The database is not configured." };
  if (!because.trim()) return { ok: false, error: "Abandoning a plan requires a reason." };

  const manifest = await manifestById(manifestId);
  if (!manifest) return { ok: false, error: `No retention manifest ${manifestId}.` };
  if (manifest.status === "abandoned") return { ok: true, already: true };
  if (manifest.status !== "planned") {
    return {
      ok: false,
      error:
        `${manifestId} is ${manifest.status}, so it is the record of something that happened. Only a ` +
        "plan nobody ran can be abandoned.",
    };
  }

  const { error } = await client
    .from("eng_retention_runs")
    .update({
      status: "abandoned",
      finished_at: new Date().toISOString(),
      note: `Abandoned without running: ${because}`,
    })
    .eq("id", manifestId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, already: false };
}

/** The manifests still standing at `planned`, which nothing should leave behind. */
export async function stillPlanned(actorRole?: string): Promise<Manifest[]> {
  const client = db();
  if (!client) return [];
  let q = client.from("eng_retention_runs").select("*").eq("status", "planned");
  if (actorRole) q = q.eq("actor_role", actorRole);
  const { data } = await q;
  return (data ?? []).map((r) => toManifest(r as Row));
}

/** Every table the declaration allows a run against, for a screen or a sweep. */
export function sweepable(): string[] {
  return deletableEntries().map((e) => e.table);
}
