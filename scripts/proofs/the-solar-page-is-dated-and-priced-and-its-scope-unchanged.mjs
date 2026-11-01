/**
 * THE SOLAR PAGE IS DATED AND PRICED, AND ITS SCOPE IS UNCHANGED. Robert's GEO
 * ruling of 2026-10-31, item 6: "scope text unchanged, wind uplift wording
 * unchanged until Robert rules. Add Updated date, FAQPage JSON-LD for its
 * existing visible Q&A, Service + Offer JSON-LD from catalog.ts." Solar is
 * cited in 6 AI answers at average position 1.5 (the chat's Brand Radar run),
 * so the page's words are held still here and only its markup and date move.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-solar-page-is-dated-and-priced-and-its-scope-unchanged.mjs
 *
 * THE SCOPE IS PINNED AS A FINGERPRINT of every worded field, taken on
 * 2026-10-31 from the text on main. Any change to the wording turns this red,
 * so changing it costs a deliberate edit here, which is Robert's ruling to make.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { lineRange, chicagoDay } from "../lib/guide-dates.mjs";

const SCOPE_FINGERPRINT = "f46c0eaead251212645f2146e59b4b518067bd42f09e630841f8c49545171aba";
const WIND_UPLIFT = "Wind uplift is not calculated, and the letter says so.";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { services } = await import("../../src/content/services.ts");
const { serviceSchema, faqSchema } = await import("../../src/lib/schema.tsx");
const { CATALOG } = await import("../../data/catalog.ts");
const solar = services.find((s) => s.slug === "solar-structural-letters");

/* 1. The words are the words on main. */
const { dateModified, ...worded } = solar;
const fingerprint = createHash("sha256").update(JSON.stringify(worded)).digest("hex");
check("the solar page's wording, scope included, is unchanged", fingerprint === SCOPE_FINGERPRINT, fingerprint.slice(0, 16));
check("and the wind uplift sentence stands as written", solar.what.some((p) => p.includes(WIND_UPLIFT)));

/* 2. The Updated date is the block's git history, never a guess. */
const FILE = "src/content/services.ts";
const [a, b] = lineRange({ file: FILE, slug: "solar-structural-letters" });
const log = execFileSync("git", ["log", `-L${a},${b}:${FILE}`, "--format=COMMIT %aI"], { encoding: "utf8", maxBuffer: 1 << 26 });
const real = log
  .split(/^COMMIT /m)
  .filter(Boolean)
  .find((c) => {
    const changed = c.split("\n").filter((l) => /^[+-](?![+-])/.test(l));
    return changed.length > 0 && !changed.every((l) => /^[+-]\s*dateModified:/.test(l));
  });
const gitDay = real ? chicagoDay(real.slice(0, 25).trim()) : null;
check("its Updated date is the day its wording last changed in git", Boolean(dateModified) && dateModified === gitDay, `typed ${dateModified}, git ${gitDay}`);
const page = readFileSync("src/app/(site)/services/[slug]/page.tsx", "utf8");
check("and the service page shows it as Updated", page.includes("service.dateModified ?") && page.includes("Updated <time dateTime={service.dateModified}>"));

/* 3. Service and Offer from the catalog, FAQPage from the visible questions. */
const node = serviceSchema({ name: solar.name, description: solar.summary, path: `/services/${solar.slug}`, serviceSlug: solar.slug });
const offers = [].concat(node.offers ?? []);
const priced = CATALOG.filter((e) => e.serviceSlug === solar.slug && e.priceCents !== null);
check(
  "its Service carries an Offer at each catalog price, with no availability claim",
  node["@type"] === "Service" && priced.length > 0 && priced.every((e) => offers.some((o) => o.price === (e.priceCents / 100).toFixed(2) && o.priceCurrency === "USD")) && offers.every((o) => !("availability" in o)),
  offers.map((o) => o.price).join(", "),
);
const faq = faqSchema(solar.faqs);
check(
  "its FAQPage carries exactly its visible questions and answers",
  solar.faqs.length > 0 && faq.mainEntity.length === solar.faqs.length && solar.faqs.every((f, i) => faq.mainEntity[i].name === f.q && faq.mainEntity[i].acceptedAnswer.text === f.a),
);

console.log(wrong === 0 ? "PASS: the solar page is dated and priced, and its scope is unchanged." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
