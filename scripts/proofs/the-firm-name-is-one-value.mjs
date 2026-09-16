/**
 * PROOF: RENAMING THE FIRM IS ONE EDIT TO THE REGISTER.
 *
 * Operator ruling, 2026-09-15, on the Secretary of State amendment: when TBPELS
 * reissues F-29811 in the new name, the change must be one configuration value
 * and every rendered surface must follow it. This is the check that says so
 * rather than the claim that says so.
 *
 * WHY A CHILD PROCESS. CLAUDE.md section 6: a module level constant is read
 * once, and a fresh `import()` is not fresh enough, because a query string busts
 * one specifier and not the graph beneath it. `verifiedFirmRegistrations` is
 * exactly such a constant. Patching it in this process and re-importing would
 * read the value this process already bound, and the run would report the code
 * refusing correctly while proving nothing. So the register is patched on disk,
 * a child is spawned to read the world as it now is, and the file is restored in
 * a finally block whether the child passes, fails or throws.
 *
 * WHAT IT WOULD CATCH. A sentence that goes back to typing the name. That is
 * also what `compliance-audit` catches by scanning the source, and the two are
 * deliberately different questions: the audit asks whether the literal is
 * absent, this asks whether the RENDER actually moves. A file could pass the
 * first while rendering from some other stale copy of the name.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

const REGISTER = "src/config/credentials.ts";
const BACKUP = "src/config/credentials.ts.rename-proof.bak";
const TODAY = "254 Services LLC";
const RENAMED = "254 Engineering LLC";

/*
 * WHAT THIS READER ACTUALLY COVERS, SAID PLAINLY: the deriver itself, the
 * registration sentence, and ONE content module, in two of its fields. It does
 * not render the JSON-LD block, the email templates or the CSV export header,
 * which also derive the name; those need a request, a template argument and a
 * report respectively.
 *
 * Stating the coverage rather than implying it, because a proof that names four
 * surfaces and reads one is the sentence somebody would quote as evidence the
 * whole rename was verified. The absence of the literal everywhere else is what
 * `compliance-audit` asserts by scanning all 386 files, and that is the check
 * doing the breadth. This one does the depth: that the render actually moves.
 */
const READER = `
import { firmName, registrationStatement } from "../../src/lib/launch.ts";
const { location } = await import("../../src/content/location.ts");
console.log(JSON.stringify({
  firmName: firmName(),
  statement: registrationStatement(),
  locationDescription: location.description,
  locationBody: location.position[0],
}));
`;

const READER_PATH = "scripts/proofs/.rename-proof-reader.mts";

function readWorld(label) {
  writeFileSync(READER_PATH, READER);
  try {
    const r = spawnSync("npx", ["tsx", READER_PATH], { encoding: "utf8", shell: true });
    const line = (r.stdout || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{")).pop();
    if (!line) {
      console.error(`could not read the world ${label}. stderr:\n${(r.stderr || "").slice(-800)}`);
      process.exit(1);
    }
    return JSON.parse(line);
  } finally {
    try { unlinkSync(READER_PATH); } catch {}
  }
}

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const before = readWorld("before the rename");
check("firmName() reads the register today", before.firmName === TODAY, before.firmName);
check(
  "and the rendered sentences carry that name",
  before.locationDescription.includes(TODAY) && before.locationBody.includes(TODAY),
  "location description and body",
);

copyFileSync(REGISTER, BACKUP);
try {
  const src = readFileSync(REGISTER, "utf8");
  const anchor = `    issuedTo: "${TODAY}",`;
  if (src.split(anchor).length - 1 !== 1) {
    console.error(`the register does not carry exactly one ${anchor.trim()}`);
    process.exit(1);
  }
  writeFileSync(REGISTER, src.replace(anchor, `    issuedTo: "${RENAMED}",`));

  const after = readWorld("after the rename");
  check("one edit to issuedTo moves firmName()", after.firmName === RENAMED, after.firmName);
  check(
    "and the registration sentence with it",
    (after.statement || "").startsWith(RENAMED),
    after.statement,
  );
  check(
    "and every rendered sentence follows, with no trace of the old name",
    after.locationDescription.includes(RENAMED) &&
      after.locationBody.includes(RENAMED) &&
      !after.locationDescription.includes(TODAY) &&
      !after.locationBody.includes(TODAY),
    "location description and body",
  );
} finally {
  copyFileSync(BACKUP, REGISTER);
  unlinkSync(BACKUP);
  console.log(`\nregister restored to "${TODAY}"`);
}

const restored = readWorld("after restoring");
check("and the register is back as it was", restored.firmName === TODAY, restored.firmName);

console.log(wrong === 0 ? "\nAll checks correct. Reissuance is one value." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
