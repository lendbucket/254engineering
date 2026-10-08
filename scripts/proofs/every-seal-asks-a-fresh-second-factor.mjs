/**
 * EVERY SEAL ASKS A FRESH SECOND FACTOR, AND RECORDS THE MOMENT IT ANSWERED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-seal-asks-a-fresh-second-factor.mjs
 *
 * Control 4 in docs/sealing-controls.md, operator ruling of 2026-10-06: only
 * the engineer's own session, with a fresh second factor, can apply his seal.
 * FOUND BY THE INTEGRATION AUDIT OF 2026-10-07: nothing asserted it. The
 * database requires `mfa_verified_at` to be present (0061, 0062) and cannot
 * know whether it is fresh, so a door that dropped its verifyFreshCode call and
 * passed the current time would have sealed with no code typed, past every
 * check on the board.
 *
 * Three doors write a seal: a letter (eng_record_letter_seal), a protocol
 * signature (eng_record_protocol_signature) and a seal image
 * (eng_record_seal_image). For each, read from source, a STATED PROXY because a
 * live seal leaves rows on tables that refuse deletes:
 *
 *   1. the door calls verifyFreshCode before the record call;
 *   2. a failed code returns before the record call;
 *   3. the record call's p_mfa_verified_at is that result's verifiedAt, not a
 *      clock or anything else;
 * and, so a fourth door cannot appear unasserted:
 *   4. nothing else under src calls any of the three record functions.
 *
 * verifyFreshCode itself, the code being spent atomically, is mfa-audit's.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const DOORS = [
  { file: "src/lib/letter-seal.ts", rpc: "eng_record_letter_seal" },
  { file: "src/lib/protocol-sign.ts", rpc: "eng_record_protocol_signature" },
  { file: "src/lib/seal-store.ts", rpc: "eng_record_seal_image" },
];

for (const door of DOORS) {
  const src = readFileSync(door.file, "utf8");
  const call = src.match(/const (\w+) = await verifyFreshCode\(/);
  const v = call?.[1];
  const callAt = call ? src.indexOf(call[0]) : -1;
  const rpcAt = src.indexOf(`rpc("${door.rpc}"`);
  check(`${door.file}: asks verifyFreshCode before ${door.rpc}`, callAt >= 0 && rpcAt > callAt, `code at ${callAt}, record at ${rpcAt}`);

  const refusal = v ? src.indexOf(`if (!${v}.ok) return`, callAt) : -1;
  check(`${door.file}: and a failed code returns before the record`, refusal > callAt && refusal < rpcAt, v ? `if (!${v}.ok) return` : "no result variable");

  const block = rpcAt >= 0 ? src.slice(rpcAt, src.indexOf("});", rpcAt)) : "";
  check(
    `${door.file}: and records the moment that code answered`,
    Boolean(v) && new RegExp(`p_mfa_verified_at:\\s*${v}\\.verifiedAt`).test(block),
    (block.match(/p_mfa_verified_at:[^,\n]*/) ?? ["p_mfa_verified_at not passed"])[0],
  );
}

/* 4. No other door. */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p.split("\\").join("/"));
  }
};
walk("src");
const others = files.filter((f) => {
  if (DOORS.some((d) => d.file === f)) return false;
  const s = readFileSync(f, "utf8");
  return DOORS.some((d) => s.includes(`"${d.rpc}"`));
});
check("the source tree was read", files.length > 100, `${files.length} files`);
check("and no other file calls a seal record function", others.length === 0, others.join(", ") || "three doors, all asserted above");

console.log("");
if (wrong === 0) {
  console.log("PASS: every seal asks a fresh second factor, and records the moment it answered.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
