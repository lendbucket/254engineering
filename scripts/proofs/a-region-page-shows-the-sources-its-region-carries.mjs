/**
 * PROOF: A REGION PAGE SHOWS THE SOURCES ITS REGION CARRIES, AND NOTHING WHEN
 * IT CARRIES NONE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-region-page-shows-the-sources-its-region-carries.mjs
 *
 * Operator ruling, 2026-10-17 (BACKLOG, "A REGION HAS NO SOURCES, SO A REGION
 * PAGE CANNOT CARRY A SOURCED FACT"), built on Robert's all-day prompt of
 * 2026-11-19, job two (`docs/master-undone-2026-11-19.md`, N3).
 *
 * No region carried a source when this was written, so a check that rendered
 * the real regions would have passed over nothing. This BUILDS THE SUBJECT: it
 * gives one region a source and another none, in memory, renders the real page
 * component to HTML, and reads it, so it stays true whatever the file holds.
 *
 *   A  with a source, the page shows its label, its address, and what it is
 *      cited for, in the sources band
 *   B  with none, the page has no sources band at all
 *   C  citation-audit derives its subject from every `url:` in src/content,
 *      and src/content/regions.ts is inside it, so a region's source is loaded
 *      the day it is written
 */
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

const { regions } = await import("../../src/content/regions.ts");
const Page = (await import("../../src/app/(site)/coverage/[slug]/page.tsx")).default;

const region = regions[0];
const other = regions[1];
check("the fixture has two regions to compare", Boolean(region && other), `${regions.length} regions`);
/*
 * Both regions are set here, in memory, whatever the file holds: the check must
 * stay true the day a region gains a real source, so it never asserts that none
 * has one. What each held is put back at the end.
 */
const held = { region: region.sources, other: other.sources };
other.sources = undefined;

const source = {
  label: "Proof source, Texas Department of Insurance",
  url: "https://www.tdi.texas.gov/wind/index.html",
  supports: "a sentence this proof wrote and nobody will publish",
};
region.sources = [source];

async function html(slug) {
  const element = await Page({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(element);
}

console.log("A  a region with a source");
{
  const out = await html(region.slug);
  check("the sources band renders", /id="sources"/.test(out));
  check("its label is shown", out.includes(source.label));
  check("its address is the link", out.includes(`href="${source.url}"`));
  check("what it is cited for is shown", out.includes(source.supports));
}

console.log("B  a region with none");
{
  const out = await html(other.slug);
  check("there is no sources band", !/id="sources"/.test(out));
}

console.log("C  citation-audit will load it");
{
  const audit = readFileSync("scripts/citation-audit.mjs", "utf8");
  check("citation-audit walks src/content", /const ROOT = "src\/content";/.test(audit));
  check("and reads every url: field", audit.includes("url:\\s*\"(https?:"));
  check("and does not exclude regions.ts", !/regions/.test(audit.slice(audit.indexOf("const EXCLUDED"), audit.indexOf("const OWN"))));
}

region.sources = held.region;
other.sources = held.other;
if (failures) {
  console.log(`FAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log("PASS: a region page shows the sources its region carries, and nothing when it carries none.");
