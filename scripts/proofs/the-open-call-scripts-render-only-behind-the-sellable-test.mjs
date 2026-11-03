/**
 * PROOF: THE OPEN CALL SCRIPT VARIANTS ARE EXEMPT FROM THE PRESENT TENSE RULE
 * ONLY WHERE THEY ARE WRITTEN, AND RENDER NOWHERE EXCEPT BEHIND THE SELLABLE
 * TEST. Robert's ruling of 2026-11-02 evening on R3 (issue #1, his answer to
 * 6589813147, item 1): "approved, the narrow counted exemption for the open
 * script variants in src/content/crm-scripts.ts only, with the second check
 * that they render nowhere except behind the sellable test."
 *
 *   A  the exemption is found by structure: one open and one prelaunch string
 *      for every vertical, read from CRM_SCRIPTS by the TypeScript compiler,
 *      and no prelaunch text is also an open text
 *   B  the exemption is narrow: an open literal is exempt only in that file and
 *      only as itself; the same text in any other file, a prelaunch literal, and
 *      an open text under a `prelaunch:` key are all read by the rule
 *   C  every prelaunch variant passes the ordinary present tense rule
 *   D  CRM_SCRIPTS is imported by the one renderer and nothing else, and no
 *      other source file carries an open variant's text
 *   E  the renderer picks the open variant only from its sellable argument:
 *      read in its source, and run for every vertical with sellable false and
 *      true
 *   F  the renderer's only caller hands it the line's own sellable answer,
 *      lineIsSellableForDisplay's .ok, and nothing else fills a script
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-open-call-scripts-render-only-behind-the-sellable-test.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { crmScriptVariants, exemptOpenScriptLines, CRM_SCRIPTS_FILE } = await import("../lib/crm-open-scripts.mjs");
const { findRegulatoryClaims } = await import("../lib/voice-blocklist.mjs");
const { CRM_VERTICALS } = await import("../../src/lib/crm-rules.ts");
const render = await import("../../src/lib/crm-script-render.ts");

/* ------------------------------------------------------------- A structure */

const variants = crmScriptVariants();
const verticals = [...CRM_VERTICALS].sort();
check("CRM_SCRIPTS reads with no shape problem", variants.problems.length === 0, variants.problems.join("; "));
check(
  "one open variant per vertical, and only those",
  JSON.stringify(variants.open.map((v) => v.vertical).sort()) === JSON.stringify(verticals),
  variants.open.map((v) => v.vertical).join(", "),
);
check(
  "one prelaunch variant per vertical",
  JSON.stringify(variants.prelaunch.map((v) => v.vertical).sort()) === JSON.stringify(verticals),
);
const openTexts = new Set(variants.open.map((v) => v.text));
check("no prelaunch text is also an open text", variants.prelaunch.every((p) => !openTexts.has(p.text)));

/* ------------------------------------------------------------- B narrow */

const sampleOpen = variants.open[0];
const samplePre = variants.prelaunch[0];
const lit = (t) => JSON.stringify(t);
const synthetic = [
  { path: CRM_SCRIPTS_FILE, text: `      ${lit(sampleOpen.text)},` },
  { path: CRM_SCRIPTS_FILE, text: `    open: ${lit(sampleOpen.text)},` },
  { path: "src/lib/somewhere-else.ts", text: `  ${lit(sampleOpen.text)},` },
  { path: CRM_SCRIPTS_FILE, text: `      ${lit(samplePre.text)},` },
  { path: CRM_SCRIPTS_FILE, text: `    prelaunch: ${lit(sampleOpen.text)},` },
  { path: CRM_SCRIPTS_FILE, text: `      ${lit(sampleOpen.text + " Extra.")},` },
];
const { kept, exempted } = exemptOpenScriptLines(synthetic, variants);
check("an open literal on its own line in that file is exempt", !kept.includes(synthetic[0]));
check("an open literal after `open:` in that file is exempt", !kept.includes(synthetic[1]));
check("the same text in any other file is read by the rule", kept.includes(synthetic[2]));
check("a prelaunch literal is read by the rule", kept.includes(synthetic[3]));
check("an open text under a `prelaunch:` key is read by the rule", kept.includes(synthetic[4]));
check("a changed open text is read by the rule", kept.includes(synthetic[5]));
check("the exemption counts and names what it exempted", exempted.length === 2 && exempted.every((v) => v === sampleOpen.vertical), exempted.join(", "));

/* ------------------------------------------------------------- C prelaunch passes the rule */

const preClaims = variants.prelaunch.flatMap((p) => findRegulatoryClaims(p.text).map((c) => `${p.vertical}: ${c.match ?? JSON.stringify(c)}`));
check("every prelaunch variant passes the present tense rule", preClaims.length === 0, preClaims.join("; "));

/* ------------------------------------------------------------- D one importer */

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}
const srcFiles = walk("src");
const importers = [];
for (const f of srcFiles) {
  if (f === CRM_SCRIPTS_FILE) continue;
  const code = readFileSync(f, "utf8");
  for (const m of code.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']*crm-scripts)["']/g)) {
    const names = m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
    importers.push({ file: f, names });
  }
  if (/import\s*\*\s*as\s+\w+\s*from\s*["'][^"']*crm-scripts["']/.test(code) || /import\(\s*["'][^"']*crm-scripts["']\s*\)/.test(code)) {
    importers.push({ file: f, names: ["*"] });
  }
}
const scriptReaders = importers.filter((i) => i.names.includes("CRM_SCRIPTS") || i.names.includes("*")).map((i) => i.file);
check("the importers of crm-scripts were found at all", importers.length >= 1, `${importers.length}`);
check(
  "CRM_SCRIPTS is imported by the renderer and nothing else",
  JSON.stringify(scriptReaders) === JSON.stringify(["src/lib/crm-script-render.ts"]),
  scriptReaders.join(", ") || "none",
);
const copies = [];
for (const f of srcFiles) {
  if (f === CRM_SCRIPTS_FILE) continue;
  const code = readFileSync(f, "utf8");
  for (const o of variants.open) if (code.includes(o.text.slice(0, 60))) copies.push(`${f} (${o.vertical})`);
}
check("no other source file carries an open variant's text", copies.length === 0, copies.join(", "));

/* ------------------------------------------------------------- E the renderer */

const renderer = readFileSync("src/lib/crm-script-render.ts", "utf8");
check("the renderer chooses the variant from its sellable argument and nothing else", /const variant = sellable \? "open" : "prelaunch";/.test(renderer));
check(
  "and reads a script pair only as pair[variant]",
  (renderer.match(/pair\[/g) ?? []).length === 1 && /pair\[variant\]/.test(renderer) && !/\.open\b|\["open"\]/.test(renderer),
);
const card = (vertical) => ({ vertical, rep: "Sam", contact: "Pat Lee", company: "Proof Co", city: null });
const asked = [];
for (const v of verticals) {
  const shut = render.scriptFor(card(v), false);
  const open = render.scriptFor(card(v), true);
  if (!(shut.ok && shut.variant === "prelaunch")) asked.push(`${v}: not sellable gave ${shut.ok ? shut.variant : shut.error}`);
  if (shut.ok && findRegulatoryClaims(shut.text).length) asked.push(`${v}: the not sellable text makes a present tense claim`);
  if (!(open.ok && open.variant === "open")) asked.push(`${v}: sellable gave ${open.ok ? open.variant : open.error}`);
}
check(`every vertical renders prelaunch when not sellable and open only when sellable (${verticals.length})`, asked.length === 0, asked.join("; "));

/* ------------------------------------------------------------- F the caller */

const callers = srcFiles.filter((f) => f !== "src/lib/crm-script-render.ts" && /\bscriptFor\s*\(/.test(readFileSync(f, "utf8")));
check("scriptFor has one caller, the call queue", JSON.stringify(callers) === JSON.stringify(["src/lib/crm-queue.ts"]), callers.join(", ") || "none");
const queue = readFileSync("src/lib/crm-queue.ts", "utf8");
const callAt = queue.indexOf("scriptFor(");
const callText = callAt < 0 ? "" : queue.slice(callAt, queue.indexOf(");", callAt) + 2);
check("and hands it sellable.ok", /,\s*sellable\.ok,?\s*\)\s*;$/.test(callText), callText.slice(-60));
const assigned = queue.slice(0, callAt).match(/const sellable = await lineIsSellableForDisplay\([^)]*\);/g) ?? [];
check("where sellable is the line's own lineIsSellableForDisplay answer", assigned.length >= 1);
const fillers = srcFiles.filter((f) => f !== "src/lib/crm-script-render.ts" && /\bfillScript\s*\(/.test(readFileSync(f, "utf8")));
check("nothing outside the renderer fills a script", fillers.length === 0, fillers.join(", "));

console.log(
  wrong === 0
    ? "PASS: the open call scripts are exempt from the present tense rule only where they are written, counted and named, and render nowhere except behind the sellable test."
    : `FAIL: ${wrong} check(s).`,
);
process.exitCode = wrong === 0 ? 0 : 1;
