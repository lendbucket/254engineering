/**
 * PROOF: THE SITE SENDS ITS SECURITY HEADERS, AND THE CONTENT SECURITY POLICY
 * IS REPORT ONLY.
 *
 * Robert's ruling Q14 of 2026-11-02, from the live site audit (issue #1,
 * 6585009543, issues 5 and 6): "add CSP report only, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy and
 * includeSubDomains; poweredByHeader false".
 *
 *   A  next.config.ts, as Next reads it, sets poweredByHeader false
 *   B  its headers() puts every one of the six on every path, '/:path*'
 *   C  the policy is Content-Security-Policy-Report-Only, and no enforcing
 *      Content-Security-Policy header is sent (the ruling says report only)
 *   D  the policy allows what the site loads: Google's tag for GA4, Supabase
 *      storage for the portal's images and uploads, this origin for fonts and
 *      the field app's worker; and lets nothing frame the site
 *   E  HSTS keeps two years and adds includeSubDomains, without preload
 *   F  the camera and geolocation stay open to this origin, which the field
 *      capture screen uses
 *
 * The expected values are literals here, never imported from next.config.ts:
 * an audit never takes its expectation from the thing it audits.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-site-sends-its-security-headers.mjs
 */
const { default: config } = await import("../../next.config.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

check("poweredByHeader is false", config.poweredByHeader === false, String(config.poweredByHeader));

const rules = typeof config.headers === "function" ? await config.headers() : [];
const all = rules.find((r) => r.source === "/:path*");
check("headers() has a rule for every path, /:path*", Boolean(all), rules.map((r) => r.source).join(", "));
const get = (key) => (all?.headers ?? []).find((h) => h.key.toLowerCase() === key.toLowerCase())?.value ?? null;

const EXPECTED = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};
for (const [key, value] of Object.entries(EXPECTED)) check(`${key} is ${value}`, get(key) === value, String(get(key)));

const csp = get("Content-Security-Policy-Report-Only") ?? "";
check("the policy is sent as Content-Security-Policy-Report-Only", csp.length > 0);
check("and no enforcing Content-Security-Policy is sent, the ruling says report only", get("Content-Security-Policy") === null);
const directive = (name) => (csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "").split(/\s+/).slice(1);
const has = (name, ...sources) => sources.every((s) => directive(name).includes(s));
check("default-src is this origin", JSON.stringify(directive("default-src")) === JSON.stringify(["'self'"]), directive("default-src").join(" "));
check("scripts: this origin, inline (Next's payload and JSON-LD) and Google's tag", has("script-src", "'self'", "'unsafe-inline'", "https://www.googletagmanager.com"));
check("images: this origin, data, blob, GA4 and Supabase storage", has("img-src", "'self'", "data:", "blob:", "https://*.google-analytics.com", "https://*.supabase.co"));
check("connect: this origin, GA4 and Supabase storage", has("connect-src", "'self'", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.supabase.co"));
check("fonts from this origin (next/font self hosts)", has("font-src", "'self'"));
check("the field app's worker from this origin", has("worker-src", "'self'"));
check("nothing may frame the site, and it frames nothing", has("frame-ancestors", "'none'") && has("frame-src", "'none'"));
check("no plugins, no base or form target elsewhere", has("object-src", "'none'") && has("base-uri", "'self'") && has("form-action", "'self'"));

const hsts = get("Strict-Transport-Security") ?? "";
check("HSTS carries no preload, which the ruling did not ask for", !/preload/i.test(hsts));

const pp = get("Permissions-Policy") ?? "";
check("Permissions-Policy keeps the camera and geolocation for this origin", /camera=\(self\)/.test(pp) && /geolocation=\(self\)/.test(pp), pp);
check("and turns off the microphone and payment", /microphone=\(\)/.test(pp) && /payment=\(\)/.test(pp));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: every path carries the six security headers, the content security policy is report only and allows what the site loads, HSTS covers subdomains, and no x-powered-by is sent."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
