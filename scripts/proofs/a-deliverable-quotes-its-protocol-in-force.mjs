/**
 * A DELIVERABLE QUOTES ITS PROTOCOL IN FORCE, OR SAYS IT IS PENDING. Robert,
 * 09:28 Central 2026-10-30.
 *
 * The windstorm completed line's "what you receive" read "The scope of this
 * service is published here once the engineer of record signs its protocol."
 * after 254-WS-001 was signed and in force. So did five other lines and six
 * service pages. protocol-registry-audit carried the rule but only knew the
 * paper-signed 254-RC-001, and it needs the development database to run at all,
 * so nothing before a board could see it.
 *
 * This proof applies the same rule (scripts/lib/receives-check.mjs) with no
 * database: every portal-signed line is compared with its protocol's
 * transcription, the paper-signed lines are left to the audit, and every line
 * whose protocol is in force is refused the pending sentence and any other
 * pre-signature wording. The preflight runs it among the static proofs.
 *
 * The pending sentence is written out here as a literal, never imported.
 */
import { inForceResolver, checkReceives, receivesEntries } from "../lib/receives-check.mjs";

const PENDING = "The scope of this service is published here once the engineer of record signs its protocol.";

const catalog = await import("../../data/catalog.ts");
const { services } = await import("../../src/content/services.ts");
const { PROTOCOL_ENTRIES } = await import("../../src/content/protocols/index.ts");
const { SIGNABLE_PROTOCOLS, HELD_OUT_OF_FORCE } = await import("../../src/content/protocols/signable.ts");
const { OWN_PROTOCOL_REQUIRED, SCOPE_NOT_STATED_BY_ITS_PROTOCOL } = await import("../../src/config/own-protocol.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

const { inForceFor, inForceSet } = inForceResolver({
  PROTOCOL_ENTRIES,
  SIGNABLE_PROTOCOLS,
  HELD_OUT_OF_FORCE,
  OWN_PROTOCOL_REQUIRED,
  SCOPE_NOT_STATED_BY_ITS_PROTOCOL,
  paperText: () => undefined,
});
/*
 * The real-estate letter sells under 254-PL-001 since Robert's ruling of 20:08
 * Central 2026-11-15, and PL-001's deliverable sentences describe a letter to a
 * permitting authority. So for what it RECEIVES it borrows none and reads as
 * pending, declared by name in SCOPE_NOT_STATED_BY_ITS_PROTOCOL, and counted so
 * the exemption cannot quietly grow.
 */
check(
  "the real estate letter, sold under PL-001 whose sentences do not describe it, borrows none for what it receives: it reads as pending",
  inForceFor({ serviceSlug: "structural-letters", tier: "real-estate" }) === null &&
    inForceFor({ serviceSlug: "structural-letters", tier: "standard" })?.documentNumber === "254-PL-001",
);
check(
  "and that exemption is exactly one deliverable, named",
  JSON.stringify(Object.keys(SCOPE_NOT_STATED_BY_ITS_PROTOCOL)) === JSON.stringify(["structural-letters/real-estate"]),
  Object.keys(SCOPE_NOT_STATED_BY_ITS_PROTOCOL).join(", "),
);

check(
  "the protocols in force are the code's declared set, and it holds 254-WS-001",
  inForceSet.includes("254-WS-001") && inForceSet.includes("254-RC-001") && inForceSet.length >= 7,
  `in force: ${inForceSet.join(", ")}`,
);
check(
  "the windstorm completed line reads 254-WS-001, and the ongoing tier, held, reads none",
  inForceFor({ serviceSlug: "windstorm-wpi-8", tier: "completed" })?.documentNumber === "254-WS-001" &&
    inForceFor({ serviceSlug: "windstorm-wpi-8", tier: "ongoing" }) === null,
);
check("the catalogue's pending sentence is the operator's wording", catalog.SCOPE_PENDING === PENDING);

const entries = receivesEntries(catalog, services);
const { wrong, quoted, pending, skipped, itemsCompared } = checkReceives(entries, inForceFor, PENDING);

check(
  "no line whose protocol is in force carries the pending sentence or other pre-signature wording, and every portal-signed line quotes its transcription",
  wrong.length === 0,
  wrong.length ? wrong.join("; ") : `${quoted.length} quoted, ${pending.length} pending, ${skipped.length} paper-signed left to the audit`,
);
check(
  "and it had something to check: portal-signed lines quoted, pending lines present, items compared",
  quoted.length >= 12 && pending.length > 0 && itemsCompared > 0 && quoted.some((q) => q.startsWith("windstorm-wpi-8/completed")),
  `${quoted.length} quoted, ${itemsCompared} item(s) compared, pending: ${pending.join(", ")}`,
);

const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(`FAIL: ${failed} check(s).`);
  process.exitCode = 1;
} else {
  console.log("PASS: every deliverable quotes its protocol in force, or says it is pending, and none in force says it waits on a signature.");
}
