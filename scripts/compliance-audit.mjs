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
  verifiedEngineers,
  verifiedCredentials,
  operatingNameOnBoardRecord,
  legalEntityMatchesRegistrant,
  secretaryOfStateAmendment,
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

/* ------------------------- 0b. the engineer register, and its one home */

/*
 * THE LICENCE NUMBER HAS ONE HOME. Operator ruling, 2026-09-16, recorded as the
 * FOURTH instance in a fortnight of one fact with two homes.
 *
 * peInResponsibleCharge() read TBPELS_PE_LICENSE from the environment. That was
 * harmless while no PE existed and became a live defect the moment 143295
 * entered the register, because a variable can differ between a build and a
 * deployment while a file cannot. Same defect as the firm registration number
 * before the 2026-09-10 ruling; same answer.
 */
{
  const PE_LICENSE = "143295";

  rec(
    "the engineer of record is in the register, with the licence number pinned here as a literal",
    verifiedEngineers.some((e) => e.licenseNumber === PE_LICENSE),
    verifiedEngineers.map((e) => `${e.name} ${e.licenseNumber}`).join("; ") || "the register is empty",
  );

  /*
   * AN UNRECORDED EXPIRY IS NAMED, NOT ABSORBED. null means nobody has written
   * the date down, which is a different state from current. This check does not
   * fail on it: recording the number before the date is a legitimate state the
   * operator is in today. It reports WHICH engineers are in it, so the absence
   * is visible in the run rather than silently fine.
   */
  const unrecorded = verifiedEngineers.filter((e) => e.expires === null).map((e) => e.name);
  const lapsed = verifiedEngineers
    .filter((e) => typeof e.expires === "string" && e.expires < new Date().toISOString().slice(0, 10))
    .map((e) => `${e.name} expired ${e.expires}`);

  rec(
    "no engineer in the register holds a licence recorded as already expired",
    lapsed.length === 0,
    lapsed.join("; ") || `${verifiedEngineers.length} engineer(s), none lapsed`,
  );
  rec(
    "and every engineer whose expiry is unrecorded is named, because an unknown expiry is not a current licence",
    true,
    unrecorded.length
      ? `expiry NOT YET RECORDED for: ${unrecorded.join(", ")}. activeEngineer() does not treat these as in responsible charge.`
      : "every engineer has a recorded expiry",
  );

  /*
   * THE RULE IS EXERCISED ON CONSTRUCTED VALUES, NOT ON THE REGISTER AS IT
   * HAPPENS TO BE TODAY. Changed 2026-09-16, the day a real expiry was recorded.
   *
   * Until then the register held an engineer with no expiry, so a check could
   * assert "an unrecorded expiry is not current" by looking at live data. The
   * moment the operator read the date off the roster, nothing was in that state
   * and the check began passing over an empty set. It would have been exercised
   * for the first time on the day somebody adds a second engineer without a
   * date, which is the one day nobody is watching it.
   *
   * So it calls the pure rule with the three answers that matter. True or false
   * today and every day, whatever the register holds.
   */
  const { activeEngineer, licenceIsCurrent } = await import("../src/lib/launch.ts");
  const TODAY = "2026-09-16";
  rec(
    "an unrecorded licence expiry is never current, asked of the rule rather than of the register",
    licenceIsCurrent(null, TODAY) === false && licenceIsCurrent("", TODAY) === false,
    "null and empty both answer false",
  );
  rec(
    "and a lapsed one is not current, and a future one is",
    licenceIsCurrent("2020-01-01", TODAY) === false &&
      licenceIsCurrent("2028-01-31", TODAY) === true &&
      licenceIsCurrent(TODAY, TODAY) === true,
    "expiry day itself still counts as current",
  );
  rec(
    "and the gate reads that same rule rather than a second copy of it",
    unrecorded.length === 0 || activeEngineer() === null,
    activeEngineer() ? `activeEngineer() returns ${activeEngineer()?.name}` : "activeEngineer() returns null",
  );

  /*
   * THE BRANCH AND THE COMPETENCE ARE DIFFERENT FACTS. Operator ruling,
   * 2026-09-16. Texas restricts practice by competence rather than by branch,
   * so an engineer whose licence says Civil and who will seal structural work
   * only must have BOTH recorded. A record carrying one of them is wrong in
   * whichever direction it omits.
   */
  const withoutCompetence = verifiedEngineers.filter((e) => !e.sealsOnly || e.sealsOnly.length === 0);
  rec(
    "every engineer records what he will seal, separately from the branch on his licence",
    withoutCompetence.length === 0,
    verifiedEngineers.map((e) => `${e.name}: branch ${e.disciplines.join("/")}, seals ${e.sealsOnly.join("/")}`).join("; ") || "no engineers",
  );
  rec(
    "and the roster read is attributed to a person and a date, because nothing here can read the roster",
    verifiedEngineers.every((e) => /\d{4}-\d{2}-\d{2}/.test(e.verified) && e.employersOnRoster.length > 0),
    verifiedEngineers.map((e) => `${e.name}: ${e.employersOnRoster.length} employer(s) on the roster`).join("; "),
  );
  rec(
    "and this firm appears on the engineer's own roster entry, which is the registration reflected from his side",
    verifiedEngineers.every((e) => e.employersOnRoster.includes(ISSUED_TO)),
    verifiedEngineers.map((e) => e.employersOnRoster.join(", ")).join(" | "),
  );

  /*
   * THE VARIABLE IS GONE AND MAY NOT COME BACK. The reverse of the usual scan:
   * this refuses a NAME rather than requiring one.
   */
  const { readdirSync: rd, statSync: st } = await import("node:fs");
  const srcFiles = [];
  const walkSrc = (dir) => {
    for (const name of rd(dir)) {
      const full = `${dir}/${name}`;
      if (st(full).isDirectory()) walkSrc(full);
      else if (/.(ts|tsx)$/.test(name)) srcFiles.push(full);
    }
  };
  walkSrc("src");
  rec(
    "the retirement sweep had source to read",
    srcFiles.length > 100,
    `${srcFiles.length} files (if this were zero the check below would pass over nothing)`,
  );
  const readsTheVariable = srcFiles.filter((file) => codeOnly(readSource(file)).includes("TBPELS_PE_LICENSE"));
  rec(
    "no source reads TBPELS_PE_LICENSE, because the register is the one home of a licence number",
    readsTheVariable.length === 0,
    readsTheVariable.join("; ") || "retired 2026-09-16, recorded in scripts/lib/soc2-credentials.mjs",
  );
}

/* ------- 0c. no credential is asserted unless the register holds it, dated */

/*
 * OPERATOR RULING, 2026-09-17, AFTER THE SAM FINDING.
 *
 * Nothing on this site asserts a registration, a certification or an
 * appointment unless `verifiedCredentials` holds it, with a date somebody
 * checked it and a reference a reader could check it against.
 *
 * WHY THE PATTERNS INCLUDE THE NEGATIVE AND THE "IN PROGRESS" FORMS, which is
 * the half that would otherwise be lost. The SAM defect was a boolean whose
 * TRUE branch said "registered" and whose FALSE branch said "registration is in
 * progress". Switching the flag off would have replaced a false claim with a
 * different false claim, because a registration that has not been started is
 * not in progress. A check that only refused the word "registered" would have
 * passed the repaired site.
 *
 * WHY THE REGISTER ITSELF IS THE ONLY EXEMPTION, asserted rather than assumed.
 * The register has to name SAM in order to record that the firm does NOT hold
 * it, which is the ruling: the record says why nothing renders. Every other
 * file under src is refused, and comments are stripped first, so the paragraphs
 * explaining this removal do not trip the check that enforces it.
 */
{
  const CREDENTIAL_CLAIMS = [
    { pattern: /SAM\.gov/i, what: "a SAM.gov registration" },
    { pattern: /\bSAM registered\b/i, what: "a SAM registration" },
    { pattern: /System for Award Management/i, what: "a SAM registration" },
    { pattern: /\bCAGE code\b/i, what: "a CAGE code" },
    { pattern: /Unique Entity Identifier/i, what: "a Unique Entity Identifier" },
    { pattern: /\bSDVOSB\b/i, what: "an SDVOSB certification" },
    {
      pattern: /Service Disabled Veteran Owned Small Business/i,
      what: "an SDVOSB certification",
    },
    {
      pattern: /registration is in progress|registration in progress/i,
      what: "a registration said to be under way",
    },
  ];

  /* The register is the one file allowed to name a credential the firm lacks. */
  const REGISTER = "src/config/credentials.ts";

  const { readdirSync: rd2, statSync: st2 } = await import("node:fs");
  const files = [];
  const walk = (dir) => {
    for (const name of rd2(dir)) {
      const full = `${dir}/${name}`;
      if (st2(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) files.push(full);
    }
  };
  walk("src");
  walk("data");

  const offenders = [];
  for (const file of files) {
    if (file === REGISTER) continue;
    const code = codeOnly(readSource(file));
    for (const claim of CREDENTIAL_CLAIMS) {
      if (claim.pattern.test(code)) offenders.push(`${file} asserts ${claim.what}`);
    }
  }

  rec(
    "no source outside the register asserts a credential, including as in progress",
    offenders.length === 0,
    offenders.join("; ") || `${files.length} files scanned, ${CREDENTIAL_CLAIMS.length} claim shapes`,
  );

  /*
   * The register's own shape. A held credential with no identifier and no
   * reference is the thing this ruling exists to prevent: a claim with an edit
   * point rather than a claim somebody checked.
   */
  const unverifiable = verifiedCredentials.filter(
    (c) => c.held && (!c.identifier || !c.reference || !/^\d{4}-\d{2}-\d{2}$/.test(c.verifiedOn)),
  );
  rec(
    "every credential the register holds carries an identifier, a date and a reference",
    unverifiable.length === 0,
    unverifiable.map((c) => c.name).join("; ") ||
      `${verifiedCredentials.filter((c) => c.held).length} held, ${verifiedCredentials.length} recorded`,
  );

  /*
   * And the one that is NOT held is recorded rather than deleted, with a date
   * and a reason, which is the operator's ruling. A credential that vanishes
   * from the record is one the next session re-adds by hand.
   */
  const sam = verifiedCredentials.find((c) => /SAM/i.test(c.name));
  rec(
    "SAM is recorded as not held, with the date somebody established that and why",
    Boolean(sam) &&
      sam.held === false &&
      /^\d{4}-\d{2}-\d{2}$/.test(sam.verifiedOn) &&
      sam.verified.length > 80,
    sam ? `held ${sam.held}, established ${sam.verifiedOn}` : "no SAM record in the register",
  );

  /*
   * THE TDI APPOINTMENT, WHICH THE RULING NAMES, AND WHY THIS ONE IS ASSERTED
   * RATHER THAN BANNED.
   *
   * The windstorm pages disclose that no engineer here holds a Texas Department
   * of Insurance windstorm appointment. That disclosure is owed: a WPI-8 on
   * ongoing construction is inspected by an appointed engineer, so a reader on
   * that page needs it before they enquire. Banning the phrase the way SAM is
   * banned would delete the disclosure and call it compliance.
   *
   * So the check reads the REGISTER and requires the render to agree with it,
   * in whichever direction the register points. Not held means the sentence
   * must be there. Held means it must be gone, because a firm that has the
   * appointment and still says it does not is telling a different lie.
   */
  const tdi = verifiedCredentials.find((c) => /TDI|Department of Insurance/i.test(c.issuer + c.name));
  const windstorm = readSource("src/content/windstorm-program.ts");
  const disclosesAbsence = windstorm.includes(
    "does not currently hold a Texas Department of Insurance windstorm appointment",
  );
  rec(
    tdi && !tdi.held
      ? "the windstorm pages disclose that no TDI appointment is held, because the register says none is"
      : "the windstorm pages no longer disclose an absent TDI appointment, because the register holds one",
    Boolean(tdi) && (tdi.held ? !disclosesAbsence : disclosesAbsence),
    tdi
      ? `register: held ${tdi.held}; page discloses the absence: ${disclosesAbsence}`
      : "no TDI record in the register, so nothing decides what the page should say",
  );

  /*
   * The retired declaration cannot come back. Same shape as the
   * TBPELS_PE_LICENSE check above it, and for the same reason: the defect was
   * one fact with a home nobody was checking.
   */
  const readsRetired = files.filter((f) => codeOnly(readSource(f)).includes("samRegistration"));
  rec(
    "no source reads the retired samRegistration declaration",
    readsRetired.length === 0,
    readsRetired.join("; ") || "retired 2026-09-17, recorded in src/config/business.ts",
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

  /*
   * AND SOMETHING IS HOLDING IT, NAMED, WHICHEVER CONDITION THAT IS.
   *
   * This used to assert that the OPERATING NAME was the condition holding the
   * gate, which was true from 2026-09-10 until the operator cleared it on
   * 2026-09-13 by ruling that the firm trades under its registered name.
   *
   * WHY THE REPLACEMENT IS NOT SIMPLY LOOSER. Naming one condition made this a
   * check on which condition happened to be unmet, and that is a fact about
   * today rather than a property of the gate. The property worth asserting is
   * the one the ruling of 2026-09-10 actually established: the switch alone
   * does not open the gate, and whatever holds it says so IN A SENTENCE a
   * person can act on rather than as a bare false.
   *
   * So it asserts there is at least one blocker and that every one of them is a
   * real sentence. A gate held by an empty string is a gate nobody can clear.
   */
  rec(
    `and the conditions holding it each say why (${blockers.length})`,
    blockers.length > 0 && blockers.every((b) => typeof b === "string" && b.trim().length > 40),
    blockers.length === 0
      ? "NO BLOCKERS AT ALL, so the switch alone would open it"
      : blockers.map((b) => b.split(".")[0]).join(" | "),
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
  /*
   * AND IT NO LONGER CONFESSES, WHICH IS THE OPERATOR'S RULING OF 2026-09-17.
   *
   * This check used to assert the footer SAID "no engineer of record is in
   * responsible charge". That sentence was true and had to be there for as long
   * as it was true. An engineer of record is now on the register, active, so
   * asserting the confession would be asserting that the firm keeps saying
   * something false about itself.
   *
   * WHAT REPLACES IT IS STRICTER RATHER THAN ABSENT, and that is the point: a
   * check that is deleted when the thing it guarded becomes true leaves the
   * surface unguarded. The footer states the registrant and the number and
   * NOTHING ELSE, which is what the operator asked for, so this asserts the
   * absence of the two sentence shapes that would put a claim back into it.
   */
  rec(
    "and states the registration without confessing or claiming anything else",
    !/no engineer of record/i.test(line) &&
      !/not (yet )?(offering|performing|accepting)/i.test(line) &&
      !/opening soon/i.test(line),
    line.slice(0, 96),
  );

  /*
   * AND THE CONDITION IS STATED, not merely false. A boolean anybody can flip
   * in a hurry is not a condition; a sentence naming the board's record is.
   */
  /*
   * THE OPERATING NAME RECORD, CLEARED, AND STILL A SENTENCE RATHER THAN A FLAG.
   *
   * This asserted the condition was FALSE and that its reason named both the
   * registrant and the name the sites traded under. The operator cleared it on
   * 2026-09-13, so asserting it is false is now asserting that a decision was
   * not made.
   *
   * WHAT SURVIVES IS THE PROPERTY THAT MATTERED, and it is the one the two
   * field object was built for: the answer cannot be a bare boolean somebody
   * flipped in a hurry. Cleared or not, the reason has to name BOTH names, so a
   * reader can see which name the board holds and which the sites use, and a
   * future session cannot flip it back without writing down why.
   *
   * The registrant is still asserted by literal through ISSUED_TO, which is the
   * pinned value, so this cannot drift into agreeing with whatever the config
   * happens to say.
   */
  rec(
    "the operating name record names both the registrant and the brand, whichever way it is set",
    operatingNameOnBoardRecord.because.includes(ISSUED_TO) &&
      operatingNameOnBoardRecord.because.includes(TRADING_AS),
    `onRecord: ${operatingNameOnBoardRecord.onRecord}. ${operatingNameOnBoardRecord.because.slice(0, 90)}`,
  );

  /*
   * AND WHILE A RENAME IS IN FLIGHT, THE RECORD NAMES THE NAME THE STATE HOLDS.
   * Operator ruling, 2026-09-15.
   *
   * The Secretary of State amendment creates a third name, and a reader of this
   * record has to be able to tell all three apart: the board's, the state's, and
   * the brand. The check above already forces the first and the third. This
   * forces the second for as long as the amendment is on file and the board has
   * not caught up, which is exactly the window where a reader is most likely to
   * confuse them.
   *
   * It is derived from the amendment's own presence rather than pinned to a
   * date, so it stops applying by itself when `issuedTo` becomes the new name
   * and the two records agree again.
   */
  {
    const renameInFlight = secretaryOfStateAmendment.newName !== ISSUED_TO;
    rec(
      renameInFlight
        ? "a rename is on file, so the record also names the entity name the state holds"
        : "no rename is in flight: the board and the state hold the same name",
      !renameInFlight ||
        operatingNameOnBoardRecord.because.includes(secretaryOfStateAmendment.newName),
      renameInFlight
        ? `state: ${secretaryOfStateAmendment.newName} (effective ${secretaryOfStateAmendment.effective}, file ${secretaryOfStateAmendment.fileNumber}); board: ${ISSUED_TO}`
        : `both hold ${ISSUED_TO}`,
    );
    rec(
      "and while it is in flight the board's record has not been quietly updated to the new name",
      !renameInFlight || !verifiedFirmRegistrations.some((r) => r.issuedTo === secretaryOfStateAmendment.newName),
      `registrations name: ${verifiedFirmRegistrations.map((r) => r.issuedTo).join(", ") || "none"}`,
    );
  }

  /*
   * AND IF IT IS CLEARED, IT SAYS THE FIRM TRADES UNDER THE REGISTERED NAME.
   *
   * The only route to true that this repository recognises. The alternative
   * route, an assumed name filed and acknowledged, would be a different
   * sentence naming the filing, and a cleared record saying neither is a
   * cleared record nobody can check.
   */
  rec(
    "and a cleared record says which of the two routes cleared it",
    operatingNameOnBoardRecord.onRecord === false ||
      /trades under its registered name|assumed name/i.test(operatingNameOnBoardRecord.because),
    operatingNameOnBoardRecord.onRecord ? "cleared, and the route is named" : "not cleared",
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
  /*
   * AND THE TWO SURFACES THIS CHECK DID NOT COVER, WHERE THE SAME DEFECT CAME
   * BACK. Operator ruling, 2026-09-17: extend the check or the sentence returns
   * a third time.
   *
   * CLAUDE.md records the 2026-09-12 defect: the portal sidebar carried "No
   * engineer of record is yet in responsible charge." as a literal, and it went
   * on saying pending to the firm's own staff for a day after TBPELS issued.
   * The fix asserted that the SIDEBAR renders registrationLine() and carries no
   * sentence of its own.
   *
   * /portal/login and /portal/set-password carried the identical literal and
   * were never covered, so when the engineer of record became real on
   * 2026-09-17 both screens went on telling every person signing in that there
   * was no engineer. Found by sweeping the source for the sentence rather than
   * by any check.
   *
   * The general form, which is why this is worth eleven lines: a check written
   * against the surface where a defect was FOUND protects that surface. The
   * defect belongs to the SENTENCE, and the sentence can live anywhere.
   */
  for (const screen of [
    "src/app/portal/(public)/login/page.tsx",
    "src/app/portal/(public)/set-password/page.tsx",
  ]) {
    const src = codeOnly(readSource(screen));
    rec(
      `${screen.split("/").slice(-2)[0]} states the registration through the deriver and carries no compliance sentence of its own`,
      src.includes("registrationLine()") &&
        !/no engineer of record/i.test(src) &&
        !/registration (is )?pending/i.test(src),
      screen,
    );
  }

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

/* ------------- 5. the conditions beyond the first three, each asserted by id */

/*
 * THE IDS ARE PINNED AS A LITERAL LIST, AND THAT IS THE WHOLE MECHANISM.
 *
 * An audit that iterated LAUNCH_CONDITIONS and checked each one it found would
 * pass just as happily over an array somebody shortened, which is the defect
 * class CLAUDE.md section 6 names: a check that agrees with the thing it
 * checks. So they are written out here BY ID, and the gate is asserted to carry
 * exactly them, no more and no fewer. The count is deliberately not stated in
 * this comment: a number beside a list is a second account of the list, and it
 * is always the one nobody updates.
 *
 * Removing a condition therefore costs two edits made on purpose, which is the
 * same shape the business rulings in section 6c use.
 */
const RULED_CONDITIONS = [
  "switch",
  "registration",
  /*
   * THE NINTH, AND A RENAME, BOTH ON 2026-09-17, AND BOTH COST TWO EDITS ON
   * PURPOSE.
   *
   * `operating-name` became `trading-name`. It used to gate everything on
   * whether the board held the name the firm trades under; it now decides which
   * NAME the trading copy uses and blocks nothing, because `firmName()` derives
   * the name from the board's own record and the hole it guarded is filled by
   * construction. Renaming it here is the second of the two edits, which is the
   * mechanism this list exists to impose.
   *
   * `engineer-of-record` is new. It was never a condition, and the reason is
   * worth keeping: `peInResponsibleCharge()` returned false whenever the gate
   * was shut, so a condition built on it would have been false BECAUSE the gate
   * was shut. That circularity was removed in the same commit that added this.
   */
  "trading-name",
  "engineer-of-record",
  "stripe",
  "protocols",
  "phone",
  "recovery",
  /*
   * THE EIGHTH, ADDED 2026-09-13, AND THIS RED IS THE MECHANISM WORKING.
   *
   * Phase 13 added self service sign up to the gate and this list stayed at
   * seven, so the first board after it went red naming the extra id. That is
   * exactly what the paragraph above says this list is for: the gate grew and
   * the check refused to agree with it until somebody wrote the growth down.
   *
   * It is the operator's alone to lift, and it is a decision they have not
   * made: a customer session signed on any preview deployment is accepted by
   * production, and preview URLs are publicly reachable. That is tolerable
   * while every account is one the operator created, and self service sign up
   * is what turns it into a risk about anybody who can reach a preview URL.
   * The full reasoning is in src/lib/launch.ts above the condition itself.
   */
  "self-service-signup",
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

/* ------------------------------------------------------------------------
 * NO SURFACE STATES A REGISTRATION STATUS THE REGISTER DOES NOT SUPPORT.
 *
 * Operator ruling, 2026-09-15. TBPELS issued F-29811 on 2026-09-10 and more
 * than twenty rendered sentences went on saying the registration was pending,
 * on public pages, in order API refusals, in seal refusals and on staff
 * screens, because each was a literal and this file guarded only the portal
 * rail. They now render `registrationStatement()`, and the order refusals
 * render `notYetAcceptingEngagements()`, which is about launch mode and never
 * about registration.
 *
 * Checked in both directions against the REGISTER, which is the declaration:
 * with an active registration, no source may carry a sentence saying it is
 * pending or not yet issued; with none, no source may call the firm registered.
 * The one exemption is registrationLine() and registrationStatement() in
 * launch.ts, whose branches are chosen by the register itself.
 * ------------------------------------------------------------------------ */
{
  const { readdirSync, statSync } = await import("node:fs");
  const { registrationStatement, notYetAcceptingEngagements } = await import("../src/lib/launch.ts");
  const hasActive = verifiedFirmRegistrations.some(
    (r) => r.status === "active" && r.expires >= new Date().toISOString().slice(0, 10),
  );

  /* The ruled sentences, written out, because an audit does not import its expectation. */
  const RULED = "254 Services LLC is a Texas registered engineering firm, TBPELS Firm Registration F-29811.";
  rec(
    "the registration sentence is exactly the ruled one, built from the register",
    registrationStatement() === RULED,
    registrationStatement() ?? "null",
  );
  rec(
    "and the launch mode refusal says nothing about registration",
    notYetAcceptingEngagements() === "The firm is not yet accepting engagements.",
    notYetAcceptingEngagements(),
  );

  const UNISSUED = [
    /registration[^.;"`]{0,80}\bpending\b/i,
    /\bpending with (?:the )?(?:TBPELS|Texas Board)/i,
    /application pending with the Texas Board/i,
    /registration (?:is )?not yet (?:issued|active)/i,
    /(?:once|when|until) (?:its |the |firm )?registration (?:is )?(?:issued|issues|active)\b/i,
    /\bnot yet registered\b/i,
  ];
  const ISSUED = [/Texas registered engineering firm/i, /TBPELS Firm Registration F-/i];

  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) files.push(full);
    }
  };
  walk("src");

  const launchExempt = (file, text) => {
    if (file !== "src/lib/launch.ts") return text;
    return text
      .replace(/export function registrationLine\(\)[\s\S]*?\n}\n/, "")
      .replace(/export function registrationStatement\(\)[\s\S]*?\n}\n/, "");
  };

  const hits = [];
  for (const file of files) {
    const text = launchExempt(file, codeOnly(readSource(file)));
    for (const pattern of hasActive ? UNISSUED : ISSUED) {
      const m = text.match(pattern);
      if (m) hits.push(`${file}: "${m[0]}"`);
    }
  }
  rec(
    "the sweep had source to read",
    files.length > 100,
    `${files.length} .ts and .tsx files under src (if this were zero the check below would pass over nothing)`,
  );
  rec(
    hasActive
      ? "no surface says the registration is pending or not yet issued, because the register holds an active one"
      : "no surface calls the firm registered, because the register holds no active registration",
    hits.length === 0,
    hits.length ? hits.join("; ") : `${files.length} files read against the register`,
  );

  /* --------------------------------------------------------------------------
   * AND THE FIRM'S NAME IS DERIVED, NOT TYPED. Operator ruling, 2026-09-15.
   *
   * The sweep above proves the registration SENTENCE derives. Until today the
   * firm's NAME did not: it was a literal in twenty rendered sentences, so
   * renaming the firm cost twenty seven edits and the audits pinning those
   * literals could only catch an accidental change, never a deliberate one.
   *
   * This is the check that makes `firmName()` real. A deriver nothing enforces
   * is a deriver the next sentence quietly ignores, which is how the name got
   * written twenty times in the first place.
   *
   * The name is the audit's OWN pinned literal, never read from the register,
   * because an audit that imports its expectation from the thing it audits
   * cannot disagree with anything. The register is asserted separately to still
   * state it, which names a drifted register as a drifted register.
   *
   * THE EXEMPT SET IS TWO CONFIG FILES AND IS ASSERTED, so it cannot quietly
   * grow to cover the next file somebody types the name into.
   * ---------------------------------------------------------------------- */
  /*
   * THE THIRD EXEMPTION IS NOT A LOOSENING, AND THE BOARD CAUGHT IT THE ONLY
   * WAY IT COULD. Operator ruling, 2026-09-16.
   *
   * src/config/stripe-console.ts records what the STRIPE CONSOLE holds, read by
   * a person. Its `legalBusinessName` is an observation of an external system,
   * not a sentence this platform renders, and it MUST be able to disagree with
   * the register: `stripe-webhook-audit` asserts that field equals the
   * registrant, and that is the check which makes "change it in the same
   * sitting as issuedTo" mechanical.
   *
   * SO DERIVING IT WOULD BE THE DEFECT. If this file called firmName(), the
   * equality check would compare a value to itself and pass forever, which is
   * exactly what CLAUDE.md forbids: an audit never imports its expectation from
   * the thing it audits. The check below therefore also asserts this file does
   * NOT import the deriver, so the exemption cannot quietly become vacuous.
   */
  /*
   * THE FOURTH ENTRY IS THE SAME KIND AS THE THIRD, AND FOR THE SAME REASON.
   *
   * src/content/protocols/rc-001.ts records the name the board's register held
   * ON THE DAY the protocol's naming discrepancy was written down. Like the
   * Stripe console record, it is an OBSERVATION and must be able to disagree
   * with the register: `protocol-registry-audit` fires its reissuance trigger
   * precisely when the register no longer matches this recorded value.
   *
   * Deriving it would make that trigger unfireable, which is the same defect as
   * an audit importing its expectation from the thing it audits. The check
   * below asserts that neither observation file imports the deriver, so the
   * exemption cannot quietly become vacuous.
   */
  const NAME_MAY_BE_TYPED_IN = [
    "src/config/credentials.ts",
    "src/config/business.ts",
    "src/config/stripe-console.ts",
    "src/content/protocols/rc-001.ts",
  ];
  /** The exempt files that OBSERVE the name rather than holding it. */
  const OBSERVERS = ["src/config/stripe-console.ts", "src/content/protocols/rc-001.ts"];
  const { firmName } = await import("../src/lib/launch.ts");

  rec(
    "firmName() returns the registrant the board holds, pinned here as a literal",
    firmName() === ISSUED_TO,
    `${firmName()} (pinned: ${ISSUED_TO})`,
  );
  rec(
    "and the register still states it, so a drift is named rather than absorbed",
    verifiedFirmRegistrations.some((r) => r.issuedTo === ISSUED_TO),
    verifiedFirmRegistrations.map((r) => r.issuedTo).join(", ") || "none",
  );

  const typed = [];
  for (const file of files) {
    if (NAME_MAY_BE_TYPED_IN.includes(file)) continue;
    const text = codeOnly(readSource(file));
    if (text.includes(ISSUED_TO)) typed.push(file);
  }
  rec(
    `no source outside the config writes "${ISSUED_TO}" as a literal, so reissuance is one value`,
    typed.length === 0,
    typed.length
      ? `${typed.join("; ")} (render firmName() instead)`
      : `${files.length - NAME_MAY_BE_TYPED_IN.length} files read`,
  );
  rec(
    "and the files allowed to type it are exactly four, two that hold the name and two that observe it",
    NAME_MAY_BE_TYPED_IN.length === 4 &&
      NAME_MAY_BE_TYPED_IN.every((f) => files.includes(f)),
    NAME_MAY_BE_TYPED_IN.join(", "),
  );
  /*
   * MATCHED ON THE CALL, NOT THE SUBSTRING. The first version tested /firmName/
   * and reddened on rc-001.ts because that file has a FIELD named
   * firmNameOnDocument. It is the matcher whose window is wider than the thing
   * it matches, which this repository has met four times now: what is forbidden
   * here is CALLING the deriver, so the pattern names the call.
   */
  const derivingObservers = OBSERVERS.filter((f) => /\bfirmName\s*\(/.test(readSource(f)));
  rec(
    "and no observation record derives the name, so each can still disagree with the register",
    derivingObservers.length === 0,
    derivingObservers.join(", ") || "stripe-console records what Stripe holds, rc-001 records what the register held when; deriving either would make its trigger compare a value to itself",
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
