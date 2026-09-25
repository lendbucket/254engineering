/**
 * PROOF: THE SEALING COPY FOLLOWS THE GATE, NOT THE REGISTER.
 *
 * Operator ruling, 2026-09-24.
 *
 * WHAT HAPPENED. `sealingIsAvailable()` was `peInResponsibleCharge() &&
 * approvedProtocols.length > 0`. It was written on 2026-09-17 to stop six
 * rendered sentences flipping to the present tense, and it held for a week for
 * one reason: the register was EMPTY. Aman approved 254-RC-001 on 2026-09-22,
 * the register gained its first entry, and all six flipped.
 *
 * Second instance of the dormant register, recorded in CLAUDE.md beside the PE
 * licence one. The question that rule leaves is the one this proof answers: not
 * "does this fact have two homes today" but "what becomes true the first time
 * somebody fills in the empty one".
 *
 * =============================================================================
 * IT READS TWO WORLDS, AND THE FIRST VERSION READ ONLY ONE, WRONGLY
 * =============================================================================
 *
 * The first version asserted, as its premise, that the gate reads PRELAUNCH.
 * It passed. It passed because its child process does not load `.env.local`,
 * so `FIRM_PHONE` was unset, the phone trading condition was unmet, and the
 * gate answered prelaunch IN THE PROOF while the build under test was made in
 * TRADING. A proof green about a world the site is not in.
 *
 * That is the ambient-state defect CLAUDE.md records against `partner-audit`,
 * written fresh into the proof for a different instance of the same family, by
 * the session writing up the first one.
 *
 * So it reads BOTH worlds and asserts the correct outcome for each, which is
 * what CLAUDE.md says to do with a check that depends on ambient state: read
 * the state and say out loud which one you saw.
 *
 *   as built    .env.local loaded, the same file `next build` loads. The firm
 *               is TRADING, sealing is available, and the copy is PRESENT
 *               tense, which is the sentence the firm is entitled to say.
 *   bare        no firm configuration at all, so no FIRM_PHONE and the gate is
 *               PRELAUNCH. Sealing is refused and the copy is FUTURE tense.
 *
 * THE SECOND WORLD IS WHAT MAKES THE CONJUNCT PROVABLE. In trading,
 * `isTrading()` is satisfied, so removing it changes nothing and an injection
 * there proves nothing. The prelaunch world is where it bites, and it is a real
 * deployment state rather than a contrivance: it is what this firm was, in
 * production, until FIRM_PHONE was set.
 *
 * WHY CHILD PROCESSES. CLAUDE.md section 6: a module level constant is read
 * once and a fresh `import()` is not fresh enough. `approvedProtocols` and the
 * launch conditions are exactly such constants, and the two worlds differ only
 * in the environment present at module load. Two processes, two answers.
 */
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";

/*
 * EVERY IMPORT IN THE READER IS DYNAMIC, AND THAT IS LOAD BEARING RATHER THAN
 * STYLE. The first version put `process.loadEnvFile(".env.local")` at the top
 * of the file above static imports, and the "as built" world came back reading
 * PRELAUNCH: ES module imports are HOISTED and evaluated before any top level
 * statement, so `launch.ts` and the config beneath it bound their module level
 * constants before the environment existed.
 *
 * That is exactly the hazard `scripts/lib/load-env.mjs` documents in its own
 * header under "IMPORT THIS FIRST", and it is the hazard I had just wrongly
 * accused `voice-audit` of, where the ordering is in fact correct because the
 * launch import there is dynamic. The defect was mine, one file over.
 *
 * A dynamic import runs when it is reached, so the env decision happens first.
 */
const reader = (loadEnv) => `
${loadEnv ? 'process.loadEnvFile(".env.local");' : "/* no firm configuration in this process */"}
const {
  isPrelaunch,
  isTrading,
  peInResponsibleCharge,
  sealingIsAvailable,
  sealingIsAvailableFor,
  launchMode,
} = await import("../../src/lib/launch.ts");
const { approvedProtocols } = await import("../../src/config/launch-readiness.ts");
const copy = await import("../../src/content/model-copy.ts");
console.log(JSON.stringify({
  mode: launchMode(),
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

function readWorld(label, loadEnv) {
  writeFileSync(READER_PATH, reader(loadEnv));
  try {
    /*
     * THE BARE WORLD IS MADE BARE, NOT MERELY LEFT UNLOADED, and the board is
     * what taught this. Run directly, this proof passed: nothing in its
     * environment carried the firm's configuration, so "do not load .env.local"
     * was the same as "have no FIRM_PHONE". Run by `proofs-audit` inside the
     * suite, the parent's environment DID carry it, the bare child inherited
     * it, both worlds came back trading, and six of fourteen checks failed.
     *
     * Not loading a file is not the same as not having a value. A world this
     * proof describes as having no firm configuration has to have none, which
     * means removing it rather than declining to add it. The variables stripped
     * are the ones the TRADING conditions read, which is what separates the two
     * worlds this proof exists to compare.
     */
    const env = { ...process.env };
    if (!loadEnv) {
      delete env.FIRM_PHONE;
      delete env.LAUNCH_MODE;
    }
    const r = spawnSync("npx", ["tsx", READER_PATH], { encoding: "utf8", shell: true, env });
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
 * The PRESENT tense branch of each of the three sentences, quoted from
 * model-copy.ts. Matched as the SENTENCE rather than on the word "sealed",
 * because both branches of all three contain that word and a matcher on it
 * would fire on the compliant copy. Match the thing you mean.
 */
const PRESENT = {
  responsibleCharge: "is reviewed and sealed by a Texas licensed Professional Engineer",
  deliverable: "Every deliverable is reviewed and sealed by",
  reviewStep: "Professional Engineer reviews the record",
};

const built = readWorld("as the build is made", true);
const bare = readWorld("with no firm configuration", false);

console.log(`as built: mode ${built.mode}.  bare: mode ${bare.mode}.`);
console.log("");

// --------------------------------------------------- the premise, in both

check(
  `the register holds an approved protocol (${built.approvedCount})`,
  built.approvedCount > 0 && bare.approvedCount > 0,
  built.approvedCount > 0
    ? built.approvedSlugs.join(", ")
    : "EMPTY, so every sentence below is future tense for a reason that is not the fix, and this proof would be vacuous",
);

check(
  "the two worlds really are different modes",
  built.mode === "trading" && bare.mode === "prelaunch",
  `as built ${built.mode}, bare ${bare.mode}. If these were equal the proof would be asserting one world twice.`,
);

check(
  "an engineer is in responsible charge in both",
  built.engineer === true && bare.engineer === true,
  "so the conjunct that differs between the two worlds is isTrading(), and nothing else",
);

// ------------------------------------------- as built: TRADING, and allowed

check(
  "as built: sealing IS available, because the firm is trading and a protocol is approved",
  built.sealing === true,
  `trading ${built.trading}, engineer ${built.engineer}, approved ${built.approvedCount}`,
);

check(
  "as built: the responsible charge paragraph is present tense",
  built.responsibleCharge.includes(PRESENT.responsibleCharge),
  built.responsibleCharge.slice(0, 80),
);

check(
  "as built: the deliverable sentence is present tense",
  built.deliverable.includes(PRESENT.deliverable),
  built.deliverable.slice(0, 80),
);

check(
  "as built: the review step is present tense",
  built.reviewStep.includes(PRESENT.reviewStep),
  built.reviewStep.slice(0, 80),
);

check(
  "as built: the APPROVED line may say its deliverable is sealed",
  built.sealingRoof === true,
  "roof-inspections has an approved protocol and the firm is trading",
);

/*
 * THE NARROW RULE, AND IT IS THE ONE THE SITEWIDE PREDICATE CANNOT EXPRESS.
 * `sealingIsAvailable()` asks whether ANY protocol is approved. One approved
 * line out of eleven would otherwise license a present tense sealing claim on
 * the ten that seal nothing.
 */
check(
  "as built: a line with NO approved protocol still may not",
  built.sealingUnapproved === false,
  "manufactured-home-foundations has no approved protocol, and the firm is trading",
);

// ------------------------------------------ bare: PRELAUNCH, and refused

check(
  "bare: sealing is NOT available, because the firm is not trading",
  bare.sealing === false,
  `trading ${bare.trading}, engineer ${bare.engineer}, approved ${bare.approvedCount}. This is the conjunct isTrading() doing the work.`,
);

check(
  "bare: the responsible charge paragraph stays future tense",
  !bare.responsibleCharge.includes(PRESENT.responsibleCharge),
  bare.responsibleCharge.slice(0, 80),
);

check(
  "bare: the deliverable sentence stays future tense",
  !bare.deliverable.includes(PRESENT.deliverable),
  bare.deliverable.slice(0, 80),
);

check(
  "bare: the review step stays future tense",
  !bare.reviewStep.includes(PRESENT.reviewStep),
  bare.reviewStep.slice(0, 80),
);

check(
  "bare: even the APPROVED line may not claim present tense sealing",
  bare.sealingRoof === false,
  "an approved protocol does not open the copy; trading does",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. An approved register does not open the copy; trading does."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
