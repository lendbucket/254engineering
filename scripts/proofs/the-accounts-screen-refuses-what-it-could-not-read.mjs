/**
 * PROOF: THE ACCOUNTS SCREEN REFUSES WHAT IT COULD NOT READ.
 *
 * Operator ruling, 2026-09-24: chunk the `.in()` reads, and a failed read must
 * fail loudly rather than become zeros.
 *
 * =============================================================================
 * WHAT WAS WRONG, MEASURED RATHER THAN ARGUED
 * =============================================================================
 *
 * `accountRows()` passed every account id into four `.in()` filters at once.
 * Measured against development, one filter, ids sliced:
 *
 *     in(300):    145ms  filter 11099 chars  ok
 *     in(400):   8116ms  filter 14799 chars  ERROR TypeError: fetch failed
 *
 * A cliff, not a gradient: a request too large for the transport. Development
 * holds well over 400 accounts, so all four failed, every time. Each failure
 * was turned into an empty list by `?? []`, and the screen rendered every
 * account as "Unknown organization" with no orders, no seats and no open
 * statement, beside real outstanding balances, after two minutes.
 *
 * =============================================================================
 * WHY THE INJECTION IS THE CHUNK SIZE
 * =============================================================================
 *
 * The honest way to prove a failure path is to make the failure happen, not to
 * stub a client into returning an error. Raising `IN_FILTER_CHUNK` back above
 * the cliff reproduces the ORIGINAL defect exactly, in the real database, over
 * the real query, and asks the new code what it does about it. The answer must
 * be a refusal with a reason, never a page of zeros.
 *
 * It patches the constant on disk and reads the world in a CHILD PROCESS,
 * because a module level constant is read once and a fresh import is not fresh
 * enough. It restores in a `finally` and verifies the restore.
 *
 * THE SUBJECT IS ASSERTED FIRST. Below roughly 350 accounts the oversized
 * filter would succeed and the injection would prove nothing, so this refuses
 * to report anything unless the database actually holds enough accounts to
 * cross the cliff.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const BOUNDED = "src/lib/bounded-read.ts";
const BACKUP = "src/lib/bounded-read.ts.accounts-proof.bak";
const OVER_THE_CLIFF = 600;

const READER = `
process.loadEnvFile(".env.local");
const { accountRows } = await import("../../src/lib/ops-accounts-admin.ts");
const began = Date.now();
const result = await accountRows();
const took = Date.now() - began;
if (!result.ok) {
  console.log(JSON.stringify({ ok: false, took, unavailable: result.unavailable }));
} else {
  const rows = result.rows;
  console.log(JSON.stringify({
    ok: true,
    took,
    count: rows.length,
    unknownNames: rows.filter((r) => r.clientName === "Unknown organization").length,
    named: rows.filter((r) => r.clientName !== "Unknown organization").length,
    withOrders: rows.filter((r) => r.orders > 0).length,
    withUsers: rows.filter((r) => r.users > 0).length,
  }));
}
`;

const READER_PATH = "scripts/proofs/.accounts-proof-reader.mts";

function readWorld(label) {
  writeFileSync(READER_PATH, READER);
  try {
    const r = spawnSync("npx", ["tsx", "--conditions=react-server", READER_PATH], {
      encoding: "utf8",
      shell: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    const line = (r.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .pop();
    if (!line) {
      console.error(`could not read the world ${label}. stderr:\n${(r.stderr || "").slice(-900)}`);
      process.exit(1);
    }
    return JSON.parse(line);
  } finally {
    try {
      unlinkSync(READER_PATH);
    } catch {}
  }
}

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

// ------------------------------------------------- the chunk size is declared

const source = readFileSync(BOUNDED, "utf8");
const declared = /export const IN_FILTER_CHUNK = (\d+);/.exec(source);
check("the chunk size is a declared constant", declared !== null, declared ? declared[1] : "not found");
const chunk = declared ? Number(declared[1]) : 0;
check(
  `and it is below the measured cliff (${chunk} against the last size that worked, 300)`,
  chunk > 0 && chunk <= 300,
  "the last size that WORKED is not a safe size to choose: the limit is on the whole request, not on this filter",
);

// ------------------------------------------------------------ as it stands

const healthy = readWorld("as it stands");

check("the screen computes", healthy.ok === true, healthy.ok ? `${healthy.count} accounts in ${healthy.took}ms` : JSON.stringify(healthy.unavailable));

check(
  `the database holds enough accounts to cross the cliff (${healthy.count ?? 0})`,
  (healthy.count ?? 0) > 350,
  (healthy.count ?? 0) > 350
    ? "so the injection below is a real oversized request rather than a hypothetical"
    : "FEWER THAN 350, so an oversized filter would succeed and the injection would prove nothing",
);

check(
  "no account renders as an unnamed organization",
  healthy.ok === true && healthy.unknownNames === 0,
  `${healthy.unknownNames ?? "?"} of ${healthy.count ?? "?"} read "Unknown organization"`,
);

/*
 * The names, the orders and the seats each come from a DIFFERENT one of the
 * four chunked reads. Asserting only the names would leave three reads covered
 * by nothing, which is how a green comes to be over one quarter of a fix.
 */
check(
  "the client names read (a read that failed would leave every one of them blank)",
  healthy.ok === true && healthy.named > 0,
  `${healthy.named ?? 0} named`,
);
check(
  "the order counts read (a read that failed would leave every one of them zero)",
  healthy.ok === true && healthy.withOrders > 0,
  `${healthy.withOrders ?? 0} account(s) with at least one order`,
);
check(
  "the seat counts read (a read that failed would leave every one of them zero)",
  healthy.ok === true && healthy.withUsers > 0,
  `${healthy.withUsers ?? 0} account(s) with at least one seat`,
);

// ----------------------------------- the injection: put the chunk over the cliff

copyFileSync(BOUNDED, BACKUP);
let injected = null;
try {
  const anchor = `export const IN_FILTER_CHUNK = ${chunk};`;
  if (source.split(anchor).length - 1 !== 1) {
    console.error(`bounded-read.ts does not carry exactly one ${anchor}`);
    process.exit(1);
  }
  writeFileSync(BOUNDED, source.replace(anchor, `export const IN_FILTER_CHUNK = ${OVER_THE_CLIFF};`));
  injected = readWorld(`with the chunk at ${OVER_THE_CLIFF}`);
} finally {
  copyFileSync(BACKUP, BOUNDED);
  unlinkSync(BACKUP);
  const restored = readFileSync(BOUNDED, "utf8");
  if (restored !== source) {
    console.error(`RESTORE FAILED on ${BOUNDED}. It is not byte identical to what this proof read.`);
    process.exit(1);
  }
  console.log(`\n${BOUNDED} restored byte identical, chunk back at ${chunk}.\n`);
}

check(
  `with the chunk over the cliff the screen REFUSES rather than stating zeros`,
  injected.ok === false,
  injected.ok === false
    ? injected.unavailable.join(" | ").slice(0, 200)
    : `it returned ${injected.count} rows, ${injected.unknownNames} of them unnamed. This is the original defect, and it is back.`,
);

check(
  "and the refusal names which read failed",
  injected.ok === false && injected.unavailable.some((u) => /statements|orders|names|seats|balances/i.test(u)),
  injected.ok === false ? `${injected.unavailable.length} reason(s)` : "",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. A read that fails is an absence, not a page of zeros."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
