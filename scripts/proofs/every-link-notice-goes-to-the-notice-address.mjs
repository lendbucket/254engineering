/**
 * EVERY ORDER NOTICE THAT CARRIES THE STATUS LINK GOES WHERE noticeAddress SAYS.
 *
 * Operator ruling 2026-10-13: a notice carrying the order's status link goes to
 * the account's address on file when the order is on an account, and to the
 * order's own address otherwise. noticeAddress in src/lib/ops-payments.ts is
 * that answer. Four notices used it; the sealed, replacement and decline
 * notices read the order's customer_email directly, so the notice carrying the
 * letter went to the address that paid. Part 1 finding 5 of 2026-11-14, fixed on
 * Robert's answer 1 the same day.
 *
 * THE SUBJECT IS DERIVED, so the next notice is held to it without anybody
 * adding it here: every function in ops-payments.ts that mints a status link
 * (calls statusUrlFor) is a link notice, and each must ask noticeAddress and
 * must not read customer_email. A floor on the count stops a parse that finds
 * nothing from passing over an empty set.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const source = readFileSync("src/lib/ops-payments.ts", "utf8");

/* Split into top level functions by their declaration lines. */
const starts = [...source.matchAll(/^(?:export )?async function ([A-Za-z0-9_]+)\(/gm)].map((m) => ({ name: m[1], at: m.index }));
const bodies = starts.map((s, i) => ({ name: s.name, body: source.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : source.length) }));

const linkNotices = bodies.filter((b) => b.name !== "statusUrlFor" && b.body.includes("statusUrlFor("));
const FLOOR = 7;
check(`at least ${FLOOR} functions mint a status link`, linkNotices.length >= FLOOR, `${linkNotices.length}: ${linkNotices.map((b) => b.name).join(", ")}`);

/*
 * CODE, NOT PROSE. The first version searched the whole body and went red on a
 * comment saying the function "used to read the order's own customer_email":
 * a matcher matching a word rather than the thing it means. Comments are
 * removed before either question is asked.
 */
const codeOf = (body) => body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

for (const { name, body } of linkNotices) {
  const code = codeOf(body);
  check(`${name} asks noticeAddress who it goes to`, /noticeAddress\(orderId, "[^"]+"\)/.test(code));
  check(`${name} does not read the order's customer_email`, !code.includes("customer_email"));
}

/* noticeAddress itself is still the 2026-10-13 rule: the account's address first. */
const rule = bodies.find((b) => b.name === "noticeAddress")?.body ?? "";
check("noticeAddress asks confirmationRecipient first", /await confirmationRecipient\(orderId\)/.test(rule));
check("and an account's address wins", /if \(recipient\.kind === "account"\) return recipient\.email;/.test(rule));

console.log("");
if (wrong === 0) {
  console.log("PASS: every notice carrying the status link goes where noticeAddress says.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
