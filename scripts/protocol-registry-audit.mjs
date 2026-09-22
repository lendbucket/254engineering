/**
 * DOES THE PORTAL SAY WHAT THE SIGNED PROTOCOL SAYS, IN BOTH DIRECTIONS?
 *
 *   npx tsx scripts/protocol-registry-audit.mjs
 *
 * THE RULE THIS AUDIT EXISTS FOR. The document is the authority and the portal
 * is its implementation.
 *
 *   Anything in the portal that is not in the document is a defect.
 *   Anything in the document the portal silently drops is a WORSE defect.
 *
 * The second is worse because it is invisible: a question nobody asks leaves no
 * trace, while an invented question at least appears on a screen somebody can
 * read.
 *
 * DERIVED FROM A DECLARATION, CHECKED AGAINST THE DOCUMENT. The declaration is
 * src/content/protocols/rc-001*.ts. The document is the PDF itself, read with
 * pdftotext at run time. Neither is a hand list, and the audit never compares
 * the declaration to itself: every text assertion is against the extracted
 * document.
 *
 * WHEN pdftotext IS NOT INSTALLED the document half reports COULD NOT TELL and
 * the structural half still runs. Unreachable is not failed, and it says loudly
 * which half did not run.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const tell = [];

console.log("");
console.log("========== 254-RC-001 AGAINST ITS SIGNED DOCUMENT ==========");
console.log("");

const { RC001, RC001_ENFORCED, RC001_AMBIGUITIES, RC001_SIGNATURE_EVIDENCE } = await import(
  "../src/content/protocols/rc-001.ts"
);
const { verifiedFirmRegistrations } = await import("../src/config/credentials.ts");

/* ------------------------------------------- 1. the declaration is coherent */

const numbers = RC001.intakeQuestions.map((q) => q.number);
rec(
  "the intake questions are numbered 1 to 16 with no gap and no repeat",
  numbers.length === 16 && new Set(numbers).size === 16 && Math.min(...numbers) === 1 && Math.max(...numbers) === 16,
  `${numbers.length} questions: ${numbers.join(",")}`,
);

const flagNumbers = RC001.intakeQuestions.filter((q) => q.flag).map((q) => q.number).sort((a, b) => a - b);
rec(
  "the flag questions are exactly 8 to 12, because a yes on one routes to the engineer before dispatch",
  JSON.stringify(flagNumbers) === JSON.stringify([8, 9, 10, 11, 12]),
  `flags: ${flagNumbers.join(",")}`,
);

rec(
  "exactly one upload is required outright, and it is the photo of the front of the property",
  RC001.intakeUploads.filter((u) => u.tier === "required").length === 1 &&
    RC001.intakeUploads.find((u) => u.tier === "required")?.key === "front-of-property",
  RC001.intakeUploads.map((u) => `${u.key}:${u.tier}`).join(", "),
);

const itemKeys = RC001.checklist.map((i) => i.key);
rec(
  "every checklist item has a unique key",
  new Set(itemKeys).size === itemKeys.length,
  `${itemKeys.length} items`,
);
const declaredSections = new Set(RC001.sections.map((s) => s.key));
const orphanSections = [...new Set(RC001.checklist.map((i) => i.section))].filter((s) => !declaredSections.has(s));
rec(
  "every checklist item sits under a declared section",
  orphanSections.length === 0,
  orphanSections.join(", ") || `${declaredSections.size} sections`,
);
const emptySections = RC001.sections.filter((s) => !RC001.checklist.some((i) => i.section === s.key));
rec(
  "and every declared section has at least one item, so a heading cannot survive its content",
  emptySections.length === 0,
  emptySections.map((s) => s.heading).join(", ") || "all sections populated",
);

rec(
  "the five determinations are present and no others",
  RC001.determinations.length === 5 &&
    JSON.stringify(RC001.determinations.map((d) => d.key)) ===
      JSON.stringify(["pass", "revise", "repairs-required", "site-revisit", "decline"]),
  RC001.determinations.map((d) => d.key).join(", "),
);
rec(
  "every determination carries at least one criterion, so none is a heading with nothing under it",
  RC001.determinations.every((d) => d.criteria.length > 0),
  RC001.determinations.map((d) => `${d.key}:${d.criteria.length}`).join(" "),
);

/*
 * An unsettled threshold must carry the question it raises. A number recorded
 * as unsettled with nothing to ask is a note nobody can act on.
 */
const unsettledWithoutQuestion = RC001.thresholds.filter((t) => !t.settled && !t.question);
rec(
  "every threshold the document leaves open carries the question it raises for the engineer",
  unsettledWithoutQuestion.length === 0,
  `${RC001.thresholds.filter((t) => !t.settled).length} of ${RC001.thresholds.length} unsettled, all with questions`,
);
rec(
  "and every ambiguity names where in the document it lives",
  RC001_AMBIGUITIES.every((a) => a.at && a.question),
  `${RC001_AMBIGUITIES.length} questions for the engineer`,
);
rec(
  "every enforced rule names where the document states it",
  RC001_ENFORCED.every((r) => r.at && r.rule) &&
    new Set(RC001_ENFORCED.map((r) => r.key)).size === RC001_ENFORCED.length,
  `${RC001_ENFORCED.length} rules`,
);

/* --------------------------- 2. the firm name against the board's register */

/*
 * RULING 3, 2026-09-16. A protocol whose document names the firm in a name the
 * board's register does not hold is FLAGGED, so a future protocol cannot arrive
 * with the same defect unnoticed.
 *
 * It asserts the RECORD rather than the absence. A check that simply failed
 * while the names differ would be a permanent red until reissuance, and the
 * operator ruled the document stands exactly as signed. So an unresolved
 * difference passes as long as it is written down with both names, and it FAILS
 * the moment the register moves and the protocol has not been reissued.
 */
{
  const registrant = verifiedFirmRegistrations.find((r) => r.status === "active")?.issuedTo ?? null;
  const matches = RC001.firmNameOnDocument === registrant;

  rec(
    "the protocol's firm name either matches the board's register or the difference is recorded",
    matches || RC001.naming.matchesBoardRegister === false,
    matches
      ? `both say "${registrant}"`
      : `document says "${RC001.firmNameOnDocument}", the board's register says "${registrant}", recorded as a known difference`,
  );
  rec(
    "and the record names both names, so nobody resolves it by editing one string",
    matches ||
      (RC001.naming.because.includes(RC001.firmNameOnDocument) &&
        RC001.naming.because.includes(RC001.naming.registrantWhenRecorded)),
    matches ? "no difference to record" : "the record names the document's name and the registrant",
  );

  /*
   * THE REISSUANCE TRIGGER, AND IT IS THE MECHANICAL HALF OF THE OPERATOR'S
   * "IN THE SAME SITTING". The record was written while the board held
   * 254 Services LLC. If the register now holds a DIFFERENT name, TBPELS has
   * reissued and 254-RC-001 owes its v1.1. Staying at v1.0 is then a stale
   * record rather than a known difference, and this goes red naming what is
   * owed.
   */
  const registerMoved = registrant !== null && registrant !== RC001.naming.registrantWhenRecorded;

  /*
   * =====================================================================
   * THIS CHECK PASSED FOR THE WRONG REASON ON 2026-09-21, AND IT WAS
   * FOUND BY READING IT RATHER THAN BY A RED.
   * =====================================================================
   *
   * It asserted `!registerMoved || RC001.version !== "1.0"`, using the version
   * STRING as a proxy for "has been reissued with the corrected name". The
   * register moved that day, and the check passed, because RC001 was already
   * at v1.1.
   *
   * **But v1.1 was issued on 2026-09-18 for retention wording, and it names
   * 254 Engineering Services on every page exactly as v1.0 did.** Nothing
   * about the name was corrected. The proxy broke the moment a version shipped
   * for any other reason, and from then on this check could never fail: the
   * version can only go up.
   *
   * That is the vacuous green in its quietest form. No empty set, no wrong
   * file, no cap. A real comparison against a value that had stopped meaning
   * what the check needed it to mean.
   *
   * WHAT ACTUALLY RESOLVED IT IS NOT A REISSUE AT ALL. Operator ruling,
   * 2026-09-21: TBPELS reissued F-29811 to 254 Engineering LLC AND recorded
   * 254 Engineering Services as an assumed name on it. The name printed on the
   * signed document is now a name the Board holds, so the document stands and
   * no v1.2 is owed for the naming. That outcome did not exist when this check
   * was written, which is why the check could not express it.
   *
   * SO THE TRIGGER NOW ASKS THE QUESTION IT MEANT: when the register moves,
   * either the document's name is recorded as a DBA the Board holds, or the
   * protocol has been reissued naming the registrant. The version string is
   * not consulted, because it answers a different question.
   */
  const nameIsOnTheBoardsRecord =
    RC001.naming.matchesBoardDba === true || RC001.firmNameOnDocument === registrant;

  rec(
    registerMoved
      ? "the register has moved, so the document's name is either a DBA the board holds or the protocol was reissued"
      : "the register still holds the name this difference was recorded against",
    !registerMoved || nameIsOnTheBoardsRecord,
    registerMoved
      ? nameIsOnTheBoardsRecord
        ? `the board now holds "${registrant}" and records "${RC001.firmNameOnDocument}" as an assumed name on the registration, so the signed document names a name the board holds`
        : `the board now holds "${registrant}" and 254-RC-001 v${RC001.version} names "${RC001.firmNameOnDocument}", which the board holds neither as registrant nor as a DBA. Reissue with the corrected name.`
      : `recorded against "${RC001.naming.registrantWhenRecorded}", register holds "${registrant}"`,
  );

  /*
   * AND THE DBA CLAIM IS DATED, because "the board holds it as a DBA" is an
   * assertion about the Board's record and carries the same burden as every
   * other one here: it is true as of a read, by a person, on a date.
   */
  rec(
    "and a DBA resolution names the date the board's record was read",
    RC001.naming.matchesBoardDba !== true || /\d{4}-\d{2}-\d{2}/.test(RC001.naming.dbaRecordedOn ?? ""),
    RC001.naming.matchesBoardDba === true
      ? `recorded from the board's record on ${RC001.naming.dbaRecordedOn}`
      : "no DBA resolution claimed",
  );
}

/* ------------------------ 2a. the discipline gate, exercised as a rule */

/*
 * A SERVICE LINE IS OFFERABLE ONLY WHEN AN ACTIVE ENGINEER SEALS WHAT ITS
 * PROTOCOL REQUIRES. Operator ruling, 2026-09-16.
 *
 * EXERCISED ON CONSTRUCTED VALUES, not on the register as it happens to be.
 * Today there is one engineer and one protocol, and that protocol has not
 * declared its discipline, so every live case lands on the same branch. A check
 * that only looked at live data would prove one branch of four and be exercised
 * on the others for the first time the day somebody adds an engineer.
 */
{
  const { lineBlocks, linesAwaitingDiscipline } = await import("../src/lib/protocol-gate.ts");
  const { PROTOCOLS } = await import("../src/content/protocols/index.ts");
  const { services } = await import("../src/content/services.ts");
  const TODAY = "2026-09-16";

  const structural = { name: "A", sealsOnly: ["structural"], expires: "2028-01-31" };
  const lapsed = { name: "B", sealsOnly: ["structural"], expires: "2020-01-01" };
  const undated = { name: "C", sealsOnly: ["structural"], expires: null };
  const civilOnly = { name: "D", sealsOnly: ["civil"], expires: "2028-01-31" };
  const declared = [{ serviceSlug: "x", documentNumber: "TEST-1", requiresDiscipline: "structural" }];
  const undeclared = [{ serviceSlug: "x", documentNumber: "TEST-1", requiresDiscipline: null }];

  rec(
    "a line whose protocol declares a discipline an active engineer seals is offerable",
    lineBlocks(["x"], declared, [structural], TODAY).length === 0,
    "declared structural, engineer seals structural, licence current",
  );
  rec(
    "and a line with no protocol at all is blocked, saying so",
    lineBlocks(["y"], declared, [structural], TODAY)[0]?.because.includes("No protocol exists"),
    lineBlocks(["y"], declared, [structural], TODAY)[0]?.because ?? "not blocked",
  );
  rec(
    "and a protocol that has not declared its discipline blocks its line rather than being guessed at",
    lineBlocks(["x"], undeclared, [structural], TODAY)[0]?.because.includes("does not declare the discipline"),
    lineBlocks(["x"], undeclared, [structural], TODAY)[0]?.because ?? "not blocked",
  );
  rec(
    "and a discipline no engineer seals blocks the line",
    lineBlocks(["x"], declared, [civilOnly], TODAY)[0]?.because.includes("no engineer on record seals that"),
    lineBlocks(["x"], declared, [civilOnly], TODAY)[0]?.because ?? "not blocked",
  );
  rec(
    /*
     * "license", one word moved with the US spelling ruling of 2026-09-22.
     * The sentence lives in protocol-gate.ts and this pins it, which is the
     * section 6c shape: two edits made on purpose. This check went red naming
     * the sentence, which is it asking whether the change was meant.
     */
    "and an engineer who seals it but holds no current license blocks it, with a different sentence",
    lineBlocks(["x"], declared, [lapsed], TODAY)[0]?.because.includes("hold no current license") &&
      lineBlocks(["x"], declared, [undated], TODAY)[0]?.because.includes("hold no current license"),
    "a lapsed license and an unrecorded expiry both block, and neither reads as nobody seals it",
  );
  rec(
    "and one covering engineer among several is enough, so the rule survives a second engineer",
    lineBlocks(["x"], declared, [civilOnly, lapsed, structural], TODAY).length === 0,
    "four engineers, one of them covering and current",
  );

  /*
   * THE LIST FOR THE ENGINEER. Reported rather than asserted: every line
   * awaiting a discipline is a question for him, and the count is printed so
   * the report can carry it without anybody counting by hand.
   */
  const awaiting = linesAwaitingDiscipline(services.map((x) => x.slug), PROTOCOLS);
  rec(
    "every service line awaiting a declared discipline is named, so the list can go to the engineer",
    true,
    awaiting.length === 0
      ? "every line has a protocol declaring its discipline"
      : `${awaiting.length} of ${services.length} awaiting: ${awaiting.join(", ")}`,
  );
}

/* ------------------- 2b. the intake surface derives from the same document */

/*
 * THE ONE FIELD DEFINITION, AND THE PROTOCOL DERIVES INTO IT. A second list of
 * roof questions living in a form would be the two-homes defect this repository
 * has now ruled on four times in a fortnight, so these checks assert the
 * derivation rather than the existence of the fields.
 */
{
  const { fieldsFor } = await import("../data/intake-fields.ts");
  const { rc001RoutesToEngineer, rc001MissingUploads, rc001FlagFieldIds } = await import(
    "../data/protocol-fields.ts"
  );

  const fields = fieldsFor(RC001.serviceSlug, "standard");
  const ids = new Set(fields.map((f) => f.id));

  const missingQ = RC001.intakeQuestions.filter((q) => !ids.has(`rc001_q${q.number}`));
  rec(
    "every intake question the document asks reaches the one field definition",
    missingQ.length === 0 && fields.length > 0,
    missingQ.map((q) => `Q${q.number}`).join(", ") || `${fields.length} fields for ${RC001.serviceSlug}`,
  );

  const missingU = RC001.intakeUploads.filter((u) => !ids.has(`rc001_upload_${u.key}`));
  rec(
    "and every upload it requires",
    missingU.length === 0,
    missingU.map((u) => u.key).join(", ") || `${RC001.intakeUploads.length} uploads`,
  );

  /*
   * The other direction: a field carrying a protocol id that the document does
   * not account for is an invented question on a real form.
   */
  const accounted = new Set([
    ...RC001.intakeQuestions.map((q) => `rc001_q${q.number}`),
    ...RC001.intakeQuestions.filter((q) => q.flag).map((q) => `rc001_q${q.number}_detail`),
    ...RC001.intakeUploads.map((u) => `rc001_upload_${u.key}`),
  ]);
  const invented = [...ids].filter((id) => id.startsWith("rc001_") && !accounted.has(id));
  rec(
    "and no protocol field exists that the document does not account for",
    invented.length === 0,
    invented.join(", ") || `${accounted.size} accounted`,
  );

  rec(
    "the flag field ids are exactly the document's questions 8 to 12",
    JSON.stringify(rc001FlagFieldIds()) === JSON.stringify(["rc001_q8", "rc001_q9", "rc001_q10", "rc001_q11", "rc001_q12"]),
    rc001FlagFieldIds().join(", "),
  );

  /*
   * A yes on ANY flag routes, tested one at a time. Testing them together would
   * pass even if only one were wired, which is the fixture lesson: a check that
   * cannot separate the answers proves none of them.
   */
  const notRouting = RC001.intakeQuestions
    .filter((q) => q.flag)
    .filter((q) => !rc001RoutesToEngineer({ [`rc001_q${q.number}`]: "Yes" }).routes)
    .map((q) => `Q${q.number}`);
  rec(
    "a yes on any one flag question routes the job to the engineer before dispatch",
    notRouting.length === 0,
    notRouting.join(", ") || "all five route on their own",
  );
  rec(
    "and a job with no flags answered yes does not route",
    rc001RoutesToEngineer({ rc001_q8: "No", rc001_q9: "No", rc001_q10: "No", rc001_q11: "No", rc001_q12: "No" }).routes === false,
    "five noes do not route",
  );

  rec(
    "the required upload is missing until it is given",
    rc001MissingUploads({}).length === 1,
    rc001MissingUploads({}).join("; "),
  );
  rec(
    "and an adverse report becomes required once question 11 is yes, because the document says it must be uploaded",
    rc001MissingUploads({ "rc001_upload_front-of-property": "x", rc001_q11: "Yes" }).length === 1 &&
      rc001MissingUploads({ "rc001_upload_front-of-property": "x", rc001_q11: "No" }).length === 0,
    "required on yes, not required on no",
  );

  /*
   * Section 6 again: the purpose and the recipient are recorded exactly as
   * given. A select here would normalise the one fact the letter is addressed
   * for, which is the defect the rule exists to prevent.
   */
  const normalised = RC001.intakeQuestions
    .filter((q) => q.verbatim)
    .filter((q) => fields.find((f) => f.id === `rc001_q${q.number}`)?.kind === "select")
    .map((q) => `Q${q.number}`);
  rec(
    "the questions the document records verbatim are free text, never a dropdown",
    normalised.length === 0,
    normalised.join(", ") || "purpose and recipient are free text",
  );
}

/* ---------------------------- 3. both directions, against the document text */

const pdf = RC001.sourceFile;
rec("the signed document is in the repository", existsSync(pdf), pdf);

const pdftotext = spawnSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
if (pdftotext.error || pdftotext.status !== 0) {
  tell.push(
    "The DOCUMENT half did not run: pdftotext is not available here, so nothing compared this " +
      "declaration against the signed PDF. That is the half proving the portal neither invents nor " +
      "drops anything. Install poppler-utils and re-run before trusting the mapping.",
  );
} else {
  /*
   * Normalised for comparison only: the PDF's layout inserts line breaks and
   * runs of spaces inside sentences, so a raw includes() would fail on wording
   * that is present and correctly transcribed. Case and punctuation are kept.
   */
  const norm = (s) => s.replace(/\s+/g, " ").trim();

  /*
   * COMPARED WITH WHITESPACE REMOVED ENTIRELY, and the reason is an extraction
   * artifact rather than laziness.
   *
   * pdftotext breaks a line inside a hyphenated word and leaves a space behind:
   * the document's "close-up each occurrence" comes back as "close- up each
   * occurrence". Collapsing runs of spaces does not repair that, and a check
   * that failed on it would be reporting a defect in poppler as a defect in the
   * transcription.
   *
   * Removing whitespace keeps the comparison strict in the way that matters:
   * every character is still compared, in order, so a changed word, a dropped
   * clause or a reworded criterion still fails. What it stops caring about is
   * where the PDF happened to wrap.
   */
  const squash = (s) => s.replace(/\s+/g, "");
  const doc = squash(pdftotext.stdout);

  rec(
    "the extraction produced a document to read",
    doc.length > 10000,
    `${doc.length} characters (if this were small the checks below would pass over nothing)`,
  );

  /* ---- direction one: nothing in the declaration that is not in the document */
  const missingQuestions = RC001.intakeQuestions.filter((q) => !doc.includes(squash(q.ask)));
  rec(
    "every intake question in the declaration appears in the signed document, word for word",
    missingQuestions.length === 0,
    missingQuestions.map((q) => `Q${q.number}`).join(", ") || `${RC001.intakeQuestions.length} matched`,
  );

  const missingCriteria = [];
  for (const d of RC001.determinations) {
    for (const c of d.criteria) if (!doc.includes(squash(c))) missingCriteria.push(`${d.key}: ${c.slice(0, 40)}`);
  }
  rec(
    "every determination criterion appears in the signed document, word for word",
    missingCriteria.length === 0,
    missingCriteria.join(" | ") || `${RC001.determinations.reduce((n, d) => n + d.criteria.length, 0)} criteria matched`,
  );

  const missingProcedure = RC001.photoProcedure.filter((p) => !doc.includes(squash(p.text)));
  rec(
    "the photo procedure appears in the signed document, word for word",
    missingProcedure.length === 0,
    missingProcedure.map((p) => `step ${p.step}`).join(", ") || "all three steps matched",
  );

  /*
   * THE ENFORCED RULES, WORD FOR WORD, AND THIS CHECK DID NOT EXIST UNTIL
   * 2026-09-18. Found by injecting a falsified rule and watching the audit pass.
   *
   * Every other part of this declaration was compared against the PDF:
   * questions, criteria, photo procedure, thresholds, checklist items. The
   * ENFORCED rules were checked only for having a key and a place, which is a
   * check on shape and not on truth. So the one part of the registry the
   * platform is supposed to be unable to break was the one part that could say
   * anything at all.
   *
   * It matters more than the others rather than less. These are the sentences a
   * check derives from, so a transcription error here does not stay a
   * transcription error: it becomes a rule the platform enforces against copy,
   * with the document's authority and none of its words.
   */
  /*
   * A RULE ATTRIBUTED TO THE DOCUMENT IS HELD TO THE DOCUMENT'S WORDS. A rule
   * attributed to standing law is not, and says so in its own `at`.
   *
   * That distinction is not a loophole, it is the finding. One rule used to
   * read "the engineer issues a sealed letter. The platform stores it and never
   * composes one" with an `at` of "section 11; CLAUDE.md standing law", which
   * made it a quotation from neither source. The document says nothing about
   * what the platform composes, and CLAUDE.md says nothing about a pass
   * determination. Splitting them is what lets each be checked against the
   * thing it actually came from.
   */
  const fromDocument = RC001_ENFORCED.filter((r) => /section|Appendix/.test(r.at));
  const missingRules = fromDocument.filter((r) => !doc.includes(squash(r.rule)));
  rec(
    "every enforced rule attributed to the document appears in it, word for word",
    missingRules.length === 0,
    missingRules.map((r) => r.key).join(", ") || `${fromDocument.length} of ${RC001_ENFORCED.length} rules matched`,
  );
  /*
   * And the ones that are NOT from the document are few and named.
   *
   * AN EXEMPTION THAT NOBODY COUNTS BECOMES THE RULE. Operator ruling,
   * 2026-09-18. A verbatim check with an unbounded escape hatch is a verbatim
   * check in name only: every rule that failed it would acquire an `at` naming
   * standing law, one at a time, each change reasonable on its own, until the
   * check covered nothing. Counting them is what keeps the exemption an
   * exception.
   */
  const notFromDocument = RC001_ENFORCED.filter((r) => !/section|Appendix/.test(r.at));
  rec(
    "and the rules that do not come from the document are named and countable",
    notFromDocument.length <= 2,
    notFromDocument.map((r) => `${r.key} (${r.at})`).join("; ") || "all rules are quotations",
  );

  const missingThresholds = RC001.thresholds.filter((t) => !doc.includes(squash(t.states)));
  rec(
    "every threshold is quoted from the document rather than computed",
    missingThresholds.length === 0,
    missingThresholds.map((t) => t.key).join(", ") || `${RC001.thresholds.length} matched`,
  );

  rec(
    "the document number, version and issue date are the document's own",
    doc.includes(RC001.documentNumber) && doc.includes(squash("Version 1.0")) && doc.includes(squash("September 14, 2026")),
    `${RC001.documentNumber}, v${RC001.version}, ${RC001.issueDate}`,
  );

  /* ---- direction two: nothing in the document the declaration silently drops */

  /*
   * The document's Appendix B lines are its own "[ ]" checkboxes. Counting them
   * out of the document and comparing to the declaration is what catches a
   * DROPPED item, which is the defect no screen can show.
   */
  const raw = pdftotext.stdout;
  const appendixB = raw.slice(raw.indexOf("Appendix B."), raw.indexOf("Appendix C."));
  const boxes = [...appendixB.matchAll(/\[\s?\]\s*([^\n]+)/g)].map((m) => norm(m[1]));
  const boxesWithoutPhotoTag = boxes.map((b) => squash(b.replace(/\[PHOTO\]\s*$/, "")));

  rec(
    "the document's own Appendix B checkboxes were found, so this direction reads something",
    boxes.length > 30,
    `${boxes.length} checkbox lines in the document`,
  );

  /*
   * A dropped item is a checkbox line in the document that no declared item
   * accounts for. Matched on a distinctive leading fragment rather than the
   * whole line, because the declaration strips the document's own "[PHOTO]"
   * marker and its punctuation varies.
   */
  const declaredLabels = RC001.checklist.map((i) => squash(i.label).toLowerCase());
  const unaccounted = boxesWithoutPhotoTag.filter((line) => {
    const head = line.toLowerCase().slice(0, 24);
    return !declaredLabels.some((l) => l.slice(0, 24) === head || l.includes(head) || head.includes(l.slice(0, 24)));
  });
  rec(
    "no checkbox line in the document is missing from the declaration",
    unaccounted.length === 0,
    unaccounted.slice(0, 4).join(" | ") || `${boxes.length} document lines all accounted for`,
  );

  /*
   * =====================================================================
   * AND THE WHOLE LABEL, NOT ITS FIRST 24 CHARACTERS. Found 2026-09-20 by
   * the v1.1 transcription, and the check above is why it had to be found
   * rather than reported.
   * =====================================================================
   *
   * The check above matches a checkbox line to a declared item on a leading
   * fragment, for a good reason: the declaration strips the document's own
   * "[PHOTO]" marker and the punctuation varies. **What it therefore asks is
   * whether an item is PRESENT, and nothing at all about whether it is
   * QUOTED.**
   *
   * v1.1 changed the seal-bond item from "gentle tab lift at 3-4 spots on
   * different planes" to "gentle tab lift at 4 locations spread across
   * different planes". The first 24 characters, "shingle roofs -- seal-bo",
   * are identical in both. **The audit read v1.1, compared it against a v1.0
   * transcription, and passed 44 of 44.** Twenty-one labels could each diverge
   * after their twenty-fourth character and nothing would have said so.
   *
   * It is the RC001_ENFORCED lesson in a second place: a declaration verified
   * for SHAPE while the CONTENT, which is what a checklist hands a technician
   * on a roof, was compared to nothing. It is also a matcher with a window
   * narrower than the thing it matches, which is the same family from the
   * other end.
   *
   * So the label is compared WHOLE, against the document's own line with its
   * "[PHOTO]" marker and check box removed and whitespace squashed, which are
   * extraction artifacts rather than the document's words.
   */
  /*
   * SCOPED TO THE ITEMS THAT ARE CHECKBOX LINES, which is exactly where the
   * hole was. The declaration also carries form fields, "job no", "property
   * address", "technician name", which are not checkbox lines in the document
   * and are covered by their own checks. Requiring those to match a checkbox
   * line would be inventing a rule rather than closing a gap, and the first
   * version of this check did exactly that and named three of them.
   *
   * The pairing uses the SAME leading fragment the check above uses, so the two
   * agree about which document line an item is; what this adds is that once
   * they are paired, the WHOLE line must match.
   */
  /*
   * COMPARED THE WAY THE OTHER FOUR ARE: against the whole document with all
   * whitespace squashed out, rather than against one extracted line.
   *
   * The first attempt compared a label to the checkbox LINE and failed on
   * every long item, because `pdftotext -layout` wraps a long line and the
   * continuation lands on the next one. That is an extraction artifact, the
   * same class as the hyphen-break this file already documents, and repairing
   * it by squashing whitespace is what the intake, criteria, procedure and
   * enforced-rule comparisons all already do. Every character is still
   * compared, in order.
   */
  const notVerbatim = RC001.checklist
    .filter((item) => !doc.includes(squash(item.label)))
    .map((item) => `${item.key}: "${squash(item.label).slice(0, 60)}"`);
  rec(
    `every checklist label appears in the signed document, word for word (${RC001.checklist.length} items)`,
    RC001.checklist.length > 15 && notVerbatim.length === 0,
    notVerbatim.length === 0
      ? `${RC001.checklist.length} labels compared whole rather than on their first 24 characters`
      : `NOT WHAT THE DOCUMENT SAYS: ${notVerbatim.slice(0, 3).join(" | ")}`,
  );

  /*
   * And the same question asked the other way for the counts and the
   * temperature, because those are the captures the document is most explicit
   * about and the easiest to render as a note rather than a value.
   */
  rec(
    "the seal-bond ambient temperature is a capture on its item rather than a loose note",
    RC001.checklist.find((i) => i.key === "shingle-seal-bond")?.capture?.kind === "temperature" &&
      doc.includes(squash("Ambient temperature during seal-bond check")),
    "section 8 says the result is not meaningful without it",
  );
}

/* ------ 5. no rendered sentence promises what the protocol excludes */

/*
 * ===========================================================================
 * THE DELIVERABLE MAY NOT BE DESCRIBED IN TERMS ITS PROTOCOL EXCLUDES.
 * Operator ruling, 2026-09-18.
 * ===========================================================================
 *
 * WHY IT EXISTS. services.ts said in six places that a roof certification
 * states remaining service life, including in the deliverable itself and in a
 * named buyer segment. 254-RC-001 section 11, signed by the engineer of record
 * on 09/14/2026, says the letter states observed condition only and does not
 * estimate remaining service life. The two disagreed for three days and nothing
 * on the board could see it, because no check compared what the site PROMISES
 * against what the governing protocol PERMITS.
 *
 * DERIVED, NOT A HAND LIST, which is the operator's requirement and the only
 * version worth having. The excluded phrases are extracted from the protocol's
 * own exclusion sentence, which is itself checked word for word against the
 * signed PDF above. So the chain is: the engineer's signature, the PDF, the
 * verbatim check, this extraction, the copy. A hand list would break that chain
 * at its first link and would go stale the day a protocol is reissued.
 *
 * THE EXTRACTION, AND ITS LIMIT STATED PLAINLY. The sentence has the shape
 * "It does not X, Y, or Z", so the clause after "does not" is split on commas
 * and "or", and the leading verb is dropped to leave the thing itself:
 * "estimate remaining service life" becomes "remaining service life". That is
 * mechanical rather than clever, and it will not catch a promise phrased in
 * words the protocol does not use. It catches the promise phrased in the
 * protocol's OWN words, which is what the six sentences did.
 */
{
  const { readSource } = await import("./lib/read-source.mjs");

  /*
   * Rules that state what the DELIVERABLE does not do, which is narrower than
   * rules containing "does not".
   *
   * The first version matched the latter and produced four junk phrases out of
   * seven, from rules where "does not" means something else entirely: "An item
   * that does not apply to the property is marked with the reason it does not
   * apply" yielded "to the property is marked with the reason it". A junk
   * phrase in a forbidden list is not harmless noise, it is a false positive
   * waiting for the day some page legitimately uses those words, and a check
   * that cries wolf is one somebody switches off.
   */
  const exclusions = RC001_ENFORCED.filter(
    (r) => /\bdoes not\b/.test(r.rule) && /\bthe letter\b/i.test(r.rule),
  );

  const forbidden = [];
  for (const rule of exclusions) {
    const after = rule.rule.split(/\bdoes not\b/)[1] ?? "";
    for (const raw of after.split(/,| or /)) {
      const clause = raw.replace(/[.]/g, "").trim();
      if (clause.length < 8) continue;
      /* Drop the leading verb to leave the thing itself. */
      const phrase = clause.split(/\s+/).slice(1).join(" ").trim();
      if (phrase.length >= 8) forbidden.push({ phrase, from: rule.key });
    }
  }

  rec(
    "the protocol's exclusions yield phrases to check the copy against",
    forbidden.length > 0,
    forbidden.map((f) => `"${f.phrase}"`).join(", ") || "no exclusion rule found, so this check is measuring nothing",
  );

  /*
   * The copy for the line this protocol governs. One file today, named rather
   * than globbed, because a glob that matched nothing would pass silently and
   * that is the failure this whole audit exists to prevent.
   */
  const copy = readSource("src/content/services.ts").toLowerCase();
  const promised = forbidden.filter((f) => copy.includes(f.phrase.toLowerCase()));

  rec(
    `no rendered sentence describes the deliverable in terms ${RC001.documentNumber} excludes`,
    promised.length === 0,
    promised.length
      ? promised.map((p) => `"${p.phrase}" (excluded by ${p.from})`).join("; ") +
          ". The signed protocol says the letter does not do this. A page that promises it is promising something the engineer will not seal."
      : `${forbidden.length} excluded phrase(s) checked against the service copy`,
  );
}

/*
 * ===========================================================================
 * 5. THE MIGRATION THAT CARRIES THIS DOCUMENT TO A DATABASE NAMES THE SAME
 *    DOCUMENT. Operator ruling, 2026-09-21.
 * ===========================================================================
 *
 * WHY THIS CHECK IS OWED THE MOMENT A MIGRATION EXISTS AT ALL.
 * `seed-roof-protocol.mjs` hashes the PDF before it writes anything, and that
 * protection lives in the GENERATOR. Once the SQL is on disk the digest is a
 * literal like any other and **nothing in the migration re-derives it**.
 * Postgres cannot hash a PDF, so the check has to come from this side.
 *
 * THE SUBJECT IS DERIVED RATHER THAN NAMED. Scanning every migration for one
 * that inserts this document number answers a question a hardcoded path
 * cannot: whether there is a SECOND migration writing the same row. A path
 * typed here would also be a second home for a fact the generator already
 * holds, which is this repository's most frequent defect.
 *
 * AND IT COMPARES THREE VALUES, NOT TWO. The registry, the file on disk, and
 * the migration. Comparing the migration only to the registry would pass on a
 * day when both had drifted off the actual PDF, which is precisely the state
 * the generator's own refusal exists to catch.
 */

/**
 * Split a SQL value list on its top level commas.
 *
 * A NAIVE split(",") IS WRONG HERE AND WOULD HAVE BEEN WRONG QUIETLY. The row
 * this migration writes carries a summary reading
 * "254-RC-001 v1.1, signed 2026-09-18 by Aman Dhakal, P.E., Engineer of
 * Record.", which holds four commas inside one quoted literal. Splitting on
 * every comma yields more values than there are columns, the status would land
 * at the wrong index, and the check would report a status of "signed 2026-09-18
 * by Aman Dhakal" rather than saying it could not line them up.
 *
 * Quotes are doubled rather than escaped in the SQL this generator writes, and
 * a doubled quote inside a string reads as a close followed by an open, which
 * leaves the parity correct without a special case.
 */
function splitSqlValues(text) {
  const values = [];
  let current = "";
  let inString = false;
  for (const ch of text) {
    if (ch === "'") inString = !inString;
    if (ch === "," && !inString) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) values.push(current.trim());
  return values;
}

const migrationDir = "supabase/migrations";
const carriers = readdirSync(migrationDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({ file: f, text: readFileSync(`${migrationDir}/${f}`, "utf8") }))
  .filter((m) => m.text.includes("insert into eng_protocol_templates") && m.text.includes(RC001.documentNumber));

rec(
  `exactly one migration inserts ${RC001.documentNumber} into eng_protocol_templates`,
  carriers.length === 1,
  carriers.map((c) => c.file).join(", ") ||
    "no migration carries this document, so every check below this line is measuring nothing",
);

if (carriers.length === 1) {
  const carrier = carriers[0];

  /*
   * Every 64 character hexadecimal literal in the file, deduplicated. A sha256
   * is the only thing of that shape this migration has any reason to contain,
   * and taking the SET rather than the first occurrence is what makes a file
   * that names two different digests fail rather than pass on whichever one
   * happened to be written first.
   */
  const digests = [...new Set(carrier.text.match(/[0-9a-f]{64}/g) ?? [])];

  rec(
    `${carrier.file} states exactly one document digest`,
    digests.length === 1,
    digests.length === 0
      ? "none found, so the comparisons below would have nothing to compare"
      : digests.join(", "),
  );

  if (digests.length === 1) {
    const inMigration = digests[0];

    rec(
      "and it is the digest the registry declares",
      inMigration === RC001.sourceSha256,
      inMigration === RC001.sourceSha256
        ? inMigration
        : `migration ${inMigration} against registry ${RC001.sourceSha256}`,
    );

    /*
     * THE THIRD VALUE, AND IT IS THE ONE NEITHER DECLARATION CAN SUPPLY.
     * Hashed here rather than trusted, because the whole point of the digest
     * is to bind the record to a specific file, and a record that agrees with
     * a declaration about a file nobody read is two declarations agreeing.
     */
    if (!existsSync(RC001.sourceFile)) {
      tell.push(
        `${RC001.sourceFile} is not on disk, so the migration's digest could not be compared against ` +
          "the document itself. It was compared against the registry only, which is two declarations agreeing.",
      );
    } else {
      const onDisk = createHash("sha256").update(readFileSync(RC001.sourceFile)).digest("hex");
      rec(
        "and it is the digest of the PDF on disk, hashed here rather than declared",
        inMigration === onDisk,
        inMigration === onDisk ? onDisk : `migration ${inMigration} against file ${onDisk}`,
      );
    }
  }

  /*
   * THE STATE THE ROW LANDS IN, because a migration that seeded 'published'
   * would be the platform claiming an approval the engineer never gave, and
   * that is the one thing this whole protocol chain exists to make impossible.
   * 0049 refuses it at the database; this refuses it in review, which is
   * earlier and names the file.
   *
   * READ THE COLUMN LIST, NOT THE FILE. The first version of this check asked
   * whether the word "approved_by" appears anywhere in the migration, which
   * would have gone red the day somebody EXPLAINED in a comment why the column
   * is absent. That is a check on wording, which this repository has recorded
   * as its own defect class. The thing meant is the insert's column list.
   */
  const insertMatch = carrier.text.match(/insert into eng_protocol_templates\s*\(([^)]*)\)/);
  const insertColumns = (insertMatch?.[1] ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  rec(
    `the insert in ${carrier.file} was found and names its columns`,
    insertColumns.length > 0,
    insertColumns.length > 0
      ? `${insertColumns.length} columns`
      : "the insert could not be parsed, so the approval check below would pass over nothing",
  );

  const approvalColumns = ["approved_by", "approved_at", "approved_by_license", "published_at"];
  const claimed = approvalColumns.filter((c) => insertColumns.includes(c));

  rec(
    `${carrier.file} seeds the row awaiting its engineer and claims no approval`,
    insertColumns.length > 0 && insertColumns.includes("status") && claimed.length === 0,
    claimed.length > 0
      ? `${claimed.join(", ")} written by a migration. An approval is the engineer's act in his own session.`
      : "no approver, approval time, licence or publication date is written",
  );

  /*
   * And the value that column carries. 0049 refuses a published row with no
   * approver at the DATABASE; this refuses it in review, which is earlier and
   * names the file somebody would have to edit.
   */
  const statusIndex = insertColumns.indexOf("status");
  const selectMatch = carrier.text.match(/\)\s*select\s+([^;]*?)\s*where not exists/);
  const selectValues = splitSqlValues(selectMatch?.[1] ?? "");
  const linedUp = selectValues.length === insertColumns.length;

  rec(
    `and the status it actually writes is awaiting_engineer`,
    statusIndex >= 0 && linedUp && selectValues[statusIndex] === "'awaiting_engineer'",
    linedUp
      ? String(selectValues[statusIndex])
      : `${insertColumns.length} columns against ${selectValues.length} values, so nothing lines up`,
  );

  /*
   * =====================================================================
   * THE SIGNED DATE IS THE APPROVAL PAGE'S, AND THE MIGRATION MUST AGREE.
   * Operator ruling, 2026-09-21.
   * =====================================================================
   *
   * WHY IT NEEDED ITS OWN CHECK RATHER THAN TRUST IN THE GENERATOR. The
   * generator derives this value from `RC001_SIGNATURE_EVIDENCE`, and the
   * moment the SQL is written that derivation is gone: the file holds a date
   * literal and nothing re-derives it, exactly as with the digest. A hand
   * edit, or a regeneration from an older script, would put the ISSUE date
   * back in and every other check here would still pass.
   *
   * AND THE TWO DATES ARE TWO DAYS APART, WHICH IS WHAT MAKES THIS FINDABLE
   * AT ALL. v1.1 was issued 2026-09-18 and signed 2026-09-20. Both are real
   * dates about the same document, both appear in this migration, and the
   * column means one of them. A check comparing `document_signed_at` against
   * "a date the registry holds" would pass on either, so it compares against
   * the approval page date SPECIFICALLY and asserts the two differ, because
   * the day somebody makes them equal this check silently stops discriminating.
   */
  const signedIndex = insertColumns.indexOf("document_signed_at");
  const issueIndex = insertColumns.indexOf("issue_date");

  rec(
    "the migration writes a signed date and an issue date, and they are different columns",
    signedIndex >= 0 && issueIndex >= 0 && linedUp,
    signedIndex >= 0 && issueIndex >= 0
      ? `document_signed_at at ${signedIndex}, issue_date at ${issueIndex}`
      : "one of the two columns is not written, so the comparison below has nothing to separate",
  );

  if (signedIndex >= 0 && issueIndex >= 0 && linedUp) {
    const signedInSql = String(selectValues[signedIndex]).replace(/'/g, "");
    const issueInSql = String(selectValues[issueIndex]).replace(/'/g, "");

    rec(
      "and the signed date is the approval page's, read from the signature evidence",
      signedInSql === RC001_SIGNATURE_EVIDENCE.approvalPageDate,
      signedInSql === RC001_SIGNATURE_EVIDENCE.approvalPageDate
        ? `${signedInSql}, which is the date beside the handwritten mark`
        : `migration ${signedInSql} against approval page ${RC001_SIGNATURE_EVIDENCE.approvalPageDate}`,
    );

    /*
     * THE DISCRIMINATING HALF. If the issue date and the approval page date
     * were ever the same value, the check above would pass whichever one the
     * migration wrote, and would go on printing a green line about a
     * distinction it could no longer make.
     */
    rec(
      "and that date is not simply the issue date, so the check above can tell them apart",
      RC001_SIGNATURE_EVIDENCE.approvalPageDate !== RC001.issueDate && signedInSql !== issueInSql,
      RC001_SIGNATURE_EVIDENCE.approvalPageDate === RC001.issueDate
        ? "the registry now holds one date for both, so this comparison has stopped discriminating"
        : `issued ${issueInSql}, signed ${signedInSql}`,
    );
  }
}

/*
 * ===========================================================================
 * 6. THE MIGRATION THAT WRITES THE DISCIPLINE WRITES THE REGISTRY'S VALUE.
 * Operator ruling, 2026-09-21.
 * ===========================================================================
 *
 * SAME SHAPE AS THE DIGEST CHECK ABOVE, AND FOR THE SAME REASON. The generator
 * reads `RC001.requiresDiscipline`; once the SQL is on disk that derivation is
 * gone and the file holds a bare string literal. Nothing in Postgres can know
 * which discipline the engineer named.
 *
 * WHAT MAKES THIS ONE WORTH A CHECK RATHER THAN TRUST. The value is a
 * LICENSEE'S JUDGEMENT about what competence a sealed deliverable requires,
 * and `protocol-gate.ts` filters engineers by it. A wrong value here does not
 * fail loudly: it either blocks a line the firm could serve, or clears the
 * discipline block for an engineer who never said he seals that work. The
 * second is the one that matters, and it would look exactly like this check
 * passing.
 *
 * THE SUBJECT IS DERIVED, not named, for the reason the digest check gives: a
 * hardcoded path is a second home, and scanning finds a SECOND migration
 * writing the same column, which a path could not.
 */
{
  const disciplineCarriers = readdirSync(migrationDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ file: f, text: readFileSync(`${migrationDir}/${f}`, "utf8") }))
    .filter((m) => /update\s+eng_protocol_templates[\s\S]{0,200}?set\s+requires_discipline/i.test(m.text));

  if (RC001.requiresDiscipline === null) {
    rec(
      "no migration writes a discipline, because the registry declares none",
      disciplineCarriers.length === 0,
      disciplineCarriers.map((c) => c.file).join(", ") ||
        "the engineer has not stated it and nothing is writing one on his behalf",
    );
  } else {
    rec(
      "exactly one migration sets requires_discipline",
      disciplineCarriers.length === 1,
      disciplineCarriers.map((c) => c.file).join(", ") ||
        "the registry declares a discipline and no migration carries it to a database",
    );

    if (disciplineCarriers.length === 1) {
      const carrier = disciplineCarriers[0];
      const setMatch = carrier.text.match(/set\s+requires_discipline\s*=\s*'([^']*)'/i);

      rec(
        `${carrier.file} sets the discipline to a literal this check can read`,
        Boolean(setMatch),
        setMatch ? `'${setMatch[1]}'` : "the UPDATE could not be parsed, so the comparison below would pass over nothing",
      );

      rec(
        "and that literal is the discipline the registry declares",
        setMatch?.[1] === RC001.requiresDiscipline,
        setMatch?.[1] === RC001.requiresDiscipline
          ? `${RC001.requiresDiscipline}, read from the registry rather than typed`
          : `migration '${setMatch?.[1]}' against registry '${RC001.requiresDiscipline}'`,
      );

      /*
       * AND AN ENGINEER ON RECORD ACTUALLY SEALS IT. A discipline nobody seals
       * is not wrong, it is a line that stays shut, and that is a legitimate
       * state. What would be wrong is this repository carrying a discipline it
       * cannot trace to a licensee's own declaration, so the check reports
       * WHICH engineers cover it rather than asserting somebody must.
       */
      const { verifiedEngineers } = await import("../src/config/credentials.ts");
      const sealers = verifiedEngineers.filter((e) => e.sealsOnly.includes(RC001.requiresDiscipline));
      rec(
        "and the discipline is one an engineer on record declares he seals",
        sealers.length > 0,
        sealers.map((e) => `${e.name} seals ${e.sealsOnly.join("/")}`).join("; ") ||
          `no engineer on record declares ${RC001.requiresDiscipline}, so this line stays shut on the discipline block`,
      );
    }
  }
}

/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
for (const t of tell) console.log(`  COULD NOT TELL: ${t}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks.${tell.length ? " The document half did not run; see above." : ""}`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The document is the authority. A portal that drops one of its items drops it silently.");
  process.exitCode = 1;
}
