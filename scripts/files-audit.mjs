/**
 * The file state machine and county derivation, asserted.
 *
 *   npx tsx scripts/files-audit.mjs
 *
 * Pure, so it needs no server, no database, and no network. It runs in phase
 * zero beside db-guard-audit.
 *
 * WHY THE EXPECTATIONS ARE WRITTEN OUT RATHER THAN DERIVED
 * --------------------------------------------------------
 * Same reason as roles-audit. Looping over the module's own TRANSITIONS map and
 * asserting that canTransition agrees with it would pass forever, including on
 * the day somebody adds "sealed" to the moves available from "intake". So the
 * moves that matter are named here by hand, and the two have to agree.
 *
 * THE COMPLIANCE GATE IS THE PART THAT MUST NOT REGRESS
 * -----------------------------------------------------
 * A file reaching sealed or delivered while the firm's registration is pending
 * is not a bug in a workflow. It is the platform helping the firm practise
 * engineering it is not registered to practise. It is asserted for every role
 * including admin, and from every status that could otherwise reach it.
 */
import fs from "node:fs";
import {
  canTransition,
  availableTransitions,
  FILE_STATUSES,
  formatFileNumber,
  STATUS_LABEL,
  GATED_STATUSES as GATED_FROM_MODULE,
} from "../src/lib/ops-files.ts";
import { resolveCounty, canonicalCounty, twiaStatus, regionForCounty, TEXAS_COUNTIES } from "../src/lib/ops-counties.ts";
import { ROLES } from "../src/lib/ops-authz.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const actor = (role) => ({ id: `${role}-1`, role, status: "active" });
const admin = actor("admin");
const engineer = actor("engineer");
const tech = actor("field_tech");

/*
 * The statuses the gate MUST block, stated here rather than imported.
 *
 * The first version of this loop iterated over the module's own
 * GATED_STATUSES. An injection that removed "sealed" from that list therefore
 * removed it from the test too, and the leak check passed while sealing was
 * wide open during prelaunch. The audit was reading its answer off the thing it
 * was supposed to be checking.
 *
 * That is the defect class this repo has lost the most hours to, and it turned
 * up here in the one check whose silence would matter most. Found by injecting
 * the leak and watching the wrong test stay green.
 */
const MUST_BE_GATED = ["sealed", "delivered"];
const LIVE = { prelaunch: false };
const GATED = { prelaunch: true };

// =====================================================================
// The compliance gate. First, because it is the one that matters most.
// =====================================================================
{
  let leaks = 0;
  for (const role of ROLES) {
    for (const from of FILE_STATUSES) {
      for (const to of MUST_BE_GATED) {
        const result = canTransition(actor(role), from, to, GATED);
        if (result.ok) {
          leaks++;
          rec(`GATE LEAK: ${role} moved ${from} to ${to} while prelaunch`, false);
        }
      }
    }
  }
  rec(
    `no role can reach sealed or delivered while the registration is pending (${ROLES.length} roles x ${FILE_STATUSES.length} statuses)`,
    leaks === 0,
    leaks ? `${leaks} leaks` : "",
  );

  // The module's own list must still name everything that has to be gated.
  // Checked directly, so removing one is reported as itself rather than only
  // through whatever it happens to break downstream.
  {
    const declared = new Set(GATED_FROM_MODULE);
    const missing = MUST_BE_GATED.filter((s) => !declared.has(s));
    rec(
      "the module still declares every status the gate must block",
      missing.length === 0,
      missing.length ? `missing: ${missing.join(", ")}` : "",
    );
  }

  // And the refusal has to explain itself, or an operator will read it as a bug.
  const refusal = canTransition(admin, "under_review", "sealed", GATED);
  rec(
    "the gate's refusal names the registration rather than saying no",
    !refusal.ok && /registration/i.test(refusal.reason) && /Professional Engineer/i.test(refusal.reason),
    refusal.ok ? "it allowed it" : refusal.reason.slice(0, 60),
  );

  // The same move must work once the firm is registered, or the gate is just a wall.
  const live = canTransition(admin, "under_review", "sealed", LIVE);
  rec("the same move is allowed once the gate is lifted", live.ok, live.ok ? "" : live.reason);
}

// =====================================================================
// The grammar, stated independently.
// =====================================================================
{
  /** [from, to, allowedForAdminWhenLive] */
  const EXPECTED = [
    ["intake", "needs_dispatch", true],
    ["intake", "cancelled", true],
    ["intake", "dispatched", false],
    ["intake", "sealed", false],
    ["intake", "delivered", false],
    ["needs_dispatch", "dispatched", true],
    ["needs_dispatch", "intake", true],
    ["needs_dispatch", "evidence_submitted", false],
    ["dispatched", "evidence_in_progress", true],
    ["dispatched", "sealed", false],
    ["evidence_in_progress", "evidence_submitted", true],
    ["evidence_submitted", "under_review", true],
    ["evidence_submitted", "revisions_requested", true],
    ["evidence_submitted", "sealed", false],
    ["under_review", "sealed", true],
    ["under_review", "refused", true],
    ["under_review", "needs_dispatch", true],
    ["refused", "closed", true],
    ["refused", "cancelled", true],
    // A refusal does not go back into review by pressing back. Reopening one is
    // a deliberate act: somebody opens a new file.
    ["refused", "under_review", false],
    ["refused", "sealed", false],
    ["refused", "delivered", false],
    ["evidence_submitted", "refused", false],
    ["under_review", "revisions_requested", true],
    ["under_review", "delivered", false],
    ["revisions_requested", "evidence_in_progress", true],
    ["sealed", "delivered", true],
    ["sealed", "under_review", false],
    ["delivered", "closed", true],
    ["delivered", "sealed", false],
    ["closed", "delivered", false],
    ["closed", "cancelled", false],
    ["cancelled", "intake", false],
  ];

  /*
   * This block tests the GRAMMAR, which move follows which. The preconditions
   * that are not grammar are satisfied so they cannot mask it: a file being
   * dispatched has a technician on it, and that rule is asserted on its own
   * below rather than folded into a table about move ordering.
   */
  const GRAMMAR = { ...LIVE, assignedTech: true };

  let wrong = 0;
  for (const [from, to, expected] of EXPECTED) {
    const actual = canTransition(admin, from, to, GRAMMAR).ok;
    if (actual !== expected) {
      wrong++;
      rec(`${from} to ${to}`, false, `expected ${expected}, machine says ${actual}`);
    }
  }
  rec(
    `the transition grammar matches the independent expectation (${EXPECTED.length} moves)`,
    wrong === 0,
    wrong ? `${wrong} disagreements` : "",
  );

  rec(
    "a file cannot transition to the status it already holds",
    !canTransition(admin, "intake", "intake", LIVE).ok,
  );
  for (const terminal of ["closed", "cancelled"]) {
    const anyMove = FILE_STATUSES.some((to) => canTransition(admin, terminal, to, LIVE).ok);
    rec(`${terminal} is terminal: no move out of it`, !anyMove);
  }
}

// =====================================================================
// Role boundaries on transitions.
// =====================================================================
{
  rec("a technician cannot seal", !canTransition(tech, "under_review", "sealed", LIVE).ok);
  rec("a technician cannot deliver", !canTransition(tech, "sealed", "delivered", LIVE).ok);
  rec("a technician cannot cancel a file", !canTransition(tech, "intake", "cancelled", LIVE).ok);
  rec("an engineer can seal once the gate is lifted", canTransition(engineer, "under_review", "sealed", LIVE).ok);
  rec("an engineer cannot cancel a file", !canTransition(engineer, "intake", "cancelled", LIVE).ok);
  /*
   * Dispatched is reached by ACCEPTING an offer, so two things have to hold at
   * once: somebody is on the file, and the actor is allowed to respond to
   * offers. Both are asserted, and the order matters: the assignment refusal
   * comes first so an administrator clicking too early is told what is missing
   * rather than that they lack a permission they have.
   */
  const ASSIGNED = { ...LIVE, assignedTech: true };
  rec("an engineer cannot dispatch", !canTransition(engineer, "needs_dispatch", "dispatched", ASSIGNED).ok);
  rec("a technician accepting a job dispatches the file", canTransition(tech, "needs_dispatch", "dispatched", ASSIGNED).ok);
  rec("an administrator can dispatch on a technician's behalf", canTransition(admin, "needs_dispatch", "dispatched", ASSIGNED).ok);
  const empty = canTransition(admin, "needs_dispatch", "dispatched", { ...LIVE, assignedTech: false });
  rec("a file with nobody on it cannot be dispatched", !empty.ok);
  rec("and the refusal says why rather than blaming permissions", /nobody has accepted/i.test(empty.reason ?? ""), empty.reason);
  rec(
    "an unspecified assignment is treated as nobody, not as yes",
    !canTransition(admin, "needs_dispatch", "dispatched", LIVE).ok,
  );
  rec("a signed out actor can do nothing", !canTransition(null, "intake", "needs_dispatch", LIVE).ok);

  /*
   * A technician has to be able to finish their own job without being handed
   * files.transition, which would let them move anything anywhere. These four
   * are the whole of what they may do, and the fifth is the one that matters:
   * evidence submitted is reachable from under review as well, and a technician
   * reaching it from there would be yanking a file back from the engineer
   * holding it. Same destination, different act, different permission.
   */
  rec("a technician can start capture on a dispatched job", canTransition(tech, "dispatched", "evidence_in_progress", LIVE).ok);
  rec("a technician can submit their own evidence", canTransition(tech, "evidence_in_progress", "evidence_submitted", LIVE).ok);
  rec("a technician can resume after a revision request", canTransition(tech, "revisions_requested", "evidence_in_progress", LIVE).ok);
  rec("a technician cannot pull a file back out of review", !canTransition(tech, "under_review", "evidence_submitted", LIVE).ok);
  rec("an engineer can send a file back out of review", canTransition(engineer, "under_review", "evidence_submitted", LIVE).ok);

  /*
   * The asymmetry that matters most in this whole machine. While the firm is
   * prelaunch, sealing is blocked and declining to seal is not. A gate that
   * stopped an engineer refusing, while leaving certification available, would
   * be the exact inversion of what the gate is for.
   */
  rec("an engineer can decline to seal", canTransition(engineer, "under_review", "refused", LIVE).ok);
  rec(
    "and can still decline while the compliance gate is active",
    canTransition(engineer, "under_review", "refused", GATED).ok,
    canTransition(engineer, "under_review", "refused", GATED).reason,
  );
  rec(
    "while sealing in the same state is refused",
    !canTransition(engineer, "under_review", "sealed", GATED).ok,
  );
  rec("a technician cannot decline to seal", !canTransition(tech, "under_review", "refused", LIVE).ok);
  rec("a technician still cannot move a file to needs dispatch", !canTransition(tech, "evidence_in_progress", "needs_dispatch", LIVE).ok);
  rec(
    "a suspended admin can do nothing",
    !canTransition({ id: "a", role: "admin", status: "suspended" }, "intake", "needs_dispatch", LIVE).ok,
  );
}

// =====================================================================
// availableTransitions must agree with canTransition, always.
// =====================================================================
{
  let mismatches = 0;
  for (const role of ROLES) {
    for (const from of FILE_STATUSES) {
      for (const option of availableTransitions(actor(role), from, GATED)) {
        const direct = canTransition(actor(role), from, option.to, GATED);
        if (direct.ok !== option.allowed) mismatches++;
      }
    }
  }
  rec(
    "the buttons a screen would render agree with what the API would allow",
    mismatches === 0,
    mismatches ? `${mismatches} disagreements` : "",
  );
  const blocked = availableTransitions(admin, "under_review", GATED).find((o) => o.to === "sealed");
  rec("a blocked option carries the reason it is blocked", Boolean(blocked && !blocked.allowed && blocked.reason));
}

// =====================================================================
// County derivation.
// =====================================================================
{
  rec("the canonical list holds 254 counties", TEXAS_COUNTIES.length === 254, String(TEXAS_COUNTIES.length));

  rec("an explicit county wins", resolveCounty({ city: "Houston", county: "Nueces" }).county === "Nueces");
  rec("a known city resolves", resolveCounty({ city: "Corpus Christi" }).county === "Nueces");
  rec("a known city reports how it resolved", resolveCounty({ city: "Corpus Christi" }).source === "city");
  rec("an unknown city resolves to nothing rather than a guess", resolveCounty({ city: "Nowheresville" }).county === null);
  rec("an unknown city is marked invalid so intake asks", !resolveCounty({ city: "Nowheresville" }).valid);
  rec("a county that is not one of the 254 is rejected", !resolveCounty({ county: "Fakeshire" }).valid);
  rec('the word "County" is tolerated', canonicalCounty("Nueces County") === "Nueces");
  rec("case is tolerated", canonicalCounty("nUeCeS") === "Nueces");

  rec("a designated coastal county is flagged", twiaStatus("Nueces") === "designated");
  rec("Galveston is flagged", twiaStatus("Galveston") === "designated");
  rec("an inland county is not flagged", twiaStatus("Travis") === "not_designated");
  /*
   * Harris is the one the software must refuse to answer. The designated area is
   * the part east of State Highway 146, which a county name cannot express.
   */
  rec("Harris asks rather than guessing", twiaStatus("Harris") === "check");
  rec("no county returns a flag it cannot justify", twiaStatus(null) === "not_designated");

  let flagged = 0;
  for (const county of TEXAS_COUNTIES) if (twiaStatus(county) === "designated") flagged++;
  rec("exactly fourteen counties are designated, matching the statute", flagged === 14, String(flagged));

  rec("a county maps to its coverage region", regionForCounty("Nueces") === "coastal-bend");
  const unmapped = TEXAS_COUNTIES.filter((c) => !regionForCounty(c));
  rec("every one of the 254 belongs to a region", unmapped.length === 0, unmapped.slice(0, 3).join(", "));
}

// =====================================================================
// File numbering.
// =====================================================================
{
  rec("file numbers are readable down a phone", formatFileNumber(2026, 147) === "254-2026-0147");
  rec("file numbers pad consistently", formatFileNumber(2026, 1) === "254-2026-0001");
  rec("file numbers do not truncate past four digits", formatFileNumber(2026, 12345) === "254-2026-12345");
}

// =====================================================================
{
  const unlabelled = FILE_STATUSES.filter((s) => !STATUS_LABEL[s]);
  rec("every status has a human label", unlabelled.length === 0, unlabelled.join(", "));
}

// =====================================================================
// ONE WRITER FOR eng_files.status
//
// A grammar that some paths obey and others route around is not a grammar.
//
// This was not hypothetical. Until Phase 10 Section 1, ops-payments released
// paid work with a raw \`db.from("eng_files").update({ status: target })\` that
// never called canTransition and never wrote the file event every other move
// writes. It moved desk work from intake to evidence_submitted, which the
// grammar did not permit, and nothing noticed because the only enforcement
// lived in the function being skipped.
//
// The rule: transitionFile in ops-crm.ts is the only thing in src/ that may
// write that column. Everything else asks it.
//
// The check reads STATEMENTS rather than files, because a module may
// legitimately update other columns on eng_files (ops-engineer assigns an
// engineer, ops-field attaches a protocol) and a file level grep would either
// miss the violation or flag those.
// =====================================================================
{
  const OWNER = "src/lib/ops-crm.ts";

  /** Every .ts and .tsx under src, so a route handler cannot do it either. */
  function sourceFiles(dir) {
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) found.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
    return found;
  }

  const offenders = [];
  for (const file of sourceFiles("src")) {
    if (file === OWNER) continue;
    const text = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

    /*
     * Each fragment runs from a mention of the table to the end of that
     * statement, so ".update({ status: x })" is seen while a select elsewhere
     * in the module is not.
     */
    const parts = text.split('from("eng_files")').slice(1);
    for (const part of parts) {
      const statement = part.split(";")[0];
      if (!/\.update\(/.test(statement)) continue;
      if (!/\bstatus\b/.test(statement)) continue;
      offenders.push(file.replace(/^src\//, "") + ": " + statement.trim().slice(0, 60));
    }
  }

  rec(
    "only ops-crm writes eng_files.status",
    offenders.length === 0,
    offenders.length ? offenders.join(" | ") : "transitionFile is the one door",
  );

  /*
   * And the owner really does own it, so the check above cannot be passing
   * because the write moved somewhere this scan does not look.
   */
  const owner = fs.readFileSync(OWNER, "utf8");
  rec(
    "and ops-crm writes it through transitionFile, which asks canTransition first",
    /export async function transitionFile[\s\S]*?canTransition\([\s\S]*?\.update\(patch\)/.test(owner),
    "the guard has to run before the write, not beside it",
  );

  /*
   * The move that started this. Desk work arrives with its evidence already
   * attached, so intake to evidence_submitted is legal, and the release path
   * depends on it being legal rather than on nobody checking.
   */
  rec(
    "a desk file may go from intake straight to evidence submitted",
    canTransition({ role: "admin", status: "active" }, "intake", "evidence_submitted", {
      prelaunch: false,
    }).ok,
    "the release path relies on this being permitted rather than on nobody checking",
  );
}

console.log("================ FILES AND COUNTIES ================");
console.log("the state machine, the compliance gate, and county derivation\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The grammar holds and the gate does not leak.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
