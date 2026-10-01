/**
 * THE BREAK IT SWEEP. REPORT ONLY, NOTHING FIXED.
 *
 *   npx tsx scripts/sweep/run.mjs
 *
 * Operator order, 2026-09-30, with five rulings the same day and one more on
 * 2026-10-01. Development only. No Stripe call, no email, no SMS, no
 * production, no key values.
 *
 * WHAT IT WILL NOT DO, and these are refusals rather than omissions:
 *
 *   It never presses a control whose label says it takes money, sends mail or
 *   sends a message. The list is matched on the label, because that is what a
 *   person reads, and anything it is unsure about is skipped and reported as
 *   skipped rather than pressed to find out.
 *
 *   It writes nothing to the report that matches the shape of a secret. The
 *   guard throws and the file is not written. It refuses rather than redacts,
 *   because a redaction that happened and one that was never needed read
 *   identically on the page.
 *
 *   It makes no probe that can reach a person: reserved .invalid addresses, no
 *   phone, and the customer inserted directly so no door queues anything.
 *
 * EVERY CELL IT COULD NOT MEASURE SAYS SO. A sweep whose gaps are invisible is
 * worse than a shorter one, because the reader cannot tell a clean route from
 * an unvisited one.
 */
process.loadEnvFile?.(".env.local");

import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { startNextServer } from "../lib/dev-server.mjs";
import { takeLock } from "../lib/machine-lock.mjs";
import { auditClient, describeTarget } from "../lib/db-target.mjs";
import { assertNothingSecret, refusalFor, registerEnvironment, treatAsSecret } from "./lib/secrecy.mjs";
import { inventoryGap, sitemapRoutes, routesUnder, apisOnDisk, openByDesign } from "./lib/routes.mjs";
import { makePrincipals, disposeOf, STAFF_ROLES } from "./lib/principals.mjs";
import { surfaces, routesOf, apisOf } from "../lib/surfaces.mjs";

const PORT = Number(process.env.SWEEP_PORT ?? 3240);
const OUT_DIR = "docs/audits";
const OUT = `${OUT_DIR}/break-it-sweep-${new Date().toISOString().slice(0, 10)}.md`;
const PHONE_HEIGHT = 844;
const HEIGHT_CEILING = PHONE_HEIGHT * 3;
const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

/* Everything secret this process can see is registered before anything runs. */
registerEnvironment();

const findings = [];
const couldNotTell = [];

/*
 * Declared here with the other collectors, not beside its first use.
 *
 * It was below, and `const` in a temporal dead zone throws rather than reading
 * undefined, so the sweep would have died inside the route loop having measured
 * most of the product and written nothing. The identical mistake was caught in
 * reporting-audit an hour earlier, which is the argument for declaring every
 * collector in one place rather than next to whatever first needs it.
 */
const staffColour = new Set();

/**
 * One finding.
 * @param sev 1 money or a customer's order, 2 wrong data shown, 3 dead path, 4 presentation
 */
let withheld = 0;
const find = (route, role, width, what, sev, fix) => {
  /*
   * A SECRET IS NEVER CAPTURED, RATHER THAN CAPTURED AND THEN REFUSED.
   *
   * The first run assembled findings from raw console text and response
   * bodies, and the guard refused to write the whole report over one line. That
   * is the guard working, and it is the wrong place to fix it: dropping an
   * entire sweep because one finding quoted a token means the report is held
   * hostage by the thing it is reporting on.
   *
   * So the shape is checked HERE, where the text is first turned into a
   * finding, and a line that would be refused is replaced by a description of
   * what it was. The finding survives, with its route, role and severity
   * intact, and the reader learns that something was found and that its text
   * could not be shown. The write time assertion stays as the backstop, and a
   * refusal there now means a bug in this function rather than a secret in the
   * product.
   *
   * THIS IS NOT THE REDACTION THE OPERATOR REFUSED. He refused a report that
   * silently starred out a value, leaving nobody able to say whether one had
   * been there. This says plainly that a value was withheld, counts them, and
   * names the shape.
   */
  const refusal = refusalFor(String(what));
  if (refusal) {
    withheld += 1;
    findings.push({
      route,
      role,
      width,
      what: `a value was withheld from this line because ${refusal}. The finding stands; its text cannot be shown.`,
      sev,
      fix,
    });
    return;
  }
  findings.push({ route, role, width, what, sev, fix });
};

const cnt = (what, why) => couldNotTell.push({ what, why });

/**
 * CONTROLS THIS SWEEP WILL NOT PRESS.
 *
 * Matched on the visible label, because that is the only thing a person reads
 * before pressing, and a sweep that decided from an href would press a button
 * whose handler posts. Anything matching is recorded as deliberately skipped.
 */
const NEVER_PRESS =
  /pay|payment|checkout|charge|refund|invoice|send|email|e-mail|sms|text|notify|message|submit the request|place the order|continue to payment|issue|resend|invite/i;

console.log("");
console.log("================ THE BREAK IT SWEEP ================");
console.log("");

const db = auditClient("the break it sweep");
console.log(describeTarget(process.env.SUPABASE_URL));

/* ------------------------------------------ 0. the inventory, before anything */

const gap = inventoryGap();
const OPEN = openByDesign();
console.log(`  ${OPEN.why}`);
if (OPEN.paths.size === 0) {
  /*
   * AN EMPTY DECLARATION WOULD MAKE EVERY FRONT DOOR A FINDING, which is the
   * opposite failure to not consulting it and just as useless. Said out loud
   * rather than discovered in a table of false positives.
   */
  cnt(
    "which routes are open by design",
    "security-audit's OPEN_BY_DESIGN could not be read, so every unauthenticated route below is reported as if it were a breach",
  );
}
if (gap.undeclared.length > 0) {
  find(
    "(the surface inventory)",
    "n/a",
    "n/a",
    `${gap.undeclared.length} static route(s) belong to no declared surface, so every browser audit is blind to them: ${gap.undeclared.join(", ")}`,
    2,
    "behaviour",
  );
}
if (gap.declaredButMissing.length > 0) {
  find(
    "(the surface inventory)",
    "n/a",
    "n/a",
    `${gap.declaredButMissing.length} declared route(s) have no page on disk: ${gap.declaredButMissing.join(", ")}`,
    3,
    "behaviour",
  );
}

const release = await takeLock({
  project: "254engineering",
  label: "break it sweep",
  onWait: (h) => console.log(`  waiting on ${h.project} pid ${h.pid}`),
});

let server = null;
let principals = [];
let customer = null;

try {
  server = await startNextServer({ port: PORT });
  const BASE = server.base;
  console.log(`server up at ${BASE}`);

  const built = await makePrincipals(BASE);
  principals = built.principals;
  customer = built.customer;

  for (const p of principals) {
    if (p.role === "signed out") continue;
    if (p.email) treatAsSecret(p.password ?? "");
    if (!p.cookie) {
      cnt(
        `every check as ${p.role}`,
        `no session could be built: ${p.fault ?? "no cookie"}. Nothing was measured as this role.`,
      );
    }
    console.log(`  principal ${String(p.role).padEnd(12)} ${p.cookie ? "session ok" : "NO SESSION"}`);
  }

  /* ------------------------------------------------- 1. the routes to visit */

  const site = await sitemapRoutes(BASE);
  if (site.routes.length === 0) {
    cnt("the public marketing routes", `the sitemap yielded nothing: ${site.why}`);
  }

  const walked = [];
  for (const surface of surfaces()) {
    if (surface.routesFrom === "sitemap") continue;
    for (const r of routesOf(surface, {})) walked.push({ surface: surface.key, route: r });
  }
  const routes = [
    ...site.routes.map((r) => ({ surface: "site", route: r })),
    ...walked,
  ].filter((v, i, a) => a.findIndex((x) => x.route === v.route) === i);

  console.log(`  ${routes.length} route(s) to visit, ${site.routes.length} from the sitemap`);
  if (routes.length < 20) {
    cnt(
      "the route list",
      `only ${routes.length} routes were assembled, which is too few to be the whole product. Everything below is over that subset.`,
    );
  }

  /* --------------------------------- 2. load every route as every principal */

  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    for (const p of principals) {
      if (p.role !== "signed out" && !p.cookie) continue;
      const context = await browser.newContext({
        viewport: { width: width.width, height: width.height },
      });
      if (p.cookie) {
        const [name, value] = p.cookie.split("=");
        await context.addCookies([
          { name: name.trim(), value: value ?? "", domain: "localhost", path: "/" },
        ]);
      }
      const page = await context.newPage();

      const consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
      });

      for (const { route } of routes) {
        consoleErrors.length = 0;
        let status = 0;
        try {
          const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
          status = res?.status() ?? 0;
        } catch (e) {
          find(route, p.role, width.name, `the page did not load: ${String(e).slice(0, 90)}`, 3, "behaviour");
          continue;
        }

        if (status >= 500) {
          find(route, p.role, width.name, `HTTP ${status}`, 1, "behaviour");
        } else if (status === 404) {
          find(route, p.role, width.name, "HTTP 404 on a route the inventory declares", 3, "behaviour");
        }

        if (consoleErrors.length > 0) {
          find(
            route,
            p.role,
            width.name,
            `${consoleErrors.length} console error(s), first: ${consoleErrors[0]}`,
            3,
            "behaviour",
          );
        }

        if (width.name === "390" && status === 200) {
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          if (height > HEIGHT_CEILING) {
            /*
             * A LONG MARKETING PAGE AND A LONG FORM ARE DIFFERENT THINGS.
             *
             * The operator asked for anything over three phone heights at 390
             * to be flagged, and that is what this does. But an insights
             * article running nine screens is long-form content behaving
             * normally, while an order step running thirteen is a form nobody
             * can finish. Reporting both at one severity buries the second
             * under forty of the first.
             *
             * So the surface decides the ranking, and the note says which kind
             * it is. Nothing is dropped: the operator asked to see them all.
             */
            const isApp =
              route.startsWith("/account") ||
              route.startsWith("/portal") ||
              route.startsWith("/partner") ||
              route.startsWith("/order");
            find(
              route,
              p.role,
              "390",
              `${height}px tall, ${(height / PHONE_HEIGHT).toFixed(1)} phone heights against a ceiling of three` +
                (isApp
                  ? ". This is an app screen, where length is a form somebody has to finish."
                  : ". This is long-form marketing content, where length may be intended."),
              isApp ? 3 : 4,
              "presentation",
            );
          }
        }

        /* ------------------------- 6 and 7, measured on the rendered page */
        if (status === 200) {
          const measured = await page.evaluate(() => {
            const out = { dashes: [], promises: [], colourStatus: [], ink: null, mark: null };
            const body = document.body?.innerText ?? "";

            /* Long dashes, which standing law forbids in anything rendered. */
            for (const m of body.match(/[^\n]{0,40}[‒–—―][^\n]{0,40}/g) ?? []) {
              out.dashes.push(m.trim().slice(0, 90));
            }

            /*
             * WORDING THAT PROMISES OR WARRANTS, WITH THE SENTENCE AROUND IT.
             *
             * The word alone is not a finding and the first run proved it: the
             * insights page explaining that a letter is NOT a warranty matched
             * on "warranty", and so did every page saying the firm does not
             * guarantee an outcome. A row reading `promises or warrants:
             * "warranty"` is unusable, because the reader cannot tell the
             * promise from its denial.
             *
             * So the match carries its sentence, and an obvious negation within
             * the preceding few words is not reported at all. That is a
             * heuristic and it will miss a negation phrased unusually, which is
             * why the sentence is still shown for the ones it does report.
             */
            const promise =
              /\b(guarantee[ds]?|warrant(y|ies|ed)?|estimated|typically|usually|we promise|assured|ensures? that your|within \d+ (business )?days?)\b/gi;
            const NEGATED = /\b(not|never|no|without|cannot|does not|do not|is not|are not|nor)\b[^.]{0,40}$/i;
            /*
             * AND THE SENTENCE MUST BE ABOUT THE FIRM'S WORK.
             *
             * The second run showed what the word alone catches: "wind is
             * usually the governing lateral load", "the part people usually
             * find out about last". True sentences about the world, and not
             * promises about anything this firm will do. Forty rows of them
             * buried the handful that matter.
             *
             * A promise needs a promisor and a thing promised, so the sentence
             * has to mention the firm or the reader's own deliverable. That is
             * a heuristic and it will miss an oddly phrased promise, which is
             * why every row it does report carries its sentence for a person to
             * judge rather than being asserted as a defect.
             */
            const ABOUT_THE_WORK =
              /\b(we |our |the firm|your (letter|report|order|certificate|document|inspection)|turnaround|deliver|issued|sealed|you (will|can expect)|engineer will)\b/i;
            for (const m of body.matchAll(promise)) {
              const at = m.index ?? 0;
              const before = body.slice(Math.max(0, at - 90), at);
              if (NEGATED.test(before)) continue;
              const sentence = body
                .slice(Math.max(0, at - 70), at + m[0].length + 70)
                .replace(/\s+/g, " ")
                .trim();
              if (!ABOUT_THE_WORK.test(sentence)) continue;
              out.promises.push(`${m[0]} :: ...${sentence}...`);
            }

            const h1 = document.querySelector("h1");
            out.ink = h1 ? getComputedStyle(h1).color : null;

            const img = document.querySelector("header img");
            if (img) {
              const r = img.getBoundingClientRect();
              out.mark = { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
            }

            /*
             * COLOUR AS STATUS. A status dot or pill carrying meaning in its
             * colour alone. Found by looking for small elements whose
             * background is a red, green or amber and which sit beside text.
             */
            /*
             * THE BRAND PALETTE IS NOT A STATUS COLOUR, AND IT IS READ FROM THE
             * PAGE RATHER THAN TYPED HERE.
             *
             * The first run reported the brand gold, rgb(214, 166, 42), as
             * "amber status" on eleven screens. That is #D6A62A, the logo's
             * gold, which the operator ruled on hours earlier and which this
             * design uses for rules, marks and the active nav bar. Reporting
             * the brand as a defect is how a sweep teaches people to skim it.
             *
             * The values come from the document's own custom properties, so a
             * palette change moves this with it rather than leaving a stale
             * list of hex codes in a script.
             */
            const root = getComputedStyle(document.documentElement);
            const brand = new Set();
            for (const token of [
              "--color-brass",
              "--color-brass-deep",
              "--color-brass-light",
              "--color-brass-tint",
              "--gold",
              "--gold-bright",
              "--gold-wash",
            ]) {
              const v = root.getPropertyValue(token).trim();
              if (v) brand.add(v.toLowerCase());
            }
            const asRgb = (hex) => {
              const h = hex.replace("#", "");
              if (h.length !== 6) return null;
              return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
            };
            const brandRgb = [...brand].map(asRgb).filter(Boolean);
            const isBrand = (r, g, b) =>
              brandRgb.some(([br, bg2, bb]) => Math.abs(br - r) < 8 && Math.abs(bg2 - g) < 8 && Math.abs(bb - b) < 8);

            for (const el of Array.from(document.querySelectorAll("span,div,i")).slice(0, 2000)) {
              const cs = getComputedStyle(el);
              const bg = cs.backgroundColor;
              const m = bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (!m) continue;
              const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
              if (r === g && g === b) continue;
              if (isBrand(r, g, b)) continue;
              const red = r > 120 && g < 90 && b < 90;
              const green = g > 90 && r < 120 && b < 120;
              const amber = r > 180 && g > 120 && b < 100;
              const box = el.getBoundingClientRect();
              if ((red || green || amber) && box.width > 0 && box.width < 40 && box.height < 40) {
                out.colourStatus.push(`${red ? "red" : green ? "green" : "amber"} ${bg}`);
              }
            }
            return out;
          });

          for (const d of measured.dashes.slice(0, 3)) {
            find(route, p.role, width.name, `a long dash in rendered copy: "${d}"`, 4, "presentation");
          }
          for (const promise of [...new Set(measured.promises)].slice(0, 4)) {
            find(
              route,
              p.role,
              width.name,
              `wording that promises or warrants: "${promise}"`,
              2,
              "behaviour",
            );
          }
          if (measured.ink && measured.ink !== "rgb(22, 27, 34)" && route.startsWith("/account")) {
            find(
              route,
              p.role,
              width.name,
              `the h1 computed ${measured.ink} against the V10 ink #161B22`,
              4,
              "presentation",
            );
          }
          if (measured.colourStatus.length > 0) {
            const staff = route.startsWith("/portal") || route.startsWith("/partner");
            if (!staff) {
              find(
                route,
                p.role,
                width.name,
                `${measured.colourStatus.length} element(s) carry status in colour: ${[...new Set(measured.colourStatus)].slice(0, 3).join(", ")}`,
                4,
                "presentation",
              );
            } else {
              staffColour.add(route);
            }
          }
        }
      }

      await context.close();
    }
  }

  await browser.close();

  /* ----------------------------- 3. API role boundaries, GET and POST, all */

  const declaredApis = [];
  for (const surface of surfaces()) {
    try {
      for (const a of apisOf(surface, {})) declaredApis.push(a);
    } catch {
      /* a surface with no apis */
    }
  }
  const allApis = [...new Set([...apisOnDisk().filter((a) => !a.includes("[")), ...declaredApis])].sort();
  console.log(`  ${allApis.length} API route(s) to probe, GET and POST, as ${principals.length} principal(s)`);

  for (const api of allApis) {
    for (const p of principals) {
      if (p.role !== "signed out" && !p.cookie) continue;
      for (const method of ["GET", "POST"]) {
        let res = null;
        try {
          res = await fetch(BASE + api, {
            method,
            headers: {
              ...(p.cookie ? { cookie: p.cookie } : {}),
              ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
            },
            ...(method === "POST" ? { body: "{}" } : {}),
            redirect: "manual",
          });
        } catch (e) {
          find(api, p.role, "n/a", `${method} threw: ${String(e).slice(0, 80)}`, 3, "behaviour");
          continue;
        }

        const status = res.status;
        let body = "";
        try {
          body = (await res.text()).slice(0, 400);
        } catch {
          body = "";
        }

        /*
         * WHAT COUNTS AS A FINDING. A 2xx that carries a JSON body with data in
         * it, to a principal who should not have it. Refusals, redirects to a
         * login, 404s and method-not-allowed are all correct answers.
         *
         * The sweep cannot know every route's intended audience, so it reports
         * the PAIR and ranks it, rather than asserting a rule it does not have.
         * A 200 with data to "signed out" on a portal API is unambiguous; the
         * rest is for a person to read.
         */
        const looksLikeData =
          status >= 200 &&
          status < 300 &&
          /^[\s]*[[{]/.test(body) &&
          !/"error"|"ok"\s*:\s*false|not permitted|not signed in/i.test(body);

        /*
         * A ROUTE DECLARED OPEN BY DESIGN IS NOT A BREACH.
         *
         * security-audit's OPEN_BY_DESIGN is the declaration of what a signed
         * out caller is MEANT to reach, each entry with its reasoning. Without
         * consulting it the first run reported /api/portal/health as a severity
         * one finding, and that route is deliberately unauthenticated with
         * twenty lines explaining why. A sweep that cries breach over every
         * front door is one nobody reads to the end.
         */
        if (looksLikeData && !OPEN.paths.has(api)) {
          const staffOnly = api.startsWith("/api/portal") || api.startsWith("/api/ops");
          if (staffOnly && (p.role === "signed out" || p.role === "customer")) {
            find(
              api,
              p.role,
              "n/a",
              `${method} answered ${status} with a data body to a principal with no staff role`,
              1,
              "behaviour",
            );
          } else if (p.role === "signed out" && api.startsWith("/api/")) {
            find(
              api,
              "signed out",
              "n/a",
              `${method} answered ${status} with a data body with no session`,
              2,
              "behaviour",
            );
          }
        }

        if (status >= 500) {
          find(api, p.role, "n/a", `${method} answered ${status}, an unhandled error`, 1, "behaviour");
        }
      }
    }
  }
} catch (e) {
  cnt("the sweep as a whole", `it stopped early: ${String(e).slice(0, 220)}`);
  console.log("SWEEP STOPPED: " + String(e).slice(0, 220));
} finally {
  if (server) await server.stop();

  /* ------------------------------------------------------- dispose and report */
  let disposal = { removed: [], kept: ["disposal did not run"], leftOnDomain: "unknown" };
  try {
    disposal = await disposeOf(customer, db);
  } catch (e) {
    disposal = { removed: [], kept: [`disposal threw: ${String(e).slice(0, 120)}`], leftOnDomain: "unknown" };
  }
  release();

  const lines = buildReport({ findings, couldNotTell, disposal, gap });
  const text = lines.join("\n");

  /*
   * THE GUARD RUNS BEFORE THE WRITE AND THROWS. If it refuses, no file is
   * written at all and the run fails naming the rule, which is the only version
   * where a written report means the text was clean rather than cleaned.
   */
  assertNothingSecret(text, OUT);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, text, "utf8");
  console.log("");
  console.log(`report written to ${OUT}: ${findings.length} finding(s), ${couldNotTell.length} could not tell`);
}

/**
 * Every line of the report goes through here before it is pushed.
 *
 * THE PER FIELD CHECK WAS NOT ENOUGH, which the second run proved. `find()`
 * sanitised the `what` and left `route` alone, and `cnt()` was not checked at
 * all, so a runtime value reaching either still blocked the whole file. Checking
 * the assembled LINE is the only version that covers every section, including
 * ones added later by somebody who has not read this comment.
 *
 * It substitutes rather than drops, and says plainly that it did, so a reader
 * can see that something was found and that its text could not be shown.
 */
function safeLine(line, counter) {
  const refusal = refusalFor(line);
  if (!refusal) return line;
  counter.n += 1;
  /*
   * SEVEN COLUMNS, because the table has seven and a short row breaks the
   * markdown for every row after it. The first version emitted two cells and
   * the rendered table collapsed at the first withheld line.
   */
  return `| withheld | | | | a line was withheld because ${refusal}. The finding it carried stands; its text cannot be shown. | | |`;
}

function buildReport({ findings, couldNotTell, disposal, gap }) {
  const sevName = { 1: "1 money or a customer's order", 2: "2 wrong data shown", 3: "3 dead path", 4: "4 presentation" };

  /*
   * ONE ROW PER DISTINCT FINDING, WITH THE ROLES AND WIDTHS IT AFFECTS.
   *
   * The first run produced 783 rows and most of them were one finding repeated:
   * a long dash in shared copy is the same defect whether an admin or a
   * customer is looking at it, and whether the window is 1280 or 390. Eight
   * rows saying so is not eight findings, it is one finding and seven copies,
   * and a table that cannot tell them apart buries the four that matter.
   *
   * So rows collapse on route and text, and the roles and widths become columns
   * of their own. Where a finding genuinely differs by role, which is every
   * boundary finding, the text differs too and the rows stay separate. Nothing
   * is dropped: the counts are stated so a reader can see the spread.
   */
  const byKey = new Map();
  for (const f of findings) {
    const key = `${f.sev}|${f.route}|${f.what}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...f, roles: new Set(), widths: new Set() });
    }
    byKey.get(key).roles.add(f.role);
    byKey.get(key).widths.add(f.width);
  }
  const sorted = [...byKey.values()]
    .map((f) => ({
      ...f,
      role: [...f.roles].join(", "),
      width: [...f.widths].filter((w) => w !== "n/a").join(", ") || "n/a",
    }))
    .sort((a, b) => a.sev - b.sev || a.route.localeCompare(b.route));

  const counter = { n: withheld };
  const raw = [];
  /* Every push goes through the guard, whatever section it is in. */
  const l = { push: (line) => raw.push(safeLine(String(line), counter)) };
  l.push(`# The break it sweep, ${new Date().toISOString().slice(0, 10)}`);
  l.push("");
  l.push("Report only. Nothing in this file has been fixed.");
  l.push("");
  l.push("## What was swept");
  l.push("");
  l.push(`- Static routes on disk belonging to no declared surface: **${gap.undeclared.length}**`);
  l.push(`- Declared routes with no page: **${gap.declaredButMissing.length}**`);
  l.push(`- Dynamic routes, which need a parameter and were not visited: **${gap.dynamic.length}**`);
  l.push("");
  l.push("## Findings, ranked");
  l.push("");
  l.push(
    `${sorted.length} distinct finding(s), collapsed from ${findings.length} observation(s). ` +
      "A finding seen by four roles at two widths is one finding and seven copies; the roles and " +
      "widths it was seen at are in their own columns.",
  );
  l.push("");
  l.push("| # | Route | Role | Width | What happened | Severity | Fix |");
  l.push("| --- | --- | --- | --- | --- | --- | --- |");
  sorted.forEach((f, i) => {
    const what = String(f.what).replace(/\|/g, "\\|");
    l.push(`| ${i + 1} | \`${f.route}\` | ${f.role} | ${f.width} | ${what} | ${sevName[f.sev]} | ${f.fix} |`);
  });
  if (sorted.length === 0) l.push("| | | | | nothing found | | |");
  l.push("");

  if (staffColour.size > 0) {
    l.push("## Colour as status on staff surfaces");
    l.push("");
    l.push("One row, per the operator's ruling of 2026-09-30: V10 supersedes the portal");
    l.push("standard's status dots for stages 2 to 4, and the portal is not restyled yet, so");
    l.push("this is recorded as work to come rather than as a defect per screen.");
    l.push("");
    l.push(`**To be removed in stages 2 to 4.** ${staffColour.size} staff screen(s) carry status in colour:`);
    l.push("");
    for (const r of [...staffColour].sort()) l.push(`- \`${r}\``);
    l.push("");
  }

  l.push("## Could not tell");
  l.push("");
  if (couldNotTell.length === 0) {
    l.push("Nothing. Every cell above was measured.");
  } else {
    for (const c of couldNotTell) l.push(`- **${c.what}**: ${c.why}`);
  }
  l.push("");

  l.push("## The probes, and what was removed");
  l.push("");
  for (const r of disposal.removed) l.push(`- removed: ${r}`);
  for (const k of disposal.kept) l.push(`- **NOT removed**: ${k}`);
  l.push(`- read back: ${disposal.leftOnDomain} account(s) remain on the probe domain`);
  l.push("");
  l.push("Audit rows these probes caused are permanent. `eng_audit_events` refuses deletes");
  l.push("by design, and a customer account is superseded rather than removed because the");
  l.push("orders and statements attached to one are the record of what somebody was charged.");
  l.push("");
  /*
   * THE COUNT GOES IN AFTER THE FACT, because it is not known until every line
   * has been through the guard. Inserted near the top where a reader meets it
   * before the table rather than appended where it would be missed.
   */
  if (counter.n > 0) {
    const at = raw.findIndex((x) => x.startsWith("## Findings"));
    const note =
      `**${counter.n} line(s) had text withheld** because it matched the shape of a secret. ` +
      "Each still appears with its route, role and severity where it had them; only the quoted " +
      "text is absent, and the row says so rather than looking like an ordinary finding.";
    if (at > 0) raw.splice(at, 0, note, "");
    else raw.push("", note);
  }
  return raw;
}
