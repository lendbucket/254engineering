/**
 * A PROTOCOL OFFERED FOR SIGNATURE IS ONE SOMETHING READS, AND A WITHDRAWN ONE
 * IS REFUSED BY NAME.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-signable-protocol-is-one-something-reads.mjs
 *
 * Issue #1 comment 6449724196 (2026-10-27, 1 pm Central): any document the
 * portal offers the engineer that no gate, door or pay figure reads is withdrawn,
 * and a document a door reads is never withdrawn. 254-DS-001 v1.1 is the one
 * withdrawn: design is a desk line paid on its accepted quote and his signed
 * addendum, with no protocol (Robert's answer 1 of 2026-10-27).
 *
 * What reads a signature: line-gate.ts finds each non-desk offered line's
 * protocol in SIGNABLE_PROTOCOLS by line and tier, and asks for its signature at
 * every money door. The selection rule is restated here from the declarations,
 * not imported from line-gate, so the two can disagree. No database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const signable = await import("../../src/content/protocols/signable.ts");
const { SIGNABLE_PROTOCOLS, WITHDRAWN_PROTOCOLS, SIGNABLE_AT_0081, signableProtocol, withdrawnRefusal } = signable;
const { offeredServiceLines, deskLines } = await import("../../src/config/launch-conditions.ts");

/* The ruled withdrawal, pinned. A second costs this edit and the one in signable.ts. */
const WITHDRAWN_RULED = ["254-DS-001"];
const withdrawnNumbers = WITHDRAWN_PROTOCOLS.map((p) => p.documentNumber).sort();
check("exactly the ruled document is withdrawn from signing", withdrawnNumbers.join("|") === WITHDRAWN_RULED.join("|"), withdrawnNumbers.join(", ") || "none");
check("and the offered list is what remains of the texts 0081 was written from", SIGNABLE_PROTOCOLS.length + WITHDRAWN_PROTOCOLS.length === SIGNABLE_AT_0081.length, `${SIGNABLE_PROTOCOLS.length} + ${WITHDRAWN_PROTOCOLS.length} of ${SIGNABLE_AT_0081.length}`);

/* Every offered text is the one a line's money door would read. */
const doorReads = (slug, tier) =>
  SIGNABLE_PROTOCOLS.find((p) => p.serviceSlug === slug && p.serviceTier === (tier ?? null)) ??
  SIGNABLE_PROTOCOLS.find((p) => p.serviceSlug === slug && !p.serviceTier);
for (const p of SIGNABLE_PROTOCOLS) {
  const offered = offeredServiceLines.includes(p.serviceSlug) && !deskLines.includes(p.serviceSlug);
  const read = doorReads(p.serviceSlug, p.serviceTier) === p;
  check(`${p.documentNumber} v${p.version} is read: its line ${p.serviceSlug}${p.serviceTier ? `/${p.serviceTier}` : ""} is offered, not a desk line, and its door picks this text`, offered && read);
}

/* Every withdrawn text is read by nothing, and the door refuses it by name. */
for (const p of WITHDRAWN_PROTOCOLS) {
  const readByALine = offeredServiceLines.includes(p.serviceSlug) && !deskLines.includes(p.serviceSlug);
  check(`${p.documentNumber}: no line reads it (${p.serviceSlug} is a desk line or not offered)`, !readByALine);
  check(`${p.documentNumber}: it is not offered for signature`, !SIGNABLE_PROTOCOLS.some((s) => s.documentNumber === p.documentNumber) && signableProtocol(p.documentNumber) === undefined);
  const refusal = withdrawnRefusal(p.documentNumber);
  check(`${p.documentNumber}: the signing door's refusal names it and says when`, typeof refusal === "string" && refusal.includes(p.documentNumber) && refusal.includes("2026-10-27"), refusal ?? "no refusal");
}
check("and an offered document gets no withdrawal refusal", SIGNABLE_PROTOCOLS.every((p) => withdrawnRefusal(p.documentNumber) === null));

/* The door asks the withdrawal first, before it looks the text up. */
const door = readFileSync("src/lib/protocol-sign.ts", "utf8");
const body = door.slice(door.indexOf("export async function signProtocol("));
const refuseAt = body.indexOf("withdrawnRefusal(input.documentNumber)");
const lookupAt = body.indexOf("signableProtocol(input.documentNumber)");
check("the signing door refuses a withdrawn document before it looks the text up", refuseAt > 0 && lookupAt > refuseAt && /if \(withdrawn\) return \{ ok: false, error: withdrawn \}/.test(body));

/* Only the history reads the 0081 list: nothing under src offers from it. */
const screen = readFileSync("src/app/portal/(app)/protocols/page.tsx", "utf8");
check("the protocols screen lists SIGNABLE_PROTOCOLS, the offered texts", /SIGNABLE_PROTOCOLS\.map/.test(screen) && !screen.includes("SIGNABLE_AT_0081"));
for (const file of ["src/lib/line-gate.ts", "src/lib/launch.ts", "src/lib/protocol-sign.ts"]) {
  check(`${file} does not read the 0081 list`, !readFileSync(file, "utf8").includes("SIGNABLE_AT_0081"));
}

console.log(wrong === 0 ? "\nPASS: every protocol offered for signature is one a line reads, and a withdrawn one is refused by name." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
