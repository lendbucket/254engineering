/**
 * PROOF: AN APPROVED PROTOCOL DOES NOT PUT THE SITE INTO THE PRESENT TENSE.
 *
 * Operator ruling, 2026-09-24, after the board caught it on the branch that
 * introduces the register entry.
 *
 * WHAT HAPPENED. `sealingIsAvailable()` was `peInResponsibleCharge() &&
 * approvedProtocols.length > 0`. It was written on 2026-09-17 precisely to stop
 * six rendered sentences flipping to the present tense, and it held for a week
 * for one reason: the register was EMPTY. Aman approved 254-RC-001 on
 * 2026-09-22, the register gained its first entry, and all six flipped on a
 * site whose gate still reads prelaunch. `voice-audit` went red with six
 * findings across five routes and `partner-audit` with four checks.
 *
 * SECOND INSTANCE OF THE DORMANT REGISTER. CLAUDE.md records the first: the PE
 * licence number had two homes and that was harmless for exactly as long as the
 * register held nothing, because one home holding nothing cannot disagree with
 * another. The question that rule leaves is the one this proof answers: not
 * "does this fact have two homes today" but "what becomes true the first time
 * somebody fills in the empty one".
 *
 * WHY A PROOF AND NOT ONLY voice-audit. voice-audit is the check and it stays
 * the check; it scans 63 rendered routes and it is what went red. It needs a
 * built site and a running server. This reads the three predicates and the
 * three sentences directly, costs a second, and names WHICH conjunct is
 * refusing, which a route scan cannot say.
 *
 * WHY A CHILD PROCESS. CLAUDE.md section 6: a module level constant is read
 * once and a fresh import() is not fresh enough. `approvedProtocols` and the
 * launch conditions are exactly such constants. The injection below patches
 * source on disk, so the world has to be read by a process that starts after
 * the patch.
 *
 * THE PREMISE IS ASSERTED BEFORE ANYTHING ELSE, because this whole proof is
 * about a state and a proof that does not check it is in that state proves
 * nothing. If the register were empty, every sentence below would be future
 * tense for a reason that has nothing to do with the fix, and this would print
 * green over the exact hole it was written to close.
 */
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";

const READER = `
import {
  isPrelaunch,
  isTrading,
  peInResponsibleCharge,
  sealingIsAvailable,
  sealingIsAvailableFor,
} from "../../src/lib/launch.ts";
import { approvedProtocols } from "../../src/config/launch-readiness.ts";
const copy = await import("../../src/content/model-copy.ts");
console.log(JSON.stringify({
  approvedCount: approvedProtocols.length,
  approvedSlugs: approvedProtocols.map((p) => p.serviceSlug),
  prelaunch: isPrelaunch(),
  trading: isTrading(),
  engineer: peInResponsibleCharge(),
  sealing: sealingIsAvailable(),
  sealingRoof: sealingIsAvailableFor("roof-inspections"),
  sealingUnapproved: sealingIsAvailableFor("manufactured-home-foundations"),
  responsibleCharge: copy.responsibleChargeCopy(),
  deliverable: copy.sealedDeliverableSentence(),
  reviewStep: copy.reviewStepCopy(),
}));
`;

const READER_PATH = "scripts/proofs/.sealing-proof-reader.mts";

function readWorld(label) {
  writeFileSync(READER_PATH, READER);
  try {
    const r = spawnSync("npx", ["tsx", READER_PATH], { encoding: "utf8", shell: true });
    const line = (r.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .pop();
    if (!line) {
      console.error(`could not read the world ${label}. stderr:\n${(r.stderr || "").slice(-900)}`);
      process.exit(1);
    }
    return JSON.parse(line);
  } finally {
    try {
      unlinkSync(READER_PATH);
    } catch {}
  }
}

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/*
 * The present tense branch of each of the three sentences, quoted from
 * model-copy.ts. Matched as the SENTENCE rather than on the word "sealed",
 * because both branches of all three contain that word and a matcher on it
 * would fire on the compliant copy. Match the thing you mean.
 */
const PRESENT = {
  responsibleCharge: "is reviewed and sealed by a Texas licensed Professional Engineer",
  deliverable: "Every deliverable is reviewed and sealed by",
  reviewStep: "Professional Engineer reviews the record",
};

const world = readWorld("as the branch stands");

// ------------------------------------------------------- the premise, first

check(
  `the register holds an approved protocol (${world.approvedCount})`,
  world.approvedCount > 0,
  world.approvedCount > 0
    ? world.approvedSlugs.join(", ")
    : "EMPTY, so every sentence below is future tense for a reason that is not the fix, and this proof would be vacuous",
);

check(
  "and the gate reads prelaunch",
  world.prelaunch === true && world.trading === false,
  `prelaunch ${world.prelaunch}, trading ${world.trading}`,
);

check(
  "and an engineer is in responsible charge",
  world.engineer === true,
  "if this were false, sealingIsAvailable would be false without isTrading doing any work",
);

/*
 * THE ISOLATION, AND IT IS WHAT MAKES THE RESULT MEAN SOMETHING. Two of the
 * three conjuncts are true, asserted directly above. So a false answer from
 * sealingIsAvailable() can only be isTrading() refusing, which is the conjunct
 * this change added. Without these three lines the check below would pass just
 * as happily on an empty register, which is the state it was written against.
 */

// --------------------------------------------- the predicate and the copy

check(
  "sealing is NOT available, because the firm is not trading",
  world.sealing === false,
  `trading ${world.trading}, engineer ${world.engineer}, approved ${world.approvedCount}`,
);

check(
  "the responsible charge paragraph stays future tense",
  !world.responsibleCharge.includes(PRESENT.responsibleCharge),
  world.responsibleCharge.slice(0, 90),
);

check(
  "the deliverable sentence stays future tense",
  !world.deliverable.includes(PRESENT.deliverable),
  world.deliverable.slice(0, 90),
);

check(
  "the review step stays future tense",
  !world.reviewStep.includes(PRESENT.reviewStep),
  world.reviewStep.slice(0, 90),
);

// ------------------------------------------------------ the line level rule

check(
  "an APPROVED line may not claim present tense sealing while the firm is not trading",
  world.sealingRoof === false,
  `roof-inspections is approved and sealingIsAvailableFor returned ${world.sealingRoof}`,
);

check(
  "and a line with no approved protocol may not either",
  world.sealingUnapproved === false,
  "manufactured-home-foundations has no approved protocol",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. An approved register does not open the copy; trading does."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
