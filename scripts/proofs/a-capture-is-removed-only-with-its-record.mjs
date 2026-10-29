/**
 * A CAPTURE IS REMOVED ONLY WHILE THE FILE IS IN THE FIELD, ONLY BY WHOEVER
 * MAY CAPTURE ON IT, AND ONLY AFTER ITS RECORD IS WRITTEN.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-capture-is-removed-only-with-its-record.mjs
 *
 * Robert's ruling, 10:52 Central 2026-10-29 (issue #1 comment 6501552714),
 * WF-030 step 5: "a delete button for a field capture while the file is in the
 * field. Add the audit row to deleteCapture first." Until this, deleteCapture
 * removed a piece of evidence the engineer would seal on and wrote nothing.
 *
 * The verdicts are exercised on captureDeleteRefusal, the one rule the job
 * screen and the server share. That deleteCapture asks it, then writes the
 * record through writeAuditOrRefuse and returns on its failure, all BEFORE the
 * delete, is asserted from the source by position, because the ordering is the
 * whole guarantee: a record written after the row goes is a record that can be
 * missing.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";

const { captureDeleteRefusal, CAPTURE_REMOVABLE_STATUSES } = await import("../../src/lib/ops-evidence.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ask = (over) =>
  captureDeleteRefusal({
    actorId: "tech-1",
    actorRole: "field_tech",
    mayCapture: true,
    assignedTechId: "tech-1",
    status: "evidence_in_progress",
    ...over,
  });

/* The rule. */
check("the technician who accepted the job may remove while evidence is in progress", ask({}) === null);
check("and while the engineer has sent it back for revisions", ask({ status: "revisions_requested" }) === null);
check(
  "the field statuses are exactly those two",
  CAPTURE_REMOVABLE_STATUSES.length === 2 &&
    CAPTURE_REMOVABLE_STATUSES.includes("evidence_in_progress") &&
    CAPTURE_REMOVABLE_STATUSES.includes("revisions_requested"),
  CAPTURE_REMOVABLE_STATUSES.join(", "),
);
for (const status of ["dispatched", "evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"]) {
  check(`a file ${status} is refused`, ask({ status }) !== null, ask({ status }) ?? "allowed");
}
check("a technician who only holds the offer is refused", ask({ assignedTechId: null }) !== null, ask({ assignedTechId: null }) ?? "allowed");
check("a technician on somebody else's job is refused", ask({ assignedTechId: "tech-2" }) !== null, ask({ assignedTechId: "tech-2" }) ?? "allowed");
check("a role that neither captures nor reviews evidence is refused", ask({ actorRole: "sales", mayCapture: false }) !== null);
check("and nobody signed in is refused", ask({ actorId: null }) !== null);

/* deleteCapture, read in order. */
const field = readSource("src/lib/ops-field.ts");
const start = field.indexOf("export async function deleteCapture(");
const end = start >= 0 ? field.indexOf("\nexport ", start + 10) : -1;
const body = start >= 0 ? field.slice(start, end > start ? end : undefined) : "";
const at = (s) => body.indexOf(s);
const rule = at("const refused = captureDeleteRefusal({");
const ruleReturn = at("if (refused) return { ok: false, error: refused };");
const repair = at("view.repairs.some((r) => r.verified_by_evidence_id === captureId)");
const record = at("const recorded = await writeAuditOrRefuse({");
const recordReturn = at("if (!recorded.ok) return { ok: false, error: recorded.error };");
const removal = at('.from("eng_evidence_items")');
const removalDelete = removal >= 0 ? body.indexOf(".delete()", removal) : -1;
check("deleteCapture is found, so the order below is read from it", start >= 0 && body.length > 0);
check(
  "the rule, then the repair check, then the record, each refusing on failure",
  rule > 0 && ruleReturn > rule && repair > ruleReturn && record > repair && recordReturn > record,
  `rule ${rule}, repair ${repair}, record ${record}, refuses at ${recordReturn}`,
);
check(
  "and all of it before the capture row is deleted",
  recordReturn > 0 && removal > recordReturn && removalDelete > removal,
  `record refuses at ${recordReturn}, delete at ${removal}`,
);
check("the record is capture.delete on the file", /action: "capture\.delete",/.test(body) && /entityType: "file",/.test(body));
check(
  "it names the capture, the item and the stored object it pointed at",
  /capture_id: capture\.id,/.test(body) && /item_key: capture\.item_key,/.test(body) && /storage_key: capture\.storage_key,/.test(body),
);
check(
  "a delete that removed no row says so in a second record and refuses",
  /action: "capture\.delete_failed"/.test(body) && /removed\.length === 0/.test(body),
);
check(
  "the field route passes the request context, so the record carries who asked from where",
  /deleteCapture\(actor, String\(body\?\.fileId \?\? ""\), String\(body\?\.captureId \?\? ""\), context\)/.test(
    readSource("src/app/api/portal/field/route.ts"),
  ),
);

/* No other door removes a capture. */
const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(name)) {
      const text = readSource(p.split("\\").join("/"));
      if (/\.from\("eng_evidence_items"\)\s*\.delete\(\)/.test(text) && !p.split("\\").join("/").endsWith("src/lib/ops-field.ts")) offenders.push(p);
    }
  }
};
walk("src");
const inField = (field.match(/\.from\("eng_evidence_items"\)\s*\.delete\(\)/g) ?? []).length;
check("no other source file deletes a capture", offenders.length === 0, offenders.join(", "));
check("and ops-field deletes one in exactly one place, deleteCapture", inField === 1 && removalDelete > 0, `${inField} found`);

/* The screen draws the control from the same rule, and only in the field. */
const page = readSource("src/app/portal/(app)/jobs/[id]/page.tsx");
const client = readSource("src/app/portal/(app)/jobs/[id]/CaptureClient.tsx");
check(
  "the job screen asks captureDeleteRefusal with the file's own status and technician",
  /captureDeleteRefusal\(\{/.test(page) &&
    /assignedTechId: view\.file\.assigned_tech_id,/.test(page) &&
    /status: view\.file\.status,/.test(page) &&
    /\}\) === null;/.test(page),
);
check("and hands the answer to the checklist", /canRemove=\{canRemove\}/.test(page));
check(
  "the checklist lists removable captures only when it may remove and the package is open",
  /const onServer = canRemove && !readOnly \? captures\.filter\(\(c\) => c\.itemKey === item\.itemKey\) : \[\];/.test(client),
);
check(
  "the Remove control is drawn only inside that list",
  (client.match(/onClick=\{\(\) => void removeCapture\(/g) ?? []).length === 1 &&
    client.indexOf("onServer.map(") > 0 &&
    client.indexOf("void removeCapture(") > client.indexOf("onServer.map("),
);
check("it asks before it removes, and sends delete_capture", /window\.confirm\(`Remove /.test(client) && /action: "delete_capture"/.test(client));
check("the control defaults to not drawn", /canRemove = false,/.test(client));

console.log(wrong === 0 ? "\nPROVED: a capture is removed only in the field, by its technician, after its record." : `\nNOT PROVED: ${wrong} check(s) failed.`);
process.exit(wrong === 0 ? 0 : 1);
