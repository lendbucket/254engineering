/**
 * THE STORE REVIEWER SIGNS IN WITHOUT THE SECOND FACTOR BY ONE ID, UNDER ONE
 * ROLE, AND MATCHES NOBODY UNTIL ROBERT SUPPLIES THE ID.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-store-reviewer-signs-in-by-one-id.mjs
 *
 * Robert's answer 29 of 2026-11-14 on issue #1: a fifth named override, for the
 * reviewer technician's id alone, sign in only, every sign in audited, shown on
 * /portal/launch. The id is the one value he supplies.
 *
 * TWO HALVES. The declaration as it stands is asserted inert: no id is set, so
 * nothing matches, the probe included. Then the SAME two modules are copied to
 * a temporary directory with a probe id written into the copy, and asked every
 * question the session route asks. A copy at a new path is a new module, so
 * nothing bound at first import stands in for the patch, and the source file is
 * never written.
 */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* Pinned here as literals, never imported as the expectation. */
const RULED_ON = "2026-11-14";
const REVIEWER_ID = null;
/* Carries hex letters, so its upper case form is a different string: an all-digit probe cannot test case. */
const PROBE = "abcdef33-3333-4333-8333-33333333abcd";
const OWNER_TECH = "c9d46cd2-9ee3-4479-9768-2b27e13c0044";
const OTHER = "11111111-1111-4111-8111-111111111111";

/* ---- the declaration as it stands ---- */
const live = await import("../../src/lib/owner-override.ts");
const liveFactor = await import("../../src/lib/sign-in-factor.ts");
check(
  "the declaration holds the pinned id (none yet) and the ruling date, and nothing else",
  live.STORE_REVIEWER_OVERRIDE.reviewerUserId === REVIEWER_ID &&
    live.STORE_REVIEWER_OVERRIDE.ruledOn === RULED_ON &&
    Object.keys(live.STORE_REVIEWER_OVERRIDE).length === 2,
  JSON.stringify(live.STORE_REVIEWER_OVERRIDE),
);
check(
  "with no id set, nobody is the reviewer: a probe, the owner's technician, an empty and a missing id",
  [PROBE, OWNER_TECH, OTHER, "", null, undefined].every((id) => !live.isStoreReviewer(id)),
);
check(
  "and a technician who is not enrolled is sent to enrolment",
  liveFactor.signInFactor({ profileId: PROBE, role: "field_tech", enrolled: false, requirement: "required" }).next === "/portal/mfa/enrol",
);
check(
  "the record carries the reviewer's own summary and ruling date",
  live.SIGN_IN_OVERRIDE_RECORD.sign_in_second_factor_reviewer?.ruledOn === RULED_ON &&
    /^Store reviewer override used: /.test(live.SIGN_IN_OVERRIDE_RECORD.sign_in_second_factor_reviewer?.summary ?? ""),
);

/* ---- the same modules with an id written into a copy ---- */
const dir = mkdtempSync(join(tmpdir(), "reviewer-override-"));
try {
  const declared = readFileSync("src/lib/owner-override.ts", "utf8");
  const marker = "reviewerUserId: null,";
  check("the copy finds the one line it patches", declared.split(marker).length === 2);
  writeFileSync(join(dir, "owner-override.ts"), declared.replace(marker, `reviewerUserId: "${PROBE}",`));
  writeFileSync(join(dir, "sign-in-factor.ts"), readFileSync("src/lib/sign-in-factor.ts", "utf8"));
  const set = await import(pathToFileURL(join(dir, "owner-override.ts")).href);
  const { signInFactor } = await import(pathToFileURL(join(dir, "sign-in-factor.ts")).href);
  const ask = (over) => signInFactor({ profileId: PROBE, role: "field_tech", enrolled: false, requirement: "required", ...over });

  check("the copy reads the id it was given", set.STORE_REVIEWER_OVERRIDE.reviewerUserId === PROBE);
  const r = ask({});
  check(
    "the reviewer id under field_tech, not enrolled, signs in with a full session and the reviewer override named",
    r.factor === "full" && r.next === null && r.ownerOverride === "sign_in_second_factor_reviewer",
    JSON.stringify(r),
  );
  check(
    "the reviewer id under any other required role is not exempt",
    ["admin", "ops_manager", "rep", "engineer"].every((role) => ask({ role }).ownerOverride === null),
  );
  check("if the reviewer enrols, he is challenged like anybody enrolled", ask({ enrolled: true }).next === "/portal/mfa");
  check(
    "nothing that resembles the id is exempt, and another technician is sent to enrolment",
    [PROBE.toUpperCase(), ` ${PROBE}`, `${PROBE} `, PROBE.slice(0, 8), "", OTHER].every((id) => ask({ profileId: id }).ownerOverride === null),
  );
  check("the reviewer is not the owner: no owner exemption reaches the id", !set.isOwnerFieldTech(PROBE) && !set.isOwnerAdmin(PROBE));
  check(
    "and the owner's own technician sign in is unchanged beside it",
    ask({ profileId: OWNER_TECH }).ownerOverride === "sign_in_second_factor_tech",
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/* ---- sign in only: the reviewer predicate is read by the sign in decision and nowhere else ---- */
const { readdirSync } = await import("node:fs");
const readers = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && /isStoreReviewer\(/.test(readFileSync(p, "utf8"))) readers.push(p);
  }
};
walk("src");
check(
  "isStoreReviewer is called only by the sign in decision and its own declaration",
  readers.sort().join(",") === "src/lib/owner-override.ts,src/lib/sign-in-factor.ts",
  readers.join(", "),
);

/* ---- shown on /portal/launch, from the declaration ---- */
const launch = readFileSync("src/app/portal/(app)/launch/page.tsx", "utf8");
check(
  "the launch screen renders the reviewer override from the declaration, in force or not",
  /title="Store reviewer override"/.test(launch) && /STORE_REVIEWER_OVERRIDE\.reviewerUserId \?/.test(launch),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the store reviewer signs in without the second factor by one id under field_tech, and matches nobody until the id is set.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
