/**
 * Engineer review: the four actions, the responsible charge log, and the export.
 *
 *   npx tsx scripts/review-audit.mjs
 *
 * Pure. No server, no database, no network. Runs in phase zero.
 *
 * WHY THE EXPECTATIONS ARE WRITTEN OUT
 * ------------------------------------
 * Same discipline as files-audit, roles-audit, dispatch-audit and
 * onboarding-audit. Looping over the module's own REVIEW_ACTIONS and asserting
 * it agrees with itself would pass on the day somebody drops refusal.
 *
 * THE ONE THING THIS FILE EXISTS FOR ABOVE ALL OTHERS
 * ---------------------------------------------------
 * That declining to seal is always available. Every other check here could be
 * rewritten and the platform would still be usable; if that one ever goes green
 * while being false, the firm is applying pressure to a licensed engineer's
 * professional judgment and nobody will find out from the software.
 */
import {
  ACTION_LABEL,
  ACTION_TARGET,
  BRISK_REVIEW_MINUTES,
  MIN_REASON_LENGTH,
  REQUIRES_REASON,
  REVIEW_ACTIONS,
  availableReviewActions,
  canReview,
  chargeLogRow,
  isBriskReview,
  minutesBetween,
  monthlyExportCsv,
  periodOf,
} from "../src/lib/ops-review.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const actor = (role, over = {}) => ({ id: over.id ?? `${role}-1`, role, status: over.status ?? "active" });
const engineer = actor("engineer");
const admin = actor("admin");
const tech = actor("field_tech");

const subject = (over = {}) => ({
  status: over.status ?? "under_review",
  packageComplete: over.packageComplete ?? true,
  assignedEngineerId: over.assignedEngineerId ?? "engineer-1",
});

const REASON = "The deck attachment cannot be established from what was captured.";
const LIVE = { prelaunch: false };
const GATED = { prelaunch: true };

// =====================================================================
// The four actions, named independently.
// =====================================================================
{
  const EXPECTED = ["seal", "revisions", "site_visit", "refuse"];
  rec(
    "there are exactly four review actions and refusal is one of them",
    EXPECTED.every((a) => REVIEW_ACTIONS.includes(a)) && REVIEW_ACTIONS.length === EXPECTED.length,
    REVIEW_ACTIONS.join(", "),
  );

  /** [action, target status] written by hand. */
  const TARGETS = [
    ["seal", "sealed"],
    ["revisions", "revisions_requested"],
    // A site visit is a new journey and goes through dispatch, not back to the
    // technician who already holds the file.
    ["site_visit", "needs_dispatch"],
    ["refuse", "refused"],
  ];
  let wrong = 0;
  for (const [action, target] of TARGETS) {
    if (ACTION_TARGET[action] !== target) {
      wrong++;
      rec(`target: ${action}`, false, `expected ${target}, got ${ACTION_TARGET[action]}`);
    }
  }
  rec("each action moves the file where it should", wrong === 0);

  rec("every action has a label somebody can read", REVIEW_ACTIONS.every((a) => (ACTION_LABEL[a] ?? "").length > 3));
  rec("refusal is not called cancellation", !/cancel/i.test(ACTION_LABEL.refuse), ACTION_LABEL.refuse);
}

// =====================================================================
// THE ONE THAT MATTERS: declining is always available.
// =====================================================================
{
  rec("an engineer can decline to seal", canReview(engineer, subject(), "refuse", REASON, LIVE).ok);

  const gated = canReview(engineer, subject(), "refuse", REASON, GATED);
  rec("and can decline while the compliance gate is active", gated.ok, gated.ok ? "" : gated.reason);

  const sealGated = canReview(engineer, subject(), "seal", null, GATED);
  rec("while sealing in the same breath is refused", !sealGated.ok);
  rec(
    "and the refusal explains that declining is still open",
    /declining to seal is still available/i.test(sealGated.reason ?? ""),
    sealGated.reason,
  );

  /*
   * An incomplete package. Sealing it would certify a review of evidence that
   * is not there, so sealing is refused. Declining is not: on a package that
   * cannot be completed, refusing is often exactly the right call.
   */
  const incomplete = subject({ packageComplete: false });
  rec("an incomplete package cannot be sealed", !canReview(engineer, incomplete, "seal", null, LIVE).ok);
  rec("but can be declined", canReview(engineer, incomplete, "refuse", REASON, LIVE).ok);
  rec("and can be sent back for revisions", canReview(engineer, incomplete, "revisions", REASON, LIVE).ok);
  rec("and can be sent for a site visit", canReview(engineer, incomplete, "site_visit", REASON, LIVE).ok);

  rec(
    "the refusal to seal an incomplete package says what to do instead",
    /send it back for revisions, or decline/i.test(
      canReview(engineer, incomplete, "seal", null, LIVE).reason ?? "",
    ),
  );
}

// =====================================================================
// Who may decide.
// =====================================================================
{
  const CASES = [
    ["an engineer seals", engineer, "seal", true],
    ["an engineer declines", engineer, "refuse", true],
    ["an engineer requests revisions", engineer, "revisions", true],
    ["an administrator seals", admin, "seal", true],
    ["a technician seals", tech, "seal", false],
    ["a technician declines", tech, "refuse", false],
    ["a technician requests revisions", tech, "revisions", false],
    ["a signed out actor decides anything", null, "refuse", false],
    ["a suspended engineer decides", actor("engineer", { status: "suspended" }), "refuse", false],
  ];

  let wrong = 0;
  for (const [label, who, action, expected] of CASES) {
    const got = canReview(who, subject(), action, REASON, LIVE).ok;
    if (got !== expected) {
      wrong++;
      rec(`permission: ${label}`, false, `expected ${expected}, got ${got}`);
    }
  }
  rec(`who may decide matches the independent expectation (${CASES.length} cases)`, wrong === 0);
}

// =====================================================================
// The file has to be in review.
// =====================================================================
{
  for (const status of ["intake", "evidence_submitted", "sealed", "refused", "closed", "cancelled"]) {
    const verdict = canReview(engineer, subject({ status }), "refuse", REASON, LIVE);
    rec(`a ${status} file cannot be decided`, !verdict.ok);
  }
  rec(
    "and the refusal names the missing step rather than blaming permissions",
    /has to be under review/i.test(
      canReview(engineer, subject({ status: "intake" }), "seal", null, LIVE).reason ?? "",
    ),
  );
}

// =====================================================================
// Reasons.
// =====================================================================
{
  /** [action, needs a written reason] */
  const NEEDS = [
    ["seal", false],
    ["revisions", true],
    ["site_visit", true],
    ["refuse", true],
  ];
  let wrong = 0;
  for (const [action, needs] of NEEDS) {
    if (REQUIRES_REASON[action] !== needs) {
      wrong++;
      rec(`reason requirement: ${action}`, false, `expected ${needs}`);
    }
  }
  rec("the actions that need a written reason are the three that go to somebody", wrong === 0);

  rec("sealing needs no note, because the deliverable is the statement", canReview(engineer, subject(), "seal", null, LIVE).ok);
  rec("declining with no reason is refused", !canReview(engineer, subject(), "refuse", null, LIVE).ok);
  rec("declining with whitespace is refused", !canReview(engineer, subject(), "refuse", "        ", LIVE).ok);
  rec("declining with one word is refused", !canReview(engineer, subject(), "refuse", "no", LIVE).ok);
  rec(
    "and the refusal says who reads the reason",
    /client/i.test(canReview(engineer, subject(), "refuse", "no", LIVE).reason ?? ""),
    canReview(engineer, subject(), "refuse", "no", LIVE).reason,
  );
  rec("a real reason is accepted", canReview(engineer, subject(), "refuse", REASON, LIVE).ok);
  rec(
    "the minimum is short enough not to be a hurdle",
    MIN_REASON_LENGTH <= 20,
    String(MIN_REASON_LENGTH),
  );

  /*
   * An empty reason box is a state of the FORM, not a property of the file. A
   * screen that renders "decline" as blocked because nothing is typed yet
   * teaches its reader that the explanations are noise.
   */
  const available = availableReviewActions(engineer, subject(), LIVE);
  rec(
    "the button list does not report decline as blocked merely because the box is empty",
    available.find((a) => a.action === "refuse")?.allowed === true,
  );
  rec(
    "and under the gate it reports sealing blocked with the gate's own sentence",
    /cannot seal work yet/i.test(
      availableReviewActions(engineer, subject(), GATED).find((a) => a.action === "seal")?.reason ?? "",
    ),
  );
  rec(
    "while still offering decline under the gate",
    availableReviewActions(engineer, subject(), GATED).find((a) => a.action === "refuse")?.allowed === true,
  );
}

// =====================================================================
// The responsible charge log.
// =====================================================================
{
  const at = new Date("2026-03-14T15:09:00Z");
  const base = {
    engineerId: "eng-1",
    fileId: "file-1",
    propertyAddress: "1400 Example Street",
    county: "Nueces",
    reviewMinutes: 42,
    revisionCount: 1,
    siteVisit: true,
    reason: REASON,
    at,
  };

  const sealed = chargeLogRow({ ...base, action: "seal", documentType: "WPI-8" });
  rec("a seal writes a log row", sealed.file_id === "file-1" && sealed.engineer_id === "eng-1");
  rec("marked as not refused", sealed.refused === false);
  /*
   * A revision note is chatter between an engineer and a technician. A refusal
   * reason is part of the professional record. Carrying the first into the log
   * a board reads would bury the second.
   */
  rec("and carries no refusal reason", sealed.refusal_reason === null);
  rec("the review minutes are recorded", sealed.review_minutes === 42);
  rec("the revision count is recorded", sealed.revision_count === 1);
  rec("the site visit is recorded", sealed.site_visit === true);
  rec("the period is the month of the review", sealed.period === "2026-03", sealed.period);

  const refused = chargeLogRow({ ...base, action: "refuse" });
  rec("a refusal writes a log row too", refused.file_id === "file-1");
  rec("marked as refused", refused.refused === true);
  rec("and carries the reason", refused.refusal_reason === REASON);

  const revised = chargeLogRow({ ...base, action: "revisions" });
  rec("a revision request is logged and is not a refusal", revised.refused === false && revised.refusal_reason === null);

  const emptyReason = chargeLogRow({ ...base, action: "refuse", reason: "   " });
  rec("a whitespace refusal reason is stored as nothing rather than as blank text", emptyReason.refusal_reason === null);

  rec("the period of a December review is that December", periodOf(new Date("2026-12-31T23:00:00")) === "2026-12");
  rec("and a January review is that January", periodOf(new Date("2026-01-01T00:30:00")) === "2026-01");
}

// =====================================================================
// The export. This is the file a regulator reads.
// =====================================================================
{
  const rows = [
    {
      reviewed_at: "2026-03-02T14:00:00.000Z",
      property_address: "1400 Example Street",
      county: "Nueces",
      document_type: "WPI-8",
      review_minutes: 42,
      revision_count: 0,
      site_visit: false,
      refused: false,
      refusal_reason: null,
    },
    {
      reviewed_at: "2026-03-09T10:00:00.000Z",
      property_address: "88 Example Court",
      county: "Aransas",
      document_type: "WPI-8",
      review_minutes: 31,
      revision_count: 2,
      site_visit: true,
      refused: true,
      refusal_reason: "-- the roof deck could not be established from the evidence provided",
    },
  ];

  const csv = monthlyExportCsv(rows, {
    engineerName: "Example Engineer",
    licenseNumber: "00000",
    period: "2026-03",
  });

  rec("the export names the engineer", csv.includes("Example Engineer"));
  rec("and the licence", csv.includes("00000"));
  rec("and the period", csv.includes("2026-03"));
  rec("it counts the records", /"Records","2"/.test(csv));
  /*
   * The count a regulator looks for first. A log containing only the files an
   * engineer sealed describes an engineer who never said no, which is not a
   * defensible professional record.
   */
  rec("and counts the refusals separately", /"Declined to seal","1"/.test(csv));
  rec("both rows are present", csv.includes("1400 Example Street") && csv.includes("88 Example Court"));
  rec("a refusal is labelled as one", csv.includes('"Declined to seal"'));
  rec("a seal is labelled as one", csv.includes('"Sealed"'));

  /*
   * The refusal reason above begins with two hyphens. A spreadsheet treats a
   * leading -, =, + or @ as the start of a formula, and this export is handed
   * to a regulator. An engineer's stated reason must arrive as text.
   */
  rec("a reason beginning with a dash is not left as a formula", csv.includes("\"'-- the roof deck"), "prefixed");
  for (const dangerous of ["=SUM(1)", "+1", "@cmd", "-1"]) {
    const one = monthlyExportCsv(
      [{ ...rows[0], refused: true, refusal_reason: dangerous }],
      { engineerName: "E", licenseNumber: null, period: "2026-03" },
    );
    rec(`a reason starting with ${dangerous[0]} is escaped`, one.includes(`"'${dangerous}"`));
  }

  const quoted = monthlyExportCsv(
    [{ ...rows[0], refusal_reason: 'he said "no"' }],
    { engineerName: "E", licenseNumber: null, period: "2026-03" },
  );
  rec("embedded quotes are doubled rather than breaking the row", quoted.includes('""no""'));

  const withComma = monthlyExportCsv(
    [{ ...rows[0], property_address: "1400 Example Street, Unit 2" }],
    { engineerName: "E", licenseNumber: null, period: "2026-03" },
  );
  rec("a comma in an address does not split the row", withComma.includes('"1400 Example Street, Unit 2"'));

  const empty = monthlyExportCsv([], { engineerName: "E", licenseNumber: null, period: "2026-04" });
  rec("a month with no reviews still produces a file with headers", empty.includes("Reviewed at"));
  rec("and says zero rather than looking broken", /"Records","0"/.test(empty));
  rec("a missing licence number says so rather than being blank", empty.includes("not recorded"));
}

// =====================================================================
// The clock.
// =====================================================================
{
  const start = new Date("2026-03-14T15:00:00Z");
  rec("42 minutes measures as 42", minutesBetween(start, new Date("2026-03-14T15:42:00Z")) === 42);
  rec("seconds round to the nearest minute", minutesBetween(start, new Date("2026-03-14T15:00:40Z")) === 1);
  rec("a review that ends before it starts is zero, not negative", minutesBetween(start, new Date("2026-03-14T14:00:00Z")) === 0);
  rec("an instant review is zero", minutesBetween(start, start) === 0);

  /*
   * Surfaced, never blocked. A minimum review time would teach people to leave
   * the tab open while they make coffee, which corrupts the only honest number
   * in the log.
   */
  rec("a two minute review is flagged as brisk", isBriskReview(2));
  rec("a five minute review is not", !isBriskReview(5));
  rec("an unmeasured review is not flagged", !isBriskReview(null));
  rec("the brisk threshold is small enough to be rare", BRISK_REVIEW_MINUTES <= 5, String(BRISK_REVIEW_MINUTES));
}

console.log("================ ENGINEER REVIEW ================");
console.log("the four actions, the responsible charge log, and the export a regulator reads\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Declining to seal is always available, and always recorded.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
