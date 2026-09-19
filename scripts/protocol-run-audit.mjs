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
const { checklistState } = await import("../src/lib/ops-evidence.ts");

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
