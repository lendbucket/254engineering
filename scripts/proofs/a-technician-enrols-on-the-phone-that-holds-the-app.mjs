/**
 * PROOF: A TECHNICIAN CAN ENROL THE SECOND FACTOR ON THE PHONE THAT HOLDS THE
 * AUTHENTICATOR, AND THE OWNER OVERRIDE STILL HOLDS.
 *
 * Robert's T7, 2026-11-07: "second factor enrollment on the phone for
 * technicians, with the owner override kept."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-technician-enrols-on-the-phone-that-holds-the-app.mjs
 *
 *   A  the enrol screen: the link that hands the otpauth uri to the phone's
 *      authenticator is visible without opening the typed fallback, it comes
 *      after the QR (which stays the primary path at a desk), and the typed
 *      secret is still offered behind "Cannot scan it".
 *   B  the field technician's second factor is required in the role seed, and
 *      the owner's two named overrides are still the only way past it.
 *
 * This proves the markup and the rules. That the link opens an authenticator
 * on a real phone is a thing only a phone can show, and it is the T3 and T4
 * phone pass's to show.
 */
import { readSource } from "../lib/read-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* --------------------------------------------------------------- A, the screen */

const form = readSource("src/app/portal/(public)/mfa/enrol/EnrolForm.tsx");
const qrAt = form.indexOf("dangerouslySetInnerHTML={{ __html: qr }}");
const linkAt = form.indexOf("href={uri}");
const detailsAt = form.indexOf("<details");
const detailsEnd = form.indexOf("</details>");
check("A: the screen draws the QR", qrAt > 0);
check("A: it carries one link to the otpauth uri", linkAt > 0 && form.indexOf("href={uri}", linkAt + 1) === -1);
check(
  "A: that link is outside the typed fallback, so it needs no second tap to find",
  linkAt > 0 && detailsAt > 0 && !(linkAt > detailsAt && linkAt < detailsEnd),
);
check("A: and it comes after the QR, which stays the primary path at a desk", linkAt > qrAt);
check("A: it says it is for the phone that holds the app", /Open your authenticator app on this phone/.test(form));
check("A: the typed secret is still offered behind Cannot scan it", /Cannot scan it/.test(form) && form.slice(detailsAt, detailsEnd).includes("{secret}"));

/* ------------------------------------------------- B, required, and the owner */

const migrations = readSource("supabase/migrations/0103_the_second_factor_is_required_for_the_field_technician.sql");
check("B: 0103 requires the second factor for the field technician", /field_tech/.test(migrations) && /required/.test(migrations));

const factor = readSource("src/lib/sign-in-factor.ts");
const overrides = [...factor.matchAll(/ownerOverride: "([a-z_]+)"/g)].map((m) => m[1]).sort();
check(
  "B: the only ways past a required factor are the owner's two named overrides",
  JSON.stringify(overrides) === JSON.stringify(["sign_in_second_factor", "sign_in_second_factor_tech"]),
  overrides.join(", "),
);
check("B: the technician override is the owner's field technician id, by isOwnerFieldTech", factor.includes("isOwnerFieldTech("));

console.log(wrong === 0 ? "PASS: a technician enrols on the phone that holds the app." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
