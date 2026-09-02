/**
 * Credentials, expiry, activation readiness, and the protocol certification
 * check.
 *
 *   npx tsx scripts/onboarding-audit.mjs
 *
 * Pure. No server, no database, no network. Runs in phase zero.
 *
 * WHY THE EXPECTATIONS ARE WRITTEN OUT
 * ------------------------------------
 * Same discipline as files-audit, roles-audit and dispatch-audit, and the same
 * reason: looping over the module's own REQUIRED_FOR_DISPATCH and asserting it
 * agrees with itself would pass on the day somebody drops vehicle insurance from
 * the list. The four required credentials are named here by hand, and the module
 * has to agree.
 *
 * WHY EVERY DATE IS FIXED
 * -----------------------
 * Every expiry check passes an explicit `now`. An audit that reads the clock
 * passes today and fails in three months when a hard coded date drifts past,
 * and the failure looks like a code defect rather than a test that was written
 * against a moving target.
 */
import {
  CREDENTIAL_OF_ITEM,
  EXPIRY_WARNING_DAYS,
  REQUIRED_FOR_DISPATCH,
  activationReadiness,
  credentialBlockers,
  daysUntilExpiry,
  expiringSoon,
  expiryState,
} from "../src/lib/ops-credentials.ts";
import {
  canAttempt,
  certificationLabel,
  forTechnician,
  gradeAttempt,
  isStale,
} from "../src/lib/ops-certification.ts";
import { planDispatch } from "../src/lib/ops-dispatch.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** A fixed today, so nothing in this file drifts. */
const NOW = new Date("2026-09-02T12:00:00Z");
const day = (offset) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const cred = (kind, over = {}) => ({
  kind,
  status: over.status ?? "verified",
  expiresOn: over.expiresOn === undefined ? null : over.expiresOn,
  label: null,
});

/** A technician whose paperwork is entirely in order. */
const fullSet = () => [
  cred("drivers_license", { expiresOn: day(400) }),
  cred("vehicle_insurance", { expiresOn: day(200) }),
  cred("w9"),
  cred("ic_agreement"),
];

// =====================================================================
// What is required, stated independently.
// =====================================================================
{
  /*
   * Written by hand. If somebody drops one of these from the module, this
   * disagrees rather than quietly following along.
   */
  const MUST_HOLD = ["drivers_license", "vehicle_insurance", "w9", "ic_agreement"];
  const MUST_NOT_BE_REQUIRED = ["gl_insurance", "direct_deposit", "drone_license", "pe_license"];

  rec(
    "the four required credentials are exactly what dispatch demands",
    MUST_HOLD.every((k) => REQUIRED_FOR_DISPATCH.includes(k)) &&
      REQUIRED_FOR_DISPATCH.length === MUST_HOLD.length,
    REQUIRED_FOR_DISPATCH.join(", "),
  );
  for (const kind of MUST_NOT_BE_REQUIRED) {
    rec(`${kind} is not required for dispatch`, !REQUIRED_FOR_DISPATCH.includes(kind));
  }

  rec("a complete set produces no blockers", credentialBlockers(fullSet(), NOW).length === 0);

  for (const kind of MUST_HOLD) {
    const missing = credentialBlockers(
      fullSet().filter((c) => c.kind !== kind),
      NOW,
    );
    rec(`a missing ${kind} blocks dispatch`, missing.length === 1 && missing[0].kind === kind, missing[0]?.reason);
  }

  const unverified = credentialBlockers(
    [...fullSet().filter((c) => c.kind !== "w9"), cred("w9", { status: "pending" })],
    NOW,
  );
  rec("a document on file but unverified blocks", unverified.length === 1);
  rec(
    "and says it is unverified rather than missing",
    /not verified/i.test(unverified[0]?.reason ?? ""),
    unverified[0]?.reason,
  );

  const rejected = credentialBlockers(
    [...fullSet().filter((c) => c.kind !== "w9"), cred("w9", { status: "rejected" })],
    NOW,
  );
  rec("a rejected document does not count as held", rejected.length === 1);
}

// =====================================================================
// Expiry.
// =====================================================================
{
  const CASES = [
    ["no expiry date at all", null, "none"],
    ["a year out", day(365), "current"],
    ["just past the warning window", day(EXPIRY_WARNING_DAYS + 1), "current"],
    ["exactly at the warning window", day(EXPIRY_WARNING_DAYS), "expiring"],
    ["a week out", day(7), "expiring"],
    ["expiring today", day(0), "expiring"],
    ["expired yesterday", day(-1), "expired"],
    ["long expired", day(-400), "expired"],
    ["not a date at all", "not-a-date", "none"],
  ];

  let wrong = 0;
  for (const [label, value, expected] of CASES) {
    const actual = expiryState(value, NOW);
    if (actual !== expected) {
      wrong++;
      rec(`expiry: ${label}`, false, `expected ${expected}, got ${actual}`);
    }
  }
  rec(`expiry state matches the independent expectation (${CASES.length} cases)`, wrong === 0);

  /*
   * The boundary that matters. An insurer does not stop covering somebody at
   * nine in the morning because that is when the audit ran, so a certificate
   * expiring today is valid today.
   */
  rec("a credential expiring today is not expired", expiryState(day(0), NOW) !== "expired");
  rec("and it is expired tomorrow", expiryState(day(0), new Date("2026-09-03T09:00:00Z")) === "expired");
  rec("days until expiry counts whole days", daysUntilExpiry(day(10), NOW) === 10, String(daysUntilExpiry(day(10), NOW)));
  rec("and goes negative once passed", daysUntilExpiry(day(-3), NOW) === -3);

  const expired = credentialBlockers(
    [...fullSet().filter((c) => c.kind !== "vehicle_insurance"), cred("vehicle_insurance", { expiresOn: day(-1) })],
    NOW,
  );
  rec("an expired required credential blocks dispatch", expired.length === 1);
  rec("and the blocker carries the date", /2026-/.test(expired[0]?.reason ?? ""), expired[0]?.reason);

  rec(
    "an expiring credential does not block",
    credentialBlockers(
      [...fullSet().filter((c) => c.kind !== "vehicle_insurance"), cred("vehicle_insurance", { expiresOn: day(10) })],
      NOW,
    ).length === 0,
  );

  /*
   * A renewal uploaded alongside the old copy must win. Otherwise the act of
   * keeping the old document blocks the technician, and the fix looks like
   * deleting records.
   */
  const renewed = credentialBlockers(
    [
      ...fullSet().filter((c) => c.kind !== "vehicle_insurance"),
      cred("vehicle_insurance", { expiresOn: day(-30) }),
      cred("vehicle_insurance", { expiresOn: day(330) }),
    ],
    NOW,
  );
  rec("a renewal beside a lapsed copy does not block", renewed.length === 0, renewed[0]?.reason);

  /*
   * A lapsed document that is not required is a WORSE state than one that was
   * never uploaded, because the firm believed there was cover.
   */
  const lapsedOptional = credentialBlockers([...fullSet(), cred("gl_insurance", { expiresOn: day(-5) })], NOW);
  rec("a lapsed optional certificate on file still blocks", lapsedOptional.length === 1, lapsedOptional[0]?.reason);
  rec(
    "an optional certificate that was never uploaded does not",
    credentialBlockers(fullSet(), NOW).length === 0,
  );

  const warnings = expiringSoon(
    [
      cred("drivers_license", { expiresOn: day(30) }),
      cred("vehicle_insurance", { expiresOn: day(5) }),
      cred("gl_insurance", { expiresOn: day(300) }),
      cred("drone_license", { expiresOn: day(-2) }),
    ],
    NOW,
  );
  rec("the roster warns about exactly the expiring ones", warnings.length === 2, warnings.map((w) => w.kind).join(", "));
  rec("soonest first", warnings[0]?.kind === "vehicle_insurance");
  rec("an already expired credential is not listed as expiring soon", !warnings.some((w) => w.kind === "drone_license"));
}

// =====================================================================
// The fourth dispatch gate, through planDispatch itself.
// =====================================================================
{
  const base = {
    id: "t1",
    displayName: "Tech One",
    status: "active",
    coverageCounties: ["Nueces"],
    certifiedFor: ["windstorm-wpi-8"],
    openJobs: 0,
    baseLat: null,
    baseLng: null,
  };
  const job = { county: "Nueces", serviceSlug: "windstorm-wpi-8" };

  rec("a technician with no credential blockers is offered work", planDispatch(job, [base], 100).offers.length === 1);

  const blocked = planDispatch(job, [{ ...base, credentialBlockers: ["Vehicle insurance expired on 2026-08-01."] }], 100);
  rec("a credential blocker keeps a technician out of the offer list", blocked.offers.length === 0);
  rec("and the reason reaches the ineligible list verbatim", /Vehicle insurance expired/.test(blocked.ineligible[0]?.reason ?? ""), blocked.ineligible[0]?.reason);
  rec("an empty blocker array is not a blocker", planDispatch(job, [{ ...base, credentialBlockers: [] }], 100).offers.length === 1);
}

// =====================================================================
// Activation readiness.
// =====================================================================
{
  const item = (itemKey, over = {}) => ({
    itemKey,
    label: over.label ?? itemKey,
    status: over.status ?? "accepted",
    actor: over.actor ?? "person",
    expiresOn: over.expiresOn === undefined ? null : over.expiresOn,
  });

  const complete = () => [
    item("drivers_license", { label: "Driver licence", expiresOn: day(400) }),
    item("vehicle_insurance", { label: "Vehicle insurance card", expiresOn: day(300) }),
    item("w9", { label: "Form W-9" }),
    item("ica_signed", { label: "Signed independent contractor agreement" }),
    item("identity_verified_video", { label: "Identity confirmed on video call", actor: "admin" }),
  ];

  const ready = activationReadiness(complete(), ["Nueces"], NOW);
  rec("a complete onboarding is ready to activate", ready.ready, ready.blockers.join(" | "));

  const noCounties = activationReadiness(complete(), [], NOW);
  rec("no coverage counties blocks activation", !noCounties.ready);
  rec(
    "and explains that the technician would be invisible rather than just saying invalid",
    /offered nothing/i.test(noCounties.blockers.join(" ")),
    noCounties.blockers.find((b) => /coverage/i.test(b)),
  );

  const pendingDoc = activationReadiness(
    complete().map((i) => (i.itemKey === "w9" ? { ...i, status: "uploaded" } : i)),
    ["Nueces"],
    NOW,
  );
  rec("a document uploaded but not accepted blocks activation", !pendingDoc.ready);

  const noExpiry = activationReadiness(
    complete().map((i) => (i.itemKey === "vehicle_insurance" ? { ...i, expiresOn: null } : i)),
    ["Nueces"],
    NOW,
  );
  rec("an accepted expiring document with no date recorded blocks", !noExpiry.ready);
  rec("and is named so the operator knows what to ask for", noExpiry.missingExpiry.includes("Vehicle insurance card"), noExpiry.missingExpiry.join(", "));

  const alreadyExpired = activationReadiness(
    complete().map((i) => (i.itemKey === "drivers_license" ? { ...i, expiresOn: day(-1) } : i)),
    ["Nueces"],
    NOW,
  );
  rec("a document that expired before activation blocks", !alreadyExpired.ready);

  const operatorOutstanding = activationReadiness(
    complete().map((i) => (i.actor === "admin" ? { ...i, status: "pending" } : i)),
    ["Nueces"],
    NOW,
  );
  rec("an outstanding operator item blocks activation", !operatorOutstanding.ready);
  rec(
    "and says it is on the operator's side, not the applicant's",
    /operator/i.test(operatorOutstanding.blockers.join(" ")),
    operatorOutstanding.blockers.find((b) => /operator/i.test(b)),
  );

  /*
   * An item that is not on this person's checklist is not a blocker. The
   * operator adds bespoke items per hire, and a required-credential mapping
   * that fired for a checklist that never contained the item would make every
   * engineer onboarding unactivatable.
   */
  const engineerish = activationReadiness(
    [item("pe_license_card", { label: "Texas PE licence verification", expiresOn: day(500) })],
    ["Nueces"],
    NOW,
  );
  rec("a checklist without the field tech documents is not blocked by their absence", engineerish.ready, engineerish.blockers.join(" | "));

  rec("every mapped item key maps to a real credential kind", Object.values(CREDENTIAL_OF_ITEM).every((m) => typeof m.kind === "string" && m.kind.length > 0));
}

// =====================================================================
// The protocol certification check.
// =====================================================================
{
  const questions = [
    { id: "q1", prompt: "How many elevations?", options: ["Two", "Four", "As many as you like"], correctIndex: 1, rationale: "Four. One per face of the structure." },
    { id: "q2", prompt: "No attic access. What do you do?", options: ["Skip the item", "Photograph what blocks it"], correctIndex: 1, rationale: "Photograph the obstruction so the engineer can see why." },
    { id: "q3", prompt: "Roof pitch reads zero.", options: ["Record zero", "Leave it blank"], correctIndex: 0, rationale: "Zero is a reading. Blank is a missing item." },
  ];

  const all = (i) => questions.map((q) => ({ questionId: q.id, optionIndex: q.correctIndex + i }));

  const perfect = gradeAttempt(questions, questions.map((q) => ({ questionId: q.id, optionIndex: q.correctIndex })));
  rec("a fully correct attempt passes", perfect.passed && perfect.score === 100);

  const oneWrong = gradeAttempt(questions, [
    { questionId: "q1", optionIndex: 0 },
    { questionId: "q2", optionIndex: 1 },
    { questionId: "q3", optionIndex: 0 },
  ]);
  rec("one wrong answer fails the whole check", !oneWrong.passed, `${oneWrong.correct} of ${oneWrong.total}`);
  rec("and the score is recorded rather than just a fail", oneWrong.score === 67, String(oneWrong.score));
  rec("the reasoning for the wrong answer comes back", oneWrong.wrong.length === 1 && oneWrong.wrong[0].rationale.length > 10, oneWrong.wrong[0]?.rationale);

  const skipped = gradeAttempt(questions, [{ questionId: "q1", optionIndex: 1 }]);
  rec("an unanswered question is wrong", !skipped.passed);
  rec("and is named as skipped rather than as misunderstood", skipped.unanswered.length === 2, skipped.unanswered.join(", "));

  rec("an empty check never passes", !gradeAttempt([], []).passed);
  rec("answers for questions that do not exist are ignored", gradeAttempt(questions, [...questions.map((q) => ({ questionId: q.id, optionIndex: q.correctIndex })), { questionId: "ghost", optionIndex: 0 }]).passed);

  /*
   * The answer key never reaches the browser. A check whose answers are in the
   * page source is a formality, and a formality that writes a certification
   * record is worse than no record.
   */
  const served = forTechnician(questions);
  rec("a served question carries no correct index", served.every((q) => !("correctIndex" in q)));
  rec("and no rationale", served.every((q) => !("rationale" in q)));
  rec("but keeps the prompt and the options", served[0].prompt === questions[0].prompt && served[0].options.length === 3);
  rec(
    "the whole served payload contains no answer key",
    !JSON.stringify(served).includes("correctIndex") && !JSON.stringify(served).includes("Zero is a reading"),
  );

  const certified = { serviceSlug: "w", status: "certified", templateId: "v1", score: 100, attempts: 1 };
  const failed = { serviceSlug: "w", status: "failed", templateId: null, score: 67, attempts: 2 };
  const revoked = { serviceSlug: "w", status: "revoked", templateId: "v1", score: 100, attempts: 1 };

  rec("somebody who has never attempted may sit the check", canAttempt(null).ok);
  rec("somebody who failed may retake immediately", canAttempt(failed).ok);
  rec("somebody already certified is not asked to retake", !canAttempt(certified).ok);
  const revokedVerdict = canAttempt(revoked);
  rec("a revoked certification cannot be undone by retaking", !revokedVerdict.ok);
  rec(
    "and the refusal says who restores it",
    /engineer who revoked it/i.test(revokedVerdict.reason ?? ""),
    revokedVerdict.reason,
  );

  rec("a certification on the published version is not stale", !isStale(certified, "v1"));
  rec("a certification on a superseded version is stale", isStale(certified, "v2"));
  rec("a failed certification is never described as stale", !isStale(failed, "v2"));
  rec("an unknown published version does not manufacture staleness", !isStale(certified, null));

  rec("the label reads plainly for somebody who has not started", certificationLabel(null) === "Not started");
  rec("and counts attempts when there was more than one", /2 attempts/.test(certificationLabel({ ...certified, attempts: 2 })));
  rec("and names a revocation rather than hiding it", certificationLabel(revoked) === "Revoked");
}

console.log("============ ONBOARDING, CREDENTIALS, CERTIFICATION ============");
console.log("what a technician must hold, whether it is current, and how they earn a service line\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Nobody works on lapsed paperwork or an unearned certification.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
