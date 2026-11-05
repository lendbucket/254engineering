/**
 * PROOF: THE LIVE SITE AUDIT'S PAGE FINDINGS STAY FIXED.
 *
 * Robert's ruling Q14 of 2026-11-02, from the live site audit (issue #1,
 * 6585009543): "replace "leverage" ... https for the txrules links ... server
 * render the onboarding not found page; own titles for account login and 404."
 *
 *   A  no insight links a plain http:// address, in its sources or its prose
 *      (issue 4: ten posts linked txrules.elaws.us over http)
 *   B  no windstorm guide page says "leverage" (issue 2), which the shared
 *      voice blocklist names
 *   C  the onboarding page renders its "not active" page itself for every
 *      failure and never calls notFound(), whose thrown path sent an empty
 *      server body (issue 10); the not-active copy is the not-found module's
 *   D  account login and the 404 each export their own title, brand suffixed,
 *      not the home page's (issue 11)
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-live-site-audit-pages-hold.mjs
 */
import { readFileSync } from "node:fs";

const { insights } = await import("../../src/content/insights.ts");
const { windstormPages } = await import("../../src/content/windstorm-program.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const HOME_TITLE = "Texas Engineering Services Statewide | 254 Engineering";

const plain = [];
for (const p of insights) {
  const text = JSON.stringify(p);
  for (const m of text.matchAll(/http:\/\/[^\s"')\]]+/g)) plain.push(`${p.slug}: ${m[0]}`);
}
check("no insight links a plain http:// address", plain.length === 0, plain.slice(0, 3).join("; ") || `${insights.length} posts read`);
const txrules = insights.filter((p) => JSON.stringify(p).includes("txrules.elaws.us"));
check("the txrules citations are still there, over https", txrules.length >= 10 && txrules.every((p) => JSON.stringify(p).includes("https://txrules.elaws.us/")), `${txrules.length} posts cite it`);

const leverage = windstormPages.filter((p) => /\bleverage\b/i.test(JSON.stringify(p))).map((p) => p.slug);
check('no windstorm guide page says "leverage"', leverage.length === 0, leverage.join(", "));
const buying = JSON.stringify(windstormPages.find((p) => p.slug === "buying-and-selling") ?? null);
check("the buying and selling page keeps its sentence, with less room to negotiate", buying.includes("with less room to negotiate and a contract in place"));

const onboarding = readFileSync("src/app/(site)/onboarding/[token]/page.tsx", "utf8");
const code = onboarding.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check("the onboarding page never calls notFound()", !/notFound\(/.test(code));
check("it imports the not active page from its not-found module", /import OnboardingNotFound from "\.\/not-found";/.test(code));
const returns = [...code.matchAll(/return <OnboardingNotFound \/>;/g)].length;
check("and returns it for an unknown token and for a completed onboarding", returns === 2 && /if \(!onboarding\) return <OnboardingNotFound \/>;/.test(code) && /onboarding\.status === "complete"\) return <OnboardingNotFound \/>;/.test(code), `${returns} returns`);
const notFoundPage = readFileSync("src/app/(site)/onboarding/[token]/not-found.tsx", "utf8");
check("the not active page still says what it said", notFoundPage.includes("This link is not active") && /export default function OnboardingNotFound/.test(notFoundPage));

const titleOf = (file) => {
  const src = readFileSync(file, "utf8");
  const block = src.slice(src.indexOf("export const metadata"), src.indexOf("};", src.indexOf("export const metadata")));
  return /title: "([^"]+)"/.exec(block)?.[1] ?? null;
};
for (const [label, file] of [["account login", "src/app/account/login/page.tsx"], ["the 404", "src/app/not-found.tsx"]]) {
  const t = titleOf(file);
  check(`${label} has its own title, brand suffixed, not the home page's`, t !== null && t.endsWith(" | 254 Engineering") && t !== HOME_TITLE, String(t));
}

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: no insight links over http, no guide says leverage, the onboarding page renders its not active page on the server, and account login and the 404 carry their own titles."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
