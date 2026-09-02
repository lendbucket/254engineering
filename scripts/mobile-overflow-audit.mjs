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
 * The probe is an ADMIN because an admin sees the most navigation. Five tab bar
 * items on a 360px screen is the densest the chrome ever gets, and it is the
 * layout most likely to overflow.
 */
const PORTAL_ROUTES = [
  "/portal",
  "/portal/people",
  "/portal/files",
  "/portal/clients",
  "/portal/audit",
  "/portal/profile",
  "/portal/review",
  "/portal/jobs",
  "/portal/login",
  "/portal/set-password",
];

const PROBE_DOMAIN = "mobile-audit.invalid";
let probe = null;

async function createProbe() {
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
    role: "admin",
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
  if (!probe) return true;
  await probe.db.from("eng_profiles").delete().eq("id", probe.id);
  await probe.db.auth.admin.deleteUser(probe.id).catch(() => {});
  const { data } = await probe.db.from("eng_profiles").select("email").like("email", `%@${PROBE_DOMAIN}`);
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
  return [...found, ...PORTAL_ROUTES];
}

const findings = [];
const checks = [];

async function run() {
  const list = await routes();
  probe = await createProbe();
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

  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    if (probe?.cookie) {
      await ctx.addCookies([
        {
          name: "eng_ops",
          value: probe.cookie,
          url: BASE,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }

    for (const route of list) {
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

      const measure = () =>
        page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          // The reference. See the note above on why innerWidth is not usable.
          inner: document.documentElement.clientWidth,
          reportedInner: window.innerWidth,
        }));

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
      const ok = over <= SLACK;

      // The reference itself must be the width that was asked for. If emulation
      // ever starts expanding clientWidth too, this check turns into the same
      // tautology it used to be, and this line is what would say so.
      if (top.inner !== width) {
        findings.push(
          `${route} @${width}: documentElement.clientWidth is ${top.inner}, not ${width}. The reference width moved, so this measurement cannot be trusted.`,
        );
      }

      let detail = `${worst} vs ${top.inner}`;
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
        }, top.inner);
        detail = `${worst} vs ${top.inner} (+${over})`;
        findings.push(
          `${route} @${width}: document is ${over}px wider than the viewport. ${culprits.join(" | ") || "no element identified"}`,
        );
      }

      checks.push({ name: `${route} @${width}`, ok, detail });
      await page.close();
    }

    await ctx.close();
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
  detail: "a probe left behind is a live admin account nobody created on purpose",
});

console.log("================ MOBILE HORIZONTAL OVERFLOW ================");
console.log(
  `${BASE}, every sitemap route plus ${PORTAL_ROUTES.length} portal routes at ${WIDTHS.join(" and ")}\n`,
);
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
  console.log(`PASS: ${checks.length} route and width combinations, zero horizontal document scroll.`);
  process.exitCode = 0;
} else {
  for (const f of findings) console.log(`  - ${f}`);
  console.log(
    `\nFAIL: ${findings.length} overflow finding(s) and ${failed.length} failed check(s) across ${checks.length} checks.`,
  );
  process.exitCode = 1;
}
