/**
 * THE WPI-8 GUIDE ANSWERS FIRST. Robert's GEO ruling of 2026-10-31, item 4, as
 * amended by his answer 4 (upgrade /insights/wpi-8-certificate in place) and by
 * the facts he confirmed: TWIA's lookup is WPI-8-C only, the engineer signs the
 * WPI-2 forms and TDI issues the certificate, turnaround is the catalog's
 * wording.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-wpi-8-guide-answers-first.mjs
 *
 * The required headings, links and names are written out here as literals.
 * The prices are compared against the catalog, the declaration the page reads.
 */
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { insights } = await import("../../src/content/insights.ts");
const { catalogFor } = await import("../../data/catalog.ts");
const { verifiedEngineers } = await import("../../src/config/credentials.ts");

const post = insights.find((p) => p.slug === "wpi-8-certificate");
const { existsSync } = await import("node:fs");
check(
  "the WPI-8 guide is the existing /insights/wpi-8-certificate, with no second WPI-8 page and no /guides route (answer 4)",
  Boolean(post) && !insights.some((p) => p.slug === "wpi-8-windstorm-certificate") && !existsSync("src/app/(site)/guides/[slug]") && !existsSync("src/app/(site)/guides/wpi-8-windstorm-certificate"),
);
const body = post?.body ?? [];
const prose = body.map((b) => b.text ?? (b.items ?? []).join(" ") ?? "").join(" ") + " " + body.filter((b) => b.kind === "table").flatMap((b) => b.rows.flat()).join(" ");

const first = body[0];
const words = first?.kind === "p" ? first.text.split(/\s+/).filter(Boolean).length : Infinity;
check("it opens with the answer, in 50 words or fewer", words <= 50 && /certificate of compliance/.test(first?.text ?? ""), `${words} words`);

const QUESTIONS = [
  "What is a WPI-8?",
  "Who can sign a WPI-8?",
  "What is the difference between WPI-2, WPI-8, WPI-8-C and WPI-8-E?",
  "How do you look up a WPI-8 on TWIA?",
  "How long does a WPI-8 take?",
  "What does a WPI-8 cost?",
];
const h2 = body.filter((b) => b.kind === "h2").map((b) => b.text);
const missing = QUESTIONS.filter((q) => !h2.includes(q));
check("its H2s are the six questions people ask", missing.length === 0, missing.join(" | "));
/* The template adds five statement headings (title, sources, questions, related reading, the call to action). */
const ratio = (h2.filter((h) => h.endsWith("?")).length) / (h2.length + 5);
check("and question headings stay within voice-audit's 40 percent of the page", ratio <= 0.4, `${Math.round(ratio * 100)}%`);

const tables = body.filter((b) => b.kind === "table");
check("it carries exactly one comparison table, of the four documents", tables.length === 1 && ["WPI-2", "WPI-8", "WPI-8-E", "WPI-8-C"].every((d) => tables[0].rows.some((r) => r[0].startsWith(d))));

for (const [what, url] of [
  ["the TDI windstorm inspection process page", "https://www.tdi.texas.gov/wind/inspectionproc.html"],
  ["the TDI windstorm forms page", "https://agate.tdi.texas.gov/forms/form13windstorm.html"],
  ["the TWIA WPI-8 lookup", "https://www.twia.org/wpi-8-lookup/"],
]) check(`it links ${what} in the text`, prose.includes(`](${url})`));

check("it names TDI, TWIA and TBPELS in the text", ["Texas Department of Insurance", "Texas Windstorm Insurance Association", "Texas Board of Professional Engineers and Land Surveyors", "TBPELS"].every((n) => prose.includes(n)));
check("it says TWIA's lookup is WPI-8-C only", /TWIA's lookup finds only WPI-8-C certificates/.test(prose));
check("it says the inspector signs the WPI-2 forms and TDI issues the certificate", /inspector signs the WPI-2/.test(prose) && /TDI issues the certificate/.test(prose));
check("it states the firm's TDI appointment", /holds a Texas Department of Insurance windstorm appointment/.test(prose));

const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;
const ongoing = catalogFor("windstorm-wpi-8", "ongoing");
const completed = catalogFor("windstorm-wpi-8", "completed");
check(
  "its prices are the catalog's, ongoing and completed",
  prose.includes(`${dollars(ongoing.priceCents)} for a WPI-8 inspection of ongoing construction`) && prose.includes(`${dollars(completed.priceCents)} for a WPI-8E evaluation of completed construction`),
);
check("its turnaround is the catalog's wording, both tiers", prose.includes(ongoing.turnaround) && prose.includes(completed.turnaround));
check("it links to order", prose.includes("](/order/start/windstorm-wpi-8)"));

const names = verifiedEngineers.flatMap((e) => [e.name, e.licenseNumber, e.number].filter(Boolean).map(String));
const leaked = names.filter((n) => JSON.stringify(post).includes(n));
check("it carries no engineer name or license number", names.length > 0 && leaked.length === 0, leaked.length ? "leaked" : `${names.length} register values checked`);

check("its Updated date is shown (modified differs from published)", post.dateModified !== post.datePublished, `${post.datePublished} to ${post.dateModified}`);
check("it has visible questions for FAQPage", post.faqs.length >= 3);

console.log(wrong === 0 ? "PASS: the WPI-8 guide answers first, as ruled." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
