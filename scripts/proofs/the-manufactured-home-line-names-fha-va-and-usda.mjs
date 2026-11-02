/**
 * PROOF: THE MANUFACTURED HOME LINE NAMES FHA, VA AND USDA, THE SAME WAY, ON
 * EVERY SURFACE ROBERT NAMED.
 *
 * Robert's answer to issue #1 comment 6560030875, 2026-11-01: "FHA, VA and
 * USDA. The manufactured home foundation certification serves FHA, VA and USDA
 * loans. Make the service page, catalog wording, llms.txt and JSON-LD say FHA,
 * VA and USDA consistently."
 *
 *   A  the service page: every sentence on it that names a loan program names
 *      all three, and none writes them with a serial comma
 *   B  the catalog: the line's turnaround and its lender request help name all
 *      three
 *   C  llms.txt, rendered by its own route: the line's entry names all three
 *   D  JSON-LD: the Service node the page emits, built from the page's own
 *      summary, names all three
 *
 * NOT IN SCOPE, on purpose: /insights/manufactured-home-foundation-certification-loans
 * stays FHA only under Robert's ruling of 2026-10-30, until the VA and USDA
 * handbooks are read; his answer names four surfaces and not that post.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-manufactured-home-line-names-fha-va-and-usda.mjs
 */
import { readFileSync } from "node:fs";

const SLUG = "manufactured-home-foundation-certifications";
const { services } = await import("../../src/content/services.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { serviceSchema } = await import("../../src/lib/schema.tsx");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });
const ALL_THREE = (s) => /\bFHA\b/.test(s) && /\bVA\b/.test(s) && /\bUSDA\b/.test(s);
const sentences = (s) => s.split(/(?<=[.?!])\s+/);

const svc = services.find((s) => s.slug === SLUG);
check("the service line exists", Boolean(svc));
const pageStrings = [svc.title, svc.h1, svc.description, svc.summary, ...svc.what, ...svc.whoOrders, svc.turnaround, ...svc.faqs.flatMap((f) => [f.q, f.a])];
const programSentences = pageStrings.flatMap(sentences).filter((s) => /\b(FHA|VA|USDA)\b/.test(s));
check("the service page names the programs somewhere, so the scan has a subject", programSentences.length >= 3, `${programSentences.length}`);
const partial = programSentences.filter((s) => !ALL_THREE(s));
check("every service page sentence that names a program names all three", partial.length === 0, partial.join(" | "));
const serial = pageStrings.filter((s) => /\bVA, (or|and) USDA\b/.test(s));
check("none writes them with a serial comma", serial.length === 0, serial.join(" | "));
check("the summary names all three", ALL_THREE(svc.summary), svc.summary);
check("the description names all three", ALL_THREE(svc.description), svc.description);

const entry = CATALOG.find((e) => e.serviceSlug === SLUG);
check("the catalog line exists", Boolean(entry));
check("the catalog turnaround names all three", ALL_THREE(entry.turnaround), entry.turnaround);
const lender = entry.requiredInputs.find((i) => i.id === "lender_request");
check("the catalog's lender request help names all three", ALL_THREE(lender?.help ?? ""), lender?.help);

const { GET } = await import("../../src/app/llms.txt/route.ts");
const llms = await (await GET()).text();
const line = llms.split("\n").find((l) => l.includes(`/services/${SLUG})`));
check("llms.txt carries the line", Boolean(line));
check("its llms.txt entry names all three", ALL_THREE(line ?? ""), line);

const page = readFileSync("src/app/(site)/services/[slug]/page.tsx", "utf8");
check("the service page builds its Service node from service.summary", /serviceSchema\(\{[\s\S]*?description:\s*service\.summary/.test(page));
const node = JSON.stringify(serviceSchema({ name: svc.name, description: svc.summary, path: `/services/${SLUG}`, serviceSlug: SLUG }));
check("the JSON-LD Service node names all three", ALL_THREE(node));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the manufactured home line names FHA, VA and USDA together on the service page, in the catalog, in llms.txt and in its JSON-LD."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
