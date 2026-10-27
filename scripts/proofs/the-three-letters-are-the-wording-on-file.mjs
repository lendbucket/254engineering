// @runtime react-server
//
// Declared because it reads src/lib/letter-seal.ts as text and imports the
// pure drafter, and letter-seal carries server-only.

/**
 * THE MANUFACTURED HOME AND SOLAR LETTERS ARE THE WORDING ON FILE, AND SEAL
 * WITH NO TEMPLATE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-three-letters-are-the-wording-on-file.mjs
 *
 * Item B of Robert's ruling of 2026-10-25, 23:51 Central: drafts are built only
 * from recorded facts (0087) and the drafted wording on file; the preview shows
 * the complete letter; the "waiting on template signature" state is removed;
 * a decline or send-back shows the office why.
 *
 *   1. Every line and option sentence of both letters is a line of the drafts
 *      document (docs/letter-drafts/letter-drafts-for-adoption-2026-10-24.md),
 *      word for word, in its order; and every line the document marks as his
 *      own words is in his answered letter templates file, template 5 or 6,
 *      read from the private source by SHA-256, with the HUD-7584 requirement.
 *   2. The drafter, run: a complete set of facts drafts every line with no
 *      slot left; each determination takes its own option; "none" additions
 *      print the drafts' own line; a missing fact, a determination with no
 *      letter, and a solar file with a survey date are each refused.
 *   3. The wiring, read: both letters are sealable and their reviews record a
 *      determination; sealing names no template; a recorded other requirement
 *      is refused; the template section is gone from the protocols screen; the
 *      office's file view leads with the reason a file was declined or sent
 *      back.
 */
import { readFileSync } from "node:fs";
import { documentText, ensurePrivateSources, squash } from "../lib/protocol-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const MH = await import("../../src/content/letters/manufactured-home-certification.ts");
const SL = await import("../../src/content/letters/solar-structural-letter.ts");
const { draftManufacturedHomeLetter, draftSolarLetter } = await import("../../src/lib/letter-draft-mh-sl.ts");

/* ------------------------------------------------- 1. the wording on file */
const DRAFTS = readFileSync("docs/letter-drafts/letter-drafts-for-adoption-2026-10-24.md", "utf8");
const sectionOf = (text, startHeading, endHeading) => {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(endHeading, start + 1);
  return start >= 0 && end > start ? text.slice(start, end) : "";
};
const mhDrafts = squash(sectionOf(DRAFTS, "## 1. Manufactured home", "## 2. Solar"));
const slDrafts = squash(sectionOf(DRAFTS, "## 2. Solar", "## 3. WPI-8E"));
check("the drafts document's sections 1 and 2 were found", mhDrafts.length > 0 && slDrafts.length > 0);

const inOrder = (section, texts) => {
  let at = 0;
  const missing = [];
  const outOfOrder = [];
  for (const t of texts) {
    const k = section.indexOf(squash(t), at);
    if (k < 0) {
      (section.includes(squash(t)) ? outOfOrder : missing).push(t.slice(0, 60));
      continue;
    }
    at = k + squash(t).length;
  }
  return { missing, outOfOrder };
};
const linesIn = (lines, option) =>
  lines.flatMap((l) => (l.kind === "determination" ? Object.values(option).flat() : [l.text]));
for (const [name, section, lines, option] of [
  ["manufactured home", mhDrafts, MH.MANUFACTURED_HOME_LETTER_LINES, MH.MANUFACTURED_HOME_LETTER_OPTION],
  ["solar", slDrafts, SL.SOLAR_LETTER_LINES, SL.SOLAR_LETTER_OPTION],
]) {
  const r = inOrder(section, linesIn(lines, option));
  check(`every ${name} line is a line of the drafts document, word for word`, r.missing.length === 0, r.missing.join(" | ") || `${linesIn(lines, option).length} lines`);
  check(`and in its order`, r.outOfOrder.length === 0, r.outOfOrder.join(" | "));
}
check("the line for no additions is the drafts document's own", mhDrafts.includes(squash(MH.MANUFACTURED_HOME_NO_ADDITIONS)));
check(
  "every line marked as his is among the letter's lines",
  [...MH.MANUFACTURED_HOME_STANDING].every((t) => linesIn(MH.MANUFACTURED_HOME_LETTER_LINES, MH.MANUFACTURED_HOME_LETTER_OPTION).includes(t)) &&
    [...SL.SOLAR_STANDING].every((t) => linesIn(SL.SOLAR_LETTER_LINES, SL.SOLAR_LETTER_OPTION).includes(t)),
);
check(
  "and the drafts document marks each of them as standing, his words",
  [...MH.MANUFACTURED_HOME_STANDING].every((t) => mhDrafts.includes(squash(`[Stands: your words, answered letter templates of 2026-10-06] ${t.replace(/^Based/, "")}`)) || mhDrafts.includes(squash(`2026-10-06] option A, on pass: ${t}`)) || mhDrafts.includes(squash(`2026-10-06] option B, on repairs required: ${t}`))) &&
    [...SL.SOLAR_STANDING].every((t) => slDrafts.includes(squash(`[Stands: your words, answered letter templates of 2026-10-06] ${t}`)) || slDrafts.includes(squash(`2026-10-06] option A, on pass: ${t}`)) || slDrafts.includes(squash(`2026-10-06] option C, on repairs required: ${t}`))),
);
check(
  "the four template sentences left for him to keep or strike are not printed",
  ["It is not a warranty or a guarantee of any kind.", "This letter makes no prediction of remaining service life."].every(
    (t) => !MH.MANUFACTURED_HOME_LETTER_LINES.some((l) => l.text.includes(t)),
  ),
);

const { ROOF_LETTER_SOURCE } = await import("../../src/content/letters/roof-certification.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../../src/content/protocols/private-sources.ts");
const [fetched] = await ensurePrivateSources(PRIVATE_SOURCES.filter((s) => s.path === ROOF_LETTER_SOURCE), PROTOCOL_SOURCE_BUCKET);
if (!fetched || fetched.unreachable) {
  console.log(`COULD NOT TELL: his answered templates file was not reachable${fetched?.why ? `, ${fetched.why}` : ""}.`);
  wrong += 1;
} else {
  check("his answered templates file, by SHA-256 and size", fetched.ok, fetched.why ?? fetched.how);
  const read = documentText(ROOF_LETTER_SOURCE);
  if (!read.ok) {
    console.log(`COULD NOT TELL: the template file was not read, because ${read.why}.`);
    wrong += 1;
  } else {
    const t5 = squash(sectionOf(read.text, "Template 5 of 8: Manufactured home foundation certification letter\n", "Template 6 of 8: "));
    const t6 = squash(sectionOf(read.text, "Template 6 of 8: Solar structural letter\n", "Template 7 of 8: "));
    check("templates 5 and 6 were found in his file", t5.length > 0 && t6.length > 0);
    const notIn = (section, texts) => texts.filter((t) => !section.includes(squash(t)));
    const mhMissing = notIn(t5, MH.MANUFACTURED_HOME_STANDING);
    const slMissing = notIn(t6, SL.SOLAR_STANDING);
    check("every manufactured home line marked as his is in his template 5", mhMissing.length === 0, mhMissing.map((t) => t.slice(0, 50)).join(" | "));
    check("every solar line marked as his is in his template 6", slMissing.length === 0, slMissing.map((t) => t.slice(0, 50)).join(" | "));
    check("and the requirement every manufactured home letter names is his answer, word for word", t5.includes(squash(`${MH.MANUFACTURED_HOME_NAMED_REQUIREMENT}.`)));
  }
}

/* --------------------------------------------------------- 2. the drafter */
const filled = (slots) => Object.fromEntries(slots.map((s) => [s, `proof ${s}`]));
const mhFacts = { ...filled(MH.MANUFACTURED_HOME_LETTER_SLOTS), named_requirement: MH.MANUFACTURED_HOME_NAMED_REQUIREMENT };
const slFacts = filled(SL.SOLAR_LETTER_SLOTS);
const mhPass = draftManufacturedHomeLetter("pass", mhFacts);
check("a complete manufactured home record drafts, with no slot left", mhPass.ok && mhPass.lines.every((l) => !l.text.includes("{{")), mhPass.ok ? `${mhPass.lines.length} lines` : mhPass.why);
check(
  "a pass takes option A alone",
  mhPass.ok &&
    mhPass.lines.filter((l) => l.kind === "determination").map((l) => l.text).join("|") ===
      MH.MANUFACTURED_HOME_LETTER_OPTION.pass[0].replace("{{named_requirement}}", MH.MANUFACTURED_HOME_NAMED_REQUIREMENT),
);
const mhRepairs = draftManufacturedHomeLetter("repairs-required", mhFacts);
check("repairs required takes option B and the sentence that follows it", mhRepairs.ok && mhRepairs.lines.filter((l) => l.kind === "determination").length === 2);
const mhNone = draftManufacturedHomeLetter("pass", { ...mhFacts, additions_as_observed: "none" });
check("additions recorded as none print the drafts' own line", mhNone.ok && mhNone.lines.some((l) => l.text === MH.MANUFACTURED_HOME_NO_ADDITIONS));
const mhMissing = draftManufacturedHomeLetter("pass", { ...mhFacts, serial_number: " " });
check("a missing fact is refused by name", !mhMissing.ok && mhMissing.missing.includes("serial_number"), mhMissing.ok ? "it drafted" : mhMissing.why);
for (const d of ["decline", "revise", "site-revisit"]) {
  const r = draftManufacturedHomeLetter(d, mhFacts);
  const s = draftSolarLetter(d, slFacts, null);
  check(`a ${d} determination drafts no letter on either line`, !r.ok && !s.ok);
}
const slPass = draftSolarLetter("pass", slFacts, null);
check("a complete solar record drafts, with no slot left", slPass.ok && slPass.lines.every((l) => !l.text.includes("{{")), slPass.ok ? `${slPass.lines.length} lines` : slPass.why);
const slRepairs = draftSolarLetter("repairs-required", slFacts, null);
check("solar repairs required takes option C and the sentence that follows it", slRepairs.ok && slRepairs.lines.filter((l) => l.kind === "determination").length === 2);
const slSurvey = draftSolarLetter("pass", slFacts, "2026-10-01");
check("a solar file with an installer's survey date is refused until that case is worded", !slSurvey.ok && /survey/.test(slSurvey.why), slSurvey.ok ? "it drafted" : slSurvey.why);

/* ---------------------------------------------------------- 3. the wiring */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("both letters are sealable", /SEALABLE_PROTOCOLS = \["254-RC-001", "254-FC-001", "254-PL-001", "254-MH-001", "254-SL-001"\]/.test(seal));
const run = readFileSync("src/lib/protocol-run.ts", "utf8");
/* Membership, not position: 254-RS-001 joins the same list (item C), and the exact set is pinned in fc-and-pl-reviews-record-a-determination. */
const reviewed = (run.match(/REVIEWED_UNDER_SIGNATURE = \[([^\]]*)\]/) ?? [])[1] ?? "";
check("and their reviews record a determination", reviewed.includes('"254-MH-001"') && reviewed.includes('"254-SL-001"'), reviewed);
const sealBody = seal.slice(seal.indexOf("export async function sealLetter("), seal.indexOf("export function sealerFor(") > 0 ? seal.indexOf("export function sealerFor(") : seal.indexOf("export type AwaitingLetter"));
check("sealing asks for no template and names none (0091)", !/letterNeedsTemplate|templateToSealFrom|p_letter_template_act_id/.test(sealBody));
check("a recorded requirement other than HUD-7584 is refused", /if \(fact\("named_requirement"\)\) \{\s*return \{\s*ok: false,/.test(seal));
check("the drafts take the version the file ran under (L2a)", /async function manufacturedHomeOrSolarDraft[\s\S]*?fileFactsFor\(det, \{ printsProtocolVersion: true \}\)/.test(seal));
const protocols = readFileSync("src/app/portal/(app)/protocols/page.tsx", "utf8");
/* An import or a render, never the name in the comment that records why the section went. */
check(
  "the protocols screen no longer waits on a template signature",
  !/import[^;]*(LETTER_TEMPLATES|SignTemplatePanel|templateSignatureStatus)/.test(protocols) && !/<SignTemplatePanel|templateSignatureStatus\(/.test(protocols),
);
const files = readFileSync("src/app/portal/(app)/files/page.tsx", "utf8");
check(
  "the office's file view leads with why it was declined or sent back",
  /lastMove\.from_status === "under_review" && lastMove\.to_status === selected\.status/.test(files) && /\{sentBack \? \(/.test(files),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the manufactured home and solar letters are the wording on file, and seal with no template.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
