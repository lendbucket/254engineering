/**
 * The admin portal's security posture, asserted rather than assumed.
 *
 *   BASE_URL=http://localhost:3225 node scripts/security-audit.mjs
 *
 * WHAT THIS IS FOR
 * ----------------
 * The portal holds applicant records and identity documents. Every control that
 * keeps a stranger out of it is invisible when it works, which is the definition
 * of the thing that rots without a test. This asserts each one from outside, as
 * an unauthenticated client, because that is the position an attacker occupies.
 *
 * IT TESTS THE DEPLOYED BEHAVIOUR, NOT THE SOURCE
 * -----------------------------------------------
 * Reading proxy.ts and concluding the routes are protected is the mistake this
 * file exists to avoid: a matcher can be wrong, a route can be added outside it,
 * and the source still reads correctly. Every check here is an HTTP request.
 *
 * THE PASSPHRASE IS GONE AND THIS FILE PROVES IT
 * ----------------------------------------------
 * The portal replaced one shared passphrase with Supabase backed accounts. The
 * old sign in surface is asserted to no longer answer, because a retired auth
 * path that still works is worse than one that was never retired: nobody is
 * watching it.
 *
 * Role boundaries are NOT checked here. scripts/roles-audit.mjs signs in as each
 * role and attempts everything, which needs the service role key and a database.
 * This file is the unauthenticated perimeter and stays runnable without either.
 */
import { chromium } from "playwright";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** Pages a signed out visitor must never see. */
const ADMIN_PAGES = [
  "/portal",
  "/portal/people",
  "/portal/audit",
  "/portal/profile",
  "/portal/review",
  "/portal/jobs",
  "/portal/files",
  "/portal/clients",
  "/portal/techs",
  "/portal/protocols",
  "/portal/onboarding",
  "/portal/certification",
  "/admin",
  "/admin/leads",
  "/admin/applications",
  "/admin/onboarding",
  "/admin/onboarding/00000000-0000-4000-8000-000000000000",
];

/** API paths a signed out client must never reach. */
const ADMIN_APIS = [
  "/api/admin/onboarding",
  "/api/portal/people",
  "/api/portal/password",
  // Never listed since Phase 1 shipped it. Found by the coverage check below on
  // its first run, which is the argument for the coverage check.
  "/api/portal/files",
  "/api/portal/field",
  "/api/portal/onboarding",
];

/**
 * The lists above are hand written, and a hand written list of routes drifts
 * the moment somebody adds one.
 *
 * It drifted the first time within a single phase: Phase 2 added /portal/techs,
 * /portal/protocols and /api/portal/field, and this audit went on reporting
 * that the portal was closed while never asking about any of them. Passing
 * while looking at the wrong thing is the recurring defect class in this repo,
 * and a perimeter audit is the worst place for it.
 *
 * So the routes are also DISCOVERED from the filesystem and the two are
 * compared. A new surface fails this audit until somebody has decided, in
 * writing, that a signed out client must not reach it.
 *
 * Discovery is one level deep on purpose. A nested route under a covered parent
 * is reached through it, and a nested route under a NEW parent shows up as the
 * uncovered parent.
 */
function discoverRoutes() {
  const root = process.cwd();
  const pages = [];
  const apis = [];

  const appDir = join(root, "src", "app", "portal", "(app)");
  if (existsSync(appDir)) {
    if (existsSync(join(appDir, "page.tsx"))) pages.push("/portal");
    for (const entry of readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("[")) continue;
      if (existsSync(join(appDir, entry.name, "page.tsx"))) pages.push(`/portal/${entry.name}`);
    }
  }

  const apiDir = join(root, "src", "app", "api", "portal");
  if (existsSync(apiDir)) {
    for (const entry of readdirSync(apiDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (existsSync(join(apiDir, entry.name, "route.ts"))) apis.push(`/api/portal/${entry.name}`);
    }
  }
  return { pages, apis };
}

/**
 * Routes that are open by design, and why each one has to be.
 *
 * Every entry is a deliberate hole in the perimeter, so they are named here
 * rather than skipped by a pattern. src/proxy.ts holds the same list and these
 * two must agree; a route open in the proxy and absent here would be an open
 * door nobody tests.
 */
const OPEN_BY_DESIGN = new Set([
  "/portal/login",
  "/portal/set-password",
  "/api/portal/session",
  "/api/portal/set-password",
  // Clears the sign in rate limiter, so it cannot be behind the sign in it
  // exists to unblock. Guarded by a token instead, and tested below.
  "/api/portal/unlock",
]);

/** The retired passphrase surface. These must not answer at all any more. */
const RETIRED = ["/admin/login", "/admin/logout", "/api/admin/session"];

async function run() {
  // ---------- every portal route is actually covered by this audit ----------
  /*
   * Run first, because everything below it is only meaningful if the lists are
   * complete. An audit that says the portal is closed while three of its routes
   * were never asked about is worse than no audit.
   */
  {
    const found = discoverRoutes();
    const coveredPages = new Set(ADMIN_PAGES);
    const coveredApis = new Set(ADMIN_APIS);

    const uncoveredPages = found.pages.filter(
      (p) => !coveredPages.has(p) && !OPEN_BY_DESIGN.has(p),
    );
    const uncoveredApis = found.apis.filter(
      (p) => !coveredApis.has(p) && !OPEN_BY_DESIGN.has(p),
    );

    rec(
      `every portal page on disk is in the perimeter list (${found.pages.length} found)`,
      uncoveredPages.length === 0,
      uncoveredPages.length ? `not covered: ${uncoveredPages.join(", ")}` : "",
    );
    rec(
      `every portal API on disk is in the perimeter list (${found.apis.length} found)`,
      uncoveredApis.length === 0,
      uncoveredApis.length ? `not covered: ${uncoveredApis.join(", ")}` : "",
    );

    /*
     * And the other direction. A route removed from the app but left in the
     * list above means this audit is spending its checks on a 404 and quietly
     * covering nothing, which reads green forever.
     */
    const missingPages = ADMIN_PAGES.filter(
      (p) => p.startsWith("/portal") && !p.includes("00000000") && !found.pages.includes(p),
    );
    rec(
      "the perimeter list holds no portal page that no longer exists",
      missingPages.length === 0,
      missingPages.join(", "),
    );
  }

  // ---------- the retired passphrase surface is gone ----------
  for (const path of RETIRED) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const location = res.headers.get("location") || "";
    rec(
      `retired: ${path} no longer serves a sign in`,
      res.status !== 200,
      `HTTP ${res.status}`,
    );
    rec(
      `retired: ${path} points at the portal sign in`,
      location.includes("/portal/login") || res.status === 404,
      location || `HTTP ${res.status}`,
    );
  }

  {
    // The old endpoint accepted a passphrase. It must not accept anything now.
    const res = await fetch(`${BASE}/api/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "anything at all" }),
      redirect: "manual",
    });
    rec("retired: the passphrase endpoint issues no session", res.status !== 200, `HTTP ${res.status}`);
    rec(
      "retired: the passphrase endpoint sets no cookie",
      !(res.headers.get("set-cookie") || "").includes("eng_"),
      (res.headers.get("set-cookie") || "").slice(0, 40),
    );
  }

  // ---------- pages redirect, never render ----------
  for (const path of ADMIN_PAGES) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const location = res.headers.get("location") || "";
    rec(
      `signed out: ${path} does not render`,
      res.status === 307 || res.status === 302 || res.status === 303,
      `HTTP ${res.status}`,
    );
    rec(
      `signed out: ${path} redirects to the login screen`,
      location.includes("/portal/login"),
      location || "no location header",
    );

    // The body of a redirect must not carry the page. A 200 with content here
    // would mean the redirect is advisory and the data already left the server.
    const body = await res.text();
    rec(
      `signed out: ${path} returns no record data`,
      !/eng_|person_name|@254engineering\.com/i.test(body),
      body.slice(0, 60),
    );
  }

  // ---------- api returns 401 json, never a redirect ----------
  for (const path of ADMIN_APIS) {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", onboardingId: "00000000-0000-4000-8000-000000000000", status: "complete" }),
      redirect: "manual",
    });
    rec(`signed out: POST ${path} is 401`, res.status === 401, `HTTP ${res.status}`);
    // A redirect to an HTML login page is the wrong answer for a fetch: the
    // caller gets a parse error instead of an honest "not signed in".
    rec(
      `signed out: POST ${path} answers JSON rather than redirecting`,
      (res.headers.get("content-type") || "").includes("application/json"),
      res.headers.get("content-type") || "none",
    );
  }

  // ---------- the sign in endpoint ----------
  {
    const res = await fetch(`${BASE}/api/portal/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "definitely-not-the-password" }),
    });
    rec("wrong credentials are rejected", res.status === 401 || res.status === 503, `HTTP ${res.status}`);
    const setCookie = res.headers.get("set-cookie") || "";
    rec("wrong credentials set no session cookie", !setCookie.includes("eng_ops="), setCookie.slice(0, 40));

    const body = await res.text();
    /*
     * The same answer for a wrong password and an unknown address. Anything that
     * distinguishes them turns this endpoint into an account enumerator, and the
     * staff of this firm are named on a public careers page.
     */
    rec(
      "a failed sign in does not reveal whether the account exists",
      !/no account|not found|unknown user|no such/i.test(body),
      body.slice(0, 80),
    );
  }

  {
    // An empty body must not be treated as empty credentials matching anything.
    const res = await fetch(`${BASE}/api/portal/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    rec("empty credentials are rejected", res.status !== 200, `HTTP ${res.status}`);
  }

  {
    // The one time link endpoint is open by design. It must still refuse junk.
    const res = await fetch(`${BASE}/api/portal/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-real-token", password: "a-long-enough-password" }),
    });
    rec("a forged set-password token is refused", res.status !== 200, `HTTP ${res.status}`);
  }

  // ---------- rate limiting, both dimensions ----------
  /*
   * The limiter has two buckets and one number cannot describe it.
   *
   * This check used to send twelve attempts across twelve DIFFERENT addresses
   * and call the result rate limiting. When the limiter gained a per account
   * key so a typo could not lock the operator out, that probe started passing
   * through untouched, and it was right to fail: the change had made spraying
   * cheaper. Both dimensions are asserted now so neither can be widened
   * silently in service of the other.
   */
  {
    // Guessing ONE account. This is the bucket a typo consumes.
    let identityLimited = 0;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE}/api/portal/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77" },
        body: JSON.stringify({ email: "one-account@example.com", password: `guess-${i}` }),
      });
      if (res.status === 429) {
        identityLimited = i + 1;
        rec(
          "rate limit sends Retry-After",
          Boolean(res.headers.get("retry-after")),
          res.headers.get("retry-after") || "missing",
        );
        break;
      }
    }
    rec(
      "repeated wrong sign ins against ONE account are rate limited",
      identityLimited > 0,
      identityLimited ? `refused at attempt ${identityLimited}` : "12 attempts all accepted",
    );

    // Spraying MANY accounts from one host. A different bucket, and the one
    // the per account key would otherwise have left wide open.
    let sprayLimited = 0;
    for (let i = 0; i < 30; i++) {
      const res = await fetch(`${BASE}/api/portal/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.78" },
        body: JSON.stringify({ email: `spray-${i}@example.com`, password: "one-common-password" }),
      });
      if (res.status === 429) {
        sprayLimited = i + 1;
        break;
      }
    }
    rec(
      "spraying one password across many accounts from one address is rate limited",
      sprayLimited > 0,
      sprayLimited ? `refused at attempt ${sprayLimited}` : "30 attempts all accepted",
    );
  }

  // ---------- forged and tampered cookies ----------
  {
    const forged = [
      ["a bare value", "yes"],
      ["an unsigned payload", `${Math.floor(Date.now() / 1000) + 3600}.abc`],
      ["a wrong signature", `${Math.floor(Date.now() / 1000) + 3600}.abc.notavalidsignature`],
      ["an expired but signed shape", `1.abc.whatever`],
    ];
    for (const [label, value] of forged) {
      const res = await fetch(`${BASE}/portal`, {
        headers: { cookie: `eng_ops=${value}` },
        redirect: "manual",
      });
      rec(`forged cookie rejected: ${label}`, res.status !== 200, `HTTP ${res.status}`);
    }
  }

  // ---------- the session cookie's own attributes ----------
  {
    // Without the real passphrase no cookie can be minted, so this asserts the
    // attributes on the sign out cookie, which is written by the same helper.
    const res = await fetch(`${BASE}/api/portal/session`, { method: "DELETE" });
    const setCookie = res.headers.get("set-cookie") || "";
    rec("session cookie is HttpOnly", /httponly/i.test(setCookie), setCookie.slice(0, 80));
    rec("session cookie is Secure", /secure/i.test(setCookie), setCookie.slice(0, 80));
    rec("session cookie is SameSite=Lax", /samesite=lax/i.test(setCookie), setCookie.slice(0, 80));
  }

  // ---------- the login form cannot leak the passphrase into a URL ----------
  {
    /*
     * The form had no method and no action, so a submit before React hydrated
     * was a native GET and the passphrase went into the query string. It reached
     * browser history, the server log, and the next request's Referer header.
     *
     * Found on the live site and not on localhost, because a real network is
     * slow enough for a person to submit before hydration.
     */
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${BASE}/portal/login`, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    const method = ((await form.getAttribute("method")) || "get").toLowerCase();
    const action = (await form.getAttribute("action")) || "";
    rec("login form posts rather than gets", method === "post", method);
    rec(
      "login form action points at the session endpoint",
      action.includes("/api/portal/session"),
      action || "none",
    );
    await browser.close();
  }

  // ---------- the break glass is closed to everyone but the operator ----------
  {
    /*
     * /api/portal/unlock clears the sign in rate limiter. It has to be
     * reachable without a session, because the person who needs it is by
     * definition unable to sign in, so it is protected by OPS_UNLOCK_TOKEN
     * instead of by the session gate.
     *
     * A wrong token must be indistinguishable from the route not existing. A
     * 401 confirms the endpoint is there and worth attacking; a 404 says
     * nothing. It shipped as a 401 once because the proxy was gating it, which
     * also meant the endpoint could never run for the one person who needed it.
     */
    const probes = [
      ["no token", "/api/portal/unlock"],
      ["a wrong token", "/api/portal/unlock?token=definitely-not-the-unlock-token"],
      ["an empty token", "/api/portal/unlock?token="],
    ];
    for (const [label, path] of probes) {
      const res = await fetch(BASE + path, { redirect: "manual" });
      rec(
        `unlock: ${label} is indistinguishable from the route not existing`,
        res.status === 404,
        `HTTP ${res.status}`,
      );
    }

    const post = await fetch(`${BASE}/api/portal/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "definitely-not-the-unlock-token" }),
      redirect: "manual",
    });
    rec("unlock: a wrong token cannot clear the limiter", post.status === 404, `HTTP ${post.status}`);
  }
  // ---------- the portal is not indexable ----------
  {
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    rec("robots disallows /admin", robots.includes("Disallow: /admin"));
    rec("robots disallows /portal", robots.includes("Disallow: /portal"));
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    rec("sitemap lists no admin route", !sitemap.includes("/admin"));
    rec("sitemap lists no portal route", !sitemap.includes("/portal"));

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${BASE}/portal/login`, { waitUntil: "domcontentloaded" });
    const robotsMeta = await page
      .locator('meta[name="robots"]')
      .getAttribute("content")
      .catch(() => null);
    rec(
      "the login page carries a noindex meta tag",
      Boolean(robotsMeta && /noindex/i.test(robotsMeta)),
      robotsMeta || "absent",
    );
    await browser.close();
  }

  // ---------- the service role key never reaches a browser ----------
  {
    const res = await fetch(`${BASE}/portal/login`);
    const html = await res.text();
    rec(
      "no service role key in the sign in HTML",
      !/SUPABASE_SERVICE_ROLE|service_role|eyJhbGciOi/i.test(html),
    );
    rec("no session secret in the sign in HTML", !/OPS_SESSION_SECRET/.test(html));
    /*
     * There must be no browser Supabase client anywhere on this site. The closed
     * door pattern depends on it: RLS is on with zero policies, so an anon key in
     * the browser would be a second access path to reason about for no benefit.
     */
    rec("no anon key or public Supabase URL reaches the browser", !/NEXT_PUBLIC_SUPABASE/.test(html));
  }
}

await run();

console.log("================ SECURITY AUDIT ================");
console.log(`${BASE}, as an unauthenticated client\n`);
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The portal is closed to an unauthenticated client.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
