/**
 * A TOKENED LINK LEAVES THE ADDRESS ON FIRST VISIT, AND ONE PAGE'S COOKIE OPENS
 * NO OTHER PAGE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-tokened-link-leaves-the-address.mjs
 *
 * Robert's answer L6, 2026-11-05 (issue #1, auth low findings 6594441148):
 * "swap the token for a short lived httpOnly cookie on first visit and redirect
 * without it." The order status, quote, three set password and onboarding
 * invite links carried their token in the address, which reaches request logs,
 * browser history and the Referer header.
 *
 * PROVEN ON THE PLANNER, AND THE PROXY IS HELD TO IT BY SOURCE GUARDS. Which
 * request is exchanged, rewritten or left alone is decided by
 * `planLinkRequest` in src/lib/link-cookie.ts, a pure function of the path,
 * the query and the cookies. The proxy only turns the plan into a response,
 * and that it calls the planner first, before any session gate, and matches
 * every tokened path, is asserted from its source. security-audit reads the
 * live redirect, cookie and landing page on the board; onboarding-walk-audit
 * walks a real invite through it.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */

import { readFileSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const { planLinkRequest, linkCookieName, isLinkPath, LINK_COOKIE_OPTIONS, LINK_COOKIE_MAX_AGE_SECONDS } = await import(
  "../../src/lib/link-cookie.ts"
);

console.log("");
console.log("========== A TOKENED LINK LEAVES THE ADDRESS ==========");
console.log("");

const q = (s) => new URLSearchParams(s);
const none = () => undefined;
const jar = (entries) => (name) => entries[name];

/* ------------------------------------------------------------ the exchange */

const ORDER = "/order/254-O2026-ABC123";
const OTHER = "/order/254-O2026-ZZZ999";
const orderCookie = linkCookieName(ORDER);

const firstVisit = planLinkRequest(ORDER, q("token=abc.def&paid=1"), none);
rec(
  "an order link with a token is exchanged, not rendered",
  firstVisit.kind === "exchange" && firstVisit.token === "abc.def" && firstVisit.cookie === orderCookie,
  firstVisit.kind,
);
rec(
  "and the address it redirects to is the same page without the token, keeping the rest",
  firstVisit.kind === "exchange" && firstVisit.location === `${ORDER}?paid=1`,
  firstVisit.kind === "exchange" ? firstVisit.location : "",
);
rec(
  "the cookie is host only, httpOnly, Secure, SameSite=Lax, path / and one hour",
  /^__Host-254-link-[0-9a-f]{20}$/.test(orderCookie) &&
    LINK_COOKIE_OPTIONS.httpOnly === true &&
    LINK_COOKIE_OPTIONS.secure === true &&
    LINK_COOKIE_OPTIONS.sameSite === "lax" &&
    LINK_COOKIE_OPTIONS.path === "/" &&
    LINK_COOKIE_OPTIONS.maxAge === 3600 &&
    LINK_COOKIE_MAX_AGE_SECONDS === 3600,
  orderCookie,
);

/* ------------------------------------------------------------- the rewrite */

const later = planLinkRequest(ORDER, q("paid=1"), jar({ [orderCookie]: "abc.def" }));
rec(
  "a later visit with no token is rewritten inside the server to carry the cookie's token",
  later.kind === "rewrite" && later.pathname === ORDER && new URLSearchParams(later.search).get("token") === "abc.def" && new URLSearchParams(later.search).get("paid") === "1",
  later.kind === "rewrite" ? later.search.replace(/token=[^&]*/, "token=...") : later.kind,
);
rec(
  "one order's cookie opens no other order: the names differ and the other page is left alone",
  linkCookieName(OTHER) !== orderCookie && planLinkRequest(OTHER, q(""), jar({ [orderCookie]: "abc.def" })).kind === "none",
);
rec("with no cookie and no token nothing is done", planLinkRequest(ORDER, q(""), none).kind === "none");

/* ------------------------------------------------- every other tokened page */

const QUOTE = "/order/quote/Q-2026-ABC";
const quote = planLinkRequest(QUOTE, q("token=t1"), none);
rec(
  "the quote link is exchanged the same way, under its own cookie",
  quote.kind === "exchange" && quote.location === QUOTE && quote.cookie === linkCookieName(QUOTE) && quote.cookie !== orderCookie,
);
for (const page of ["/portal/set-password", "/account/set-password", "/partner/set-password"]) {
  const plan = planLinkRequest(page, q("token=s1"), none);
  const back = planLinkRequest(page, q(""), jar({ [linkCookieName(page)]: "s1" }));
  rec(
    `${page} is exchanged, and rewritten on the next visit`,
    plan.kind === "exchange" && plan.location === page && back.kind === "rewrite" && new URLSearchParams(back.search).get("token") === "s1",
  );
}

/* ------------------------------------------- the invite carries it in the path */

const invite = planLinkRequest("/onboarding/inv.token.value", q(""), none);
rec(
  "the onboarding invite's path token is exchanged to /onboarding/invite",
  invite.kind === "exchange" && invite.location === "/onboarding/invite" && invite.token === "inv.token.value" && invite.cookie === linkCookieName("/onboarding"),
);
const training = planLinkRequest("/onboarding/inv.token.value/training", q(""), none);
rec("and its training page to /onboarding/invite/training", training.kind === "exchange" && training.location === "/onboarding/invite/training");
const inviteBack = planLinkRequest("/onboarding/invite/training", q(""), jar({ [linkCookieName("/onboarding")]: "inv.token.value" }));
rec(
  "and /onboarding/invite is rewritten to the token's own page while the cookie lives",
  inviteBack.kind === "rewrite" && inviteBack.pathname === "/onboarding/inv.token.value/training",
  inviteBack.kind === "rewrite" ? inviteBack.pathname : inviteBack.kind,
);
rec("and with no cookie /onboarding/invite opens nothing", planLinkRequest("/onboarding/invite", q(""), none).kind === "none");
rec("a malformed path segment is left for the page to refuse", planLinkRequest("/onboarding/%E0%A4%A", q(""), none).kind === "none");

/* ---------------------------------------------------- the letter download */

const letter = planLinkRequest("/api/order-document", q("reference=254-O2026-ABC123&document=d1"), jar({ [orderCookie]: "abc.def" }));
rec(
  "the letter link names the order, and the route is given that order's token from its cookie",
  letter.kind === "rewrite" && new URLSearchParams(letter.search).get("token") === "abc.def" && new URLSearchParams(letter.search).get("document") === "d1",
);
rec(
  "and another order's cookie supplies nothing to it",
  planLinkRequest("/api/order-document", q("reference=254-O2026-ZZZ999&document=d1"), jar({ [orderCookie]: "abc.def" })).kind === "none",
);
rec(
  "a reference that is not a reference supplies nothing",
  planLinkRequest("/api/order-document", q("reference=../portal&document=d1"), jar({ [linkCookieName("/order/../portal")]: "x" })).kind === "none",
);

/* --------------------------------------------------- what is left alone */

for (const path of ["/order/referred/demo-title", "/order/start/roof-certification", "/order/referred", "/order/start", "/portal/login", "/"]) {
  rec(`${path} is not a tokened page`, planLinkRequest(path, q("token=x"), none).kind === "none");
}
rec("a token longer than any the platform issues is not put in a cookie", planLinkRequest(ORDER, q(`token=${"a".repeat(513)}`), none).kind === "none");
rec("and the matcher predicate agrees for the letter route", isLinkPath("/api/order-document") && !isLinkPath("/order/referred/x"));

/* ------------------------------------------------- the proxy obeys the plan */

const proxy = read("src/proxy.ts")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");
const planAt = proxy.indexOf("planLinkRequest(pathname, request.nextUrl.searchParams");
const partnerAt = proxy.indexOf('if (pathname.startsWith("/partner") || pathname.startsWith("/api/partner")) {');
const opsAt = proxy.indexOf("readOpsSession(request.cookies");
rec("the proxy plans the link before any session is read", planAt !== -1 && partnerAt !== -1 && opsAt !== -1 && planAt < partnerAt && planAt < opsAt);
const linkBranch = planAt !== -1 && partnerAt !== -1 ? proxy.slice(planAt, partnerAt) : "";
rec(
  "and the exchange is a 307 that sets the cookie, is never cached, and sends no Referer",
  /NextResponse\.redirect\(url, 307\)/.test(linkBranch) &&
    /cookies\.set\(link\.cookie, link\.token, LINK_COOKIE_OPTIONS\)/.test(linkBranch) &&
    /"Cache-Control", "no-store"/.test(linkBranch) &&
    /"Referrer-Policy", "no-referrer"/.test(linkBranch),
);
rec("and the link branch reads no principal's cookie", linkBranch !== "" && !/OPS_COOKIE|CUSTOMER_COOKIE|PARTNER_COOKIE/.test(linkBranch));
rec(
  "the order, onboarding and letter paths return before the staff gate",
  /pathname\.startsWith\("\/order\/"\)/.test(linkBranch) && /pathname\.startsWith\("\/onboarding\/"\)/.test(linkBranch) && /pathname === "\/api\/order-document"/.test(linkBranch),
);
rec(
  "and the matcher names all three, so the proxy actually runs for them",
  /"\/order\/:path\*"/.test(proxy) && /"\/onboarding\/:path\*"/.test(proxy) && /"\/api\/order-document"/.test(proxy),
);

/* --------------------------------------- the pages link without the token */

const orderPage = read("src/app/(order)/order/[reference]/page.tsx");
rec(
  "the order page links its letter by reference, never by token",
  /\/api\/order-document\?reference=\$\{encodeURIComponent\(reference\)\}/.test(orderPage) && !/order-document\?token=/.test(orderPage),
);
const invitePage = read("src/app/(site)/onboarding/[token]/page.tsx");
rec("the invite page links its training by /onboarding/invite, never by token", /href="\/onboarding\/invite\/training"/.test(invitePage) && !/onboarding\/\$\{token\}/.test(invitePage));
rec(
  "and the emailed links are unchanged, as ruled",
  /\/onboarding\/\$\{token\}/.test(read("src/lib/onboarding-tokens.ts")),
);

/* ------------------------------------------------------------------ verdict */

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A tokened link leaves the address on first visit, and one page's cookie opens no other.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
