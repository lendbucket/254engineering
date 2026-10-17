/**
 * A DOCUMENT THE SIGNED PROTOCOL REQUIRES AT ORDER IS ATTACHED BY THE FIRM,
 * AND NEVER SATISFIED BY A SENTENCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-required-document-is-attached-not-typed.mjs
 *
 * Found 2026-10-16 preparing the first real roof job. 254-RC-001 requires
 * "Photo of the front of the property" at its Required tier, so the field is
 * required at order, and both the intake screen and takeJob refuse an
 * order-stage gap. The screen said the document "cannot be attached on a call"
 * and "stays outstanding on the file", so a job the firm takes by telephone
 * could not be opened at all.
 *
 * The requirement is kept. The firm now attaches the document at intake
 * (0078 gives eng_file_inputs the storage columns eng_order_inputs has), and
 * takeJob accepts a file field as answered only by an upload made for THIS
 * intake and THIS field. It also stops a sentence posted against a file field
 * from counting, which it used to.
 */
import { readSource } from "../lib/read-source.mjs";

const { applyIntakeUploads } = await import("../../src/lib/job-intake-rules.ts");
const { fieldsFor, missingFor } = await import("../../data/intake-fields.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SLUG = "roof-inspections";
const TIER = "standard";
const FRONT = "rc001_upload_front-of-property";
const BUCKET = "eng-uploads";
const ATTACHED = "Attached by the firm when the job was taken.";
const DRAFT = "11111111-2222-3333-4444-555555555555";

const fileIds = fieldsFor(SLUG, TIER).filter((f) => f.kind === "file").map((f) => f.id);
check("the front photo is a file field of a roof certification", fileIds.includes(FRONT), fileIds.join(", "));
const front = fieldsFor(SLUG, TIER).find((f) => f.id === FRONT);
check("and it is required at order, as the signed protocol's Required tier says", front?.required === true && front?.stage === "order");

const apply = (answers, uploads, draftId = DRAFT) =>
  applyIntakeUploads({ fileFieldIds: fileIds, uploads, draftId, answers, bucket: BUCKET, attachedText: ATTACHED });
const stillMissing = (answers) => missingFor(SLUG, TIER, answers, "order").some((f) => f.id === FRONT);

const typed = apply({ [FRONT]: "photo is on its way" }, []);
check(
  "a sentence posted against the photo is dropped, so the photo is still missing",
  typed.ok && !(FRONT in typed.answers) && stillMissing(typed.answers),
);

const good = apply({}, [{ fieldId: FRONT, bucket: BUCKET, storageKey: `intake/${DRAFT}/${FRONT}/a.jpg` }]);
check(
  "an upload made for this intake and this field answers it",
  good.ok && good.answers[FRONT] === ATTACHED && !stillMissing(good.answers),
);

const otherDraft = apply({}, [{ fieldId: FRONT, bucket: BUCKET, storageKey: `intake/another-draft/${FRONT}/a.jpg` }]);
check("an upload from another intake is refused", !otherDraft.ok, otherDraft.ok ? "accepted" : otherDraft.error);

const otherField = apply({}, [{ fieldId: FRONT, bucket: BUCKET, storageKey: `intake/${DRAFT}/rc001_upload_permits-hoa/a.jpg` }]);
check("an upload made for another field is refused", !otherField.ok);

const otherBucket = apply({}, [{ fieldId: FRONT, bucket: "eng-evidence", storageKey: `intake/${DRAFT}/${FRONT}/a.jpg` }]);
check("an upload in another bucket is refused", !otherBucket.ok);

const orderKey = apply({}, [{ fieldId: FRONT, bucket: BUCKET, storageKey: `orders/${DRAFT}/${FRONT}/a.jpg` }]);
check("a customer's order upload cannot be claimed by an intake", !orderKey.ok);

const noDraft = apply({}, [{ fieldId: FRONT, bucket: BUCKET, storageKey: `intake/${DRAFT}/${FRONT}/a.jpg` }], null);
check("an upload with no draft to belong to is refused", !noDraft.ok);

const notAsked = apply({}, [{ fieldId: "rc001_q2", bucket: BUCKET, storageKey: `intake/${DRAFT}/rc001_q2/a.jpg` }]);
check("a document cannot answer a field that is not a document", !notAsked.ok);

/* takeJob, the route, the screen and the schema, read from the source. */
const intake = readSource("src/lib/ops-job-intake.ts");
const take = intake.slice(intake.indexOf("export async function takeJob("));
const applied = take.indexOf("const filed = applyIntakeUploads({");
const gate = take.indexOf('const missingToOrder = missingFor(input.serviceSlug, input.tier, answers, "order");');
check("takeJob applies the uploads before it asks what is missing to order", applied > 0 && gate > applied, `apply ${applied}, gate ${gate}`);
check("and refuses on the rule's refusal", /if \(!filed\.ok\) return \{ ok: false, error: filed\.error, field: filed\.field \};/.test(take));
check("the row records where the document landed", /storage_key: uploadFor\(field_id\)!\.storageKey/.test(take));

const route = readSource("src/app/api/portal/files/route.ts");
check(
  "the upload is signed under the intake namespace, for somebody who may take a job",
  /if \(action === "sign_intake_upload"\) \{\s*if \(!can\(actor, "files\.create"\)\)/.test(route) && /space: "intake"/.test(route),
);

const screen = readSource("src/app/portal/(app)/intake/IntakeClient.tsx");
check("the screen no longer says it cannot be attached", !screen.includes("Cannot be attached on a call"));
check("and posts the draft and its uploads with the job", /draftId,\s*uploads: Object\.entries\(uploads\)/.test(screen));

const migration = readSource("supabase/migrations/0078_an_intake_answer_can_be_a_stored_file.sql");
check(
  "0078 gives eng_file_inputs the four columns eng_order_inputs has, and keeps a stored file whole",
  ["bucket", "storage_key", "content_type", "byte_size"].every((c) => new RegExp(`add column if not exists ${c} `).test(migration)) &&
    /check \(\(bucket is null\) = \(storage_key is null\)\)/.test(migration),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a required document is attached by the firm for this job, and a sentence never stands in for it.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
