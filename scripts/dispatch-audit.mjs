/**
 * Dispatch and the evidence submission gate, asserted.
 *
 *   npx tsx scripts/dispatch-audit.mjs
 *
 * Pure. No server, no database, no network. Runs in phase zero.
 *
 * WHY THE EXPECTATIONS ARE WRITTEN OUT
 * ------------------------------------
 * Same discipline as roles-audit and files-audit. Looping over the module's own
 * eligibility rules and asserting it agrees with itself would pass on the day
 * somebody drops the certification gate. The rules that matter are stated here
 * by hand and the two have to agree.
 *
 * THE THREE GATES ARE THE PART THAT MUST NOT SOFTEN
 * -------------------------------------------------
 * Coverage, certification, active status. Each represents work the technician is
 * not permitted or not equipped to do, and the one with teeth is certification:
 * an uncertified technician working a windstorm inspection produces evidence an
 * engineer cannot rely on, which means a wasted visit and a file that has to
 * start again.
 *
 * THE SUBMISSION GATE IS THE OTHER ONE
 * ------------------------------------
 * A checklist that can be submitted incomplete produces an engineer opening a
 * package at review and finding the photograph that mattered is missing, by
 * which time the roof is closed and somebody is driving back.
 */
import { planDispatch, canRespondToOffer, milesBetween } from "../src/lib/ops-dispatch.ts";
import { checklistState, itemStatus, newCaptureId, progressLabel } from "../src/lib/ops-evidence.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const tech = (over = {}) => ({
  id: over.id ?? "t1",
  displayName: over.displayName ?? "Tech One",
  status: over.status ?? "active",
  coverageCounties: over.coverageCounties ?? ["Nueces"],
  certifiedFor: over.certifiedFor ?? ["windstorm-wpi-8"],
  openJobs: over.openJobs ?? 0,
  baseLat: over.baseLat ?? null,
  baseLng: over.baseLng ?? null,
});

const JOB = { county: "Nueces", serviceSlug: "windstorm-wpi-8" };

// =====================================================================
// The three gates, stated independently.
// =====================================================================
{
  /** [description, techOverrides, shouldBeOffered] */
  const CASES = [
    ["fully eligible", {}, true],
    ["covers the county, certified, active", { coverageCounties: ["Nueces", "Aransas"] }, true],
    ["does not cover the county", { coverageCounties: ["Travis"] }, false],
    ["covers nothing at all", { coverageCounties: [] }, false],
    ["not certified for this service", { certifiedFor: ["roof-inspections"] }, false],
    ["certified for nothing", { certifiedFor: [] }, false],
    ["suspended", { status: "suspended" }, false],
    ["still invited, never activated", { status: "invited" }, false],
    ["suspended AND uncertified", { status: "suspended", certifiedFor: [] }, false],
    ["county spelled with the word County", { coverageCounties: ["Nueces County"] }, true],
    ["county in a different case", { coverageCounties: ["nueces"] }, true],
  ];

  let wrong = 0;
  for (const [label, over, expected] of CASES) {
    const plan = planDispatch(JOB, [tech(over)], 12000);
    const offered = plan.offers.length === 1;
    if (offered !== expected) {
      wrong++;
      rec(`eligibility: ${label}`, false, `expected offered=${expected}, got ${offered}`);
    }
  }
  rec(`the three eligibility gates match the independent expectation (${CASES.length} cases)`, wrong === 0);

  // Every exclusion must say why. "Nobody was offered this job" with no reason
  // is the most confusing state an operator can meet.
  for (const [label, over] of [
    ["coverage", { coverageCounties: ["Travis"] }],
    ["certification", { certifiedFor: [] }],
    ["status", { status: "suspended" }],
  ]) {
    const plan = planDispatch(JOB, [tech(over)], 12000);
    rec(
      `an exclusion for ${label} carries a reason`,
      plan.ineligible.length === 1 && plan.ineligible[0].reason.length > 10,
      plan.ineligible[0]?.reason,
    );
  }
  rec(
    "the county name appears in a coverage refusal, so it can be acted on",
    planDispatch(JOB, [tech({ coverageCounties: ["Travis"] })], 12000).ineligible[0].reason.includes("Nueces"),
  );
}

// =====================================================================
// Ranking: load first, then proximity.
// =====================================================================
{
  const property = { ...JOB, lat: 27.8, lng: -97.4 };
  const near = tech({ id: "near", displayName: "Near", baseLat: 27.79, baseLng: -97.39, openJobs: 3 });
  const far = tech({ id: "far", displayName: "Far", baseLat: 29.4, baseLng: -98.5, openJobs: 0 });
  const plan = planDispatch(property, [near, far], 12000);

  rec(
    "a free technician outranks a closer but loaded one",
    plan.offers[0].techId === "far",
    plan.offers.map((o) => o.techId).join(" then "),
  );

  const a = tech({ id: "a", displayName: "A", baseLat: 27.79, baseLng: -97.39, openJobs: 1 });
  const b = tech({ id: "b", displayName: "B", baseLat: 28.9, baseLng: -97.9, openJobs: 1 });
  const tie = planDispatch(property, [b, a], 12000);
  rec("at equal load the closer technician ranks first", tie.offers[0].techId === "a");

  const unknown = tech({ id: "u", displayName: "Unknown", openJobs: 1 });
  const placed = tech({ id: "p", displayName: "Placed", baseLat: 27.79, baseLng: -97.39, openJobs: 1 });
  const mixed = planDispatch(property, [unknown, placed], 12000);
  rec(
    "a technician the platform can place outranks one it cannot",
    mixed.offers[0].techId === "p",
    mixed.offers.map((o) => o.techId).join(" then "),
  );

  rec("ranks are 1 based and contiguous", plan.offers.every((o, i) => o.rank === i + 1));
  rec("the offer carries the fee agreed at offer time", plan.offers[0].amountCents === 12000);
  rec("a job with no fee schedule entry still produces offers", planDispatch(JOB, [tech()], null).offers[0].amountCents === null);
}

// =====================================================================
// Distance.
// =====================================================================
{
  const corpus = { lat: 27.8006, lng: -97.3964 };
  const houston = { lat: 29.7604, lng: -95.3698 };
  const d = milesBetween(corpus, houston);
  /*
   * Corpus Christi to Houston is about 190 miles straight line. A band rather
   * than a fixed number, because this is a great circle approximation and
   * asserting a single value would be asserting the approximation rather than
   * the behaviour.
   */
  rec("distance is in the right band for a known pair", d > 170 && d < 215, `${d} miles`);
  rec("distance to itself is zero", milesBetween(corpus, corpus) === 0);
  rec("distance is symmetric", milesBetween(corpus, houston) === milesBetween(houston, corpus));
}

// =====================================================================
// Offers: first acceptance wins.
// =====================================================================
{
  const techActor = { id: "t1", role: "field_tech", status: "active" };
  const otherTech = { id: "t2", role: "field_tech", status: "active" };
  const admin = { id: "a1", role: "admin", status: "active" };
  const offer = { techId: "t1", state: "offered", expiresAt: null };

  rec("a technician may respond to their own live offer", canRespondToOffer(techActor, offer, false).ok);
  rec("a technician may not respond to somebody else's", !canRespondToOffer(otherTech, offer, false).ok);
  rec("an admin may respond on a technician's behalf", canRespondToOffer(admin, offer, false).ok);
  rec("an engineer may not respond to a job offer", !canRespondToOffer({ id: "e", role: "engineer", status: "active" }, offer, false).ok);
  rec("a signed out actor may not respond", !canRespondToOffer(null, offer, false).ok);
  rec("a suspended technician may not respond", !canRespondToOffer({ ...techActor, status: "suspended" }, offer, false).ok);

  const lost = canRespondToOffer(techActor, { ...offer, state: "withdrawn" }, false);
  rec("a withdrawn offer says somebody else took it", !lost.ok && /accepted this job first/i.test(lost.reason), lost.reason);

  const taken = canRespondToOffer(techActor, offer, true);
  rec(
    "a live offer on an already assigned file is refused with the same sentence",
    !taken.ok && /accepted this job first/i.test(taken.reason),
    taken.reason,
  );

  const expired = canRespondToOffer(techActor, { ...offer, expiresAt: "2020-01-01T00:00:00Z" }, false);
  rec("an offer past its expiry is refused", !expired.ok && /expired/i.test(expired.reason));
  rec("an offer with no expiry does not expire", canRespondToOffer(techActor, offer, false).ok);
  rec("accepting twice is refused", !canRespondToOffer(techActor, { ...offer, state: "accepted" }, false).ok);
}

// =====================================================================
// The submission gate.
// =====================================================================
{
  const items = [
    { id: "1", itemKey: "elevations", kind: "photo", label: "Four elevations", required: true, minCount: 4 },
    { id: "2", itemKey: "deck", kind: "photo", label: "Deck attachment", required: true },
    { id: "3", itemKey: "pitch", kind: "measurement", label: "Roof pitch", required: true, unit: "in12", minValue: 0, maxValue: 24 },
    { id: "4", itemKey: "notes", kind: "note", label: "Observations", required: false },
  ];

  const photo = (key) => ({ itemKey: key, kind: "photo", storageKey: `k/${key}/${Math.random()}` });

  rec("an empty checklist cannot be submitted", !checklistState(items, []).canSubmit);

  const partial = [photo("elevations"), photo("elevations"), photo("deck"), { itemKey: "pitch", kind: "measurement", valueNumber: 6 }];
  const partialState = checklistState(items, partial);
  rec("a photo item needing four is not satisfied by two", !partialState.canSubmit);
  rec("the blocker names the item and the shortfall", partialState.blockers.some((b) => /Four elevations/.test(b) && /2 of 4/.test(b)), partialState.blockers[0]);

  const complete = [
    photo("elevations"), photo("elevations"), photo("elevations"), photo("elevations"),
    photo("deck"),
    { itemKey: "pitch", kind: "measurement", valueNumber: 6 },
  ];
  const done = checklistState(items, complete);
  rec("a complete required set can be submitted", done.canSubmit, done.blockers.join("; "));
  rec("optional items never block", done.canSubmit && done.optionalDone === 0);
  rec("progress counts required only", done.requiredTotal === 3 && done.requiredDone === 3);

  /*
   * Zero is a reading. Checking truthiness rather than presence is the oldest
   * bug in form handling and it would silently discard a valid measurement.
   */
  const zero = checklistState(
    items,
    [photo("elevations"), photo("elevations"), photo("elevations"), photo("elevations"), photo("deck"), { itemKey: "pitch", kind: "measurement", valueNumber: 0 }],
  );
  rec("a measurement of zero counts as captured", zero.canSubmit, zero.blockers.join("; "));

  const outOfRange = itemStatus(items[2], [{ itemKey: "pitch", kind: "measurement", valueNumber: 40 }]);
  rec("a measurement above the expected maximum is refused", !outOfRange.satisfied);
  rec("and the refusal states the bound", /maximum of 24/.test(outOfRange.problem ?? ""), outOfRange.problem);

  /*
   * The correction case. A technician records a bad reading, sees the item is
   * still blocked, and records a good one. If the bad reading kept blocking,
   * that item would be unsatisfiable for the rest of the visit and the only way
   * out would be deleting a capture, which nobody thinks to do on a roof.
   */
  const corrected = itemStatus(items[2], [
    { itemKey: "pitch", kind: "measurement", valueNumber: 40 },
    { itemKey: "pitch", kind: "measurement", valueNumber: 6 },
  ]);
  rec("a corrected measurement satisfies the item", corrected.satisfied, corrected.problem ?? "");
  rec("and the order does not matter", itemStatus(items[2], [
    { itemKey: "pitch", kind: "measurement", valueNumber: 6 },
    { itemKey: "pitch", kind: "measurement", valueNumber: 40 },
  ]).satisfied);
  rec(
    "a lone out of range reading still blocks",
    !itemStatus(items[2], [{ itemKey: "pitch", kind: "measurement", valueNumber: 40 }]).satisfied,
  );

  const blank = itemStatus(
    { id: "5", itemKey: "n", kind: "note", label: "Note", required: true },
    [{ itemKey: "n", kind: "note", valueText: "   " }],
  );
  rec("whitespace is not a note", !blank.satisfied);

  const noProtocol = checklistState([], []);
  rec("a file with no protocol cannot be submitted by accident", !noProtocol.canSubmit);
  rec("and says so rather than showing zero of zero", progressLabel(noProtocol) === "No protocol attached", progressLabel(noProtocol));

  rec("a capture id is unique per call", newCaptureId() !== newCaptureId());
  rec("a capture id is prefixed so it is recognisable in a log", newCaptureId().startsWith("cap_"));
}

console.log("================ DISPATCH AND EVIDENCE ================");
console.log("eligibility, ranking, offer responses, and the submission gate\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Nobody is offered work they cannot do, and no package submits incomplete.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
