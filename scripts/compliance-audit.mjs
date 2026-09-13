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
  legalEntityMatchesRegistrant,
} = await import("../src/config/credentials.ts");

/* ------------ 0. the legal entity name, which is a SECOND name discrepancy */

/*
 * Found 2026-09-11. `business.legalName` says the entity is 254 Engineering
 * Services LLC; the board issued F-29811 to 254 Services LLC. That is a claim
 * about who the firm IS, separate from what it trades as, and /government
 * prints it to procurement officers under the heading "Legal entity".
 *
 * This audit does not decide which is correct, because it cannot: the answer is
 * in formation documents nobody here can read. What it enforces is that the
 * discrepancy is RECORDED with both names written out, so it cannot be resolved
 * by somebody editing one string and assuming the other followed.
 */
{
  const { business } = await import("../src/config/business.ts");
  const registrant = verifiedFirmRegistrations.find((r) => r.status === "active")?.issuedTo;
  const actuallyMatch = business.legalName === registrant;

  rec(
    "the legal entity name and the registrant are either the same or the difference is recorded",
    actuallyMatch || legalEntityMatchesRegistrant.resolved === false,
    actuallyMatch
      ? `both say "${registrant}"`
      : `site says "${business.legalName}", board says "${registrant}", recorded as unresolved`,
  );

  /*
   * AND THE RECORD NAMES BOTH, not merely that something is wrong. A flag
   * saying "unresolved" with no names is a flag nobody can act on.
   */
  rec(
    "and the record names both, so nobody resolves it by editing one string",
    actuallyMatch ||
      (legalEntityMatchesRegistrant.legalNameOnSite === business.legalName &&
        legalEntityMatchesRegistrant.registrantOnRecord === registrant),
    actuallyMatch
      ? "no discrepancy to record"
      : `recorded: "${legalEntityMatchesRegistrant.legalNameOnSite}" against "${legalEntityMatchesRegistrant.registrantOnRecord}"`,
  );

  /*
   * AND THE RECORD CANNOT GO STALE. If somebody changes business.legalName or
   * the registrant without updating this record, the check above fails rather
   * than the record quietly describing two strings that no longer exist.
   */
  rec(
    "and it stays true of the values as they are today, not as they were when written",
    actuallyMatch || legalEntityMatchesRegistrant.because.includes(registrant ?? "~none~"),
    "the sentence names the registrant currently on record",
  );
}

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

  /*
   * THE FOOTER NOW NAMES THE REGISTRANT AND THE NUMBER, AND THIS CHECK CHANGED
   * WITH THE RULING RATHER THAN BEING LOOSENED.
   *
   * It used to assert the line said "pending with the Texas Board". Operator
   * ruling, 2026-09-11: until the board holds the operating name, the footer
   * reads "254 Services LLC, TBPELS Firm F-29811" with the brand above it, so
   * the day the gate opens the sites already hold out under the registered
   * name.
   *
   * The replacement is SHARPER than the old one, which is the response CLAUDE.md
   * section 6 asks for when an implementation is deliberately changed. The old
   * check could not see the thing that actually matters here: whether the number
   * is printed beside a name the board has no record of. This one can, and it
   * asserts both halves.
   */
  rec(
    "the footer line names the registrant exactly as the board issued it",
    line.includes(ISSUED_TO) && line.includes(FIRM_NUMBER),
    line.slice(0, 96),
  );
  rec(
    "and never puts the number beside the trading name",
    !new RegExp(`${TRADING_AS}[^.]{0,40}${FIRM_NUMBER}`).test(line) &&
      !new RegExp(`${FIRM_NUMBER}[^.]{0,40}${TRADING_AS}`).test(line),
    `the board has no record of "${TRADING_AS}", so its number may not appear beside it`,
  );
  rec(
    "and still says no engineer of record is in responsible charge",
    /no engineer of record/i.test(line),
    "a registration alone does not let a firm seal anything, and the footer says so",
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

  /*
   * AND THE PORTAL RAIL, WHICH IS NOT ONE OF THE THREE RULED PLACES AND IS
   * CHECKED ANYWAY.
   *
   * It carried its own hardcoded sentence, "Firm registration pending with
   * TBPELS", which became false the moment F-29811 issued on 2026-09-10 and
   * went on saying pending to the firm's own staff for a day. Nothing caught it
   * because nothing was looking: it is staff facing, so none of the three ruled
   * places covered it, and every check that renders that layout was green.
   *
   * Found by looking at a screenshot. Checked here so it cannot come back.
   */
  const portalLayout = codeOnly(readSource("src/app/portal/(app)/layout.tsx"));
  rec(
    "the portal rail renders the registration line rather than its own sentence",
    /registrationLine\(\)/.test(portalLayout) && !/registration pending with TBPELS/i.test(portalLayout),
    /registration pending with TBPELS/i.test(portalLayout)
      ? "the rail carries a hardcoded compliance sentence, which is a second account of a fact that lives in the register"
      : "src/app/portal/(app)/layout.tsx",
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

/* ------------- 5. the five conditions added 2026-09-11, each asserted by id */

/*
 * THE IDS ARE PINNED AS A LITERAL LIST, AND THAT IS THE WHOLE MECHANISM.
 *
 * An audit that iterated LAUNCH_CONDITIONS and checked each one it found would
 * pass just as happily over an array somebody shortened, which is the defect
 * class CLAUDE.md section 6 names: a check that agrees with the thing it
 * checks. So the seven are written out here, and the gate is asserted to carry
 * exactly them, no more and no fewer.
 *
 * Removing a condition therefore costs two edits made on purpose, which is the
 * same shape the business rulings in section 6c use.
 */
const RULED_CONDITIONS = [
  "switch",
  "registration",
  "operating-name",
  "stripe",
  "protocols",
  "phone",
  "recovery",
];

{
  const { LAUNCH_CONDITIONS, launchReadiness } = await import("../src/lib/launch.ts");
  const ids = LAUNCH_CONDITIONS.map((c) => c.id);

  rec(
    `the gate carries exactly the ${RULED_CONDITIONS.length} ruled conditions`,
    ids.length === RULED_CONDITIONS.length && RULED_CONDITIONS.every((id) => ids.includes(id)),
    ids.length === RULED_CONDITIONS.length
      ? ids.join(", ")
      : `the gate has ${ids.length}: ${ids.join(", ")}. Missing: ${RULED_CONDITIONS.filter((i) => !ids.includes(i)).join(", ") || "none"}`,
  );

  /*
   * EVERY CONDITION SAYS WHO CLEARS IT AND WHERE IT IS STATED TRUE. Operator
   * ruling: the launch document is one line each with who clears it and how it
   * is stated true in configuration, and a condition that cannot answer those
   * two questions cannot appear in that document.
   */
  const incomplete = LAUNCH_CONDITIONS.filter(
    (c) => !c.what?.trim() || !c.whoClears?.trim() || !c.statedIn?.trim(),
  ).map((c) => c.id);
  rec(
    "and every one names what it is, who clears it, and where it is stated true",
    incomplete.length === 0,
    incomplete.length === 0 ? `${ids.length} complete` : `incomplete: ${incomplete.join(", ")}`,
  );

  /*
   * A BLOCKER IS A SENTENCE. The ruling is explicit and the reason is the
   * reader: a list of falses is a puzzle. Asserted as real prose rather than as
   * a non empty string, because "no" is a non empty string.
   */
  const readiness = launchReadiness();
  const unmet = readiness.filter((r) => r.blocker !== null);
  /*
   * A SENTENCE IS WORDS AND A FULL STOP, NOT A LENGTH.
   *
   * The first version of this check required more than 24 characters and failed
   * on "LAUNCH_MODE is not live.", which is 24 exactly and is unarguably a
   * sentence. An arbitrary cliff tests the wrong property, and the note beside
   * it said "all full sentences" without consulting the result, so the audit
   * reported a failure while printing evidence that it had passed.
   *
   * Both are fixed here rather than by lowering the number: the test is that
   * the blocker reads as prose, and the note names whichever ones do not.
   */
  const notSentences = unmet
    .filter((r) => !(r.blocker.trim().split(/\s+/).length >= 4 && /[.]$/.test(r.blocker.trim())))
    .map((r) => r.condition.id);
  rec(
    "and every unmet one returns a sentence rather than a boolean",
    unmet.length > 0 && notSentences.length === 0,
    unmet.length === 0
      ? "NOTHING IS UNMET, so this check measured nothing. If the gate is genuinely open, this check needs rewriting"
      : notSentences.length === 0
        ? `${unmet.length} unmet, every one a sentence ending in a full stop`
        : `not sentences: ${notSentences.join(", ")}`,
  );

  /*
   * AND THE GATE IS STILL SHUT FOR MORE THAN ONE REASON. A check that the gate
   * is shut passes on a single blocker forever; naming which ones are
   * outstanding is what tells the next reader whether the list is being
   * evaluated at all.
   */
  rec(
    "and the conditions outstanding today are named",
    unmet.length >= 1,
    unmet.map((r) => r.condition.id).join(", "),
  );
}

/* ------------------ 5a. each new condition is stated in configuration, not code */

{
  const {
    stripeAccount,
    approvedProtocols,
    pointInTimeRecovery,
    placeholderPhonePatterns,
  } = await import("../src/config/launch-readiness.ts");

  /* --- Stripe: the account's OWNER is part of the condition, not just its existence. */
  rec(
    "the Stripe condition records whose account it is, not only that one exists",
    "connected" in stripeAccount && "accountName" in stripeAccount && "proof" in stripeAccount,
    `connected=${stripeAccount.connected}, accountName=${stripeAccount.accountName ?? "null"}, proof=${stripeAccount.proof ? "recorded" : "null"}`,
  );
  rec(
    "and it cannot be satisfied without a real charge AND its refund",
    stripeAccount.proof === null ||
      (Boolean(stripeAccount.proof.chargeId) &&
        Boolean(stripeAccount.proof.refundId) &&
        Boolean(stripeAccount.proof.on)),
    stripeAccount.proof
      ? `charge ${stripeAccount.proof.chargeId}, refund ${stripeAccount.proof.refundId}, ${stripeAccount.proof.on}`
      : "no proof recorded, which is why the condition is unmet",
  );
  rec(
    "and while it is unmet it says why in words",
    !stripeAccount.connected ? stripeAccount.because.trim().length > 40 : true,
    stripeAccount.because.slice(0, 90),
  );

  /* --- Protocols: the registry decides what may be SOLD. */
  const { services } = await import("../src/content/services.ts");
  const slugs = new Set(services.map((s) => s.slug));
  const unknown = approvedProtocols.filter((p) => !slugs.has(p.serviceSlug)).map((p) => p.serviceSlug);
  rec(
    "every approved protocol names a real service line",
    unknown.length === 0,
    unknown.length === 0
      ? `${approvedProtocols.length} approved, ${services.length} service lines exist`
      : `names no such service line: ${unknown.join(", ")}`,
  );

  /*
   * ONE APPROVAL PER LINE. Two rows for one service line is two answers to
   * which protocol governs it, and the dispatch would pick whichever came
   * first in the array.
   */
  const seen = new Set();
  const duplicated = approvedProtocols.filter((p) => (seen.has(p.serviceSlug) ? true : (seen.add(p.serviceSlug), false)));
  rec(
    "and no service line carries two approvals",
    duplicated.length === 0,
    duplicated.length === 0 ? "one protocol per line, or none" : `duplicated: ${duplicated.map((p) => p.serviceSlug).join(", ")}`,
  );

  /*
   * AND AN APPROVAL NAMES A LICENSED ENGINEER WHO IS IN THE REGISTER. An
   * approval by a name nobody verified is the fabricated credential this whole
   * register exists to prevent, wearing a protocol.
   */
  const { verifiedEngineers } = await import("../src/config/credentials.ts");
  const licensed = new Set(verifiedEngineers.map((e) => e.licenseNumber));
  const unverified = approvedProtocols
    .filter((p) => !licensed.has(p.approvedByLicense))
    .map((p) => `${p.serviceSlug} by ${p.approvedByLicense}`);
  rec(
    "and every approval names an engineer who is in the verified register",
    unverified.length === 0,
    unverified.length === 0
      ? verifiedEngineers.length === 0
        ? "no approvals and no verified engineers, which agree"
        : `${verifiedEngineers.length} verified engineer(s)`
      : `approved by somebody not in the register: ${unverified.join(", ")}`,
  );

  /*
   * AND THE CATALOGUE ACTUALLY READS IT. The ruling's own words: the service
   * catalogue reads the protocol registry to decide which is which, so nobody
   * can list a line that cannot be dispatched. Asserted on the ORDER path,
   * because that is the one that takes money.
   */
  const catalog = codeOnly(readSource("data/catalog.ts"));
  rec(
    "the order catalogue refuses a line with no approved protocol",
    /hasApprovedProtocol/.test(catalog) && /function orderBlockedReason\([\s\S]{0,220}hasApprovedProtocol: boolean/.test(catalog),
    "orderBlockedReason takes it as a required parameter, so the two sibling repositories fail to compile until somebody decides",
  );

  /* --- The phone, which is the one condition a person can fake by typing. */
  rec(
    "the phone condition refuses placeholders and not only emptiness",
    placeholderPhonePatterns.length >= 3 &&
      placeholderPhonePatterns.every((p) => p.pattern instanceof RegExp && p.why.trim().length > 10),
    `${placeholderPhonePatterns.length} patterns, each with a reason`,
  );
  /*
   * Exercised rather than trusted. A list of regexes nothing runs is a list.
   */
  const fakes = ["+12145551234", "+15555555555", "+11234567890", "+12140001234"];
  const caught = fakes.filter((f) => placeholderPhonePatterns.some((p) => p.pattern.test(f)));
  rec(
    "and the patterns actually catch the numbers somebody reaches for",
    caught.length === fakes.length,
    caught.length === fakes.length
      ? `all ${fakes.length} refused`
      : `these got through: ${fakes.filter((f) => !caught.includes(f)).join(", ")}`,
  );
  /*
   * AND A REAL NUMBER IS NOT REFUSED. A gate that refuses everything is not a
   * gate, and this half is what would catch a pattern widened past its job.
   */
  rec(
    "and a real number is not refused by them",
    !placeholderPhonePatterns.some((p) => p.pattern.test("+13612034471")),
    "a plausible Corpus Christi number passes the placeholder patterns",
  );

  /* --- Recovery: stated by a person, with a date, and its limit recorded elsewhere. */
  rec(
    "point in time recovery is stated by a person with a date",
    pointInTimeRecovery.enabled === false ||
      (Boolean(pointInTimeRecovery.on) && pointInTimeRecovery.statedBy.trim().length > 10),
    pointInTimeRecovery.enabled
      ? `stated ${pointInTimeRecovery.on} by ${pointInTimeRecovery.statedBy.slice(0, 60)}`
      : "not enabled",
  );
  rec(
    "and its limit is recorded where an incident would look, not only here",
    /restores all five apps or none/i.test(readSource("docs/disaster-recovery.md")),
    "docs/disaster-recovery.md section 2a states the limit in bold",
  );
}

/* ------------------ 5b. the launch document, and the screen that renders the list */

{
  const doc = readSource("docs/launch-readiness.md");
  const missing = RULED_CONDITIONS.filter((id) => !doc.includes(id));
  rec(
    "docs/launch-readiness.md names every condition by id",
    missing.length === 0,
    missing.length === 0 ? `${RULED_CONDITIONS.length} named` : `missing: ${missing.join(", ")}`,
  );

  /*
   * AND THE OPERATOR'S SCREEN RENDERS THE GATE'S OWN ANSWER rather than
   * computing its own. A screen with its own copy of the logic is a second
   * gate, and the first time the two disagree the operator reads the wrong one.
   */
  const screen = codeOnly(readSource("src/app/portal/(app)/launch/page.tsx"));
  rec(
    "the operator's launch screen renders the gate's own list",
    /launchReadiness\(\)/.test(screen),
    "src/app/portal/(app)/launch/page.tsx",
  );
  rec(
    "and does not decide for itself whether a condition is met",
    !/process\.env\.LAUNCH_MODE/.test(screen) &&
      !/operatingNameOnBoardRecord/.test(screen) &&
      !/approvedProtocols/.test(screen),
    "it reads no condition source directly, so it cannot disagree with the gate",
  );
  rec(
    "and it is reachable from the portal navigation",
    /\/portal\/launch/.test(codeOnly(readSource("src/components/portal/nav.ts"))),
    "a screen nothing links to is a screen nobody opens",
  );
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
