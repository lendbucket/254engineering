/**
 * A PARTNER ASSET TAKES ITS REGISTRATION FROM THE REGISTER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-asset-takes-its-registration-from-the-register.mjs
 *
 * Run item 15 of 2026-10-10, product audit defect 14: the approved asset "Who
 * performs the work" typed the registration in when it was written, and went on
 * telling partners it was pending after F-29811 issued. An asset now carries
 * [firm registration], which the library fills from the register on every read,
 * and publishing refuses a registration fact typed by hand.
 *
 * The filled sentence is compared against a PINNED LITERAL rather than against
 * registrationStatement(), which would agree with itself by construction.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { REGISTRATION_PLACEHOLDER, fillRegistration, typedRegistration } = await import("../../src/lib/partner-copy.ts");

/* The register today, as a literal. Moves only by two deliberate edits. */
const PINNED = "254 Engineering LLC is a Texas registered engineering firm, TBPELS Firm Registration F-29811.";

const approved =
  "Engineering work referred through this program will be carried out by 254 Engineering. " + REGISTRATION_PLACEHOLDER;
const filled = fillRegistration(approved);
check("the placeholder is filled with the register's sentence", filled === approved.replace(REGISTRATION_PLACEHOLDER, PINNED), filled ?? "null");
check("and nothing of the placeholder is left in what a partner reads", filled !== null && !filled.includes(REGISTRATION_PLACEHOLDER));
check("with no active registration, an asset that must state it is withheld", fillRegistration(approved, null) === null);
check("an asset with no placeholder is returned as approved", fillRegistration("Plain copy.", null) === "Plain copy.");

/* The stale wording, and the shapes a person would type instead of the placeholder. */
for (const typed of [
  "Firm registration is pending with TBPELS.",
  "254 Engineering LLC, Firm F-29811, performs the work.",
  "The firm is not yet registered.",
]) {
  check(`publishing refuses a typed registration fact: "${typed}"`, typedRegistration(typed).length > 0);
}
check("and the placeholder itself is not a typed fact", typedRegistration(approved).length === 0);

/* The wiring: the read fills, the publish refuses before it writes a version. */
const src = readFileSync("src/lib/ops-partner-assets.ts", "utf8");
const pub = src.slice(src.indexOf("export async function publishAsset("));
check(
  "publishAsset checks for typed registration before it writes a version",
  pub.indexOf("typedRegistration(") !== -1 && pub.indexOf("typedRegistration(") < pub.indexOf('from("eng_partner_asset_versions")'),
);
const read = src.slice(src.indexOf("export async function publishedAssets("), src.indexOf("export async function assetDownloadUrl("));
check("publishedAssets fills the placeholder on every read", read.includes("fillRegistration("));

const seed = readFileSync("scripts/seed-field-demo.mjs", "utf8");
check("the seeded asset carries the placeholder, not a frozen sentence", seed.includes("REGISTRATION_PLACEHOLDER,") && !seed.includes("registrationStatement()"));

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner asset takes its registration from the register.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
