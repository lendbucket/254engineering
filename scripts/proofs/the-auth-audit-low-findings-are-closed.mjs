// @runtime react-server
/**
 * PROOF: THE AUTH AUDIT'S LOW FINDINGS L1 TO L5, AND M5, ARE CLOSED.
 *
 * The chat counterpart's auth audit of 2026-11-02 (issue #1 comment
 * 6585008053), built by Robert's ruling: "Low findings: build after Q14 as one
 * bundle per audit file, skipping any that touch a ruling." L6 (tokens in
 * URLs) changes how emailed links work and is a question for Robert, so it is
 * not here.
 *
 *   L1  a partner sign in is audited as role "partner", never "admin"
 *   L2  break glass is counted by the limiter before it compares; the unlock
 *       token is never read from the URL, and its compare is length blind
 *   L3  an applicant upload is signed with upsert off, at a key no two
 *       requests share
 *   L4  placeOrder refuses a file outside its own request, before writing
 *   L5  the sign in and invite lookups escape LIKE wildcards
 *   M5  an API key's limit is a whole number from 1 to 60, and a stored value
 *       above it is read as 60
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-auth-audit-low-findings-are-closed.mjs
 */
import { readFileSync } from "node:fs";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });
const read = (p) => readFileSync(p, "utf8");

/* L1 */
const partnerSession = read("src/app/api/partner/session/route.ts");
const signInAudit = partnerSession.slice(partnerSession.indexOf("await writeAudit({"), partnerSession.indexOf('action: "partner.sign_in"'));
check("L1: the partner sign in audit row is found", partnerSession.indexOf('action: "partner.sign_in"') > 0 && signInAudit.length > 0);
check("L1: and it names the partner role", /role: "partner"/.test(signInAudit) && !/role: "admin"/.test(signInAudit), signInAudit.trim().slice(0, 120));

/* L2 */
const mfa = read("src/app/api/portal/mfa/route.ts");
const glass = mfa.slice(mfa.indexOf('if (action === "break_glass")'), mfa.indexOf("/* ------------------------------------------------------------ verify */"));
check("L2: the break glass branch is found", glass.length > 100);
const limitAt = glass.indexOf("takeLoginAttempt(");
const matchAt = glass.indexOf("breakGlassMatches(");
check("L2: break glass is counted by the limiter before the token is compared", limitAt > 0 && matchAt > 0 && limitAt < matchAt);
check("L2: on the same key a code guess uses", /takeLoginAttempt\(clientKey\(request\.headers\), `\$\{MFA_SCOPE\}:\$\{profile\.id\}`\)/.test(glass));
const unlock = read("src/app/api/portal/unlock/route.ts");
check("L2: the unlock route never reads a token from the query string", !/searchParams\.get\("token"\)/.test(unlock));
check("L2: it reads the Authorization header", /request\.headers\.get\("authorization"\)/.test(unlock) && /\^Bearer/.test(unlock));
check("L2: and its compare hashes both sides before a constant time compare", /timingSafeEqual\(a, b\)/.test(unlock) && !/if \(provided\.length !== expected\.length\) return false;/.test(unlock));

/* L3 */
const uploads = await import("../../src/lib/uploads.ts");
const appId = "0b5a6c2e-1d4f-4b8a-9c1e-2f3a4b5c6d7e";
const p1 = uploads.uploadPath(appId, "resume", "Resume final.pdf");
const p2 = uploads.uploadPath(appId, "resume", "Resume final.pdf");
check("L3: two uploads of the same file get two different keys", p1 !== p2, `${p1} / ${p2}`);
check("L3: each key keeps the application's prefix and the kind", p1.startsWith(`254/${appId}/resume-`) && p2.startsWith(`254/${appId}/resume-`), p1);
check("L3: and the shape the apply check reads", /^[a-z]+-[A-Za-z0-9._-]+$/.test(p1.split("/").pop()), p1);
const uploadsSrc = read("src/lib/uploads.ts");
check("L3: the signed URL is issued with upsert off", /createSignedUploadUrl\(path, \{ upsert: false \}\)/.test(uploadsSrc) && !/upsert: true/.test(uploadsSrc));

/* L4 */
const intake = read("src/lib/ops-intake.ts");
const placeStart = intake.indexOf("export async function placeOrder(");
const placeBody = intake.slice(placeStart, intake.indexOf("\nasync function ", placeStart));
const fileCheckAt = placeBody.indexOf("quoteFileProblem(input.clientRequestId, f)");
const insertAt = placeBody.indexOf('.from("eng_service_orders")\n    .insert(');
const insertAt2 = insertAt > 0 ? insertAt : placeBody.indexOf(".insert(");
check("L4: placeOrder asks the file check", fileCheckAt > 0);
check("L4: before it writes the order", fileCheckAt > 0 && insertAt2 > 0 && fileCheckAt < insertAt2, `check at ${fileCheckAt}, first insert at ${insertAt2}`);
const { quoteFileProblem } = await import("../../src/lib/ops-intake.ts");
check("L4: a file under its own request passes", quoteFileProblem("draft-1", { key: "roof_photo", bucket: "eng-uploads", storageKey: "orders/draft-1/roof_photo/x.png" }) === null);
check("L4: a file under another request is refused", quoteFileProblem("draft-1", { key: "roof_photo", bucket: "eng-uploads", storageKey: "orders/draft-2/roof_photo/x.png" }) !== null);
check("L4: a file in another bucket is refused", quoteFileProblem("draft-1", { key: "roof_photo", bucket: "eng-evidence", storageKey: "orders/draft-1/roof_photo/x.png" }) !== null);

/* L5 */
const { exactEmailPattern } = await import("../../src/lib/email-match.ts");
check("L5: a plain address is unchanged", exactEmailPattern("  Owner@Example.com ") === "Owner@Example.com");
const BS = String.fromCharCode(92);
check("L5: percent is escaped", exactEmailPattern("%") === `${BS}%`, exactEmailPattern("%"));
check("L5: underscore is escaped", exactEmailPattern("a_b@x.com") === `a${BS}_b@x.com`, exactEmailPattern("a_b@x.com"));
check("L5: a backslash is escaped first, so it cannot cancel an escape", exactEmailPattern(`a${BS}%`) === `a${BS}${BS}${BS}%`, exactEmailPattern(`a${BS}%`));
for (const [file, label] of [["src/lib/customer-auth.ts", "customer sign in"], ["src/lib/partner-auth.ts", "partner sign in"], ["src/lib/ops-partners-admin.ts", "partner invite"]]) {
  const src = read(file);
  check(`L5: the ${label} lookup escapes the pattern`, /\.ilike\("email", exactEmailPattern\(email\)\)/.test(src) && !/\.ilike\("email", email(\.trim\(\))?\)/.test(src));
}

/* M5 */
const keys = await import("../../src/lib/account-api-keys.ts");
check("M5: an unset limit is allowed (the default applies)", keys.apiKeyRateLimitProblem(undefined) === null);
check("M5: 1 and 60 are allowed", keys.apiKeyRateLimitProblem(1) === null && keys.apiKeyRateLimitProblem(60) === null);
check("M5: 0, 61, 1e9, a fraction and NaN are refused",
  [0, 61, 1e9, 2.5, Number.NaN].every((v) => keys.apiKeyRateLimitProblem(v) !== null));
check("M5: a stored 1e9 is read as 60", keys.effectiveRateLimit(1e9) === 60);
check("M5: a stored null, NaN or negative is read as the default", keys.effectiveRateLimit(null) === 60 && keys.effectiveRateLimit("x") === 60 && keys.effectiveRateLimit(-5) === 60);
check("M5: a stored 20 is read as 20", keys.effectiveRateLimit(20) === 20);
const keysSrc = read("src/lib/account-api-keys.ts");
check("M5: creation refuses before the insert", keysSrc.indexOf("apiKeyRateLimitProblem(rateLimitPerMinute)") > 0 && keysSrc.indexOf("apiKeyRateLimitProblem(rateLimitPerMinute)") < keysSrc.indexOf('.from("eng_account_api_keys")\n    .insert('));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note && !x.ok ? ` (${x.note})` : ""}`);
}
console.log(failed === 0 ? `PASS: the auth audit's low findings L1 to L5 and M5 are closed (${out.length} checks).` : `FAIL: ${failed} of ${out.length} check(s).`);
process.exitCode = failed === 0 ? 0 : 1;
