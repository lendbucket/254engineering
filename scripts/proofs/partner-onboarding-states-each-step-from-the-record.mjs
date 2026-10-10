/**
 * PARTNER ONBOARDING STATES EACH STEP FROM THE RECORD, AND INVENTS NO LEGAL TEXT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/partner-onboarding-states-each-step-from-the-record.mjs
 *
 * Run item 19 of 2026-10-10. Agreement acceptance is by version and to the
 * moment: the acceptance writes the version and a database stamp, refuses a
 * version that is not the current one, and the partner sees the time and zone,
 * not only the date. A step whose text is with counsel reads "awaiting counsel",
 * and no agreement or training text is typed into the source.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const portal = readFileSync("src/lib/ops-partner-portal.ts", "utf8");
const at = portal.indexOf("const acceptedAt = DB_NOW;");
check("acceptance is stamped by the database, one value for both columns", at !== -1);
check(
  "and records the version and the moment in the acceptances log and on the partner",
  /eng_partner_acceptances"\)\.insert\(\{[\s\S]*?agreement_version: version,[\s\S]*?accepted_at: acceptedAt/.test(portal) &&
    portal.includes(".update({ agreement_version: version, agreement_accepted_at: acceptedAt })"),
);
check("and refuses a version that is not the current one", portal.includes("if (agreement.version !== version)"));

const agreementPage = readFileSync("src/app/partner/(app)/agreement/page.tsx", "utf8");
const home = readFileSync("src/app/partner/(app)/page.tsx", "utf8");
for (const [name, text] of [["the agreement page", agreementPage], ["the partner home", home]]) {
  check(`${name} shows the acceptance with its time and zone`, /hour: "numeric",\s*minute: "2-digit",[\s\S]{0,40}\} CT`/.test(text));
}
check("with no agreement published, the agreement page says it is awaiting counsel", agreementPage.includes("The program agreement is awaiting counsel"));
check("the home's set up steps say awaiting counsel for the agreement and for training", (home.match(/Awaiting counsel\./g) ?? []).length === 2);

/* No legal text typed: the agreement body is only ever the published database row. */
check("the agreement's text is read from the published row, never typed", agreementPage.includes("agreement?.body ??") && !/Terms of the program|hereby agree|indemnif/i.test(agreementPage + home));

console.log("");
if (wrong === 0) {
  console.log("PASS: partner onboarding states each step from the record, and invents no legal text.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
