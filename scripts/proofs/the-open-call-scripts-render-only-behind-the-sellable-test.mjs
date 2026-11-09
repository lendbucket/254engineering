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
/*
 * G. THE GENERAL SCRIPT FOLLOWS THE ROOF LINE, Robert's R3 ruling 4 of
 * 2026-11-02, including when it stands in for solar in a listed wind load city:
 * the queue reads the sellable answer for the line of the script actually shown.
 */
const { SCRIPT_LINE, SOLAR_WIND_LOAD_CITIES } = await import("../../src/content/crm-scripts.ts");
check("the general script's line is the roof line", SCRIPT_LINE.other?.serviceSlug === "roof-inspections" && !SCRIPT_LINE.other?.tier, JSON.stringify(SCRIPT_LINE.other));
const windCity = SOLAR_WIND_LOAD_CITIES[0];
check("a solar company in a wind load city is shown the general script", Boolean(windCity) && render.scriptVerticalFor({ vertical: "solar", city: ` ${String(windCity).toUpperCase()} ` }) === "other", String(windCity));
check("and a solar company elsewhere keeps its own", render.scriptVerticalFor({ vertical: "solar", city: "Amarillo" }) === "solar");
check(
  "the queue reads the sellable answer for the line of the script it shows",
  /const line = SCRIPT_LINE\[scriptVerticalFor\(\{ vertical, city: [^\]]*\}\)\];/.test(queue) && !/const line = SCRIPT_LINE\[vertical\];/.test(queue),
);

/*
 * H. THE ONE OTHER FILLER, THE SEQUENCE EMAIL (R7). fillScript is the
 * placeholder engine (price book, names); the sequence email uses it for its
 * own templates (src/content/crm-emails.ts), never for CRM_SCRIPTS (asserted
 * in D). What this proof owes Robert's R3 ruling 1 is that nothing renders an
 * OPEN text except behind the sellable test, so the email is held to exactly
 * the shape the renderer is held to above: the variant comes from its sellable
 * argument and nothing else, every vertical renders prelaunch when not
 * sellable, and its one send path hands it the line's own sellable answer for
 * the email actually shown. A third filler, or the email choosing its variant
 * any other way, turns this red. (Replaces "nothing outside the renderer fills
 * a script", which R7's email legitimately broke, 2026-11-02.)
 */
const fillers = srcFiles.filter((f) => f !== "src/lib/crm-script-render.ts" && /\bfillScript\s*\(/.test(readFileSync(f, "utf8")));
check(
  "outside the renderer, only the sequence email fills a template",
  JSON.stringify(fillers) === JSON.stringify(["src/lib/crm-email-rules.ts"]),
  fillers.join(", ") || "none",
);
const emailRules = readFileSync("src/lib/crm-email-rules.ts", "utf8");
check("the email chooses its variant from its sellable argument and nothing else", /const variant = sellable \? "open" : "prelaunch";/.test(emailRules));
check(
  "and reads an email pair only as CRM_EMAILS[...][variant]",
  (emailRules.match(/CRM_EMAILS\[/g) ?? []).length === 1 && /CRM_EMAILS\[usedVertical\]\[variant\]/.test(emailRules) && !/\.open\b|\["open"\]/.test(emailRules),
);
const emails = await import("../../src/lib/crm-email-rules.ts");
const ecard = (vertical) => ({ vertical, rep: "Sam", contact: "Pat Lee", company: "Proof Co", city: null, siteUrl: "https://254engineering.com", phone: "(281) 940-4490" });
const emailAsked = [];
for (const v of verticals) {
  const shut = emails.renderSequenceEmail(ecard(v), false);
  const open = emails.renderSequenceEmail(ecard(v), true);
  if (!(shut.ok && shut.variant === "prelaunch")) emailAsked.push(`${v}: not sellable gave ${shut.ok ? shut.variant : shut.error}`);
  if (shut.ok && findRegulatoryClaims([shut.subject, ...shut.paragraphs].join(" ")).length) emailAsked.push(`${v}: the not sellable email makes a present tense claim`);
  if (!(open.ok && open.variant === "open")) emailAsked.push(`${v}: sellable gave ${open.ok ? open.variant : open.error}`);
}
check(`every vertical's email renders prelaunch when not sellable and open only when sellable (${verticals.length})`, emailAsked.length === 0, emailAsked.join("; "));
check(
  "the email follows the scripts' own vertical rule (a solar company in a wind load city gets the general email)",
  /return scriptVerticalFor\(\{ vertical, city \}\);/.test(emailRules) && emails.emailVerticalFor("solar", ` ${String(windCity).toUpperCase()} `) === "other",
);
const emailCallers = srcFiles.filter((f) => f !== "src/lib/crm-email-rules.ts" && /\brenderSequenceEmail\s*\(/.test(readFileSync(f, "utf8")));
check(
  "renderSequenceEmail is called by the send path and the audit's samples only",
  JSON.stringify(emailCallers) === JSON.stringify(["src/lib/crm-email.ts", "src/lib/email-templates.ts"]),
  emailCallers.join(", ") || "none",
);
const send = readFileSync("src/lib/crm-email.ts", "utf8");
check(
  "the send path asks the sellable answer for the line of the email it shows, and hands it sellable.ok",
  /const line = SCRIPT_LINE\[emailVerticalFor\(vertical, [^\]]*\)\];/.test(send) &&
    /const sellable = await lineIsSellableForDisplay\(line\.serviceSlug, line\.tier \?\? null\);/.test(send) &&
    /\n\s*sellable\.ok,\n\s*\);/.test(send),
);

console.log(
  wrong === 0
    ? "PASS: the open call scripts are exempt from the present tense rule only where they are written, counted and named, and render nowhere except behind the sellable test."
    : `FAIL: ${wrong} check(s).`,
);
process.exitCode = wrong === 0 ? 0 : 1;
