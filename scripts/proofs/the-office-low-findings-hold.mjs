/**
 * PROOF: THE OFFICE AUDIT'S LOW FINDINGS ARE CLOSED.
 *
 * The chat counterpart's office audit of 2026-11-02 (issue #1 comment
 * 6585009173), low findings, built under Robert's ruling of the same day:
 *
 *   F14  four CSV exports (clients, inbox, jobs not yet paid, orders) wrote no
 *        audit row; each writes one, before the file is assembled, or refuses.
 *   F15  the people screen drew Resend invite, Force reset, Suspend and Restore
 *        for anybody who could open it; each is drawn only for the grant its
 *        route asks.
 *   F16  createTask, setTaskStatus and assignTask asked no task grant; each asks
 *        tasks.use, and every role that records a deletion request holds it.
 *   F17  activation after the account was created could not be run again; the
 *        profile is recorded on the onboarding at once and a second attempt
 *        finishes it, and the message says so.
 *   F18  answering a deletion request and converting a lead were read, then
 *        written unconditionally; both write only where not already done.
 *   F19  requireAdmin checked profiles.list; it takes the action, and the
 *        applications reads pass applications.read.
 *   F20  api/portal/exports audited with writeAudit, which carries on when the
 *        write fails, and suspend and restore audited after the change; both
 *        write the record first through writeAuditOrRefuse.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-office-low-findings-hold.mjs
 */
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const before = (src, a, b) => src.indexOf(a) >= 0 && src.indexOf(b) >= 0 && src.indexOf(a) < src.indexOf(b);

/* F14 */
const helper = read("src/lib/export-audit.ts");
check("the export record goes through writeAuditOrRefuse", /const written = await writeAuditOrRefuse\(\{/.test(helper) && /return written\.ok \? null :/.test(helper));
for (const [path, action] of [
  ["src/app/api/portal/clients/export/route.ts", "export.clients"],
  ["src/app/api/portal/inbox/export/route.ts", "export.inbox"],
  ["src/app/api/portal/payment-links/export/route.ts", "export.payment_links"],
  ["src/app/api/portal/order-lookup/route.ts", "export.orders"],
]) {
  const src = read(path);
  const call = `const refused = await auditExportOrRefuse(actor, "${action}"`;
  check(`${action} is recorded before the file is assembled`, before(src, call, "const body = csv({"));
  check(`${action} refuses when the record cannot be written`, /if \(refused\) return (bad\(refused, 503\)|NextResponse\.json\(\{ ok: false, error: refused \}, \{ status: 503 \}\));/.test(src));
}

/* F20 */
const exportsRoute = read("src/app/api/portal/exports/route.ts");
check("api/portal/exports writes every record or refuses", (exportsRoute.match(/const audited = await writeAuditOrRefuse\(\{/g) ?? []).length === 5 && (exportsRoute.match(/if \(!audited\.ok\) return bad\(/g) ?? []).length === 5 && !/await writeAudit\(/.test(exportsRoute));
const people = read("src/app/api/portal/people/route.ts");
const suspend = people.slice(people.indexOf('if (action === "suspend" || action === "restore")'));
check("suspend and restore write the record before the change", before(suspend, "const audited = await writeAuditOrRefuse({", ".update({\n        status: nextStatus,"));
check("and refuse when it cannot be written", /if \(!audited\.ok\) return NextResponse\.json\(\{ ok: false, error: audited\.error \}, \{ status: 503 \}\);/.test(suspend));

/* F15 */
const { can, DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const page = read("src/app/portal/(app)/people/page.tsx");
const client = read("src/app/portal/(app)/people/PeopleClient.tsx");
check("the screen reads the route's three grants", /invite: can\(actor, "profiles\.create"\),/.test(page) && /forceReset: can\(actor, "profiles\.force_reset"\),/.test(page) && /suspend: can\(actor, "profiles\.suspend"\),/.test(page));
check("and the route asks exactly those", /action === "resend_invite" \? "profiles\.create" : "profiles\.force_reset"/.test(people) && /if \(!can\(actor, "profiles\.suspend"\)\)/.test(people));
check("both call sites pass them", (page.match(/<PersonActions person=\{p\} selfId=\{actor!\.id\} may=\{may\} \/>/g) ?? []).length === 2);
check("Resend invite is drawn only with may.invite", /may\.invite \? \(\s*<button type="button" disabled=\{busy !== null\} onClick=\{\(\) => run\("resend_invite"\)\}/.test(client));
check("Force reset is drawn only with may.forceReset", /\) : !may\.forceReset \? null : \(\s*<button/.test(client));
check("Suspend and Restore are drawn only with may.suspend", /\) : !may\.suspend \? null : person\.status === "suspended" \?/.test(client));

/* F16 */
const tasks = read("src/lib/ops-tasks.ts");
for (const fn of ["createTask", "setTaskStatus", "assignTask"]) {
  const at = tasks.indexOf(`export async function ${fn}(`);
  const body = tasks.slice(at, tasks.indexOf("\n}\n", at));
  check(`${fn} asks tasks.use before it reads anything`, before(body, 'if (!can(actor, "tasks.use"))', 'db.from("eng_tasks")') || (fn === "createTask" && /if \(!can\(actor, "tasks\.use"\)\)/.test(body.slice(0, 700))));
}
const actorFor = (role) => ({ id: `probe-${role}`, role, status: "active", grants: new Set(DEFAULT_ROLES.find((r) => r.key === role)?.grants ?? []) });
const takers = DEFAULT_ROLES.filter((r) => r.grants.includes("suppressions.manage")).map((r) => r.key);
check("every role that records a deletion request may make its task", takers.length >= 2 && takers.every((role) => can(actorFor(role), "tasks.use")), takers.join(", "));

/* F17 */
const onboarding = read("src/lib/ops-onboarding.ts");
const activate = onboarding.slice(onboarding.indexOf("export async function activateTechnician("), onboarding.indexOf("// ------------------------------------------------------------- credentials"));
check("a second attempt picks up the account an earlier one made", before(activate, "if (view.onboarding.profile_id) {", "const made = await createAccount({"));
check("the account is recorded on the onboarding the moment it exists", before(activate, "const made = await createAccount({", '.update({ profile_id: made.profileId })') && before(activate, '.update({ profile_id: made.profileId })', "const credentialRows = view.items"));
check("a resumed attempt does not write a credential kind twice", /toWrite = credentialRows\.filter\(\(r\) => !have\.has\(r\.kind\)\);/.test(activate));
check("the message says what to do, not to run it again", !activate.includes("Run this again.") && activate.includes("Press Activate again: it finishes this account rather than making a second one."));

/* F18 */
const deletion = read("src/lib/deletion-requests.ts");
const answer = deletion.slice(deletion.indexOf("export async function answerDeletionRequest("), deletion.indexOf("export async function listDeletionRequests("));
check("an answer is written only where none is", /\.eq\("id", id\)\s*\.is\("answered_at", null\)\s*\.select\("id"\);/.test(answer) && /if \(!answered \|\| answered\.length === 0\)/.test(answer));
const crm = read("src/lib/ops-crm.ts");
const convert = crm.slice(crm.indexOf("export async function convertLead("), crm.indexOf("const leadAccrual = await accrueForQualifiedLead(leadId);"));
check("a lead is claimed where not converted, before anything is created", before(convert, '.neq("status", "converted")', "const client = await createClient(") && /if \(!claimed \|\| claimed\.length === 0\)/.test(convert));
check("and no unconditional conversion write remains", !/await db\.from\("eng_leads"\)\.update\(\{ status: "converted" \}\)\.eq\("id", leadId\);/.test(convert));

/* F19 */
const admin = read("src/lib/admin-data.ts");
check("requireAdmin takes the action", /export async function requireAdmin\(action: Action\): Promise<void>/.test(admin) && /if \(!can\(actor, action\)\)/.test(admin) && !/can\(actor, "profiles\.list"\)/.test(admin));
check("every applications read passes applications.read", (admin.match(/await requireAdmin\("applications\.read"\);/g) ?? []).length === 3 && !/await requireAdmin\(\);/.test(admin));

console.log(wrong === 0 ? "PASS: the office audit's low findings hold: exports recorded first, buttons the route accepts, task grants, a resumable activation, conditional writes and the applications grant." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
