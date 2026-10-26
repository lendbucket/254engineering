// @runtime react-server
//
// Declared because it imports src/lib/ops-observability.ts, which carries server-only.

/**
 * A DAILY CRON IS SEEN PAST A CRON THAT RUNS EVERY MINUTE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-daily-cron-is-seen-past-a-busy-cron.mjs
 *
 * Section 6 of Robert's audit of 2026-10-24 (class B, severity 2): cronStates
 * read the newest 500 runs across every cron, and the job worker writes one a
 * minute, so the daily rollup's run fell out of the window and the status page
 * read it as never run. Every migration is replayed into PGlite and served as
 * PostgREST (scripts/lib/replay-rest.mjs), so the real filters answer: 600
 * runs of the job worker, newer than one daily run, and the daily cron must
 * still show its run. Nothing reaches development.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

/* The daily rollup ran and succeeded two hours ago; the job worker has run 600 times since. */
await db.exec(`
  insert into eng_cron_runs (name, started_at, finished_at, ok)
    values ('daily', now() - interval '2 hours', now() - interval '2 hours' + interval '30 seconds', true);
  insert into eng_cron_runs (name, started_at, finished_at, ok)
    select 'jobs', now() - (g || ' seconds')::interval, now() - (g || ' seconds')::interval + interval '1 second', true
      from generate_series(1, 600) g;
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
try {
  const { cronStates } = await import("../../src/lib/ops-observability.ts");
  const states = await cronStates();
  check("the cron states read", Array.isArray(states), JSON.stringify(states)?.slice(0, 120));
  const daily = states?.find((s) => s.name === "daily");
  const jobs = states?.find((s) => s.name === "jobs");
  const watch = states?.find((s) => s.name === "health-watch");
  check("the daily rollup's run is seen past 600 newer runs of the job worker", Boolean(daily?.lastSuccessAt) && Boolean(daily?.lastStartedAt), JSON.stringify(daily));
  check("and it reads as recent, not never run", daily?.minutesSinceSuccess !== null && daily.minutesSinceSuccess >= 119 && daily.minutesSinceSuccess <= 121, `${daily?.minutesSinceSuccess}`);
  check("the job worker shows its newest run", jobs?.minutesSinceSuccess !== null && jobs.minutesSinceSuccess <= 1, `${jobs?.minutesSinceSuccess}`);
  check("and a cron with no run at all still reads as never run", watch?.lastStartedAt === null && watch?.lastSuccessAt === null, JSON.stringify(watch));
} finally {
  await rest.close();
}
await db.close();

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a daily cron is seen past a cron that runs every minute.");
