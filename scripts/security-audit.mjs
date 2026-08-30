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
 * Reading middleware.ts and concluding the routes are protected is the mistake
 * this file exists to avoid: a matcher can be wrong, a route can be added
 * outside it, and the source still reads correctly. Every check here is an HTTP
 * request.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** Pages a signed out visitor must never see. */
const ADMIN_PAGES = [
  "/admin",
  "/admin/leads",
  "/admin/applications",
  "/admin/onboarding",
  "/admin/onboarding/00000000-0000-4000-8000-000000000000",
];

/** API paths a signed out client must never reach. */
const ADMIN_APIS = ["/api/admin/onboarding"];

async function run() {
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
      location.includes("/admin/login"),
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

  // ---------- the login endpoint ----------
  {
    const res = await fetch(`${BASE}/api/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "definitely-not-the-passphrase" }),
    });
    rec("wrong passphrase is rejected", res.status === 401 || res.status === 503, `HTTP ${res.status}`);
    const setCookie = res.headers.get("set-cookie") || "";
    rec("wrong passphrase sets no session cookie", !setCookie.includes("eng_admin"), setCookie.slice(0, 40));
  }

  {
    // An empty body must not be treated as an empty passphrase matching an
    // empty secret. The unset case has to be a closed door.
    const res = await fetch(`${BASE}/api/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    rec("empty passphrase is rejected", res.status !== 200, `HTTP ${res.status}`);
  }

  // ---------- rate limiting ----------
  {
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE}/api/admin/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77" },
        body: JSON.stringify({ passphrase: `guess-${i}` }),
      });
      if (res.status === 429) {
        limited = true;
        rec("rate limit sends Retry-After", Boolean(res.headers.get("retry-after")), res.headers.get("retry-after") || "missing");
        break;
      }
    }
    rec("repeated wrong passphrases are rate limited", limited, limited ? "" : "12 attempts all accepted");
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
      const res = await fetch(`${BASE}/admin`, {
        headers: { cookie: `eng_admin=${value}` },
        redirect: "manual",
      });
      rec(`forged cookie rejected: ${label}`, res.status !== 200, `HTTP ${res.status}`);
    }
  }

  // ---------- the session cookie's own attributes ----------
  {
    // Without the real passphrase no cookie can be minted, so this asserts the
    // attributes on the sign out cookie, which is written by the same helper.
    const res = await fetch(`${BASE}/api/admin/session`, { method: "DELETE" });
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
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    const form = page.locator("form").first();
    const method = ((await form.getAttribute("method")) || "get").toLowerCase();
    const action = (await form.getAttribute("action")) || "";
    rec("login form posts rather than gets", method === "post", method);
    rec(
      "login form action points at the session endpoint",
      action.includes("/api/admin/session"),
      action || "none",
    );
    await browser.close();
  }

  // ---------- the portal is not indexable ----------
  {
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    rec("robots disallows /admin", robots.includes("Disallow: /admin"));
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    rec("sitemap lists no admin route", !sitemap.includes("/admin"));

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
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
    const res = await fetch(`${BASE}/admin/login`);
    const html = await res.text();
    rec(
      "no service role key in the login HTML",
      !/SUPABASE_SERVICE_ROLE|service_role|eyJhbGciOi/i.test(html),
    );
    rec("no passphrase in the login HTML", !new RegExp("ADMIN_PASSPHRASE").test(html));
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
