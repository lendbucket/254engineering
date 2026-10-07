/**
 * NO PROTOCOL SENTENCE REACHES THE ORDER FORM, AND EVERY FACT IS ASKED ONCE.
 *
 * Order flow v2, from docs/order-flow-v2-findings.md: "it needs a check that
 * fails if protocol text reaches a public page, which is the mechanism rather
 * than the intention." Read from fieldsFor(), the one function every order
 * door asks, for every line that has a protocol in force:
 *
 *   1. no label or help on the form IS a question the signed document asks,
 *      word for word, and none carries a note to staff ("record exactly",
 *      "likely decline", "route to engineer", the literal "--");
 *   2. every question the document asks is covered: by a field, or declared as
 *      asked by the order's own step;
 *   3. no customer field the protocol supersedes is still on the form, so the
 *      same fact is not asked twice;
 *   4. every protocol question has phrasing, so no fallback to the document's
 *      own words is reaching the page.
 */
const { fieldsFor } = await import("../../data/intake-fields.ts");
const { PROTOCOL_ENTRIES } = await import("../../src/content/protocols/index.ts");
const { PROTOCOL_PHRASING } = await import("../../data/protocol-phrasing.ts");
const { deliverablesFor } = await import("../../data/catalog.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const sq = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const STAFF_NOTES = [/record exactly/i, /likely decline/i, /route to engineer/i, /\s--\s/, /pre-review/i, /must be disclosed and uploaded/i];

check("at least one protocol is in force, so the checks read something", PROTOCOL_ENTRIES.length > 0, `${PROTOCOL_ENTRIES.length}`);

for (const entry of PROTOCOL_ENTRIES) {
  const d = entry.declaration;
  const phrasing = PROTOCOL_PHRASING[d.documentNumber];
  check(`${d.documentNumber}: the protocol has customer phrasing`, Boolean(phrasing));
  if (!phrasing) continue;

  const unphrased = d.intakeQuestions.filter((q) => !phrasing.questions[q.number]).map((q) => `Q${q.number}`);
  const unphrasedUploads = d.intakeUploads.filter((u) => !phrasing.uploads[u.key]).map((u) => u.key);
  check(`${d.documentNumber}: every question and upload has customer phrasing`, unphrased.length + unphrasedUploads.length === 0, [...unphrased, ...unphrasedUploads].join(", "));

  for (const deliverable of deliverablesFor(d.serviceSlug)) {
    const fields = fieldsFor(d.serviceSlug, deliverable.tier);
    const where = `${d.documentNumber} on ${d.serviceSlug}/${deliverable.tier}`;

    const asks = d.intakeQuestions.map((q) => sq(q.ask));
    const leaked = fields.filter((f) => asks.includes(sq(f.label)) || asks.includes(sq(f.help)));
    check(`${where}: no field is worded as the signed document words it`, leaked.length === 0, leaked.map((f) => f.id).join(", ") || `${fields.length} fields read`);

    const notes = fields.filter((f) => STAFF_NOTES.some((re) => re.test(f.label) || re.test(f.help ?? "")));
    check(`${where}: and none carries a note meant for staff`, notes.length === 0, notes.map((f) => `${f.id}: ${f.label.slice(0, 40)}`).join(" | "));

    const ids = new Set(fields.map((f) => f.id));
    const uncovered = d.intakeQuestions.filter((q) => {
      const w = phrasing.questions[q.number];
      return !(w && "byOrder" in w) && !ids.has(`${entry.fieldPrefix}_q${q.number}`);
    });
    check(`${where}: every question the document asks is covered`, uncovered.length === 0, uncovered.map((q) => `Q${q.number}`).join(", ") || "each by a field or by the order's own step");

    const superseded = Object.values(phrasing.questions).flatMap((w) => ("supersedes" in w ? w.supersedes ?? [] : []));
    const twice = superseded.filter((id) => ids.has(id));
    check(`${where}: and no fact is asked twice`, twice.length === 0, twice.join(", ") || `${superseded.length} customer field(s) superseded`);

    const required = fields.filter((f) => f.required).length;
    console.log(`    ${where}: ${fields.length} fields, ${required} required`);
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: no protocol sentence reaches the order form, and every fact is asked once.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
