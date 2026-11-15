/**
 * A SERVICE PAGE NAMES ITS GUIDE, UNDER "WHO ORDERS ONE".
 *
 * Robert's answer 23 of 2026-11-14: a Further reading line on the service
 * pages, linking each page's matching guide, from the SEO report's quick win 4
 * (the roofers guide, linked from the roof service page).
 *
 *   1. every service slug the map names is a real service, and every guide slug
 *      a published guide, so no line can render a dead link or silently vanish;
 *   2. every service has a line except the ones named here as having no guide
 *      yet, which are COUNTED, so the exception cannot quietly grow;
 *   3. the roof service page links the roofers guide, the quick win itself;
 *   4. by source, the line sits under the Who orders one list and its anchor is
 *      the guide's own H1.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-service-page-names-its-guide.mjs
 */
import { readFileSync } from "node:fs";

const { services } = await import("../../src/content/services.ts");
const { insights } = await import("../../src/content/insights.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PAGE = "src/app/(site)/services/[slug]/page.tsx";
const src = readFileSync(PAGE, "utf8");
const block = src.slice(src.indexOf("const FURTHER_READING"), src.indexOf("};", src.indexOf("const FURTHER_READING")));
const map = Object.fromEntries([...block.matchAll(/"([a-z0-9-]+)":\s*"([a-z0-9-]+)"/g)].map((m) => [m[1], m[2]]));
const pairs = Object.entries(map);
check("the map was read", pairs.length > 0, `${pairs.length} lines`);

const serviceSlugs = new Set(services.map((s) => s.slug));
const guideSlugs = new Set(insights.map((i) => i.slug));
for (const [service, guide] of pairs) {
  check(`${service} is a real service, and its guide ${guide} is published`, serviceSlugs.has(service) && guideSlugs.has(guide));
}

/* Robert's wording, "each page's matching guide": a service with no guide is named here, and counted. */
const NO_GUIDE_YET = ["residential-light-commercial-design"];
const without = services.map((s) => s.slug).filter((s) => !map[s]);
check(
  "every service has a line, except the ones with no guide yet",
  without.length === NO_GUIDE_YET.length && without.every((s) => NO_GUIDE_YET.includes(s)),
  without.join(", ") || "none",
);

check("the roof service page links the roofers guide (quick win 4)", map["roof-inspections"] === "engineer-letter-for-roofers");

const who = src.indexOf('eyebrow="Who orders one"');
const line = src.indexOf("data-further-reading");
const roofers = src.indexOf("For roofing companies");
check("the line sits under the Who orders one list, before the roofing partner panel", who > 0 && line > who && line < roofers);
check(
  "and its anchor is the guide's own H1, linked to the guide",
  /<Link href=\{`\/insights\/\$\{guide\.slug\}`\}[^>]*>\s*\{guide\.h1\}\s*<\/Link>/.test(src.slice(line, roofers)),
);

console.log(wrong === 0 ? "\nEvery service page names its guide." : `\n${wrong} check(s) wrong.`);
process.exitCode = wrong === 0 ? 0 : 1;
