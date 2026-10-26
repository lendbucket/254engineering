/**
 * A REVIEW OF A FILE WORKED TO 254-FC-001 OR 254-PL-001 RECORDS ONE OF THE FIVE
 * APPENDIX C DETERMINATIONS, AS A ROOF REVIEW DOES, AND ONLY WHILE THE PROTOCOL
 * IS IN FORCE BY HIS SIGNATURE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/fc-and-pl-reviews-record-a-determination.mjs
 *
 * Operator ruling of 2026-10-23: determination recording for foundation
 * (254-FC-001) and permit letter (254-PL-001). governingDeclaration in
 * src/lib/protocol-run.ts decides which protocol governs a review; this proves
 * its answer for every signed protocol and every state a protocol row can be
 * in, and that the review path, the screen and the route all ask it.
 *
 * WHAT THIS DOES NOT DO: seal any letter. Ordering: both lines are offered
 * since ruling 2 of 2026-10-24, each sold only past its own door.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { governingDeclaration, REVIEWED_UNDER_SIGNATURE } = await import("../../src/lib/protocol-run.ts");
const { FC001 } = await import("../../src/content/protocols/fc-001.ts");
const { PL001 } = await import("../../src/content/protocols/pl-001.ts");
const { RS001 } = await import("../../src/content/protocols/rs-001.ts");
const { offeredServiceLines } = await import("../../src/config/launch-conditions.ts");

const FIVE = ["pass", "revise", "repairs-required", "site-revisit", "decline"];
const keys = (g) => (g ? g.determinations.map((d) => d.key).join(",") : "none");

/*
 * The set is the ruling, pinned as a literal here rather than read back.
 * 254-RS-001 joined by Robert's ruling of 2026-10-25, 23:51 Central, item C:
 * the engineer's own repair specification seals against his determination.
 */
check(
  "exactly 254-FC-001, 254-PL-001 and 254-RS-001 are reviewed under their signature",
  [...REVIEWED_UNDER_SIGNATURE].sort().join(",") === "254-FC-001,254-PL-001,254-RS-001",
  [...REVIEWED_UNDER_SIGNATURE].join(", "),
);

const rc = governingDeclaration("254-RC-001", "published");
check("254-RC-001 still governs from the registry, its five determinations", keys(rc) === FIVE.join(","), keys(rc));

for (const [doc, decl] of [["254-FC-001", FC001], ["254-PL-001", PL001], ["254-RS-001", RS001]]) {
  const g = governingDeclaration(doc, "published");
  check(`${doc} published governs, with Appendix C's five determinations`, keys(g) === FIVE.join(","), keys(g));
  check(
    `and every heading and criterion is the declaration's own text, word for word`,
    g !== null &&
      g.determinations.every((d, i) =>
        d.heading === decl.determinations[i].heading &&
        JSON.stringify(d.criteria) === JSON.stringify(decl.determinations[i].criteria)),
  );
  for (const status of ["draft", "awaiting_engineer", "voided", "retired", null]) {
    check(`${doc} ${status ?? "with no row"} governs nothing: no signature has it in force`, governingDeclaration(doc, status) === null);
  }
}

for (const doc of ["254-SL-001", "254-MH-001", "254-DS-001", "254-WS-001", "254-WP-001"]) {
  check(`${doc} published is not ruled into review, so it governs nothing`, governingDeclaration(doc, "published") === null);
}
check("an unknown document governs nothing", governingDeclaration("254-XX-001", "published") === null);
check("no document governs nothing", governingDeclaration(null, "published") === null);

/* The three places a review asks, each by a call, never a name. */
const engineer = readFileSync("src/lib/ops-engineer.ts", "utf8");
check(
  "decideReview takes the governing protocol from governingDeclaration, with the row's status",
  /const governing = governingDeclaration\(pkg\.protocolDocument, pkg\.protocolStatus\)/.test(engineer),
);
check("and the package carries that status from the file's protocol row", /protocolStatus: view\.protocol\?\.status \?\? null/.test(engineer));
const page = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check(
  "the review screen shows the rules governingDeclaration returns, the same text decideReview reads",
  /governingDeclaration\(selected\.protocolDocument, selected\.protocolStatus\)\?\.determinations/.test(page),
);
const route = readFileSync("src/app/api/portal/review/route.ts", "utf8");
check("the review route carries the permit letter's option and schedule to decideReview", /letterOption:/.test(route) && /letterConditions:/.test(route));
const client = readFileSync("src/app/portal/(app)/review/ReviewClient.tsx", "utf8");
check(
  "the panel will not send a permit letter pass without option A, or option B without a condition",
  /letterOption === "A" \|\|\s*\(letterOption === "B" && letterConditions\.length > 0\)/.test(client),
);

/*
 * OFFERED SINCE ROBERT'S RULING 2 OF 2026-10-24, AND STILL SOLD ONLY AT EACH
 * LINE'S OWN DOOR. This asserted that neither line was offered, the state that
 * ruling ended on purpose. What must stay true is that offering opens nothing
 * by itself: each line sells only when its signature stands and somebody is
 * trained on that version (the-gate-counts-a-protocol-signed-in-the-portal
 * proves the doors on a played database).
 */
const gate = readFileSync("src/lib/line-gate.ts", "utf8");
check(
  "both lines are offered under ruling 2, and each sells only past its own signature and training",
  offeredServiceLines.includes("foundation-inspections") &&
    offeredServiceLines.includes("structural-letters") &&
    /const status = await signatureStatus\(received\.documentNumber, received\.version\);/.test(gate) &&
    /return trainedInDatabase\(serviceSlug, received\.documentNumber, received\.version\);/.test(gate),
  offeredServiceLines.join(", "),
);
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("letter sealing still refuses every protocol but 254-RC-001", /if \(det\.protocol_document !== "254-RC-001"\)/.test(seal));

console.log("");
if (wrong === 0) {
  console.log("PASS: a foundation or permit letter review records its determination while the protocol is in force by signature, and nothing opens.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
