/**
 * A FAILED READ OPENS NO GATE.
 *
 *   node scripts/proofs/a-failed-read-opens-no-gate.mjs
 *
 * Operator ruling, 2026-10-15, on the survey of discarded errors
 * (docs/audit-2026-10/SURVEY-discarded-errors-2026-10-15.md on the audit
 * branch). Three gates read a failed read as the safe answer:
 *
 *   1. refuseIfOutwardWorkIsWaiting read a failed list of live outward jobs as
 *      none, so a script went on to run a worker that could send real email.
 *   2. queue-audit read a failed count of the same jobs as zero, and printed
 *      the PASS of the check that stands between an audit and real email.
 *   3. seed-admin read a failed count of administrators as none, and went on to
 *      create one. It is the one script that runs against production.
 *
 * Each is driven here with its read made to fail, and each must refuse. Each is
 * also driven with a read that succeeds, so a gate that refused everything
 * would not pass either. Nothing here touches a database: the first two take a
 * stand-in client, and seed-admin is pointed at a local server that fails every
 * request and counts them.
 */
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const { refuseIfOutwardWorkIsWaiting, countLiveOutward } = await import("../lib/queue-drain.mjs");
const { COULD_NOT_TELL } = await import("../lib/reachable.mjs");

/** A client whose every query, however it is built, answers `result`. */
function standIn(result) {
  const chain = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (ok, bad) => Promise.resolve(result).then(ok, bad);
        return () => chain;
      },
    },
  );
  return { from: () => chain };
}
const FAILED = { data: null, count: null, error: { message: "the proof failed this read" } };

/* The child half: refuseIfOutwardWorkIsWaiting exits the process when it refuses. */
if (process.argv[2] === "drain-child") {
  const db = standIn(process.argv[3] === "fail" ? FAILED : { data: [], error: null });
  const r = await refuseIfOutwardWorkIsWaiting({ db, outwardKinds: ["email.send"], label: "this proof" });
  console.log(`RETURNED ${JSON.stringify(r)}`);
  process.exit(0);
}

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const SELF = fileURLToPath(import.meta.url);

/* ===================== 1. the refusal before a worker runs ===================== */
{
  const failed = spawnSync(process.execPath, [SELF, "drain-child", "fail"], { encoding: "utf8" });
  check(
    "a worker is refused when the live outward jobs cannot be read",
    failed.status === COULD_NOT_TELL && failed.stdout.includes("REFUSED TO START") && !failed.stdout.includes("RETURNED"),
    `exit ${failed.status}; ${failed.stdout.trim().split("\n").filter(Boolean).slice(-1)[0] ?? ""}`,
  );
  const empty = spawnSync(process.execPath, [SELF, "drain-child", "empty"], { encoding: "utf8" });
  check(
    "and is let through when they are read and there are none",
    empty.status === 0 && empty.stdout.includes('RETURNED {"ok":true'),
    `exit ${empty.status}; ${empty.stdout.trim()}`,
  );
}

/* ===================== 2. queue-audit's count of the same jobs ===================== */
{
  const failed = await countLiveOutward({ db: standIn(FAILED), outwardKinds: ["email.send"] });
  check("a count that failed is not counted, and is never zero", failed.counted === false && !("count" in failed), JSON.stringify(failed));
  const none = await countLiveOutward({ db: standIn({ count: 0, error: null }), outwardKinds: ["email.send"] });
  check("and a count that came back zero is counted as zero", none.counted === true && none.count === 0, JSON.stringify(none));
}

/* ===================== 3. seed-admin against a database that fails ===================== */
{
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url.split("?")[0]}`);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "PROOF", message: "the proof failed this read", details: null, hint: null }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  /* Asynchronous, because the server answering it lives in this process. */
  const child = spawn(
    process.execPath,
    ["scripts/seed-admin.mjs", "Seed Admin Proof, not a real person", "seed-admin-proof@audit-probe.invalid"],
    {
      env: {
        ...process.env,
        SUPABASE_URL: `http://127.0.0.1:${port}`,
        SUPABASE_SERVICE_ROLE_KEY: "proof-stand-in",
        ALLOW_PRODUCTION_DB: "",
      },
    },
  );
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b));
  child.stdout.on("data", (b) => (stderr += b));
  const status = await new Promise((resolve) => child.on("close", resolve));
  server.close();

  check(
    "seed-admin stops when the administrators on file cannot be counted",
    status === 1 && stderr.includes("could not be counted") && stderr.includes("Nothing was created"),
    `exit ${status}; ${stderr.trim().split("\n").slice(-1)[0] ?? ""}`,
  );
  check(
    "and asks nothing after the count",
    seen.length === 1 && seen[0].endsWith("/rest/v1/eng_profiles"),
    seen.join(", ") || "no request reached the stand-in",
  );
}

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a failed read refuses at all three gates, and a read that succeeds is let through.");
