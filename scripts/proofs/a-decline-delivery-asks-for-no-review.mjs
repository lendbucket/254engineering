// @runtime react-server
//
// Declared because it reads src/lib/review-request.ts, which carries server-only.

/**
 * A DELIVERY ON A DECLINE ASKS FOR NO REVIEW. Robert, 2026-11-02 (answer to
 * issue #1 6586834020, item 1): "suppress the review request on a decline, as a
 * follow-up."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-decline-delivery-asks-for-no-review.mjs
 *
 * Since Q4 a 254-FC-001 decline letter moves its file to delivered, and the one
 * door to delivered queues the Google review request for every delivered file.
 * This proves the rule on the file's determinations, and reads in
 * scheduleReviewRequest that the decline and a failed read both stop before
 * anything is queued, while every other delivery still schedules it.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { deliveredOnADecline, lettersInsteadOfRefund } = await import("../../src/lib/foundation-decline-rules.ts");

/* ------------------------------------------------------------------ the rule */
check("a 254-FC-001 decline is a delivery on a decline", deliveredOnADecline([{ protocol_document: "254-FC-001", determination: "decline" }]) === true);
check("so is a decline under any protocol", deliveredOnADecline([{ protocol_document: "254-RC-001", determination: "decline" }]) === true);
check("a pass is not", deliveredOnADecline([{ protocol_document: "254-RC-001", determination: "pass" }]) === false);
check("no determination is not", deliveredOnADecline([]) === false);
check("a pass beside a decline still counts as a decline", deliveredOnADecline([{ protocol_document: "254-FC-001", determination: "pass" }, { protocol_document: "254-FC-001", determination: "decline" }]) === true);
check("and Q4's letters-instead rule is unchanged", lettersInsteadOfRefund([{ protocol_document: "254-FC-001", determination: "decline" }]) === true && lettersInsteadOfRefund([{ protocol_document: "254-RC-001", determination: "decline" }]) === false);

/* ------------------------------------------------------------------ where it is asked */
const src = readFileSync("src/lib/review-request.ts", "utf8");
const body = src.slice(src.indexOf("export async function scheduleReviewRequest("), src.indexOf("export async function runReviewRequest("));
const readAt = body.indexOf('.from("eng_determinations")');
const declineAt = body.indexOf("if (deliveredOnADecline(read.data))");
const failedAt = body.indexOf("if (read.error || !read.data)");
const queueAt = body.indexOf("await enqueue(REVIEW_REQUEST_JOB");
check("scheduleReviewRequest reads the file's determinations", readAt > 0, readAt < 0 ? "no read" : "");
check("a failed read schedules nothing: it returns before the queue", failedAt > 0 && failedAt < queueAt && /if \(read\.error \|\| !read\.data\) \{[\s\S]*?return;\s*\}/.test(body.slice(failedAt, queueAt)));
check("a decline schedules nothing: it returns before the queue", declineAt > 0 && declineAt < queueAt && /if \(deliveredOnADecline\(read\.data\)\) \{[\s\S]*?return;\s*\}/.test(body.slice(declineAt, queueAt)));
check("both are said on the order's timeline", (body.match(/"review_request\.not_scheduled"/g) ?? []).length === 2);
check("every other delivery still queues the request", queueAt > declineAt && queueAt > failedAt);
const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
check("and delivered still asks scheduleReviewRequest, the one door", /if \(to === "delivered"\) \{[\s\S]*?scheduleReviewRequest\(id\)/.test(crm));

console.log("");
if (wrong === 0) {
  console.log("PASS: a delivery on a decline asks for no review, a failed read asks for none, and every other delivery still schedules it.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
