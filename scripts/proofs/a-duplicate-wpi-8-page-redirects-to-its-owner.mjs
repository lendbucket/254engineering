/**
 * PROOF: ONE PAGE PER WPI-8 INTENT.
 *
 * Robert, 2026-11-01, round 3 item h. Owners: hire or price a WPI-8,
 * /services/windstorm-wpi-8; what a WPI-8 is, /insights/wpi-8-certificate;
 * look one up, /insights/texas-windstorm-certificate-lookup; TWIA coverage,
 * /windstorm/twia-coverage. The mapping, with the reason for each page, was
 * posted on issue #1 (6559524740) before merging.
 *
 *   A  /insights/windstorm-certificate-of-compliance answers 301 to the WPI-8
 *      guide, set as statusCode 301 rather than `permanent` (which is 308)
 *   B  it is no longer a post, so it leaves the sitemap, the post list and the
 *      perf audit's page set, and nothing in the source links to it
 *   C  what it said that the owner did not, subsections (e), (h), (i) and (j)
 *      of Insurance Code 2210.2515, is in the owner, which cites the section
 *   D  the two pages kept for a distinct intent carry their retargeted titles,
 *      each 50 to 60 characters
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-duplicate-wpi-8-page-redirects-to-its-owner.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OLD = "/insights/windstorm-certificate-of-compliance";
const OWNER = "/insights/wpi-8-certificate";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const { default: config } = await import("../../next.config.ts");
const redirects = typeof config.redirects === "function" ? await config.redirects() : [];
const r = redirects.find((x) => x.source === OLD);
check("the old path has a redirect", Boolean(r));
check("it goes to the WPI-8 guide", r?.destination === OWNER, r?.destination);
check("it answers 301, not the 308 that permanent sends", r?.statusCode === 301 && !("permanent" in (r ?? {})), JSON.stringify(r));

const { insights } = await import("../../src/content/insights.ts");
check("the post list was read, so the absence check is not over nothing", insights.length > 20, `${insights.length}`);
check("the old slug is no longer a post", !insights.some((p) => p.slug === "windstorm-certificate-of-compliance"));
const owner = insights.find((p) => p.slug === "wpi-8-certificate");
check("the owner is a post", Boolean(owner));

/* Every source file that could carry a link, walked rather than listed. */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs|md)$/.test(name)) files.push(p);
  }
};
walk("src");
walk("data");
const linking = files.filter((f) => readFileSync(f, "utf8").includes(`](${OLD})`) || readFileSync(f, "utf8").includes(`href="${OLD}"`));
check("the walk read the source tree", files.length > 300, `${files.length} files`);
check("nothing in src or data links to the old path", linking.length === 0, linking.join(", "));
const perf = readFileSync("scripts/perf-budgets.mjs", "utf8");
check("the perf audit no longer measures the old path", !perf.includes(`path: "${OLD}"`));
check("the perf audit measures the owner in its place", perf.includes(`path: "${OWNER}"`));

const text = owner
  ? [...owner.body.map((b) => [b.text, ...(b.items ?? [])].join(" ")), ...owner.faqs.map((f) => `${f.q} ${f.a}`)].join(" ")
  : "";
check("the owner carries the six month limit, subsection (e)", /2210\.2515\(e\)[^.]*six months after the final inspection/.test(text));
check("the owner carries the fee provision, subsection (h)", /2210\.2515\(h\)/.test(text));
check("the owner carries the accountability clauses, subsections (i) and (j)", /subsections \(i\) and \(j\)/.test(text));
check("the owner still carries the bar on rescission, subsection (k)", /2210\.2515\(k\)/.test(text));
check("the owner cites section 2210.2515 for them", owner?.sources?.some((s) => /six month limit/.test(JSON.stringify(s))));

const titles = {
  "windstorm-inspection-coastal-buyers": "No Windstorm Certificate on a Coastal Home | 254 Engineering",
  "texas-windstorm-inspections": "Windstorm Inspection Process in Texas | 254 Engineering",
};
for (const [slug, title] of Object.entries(titles)) {
  const p = insights.find((x) => x.slug === slug);
  check(`/insights/${slug} is kept`, Boolean(p));
  check(`/insights/${slug} carries its retargeted title`, p?.title === title, p?.title);
  check(`/insights/${slug} title is 50 to 60 characters`, title.length >= 50 && title.length <= 60, `${title.length}`);
}

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the duplicate WPI-8 page answers 301 to its owner, is gone from the post list, sitemap source, links and perf set, its unique statute facts are in the owner, and the two kept pages carry their retargeted titles."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
