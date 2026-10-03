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
import {
  inventoryGap,
  sitemapRoutes,
  routesUnder,
  routesOnDisk,
  apisOnDisk,
  openByDesign,
  openPathsFromProxy,
} from "./lib/routes.mjs";
import { makePrincipals, disposeOf, STAFF_ROLES } from "./lib/principals.mjs";
import { PROBE_DOMAIN } from "../lib/portal-probe.mjs";
import { surfaces, routesOf, apisOf, roleForRoute } from "../lib/surfaces.mjs";
import { PORTS } from "../lib/ports.mjs";

const PORT = Number(process.env.SWEEP_PORT ?? PORTS.sweep);
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

/*
 * What the form abuse and control clicking areas actually reached.
 *
 * Declared up here with the other collectors for the reason the comment above
 * gives: `const` in a temporal dead zone throws rather than reading undefined,
 * and this one is written inside the try block and read inside `buildReport`,
 * which is the exact span where that mistake costs a whole run and a report.
 *
 * It starts as a stated absence rather than as zeroes, because zero forms found
 * and the area never running are different facts and a table of zeroes cannot
 * tell them apart.
 */
const tally = { forms: null, controls: null };

/**
 * Does this principal hold a session that was PROVEN to open its own surface?
 *
 * One predicate, used everywhere, because the old test was `p.cookie` and that
 * was true for four principals whose cookie opened nothing. `makePrincipals`
 * empties `cookies` when its verification fails, so this cannot be true of a
 * principal that was built and never checked.
 */
const hasSession = (p) => p?.role === "signed out" || (Array.isArray(p?.cookies) && p.cookies.length > 0);

/** The `cookie` request header for a principal, or nothing when it is signed out. */
const cookieHeader = (p) =>
  Array.isArray(p?.cookies) && p.cookies.length > 0
    ? { cookie: p.cookies.map((c) => `${c.name}=${c.value}`).join("; ") }
    : {};

/*
 * ===========================================================================
 * A REFUSAL IS NOT A DEFECT, AND THE FIRST RUN THAT COULD SEE ONE CALLED IT ONE.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-01. The moment the staff cookies worked, this sweep
 * reached the portal and produced 56 new rows that were the product refusing
 * correctly: 28 screens answering 404 to a role without the permission, each
 * with its paired console error, plus 12 redirects to a surface root or to a
 * role's own landing screen. 68 of 73 new findings were correct behaviour
 * reported as a dead path.
 *
 * CLAUDE.md records this exact class from 2026-09-19, when four audits reported
 * `/portal/protocols/rc-001` as broken because the admin probe was refused by a
 * licence check the page carries. It was reproduced here, and it was invisible
 * until the sessions worked: the defect was latent behind the broken cookie.
 *
 * SO THE ANSWER COMES FROM THE DECLARATION THAT ALREADY DECIDES IT.
 * `roleForRoute` in `scripts/lib/surfaces.mjs` says which principal opens a
 * route, inheriting down the path. Nothing is guessed and no list is typed here.
 *
 * AND IT IS USED ONLY TO EXCUSE A REFUSAL OF A NON OWNER, WHICH IS THE WHOLE
 * CARE IN IT. That declaration names the principal an audit should probe with,
 * not an exhaustive permission list: admin and csr may both legitimately open a
 * screen declared for one of them. Read as "may open" it would excuse too much.
 * Read as "a refusal of somebody who is NOT the declared owner is expected" it
 * is sound, because a refusal of the DECLARED OWNER stays a finding and that is
 * the case that matters: the role a screen exists for being unable to open it.
 */
const ownerDeclaredFor = (route) => {
  for (const s of surfaces()) {
    if (!s.prefix || !route.startsWith(s.prefix)) continue;
    try {
      return roleForRoute(s, route);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Is this principal the role the route is declared for?
 *
 * The sweep labels staff roles `admin`, `csr`, `technician`, `engineer` while
 * the declaration uses the role KEYS, so the comparison goes through the key the
 * principal already carries rather than through its display label.
 */
const isDeclaredOwner = (p, route) => {
  const owner = ownerDeclaredFor(route);
  if (!owner) return false;
  return owner === (p.roleKey ?? p.role);
};

/** Does this route belong to a surface this principal holds a session for? */
const surfaceOf = (route) =>
  route.startsWith("/portal") ? "portal" : route.startsWith("/partner") ? "partner" : route.startsWith("/account") ? "account" : "public";

const principalSurface = (p) => {
  if (p.role === "signed out") return "none";
  if (p.role === "customer") return "account";
  if (p.role === "partner") return "partner";
  return "portal";
};

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
const OPEN_PATHS = openPathsFromProxy();
console.log(`  ${OPEN.why}`);
console.log(`  ${OPEN_PATHS.why}`);
if (!OPEN_PATHS.read) {
  cnt(
    "which account and partner paths the perimeter lets through",
    `${OPEN_PATHS.why}, so every sign in screen was opened as a signed in principal and the missing-door comparison below ran over an empty set`,
  );
}

/* --------------- 0b. a door for people with no session, behind the perimeter */

/*
 * A DOOR THAT CANNOT BE REACHED BY THE PEOPLE IT IS FOR.
 *
 * The comment above `CUSTOMER_OPEN_PATHS` in `src/proxy.ts` records this exact
 * failure happening to sign up on 2026-09-13, in these words: "A door for people
 * who do not have an account cannot sit behind a check for having one." Nothing
 * was built to stop it recurring. `accounts-audit` asserts the list EXISTS,
 * which is a check on shape rather than on content, and the first sweep then
 * reported two findings against `/account/forgot-password` that were measured on
 * `/account/login`, because the route 307s there.
 *
 * SO THE SUBJECT IS DERIVED FROM THE PURPOSE OF THE SCREEN RATHER THAN LISTED.
 * A route whose own path says it is for somebody who cannot get in, sign in,
 * sign up, recovering a password, or setting one from an emailed token, must be
 * in the perimeter's open set. Every other account route must not be. Both
 * directions are reported, because an account screen wrongly OPEN is a worse
 * defect than a door wrongly shut.
 */
/*
 * THE ENDPOINT IS A DOOR TOO, AND THE FIRST VERSION OF THIS COULD NOT SEE IT.
 *
 * The pattern matched page routes only, so it found the recovery SCREEN shut and
 * said nothing about `/api/account/forgot-password`, which the form posts to and
 * which the same perimeter answers with 401 "Not signed in." Fixing only the
 * screen would have produced a page that renders perfectly and a form that
 * cannot submit, which is a worse state than the one it replaced because the
 * failure moves from the URL bar to after the button press.
 *
 * So the subject is both lists. Pages come from the directory walk and endpoints
 * from the API walk, and each is compared against the same open set.
 */
const NEEDS_NO_SESSION =
  /^\/(api\/)?(account|partner)\/(login|sign-up|forgot-password|set-password|reset-password)$/;
const needsNoSession = [...routesOnDisk(), ...apisOnDisk()]
  .filter((r) => !r.includes("["))
  .filter((r) => NEEDS_NO_SESSION.test(r))
  .sort();
for (const route of needsNoSession) {
  const open = OPEN_PATHS.customer.has(route) || OPEN_PATHS.partner.has(route);
  find(
    route,
    "signed out",
    "n/a",
    open
      ? "it is a door for somebody with no session and the perimeter lets it through"
      : "it is a door for somebody with no session and the perimeter does NOT let it through, so the people it exists for are redirected to sign in",
    open ? 0 : 1,
    "behaviour",
  );
}
if (needsNoSession.length === 0) {
  cnt(
    "whether every door for somebody with no session is open in the perimeter",
    "no route on disk matched the shape of such a door, so the comparison had no subject and proves nothing",
  );
}
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
    if (!hasSession(p)) {
      cnt(
        `every check as ${p.role}`,
        `no session could be built: ${p.fault ?? "no cookie"}. Nothing was measured as this role.`,
      );
    }
    /*
     * "session ok" USED TO MEAN "A STRING CAME BACK", and it was wrong for four
     * of six principals on every run. It now reports what `verify` actually
     * observed, so a reader sees which screen opened rather than a word.
     */
    console.log(
      `  principal ${String(p.role).padEnd(12)} ${hasSession(p) ? `OPENS ITS SURFACE (${p.verified})` : `NO SESSION: ${p.fault}`}`,
    );
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
      if (!hasSession(p)) continue;
      const context = await browser.newContext({
        viewport: { width: width.width, height: width.height },
      });
      if (p.cookies.length > 0) {
        await context.addCookies(
          p.cookies.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })),
        );
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
          /*
           * A 404 TO A ROLE THE SCREEN IS NOT FOR IS THE PERMISSION MODEL, not
           * a dead route. This platform answers 404 rather than 403 so the
           * existence of a screen is not disclosed to somebody who may not see
           * it, which means "declared route, 404" is the EXPECTED answer for
           * every non owner and was being reported as a defect 28 times.
           *
           * A 404 to the role the screen IS declared for is the opposite and
           * stays a finding: the owner cannot open their own screen.
           */
          const owner = ownerDeclaredFor(route);
          const mine = isDeclaredOwner(p, route);
          find(
            route,
            p.role,
            width.name,
            mine
              ? `HTTP 404 on a route declared for this very role, so the role it exists for cannot open it`
              : `HTTP 404, which is how this platform refuses a role the screen is not for. It is declared for ${owner ?? "no role in particular"}`,
            mine ? 2 : 0,
            "behaviour",
          );
          continue;
        }

        /*
         * WHICH PAGE DID WE ACTUALLY GET, and this sweep got it wrong once
         * already before anybody noticed.
         *
         * `page.goto` follows redirects, so a route behind the perimeter answers
         * 200 with somebody else's page. The first run reported two findings
         * against `/account/forgot-password` and both were measured on
         * `/account/login` and `/account/settings`, because that route 307s to
         * sign in for a signed out visitor and to settings for a signed in one.
         * Every row was honestly recorded and attributed to a page the browser
         * never rendered.
         *
         * It is this repository's commonest defect in a new place: the right
         * subject measured in the wrong span. A 200 is not evidence that the
         * route answered; it is evidence that SOMETHING answered.
         *
         * SO THE LANDING IS COMPARED AND THE WALK STOPS HERE. Reporting the
         * redirect is the finding, and measuring the page anyway would file the
         * other page's dashes, promises and height under this route's name.
         *
         * AND IT IS NOT ALWAYS A DEFECT, which is why the note describes rather
         * than accuses. A signed out visitor sent from an account screen to sign
         * in is the perimeter working. The row says where it went and lets a
         * person judge, and the one that mattered was obvious the moment it was
         * written down: a password recovery screen sending somebody to sign in.
         */
        let landed = route;
        try {
          landed = new URL(page.url()).pathname;
        } catch {
          landed = route;
        }
        if (landed !== route) {
          /*
           * WHICH KIND OF REDIRECT, because three of the four are the product
           * working and only one is a defect. Operator ruling, 2026-10-01: the
           * two portal login redirects for a signed in admin are correct
           * behaviour and are to be marked as such.
           */
          const here = surfaceOf(route);
          const mySurface = principalSurface(p);
          const toLogin = /\/(login)(\?|$)/.test(landed);
          const fromDoor = /\/(login|mfa|mfa\/enrol|sign-up|set-password|forgot-password)$/.test(route);

          let why = null;
          let sev = 3;

          if (toLogin && mySurface !== here) {
            /* The perimeter refusing a principal of another surface. Correct. */
            why = `redirected to ${landed}, which is the perimeter refusing a ${p.role} on a ${here} route`;
            sev = 0;
          } else if (fromDoor && mySurface === here) {
            /*
             * A LOGIN OR MFA SCREEN BOUNCING SOMEBODY WHO IS ALREADY SIGNED IN.
             * This is the product working, and it is also the clearest proof in
             * the report that the session is real, so it is recorded rather than
             * dropped.
             */
            why = `redirected to ${landed} because this principal is already signed in, which is what a sign in screen should do`;
            sev = 0;
          } else if (!toLogin && !isDeclaredOwner(p, route)) {
            /* Sent to a surface root or to this role's own landing screen. */
            why = `redirected to ${landed}, which is how this platform sends a role elsewhere when a screen is not theirs. It is declared for ${ownerDeclaredFor(route) ?? "no role in particular"}`;
            sev = 0;
          } else {
            why = `it did not render: the browser was redirected to ${landed}, so nothing below was measured on this route`;
            sev = 3;
          }

          find(route, p.role, width.name, why, sev, "behaviour");
          continue;
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

            /*
             * A PROMISE NEEDS A PROMISOR, AND THE THIRD RUN MEASURED WHAT THAT IS
             * WORTH. Operator ruling, 2026-10-01.
             *
             * The second run reported six sentences and exactly one was a
             * promise: an unsourced market price range on /structural-engineer/cost
             * with an imputed motive beside it. The other five were a form label
             * reading "Counties you usually work in", a paragraph correcting the
             * misconception that a sealed report is a warranty, a sentence about
             * engineering practice, a heading whose body says it is not a
             * diagnostic list, and an honest hedge about what lenders ask for.
             *
             * One in six is a matcher people learn to skim, and skimming is how
             * the one that matters gets missed. The operator refused an exemption
             * list for the five, which is the standing ruling on this shape: an
             * allowlist of instances is a list somebody grows until the check
             * covers nothing.
             *
             * SO THE SUBJECT IS SHARPENED. A promise has somebody doing the
             * promising, and four of the five name the firm nowhere at all.
             * ABOUT_THE_WORK above is too generous on its own because `sealed`
             * and `your report` match a sentence about the industry; this adds the
             * requirement that the firm itself is the subject near the hedge.
             *
             * WHAT IT GIVES UP, stated rather than hidden: a promise phrased
             * without naming the firm, "turnaround is usually two weeks" as a bare
             * heading, would no longer be reported. That is a real gap and it is
             * the right trade against five false rows a reader has to triage. The
             * sentence is still shown for everything it does report, because this
             * is a heuristic and a person makes the judgement.
             */
            const HAS_A_PROMISOR = /\b(we|our|us|this firm|the firm|254)\b/i;

            for (const m of body.matchAll(promise)) {
              const at = m.index ?? 0;
              const before = body.slice(Math.max(0, at - 90), at);
              if (NEGATED.test(before)) continue;
              const sentence = body
                .slice(Math.max(0, at - 70), at + m[0].length + 70)
                .replace(/\s+/g, " ")
                .trim();
              if (!ABOUT_THE_WORK.test(sentence)) continue;
              if (!HAS_A_PROMISOR.test(sentence)) continue;
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
      if (!hasSession(p)) continue;
      for (const method of ["GET", "POST"]) {
        let res = null;
        try {
          res = await fetch(BASE + api, {
            method,
            headers: {
              ...cookieHeader(p),
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
  /* ------------------------------------------------- 4. the auth cases */

  const { runAuthCases } = await import("./lib/auth-cases.mjs");
  await runAuthCases({ base: BASE, customer, db, find, cnt, treatAsSecret });

  /* ------------------------- 5 and 6. form abuse, and every dead control */

  /*
   * ONE PRINCIPAL PER ROUTE, AND IT IS WRITTEN DOWN RATHER THAN ASSUMED.
   *
   * The route walk visits every route as six principals at two widths. Abusing
   * four payloads into every form, and reloading before every single control
   * click, cannot be multiplied by twelve and still finish in an evening. So
   * each route gets the principal whose surface it is, and the report says so,
   * because a reader who believes every role was clicked is wrong about what
   * the green covers. CLAUDE.md: say what the green is over.
   */
  /*
   * WHOSE SCREEN IS THIS, read from the perimeter rather than from the prefix.
   *
   * The first version worked it out from the path, so `/account/login` was
   * opened as a signed in customer, redirected to `/account`, and its form was
   * never abused. A sign in screen belongs to somebody with NO session, and the
   * only place that is written down is `CUSTOMER_OPEN_PATHS` in the perimeter.
   */
  const ownerOf = (route) => {
    const signedOut = principals.find((p) => p.role === "signed out");
    /*
     * A DOOR ON ANY SURFACE BELONGS TO SOMEBODY WITH NO SESSION, staff included.
     * Reading only the customer and partner sets routed /portal/login to the
     * admin, who is signed in and is correctly redirected away from it, which
     * took the portal sign in form out of form abuse the day the sessions
     * started working.
     */
    if (
      OPEN_PATHS.customer.has(route) ||
      OPEN_PATHS.partner.has(route) ||
      OPEN_PATHS.staff.has(route)
    ) {
      return signedOut;
    }
    /*
     * The MFA screens are not in any open set, because they need a HALF
     * authenticated session rather than none. They are still a door, and a
     * signed in admin is redirected off them, so they are owned by nobody this
     * sweep builds and the generic note says so rather than reporting a refusal.
     */
    if (/^\/portal\/mfa(\/|$)/.test(route)) return null;
    if (route.startsWith("/portal")) return principals.find((p) => p.role === "admin");
    if (route.startsWith("/account")) return principals.find((p) => p.role === "customer");
    if (route.startsWith("/partner")) return principals.find((p) => p.role === "partner");
    return signedOut;
  };

  /*
   * THE PARTNER SURFACE NOW HAS A PRINCIPAL. The note that used to sit here
   * said the sweep built none, so those five screens were reached signed out,
   * redirected and reported as unmeasured rather than clean. `makePrincipals`
   * builds one, `verify` proves it opens `/partner`, and `ownerOf` routes the
   * surface to it, so the gap this paragraph declared is closed rather than
   * described. If the partner session ever fails to build, the generic
   * no-session note below names it, which is the shape every other principal
   * already had.
   */

  const { abuseFormsOn } = await import("./lib/form-abuse.mjs");
  const { clickDeadControlsOn } = await import("./lib/dead-controls.mjs");

  const browser2 = await chromium.launch();
  const formTally = { routes: 0, forms: 0, abused: 0, skipped: [] };
  const controlTally = { routes: 0, found: 0, clicked: 0, skipped: [], cappedRoutes: [], widths: [] };

  /*
   * CONTROLS ARE CLICKED AT BOTH WIDTHS, AND THE FIRST RUN IS WHY.
   *
   * It ran at 1280 only and pressed 65 controls across 64 routes, which is
   * roughly one per page and reads like thorough coverage of a product with
   * almost no buttons. The product has a mobile menu button on every single
   * page, and at 1280 that button measures ZERO BY ZERO, so the size filter
   * correctly excluded it and the most obviously pressable control in the whole
   * site was never pressed anywhere.
   *
   * A sweep that cannot see the navigation is not a sweep of the navigation.
   * Forms stay at 1280, because a form's fields do not appear and disappear with
   * the viewport the way a menu does, and four payloads per form per width would
   * double the only expensive part of this for no new subject.
   */
  const CONTROL_WIDTHS = [
    { name: "1280", width: 1280, height: 900 },
    { name: "390", width: 390, height: 844 },
  ];

  try {
    for (const { route } of routes) {
      const p = ownerOf(route);
      if (!hasSession(p)) {
        cnt(
          `form abuse and control clicking on ${route}`,
          `no session could be built for ${p?.role ?? "its owning role"}: ${p?.fault ?? "no principal owns this route"}. The screen was never opened as the principal that owns it`,
        );
        continue;
      }

      const context = await browser2.newContext({ viewport: { width: 1280, height: 900 } });
      if (p.cookies.length > 0) {
        await context.addCookies(
          p.cookies.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })),
        );
      }
      const page = await context.newPage();

      try {
        const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
        if ((res?.status() ?? 0) !== 200) {
          await context.close();
          continue;
        }
        /*
         * THE SAME LANDING CHECK AS THE WALK. Without it these two areas would
         * abuse the sign in form four times and call it this route's form, which
         * is how the first run came to report a submit button labelled "Sign in"
         * on the password recovery screen.
         */
        if (new URL(page.url()).pathname !== route) {
          cnt(
            `form abuse and control clicking on ${route}`,
            `it redirected to ${new URL(page.url()).pathname} as ${p.role}, so its own forms and controls were never reached`,
          );
          await context.close();
          continue;
        }
      } catch {
        await context.close();
        continue;
      }

      try {
        const forms = await abuseFormsOn({
          page,
          route,
          role: p.role,
          find,
          neverPress: NEVER_PRESS,
          probeAddress: customer?.email ?? `sweep@${PROBE_DOMAIN}`,
        });
        if (forms.forms > 0) formTally.routes += 1;
        formTally.forms += forms.forms;
        formTally.abused += forms.abused;
        formTally.skipped.push(...forms.skipped);
      } catch (e) {
        cnt(`form abuse on ${route}`, `it stopped: ${String(e).slice(0, 140)}`);
      }

      let sawAControl = false;
      for (const w of CONTROL_WIDTHS) {
        try {
          await page.setViewportSize({ width: w.width, height: w.height });
          await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
          const controls = await clickDeadControlsOn({
            page,
            route,
            role: `${p.role} at ${w.name}`,
            find,
            neverPress: NEVER_PRESS,
          });
          if (controls.found > 0) sawAControl = true;
          controlTally.found += controls.found;
          controlTally.clicked += controls.clicked;
          controlTally.skipped.push(...controls.skipped);
          if (controls.capped) controlTally.cappedRoutes.push(`${route} at ${w.name} (${controls.found})`);
        } catch (e) {
          cnt(`control clicking on ${route} at ${w.name}`, `it stopped: ${String(e).slice(0, 140)}`);
        }
      }
      if (sawAControl) controlTally.routes += 1;

      await context.close();
    }
  } finally {
    await browser2.close();
  }

  console.log(
    `  forms: ${formTally.forms} found on ${formTally.routes} route(s), ${formTally.abused} submission(s), ${formTally.skipped.length} skipped`,
  );
  console.log(
    `  controls: ${controlTally.found} found on ${controlTally.routes} route(s), ${controlTally.clicked} pressed, ${controlTally.skipped.length} skipped`,
  );

  /*
   * A WALK THAT FOUND NO SUBJECT IS NOT A WALK THAT FOUND NO DEFECTS, and the
   * two read identically in a findings table. CLAUDE.md records this as the
   * vacuous green: ask what the count would be if the mechanism returned
   * nothing, and whether the check could tell. These two say so out loud.
   */
  if (formTally.forms === 0) {
    cnt("form abuse", "no form element was found on any route, so nothing was abused and the area measured nothing");
  }
  if (controlTally.found === 0) {
    cnt("clicking every control", "no pressable control was found on any route, so the area measured nothing");
  }
  tally.forms = formTally;
  tally.controls = controlTally;
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

  const lines = buildReport({ findings, couldNotTell, disposal, gap, tally });
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

function buildReport({ findings, couldNotTell, disposal, gap, tally }) {
  const sevName = {
    0: "confirmed, not a finding",
    1: "1 money or a customer's order",
    2: "2 wrong data shown",
    3: "3 dead path",
    4: "4 presentation",
  };

  /*
   * SEVERITY ZERO IS A CHECK THAT WAS EXERCISED AND HELD, and it is reported
   * separately rather than dropped. "An expired session was refused" is not a
   * finding, but it is the thing the operator asked to be tested, and a sweep
   * that printed only failures would leave him unable to tell a case that
   * passed from one that never ran. The COULD NOT TELL section is the third
   * state, for the ones that genuinely could not be exercised.
   */

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
  const all = [...byKey.values()]
    .map((f) => ({
      ...f,
      role: [...f.roles].join(", "),
      width: [...f.widths].filter((w) => w !== "n/a").join(", ") || "n/a",
    }))
    .sort((a, b) => a.sev - b.sev || a.route.localeCompare(b.route));
  const confirmed = all.filter((f) => f.sev === 0);
  const sorted = all.filter((f) => f.sev > 0);

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

  /*
   * THE BOUNDS OF THE LAST TWO AREAS, STATED BEFORE THE FINDINGS.
   *
   * Both were run as one principal per route at 1280 only, and both skip
   * anything whose label says it takes money or sends something. A reader who
   * assumes otherwise is wrong about what the absence of a finding means, and
   * CLAUDE.md is explicit that where a check depends on a bound, the bound is
   * reported: "a green that announces it compared seventeen thousand things one
   * by one, having compared a thousand, reads as the strongest evidence in the
   * file."
   */
  l.push("### Form abuse, and every control that does not submit");
  l.push("");
  if (!tally?.forms || !tally?.controls) {
    l.push(
      "**These two areas did not run.** The sweep stopped before them, so nothing below " +
        "says anything about forms or controls. See Could not tell.",
    );
    l.push("");
  } else {
    const f = tally.forms;
    const c = tally.controls;
    l.push(
      `Forms: **${f.forms}** found on **${f.routes}** route(s), **${f.abused}** submission(s) made. ` +
        "Each form got four payloads: nothing at all, far too much text, markup, and the wrong " +
        "type in every typed field.",
    );
    l.push("");
    l.push(
      `Controls: **${c.found}** pressable controls that do not submit, found on **${c.routes}** ` +
        `route(s), **${c.clicked}** pressed. A control counts as dead only when pressing it moves ` +
        "none of four things: a DOM mutation, its own aria state, the URL, or a request.",
    );
    l.push("");
    l.push(
      "**One principal per route.** A portal route was opened as admin, an account route as " +
        "the customer, a sign in or recovery screen signed out because that is who it is for, " +
        "and everything else signed out. The owning principal is read from the perimeter's own " +
        "open path set rather than guessed from the prefix. No route was opened as all six " +
        "roles, so a control visible only to one of the others was not pressed.",
    );
    l.push("");
    l.push(
      "**Controls were clicked at 1280 and at 390. Forms were abused at 1280 only.** The first " +
        "run clicked at 1280 alone and pressed roughly one control per page, which reads like " +
        "thorough coverage of a site with no buttons: the mobile menu button measures zero by " +
        "zero at 1280, so the most pressable control in the product was never pressed anywhere. " +
        "A form's fields do not appear and disappear with the viewport the way a menu does, so " +
        "abusing each one twice would have doubled the expensive half for no new subject.",
    );
    l.push("");
    l.push(
      `**${f.skipped.length} form(s) and ${c.skipped.length} control(s) were deliberately not pressed**, ` +
        "because their visible label says they take money or send something. Nothing matching " +
        "pay, checkout, refund, send, email, SMS, notify, invite, resend or place the order was " +
        "touched, which is why this sweep made no charge and sent nothing.",
    );
    l.push("");
    for (const s of [...new Set([...f.skipped, ...c.skipped])].sort().slice(0, 60)) {
      l.push(`- not pressed: ${s}`);
    }
    if (new Set([...f.skipped, ...c.skipped]).size > 60) {
      l.push(`- and ${new Set([...f.skipped, ...c.skipped]).size - 60} more`);
    }
    l.push("");
    if (c.cappedRoutes.length > 0) {
      l.push(
        `**${c.cappedRoutes.length} route(s) have more than forty pressable controls**, and only ` +
          "the first forty were pressed on each. The number found is the true count; the number " +
          "pressed is not. Stated rather than left as a figure that reads like a total: " +
          c.cappedRoutes.join(", "),
      );
      l.push("");
    }
  }
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

  if (confirmed.length > 0) {
    l.push("## Exercised and held");
    l.push("");
    l.push(
      "Not findings. These are the cases the sweep attacked and the product refused " +
        "correctly, listed so a case that PASSED can be told apart from one that never ran.",
    );
    l.push("");
    for (const f of confirmed) l.push(`- \`${f.route}\` as ${f.role}: ${f.what}`);
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
