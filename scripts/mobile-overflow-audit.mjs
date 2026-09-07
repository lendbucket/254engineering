/**
 * Zero horizontal document scroll, on every route, at phone widths.
 *
 *   BASE_URL=http://localhost:3225 node scripts/mobile-overflow-audit.mjs
 *
 * WHY THIS IS SEPARATE FROM mobile-audit
 * --------------------------------------
 * mobile-audit already asserts `documentElement.scrollWidth === clientWidth`,
 * but only over a hand written list of twenty template representatives. That is
 * the right shape for the checks it also runs, which are slow: tap target
 * geometry on every interactive element, and the menu behaviour.
 *
 * Horizontal overflow is not a template property. It is a content property. One
 * long county name, one unbroken email address, one wide table in one insights
 * post, and a route breaks while every other route on the same template stays
 * clean. So this walks EVERY url in the sitemap, which is the only list that
 * grows by itself when a page is added.
 *
 * MEASURED TWICE, BEFORE AND AFTER SCROLLING
 * ------------------------------------------
 * Overflow frequently does not exist at first paint. Lazy images have no
 * intrinsic width until they load, and anything mounted below the fold has not
 * laid out yet, so a check that measures the top of the page and moves on is
 * measuring the least likely moment for the failure to be present. This walks
 * the page to the bottom first and takes the worst number seen.
 *
 * MEASURED AGAINST clientWidth, NEVER AGAINST innerWidth
 * ------------------------------------------------------
 * The first version of this file compared scrollWidth to window.innerWidth, and
 * it could not fail. Under mobile emulation, and on a real phone, the LAYOUT
 * viewport expands to contain overflowing content: inject a 900px element into a
 * 390px viewport and innerWidth becomes 900 as well. The two numbers move
 * together, so the comparison was always false.
 *
 * That was caught by injecting the 900px element and watching the audit stay
 * green, which is the only reason this file is correct now.
 *
 * documentElement.clientWidth stays pinned at the layout viewport width, 390,
 * whatever the content does. That is the reference. The configured width is
 * asserted against it too, so an emulation change that moved clientWidth could
 * not quietly turn this check off.
 *
 * WHAT COUNTS AS A FAILURE
 * ------------------------
 * `documentElement.scrollWidth` or `body.scrollWidth` exceeding
 * `documentElement.clientWidth` by more than one pixel. One pixel of slack is
 * deliberate:
 * sub pixel layout rounding at some widths produces a scrollWidth one greater
 * than innerWidth with nothing actually scrollable, and failing the build on
 * that would train everyone to ignore this audit.
 *
 * On failure it names the widest offending elements rather than only the number,
 * because "some route is 12 pixels too wide" is not a finding anybody can act
 * on.
 */
import { chromium } from "playwright";
import { allPages } from "./lib/surfaces.mjs";
import {
  createPartnerProbe,
  createCustomerProbe,
  destroyPartnerProbes,
  destroyCustomerProbes,
} from "./lib/portal-probe.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const WIDTHS = [360, 390];
const SLACK = 1;

/*
 * THE PORTAL IS NOT IN THE SITEMAP, AND HAS TO BE WALKED ANYWAY
 * ------------------------------------------------------------
 * Every portal route is noindex and disallowed in robots, so the sitemap, which
 * is this audit's route list, does not name a single one. That is correct for
 * the sitemap and it would have left the entire operations platform outside the
 * one check that guarantees a phone never scrolls sideways.
 *
 * So the portal routes are listed here explicitly and walked with a real signed
 * in session, created for the run and torn down after it. A probe account is the
 * only way to see these pages at all: an unauthenticated request is a redirect,
 * and a redirect never overflows anything.
 *
 * The first probe is an ADMIN because an admin sees the most navigation. Five
 * tab bar items on a 360px screen is the densest the chrome ever gets, and it
 * is the layout most likely to overflow.
 *
 * THE SECOND PROBE EXISTS BECAUSE AN ADMINISTRATOR CANNOT SEE THE REVIEW QUEUE.
 * review.queue is one of the five licensed capabilities, so it comes from
 * holding the Professional Engineer role rather than from a permission, and
 * /portal/review answers 404 to an administrator by design.
 *
 * Dropping the route would have been the easy repair and the wrong one. The
 * note above says portal routes are listed here precisely because the sitemap
 * does not carry them; removing the review queue would put the densest table in
 * the portal back outside this check while the audit went green.
 */
/*
 * The eleven portal routes this file used to carry are gone rather than kept as
 * a dead array. What they were is not the useful part; that they were a hand
 * written list with no partner or account route in it is, and that is recorded
 * in the comment below and in BACKLOG.
 */

/**
 * THE SIGNED IN ROUTES ARE DERIVED, AS OF 2026-09-07.
 *
 * PORTAL_ROUTES above is kept only as the record of what this file used to
 * measure, and nothing reads it any more: eleven portal routes, hand written,
 * and no partner or account route at all. The partner portal shipped in Phase 9
 * Section 4 and never entered this list, so five signed in pages and two
 * credential screens were never measured for sideways scroll. Nobody decided
 * that; the list was a memory.
 *
 * scripts/lib/surfaces.mjs is the declaration now, surface-audit fails when a
 * surface is not in it, and this file walks whatever it is given.
 */
const INVENTORY_PAGES = allPages();


const PROBE_DOMAIN = "mobile-audit.invalid";
let probe = null;
let licensedProbe = null;

async function createProbe(role = "admin") {
  const { auditClient } = await import("./lib/db-target.mjs");
  const db = auditClient("mobile-overflow-audit");
  if (!db) return null;

  const stamp = Date.now();
  const email = `probe-${stamp}@${PROBE_DOMAIN}`;
  const password = `probe-${stamp}-mobile-overflow-audit`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) return null;
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id,
    email,
    display_name: "Mobile Probe",
    role,
    status: "active",
  });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => {});
    return null;
  }

  const res = await fetch(`${BASE}/api/portal/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const m = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
  return { db, id: data.user.id, email, cookie: m ? m[1] : null };
}

async function destroyProbe() {
  /*
   * Every staff probe this file makes, and the technician one was missed when it
   * was added: the sweep by domain caught it on the same run and reported a
   * probe left behind, which is the teardown check doing its job.
   */
  const all = [probe, licensedProbe, techProbe].filter(Boolean);
  if (!all.length) return true;

  /*
   * DELETE WHAT THE VERIFICATION LOOKS FOR, which is everything on the probe
   * domain rather than the ids this run happens to hold.
   *
   * The earlier version deleted its own ids and then verified by sweeping the
   * domain, so the two were looking at different sets: a probe left behind by a
   * crashed run, or by a run that made one more probe than its teardown knew
   * about, was reported as a failure this teardown was not fixing. It happened
   * on 2026-09-07, the first run after a technician probe was added, and the
   * report was correct both times: there was an account left behind, and this
   * function was never going to remove it.
   *
   * portal-probe.mjs made the same repair for the same reason. The two are
   * deliberately separate probe domains, so neither run can tear down the
   * other's accounts, and that separation is only worth having if each one
   * cleans its own domain completely.
   */
  const db = all[0].db;
  const { data: strays } = await db
    .from("eng_profiles")
    .select("id")
    .like("email", `%@${PROBE_DOMAIN}`);

  const ids = new Set([...all.map((p) => p.id), ...(strays ?? []).map((r) => r.id)]);
  for (const id of ids) {
    await db.from("eng_profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }

  const { data } = await db.from("eng_profiles").select("email").like("email", `%@${PROBE_DOMAIN}`);
  return (data ?? []).length === 0;
}

async function routes() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const found = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
  );
  // The homepage and the waitlist are reachable and indexable; whether they are
  // in the sitemap is a separate question from whether they overflow.
  for (const extra of ["/", "/waitlist"]) if (!found.includes(extra)) found.push(extra);

  /*
   * The sitemap is the public list and the inventory is everything else. Pages
   * that need no session are walked signed out with the rest; the ones that do
   * are grouped by principal below, because a page opened without its session is
   * the sign in screen measured under another name.
   */
  const open = INVENTORY_PAGES.filter((p) => p.session === "none").map((p) => p.path);
  return [...new Set([...found, ...open])];
}

/** The signed in pages, grouped by which principal opens them. */
function byPrincipal() {
  const groups = new Map();
  for (const page of INVENTORY_PAGES) {
    if (page.session === "none") continue;
    const key = page.session === "staff" ? `staff:${page.role ?? "admin"}` : page.session;
    groups.set(key, [...(groups.get(key) ?? []), page.path]);
  }
  return groups;
}

const findings = [];
const checks = [];

/*
 * The other two principals, from the shared probe module rather than from a
 * third copy of account creation in this file. The staff probe above predates
 * that module and is left alone deliberately: it uses its own probe domain, so
 * a run of this audit and a run of another cannot tear down each other's
 * accounts, which is a hazard recorded in BACKLOG and worth keeping here.
 */
let techProbe = null;
let partnerProbe = null;
let customerProbe = null;

async function run() {
  const list = await routes();
  probe = await createProbe("admin");
  licensedProbe = await createProbe("engineer");
  techProbe = await createProbe("field_tech");
  partnerProbe = await createPartnerProbe(BASE, "mobile-overflow-audit");
  customerProbe = await createCustomerProbe(BASE, "mobile-overflow-audit");

  /*
   * A principal whose probe could not be made is a FAILURE, not a skip. The
   * pages it opens are the pages nobody has ever measured, so reporting them as
   * unmeasured is the whole point of bringing them in.
   */
  checks.push({
    name: "the partner surface measured with a partner session",
    ok: Boolean(partnerProbe?.cookie),
    detail: "five signed in pages that no audit opened before 2026-09-07",
  });
  checks.push({
    name: "the account surface measured with a customer session",
    ok: Boolean(customerProbe?.cookie),
    detail: "the customer's own screens, opened by a customer",
  });
  checks.push({
    name: "the technician screens measured with a technician session",
    ok: Boolean(techProbe?.cookie),
    detail: "an administrator gets a different screen, or none",
  });
  if (!probe?.cookie) {
    // Reported as a failure, not skipped quietly. A portal that was never
    // measured is not a portal that passed.
    checks.push({
      name: "portal routes measured with a signed in session",
      ok: false,
      detail: probe
        ? "the probe account could not sign in"
        : "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
    });
  } else {
    checks.push({ name: "portal routes measured with a signed in session", ok: true, detail: "" });
  }

  checks.push({
    name: "the licence bound routes measured with an engineer's session",
    ok: Boolean(licensedProbe?.cookie),
    detail: "an administrator gets 404 on the review queue, so only a PE can measure it",
  });

  const browser = await chromium.launch();

  /*
   * THREE COOKIES, THREE PRINCIPALS, AND THE NAME MATTERS.
   *
   * eng_ops, eng_partner and eng_customer are separate credential stores with
   * separate HMAC labels, which accounts-audit asserts cannot be read as each
   * other. A context handed the wrong one lands on a sign in screen, which
   * answers 200 and would be measured as the page it is not.
   */
  const COOKIE_NAME = { staff: "eng_ops", partner: "eng_partner", customer: "eng_customer" };

  const contextFor = async (width, cookie, kind = "staff") => {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    if (cookie) {
      await ctx.addCookies([
        { name: COOKIE_NAME[kind], value: cookie, url: BASE, httpOnly: true, sameSite: "Lax" },
      ]);
    }
    return ctx;
  };

  for (const width of WIDTHS) {
    const ctx = await contextFor(width, probe?.cookie);

  /*
   * ONE MEASUREMENT, TWO SESSIONS. Extracted rather than copied, because a
   * second copy of a hundred lines of overflow measurement is a second
   * place for the two to disagree about what counts as an overflow.
   */
  async function walk(ctx, routeList) {
    for (const route of routeList) {
        const page = await ctx.newPage();

        /*
         * domcontentloaded plus a settle, not networkidle.
         *
         * networkidle waits for the network to go quiet, and a portal page never
         * quite does: it timed out at thirty seconds on /portal and threw, which
         * killed the whole audit. One route's timeout took a hundred and fifteen
         * other checks with it and reported as an overflow failure, which it was
         * not.
         *
         * Horizontal overflow is a layout property. domcontentloaded plus a short
         * settle is what layout needs and is far more deterministic than waiting
         * on a network that may have a long lived connection on it.
         *
         * The try/catch is the other half: a route that will not load is a
         * FINDING, recorded against that route, not an exception that hides every
         * route after it.
         */
        let res;
        try {
          res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(600);
        } catch (err) {
          findings.push(`${route} @${width}: did not load (${String(err.message).split("\n")[0]})`);
          checks.push({ name: `${route} @${width}`, ok: false, detail: "did not load" });
          await page.close();
          continue;
        }

        if (!res || res.status() !== 200) {
          findings.push(`${route} @${width}: HTTP ${res ? res.status() : "no response"}`);
          checks.push({ name: `${route} @${width}`, ok: false, detail: "not 200" });
          await page.close();
          continue;
        }

        /*
         * A SIGNED IN ROUTE THAT LANDED ON A SIGN IN SCREEN WAS NOT MEASURED.
         *
         * A rejected cookie redirects, the redirect is followed, and the sign in
         * page answers 200 and has no overflow. So every portal, partner and
         * account route would report a pass while measuring one small page over
         * and over. mobile-audit has had this guard since Phase 11; this file
         * did not, and on 2026-09-07 it produced a clean run that had measured
         * nothing behind any door: two probe using audits were running at once,
         * one tore down the other's accounts mid run, and the output was a
         * confident green.
         *
         * The failure it hid was real and is in this run's output.
         */
        const landed = new URL(page.url()).pathname;
        const isSignIn = /\/(portal|partner|account)\/login$/.test(landed);
        if (isSignIn && !/\/login$/.test(route)) {
          findings.push(
            `${route} @${width}: bounced to ${landed}, so it was not measured. The session was rejected.`,
          );
          checks.push({ name: `${route} @${width}`, ok: false, detail: "bounced to sign in, not measured" });
          await page.close();
          continue;
        }

        /*
         * THE DOCUMENT, AND THE ELEMENT THAT SCROLLS INSTEAD OF IT.
         *
         * Portal routes are in the list above and their document CANNOT scroll
         * sideways: point 1 of the native standard put overflow-hidden on the
         * shell and gave the scrolling to one element between the fixed chrome.
         * So every portal row here was passing a measurement it could not fail,
         * which is the shape of defect this repository keeps finding, and this
         * time the audit was the one making it.
         *
         * Found on 2026-09-06 by injecting a 2000px box into a portal screen:
         * mobile-audit reported pass at four widths while the region measured
         * 2016px inside a 390px viewport. Both audits read the document and
         * neither read the region.
         *
         * The region's width is compared to the region's own client width
         * rather than to the viewport, because the shell is narrower than the
         * viewport at lg where a rail takes 230px of it.
         */
        const measure = () =>
          page.evaluate(() => {
            const region = document.querySelector("[data-portal-scroll], [data-partner-scroll]");
            return {
              doc: document.documentElement.scrollWidth,
              body: document.body.scrollWidth,
              // The reference. See the note above on why innerWidth is not usable.
              inner: document.documentElement.clientWidth,
              reportedInner: window.innerWidth,
              regionScroll: region ? region.scrollWidth : null,
              regionClient: region ? region.clientWidth : null,
            };
          });

        const top = await measure();
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 80));
          }
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 200));
        });
        const bottom = await measure();

        const worst = Math.max(top.doc, top.body, bottom.doc, bottom.body);
        const over = worst - top.inner;

        /*
         * The region is judged against ITSELF, with the same one pixel of slack
         * the document gets and for the same reason: sub pixel layout rounding.
         */
        const regionOver = Math.max(
          top.regionScroll !== null ? top.regionScroll - top.regionClient : 0,
          bottom.regionScroll !== null ? bottom.regionScroll - bottom.regionClient : 0,
        );
        const ok = over <= SLACK && regionOver <= SLACK;

        // The reference itself must be the width that was asked for. If emulation
        // ever starts expanding clientWidth too, this check turns into the same
        // tautology it used to be, and this line is what would say so.
        if (top.inner !== width) {
          findings.push(
            `${route} @${width}: documentElement.clientWidth is ${top.inner}, not ${width}. The reference width moved, so this measurement cannot be trusted.`,
          );
        }

        let detail =
          regionOver > SLACK
            ? `the scrolling region is ${Math.max(top.regionScroll ?? 0, bottom.regionScroll ?? 0)} wide inside ${top.regionClient}`
            : `${worst} vs ${top.inner}`;
        if (!ok) {
          const culprits = await page.evaluate((inner) => {
            const out = [];
            for (const el of document.querySelectorAll("*")) {
              const r = el.getBoundingClientRect();
              const right = r.right + window.scrollX;
              if (right > inner + 1 && r.width > 0) {
                out.push(
                  `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}> reaches ${Math.round(right)}px` +
                    ` class="${(el.getAttribute("class") || "").slice(0, 60)}"`,
                );
              }
            }
            return out.slice(0, 4);
          }, regionOver > SLACK ? top.regionClient : top.inner);

          /*
           * The message has to name WHICH box overflowed. The first version of
           * the region check reused the document sentence, so a region failure
           * read "document is 0px wider than the viewport", which is a finding
           * that reads as a non-finding and would send whoever hit it looking
           * at the wrong element.
           */
          if (regionOver > SLACK) {
            const widest = Math.max(top.regionScroll ?? 0, bottom.regionScroll ?? 0);
            detail = `region ${widest} vs ${top.regionClient} (+${regionOver})`;
            findings.push(
              `${route} @${width}: the scrolling region is ${regionOver}px wider than itself at ${top.regionClient}px. ` +
                `The document does not scroll on this screen, so this is the overflow a person would feel. ` +
                `${culprits.join(" | ") || "no element identified"}`,
            );
          } else {
            detail = `${worst} vs ${top.inner} (+${over})`;
            findings.push(
              `${route} @${width}: document is ${over}px wider than the viewport. ${culprits.join(" | ") || "no element identified"}`,
            );
          }
        }

        checks.push({ name: `${route} @${width}`, ok, detail });
        await page.close();
    }
  }

    await walk(ctx, list);
    await ctx.close();

    /*
     * Then every signed in group, each with the session that opens it. A probe
     * that could not be made walks its routes signed out rather than skipping
     * them: a route nobody measured is not a route that passed, and it fails as
     * a redirect, which is loud.
     */
    const cookieFor = {
      "staff:admin": [probe?.cookie, "staff"],
      "staff:engineer": [licensedProbe?.cookie, "staff"],
      "staff:field_tech": [techProbe?.cookie, "staff"],
      partner: [partnerProbe?.cookie, "partner"],
      customer: [customerProbe?.cookie, "customer"],
    };

    for (const [group, routeList] of byPrincipal()) {
      const [cookie, kind] = cookieFor[group] ?? [null, "staff"];
      const groupCtx = await contextFor(width, cookie, kind);
      await walk(groupCtx, routeList);
      await groupCtx.close();
    }
  }

  await browser.close();
}

await run();

/*
 * The probe account is removed and the removal is VERIFIED, because forms-audit
 * once filled production tables while reporting green and the lesson was that a
 * delete which matched nothing still returned no error.
 */
checks.push({
  name: "the mobile probe account was removed",
  ok: await destroyProbe(),
  detail: "a probe left behind is a live account nobody created on purpose",
});

const sweptPartners = await destroyPartnerProbes("mobile-overflow-audit");
checks.push({
  name: "the partner probe was removed",
  ok: sweptPartners.ok,
  detail: sweptPartners.note,
});

const sweptCustomers = await destroyCustomerProbes("mobile-overflow-audit");
checks.push({
  name: "the customer probe was removed",
  ok: sweptCustomers.ok,
  detail: sweptCustomers.note,
});

console.log("================ MOBILE HORIZONTAL OVERFLOW ================");
console.log(
  `${BASE}, every sitemap route plus ${INVENTORY_PAGES.length} pages from the surface inventory at ${WIDTHS.join(" and ")}\n`,
);
/*
 * Every check, on demand. Failures print always; this prints the whole list,
 * which is how a route that was never measured is told apart from a route that
 * passed. They look identical in a summary count.
 */
if (process.env.OVERFLOW_SHOW_ALL === "1") {
  for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
}

const failed = checks.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL: ${c.name} (${c.detail})`);
console.log("");
/*
 * The exit code counts BOTH, and it did not.
 *
 * It was decided by findings.length alone, while the probe teardown check was
 * pushed to `checks`. So a probe account left behind on a live database printed
 * FAIL in the output and exited 0, and the suite went green around it. A check
 * that cannot fail the build is a check nobody is running.
 *
 * Found when a crashed run left its probe behind and the next run reported the
 * leftover and passed anyway.
 */
if (findings.length === 0 && failed.length === 0) {
  console.log(`PASS: ${checks.length} route and width combinations, nothing scrolls sideways, document or region.`);
  process.exitCode = 0;
} else {
  for (const f of findings) console.log(`  - ${f}`);
  console.log(
    `\nFAIL: ${findings.length} overflow finding(s) and ${failed.length} failed check(s) across ${checks.length} checks.`,
  );
  process.exitCode = 1;
}
