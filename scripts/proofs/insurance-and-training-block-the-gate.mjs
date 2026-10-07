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
const CONDITIONS = "src/config/launch-conditions.ts";
const TSX = "node_modules/tsx/dist/cli.mjs";

const BACKUPS = {
  [CREDENTIALS]: `.insurance-proof-credentials-${process.pid}.bak`,
  [READINESS]: `.insurance-proof-readiness-${process.pid}.bak`,
  [CONDITIONS]: `.insurance-proof-conditions-${process.pid}.bak`,
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

/**
 * SET a declaration to a state, whether or not that is a change.
 *
 * `patch` asserts that an EDIT HAPPENED, which is the right assertion when the
 * point is to move the world off its current state. It is the WRONG assertion
 * when the point is to guarantee a state: setting an already empty register to
 * empty is a legitimate no-op, and `patch` reads that as "the shape has moved"
 * and throws. It did exactly that the first time this proof was made to build
 * its own world.
 *
 * So this asserts the PATTERN MATCHED, which is the thing that would really be
 * wrong, and is indifferent to whether the bytes changed. The two helpers are
 * kept separate rather than one made lenient, because "an edit happened" is
 * still the assertion every case that MOVES the world wants.
 */
function ensure(file, find, replace) {
  const before = readFileSync(file, "utf8");
  if (!find.test(before)) {
    throw new Error(`the proof could not find ${String(find)} in ${file}: the shape has moved.`);
  }
  writeFileSync(file, before.replace(find, replace));
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

/*
 * =============================================================================
 * THE PROOF BUILDS ITS OWN WORLD. It used to depend on the live registers
 * being empty. Operator ruling, 2026-09-24.
 * =============================================================================
 *
 * These were the literal strings `= [];`, used as the anchor to patch a
 * fixture in. That worked for exactly as long as nobody had recorded anything,
 * and it broke the day the operator attested the first technician training:
 * the literal was no longer in the file, the patch found nothing, and this
 * proof exited 1 on the integrated board.
 *
 * It is the third instance of one defect in two days. The gate fixture's
 * protocol patch broke the same way when Aman's approval was recorded, and its
 * training patch broke the same way this morning. Each time the anchor was the
 * register's STARTING state, which the firm was always going to leave.
 *
 * A PROOF MUST NOT DEPEND ON WHAT THE REGISTER HOLDS TODAY. Its job is to
 * prove both directions of a rule, and a rule is not "true while the register
 * happens to be empty". So each anchor now matches the whole DECLARATION,
 * empty or populated, and every case writes the state it needs rather than
 * assuming it. Case D sets the training register to EMPTY explicitly, where it
 * previously relied on finding it that way.
 */
const DECLARATION = (name, type) =>
  new RegExp(`export const ${name}: ${type}\\[\\] = (?:\\[\\]|\\[[\\s\\S]*?\\n\\]);`);

const EMPTY_INSURANCE = DECLARATION("verifiedInsurance", "VerifiedInsurance");
const EMPTY_TRAINING = DECLARATION("verifiedTechnicianTraining", "TechnicianTraining");
/*
 * RULING 11 STAGE B, 2026-10-07. This was the typed approval list, which is
 * removed. "No protocol" is now "no line offered", because the protocol in
 * force for an offered line is code (PROTOCOL_ENTRIES) and is never patched.
 */
const EMPTY_OFFERED = /export const offeredServiceLines: string\[\] = \[[^\]]*\];/;

/** What each register is set to when a case needs it empty. */
const NO_INSURANCE = "export const verifiedInsurance: VerifiedInsurance[] = [];";
const NO_TRAINING = "export const verifiedTechnicianTraining: TechnicianTraining[] = [];";
const NO_OFFERED = "export const offeredServiceLines: string[] = [];";

/*
 * THE OWNER OVERRIDE, WHICH THIS PROOF DID NOT KNOW ABOUT AND WHICH BROKE IT.
 *
 * Operator ruling, 2026-09-28: the firm trades without professional liability
 * cover by owner decision until 2026-10-28. The moment that was recorded, cases
 * A and C went red on a gate that was working exactly as ruled: they set the
 * POLICY register empty or expired and asserted the gate shuts, and the override
 * was holding it open for a reason neither case mentions.
 *
 * That is the dormant-register defect from the other direction. The register
 * those cases patch is no longer the only thing the condition reads, so a case
 * that states its world has to state ALL of it.
 *
 * So the override is now part of every world this proof builds, and it gains two
 * cases of its own. G and H are the ones that matter most, because the expiry is
 * the ONLY thing that makes trading uninsured safe to record at all: an override
 * that never lapsed would be an exemption, which is the 2026-09-22 ACKNOWLEDGED
 * ruling in one sentence. H is what proves it lapses.
 */
const OVERRIDE_DECLARATION = new RegExp(
  "export const insuranceOverride: InsuranceOverride \\| null = (?:null;|\\{[\\s\\S]*?\\n\\};)",
);
const NO_OVERRIDE = "export const insuranceOverride: InsuranceOverride | null = null;";
const OVERRIDE_UNTIL = (expires) =>
  [
    "export const insuranceOverride: InsuranceOverride | null = {",
    '  acknowledgedBy: "A proof fixture, not a person",',
    '  acknowledgedOn: "2026-09-28",',
    `  expires: "${expires}",`,
    '  reason: "a proof fixture",',
    "};",
  ].join("\n");

const insuranceBlocker = (b) => b.find((s) => s.includes("professional liability cover")) ?? null;
const trainingBlocker = (b) => b.find((s) => s.includes("trained on the approved protocol")) ?? null;

console.log("");
console.log("========== INSURANCE AND TRAINING HOLD THE GATE ==========");
console.log("");

for (const [file, backup] of Object.entries(BACKUPS)) copyFileSync(file, backup);

try {
  /* ------------------------------------------------ A: nothing recorded */
  /*
   * SET, NOT ASSUMED. This case is named "nothing recorded" and it used to
   * read whatever the three registers happened to hold. On a tree where a
   * protocol is approved and a technician is trained, both of its assertions
   * would have passed for reasons that have nothing to do with what they
   * claim: training does not block because somebody IS trained, rather than
   * because no protocol is approved.
   *
   * A case that describes a world states that world.
   */
  ensure(CREDENTIALS, EMPTY_INSURANCE, NO_INSURANCE);
  ensure(CREDENTIALS, EMPTY_TRAINING, NO_TRAINING);
  ensure(CONDITIONS, EMPTY_OFFERED, NO_OFFERED);
  /* Nothing recorded means nothing recorded, the owner's decision included. */
  ensure(CREDENTIALS, OVERRIDE_DECLARATION, NO_OVERRIDE);
  const a = blockersInChild();
  rec(
    "A: with no cover on record, insurance holds the gate shut",
    insuranceBlocker(a.blockers) !== null,
    insuranceBlocker(a.blockers) ?? "NO insurance blocker, which is the defect this condition exists to prevent",
  );
  rec(
    "A: and training does NOT block, because no line is offered, so no protocol is in force",
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
  /* restoreAll brings the real override back, and this case is about the POLICY
   * expiring. Leaving it in place would have the override answering for the
   * lapsed cover, which is how case C first went red. */
  ensure(CREDENTIALS, OVERRIDE_DECLARATION, NO_OVERRIDE);
  const c = blockersInChild();
  rec(
    "C: with EXPIRED cover on record, insurance blocks again",
    insuranceBlocker(c.blockers) !== null,
    "the expiry is load bearing, not decoration. A lapsed policy is not cover.",
  );

  /* ------------------------------- G: no cover, and the owner says trade anyway */
  restoreAll();
  ensure(CREDENTIALS, EMPTY_INSURANCE, NO_INSURANCE);
  ensure(CREDENTIALS, OVERRIDE_DECLARATION, OVERRIDE_UNTIL("2099-12-31"));
  const g = blockersInChild();
  rec(
    "G: with no cover and a live owner override, insurance does NOT block",
    insuranceBlocker(g.blockers) === null,
    "the owner's decision to trade uninsured is what opens the gate here, and nothing else is recorded",
  );

  /* ------------------------------------- H: the same override, lapsed */
  /*
   * THE CASE THAT MAKES THE OVERRIDE SAFE TO HAVE WRITTEN DOWN. An acknowledgement
   * that never expires is an exemption, and the firm would be trading uninsured
   * for ever on a decision somebody made once. This is the assertion that it ends.
   */
  restoreAll();
  ensure(CREDENTIALS, EMPTY_INSURANCE, NO_INSURANCE);
  ensure(CREDENTIALS, OVERRIDE_DECLARATION, OVERRIDE_UNTIL("2000-01-01"));
  const h = blockersInChild();
  rec(
    "H: with the override LAPSED, insurance blocks again",
    insuranceBlocker(h.blockers) !== null,
    insuranceBlocker(h.blockers) ??
      "NO blocker, so the override never ends and the firm trades uninsured for ever on one decision",
  );
  rec(
    "H: and the sentence names the date it lapsed, so nobody has to guess",
    (insuranceBlocker(h.blockers) ?? "").includes("2000-01-01"),
    insuranceBlocker(h.blockers)?.slice(0, 120) ?? "no blocker to read",
  );

  /* ----------------------------- D: a protocol approved, nobody trained */
  restoreAll();
  /* Explicitly nobody trained. This case previously relied on the register
   * being empty on disk, which stopped being true the day the operator
   * attested the first training and is what broke this proof. */
  ensure(CREDENTIALS, EMPTY_TRAINING, NO_TRAINING);
  /* No protocol patch since ruling 11 stage B: 254-RC-001 v1.1 is in force for the offered roof line in code. */
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
      protocolDocument: "254-RC-001",
      protocolVersion: 1,
      protocolVersionLabel: "1.1",
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
    CREDENTIALS,
    EMPTY_TRAINING,
    `export const verifiedTechnicianTraining: TechnicianTraining[] = [{
      technician: "PROOF FIXTURE",
      protocolDocument: "254-RC-001",
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
    "F: trained on 254-RC-001 v1.0 while v1.1 is in force, training STILL blocks",
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
