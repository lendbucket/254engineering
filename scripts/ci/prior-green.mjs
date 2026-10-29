/**
 * A PUSH TO MAIN WHOSE EXACT COMMIT ALREADY HAS A GREEN BOARD IS NOT BOARDED
 * AGAIN. Ruled 2026-10-22, built 2026-10-29 (BACKLOG, "A PUSH TO MAIN RE-BOARDS
 * A COMMIT THAT ALREADY HAS A GREEN BOARD").
 *
 *   node scripts/ci/prior-green.mjs <verdict-prior.json>
 *
 * Moving main to c063762 started run 39879066187 on the exact commit run
 * 39872774654 had just passed, and its writers shard would have held
 * development past a production sitting. The rule: the board skips such a
 * push and names the earlier run. SAME COMMIT ONLY, as ruled. A different
 * commit is boarded even when its tree is identical, which is every --no-ff
 * merge: the merge commit is never the commit a board measured, and that is
 * the ruling, not an oversight.
 *
 * FAILS CLOSED. Any API error, any missing field, any doubt: the board runs.
 * A prior run counts only if it completed with success AND every job a real
 * board has (build, preflight, each declared shard, board) concluded success.
 * A run that was itself skipped has skipped shards, so it never counts, and a
 * skip can never be the evidence for another skip.
 *
 * Writes `skip=true|false` and `run=<id>` to $GITHUB_OUTPUT, and a verdict file
 * the board job reads, so the summary says "skipped" and never reads like a pass
 * of this run.
 */
import { writeFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SHARDS } from "./shards.mjs";

/** The job names a complete board run has, as GitHub reports them. */
export const REQUIRED_JOBS = ["build", "preflight", ...Object.keys(SHARDS).map((s) => `shard ${s}`), "board"];

/**
 * Pure: whether this push may skip its board.
 *
 * input: { event, ref, sha, currentRunId, runs, error }
 *   runs: [{ id, headSha, status, conclusion, jobs: [{ name, conclusion }] }]
 * returns: { skip, run, reason }
 */
export function decideSkip({ event, ref, sha, currentRunId, runs, error }) {
  const board = (reason) => ({ skip: false, run: null, reason });
  if (error) return board(`the earlier runs could not be read (${error}), so this commit is boarded`);
  if (event !== "push" || ref !== "refs/heads/main") return board("not a push to main");
  if (typeof sha !== "string" || sha.length < 40) return board("this run's commit is unknown");
  if (!Array.isArray(runs)) return board("the earlier runs could not be read, so this commit is boarded");
  const complete = (r) => {
    if (!Array.isArray(r.jobs)) return false;
    return REQUIRED_JOBS.every((name) => {
      const jobs = r.jobs.filter((j) => j.name === name);
      return jobs.length > 0 && jobs.every((j) => j.conclusion === "success");
    });
  };
  const eligible = runs.filter(
    (r) => r && r.id !== currentRunId && r.headSha === sha && r.status === "completed" && r.conclusion === "success" && complete(r),
  );
  if (eligible.length === 0) return board("no earlier board of this exact commit passed in full");
  const newest = eligible.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));
  return { skip: true, run: newest.id, reason: `skipped: the same commit passed on run ${newest.id}` };
}

async function readRuns({ repo, sha, token }) {
  const api = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path.split("?")[0]}`);
    return res.json();
  };
  const list = await api(`/actions/workflows/board.yml/runs?head_sha=${sha}&status=completed&per_page=100`);
  if (!Array.isArray(list.workflow_runs)) throw new Error("no workflow_runs in the answer");
  const runs = [];
  for (const r of list.workflow_runs) {
    const jobs = await api(`/actions/runs/${r.id}/jobs?per_page=100`);
    if (!Array.isArray(jobs.jobs)) throw new Error(`no jobs for run ${r.id}`);
    runs.push({
      id: r.id,
      headSha: r.head_sha,
      status: r.status,
      conclusion: r.conclusion,
      jobs: jobs.jobs.map((j) => ({ name: j.name, conclusion: j.conclusion })),
    });
  }
  return runs;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = process.argv[2];
  const env = process.env;
  let runs = null;
  let error = null;
  if (env.GITHUB_EVENT_NAME === "push" && env.GITHUB_REF === "refs/heads/main") {
    try {
      runs = await readRuns({ repo: env.GITHUB_REPOSITORY, sha: env.GITHUB_SHA, token: env.GITHUB_TOKEN });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  const decision = decideSkip({
    event: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    sha: env.GITHUB_SHA,
    currentRunId: Number(env.GITHUB_RUN_ID),
    runs: runs ?? [],
    error,
  });
  console.log(decision.skip ? decision.reason.toUpperCase() : `boarded: ${decision.reason}`);
  if (out) writeFileSync(out, JSON.stringify({ shard: "prior", ...decision, commit: env.GITHUB_SHA ?? null }, null, 2));
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `skip=${decision.skip ? "true" : "false"}\nrun=${decision.run ?? ""}\n`);
}
