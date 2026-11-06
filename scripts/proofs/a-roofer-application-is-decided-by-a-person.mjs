/**
 * PROOF: A ROOFER APPLICATION IS DECIDED BY A PERSON, AND THE PROGRAM PAYS NO
 * ROOFER FOR SENDING WORK.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-roofer-application-is-decided-by-a-person.mjs
 *
 * Robert's request and rulings of 2026-11-05 (issue #1, 6665440881 and the
 * answers on ops/day). What is proved, and how:
 *
 *   A  the rules the form and the route share: what is required, a blank number
 *      is no answer rather than zero, services and bands come from their lists
 *   B  a certificate key is accepted only under this application's own prefix
 *   C  the public route answers a bot at the honeypot, counts the post, and only
 *      then writes, through the one transaction function
 *   D  NOTHING DECIDES BY ITSELF: the only caller of decideRooferApplication is
 *      the signed in portal route, which asks roofers.review; the public route
 *      cannot reach it; a decision needs a written reason; the table lets a
 *      decision be made once
 *   E  roofers.review is admin's and ops_manager's and nobody else's
 *   F  the copy: no "franchise" anywhere in the program, and the words fee,
 *      commission, rebate and credit appear only inside the sentence saying the
 *      firm pays none of them; the decline email carries none of the reviewer's
 *      reason; the approval email carries the set password link
 *   G  the migration widens exactly the two checks and the NOT NULL it says,
 *      deletes no row and drops no table or column
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL. The write itself is exercised on the
 * preview walk, against development, after the sitting.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
console.log("========== A ROOFER APPLICATION IS DECIDED BY A PERSON ==========");
console.log("");

/* A ------------------------------------------------------------------------ */
const valid = {
  legalName: "Proof Roofing LLC",
  ownerName: "Proof Owner",
  ownerTitle: "Owner",
  email: "proof@example.com",
  phone: "(361) 555-0100",
  officeCity: "Corpus Christi",
  counties: ["Nueces", "San Patricio"],
  yearsInBusiness: "12",
  crewCount: "3",
  workMix: "both",
  roofsPerYear: "180",
  services: ["inspections", "windstorm"],
  monthlyVolume: "6_15",
  insuranceCarrier: "Proof Mutual",
  glPerOccurrence: "$1,000,000",
  glAggregate: "$2,000,000",
  reference1Name: "Reference One",
  reference1Phone: "(361) 555-0101",
  reference2Name: "Reference Two",
  reference2Phone: "(361) 555-0102",
  applicationId: "0f0e0d0c-0b0a-4908-8706-050403020100",
};
const parsed = rules.rooferApplicationSchema.safeParse(valid);
check("a complete application parses, and its numbers arrive as numbers", parsed.success && parsed.data.yearsInBusiness === 12 && parsed.data.crewCount === 3);
const errs = (v) => {
  const r = rules.rooferApplicationSchema.safeParse(v);
  return r.success ? {} : rules.rooferFieldErrors(r.error);
};
check("a blank years in business is no answer, not zero", "yearsInBusiness" in errs({ ...valid, yearsInBusiness: "" }));
check("and a blank crew count the same", "crewCount" in errs({ ...valid, crewCount: "  " }));
check("the legal name is required, in the firm's own sentence", errs({ ...valid, legalName: "" }).legalName === "Enter the company's legal name.");
check("a service outside the four is refused", "services" in errs({ ...valid, services: ["design"] }));
check("no service at all is refused", "services" in errs({ ...valid, services: [] }));
check("a county listed twice is refused", "counties" in errs({ ...valid, counties: ["Nueces", "Nueces"] }));
check("a phone that is not ten digits is refused", "phone" in errs({ ...valid, phone: "555-0100" }));
check("a county that does not exist is named by the server's check", rules.unknownCounties(["Nueces", "Atlantis"], ["Nueces"]).join() === "Atlantis");

/* B ------------------------------------------------------------------------ */
const own = `254/roofer/${valid.applicationId}/certificate-0a1b2c3d-cert.pdf`;
check("this application's own certificate key is accepted", rules.isOwnCertificatePath(own, "254", valid.applicationId));
check("another application's key is refused", !rules.isOwnCertificatePath(own, "254", "11111111-1111-4111-8111-111111111111"));
check("a key with no random segment is refused", !rules.isOwnCertificatePath(`254/roofer/${valid.applicationId}/certificate-cert.pdf`, "254", valid.applicationId));
check("a traversal is refused", !rules.isOwnCertificatePath(`254/roofer/${valid.applicationId}/certificate-0a1b2c3d-..pdf`, "254", valid.applicationId));

/* C ------------------------------------------------------------------------ */
const route = code("src/app/api/roofer-application/route.ts");
const at = (s) => route.indexOf(s);
const honeypotAt = at("if (data.website)");
const limitAt = at('takePublicFormAttempt("roofer"');
const writeAt = at("takeRooferApplication(data");
check("the honeypot is answered before the post is counted", honeypotAt > 0 && limitAt > honeypotAt, `${honeypotAt} < ${limitAt}`);
check("and the post is counted before anything is written", limitAt > 0 && writeAt > limitAt, `${limitAt} < ${writeAt}`);
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
check("the public route cannot reach a decision", !/decideRooferApplication/.test(route));
const decide = ops.slice(ops.indexOf("export async function decideRooferApplication"));
check("a decision asks roofers.review first", /if \(!actor \|\| !can\(actor, "roofers\.review"\)\)/.test(decide.slice(0, 400)));
check("and refuses without a written reason", /reason\.length < 3/.test(decide));
check("and moves only a received application, so a double click cannot decide twice", (decide.match(/\.eq\("status", "received"\)/g) ?? []).length === 2);
const migration = read("supabase/migrations/0113_a_roofer_applies_and_a_person_decides.sql");
check("the table lets a decision be made once and change nothing the roofer wrote", /a roofer application is decided once/.test(migration) && /a decision changes nothing the roofer wrote/.test(migration));
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
  "src/components/forms/RooferApplicationForm.tsx",
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

const emails = await import("../../src/lib/email-templates.ts");
const declined = emails.rooferApplicationDeclined({ ownerName: "Proof Owner", legalName: "Proof Roofing LLC", email: "proof@example.com" });
check("the decline email is plain and carries no reason field", !/reason/i.test(declined.text ?? "") && /not taking it forward/.test(declined.text ?? ""));
const approved = emails.rooferApplicationApproved({ ownerName: "Proof Owner", email: "proof@example.com", link: "https://254engineering.com/account/set-password?token=t", expiresIn: "7 days" });
check("the approval email carries the set password link", (approved.html ?? "").includes("https://254engineering.com/account/set-password?token=t"));
/* Robert's polish of 2026-11-05: his voice, "Hi" and the first name, what happens next, and no password sentence. */
const approvedText = approved.text ?? "";
check("the approval opens \"Hi\" and the first name only", /^Hi Proof,/m.test(approvedText) && !/Proof Owner,/.test(approvedText));
check("and welcomes them as a partner, says the account is open, and says Robert will be in touch about pricing and ordering",
  /Welcome to the roofing partner program/.test(approvedText) &&
    /account is open, and the button below sets your password/.test(approvedText) &&
    /set up your partner pricing and walk you through ordering/.test(approvedText));
check("and the sentence about nobody seeing the password is gone", !/nobody can see/i.test(approvedText));
check("the decline opens \"Hi\" and the first name only", /^Hi Proof,/m.test(declined.text ?? "") && !/Proof Owner,/.test(declined.text ?? ""));

/* G ------------------------------------------------------------------------ */
const sql = migration.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const drops = [...sql.matchAll(/\bdrop\s+(constraint|not null|table|column)\s*([a-z_]*)/gi)].map((m) => `${m[1].toLowerCase()} ${m[2]}`.trim());
check(
  "the migration drops exactly the two checks it widens and the one NOT NULL it replaces",
  drops.sort().join(", ") === "constraint eng_prospect_sources_source_known, constraint eng_prospects_next_action_kind_known, not null",
  drops.join(", "),
);
check("and deletes no row", !/\bdelete\s+from\b/i.test(sql) && !/\btruncate\b/i.test(sql));
check("the widened source check names roofer_application", /'manual', 'roofer_application'\)\)/.test(sql));
check("the widened action check names review_application", /'call', 'email', 'review_application'/.test(sql));
check("a prospect's author is a person or an application, never neither", /check \(created_by is not null or roofer_application_id is not null\)/.test(sql));

console.log("");
if (wrong === 0) {
  console.log("PASS: a roofer application is decided by a person, and the program pays no roofer for sending work.");
} else {
  console.log(`FAIL: ${wrong} check(s) above.`);
}
process.exit(wrong === 0 ? 0 : 1);
