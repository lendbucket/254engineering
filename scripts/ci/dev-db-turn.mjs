/**
 * THE WRITER SHARD WAITS ITS TURN ON THE DEVELOPMENT DATABASE.
 * Operator ruling, 2026-10-22: parallel jobs share the development database,
 * and audits that create fixtures must not collide.
 *
 *   node scripts/ci/dev-db-turn.mjs <owner/repo> <this run id>
 *
 * Every run's writer shard is the same job, named WRITER_JOB, and its first
 * step after setup is WAIT_STEP, which is this script. A run holds the database
 * from the moment its WAIT_STEP succeeds until its writer job completes. So
 * this script proceeds only when no other in-progress run:
 *
 *   - is HOLDING: its WAIT_STEP succeeded and its writer job is not complete; or
 *   - is EARLIER IN LINE: its writer job has started and its run id is lower,
 *     whatever its step statuses say (they are reported late; see below).
 *
 * and it must find that true twice, 45 seconds apart. Run ids only grow, so the
 * line is first come first served, and two runs that both see each other
 * resolve the same way from both ends. A cancelled
 * or crashed run's job is complete, so nothing is ever left holding a stale
 * lock to reap.
 *
 * WHY NOT GITHUB'S `concurrency`. A concurrency group keeps one run going and at
 * most ONE pending, and cancels any earlier pending run when another arrives.
 * Four ordering pieces boarded at once would lose two boards silently.
 *
 * WHAT IT DOES NOT COVER, said rather than implied: a run on the operator's PC.
 * That holds the machine lock, which no runner can see. A local perf run while
 * a cloud writer shard runs would sweep each other's probes.
 */
const WRITER_JOB = "shard writers";
const WAIT_STEP = "Wait for the development database";
const POLL_MS = 120_000; // GITHUB_TOKEN allows 1000 calls an hour per repository; four waiters stay well under it.
const GIVE_UP_MS = 5.5 * 60 * 60 * 1000;
const SETTLE_MS = 45_000;

const [repo, runIdArg] = process.argv.slice(2);
const me = Number(runIdArg);
const token = process.env.GITHUB_TOKEN;
if (!repo || !me || !token) {
  console.log("REFUSED: usage is dev-db-turn.mjs <owner/repo> <run id>, with GITHUB_TOKEN set.");
  process.exit(1);
}

async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
  });
  if (!r.ok) throw new Error(`GitHub answered ${r.status} for ${path.split("?")[0]}`);
  return r.json();
}

async function blockers() {
  const { workflow_runs: runs } = await gh("actions/runs?status=in_progress&per_page=100");
  const found = [];
  for (const run of runs) {
    if (run.id === me) continue;
    const { jobs } = await gh(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    const writer = jobs.find((j) => j.name === WRITER_JOB);
    if (!writer || writer.status !== "in_progress") continue;
    const wait = (writer.steps ?? []).find((s) => s.name === WAIT_STEP);
    if (wait && wait.status === "completed" && wait.conclusion === "success") {
      found.push(`run ${run.id} on ${run.head_branch} holds the database`);
    } else if (run.id < me) {
      /*
       * AHEAD IN LINE WHATEVER ITS STEPS SAY. The first version counted a lower
       * run only when its wait step read in_progress, and GitHub reports step
       * status late: on 2026-10-22 two writer shards each read the other's
       * wait step as not yet running and both went ahead, on one database.
       * A lower run whose writer job has started is ahead, full stop.
       */
      found.push(`run ${run.id} on ${run.head_branch} is ahead in line`);
    }
  }
  return found;
}

const started = Date.now();
for (;;) {
  let waitingOn;
  try {
    waitingOn = await blockers();
  } catch (err) {
    /* Unknown is not "free". A failed read waits and asks again. */
    waitingOn = [`could not read the other runs (${err.message}), so this waits rather than assuming the database is free`];
  }
  if (waitingOn.length === 0) {
    /*
     * CLEAR TWICE, 45 SECONDS APART, before taking the turn, so a run whose
     * writer job started a moment ago and is not yet visible to the API is
     * seen on the second look. The lag is what let two writers in at once.
     */
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    let again;
    try {
      again = await blockers();
    } catch (err) {
      again = [`could not read the other runs on the second look (${err.message})`];
    }
    if (again.length === 0) {
      console.log(`Run ${me} has the development database after ${Math.round((Date.now() - started) / 60000)} minute(s), clear on two looks.`);
      break;
    }
    waitingOn = again;
  }
  if (Date.now() - started > GIVE_UP_MS) {
    console.log(`Gave up after 5.5 hours waiting on: ${waitingOn.join("; ")}`);
    process.exit(1);
  }
  console.log(`waiting: ${waitingOn.join("; ")}. Asking again in ${POLL_MS / 60000} minutes.`);
  await new Promise((r) => setTimeout(r, POLL_MS));
}
