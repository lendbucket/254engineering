/**
 * A TECHNICIAN SEES WHY NO JOB IS OFFERED TO THEM.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-technician-sees-why-no-job-is-offered.mjs
 *
 * Operator ruling, 2026-10-10 (gap 1 of the product audit): the technician's
 * dashboard names each blocker on dispatch, credentials, certification and
 * documents, where until then only the dispatcher saw them.
 *
 * Live on development, through the product's own dashboardFor: a probe
 * technician who covers no county, holds no certification and has submitted
 * no credential is shown a blocker for each, the W-9 and the contractor
 * agreement named among the credentials; and every reason shown is one
 * planDispatch gives when it leaves that same technician out of a job, so the
 * dashboard and dispatch say the same thing. Probe on @audit-probe.invalid,
 * removed and read back.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the dispatch blocker proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { dashboardFor } = await import("../../src/lib/ops-dashboard.ts");
const { planDispatch } = await import("../../src/lib/ops-dispatch.ts");
const { credentialBlockersFor } = await import("../../src/lib/ops-onboarding.ts");

const STAMP = Date.now();
let userId = null;
try {
  const email = `dispatch-blocker-proof-${STAMP}@audit-probe.invalid`;
  const made = await db.auth.admin.createUser({ id: randomUUID(), email, password: `p-${randomUUID()}`, email_confirm: true });
  if (made.error || !made.data?.user) throw new Error(`createUser: ${made.error?.message}`);
  userId = made.data.user.id;
  const { error } = await db.from("eng_profiles").insert({
    id: userId, email, display_name: "Dispatch blocker proof technician, not a real person", role: "field_tech", status: "active",
    coverage_counties: [],
  });
  if (error) throw new Error(`profile: ${error.message}`);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", userId).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", "field_tech");
  const actor = { ...row, grants: new Set((grants ?? []).map((g) => g.action)) };

  const dash = await dashboardFor(actor);
  const said = (dash?.attention ?? []).map((a) => `${a.label} | ${a.detail}`);
  check("the dashboard says the technician covers no counties", said.some((s) => /cover no counties/.test(s)));
  check("and that they are certified for no service line", said.some((s) => /not certified for any service line/.test(s)));
  /* By its own name: the reason read "No form w-9 on file" until 2026-10-10, found by this proof. */
  check(
    "and names the W-9, as Form W-9",
    said.some((s) => s.includes("No Form W-9 on file.")),
    said.filter((s) => /W.?9/i.test(s)).join(" / ").slice(0, 120) || `saw: ${said.map((s) => s.split(" | ")[1]).join(" / ").slice(0, 200)}`,
  );
  check(
    "and names the contractor agreement",
    said.some((s) => /contractor agreement/i.test(s)),
    said.filter((s) => /agreement/i.test(s)).join(" / ").slice(0, 120),
  );

  /* Every credential reason dispatch gives this technician is on the dashboard. */
  const reasons = (await credentialBlockersFor([userId])).get(userId) ?? [];
  const plan = planDispatch(
    { county: "Nueces", serviceSlug: "roof-inspections", lat: null, lng: null },
    [{ id: userId, displayName: "probe", status: "active", coverageCounties: ["Nueces"], certifiedFor: ["roof-inspections"], credentialBlockers: reasons, openJobs: 0, baseLat: null, baseLng: null }],
    null,
  );
  const dispatchSays = plan.ineligible[0]?.reason ?? "";
  check(
    "every credential reason dispatch gives for leaving this technician out is on their dashboard",
    reasons.length > 0 && reasons.every((r) => dispatchSays.includes(r) && said.some((s) => s.includes(r))),
    `${reasons.length} reason(s)`,
  );
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  if (userId) {
    await db.from("eng_profiles").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
    const left = (await db.auth.admin.getUserById(userId)).data?.user;
    check("the probe technician is removed, read back", !left);
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a technician sees why no job is offered to them, in dispatch's own words.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
