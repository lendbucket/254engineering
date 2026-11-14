/**
 * THE ELEVEN STAFF LISTS EXPORT EVERY MATCHING ROW, FOR THE ADMINISTRATOR ONLY.
 * (Six from 2026-10-28; people, do not contact and the audit trail joined on
 * 2026-10-29; credential review and insurance on Robert's ruling P9 of
 * 2026-11-01, which also says "asked to be forgotten" gets no export.)
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-staff-lists-export-for-the-admin-only.mjs
 *
 * Robert, 21:07 Central 2026-10-28: "list every staff list screen without a
 * CSV export. Build the missing ones as one bundle, owner or admin only, with
 * the shared CSV safety and an audit row, the same as the accounts export."
 * Applications, design briefs, windstorm briefs, field technicians, partners
 * and tasks. Asked of the pure builders with rows handed to them, and of the
 * export door and the screens by their source; the live refusal of the rep and
 * the operations manager at the real route is roles-audit's, on the board.
 */
import { readFileSync } from "node:fs";

const {
  LIST_EXPORT_GRANT,
  LIST_EXPORT_REPORTS,
  applicationsCsv,
  designBriefsCsv,
  windstormBriefsCsv,
  techniciansCsv,
  partnersCsv,
  tasksCsv,
  peopleCsv,
  suppressionsCsv,
  auditTrailCsv,
  credentialsCsv,
  insuranceCsv,
  listExportFilename,
} = await import("../../src/lib/list-exports.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const { partnerListRows } = await import("../../src/lib/partner-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ---- the gate is the administrator's alone ---- */
const holders = DEFAULT_ROLES.filter((r) => r.grants.includes(LIST_EXPORT_GRANT)).map((r) => r.key);
check("the export grant is held by the administrator alone", holders.length === 1 && holders[0] === "admin", `${LIST_EXPORT_GRANT}: ${holders.join(", ")}`);
/* Twelve since 2026-11-13: onboarding joined under Robert's ruling 2. */
check("twelve reports, named", LIST_EXPORT_REPORTS.length === 12 && ["applications", "design-briefs", "windstorm-briefs", "technicians", "partners", "tasks", "people", "suppressions", "audit-trail", "credentials", "insurance", "onboarding"].every((r) => LIST_EXPORT_REPORTS.includes(r)));
check("and none of them is the deletion requests, which get no export (P9)", !LIST_EXPORT_REPORTS.some((r) => /delet|forget/.test(r)));
const forget = readFileSync("src/app/portal/(app)/deletion-requests/page.tsx", "utf8");
check("the deletion requests screen draws no export link", !/csvHref|\/api\/portal\/exports|Export CSV/.test(forget));

/* ---- the builders: the shared writer's formula guard, and money as dollars or empty ---- */
const hostile = "=HYPERLINK(1)";
const apps = applicationsCsv([{ id: "a", created_at: "2026-10-28", site: "254", role: "field_technician", name: hostile, email: "a@x.invalid", phone: null, city: null, payload: null }], "f");
check("an application's name beginning = is guarded by the shared writer", apps.includes(`"'${hostile}"`) && !apps.includes(`,"${hostile}"`));
const techs = techniciansCsv(
  [{ id: "t", display_name: "T", email: "t@x.invalid", phone: null, status: "active", coverage_counties: ["Nueces", "Kleberg"], base_city: null, base_county: null, base_lat: null, base_lng: null, certifications: [], openJobs: null, completedJobs: 3, pendingCents: 12345, paidCents: null, expiringCredentials: [] }],
  "f",
);
const techRow = techs.split("\r\n").at(-1);
check("a technician's owed is dollars, and an unknown paid figure is empty, not zero", techRow.includes(`"123.45"`) && techRow.endsWith(`""`) && !techRow.includes(`"0.00"`), techRow);
check("and an unknown open-jobs count is empty, not zero", techRow.includes(`"active","","","Nueces; Kleberg","","3"`), techRow);
const partners = partnersCsv(
  [{ id: "p", organisation: "P", contactName: "C", contactEmail: "c@x.invalid", code: "c", status: "active", createdAt: "2026-10-28", agreementVersion: null, referrals: null, payableCents: null, blocked: 0, people: 1 }],
  "f",
);
check("a partner's unknown payable is empty, not zero", partners.split("\r\n").at(-1).includes(`"","","0","1"`), partners.split("\r\n").at(-1));
for (const [name, out] of [
  ["design briefs", designBriefsCsv([], "f")],
  ["windstorm briefs", windstormBriefsCsv([], "f")],
  ["tasks", tasksCsv([], "f")],
]) {
  check(`the ${name} file states its count and filter in its preamble`, out.startsWith(`"${name[0].toUpperCase()}${name.slice(1)}","0 matching"`) && out.includes(`"Filter","f"`), out.split("\r\n")[0]);
}
const people = peopleCsv([{ email: "p@x.invalid", display_name: hostile, role: "admin", status: "active", phone: null, base_county: null, last_sign_in_at: null, created_at: "2026-10-29" }], "f");
check("a person's name beginning = is guarded, and a never-signed-in person says never", people.includes(`"'${hostile}"`) && people.split("\r\n").at(-1).includes(`"never"`), people.split("\r\n").at(-1));
const sup = suppressionsCsv(
  [
    { email: "a@x.invalid", because: "asked", createdAt: "2026-10-01", enteredByOperator: false, voided: null },
    { email: "b@x.invalid", because: "typed", createdAt: "2026-10-02", enteredByOperator: true, voided: { at: "2026-10-03", because: "wrong address", replacedBy: "c@x.invalid", noReplacementBecause: null } },
  ],
  "f",
);
const supRows = sup.split("\r\n");
check("a do not contact row marked as a mistake is still exported, and says so", supRows.at(-1).includes(`"marked as a mistake","2026-10-03","wrong address","c@x.invalid"`) && supRows.at(-2).includes(`"they clicked the link","in force"`), supRows.at(-1));
const trail = auditTrailCsv([{ id: "1", created_at: "2026-10-29T01:00:00Z", actor_email: null, actor_role: null, action: "customer.signed_in", entity_type: "customer", entity_id: null, summary: hostile, ip: null }], "f");
check("an audit event keeps its stored key, the system actor is empty, and a summary beginning = is guarded", trail.split("\r\n").at(-1).startsWith(`"2026-10-29T01:00:00Z","","","customer.signed_in"`) && trail.includes(`"'${hostile}"`), trail.split("\r\n").at(-1));
const creds = credentialsCsv([{ name: hostile, label: "OSHA 10", issuingState: null, expiresOn: null, submittedAt: "2026-11-01T15:00:00Z" }], "f");
check("a credential's technician name beginning = is guarded, and no expiry is empty", creds.includes(`"'${hostile}"`) && creds.split("\r\n").at(-1).endsWith(`"OSHA 10","","","2026-11-01T15:00:00Z"`), creds.split("\r\n").at(-1));
const policy = (over) => ({ id: "p", createdAt: "2026-10-01", kind: "professional_liability", carrier: "C", policyNumber: "N1", limitPerClaimCents: 100000000, limitAggregateCents: 200000000, namedInsureds: ["254 Engineering LLC"], effectiveOn: "2026-10-01", expiresOn: "2027-10-01", certificateKey: "insurance/secret-key.pdf", certificateSha256: "abc123", withdrawnAt: null, withdrawnReason: null, ...over });
const ins = insuranceCsv([policy({}), policy({ id: "q", expiresOn: "2026-10-31" }), policy({ id: "r", withdrawnAt: "2026-10-15", withdrawnReason: "replaced" })], "f", "2026-11-01");
const insRows = ins.split("\r\n");
check("a policy's limits are dollars and its standing is read on the day passed", insRows.at(-3).includes(`"1000000.00","2000000.00"`) && insRows.at(-3).includes(`"in force"`), insRows.at(-3));
check("an expired and a withdrawn policy say so", insRows.at(-2).includes(`"expired"`) && insRows.at(-1).includes(`"withdrawn","2026-10-15","replaced"`), `${insRows.at(-2)} | ${insRows.at(-1)}`);
check("the certificate's storage key never reaches the file, only its hash", !ins.includes("secret-key") && ins.includes(`"abc123"`));
check("a file's name is dated by the caller", listExportFilename("tasks", "2026-10-28") === "tasks-2026-10-28.csv");

const lib = readFileSync("src/lib/list-exports.ts", "utf8");
check("the builders use the shared writer and no escaper of their own", /import \{ csv \} from "\.\/csv";/.test(lib) && !/replace\(\/"\/g/.test(lib));
check("and read no clock", !/new Date\(/.test(lib.replace(/\/\*[\s\S]*?\*\//g, "")));

/* ---- the partner filter is one home, and the screen and the export both call it ---- */
const rows = [
  { organisation: "Alpha", contactName: "", contactEmail: "", code: "a", status: "active" },
  { organisation: "Beta", contactName: "", contactEmail: "", code: "b", status: "suspended" },
  { organisation: "Gamma", contactName: "", contactEmail: "", code: "g", status: "ended" },
];
check("the partner filter keeps ended partners in every view, as the screen always has", partnerListRows(rows, { state: "active" }).map((p) => p.organisation).join() === "Alpha,Gamma");
check("and searches the four fields", partnerListRows(rows, { q: "bet" }).map((p) => p.organisation).join() === "Beta");
const partnersPage = readFileSync("src/app/portal/(app)/partners/page.tsx", "utf8");
check("the partners screen filters through partnerListRows", /const rows = partnerListRows\(all, \{ q: params\.q, state: params\.state \}\);/.test(partnersPage) && !/\.filter\(\s*\(p\) =>/.test(partnersPage));

/* ---- the export door ---- */
const route = readFileSync("src/app/api/portal/exports/route.ts", "utf8");
const at = route.indexOf("if ((LIST_EXPORT_REPORTS as readonly string[]).includes(report)) {");
const branch = route.slice(at, route.indexOf("\n  }\n", at));
const gate = branch.indexOf("if (!can(actor, LIST_EXPORT_GRANT) || !can(actor, screenGrant[listReport])) {");
const firstRead = Math.min(
  ...["await listEveryApplication(", "await designInquiries(", "await windstormInquiries(", "await techRoster(", "await partnerRoster(", "await listEveryTask(", "await readPeople(", "await listSuppressions(", "await auditTrailEvery(", "await awaitingVerification(", "await listPolicies(", "await listEveryOnboarding("].map((s) => {
    const i = branch.indexOf(s);
    return i < 0 ? Infinity : i;
  }),
);
check("the door asks the administrator's grant and the screen's own before reading anything", at > 0 && gate > 0 && gate < firstRead && Number.isFinite(firstRead));
check("each screen's own grant, by name", /applications: "applications\.read"/.test(branch) && /"design-briefs": "files\.create"/.test(branch) && /"windstorm-briefs": "files\.create"/.test(branch) && /technicians: "profiles\.list"/.test(branch) && /partners: "partners\.manage"/.test(branch) && /tasks: "tasks\.use"/.test(branch) && /people: "profiles\.list"/.test(branch) && /suppressions: "suppressions\.manage"/.test(branch) && /"audit-trail": "audit\.read"/.test(branch) && /credentials: "technicians\.onboard"/.test(branch) && /insurance: "insurance\.manage"/.test(branch) && /onboarding: "technicians\.onboard"/.test(branch));
check(
  "each list is read through the screen's own function and filter, every row",
  /await listEveryApplication\(\{ q: param\("q"\), role: param\("role"\) \}\)/.test(branch) &&
    /await designInquiries\(actor, query, "every"\)/.test(branch) &&
    /await windstormInquiries\(actor, query, "every"\)/.test(branch) &&
    /techListRows\(read\.rows, techListQuery\(/.test(branch) &&
    /partnerListRows\(read\.rows, \{ q: param\("q"\), state: param\("state"\) \}\)/.test(branch) &&
    /* Sort and direction since 2026-11-13, so the file reads the order the screen shows. */
    /await listEveryTask\(actor, \{ status: param\("status"\), q: param\("q"\), sort: param\("sort"\), dir: param\("dir"\) \}\)/.test(branch) &&
    /await listEveryOnboarding\(query, \{ fieldTechOnly: !can\(actor, "profiles\.create"\) \}\)/.test(branch) &&
    /staffListRows\(read\.rows, staffListQuery\(\{ q: param\("q"\), status: param\("status"\), sort: param\("sort"\), dir: param\("dir"\) \}, PEOPLE_LIST\), PEOPLE_LIST\)/.test(branch) &&
    /staffListRows\(all, staffListQuery\(\{ q: param\("q"\), source: param\("source"\), state: param\("state"\), sort: param\("sort"\), dir: param\("dir"\) \}, SUPPRESSION_LIST\), SUPPRESSION_LIST\)/.test(branch) &&
    /await auditTrailEvery\(auditTrailQuery\(\{ q: param\("q"\), who: param\("who"\), dir: param\("dir"\) \}\)\)/.test(branch) &&
    /staffListRows\(all, staffListQuery\(\{ q: param\("q"\), expiry: param\("expiry"\), sort: param\("sort"\), dir: param\("dir"\) \}, CREDENTIAL_LIST\), CREDENTIAL_LIST\)/.test(branch) &&
    /staffListRows\(read\.policies, staffListQuery\(\{ q: param\("q"\), standing: param\("standing"\), sort: param\("sort"\), dir: param\("dir"\) \}, spec\), spec\)/.test(branch),
);
const refusals = (branch.match(/return refuse\(/g) ?? []).length;
/* Office audit F20, 2026-11-02: the audit is written or the export refuses. The anchor must be found, since -1 is before everything. */
const auditAt = branch.indexOf("await writeAuditOrRefuse(");
check("a failed or partial read refuses before any audit row or file", refusals === 14 && auditAt >= 0 && branch.indexOf("return refuse(") < auditAt, `${refusals} refusals`);
check("every export writes an audit row before the body, or refuses", /action: `export\.\$\{listReport\}`/.test(branch) && auditAt >= 0 && auditAt < branch.indexOf("return new NextResponse(body") && /if \(!audited\.ok\) return bad\(/.test(branch));
check("and the file is the shared headers, dated by the door's stamp()", /csvHeaders\(listExportFilename\(listReport, stamp\(\)\)\)/.test(branch));

/* ---- the reads behind the export share the screens' filters ---- */
const admin = readFileSync("src/lib/admin-data.ts", "utf8");
check("applications: the page and the export call one filter", /applicationsMatching\(db, options\)\.range\(from, from \+ APPLICATION_PAGE_SIZE\)/.test(admin) && /readEvery<ApplicationRow>\(\(from, to\) => applicationsMatching\(db, options\)\.range\(from, to\)\)/.test(admin));
const tasks = readFileSync("src/lib/ops-tasks.ts", "utf8");
check("tasks: the page and the export call one filter, and the export keeps the visibility rule", /tasksMatching\(db, actor, filters\)\.range\(from, from \+ TASK_PAGE_SIZE\)/.test(tasks) && /readEvery<TaskRow>\(\(from, to\) => tasksMatching\(db, actor, filters\)\.range\(from, to\)\)/.test(tasks) && /return read\.rows\.filter\(\(t\) => canSeeTask\(actor,/.test(tasks));

/* ---- each screen draws the link only for the grant ---- */
for (const [screen, report] of [
  ["applications", "applications"],
  ["inquiries", "design-briefs"],
  ["windstorm-inquiries", "windstorm-briefs"],
  ["techs", "technicians"],
  ["partners", "partners"],
  ["tasks", "tasks"],
  ["people", "people"],
  ["suppressions", "suppressions"],
  ["audit", "audit-trail"],
  ["credentials", "credentials"],
  ["insurance", "insurance"],
  ["onboarding", "onboarding"],
]) {
  const src = readFileSync(`src/app/portal/(app)/${screen}/page.tsx`, "utf8");
  check(`/portal/${screen} draws its export only for the grant, carrying the query`, new RegExp(`can\\(actor, LIST_EXPORT_GRANT\\)[\\s\\S]{0,40}listHref\\("/api/portal/exports", \\{[^}]*\\}, \\{ report: "${report}" \\}\\)`).test(src));
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the twelve staff lists export every matching row through their own filters, for the administrator only, safely and audited.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
