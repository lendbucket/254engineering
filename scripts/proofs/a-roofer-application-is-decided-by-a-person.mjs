/**
 * PROOF: A ROOFER PARTNER ACCOUNT IS DECIDED BY A PERSON, AND THE PROGRAM PAYS
 * NO ROOFER FOR SENDING WORK.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-roofer-application-is-decided-by-a-person.mjs
 *
 * Robert's request and rulings of 2026-11-05, and his rework of 2026-11-06
 * with his answers 1 to 4: account first through door 1, step one asks
 * company, owner, email and phone, the email link sets the password, and the
 * work, insurance and references are a profile filled in section by section
 * (0117). What is proved, and how:
 *
 *   A  the rules the form and the route share: step one's four answers, each
 *      section's own schema, and a blank number is no answer rather than zero
 *   B  a certificate key is accepted only under this application's own prefix
 *   C  step one is door 1: the sign up condition first, the honeypot before
 *      the post is counted, the count before the account opens, the account
 *      before the application, and an address that already has an account
 *      gets no application attached
 *   D  NOTHING DECIDES BY ITSELF: the only caller of decideRooferApplication is
 *      the signed in portal route, which asks roofers.review; neither public
 *      nor account route can reach it; a decision needs a written reason; a
 *      profile section saves only while the account is under review, for the
 *      signed in account's own application
 *   E  roofers.review is admin's and ops_manager's and nobody else's
 *   F  the copy: no franchise or hiring language, "254" only in the page
 *      headline and never calling the roofer a 254 partner in the account or
 *      the emails, no fee, commission, rebate or credit, the decline carries
 *      no reason, and the emails carry the right link or none
 *   G  0113 widens exactly what it says, and 0117 drops exactly what it says
 *   H  0117 on a replay: a section saves only whole, who it is never changes,
 *      a decision is made once and changes nothing the roofer wrote, and an
 *      approval always names its account
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const read = (p) => readFileSync(p, "utf8");
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n");
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p.replace(/\\/g, "/")];
  });

const rules = await import("../../src/lib/roofer-application.ts");

console.log("");
console.log("========== A ROOFER PARTNER ACCOUNT IS DECIDED BY A PERSON ==========");
console.log("");

/* A ------------------------------------------------------------------------ */
const stepOne = { legalName: "Proof Roofing LLC", ownerName: "Proof Owner", email: "proof@example.com", phone: "(361) 555-0100" };
const s1 = rules.rooferSignUpSchema.safeParse(stepOne);
check("step one parses with four answers and no password", s1.success && !("password" in rules.rooferSignUpSchema.shape));
const s1errs = (v) => {
  const r = rules.rooferSignUpSchema.safeParse(v);
  return r.success ? {} : rules.rooferFieldErrors(r.error);
};
check("the company name is required, in the firm's own sentence", s1errs({ ...stepOne, legalName: "" }).legalName === "Enter your company's name.");
check("a phone that is not ten digits is refused", "phone" in s1errs({ ...stepOne, phone: "555-0100" }));
const work = { officeCity: "Corpus Christi", counties: ["Nueces", "San Patricio"], yearsInBusiness: "12", crewCount: "3", workMix: "both", roofsPerYear: "180", services: ["inspections", "windstorm"], monthlyVolume: "6_15" };
const w = rules.rooferWorkSchema.safeParse(work);
check("the work section parses, and its numbers arrive as numbers", w.success && w.data.yearsInBusiness === 12 && w.data.crewCount === 3);
const werrs = (v) => {
  const r = rules.rooferWorkSchema.safeParse(v);
  return r.success ? {} : rules.rooferFieldErrors(r.error);
};
check("a blank years in business is no answer, not zero", "yearsInBusiness" in werrs({ ...work, yearsInBusiness: "" }));
check("and a blank crew count the same", "crewCount" in werrs({ ...work, crewCount: "  " }));
check("a service outside the four is refused", "services" in werrs({ ...work, services: ["design"] }));
check("a county listed twice is refused", "counties" in werrs({ ...work, counties: ["Nueces", "Nueces"] }));
check("a county that does not exist is named by the server's check", rules.unknownCounties(["Nueces", "Atlantis"], ["Nueces"]).join() === "Atlantis");
check("the insurance section needs the certificate", !rules.rooferInsuranceSchema.safeParse({ insuranceCarrier: "Proof Mutual", glPerOccurrence: "$1,000,000", glAggregate: "$2,000,000" }).success);
check(
  "and the references section needs both phones",
  !rules.rooferReferencesSchema.safeParse({ reference1Name: "One", reference1Phone: "(361) 555-0101", reference2Name: "Two", reference2Phone: "" }).success,
);
check(
  "completeness is counted from the three done times",
  rules.profileCompleteness({ work: "x", insurance: null, references: "y" }).sentence === "2 of 3 profile sections done" &&
    rules.profileCompleteness({ work: "x", insurance: "x", references: "x" }).sentence === "Profile complete",
);

/* B ------------------------------------------------------------------------ */
const appId = "0f0e0d0c-0b0a-4908-8706-050403020100";
const own = `254/roofer/${appId}/certificate-0a1b2c3d-cert.pdf`;
check("this application's own certificate key is accepted", rules.isOwnCertificatePath(own, "254", appId));
check("another application's key is refused", !rules.isOwnCertificatePath(own, "254", "11111111-1111-4111-8111-111111111111"));
check("a key with no random segment is refused", !rules.isOwnCertificatePath(`254/roofer/${appId}/certificate-cert.pdf`, "254", appId));
check("a traversal is refused", !rules.isOwnCertificatePath(`254/roofer/${appId}/certificate-0a1b2c3d-..pdf`, "254", appId));

/* C ------------------------------------------------------------------------ */
const route = code("src/app/api/roofer-application/route.ts");
const at = (s) => route.indexOf(s);
const gateAt = at("if (!selfServiceSignUpOpen())");
const honeypotAt = at("if (data.website)");
const limitAt = at('takePublicFormAttempt("roofer"');
const doorLimitAt = at("takeSignUpAttempt(address");
const accountAt = at("await createCustomerAccount(");
const writeAt = at("await takeRooferApplication(");
check("the sign up condition is checked before anything else", gateAt > 0 && gateAt < honeypotAt, `${gateAt} < ${honeypotAt}`);
check("the honeypot is answered before the post is counted", honeypotAt > 0 && limitAt > honeypotAt);
check("and door 1's own limit before the account opens", doorLimitAt > limitAt && accountAt > doorLimitAt);
check("the account opens through door 1 before the application is written", /origin: doorFor\("self_service"\)\.origin/.test(route) && writeAt > accountAt);
check("and the application names the account it opened", /accountId: created\.accountId/.test(route));
const existing = route.slice(at('created.error === "already_exists"'), at("if (!created.ok) {"));
check(
  "an address that already has an account is sent a link and gets no application attached",
  existing.includes("issueLinkForExistingAccount(address)") && !existing.includes("takeRooferApplication") && /return NextResponse\.json\(\{ ok: true, message: SENT \}\)/.test(existing),
);
check("a refused count answers 429 with the refusal sentence", /PUBLIC_FORM_REFUSAL \}, \{ status: 429 \}/.test(route));
const ops = code("src/lib/ops-roofer-applications.ts");
check("the write is one call to the transaction function", (ops.match(/\.rpc\("eng_take_roofer_application"/g) ?? []).length === 1);

/* D ------------------------------------------------------------------------ */
const callers = walk("src")
  .filter((p) => /\.(ts|tsx)$/.test(p))
  .filter((p) => p !== "src/lib/ops-roofer-applications.ts" && /decideRooferApplication\(/.test(code(p)));
check(
  "the only caller of decideRooferApplication is the signed in portal route",
  callers.length === 1 && callers[0] === "src/app/api/portal/roofer-applications/route.ts",
  callers.join(", ") || "none",
);
const portalRoute = code("src/app/api/portal/roofer-applications/route.ts");
const post = portalRoute.slice(portalRoute.indexOf("async function handlePOST"));
check(
  "and it asks for a signed in person holding roofers.review before deciding",
  post.indexOf("currentActor()") >= 0 &&
    post.indexOf('can(actor, "roofers.review")') > post.indexOf("currentActor()") &&
    post.indexOf("decideRooferApplication(") > post.indexOf('can(actor, "roofers.review")'),
);
const accountRoute = code("src/app/api/account/partner/route.ts");
check("neither the public nor the account route can reach a decision", !/decideRooferApplication/.test(route) && !/decideRooferApplication/.test(accountRoute));
check(
  "the account route serves only the signed in account's own profile",
  /const me = await currentCustomer\(\);\s*if \(!me\) return/.test(accountRoute) &&
    /saveRooferProfileSection\(me\.account\.id,/.test(accountRoute) &&
    /rooferApplicationForAccount\(me\.account\.id\)/.test(accountRoute),
);
const decide = ops.slice(ops.indexOf("export async function decideRooferApplication"), ops.indexOf("export async function rooferApplicationForAccount"));
check("a decision asks roofers.review first", /if \(!actor \|\| !can\(actor, "roofers\.review"\)\)/.test(decide.slice(0, 400)));
check("and refuses without a written reason", /reason\.length < 3/.test(decide));
check("and moves only a received application, so a double click cannot decide twice", (decide.match(/\.eq\("status", "received"\)/g) ?? []).length === 2);
check("an approval of an account opened at sign up opens nothing new", /if \(app\.accountId\) \{\s*accountId = app\.accountId;/.test(decide));
const saveFn = ops.slice(ops.indexOf("export async function saveRooferProfileSection"));
check("a profile section saves only while the account is under review", /\.eq\("account_id", accountId\)\s*\.eq\("status", "received"\)/.test(saveFn));
const migration = read("supabase/migrations/0113_a_roofer_applies_and_a_person_decides.sql");
const approvers = walk("src").filter((p) => /\.(ts|tsx)$/.test(p) && /eng_roofer_applications/.test(code(p)) && /status: "approved"/.test(code(p)));
check("no code path sets an application approved except the decision", approvers.join() === "src/lib/ops-roofer-applications.ts", approvers.join(", ") || "none");

/* E ------------------------------------------------------------------------ */
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const holders = DEFAULT_ROLES.filter((r) => (r.actions ?? r.grants ?? []).includes("roofers.review")).map((r) => r.key).sort();
check("roofers.review is admin's and ops_manager's and nobody else's", holders.join() === "admin,ops_manager", holders.join() || "nobody");
check("and 0113 seeds exactly those two", /\('admin', 'roofers\.review'\),\s*\('ops_manager', 'roofers\.review'\)/.test(migration));

/* F ------------------------------------------------------------------------ */
const programFiles = [
  ...walk("src/app/(site)/roofing-partners"),
  "src/components/forms/RooferSignUpForm.tsx",
  "src/app/account/PartnerProfile.tsx",
  "src/lib/roofer-application.ts",
  ...walk("src/app/portal/(app)/roofer-applications"),
];
const templates = read("src/lib/email-templates.ts");
const rooferEmails = templates.slice(templates.indexOf("export function rooferApplicationReceived"), templates.indexOf("A refund the provider would not carry out."));
const franchise = [...programFiles.filter((p) => /franchis/i.test(read(p))), ...(/franchis/i.test(rooferEmails) ? ["the four emails"] : [])];
check("no franchise language anywhere in the program", franchise.length === 0, franchise.join(", "));
/* What renders, not the header comment that explains the rule. */
const page = code("src/app/(site)/roofing-partners/page.tsx").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
const money = /\b(?:referral fee|commission|rebate|credit)\b/i;
const sentences = page.split(/(?<=\.)\s+/).filter((s) => money.test(s));
check(
  "on the page the words fee, commission, rebate and credit appear only where the firm says it pays none",
  sentences.length === 1 && /The firm pays nothing to any roofer for sending it work/.test(sentences[0]),
  `${sentences.length} sentence(s)`,
);
check("and the four emails carry none of them", !/\b(?:referral fee|commission|rebate|credit)\b/i.test(rooferEmails.replace(/\/\*[\s\S]*?\*\//g, "")));
check("the program gives the roofer no badge, logo or mark: no asset of one is built", !programFiles.some((p) => /badge\.svg|partner-badge|logo upload/i.test(read(p))));

/* Robert's rework item 1: a supplier opening an account, never a job application. Read from what renders. */
const shown = [
  "src/app/(site)/roofing-partners/page.tsx",
  "src/app/(site)/roofing-partners/apply/page.tsx",
  "src/app/(site)/roofing-partners/apply/received/page.tsx",
  "src/components/forms/RooferSignUpForm.tsx",
  "src/app/account/PartnerProfile.tsx",
]
  .map((p) => code(p).replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/roofing-partners\/apply[a-z/]*/g, "").replace(/\bAPPLY\b/g, ""))
  .join("\n");
const hiring = /\b(?:apply|applying|applied|applicant|application to work|work with the firm|job application|start the application)\b/i;
const hiringHits = shown.split("\n").filter((l) => hiring.test(l) && /["'`>]/.test(l));
check("no page, button or form of the program speaks of applying or hiring", hiringHits.length === 0, hiringHits.slice(0, 3).map((l) => l.trim().slice(0, 80)).join(" | "));
check("the landing headline invites them to become a 254 roofing partner", /Become a 254 roofing partner\./.test(page) && /Create your partner account/.test(page) && /Get started/.test(page));
const accountCopy = code("src/app/account/page.tsx") + code("src/app/account/PartnerProfile.tsx");
check(
  "and nothing in the account or the emails calls the roofer a 254 partner",
  !/254 (?:roofing )?partner/i.test(accountCopy) && !/254 (?:roofing )?partner/i.test(rooferEmails.replace(/\/\*[\s\S]*?\*\//g, "")),
);
check("the account says the review once, plainly, as the status card", /Your partner account is being reviewed\. Finish your profile to speed it up\./.test(accountCopy));
check("the firm approving every partner is said as what keeps the program selective", /A person at the firm approves every partner\. That is what keeps the program selective\./.test(page));

const emails = await import("../../src/lib/email-templates.ts");
const received = emails.rooferApplicationReceived({ ownerName: "Proof Owner", email: "proof@example.com", link: "https://254engineering.com/account/set-password?token=t", expiresIn: "7 days" });
check("the step one email carries the set password link, then sign in (the set password rule, kept)", (received.html ?? "").includes("https://254engineering.com/account/set-password?token=t") && /sets your password; then sign in/.test(received.text ?? ""));
const declined = emails.rooferApplicationDeclined({ ownerName: "Proof Owner", legalName: "Proof Roofing LLC", email: "proof@example.com" });
check("the decline email is plain, carries no reason, and keeps the account open", !/reason/i.test(declined.text ?? "") && /not taking Proof Roofing LLC on as a partner/.test(declined.text ?? "") && /account stays open/.test(declined.text ?? ""));
const approved = emails.rooferApplicationApproved({ ownerName: "Proof Owner", email: "proof@example.com" });
const approvedText = approved.text ?? "";
check("an approval of an account opened at sign up carries no password link", !(approved.html ?? "").includes("set-password") && !/sets your password/.test(approvedText));
const approvedOld = emails.rooferApplicationApproved({ ownerName: "Proof Owner", email: "proof@example.com", link: "https://254engineering.com/account/set-password?token=t", expiresIn: "7 days" });
check("an approval from before 0117 still carries the link its account needs", (approvedOld.html ?? "").includes("https://254engineering.com/account/set-password?token=t"));
/* Robert's polish of 2026-11-05: his voice, "Hi" and the first name, what happens next, and no password sentence. */
check("the approval opens \"Hi\" and the first name only", /^Hi Proof,/m.test(approvedText) && !/Proof Owner,/.test(approvedText));
check(
  "and welcomes them as a partner and says Robert will be in touch about pricing and ordering",
  /Welcome to the roofing partner program/.test(approvedText) && /set up your partner pricing and walk you through ordering/.test(approvedText),
);
check("and the sentence about nobody seeing the password is gone", !/nobody can see/i.test(approvedText));
check("the decline opens \"Hi\" and the first name only", /^Hi Proof,/m.test(declined.text ?? "") && !/Proof Owner,/.test(declined.text ?? ""));

/* G ------------------------------------------------------------------------ */
const sql13 = migration.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const drops13 = [...sql13.matchAll(/\bdrop\s+(constraint|not null|table|column)\s*([a-z_]*)/gi)].map((m) => `${m[1].toLowerCase()} ${m[2]}`.trim());
check(
  "0113 drops exactly the two checks it widens and the one NOT NULL it replaces",
  drops13.sort().join(", ") === "constraint eng_prospect_sources_source_known, constraint eng_prospects_next_action_kind_known, not null",
  drops13.join(", "),
);
const m17 = read("supabase/migrations/0117_a_roofer_opens_an_account_first.sql");
const sql17 = m17.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const drops17 = [...sql17.matchAll(/\bdrop\s+(constraint|not null|table|column)\s*([a-z_]*)/gi)].map((m) => `${m[1].toLowerCase()} ${m[2]}`.trim());
check(
  "0117 drops sixteen NOT NULLs and the one check it re-adds wider, and nothing else",
  drops17.filter((d) => d === "not null").length === 16 &&
    drops17.filter((d) => d !== "not null").join() === "constraint eng_roofer_applications_approval_names_its_account",
  drops17.join(", "),
);
check("and neither deletes a row", ![sql13, sql17].some((s) => /\bdelete\s+from\b/i.test(s) || /\btruncate\b/i.test(s)));

/* H ------------------------------------------------------------------------ */
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { readSource } = await import("../lib/read-source.mjs");
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at17 = files.findIndex((f) => f.startsWith("0117_"));
for (const f of files.slice(0, at17 + 1)) await db.exec(readSource(join(DIR, f)));
const refused = async (sql, params = []) => {
  try {
    await db.query(sql, params);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const CLIENT = "00000000-0000-4000-8000-0000000117c1";
const ACCOUNT = "00000000-0000-4000-8000-0000000117a1";
const APP = "00000000-0000-4000-8000-000000011701";
const REVIEWER = "00000000-0000-4000-8000-0000000117e1";
await db.exec(`
  insert into auth.users (id) values ('${REVIEWER}');
  insert into eng_profiles (id, email, display_name, role, status) values ('${REVIEWER}', 'roofer-proof@audit-probe.invalid', 'Roofer proof reviewer, not a real person', 'admin', 'active');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'organization', 'Roofer proof client, not a real company');
  insert into eng_customer_accounts (id, site, client_id, billing_mode) values ('${ACCOUNT}', '254engineering', '${CLIENT}', 'card');
`);
const taken = await refused(`select public.eng_take_roofer_application($1::jsonb)`, [
  JSON.stringify({ id: APP, account_id: ACCOUNT, legal_name: "Replay Roofing LLC", owner_name: "Replay Owner", email: "replay@example.com", phone: "(361) 555-0177" }),
]);
check("H: step one writes an application with only its four answers and the account", taken === "", taken);
const noAccount = await refused(`select public.eng_take_roofer_application($1::jsonb)`, [
  JSON.stringify({ id: "00000000-0000-4000-8000-000000011702", legal_name: "Other Roofing", owner_name: "Other", email: "other@example.com", phone: "(361) 555-0178" }),
]);
check("H: and refuses one that names no account", /names the account its sign up opened/.test(noAccount), noAccount.slice(0, 90));
const halfWork = await refused(`update eng_roofer_applications set office_city = 'Corpus Christi', work_done_at = now() where id = $1`, [APP]);
check("H: a section cannot be called done while its answers are missing", /eng_roofer_applications_work_is_whole/.test(halfWork), halfWork.slice(0, 90));
const wholeWork = await refused(
  `update eng_roofer_applications set office_city = 'Corpus Christi', counties = '{Nueces}', years_in_business = 12, crew_count = 3, work_mix = 'both', roofs_per_year = 180, services = '{inspections}', monthly_volume = '6_15', work_done_at = now() where id = $1`,
  [APP],
);
check("H: a whole section saves while the account is under review", wholeWork === "", wholeWork);
const identity = await refused(`update eng_roofer_applications set email = 'someone-else@example.com' where id = $1`, [APP]);
check("H: who it is never changes, even while under review", /keeps who it is/.test(identity), identity.slice(0, 90));
const decided = await refused(`update eng_roofer_applications set status = 'approved', decided_at = now(), decided_by = $2, decision_reason = 'Proof approval' where id = $1`, [APP, REVIEWER]);
check("H: an approval of an account opened at sign up records, naming the account it already has", decided === "", decided);
const after = await refused(`update eng_roofer_applications set crew_count = 4 where id = $1`, [APP]);
check("H: and after the decision the profile no longer changes", /decided once/.test(after), after.slice(0, 90));

console.log("");
if (wrong === 0) {
  console.log("PASS: a roofer partner account is decided by a person, and the program pays no roofer for sending work.");
} else {
  console.log(`FAIL: ${wrong} check(s) above.`);
}
process.exit(wrong === 0 ? 0 : 1);
