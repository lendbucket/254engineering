/**
 * CAN A JOB BE SUBMITTED INCOMPLETE?
 *
 *   npx tsx scripts/protocol-run-audit.mjs
 *
 * The process page tells customers: "Our technician cannot submit the job
 * incomplete. The app will not let him." This is the check that makes that
 * sentence true rather than aspirational, and it is the one assertion on that
 * page a customer could not verify for themselves.
 *
 * WHY IT IS ITS OWN AUDIT. protocol-registry-audit asks whether the declaration
 * matches the signed document. This asks whether the RULES the document states
 * are actually enforced when a job runs. Those are different questions and the
 * second is the one that decides whether a sealed letter rests on a complete
 * package.
 */
import "./lib/load-env.mjs";
import { readFileSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ WORKING A PROTOCOL ON A JOB ============");
console.log("");

const { itemsFor, protocolItemRows, protocolItemRowsFor } = await import("../src/lib/protocol-run.ts");
const { RC001 } = await import("../src/content/protocols/rc-001.ts");
const { RC001_CHECKLIST } = await import("../src/content/protocols/rc-001-checklist.ts");
const { RC001_DETERMINATIONS } = await import("../src/content/protocols/rc-001-decisions.ts");
const { checklistState } = await import("../src/lib/ops-evidence.ts");
const { DETERMINATION_ACTION, actionForDetermination, reliedOnVerdict } = await import("../src/lib/ops-review.ts");

/* ------------------------------------------------ 1. which items apply */

const all = itemsFor(null);
rec(
  "with no covering recorded, every item applies",
  all.length === RC001_CHECKLIST.length,
  `${all.length} of ${RC001_CHECKLIST.length}`,
);

/*
 * THE CONSERVATIVE DIRECTION, ASSERTED RATHER THAN ASSUMED. An unknown covering
 * must widen the list rather than narrow it. If this ever inverts, a job with no
 * covering recorded would present a SHORT checklist and read as complete, which
 * is the failure that matters here.
 */
const conditional = RC001_CHECKLIST.filter((i) => i.coveringOnly !== null);
rec(
  "and the conditional items are the ones a covering decides",
  conditional.length > 0,
  `${conditional.length} item(s) qualified by covering: ${[...new Set(conditional.map((i) => i.coveringOnly))].join(", ")}`,
);

if (conditional.length > 0) {
  const covering = conditional[0].coveringOnly;
  const forCovering = itemsFor(covering);
  const otherCoverings = conditional.filter((i) => i.coveringOnly !== covering);
  rec(
    `a ${covering} job drops the items printed for another covering`,
    forCovering.length === RC001_CHECKLIST.length - otherCoverings.length,
    `${forCovering.length} apply, ${otherCoverings.length} dropped`,
  );
  rec(
    "and an unknown covering is never shorter than a known one",
    all.length >= forCovering.length,
    `${all.length} unknown, ${forCovering.length} for ${covering}`,
  );
}

/* ------------- 1b. the bridge: the signed items as rows, round tripped */

/*
 * THE MAPPING IS WHERE DRIFT COULD STILL ENTER even though both ends are
 * correct, which is why it is a separate function with its own check rather
 * than inlined in a seeder. The operator's condition on approval seeding was
 * that the rows derive from the registry, so what a technician is dispatched
 * against is what the engineer signed rather than a re-typing of it. These
 * assert the round trip rather than trusting it.
 */
{
  const rows = protocolItemRows();

  rec(
    "every item in the signed protocol becomes exactly one row",
    rows.length === RC001_CHECKLIST.length,
    `${rows.length} rows from ${RC001_CHECKLIST.length} items`,
  );

  const rowKeys = rows.map((r) => r.item_key);
  const registryKeys = RC001_CHECKLIST.map((i) => i.key);
  /*
   * THE NOTE NAMES THE FIRST DISAGREEMENT rather than describing the lengths.
   * It said "keys and order match" beside its own FAIL when the injection
   * reversed the list, because it was computed from the two lengths and a
   * reordering does not change a length. A sentence that contradicts the verdict
   * beside it is the reassuring false negative this repository keeps finding.
   */
  const firstDrift = registryKeys.findIndex((k, i) => rowKeys[i] !== k);
  rec(
    "and every key survives the mapping, in document order",
    JSON.stringify(rowKeys) === JSON.stringify(registryKeys),
    firstDrift === -1 && rowKeys.length === registryKeys.length
      ? `${rowKeys.length} keys, same order`
      : `first disagreement at ${firstDrift}: expected ${registryKeys[firstDrift]}, got ${rowKeys[firstDrift] ?? "nothing"}`,
  );
  rec(
    "and no key is duplicated, which the unique index would refuse anyway",
    new Set(rowKeys).size === rowKeys.length,
    `${new Set(rowKeys).size} distinct`,
  );

  const labelMismatch = rows.filter(
    (r, i) => r.label !== RC001_CHECKLIST[i].label,
  );
  rec(
    "and every label is the document's line rather than a paraphrase",
    labelMismatch.length === 0,
    labelMismatch.map((r) => r.item_key).join(", ") || `${rows.length} labels carried through`,
  );

  /*
   * EVERY ITEM IS REQUIRED, AND THAT IS THE DOCUMENT'S POSITION. Section 7 says
   * no item is estimated, assumed or left blank, so an item a technician may
   * silently skip is the blank the protocol forbids. The honest way to finish a
   * job without an observation is an exception with a reason, not an optional
   * item.
   */
  rec(
    "every row is required, because an optional item is the blank section 7 forbids",
    rows.every((r) => r.required === true),
    `${rows.filter((r) => r.required).length} of ${rows.length}`,
  );

  const photoRows = rows.filter((r) => r.kind === "photo").length;
  const photoItems = RC001_CHECKLIST.filter((i) => i.photo).length;
  rec(
    "and an item the document marks for a photograph maps to a photo row",
    photoRows === photoItems,
    `${photoRows} photo rows, ${photoItems} marked in the document`,
  );

  const rulerRows = rows.filter((r) => (r.instructions ?? "").includes("Ruler in frame"));
  const rulerItems = RC001_CHECKLIST.filter((i) => i.ruler).length;
  rec(
    "and the ruler requirement reaches the technician rather than staying in the registry",
    rulerRows.length === rulerItems,
    `${rulerRows.length} of ${rulerItems} carry it`,
  );
}

/* ------ 1c. the second condition is structural: a caller cannot supply items */

/*
 * THE OPERATOR'S SECOND CONDITION WAS THAT THE ROWS DERIVE FROM THE REGISTRY,
 * and 0052 says plainly that it cannot enforce that: Postgres cannot know
 * 254-RC-001 has 51 items. What the database enforces is that the rows arrive
 * only through eng_approve_protocol. What makes the ROWS right is that nothing
 * can hand that function a checklist.
 *
 * So this is a SOURCE guard, and it is a stated PROXY rather than a proof. The
 * property that matters is "no checklist a person typed can reach the seeding",
 * which is not mechanically decidable. What is decidable is that the only
 * argument ever passed as p_items is the registry deriver's return value, and
 * that approveProtocol takes no items parameter for a caller to fill.
 *
 * It is the same shape as seo-audit's guard that contact.phone is read only
 * where the derivers live, and it is recorded as a proxy for the same reason.
 */
{
  const field = readFileSync("src/lib/ops-field.ts", "utf8");

  const rpcCalls = [...field.matchAll(/p_items:\s*([A-Za-z0-9_.()]+)/g)].map((m) => m[1]);
  rec(
    "the only thing ever passed as the seeded items is the registry deriver's answer",
    rpcCalls.length === 1 && rpcCalls[0] === "items",
    rpcCalls.join(", ") || "nothing passes p_items at all, so this check is measuring nothing",
  );
  rec(
    "and that value is read from the registry rather than from the request",
    /const items = protocolItemRowsFor\(documentNumber\);/.test(field),
    "protocolItemRowsFor(documentNumber)",
  );

  /*
   * AND THE DOOR TAKES NO ITEMS ARGUMENT, which is what stops the previous two
   * checks from being true today and false the first time somebody adds a
   * parameter "for the foundation protocol".
   */
  const signature = field.match(/export async function approveProtocol\(([\s\S]*?)\): Promise/);
  rec(
    "and approveProtocol takes no checklist for a caller to fill",
    Boolean(signature) && !/item/i.test(signature[1]),
    signature ? signature[1].replace(/\s+/g, " ").trim().slice(0, 90) : "approveProtocol was not found",
  );

  /*
   * THE FUNCTION IT REPLACED IS GONE RATHER THAN LEFT BESIDE IT. publishProtocol
   * had been unable to succeed since 0049 reached production, and a dead path
   * left in place is the second home this repository keeps finding.
   */
  rec(
    "and the path it replaced is gone rather than left beside it",
    !/export async function publishProtocol/.test(field),
    "publishProtocol set no approver and the database refused every call",
  );

  /*
   * A PROTOCOL THE REGISTRY DOES NOT HOLD DERIVES NOTHING, asserted on the rule
   * rather than on the one document that exists, so it stays true when a second
   * protocol is added.
   */
  rec(
    "a document number the registry does not hold derives no items at all",
    protocolItemRowsFor("254-XX-999") === null && protocolItemRowsFor(null) === null,
    "nothing is invented for a protocol this platform holds no signed document for",
  );
  rec(
    "while the one it does hold derives the whole signed checklist",
    protocolItemRowsFor(RC001.documentNumber)?.length === RC001_CHECKLIST.length,
    `${RC001.documentNumber}: ${protocolItemRowsFor(RC001.documentNumber)?.length ?? 0} items`,
  );
}

/* -- 1d. the read that feeds the gate, which is the half a pure check cannot see */

/*
 * A RULE TESTED WITH ITS INPUT HANDED TO IT SAYS NOTHING ABOUT THE READ THAT
 * FEEDS IT IN PRODUCTION. That is CLAUDE.md's standing law and it is the exact
 * shape of the hazard here, so it is asserted rather than trusted.
 *
 * `checklistState(items, captures, exceptions = [])` has a DEFAULT on its third
 * argument, which means a caller that never learned about exceptions compiles,
 * runs, and silently computes a gate that cannot see an absence. The technician
 * types why the roof could not be walked, the gate never hears it, and the
 * package stays blocked by a blocker naming an item that has been answered.
 *
 * There were TWO callers and both had to be taught: jobView on the server and
 * the Checklist component on the phone. The second was found by looking rather
 * than by anything failing, because nothing fails.
 *
 * WHAT THIS IS AND IS NOT. It is a source check and therefore a stated PROXY:
 * it proves every call site passes a third argument, not that the argument
 * holds the right rows. What would prove the whole chain is a live walk that
 * records an exception against a real file on development and watches the gate
 * open, and that is not built tonight. The gap is named here rather than
 * papered over.
 */
{
  const callers = [
    ["src/lib/ops-field.ts", "the server gate, which is what actually refuses a submission"],
    ["src/app/portal/(app)/jobs/[id]/CaptureClient.tsx", "the technician's phone, which is what disables the button"],
  ];

  for (const [path, why] of callers) {
    const body = readFileSync(path, "utf8");
    const calls = [...body.matchAll(/checklistState\(([\s\S]*?)\)\s*[,;)]/g)].map((m) => m[1]);
    const everyCallHasThree = calls.length > 0 && calls.every((args) => args.split(",").length >= 3);
    rec(
      `${path.split("/").pop()} passes the recorded absences to the gate`,
      everyCallHasThree,
      calls.length === 0 ? "it does not call checklistState at all, so this check is measuring nothing" : why,
    );
  }

  /*
   * AND THE READ EXISTS AT ALL. The check above would pass if jobView passed an
   * empty array it had invented, which is the one way to satisfy a shape check
   * while answering nothing.
   */
  const field = readFileSync("src/lib/ops-field.ts", "utf8");

  /*
   * SCOPED TO jobView'S OWN BODY, and the first version was not. It searched
   * the whole file for a read of eng_checklist_exceptions near a file_id, and
   * ops-field.ts has three: jobView's, recordException's upsert, and
   * withdrawException's delete. Deleting the READ entirely left the check green
   * on withdrawException's query, which is the matcher whose window reached
   * into its neighbour, recorded in CLAUDE.md, met again.
   *
   * The body is taken from the function's own declaration to the start of the
   * next top level declaration, so "near" is replaced by "inside".
   */
  const jobViewBody =
    field.split("export async function jobView(")[1]?.split("\n/**")[0] ?? "";
  rec(
    "and the rows it passes are read from the table, inside jobView itself",
    jobViewBody.length > 0 && /\.from\("eng_checklist_exceptions"\)/.test(jobViewBody),
    jobViewBody.length === 0
      ? "jobView was not found, so this check is measuring nothing"
      : "jobView selects the exceptions for this file",
  );
  rec(
    "and a job carries them out to the engineer as rows, not folded into a boolean",
    /exceptions: ExceptionRow\[\];/.test(field),
    "a photograph and a recorded absence are different facts at review",
  );
}

/* ---- 1e. Appendix C has five, and the database and the registry agree which */

/*
 * A CONSTRAINT THAT PARAPHRASES A SIGNED DOCUMENT IS THE DEFECT, AND IT WAS
 * LIVE UNTIL 2026-09-19.
 *
 * 0051's check constraint read 'pass', 'package_incomplete', 'repairs_required',
 * 'return_visit', 'decline'. The document heads them PASS, REVISE, REPAIRS
 * REQUIRED, SITE REVISIT, DECLINE. Two of the five had been reworded on their
 * way into SQL, so the engineer would have chosen REVISE and the row would have
 * said package_incomplete, and the mapping existed nowhere.
 *
 * It was found by reading the migration against the registry while building the
 * write path, which is section 2c's rule: a declaration is unverified until
 * somebody reads it against the code. Nothing could have caught it, because
 * both files were internally consistent and neither referred to the other.
 *
 * This is what refers them to each other. The migration's list is PARSED rather
 * than retyped, so the check cannot drift from the thing it checks, and the
 * expected side is the registry, which protocol-registry-audit verifies against
 * the PDF character by character.
 */
{
  const migration = readFileSync(
    "supabase/migrations/0051_a_job_carries_its_determination.sql",
    "utf8",
  );
  const clause = migration.match(/check \(determination in \(([^)]*)\)\)/);
  const inSql = clause
    ? clause[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")).filter(Boolean)
    : [];
  const inRegistry = RC001_DETERMINATIONS.map((d) => d.key);

  rec(
    "the migration's determination vocabulary was found at all",
    inSql.length > 0,
    inSql.length > 0 ? `${inSql.length} values parsed` : "the check constraint could not be parsed, so nothing below means anything",
  );
  rec(
    "Appendix C has five determinations and the database accepts exactly those five",
    inSql.length === inRegistry.length && inRegistry.every((k) => inSql.includes(k)),
    inSql.join(", "),
  );
  rec(
    "and it accepts nothing the document does not name",
    inSql.every((v) => inRegistry.includes(v)),
    inSql.filter((v) => !inRegistry.includes(v)).join(", ") || "no value the document does not name",
  );
}

/* ------- 1f. the determination: what the engineer concluded, and on what */

/*
 * THE DETERMINATION AND THE ACTION ARE TWO FACTS AND THE MAP BETWEEN THEM IS
 * DECLARED. Appendix C names five determinations; this platform has four review
 * actions; they overlap and they are not the same thing. A determination is the
 * professional judgement a board would ask about, an action is what the
 * software does to the file, and collapsing them would make the regulatory
 * record a workflow state.
 *
 * ONE OF THE FIVE MAPS TO NOTHING, AND THAT IS ASSERTED RATHER THAN TOLERATED
 * QUIETLY. REPAIRS REQUIRED withholds certification and issues a repair list,
 * and the revisit happens after the OWNER has had work done. The platform has
 * no status for a file waiting on an owner, and each of the four it has would
 * be a false statement about that file. 0049's rule applies: a status
 * vocabulary that lacks a word makes somebody choose the nearest lie, and the
 * answer is to add the word rather than overload the one nearby. Until the firm
 * rules on it, the determination is recorded and the file does not move.
 *
 * The check below fails the day somebody quietly maps it to revisions, which is
 * the edit this section exists to make visible.
 */
{
  const mapped = RC001_DETERMINATIONS.map((d) => [d.key, DETERMINATION_ACTION[d.key]]);

  rec(
    "every determination in Appendix C has an entry in the action map",
    mapped.every(([, a]) => a !== undefined),
    mapped.filter(([, a]) => a === undefined).map(([k]) => k).join(", ") || `${mapped.length} entries`,
  );
  rec(
    "and the map holds nothing the document does not name",
    Object.keys(DETERMINATION_ACTION).every((k) => RC001_DETERMINATIONS.some((d) => d.key === k)),
    Object.keys(DETERMINATION_ACTION).filter((k) => !RC001_DETERMINATIONS.some((d) => d.key === k)).join(", ") ||
      "no determination the document does not name",
  );

  const unmapped = mapped.filter(([, a]) => a === null).map(([k]) => k);
  rec(
    "repairs-required still maps to no action, because the firm owes a ruling on it",
    unmapped.length === 1 && unmapped[0] === "repairs-required",
    unmapped.length === 0
      ? "something now maps it, and the platform has no status for a file waiting on an owner"
      : `unmapped: ${unmapped.join(", ")}`,
  );

  const verdict = actionForDetermination("repairs-required");
  rec(
    "and asking for it refuses with the reason rather than picking the nearest lie",
    verdict.ok === false && verdict.reason.includes("no status"),
    verdict.ok ? "it returned an action" : verdict.reason.slice(0, 80),
  );
  const passes = actionForDetermination("pass");
  rec(
    "while a determination that does map answers with its action",
    passes.ok === true && passes.action === "seal",
    passes.ok ? passes.action : passes.reason,
  );

  /*
   * A DETERMINATION RESTS ON SOMETHING OF THIS FILE'S, and the database can
   * only check that the arrays are non-empty. That a cited item belongs to this
   * protocol, and a cited photograph to this file, is a question only the
   * application can ask, so it is asked and asserted here.
   */
  rec(
    "a determination citing another file's photograph is refused",
    reliedOnVerdict({
      itemKeys: ["a"],
      evidenceIds: ["from-another-file"],
      protocolItemKeys: ["a"],
      fileEvidenceIds: ["this-file"],
    }).ok === false,
    "a determination can only rest on evidence captured for this file",
  );
  rec(
    "and one citing an item that is not in this protocol is refused by name",
    (() => {
      const v = reliedOnVerdict({
        itemKeys: ["not-an-item"],
        evidenceIds: ["this-file"],
        protocolItemKeys: ["a"],
        fileEvidenceIds: ["this-file"],
      });
      return v.ok === false && v.reason.includes("not-an-item");
    })(),
    "the sentence names the item rather than saying the form is invalid",
  );
  rec(
    "and one that rests on nothing at all is refused, which 0051 also refuses",
    reliedOnVerdict({ itemKeys: [], evidenceIds: [], protocolItemKeys: ["a"], fileEvidenceIds: ["x"] }).ok === false,
    "an opinion with no record behind it",
  );
  rec(
    "while a determination resting on this file's own evidence is allowed",
    reliedOnVerdict({
      itemKeys: ["a"],
      evidenceIds: ["this-file"],
      protocolItemKeys: ["a", "b"],
      fileEvidenceIds: ["this-file", "other"],
    }).ok === true,
    "the rule refuses the wrong thing and not everything",
  );

  /*
   * AND THE WRITE PATH REQUIRES ONE WHEN A SIGNED PROTOCOL GOVERNS. A source
   * guard, stated as a proxy: what it proves is that decideReview refuses
   * rather than that a live review does.
   */
  const engineer = readFileSync("src/lib/ops-engineer.ts", "utf8");
  rec(
    "a review of a protocol-governed file refuses without a determination",
    /if \(governing && !determination\)/.test(engineer),
    "Appendix C: one determination is recorded per review",
  );
  rec(
    "and the action it records is derived from the determination rather than accepted beside it",
    /const implied = actionForDetermination\(determination\.determination\);/.test(engineer),
    "a determination of pass beside an action of decline is a record that should not exist",
  );
}

/* ----------- 2. the gate, which lives in ops-evidence and not in a second file */

/*
 * THE GATE IS checklistState AND THERE IS ONLY ONE OF IT.
 *
 * This audit briefly tested a second implementation in protocol-run.ts, written
 * two commits earlier by a session that had recorded one-fact-two-homes five
 * times that week. Both were correct and both agreed, which is why nothing
 * would have caught it: two right answers to one question is not a
 * contradiction anything can detect, until somebody changes one of them.
 *
 * So these exercise the REAL gate, the one /portal/jobs/[id] calls.
 */
const item = (key, required = true) => ({
  id: key,
  itemKey: key,
  kind: "note",
  label: key,
  required,
  instructions: null,
});
const capture = (key) => ({ itemKey: key, kind: "note", valueText: "seen" });

{
  const state = checklistState([item("a"), item("b")], []);
  rec(
    "a job with nothing captured cannot be submitted, and the blockers name the items",
    state.canSubmit === false && state.blockers.length === 2,
    state.blockers.join("; ").slice(0, 70),
  );
}

{
  const state = checklistState([item("a"), item("b")], [capture("a"), capture("b")]);
  rec(
    "a job with everything captured can be submitted",
    state.canSubmit === true,
    `${state.requiredDone} of ${state.requiredTotal}`,
  );
}

{
  const state = checklistState([item("a"), item("b")], [capture("a")]);
  rec(
    "one missing required item refuses the whole package",
    state.canSubmit === false && state.blockers.length === 1,
    state.blockers[0] ?? "no blocker named",
  );
}

/* ------------------- 3. an exception satisfies an item, and says it did */

/*
 * SECTION 7 OF THE SIGNED PROTOCOL: "the technician records each item that could
 * not be observed and the reason. No item is estimated, assumed, or left blank."
 *
 * Until 2026-09-19 an item was satisfied or it was not, so a roof that genuinely
 * could not be walked left a technician with nothing to record but a blank,
 * which is the one outcome the document rules out. The platform was quietly
 * asking for it.
 */
{
  const exception = {
    itemKey: "b",
    reason: "roof too steep to walk safely, inspected from ladder level",
    kind: "not_observed",
  };
  const state = checklistState([item("a"), item("b")], [capture("a")], [exception]);
  rec(
    "an item recorded as not observed, with a reason, satisfies the checklist",
    state.canSubmit === true,
    `${state.requiredDone} of ${state.requiredTotal}`,
  );
  const excepted = state.items.find((s) => s.item.itemKey === "b");
  /*
   * AND IT IS DISTINGUISHABLE FROM A PHOTOGRAPH, which is the half that
   * matters. Appendix C asks the engineer to weigh the package; an absence
   * recorded as an absence is a different input from an observation, and
   * folding them into one boolean would hide that from the person whose seal
   * goes on the letter.
   */
  rec(
    "and the engineer can tell it apart from a captured one",
    Boolean(excepted?.exception) && excepted?.exception?.reason === exception.reason,
    excepted?.exception ? `carries: ${excepted.exception.kind}` : "the exception is invisible",
  );
  const captured = state.items.find((s) => s.item.itemKey === "a");
  rec(
    "while a genuinely captured item carries no exception",
    captured?.satisfied === true && captured?.exception === undefined,
    "a photograph and a recorded absence are different facts",
  );
}


/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A job cannot be submitted incomplete, and an absence is recorded as one.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The process page tells customers the app will not let a technician submit an");
  console.log("incomplete job. If this is red, that sentence is not true.");
  process.exitCode = 1;
}
