/**
 * PROOF: THE NOINDEX SURFACES CARRY THEIR OWN DESCRIPTIONS, AND THE ORDERING
 * API'S GET ANSWER NAMES NO INTERNAL FILE.
 *
 * The chat counterpart's live site audit of 2026-11-02 (issue #1 comment
 * 6585009543), low findings, built under Robert's ruling of the same day:
 *
 *   issue 7   GET /api/v1/orders answered "This endpoint accepts POST only. See
 *             docs/ordering-api.md.", naming a repository path the public does
 *             not have.
 *   issue 12  the order start, order status, portal, account, partner and
 *             onboarding surfaces reused the home page's meta description.
 *
 * Recorded, not changed: issue 8 (/api/portal/health answers {"ok":true} to an
 * unauthenticated GET, a liveness probe by design that exposes nothing) and
 * issue 16 (only the solar service page shows an Updated line; it is true and
 * dated).
 *
 *   node scripts/proofs/noindex-surfaces-describe-themselves-and-the-api-names-no-file.mjs
 */
import { readFileSync } from "node:fs";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const HOME_DESCRIPTION_START = "254 Engineering LLC is a veteran owned Texas engineering firm";

const SURFACES = [
  ["the portal", "src/app/portal/layout.tsx"],
  ["the customer account", "src/app/account/layout.tsx"],
  ["the referral partner door", "src/app/partner/layout.tsx"],
  ["the order start pages", "src/app/(order)/order/start/[slug]/page.tsx"],
  ["the order status page", "src/app/(order)/order/[reference]/page.tsx"],
  ["the onboarding link", "src/app/(site)/onboarding/[token]/page.tsx"],
];

for (const [name, file] of SURFACES) {
  const src = readFileSync(file, "utf8");
  const meta = src.slice(src.search(/export (const metadata|async function generateMetadata)/));
  const m = meta.match(/description:\s*"([^"]+)"/);
  const text = m ? m[1] : "";
  check(`${name} declares its own description`, Boolean(text), file);
  check(`${name}'s description is not the home page's`, Boolean(text) && !text.startsWith(HOME_DESCRIPTION_START), text.slice(0, 60));
  check(`${name}'s description carries no long dash`, !/[‒-―]/.test(text));
  check(`${name}'s description says no "we" service claim`, !/\bwe (seal|inspect|provide|issue|certify|offer)\b/i.test(text), text.slice(0, 60));
}

const api = readFileSync("src/app/api/v1/orders/route.ts", "utf8");
const getAt = api.indexOf("export async function GET(");
const getBody = getAt < 0 ? "" : api.slice(getAt, api.indexOf("\n}\n", getAt));
check("the ordering API's GET is found", getAt >= 0);
check("its answer still says POST only", getBody.includes('"This endpoint accepts POST only."'), getBody.slice(0, 120));
check("its answer names no repository path", !/docs\/|\.md\b/.test(getBody.replace(/\/\*[\s\S]*?\*\//g, "")));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(failed === 0 ? "PASS: the noindex surfaces describe themselves, and the ordering API names no internal file." : `FAIL: ${failed} check(s).`);
process.exitCode = failed === 0 ? 0 : 1;
