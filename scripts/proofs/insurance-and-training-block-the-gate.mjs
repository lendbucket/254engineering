/**
 * INSURANCE AND TECHNICIAN TRAINING HOLD THE GATE SHUT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/insurance-and-training-block-the-gate.mjs
 *
 * FIVE CASES, AND THE SHAPE OF THE SET IS THE ARGUMENT. Each condition is
 * proven to block when it should, NOT to block when it should not, and for
 * insurance the expiry is proven to be load bearing on its own. A condition
 * that always blocks would satisfy half of this and be useless.
 *
 *   A  nothing recorded            insurance blocks, training does NOT
 *   B  cover recorded and current  insurance stops blocking
 *   C  the same cover, expired     insurance blocks again
 *   D  a protocol approved, nobody trained   training blocks, naming the line
 *   E  the same protocol, trained            training stops blocking
 *
 * CASE A'S SECOND HALF IS THE ONE WORTH READING. Training does NOT block while
 * no protocol is approved, and that is deliberate rather than an oversight: a
 * line with no approved protocol is already shut by the `protocols` condition,
 * and a second condition naming the same line would report one fault as two.
 * It is vacuously met today and becomes load bearing at case D.
 *
 * EVERY CASE IS A CHILD PROCESS. The registers are read at module load, so a
 * patch on disk cannot reach a module this process has already imported. A
 * fresh import() is not fresh enough. A child has no module graph to
 * invalidate.
 *
 * PATCHED AND RESTORED BY COPY, verified byte identical, because a restore
 * reads identically whether it happened or not.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CREDENTIALS = "src/config/credentials.ts";
const READINESS = "src/config/launch-readiness.ts";
const TSX = "node_modules/tsx/dist/cli.mjs";

const BACKUPS = {
  [CREDENTIALS]: `.insurance-proof-credentials-${process.pid}.bak`,
  [READINESS]: `.insurance-proof-readiness-${process.pid}.bak`,
};

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/** Replace exactly once, or throw. A patch that edits nothing proves nothing. */
function patch(file, find, replace) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(find, replace);
  if (after === before) {
    throw new Error(`the proof could not patch ${file}: the shape has moved. ${String(find)}`);
  }
  writeFileSync(file, after);
}

function restoreAll() {
  for (const [file, backup] of Object.entries(BACKUPS)) {
    copyFileSync(backup, file);
  }
}

/** Read the open blockers in a child, so the files on disk are what it sees. */
function blockersInChild() {
  const file = `.insurance-proof-child-${process.pid}.mjs`;
  writeFileSync(
    file,
    `const { openBlockers, launchMode } = await import("./src/lib/launch.ts");\n` +
      `console.log("RESULT " + JSON.stringify({ blockers: openBlockers(), mode: launchMode() }));\n`,
  );
  try {
    const stdout = execFileSync(process.execPath, [TSX, file], { encoding: "utf8", stdio: "pipe" });
    const line = stdout.split("\n").find((l) => l.startsWith("RESULT "));
    if (!line) throw new Error(`the child printed no RESULT line: ${stdout.slice(0, 300)}`);
    return JSON.parse(line.slice("RESULT ".length));
  } finally {
    if (existsSync(file)) unlinkSync(file);
  }
}

const INSURED = (expires) =>
  `export const verifiedInsurance: VerifiedInsurance[] = [{
    kind: "professional-liability",
    carrier: "PROOF FIXTURE, NOT A REAL CARRIER",
    policyNumber: "PROOF-FIXTURE",
    limitPerClaimCents: 100000000,
    limitAggregateCents: 200000000,
    effective: "2000-01-01",
    expires: "${expires}",
    status: "active",
    evidence: { seenBy: "the proof", seenOn: "2000-01-01", document: "none: this is a fixture" },
  }];`;

const EMPTY_INSURANCE = "export const verifiedInsurance: VerifiedInsurance[] = [];";
const EMPTY_TRAINING = "export const verifiedTechnicianTraining: TechnicianTraining[] = [];";
const EMPTY_PROTOCOLS = "export const approvedProtocols: ApprovedProtocol[] = [];";

const insuranceBlocker = (b) => b.find((s) => s.includes("professional liability cover")) ?? null;
const trainingBlocker = (b) => b.find((s) => s.includes("trained on the approved protocol")) ?? null;

console.log("");
console.log("========== INSURANCE AND TRAINING HOLD THE GATE ==========");
console.log("");

for (const [file, backup] of Object.entries(BACKUPS)) copyFileSync(file, backup);

try {
  /* ------------------------------------------------ A: nothing recorded */
  const a = blockersInChild();
  rec(
    "A: with no cover on record, insurance holds the gate shut",
    insuranceBlocker(a.blockers) !== null,
    insuranceBlocker(a.blockers) ?? "NO insurance blocker, which is the defect this condition exists to prevent",
  );
  rec(
    "A: and training does NOT block, because no protocol is approved",
    trainingBlocker(a.blockers) === null,
    "a line with no protocol is already shut by `protocols`; naming it twice reports one fault as two",
  );

  /* ------------------------------------- B: cover recorded and current */
  patch(CREDENTIALS, EMPTY_INSURANCE, INSURED("2099-12-31"));
  const b = blockersInChild();
  rec(
    "B: with current cover on record, insurance stops blocking",
    insuranceBlocker(b.blockers) === null,
    "without this a condition that always blocked would pass case A and be useless",
  );

  /* ------------------------------------------- C: the same cover, expired */
  restoreAll();
  patch(CREDENTIALS, EMPTY_INSURANCE, INSURED("2000-01-01"));
  const c = blockersInChild();
  rec(
    "C: with EXPIRED cover on record, insurance blocks again",
    insuranceBlocker(c.blockers) !== null,
    "the expiry is load bearing, not decoration. A lapsed policy is not cover.",
  );

  /* ----------------------------- D: a protocol approved, nobody trained */
  restoreAll();
  patch(
    READINESS,
    EMPTY_PROTOCOLS,
    `export const approvedProtocols: ApprovedProtocol[] = [{
      serviceSlug: "roof-inspections",
      protocolName: "PROOF FIXTURE",
      version: 1,
      approvedBy: "PROOF FIXTURE",
      approvedByLicense: "000000",
      approvedOn: "2000-01-01",
    }];`,
  );
  const d = blockersInChild();
  rec(
    "D: with a protocol approved and nobody trained, training holds the gate shut",
    trainingBlocker(d.blockers) !== null,
    trainingBlocker(d.blockers) ?? "NO training blocker, so a technician could be dispatched on a protocol nobody prepared them for",
  );
  rec(
    "D: and it names the service line, so the operator knows what to fix",
    (trainingBlocker(d.blockers) ?? "").includes("roof-inspections"),
    trainingBlocker(d.blockers) ?? "",
  );

  /* ------------------------------- E: the same protocol, somebody trained */
  patch(
    CREDENTIALS,
    EMPTY_TRAINING,
    `export const verifiedTechnicianTraining: TechnicianTraining[] = [{
      technician: "PROOF FIXTURE",
      protocolDocument: "PROOF-FIXTURE",
      protocolVersion: 1,
      protocolVersionLabel: "1",
      serviceSlug: "roof-inspections",
      trainedOn: "2000-01-01",
      trainedBy: "the proof",
      evidence: { seenBy: "the proof", seenOn: "2000-01-01", document: "none: this is a fixture" },
    }];`,
  );
  const e = blockersInChild();
  rec(
    "E: with that technician trained on that version, training stops blocking",
    trainingBlocker(e.blockers) === null,
    "without this a condition that always blocked would pass case D and be useless",
  );

  /* ------------------------- F: trained on the PREVIOUS version, which is stale
   *
   * ADDED AFTER AN INJECTION FOUND THIS PROOF COULD NOT SEE IT. Cases D and E
   * both use version 1 on both sides, so dropping the version from the match
   * entirely left every check above green: training on the line read as
   * training on the line. The design says the version is the part that matters
   * most, and the proof was blind to exactly that.
   *
   * 254-RC-001 was at v1.0 nine days before it was at v1.1. Somebody trained on
   * the first is not trained on the second, and a record without a version
   * reads as current for ever.
   */
  restoreAll();
  patch(
    READINESS,
    EMPTY_PROTOCOLS,
    `export const approvedProtocols: ApprovedProtocol[] = [{
      serviceSlug: "roof-inspections",
      protocolName: "PROOF FIXTURE",
      version: 2,
      approvedBy: "PROOF FIXTURE",
      approvedByLicense: "000000",
      approvedOn: "2000-01-01",
    }];`,
  );
  patch(
    CREDENTIALS,
    EMPTY_TRAINING,
    `export const verifiedTechnicianTraining: TechnicianTraining[] = [{
      technician: "PROOF FIXTURE",
      protocolDocument: "PROOF-FIXTURE",
      protocolVersion: 1,
      protocolVersionLabel: "1.0",
      serviceSlug: "roof-inspections",
      trainedOn: "2000-01-01",
      trainedBy: "the proof",
      evidence: { seenBy: "the proof", seenOn: "2000-01-01", document: "none: this is a fixture" },
    }];`,
  );
  const f = blockersInChild();
  rec(
    "F: trained on version 1 while version 2 is approved, training STILL blocks",
    trainingBlocker(f.blockers) !== null,
    trainingBlocker(f.blockers) ??
      "stale training read as current, which is the defect the version in the match exists to prevent",
  );
} finally {
  restoreAll();
  let clean = true;
  for (const [file, backup] of Object.entries(BACKUPS)) {
    if (readFileSync(file, "utf8") !== readFileSync(backup, "utf8")) {
      console.log(`FAIL  ${file} was NOT restored. Restore it by hand from ${backup}`);
      clean = false;
      process.exitCode = 1;
    }
  }
  if (clean) {
    console.log("");
    console.log("restored byte identical: " + Object.keys(BACKUPS).join(", "));
    for (const backup of Object.values(BACKUPS)) unlinkSync(backup);
  }
}

console.log("");
const failed = out.filter((r) => !r.ok);
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`All ${out.length} checks correct.`);
}
