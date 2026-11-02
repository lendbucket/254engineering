/**
 * THE REVIEW QUEUE SEARCHES, FILTERS AND SORTS, AND WITH NOTHING CHOSEN IT IS
 * THE READ EXACTLY. Robert's ruling P4, 2026-11-01 evening: "add search,
 * filter and sort. The default order stays exactly what it is today; filters
 * only narrow. No change to what the engineer sees first unless he chooses it."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-review-queue-first-view-does-not-move.mjs
 *
 * Asked of the pure engine with rows handed to it, in an order that is
 * deliberately NOT sorted by any field the list can sort by (counties,
 * addresses, services and revision counts all out of order), so a default that
 * quietly sorted by any of them would move a row and fail. The page's use of
 * the engine is asserted by the-engineer-withdraws-a-certification-on-review-
 * with-a-reason.mjs.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { reviewQueueList } = await import("../../src/lib/review-queue-list.ts");
const { staffListQuery, staffListRows } = await import("../../src/lib/staff-lists.ts");

const ME = "eng-1";
const names = { "roof-inspections": "Roof inspection", "foundation-inspections": "Foundation inspection", "windstorm-wpi-8": "WPI-8" };
const serviceName = (slug) => names[slug] ?? slug;
const spec = reviewQueueList(serviceName, Object.keys(names), ME);

/* The read's order: what reviewQueue returned, oldest evidence first. Every other field is shuffled against it. */
const read = [
  { id: "a", file_number: "254-0009", property_address: "9 Zeta St", county: "Nueces", service_slug: "windstorm-wpi-8", status: "evidence_submitted", evidence_submitted_at: "2026-10-01T10:00:00Z", assigned_engineer_id: ME, revision_count: 0 },
  { id: "b", file_number: "254-0002", property_address: "2 Alpha Rd", county: "Bexar", service_slug: "roof-inspections", status: "revisions_requested", evidence_submitted_at: "2026-10-02T10:00:00Z", assigned_engineer_id: null, revision_count: 2 },
  { id: "c", file_number: "254-0005", property_address: "5 Mu Ln", county: "Travis", service_slug: "foundation-inspections", status: "under_review", evidence_submitted_at: "2026-10-03T10:00:00Z", assigned_engineer_id: "eng-2", revision_count: 1 },
  { id: "d", file_number: "254-0001", property_address: "1 Beta Ave", county: "Aransas", service_slug: "roof-inspections", status: "evidence_submitted", evidence_submitted_at: "2026-10-04T10:00:00Z", assigned_engineer_id: ME, revision_count: 3 },
  { id: "e", file_number: "254-0007", property_address: "7 Kappa Ct", county: "Cameron", service_slug: "windstorm-wpi-8", status: "evidence_submitted", evidence_submitted_at: null, assigned_engineer_id: null, revision_count: 0 },
];
const ids = (rows) => rows.map((r) => r.id).join("");
const run = (params) => staffListRows(read, staffListQuery(params, spec), spec);
const isSubsequence = (rows) => {
  let at = -1;
  return rows.every((r) => {
    const i = read.indexOf(r);
    const ok = i > at;
    at = i;
    return ok;
  });
};

check("with no parameter the list is the read, in the read's order", ids(run({})) === "abcde", ids(run({})));
check("the default sort is the read's own order, ascending", spec.defaultSort === "waiting" && staffListQuery({}, spec).ascending === true);
check("an unknown sort falls back to the read's order", ids(run({ sort: "price" })) === "abcde", ids(run({ sort: "price" })));
check("the form's own default submission (waiting, ascending) is the read as well", ids(run({ sort: "waiting", dir: "asc", q: "", status: "", service: "", assigned: "" })) === "abcde");

for (const [what, params, expect] of [
  ["a status filter", { status: "submitted" }, "ade"],
  ["a service filter", { service: "roof-inspections" }, "bd"],
  ["assigned to me", { assigned: "mine" }, "ad"],
  ["unassigned", { assigned: "unassigned" }, "be"],
  ["a search by county", { q: "nueces" }, "a"],
  ["a search by service name", { q: "wpi" }, "ae"],
  ["a search by file number", { q: "254-000" }, "abcde"],
  ["two filters together", { status: "submitted", service: "windstorm-wpi-8" }, "ae"],
]) {
  const got = run(params);
  check(`${what} only narrows, and keeps the read's order`, ids(got) === expect && isSubsequence(got), ids(got));
}
check("an unknown filter value narrows nothing", ids(run({ status: "sealed" })) === "abcde");
check("assigned to me matches nothing for an actor with no id", ids(staffListRows(read, staffListQuery({ assigned: "mine" }, reviewQueueList(serviceName, Object.keys(names), null)), reviewQueueList(serviceName, Object.keys(names), null))) === "");

check("another order appears only when he picks one: county", ids(run({ sort: "county" })) === "dbeac", ids(run({ sort: "county" })));
check("revisions so far, most first", ids(run({ sort: "revisions" })) === "dbcae", ids(run({ sort: "revisions" })));
check("and he can turn the waiting order round himself", ids(run({ sort: "waiting", dir: "desc" })) === "edcba");

console.log(wrong === 0 ? "PASS: the review queue searches, filters and sorts, and with nothing chosen it is the read exactly." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
