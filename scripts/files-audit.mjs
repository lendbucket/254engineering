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

  let wrong = 0;
  for (const [from, to, expected] of EXPECTED) {
    const actual = canTransition(admin, from, to, LIVE).ok;
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
  rec("an engineer cannot dispatch", !canTransition(engineer, "needs_dispatch", "dispatched", LIVE).ok);
  rec("a signed out actor can do nothing", !canTransition(null, "intake", "needs_dispatch", LIVE).ok);
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
