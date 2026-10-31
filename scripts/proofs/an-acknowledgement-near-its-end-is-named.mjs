/**
 * An acknowledgement in compliance-audit close to its end date is named before
 * a board fails on it, and the naming is a warning only.
 *
 * Robert, 15:07 Central 2026-10-31: "extend the 45-day warning to every
 * acknowledged date in compliance-audit, a warning only." compliance-audit
 * needs a build for part of its subject, so the decision of which
 * acknowledgements warn lives in a pure function, scripts/lib/ack-notice.mjs,
 * and this proof tests it with fixed days, so it means the same thing on any
 * date.
 *
 * The figures are the park's own: production-cutover was acknowledged through
 * 2026-12-01 and nothing said so until a person read the block on 2026-10-31,
 * 31 days out. It is now acknowledged through 2027-03-31, so its warning
 * starts on 2027-02-14.
 */
import { readFileSync } from "node:fs";
import { ackNotices, ACK_NOTICE_DAYS } from "../lib/ack-notice.mjs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

check("the notice is the ruled 45 days", ACK_NOTICE_DAYS === 45, `${ACK_NOTICE_DAYS}`);

const old = ackNotices([{ name: "production-cutover", through: "2026-12-01" }], "2026-10-31");
check("the old cutover date, 31 days out on 2026-10-31, is named", old.length === 1 && old[0].daysLeft === 31, JSON.stringify(old));

const cutover = [{ name: "production-cutover", through: "2027-03-31" }];
check("the new date is not named today", ackNotices(cutover, "2026-10-31").length === 0);
check("nor on 2027-02-13, 46 days out", ackNotices(cutover, "2027-02-13").length === 0);
const first = ackNotices(cutover, "2027-02-14");
check("it is named from 2027-02-14, 45 days out", first.length === 1 && first[0].daysLeft === 45, JSON.stringify(first));
const last = ackNotices(cutover, "2027-03-31");
check("and on its last day, with 0 days left", last.length === 1 && last[0].daysLeft === 0, JSON.stringify(last));
check(
  "but not the day after, which is a FAIL in the audit's own path",
  ackNotices(cutover, "2027-04-01").length === 0,
);
check("an acknowledgement with no real date is not a warning here", ackNotices([{ name: "x", through: "soon" }], "2026-10-31").length === 0);

const mixed = ackNotices(
  [
    { name: "later", through: "2026-12-10" },
    { name: "sooner", through: "2026-11-05" },
    { name: "far", through: "2027-06-01" },
  ],
  "2026-10-31",
);
check("several are listed soonest first, and a far one is left out", mixed.map((n) => n.name).join(",") === "sooner,later", JSON.stringify(mixed));
check(
  "the function returns names and days left, never a verdict",
  mixed.every((n) => Object.keys(n).sort().join(",") === "daysLeft,name,through"),
);

/* The audit must hand every acknowledgement its date, and must not judge the warning. */
const audit = readFileSync(new URL("../compliance-audit.mjs", import.meta.url), "utf8");
const calls = audit.split("\n").filter((line) => /^\s+ack\($/.test(line)).length;
check("compliance-audit has exactly the two acknowledgement sites this proof reads", calls === 2, `${calls} found`);
check(
  "the roster acknowledgement passes its earliest expiry and its own day",
  audit.includes("covered.map((e) => e.rosterNameLag.expires).sort()[0],\n        TODAY,\n      );"),
);
check(
  "the park acknowledgement passes its date and the firm's calendar day",
  audit.includes("p.acknowledgedThrough,\n        firmToday,\n      );"),
);
const start = audit.indexOf("const undated = acknowledged.filter(");
const block = start < 0 ? "" : audit.slice(start, audit.indexOf("/* Unreachable is not failed", start));
check("the warning block calls ackNotices", block.includes("ackNotices("));
check(
  "and pushes nothing into the verdicts",
  block.length > 0 && !/out\.push|rec\(|[^.]ack\(|process\.exitCode/.test(block),
  `${block.length} chars read`,
);
check("and names an acknowledgement it cannot date rather than skipping it", block.includes("carries no end date"));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: an acknowledgement within ${ACK_NOTICE_DAYS} days of its end is named as a warning, and the warning decides nothing.`
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
