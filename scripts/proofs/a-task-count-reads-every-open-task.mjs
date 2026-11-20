// @runtime react-server
/**
 * PROOF: THE DASHBOARD'S TASK COUNTS READ EVERY OPEN TASK, NOT THE FIRST PAGE,
 * AND A FAILED READ IS NULL RATHER THAN A SMALLER NUMBER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-task-count-reads-every-open-task.mjs
 *
 * Master undone list N5, 2026-11-20. `taskCounts` counted what `listTasksRead`
 * returned, and that was the first page of the tasks screen, 300 rows. So the
 * dashboard's "Tasks overdue" stopped at 300, and an overdue task on the second
 * page was not counted, with nothing on the tile saying the figure was partial.
 *
 * The real function runs against a stub PostgREST held here. It honours the
 * filters this read uses (not.in for done and cancelled), offset and limit, and
 * the transport's ceiling: it never answers more than 1,000 rows. No request
 * leaves this process.
 *
 * The fixture is built so the old shape and the new one give different
 * answers: 1,150 open tasks, 340 of them overdue and the rest due in the
 * future, plus 60 done and 20 cancelled that must not count. The first page of
 * 300 holds 300 overdue tasks (the screen sorts by due date, earliest first),
 * so the old shape answers open 300 and overdue 300; the true answer is open
 * 1,150 and overdue 340. 1,150 also crosses the 1,000-row ceiling, so a read
 * that stops at one answer is caught as well.
 */
const tables = { eng_tasks: [] };
let failing = false;

function parseIn(value) {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  return inner.split(",").map((v) => v.replace(/^"|"$/g, ""));
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  if (failing) return new Response(JSON.stringify({ message: "stub failure", code: "XX000" }), { status: 500, headers: json });
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (raw.startsWith("not.in.")) {
      const values = parseIn(raw.slice("not.".length));
      rows = rows.filter((r) => !values.includes(String(r[key])));
    } else if (raw.startsWith("eq.")) {
      rows = rows.filter((r) => String(r[key]) === raw.slice(3));
    }
  }
  /* The order this read asks for: due date ascending, nulls last, then id. */
  rows.sort((a, b) => (a.due_at === b.due_at ? (a.id < b.id ? -1 : 1) : a.due_at === null ? 1 : b.due_at === null ? -1 : a.due_at < b.due_at ? -1 : 1));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + Math.min(asked, 1000));
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { taskCounts, TASK_PAGE_SIZE } = await import("../../src/lib/ops-tasks.ts");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}
const uuid = (prefix, i) => `${prefix}${String(i).padStart(7, "0")}-0000-4000-8000-000000000000`;
const day = (offsetDays) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
const task = (id, status, due) => ({
  id, created_at: day(-60), title: `task ${id}`, description: null, assignee_id: null, created_by: null,
  due_at: due, priority: "normal", status, file_id: null, recurrence: null, source_key: null, completed_at: null,
});

for (let i = 0; i < 340; i += 1) tables.eng_tasks.push(task(uuid("a", i), "open", day(-30 + (i % 25))));
for (let i = 0; i < 810; i += 1) tables.eng_tasks.push(task(uuid("b", i), "open", day(2 + (i % 40))));
for (let i = 0; i < 60; i += 1) tables.eng_tasks.push(task(uuid("c", i), "done", day(-40)));
for (let i = 0; i < 20; i += 1) tables.eng_tasks.push(task(uuid("d", i), "cancelled", day(-40)));

const admin = { id: uuid("f", 1), role: "admin", status: "active" };

console.log("the fixture separates the two answers");
check("the page the old read stopped at is 300", TASK_PAGE_SIZE === 300, `TASK_PAGE_SIZE ${TASK_PAGE_SIZE}`);
check("more open tasks than one page and than one 1,000-row answer", 1150 > TASK_PAGE_SIZE && 1150 > 1000);

console.log("the counts are of every open task");
const counts = await taskCounts(admin);
check("it answers", counts !== null);
check("open is every open task, 1,150, not the first page's 300", counts?.open === 1150, `open ${counts?.open}`);
check("overdue is every overdue task, 340, not the first page's 300", counts?.overdue === 340, `overdue ${counts?.overdue}`);
check("done and cancelled tasks are not counted", counts !== null && counts.open < tables.eng_tasks.length);

console.log("a failed read is null, never a smaller number");
failing = true;
const failed = await taskCounts(admin);
failing = false;
check("a failing read answers null", failed === null, JSON.stringify(failed));

console.log("");
if (failures === 0) {
  console.log("PASS: the dashboard's task counts read every open task, and a failed read is null.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failures} check(s).`);
  process.exitCode = 1;
}
