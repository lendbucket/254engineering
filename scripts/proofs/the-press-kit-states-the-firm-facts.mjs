/**
 * /press states the firm facts a writer copies, from the derivers that hold
 * them, and names no engineer.
 *
 * Robert, 2026-11-01 morning, round 3 item b: firm facts (legal name 254
 * Engineering LLC, TBPELS F-29811, offices, service lines, veteran owned as
 * plain prose, never certified), logo files to download, media contact
 * support@254engineering.com, and the expert topics: Texas windstorm and
 * WPI-8, foundations on expansive clay, solar structural review, and
 * manufactured home foundations for FHA. No engineer name.
 *
 * What is proved, read off the page source and the modules it reads:
 *   the legal name and registration line come from firmName() and
 *     registrationLine(), and the register they read says 254 Engineering LLC
 *     and F-29811;
 *   the San Antonio address comes from postalAddressLine(), and Corpus Christi
 *     is named with servesVerb() and no street;
 *   the service lines are rendered from `services`, not typed;
 *   the four topics are the four ruled, each linking a page that exists;
 *   every logo file listed exists under public/;
 *   the media contact is business.email and it is support@254engineering.com;
 *   "veteran owned" is never paired with "certified" or "certification";
 *   no registered engineer's name or license number appears in the source.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { business } = await import("../../src/config/business.ts");
const { verifiedEngineers, verifiedFirmRegistrations } = await import("../../src/config/credentials.ts");
const { services } = await import("../../src/content/services.ts");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const PAGE = "src/app/(site)/press/page.tsx";
const src = read(PAGE);

check("the legal name is firmName(), not typed", src.includes("{firmName()}"));
check("the registration line is registrationLine(), not typed", src.includes("{registrationLine()}"));
const reg = verifiedFirmRegistrations.find((r) => r.number === "F-29811");
check("the register holds F-29811 in the name 254 Engineering LLC", Boolean(reg && reg.issuedTo === "254 Engineering LLC"), reg ? reg.issuedTo : "absent");

check("the office address is postalAddressLine()", src.includes("{postalAddressLine()}"));
const ccBlock = src.slice(src.indexOf('href="/corpus-christi"'), src.indexOf("</dd>", src.indexOf('href="/corpus-christi"')));
check("Corpus Christi is named with servesVerb()", ccBlock.includes("{servesVerb()}"), ccBlock.slice(0, 120));
check("the Corpus Christi entry carries no street", !ccBlock.includes("postalAddressLine") && !/San Pedro/.test(ccBlock));
check("it says there is no office address there", ccBlock.includes("There is no office address there."));

check("the service lines are rendered from services", src.includes("services.map((s)") && src.includes("{services.length}"));
check("services has every line the catalog page lists (at least eight)", services.length >= 8, `${services.length}`);

const topics = [...src.matchAll(/title: "([^"]+)",\s*body: "[^"]+",\s*href: "([^"]+)"/g)].map((m) => ({ title: m[1], href: m[2] }));
const RULED = [
  ["Texas windstorm certification and the WPI-8", "/insights/wpi-8-certificate"],
  ["Foundations on expansive clay", "/services/foundation-inspections"],
  ["Solar structural review", "/services/solar-structural-letters"],
  ["Manufactured home foundations for FHA loans", "/services/manufactured-home-foundation-certifications"],
];
check("exactly the four ruled topics, in order", JSON.stringify(topics.map((t) => [t.title, t.href])) === JSON.stringify(RULED), JSON.stringify(topics));
const serviceSlugs = new Set(services.map((s) => s.slug));
const insights = read("src/content/insights-coastal.ts");
for (const t of topics) {
  const ok = t.href.startsWith("/services/")
    ? serviceSlugs.has(t.href.slice("/services/".length))
    : insights.includes(`slug: "${t.href.slice("/insights/".length)}"`);
  check(`the topic link ${t.href} names a page that exists`, ok);
}

const logos = [...src.matchAll(/file: "(\/brand\/[^"]+)"/g)].map((m) => m[1]);
check("three logo files are offered", logos.length === 3, logos.join(", "));
for (const f of logos) check(`${f} exists under public/`, existsSync(join(root, "public", f)));
check("each logo is a download link", src.includes("download"));

check("the media contact is business.email", src.includes("mailto:${business.email}"));
check("business.email is support@254engineering.com", business.email === "support@254engineering.com", business.email);

/* Comments state the rule itself ("never as a certification"), so the pairing is judged on code. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
check("the code without comments still carries the veteran owned prose it inherits", /veteran owned/.test(code));
check("veteran owned is never paired with certified", !/veteran[^.]{0,80}certif/i.test(code) && !/certif[^.]{0,80}veteran/i.test(code));
for (const e of verifiedEngineers) {
  check("no registered engineer's name is on the page", !src.includes(e.name));
  if (e.licenseNumber) check("no registered engineer's license number is on the page", !src.includes(String(e.licenseNumber)));
}
check("the engineer register was read, so the name check is not over nothing", verifiedEngineers.length > 0);

let failedCount = 0;
for (const r of results) {
  if (!r.ok) failedCount += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failedCount === 0
    ? "PASS: the press kit states the legal name, registration line, office, highlighted market, service lines, four ruled topics, logo files and media contact from their derivers, and names no engineer."
    : `FAIL: ${failedCount} check(s).`,
);
process.exitCode = failedCount === 0 ? 0 : 1;
