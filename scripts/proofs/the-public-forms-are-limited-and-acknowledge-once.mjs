/**
 * PROOF: THE TECHNICIAN SHEET'S COVERAGE FORM REACHES ITS OWN BRANCH, AND THE
 * FOUR PUBLIC FORMS ARE LIMITED PER CONNECTION AND PER ADDRESS AND ACKNOWLEDGE
 * ONE ADDRESS ONCE A DAY.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-public-forms-are-limited-and-acknowledge-once.mjs
 *
 * Robert's Q11 of 2026-11-02 (office audit F1 and F2): "set_tech_coverage
 * action for the technician sheet; rate limit lead, design inquiry, windstorm
 * inquiry and apply per address and IP, one acknowledgement per address per
 * kind per day."
 *
 *   A  /api/portal/onboarding has one set_coverage branch (onboarding) and one
 *      set_tech_coverage branch (setTechCoverage), and the technician sheet's
 *      form posts set_tech_coverage. The second set_coverage branch was dead.
 *   B  the limits are the pinned literals below, not the module's own constants
 *   C  the real limiter, counting in memory with the database off: the eleventh
 *      post from one connection is refused, the sixth for one address from
 *      fresh connections is refused, and the first acknowledgement of a day is
 *      the only one
 *   D  a board run's keys carry its prefix on development and production's do
 *      not, and no key holds the typed address
 *   E  each of the four routes counts the post after its honeypot and before it
 *      writes or queues anything, answers a refusal with 429 and the refusal
 *      sentence, sends the operator's copy unconditionally, and gates only the
 *      acknowledgement
 */
import { readFileSync } from "node:fs";

/* The database is off for this process, so the limiter's in-memory fallback answers. */
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.BOARD_RUN_ID;

const forms = await import("../../src/lib/public-form-limits.ts");
const { DEVELOPMENT_REF } = await import("../../src/lib/db-guard.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const code = (path) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n");

/* A ------------------------------------------------------------------------ */
const onboardingRoute = code("src/app/api/portal/onboarding/route.ts");
const branches = (name) => (onboardingRoute.match(new RegExp(`action === "${name}"`, "g")) ?? []).length;
check("the onboarding route has exactly one set_coverage branch", branches("set_coverage") === 1, String(branches("set_coverage")));
check("and exactly one set_tech_coverage branch", branches("set_tech_coverage") === 1, String(branches("set_tech_coverage")));
const techAt = onboardingRoute.indexOf('action === "set_tech_coverage"');
check("and that branch calls setTechCoverage", techAt >= 0 && /setTechCoverage\(/.test(onboardingRoute.slice(techAt, techAt + 400)));
const coverageForm = code("src/app/portal/(app)/techs/[id]/CoverageForm.tsx");
check("the technician sheet's form posts set_tech_coverage", /action: "set_tech_coverage"/.test(coverageForm) && !/action: "set_coverage"/.test(coverageForm));

/* B ------------------------------------------------------------------------ */
const PINNED = { windowSeconds: 3600, perConnection: 10, perAddress: 5, acknowledgementsPerDay: 1 };
for (const [k, v] of Object.entries(PINNED)) check(`the ${k} limit is ${v}`, forms.PUBLIC_FORM_LIMITS[k] === v, String(forms.PUBLIC_FORM_LIMITS[k]));

/* C ------------------------------------------------------------------------ */
const from = (ip) => new Headers({ "x-forwarded-for": ip });
let allowed = 0;
for (let i = 0; i < 10; i++) if ((await forms.takePublicFormAttempt("design", from("198.51.100.1"), `person${i}@example.com`)).allowed) allowed++;
check("ten posts from one connection are taken", allowed === 10, String(allowed));
check("and the eleventh is refused", !(await forms.takePublicFormAttempt("design", from("198.51.100.1"), "person10@example.com")).allowed);
check("another form from that connection has its own count", (await forms.takePublicFormAttempt("windstorm", from("198.51.100.1"), "person0@example.com")).allowed);

let toOne = 0;
for (let i = 0; i < 5; i++) if ((await forms.takePublicFormAttempt("contact", from(`203.0.113.${i + 1}`), "Victim@Example.com ")).allowed) toOne++;
check("five posts naming one address from five connections are taken", toOne === 5, String(toOne));
check("and a sixth from a fresh connection is refused", !(await forms.takePublicFormAttempt("contact", from("203.0.113.99"), "victim@example.com")).allowed);

check("the first acknowledgement of the day is sent", await forms.takeAcknowledgement("apply", from("192.0.2.1"), "applicant@example.com"));
check("the second, from another connection, is not", !(await forms.takeAcknowledgement("apply", from("192.0.2.2"), "APPLICANT@example.com")));
check("another form's acknowledgement to that address is its own", await forms.takeAcknowledgement("design", from("192.0.2.1"), "applicant@example.com"));
const today = forms.publicFormKeys("apply", from("192.0.2.1"), "applicant@example.com", "2026-11-02").acknowledgement;
const tomorrow = forms.publicFormKeys("apply", from("192.0.2.1"), "applicant@example.com", "2026-11-03").acknowledgement;
check("tomorrow's acknowledgement is counted under another key", today !== tomorrow && today.endsWith(":2026-11-02"));

/* D ------------------------------------------------------------------------ */
const plain = forms.publicFormKeys("contact", from("198.51.100.7"), "someone@example.com");
check("no key holds the typed address", !Object.values(plain).some((k) => k.includes("someone")), JSON.stringify(plain));
check("the address key is the address's digest", /^form:contact:to:[0-9a-f]{64}$/.test(plain.address), plain.address);
process.env.SUPABASE_URL = `https://${DEVELOPMENT_REF}.supabase.co`;
process.env.BOARD_RUN_ID = "41500000001";
const boarded = forms.publicFormKeys("contact", from("198.51.100.7"), "someone@example.com");
check("a board run's connection key carries its run", boarded.connection === "form:contact:ip:board:41500000001:198.51.100.7", boarded.connection);
check("and so do its address and acknowledgement keys", boarded.address.startsWith("form:contact:to:board:41500000001:") && boarded.acknowledgement.startsWith("ack:contact:board:41500000001:"));
process.env.SUPABASE_URL = "https://fsaryeciduszuahgjbly.supabase.co";
const production = forms.publicFormKeys("contact", from("198.51.100.7"), "someone@example.com");
check("production's keys carry no run", !Object.values(production).some((k) => k.includes("board:")), JSON.stringify(production));
delete process.env.SUPABASE_URL;
delete process.env.BOARD_RUN_ID;

/* E ------------------------------------------------------------------------ */
const ROUTES = [
  { file: "src/app/api/lead/route.ts", write: "insertLead(", operator: "leadNotification(", ack: "queueEmail(inquiryAcknowledged(" },
  { file: "src/app/api/design-inquiry/route.ts", write: "insertDesignInquiry(", operator: "inquiryNotification(", ack: "queueEmail(\n      inquiryAcknowledged(" },
  { file: "src/app/api/windstorm-inquiry/route.ts", write: "insertWindstormInquiry(", operator: "inquiryNotification(", ack: "queueEmail(\n      inquiryAcknowledged(" },
  { file: "src/app/api/apply/route.ts", write: "insertStructuredApplication(", operator: "applicationNotification(", ack: "applicantConfirmation(" },
];
for (const r of ROUTES) {
  const src = code(r.file);
  const honeypot = src.indexOf("company)");
  const limit = src.indexOf("takePublicFormAttempt(");
  const write = src.indexOf(r.write);
  const operator = src.indexOf(r.operator);
  const gate = src.indexOf("takeAcknowledgement(");
  const ack = src.indexOf(r.ack);
  const name = r.file.split("/")[3];
  check(`${name}: every anchor is found`, [honeypot, limit, write, operator, gate, ack].every((i) => i >= 0), JSON.stringify({ honeypot, limit, write, operator, gate, ack }));
  check(`${name}: the post is counted after the honeypot and before the write`, honeypot < limit && limit < write);
  check(`${name}: a refusal answers 429 with the refusal sentence`, /status: 429/.test(src.slice(limit, limit + 300)) && /PUBLIC_FORM_REFUSAL/.test(src.slice(limit, limit + 300)));
  check(`${name}: the operator's copy is queued before the acknowledgement gate`, operator < gate);
  check(`${name}: and the acknowledgement is queued only past the gate`, gate < ack);
}

console.log(
  wrong === 0
    ? "PASS: the technician sheet sets coverage through its own action, and the four public forms are limited per connection and per address and acknowledge one address once a day."
    : `FAIL: ${wrong} check(s).`,
);
process.exitCode = wrong === 0 ? 0 : 1;
