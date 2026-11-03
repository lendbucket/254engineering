/**
 * A FOUNDATION DECLINE LETTER MOVES ITS FILE TO SEALED AND DELIVERED, AND ONLY
 * A RECORDED 254-FC-001 DECLINE REPLACES THE REFUND.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-foundation-decline-letter-delivers-and-only-it-replaces-the-refund.mjs
 *
 * Robert's ruling Q4 of 2026-11-02, from audit field F8 and F12: "foundation
 * decline delivery. Let refused move to sealed under documents.seal, set
 * delivered_at, run accruals; decide letters-instead from the FC-001
 * determination, refund otherwise."
 *
 *   A  the grammar: the engineer moves refused to sealed, then sealed to
 *      delivered; an administrator cannot (documents.seal is licensed); refused
 *      still cannot go straight to delivered or back into review
 *   B  delivered stamps delivered_at and is where accruals and the review
 *      request run, so the decline letter's delivery reaches both
 *   C  the letter replaces the refund only for a recorded 254-FC-001 decline;
 *      a foundation file refused with none, or with another determination, is
 *      refunded
 *   D  in the code: the after-decision job reads the file's determinations,
 *      decides through lettersInsteadOfRefund, and retries on a failed read;
 *      the service slug no longer decides it; sealLetter still delivers a
 *      254-FC-001 decline through deliverSealedFile
 *
 * Pure rules and source reading. Nothing reaches a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { canTransition, STATUS_TIMESTAMP } = await import("../../src/lib/ops-files.ts");
const { actionsFor } = await import("../../src/lib/ops-authz.ts");
const { lettersInsteadOfRefund } = await import("../../src/lib/foundation-decline-rules.ts");

const actor = (role) => ({ id: `${role}-q4`, role, status: "active", grants: new Set(actionsFor(role)) });
const engineer = actor("engineer");
const admin = actor("admin");
const LIVE = { prelaunch: false };

/* A */
const r2s = canTransition(engineer, "refused", "sealed", LIVE);
check("the engineer moves a refused file to sealed", r2s.ok === true, r2s.ok ? "" : r2s.reason);
const s2d = canTransition(engineer, "sealed", "delivered", LIVE);
check("and the sealed file to delivered", s2d.ok === true, s2d.ok ? "" : s2d.reason);
check("an administrator cannot move refused to sealed", canTransition(admin, "refused", "sealed", LIVE).ok === false);
check("refused still cannot go straight to delivered", canTransition(engineer, "refused", "delivered", LIVE).ok === false);
check("nor back into review", canTransition(engineer, "refused", "under_review", LIVE).ok === false);
check("and the move is still shut while the gate is", canTransition(engineer, "refused", "sealed", { prelaunch: true }).ok === false);

/* B */
check("delivered stamps delivered_at", STATUS_TIMESTAMP.delivered === "delivered_at");
check("sealed stamps sealed_at", STATUS_TIMESTAMP.sealed === "sealed_at");
const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
check("delivered is where accruals and the review request run", /if \(to === "delivered"\) \{\s*const accrued = await accrueForDelivery\(id\);[\s\S]{0,700}scheduleReviewRequest\(id\)/.test(crm));

/* C */
check("a recorded 254-FC-001 decline replaces the refund with the letter", lettersInsteadOfRefund([{ protocol_document: "254-FC-001", determination: "decline" }]) === true);
check("a foundation file refused with no determination is refunded", lettersInsteadOfRefund([]) === false);
check("an earlier 254-FC-001 revise does not stand in for a decline", lettersInsteadOfRefund([{ protocol_document: "254-FC-001", determination: "revise" }]) === false);
check("another protocol's decline does not either", lettersInsteadOfRefund([{ protocol_document: "254-RC-001", determination: "decline" }]) === false);
check("the decline is found among other determinations", lettersInsteadOfRefund([{ protocol_document: "254-FC-001", determination: "revise" }, { protocol_document: "254-FC-001", determination: "decline" }]) === true);

/* D */
const handlers = readFileSync("src/lib/job-handlers.ts", "utf8");
const refuse = handlers.slice(handlers.indexOf('if (action === "refuse") {'), handlers.indexOf('if (action === "refuse") {') + 4000);
check("the refusal branch is found", refuse.length > 1000);
check("it reads the file's determinations", /\.from\("eng_determinations"\)\s*\.select\("protocol_document, determination"\)\s*\.eq\("file_id", fileId\)/.test(refuse));
check("a failed read is a retry, never a refund decided on a guess", /if \(determinationError\) return \{ kind: "retry"/.test(refuse));
check("and the letter is decided by lettersInsteadOfRefund", /const lettersInstead = lettersInsteadOfRefund\(determinations \?\? \[\]\);/.test(refuse));
check("the service slug no longer decides it", !/service_slug === "foundation-inspections"/.test(refuse));
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("sealLetter still delivers a 254-FC-001 decline through deliverSealedFile", /const delivers = det\.determination === "pass" \|\| \(det\.protocol_document === "254-FC-001" && det\.determination === "decline"\);[\s\S]{0,200}deliverSealedFile\(/.test(seal));

console.log(
  wrong === 0
    ? "PASS: a foundation decline letter moves its file to sealed and delivered, and only a recorded 254-FC-001 decline replaces the refund."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
