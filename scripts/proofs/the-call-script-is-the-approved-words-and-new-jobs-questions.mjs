/**
 * THE PRINTABLE CALL SCRIPT IS ROBERT'S APPROVED WORDS AND NEW JOB'S OWN
 * QUESTIONS. C7, his rulings of 2026-11-14 on issue #1: the roof script with
 * line 9 always said (answer 6 to 6878458673), and the four other call types
 * as drafted (6879119977).
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-call-script-is-the-approved-words-and-new-jobs-questions.mjs
 *
 * The approved lines are written out here as literals, never imported, so a
 * reworded line in src/content/call-scripts.ts is a red rather than a new
 * expectation. Then the page is read for the two things the script promises:
 * the questions come from fieldsFor, the one definition New job asks from, and
 * the payment line gives way to the shut gate sentence only where the
 * deliverable cannot be ordered now.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { CALL_SCRIPTS, CALL_TYPES, SHUT_GATE_LINE } = await import("../../src/content/call-scripts.ts");

/* The roof script, lines 1 to 9, in the approved words. */
const ROOF = [
  "Thank you for calling 254 Engineering. Can I take your name and the best number to reach you?",
  "What is the address of the property, and which city and county is it in?",
  "Is this for a roof certification, or something else?",
  "I have a few questions the engineer needs answered before anything is booked.",
  "Who will be at the property, and what number should the technician call? Is there a gate code, a dog or an alarm?",
  "Should anybody else receive a copy of the letter, an agent, a lender or a title company?",
  "Who is paying for this?",
  "The price for this is [read from the screen].",
  "I am sending you a secure payment link by email now.",
];
const SHUT = "We are not taking payment for this yet. We will call you as soon as we can.";

/* The first sentence each of the other four scripts has the rep say, and how many lines each has. */
const OTHERS = {
  returning: { lines: 9, says: ["I have you as [name] at [email]. Is that still the best email for the letter and the payment link?", "Is this for the same property as before, or a new one?", "What is the address, and which city and county is it in?", "What do you need this time?"] },
  agent: {
    lines: 9,
    says: [
      "Thank you for calling 254 Engineering. Can I take your name, your company, and the best number to reach you?",
      "Who is the property owner or buyer, and how do we reach them?",
      "What does the letter need to say, and who should it be addressed to?",
      "Is there a date it is needed by, such as a closing?",
      "Who will let the technician in, and what number should the technician call?",
      "Who is paying for this, you or your client?",
      "I am sending the secure payment link by email now to [the payer].",
    ],
  },
  partner: { lines: 3, says: ["Did somebody send you to us? If they gave you a code, can you read it to me?", "Can you check that code with them?"] },
  wpi8: {
    lines: 10,
    says: [
      "That address is outside the area where a WPI-8 applies, so this is not a job we can take for it.",
      "When was the work finished, and what was done?",
      "Is any of the work covered up now, so it cannot be seen?",
      "Should anybody else receive a copy, for example your insurance agent?",
    ],
  },
};

const said = (script) => script.lines.flatMap((l) => l.segments.filter((s) => "say" in s).map((s) => s.say));

check("there are exactly the five approved call types", JSON.stringify(CALL_TYPES) === JSON.stringify(["roof", "returning", "agent", "partner", "wpi8"]), CALL_TYPES.join(", "));
check("the shut gate sentence is the approved one", SHUT_GATE_LINE === SHUT);

const roof = CALL_SCRIPTS.roof;
check("the roof script has its nine lines", roof.lines.length === 9, `${roof.lines.length}`);
roof.lines.forEach((line, i) => {
  const first = line.segments.find((s) => "say" in s);
  check(`roof line ${i + 1} is the approved sentence`, first?.say === ROOF[i], first?.say ?? "no sentence");
});
check("roof line 9 is the payment line, and the only one", roof.lines.map((l) => Boolean(l.payment)).join() === [0, 0, 0, 0, 0, 0, 0, 0, 1].map(Boolean).join());
check("roof asks the service's questions at line 4 and the getting in questions at line 5", Boolean(roof.lines[3].questions) && Boolean(roof.lines[4].access));

for (const [type, want] of Object.entries(OTHERS)) {
  const s = CALL_SCRIPTS[type];
  check(`${type}: ${want.lines} lines`, s.lines.length === want.lines, `${s.lines.length}`);
  const all = said(s);
  const missing = want.says.filter((w) => !all.includes(w));
  check(`${type}: carries its approved sentences word for word`, missing.length === 0, missing.join(" | "));
}
check(
  "every script but the partner's ends on the payment line; the partner's continues the roof script from line 2",
  ["roof", "returning", "agent", "wpi8"].every((t) => CALL_SCRIPTS[t].lines.at(-1).payment === true) &&
    CALL_SCRIPTS.partner.lines.at(-1).continues?.script === "roof" &&
    CALL_SCRIPTS.partner.lines.at(-1).continues?.fromLine === 2,
);
check(
  "the roof and WPI-8 scripts fix their deliverable; the other three are chosen on the page",
  CALL_SCRIPTS.roof.deliverable?.serviceSlug === "roof-inspections" &&
    CALL_SCRIPTS.wpi8.deliverable?.serviceSlug === "windstorm-wpi-8" &&
    CALL_SCRIPTS.wpi8.deliverable?.tier === "completed" &&
    ["returning", "agent", "partner"].every((t) => CALL_SCRIPTS[t].deliverable === null),
);

/* The page: New job's questions, and line 9 said wherever the deliverable can be ordered now. */
const page = readFileSync("src/app/portal/(app)/intake/script/page.tsx", "utf8");
const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("the page asks fieldsFor for the questions, less the copy contacts New job asks on its own", /fieldsFor\(deliverable\.serviceSlug, deliverable\.tier\)\.filter\(\(f\) => f\.id !== "copy_to"\)/.test(code));
check("the page decides the payment line from the order page's own answer for the deliverable", /const blocked = await deliverableBlockedForDisplay\(entry, launchMode\(\)\);/.test(code));
check("and prints the shut sentence only on the payment line, only when blocked", /line\.payment && blocked \? SHUT_GATE_LINE : s\.say/.test(code));
check("the page is behind files.create, New job's own door", /if \(!actor \|\| !can\(actor, "files\.create"\)\) notFound\(\);/.test(code));

console.log(wrong === 0 ? "\nThe call script is the approved words and New job's questions." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
