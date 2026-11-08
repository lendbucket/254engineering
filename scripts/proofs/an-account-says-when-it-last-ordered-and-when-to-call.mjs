// @runtime react-server
/**
 * PROOF: AN ACCOUNT SAYS WHEN IT LAST ORDERED, WHEN TO CALL, AND WHO MAY SEE
 * ITS MONEY. Robert's sales CRM ruling of 2026-11-02, item R6, with his answer
 * 2 (the rep is also the account manager) and the grants rule ("reps see no
 * revenue figures beyond their own attributed orders"). Also R5's rule on the
 * contact log's own route, applied there by R6.
 *
 *   A  the average interval: one order day gives none; two or more give the
 *      rounded mean gap, pinned on numbers
 *   B  churn and the check-in at the 89, 90 and 91 day boundary
 *   C  the quarter on the firm calendar, at each quarter's first day
 *   D  orders that count, revenue that counts, and an absent total is not zero
 *   E  the risk order, and the tasks an account wants, keyed so a re-run adds
 *      nothing
 *   F  who sees revenue: crm.reports or billing.read, never the rep; and the
 *      account view never carries a rep's figure
 *   G  the daily job and its key, the cron queueing it, and the raise reading
 *      the key before it writes
 *   H  the contact log's route asks the sales list's rule before logging
 *      against a company
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-account-says-when-it-last-ordered-and-when-to-call.mjs
 */
import { readSource } from "../lib/read-source.mjs";

const R = await import("../../src/lib/crm-account-rules.ts");
const { DEFAULT_ROLES, can } = await import("../../src/lib/ops-authz.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });

/* ---------------------------------------------------------------- A interval */
check("one order day gives no interval", R.averageIntervalDays(["2026-01-10"]) === null);
check("the same day twice is one day, so no interval", R.averageIntervalDays(["2026-01-10", "2026-01-10"]) === null);
check("two order days 30 apart give 30", R.averageIntervalDays(["2026-01-01", "2026-01-31"]) === 30);
check(
  "three order days give the rounded mean gap (0 to 20 to 45: 22.5 rounds to 23)",
  R.averageIntervalDays(["2026-01-01", "2026-01-21", "2026-02-15"]) === 23,
  String(R.averageIntervalDays(["2026-01-01", "2026-01-21", "2026-02-15"])),
);
check("order of input does not matter", R.averageIntervalDays(["2026-02-15", "2026-01-01", "2026-01-21"]) === 23);

const order = (day, status = "complete", totalCents = 70900, refundedCents = 0) => ({ day, status, totalCents, refundedCents });

const oneOrder = R.accountStanding({ openedOn: "2026-01-01", today: "2026-02-01", orders: [order("2026-01-10")] });
check("an account with one order has no reorder reminder", oneOrder.reorderDueOn === null && oneOrder.averageIntervalDays === null);
check("and wants no reorder task", R.accountTasksWanted({ accountId: "a", name: "A", openedOn: "2026-01-01", today: "2026-02-01", standing: oneOrder }).every((t) => t.kind !== "reorder"));

const two = R.accountStanding({ openedOn: "2026-01-01", today: "2026-03-05", orders: [order("2026-01-01"), order("2026-01-31")] });
check("two orders 30 days apart: reorder due 30 days after the last", two.reorderDueOn === "2026-03-02", String(two.reorderDueOn));
check("and on 2026-03-05 the reorder is overdue", two.reorderOverdue === true && two.risk === 1, `risk ${two.risk}`);
const wantedTwo = R.accountTasksWanted({ accountId: "acc-1", name: "Gulf Roofing", openedOn: "2026-01-01", today: "2026-03-05", standing: two });
check("an overdue reorder wants a task keyed on the account and its due day", wantedTwo.some((t) => t.key === "crm-reorder:acc-1:2026-03-02"), wantedTwo.map((t) => t.key).join(", "));

/* ---------------------------------------------------------- B the boundary */
const at = (days) => R.addDays("2026-01-01", days);
const quiet = (days) => R.accountStanding({ openedOn: "2025-06-01", today: at(days), orders: [order("2026-01-01")] });
check("89 days quiet is not churned", quiet(89).churned === false && quiet(89).daysSince === 89);
check("90 days quiet is churned", quiet(90).churned === true && quiet(90).risk === 0);
check("91 days quiet is churned", quiet(91).churned === true);
const neverOrdered = (days) => R.accountStanding({ openedOn: "2026-01-01", today: at(days), orders: [] });
check("an account that never ordered is churned from day 90 after it opened, not before", neverOrdered(89).churned === false && neverOrdered(90).churned === true);

check("no check-in has come due at day 89", R.checkInDueBy("2026-01-01", at(89)) === null);
check("the first check-in comes due at day 90", R.checkInDueBy("2026-01-01", at(90)) === at(90));
check("at day 91 the due check-in is still day 90's", R.checkInDueBy("2026-01-01", at(91)) === at(90));
check("at day 180 the next one has come due", R.checkInDueBy("2026-01-01", at(180)) === at(180));
const checkInTasks = (days) =>
  R.accountTasksWanted({ accountId: "acc-2", name: "Coastal Solar", openedOn: "2026-01-01", today: at(days), standing: neverOrdered(days) }).filter((t) => t.kind === "check_in");
check("day 89 wants no check-in task", checkInTasks(89).length === 0);
check("day 90 wants one, keyed on the account and day 90", checkInTasks(90).length === 1 && checkInTasks(90)[0].key === `crm-checkin:acc-2:${at(90)}`);
check("day 91 wants the same key as day 90, so a re-run the next day adds nothing", checkInTasks(91)[0]?.key === checkInTasks(90)[0]?.key);

/* ------------------------------------------------------------ C quarters */
check("the quarter holding 2026-01-01 starts 2026-01-01", R.quarterStart("2026-01-01") === "2026-01-01");
check("the quarter holding 2026-03-31 starts 2026-01-01", R.quarterStart("2026-03-31") === "2026-01-01");
check("the quarter holding 2026-04-01 starts 2026-04-01", R.quarterStart("2026-04-01") === "2026-04-01");
check("the quarter holding 2026-11-02 starts 2026-10-01", R.quarterStart("2026-11-02") === "2026-10-01");
const q = R.accountStanding({ openedOn: "2026-01-01", today: "2026-10-01", orders: [order("2026-09-30"), order("2026-10-01")] });
check("on the first day of a quarter only that day's order is this quarter's", q.ordersThisQuarter === 1, String(q.ordersThisQuarter));
const fw = readSource("src/lib/crm-accounts.ts");
check("an order's day is read on the firm calendar", /todayInFirmCalendar\(new Date\(o\.placed_at \?\? o\.created_at\)\)/.test(fw));

/* ------------------------------------------------- D what counts as money */
const mixed = R.accountStanding({
  openedOn: "2026-01-01",
  today: "2026-02-01",
  orders: [order("2026-01-05", "complete", 70900, 10000), order("2026-01-06", "refunded", 70900, 70900), order("2026-01-07", "cancelled", 70900), order("2026-01-08", "awaiting_payment", 70900)],
});
check("cancelled and unpaid orders do not count; a refunded one does", mixed.ordersEver === 2, String(mixed.ordersEver));
check("revenue is the earning totals less refunds: 709.00 less 100.00", mixed.lifetimeRevenueCents === 60900, String(mixed.lifetimeRevenueCents));
const unknown = R.accountStanding({ openedOn: "2026-01-01", today: "2026-02-01", orders: [order("2026-01-05"), order("2026-01-06", "paid", null)] });
check("an earning order with no total leaves revenue not stated, never summed as zero", unknown.lifetimeRevenueCents === null);

/* ----------------------------------------------------- E risk and tasks */
const rows = [
  { name: "On track", standing: { risk: 3, daysSince: 5 } },
  { name: "Due soon", standing: { risk: 2, daysSince: 20 } },
  { name: "Quiet B", standing: { risk: 0, daysSince: 100 } },
  { name: "Overdue", standing: { risk: 1, daysSince: 40 } },
  { name: "Quiet A", standing: { risk: 0, daysSince: 140 } },
];
check(
  "the risk order: quiet first (longest quiet first), then overdue, then due soon, then the rest",
  R.byRisk(rows).map((r) => r.name).join(",") === "Quiet A,Quiet B,Overdue,Due soon,On track",
  R.byRisk(rows).map((r) => r.name).join(","),
);
const soon = R.accountStanding({ openedOn: "2026-01-01", today: "2026-02-20", orders: [order("2026-01-01"), order("2026-02-01")] });
check("a reorder due within 14 days is due soon (31 days after 2026-02-01 is 2026-03-04)", soon.reorderDueOn === "2026-03-04" && soon.dueSoon === true && soon.risk === 2, `${soon.reorderDueOn} risk ${soon.risk}`);

/* -------------------------------------------------------- F who sees money */
const actorFor = (key) => ({ id: `id-${key}`, role: key, status: "active", email: `${key}@audit-probe.invalid`, grants: new Set(DEFAULT_ROLES.find((r) => r.key === key)?.grants ?? []) });
const { seesAccountRevenue } = await import("../../src/lib/crm-accounts.ts");
check("the administrator sees account revenue", seesAccountRevenue(actorFor("admin")) === true);
check("the operations manager (the sales manager, crm.reports) sees it", seesAccountRevenue(actorFor("ops_manager")) === true);
check("the rep does not", seesAccountRevenue(actorFor("rep")) === false && can(actorFor("rep"), "crm.use"));
check("the rule is crm.reports or billing.read and nothing wider", /return can\(actor, "crm\.reports"\) \|\| can\(actor, "billing\.read"\);/.test(fw));
check("a rep's row carries no figure: revenue is stripped from the standing and set only for a money viewer", /const \{ lifetimeRevenueCents, \.\.\.rest \} = standing;/.test(fw) && /lifetimeRevenueCents: money \? lifetimeRevenueCents : null,/.test(fw));
check("the account view reads only accounts the sales list's rule shows this person", /canSeeCompany\(viewer, p\.owner_id, p\.county\)/.test(fw));
const page = readSource("src/app/portal/(app)/crm/accounts/page.tsx");
check("the screen draws the revenue column only for a money viewer", /\.\.\.\(read\.seesRevenue\s*\?/.test(page));
check("the screen says a failed read is a failed read", page.includes("This is a failed read, not an empty list."));

/* ------------------------------------------------- G the job and its key */
const jobs = readSource("src/lib/job-handlers.ts");
check("the daily job is keyed on the day", /registerJob\("crm\.account_tasks"[\s\S]{0,200}keyOf\("crm-account-tasks", p\.day\)/.test(jobs));
const cron = readSource("src/app/api/cron/daily/route.ts");
check("the daily cron queues it on the firm's day", /enqueue\("crm\.account_tasks", \{ day: firmDay \}\)/.test(cron));
const raiseAt = fw.indexOf("export async function refreshAccountTasks");
const raiseBody = raiseAt >= 0 ? fw.slice(raiseAt) : "";
check("the raise is found", raiseAt >= 0);
check(
  "each task is looked up by its key before it is written, so a re-run adds nothing",
  raiseBody.indexOf('.eq("source_key", task.key)') > 0 && raiseBody.indexOf('.eq("source_key", task.key)') < raiseBody.indexOf('from("eng_tasks").insert('),
);
check("a concurrent raise caught by the unique key counts as already raised, not a fault", /error\.code === "23505"/.test(raiseBody));
check("the task goes to the company's owner, the account manager", /assignee_id: prospect\.owner_id,/.test(raiseBody));

/* -------------------------------------------- H the contact log's route */
const route = readSource("src/app/api/portal/contact-log/route.ts");
const askAt = route.indexOf("mayActOnCompany(actor, subjectId)");
check("the contact log's route asks the sales list's rule for a company", askAt > 0 && /if \(subject === "prospect"\)/.test(route));
check("and asks it before anything is logged", askAt > 0 && askAt < route.indexOf("await logContact("));
const pipe = readSource("src/lib/crm-pipeline.ts");
check("the rule it asks is visibleCompany, canSeeCompany over the viewer's territories", /export async function mayActOnCompany[\s\S]{0,400}visibleCompany\(actor, db, id\)/.test(pipe));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: an account says when it last ordered, when to reorder and check in, churns at 90 days quiet, and shows its money only to the sales manager and the administrator (${out.length} checks).`
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
