/**
 * GOOGLE ANALYTICS 4 LOADS AFTER IDLE, ON PUBLIC PAGES ONLY, AND NEVER SENDS A
 * TOKEN OR AN ORDER REFERENCE. Robert's ruling, 2026-11-01 (item m): "Load it
 * with next/script strategy lazyOnload ... Record page views and one event:
 * order started (the first step of /order) and order paid (the confirmation
 * page). No analytics on /portal, /admin, /partner or /account."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/analytics-loads-idle-on-public-pages-only.mjs
 *
 * WHAT IT ASSERTS
 *   the pure rules in src/lib/analytics.ts, exercised with real addresses: the
 *   four excluded prefixes refuse on a segment boundary, a signed ?token= link
 *   refuses, references are replaced, only campaign tags survive the query, and
 *   only the canonical host sends;
 *   the component loads gtag.js through next/script with lazyOnload and nothing
 *   else, configures with signals and ad personalization off and no automatic
 *   page view;
 *   it is rendered by exactly the (site) and (order) layouts, and by no layout
 *   or page under /portal, /admin, /partner or /account, nor by the root layout;
 *   the two events fire where the ruling says, with no money or personal field.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ga = await import("../../src/lib/analytics.ts");

/* The exclusions, on a segment boundary in both directions. */
for (const p of ["/portal", "/portal/queue", "/admin", "/partner", "/partner/earnings", "/account", "/account/orders"]) {
  check(`no analytics on ${p}`, ga.analyticsAllowedOn(p, "") === false);
}
for (const p of ["/", "/partners/badge", "/accounting-is-not-account", "/services/windstorm-wpi-8", "/order", "/order/start/roof-inspections"]) {
  check(`analytics allowed on ${p}`, ga.analyticsAllowedOn(p, "") === true);
}
check("a status page opened with its signed link loads none", ga.analyticsAllowedOn("/order/254-ABC123", "?token=abc.def") === false);
check("an onboarding invite, whose token is in the path, loads none", ga.analyticsAllowedOn("/onboarding/abcdef0123456789", "") === false && ga.analyticsAllowedOn("/onboarding/abcdef0123456789/training", "") === false);

/*
 * THE CLASS, NOT THE INSTANCE. Every public route whose path carries a [token]
 * segment is a signed link, and must load no analytics at all, because cleaning
 * only replaces the paths it knows. Walked from the filesystem so a new one is
 * found the day it is written. Route groups like (site) are not in the URL.
 */
const routeDirs = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n).replace(/\\/g, "/");
    return statSync(p).isDirectory() ? [p, ...routeDirs(p)] : [];
  });
const tokenRoutes = ["src/app/(site)", "src/app/(order)"]
  .flatMap(routeDirs)
  .filter((d) => /\/\[[^\]]*token[^\]]*\]$/i.test(d))
  .map((d) => d.replace(/^src\/app/, "").replace(/\/\([^)]+\)/g, "").replace(/\[[^\]]+\]/g, "x0123456789"));
check("every public route with a token in its path is found", tokenRoutes.length >= 1, tokenRoutes.join(", "));
for (const r of tokenRoutes) check(`and loads no analytics: ${r}`, ga.analyticsAllowedOn(r, "") === false);
check("the Stripe return, which carries no token, is allowed", ga.analyticsAllowedOn("/order/254-ABC123", "?paid=1") === true);

/* The cleaned address. */
const O = "https://254engineering.com";
check("an order reference is replaced", ga.cleanedLocation(O, "/order/254-ABC123", "?paid=1") === `${O}/order/[reference]`);
check("a quote reference is replaced", ga.cleanedLocation(O, "/order/quote/Q-77", "") === `${O}/order/quote/[reference]`);
check("a partner code in the path is replaced", ga.cleanedLocation(O, "/order/referred/acme", "") === `${O}/order/referred/[code]`);
check("the order start page keeps its service slug", ga.cleanedLocation(O, "/order/start/roof-inspections", "") === `${O}/order/start/roof-inspections`);
check("the catalogue keeps its path", ga.cleanedLocation(O, "/order", "") === `${O}/order`);
check(
  "only campaign tags survive the query",
  ga.cleanedLocation(O, "/services/windstorm-wpi-8", "?utm_source=g&token=x&email=a%40b.c&gclid=1&ref=p") === `${O}/services/windstorm-wpi-8?utm_source=g&gclid=1`,
  ga.cleanedLocation(O, "/services/windstorm-wpi-8", "?utm_source=g&token=x&email=a%40b.c&gclid=1&ref=p"),
);
check("only the canonical host sends", ga.sendsFrom("254engineering.com", "254engineering.com") && !ga.sendsFrom("localhost:4300", "254engineering.com") && !ga.sendsFrom("254engineering-x.vercel.app", "254engineering.com"));
/* Three since 2026-11-13: Robert named the two conversions order_paid and phone_tap. */
check("the three events are named as ruled", JSON.stringify(ga.GA_EVENTS) === JSON.stringify({ orderStarted: "order_started", orderPaid: "order_paid", phoneTap: "phone_tap" }));

/* The component. */
const comp = readFileSync("src/components/site/Analytics.tsx", "utf8");
const scripts = [...comp.matchAll(/<Script\b[^>]*>/g)].map((m) => m[0]);
check("one next/script element", scripts.length === 1 && /from "next\/script"/.test(comp), `${scripts.length}`);
check("loaded with strategy lazyOnload", /strategy="lazyOnload"/.test(scripts[0] ?? ""));
check("from googletagmanager with the measurement id", /src=\{`https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=\$\{id\}`\}/.test(scripts[0] ?? ""));
check("no automatic page view, no signals, no ad personalization", /send_page_view: false/.test(comp) && /allow_google_signals: false/.test(comp) && /allow_ad_personalization_signals: false/.test(comp));
check("no <script> tag of its own", !/<script\b/.test(comp));

/* Who renders it. */
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n).replace(/\\/g, "/");
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(n) ? [p] : [];
  });
const files = walk("src/app");
const renders = files.filter((f) => /<Analytics\b/.test(readFileSync(f, "utf8")));
check(
  "rendered by exactly the (site) and (order) layouts",
  JSON.stringify(renders.sort()) === JSON.stringify(["src/app/(order)/layout.tsx", "src/app/(site)/layout.tsx"]),
  renders.join(", "),
);
const forbidden = files.filter((f) => /^src\/app\/(portal|admin|partner|account)\//.test(f) && /components\/site\/Analytics/.test(readFileSync(f, "utf8")));
check("nothing under /portal, /admin, /partner or /account imports it", forbidden.length === 0, forbidden.join(", "));
check("the root layout does not render it", !/Analytics/.test(readFileSync("src/app/layout.tsx", "utf8")));

/* The events. */
const start = readFileSync("src/app/(order)/order/start/[slug]/page.tsx", "utf8");
const paid = readFileSync("src/app/(order)/order/[reference]/page.tsx", "utf8");
const startCall = start.match(/<TrackOnMount[^>]*\/>/g) ?? [];
const paidCall = paid.match(/<TrackOnMount[^>]*\/>/g) ?? [];
check("order started fires once, on the order start page, beside the flow", startCall.length === 1 && /GA_EVENTS\.orderStarted/.test(startCall[0]) && start.indexOf(startCall[0]) < start.indexOf("<OrderFlow"));
check("and carries only the service slug", /params=\{\{ service: slug \}\}/.test(startCall[0] ?? ""));
const paidBranch = paid.slice(paid.indexOf("if (!view && paid)"), paid.indexOf("if (!view && paid)") + 1200);
check("order paid fires once, inside the Stripe return's branch", paidCall.length === 1 && /GA_EVENTS\.orderPaid/.test(paidCall[0]) && paidBranch.includes(paidCall[0]));
check("and carries no parameter", !/params=/.test(paidCall[0] ?? ""));

/*
 * ONCE PER ORDER, NEVER ON A RELOAD (Robert, 2026-11-13). The return page
 * renders on every reload, so the paid event is keyed on the order and
 * remembered BEFORE it is sent; a key already there sends nothing. The
 * reference is the key and never a parameter.
 */
check("order paid is once per order, keyed on the reference", /once=\{reference\}/.test(paidCall[0] ?? ""));
const gaComponent = readFileSync("src/components/site/Analytics.tsx", "utf8");
const mount = gaComponent.slice(gaComponent.indexOf("export function TrackOnMount"));
check(
  "and a key already remembered sends nothing, the key written before the send",
  /if \(window\.localStorage\.getItem\(remembered\)\) return;/.test(mount) &&
    mount.indexOf("localStorage.setItem(remembered") < mount.indexOf('window.gtag!("event", event'),
);
check("the remembered key is the event and the order, in this browser only", ga.onceKey("order_paid", "254-O2026-000001") === "ga-sent:order_paid:254-O2026-000001");

/* PHONE_TAP, one per tap of a tel: link, sent from the public layouts' one component, carrying no number. */
const tapAt = gaComponent.indexOf("GA_EVENTS.phoneTap");
check(
  "phone tap is sent on a click on any tel: link, and carries only the page",
  tapAt > 0 &&
    /closest\?\.\('a\[href\^="tel:"\]'\)/.test(gaComponent) &&
    /document\.addEventListener\("click", onTap, true\)/.test(gaComponent) &&
    /GA_EVENTS\.phoneTap, \{ page_location: currentLocation\(\) \}\)/.test(gaComponent),
);

/* The disclosure. Robert, 2026-11-01, Q1: the privacy page says it, in his approved words. */
const privacy = readFileSync("src/app/(site)/privacy/page.tsx", "utf8").replace(/\s+/g, " ");
/* Robert's approved paragraph of 2026-11-14 (his answer 3 to 6871344363), carried exactly. */
check(
  "the privacy page discloses Google Analytics 4 and the two conversions, in his approved words",
  privacy.includes(
    "Public pages use Google Analytics 4 to count page views, two steps of an order (starting one, and paying for one, counted once per order), and taps on the firm&apos;s telephone number.",
  ) &&
    privacy.includes(
      "The count of paid orders and telephone taps is shared with Google Ads to measure whether advertising works, with no name, email, address, price or order reference in it.",
    ) &&
    privacy.includes("Google signals and ad personalization are off, the address sent leaves out order references and signed links, and no form contents are sent."),
);
check("and says staff and account screens do not load it", privacy.includes("Staff and account screens do not load it."));
check("and its effective date moved with it, to the conversions' merge day", privacy.includes('const EFFECTIVE = "14 November 2026"'));

console.log(wrong === 0 ? "PASS: GA4 loads after idle on public pages only, and sends no token, reference or personal field." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
