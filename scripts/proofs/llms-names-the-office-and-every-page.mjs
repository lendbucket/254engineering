/**
 * LLMS.TXT NAMES THE OFFICE AND EVERY LIVE PAGE, AND LLMS-FULL.TXT PRICES EVERY
 * DELIVERABLE FROM THE CATALOG. Robert's GEO ruling of 2026-10-31, item 1, with
 * his answer 3 (the generated page stays, no typed copy in public/).
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/llms-names-the-office-and-every-page.mjs
 *
 * Both routes are rendered by calling their own GET, so what is checked is the
 * text a crawler receives. The office facts are written out here as literals,
 * never imported, so a drifted config is a red rather than a value compared
 * with itself.
 */
import { existsSync } from "node:fs";

const STREET = "11103 San Pedro Ave, San Antonio, TX 78216";
const HOURS = "Monday to Sunday, 8:00 AM to 8:00 PM Central";
const EMAIL = "support@254engineering.com";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const short = await (await (await import("../../src/app/llms.txt/route.ts")).GET()).text();
const full = await (await (await import("../../src/app/llms-full.txt/route.ts")).GET()).text();
const { services } = await import("../../src/content/services.ts");
const { insightsByDate } = await import("../../src/content/insights.ts");
const { windstormPages } = await import("../../src/content/windstorm-program.ts");
const { proximityPages } = await import("../../src/content/structural-engineer.ts");
const { CATALOG } = await import("../../data/catalog.ts");

check("llms.txt states the office address", short.includes(`Office: ${STREET}`));
check("and the hours", short.includes(`Hours: ${HOURS}`));
check("and Corpus Christi as a service area, linked", /Service area: San Antonio, Corpus Christi \(https:\/\/254engineering\.com\/corpus-christi\)/.test(short));
check("and the San Antonio location page", short.includes("https://254engineering.com/san-antonio"));

const emails = [...new Set(short.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
check("llms.txt carries exactly one email, the firm's", emails.length === 1 && emails[0] === EMAIL, emails.join(", "));
const fullEmails = [...new Set(full.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
check("and llms-full.txt the same one", fullEmails.length === 1 && fullEmails[0] === EMAIL, fullEmails.join(", "));

const urls = [
  ...services.map((s) => `/services/${s.slug}`),
  ...insightsByDate().map((i) => `/insights/${i.slug}`),
  "/guides",
  "/windstorm",
  ...windstormPages.map((p) => `/windstorm/${p.slug}`),
  "/structural-engineer",
  ...proximityPages.map((p) => `/structural-engineer/${p.slug}`),
];
const missing = urls.filter((u) => !short.includes(`https://254engineering.com${u})`));
check(`llms.txt links every live service and guide page (${urls.length})`, urls.length > 40 && missing.length === 0, missing.join(", "));

const unpriced = CATALOG.filter((e) => {
  const price = e.priceCents == null ? "priced by quote" : `$${(e.priceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return !full.includes(`- ${e.name}: ${price}`) || !full.includes(`Turnaround: ${e.turnaround}`);
});
check(`llms-full.txt states every deliverable's catalog price and turnaround (${CATALOG.length})`, CATALOG.length >= 10 && unpriced.length === 0, unpriced.map((e) => e.name).join(", "));
check("llms-full.txt states the office address", full.includes(`Office: ${STREET}`));

check("no typed copy of llms-full.txt sits in public/", !existsSync("public/llms-full.txt") && !existsSync("public/llms.txt"));

console.log(wrong === 0 ? "PASS: llms.txt names the office and every page; llms-full.txt prices every deliverable." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
