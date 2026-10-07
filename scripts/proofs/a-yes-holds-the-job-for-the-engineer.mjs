/**
 * A YES TO RC-001'S QUESTIONS 8 TO 12 HOLDS THE JOB FOR THE ENGINEER, AND
 * NOTHING DECIDES FOR HIM.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-yes-holds-the-job-for-the-engineer.mjs
 *
 * Operator ruling 1 of 2026-10-07, refined the same day: any yes, an open
 * insurance claim included, holds the job before dispatch until the engineer
 * records accept or decline; an open claim is NOT declined automatically, his
 * screen shows Aman's standing ruling as the reason, and he records the decline
 * with the referral himself. Proved both ways here from the rule and the source;
 * the live half (a held job refused at dispatch, then declined with a referral
 * and refunded, and another accepted and dispatched) is the order path walk.
 */
import { readFileSync } from "node:fs";

const { holdQuestions, holdRefusal, STANDING_RULINGS } = await import("../../src/lib/dispatch-hold.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SLUG = "roof-inspections";
const ALL_NO = { rc001_q8: "No", rc001_q9: "No", rc001_q10: "No", rc001_q11: "No", rc001_q12: "No" };

/* One at a time, because a check on all five together passes if only one is wired. */
for (const n of [8, 9, 10, 11, 12]) {
  const q = holdQuestions(SLUG, { ...ALL_NO, [`rc001_q${n}`]: "Yes" });
  check(`a yes to question ${n} alone holds the job, naming question ${n}`, q.length === 1 && q[0].number === n, q.map((x) => x.number).join(", ") || "not held");
}
check("five noes hold nothing", holdQuestions(SLUG, ALL_NO).length === 0);
check("a yes outside 8 to 12 holds nothing (question 13, the attic)", holdQuestions(SLUG, { ...ALL_NO, rc001_q13: "Yes" }).length === 0);
check("a line with no protocol holds nothing", holdQuestions("structural-letters", { rc001_q8: "Yes" }).length === 0);

const claim = holdQuestions(SLUG, { ...ALL_NO, rc001_q8: "Yes" });
check(
  "an open insurance claim is HELD, with Aman's standing ruling shown as the reason",
  claim.length === 1 && /declined with a referral/.test(claim[0].standingRuling ?? ""),
  claim[0]?.standingRuling ?? "no ruling shown",
);
check("and the standing ruling is shown only beside question 8", Object.keys(STANDING_RULINGS).join(",") === "8");
check(
  "a held job's refusal tells the dispatcher the engineer decides first",
  /held for the engineer/.test(holdRefusal({ held: true, questions: claim }) ?? ""),
  (holdRefusal({ held: true, questions: claim }) ?? "").slice(0, 80),
);
check("a failed read of the hold refuses dispatch rather than allowing it", Boolean(holdRefusal({ held: null, error: "read failed" })));
check("and a job that is not held is not refused", holdRefusal({ held: false, reason: "no yes" }) === null);

/* NOTHING DECLINES AUTOMATICALLY: the only close and refund sit behind his decision to decline. */
const hold = readFileSync("src/lib/dispatch-hold.ts", "utf8");
const body = (name) => {
  const at = hold.indexOf(`export async function ${name}(`);
  const next = hold.indexOf("\nexport ", at + 10);
  return hold.slice(at, next < 0 ? undefined : next);
};
const decideFree = ["holdFor", "heldFiles"].filter((f) => /transitionFile\(|settleDecision\(/.test(body(f)));
check("reading or listing a hold never closes or refunds anything", decideFree.length === 0, decideFree.join(", ") || "holdFor and heldFiles decide nothing");
const record = body("recordPrereview");
const declineBranch = record.indexOf('if (decision === "decline") {\n');
check(
  "the close and the refund are reached only inside the engineer's decline",
  declineBranch > 0 && record.indexOf("transitionFile(") > declineBranch && record.indexOf("settleDecision(") > declineBranch,
);
check("and a decline needs his referral", /decision === "decline" && written\.length < 10/.test(record));
check("and only his licence decides", /holdsLicence\(actor, "review\.queue"\)/.test(record));

/* DISPATCH ASKS FIRST: sendOffers refuses a held job before any offer is written. */
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const send = field.slice(field.indexOf("export async function sendOffers("), field.indexOf("export async function listOffers("));
const asked = send.indexOf("holdRefusal(await holdFor(fileId))");
const written = send.indexOf('.from("eng_assignments")');
check("sendOffers asks the hold before it writes an offer", asked > 0 && (written < 0 || asked < written), `asked at ${asked}, offer written at ${written}`);

console.log("");
if (wrong === 0) {
  console.log("PASS: a yes holds the job for the engineer, and nothing decides for him.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
