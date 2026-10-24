/**
 * THE FOUNDATION AND PERMIT LETTER INTAKE, AND THE SCREENS THAT RECORD WHAT
 * THE LETTERS PRINT, FOLLOW RULING 7.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/foundation-and-permit-intake-and-screens-follow-ruling-7.mjs
 *
 * Operator ruling 7 of 2026-10-23. The intake is read through fieldsFor, the
 * one definition every intake surface renders; the screens and the library are
 * read as source, for the call each one must make. The database rules (who may
 * record which fact) are proved in a-letter-states-only-recorded-facts.mjs.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { fieldsFor } = await import("../../data/intake-fields.ts");
const fc = Object.fromEntries(fieldsFor("foundation-inspections", "standard").map((f) => [f.id, f]));
const pl = Object.fromEntries(fieldsFor("structural-letters", "standard").map((f) => [f.id, f]));

/* FC-2: purpose and recipient in RC-001's customer wording (data/protocol-phrasing.ts rc001_q1, rc001_q2), pinned here. */
check(
  "FC-2: the foundation order asks the letter's purpose in RC-001's words",
  fc.reason?.label === "What is the letter for? Tell us in your own words, for example insurance, a home sale, a lender or a permit." &&
    fc.reason?.stage === "order",
  fc.reason?.label,
);
check(
  "FC-2: and the recipient in RC-001's words, still asked before sealing rather than to take the job (the staging ruling)",
  fc.addressed_to?.label === "Who should the letter be addressed to?" && fc.addressed_to?.stage === "seal",
  `${fc.addressed_to?.label} / ${fc.addressed_to?.stage}`,
);
/* FC-3: three structured fields, the foundation type a select of exactly the three. */
check(
  "FC-3: the foundation type is a select of exactly slab-on-grade, pier-and-beam, crawlspace",
  fc.foundation_type?.kind === "select" && JSON.stringify(fc.foundation_type?.options) === JSON.stringify(["slab-on-grade", "pier-and-beam", "crawlspace"]),
  `${fc.foundation_type?.kind} ${JSON.stringify(fc.foundation_type?.options)}`,
);
check("FC-3: year built and prior repair year are numbers", fc.year_built?.kind === "number" && fc.prior_repair_year?.kind === "number");
/* PL-1 and PL-3. */
check("PL-1: the authority and the permit number are separate fields", Boolean(pl.authority_name) && Boolean(pl.permit_number) && pl.authority_name.id !== pl.permit_number.id);
check(
  "PL-3: the element's category is a select from PL-001's list, with a free text description beside it",
  pl.element_category?.kind === "select" && (pl.element_category?.options ?? []).length === 7 && pl.element_described?.kind === "text" && pl.element_described?.required === true,
);
check("and neither line's intake asks what the other line asks", !fc.authority_name && !pl.foundation_type);

/* The screens and the library, each by the call it must make. */
const lib = readFileSync("src/lib/letter-facts.ts", "utf8");
check("the office's facts need files.update_details", /recordOfficeFact[\s\S]{0,400}can\(actor, "files\.update_details"\)/.test(lib));
check(
  "the engineer's facts, triage and capture items each need his licence and the register",
  ["recordEngineerFact", "recordTriage", "addCaptureItem"].every((fn) =>
    new RegExp(`export async function ${fn}[\\s\\S]{0,900}holdsLicence\\(actor, "review\\.decide"\\)[\\s\\S]{0,900}engineerOnRegister\\(actor\\)`).test(lib)),
);
const desk = readFileSync("src/app/portal/(app)/files/page.tsx", "utf8");
check("PL-2: the desk file screen carries the office's authority form on a permit letter file", /service_slug === "structural-letters" && can\(actor, "files\.update_details"\)[\s\S]{0,400}<AuthorityDetailsForm/.test(desk));
const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("FC-3: the review screen asks him to confirm the foundation type", /<FoundationTypeConfirm/.test(review) && /fromIntake=\{letterAnswers\.foundation_type/.test(review));
check("PL-3: and to review the element described", /<ElementDescribedReview/.test(review));
check("PL-2: and shows him the authority's details as the office recorded them", /letterFacts\.authority_address\?\.value/.test(review));
check("PL-4: and lists permit letter jobs waiting for his triage", /filesAwaitingTriage\(\)/.test(review) && /<TriagePanel/.test(review));
const job = readFileSync("src/app/portal/(app)/jobs/[id]/page.tsx", "utf8");
check("PL-5: the technician's job shows the engineer's added items", /captureAdditionsFor\(view\.file\.id\)/.test(job) && /The engineer also asks for/.test(job));
const route = readFileSync("src/app/api/portal/letter-facts/route.ts", "utf8");
check("the route only reads the body: every rule is in the library", !/supabaseAdmin|from\(/.test(route));

console.log("");
if (wrong === 0) {
  console.log("PASS: the foundation and permit letter intake and screens follow ruling 7.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
