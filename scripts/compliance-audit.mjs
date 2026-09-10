// @runtime react-server
/**
 * THE COMPLIANCE GATE'S NAMED CONDITIONS, ASSERTED.
 *
 *   npm run compliance-audit
 *
 * WHY A SEPARATE AUDIT FROM launch-audit
 * ---------------------------------------
 * launch-audit runs the SITE in both modes and asserts what each renders: what
 * prelaunch must not say, what live must say, and the claims neither may ever
 * make. It answers "given a mode, is the copy right".
 *
 * This one answers a different question, and it is the question TBPELS issuing
 * F-29811 on 2026-09-10 created: **may the mode change at all**. The operator's
 * ruling that day made the gate a set of NAMED CONDITIONS read from
 * configuration rather than one environment variable, so the flip is impossible
 * until each is stated true in a file somebody has to edit on purpose.
 *
 * The two audits fail on different days. launch-audit goes red when a sentence
 * drifts. This goes red when somebody tries to open the gate before the firm is
 * entitled to it, or when the registration number stops appearing in one of the
 * three places the ruling requires it.
 *
 * WHY THE NUMBER IS PINNED HERE AS A LITERAL
 * -------------------------------------------
 * CLAUDE.md section 6: an audit never imports its expectation from the thing it
 * audits. The register in src/config/credentials.ts is the one place the number
 * lives, and an audit that read the number from the register and compared it to
 * the register would compare a value to itself.
 *
 * So F-29811 is written out below as a literal. The duplication IS the
 * mechanism: two places somebody has to edit on purpose, which is the same
 * shape the business rulings in CLAUDE.md section 6c use, and it restores the
 * property the old TBPELS_FIRM_NUMBER environment variable was providing
 * without the hazard that a variable can differ between a build and a
 * deployment.
 */

import { readSource } from "./lib/read-source.mjs";

/*
 * Comments stripped before any source is matched.
 *
 * The first run of this file failed on "takes it from the register rather than
 * from what the site is rendering", because ops-docs.ts explains that choice in
 * a comment naming tbpelsFirmNumber() and the check read the explanation. That
 * is the wording defect this repository keeps meeting, and it has now been met
 * three times in one session, so it is answered here the way the others were
 * rather than by loosening the pattern.
 */
const codeOnly = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/*
 * THE RULED VALUES, AS LITERALS. Changing one of these is changing what the
 * board issued, which is not a thing that happens because a test was failing.
 */
const FIRM_NUMBER = "F-29811";
const ISSUED_TO = "254 Services LLC";
const EXPIRES = "2027-07-31";
const TRADING_AS = "254 Engineering Services";

console.log("");
console.log("================ THE COMPLIANCE GATE ================");
console.log("");

const {
  verifiedFirmRegistrations,
  operatingNameOnBoardRecord,
} = await import("../src/config/credentials.ts");

/* ------------------------------------------------ 1. the register, in one place */

{
  const active = verifiedFirmRegistrations.filter((r) => r.status === "active");
  rec(
    "the firm registration is recorded in the register",
    active.length === 1,
    `${verifiedFirmRegistrations.length} entr(y/ies), ${active.length} active`,
  );

  const r = active[0];
  rec(
    `and it is the number the board issued (${FIRM_NUMBER})`,
    r?.number === FIRM_NUMBER,
    r ? `register says ${r.number}` : "no active registration",
  );
  rec(
    "and it records the name the board issued it TO, which is not the trading name",
    r?.issuedTo === ISSUED_TO,
    r ? `issued to "${r.issuedTo}"` : "no active registration",
  );
  rec(
    `and when it expires (${EXPIRES})`,
    r?.expires === EXPIRES,
    r ? `expires ${r.expires}` : "no active registration",
  );

  /*
   * AND IT IS ACTIVE BY THE GATE'S OWN DEFINITION, not merely by its status
   * column.
   *
   * Injection 3 found this gap. Setting expires to 2020-01-01 left the check
   * above green, because it filtered on status alone, while
   * activeFirmRegistration() correctly returned null. One date check caught it
   * and the register check did not, which means the audit and the gate were
   * using two definitions of the word active.
   */
  const { activeFirmRegistration } = await import("../src/lib/launch.ts");
  rec(
    "and the gate agrees it is active today, expiry included",
    activeFirmRegistration()?.number === FIRM_NUMBER,
    activeFirmRegistration()
      ? `in force until ${activeFirmRegistration()?.expires}`
      : "the register lists it and the gate does not consider it active, which is an expiry or a status",
  );

  /*
   * The number lives in ONE place. An environment variable holding it as well
   * would be a second answer that a deployment could disagree with, which is
   * what the 2026-09-10 ruling removed.
   */
  const launchSrc = codeOnly(readSource("src/lib/launch.ts"));
  rec(
    "and the gate reads it from the register rather than from the environment",
    !/TBPELS_FIRM_NUMBER/.test(launchSrc) && /activeFirmRegistration/.test(launchSrc),
    /TBPELS_FIRM_NUMBER/.test(launchSrc)
      ? "src/lib/launch.ts still reads TBPELS_FIRM_NUMBER, so the number has two homes"
      : "one place, and a file cannot differ between a build and a deployment",
  );
}

/* ----------------------------- 2. the gate cannot open, and says why in a sentence */

{
  /*
   * THE CENTRAL CHECK. Set the switch and require that the gate STAYS SHUT,
   * because the other conditions are not met.
   *
   * This is the whole of the 2026-09-10 ruling: LAUNCH_MODE is the operator's
   * switch and one of the conditions rather than all of them.
   */
  const before = process.env.LAUNCH_MODE;
  process.env.LAUNCH_MODE = "live";
  const { launchBlockers, launchMode, tbpelsFirmNumber, registrationLine } = await import(
    "../src/lib/launch.ts"
  );
  const blockers = launchBlockers();
  const mode = launchMode();
  const rendered = tbpelsFirmNumber();
  const line = registrationLine();
  process.env.LAUNCH_MODE = before;

  rec(
    "with LAUNCH_MODE=live the gate is STILL shut",
    mode === "prelaunch",
    mode === "prelaunch"
      ? `${blockers.length} condition(s) unmet, so the switch alone does not open it`
      : "THE GATE OPENED ON THE SWITCH ALONE, which is the state the ruling forbids",
  );

  rec(
    "and the operating name is the condition holding it",
    blockers.some((b) => b.includes("operating name")),
    blockers.join(" | ") || "no blockers at all",
  );

  rec(
    "and no registration number renders while it is shut",
    rendered === null,
    rendered === null
      ? "tbpelsFirmNumber() is null, so nothing prints a number beside a name the board has no record of"
      : `IT RENDERED ${rendered}`,
  );

  rec(
    "and the footer line still says the registration is pending",
    /pending with the Texas Board/i.test(line),
    line.slice(0, 96),
  );

  /*
   * AND THE CONDITION IS STATED, not merely false. A boolean anybody can flip
   * in a hurry is not a condition; a sentence naming the board's record is.
   */
  rec(
    "the unmet condition carries the board's record as its reason",
    operatingNameOnBoardRecord.onRecord === false &&
      operatingNameOnBoardRecord.because.includes(ISSUED_TO) &&
      operatingNameOnBoardRecord.because.includes(TRADING_AS),
    operatingNameOnBoardRecord.because.slice(0, 120),
  );
}

/* --------------------- 3. what must carry the number BEFORE the gate may open */

/*
 * The ruling names three places. None of them can be TESTED in the live state
 * today, because the gate will not enter it, so what is asserted is that each
 * place is WIRED to the register: it renders registrationLine(), or it writes
 * the registration, rather than carrying a number of its own.
 *
 * That is the right assertion anyway. A hardcoded "F-29811" in a footer would
 * pass a check that looked for the number and would be the exact drift the
 * register exists to prevent.
 */
{
  const footer = codeOnly(readSource("src/components/site/SiteFooter.tsx"));
  rec(
    "the public footer renders the registration line rather than a number of its own",
    /registrationLine\(\)/.test(footer) && !new RegExp(FIRM_NUMBER).test(footer),
    new RegExp(FIRM_NUMBER).test(footer)
      ? "the footer carries the number as a literal, which the register cannot correct"
      : "src/components/site/SiteFooter.tsx",
  );

  const emailLayout = codeOnly(readSource("src/lib/email-layout.ts"));
  rec(
    "every email footer renders it too",
    /registrationLine\(\)/.test(emailLayout) && !new RegExp(FIRM_NUMBER).test(emailLayout),
    new RegExp(FIRM_NUMBER).test(emailLayout)
      ? "the email layout carries the number as a literal"
      : "src/lib/email-layout.ts, both the html and the plaintext part",
  );

  /*
   * THE THIRD PLACE IS A ROW, NOT A RENDER, and that is why it needed a
   * migration. A footer answers "under whose registration does this firm
   * operate NOW". Only the row answers it for a document as it was THEN, which
   * is the question asked about a sealed deliverable years later.
   */
  const docs = codeOnly(readSource("src/lib/ops-docs.ts"));
  rec(
    "a filed document records the registration it was filed under",
    /firm_registration: registration\?\.number \?\? null/.test(docs),
    "recordDocument writes it at insert",
  );
  rec(
    "and takes it from the register rather than from what the site is rendering",
    /activeFirmRegistration\(\)/.test(docs) && !/tbpelsFirmNumber\(\)/.test(docs),
    "a document filed today under F-29811 was filed under it whatever LAUNCH_MODE said that afternoon",
  );
  rec(
    "and the column exists in a migration",
    /add column if not exists firm_registration/.test(
      readSource("supabase/migrations/0041_a_filed_document_says_which_registration.sql"),
    ),
    "0041",
  );
}

/* --------------- 4. the three sites, and the two this repository cannot reach */

{
  /*
   * The ruling says all three sites. This repository is one of them, and the
   * other two are separate repositories that nothing here may touch, by the
   * operator's ruling of 2026-09-10.
   *
   * So what is asserted here is that the requirement is WRITTEN DOWN where
   * those sessions will find it. A condition nobody carried across is a
   * condition that is met on one site and unmet on two, which for a compliance
   * gate is the same as unmet.
   */
  for (const brief of ["docs/brief-sealedengineering.md", "docs/brief-stampmyplans.md"]) {
    const text = readSource(brief);
    rec(
      `${brief.split("/").pop()} carries the registration requirement`,
      text.includes(FIRM_NUMBER) && text.includes(ISSUED_TO),
      text.includes(FIRM_NUMBER)
        ? "the number and the name it was issued to are both stated"
        : "the sibling session would not know the number has to appear in its footer",
    );
  }
}

/* ----------------------------------------------------------------- verdict */

console.log("");
const failed = out.filter((r) => !r.ok);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The gate is shut, and every condition of opening it is named.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A compliance gate that can be opened by one variable is not a gate.");
  process.exitCode = 1;
}
