/**
 * THE CREDENTIAL TASK REFRESH RUNS EVERY DAY, AND IT RAISES AND CLOSES.
 * Operator ruling, 2026-10-08.
 *
 *   npx tsx --conditions=react-server scripts/proofs/credential-tasks-refresh-every-day.mjs
 *
 * Until that day refreshCredentialTasks ran only from the tasks screen's seed
 * button, which shows only until the first seed, and nothing scheduled it. The
 * screen told the operator these tasks closed themselves; they did not.
 *
 * TWO HALVES.
 *
 * 1. IT HAS A SCHEDULED CALLER, read from the source rather than trusted: the
 *    daily cron is scheduled in vercel.json, /api/cron/daily queues
 *    credentials.refresh_tasks, and job-handlers registers that kind with a run
 *    that calls refreshCredentialTasks. Each link is a separate check, so the
 *    one that breaks names itself. This half needs nothing and always runs.
 *
 * 2. IT RAISES AND CLOSES, on DEVELOPMENT only, against a probe technician
 *    whose credentials are recorded through recordCredential, the screen's own
 *    server function: an expiring driver license raises a task; a second run
 *    raises no duplicate; a verified replacement expiring 45 or more days out
 *    closes it on the next run. The refresh walks every technician, so other
 *    development rows may gain or close tasks too; only the probe's key is
 *    asserted. Nothing is emailed or texted: the tasks are unassigned and the
 *    refresh notifies nobody. The probes and the probe's tasks are removed and
 *    read back, and every removal error is printed.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const code = (p) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

// ---------------------------------------------------------------- 1. the caller
{
  const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? [];
  const daily = crons.find((c) => c.path === "/api/cron/daily");
  check("the daily cron is scheduled in vercel.json", Boolean(daily?.schedule), daily ? daily.schedule : "no /api/cron/daily entry");

  const route = code("src/app/api/cron/daily/route.ts");
  check(
    "and /api/cron/daily queues credentials.refresh_tasks",
    /enqueue\(\s*"credentials\.refresh_tasks"/.test(route),
    "the route enqueues the kind by name",
  );

  const handlers = code("src/lib/job-handlers.ts");
  const start = handlers.indexOf('registerJob("credentials.refresh_tasks"');
  const end = start < 0 ? -1 : handlers.indexOf("registerJob(", start + 10);
  const body = start < 0 ? "" : handlers.slice(start, end < 0 ? undefined : end);
  check("and that kind is registered", start >= 0);
  check("and its run calls refreshCredentialTasks", /refreshCredentialTasks\(/.test(body));
}

// ------------------------------------------------------------- 2. it works
const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the credential task refresh proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so the raise and close half did not run.");
} else {
  if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");
  const { refreshCredentialTasks } = await import("../../src/lib/ops-tasks.ts");
  const { recordCredential } = await import("../../src/lib/ops-onboarding.ts");
  const { destroyProbes } = await import("../lib/portal-probe.mjs");

  const STAMP = Date.now();
  const made = [];
  const keys = [];
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  async function probe(role) {
    const email = `credtasks-${role}-${STAMP}@audit-probe.invalid`;
    const { data, error } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
    if (error || !data?.user) throw new Error(`createUser ${role}: ${error?.message}`);
    const { error: pErr } = await db.from("eng_profiles").insert({
      id: data.user.id, email, display_name: `Credential task proof ${role}, not a real person`,
      role, status: "active", is_demo: true,
    });
    if (pErr) throw new Error(`profile ${role}: ${pErr.message}`);
    made.push(data.user.id);
    const { data: row } = await db.from("eng_profiles").select("*").eq("id", data.user.id).single();
    const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", role);
    return { ...row, grants: new Set((grants ?? []).map((g) => g.action)) };
  }
  const taskFor = async (key) => {
    const { data, error } = await db.from("eng_tasks").select("id, status, created_by").eq("source_key", key);
    if (error) throw new Error(`reading ${key}: ${error.message}`);
    return data ?? [];
  };

  try {
    const admin = await probe("admin");
    const tech = await probe("field_tech");
    const LABEL = "Credential task proof, no document";

    const old = await recordCredential(admin, tech.id, { kind: "drivers_license", label: LABEL, issuedOn: day(-1000), expiresOn: day(20) });
    if (!old.ok) throw new Error(`recording the expiring license: ${old.error}`);
    const oldKey = `credential:${old.id}`;
    keys.push(oldKey);

    const first = await refreshCredentialTasks(null);
    const raised = await taskFor(oldKey);
    check("a license expiring in 20 days raises a task", raised.length === 1 && raised[0].status !== "done", `${raised.length} task(s), ${raised[0]?.status ?? "none"}`);
    check("raised by the platform, with no creator row", raised[0]?.created_by === null, String(raised[0]?.created_by));
    check("and the run reported no fault", first.faults.length === 0, first.faults.slice(0, 2).join("; ") || `${first.raised} raised, ${first.closed} closed`);

    await refreshCredentialTasks(null);
    check("a second run raises no duplicate", (await taskFor(oldKey)).length === 1, `${(await taskFor(oldKey)).length} task(s)`);

    const replacement = await recordCredential(admin, tech.id, { kind: "drivers_license", label: LABEL, issuedOn: day(0), expiresOn: day(60) });
    if (!replacement.ok) throw new Error(`recording the replacement: ${replacement.error}`);
    keys.push(`credential:${replacement.id}`);
    const third = await refreshCredentialTasks(null);
    const after = await taskFor(oldKey);
    check(
      "a verified replacement 60 days out closes it on the next run",
      after.length === 1 && after[0].status === "done",
      `${after[0]?.status ?? "none"}`,
    );
    check("and raises nothing for the replacement", (await taskFor(`credential:${replacement.id}`)).length === 0);
    check("and that run reported no fault", third.faults.length === 0, third.faults.slice(0, 2).join("; "));
  } catch (e) {
    wrong += 1;
    console.log(`  FAIL: the proof could not complete (${e.message})`);
  } finally {
    for (const key of keys) {
      const { error } = await db.from("eng_tasks").delete().eq("source_key", key);
      if (error) console.log(`  TEARDOWN FAULT: task ${key}: ${error.code ?? ""} ${error.message}`);
    }
    const swept = await destroyProbes("credential-task-proof");
    let left = 0;
    for (const id of made) {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user) left += 1;
    }
    let tasksLeft = 0;
    for (const key of keys) tasksLeft += (await taskFor(key).catch(() => [1])).length;
    check("the probes and their tasks are removed, read back", left === 0 && swept.ok && tasksLeft === 0, `${left} account(s), ${tasksLeft} task(s) left`);
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the credential task refresh is scheduled daily, and it raises and closes.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
