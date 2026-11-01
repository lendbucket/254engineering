/**
 * /services/foundation-inspections and /san-antonio answer "structural engineer
 * foundation inspection San Antonio" first, and /corpus-christi follows the
 * same pattern with no street address.
 *
 * Robert's GEO ruling of 2026-10-31, item 5: an answer of about fifty words
 * with the price and turnaround from the catalog; what the visit covers and
 * what the report contains; the address and hours; an FAQ with FAQPage. The
 * same on /corpus-christi without an address (CLAUDE.md section 2).
 *
 * What is proved: every figure in the answers is the catalog's, the turnaround
 * is the catalog's sentence verbatim, the Corpus Christi total is the price
 * plus the coastal difference because Nueces is first tier and San Antonio's
 * is not, no Corpus Christi text carries the street, each page's FAQPage is
 * built from the exact list it renders, the letter on both location pages is
 * read through deliverableAsSigned, and every page that calls it is one the
 * void sweep revalidates.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const local = await import("../../src/content/foundation-local.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { money } = await import("../../src/config/prices.ts");
const { contact, hoursLine, postalAddressLine } = await import("../../src/config/contact.ts");
const { services } = await import("../../src/content/services.ts");
const { pagesQuoting, ALSO_QUOTED_ON } = await import("../../src/lib/scope-quote.ts");
const { sanAntonio } = await import("../../src/content/location-san-antonio.ts");
const { location } = await import("../../src/content/location.ts");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const words = (s) => s.split(/\s+/).filter(Boolean).length;
/* Figure, en, em and horizontal bar, built from code points so this file carries none. */
const LONG_DASH = new RegExp(`[${[0x2012, 0x2013, 0x2014, 0x2015].map((c) => String.fromCharCode(c)).join("")}]`);

const entry = CATALOG.find((e) => e.serviceSlug === "foundation-inspections");
check("the catalog has a priced foundation deliverable with a coastal difference", Boolean(entry && entry.priceCents && entry.coastalSurchargeCents));
const price = money(entry.priceCents);
const surcharge = money(entry.coastalSurchargeCents);

const sa = local.foundationAnswer();
check("the San Antonio answer is about fifty words", words(sa) >= 40 && words(sa) <= 60, `${words(sa)} words`);
check("it states the catalog price and coastal difference", sa.includes(` ${price}, plus ${surcharge} in first tier coastal counties`), sa);
check("it carries the catalog's turnaround sentence verbatim", sa.endsWith(entry.turnaround), entry.turnaround);
check("it names the city of the office", sa.includes(`in ${contact.city} is`));

const cc = local.foundationAnswerCorpusChristi();
const total = money(entry.priceCents + entry.coastalSurchargeCents);
check("the Corpus Christi answer is about fifty words", words(cc) >= 40 && words(cc) <= 60, `${words(cc)} words`);
check("it states the Nueces County total, price plus the coastal difference", cc.includes(`is ${total}: the ${price} price plus ${surcharge}, because Nueces County is a first tier coastal county`), cc);
check("it carries the catalog's turnaround sentence verbatim", cc.endsWith(entry.turnaround));

const saFaqs = local.sanAntonioFoundationFaqs();
const ccFaqs = local.corpusChristiFoundationFaqs();
const address = postalAddressLine();
check("the office has a street on record, so the San Antonio address is stated", Boolean(address));
check("a San Antonio question gives the address and hours", saFaqs.some((f) => f.a.includes(address) && f.a.includes(hoursLine())));
check("a San Antonio question says Bexar County pays no coastal difference", saFaqs.some((f) => f.a.includes("Bexar County is not one of the fourteen first tier coastal counties")));
check("the San Antonio questions differ from the Corpus Christi ones", saFaqs.every((s) => !ccFaqs.some((c) => c.q === s.q && c.a === s.a)));

const ccText = [cc, ...ccFaqs.flatMap((f) => [f.q, f.a])].join("\n");
check("no Corpus Christi text carries the street", !ccText.includes(contact.street), contact.street);
const ccPage = read("src/app/(site)/corpus-christi/page.tsx");
check("the Corpus Christi page reads no address deriver", !/postalAddressLine\(|officeLine\(|hasPostalAddress\(/.test(ccPage));

const all = [sa, cc, local.officeLine() ?? "", ...saFaqs.flatMap((f) => [f.q, f.a]), ...ccFaqs.flatMap((f) => [f.q, f.a])].join("\n");
check("no long dash in any of it", !LONG_DASH.test(all));

const visit = local.foundationVisit();
const foundationService = services.find((s) => s.slug === "foundation-inspections");
check("what the visit covers is the service page's own paragraph", foundationService.what.includes(visit));

const saPage = read("src/app/(site)/san-antonio/page.tsx");
for (const [name, src, faqFn] of [
  ["/san-antonio", saPage, "sanAntonioFoundationFaqs()"],
  ["/corpus-christi", ccPage, "corpusChristiFoundationFaqs()"],
]) {
  check(`${name}: the FAQPage is built from the list the page renders`, src.includes(`const faqs = ${faqFn};`) && src.includes("faqSchema(faqs)") && src.includes("<FaqBlock faqs={faqs}"));
  check(`${name}: the letter is read through deliverableAsSigned`, /await deliverableAsSigned\(foundation\.deliverable, `\/\$\{(sanAntonio|location)\.slug\}`\)/.test(src));
}

const svcPage = read("src/app/(site)/services/[slug]/page.tsx");
check("the service page leads with serviceAnswer for its own slug", svcPage.includes("const answer = serviceAnswer(service.slug);"));
const answered = services.filter((s) => local.serviceAnswer(s.slug) !== null).map((s) => s.slug);
check("only the foundation line has an answer", answered.length === 1 && answered[0] === "foundation-inspections", answered.join(", "));
const svc = local.serviceAnswer("foundation-inspections");
check("the service page's office line is the address and the hours", svc.office === `Office: ${address}. Hours: ${hoursLine()}.`);

check("the slugs the sweep names are the slugs the pages render", sanAntonio.slug === "san-antonio" && location.slug === "corpus-christi");
const swept = pagesQuoting(["254-FC-001"], services);
for (const p of ["/services/foundation-inspections", "/san-antonio", "/corpus-christi", "/llms-full.txt"]) {
  check(`a void on 254-FC-001 revalidates ${p}`, swept.includes(p), swept.join(", "));
}

/*
 * Every page that calls deliverableAsSigned is swept. Derived from the source
 * tree, so a new quoting page that ALSO_QUOTED_ON does not name turns this red.
 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const callers = walk(join(root, "src", "app")).filter((p) => readFileSync(p, "utf8").includes("deliverableAsSigned("));
const named = new Set(Object.values(ALSO_QUOTED_ON).flat());
const unswept = [];
for (const file of callers) {
  const route =
    "/" +
    relative(join(root, "src", "app"), file)
      .split(sep)
      .slice(0, -1)
      .filter((seg) => !seg.startsWith("("))
      .join("/");
  if (route === "/services/[slug]" || route === "/llms-full.txt") continue;
  if (!named.has(route)) unswept.push(route);
}
check("at least four pages call deliverableAsSigned, so the walk read something", callers.length >= 4, `${callers.length}`);
check("every page that calls deliverableAsSigned is one the void sweep revalidates", unswept.length === 0, unswept.join(", "));

let failedCount = 0;
for (const r of results) {
  if (!r.ok) failedCount += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failedCount === 0
    ? "PASS: the foundation answer is the catalog's price and turnaround in about fifty words on the service page and both location pages, Corpus Christi carries no street, each FAQPage is the list rendered, and every quoting page is swept."
    : `FAIL: ${failedCount} check(s).`,
);
process.exitCode = failedCount === 0 ? 0 : 1;
